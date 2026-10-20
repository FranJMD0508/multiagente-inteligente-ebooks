"""Ebooks: biblioteca, puntos de control (HITL), edición, diseño y reintentos.

Cada ruta que modifica un ebook devuelve el ebook completo (200, o 202 si lanza
trabajo). Las reglas son las de `frontend/src/lib/api/index.ts`.
"""

from __future__ import annotations

import asyncio
import re
import secrets
import uuid
from typing import Any, Literal

from fastapi import APIRouter, File, Response, UploadFile
from pydantic import Field

from ..agents import maquetador
from ..agents.redactor import live_markdown, normalize_markdown
from ..cover_image import WORST_CASE, ImageTooLarge, ImageUnreadable, bright_color, min_veil_for
from ..design import HEX_RE, accessible_cloth, contrast_ratio, format_ratio
from ..graph.activity import settle_working
from ..graph.mutations import (
    outline_snapshot,
    push_chapter_one_history,
    renumber,
    restore_previous_chapter_one,
    restore_previous_outline,
    to_chapters,
    undo_chapter_one_adjustment,
)
from ..graph.state import APPROVED_KEY, entry_for_status, sections_complete
from ..llm import LLMError
from ..models import (
    MAX_CHAPTERS,
    MIN_CHAPTERS,
    SECTION_ORDER,
    BackCover,
    BusyState,
    CamelModel,
    Chapter,
    Ebook,
    EbookDesign,
    Sections,
)
from ..niches import NICHE_IDS, detect_niche, get_niche
from ..store import now_iso
from .deps import ServicesDep, UserDep, fail, owned_ebook

router = APIRouter(prefix="/ebooks", tags=["ebooks"])

ID_RE = re.compile(r"^[A-Za-z0-9_-]{8,64}$")
ASSET_RE = re.compile(r"(?:^|/)api/assets/([0-9a-f]{32})$")
MAX_IMAGE_BYTES = 5 * 1024 * 1024

MSG_BUSY = "Espera a que termine el cambio en curso."


# ---------- cuerpos de las peticiones ----------


class NewEbookBody(CamelModel):
    id: str | None = None
    prompt: str = ""
    niche_id: str | None = None
    audience: str | None = None
    desired_chapters: Literal[5, 6, 7, "auto"] = "auto"
    exercise_pref: Literal["auto", "checklist", "reto"] = "auto"
    author: str = ""


class MetaBody(CamelModel):
    title: str | None = None
    subtitle: str | None = None


class DuplicateBody(CamelModel):
    new_id: str | None = None


class OutlineChapterIn(CamelModel):
    id: str | None = None
    title: str = ""
    summary: str = ""
    key_points: list[str] = Field(default_factory=list)


class OutlineBody(CamelModel):
    chapters: list[OutlineChapterIn] = Field(default_factory=list)


class FeedbackBody(CamelModel):
    feedback: str = ""


class AdjustBody(CamelModel):
    chips: list[Literal["mas_cercano", "mas_ejemplos", "mas_corto", "menos_formal", "otro_ejercicio"]] = Field(default_factory=list)
    note: str = ""


class ManualBody(CamelModel):
    sections: Sections


class SectionBody(CamelModel):
    section: Literal["introduccion", "desarrollo", "ejemplos", "conclusion"]
    text: str = ""


# ---------- utilidades ----------


def _snapshot(ebook: Ebook | None) -> dict:
    return ebook.dump() if ebook is not None else {}


def _require_status(ebook: Ebook, statuses: tuple[str, ...], message: str) -> None:
    if ebook.status not in statuses:
        fail(409, "estado", message)


async def _require_idle(services, ebook: Ebook) -> None:
    """Sin cambios en curso. Si el grafo está llegando a la pausa (acaba de emitir
    `checkpoint.required`), se espera un momento a que se detenga."""
    if ebook.busy is not None:
        fail(409, "ocupado", MSG_BUSY)
    if services.runner.running(ebook.id):
        try:
            await services.tasks.wait(ebook.id, timeout=5)
        except (TimeoutError, Exception):  # noqa: BLE001
            pass
        if services.runner.running(ebook.id):
            fail(409, "ocupado", MSG_BUSY)


