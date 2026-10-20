"""Referencias y lecturas recomendadas (APA 7), con verificación en Crossref y Open Library."""

from __future__ import annotations

import re
import uuid

from fastapi import APIRouter, Query, Response
from pydantic import Field

from ..agents.investigador import clean_doi, clean_isbn, normalized_title
from ..models import BIBLIO_FIELDS, CamelModel, Ebook, Reference, ReferenceKind
from ..references.apa import http_url
from ..references.lookup import LookupFailed, lookup
from ..references.service import fingerprint
from .deps import ServicesDep, UserDep, fail, owned_ebook

router = APIRouter(tags=["referencias"])

ID_RE = re.compile(r"^[A-Za-z0-9_-]{6,64}$")


class ReferenceIn(CamelModel):
    id: str | None = None
    kind: ReferenceKind = "libro"
    authors: list[str] = Field(default_factory=list)
    year: str | int | None = None
    title: str = ""
    publisher: str | None = None
    edition: str | int | None = None
    journal: str | None = None
    volume: str | int | None = None
    issue: str | int | None = None
    pages: str | None = None
    doi: str | None = None
    isbn: str | None = None
    url: str | None = None
    chapters: list[int] | None = None


class ReferencePatch(CamelModel):
    kind: ReferenceKind | None = None
    authors: list[str] | None = None
    year: str | int | None = None
    title: str | None = None
    publisher: str | None = None
    edition: str | int | None = None
    journal: str | None = None
    volume: str | int | None = None
    issue: str | int | None = None
    pages: str | None = None
    doi: str | None = None
    isbn: str | None = None
    url: str | None = None
    chapters: list[int] | None = None


def _text(value: object, limit: int = 300) -> str | None:
    if value is None:
        return None
    text = re.sub(r"\s+", " ", str(value)).strip()[:limit]
    return text or None


def _year(value: object) -> str:
    text = _text(value, 12) or ""
    match = re.search(r"\b(1[5-9]\d{2}|20\d{2})([a-z]?)\b", text)
    return match.group(1) + match.group(2) if match else "s. f."


def _clean_fields(raw: dict, *, partial: bool) -> dict:
    """Normaliza los datos bibliográficos que llegan del cliente."""
    out: dict = {}
    for key, value in raw.items():
        if key not in BIBLIO_FIELDS:
            continue
        if key == "authors":
            out[key] = [a for a in (_text(x, 200) for x in (value or [])) if a][:30]
        elif key == "year":
            out[key] = _year(value)
        elif key == "title":
            title = _text(value, 400)
            if not title:
                fail(422, "validacion", "La referencia necesita un título.")
            out[key] = title
        elif key == "doi":
            out[key] = clean_doi(_text(value)) if value else None
            if value and out[key] is None:
                fail(422, "validacion", "Ese DOI no parece válido. Debe empezar por 10.")
        elif key == "isbn":
            out[key] = clean_isbn(_text(value)) if value else None
            if value and out[key] is None:
                fail(422, "validacion", "Ese ISBN no parece válido: debe tener 10 o 13 dígitos.")
        elif key == "edition":
            digits = re.sub(r"\D", "", str(value or ""))
            out[key] = None if not value or digits == "1" else (digits or _text(value, 40))
        elif key == "url":
            text = _text(value, 600)
            out[key] = http_url(text) if text else None
            if text and out[key] is None:
                fail(422, "validacion", "La dirección web debe empezar por http:// o https://.")
        elif key == "kind":
            out[key] = value
        else:
            out[key] = _text(value)
    if not partial and "title" not in out:
        fail(422, "validacion", "La referencia necesita un título.")
    return out


def _chapters(values: list[int] | None, ebook: Ebook) -> list[int]:
    total = len(ebook.chapters)
    return sorted({int(c) for c in values or [] if 1 <= int(c) <= total})


def _find(ebook: Ebook, ref_id: str) -> Reference:
    ref = next((r for r in ebook.references if r.id == ref_id), None)
    if ref is None:
        fail(404, "no_encontrado", "No encontramos esa referencia.")
    return ref


@router.post("/ebooks/{ebook_id}/references", status_code=202)
async def add_reference(ebook_id: str, body: ReferenceIn, user: UserDep, services: ServicesDep) -> dict:
    ebook = owned_ebook(services, ebook_id, user)
    fields = _clean_fields(body.model_dump(exclude={"id", "chapters"}), partial=False)
    if any(normalized_title(r.title) == normalized_title(fields["title"]) for r in ebook.references):
        fail(409, "duplicada", "Esa obra ya está en tus referencias.")
    ref_id = body.id if body.id and ID_RE.match(body.id) and not any(r.id == body.id for r in ebook.references) else str(uuid.uuid4())
    ref = Reference(**fields, id=ref_id, chapters=_chapters(body.chapters, ebook), origin="usuario", check="pendiente")
    snapshot = services.store.update(ebook_id, lambda e: setattr(e, "references", [*e.references, ref]))
    services.readings.verify(ebook_id, ref_id)
    return snapshot.dump() if snapshot else {}


