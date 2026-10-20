"""Guardarraíl de entrada (RF-01): reglas deterministas + clasificación del LLM, con caché de 15 min."""

from __future__ import annotations

import hashlib
import logging
import re
import time
from dataclasses import asdict, dataclass, field

from pydantic import BaseModel, Field

from ..agents.common import Text, ask_json
from ..guardrails import (
    FICTION_ALTERNATIVES,
    FICTION_REASON,
    HARMFUL_ALTERNATIVES,
    HARMFUL_REASON,
    is_fiction,
    is_harmful,
)
from ..llm import LLMBlockedError, LLMError, LLMProvider
from ..models import SENSITIVITIES
from ..niches import NICHE_IDS, NICHES, detect_niche, get_niche

log = logging.getLogger("folio.guardrail")

CACHE_TTL_S = 15 * 60


class GuardrailOut(BaseModel):
    valido: bool
    motivo: Text = ""
    nichoId: Text = "general"
    sensibilidad: Text = ""
    publico: Text = ""
    alternativas: list[Text] = Field(default_factory=list)


@dataclass
class Verdict:
    valid: bool
    reason: str = ""
    niche_id: str = "general"
    sensitivity: str = "autoayuda_general"
    audience: str = ""
    alternatives: list[str] = field(default_factory=list)
    source: str = "llm"  # "llm" | "reglas"

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> Verdict:
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})

    def to_topic_check(self) -> dict:
        """Respuesta de POST /api/topics/check (tipo `TopicCheck` del frontend)."""
        if self.valid:
            return {"ok": True, "nicheId": self.niche_id} if self.niche_id != "general" else {"ok": True}
        return {"ok": False, "reason": self.reason, "alternatives": self.alternatives}


def _key(prompt: str) -> str:
    normalized = re.sub(r"\s+", " ", prompt.strip().lower())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


class GuardrailCache:
    def __init__(self, ttl_s: float = CACHE_TTL_S) -> None:
        self.ttl_s = ttl_s
        self._items: dict[str, tuple[float, Verdict]] = {}

    def get(self, prompt: str) -> Verdict | None:
        item = self._items.get(_key(prompt))
        if item is None:
            return None
        expires, verdict = item
        if time.monotonic() > expires:
            self._items.pop(_key(prompt), None)
            return None
        return verdict

    def put(self, prompt: str, verdict: Verdict) -> None:
        now = time.monotonic()
        # Limpieza perezosa de lo caducado.
        for key, (expires, _) in list(self._items.items()):
            if expires < now:
                self._items.pop(key, None)
        self._items[_key(prompt)] = (now + self.ttl_s, verdict)


def rules_verdict(prompt: str) -> Verdict:
    """Respaldo sin LLM: las mismas reglas que el frontend."""
    if is_fiction(prompt):
        return Verdict(False, FICTION_REASON, "general", "ninguno", "", list(FICTION_ALTERNATIVES), "reglas")
    if is_harmful(prompt):
        return Verdict(False, HARMFUL_REASON, "general", "ninguno", "", list(HARMFUL_ALTERNATIVES), "reglas")
    niche = detect_niche(prompt)
    return Verdict(True, f"Guía práctica sobre {niche.label.lower()}", niche.id, niche.sensitivity, niche.audience, [], "reglas")


def _normalize(out: GuardrailOut, prompt: str) -> Verdict:
    niche_id = out.nichoId.strip() if out.nichoId.strip() in NICHE_IDS else "general"
    niche = get_niche(niche_id)
    sensitivity = out.sensibilidad if out.sensibilidad in SENSITIVITIES else niche.sensitivity
    audience = out.publico.strip().rstrip(".")
    if out.valido:
        return Verdict(True, out.motivo, niche_id, sensitivity, audience, [], "llm")
    fallback_alts = HARMFUL_ALTERNATIVES if is_harmful(prompt) else FICTION_ALTERNATIVES
    alternatives = [a.strip() for a in out.alternativas if a.strip()][:3]
    for alt in fallback_alts:
        if len(alternatives) >= 3:
            break
        if alt not in alternatives:
            alternatives.append(alt)
    reason = out.motivo.strip() or (HARMFUL_REASON if is_harmful(prompt) else FICTION_REASON)
    return Verdict(False, reason, niche_id, sensitivity, "", alternatives, "llm")


async def check_topic(llm: LLMProvider, cache: GuardrailCache, prompt: str) -> Verdict:
    cached = cache.get(prompt)
    if cached is not None:
        return cached
    hints = []
    if is_fiction(prompt):
        hints.append("Aviso del filtro automático: la idea contiene palabras habituales en la ficción. Revisa con cuidado si pide una historia inventada.")
    if is_harmful(prompt):
        hints.append("Aviso del filtro automático: la idea podría pedir algo dañino o ilegal. Revísala con cuidado.")
    values = {
        "catalogo": "\n".join(f"- {n.id}: {n.label}" for n in NICHES) + "\n- general: Crecimiento personal (si ninguno encaja)",
        "idea": prompt.strip(),
        "pista": ("\n" + "\n".join(hints)) if hints else "",
    }
    try:
        out = await ask_json(llm, "orquestador/guardarrail", "orquestador.guardarrail", GuardrailOut, values, {"idea": prompt})
        verdict = _normalize(out, prompt)
    except LLMBlockedError:
        # Si el propio proveedor se niega a clasificar la idea, no se escribe el libro.
        verdict = Verdict(False, HARMFUL_REASON, "general", "ninguno", "", list(HARMFUL_ALTERNATIVES), "llm")
    except LLMError as exc:
        log.warning("El guardarraíl del LLM falló (%s); se usan las reglas.", exc)
        verdict = rules_verdict(prompt)
    cache.put(prompt, verdict)
    return verdict
