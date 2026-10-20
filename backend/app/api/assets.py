"""Imágenes de portada. Sin autenticación: el id es aleatorio (32 hex) y no se puede adivinar."""

from __future__ import annotations

import re

from fastapi import APIRouter, Response

from .deps import ServicesDep, fail

router = APIRouter(tags=["archivos"])

ASSET_ID = re.compile(r"^[0-9a-f]{32}$")


@router.get("/assets/{asset_id}")
async def get_asset(asset_id: str, services: ServicesDep) -> Response:
    if not ASSET_ID.match(asset_id):
        fail(404, "no_encontrado", "No encontramos esa imagen.")
    asset = await services.store.get_asset(asset_id)
    if asset is None:
        fail(404, "no_encontrado", "No encontramos esa imagen.")
    return Response(
        content=asset["data"],
        media_type=asset["mime"],
        headers={"Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff"},
    )