def _new_id(candidate: str | None, services) -> str:
    if candidate:
        if not ID_RE.match(candidate):
            fail(422, "validacion", "El identificador del ebook no es válido.")
        if services.store.exists(candidate):
            fail(409, "id_en_uso", "Ya existe un ebook con ese identificador.")
        return candidate
    return str(uuid.uuid4())


def _clean_text(text: str, limit: int) -> str:
    return re.sub(r"\s+", " ", text or "").strip()[:limit]


def _live_text(text: str, limit: int) -> str:
    """Texto que se edita en vivo (título, subtítulo, autor…): sin saltos de línea, pero sin
    recortar espacios, para no mover el cursor de quien escribe. Se recorta al exportar."""
    return re.sub(r"[\r\n\t]+", " ", text or "")[:limit]


# ---------- biblioteca ----------


@router.get("")
async def list_ebooks(user: UserDep, services: ServicesDep) -> list[dict]:
    return [e.dump() for e in services.store.list_for(user["id"])]


@router.post("", status_code=201)
async def create_ebook(body: NewEbookBody, user: UserDep, services: ServicesDep) -> dict:
    prompt = body.prompt.strip()
    if len(prompt) < 12:
        fail(422, "validacion", "Cuéntanos un poco más de tu idea (al menos 12 caracteres).")
    if len(prompt) > 2000:
        fail(422, "validacion", "La idea es demasiado larga. Resúmela en menos de 2.000 caracteres.")
    ebook_id = _new_id(body.id, services)
    chosen = body.niche_id if body.niche_id in NICHE_IDS or body.niche_id == "general" else None
    niche = get_niche(chosen) if chosen else detect_niche(prompt)
    audience = _clean_text(body.audience or "", 160)
    now = now_iso()
    ebook = Ebook(
        id=ebook_id,
        title="Tu nuevo ebook",
        subtitle="",
        prompt=prompt,
        niche_id=niche.id,
        audience=audience or niche.audience,
        desired_chapters=body.desired_chapters,
        exercise_pref=body.exercise_pref,
        status="investigando",
        sensitivity=niche.sensitivity,  # type: ignore[arg-type]
        design=EbookDesign(
            cover_template="clasica",
            cloth_color=niche.cloth,
            title_font="Lexend",
            title_size="m",
            title_align="start",
            back_cover=BackCover(enabled=True, blurb=""),
            font="Roboto",
            body_size_pt=11,
            page_size="A5",
            author=_clean_text(body.author, 120),
        ),
        references=[],
        references_state="pendiente",
        created_at=now,
        updated_at=now,
    )
    services.store.put(
        ebook,
        user["id"],
        internal={"nicheFromUser": bool(chosen), "audienceFromUser": bool(audience), APPROVED_KEY: False},
    )
    services.runner.start(ebook_id, "inicio")
    return ebook.dump()


@router.get("/{ebook_id}")
async def get_ebook(ebook_id: str, user: UserDep, services: ServicesDep) -> dict:
    return owned_ebook(services, ebook_id, user).dump()


@router.patch("/{ebook_id}")
async def update_meta(ebook_id: str, body: MetaBody, user: UserDep, services: ServicesDep) -> dict:
    owned_ebook(services, ebook_id, user)
    fields = body.model_fields_set
    title = _live_text(body.title or "", 160) if "title" in fields else None
    if "title" in fields and not (title or "").strip():
        fail(422, "validacion", "Escribe un título para tu ebook.")

    def apply(e: Ebook) -> None:
        if title is not None:
            e.title = title
        if "subtitle" in fields:
            e.subtitle = _live_text(body.subtitle or "", 240)

    return _snapshot(services.store.update(ebook_id, apply))


@router.delete("/{ebook_id}", status_code=204)
async def delete_ebook(ebook_id: str, user: UserDep, services: ServicesDep) -> Response:
    owned_ebook(services, ebook_id, user)
    await services.runner.delete(ebook_id)
    # Solo se borran las imágenes que no usa otro ebook (las copias comparten portada).
    used = {
        e.design.cover_image.src
        for e in services.store.list_for(user["id"])
        if e.id != ebook_id and e.design.cover_image is not None
    }
    own = await services.store.asset_ids_for_ebook(ebook_id, user["id"])
    ebook = services.store.get(ebook_id)
    if ebook and ebook.design.cover_image:
        match = ASSET_RE.search(ebook.design.cover_image.src)
        if match:
            own.append(match.group(1))
    await services.store.delete_assets([a for a in set(own) if f"/api/assets/{a}" not in used])
    services.store.delete(ebook_id)
    return Response(status_code=204)


