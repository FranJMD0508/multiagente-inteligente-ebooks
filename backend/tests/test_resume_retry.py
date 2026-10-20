"""Retomar tras un reinicio, reintentos automáticos (RNF-02), errores reintentables, duplicar y borrar."""

from __future__ import annotations

import asyncio

from .conftest import IDEA_FINANZAS, client_for, make_settings, register, start_services, wait_for, wait_status


async def _create(client, headers, chapters=5) -> str:
    res = await client.post(
        "/api/ebooks",
        json={"prompt": IDEA_FINANZAS, "desiredChapters": chapters, "exercisePref": "auto", "author": "Ana"},
        headers=headers,
    )
    assert res.status_code == 201
    return res.json()["id"]


async def test_retomar_una_pausa_tras_reiniciar(tmp_path):
    settings = make_settings(tmp_path)
    services = await start_services(settings)
    async with client_for(services) as client:
        headers = await register(client)
        eid = await _create(client, headers)
        await wait_status(services, eid, "indice_pendiente")
    await services.stop()

    # "Reinicio": servicios nuevos sobre los mismos SQLite.
    services = await start_services(settings)
    try:
        assert await services.runner.paused_at(eid) == "outline"
        async with client_for(services) as client:
            login = await client.post("/api/auth/login", json={"email": "ana@correo.com", "password": "secreto123"})
            headers = {"Authorization": f"Bearer {login.json()['token']}"}
            assert (await client.get(f"/api/ebooks/{eid}", headers=headers)).json()["status"] == "indice_pendiente"
            res = await client.post(f"/api/ebooks/{eid}/outline/approve", headers=headers)
            assert res.status_code == 202
            await wait_status(services, eid, "cap1_pendiente")
    finally:
        await services.stop()


async def test_retomar_un_capitulo_a_medias_tras_reiniciar(tmp_path):
    settings = make_settings(tmp_path)
    services = await start_services(settings)
    async with client_for(services) as client:
        headers = await register(client)
        eid = await _create(client, headers)
        await wait_status(services, eid, "indice_pendiente")
        await client.post(f"/api/ebooks/{eid}/outline/approve", headers=headers)
        await wait_status(services, eid, "cap1_pendiente")
        # El capítulo 3 se queda colgado: así el servidor "se apaga" a mitad de la redacción.
        services.llm.inject_failure("redactor.capitulo", when=lambda ctx: ctx["number"] == 3, hang=True)
        await client.post(f"/api/ebooks/{eid}/chapters/1/approve", headers=headers)
        await wait_for(lambda: services.store.get(eid).chapter(3).status == "generando", what="el capítulo 3 en marcha")
    await services.stop()

    services = await start_services(settings)
    try:
        await wait_status(services, eid, "listo")
        ebook = services.store.get(eid)
        assert all(c.sections and c.exercise for c in ebook.chapters)
        assert all(a.state == "hecho" for a in ebook.activity)
    finally:
        await services.stop()


async def test_reintento_automatico_por_tiempo_limite(tmp_path):
    services = await start_services(make_settings(tmp_path, chapter_timeout_s=0.4))
    try:
        async with client_for(services) as client:
            headers = await register(client)
            eid = await _create(client, headers)
            await wait_status(services, eid, "indice_pendiente")
            # El primer intento del capítulo 1 supera el tiempo límite; el reintento automático lo escribe.
            services.llm.inject_failure("redactor.capitulo", times=1, hang=True)
            await client.post(f"/api/ebooks/{eid}/outline/approve", headers=headers)
            await wait_status(services, eid, "cap1_pendiente")
            assert services.store.get(eid).chapters[0].exercise is not None
    finally:
        await services.stop()


async def test_error_reintentable_y_reintento(client, services):
    headers = await register(client)
    eid = await _create(client, headers, chapters=6)
    await wait_status(services, eid, "indice_pendiente")
    await client.post(f"/api/ebooks/{eid}/outline/approve", headers=headers)
    await wait_status(services, eid, "cap1_pendiente")

    # El capítulo 4 falla dos veces (intento + reintento automático) → error reintentable.
    services.llm.inject_failure("redactor.capitulo", times=2, when=lambda ctx: ctx["number"] == 4)
    await client.post(f"/api/ebooks/{eid}/chapters/1/approve", headers=headers)
    await wait_status(services, eid, "error")
    ebook = services.store.get(eid)
    assert ebook.error.message == "No pudimos terminar el capítulo 4"
    assert ebook.error.chapter == 4 and ebook.error.retryable and ebook.error.resume_status == "redactando"
    assert ebook.chapter(4).status == "error"
    assert all(ebook.chapter(n).status == "generado" for n in (2, 3))
    assert all(a.state == "hecho" for a in ebook.activity)

    res = await client.post(f"/api/ebooks/{eid}/retry", headers=headers)
    assert res.status_code == 202 and res.json()["status"] == "redactando"
    await wait_status(services, eid, "listo")
    assert all(c.exercise for c in services.store.get(eid).chapters)


async def test_duplicar_en_pausa_y_borrar(client, services):
    headers = await register(client)
    eid = await _create(client, headers)
    await wait_status(services, eid, "indice_pendiente")

    res = await client.post(f"/api/ebooks/{eid}/duplicate", json={}, headers=headers)
    assert res.status_code == 201
    copy = res.json()
    assert copy["title"].endswith(" (copia)") and copy["status"] == "indice_pendiente" and copy["id"] != eid
    await wait_for(lambda: not services.runner.running(copy["id"]))
    assert await services.runner.paused_at(copy["id"]) == "outline"

    # La copia sigue su propio camino.
    await client.post(f"/api/ebooks/{copy['id']}/outline/approve", headers=headers)
    await wait_status(services, copy["id"], "cap1_pendiente")
    assert services.store.get(eid).status == "indice_pendiente"

    listing = (await client.get("/api/ebooks", headers=headers)).json()
    assert [e["id"] for e in listing] == [copy["id"], eid]  # más reciente primero

    assert (await client.delete(f"/api/ebooks/{eid}", headers=headers)).status_code == 204
    assert (await client.get(f"/api/ebooks/{eid}", headers=headers)).status_code == 404
    assert (await services.runner.snapshot(eid)).values == {}
    await asyncio.sleep(0)
