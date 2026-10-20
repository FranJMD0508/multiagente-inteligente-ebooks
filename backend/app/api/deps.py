"""Dependencias comunes de la API: servicios, usuario autenticado, ebook propio y errores."""

from __future__ import annotations

from typing import Annotated, NoReturn

from fastapi import Depends, HTTPException, Query, Request

from ..auth import MSG_NEED_LOGIN, decode_token
from ..models import Ebook
from ..services import Services


def api_error(status: int, code: str, message: str, **extra) -> HTTPException:
    """Error con el formato del contrato: {"detail": {"code", "message"}}."""
    detail = {"code": code, "message": message, **extra}
    headers = {"WWW-Authenticate": "Bearer"} if status == 401 else None
    return HTTPException(status_code=status, detail=detail, headers=headers)


def fail(status: int, code: str, message: str, **extra) -> NoReturn:
    raise api_error(status, code, message, **extra)


def get_services(request: Request) -> Services:
    return request.app.state.services


ServicesDep = Annotated[Services, Depends(get_services)]


def _bearer(request: Request) -> str | None:
    header = request.headers.get("authorization", "")
    if header.lower().startswith("bearer "):
        return header[7:].strip() or None
    return None


async def _user_from_token(services: Services, token: str | None) -> dict:
    if not token:
        fail(401, "no_autenticado", MSG_NEED_LOGIN)
    payload = decode_token(services.secret_key, token)
    if payload is None:
        fail(401, "no_autenticado", MSG_NEED_LOGIN)
    user = await services.store.user_by_id(payload["sub"])
    if user is None:
        fail(401, "no_autenticado", MSG_NEED_LOGIN)
    return user


async def current_user(request: Request, services: ServicesDep) -> dict:
    return await _user_from_token(services, _bearer(request))


async def current_user_sse(
    request: Request,
    services: ServicesDep,
    token: Annotated[str | None, Query(description="Token para EventSource, que no envía cabeceras")] = None,
) -> dict:
    """Las rutas SSE aceptan el token por cabecera o por `?token=`."""
    return await _user_from_token(services, _bearer(request) or token)


UserDep = Annotated[dict, Depends(current_user)]


def public_user(user: dict) -> dict:
    return {"id": user["id"], "name": user["name"], "email": user["email"]}


def owned_ebook(services: Services, ebook_id: str, user: dict) -> Ebook:
    ebook = services.store.get(ebook_id)
    if ebook is None or services.store.owner_of(ebook_id) != user["id"]:
        fail(404, "no_encontrado", "No encontramos ese ebook.")
    return ebook
