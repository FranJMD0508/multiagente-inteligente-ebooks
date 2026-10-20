"""Bitácora (`activity`) y eventos de progreso, con los mismos textos que el simulador del frontend."""

from __future__ import annotations

import uuid

from ..models import ActivityEntry, Ebook
from ..store import Store

MAX_ENTRIES = 40


def uid() -> str:
    return str(uuid.uuid4())


def lower_first(text: str) -> str:
    return text[:1].lower() + text[1:] if text else text


def log(store: Store, ebook_id: str, agent: str, message: str, state: str = "hecho", chapter: int | None = None) -> str:
    """Añade una entrada a la bitácora y emite `agent.progress`."""
    entry = ActivityEntry(id=uid(), agent=agent, message=message, state=state)  # type: ignore[arg-type]

    def apply(e: Ebook) -> None:
        e.activity = [*e.activity, entry][-MAX_ENTRIES:]

    store.update(ebook_id, apply)
    _progress(store, ebook_id, agent, message, chapter)
    return entry.id


def edit_log(store: Store, ebook_id: str, entry_id: str, message: str, state: str, chapter: int | None = None) -> None:
    agent = None

    def apply(e: Ebook) -> None:
        nonlocal agent
        for a in e.activity:
            if a.id == entry_id:
                a.message = message
                a.state = state  # type: ignore[assignment]
                agent = a.agent

    store.update(ebook_id, apply)
    if agent:
        _progress(store, ebook_id, agent, message, chapter)


def settle_working(e: Ebook, suffix: str = "") -> None:
    """Marca como hechas las entradas que quedaron "trabajando" (tras cancelar o fallar)."""
    for a in e.activity:
        if a.state == "trabajando":
            a.state = "hecho"
            if suffix and not a.message.endswith(suffix):
                a.message = f"{a.message}{suffix}"


def notice(store: Store, ebook_id: str, text: str) -> None:
    """Mensaje breve para lectores de pantalla (lo mismo que `announce` en el simulador)."""
    store.emit(ebook_id, "notice", text=text)


def _progress(store: Store, ebook_id: str, agent: str, message: str, chapter: int | None) -> None:
    payload = {"agent": agent, "message": message}
    if chapter is not None:
        payload["chapter"] = chapter
    store.emit(ebook_id, "agent.progress", **payload)