@router.post("/{ebook_id}/duplicate", status_code=201)
async def duplicate(ebook_id: str, user: UserDep, services: ServicesDep, body: DuplicateBody | None = None) -> dict:
    original = owned_ebook(services, ebook_id, user)
    _require_status(original, ("listo", "indice_pendiente", "cap1_pendiente"), "Solo puedes duplicar un ebook listo o en pausa.")
    new_id = _new_id(body.new_id if body else None, services)
    now = now_iso()
    copy = original.model_copy(deep=True)
    copy.id = new_id
    copy.title = f"{original.title} (copia)"
    copy.created_at = now
    copy.updated_at = now
    if copy.busy is not None:
        # Igual que al retomar: un cambio a medias no se copia. Al rehacer el índice ya se
        # guardó la versión actual en el historial: se saca para no dejarla repetida.
        if copy.busy.kind == "capitulo1":
            undo_chapter_one_adjustment(copy)
        elif copy.busy.kind == "indice":
            restore_previous_outline(copy)
        copy.busy = None
        settle_working(copy)
    for ref in copy.references:
        if ref.check == "pendiente":
            ref.check = "sin_verificar"
    suggesting = copy.references_state == "sugiriendo"
    if suggesting:
        copy.references_state = "pendiente"
    services.store.put(copy, user["id"], internal=services.store.internal(ebook_id))
    if copy.status in ("indice_pendiente", "cap1_pendiente"):
        # El hilo nuevo llega a la misma pausa sin cambiar nada del ebook.
        services.runner.start(new_id, entry_for_status(copy.status))
    if suggesting:
        services.readings.suggest(new_id)
    return _snapshot(services.store.get(new_id))


# ---------- Punto de control 1: índice ----------


@router.put("/{ebook_id}/outline")
async def put_outline(ebook_id: str, body: OutlineBody, user: UserDep, services: ServicesDep) -> dict:
    async with services.runner.lock(ebook_id):
        ebook = owned_ebook(services, ebook_id, user)
        _require_status(ebook, ("indice_pendiente",), "El índice ya no se puede cambiar en este momento.")
        await _require_idle(services, ebook)
        if not MIN_CHAPTERS <= len(body.chapters) <= MAX_CHAPTERS:
            fail(422, "capitulos", f"El índice debe tener entre {MIN_CHAPTERS} y {MAX_CHAPTERS} capítulos.")
        seen: set[str] = set()
        chapters: list[Chapter] = []
        for i, item in enumerate(body.chapters, start=1):
            title = _clean_text(item.title, 160)
            if not title:
                fail(422, "validacion", f"El capítulo {i} necesita un título.")
            cid = item.id if item.id and ID_RE.match(item.id) and item.id not in seen else str(uuid.uuid4())
            seen.add(cid)
            points = [_clean_text(p, 200) for p in item.key_points if _clean_text(p, 200)][:5]
            chapters.append(
                Chapter(id=cid, number=i, status="pendiente", title=title, summary=_clean_text(item.summary, 400), key_points=points)
            )

        def apply(e: Ebook) -> None:
            e.chapters = renumber(chapters)

        return _snapshot(services.store.update(ebook_id, apply))


@router.post("/{ebook_id}/outline/regenerate", status_code=202)
async def regenerate_outline(ebook_id: str, user: UserDep, services: ServicesDep, body: FeedbackBody | None = None) -> dict:
    feedback = _clean_text(body.feedback if body else "", 500)
    async with services.runner.lock(ebook_id):
        ebook = owned_ebook(services, ebook_id, user)
        _require_status(ebook, ("indice_pendiente",), "El índice ya no se puede cambiar en este momento.")
        await _require_idle(services, ebook)
        await services.runner.ensure_paused(ebook_id, "outline")

        def apply(e: Ebook) -> None:
            e.outline_history = [*e.outline_history, outline_snapshot(e)]
            e.busy = BusyState(kind="indice", message="El Investigador está preparando otra versión…")

        snapshot = services.store.update(ebook_id, apply)
        services.runner.resume(ebook_id, {"action": "regenerate", "feedback": feedback})
        return _snapshot(snapshot)


