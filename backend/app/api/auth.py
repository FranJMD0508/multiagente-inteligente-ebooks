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
    hash_password,
    normalize_email,
    reset_token_matches,
    validate_email,
    validate_name,
    validate_password,
    verify_password,
)
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


def _session(services, user: dict) -> dict:
    token = create_access_token(services.secret_key, user["id"], services.settings.access_token_days)
    return {"token": token, "user": public_user(user)}


@router.post("/register", status_code=201)
async def register(body: RegisterBody, services: ServicesDep) -> dict:
    _check(validate_name(body.name), validate_email(body.email), validate_password(body.password))
    email = normalize_email(body.email)
    if await services.store.user_by_email(email):
        fail(409, "correo_en_uso", MSG_DUPLICATE)
    user = {"id": uuid.uuid4().hex, "name": body.name.strip(), "email": email}
    await services.store.create_user(user["id"], user["name"], email, hash_password(body.password))
    return _session(services, user)


@router.post("/login")
async def login(body: LoginBody, services: ServicesDep) -> dict:
    _check(validate_email(body.email), validate_password(body.password))
    user = await services.store.user_by_email(normalize_email(body.email))
    if user is None or not verify_password(body.password, user["password_hash"]):
        fail(401, "credenciales", MSG_BAD_LOGIN)
    return _session(services, user)


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
    if payload is None or user is None or not reset_token_matches(payload, user["password_hash"]):
        fail(400, "enlace_invalido", MSG_BAD_RESET)
    _check(validate_password(body.password))
    new_hash = hash_password(body.password)
    await services.store.update_user(user["id"], password_hash=new_hash)
    return _session(services, user)
