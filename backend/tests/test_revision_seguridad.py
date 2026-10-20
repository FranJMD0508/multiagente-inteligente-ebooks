"""Hallazgos de la revisión en cuentas y exportación: sesiones tras cambiar la contraseña,
scrypt fuera del bucle de eventos, registros simultáneos, enlaces de las referencias,
HTML crudo en el `.md` e imágenes de otra cuenta."""

from __future__ import annotations

import asyncio
import hashlib
import threading

from app.agents.investigador import ReadingOut, reading_to_reference_data
from app.auth import create_reset_token
from app.export.markdown import build_markdown
from app.models import BackCover, Chapter, ChecklistExercise, Ebook, EbookDesign, Reference, ReferenceData, Sections
from app.references.apa import format_reference

from .conftest import IDEA_FINANZAS, register, wait_status
from .test_guardrail_validations import PNG_1PX

# ---------- Hallazgo 3: cambiar la contraseña cierra las sesiones anteriores ----------


async def test_cambiar_la_contrasena_invalida_los_tokens_anteriores(client, services):
    old = await register(client)
    me = (await client.get("/api/auth/me", headers=old)).json()
    user = await services.store.user_by_id(me["id"])
    sub = services.bus.subscribe(me["id"])  # un stream de eventos abierto con la sesión vieja

    link = create_reset_token(services.secret_key, user["id"], user["password_hash"])
    res = await client.post("/api/auth/reset", json={"token": link, "password": "nueva-clave-1"})
    assert res.status_code == 200
    new = {"Authorization": f"Bearer {res.json()['token']}"}

    assert (await client.get("/api/auth/me", headers=old)).status_code == 401
    assert (await client.get("/api/ebooks", headers=old)).status_code == 401
    assert (await client.get("/api/auth/me", headers=new)).status_code == 200
    assert sub.closed and services.bus.subscriber_count(me["id"]) == 0
    login = await client.post("/api/auth/login", json={"email": "ana@correo.com", "password": "nueva-clave-1"})
    assert (await client.get("/api/auth/me", headers={"Authorization": f"Bearer {login.json()['token']}"})).status_code == 200


# ---------- Hallazgo 7: scrypt en un hilo y con hash de relleno ----------


async def test_scrypt_no_bloquea_el_bucle_y_no_delata_si_existe_la_cuenta(client, monkeypatch):
    await register(client)
    loop_thread = threading.get_ident()
    seen: list[int] = []
    original = hashlib.scrypt

    def spy(*args, **kwargs):
        seen.append(threading.get_ident())
        return original(*args, **kwargs)

    monkeypatch.setattr(hashlib, "scrypt", spy)
    res = await client.post("/api/auth/login", json={"email": "nadie@correo.com", "password": "secreto123"})
    assert res.status_code == 401
    assert len(seen) == 1  # sin cuenta también se calcula un hash: mismo tiempo de respuesta
    res = await client.post("/api/auth/login", json={"email": "ana@correo.com", "password": "otra-clave"})
    assert res.status_code == 401 and len(seen) == 2
    res = await client.post("/api/auth/login", json={"email": "ana@correo.com", "password": "secreto123"})
    assert res.status_code == 200 and len(seen) == 3
    assert loop_thread not in seen  # nunca en el hilo del bucle de eventos


# ---------- Hallazgo 11: dos registros simultáneos con el mismo correo ----------


async def test_registros_simultaneos_con_el_mismo_correo(client):
    body = {"name": "Ana", "email": "dup@correo.com", "password": "secreto123"}
    results = await asyncio.gather(*(client.post("/api/auth/register", json=body) for _ in range(3)))
    assert sorted(r.status_code for r in results) == [201, 409, 409]
    for r in results:
        if r.status_code == 409:
            assert r.json()["detail"] == {"code": "correo_en_uso", "message": "Ya hay una cuenta con ese correo."}
    assert (await client.post("/api/auth/login", json={"email": "dup@correo.com", "password": "secreto123"})).status_code == 200


# ---------- Hallazgo 10: solo enlaces http(s) ----------


