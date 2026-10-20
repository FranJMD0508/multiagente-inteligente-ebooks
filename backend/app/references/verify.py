"""Verificación de referencias contra Crossref y Open Library.

Reglas (iguales en el frontend):
- Con DOI → Crossref; con ISBN → Open Library (datos de esa edición); libro sin
  ISBN → Open Library por título y autor; artículo sin DOI → Crossref bibliográfico.
- Coincide si la similitud del título normalizado (minúsculas, sin tildes ni
  puntuación) es ≥ 0,8 comparando el título guardado contra "título" y
  "título: subtítulo" de la fuente, y también la parte antes de ":" de ambos
  (se usa la máxima); y, si hay autores en los dos lados, coincide al menos un
  apellido (sin distinguir mayúsculas ni tildes).
- `match` solo lleva lo que conviene corregir: `year` si difiere; `volume`,
  `issue` y `pages` si difieren o faltan (una sola página que coincide con el
  inicio del rango guardado no cuenta como diferencia); `doi`, `isbn`,
  `publisher` (libros), `journal` (artículos) y `authors` solo si faltan.
  Nunca el título ni una editorial ya guardada.
  Excepción: si el DOI o el ISBN guardado lleva a otra obra (o el DOI no existe)
  y la obra se encuentra por título, se propone el identificador correcto.
- Error de red o página web → `sin_verificar`.
"""

from __future__ import annotations

import logging
import re
import unicodedata
from dataclasses import dataclass
from difflib import SequenceMatcher

from ..models import ReferenceCandidate, ReferenceData, ReferenceMatch
from .lookup import (
    LookupFailed,
    ReferenceClient,
    crossref_to_candidate,
    openlibrary_doc_to_candidate,
)

log = logging.getLogger("folio.references")

TITLE_THRESHOLD = 0.8


@dataclass
class VerifyResult:
    check: str  # "verificada" | "no_encontrada" | "sin_verificar"
    checked_with: str | None = None
    match: ReferenceMatch | None = None


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFD", (text or "").lower())
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", text)).strip()


def _variants(title: str) -> set[str]:
    out = {normalize(title)}
    if ":" in title:
        out.add(normalize(title.split(":", 1)[0]))
    return {v for v in out if v}


def title_similarity(stored: str, source_title: str, source_subtitle: str | None = None) -> float:
    """Máxima similitud entre las variantes del título guardado y de la fuente."""
    mine = _variants(stored)
    theirs = _variants(source_title)
    if source_subtitle:
        theirs |= _variants(f"{source_title}: {source_subtitle}")
    best = 0.0
    for a in mine:
        for b in theirs:
            best = max(best, SequenceMatcher(None, a, b).ratio())
    return best


def _surname_tokens(author: str) -> set[str]:
    family = author.split(",", 1)[0] if "," in author else author
    return {t for t in normalize(family).split() if len(t) >= 3}


def authors_match(stored: list[str], source: list[str]) -> bool:
    if not stored or not source:
        return True
    mine: set[str] = set()
    for a in stored:
        mine |= _surname_tokens(a)
    theirs: set[str] = set()
    for a in source:
        theirs |= _surname_tokens(a)
        # Open Library da "Nombre Apellido": se acepta cualquier palabra del nombre.
        theirs |= {t for t in normalize(a).split() if len(t) >= 3}
    return bool(mine & theirs) if mine else True


def is_match(ref: ReferenceData, candidate: ReferenceCandidate) -> bool:
    return title_similarity(ref.title, candidate.title) >= TITLE_THRESHOLD and authors_match(ref.authors, candidate.authors)


def _norm_pages(value: str | None) -> str:
    return re.sub(r"[\s‐‑‒–—-]+", "-", value or "").strip("-")


