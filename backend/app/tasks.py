"""Gestor de tareas asyncio por ebook.

Cada ebook tiene como mucho una tarea principal (la ejecución del grafo) y
varias tareas secundarias con nombre (lecturas recomendadas, verificación de
referencias…), que no bloquean el pipeline.
"""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from collections.abc import Coroutine
from typing import Any

log = logging.getLogger("folio.tasks")


class TaskManager:
    def __init__(self) -> None:
        self._main: dict[str, asyncio.Task] = {}
        self._side: dict[str, dict[str, asyncio.Task]] = defaultdict(dict)
        self._closing = False

    # ----- tarea principal (grafo) -----

    def run(self, ebook_id: str, coro: Coroutine[Any, Any, Any]) -> asyncio.Task:
        if self._closing:
            coro.close()
            raise RuntimeError("El servidor se está apagando")
        previous = self._main.get(ebook_id)
        if previous is not None and not previous.done():
            previous.cancel()
        task = asyncio.create_task(coro, name=f"grafo:{ebook_id}")
        self._main[ebook_id] = task

        def _done(t: asyncio.Task) -> None:
            if self._main.get(ebook_id) is t:
                self._main.pop(ebook_id, None)
            if not t.cancelled() and t.exception() is not None:
                log.error("La tarea del ebook %s terminó con error", ebook_id, exc_info=t.exception())

        task.add_done_callback(_done)
        return task

    def running(self, ebook_id: str) -> bool:
        task = self._main.get(ebook_id)
        return task is not None and not task.done()

    def current(self, ebook_id: str) -> asyncio.Task | None:
        return self._main.get(ebook_id)

    async def cancel(self, ebook_id: str) -> None:
        """Cancela la tarea principal y espera a que termine."""
        task = self._main.pop(ebook_id, None)
        if task is None or task.done() or task is asyncio.current_task():
            return
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)

    async def wait(self, ebook_id: str, timeout: float | None = None) -> None:
        task = self._main.get(ebook_id)
        if task is not None:
            await asyncio.wait_for(asyncio.shield(task), timeout)

    # ----- tareas secundarias -----

    def spawn(self, ebook_id: str, key: str, coro: Coroutine[Any, Any, Any]) -> asyncio.Task:
        """Lanza una tarea secundaria; si ya hay una con la misma clave en marcha, la reutiliza."""
        existing = self._side[ebook_id].get(key)
        if existing is not None and not existing.done():
            coro.close()
            return existing
        task = asyncio.create_task(coro, name=f"{key}:{ebook_id}")
        self._side[ebook_id][key] = task

        def _done(t: asyncio.Task) -> None:
            if self._side.get(ebook_id, {}).get(key) is t:
                self._side[ebook_id].pop(key, None)
            if not t.cancelled() and t.exception() is not None:
                log.error("La tarea %s del ebook %s falló", key, ebook_id, exc_info=t.exception())

        task.add_done_callback(_done)
        return task

    def side_running(self, ebook_id: str, key: str) -> bool:
        task = self._side.get(ebook_id, {}).get(key)
        return task is not None and not task.done()

    async def wait_side(self, ebook_id: str, timeout: float | None = None) -> None:
        tasks = [t for t in self._side.get(ebook_id, {}).values() if not t.done()]
        if tasks:
            await asyncio.wait_for(asyncio.gather(*tasks, return_exceptions=True), timeout)

    async def cancel_all(self, ebook_id: str) -> None:
        await self.cancel(ebook_id)
        side = self._side.pop(ebook_id, {})
        for task in side.values():
            task.cancel()
        if side:
            await asyncio.gather(*side.values(), return_exceptions=True)

    async def shutdown(self) -> None:
        self._closing = True
        tasks = [t for t in self._main.values() if not t.done()]
        for group in self._side.values():
            tasks.extend(t for t in group.values() if not t.done())
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        self._main.clear()
        self._side.clear()