@router.patch("/ebooks/{ebook_id}/references/{ref_id}")
async def update_reference(
    ebook_id: str, ref_id: str, body: ReferencePatch, user: UserDep, services: ServicesDep, response: Response
) -> dict:
    ebook = owned_ebook(services, ebook_id, user)
    current = _find(ebook, ref_id)
    sent = body.model_dump(include=body.model_fields_set)
    fields = _clean_fields({k: v for k, v in sent.items() if k != "chapters"}, partial=True)
    chapters = _chapters(body.chapters, ebook) if "chapters" in body.model_fields_set else None
    updated = current.model_copy(update=fields)
    reverify = fingerprint(updated) != fingerprint(current)

    def apply(e: Ebook) -> None:
        for i, r in enumerate(e.references):
            if r.id == ref_id:
                new = r.model_copy(update=fields)
                if chapters is not None:
                    new.chapters = chapters
                if reverify:
                    new.check = "pendiente"
                    new.checked_with = None
                    new.match = None
                e.references[i] = new

    snapshot = services.store.update(ebook_id, apply)
    if reverify:
        services.readings.verify(ebook_id, ref_id)
        response.status_code = 202
    return snapshot.dump() if snapshot else {}


@router.delete("/ebooks/{ebook_id}/references/{ref_id}")
async def delete_reference(ebook_id: str, ref_id: str, user: UserDep, services: ServicesDep) -> dict:
    ebook = owned_ebook(services, ebook_id, user)
    _find(ebook, ref_id)
    snapshot = services.store.update(ebook_id, lambda e: setattr(e, "references", [r for r in e.references if r.id != ref_id]))
    return snapshot.dump() if snapshot else {}


@router.post("/ebooks/{ebook_id}/references/{ref_id}/verify", status_code=202)
async def verify_reference(ebook_id: str, ref_id: str, user: UserDep, services: ServicesDep) -> dict:
    ebook = owned_ebook(services, ebook_id, user)
    _find(ebook, ref_id)

    def apply(e: Ebook) -> None:
        for r in e.references:
            if r.id == ref_id:
                r.check = "pendiente"
                r.checked_with = None
                r.match = None

    snapshot = services.store.update(ebook_id, apply)
    services.readings.verify(ebook_id, ref_id)
    return snapshot.dump() if snapshot else {}


@router.post("/ebooks/{ebook_id}/references/{ref_id}/accept-match")
async def accept_match(ebook_id: str, ref_id: str, user: UserDep, services: ServicesDep) -> dict:
    ebook = owned_ebook(services, ebook_id, user)
    ref = _find(ebook, ref_id)
    if ref.match is None:
        fail(409, "estado", "No hay correcciones que aplicar en esta referencia.")
    fields = {k: v for k, v in ref.match.model_dump().items() if v is not None}

    def apply(e: Ebook) -> None:
        for i, r in enumerate(e.references):
            if r.id == ref_id:
                new = r.model_copy(update=fields)
                new.match = None
                new.check = "verificada"
                e.references[i] = new

    snapshot = services.store.update(ebook_id, apply)
    return snapshot.dump() if snapshot else {}


@router.post("/ebooks/{ebook_id}/references/suggest", status_code=202)
async def suggest_more(ebook_id: str, user: UserDep, services: ServicesDep) -> dict:
    ebook = owned_ebook(services, ebook_id, user)
    if not ebook.chapters:
        fail(409, "estado", "Primero hace falta un índice para sugerir lecturas.")
    if ebook.references_state == "sugiriendo" or services.tasks.side_running(ebook_id, "lecturas"):
        fail(409, "ocupado", "El Investigador ya está buscando lecturas.")
    services.readings.suggest(ebook_id, more=bool(ebook.references))
    return services.store.get(ebook_id).dump()


@router.get("/references/lookup")
async def lookup_references(user: UserDep, services: ServicesDep, q: str = Query("", max_length=300)) -> list[dict]:
    try:
        candidates = await lookup(services.refs, q)
    except LookupFailed:
        fail(503, "sin_conexion", "No pudimos consultar Crossref ni Open Library. Revisa tu conexión e inténtalo de nuevo.")
    return [c.dump() for c in candidates]
