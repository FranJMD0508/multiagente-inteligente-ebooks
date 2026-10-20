"""Ejecución del grafo: una tarea asyncio por ebook, reanudación de pausas, reintentos y arranque."""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from typing import TYPE_CHECKING, Any

from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from langgraph.types import Command

from ..models import Ebook
from .activity import notice, settle_working
from .builder import build_graph
from .mutations import reset_generating_chapters, restore_previous_outline, undo_chapter_one_adjustment
from .nodes import EbookGone, NodeFailure, Nodes
from .state import PAUSE_STATUSES, WORKING_STATUSES, entry_for_status

if TYPE_CHECKING:
    from ..services import Services

log = logging.getLogger("folio.runner")

CHECKPOINT_NODES = {"outline": "punto_control_indice", "chapter1": "punto_control_cap1"}
CHECKPOINT_ENTRY = {"outline": "indice", "chapter1": "cap1"}


def checkpoint_for_status(status: str) -> str | None:
    return {"indice_pendiente": "outline", "cap1_pendiente": "chapter1"}.get(status)


class GraphRunner:
    def __init__(self, services: Services, saver: AsyncSqliteSaver) -> None:
        self.s = services
        self.saver = saver
        self.nodes = Nodes(services)
        self.graph = build_graph(self.nodes).compile(checkpointer=saver)
        self._locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

    # ---------- utilidades ----------

    def lock(self, ebook_id: str) -> asyncio.Lock:
        """Cerrojo por ebook para las acciones del usuario (evita dobles clics simultáneos)."""
        return self._locks[ebook_id]

    @staticmethod
    def config(ebook_id: str) -> dict:
        return {"configurable": {"thread_id": ebook_id}, "recursion_limit": 200}

    async def snapshot(self, ebook_id: str):
        return await self.graph.aget_state(self.config(ebook_id))

    async def paused_at(self, ebook_id: str) -> str | None:
        """"outline" o "chapter1" si el hilo está detenido en ese punto de control."""
        snap = await self.snapshot(ebook_id)
        if not snap.next or not snap.interrupts:
            return None
        for checkpoint, node in CHECKPOINT_NODES.items():
            if node in snap.next:
                return checkpoint
        return None

    def running(self, ebook_id: str) -> bool:
        return self.s.tasks.running(ebook_id)

    # ---------- ejecución ----------

    async def _invoke(self, ebook_id: str, payload: Any) -> None:
        if self.s.store.get(ebook_id) is None:
            return
        self.s.store.emit(ebook_id, "run.started")
        try:
            await self.graph.ainvoke(payload, self.config(ebook_id), durability="sync")
        except asyncio.CancelledError:
            raise
        except (NodeFailure, EbookGone):
            pass
        except Exception as exc:  # noqa: BLE001 - cualquier fallo inesperado deja el ebook en un estado manejable
            log.exception("Fallo inesperado en el grafo del ebook %s", ebook_id)
            await self._unexpected(ebook_id, exc)

    async def _unexpected(self, ebook_id: str, exc: Exception) -> None:
        ebook = self.s.store.get(ebook_id)
        if ebook is None or ebook.status in ("error", "listo"):
            return
        checkpoint = checkpoint_for_status(ebook.status)
        if checkpoint is not None:
            # Falló un cambio durante una pausa: se vuelve a la versión anterior y a la pausa.
            self.s.store.update(ebook_id, self._undo_busy)
            notice(self.s.store, ebook_id, "No pudimos terminar ese cambio. Sigue la versión anterior.")
            await self._fresh(ebook_id, CHECKPOINT_ENTRY[checkpoint])
            return
        self.nodes.fail(ebook_id, "Algo salió mal mientras trabajábamos en tu ebook", resume_status=ebook.status)

    @staticmethod
    def _undo_busy(e: Ebook) -> None:
        if e.busy is not None and e.busy.kind == "indice":
            restore_previous_outline(e)
        if e.busy is not None and e.busy.kind == "capitulo1":
            undo_chapter_one_adjustment(e)
        e.busy = None
        settle_working(e)

    async def _fresh(self, ebook_id: str, entry: str) -> None:
        """Hilo nuevo desde `entry` (borra el checkpoint anterior)."""
        await self.saver.adelete_thread(ebook_id)
        await self._invoke(ebook_id, {"ebook_id": ebook_id, "entry": entry, "action": None, "params": {}})

    def start(self, ebook_id: str, entry: str = "inicio") -> None:
        self.s.tasks.run(ebook_id, self._fresh(ebook_id, entry))

    def resume(self, ebook_id: str, decision: dict) -> None:
        """Reanuda una pausa con `Command(resume=...)`."""
        self.s.tasks.run(ebook_id, self._invoke(ebook_id, Command(resume=decision)))

    def continue_(self, ebook_id: str) -> None:
        """Vuelve a ejecutar el nodo que quedó pendiente (tras un error o un reinicio)."""
        self.s.tasks.run(ebook_id, self._invoke(ebook_id, None))

    async def ensure_paused(self, ebook_id: str, checkpoint: str) -> None:
        """Garantiza que el hilo esté detenido en el punto de control antes de reanudarlo.

        Si falta el checkpoint (base de datos nueva, reinicio a mitad de un cambio…),
        se crea un hilo nuevo que llega a la pausa sin tocar el ebook.
        """
        if await self.paused_at(ebook_id) == checkpoint:
            return
        await self.s.tasks.cancel(ebook_id)
        await self.saver.adelete_thread(ebook_id)
        await self.graph.ainvoke(
            {"ebook_id": ebook_id, "entry": CHECKPOINT_ENTRY[checkpoint], "action": None, "params": {}},
            self.config(ebook_id),
            durability="sync",
        )

    async def reset_to_pause(self, ebook_id: str, checkpoint: str) -> None:
        """Recoloca el grafo en la pausa (tras cancelar un trabajo en curso)."""
        await self.s.tasks.cancel(ebook_id)
        await self.saver.adelete_thread(ebook_id)
        await self.graph.ainvoke(
            {"ebook_id": ebook_id, "entry": CHECKPOINT_ENTRY[checkpoint], "action": None, "params": {}},
            self.config(ebook_id),
            durability="sync",
        )

    async def retry(self, ebook_id: str) -> None:
        """Relanza el nodo que falló (`ainvoke(None)`) o, si no hay checkpoint, entra por el estado."""
        ebook = self.s.store.get(ebook_id)
        if ebook is None:
            return
        snap = await self.snapshot(ebook_id)
        if snap.next and not snap.interrupts:
            self.continue_(ebook_id)
        else:
            self.start(ebook_id, entry_for_status(ebook.status))

    async def delete(self, ebook_id: str) -> None:
        await self.s.tasks.cancel_all(ebook_id)
        await self.saver.adelete_thread(ebook_id)

    # ---------- arranque del servidor ----------

    async def resume_all(self) -> None:
        """Retoma el trabajo interrumpido por un reinicio (como `simulator.resume`)."""
        store = self.s.store
        for ebook_id in store.all_ids():
            ebook = store.get(ebook_id)
            if ebook is None:
                continue
            if ebook.busy is not None:

                def clear_busy(e: Ebook) -> None:
                    if e.busy is not None and e.busy.kind == "capitulo1" and e.chapter_one_history:
                        undo_chapter_one_adjustment(e)
                    e.busy = None
                    settle_working(e)

                store.update(ebook_id, clear_busy)
            self.s.readings.resume(ebook_id)
            if ebook.status in WORKING_STATUSES:

                def prepare(e: Ebook) -> None:
                    reset_generating_chapters(e)
                    settle_working(e)

                store.update(ebook_id, prepare)
                try:
                    snap = await self.snapshot(ebook_id)
                except Exception:  # noqa: BLE001
                    snap = None
                if snap is not None and snap.next and not snap.interrupts:
                    log.info("Retomando %s (%s) desde %s", ebook_id, ebook.status, snap.next)
                    self.continue_(ebook_id)
                else:
                    log.info("Retomando %s (%s) con un hilo nuevo", ebook_id, ebook.status)
                    self.start(ebook_id, entry_for_status(ebook.status))
            elif ebook.status in PAUSE_STATUSES:
                checkpoint = checkpoint_for_status(ebook.status)
                if checkpoint and await self.paused_at(ebook_id) != checkpoint:
                    self.s.tasks.run(ebook_id, self._fresh(ebook_id, CHECKPOINT_ENTRY[checkpoint]))
