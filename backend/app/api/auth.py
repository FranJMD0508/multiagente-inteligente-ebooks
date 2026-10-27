"""Registro, inicio de sesión, perfil y recuperación de contraseña."""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Response
from pydantic import BaseModel

from ..auth import (
    MSG_BAD_LOGIN,
    MSG_BAD_RESET,
    MSG_DUPLICATE,
    create_access_token,
    create_reset_token,
    decode_token,
    hash_password_async,
    normalize_email,
    password_matches,
    validate_email,
    validate_name,
    validate_password,
    verify_password_async,
)
from ..store import DuplicateEmail
from .deps import ServicesDep, UserDep, fail, public_user

log = logging.getLogger("folio.auth")
router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterBody(BaseModel):
    name: str = ""
    email: str = ""
    password: str = ""


class LoginBody(BaseModel):
    email: str = ""
    password: str = ""


class MeBody(BaseModel):
    name: str = ""


class RecoverBody(BaseModel):
    email: str = ""


class ResetBody(BaseModel):
    token: str = ""
    password: str = ""


def _check(*messages: str | None) -> None:
    for message in messages:
        if message:
            fail(422, "validacion", message)


def _session(services, user: dict, password_hash: str) -> dict:
    token = create_access_token(services.secret_key, user["id"], password_hash, services.settings.access_token_days)
    return {"token": token, "user": public_user(user)}


@router.post("/register", status_code=201)
async def register(body: RegisterBody, services: ServicesDep) -> dict:
    _check(validate_name(body.name), validate_email(body.email), validate_password(body.password))
    email = normalize_email(body.email)
    if await services.store.user_by_email(email):
        fail(409, "correo_en_uso", MSG_DUPLICATE)
    user = {"id": uuid.uuid4().hex, "name": body.name.strip(), "email": email}
    password_hash = await hash_password_async(body.password)
    try:
        await services.store.create_user(user["id"], user["name"], email, password_hash)
    except DuplicateEmail:
        # Dos registros simultáneos con el mismo correo: el segundo choca con la restricción UNIQUE.
        fail(409, "correo_en_uso", MSG_DUPLICATE)
    return _session(services, user, password_hash)


@router.post("/login")
async def login(body: LoginBody, services: ServicesDep) -> dict:
    _check(validate_email(body.email), validate_password(body.password))
    user = await services.store.user_by_email(normalize_email(body.email))
    # Si la cuenta no existe se verifica igualmente (contra un hash de relleno): mismo tiempo de respuesta.
    valid = await verify_password_async(body.password, user["password_hash"] if user else None)
    if user is None or not valid:
        fail(401, "credenciales", MSG_BAD_LOGIN)
    return _session(services, user, user["password_hash"])


@router.get("/me")
async def me(user: UserDep) -> dict:
    return public_user(user)


@router.patch("/me")
async def update_me(body: MeBody, user: UserDep, services: ServicesDep) -> dict:
    _check(validate_name(body.name))
    await services.store.update_user(user["id"], name=body.name.strip())
    return {**public_user(user), "name": body.name.strip()}


@router.delete("/me", status_code=204)
async def delete_me(user: UserDep, services: ServicesDep) -> Response:
    """Borra la cuenta y todos sus ebooks."""
    for ebook in services.store.list_for(user["id"]):
        await services.runner.delete(ebook.id)
        services.store.delete(ebook.id)
    await services.store.flush()
    await services.store.delete_user(user["id"])
    services.bus.close_user(user["id"])  # los streams abiertos de la cuenta borrada se cierran
    return Response(status_code=204)


@router.post("/recover", status_code=202)
async def recover(body: RecoverBody, services: ServicesDep) -> dict:
    """Siempre 202. En local no se envían correos: el enlace se imprime en el log."""
    user = await services.store.user_by_email(normalize_email(body.email))
    if user is not None:
        token = create_reset_token(services.secret_key, user["id"], user["password_hash"])
        link = f"{services.settings.frontend_url.rstrip('/')}/recuperar?token={token}"
        log.warning("Enlace para cambiar la contraseña de %s (válido 1 h): %s", user["email"], link)
    return {"ok": True}


@router.post("/reset")
async def reset(body: ResetBody, services: ServicesDep) -> dict:
    payload = decode_token(services.secret_key, body.token, kind="reset")
    user = await services.store.user_by_id(payload["sub"]) if payload else None
    if payload is None or user is None or not password_matches(payload, user["password_hash"]):
        fail(400, "enlace_invalido", MSG_BAD_RESET)
    _check(validate_password(body.password))
    new_hash = await hash_password_async(body.password)
    await services.store.update_user(user["id"], password_hash=new_hash)
    # Las sesiones abiertas con la contraseña anterior dejan de valer (su token lleva la huella vieja):
    # se cierran también sus streams de eventos.
    services.bus.close_user(user["id"])
    return _session(services, user, new_hash)