@router.post("/{ebook_id}/outline/chapters/{chapter_id}/regenerate", status_code=202)
async def regenerate_outline_item(ebook_id: str, chapter_id: str, user: UserDep, services: ServicesDep) -> dict:
    async with services.runner.lock(ebook_id):
        ebook = owned_ebook(services, ebook_id, user)
        _require_status(ebook, ("indice_pendiente",), "El índice ya no se puede cambiar en este momento.")
        await _require_idle(services, ebook)
        if not any(c.id == chapter_id for c in ebook.chapters):
            fail(404, "no_encontrado", "No encontramos ese capítulo en el índice.")
        await services.runner.ensure_paused(ebook_id, "outline")

        def apply(e: Ebook) -> None:
            e.busy = BusyState(kind="capitulo_indice", chapter_id=chapter_id, message="Buscando otra propuesta para este capítulo…")

        snapshot = services.store.update(ebook_id, apply)
        services.runner.resume(ebook_id, {"action": "regenerate_item", "chapterId": chapter_id})
        return _snapshot(snapshot)


@router.post("/{ebook_id}/outline/restore")
async def restore_outline(ebook_id: str, user: UserDep, services: ServicesDep) -> dict:
    async with services.runner.lock(ebook_id):
        ebook = owned_ebook(services, ebook_id, user)
        _require_status(ebook, ("indice_pendiente",), "El índice ya no se puede cambiar en este momento.")
        await _require_idle(services, ebook)
        return _snapshot(services.store.update(ebook_id, restore_previous_outline))


@router.post("/{ebook_id}/outline/approve", status_code=202)
async def approve_outline(ebook_id: str, user: UserDep, services: ServicesDep) -> dict:
    async with services.runner.lock(ebook_id):
        ebook = owned_ebook(services, ebook_id, user)
        _require_status(ebook, ("indice_pendiente",), "El índice ya está aprobado.")
        await _require_idle(services, ebook)
        if not MIN_CHAPTERS <= len(ebook.chapters) <= MAX_CHAPTERS:
            fail(422, "capitulos", f"El índice debe tener entre {MIN_CHAPTERS} y {MAX_CHAPTERS} capítulos.")
        await services.runner.ensure_paused(ebook_id, "outline")

        def apply(e: Ebook) -> None:
            e.chapters = to_chapters(e.chapters)
            e.status = "redactando_cap1"
            e.error = None

        snapshot = services.store.update(ebook_id, apply)
        services.runner.resume(ebook_id, {"action": "approve"})
        # Lecturas recomendadas en segundo plano: no bloquean el capítulo 1.
        if snapshot is not None and snapshot.references_state in ("pendiente", "error"):
            services.readings.suggest(ebook_id)
            snapshot = services.store.get(ebook_id)
        return _snapshot(snapshot)


@router.post("/{ebook_id}/cancel")
async def cancel_busy(ebook_id: str, user: UserDep, services: ServicesDep) -> dict:
    """Cancela el trabajo en curso durante una pausa y conserva la versión anterior (api.cancelBusy)."""
    async with services.runner.lock(ebook_id):
        ebook = owned_ebook(services, ebook_id, user)
        if ebook.busy is None or ebook.status not in ("indice_pendiente", "cap1_pendiente"):
            return ebook.dump()
        await services.tasks.cancel(ebook_id)
        kind = ebook.busy.kind

        def apply(e: Ebook) -> None:
            if kind == "indice":
                restore_previous_outline(e)
            elif kind == "capitulo1":
                undo_chapter_one_adjustment(e)
            e.busy = None
            settle_working(e, " · cancelado")

        snapshot = services.store.update(ebook_id, apply)
        await services.runner.reset_to_pause(ebook_id, "outline" if ebook.status == "indice_pendiente" else "chapter1")
        return _snapshot(services.store.get(ebook_id) or snapshot)


# ---------- Punto de control 2: capítulo 1 ----------


def _chapter_one_ready(ebook: Ebook) -> None:
    if not ebook.chapters or ebook.chapters[0].sections is None:
        fail(409, "estado", "El capítulo 1 todavía no está escrito.")


