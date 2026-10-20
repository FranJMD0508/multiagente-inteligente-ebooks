"""Utilidades compartidas por los agentes."""

from __future__ import annotations

import re
from collections.abc import Callable, Iterable
from typing import Annotated, Any, TypeVar

from pydantic import BaseModel, BeforeValidator

from ..llm import LLMProvider
from ..prompts import prompts

T = TypeVar("T", bound=BaseModel)


def _as_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return str(value).strip()


# Cadena tolerante: acepta números o null del LLM y los convierte en texto.
Text = Annotated[str, BeforeValidator(_as_text)]


def lower_first(text: str) -> str:
    return text[:1].lower() + text[1:] if text else text


def clean_title(text: str) -> str:
    """Quita numeraciones y prefijos como "Capítulo 3:" que a veces añade el modelo."""
    t = text.strip().strip('"“”«»').strip()
    t = re.sub(r"^(cap[ií]tulo\s+\d+\s*[:.\-–—]\s*)", "", t, flags=re.I)
    t = re.sub(r"^\d+\s*[.)\-–—:]\s*", "", t)
    return t.strip().rstrip(".")


def bullet_list(items: Iterable[str]) -> str:
    return "\n".join(f"- {item}" for item in items)


def _get(obj: Any, key: str, default: Any = "") -> Any:
    return obj.get(key, default) if isinstance(obj, dict) else getattr(obj, key, default)


def outline_text(chapters: Iterable[Any], *, with_summary: bool = True) -> str:
    """Índice numerado para los prompts: "1. Título — resumen"."""
    lines = []
    for i, ch in enumerate(chapters, start=1):
        title = _get(ch, "title")
        summary = _get(ch, "summary") if with_summary else ""
        lines.append(f"{i}. {title} — {summary}" if summary else f"{i}. {title}")
    return "\n".join(lines)


async def ask_json(
    llm: LLMProvider,
    prompt_name: str,
    task: str,
    schema: type[T],
    values: dict[str, Any],
    context: dict[str, Any],
    check: Callable[[T], None] | None = None,
) -> T:
    """Carga la plantilla, la rellena y pide al LLM un JSON validado con `schema`."""
    template = prompts.get(prompt_name)
    system, user = template.render(**values)
    return await llm.generate_json(
        task,
        system,
        user,
        schema,
        temperature=template.temperature,
        max_tokens=template.max_tokens,
        context=context,
        check=check,
    )
