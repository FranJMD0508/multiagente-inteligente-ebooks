"""HTML del libro para el PDF (Jinja2): portada, portadilla, aviso, índice, capítulos, referencias y contraportada."""

from __future__ import annotations

import base64
from functools import lru_cache
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape
from markdown_it import MarkdownIt

from ..agents.redactor import normalize_markdown
from ..design import PAGE_SIZES, book_font_stack
from ..guardrails import disclaimer_for
from ..models import SECTION_LABELS, SECTION_ORDER, ChecklistExercise, Ebook
from ..references.apa import format_reference, sort_references
from .markdown import AI_NOTE

EXPORT_DIR = Path(__file__).resolve().parent
FONTS_DIR = EXPORT_DIR / "fonts"

FONT_FILES = {
    ("Roboto", "normal"): "Roboto-Variable.ttf",
    ("Roboto", "italic"): "Roboto-Italic-Variable.ttf",
    ("Lexend", "normal"): "Lexend-Variable.ttf",
    ("Onest", "normal"): "Onest-Variable.ttf",
}

TITLE_SIZES = {"s": 10.0, "m": 12.5, "l": 15.0}
TITLE_FONT_STACKS = {
    "Lexend": "'Lexend', Arial, sans-serif",
    "Onest": "'Onest', Arial, sans-serif",
    "Roboto": "'Roboto', Arial, sans-serif",
}
# Ancho útil (en cqw) de cada plantilla, para la imagen en recuadro.
INNER_WIDTH = {"clasica": 76.0, "centrada": 76.0, "franja": 78.0, "marco": 68.0, "editorial": 78.0}
# Altura máxima de la imagen en recuadro, como fracción del alto de la portada.
BOX_MAX_HEIGHT = {"franja": 0.28}


def _env() -> Environment:
    return Environment(
        loader=FileSystemLoader(EXPORT_DIR / "templates"),
        autoescape=select_autoescape(enabled_extensions=("html", "j2"), default_for_string=True),
        trim_blocks=True,
        lstrip_blocks=True,
    )


@lru_cache
def _markdown() -> MarkdownIt:
    # Solo lo que producen los agentes: párrafos, H3, listas, citas, negrita y cursiva. Sin HTML.
    md = MarkdownIt("commonmark", {"html": False, "linkify": False, "typographer": False})
    md.disable(
        ["code", "fence", "html_block", "html_inline", "image", "link", "autolink", "reference", "lheading", "hr", "table"],
        ignoreInvalid=True,
    )
    return md


def markdown_to_html(text: str) -> str:
    return _markdown().render(normalize_markdown(text))


@lru_cache
def _font_data(file_name: str) -> str:
    return base64.b64encode((FONTS_DIR / file_name).read_bytes()).decode("ascii")


def font_faces(families: set[str]) -> str:
    """@font-face incrustadas (data URI) solo para las familias que se usan."""
    rules = []
    for (family, style), file_name in FONT_FILES.items():
        if family not in families:
            continue
        rules.append(
            "@font-face { "
            f"font-family: '{family}'; font-style: {style}; font-weight: 100 900; font-display: block; "
            f"src: url(data:font/ttf;base64,{_font_data(file_name)}) format('truetype'); }}"
        )
    return "\n".join(rules)


def page_info(page_size: str) -> dict:
    spec = PAGE_SIZES.get(page_size, PAGE_SIZES["A5"])
    top, side, bottom = (16, 15, 18) if spec["small"] else (22, 20, 24)
    return {
        "css": spec["css"],
        "width_mm": spec["w"],
        "height_mm": spec["h"],
        "margins": f"{top}mm {side}mm {bottom}mm",
        "content_h_mm": round(spec["h"] - top - bottom - 4, 1),
    }


def cover_info(ebook: Ebook, image_src: str | None) -> dict:
    design = ebook.design
    page = page_info(design.page_size)
    ratio = page["height_mm"] / page["width_mm"]
    template = design.cover_template
    size = TITLE_SIZES.get(design.title_size, 12.5)
    if template in ("centrada", "marco"):
        size *= 0.96
    inner = INNER_WIDTH.get(template, 76.0)
    max_h = BOX_MAX_HEIGHT.get(template, 0.40) * ratio * 100
    box_h = min(inner * 0.75, max_h)
    image = None
    if design.cover_image is not None and image_src:
        ci = design.cover_image
        image = {
            "src": image_src,
            "placement": ci.placement,
            "veil": round(max(ci.veil, ci.min_veil), 3),
            "focus_y": round(min(max(ci.focus_y, 0), 100), 1),
            "alt": ci.alt.strip(),
        }
    label = f"Portada del libro «{ebook.title.strip()}»"
    if ebook.subtitle.strip():
        label += f". {ebook.subtitle.strip()}"
    if design.author.strip():
        label += f". De {design.author.strip()}"
    if image and image["alt"]:
        label += f". Imagen: {image['alt']}"
    return {
        "template": template,
        "align": design.title_align,
        "cloth": design.cloth_color,
        "title_size": round(size, 3),
        "title_font": TITLE_FONT_STACKS.get(design.title_font, TITLE_FONT_STACKS["Lexend"]),
        "box_h": round(box_h, 2),
        "box_w": round(box_h / 0.75, 2),
        "image": image,
        "label": label + ".",
    }


def build_html(ebook: Ebook, *, image_src: str | None = None) -> str:
    design = ebook.design
    families = {"Lexend", design.title_font}
    if design.font == "Roboto":
        families.add("Roboto")
    chapters = []
    for chapter in ebook.chapters:
        sections = []
        if chapter.sections is not None:
            sections = [
                {"label": SECTION_LABELS[s], "html": markdown_to_html(getattr(chapter.sections, s))} for s in SECTION_ORDER
            ]
        exercise = None
        if chapter.exercise is not None:
            if isinstance(chapter.exercise, ChecklistExercise):
                exercise = {"type": "checklist", "title": chapter.exercise.title, "entries": chapter.exercise.items}
            else:
                exercise = {"type": "reto", "title": chapter.exercise.title, "steps": chapter.exercise.steps}
        chapters.append({"number": chapter.number, "title": chapter.title, "sections": sections, "exercise": exercise})

    blurb = design.back_cover.blurb.strip()
    context = {
        "title": ebook.title.strip(),
        "subtitle": ebook.subtitle.strip(),
        "author": design.author.strip(),
        "font_faces": font_faces(families),
        "body_font": book_font_stack(design.font),
        "body_size": max(11, int(design.body_size_pt)),
        "page": page_info(design.page_size),
        "cover": cover_info(ebook, image_src),
        "legal": disclaimer_for(ebook.sensitivity),
        "chapters": chapters,
        "references": [format_reference(r, "html") for r in sort_references(ebook.references)],
        "back_cover": blurb if design.back_cover.enabled and blurb else None,
        "ai_note": AI_NOTE,
    }
    return _env().get_template("libro.html.j2").render(**context)
