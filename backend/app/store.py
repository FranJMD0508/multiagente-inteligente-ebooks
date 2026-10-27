"""Repositorio de ebooks, usuarios y archivos.

Los ebooks viven en memoria (caché) y se guardan en SQLite con escritura
diferida (~0,5 s). `update(id, fn)` recibe una función **síncrona**: como no hay
`await` entre leer y escribir, cada actualización es atómica en el event loop.
Cada `update` publica `ebook.updated` con la instantánea completa;
`append_token` solo publica el trozo de texto (`token`).
"""

from __future__ import annotations

import asyncio
import json
import logging
import sqlite3
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import aiosqlite

from .events import EventBus
from .models import Ebook, Sections

log = logging.getLogger("folio.store")

FLUSH_DELAY_S = 0.5
FLUSH_RETRY_S = 2.0  # si falla la escritura, se reintenta pasado este tiempo

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ebooks (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    data TEXT NOT NULL,
    internal TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ebooks_owner ON ebooks(owner_id);
CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    ebook_id TEXT,
    mime TEXT NOT NULL,
    data BLOB NOT NULL,
    created_at TEXT NOT NULL,
    bright TEXT
);
CREATE INDEX IF NOT EXISTS assets_owner ON assets(owner_id);
"""


class DuplicateEmail(Exception):
    """Ya hay una cuenta con ese correo (restricción UNIQUE de `users.email`)."""


def now_iso() -> str:
    """Fecha en el mismo formato que `new Date().toISOString()`."""
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def next_rev(rev: int) -> int:
    """Revisión siguiente: al menos la hora en milisegundos, para que siga subiendo aunque el
    servidor se reinicie sin haber guardado las últimas (la escritura en disco es diferida)."""
    return max(rev + 1, int(datetime.now(UTC).timestamp() * 1000))


class Store:
    def __init__(self, db_path: Path, bus: EventBus) -> None:
        self.db_path = db_path
        self.bus = bus
        self._db: aiosqlite.Connection | None = None
        self._ebooks: dict[str, Ebook] = {}
        self._owners: dict[str, str] = {}
        self._internal: dict[str, dict[str, Any]] = {}
        self._dirty: set[str] = set()
        self._deleted: set[str] = set()
        self._flush_handle: asyncio.TimerHandle | None = None
        self._flush_task: asyncio.Future | None = None
        self._flush_lock = asyncio.Lock()

    # ---------- ciclo de vida ----------

    async def open(self) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._db = await aiosqlite.connect(self.db_path)
        await self._db.execute("PRAGMA journal_mode=WAL")
        await self._db.executescript(SCHEMA)
        await self._migrate()
        await self._db.commit()
        async with self._db.execute("SELECT id, owner_id, data, internal FROM ebooks") as cursor:
            async for ebook_id, owner_id, data, internal in cursor:
                try:
                    ebook = Ebook.model_validate(json.loads(data))
                except Exception:  # noqa: BLE001 - un registro corrupto no debe tumbar el servidor
                    log.exception("No se pudo cargar el ebook %s; se omite.", ebook_id)
                    continue
                self._ebooks[ebook_id] = ebook
                self._owners[ebook_id] = owner_id
                try:
                    self._internal[ebook_id] = json.loads(internal or "{}")
                except ValueError:
                    self._internal[ebook_id] = {}
        log.info("Store cargado: %d ebooks.", len(self._ebooks))

    async def _migrate(self) -> None:
        """Columnas añadidas después de la primera versión (las bases de datos existentes no las tienen)."""
        async with self.db.execute("PRAGMA table_info(assets)") as cur:
            columns = {row[1] for row in await cur.fetchall()}
        if "bright" not in columns:
            # Color medio del 5 % de píxeles más claros de la portada (RA-03), como JSON "[r, g, b]".
            await self.db.execute("ALTER TABLE assets ADD COLUMN bright TEXT")

    async def close(self) -> None:
        if self._flush_handle:
            self._flush_handle.cancel()
            self._flush_handle = None
        await self.flush()
        if self._db is not None:
            await self._db.close()
            self._db = None

    @property
    def db(self) -> aiosqlite.Connection:
        if self._db is None:
            raise RuntimeError("El store no está abierto")
        return self._db

    # ---------- persistencia diferida ----------

    def _mark(self, ebook_id: str) -> None:
        self._dirty.add(ebook_id)
        self._schedule_flush(FLUSH_DELAY_S)

    def _schedule_flush(self, delay: float) -> None:
        if self._flush_handle is None:
            loop = asyncio.get_running_loop()
            self._flush_handle = loop.call_later(delay, self._flush_soon)

    def _flush_soon(self) -> None:
        self._flush_handle = None
        self._flush_task = asyncio.ensure_future(self._flush_in_background())

    async def _flush_in_background(self) -> None:
        try:
            await self.flush()
        except Exception:  # noqa: BLE001 - flush() ya dejó los cambios pendientes y lo registró en el log
            # Sin esto, los cambios no se guardarían hasta la siguiente modificación de algún ebook.
            if self._db is not None and (self._dirty or self._deleted):
                self._schedule_flush(FLUSH_RETRY_S)

    async def flush(self) -> None:
        if self._db is None:
            return
        async with self._flush_lock:
            dirty, self._dirty = self._dirty, set()
            deleted, self._deleted = self._deleted, set()
            rows = []
            for ebook_id in dirty:
                ebook = self._ebooks.get(ebook_id)
                if ebook is None:
                    continue
                rows.append(
                    (
                        ebook_id,
                        self._owners[ebook_id],
                        json.dumps(ebook.dump(), ensure_ascii=False),
                        json.dumps(self._internal.get(ebook_id, {}), ensure_ascii=False),
                        ebook.created_at,
                        ebook.updated_at,
                    )
                )
            if not rows and not deleted:
                return
            try:
                if rows:
                    await self._db.executemany(
                        "INSERT OR REPLACE INTO ebooks (id, owner_id, data, internal, created_at, updated_at) "
                        "VALUES (?, ?, ?, ?, ?, ?)",
                        rows,
                    )
                for ebook_id in deleted:
                    await self._db.execute("DELETE FROM ebooks WHERE id = ?", (ebook_id,))
                await self._db.commit()
            except Exception:
                log.exception("No se pudieron guardar los cambios; se reintentará.")
                self._dirty |= dirty
                self._deleted |= deleted
                raise

    # ---------- eventos ----------

    def emit(self, ebook_id: str, event_type: str, **payload: Any) -> None:
        self.bus.publish(self._owners.get(ebook_id), {"type": event_type, "ebookId": ebook_id, **payload})

    def _publish_snapshot(self, ebook: Ebook) -> None:
        self.emit(ebook.id, "ebook.updated", ebook=ebook.dump())

    # ---------- ebooks ----------

    def get(self, ebook_id: str) -> Ebook | None:
        return self._ebooks.get(ebook_id)

    def exists(self, ebook_id: str) -> bool:
        return ebook_id in self._ebooks

    def owner_of(self, ebook_id: str) -> str | None:
        return self._owners.get(ebook_id)

    def all_ids(self) -> list[str]:
        return list(self._ebooks)

    def list_for(self, owner_id: str) -> list[Ebook]:
        mine = [e for eid, e in self._ebooks.items() if self._owners.get(eid) == owner_id]
        return sorted(mine, key=lambda e: e.created_at, reverse=True)

    def put(self, ebook: Ebook, owner_id: str, internal: dict[str, Any] | None = None) -> Ebook:
        self._ebooks[ebook.id] = ebook
        self._owners[ebook.id] = owner_id
        self._internal[ebook.id] = dict(internal or {})
        self._deleted.discard(ebook.id)
        self._mark(ebook.id)
        self._publish_snapshot(ebook)
        return ebook

    def update(self, ebook_id: str, fn: Callable[[Ebook], Ebook | None]) -> Ebook | None:
        """Aplica `fn` (síncrona) sobre una copia y publica la instantánea."""
        current = self._ebooks.get(ebook_id)
        if current is None:
            return None
        draft = current.model_copy(deep=True)
        result = fn(draft)
        new = result if isinstance(result, Ebook) else draft
        new.updated_at = now_iso()
        new.rev = next_rev(current.rev)
        self._ebooks[ebook_id] = new
        self._mark(ebook_id)
        self._publish_snapshot(new)
        return new

    def append_token(self, ebook_id: str, chapter: int, section: str, delta: str) -> None:
        """Concatena texto en memoria y publica solo el evento `token` (sin instantánea)."""
        ebook = self._ebooks.get(ebook_id)
        if ebook is None or not delta:
            return
        target = ebook.chapter(chapter)
        if target is None:
            return
        if target.sections is None:
            target.sections = Sections()
        setattr(target.sections, section, getattr(target.sections, section) + delta)
        ebook.rev = next_rev(ebook.rev)
        self._mark(ebook_id)
        self.emit(ebook_id, "token", chapter=chapter, section=section, delta=delta, rev=ebook.rev)

    def delete(self, ebook_id: str) -> None:
        owner = self._owners.get(ebook_id)
        self._ebooks.pop(ebook_id, None)
        self._internal.pop(ebook_id, None)
        self._dirty.discard(ebook_id)
        self._deleted.add(ebook_id)
        if self._db is not None:
            self._mark(ebook_id)
        self.bus.publish(owner, {"type": "ebook.deleted", "ebookId": ebook_id})
        self._owners.pop(ebook_id, None)

    # ---------- datos internos (no los ve el frontend) ----------

    def internal(self, ebook_id: str) -> dict[str, Any]:
        """Copia de los datos internos: brief, guía de estilo, veredicto del guardarraíl…"""
        return dict(self._internal.get(ebook_id, {}))

    def set_internal(self, ebook_id: str, **values: Any) -> None:
        if ebook_id not in self._ebooks:
            return
        self._internal.setdefault(ebook_id, {}).update(values)
        self._mark(ebook_id)

    # ---------- usuarios ----------

    async def create_user(self, user_id: str, name: str, email: str, password_hash: str) -> None:
        """Crea la cuenta. Lanza `DuplicateEmail` si el correo ya existe (también si dos registros llegan a la vez)."""
        try:
            await self.db.execute(
                "INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
                (user_id, name, email, password_hash, now_iso()),
            )
        except sqlite3.IntegrityError as exc:
            # SQLite deshace solo la sentencia fallida; no se hace rollback para no tocar
            # lo que otras corrutinas tengan pendiente en la misma conexión.
            raise DuplicateEmail(email) from exc
        await self.db.commit()

    async def _user_row(self, query: str, value: str) -> dict | None:
        async with self.db.execute(f"SELECT id, name, email, password_hash FROM users WHERE {query} = ?", (value,)) as cur:
            row = await cur.fetchone()
        if row is None:
            return None
        return {"id": row[0], "name": row[1], "email": row[2], "password_hash": row[3]}

    async def user_by_email(self, email: str) -> dict | None:
        return await self._user_row("email", email)

    async def user_by_id(self, user_id: str) -> dict | None:
        return await self._user_row("id", user_id)

    async def update_user(self, user_id: str, *, name: str | None = None, password_hash: str | None = None) -> None:
        if name is not None:
            await self.db.execute("UPDATE users SET name = ? WHERE id = ?", (name, user_id))
        if password_hash is not None:
            await self.db.execute("UPDATE users SET password_hash = ? WHERE id = ?", (password_hash, user_id))
        await self.db.commit()

    async def delete_user(self, user_id: str) -> None:
        await self.db.execute("DELETE FROM users WHERE id = ?", (user_id,))
        await self.db.execute("DELETE FROM assets WHERE owner_id = ?", (user_id,))
        await self.db.commit()

    # ---------- archivos (portadas) ----------

    async def put_asset(
        self,
        asset_id: str,
        owner_id: str,
        ebook_id: str | None,
        mime: str,
        data: bytes,
        bright: tuple[float, float, float] | list[float] | None = None,
    ) -> None:
        await self.db.execute(
            "INSERT INTO assets (id, owner_id, ebook_id, mime, data, created_at, bright) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (asset_id, owner_id, ebook_id, mime, data, now_iso(), _bright_json(bright)),
        )
        await self.db.commit()

    async def get_asset(self, asset_id: str) -> dict | None:
        async with self.db.execute(
            "SELECT owner_id, ebook_id, mime, data, bright FROM assets WHERE id = ?", (asset_id,)
        ) as cur:
            row = await cur.fetchone()
        if row is None:
            return None
        return {"owner_id": row[0], "ebook_id": row[1], "mime": row[2], "data": row[3], "bright": _bright_value(row[4])}

    async def get_asset_meta(self, asset_id: str) -> dict | None:
        """Como `get_asset`, sin cargar la imagen."""
        async with self.db.execute("SELECT owner_id, ebook_id, mime, bright FROM assets WHERE id = ?", (asset_id,)) as cur:
            row = await cur.fetchone()
        if row is None:
            return None
        return {"owner_id": row[0], "ebook_id": row[1], "mime": row[2], "bright": _bright_value(row[3])}

    async def set_asset_bright(self, asset_id: str, bright: tuple[float, float, float] | list[float]) -> None:
        await self.db.execute("UPDATE assets SET bright = ? WHERE id = ?", (_bright_json(bright), asset_id))
        await self.db.commit()

    async def asset_ids_for_ebook(self, ebook_id: str, owner_id: str) -> list[str]:
        """Imágenes que su dueño subió para ese ebook (un id de ebook puede volver a usarse tras borrarlo)."""
        async with self.db.execute("SELECT id FROM assets WHERE ebook_id = ? AND owner_id = ?", (ebook_id, owner_id)) as cur:
            return [row[0] for row in await cur.fetchall()]

    async def delete_assets(self, asset_ids: list[str]) -> None:
        if not asset_ids:
            return
        await self.db.executemany("DELETE FROM assets WHERE id = ?", [(a,) for a in asset_ids])
        await self.db.commit()


def _bright_json(bright) -> str | None:
    return json.dumps([round(float(v), 4) for v in bright]) if bright is not None else None


def _bright_value(raw: str | None) -> list[float] | None:
    if not raw:
        return None
    try:
        values = [float(v) for v in json.loads(raw)]
    except (ValueError, TypeError):
        return None
    return values if len(values) == 3 else None
