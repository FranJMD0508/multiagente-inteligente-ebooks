"""Exportación a Markdown y PDF (RF-06). Solo con el libro en `listo`."""

from __future__ import annotations

import logging
import re
from typing import Literal
from urllib.parse import quote

from fastapi import APIRouter, Response

from ..agents import maquetador
from ..export.markdown import slugify
from ..export.pdf import PdfTimeout, PdfUnavailable
from ..models import CamelModel
from .deps import ServicesDep, UserDep, fail, owned_ebook

log = logging.getLogger("folio.export")
router = APIRouter(tags=["exportar"])


class ExportBody(CamelModel):
    format: Literal["md", "pdf"] = "md"
    filename: str | None = None


def _filename(requested: str | None, title: str, ext: str) -> str:
    base = (requested or "").strip()
    base = re.sub(r"[\\/:*?\"<>|\x00-\x1f]+", "-", base).strip(" .-")
    if base.lower().endswith(f".{ext}"):
        base = base[: -(len(ext) + 1)]
    return f"{base or slugify(title)}.{ext}"


def content_disposition(filename: str) -> str:
    """`attachment` con nombre ASCII de respaldo y el nombre real en UTF-8 (RFC 6266)."""
    ascii_name = filename.encode("ascii", "ignore").decode("ascii").replace('"', "") or "ebook"
    return f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(filename)}"


@router.post("/ebooks/{ebook_id}/exports")
async def export_ebook(ebook_id: str, body: ExportBody, user: UserDep, services: ServicesDep) -> Response:
    ebook = owned_ebook(services, ebook_id, user)
    if ebook.status != "listo":
        fail(409, "estado", "Podrás exportar cuando el libro esté listo.")
    generated = services.store.internal(ebook_id).get("generatedWith") or {}
    provider = generated.get("provider") or services.llm.name
    model = generated.get("model") or services.llm.model

    if body.format == "md":
        text = maquetador.export_markdown(ebook, provider=provider, model=model)
        name = _filename(body.filename, ebook.title, "md")
        return Response(
            content=text.encode("utf-8"),
            media_type="text/markdown; charset=utf-8",
            headers={"Content-Disposition": content_disposition(name)},
        )

    image_src = None
    if ebook.design.cover_image is not None:
        asset_id = ebook.design.cover_image.src.rstrip("/").rsplit("/", 1)[-1]
        asset = await services.store.get_asset(asset_id)
        if asset is not None:
            image_src = maquetador.image_data_uri(asset["mime"], asset["data"])
    try:
        pdf = await maquetador.export_pdf(services.pdf, ebook, image_src=image_src)
    except PdfUnavailable as exc:
        log.error("No se pudo generar el PDF: %s", exc)
        fail(503, "pdf_no_disponible", "No pudimos generar el PDF en este equipo: falta un navegador compatible.")
    except PdfTimeout as exc:
        log.error("No se pudo generar el PDF: %s", exc)
        fail(504, "pdf_tiempo", "El PDF tardó demasiado en generarse. Inténtalo de nuevo en un momento.")
    name = _filename(body.filename, ebook.title, "pdf")
    return Response(content=pdf, media_type="application/pdf", headers={"Content-Disposition": content_disposition(name)})
