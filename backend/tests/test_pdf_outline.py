"""Marcadores del PDF: Chromium junta sin espacio las líneas de un encabezado que
ocupa varias líneas; `add_metadata(headings=…)` debe devolverles su texto real."""

from __future__ import annotations

from io import BytesIO

import pytest
from pypdf import PdfReader

from app.config import get_settings
from app.export.pdf import PdfRenderer, add_metadata, heading_texts

HTML = """<!doctype html><html lang="es"><head><title>Prueba</title>
<style>h1 { width: 140px; font-size: 30px } h2 { width: 110px }</style></head><body>
<h1>Respira, estudia, descansa</h1>
<h2>Qué es el estrés y <em>para qué</em> sirve</h2>
<h3>Corto</h3>
<h1>Referencias</h1>
</body></html>"""


def titles(outline) -> list[str]:
    out: list[str] = []
    for item in outline:
        if isinstance(item, list):
            out.extend(titles(item))
        else:
            out.append(str(item.title))
    return out


def test_heading_texts_limpia_etiquetas_y_espacios():
    assert heading_texts(HTML) == ["Respira, estudia, descansa", "Qué es el estrés y para qué sirve", "Corto", "Referencias"]


async def test_los_marcadores_conservan_los_espacios():
    renderer = PdfRenderer(get_settings().pdf_browser_channel)
    try:
        if not await renderer.available():
            pytest.skip("No hay navegador para generar el PDF en esta máquina")
        raw = await renderer.render(HTML)
    finally:
        await renderer.close()

    fixed = add_metadata(raw, title="Prueba", author="Folio", subject="Prueba", headings=heading_texts(HTML))
    assert titles(PdfReader(BytesIO(fixed)).outline) == [
        "Respira, estudia, descansa",
        "Qué es el estrés y para qué sirve",
        "Corto",
        "Referencias",
    ]
    assert b"/StructTreeRoot" in fixed
