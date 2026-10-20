"""Guardarraíl (RF-01), validaciones del índice, del diseño (RA-03) y de las imágenes de portada."""

from __future__ import annotations

import base64

from .conftest import IDEA_FINANZAS, wait_status

PNG_1PX = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)


async def test_topics_check(client, auth):
    res = await client.post("/api/topics/check", json={"prompt": "Escríbeme una novela de dragones y magia"}, headers=auth)
    body = res.json()
    assert body["ok"] is False
    assert len(body["alternatives"]) == 3 and body["reason"]

    res = await client.post("/api/topics/check", json={"prompt": IDEA_FINANZAS}, headers=auth)
    assert res.json() == {"ok": True, "nicheId": "finanzas"}

    res = await client.post("/api/topics/check", json={"prompt": "Quiero aprender a cocinar sano en casa"}, headers=auth)
    assert res.json() == {"ok": True}


async def test_la_ficcion_se_rechaza_con_alternativas(client, auth, services):
    res = await client.post(
        "/api/ebooks",
        json={"prompt": "Un cuento de fantasía con personajes mágicos", "desiredChapters": "auto", "exercisePref": "auto", "author": ""},
        headers=auth,
    )
    assert res.status_code == 201
    eid = res.json()["id"]
    await wait_status(services, eid, "error")
    ebook = services.store.get(eid)
    assert ebook.error.retryable is False
    assert ebook.error.resume_status == "investigando"
    assert len(ebook.error.alternatives) == 3
    assert ebook.chapters == []
    res = await client.post(f"/api/ebooks/{eid}/retry", headers=auth)
    assert res.status_code == 409


async def test_guardarrail_reutiliza_el_veredicto(client, auth, services):
    await client.post("/api/topics/check", json={"prompt": IDEA_FINANZAS}, headers=auth)
    calls = services.llm.calls.count("orquestador.guardarrail")
    res = await client.post("/api/ebooks", json={"prompt": IDEA_FINANZAS, "desiredChapters": 5, "exercisePref": "auto", "author": "Ana"}, headers=auth)
    await wait_status(services, res.json()["id"], "indice_pendiente")
    assert services.llm.calls.count("orquestador.guardarrail") == calls


async def test_nicho_general_se_ajusta_y_validaciones_del_indice(client, auth, services):
    res = await client.post(
        "/api/ebooks",
        json={"prompt": "Cómo salir de deudas pequeñas y empezar a ahorrar", "desiredChapters": 6, "exercisePref": "checklist", "author": "Ana", "nicheId": "general"},
        headers=auth,
    )
    eid = res.json()["id"]
    await wait_status(services, eid, "indice_pendiente")
    ebook = services.store.get(eid)
    assert ebook.niche_id == "general"  # la persona eligió "general" a propósito
    assert len(ebook.chapters) == 6

    chapters = [{"id": c.id, "title": c.title, "summary": c.summary, "keyPoints": c.key_points} for c in ebook.chapters]
    for bad in (chapters[:4], chapters + chapters[:2]):
        res = await client.put(f"/api/ebooks/{eid}/outline", json={"chapters": bad}, headers=auth)
        assert res.status_code == 422
        assert res.json()["detail"]["message"] == "El índice debe tener entre 5 y 7 capítulos."
    empty = [dict(c) for c in chapters]
    empty[0]["title"] = "  "
    assert (await client.put(f"/api/ebooks/{eid}/outline", json={"chapters": empty}, headers=auth)).status_code == 422
    # Acciones fuera de su pausa.
    assert (await client.post(f"/api/ebooks/{eid}/chapters/1/approve", headers=auth)).status_code == 409
    assert (await client.post(f"/api/ebooks/{eid}/exports", json={"format": "md"}, headers=auth)).status_code == 409


