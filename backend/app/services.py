"""Contenedor de servicios: store, bus de eventos, tareas, LLM, grafo, PDF y referencias."""

from __future__ import annotations

import logging

import aiosqlite
import httpx
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

from .auth import load_secret_key
from .config import Settings
from .events import EventBus
from .export.pdf import PdfRenderer
from .graph.guardrail import GuardrailCache
from .graph.runner import GraphRunner
from .llm import LLMProvider, get_provider
from .references.lookup import ReferenceClient
from .references.service import ReadingsService
from .store import Store
from .tasks import TaskManager

log = logging.getLogger("folio")


class Services:
    def __init__(
        self,
        settings: Settings,
        *,
        llm: LLMProvider | None = None,
        references_transport: httpx.AsyncBaseTransport | None = None,
        pdf: PdfRenderer | None = None,
    ) -> None:
        self.settings = settings
        self.bus = EventBus()
        self.store = Store(settings.db_path, self.bus)
        self.tasks = TaskManager()
        self.llm = llm or get_provider(settings)
        self.refs = ReferenceClient(
            mailto=settings.crossref_mailto,
            timeout_s=settings.references_timeout_s,
            enabled=settings.references_lookup,
            transport=references_transport,
        )
        self.pdf = pdf or PdfRenderer(settings.pdf_browser_channel, timeout_s=settings.pdf_timeout_s)
        self.guardrail_cache = GuardrailCache()
        self.readings = ReadingsService(self)
        self.secret_key = ""
        self._runner: GraphRunner | None = None
        self._checkpoints: aiosqlite.Connection | None = None

    @property
    def runner(self) -> GraphRunner:
        if self._runner is None:
            raise RuntimeError("Los servicios no se han iniciado")
        return self._runner

    async def start(self, *, resume: bool = True) -> None:
        self.settings.data_dir.mkdir(parents=True, exist_ok=True)
        self.secret_key = load_secret_key(self.settings)
        await self.store.open()
        self._checkpoints = await aiosqlite.connect(self.settings.checkpoints_path)
        saver = AsyncSqliteSaver(self._checkpoints)
        await saver.setup()
        self._runner = GraphRunner(self, saver)
        log.info("Proveedor de LLM: %s (%s)", self.llm.name, self.llm.model)
        if resume:
            await self._runner.resume_all()

    async def stop(self) -> None:
        await self.tasks.shutdown()
        self.bus.close_all()
        await self.store.close()
        if self._checkpoints is not None:
            await self._checkpoints.close()
            self._checkpoints = None
        await self.refs.aclose()
        await self.llm.aclose()
        await self.pdf.close()