@router.post("/{ebook_id}/chapters/1/regenerate", status_code=202)
async def adjust_chapter_one(ebook_id: str, user: UserDep, services: ServicesDep, body: AdjustBody | None = None) -> dict:
    body = body or AdjustBody()
    async with services.runner.lock(ebook_id):
        ebook = owned_ebook(services, ebook_id, user)
        _require_status(ebook, ("cap1_pendiente",), "El capítulo 1 ya no se puede cambiar en este momento.")
        await _require_idle(services, ebook)
        _chapter_one_ready(ebook)
        await services.runner.ensure_paused(ebook_id, "chapter1")

        def apply(e: Ebook) -> None:
            push_chapter_one_history(e)
            e.busy = BusyState(kind="capitulo1", message="El Redactor está aplicando tus ajustes…")

        snapshot = services.store.update(ebook_id, apply)
        services.runner.resume(ebook_id, {"action": "adjust", "chips": list(dict.fromkeys(body.chips)), "note": body.note.strip()[:600]})
        return _snapshot(snapshot)


@router.post("/{ebook_id}/chapters/1/restore")
async def restore_chapter_one(ebook_id: str, user: UserDep, services: ServicesDep) -> dict:
    async with services.runner.lock(ebook_id):
        ebook = owned_ebook(services, ebook_id, user)
        _require_status(ebook, ("cap1_pendiente",), "El capítulo 1 ya no se puede cambiar en este momento.")
        await _require_idle(services, ebook)
        return _snapshot(services.store.update(ebook_id, restore_previous_chapter_one))


def _clean_sections(sections: Sections) -> Sections:
    cleaned = Sections(**{s: normalize_markdown(getattr(sections, s)) for s in SECTION_ORDER})
    if any(not getattr(cleaned, s) for s in SECTION_ORDER):
        fail(422, "seccion_vacia", "Ninguna sección puede quedar vacía: el capítulo necesita sus cuatro partes.")
    return cleaned


@router.put("/{ebook_id}/chapters/1/manual")
async def edit_chapter_one_manually(ebook_id: str, body: ManualBody, user: UserDep, services: ServicesDep) -> dict:
    async with services.runner.lock(ebook_id):
        ebook = owned_ebook(services, ebook_id, user)
        _require_status(ebook, ("cap1_pendiente",), "El capítulo 1 ya no se puede cambiar en este momento.")
        await _require_idle(services, ebook)
        _chapter_one_ready(ebook)
        sections = _clean_sections(body.sections)

        def apply(e: Ebook) -> None:
            push_chapter_one_history(e)
            e.chapter_one_version += 1
            first = e.chapters[0]
            first.sections = sections
            first.status = "editado"

        return _snapshot(services.store.update(ebook_id, apply))


@router.post("/{ebook_id}/chapters/1/approve", status_code=202)
async def approve_chapter_one(ebook_id: str, user: UserDep, services: ServicesDep) -> dict:
    async with services.runner.lock(ebook_id):
        ebook = owned_ebook(services, ebook_id, user)
        _require_status(ebook, ("cap1_pendiente",), "El capítulo 1 ya está aprobado.")
        await _require_idle(services, ebook)
        _chapter_one_ready(ebook)
        await services.runner.ensure_paused(ebook_id, "chapter1")

        def apply(e: Ebook) -> None:
            first = e.chapters[0]
            first.status = "editado" if first.status == "editado" else "aprobado"
            e.status = "redactando"
            e.error = None

        snapshot = services.store.update(ebook_id, apply)
        # RF-05: el resto del libro solo se escribe con este indicador (se guarda junto con el estado).
        services.store.set_internal(ebook_id, **{APPROVED_KEY: True})
        services.runner.resume(ebook_id, {"action": "approve"})
        return _snapshot(snapshot)


# ---------- Edición en la revisión final ----------


@router.patch("/{ebook_id}/chapters/{number}")
async def edit_section(ebook_id: str, number: int, body: SectionBody, user: UserDep, services: ServicesDep) -> dict:
    ebook = owned_ebook(services, ebook_id, user)
    chapter = ebook.chapter(number)
    if chapter is None:
        fail(404, "no_encontrado", "No encontramos ese capítulo.")
    if chapter.sections is None or chapter.status == "generando":
        fail(409, "estado", "Este capítulo todavía se está escribiendo.")
    if number == 1 and ebook.busy is not None and ebook.busy.kind == "capitulo1":
        fail(409, "ocupado", MSG_BUSY)
    # RA-01: en el editor no se crean H1 ni H2; se convierten en H3. Se acepta un
    # texto vacío porque el editor guarda mientras escribes (la sección sigue existiendo),
    # y no se recortan espacios para no mover el cursor. Al exportar se normaliza del todo.
    text = live_markdown(body.text)

    def apply(e: Ebook) -> None:
        target = e.chapter(number)
        if target is not None and target.sections is not None:
            setattr(target.sections, body.section, text)
            target.status = "editado"

    return _snapshot(services.store.update(ebook_id, apply))


