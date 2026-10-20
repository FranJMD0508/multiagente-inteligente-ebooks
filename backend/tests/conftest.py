"""Fixtures: servicios con el proveedor demo, base de datos temporal y sin red."""

from __future__ import annotations

import asyncio
import time
from collections.abc import Callable

import httpx
import pytest

from app.config import Settings
from app.llm.demo import DemoProvider
from app.main import create_app
from app.services import Services

from . import bibliography


def make_settings(tmp_path, **overrides) -> Settings:
    values = {
        "llm_provider": "demo",
        "demo_delay_ms": 0,
        "ui_step_delay_ms": 0,
        "data_dir": tmp_path / "data",
        "secret_key": "clave-de-pruebas-con-longitud-suficiente-para-hs256",
        "chapter_timeout_s": 5,
        "references_lookup": True,
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


@pytest.fixture
def settings(tmp_path) -> Settings:
    return make_settings(tmp_path)


async def start_services(settings: Settings, transport: httpx.AsyncBaseTransport | None = None) -> Services:
    services = Services(settings, llm=DemoProvider(delay_ms=0), references_transport=transport or bibliography.transport())
    await services.start()
    return services


@pytest.fixture
async def services(settings):
    svc = await start_services(settings)
    yield svc
    await svc.stop()


def client_for(services: Services) -> httpx.AsyncClient:
    app = create_app(services=services)
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


@pytest.fixture
async def client(services):
    async with client_for(services) as c:
        yield c


async def register(client: httpx.AsyncClient, email: str = "ana@correo.com", name: str = "Ana") -> dict:
    res = await client.post("/api/auth/register", json={"name": name, "email": email, "password": "secreto123"})
    assert res.status_code == 201, res.text
    return {"Authorization": f"Bearer {res.json()['token']}"}


@pytest.fixture
async def auth(client) -> dict:
    return await register(client)


async def wait_for(predicate: Callable[[], bool], timeout: float = 15.0, what: str = "la condición") -> None:
    start = time.monotonic()
    while not predicate():
        if time.monotonic() - start > timeout:
            raise AssertionError(f"Se agotó el tiempo esperando {what}")
        await asyncio.sleep(0.01)


async def wait_status(services: Services, ebook_id: str, status: str, timeout: float = 15.0) -> None:
    def ok() -> bool:
        ebook = services.store.get(ebook_id)
        return ebook is not None and ebook.status == status and ebook.busy is None and not services.runner.running(ebook_id)

    await wait_for(ok, timeout, f"el estado {status}")
    # La tarea del grafo termina justo después del último cambio; se espera a que suelte el hilo.
    await asyncio.sleep(0.02)


async def wait_idle(services: Services, ebook_id: str, timeout: float = 15.0) -> None:
    def ok() -> bool:
        ebook = services.store.get(ebook_id)
        return ebook is not None and ebook.busy is None and not services.runner.running(ebook_id)

    await wait_for(ok, timeout, "a que termine el trabajo")


async def wait_references(services: Services, ebook_id: str, timeout: float = 15.0) -> None:
    def ok() -> bool:
        ebook = services.store.get(ebook_id)
        return (
            ebook is not None
            and ebook.references_state in ("listo", "error")
            and all(r.check != "pendiente" for r in ebook.references)
            and not services.tasks.side_running(ebook_id, "lecturas")
        )

    await wait_for(ok, timeout, "las lecturas recomendadas")


IDEA_FINANZAS = "Una guía para universitarios que llegan a fin de mes sin dinero: presupuesto, gastos hormiga y primeros ahorros."
