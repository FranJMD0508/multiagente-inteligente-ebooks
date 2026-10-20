"""Lecturas recomendadas y verificación en segundo plano (no bloquean el pipeline)."""

from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING

from ..agents import investigador
from ..graph.activity import edit_log, log, uid
from ..llm import LLMError
from ..models import BIBLIO_FIELDS, Ebook, Reference, ReferenceData
from .verify import verify_reference

if TYPE_CHECKING:
    from ..services import Services

logger = logging.getLogger("folio.references")


def fingerprint(ref: Reference | ReferenceData) -> tuple:
    """Datos bibliográficos de una referencia (si cambian, hay que volver a verificar)."""
    return tuple(tuple(v) if isinstance(v, list) else v for v in (getattr(ref, f) for f in BIBLIO_FIELDS))


def reference_data(ref: Reference) -> ReferenceData:
    return ReferenceData(**{f: getattr(ref, f) for f in BIBLIO_FIELDS})


def _count(n: int, singular: str, plural: str) -> str:
    return f"{n} {singular if n == 1 else plural}"


class ReadingsService:
    def __init__(self, services: Services) -> None:
        self.s = services
        self._limit = asyncio.Semaphore(3)

    # ----- API pública -----

    def suggest(self, ebook_id: str, *, more: bool = False) -> None:
        """Pide lecturas al Investigador (tarea secundaria con nombre: no se duplica)."""

        def mark(e: Ebook) -> None:
            e.references_state = "sugiriendo"

        self.s.store.update(ebook_id, mark)
        self.s.tasks.spawn(ebook_id, "lecturas", self._suggest(ebook_id, more=more))

    def verify(self, ebook_id: str, ref_id: str) -> None:
        self.s.tasks.spawn(ebook_id, f"verificar:{ref_id}", self._verify_one(ebook_id, ref_id))

    def resume(self, ebook_id: str) -> None:
        """Al arrancar: retoma sugerencias y verificaciones que quedaron a medias."""
        ebook = self.s.store.get(ebook_id)
        if ebook is None:
            return
        if ebook.references_state == "sugiriendo":
            self.suggest(ebook_id, more=bool(ebook.references))
        for ref in ebook.references:
            if ref.check == "pendiente":
                self.verify(ebook_id, ref.id)

    # ----- trabajo -----

    async def _suggest(self, ebook_id: str, *, more: bool) -> None:
        store = self.s.store
        entry = log(store, ebook_id, "investigador", "Buscando lecturas recomendadas", "trabajando")
        try:
            ebook = store.get(ebook_id)
            if ebook is None:
                return
            brief = store.internal(ebook_id).get("brief") or {}
            readings = await investigador.suggest_readings(
                self.s.llm,
                book_title=ebook.title,
                idea=ebook.prompt,
                audience=ebook.audience,
                niche_id=ebook.niche_id,
                chapters=ebook.chapters,
                concepts=list(brief.get("conceptos") or []),
                exclude_titles=[r.title for r in ebook.references],
                max_count=4 if more else 8,
                min_count=2 if more else 4,
            )
            total = max(1, len(ebook.chapters))
            refs = [investigador.reading_to_reference(r, uid(), total) for r in readings]

            def add(e: Ebook) -> None:
                taken = {investigador.normalized_title(r.title) for r in e.references}
                e.references = [*e.references, *(r for r in refs if investigador.normalized_title(r.title) not in taken)]

            store.update(ebook_id, add)
            results = await asyncio.gather(*(self._verify_one(ebook_id, r.id) for r in refs))
            verified = sum(1 for ok in results if ok)

            def done(e: Ebook) -> None:
                e.references_state = "listo"

            store.update(ebook_id, done)
            if refs:
                message = f"{_count(len(refs), 'lectura sugerida', 'lecturas sugeridas')} · {_count(verified, 'verificada', 'verificadas')}"
            else:
                message = "No encontramos lecturas nuevas que sugerir"
            edit_log(store, ebook_id, entry, message, "hecho")
        except asyncio.CancelledError:
            raise
        except (LLMError, Exception) as exc:  # noqa: BLE001
            logger.warning("No se pudieron sugerir lecturas para %s: %s", ebook_id, exc)
            if store.get(ebook_id) is not None:
                store.update(ebook_id, lambda e: setattr(e, "references_state", "error"))
                edit_log(store, ebook_id, entry, "No pudimos buscar lecturas recomendadas", "hecho")

    async def _verify_one(self, ebook_id: str, ref_id: str) -> bool:
        store = self.s.store
        ebook = store.get(ebook_id)
        ref = next((r for r in ebook.references if r.id == ref_id), None) if ebook else None
        if ref is None:
            return False
        before = fingerprint(ref)
        async with self._limit:
            result = await verify_reference(self.s.refs, reference_data(ref))

        applied = False

        def apply(e: Ebook) -> None:
            nonlocal applied
            for r in e.references:
                # Si la persona editó la referencia mientras tanto, esta verificación ya no vale.
                if r.id == ref_id and fingerprint(r) == before:
                    r.check = result.check  # type: ignore[assignment]
                    r.checked_with = result.checked_with  # type: ignore[assignment]
                    r.match = result.match
                    applied = True

        store.update(ebook_id, apply)
        return applied and result.check == "verificada"
