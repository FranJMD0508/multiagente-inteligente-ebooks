"""Streams SSE: todos los ebooks del usuario (`/events`) o uno solo (`/ebooks/{id}/events`)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from ..events import sse_stream
from .deps import ServicesDep, current_user_sse, owned_ebook

router = APIRouter(tags=["eventos"])

SSE_HEADERS = {"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no", "Connection": "keep-alive"}

SseUser = Annotated[dict, Depends(current_user_sse)]


@router.get("/events")
async def user_events(request: Request, user: SseUser, services: ServicesDep) -> StreamingResponse:
    """Al conectar llega una instantánea (`ebook.updated`) de cada ebook; después, los eventos en orden."""

    def snapshot() -> list[dict]:
        return [{"type": "ebook.updated", "ebookId": e.id, "ebook": e.dump()} for e in services.store.list_for(user["id"])]

    return StreamingResponse(
        sse_stream(services.bus, user["id"], None, snapshot, is_disconnected=request.is_disconnected),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )


@router.get("/ebooks/{ebook_id}/events")
async def ebook_events(ebook_id: str, request: Request, user: SseUser, services: ServicesDep) -> StreamingResponse:
    owned_ebook(services, ebook_id, user)

    def snapshot() -> list[dict]:
        ebook = services.store.get(ebook_id)
        return [{"type": "ebook.updated", "ebookId": ebook.id, "ebook": ebook.dump()}] if ebook is not None else []

    return StreamingResponse(
        sse_stream(services.bus, user["id"], ebook_id, snapshot, is_disconnected=request.is_disconnected),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )
