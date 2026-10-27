"""Búsqueda de obras por DOI, ISBN o texto libre en Crossref y Open Library."""

from __future__ import annotations

import asyncio
import html
import logging
import re
from itertools import zip_longest
from urllib.parse import quote

import httpx

from ..models import ReferenceCandidate

log = logging.getLogger("folio.references")

CROSSREF = "https://api.crossref.org"
OPENLIBRARY = "https://openlibrary.org"
OL_FIELDS = "title,subtitle,author_name,first_publish_year,publisher,isbn"
DOI_RE = re.compile(r"(10\.\d{4,9}/[^\s\"<>]+)", re.I)

BOOK_TYPES = {"book", "monograph", "edited-book", "reference-book", "book-set", "book-series", "book-chapter", "book-part", "book-section"}


class LookupFailed(Exception):
    """No se pudo consultar la fuente (red caída, tiempo agotado, error 5xx…)."""


def parse_doi(query: str) -> str | None:
    match = DOI_RE.search(query.strip())
    return match.group(1).rstrip(".,;)") if match else None


def parse_isbn(query: str) -> str | None:
    digits = re.sub(r"[\s-]", "", query.strip())
    digits = re.sub(r"^isbn(?:1[03])?:?", "", digits, flags=re.I)  # "ISBN-13: 978…" sin espacios ni guiones
    if re.fullmatch(r"\d{9}[\dXx]|\d{13}", digits):
        return digits.upper()
    return None


def extract_year(value: object) -> str | None:
    match = re.search(r"\b(1[5-9]\d{2}|20\d{2})\b", str(value or ""))
    return match.group(1) if match else None


def name_to_apa(full_name: str) -> str:
    """"James Clear" → "Clear, James" (la última palabra se toma como apellido)."""
    parts = full_name.strip().split()
    if len(parts) < 2:
        return full_name.strip()
    return f"{parts[-1]}, {' '.join(parts[:-1])}"


def _fix_case(text: str) -> str:
    """Crossref a veces da autores en mayúsculas ("NEFF, KRISTIN")."""
    return text.title() if text.isupper() else text


