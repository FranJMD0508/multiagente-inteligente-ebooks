"""Bus de eventos por usuario y serialización SSE (docs/03 §6).

Cada evento se serializa a JSON en el momento de publicarse: así una
instantánea (`ebook.updated`) refleja el estado exacto de ese instante y los
`token` que llegan después se pueden aplicar en orden sobre ella.

Cada suscripción tiene una cola acotada (en eventos y en bytes). Si un cliente
deja de leer y la cola se llena, se le cierra el stream (el navegador se
reconecta solo y recibe una instantánea nueva) en lugar de acumular memoria.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass, field

log = logging.getLogger("folio.events")

PING_SECONDS = 15.0
MAX_QUEUE = 2000  # eventos pendientes por cliente
MAX_QUEUE_BYTES = 16 * 1024 * 1024  # y bytes pendientes (las instantáneas de un libro entero pesan)


@dataclass(eq=False)
class Subscription:
    user_id: str
    ebook_id: str | None = None
    queue: asyncio.Queue[str | None] = field(default_factory=asyncio.Queue)
    closed: bool = False
    pending_bytes: int = 0


class EventBus:
    def __init__(self) -> None:
        self._subs: dict[str, set[Subscription]] = defaultdict(set)

    def subscribe(self, user_id: str, ebook_id: str | None = None) -> Subscription:
        sub = Subscription(user_id=user_id, ebook_id=ebook_id)
        self._subs[user_id].add(sub)
        return sub

    def unsubscribe(self, sub: Subscription) -> None:
        sub.closed = True
        subs = self._subs.get(sub.user_id)
        if subs is not None:
            subs.discard(sub)
            if not subs:
                self._subs.pop(sub.user_id, None)

    def _drop(self, sub: Subscription) -> None:
        """Cierra una suscripción: la quita del bus, vacía su cola (libera la memoria) y
        despierta al stream para que termine."""
        self.unsubscribe(sub)
        while not sub.queue.empty():
            sub.queue.get_nowait()
        sub.pending_bytes = 0
        sub.queue.put_nowait(None)

    def publish(self, user_id: str | None, event: dict) -> None:
        if not user_id:
            return
        subs = self._subs.get(user_id)
        if not subs:
            return
        data = json.dumps(event, ensure_ascii=False, separators=(",", ":"))
        ebook_id = event.get("ebookId")
        for sub in list(subs):
            if sub.closed or (sub.ebook_id is not None and sub.ebook_id != ebook_id):
                continue
            if sub.queue.qsize() >= MAX_QUEUE or sub.pending_bytes + len(data) > MAX_QUEUE_BYTES:
                log.warning("Cliente SSE demasiado lento; se cierra su stream para que se reconecte.")
                self._drop(sub)
                continue
            sub.queue.put_nowait(data)
            sub.pending_bytes += len(data)

    def subscriber_count(self, user_id: str) -> int:
        return len(self._subs.get(user_id, ()))

    def close_user(self, user_id: str) -> None:
        """Cierra los streams de una persona (p. ej. al cambiar la contraseña)."""
        for sub in list(self._subs.get(user_id, ())):
            self._drop(sub)

    def close_all(self) -> None:
        for subs in list(self._subs.values()):
            for sub in list(subs):
                self._drop(sub)


def sse_data(payload: str) -> str:
    return f"data: {payload}\n\n"


async def sse_stream(
    bus: EventBus,
    user_id: str,
    ebook_id: str | None,
    snapshot: Callable[[], list[dict]],
    *,
    is_disconnected: Callable[[], Awaitable[bool]] | None = None,
    ping_seconds: float = PING_SECONDS,
) -> AsyncIterator[str]:
    """Genera el stream SSE: instantáneas iniciales, eventos y `: ping` cada 15 s.

    La suscripción se crea al empezar a enviar la respuesta, no antes: si el cliente
    se va antes de que empiece, no queda una suscripción huérfana acumulando eventos.
    Suscripción e instantáneas van seguidas, sin `await` de por medio, así que no se
    pierde ningún evento entre las dos.
    """
    sub = bus.subscribe(user_id, ebook_id)
    try:
        initial = snapshot()
        yield "retry: 3000\n\n"
        for event in initial:
            yield sse_data(json.dumps(event, ensure_ascii=False, separators=(",", ":")))
        while True:
            try:
                item = await asyncio.wait_for(sub.queue.get(), timeout=ping_seconds)
            except TimeoutError:
                if is_disconnected is not None and await is_disconnected():
                    break
                yield ": ping\n\n"
                continue
            if item is None:
                break
            sub.pending_bytes = max(0, sub.pending_bytes - len(item))
            yield sse_data(item)
    finally:
        bus.unsubscribe(sub)
