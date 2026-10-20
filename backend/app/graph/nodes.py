"""Nodos del grafo. Reproducen las transiciones, la bitácora y los anuncios de `simulator.ts`.

Los nodos leen y escriben el ebook en el store (que publica los eventos) y
llaman a los agentes. El estado de LangGraph solo guarda lo mínimo para saber
por dónde va el flujo.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import time
from typing import TYPE_CHECKING

from langgraph.types import interrupt

from ..agents import ejercicios, investigador, maquetador, redactor
from ..agents.redactor import ChapterRequest, ChapterStreamParser
from ..llm import LLMError
from ..models import SECTION_LABELS, Chapter, Ebook, EbookError, Sections
from ..niches import GENERAL_NICHE, get_niche
from .activity import edit_log, log, lower_first, notice, settle_working, uid
from .guardrail import Verdict, check_topic
from .mutations import restore_previous_outline, to_chapters, undo_chapter_one_adjustment
from .state import GraphState

if TYPE_CHECKING:
    from ..services import Services

logger = logging.getLogger("folio.graph")

PENDING = ("pendiente", "generando", "error")


class NodeFailure(Exception):
    """Un nodo dejó el ebook en `error`; el grafo se detiene y el checkpoint queda antes del nodo."""


class IncompleteChapter(Exception):
    """El capítulo terminó sin alguna de sus cuatro secciones (RF-03)."""


class EbookGone(Exception):
    """El ebook se borró mientras el grafo trabajaba."""


def now_ms() -> float:
    return time.time() * 1000


class Nodes:
    def __init__(self, services: Services) -> None:
        self.s = services

    # ---------- utilidades ----------

    @property
    def store(self):
        return self.s.store

    def _ebook(self, ebook_id: str) -> Ebook:
        ebook = self.store.get(ebook_id)
        if ebook is None:
            raise EbookGone(ebook_id)
        return ebook

    async def _step_pause(self, factor: float = 1.0) -> None:
        delay = self.s.settings.ui_step_delay_ms * factor
        await asyncio.sleep(delay / 1000 if delay > 0 else 0)

    def _patch_chapter(self, ebook_id: str, number: int, fn) -> None:
        def apply(e: Ebook) -> None:
            chapter = e.chapter(number)
            if chapter is not None:
                fn(chapter)

        self.store.update(ebook_id, apply)

    def fail(self, ebook_id: str, message: str, *, resume_status: str, chapter: int | None = None, retryable: bool = True) -> None:
        """Deja el ebook en `error` con el mismo formato que el simulador."""

        def apply(e: Ebook) -> None:
            if chapter is not None:
                target = e.chapter(chapter)
                if target is not None:
                    target.status = "error"
                    target.current_section = None
            settle_working(e)
            e.status = "error"
            e.busy = None
            e.error = EbookError(message=message, chapter=chapter, retryable=retryable, resume_status=resume_status)  # type: ignore[arg-type]

        self.store.update(ebook_id, apply)
        self.store.emit(ebook_id, "run.failed", error=message, retryable=retryable)
        notice(self.store, ebook_id, f"{message}. Puedes reintentarlo." if retryable else message)

    # ---------- Guardarraíl (orquestador) ----------

    async def guardarrail(self, state: GraphState) -> dict:
        eid = state["ebook_id"]
        ebook = self._ebook(eid)

        def reset(e: Ebook) -> None:
            e.status = "investigando"
            e.chapters = []
            e.activity = []
            e.error = None
            e.busy = None

        self.store.update(eid, reset)
        self.store.emit(eid, "agent.started", agent="investigador")
        reading = log(self.store, eid, "investigador", "Leyendo tu idea…", "trabajando")
        verdict = await check_topic(self.s.llm, self.s.guardrail_cache, ebook.prompt)
        self.store.set_internal(eid, guardrail=verdict.to_dict())

        if not verdict.valid:
            edit_log(self.store, eid, reading, "Esta idea no encaja con Folio", "hecho")

            def reject(e: Ebook) -> None:
                e.status = "error"
                e.error = EbookError(
                    message=verdict.reason,
                    retryable=False,
                    resume_status="investigando",
                    alternatives=verdict.alternatives,
                )

            self.store.update(eid, reject)
            self.store.emit(eid, "run.failed", error=verdict.reason, retryable=False)
            notice(self.store, eid, verdict.reason)
            return {"rejected": True}

        internal = self.store.internal(eid)

        def apply_classification(e: Ebook) -> None:
            # Si el nicho era "general" y el LLM elige uno del catálogo, se adopta con su tela.
            if not internal.get("nicheFromUser") and e.niche_id == "general" and verdict.niche_id != "general":
                niche = get_niche(verdict.niche_id)
                e.niche_id = niche.id
                if e.design.cloth_color.upper() == GENERAL_NICHE.cloth.upper():
                    e.design.cloth_color = niche.cloth
                if not internal.get("audienceFromUser"):
                    e.audience = niche.audience
            if not internal.get("audienceFromUser") and verdict.audience:
                e.audience = verdict.audience

        self.store.update(eid, apply_classification)
        niche = get_niche(self._ebook(eid).niche_id)
        edit_log(self.store, eid, reading, f"Tema válido: {niche.label.lower()}", "hecho")
        return {"rejected": False}

    @staticmethod
    def route_guardrail(state: GraphState) -> str:
        return "fin" if state.get("rejected") else "investigador"

    # ---------- Investigador ----------

    async def investigador(self, state: GraphState) -> dict:
        if state.get("action") == "regenerate":
            return await self._regenerate_outline(state)
        eid = state["ebook_id"]
        ebook = self._ebook(eid)
        self.store.emit(eid, "agent.started", agent="investigador")

        def clear(e: Ebook) -> None:
            e.chapters = []
            e.error = None

        self.store.update(eid, clear)
        await self._step_pause(2)
        log(self.store, eid, "investigador", f"Público: {lower_first(ebook.audience)}")

        internal = self.store.internal(eid)
        guard = Verdict.from_dict(internal["guardrail"]) if internal.get("guardrail") else None
        niche = get_niche(ebook.niche_id)
        sensitivity = guard.sensitivity if guard and guard.sensitivity != "ninguno" else niche.sensitivity
        announced = False
        if sensitivity != "ninguno":
            await self._step_pause(1.5)
            log(self.store, eid, "investigador", "Tema sensible: se incluirá un aviso legal")
            announced = True
        self.store.update(eid, lambda e: setattr(e, "sensitivity", sensitivity))

        desired = ebook.desired_chapters
        proposing = log(
            self.store,
            eid,
            "investigador",
            "Proponiendo capítulos…" if desired == "auto" else f"Proponiendo capítulos · 0 de {desired}",
            "trabajando",
        )
        try:
            outline = await investigador.propose_outline(
                self.s.llm,
                idea=ebook.prompt,
                niche_id=ebook.niche_id,
                audience=ebook.audience,
                sensitivity=sensitivity,
                desired=desired,
            )
        except LLMError as exc:
            logger.warning("El Investigador no pudo proponer el índice de %s: %s", eid, exc)
            self.fail(eid, "No pudimos proponer el índice", resume_status="investigando")
            raise NodeFailure(str(exc)) from exc

        # La sensibilidad del LLM manda si no es "ninguno"; nunca se rebaja la del nicho.
        final_sensitivity = outline.sensibilidad if outline.sensibilidad != "ninguno" else sensitivity
        if final_sensitivity != "ninguno" and not announced:
            log(self.store, eid, "investigador", "Tema sensible: se incluirá un aviso legal")

        def apply_meta(e: Ebook) -> None:
            e.title = outline.titulo
            e.subtitle = outline.subtitulo
            e.sensitivity = final_sensitivity  # type: ignore[assignment]

        self.store.update(eid, apply_meta)
        self.store.set_internal(eid, brief=outline.brief.model_dump())

        total = len(outline.capitulos)
        edit_log(self.store, eid, proposing, f"Proponiendo capítulos · 0 de {total}", "trabajando")
        for k, item in enumerate(outline.capitulos):
            await self._step_pause()
            chapter = Chapter(
                id=uid(), number=k + 1, status="pendiente", title=item.titulo, summary=item.resumen, key_points=item.puntosClave
            )
            self.store.update(eid, lambda e, c=chapter: setattr(e, "chapters", [*e.chapters, c]))
            edit_log(self.store, eid, proposing, f"Proponiendo capítulos · {k + 1} de {total}", "trabajando")
        await self._step_pause()
        edit_log(self.store, eid, proposing, f"Índice propuesto: {total} capítulos", "hecho")
        self.store.emit(eid, "agent.completed", agent="investigador")
        return {"action": None, "params": {}}

    async def _regenerate_outline(self, state: GraphState) -> dict:
        eid = state["ebook_id"]
        ebook = self._ebook(eid)
        feedback = str((state.get("params") or {}).get("feedback") or "").strip()
        self.store.emit(eid, "agent.started", agent="investigador")
        entry = log(
            self.store,
            eid,
            "investigador",
            f"Rehaciendo el índice: “{feedback[:60]}”" if feedback else "Rehaciendo el índice",
            "trabajando",
        )
        try:
            outline = await investigador.propose_outline(
                self.s.llm,
                idea=ebook.prompt,
                niche_id=ebook.niche_id,
                audience=ebook.audience,
                sensitivity=ebook.sensitivity,
                desired=ebook.desired_chapters,
                previous=ebook.chapters,
                feedback=feedback,
                variant=len(ebook.outline_history),
            )
        except LLMError as exc:
            logger.warning("No se pudo rehacer el índice de %s: %s", eid, exc)

            def undo(e: Ebook) -> None:
                restore_previous_outline(e)
                e.busy = None

            self.store.update(eid, undo)
            edit_log(self.store, eid, entry, "No pudimos rehacer el índice; sigue la versión anterior", "hecho")
            notice(self.store, eid, "No pudimos rehacer el índice. Sigue la versión anterior.")
            return {"action": None, "params": {}}

        items = [
            Chapter(id=uid(), number=i + 1, status="pendiente", title=c.titulo, summary=c.resumen, key_points=c.puntosClave)
            for i, c in enumerate(outline.capitulos)
        ]

        def apply(e: Ebook) -> None:
            e.chapters = to_chapters(items)
            e.busy = None

        await self._step_pause()
        self.store.update(eid, apply)
        self.store.set_internal(eid, brief=outline.brief.model_dump())
        edit_log(self.store, eid, entry, "Nueva versión del índice lista", "hecho")
        notice(self.store, eid, "Nueva versión del índice lista.")
        self.store.emit(eid, "agent.completed", agent="investigador")
        return {"action": None, "params": {}}

    async def investigador_capitulo(self, state: GraphState) -> dict:
        eid = state["ebook_id"]
        ebook = self._ebook(eid)
        chapter_id = str((state.get("params") or {}).get("chapterId") or "")
        target = next((c for c in ebook.chapters if c.id == chapter_id), None)
        if target is None:
            self.store.update(eid, lambda e: setattr(e, "busy", None))
            return {"action": None, "params": {}}
        self.store.emit(eid, "agent.started", agent="investigador")
        try:
            alt = await investigador.alternative_chapter(
                self.s.llm,
                book_title=ebook.title,
                idea=ebook.prompt,
                audience=ebook.audience,
                niche_id=ebook.niche_id,
                chapters=ebook.chapters,
                target=target,
            )
        except LLMError as exc:
            logger.warning("No se pudo proponer otro capítulo para %s: %s", eid, exc)
            self.store.update(eid, lambda e: setattr(e, "busy", None))
            notice(self.store, eid, "No pudimos proponer otro capítulo. Inténtalo de nuevo.")
            return {"action": None, "params": {}}

        def apply(e: Ebook) -> None:
            for c in e.chapters:
                if c.id == chapter_id:
                    c.id = uid()
                    c.title = alt.titulo
                    c.summary = alt.resumen
                    c.key_points = list(alt.puntosClave)
            e.busy = None

        self.store.update(eid, apply)
        notice(self.store, eid, "Capítulo reemplazado en el índice.")
        self.store.emit(eid, "agent.completed", agent="investigador")
        return {"action": None, "params": {}}

    # ---------- Punto de control 1: índice ----------

    async def marcar_indice(self, state: GraphState) -> dict:
        eid = state["ebook_id"]
        if self._ebook(eid).status != "indice_pendiente":
            self.store.update(eid, lambda e: setattr(e, "status", "indice_pendiente"))
            self.store.emit(eid, "checkpoint.required", checkpoint="outline")
            notice(self.store, eid, "Es tu turno: revisa el índice.")
        return {}

    async def punto_control_indice(self, state: GraphState) -> dict:
        # Sin efectos antes de interrupt(): al reanudar, LangGraph vuelve a ejecutar el nodo.
        decision = interrupt({"checkpoint": "outline", "ebookId": state["ebook_id"]})
        decision = decision if isinstance(decision, dict) else {"action": str(decision)}
        return {"action": decision.get("action"), "params": decision}

    @staticmethod
    def route_indice(state: GraphState) -> str:
        return {"approve": "redactor", "regenerate": "investigador", "regenerate_item": "investigador_capitulo"}.get(
            state.get("action") or "", "marcar_indice"
        )

    # ---------- Redactor ----------

    async def redactor(self, state: GraphState) -> dict:
        eid = state["ebook_id"]
        ebook = self._ebook(eid)
        params = state.get("params") or {}
        adjust = state.get("action") == "adjust"
        if adjust:
            number = 1
        else:
            pending = next((c for c in ebook.chapters if c.status in PENDING), None)
            if pending is None:
                return {"chapter": None, "skip_exercise": True}
            number = pending.number
            wanted = "redactando_cap1" if number == 1 else "redactando"
            if ebook.status != wanted or ebook.error is not None:

                def set_status(e: Ebook, s: str = wanted) -> None:
                    e.status = s  # type: ignore[assignment]
                    e.error = None

                self.store.update(eid, set_status)

        started = now_ms()
        self.store.emit(eid, "agent.started", agent="redactor", chapter=number)
        internal = self.store.internal(eid)
        ebook = self._ebook(eid)
        request = ChapterRequest(
            ebook=ebook,
            number=number,
            brief=internal.get("brief"),
            style_guide=internal.get("styleGuide"),
            adjustments=list(params.get("chips") or []) if adjust else [],
            note=str(params.get("note") or "") if adjust else "",
            previous_version=ebook.chapter_one_history[-1].sections if adjust and ebook.chapter_one_history else None,
            version=(ebook.chapter_one_version + 1) if adjust else (1 if number == 1 else 0),
        )

        entry: str | None = None
        attempts = 2  # un reintento automático (RNF-02)
        for attempt in range(attempts):
            try:
                entry = await self._write_once(eid, number, request, entry, attempt)
                break
            except (TimeoutError, LLMError, IncompleteChapter) as exc:
                logger.warning("Capítulo %d de %s, intento %d: %s", number, eid, attempt + 1, exc or type(exc).__name__)
                if attempt < attempts - 1:
                    continue
                if adjust:
                    self.store.update(eid, undo_chapter_one_adjustment)
                    self.store.update(eid, settle_working)
                    notice(self.store, eid, "No pudimos aplicar los ajustes. Sigue la versión anterior del capítulo 1.")
                    return {"chapter": 1, "skip_exercise": True}
                resume = "redactando_cap1" if number == 1 else "redactando"
                self.fail(eid, f"No pudimos terminar el capítulo {number}", resume_status=resume, chapter=number)
                raise NodeFailure(f"capítulo {number}") from exc

        if entry:
            edit_log(self.store, eid, entry, f"Capítulo {number} escrito", "hecho", chapter=number)
        self.store.emit(eid, "agent.completed", agent="redactor", chapter=number)
        return {"chapter": number, "chapter_started_ms": started, "skip_exercise": False}

    async def _write_once(self, eid: str, number: int, request: ChapterRequest, entry: str | None, attempt: int) -> str:
        def start(c: Chapter) -> None:
            c.status = "generando"
            c.current_section = "introduccion"
            c.sections = Sections()
            c.exercise = None

        self._patch_chapter(eid, number, start)
        if entry is None:
            entry = log(self.store, eid, "redactor", f"Escribiendo el capítulo {number}: Introducción", "trabajando", chapter=number)
        else:
            edit_log(self.store, eid, entry, f"Reintentando el capítulo {number}", "trabajando", chapter=number)
        self.store.emit(eid, "section.started", chapter=number, section="introduccion")

        parser = ChapterStreamParser()
        current = "introduccion"

        def handle(events) -> None:
            nonlocal current
            for ev in events:
                if ev.kind == "section":
                    if ev.section != current:
                        current = ev.section
                        self._patch_chapter(eid, number, lambda c, s=ev.section: setattr(c, "current_section", s))
                        edit_log(
                            self.store, eid, entry, f"Escribiendo el capítulo {number}: {SECTION_LABELS[ev.section]}", "trabajando", chapter=number
                        )
                        self.store.emit(eid, "section.started", chapter=number, section=ev.section)
                else:
                    self.store.append_token(eid, number, ev.section, ev.text)

        async with asyncio.timeout(self.s.settings.chapter_timeout_s):
            stream = redactor.stream_chapter(self.s.llm, request)
            async with contextlib.aclosing(stream):
                async for chunk in stream:
                    handle(parser.feed(chunk))
            handle(parser.finish())

        missing = parser.missing()
        if missing:
            raise IncompleteChapter(", ".join(SECTION_LABELS[m] for m in missing))
        sections = parser.result()
        self._patch_chapter(eid, number, lambda c: setattr(c, "sections", sections))
        return entry

    # ---------- Ejercicios ----------

    async def ejercicios(self, state: GraphState) -> dict:
        eid = state["ebook_id"]
        number = state.get("chapter")
        if number is None or state.get("skip_exercise"):
            return {}
        ebook = self._ebook(eid)
        chapter = ebook.chapter(number)
        if chapter is None or chapter.sections is None or not all(
            getattr(chapter.sections, s).strip() for s in SECTION_LABELS
        ):
            # El capítulo no está completo (p. ej. tras un reinicio): lo reescribirá el Redactor.
            return {"chapter": None}
        params = state.get("params") or {}
        adjust = state.get("action") == "adjust"
        flip = adjust and "otro_ejercicio" in (params.get("chips") or [])
        kind = ejercicios.decide_type(ebook.exercise_pref, number, flip)
        duration = ejercicios.suggest_duration(number)

        self._patch_chapter(eid, number, lambda c: setattr(c, "current_section", "ejercicio"))
        self.store.emit(eid, "agent.started", agent="ejercicios", chapter=number)
        self.store.emit(eid, "section.started", chapter=number, section="ejercicio")
        entry = log(
            self.store,
            eid,
            "ejercicios",
            "Creando un reto de 24-48 h" if kind == "reto" else "Creando un checklist de autoevaluación",
            "trabajando",
            chapter=number,
        )
        try:
            exercise = await ejercicios.create_exercise(self.s.llm, ebook, chapter, kind, duration)
        except LLMError as exc:
            logger.warning("No se pudo crear el ejercicio del capítulo %d de %s: %s", number, eid, exc)
            previous = ebook.chapter_one_history[-1].exercise if adjust and ebook.chapter_one_history else None
            if previous is None:
                if adjust:
                    self.store.update(eid, undo_chapter_one_adjustment)
                    self.store.update(eid, settle_working)
                    notice(self.store, eid, "No pudimos aplicar los ajustes. Sigue la versión anterior del capítulo 1.")
                    return {}
                resume = "redactando_cap1" if number == 1 else "redactando"
                self.fail(eid, f"No pudimos terminar el capítulo {number}", resume_status=resume, chapter=number)
                raise NodeFailure(f"ejercicio {number}") from exc
            exercise = previous

        def done(c: Chapter) -> None:
            c.exercise = exercise
            c.current_section = None
            c.status = "generado"

        self._patch_chapter(eid, number, done)
        edit_log(self.store, eid, entry, f"Ejercicio del capítulo {number} listo", "hecho", chapter=number)
        self.store.emit(eid, "agent.completed", agent="ejercicios", chapter=number)
        started = state.get("chapter_started_ms") or now_ms()
        self.store.emit(eid, "chapter.completed", chapter=number, durationMs=int(now_ms() - started))

        if adjust:
            version = self._ebook(eid).chapter_one_version + 1

            def finish_adjust(e: Ebook) -> None:
                e.busy = None
                e.chapter_one_version = version

            self.store.update(eid, finish_adjust)
            notice(self.store, eid, f"Versión {version} del capítulo 1 lista.")
        elif number >= 2:
            notice(self.store, eid, f"Capítulo {number} terminado.")
        return {}

    def route_after_exercise(self, state: GraphState) -> str:
        ebook = self.store.get(state["ebook_id"])
        if ebook is None:
            return "fin"
        if state.get("action") == "adjust" or ebook.status in ("redactando_cap1", "cap1_pendiente"):
            first = ebook.chapters[0] if ebook.chapters else None
            if first is not None and first.status not in PENDING:
                return "marcar_cap1"
        if any(c.status in PENDING for c in ebook.chapters):
            return "redactor"
        return "maquetador"

    # ---------- Punto de control 2: capítulo 1 ----------

    async def marcar_cap1(self, state: GraphState) -> dict:
        eid = state["ebook_id"]
        if self._ebook(eid).status != "cap1_pendiente":

            def apply(e: Ebook) -> None:
                e.status = "cap1_pendiente"
                e.chapter_one_version = 1

            self.store.update(eid, apply)
            self.store.emit(eid, "checkpoint.required", checkpoint="chapter1")
            notice(self.store, eid, "Es tu turno: revisa el capítulo 1.")
        return {}

    async def punto_control_cap1(self, state: GraphState) -> dict:
        decision = interrupt({"checkpoint": "chapter1", "ebookId": state["ebook_id"]})
        decision = decision if isinstance(decision, dict) else {"action": str(decision)}
        return {"action": decision.get("action"), "params": decision}

    @staticmethod
    def route_cap1(state: GraphState) -> str:
        return {"adjust": "redactor", "approve": "guia_estilo"}.get(state.get("action") or "", "marcar_cap1")

    async def guia_estilo(self, state: GraphState) -> dict:
        """Tras aprobar el capítulo 1: guía de estilo para el resto del libro (RNF-03)."""
        eid = state["ebook_id"]
        ebook = self._ebook(eid)
        self.store.emit(eid, "agent.started", agent="redactor", chapter=1)
        entry = log(self.store, eid, "redactor", "Tomando el capítulo 1 como referencia de tono", "trabajando", chapter=1)
        try:
            guide = await redactor.extract_style_guide(self.s.llm, ebook, self.store.internal(eid).get("brief"))
            self.store.set_internal(eid, styleGuide=guide.model_dump())
        except LLMError as exc:
            # No es grave: el capítulo 1 completo ya viaja como referencia en cada prompt.
            logger.warning("No se pudo extraer la guía de estilo de %s: %s", eid, exc)
        edit_log(self.store, eid, entry, "Tomando el capítulo 1 como referencia de tono", "hecho", chapter=1)
        self.store.emit(eid, "agent.completed", agent="redactor", chapter=1)
        return {}

    # ---------- Maquetador ----------

    async def maquetador(self, state: GraphState) -> dict:
        eid = state["ebook_id"]

        def start(e: Ebook) -> None:
            e.status = "maquetando"
            e.error = None

        self.store.update(eid, start)
        self.store.emit(eid, "agent.started", agent="maquetador")
        entry = log(self.store, eid, "maquetador", "Armando la portada, el aviso legal y el índice", "trabajando")
        ebook = self._ebook(eid)
        if not ebook.design.back_cover.blurb.strip():
            try:
                blurb = await maquetador.write_back_cover(self.s.llm, ebook)
                self.store.update(eid, lambda e: setattr(e.design.back_cover, "blurb", blurb))
            except LLMError as exc:
                logger.warning("No se pudo escribir la contraportada de %s: %s", eid, exc)
        await self._step_pause(2)
        edit_log(self.store, eid, entry, "Libro armado", "hecho")
        self.store.set_internal(eid, generatedWith={"provider": self.s.llm.name, "model": self.s.llm.model})
        self.store.update(eid, lambda e: setattr(e, "status", "listo"))
        self.store.emit(eid, "agent.completed", agent="maquetador")
        self.store.emit(eid, "ebook.ready")
        notice(self.store, eid, "Tu ebook está listo.")
        return {}