async def test_las_referencias_solo_aceptan_enlaces_http(client, auth, services):
    res = await client.post("/api/ebooks", json={"prompt": IDEA_FINANZAS, "desiredChapters": 5, "exercisePref": "auto", "author": "Ana"}, headers=auth)
    eid = res.json()["id"]
    for bad in ("javascript:fetch('https://x.com')", "data:text/html,<script>1</script>", "file:///C:/secreto.txt", "https://"):
        res = await client.post(f"/api/ebooks/{eid}/references", json={"kind": "web", "title": f"Página {bad[:5]}", "url": bad}, headers=auth)
        assert res.status_code == 422, bad
    res = await client.post(f"/api/ebooks/{eid}/references", json={"kind": "web", "title": "Guía", "url": "https://ejemplo.com/guia"}, headers=auth)
    assert res.status_code == 202
    ref = next(r for r in res.json()["references"] if r["title"] == "Guía")
    res = await client.patch(f"/api/ebooks/{eid}/references/{ref['id']}", json={"url": "javascript:alert(1)"}, headers=auth)
    assert res.status_code == 422

    # Lo que proponga el Investigador y lo que ya estuviera guardado tampoco llega al libro.
    data = reading_to_reference_data(ReadingOut(tipo="web", titulo="Algo", url="javascript:alert(1)"))
    assert data.url is None
    legacy = ReferenceData(kind="web", title="Antigua", url="javascript:alert(1)")
    assert "javascript" not in format_reference(legacy, "html") and "javascript" not in format_reference(legacy, "md")
    assert 'href="https://ejemplo.com/a"' in format_reference(ReferenceData(kind="web", title="T", url="https://ejemplo.com/a"), "html")
    await wait_status(services, eid, "indice_pendiente")


# ---------- Hallazgo 13: el .md no lleva HTML crudo ----------


def test_el_md_no_lleva_html_crudo():
    ebook = Ebook(
        id="libro-prueba",
        prompt="idea",
        title='Mi libro <img src="x" onerror="alert(1)">',
        subtitle="<script>alert(1)</script>",
        status="listo",
        chapters=[
            Chapter(
                id="c1",
                number=1,
                status="generado",
                title="Uno <b>negrita</b>",
                summary="",
                sections=Sections(
                    introduccion="Hola <script>fetch('https://x.com')</script> y Tom & Jerry, 3 < 5.",
                    desarrollo="> Una cita con **negrita** y `<code>` dentro.",
                    ejemplos="<!-- oculto --> Un ejemplo <https://ejemplo.com/guia> &copy;",
                    conclusion="Fin <iframe src='https://x.com'></iframe>.",
                ),
                exercise=ChecklistExercise(title="<i>Lista</i>", items=["<u>uno</u>"]),
            )
        ],
        design=EbookDesign(author="Ana <svg onload=alert(1)>", back_cover=BackCover(blurb="<object data=x></object>")),
        references=[Reference(id="r1", kind="web", title="<b>Título</b>", url="javascript:alert(1)")],
        created_at="2026-10-20T00:00:00.000Z",
        updated_at="2026-10-20T00:00:00.000Z",
    )
    md = build_markdown(ebook, provider="demo")
    for raw in ("<img", "<script", "<b>", "<i>", "<u>", "<svg", "<iframe", "<object", "<!-- oculto", "&copy;", "javascript:"):
        assert raw not in md, raw
    # La sintaxis de Markdown y el texto normal se quedan igual.
    assert "> Una cita con **negrita** y `<code>` dentro." in md
    assert "<https://ejemplo.com/guia>" in md and "Tom & Jerry, 3 < 5." in md
    assert "&lt;script>" in md
    # La marca de IA sí es un comentario HTML (P-11).
    assert md.rstrip().endswith("-->") and "<!-- folio: generado-con-ia=true" in md


# ---------- Sospecha: borrar un ebook no borra imágenes de otra cuenta ----------


async def test_borrar_un_ebook_no_borra_imagenes_de_otra_cuenta(client, services):
    ana = await register(client, "ana@correo.com")
    luis = await register(client, "luis@correo.com", "Luis")
    shared_id = "ebook-compartido-01"
    res = await client.post(
        "/api/ebooks", json={"id": shared_id, "prompt": IDEA_FINANZAS, "desiredChapters": 5, "exercisePref": "auto", "author": "Ana"}, headers=ana
    )
    assert res.status_code == 201
    url = (await client.post(f"/api/ebooks/{shared_id}/cover-image", files={"file": ("f.png", PNG_1PX, "image/png")}, headers=ana)).json()["url"]
    await client.put(f"/api/ebooks/{shared_id}/design", json={"coverImage": {"src": url, "veil": 1}}, headers=ana)
    await wait_status(services, shared_id, "indice_pendiente")
    copy = (await client.post(f"/api/ebooks/{shared_id}/duplicate", json={}, headers=ana)).json()["id"]
    assert (await client.delete(f"/api/ebooks/{shared_id}", headers=ana)).status_code == 204
    assert (await client.get(url)).status_code == 200  # la copia la sigue usando

    # Luis reutiliza el identificador que quedó libre y borra su ebook.
    res = await client.post(
        "/api/ebooks", json={"id": shared_id, "prompt": IDEA_FINANZAS, "desiredChapters": 5, "exercisePref": "auto", "author": "Luis"}, headers=luis
    )
    assert res.status_code == 201
    await wait_status(services, shared_id, "indice_pendiente")
    assert (await client.delete(f"/api/ebooks/{shared_id}", headers=luis)).status_code == 204
    assert (await client.get(url)).status_code == 200  # la imagen de Ana sigue ahí
    await wait_status(services, copy, "indice_pendiente")