def build_match(ref: ReferenceData, source: ReferenceCandidate, *, fix_identifiers: bool = False) -> ReferenceMatch | None:
    fields: dict = {}
    year = source.year if re.fullmatch(r"\d{4}", source.year or "") else None
    if year and year != (ref.year or "").strip():
        fields["year"] = year
    for key in ("volume", "issue"):
        theirs = getattr(source, key)
        if theirs and normalize(theirs) != normalize(getattr(ref, key) or ""):
            fields[key] = theirs
    theirs_pages, mine_pages = _norm_pages(source.pages), _norm_pages(ref.pages)
    # Crossref a veces solo da la primera página ("385" frente a "385-396"): eso no es una diferencia.
    if theirs_pages and theirs_pages != mine_pages and not (mine_pages and mine_pages.split("-")[0] == theirs_pages):
        fields["pages"] = source.pages
    # La editorial no se usa en los artículos ni la revista en los libros (APA 7).
    missing_keys = ("doi", "journal") if ref.kind == "articulo" else ("doi", "isbn", "publisher")
    for key in missing_keys:
        theirs = getattr(source, key)
        if theirs and not getattr(ref, key):
            fields[key] = theirs
    if fix_identifiers:
        for key in ("doi", "isbn"):
            theirs, mine = getattr(source, key), getattr(ref, key)
            if theirs and mine and normalize(theirs) != normalize(mine):
                fields[key] = theirs
    if source.authors and not ref.authors:
        fields["authors"] = source.authors
    return ReferenceMatch(**fields) if fields else None


def _best(ref: ReferenceData, candidates: list[ReferenceCandidate]) -> ReferenceCandidate | None:
    scored = [(title_similarity(ref.title, c.title), c) for c in candidates if authors_match(ref.authors, c.authors)]
    scored = [(s, c) for s, c in scored if s >= TITLE_THRESHOLD]
    if not scored:
        return None
    return max(scored, key=lambda pair: pair[0])[1]


def _main_title(title: str) -> str:
    return title.split(":", 1)[0].strip() or title


def _first_surname(ref: ReferenceData) -> str | None:
    if not ref.authors:
        return None
    first = ref.authors[0]
    return first.split(",", 1)[0].strip() if "," in first else None


async def _search_by_title(client: ReferenceClient, ref: ReferenceData) -> tuple[ReferenceCandidate | None, str]:
    if ref.kind == "libro":
        docs = await client.openlibrary_search(title=_main_title(ref.title), author=_first_surname(ref), limit=4)
        return _best(ref, [openlibrary_doc_to_candidate(d) for d in docs]), "openlibrary"
    query = " ".join(filter(None, [ref.title, _first_surname(ref)]))
    items = await client.crossref_search(query, rows=4)
    return _best(ref, [crossref_to_candidate(i) for i in items]), "crossref"


def _verified(ref: ReferenceData, source: ReferenceCandidate, checked_with: str, *, fix_identifiers: bool = False) -> VerifyResult:
    return VerifyResult("verificada", checked_with, build_match(ref, source, fix_identifiers=fix_identifiers))


async def verify_reference(client: ReferenceClient, ref: ReferenceData) -> VerifyResult:
    if ref.kind == "web":
        return VerifyResult("sin_verificar")
    try:
        if ref.doi:
            item = await client.crossref_work(ref.doi)
            if item:
                candidate = crossref_to_candidate(item)
                if is_match(ref, candidate):
                    return _verified(ref, candidate, "crossref")
            # El DOI no existe o lleva a otra obra: se busca por título.
            found, source = await _search_by_title(client, ref)
            if found:
                return _verified(ref, found, source, fix_identifiers=True)
            return VerifyResult("no_encontrada", "crossref")
        if ref.isbn and ref.kind == "libro":
            edition = await client.openlibrary_isbn(ref.isbn)
            if edition and is_match(ref, edition):
                return _verified(ref, edition, "openlibrary")
            found, source = await _search_by_title(client, ref)
            if found:
                # Si el ISBN existe pero es de otra obra, se propone el correcto.
                return _verified(ref, found, source, fix_identifiers=edition is not None)
            return VerifyResult("no_encontrada", "openlibrary")
        found, source = await _search_by_title(client, ref)
        if found:
            return _verified(ref, found, source)
        return VerifyResult("no_encontrada", source)
    except LookupFailed as exc:
        log.info("No se pudo verificar «%s»: %s", ref.title, exc)
        return VerifyResult("sin_verificar")
