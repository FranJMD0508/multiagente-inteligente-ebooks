"""Reglas del guardarraíl de entrada y avisos legales (port de `frontend/src/lib/guardrails.ts`).

Aquí solo hay reglas deterministas. La clasificación con el LLM vive en
`app/graph/guardrail.py` y usa estas reglas como pista y como respaldo.
"""

from __future__ import annotations

import re

FICTION_PATTERNS = [
    re.compile(r"\bnovelas?\b"),
    re.compile(r"\bcuentos?\b"),
    re.compile(r"\brelatos?\b"),
    re.compile(r"\bfan ?fic"),
    re.compile(r"\bpoemas?\b"),
    re.compile(r"\bpoes[ií]a\b"),
    re.compile(r"ciencia ficci[oó]n"),
    re.compile(r"\bfantas[ií]a\b"),
    re.compile(r"\bdragon(es)?\b"),
    re.compile(r"\bguion\b"),
    re.compile(r"\bsaga\b"),
    re.compile(r"\bpersonajes?\b"),
    re.compile(r"historia de (amor|terror|misterio|aventuras)"),
    re.compile(r"\bf[aá]bulas?\b"),
]

# Peticiones claramente dañinas o ilegales (pista para el LLM y respaldo sin conexión).
HARMFUL_PATTERNS = [
    re.compile(r"\b(fabricar|hacer|construir)\s+(una\s+)?(bomba|explosivo|arma)s?\b"),
    re.compile(r"\b(c[oó]mo|quiero|ens[eé][ñn]ame a|aprender a)\s+(hackear|estafar|robar|extorsionar|chantajear)\b"),
    re.compile(r"\b(vender|cultivar|conseguir)\s+drogas\b"),
    re.compile(r"\blavar\s+dinero\b"),
    re.compile(r"\bmanipular\s+a\s+(mi|tu|su|una|un)\b"),
]

FICTION_REASON = (
    "Folio crea guías prácticas sobre situaciones reales, así que no puede escribir ficción. "
    "¿Probamos con alguna de estas ideas?"
)
FICTION_ALTERNATIVES = [
    "Cómo escribir tu primera historia: hábitos de quien escribe",
    "Leer más y mejor en 30 días",
    "Organiza tu tiempo para escribir cada semana",
]

HARMFUL_REASON = (
    "Folio no puede ayudarte con ese tema porque podría hacer daño a alguien. "
    "Si quieres, prueba con una guía práctica sobre una situación de tu día a día."
)
HARMFUL_ALTERNATIVES = [
    "Cómo detectar estafas y proteger tu dinero",
    "Resolver conflictos sin hacer daño a nadie",
    "Pedir ayuda cuando atraviesas un momento difícil",
]

DISCLAIMERS: dict[str, dict[str, str]] = {
    "financiero": {
        "reason": "el tema es financiero",
        "text": "Este libro tiene fines educativos e informativos. No sustituye la asesoría de un profesional en finanzas. Antes de tomar decisiones importantes sobre tu dinero, consulta a una persona experta.",
    },
    "salud_emocional": {
        "reason": "el tema toca la salud emocional",
        "text": "Este libro tiene fines educativos e informativos. No sustituye la atención de un profesional de la psicología o de la salud. Si sientes que no puedes con lo que te pasa, busca ayuda profesional.",
    },
    "salud_fisica": {
        "reason": "el tema toca la salud física",
        "text": "Este libro tiene fines educativos e informativos. No sustituye la consulta con un profesional de la salud.",
    },
    "autoayuda_general": {
        "reason": "es un tema de autoayuda",
        "text": "Este libro tiene fines educativos e informativos. No sustituye la asesoría de un profesional (psicológica, médica, financiera o legal) cuando la necesites.",
    },
}

SENSITIVITY_LABELS = {
    "financiero": "financiero (dinero, deudas, ahorro)",
    "salud_emocional": "de salud emocional",
    "salud_fisica": "de salud física",
    "autoayuda_general": "de autoayuda",
    "ninguno": "no sensible",
}


def is_fiction(prompt: str) -> bool:
    text = prompt.lower()
    return any(p.search(text) for p in FICTION_PATTERNS)


def is_harmful(prompt: str) -> bool:
    text = prompt.lower()
    return any(p.search(text) for p in HARMFUL_PATTERNS)


def disclaimer_for(sensitivity: str) -> str | None:
    """Texto del aviso legal obligatorio (RÉR-02) o None si el tema no es sensible."""
    entry = DISCLAIMERS.get(sensitivity)
    return entry["text"] if entry else None
