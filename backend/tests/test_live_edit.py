"""Edición en vivo: el servidor devuelve lo mismo que la persona tiene en pantalla
(sin recortar espacios mientras escribe) y la limpieza completa se hace al exportar."""

from __future__ import annotations

from app.agents.redactor import live_markdown, normalize_markdown

from .conftest import IDEA_FINANZAS, wait_status
from .test_guardrail_validations import PNG_1PX


def test_live_markdown_solo_convierte_encabezados():
    assert live_markdown("Hola ") == "Hola "
    assert live_markdown("Uno\n\n\n\nDos ") == "Uno\n\n\n\nDos "
    assert live_markdown("# Título manual") == "### Título manual"
    assert live_markdown("## Otro\n#### Más") == "### Otro\n### Más"
    assert live_markdown("### Ya es H3 ") == "### Ya es H3 "
    assert live_markdown("#motivación") == "#motivación"  # sin espacio no es un encabezado
    # Al exportar sí se limpia todo.
    assert normalize_markdown("Hola \n\n\n\nDos\n# Título") == "Hola \n\nDos\n### Título"
    assert normalize_markdown("#motivación") == "#motivación"


async def test_titulo_y_texto_sin_recortar_mientras_se_edita(client, auth, services):
    res = await client.post("/api/ebooks", json={"prompt": IDEA_FINANZAS, "desiredChapters": 5, "exercisePref": "auto", "author": "Ana"}, headers=auth)
    eid = res.json()["id"]
    await wait_status(services, eid, "indice_pendiente")

    res = await client.patch(f"/api/ebooks/{eid}", json={"title": "Mi libro ", "subtitle": "Para ti "}, headers=auth)
    assert res.status_code == 200
    assert res.json()["title"] == "Mi libro " and res.json()["subtitle"] == "Para ti "
    res = await client.patch(f"/api/ebooks/{eid}", json={"title": "   "}, headers=auth)
    assert res.status_code == 422

    res = await client.put(f"/api/ebooks/{eid}/design", json={"author": "Ana ", "backCover": {"blurb": "Una sinopsis "}}, headers=auth)
    assert res.json()["design"]["author"] == "Ana " and res.json()["design"]["backCover"]["blurb"] == "Una sinopsis "

    await client.post(f"/api/ebooks/{eid}/outline/approve", headers=auth)
    await wait_status(services, eid, "cap1_pendiente")
    await client.post(f"/api/ebooks/{eid}/chapters/1/approve", headers=auth)
    await wait_status(services, eid, "listo", timeout=60)

    res = await client.patch(f"/api/ebooks/{eid}/chapters/1", json={"section": "introduccion", "text": "Hola \n\n# Subtítulo"}, headers=auth)
    assert res.json()["chapters"][0]["sections"]["introduccion"] == "Hola \n\n### Subtítulo"

    md = (await client.post(f"/api/ebooks/{eid}/exports", json={"format": "md"}, headers=auth)).text
    assert md.startswith("# Mi libro\n") and "*Para ti*" in md and "Por Ana\n" in md


async def test_velo_hasta_1_y_anio_con_letra(client, auth, services):
    res = await client.post("/api/ebooks", json={"prompt": IDEA_FINANZAS, "desiredChapters": 5, "exercisePref": "auto", "author": "Ana"}, headers=auth)
    eid = res.json()["id"]
    url = (await client.post(f"/api/ebooks/{eid}/cover-image", files={"file": ("foto.png", PNG_1PX, "image/png")}, headers=auth)).json()["url"]
    image = {"src": url, "placement": "fondo", "veil": 1, "minVeil": 1, "focusY": 50, "alt": ""}
    res = await client.put(f"/api/ebooks/{eid}/design", json={"coverImage": image}, headers=auth)
    assert res.status_code == 200, res.text
    assert res.json()["design"]["coverImage"]["veil"] == 1

    ref = {"kind": "libro", "authors": ["Clear, James"], "year": "2018a", "title": "Atomic habits", "publisher": "Avery"}
    res = await client.post(f"/api/ebooks/{eid}/references", json=ref, headers=auth)
    assert res.status_code in (200, 201, 202), res.text
    assert any(r["year"] == "2018a" for r in res.json()["references"])
