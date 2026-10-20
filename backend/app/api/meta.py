"""Salud del servidor, catálogo de nichos y guardarraíl de temas."""

from __future__ import annotations

from fastapi import APIRouter

from ..graph.guardrail import check_topic
from ..models import CamelModel
from ..niches import NICHES
from .deps import ServicesDep, UserDep, fail

router = APIRouter(tags=["general"])


class TopicBody(CamelModel):
    prompt: str = ""


@router.get("/health")
async def health(services: ServicesDep) -> dict:
    return {"ok": True, "provider": services.llm.name, "model": services.llm.model}


@router.get("/niches")
async def niches() -> list[dict]:
    return [n.to_json() for n in NICHES]


@router.post("/topics/check")
async def topics_check(body: TopicBody, user: UserDep, services: ServicesDep) -> dict:
    """Guardarraíl de entrada (RF-01): `{ok: true, nicheId?}` o `{ok: false, reason, alternatives}`."""
    prompt = body.prompt.strip()
    if len(prompt) < 3:
        fail(422, "validacion", "Escribe tu idea para poder revisarla.")
    verdict = await check_topic(services.llm, services.guardrail_cache, prompt[:2000])
    return verdict.to_topic_check()
