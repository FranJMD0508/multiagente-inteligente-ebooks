"""Eventos SSE con un servidor uvicorn de verdad (en un hilo) y un cliente HTTP real."""

from __future__ import annotations

import json
import socket
import threading
import time

import httpx
import pytest
import uvicorn

from app.main import create_app

from .conftest import IDEA_FINANZAS, make_settings


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture
def live_server(tmp_path):
    # Sin red: la verificación de referencias queda en "sin_verificar".
    settings = make_settings(tmp_path, references_lookup=False)
    port = _free_port()
    server = uvicorn.Server(uvicorn.Config(create_app(settings), host="127.0.0.1", port=port, log_level="warning", timeout_graceful_shutdown=1))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    deadline = time.monotonic() + 15
    while not server.started:
        if time.monotonic() > deadline:
            raise RuntimeError("El servidor de pruebas no arrancó")
        time.sleep(0.05)
    yield f"http://127.0.0.1:{port}"
    server.should_exit = True
    thread.join(10)


def _read_events(url: str, token: str, events: list[dict], raw: list[str], stop: threading.Event) -> None:
    with httpx.Client(timeout=httpx.Timeout(30, read=30)) as client:
        with client.stream("GET", f"{url}/api/events", params={"token": token}) as response:
            assert response.status_code == 200
            assert response.headers["content-type"].startswith("text/event-stream")
            for line in response.iter_lines():
                raw.append(line)
                if line.startswith("data: "):
                    events.append(json.loads(line[6:]))
                if stop.is_set():
                    break


def _wait(predicate, timeout=20.0):
    deadline = time.monotonic() + timeout
    while not predicate():
        if time.monotonic() > deadline:
            raise AssertionError("Se agotó el tiempo esperando los eventos")
        time.sleep(0.02)


def test_eventos_sse(live_server):
    url = live_server
    with httpx.Client(base_url=url, timeout=10) as api:
        res = api.post("/api/auth/register", json={"name": "Ana", "email": "ana@correo.com", "password": "secreto123"})
        token = res.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        events: list[dict] = []
        raw: list[str] = []
        stop = threading.Event()
        reader = threading.Thread(target=_read_events, args=(url, token, events, raw, stop), daemon=True)
        reader.start()
        _wait(lambda: any(line.startswith("retry:") for line in raw))

        res = api.post("/api/ebooks", json={"prompt": IDEA_FINANZAS, "desiredChapters": 5, "exercisePref": "auto", "author": "Ana"}, headers=headers)
        eid = res.json()["id"]
        _wait(lambda: any(e["type"] == "checkpoint.required" and e["checkpoint"] == "outline" for e in events))
        res = api.post(f"/api/ebooks/{eid}/outline/approve", headers=headers)
        assert res.status_code == 202
        _wait(lambda: any(e["type"] == "checkpoint.required" and e["checkpoint"] == "chapter1" for e in events))
        stop.set()
        # Un evento más para que el lector salga del bucle.
        api.patch(f"/api/ebooks/{eid}", json={"subtitle": "Para cerrar el stream"}, headers=headers)
        reader.join(10)

    types = [e["type"] for e in events]
    assert all(e.get("ebookId") == eid for e in events)
    for expected in ("run.started", "agent.started", "agent.progress", "ebook.updated", "token", "section.started", "checkpoint.required", "chapter.completed", "notice"):
        assert expected in types, expected
    notices = [e["text"] for e in events if e["type"] == "notice"]
    assert "Es tu turno: revisa el índice." in notices and "Es tu turno: revisa el capítulo 1." in notices

    # Las instantáneas y los tokens se aplican en orden y reconstruyen el texto final.
    state: dict = {}
    for e in events:
        if e["type"] == "ebook.updated":
            state = e["ebook"]
        elif e["type"] == "token":
            sections = state["chapters"][e["chapter"] - 1]["sections"]
            sections[e["section"]] = sections[e["section"]] + e["delta"]
    final = next(e["ebook"] for e in reversed(events) if e["type"] == "ebook.updated")
    assert state["chapters"][0]["sections"] == final["chapters"][0]["sections"]
    tokens = [e for e in events if e["type"] == "token"]
    assert {t["section"] for t in tokens} == {"introduccion", "desarrollo", "ejemplos", "conclusion"}
    sections_started = [e["section"] for e in events if e["type"] == "section.started"]
    assert sections_started == ["introduccion", "desarrollo", "ejemplos", "conclusion", "ejercicio"]