# ---------- Diseño ----------


def _asset_id(src: str) -> str | None:
    match = ASSET_RE.search((src or "").split("?")[0].rstrip("/"))
    return match.group(1) if match else None


def _enum(value: Any, allowed: tuple, message: str) -> Any:
    if value not in allowed:
        fail(422, "validacion", message)
    return value


class _AssetsChanged(Exception):
    """La imagen de portada cambió entre la consulta de sus datos y el cambio del diseño."""


async def _asset_info(services, asset_id: str) -> dict | None:
    """Dueño y color de las zonas claras de una imagen (calculado al subirla o, si es
    anterior a ese cálculo, ahora mismo y guardado para la próxima vez)."""
    meta = await services.store.get_asset_meta(asset_id)
    if meta is None:
        return None
    bright = meta["bright"]
    if bright is None:
        asset = await services.store.get_asset(asset_id)
        try:
            bright = list(await asyncio.to_thread(bright_color, asset["data"])) if asset else list(WORST_CASE)
        except (ImageUnreadable, ImageTooLarge):
            bright = list(WORST_CASE)
        await services.store.set_asset_bright(asset_id, bright)
    return {"owner_id": meta["owner_id"], "bright": tuple(bright)}


def _assets_to_check(patch: dict, current: EbookDesign) -> set[str]:
    """Imágenes que puede necesitar el parche: la que envía el cliente y la que ya tiene el ebook."""
    ids: set[str] = set()
    image = patch.get("coverImage")
    if isinstance(image, dict) and image.get("src"):
        ids.add(_asset_id(str(image["src"])) or "")
    if current.cover_image is not None:
        ids.add(_asset_id(current.cover_image.src) or "")
    ids.discard("")
    return ids