def _strip_tags(text: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", text or "")).strip()


def _join_title(title: str, subtitle: str | None) -> str:
    if subtitle and subtitle.lower() not in title.lower():
        return f"{title}: {subtitle}"
    return title


def _edition_number(value: object) -> str | None:
    digits = re.sub(r"\D", "", str(value or ""))
    return digits if digits and digits != "1" else None


def _prefer_isbn13(isbns: list[str] | None) -> str | None:
    if not isbns:
        return None
    cleaned = [re.sub(r"[^0-9Xx]", "", i).upper() for i in isbns]
    cleaned = [i for i in cleaned if len(i) in (10, 13)]
    return next((i for i in cleaned if len(i) == 13), cleaned[0] if cleaned else None)


# ---------- conversión a candidatos ----------


def crossref_to_candidate(item: dict) -> ReferenceCandidate:
    title = _strip_tags((item.get("title") or [""])[0])
    subtitle = _strip_tags((item.get("subtitle") or [""])[0]) if item.get("subtitle") else None
    authors = []
    for author in item.get("author") or []:
        if author.get("family"):
            given = author.get("given", "")
            authors.append(_fix_case(f"{author['family']}, {given}".strip().rstrip(",")))
        elif author.get("name"):
            authors.append(author["name"])
    year = None
    for key in ("issued", "published-print", "published-online", "published", "created"):
        parts = (item.get(key) or {}).get("date-parts") or []
        if parts and parts[0] and parts[0][0]:
            year = str(parts[0][0])
            break
    kind = "libro" if item.get("type") in BOOK_TYPES else "articulo"
    pages = item.get("page")
    return ReferenceCandidate(
        source="crossref",
        kind=kind,
        authors=authors,
        year=year or "s. f.",
        title=_join_title(title, subtitle) or "(sin título)",
        publisher=item.get("publisher") or None,
        journal=_strip_tags((item.get("container-title") or [""])[0]) or None if kind == "articulo" else None,
        volume=str(item["volume"]) if item.get("volume") else None,
        issue=str(item["issue"]) if item.get("issue") else None,
        pages=re.sub(r"\s*-\s*", "–", pages) if pages else None,
        doi=item.get("DOI") or None,
        isbn=_prefer_isbn13(item.get("ISBN")) if kind == "libro" else None,
    )


def openlibrary_doc_to_candidate(doc: dict) -> ReferenceCandidate:
    return ReferenceCandidate(
        source="openlibrary",
        kind="libro",
        authors=[name_to_apa(a) for a in doc.get("author_name") or []],
        year=str(doc["first_publish_year"]) if doc.get("first_publish_year") else "s. f.",
        title=_join_title(doc.get("title") or "(sin título)", doc.get("subtitle")),
        publisher=(doc.get("publisher") or [None])[0],
        isbn=_prefer_isbn13(doc.get("isbn")),
    )


def openlibrary_edition_to_candidate(edition: dict, authors: list[str], isbn: str) -> ReferenceCandidate:
    return ReferenceCandidate(
        source="openlibrary",
        kind="libro",
        authors=authors,
        year=extract_year(edition.get("publish_date")) or "s. f.",
        title=_join_title(edition.get("title") or "(sin título)", edition.get("subtitle")),
        publisher=(edition.get("publishers") or [None])[0],
        edition=_edition_number(edition.get("edition_name")),
        isbn=isbn,
    )


# ---------- cliente ----------


class ReferenceClient:
    """Cliente HTTP de Crossref y Open Library (8 s de tiempo límite por petición)."""

    def __init__(self, *, mailto: str = "", timeout_s: float = 8.0, enabled: bool = True, transport: httpx.AsyncBaseTransport | None = None) -> None:
        agent = "Folio/1.0 (https://github.com/FranJMD0508/multiagente-inteligente-ebooks"
        agent += f"; mailto:{mailto})" if mailto else ")"
        self.enabled = enabled
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(timeout_s),
            headers={"User-Agent": agent, "Accept": "application/json"},
            follow_redirects=True,
            transport=transport,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def _get(self, url: str, params: dict | None = None) -> dict | None:
        if not self.enabled:
            raise LookupFailed("La búsqueda de referencias está desactivada")
        try:
            response = await self._client.get(url, params=params)
        except httpx.HTTPError as exc:
            raise LookupFailed(str(exc)) from exc
        if response.status_code == 404:
            return None
        if response.status_code >= 400:
            raise LookupFailed(f"{url} respondió {response.status_code}")
        try:
            return response.json()
        except ValueError as exc:
            raise LookupFailed("Respuesta ilegible") from exc

    async def crossref_work(self, doi: str) -> dict | None:
        data = await self._get(f"{CROSSREF}/works/{quote(doi, safe='/')}")
        return (data or {}).get("message") if data else None

    async def crossref_search(self, query: str, rows: int = 4) -> list[dict]:
        data = await self._get(f"{CROSSREF}/works", {"query.bibliographic": query, "rows": rows})
        return ((data or {}).get("message") or {}).get("items") or []

    async def openlibrary_search(self, *, q: str | None = None, title: str | None = None, author: str | None = None, isbn: str | None = None, limit: int = 4) -> list[dict]:
        params: dict = {"limit": limit, "fields": OL_FIELDS}
        if q:
            params["q"] = q
        if title:
            params["title"] = title
        if author:
            params["author"] = author
        if isbn:
            params["isbn"] = isbn
        data = await self._get(f"{OPENLIBRARY}/search.json", params)
        return (data or {}).get("docs") or []

    async def openlibrary_isbn(self, isbn: str) -> ReferenceCandidate | None:
        """Datos de esa edición (/isbn/{isbn}.json) y autores con search.json?isbn=."""
        edition = await self._get(f"{OPENLIBRARY}/isbn/{isbn}.json")
        if not edition:
            return None
        authors: list[str] = []
        try:
            docs = await self.openlibrary_search(isbn=isbn, limit=1)
            if docs:
                authors = [name_to_apa(a) for a in docs[0].get("author_name") or []]
        except LookupFailed:
            log.info("No se pudieron leer los autores del ISBN %s", isbn)
        return openlibrary_edition_to_candidate(edition, authors, isbn)


async def lookup(client: ReferenceClient, query: str) -> list[ReferenceCandidate]:
    """Candidatos (≤ 8) para un DOI, un ISBN o un texto libre."""
    query = query.strip()
    if len(query) < 3:
        return []
    doi = parse_doi(query)
    if doi:
        item = await client.crossref_work(doi)
        return [crossref_to_candidate(item)] if item else []
    isbn = parse_isbn(query)
    if isbn:
        found = await client.openlibrary_isbn(isbn)
        return [found] if found else []
    crossref, openlibrary = await asyncio.gather(
        client.crossref_search(query, rows=4),
        client.openlibrary_search(q=query, limit=4),
        return_exceptions=True,
    )
    lists: list[list[ReferenceCandidate]] = []
    if isinstance(crossref, list):
        lists.append([crossref_to_candidate(i) for i in crossref])
    if isinstance(openlibrary, list):
        lists.append([openlibrary_doc_to_candidate(d) for d in openlibrary])
    if not lists and isinstance(crossref, BaseException):
        raise LookupFailed(str(crossref))
    merged: list[ReferenceCandidate] = []
    for group in zip_longest(*lists):
        merged.extend(c for c in group if c is not None)
    # Lo más parecido a lo que se buscó, primero (Crossref devuelve mucho ruido con títulos de libros).
    from .verify import title_similarity

    merged.sort(key=lambda c: -round(title_similarity(query, c.title), 1))
    return merged[:8]
