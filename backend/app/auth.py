"""Cuentas: contraseñas con scrypt + sal, tokens JWT HS256 y mensajes de validación.

Los mensajes son los mismos que `frontend/src/lib/auth.tsx`.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import os
import re
import secrets
from datetime import UTC, datetime, timedelta

import jwt

from .config import Settings

log = logging.getLogger("folio.auth")

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

MSG_NAME = "Escribe tu nombre."
MSG_EMAIL = "Escribe un correo válido, por ejemplo tu@correo.com."
MSG_PASSWORD = "La contraseña debe tener al menos 6 caracteres."
MSG_DUPLICATE = "Ya hay una cuenta con ese correo."
MSG_BAD_LOGIN = "El correo o la contraseña no coinciden."
MSG_NEED_LOGIN = "Inicia sesión para continuar."
MSG_BAD_RESET = "El enlace para cambiar la contraseña no es válido o ya caducó. Pide uno nuevo."

SCRYPT_N, SCRYPT_R, SCRYPT_P = 2**14, 8, 1


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def validate_name(name: str) -> str | None:
    return MSG_NAME if len((name or "").strip()) < 2 else None


def validate_email(email: str) -> str | None:
    return MSG_EMAIL if not EMAIL_RE.match(normalize_email(email)) else None


def validate_password(password: str) -> str | None:
    return MSG_PASSWORD if len(password or "") < 6 else None


# ---------- contraseñas ----------


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P, dklen=32)
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, n, r, p, salt, digest = stored.split("$")
        if scheme != "scrypt":
            return False
        candidate = hashlib.scrypt(
            password.encode("utf-8"), salt=_unb64(salt), n=int(n), r=int(r), p=int(p), dklen=len(_unb64(digest))
        )
        return hmac.compare_digest(candidate, _unb64(digest))
    except (ValueError, TypeError):
        return False


# ---------- tokens ----------


def load_secret_key(settings: Settings) -> str:
    """SECRET_KEY del .env o, si no hay, una clave generada y guardada en data/secret.key."""
    if settings.secret_key:
        return settings.secret_key
    path = settings.data_dir / "secret.key"
    if path.exists():
        return path.read_text(encoding="utf-8").strip()
    path.parent.mkdir(parents=True, exist_ok=True)
    key = secrets.token_urlsafe(48)
    path.write_text(key, encoding="utf-8")
    log.info("Se generó una SECRET_KEY nueva en %s", path)
    return key


def create_access_token(secret: str, user_id: str, days: int = 30) -> str:
    now = datetime.now(UTC)
    payload = {"sub": user_id, "typ": "access", "iat": now, "exp": now + timedelta(days=days)}
    return jwt.encode(payload, secret, algorithm="HS256")


def _password_fingerprint(password_hash: str) -> str:
    return hashlib.sha256(password_hash.encode("utf-8")).hexdigest()[:16]


def create_reset_token(secret: str, user_id: str, password_hash: str) -> str:
    """Enlace de recuperación válido 1 h; deja de valer en cuanto cambia la contraseña."""
    now = datetime.now(UTC)
    payload = {
        "sub": user_id,
        "typ": "reset",
        "pwh": _password_fingerprint(password_hash),
        "iat": now,
        "exp": now + timedelta(hours=1),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def decode_token(secret: str, token: str, *, kind: str = "access") -> dict | None:
    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    if payload.get("typ") != kind or not payload.get("sub"):
        return None
    return payload


def reset_token_matches(payload: dict, password_hash: str) -> bool:
    return hmac.compare_digest(str(payload.get("pwh", "")), _password_fingerprint(password_hash))
