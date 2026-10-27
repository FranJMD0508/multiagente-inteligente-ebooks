"""Formato APA 7 en español.

El frontend tiene una copia en TypeScript: si cambias algo aquí, cámbialo allí
también (las pruebas de `tests/test_apa.py` documentan los casos).

- Autores "Apellido, Nombre Segundo" → "Apellido, N. S."; "Jean-Paul" → "J.-P.";
  sin coma es una organización y se deja tal cual (seguida de punto: "OMS. (2022).").
- 1 autor: "A."; 2: "A. y B."; 3-20: "A., B. y C."; 21 o más: los 19 primeros,
  ", . . . " y el último.
- Libro:    Autores (Año). *Título* (3.ª ed.). Editorial. https://doi.org/…  (la edición, solo en libros)
- Artículo: Autores (Año). Título. *Revista*, *volumen*(número), páginas. https://doi.org/…
- Web:      Autores (Año). *Título*. Sitio. URL
- Sin autores, el título ocupa su lugar: *Título*. (Año). Editorial.
- Sin año: (s. f.). No se duplica el punto si el título termina en "?" o "!".
"""

from __future__ import annotations

import html
import re
import unicodedata
from typing import Literal
from urllib.parse import urlsplit

from ..models import ReferenceData

Markup = Literal["md", "html"]


# ---------- autores ----------


def _initial(name: str) -> str:
    """"Jean-Paul" → "J.-P."; "J." se queda igual."""
    parts = [p for p in name.split("-") if p]
    return "-".join(f"{p[0].upper()}." for p in parts)


def format_author(author: str) -> str:
    author = re.sub(r"\s+", " ", author.strip())
    if "," not in author:
        return author  # organización
    family, given = (p.strip() for p in author.split(",", 1))
    if not given:
        return family
    initials = " ".join(_initial(n) for n in given.replace(".", ". ").split() if n.strip("."))
    return f"{family}, {initials}"


def format_authors(authors: list[str]) -> str:
    names = [format_author(a) for a in authors if a and a.strip()]
    if not names:
        return ""
    if len(names) == 1:
        return names[0]
    if len(names) == 2:
        return f"{names[0]} y {names[1]}"
    if len(names) <= 20:
        return ", ".join(names[:-1]) + " y " + names[-1]
    return ", ".join(names[:19]) + ", . . . " + names[-1]


def family_name(author: str) -> str:
    author = author.strip()
    return author.split(",", 1)[0].strip() if "," in author else author


# ---------- utilidades ----------


def _year(ref: ReferenceData) -> str:
    year = (ref.year or "").strip()
    # "s. f.", "s.f.", "s.f", "sf"… (igual que `yearText` del frontend)
    return year if year and not re.fullmatch(r"s\.?\s*f\.?", year, re.I) else "s. f."


def _end(text: str) -> str:
    """Añade el punto final si el texto no termina ya en . ? o !"""
    text = text.rstrip()
    return text if text.endswith((".", "?", "!")) else text + "."


def _ordinal_edition(edition: str | None) -> str:
    if not edition:
        return ""
    e = edition.strip()
    if re.fullmatch(r"\d+", e):
        return "" if e == "1" else f"{e}.ª ed."
    return e


def http_url(value: str | None) -> str | None:
    """La URL si es http(s) y tiene dominio; si no, None. Evita enlaces `javascript:`, `data:`
    o `file:` en el `.md` y en el PDF (allí se convierten en acciones /URI)."""
    url = (value or "").strip()
    if not url or any(c.isspace() or c in '<>"' for c in url):
        return None
    try:
        parts = urlsplit(url)
    except ValueError:
        return None
    if parts.scheme.lower() not in ("http", "https") or not parts.hostname:
        return None
    return url


def doi_url(doi: str | None) -> str:
    if not doi:
        return ""
    d = re.sub(r"^(https?://(dx\.)?doi\.org/|doi:\s*)", "", doi.strip(), flags=re.I)
    return f"https://doi.org/{d}"