async def test_validaciones_del_diseno(client, auth, services):
    res = await client.post("/api/ebooks", json={"prompt": IDEA_FINANZAS, "desiredChapters": 5, "exercisePref": "auto", "author": "Ana"}, headers=auth)
    eid = res.json()["id"]
    await wait_status(services, eid, "indice_pendiente")

    # Contraste insuficiente con el texto blanco (RA-03).
    res = await client.put(f"/api/ebooks/{eid}/design", json={"clothColor": "#9AD1C3"}, headers=auth)
    assert res.status_code == 422
    detail = res.json()["detail"]
    assert detail["code"] == "contraste" and detail["suggestion"].startswith("#")
    res = await client.put(f"/api/ebooks/{eid}/design", json={"clothColor": detail["suggestion"]}, headers=auth)
    assert res.status_code == 200

    for patch in ({"bodySizePt": 10}, {"coverTemplate": "neon"}, {"pageSize": "B5"}, {"font": "Comic Sans"}, {"titleSize": "xl"}):
        assert (await client.put(f"/api/ebooks/{eid}/design", json=patch, headers=auth)).status_code == 422, patch

    res = await client.put(
        f"/api/ebooks/{eid}/design",
        json={"coverTemplate": "editorial", "titleFont": "Onest", "titleSize": "l", "titleAlign": "center", "bodySizePt": 12, "pageSize": "6x9"},
        headers=auth,
    )
    design = res.json()["design"]
    assert design["coverTemplate"] == "editorial" and design["bodySizePt"] == 12 and design["titleAlign"] == "center"
    assert design["font"] == "Roboto"  # lo omitido no cambia

    # Contraportada parcial: se fusiona con la actual.
    res = await client.put(f"/api/ebooks/{eid}/design", json={"backCover": {"blurb": "Una sinopsis."}}, headers=auth)
    assert res.json()["design"]["backCover"] == {"enabled": True, "blurb": "Una sinopsis."}
    res = await client.put(f"/api/ebooks/{eid}/design", json={"backCover": {"enabled": False}}, headers=auth)
    assert res.json()["design"]["backCover"] == {"enabled": False, "blurb": "Una sinopsis."}


async def test_imagen_de_portada(client, auth, services):
    res = await client.post("/api/ebooks", json={"prompt": IDEA_FINANZAS, "desiredChapters": 5, "exercisePref": "auto", "author": "Ana"}, headers=auth)
    eid = res.json()["id"]

    res = await client.post(f"/api/ebooks/{eid}/cover-image", files={"file": ("notas.txt", b"hola", "text/plain")}, headers=auth)
    assert res.status_code == 415
    res = await client.post(f"/api/ebooks/{eid}/cover-image", files={"file": ("grande.png", PNG_1PX + b"0" * (5 * 1024 * 1024), "image/png")}, headers=auth)
    assert res.status_code == 413

    res = await client.post(f"/api/ebooks/{eid}/cover-image", files={"file": ("foto.png", PNG_1PX, "image/png")}, headers=auth)
    assert res.status_code == 201
    url = res.json()["url"]
    assert url.startswith("/api/assets/") and len(url.rsplit("/", 1)[1]) == 32

    asset = await client.get(url)  # sin sesión
    assert asset.status_code == 200 and asset.headers["content-type"] == "image/png"
    assert "immutable" in asset.headers["cache-control"]

    # El velo mínimo lo calcula el servidor (RA-03): un velo corto se sube en silencio, sin 422.
    image = {"src": url, "placement": "fondo", "veil": 0.3, "minVeil": 0.5, "focusY": 40, "alt": "Una mesa con libretas"}
    res = await client.put(f"/api/ebooks/{eid}/design", json={"coverImage": image}, headers=auth)
    assert res.status_code == 200
    cover = res.json()["design"]["coverImage"]
    assert cover["minVeil"] == 0.85 and cover["veil"] == 0.85  # imagen verde claro sobre la tela de finanzas
    image["veil"] = 0.9
    res = await client.put(f"/api/ebooks/{eid}/design", json={"coverImage": image}, headers=auth)
    assert res.status_code == 200 and res.json()["design"]["coverImage"]["src"] == url
    assert res.json()["design"]["coverImage"]["veil"] == 0.9
    # Parche parcial de la imagen: conserva el resto.
    res = await client.put(f"/api/ebooks/{eid}/design", json={"coverImage": {"focusY": 10}}, headers=auth)
    assert res.json()["design"]["coverImage"]["focusY"] == 10 and res.json()["design"]["coverImage"]["alt"] == "Una mesa con libretas"

    # Una imagen que no es tuya no se acepta.
    other = await client.post("/api/auth/register", json={"name": "Luis", "email": "luis@correo.com", "password": "secreto123"})
    luis = {"Authorization": f"Bearer {other.json()['token']}"}
    res2 = await client.post("/api/ebooks", json={"prompt": IDEA_FINANZAS, "desiredChapters": 5, "exercisePref": "auto", "author": "Luis"}, headers=luis)
    res = await client.put(f"/api/ebooks/{res2.json()['id']}/design", json={"coverImage": {**image, "src": url}}, headers=luis)
    assert res.status_code == 422 and res.json()["detail"]["code"] == "imagen"

    res = await client.put(f"/api/ebooks/{eid}/design", json={"coverImage": None}, headers=auth)
    assert "coverImage" not in res.json()["design"]
    await wait_status(services, eid, "indice_pendiente")
    await wait_status(services, res2.json()["id"], "indice_pendiente")
