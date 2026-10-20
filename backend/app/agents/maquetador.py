"""Agente Maquetador/Exportador: contraportada, ensamblado en Markdown y PDF etiquetado (RF-06, RA-01, RA-03, RÉR-02)."""

from __future__ import annotations

import asyncio
import base64
import re
from datetime import date

from pydantic import BaseModel

from ..export.html import build_html
from ..export.markdown import build_markdown
from ..export.pdf import PdfRenderer, add_metadata, heading_texts
from ..llm import LLMProvider
from ..models import Ebook
from .common import Text, ask_json, outline_text

BLURB_WORDS = (45, 140)  # el prompt pide 60-110; se tolera un margen antes de reintentar


class BackCoverOut(BaseModel):
    sinopsis: Text


def _check_blurb(result: BackCoverOut) -> None:
    text = re.sub(r"\s+", " ", result.sinopsis).strip().strip('"“”«»')
    words = len(re.findall(r"\w+", text))
    lo, hi = BLURB_WORDS
    if not lo <= words <= hi:
        raise ValueError(f"la sinopsis debe tener entre 60 y 110 palabras y tiene {words}")
    if text.count("!") > 1:
        raise ValueError("demasiados signos de exclamación")
    result.sinopsis = text


async def write_back_cover(llm: LLMProvider, ebook: Ebook, *, previous: str = "", variant: int = 0) -> str:
    values = {
        "titulo_libro": ebook.title,
        "subtitulo": ebook.subtitle or "(sin subtítulo)",
        "publico": ebook.audience,
        "indice": outline_text(ebook.chapters),
        "anterior": f'\nSinopsis anterior (propón una distinta, con otro enfoque): "{previous.strip()}"' if previous.strip() else "",
    }
    context = {
        "title": ebook.title,
        "subtitle": ebook.subtitle,
        "audience": ebook.audience,
        "niche_id": ebook.niche_id,
        "chapters": [c.title for c in ebook.chapters],
        "variant": variant,
    }
    result = await ask_json(llm, "maquetador/contraportada", "maquetador.contraportada", BackCoverOut, values, context, _check_blurb)
    return result.sinopsis


def export_markdown(ebook: Ebook, *, provider: str, model: str | None, when: date | None = None) -> str:
    return build_markdown(ebook, provider=provider, model=model, when=when)


def image_data_uri(mime: str, data: bytes) -> str:
    return f"data:{mime};base64,{base64.b64encode(data).decode('ascii')}"


async def export_pdf(renderer: PdfRenderer, ebook: Ebook, *, image_src: str | None) -> bytes:
    html = build_html(ebook, image_src=image_src)
    pdf = await renderer.render(html)
    title = ebook.title.strip()
    subject = ebook.subtitle.strip() or f"Ebook de crecimiento personal: {title}"
    # pypdf reescribe el PDF entero: en un hilo, para no frenar el bucle de eventos.
    return await asyncio.to_thread(
        add_metadata, pdf, title=title, author=ebook.design.author.strip(), subject=subject, headings=heading_texts(html)
    )
