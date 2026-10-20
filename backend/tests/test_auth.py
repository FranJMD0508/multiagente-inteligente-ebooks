"""Cuentas: registro, inicio de sesión, errores, perfil, recuperación y borrado."""

from __future__ import annotations

import logging
import re

from app.auth import hash_password, verify_password

from .conftest import IDEA_FINANZAS, register, wait_status


async def test_registro_y_login(client):
    res = await client.post("/api/auth/register", json={"name": "Ana Pérez", "email": " Ana@Correo.com ", "password": "secreto123"})
    assert res.status_code == 201
    body = res.json()
    assert body["user"]["email"] == "ana@correo.com" and body["user"]["name"] == "Ana Pérez"
    assert set(body["user"]) == {"id", "name", "email"}
    assert body["token"]

    res = await client.post("/api/auth/login", json={"email": "ana@correo.com", "password": "secreto123"})
    assert res.status_code == 200
    token = res.json()["token"]

    res = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200 and res.json()["name"] == "Ana Pérez"


async def test_errores_de_validacion(client):
    cases = [
        ({"name": "A", "email": "a@b.co", "password": "secreto123"}, "Escribe tu nombre."),
        ({"name": "Ana", "email": "no-es-correo", "password": "secreto123"}, "Escribe un correo válido, por ejemplo tu@correo.com."),
        ({"name": "Ana", "email": "a@b.co", "password": "123"}, "La contraseña debe tener al menos 6 caracteres."),
    ]
    for payload, message in cases:
        res = await client.post("/api/auth/register", json=payload)
        assert res.status_code == 422
        assert res.json()["detail"] == {"code": "validacion", "message": message}

    await register(client, "ana@correo.com")
    res = await client.post("/api/auth/register", json={"name": "Otra", "email": "ANA@correo.com", "password": "secreto123"})
    assert res.status_code == 409 and res.json()["detail"]["message"] == "Ya hay una cuenta con ese correo."

    res = await client.post("/api/auth/login", json={"email": "ana@correo.com", "password": "otraclave"})
    assert res.status_code == 401 and res.json()["detail"]["message"] == "El correo o la contraseña no coinciden."
    res = await client.post("/api/auth/login", json={"email": "nadie@correo.com", "password": "secreto123"})
    assert res.status_code == 401


async def test_rutas_protegidas(client):
    assert (await client.get("/api/ebooks")).status_code == 401
    assert (await client.get("/api/ebooks", headers={"Authorization": "Bearer basura"})).status_code == 401
    # Salud, nichos y archivos no necesitan sesión.
    health = await client.get("/api/health")
    assert health.json() == {"ok": True, "provider": "demo", "model": "demo-determinista"}
    niches = (await client.get("/api/niches")).json()
    assert {n["id"] for n in niches} >= {"finanzas", "tiempo", "estres"} and "keywords" in niches[0]


async def test_ebooks_de_otra_persona(client, services):
    ana = await register(client, "ana@correo.com")
    luis = await register(client, "luis@correo.com", "Luis")
    res = await client.post("/api/ebooks", json={"prompt": IDEA_FINANZAS, "desiredChapters": 5, "exercisePref": "auto", "author": "Ana"}, headers=ana)
    eid = res.json()["id"]
    assert (await client.get(f"/api/ebooks/{eid}", headers=luis)).status_code == 404
    assert (await client.get("/api/ebooks", headers=luis)).json() == []
    await wait_status(services, eid, "indice_pendiente")


async def test_perfil_y_borrar_cuenta(client, services):
    headers = await register(client, "ana@correo.com")
    res = await client.patch("/api/auth/me", json={"name": "Ana María"}, headers=headers)
    assert res.status_code == 200 and res.json()["name"] == "Ana María"
    assert (await client.patch("/api/auth/me", json={"name": "A"}, headers=headers)).status_code == 422

    res = await client.post("/api/ebooks", json={"prompt": IDEA_FINANZAS, "desiredChapters": 5, "exercisePref": "auto", "author": "Ana"}, headers=headers)
    eid = res.json()["id"]
    await wait_status(services, eid, "indice_pendiente")

    res = await client.delete("/api/auth/me", headers=headers)
    assert res.status_code == 204
    assert services.store.get(eid) is None
    assert (await client.get("/api/auth/me", headers=headers)).status_code == 401
    res = await client.post("/api/auth/login", json={"email": "ana@correo.com", "password": "secreto123"})
    assert res.status_code == 401


async def test_recuperar_contrasena(client, caplog):
    await register(client, "ana@correo.com")
    caplog.set_level(logging.WARNING, logger="folio.auth")
    res = await client.post("/api/auth/recover", json={"email": "nadie@correo.com"})
    assert res.status_code == 202
    res = await client.post("/api/auth/recover", json={"email": "ana@correo.com"})
    assert res.status_code == 202
    link = next(r.getMessage() for r in caplog.records if "recuperar?token=" in r.getMessage())
    token = re.search(r"token=([\w.-]+)", link).group(1)
    assert link.split(": ", 1)[1].startswith("http://localhost:3000/recuperar?token=")

    res = await client.post("/api/auth/reset", json={"token": token, "password": "nueva-clave"})
    assert res.status_code == 200 and res.json()["user"]["email"] == "ana@correo.com"
    # El enlace no vale dos veces: la contraseña ya cambió.
    assert (await client.post("/api/auth/reset", json={"token": token, "password": "otra-clave"})).status_code == 400
    assert (await client.post("/api/auth/login", json={"email": "ana@correo.com", "password": "nueva-clave"})).status_code == 200


def test_hash_de_contrasena():
    stored = hash_password("secreto123")
    assert stored.startswith("scrypt$") and "secreto123" not in stored
    assert verify_password("secreto123", stored)
    assert not verify_password("otra", stored)
    assert hash_password("secreto123") != stored  # sal distinta
