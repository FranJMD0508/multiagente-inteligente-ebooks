"""Hallazgos de la revisión en el orquestador: reintentos que conservan lo editado, la pausa del
capítulo 1 (RF-05) tras un reinicio, el historial del índice y fallos inesperados repetidos."""

from __future__ import annotations

import pytest

from .conftest import IDEA_FINANZAS, client_for, make_settings, register, start_services, wait_for, wait_idle, wait_status


async def _create(client, headers, chapters=5) -> str:
    res = await client.post(
        "/api/ebooks",
        json={"prompt": IDEA_FINANZAS, "desiredChapters": chapters, "exercisePref": "auto", "author": "Ana"},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def _to_chapter_one(client, headers, services) -> str:
    eid = await _create(client, headers)
    await wait_status(services, eid, "indice_pendiente")
    assert (await client.post(f"/api/ebooks/{eid}/outline/approve", headers=headers)).status_code == 202
    await wait_status(services, eid, "cap1_pendiente")
    return eid


# ---------- Hallazgo 1: reintentar solo el ejercicio ----------


@pytest.mark.parametrize("sin_checkpoint", [False, True])
async def test_reintentar_un_ejercicio_conserva_el_texto_editado(client, auth, services, sin_checkpoint):
    eid = await _to_chapter_one(client, auth, services)
    services.llm.inject_failure("ejercicios.ejercicio", times=1, when=lambda ctx: ctx["number"] == 3)
    await client.post(f"/api/ebooks/{eid}/chapters/1/approve", headers=auth)
    await wait_status(services, eid, "error", timeout=30)
    ebook = services.store.get(eid)
    assert ebook.error.chapter == 3 and ebook.error.retryable
    c3 = ebook.chapter(3)
    assert c3.sections is not None and c3.sections.conclusion and c3.exercise is None

    edited = "MI CONCLUSIÓN EDITADA A MANO, con un primer paso para esta semana."
    res = await client.patch(f"/api/ebooks/{eid}/chapters/3", json={"section": "conclusion", "text": edited}, headers=auth)
    assert res.status_code == 200
    if sin_checkpoint:
        # Sin checkpoint (p. ej. base de datos de checkpoints perdida) el grafo entra por el Redactor.
        await services.runner.saver.adelete_thread(eid)

    written_before = services.llm.calls.count("redactor.capitulo")
    res = await client.post(f"/api/ebooks/{eid}/retry", headers=auth)
    assert res.status_code == 202
    assert res.json()["chapters"][2]["sections"]["conclusion"] == edited
    await wait_status(services, eid, "listo", timeout=60)

    c3 = services.store.get(eid).chapter(3)
    assert c3.sections.conclusion == edited
    assert c3.exercise is not None and c3.status == "editado"
    # El capítulo 3 no se reescribió: el Redactor solo escribió el 4 y el 5.
    assert services.llm.calls.count("redactor.capitulo") - written_before == 2


async def test_reintentar_tras_fallar_el_texto_reescribe_el_capitulo(client, auth, services):
    eid = await _to_chapter_one(client, auth, services)
    services.llm.inject_failure("redactor.capitulo", times=2, when=lambda ctx: ctx["number"] == 2)
    await client.post(f"/api/ebooks/{eid}/chapters/1/approve", headers=auth)
    await wait_status(services, eid, "error", timeout=30)
    res = await client.post(f"/api/ebooks/{eid}/retry", headers=auth)
    assert res.status_code == 202 and "sections" not in res.json()["chapters"][1]
    await wait_status(services, eid, "listo", timeout=60)
    c2 = services.store.get(eid).chapter(2)
    assert c2.sections.conclusion and c2.exercise is not None and c2.status == "generado"


# ---------- Hallazgo 5: RF-05, la pausa del capítulo 1 no se salta ----------


@pytest.mark.parametrize("status_en_disco", ["redactando_cap1", "redactando"])
async def test_reinicio_con_el_capitulo_1_escrito_no_salta_su_pausa(tmp_path, status_en_disco):
    settings = make_settings(tmp_path)
    services = await start_services(settings)
    async with client_for(services) as client:
        headers = await register(client)
        eid = await _to_chapter_one(client, headers, services)
        # Estado en disco si el servidor se apaga entre el ejercicio del capítulo 1 y la pausa
        # (el estado se guarda con escritura diferida): el capítulo 1 escrito, sin aprobar.
        services.store.update(eid, lambda e: setattr(e, "status", status_en_disco))
    await services.stop()

    services = await start_services(settings)
    try:
        await wait_for(
            lambda: services.store.get(eid).status in ("cap1_pendiente", "listo", "error") and not services.runner.running(eid),
            30,
            "a que el ebook se detenga",
        )
        ebook = services.store.get(eid)
        assert ebook.status == "cap1_pendiente"
        assert [c.status for c in ebook.chapters[1:]] == ["pendiente"] * 4
        assert all(c.sections is None for c in ebook.chapters[1:])
        assert await services.runner.paused_at(eid) == "chapter1"
        # Al aprobar, el libro sigue con normalidad.
        async with client_for(services) as client:
            login = await client.post("/api/auth/login", json={"email": "ana@correo.com", "password": "secreto123"})
            headers = {"Authorization": f"Bearer {login.json()['token']}"}
            assert (await client.post(f"/api/ebooks/{eid}/chapters/1/approve", headers=headers)).status_code == 202
            await wait_status(services, eid, "listo", timeout=60)
    finally:
        await services.stop()


# ---------- Hallazgo 12: el historial del índice no se duplica ----------


async def test_reinicio_mientras_se_rehace_el_indice_no_duplica_el_historial(tmp_path):
    settings = make_settings(tmp_path)
    services = await start_services(settings)
    async with client_for(services) as client:
        headers = await register(client)
        eid = await _create(client, headers)
        await wait_status(services, eid, "indice_pendiente")
        titles = [c.title for c in services.store.get(eid).chapters]
        services.llm.inject_failure("investigador.indice", hang=True)
        res = await client.post(f"/api/ebooks/{eid}/outline/regenerate", json={"feedback": "más corto"}, headers=headers)
        assert res.status_code == 202
        await wait_for(lambda: services.llm.calls.count("investigador.indice") == 2, what="la nueva versión en marcha")
        assert len(services.store.get(eid).outline_history) == 1
    await services.stop()

    services = await start_services(settings)
    try:
        await wait_idle(services, eid)
        ebook = services.store.get(eid)
        assert ebook.status == "indice_pendiente" and ebook.busy is None
        assert ebook.outline_history == []
        assert [c.title for c in ebook.chapters] == titles
        assert await services.runner.paused_at(eid) == "outline"
    finally:
        await services.stop()


async def test_duplicar_mientras_se_rehace_el_indice_no_duplica_el_historial(client, auth, services):
    eid = await _create(client, auth)
    await wait_status(services, eid, "indice_pendiente")
    titles = [c.title for c in services.store.get(eid).chapters]
    services.llm.inject_failure("investigador.indice", hang=True)
    await client.post(f"/api/ebooks/{eid}/outline/regenerate", json={"feedback": "más corto"}, headers=auth)
    await wait_for(lambda: services.llm.calls.count("investigador.indice") == 2, what="la nueva versión en marcha")

    res = await client.post(f"/api/ebooks/{eid}/duplicate", json={}, headers=auth)
    assert res.status_code == 201
    copy = res.json()
    assert copy["outlineHistory"] == [] and "busy" not in copy
    assert [c["title"] for c in copy["chapters"]] == titles
    await wait_idle(services, copy["id"])
    assert await services.runner.paused_at(copy["id"]) == "outline"

    await client.post(f"/api/ebooks/{eid}/cancel", headers=auth)
    assert services.store.get(eid).outline_history == []


# ---------- Sospecha: fallo inesperado repetido al volver a la pausa ----------


async def test_un_fallo_inesperado_al_volver_a_la_pausa_no_se_repite_sin_fin(client, auth, services, monkeypatch):
    eid = await _create(client, auth)
    await wait_status(services, eid, "indice_pendiente")
    calls = {"n": 0}

    async def broken(*args, **kwargs):
        calls["n"] += 1
        if calls["n"] > 50:
            return None  # sin este tope, la versión anterior se llamaba a sí misma sin fin
        raise RuntimeError("fallo inesperado del grafo")

    monkeypatch.setattr(services.runner.graph, "ainvoke", broken)
    await services.runner._invoke(eid, None)
    # El intento original y una sola recolocación en la pausa.
    assert calls["n"] == 2
    ebook = services.store.get(eid)
    assert ebook.status == "indice_pendiente" and ebook.busy is None