def _merge_design(current: EbookDesign, patch: dict, user: dict, assets: dict[str, dict | None]) -> EbookDesign:
    """Aplica el parche sobre el diseño actual (síncrono: se llama dentro de `store.update`).

    RA-03: si el parche toca la imagen o la tela, el velo mínimo lo calcula el servidor
    con el color de las zonas claras de la imagen (el `minVeil` del cliente se ignora) y,
    si el velo pedido se queda corto, se sube en silencio hasta ese mínimo."""
    data = current.dump()
    if "coverTemplate" in patch:
        data["coverTemplate"] = _enum(patch["coverTemplate"], ("clasica", "centrada", "franja", "marco", "editorial"), "Esa plantilla de portada no existe.")
    if "clothColor" in patch:
        color = str(patch["clothColor"] or "")
        if not HEX_RE.match(color):
            fail(422, "validacion", "El color de la tela debe ser un hexadecimal, por ejemplo #2F6B58.")
        ratio = contrast_ratio(color, "#FFFFFF")
        if ratio < 4.5:
            fail(
                422,
                "contraste",
                f"Con ese color el texto blanco de la portada no se lee bien (contraste {format_ratio(ratio)}; "
                f"hace falta 4,5:1). Prueba con uno más oscuro, como {accessible_cloth(color)}.",
                suggestion=accessible_cloth(color),
            )
        data["clothColor"] = color.upper()
    if "titleFont" in patch:
        data["titleFont"] = _enum(patch["titleFont"], ("Lexend", "Onest", "Roboto"), "Esa letra para el título no está disponible.")
    if "titleSize" in patch:
        data["titleSize"] = _enum(patch["titleSize"], ("s", "m", "l"), "El tamaño del título debe ser s, m o l.")
    if "titleAlign" in patch:
        data["titleAlign"] = _enum(patch["titleAlign"], ("start", "center"), "La alineación del título debe ser start o center.")
    if "font" in patch:
        data["font"] = _enum(patch["font"], ("Roboto", "Arial", "Helvetica"), "La letra del libro debe ser Roboto, Arial o Helvetica.")
    if "bodySizePt" in patch:
        size = patch["bodySizePt"]
        if isinstance(size, bool) or size not in (11, 12, 13):
            fail(422, "validacion", "El tamaño del texto debe ser 11, 12 o 13 pt.")
        data["bodySizePt"] = int(size)
    if "pageSize" in patch:
        data["pageSize"] = _enum(patch["pageSize"], ("A5", "A4", "Carta", "6x9"), "El tamaño de página debe ser A5, A4, Carta o 6x9.")
    if "author" in patch:
        data["author"] = _live_text(str(patch["author"] or ""), 120)
    if "backCover" in patch:
        back = patch["backCover"] or {}
        if not isinstance(back, dict):
            fail(422, "validacion", "La contraportada no tiene un formato válido.")
        merged = {**data.get("backCover", {}), **{k: v for k, v in back.items() if k in ("enabled", "blurb")}}
        blurb = str(merged.get("blurb") or "")
        if len(blurb.strip()) > 1500:
            fail(422, "validacion", "La sinopsis es demasiado larga (máximo 1.500 caracteres).")
        data["backCover"] = {"enabled": bool(merged.get("enabled", True)), "blurb": blurb}
    if "coverImage" in patch:
        image = patch["coverImage"]
        if image is None:
            data.pop("coverImage", None)
        else:
            if not isinstance(image, dict):
                fail(422, "validacion", "La imagen de portada no tiene un formato válido.")
            merged = {**(data.get("coverImage") or {}), **image}
            asset = _asset_id(str(merged.get("src") or ""))
            if asset is not None and asset not in assets:
                raise _AssetsChanged(asset)
            stored = assets.get(asset) if asset else None
            if stored is None or stored["owner_id"] != user["id"]:
                fail(422, "imagen", "Esa imagen no está en tu cuenta. Súbela de nuevo.")
            placement = _enum(merged.get("placement", "fondo"), ("fondo", "recuadro"), "La imagen va de fondo o en recuadro.")
            try:
                veil = float(merged.get("veil", 0.55))
                focus_y = float(merged.get("focusY", 50))
            except (TypeError, ValueError):
                fail(422, "validacion", "Los ajustes de la imagen no son válidos.")
            if not 0 <= veil <= 1:
                fail(422, "validacion", "El velo de la imagen debe estar entre 0 y 1.")
            if not 0 <= focus_y <= 100:
                fail(422, "validacion", "El encuadre de la imagen debe estar entre 0 y 100.")
            data["coverImage"] = {
                "src": f"/api/assets/{asset}",
                "placement": placement,
                "veil": veil,
                "minVeil": 0.0,  # se calcula abajo
                "focusY": focus_y,
                "alt": _live_text(str(merged.get("alt") or ""), 300),
            }
    image = data.get("coverImage")
    if image and ("coverImage" in patch or "clothColor" in patch):
        asset = _asset_id(str(image.get("src") or ""))
        if asset is not None and asset not in assets:
            raise _AssetsChanged(asset)
        stored = assets.get(asset) if asset else None
        bright = stored["bright"] if stored else WORST_CASE
        min_veil = min_veil_for(bright, data["clothColor"])
        image["minVeil"] = min_veil
        image["veil"] = max(float(image.get("veil", 0.0)), min_veil)
    return EbookDesign.model_validate(data)


@router.put("/{ebook_id}/design")
async def update_design(ebook_id: str, patch: dict[str, Any], user: UserDep, services: ServicesDep) -> dict:
    """Parche parcial del diseño. Se calcula dentro de `store.update`, sobre el diseño de ese
    momento: dos cambios simultáneos (o la sinopsis que escribe el Maquetador) no se pisan.
    Lo único asíncrono, consultar las imágenes, se hace antes."""
    for _ in range(3):
        ebook = owned_ebook(services, ebook_id, user)
        assets = {asset_id: await _asset_info(services, asset_id) for asset_id in _assets_to_check(patch, ebook.design)}

        def apply(e: Ebook, assets=assets) -> None:
            e.design = _merge_design(e.design, patch, user, assets)

        try:
            return _snapshot(services.store.update(ebook_id, apply))
        except _AssetsChanged:
            continue  # la portada cambió mientras se consultaba: otra vuelta con la nueva
    fail(409, "ocupado", MSG_BUSY)


def _image_type(head: bytes) -> str | None:
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp"
    return None


