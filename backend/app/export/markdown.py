"""Ensamblado del ebook en Markdown (RF-06, RA-01, RÉR-02).

Mismo formato que `frontend/src/lib/markdown.ts` más las secciones nuevas
(referencias y contraportada) y la marca legible por máquina (P-11):

    # Título · *subtítulo* · Por autor · ## Aviso legal · ## Índice
    --- # Capítulo N: Título · ## Introducción … ## Ejercicio práctico
    --- # Referencias · --- # Sobre este libro
    --- *Contenido original generado con asistencia de IA.*
    <!-- folio: generado-con-ia=true; herramienta=Folio; proveedor=…; fecha=YYYY-MM-DD -->
"""

from __future__ import annotations

import re
import unicodedata
from datetime import date

from ..agents.redactor import normalize_markdown
from ..guardrails import disclaimer_for
from ..models import SECTION_LABELS, SECTION_ORDER, ChecklistExercise, Ebook
from ..references.apa import format_reference, sort_references

AI_NOTE = "Contenido original generado con asistencia de IA."

# ---------- HTML crudo ----------
# Un visor de Markdown interpreta el HTML que encuentra (`<script>`, `<img onerror=…>`,
# `<iframe>`…). El texto del libro lo escriben el LLM y la persona, así que se neutraliza
# antes de exportarlo sin tocar la sintaxis de Markdown: las citas (`> `), la negrita y los
# enlaces automáticos `<https://…>` y `<correo@dominio>` se quedan igual. No hay excepción
# para el código: los prompts no lo piden y adivinar qué es código como lo haría cada visor
# abre huecos (comillas invertidas escapadas, `~~~` a mitad de línea…).
# Correo con los caracteres que admite CommonMark: otro `<…@…>` (p. ej. `<javascript:x@y.z>`) un
# visor lo leería como un enlace con un esquema cualquiera, así que se escapa.
_AUTOLINK_RE = re.compile(
    r"<(?:(?:https?://|mailto:)[^\s<>]+"
    r"|[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*)>",
    re.I,
)
_TAG_START_RE = re.compile(r"<(?=[A-Za-z/!?])")
_ENTITY_RE = re.compile(r"&(?=#\d+;|#[xX][0-9A-Fa-f]+;|[A-Za-z][A-Za-z0-9]*;)")


def _escape_plain(text: str) -> str:
    # `&` solo cuando formaría una entidad y `<` solo cuando abriría una etiqueta, un
    # comentario o una declaración: "Tom & Jerry" o "3 < 5" se leen igual en el archivo.
    return _TAG_START_RE.sub("&lt;", _ENTITY_RE.sub("&amp;", text))


def escape_html(text: str) -> str:
    """Neutraliza el HTML crudo del texto para el `.md` (ver arriba)."""
    out: list[str] = []
    part = text or ""
    last = 0
    for match in _AUTOLINK_RE.finditer(part):
        out.append(_escape_plain(part[last : match.start()]))
        out.append(match.group(0))
        last = match.end()
    out.append(_escape_plain(part[last:]))
    return "".join(out)


def exercise_to_markdown(exercise) -> str:
    title = escape_html(exercise.title)
    if isinstance(exercise, ChecklistExercise):
        return "\n".join([f"**{title}**", "", *[f"- [ ] {escape_html(item)}" for item in exercise.items]])
    return "\n".join([f"**{title}**", "", *[f"{i}. {escape_html(step)}" for i, step in enumerate(exercise.steps, start=1)]])


def machine_mark(provider: str, model: str | None = None, when: date | None = None) -> str:
    """Comentario HTML con la marca de contenido generado con IA (AI Act, art. 50.2)."""
    day = (when or date.today()).isoformat()
    parts = ["generado-con-ia=true", "herramienta=Folio", f"proveedor={provider}"]
    if model:
        parts.append(f"modelo={model}")
    parts.append(f"fecha={day}")
    return f"<!-- folio: {'; '.join(parts)} -->"


def build_markdown(ebook: Ebook, *, provider: str, model: str | None = None, when: date | None = None) -> str:
    # Todo lo que escriben la persona o el LLM pasa por `escape_html`; lo fijo de Folio (aviso legal,
    # nota y marca de IA) no, porque la marca es un comentario HTML a propósito (P-11).
    title, subtitle, author = (escape_html(t.strip()) for t in (ebook.title, ebook.subtitle, ebook.design.author))
    out: list[str] = [f"# {title}"]
    if subtitle:
        out += ["", f"*{subtitle}*"]
    if author:
        out += ["", f"Por {author}"]

    legal = disclaimer_for(ebook.sensitivity)
    if legal:
        out += ["", "## Aviso legal", "", f"> {legal}"]

    out += ["", "## Índice", ""]
    out += [f"{c.number}. {escape_html(c.title)}" for c in ebook.chapters]

    for chapter in ebook.chapters:
        out += ["", "---", "", f"# Capítulo {chapter.number}: {escape_html(chapter.title)}"]
        if chapter.sections is None:
            continue
        for section in SECTION_ORDER:
            text = escape_html(normalize_markdown(getattr(chapter.sections, section)))
            out += ["", f"## {SECTION_LABELS[section]}", "", text]
        if chapter.exercise is not None:
            out += ["", "## Ejercicio práctico", "", exercise_to_markdown(chapter.exercise)]

    if ebook.references:
        out += ["", "---", "", "# Referencias", ""]
        refs = sort_references(ebook.references)
        out.append("\n\n".join(escape_html(format_reference(r, "md")) for r in refs))

    blurb = ebook.design.back_cover.blurb.strip()
    if ebook.design.back_cover.enabled and blurb:
        out += ["", "---", "", "# Sobre este libro", "", escape_html(blurb)]

    out += ["", "---", "", f"*{AI_NOTE}*", "", machine_mark(provider, model, when), ""]
    return "\n".join(out)


def slugify(text: str) -> str:
    folded = unicodedata.normalize("NFD", text)
    folded = "".join(c for c in folded if unicodedata.category(c) != "Mn").lower()
    slug = re.sub(r"[^a-z0-9]+", "-", folded).strip("-")[:60]
    return slug or "ebook"
