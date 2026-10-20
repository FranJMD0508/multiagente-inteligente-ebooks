"""Agente de Ejercicios: cierra cada capítulo con un checklist o un reto de 24/48 h (RF-04)."""

from __future__ import annotations

import re

from pydantic import BaseModel, Field

from ..guardrails import SENSITIVITY_LABELS
from ..llm import LLMProvider
from ..models import ChallengeExercise, Chapter, ChecklistExercise, Ebook
from .common import Text, ask_json, bullet_list, lower_first

CHECKLIST_PREFIX = "Checklist de autoevaluación"
CHECKLIST_ITEMS = (5, 7)
CHALLENGE_STEPS = (3, 5)


def decide_type(pref: str, number: int, flip: bool = False) -> str:
    """Como el mock: en automático, retos en capítulos impares y checklists en pares."""
    kind = ("reto" if number % 2 == 1 else "checklist") if pref == "auto" else pref
    if flip:
        kind = "checklist" if kind == "reto" else "reto"
    return kind


def suggest_duration(number: int) -> str:
    return "24h" if number % 3 == 0 else "48h"


class ExerciseOut(BaseModel):
    tipo: Text = ""
    titulo: Text = ""
    items: list[Text] = Field(default_factory=list)
    duracion: Text = ""
    pasos: list[Text] = Field(default_factory=list)


def _clean_item(text: str) -> str:
    t = text.strip()
    t = re.sub(r"^(\[[ xX]?\]|[-•*]|\d+[.)])\s*", "", t)
    t = re.sub(r"^(\[[ xX]?\])\s*", "", t)
    return t.strip()


def _normalize_duration(value: str, fallback: str) -> str:
    digits = re.sub(r"\D", "", value)
    if digits in ("24", "48"):
        return f"{digits}h"
    return fallback


def _title_rest(title: str, pattern: str) -> str:
    rest = re.sub(pattern, "", title.strip(), flags=re.I).strip()
    return rest.lstrip(":-–— ").strip().rstrip(".")


def to_exercise(result: ExerciseOut, kind: str, duration: str) -> ChecklistExercise | ChallengeExercise:
    """Valida RF-04 (tipo, duración y número de elementos) y normaliza el título. Lanza ValueError."""
    tipo = result.tipo.strip().lower()
    if tipo and tipo != kind:
        raise ValueError(f"se pidió un ejercicio de tipo '{kind}' y llegó '{tipo}'")
    if kind == "checklist":
        items = [_clean_item(i) for i in result.items if _clean_item(i)]
        lo, hi = CHECKLIST_ITEMS
        if len(items) < lo:
            raise ValueError(f"el checklist necesita entre {lo} y {hi} afirmaciones y tiene {len(items)}")
        rest = _title_rest(result.titulo, r"^checklist(\s+de\s+autoevaluaci[oó]n)?")
        title = f"{CHECKLIST_PREFIX}: {lower_first(rest) if rest else 'marca lo que ya haces'}"
        return ChecklistExercise(title=title, items=items[:hi])
    steps = [_clean_item(s) for s in result.pasos if _clean_item(s)]
    lo, hi = CHALLENGE_STEPS
    if len(steps) < lo:
        raise ValueError(f"el reto necesita entre {lo} y {hi} pasos y tiene {len(steps)}")
    final_duration = _normalize_duration(result.duracion, duration)
    hours = "48" if final_duration == "48h" else "24"
    rest = _title_rest(result.titulo, r"^reto(\s+de\s+\d+\s*(horas|h))?")
    title = f"Reto de {hours} horas: {lower_first(rest) if rest else 'pon en práctica lo aprendido'}"
    return ChallengeExercise(title=title, duration=final_duration, steps=steps[:hi])  # type: ignore[arg-type]


def validate_exercise(exercise: ChecklistExercise | ChallengeExercise) -> list[str]:
    """Problemas de RF-04 en un ejercicio ya creado (vacío si es válido)."""
    problems = []
    if isinstance(exercise, ChecklistExercise):
        lo, hi = CHECKLIST_ITEMS
        if not lo <= len(exercise.items) <= hi:
            problems.append("número de afirmaciones fuera de rango")
        if not exercise.title.startswith(CHECKLIST_PREFIX):
            problems.append("título del checklist")
    else:
        lo, hi = CHALLENGE_STEPS
        if exercise.duration not in ("24h", "48h"):
            problems.append("duración del reto")
        if not lo <= len(exercise.steps) <= hi:
            problems.append("número de pasos fuera de rango")
        hours = exercise.duration[:2]
        if not exercise.title.startswith(f"Reto de {hours} horas"):
            problems.append("título del reto")
    return problems


async def create_exercise(
    llm: LLMProvider,
    ebook: Ebook,
    chapter: Chapter,
    kind: str,
    duration: str,
) -> ChecklistExercise | ChallengeExercise:
    sections = chapter.sections
    essence = ""
    if sections is not None:
        essence = (sections.desarrollo[:1800] + "\n…\n" + sections.conclusion[:900]).strip()
    sensitive = (
        f"sí, {SENSITIVITY_LABELS.get(ebook.sensitivity, ebook.sensitivity)}" if ebook.sensitivity != "ninguno" else "no"
    )
    values = {
        "titulo_libro": ebook.title,
        "publico": ebook.audience,
        "numero": chapter.number,
        "titulo_capitulo": chapter.title,
        "puntos_clave": bullet_list(chapter.key_points),
        "resumen_capitulo": essence or chapter.summary,
        "aviso_sensible": sensitive,
        "tipo": kind,
        "duracion": duration,
    }
    context = {
        "type": kind,
        "duration": duration,
        "number": chapter.number,
        "item": {"title": chapter.title, "summary": chapter.summary, "keyPoints": chapter.key_points},
    }
    holder: dict = {}

    def check(result: ExerciseOut) -> None:
        holder["exercise"] = to_exercise(result, kind, duration)

    await ask_json(llm, "ejercicios/ejercicio", "ejercicios.ejercicio", ExerciseOut, values, context, check)
    return holder["exercise"]
