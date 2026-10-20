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


def exercise_to_markdown(exercise) -> str:
    if isinstance(exercise, ChecklistExercise):
        return "\n".join([f"**{exercise.title}**", "", *[f"- [ ] {item}" for item in exercise.items]])
    return "\n".join([f"**{exercise.title}**", "", *[f"{i}. {step}" for i, step in enumerate(exercise.steps, start=1)]])


def machine_mark(provider: str, model: str | None = None, when: date | None = None) -> str:
    """Comentario HTML con la marca de contenido generado con IA (AI Act, art. 50.2)."""
    day = (when or date.today()).isoformat()
    parts = ["generado-con-ia=true", "herramienta=Folio", f"proveedor={provider}"]
    if model:
        parts.append(f"modelo={model}")
    parts.append(f"fecha={day}")
    return f"<!-- folio: {'; '.join(parts)} -->"


def build_markdown(ebook: Ebook, *, provider: str, model: str | None = None, when: date | None = None) -> str:
    out: list[str] = [f"# {ebook.title}"]
    if ebook.subtitle:
        out += ["", f"*{ebook.subtitle}*"]
    if ebook.design.author:
        out += ["", f"Por {ebook.design.author}"]

    legal = disclaimer_for(ebook.sensitivity)
    if legal:
        out += ["", "## Aviso legal", "", f"> {legal}"]

    out += ["", "## Índice", ""]
    out += [f"{c.number}. {c.title}" for c in ebook.chapters]

    for chapter in ebook.chapters:
        out += ["", "---", "", f"# Capítulo {chapter.number}: {chapter.title}"]
        if chapter.sections is None:
            continue
        for section in SECTION_ORDER:
            text = normalize_markdown(getattr(chapter.sections, section))
            out += ["", f"## {SECTION_LABELS[section]}", "", text]
        if chapter.exercise is not None:
            out += ["", "## Ejercicio práctico", "", exercise_to_markdown(chapter.exercise)]

    if ebook.references:
        out += ["", "---", "", "# Referencias", ""]
        refs = sort_references(ebook.references)
        out.append("\n\n".join(format_reference(r, "md") for r in refs))

    blurb = ebook.design.back_cover.blurb.strip()
    if ebook.design.back_cover.enabled and blurb:
        out += ["", "---", "", "# Sobre este libro", "", blurb]

    out += ["", "---", "", f"*{AI_NOTE}*", "", machine_mark(provider, model, when), ""]
    return "\n".join(out)


def slugify(text: str) -> str:
    folded = unicodedata.normalize("NFD", text)
    folded = "".join(c for c in folded if unicodedata.category(c) != "Mn").lower()
    slug = re.sub(r"[^a-z0-9]+", "-", folded).strip("-")[:60]
    return slug or "ebook"
