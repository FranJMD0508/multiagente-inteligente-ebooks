"""Hallazgos de la revisión en piezas de infraestructura: verificación de referencias editadas a
mitad de camino, colas SSE acotadas, escritura diferida que se reintenta y tiempo límite del PDF."""

from __future__ import annotations

import asyncio
import json
import threading

import httpx
import pytest

from app import store as store_module
from app.events import MAX_QUEUE, EventBus, sse_stream
from app.export.pdf import PdfRenderer, PdfTimeout

from . import bibliography
from .conftest import IDEA_FINANZAS, client_for, make_settings, register, start_services, wait_for, wait_status

# ---------- Hallazgo 2: referencia editada mientras se verifica ----------


class SlowTransport(httpx.AsyncBaseTransport):
    """Crossref y Open Library simulados, con un poco de retraso."""

    def __init__(self, delay: float = 0.3) -> None:
        self.inner = bibliography.transport()
        self.delay = delay

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        await asyncio.sleep(self.delay)
        return await self.inner.handle_async_request(request)


async def test_editar_una_referencia_mientras_se_verifica_no_la_deja_pendiente(tmp_path):
    services = await start_services(make_settings(tmp_path), transport=SlowTransport())
    try:
        async with client_for(services) as client:
            headers = await register(client)
            res = await client.post(
                "/api/ebooks", json={"prompt": IDEA_FINANZAS, "desiredChapters": 5, "exercisePref": "auto", "author": "Ana"}, headers=headers
            )
            eid = res.json()["id"]
            await wait_status(services, eid, "indice_pendiente")
            ref = {"kind": "articulo", "title": "A Global Measure of Perceived Stress", "authors": ["Cohen, Sheldon"], "year": "1983", "doi": "10.2307/2136404"}
            res = await client.post(f"/api/ebooks/{eid}/references", json=ref, headers=headers)
            ref_id = next(r["id"] for r in res.json()["references"] if r["origin"] == "usuario")
            await asyncio.sleep(0.1)  # la verificación está en vuelo
            res = await client.patch(f"/api/ebooks/{eid}/references/{ref_id}", json={"year": "1984"}, headers=headers)
            assert res.status_code == 202

            def current():
                return next(r for r in services.store.get(eid).references if r.id == ref_id)

            await wait_for(lambda: current().check != "pendiente", 10, "el resultado de la verificación")
            # El resultado corresponde a los datos nuevos: la fuente dice 1983 y lo propone como corrección.
            assert current().check == "verificada" and current().match is not None and current().match.year == "1983"
    finally:
        await services.stop()


# ---------- Sospecha: colas SSE acotadas ----------


async def test_un_cliente_sse_que_no_lee_se_desconecta_en_lugar_de_acumular():
    bus = EventBus()
    sub = bus.subscribe("u1")
    for i in range(MAX_QUEUE + 10):
        bus.publish("u1", {"type": "token", "ebookId": "e1", "delta": str(i)})
    # Al llenarse la cola se cierra la suscripción, se vacía y se quita del bus.
    assert sub.closed and bus.subscriber_count("u1") == 0
    assert sub.queue.qsize() == 1 and sub.queue.get_nowait() is None

    # También por tamaño: unas pocas instantáneas enormes bastan.
    big = bus.subscribe("u2")
    for _ in range(40):
        bus.publish("u2", {"type": "ebook.updated", "ebookId": "e2", "ebook": {"texto": "x" * 1_000_000}})
    assert big.closed and bus.subscriber_count("u2") == 0


async def test_la_suscripcion_sse_empieza_con_la_respuesta():
    bus = EventBus()
    stream = sse_stream(bus, "u1", None, lambda: [{"type": "ebook.updated", "ebookId": "e1", "ebook": {}}], ping_seconds=5)
    # Si el cliente se va antes de que empiece la respuesta, no queda nada suscrito.
    assert bus.subscriber_count("u1") == 0
    assert await stream.__anext__() == "retry: 3000\n\n"
    assert bus.subscriber_count("u1") == 1
    first = await stream.__anext__()
    assert json.loads(first[6:])["type"] == "ebook.updated"
    bus.publish("u1", {"type": "token", "ebookId": "e1", "delta": "hola"})
    assert json.loads((await stream.__anext__())[6:])["delta"] == "hola"
    await stream.aclose()
    assert bus.subscriber_count("u1") == 0


# ---------- Sospecha: la escritura diferida se reintenta si falla ----------


async def test_si_falla_la_escritura_diferida_se_reintenta(client, auth, services, monkeypatch):
    monkeypatch.setattr(store_module, "FLUSH_RETRY_S", 0.1, raising=False)
    res = await client.post("/api/ebooks", json={"prompt": IDEA_FINANZAS, "desiredChapters": 5, "exercisePref": "auto", "author": "Ana"}, headers=auth)
    eid = res.json()["id"]
    await wait_status(services, eid, "indice_pendiente")
    await services.store.flush()

    db = services.store.db
    original = db.executemany
    failures = {"n": 0}

    async def failing_executemany(*args, **kwargs):
        if failures["n"] == 0:
            failures["n"] += 1
            raise RuntimeError("disco lleno")
        return await original(*args, **kwargs)

    monkeypatch.setattr(db, "executemany", failing_executemany)
    await client.patch(f"/api/ebooks/{eid}", json={"title": "Título guardado tras el reintento"}, headers=auth)

    async def saved_title() -> str | None:
        async with db.execute("SELECT data FROM ebooks WHERE id = ?", (eid,)) as cur:
            row = await cur.fetchone()
        return json.loads(row[0])["title"] if row else None

    for _ in range(100):  # sin otro cambio en el ebook; solo el reintento lo puede guardar
        if failures["n"] and await saved_title() == "Título guardado tras el reintento":
            break
        await asyncio.sleep(0.05)
    assert failures["n"] == 1
    assert await saved_title() == "Título guardado tras el reintento"


# ---------- Sospecha: tiempo límite del PDF ----------


async def test_el_pdf_tiene_tiempo_limite():
    renderer = PdfRenderer(timeout_s=0.3)
    cancelled = threading.Event()  # se marca desde el hilo del navegador

    async def never_ends(html: str) -> bytes:
        try:
            await asyncio.sleep(3600)
        except asyncio.CancelledError:
            cancelled.set()
            raise
        return b""

    renderer._render = never_ends  # type: ignore[method-assign]
    try:
        loop = asyncio.get_running_loop()
        start = loop.time()
        with pytest.raises(PdfTimeout):
            await renderer.render("<html></html>")
        assert loop.time() - start < 5
        # El trabajo del hilo del navegador también se cancela.
        assert await asyncio.to_thread(cancelled.wait, 5)
    finally:
        await renderer.close()