@router.post("/{ebook_id}/cover-image", status_code=201)
async def upload_cover_image(ebook_id: str, user: UserDep, services: ServicesDep, file: UploadFile = File(...)) -> dict:
    owned_ebook(services, ebook_id, user)
    data = await file.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        fail(413, "imagen_grande", "La imagen pesa más de 5 MB. Prueba con una más ligera.")
    mime = _image_type(data[:16])
    if mime is None:
        fail(415, "formato", "Sube una imagen JPG, PNG o WebP.")
    # RA-03: el color de las zonas claras se calcula aquí (en un hilo) y se guarda con la imagen;
    # de él sale el velo mínimo de la portada en cada cambio del diseño.
    try:
        bright = await asyncio.to_thread(bright_color, data)
    except ImageTooLarge:
        fail(413, "imagen_grande", "La imagen tiene demasiados píxeles. Prueba con una más pequeña.")
    except ImageUnreadable:
        fail(415, "formato", "No pudimos abrir la imagen. Prueba con otra en JPG, PNG o WebP.")
    asset_id = secrets.token_hex(16)
    await services.store.put_asset(asset_id, user["id"], ebook_id, mime, data, bright=bright)
    # No cambia el diseño: el cliente lo hace con PUT /design.
    return {"url": f"/api/assets/{asset_id}"}


@router.post("/{ebook_id}/back-cover/suggest")
async def suggest_back_cover(ebook_id: str, user: UserDep, services: ServicesDep) -> dict:
    ebook = owned_ebook(services, ebook_id, user)
    if not ebook.chapters:
        fail(409, "estado", "Primero hace falta un índice para escribir la contraportada.")
    variant = services.store.internal(ebook_id).get("blurbVariant", 0) + 1
    try:
        blurb = await maquetador.write_back_cover(services.llm, ebook, previous=ebook.design.back_cover.blurb, variant=variant)
    except LLMError:
        fail(502, "llm", "No pudimos escribir una sinopsis ahora. Inténtalo de nuevo en un momento.")
    services.store.set_internal(ebook_id, blurbVariant=variant)

    def apply(e: Ebook) -> None:
        e.design.back_cover.blurb = blurb

    return _snapshot(services.store.update(ebook_id, apply))


# ---------- Reintentar ----------


@router.post("/{ebook_id}/retry", status_code=202)
async def retry(ebook_id: str, user: UserDep, services: ServicesDep) -> dict:
    async with services.runner.lock(ebook_id):
        ebook = owned_ebook(services, ebook_id, user)
        if ebook.status != "error" or ebook.error is None or not ebook.error.retryable:
            fail(409, "estado", "No hay nada que reintentar en este ebook.")
        if services.runner.running(ebook_id):
            # La tarea que falló puede estar terminando justo ahora.
            try:
                await services.tasks.wait(ebook_id, timeout=5)
            except Exception:  # noqa: BLE001
                pass
            if services.runner.running(ebook_id):
                fail(409, "ocupado", MSG_BUSY)
        ebook = owned_ebook(services, ebook_id, user)
        if ebook.status != "error" or ebook.error is None:
            fail(409, "estado", "No hay nada que reintentar en este ebook.")
        resume_status = ebook.error.resume_status
        failed = ebook.error.chapter
        phase = services.store.internal(ebook_id).get("failedPhase") or {}
        exercise_only: dict | None = None

        def apply(e: Ebook) -> None:
            nonlocal exercise_only
            e.status = resume_status  # type: ignore[assignment]
            e.error = None
            if failed:
                target = e.chapter(failed)
                if target is None:
                    return
                if phase.get("chapter") == failed and phase.get("phase") == "ejercicio" and sections_complete(target.sections):
                    # Solo falló el ejercicio y el texto está completo: se conserva (con lo que
                    # haya editado la persona) y se relanza solo el agente de Ejercicios.
                    exercise_only = {"chapter": failed, "edited": target.status == "editado"}
                    target.status = "pendiente"
                    target.exercise = None
                    target.current_section = None
                else:
                    target.status = "pendiente"
                    target.sections = None
                    target.exercise = None
                    target.current_section = None

        snapshot = services.store.update(ebook_id, apply)
        services.store.set_internal(ebook_id, failedPhase=None, exerciseOnly=exercise_only)
        await services.runner.retry(ebook_id)
        return _snapshot(snapshot)