def _pages(pages: str | None) -> str:
    return re.sub(r"\s*[-‐‑‒–—]+\s*", "–", pages.strip()) if pages else ""  # "85--101" → "85–101"


class _Fmt:
    def __init__(self, markup: Markup) -> None:
        self.markup = markup

    def esc(self, text: str) -> str:
        return html.escape(text, quote=False) if self.markup == "html" else text

    def it(self, text: str) -> str:
        return f"<em>{self.esc(text)}</em>" if self.markup == "html" else f"*{text}*"

    def link(self, url: str) -> str:
        if self.markup == "html":
            safe = html.escape(url, quote=True)
            return f'<a href="{safe}">{safe}</a>'
        return url


# ---------- referencia completa ----------


def format_reference(ref: ReferenceData, markup: Markup = "md") -> str:
    f = _Fmt(markup)
    authors = format_authors(ref.authors)
    year = _year(ref)
    title = ref.title.strip()
    kind = ref.kind
    edition = _ordinal_edition(ref.edition) if kind == "libro" else ""
    # Solo enlaces http(s): una URL guardada con otro esquema no llega al libro.
    link = doi_url(ref.doi) if ref.doi else (http_url(ref.url) or "")

    # Título con su formato según el tipo (en cursiva salvo los artículos).
    if kind == "articulo":
        title_part = _end(f.esc(title))
    else:
        styled = f.it(title)
        if edition:
            title_part = f"{styled} ({f.esc(edition)})."
        else:
            title_part = styled if title.endswith((".", "?", "!")) else styled + "."

    if authors:
        # Las iniciales ya terminan en punto; una organización lo lleva explícito: "OMS. (2022)."
        parts = [f"{_end(f.esc(authors))} ({year}).", title_part]
    else:
        parts = [title_part, f"({year})."]

    if kind == "articulo":
        source = []
        if ref.journal:
            journal = f.it(ref.journal.strip())
            if ref.volume:
                volume = f.it(ref.volume.strip())
                issue = f"({f.esc(ref.issue.strip())})" if ref.issue else ""
                journal += f", {volume}{issue}"
            if ref.pages:
                journal += f", {f.esc(_pages(ref.pages))}"
            source.append(journal + ".")
        parts.extend(source)
    else:
        publisher = (ref.publisher or "").strip()
        if publisher:
            parts.append(_end(f.esc(publisher)))

    if link:
        parts.append(f.link(link))
    return " ".join(p for p in parts if p)


def in_text_citation(ref: ReferenceData) -> str:
    """Cita en el texto: (Clear, 2018) · (Fisher y Ury, 2011) · (Fisher et al., 2011)."""
    year = _year(ref)
    authors = [a for a in ref.authors if a.strip()]
    if not authors:
        title = ref.title.strip()
        return f"(«{title}», {year})" if ref.kind == "articulo" else f"({title}, {year})"
    first = family_name(authors[0])
    if len(authors) == 1:
        who = first
    elif len(authors) == 2:
        who = f"{first} y {family_name(authors[1])}"
    else:
        who = f"{first} et al."
    return f"({who}, {year})"


def _fold(text: str) -> str:
    folded = unicodedata.normalize("NFD", text.lower())
    return "".join(c for c in folded if unicodedata.category(c) != "Mn")


def _sort_key(ref: ReferenceData) -> tuple[str, str, str]:
    """Misma clave que `sortKey` del frontend: apellido sin tildes ni signos, año y título sin tildes."""
    first = next((a for a in ref.authors if a.strip()), None)
    lead = re.sub(r"[^a-z0-9 ]+", "", _fold(family_name(first) if first else ref.title))
    return lead, _year(ref), _fold(ref.title)


def sort_references(refs: list) -> list:
    """Orden alfabético por el primer apellido (o por el título si no hay autores)."""
    return sorted(refs, key=_sort_key)
