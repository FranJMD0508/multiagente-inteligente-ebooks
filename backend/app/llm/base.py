"""Interfaz común de los proveedores de LLM, errores y reintentos.

Los agentes solo conocen `LLMProvider.generate_json` y `LLMProvider.stream_text`;
cada proveedor implementa `_complete` (respuesta completa) y `_stream` (trozos).
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

log = logging.getLogger("folio.llm")

T = TypeVar("T", bound=BaseModel)

MAX_ATTEMPTS = 3  # intentos ante 429, 5xx o tiempo agotado
TRANSIENT_STATUS = {408, 409, 429, 500, 502, 503, 504, 529}

JSON_INSTRUCTION = (
    "\n\nFormato de salida: responde únicamente con un objeto JSON válido, sin texto antes ni después "
    "y sin bloques de código."
)


class LLMError(Exception):
    """Fallo al hablar con el proveedor. `retryable` indica si tiene sentido reintentar."""

    def __init__(self, message: str, *, retryable: bool = False, status: int | None = None) -> None:
        super().__init__(message)
        self.retryable = retryable
        self.status = status


class LLMBlockedError(LLMError):
    """El proveedor se negó a responder (filtros de seguridad)."""


def extract_json(text: str) -> Any:
    """Extrae el primer objeto JSON de la respuesta, tolerando ```json y texto alrededor."""
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json|JSON)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```\s*$", "", cleaned)
    start = cleaned.find("{")
    if start == -1:
        raise ValueError("la respuesta no contiene un objeto JSON")
    depth = 0
    in_string = False
    escaped = False
    for i in range(start, len(cleaned)):
        ch = cleaned[i]
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return json.loads(cleaned[start : i + 1])
    raise ValueError("el objeto JSON está incompleto (¿se cortó la respuesta?)")


def _short_error(exc: Exception) -> str:
    if isinstance(exc, ValidationError):
        parts = []
        for err in exc.errors()[:6]:
            loc = ".".join(str(x) for x in err.get("loc", ()))
            parts.append(f"{loc}: {err.get('msg')}" if loc else str(err.get("msg")))
        return "; ".join(parts)
    return str(exc)[:400]


class LLMProvider(ABC):
    """Proveedor de LLM intercambiable (docs/03 §1, D-06)."""

    name: str = "base"
    retry_base_delay: float = 1.0

    def __init__(self, model: str, *, timeout_s: float = 60.0) -> None:
        self.model = model
        self.timeout_s = timeout_s

    # ----- lo que implementa cada proveedor -----

    @abstractmethod
    async def _complete(
        self,
        task: str,
        system: str,
        prompt: str,
        *,
        temperature: float,
        max_tokens: int,
        json_mode: bool,
        context: dict,
    ) -> str: ...

    @abstractmethod
    def _stream(
        self,
        task: str,
        system: str,
        prompt: str,
        *,
        temperature: float,
        max_tokens: int,
        context: dict,
    ) -> AsyncIterator[str]: ...

    async def aclose(self) -> None:  # pragma: no cover - los proveedores con cliente lo sobrescriben
        return None

    # ----- interfaz pública -----

    async def generate_json(
        self,
        task: str,
        system: str,
        prompt: str,
        schema: type[T],
        *,
        temperature: float,
        max_tokens: int,
        context: dict | None = None,
        check: Callable[[T], None] | None = None,
    ) -> T:
        """Pide JSON, lo valida con `schema` (y `check`) y reintenta una vez si no sirve."""
        context = context or {}
        system_json = system + JSON_INSTRUCTION
        current_prompt = prompt
        last_error: Exception | None = None
        for attempt in range(2):
            text = await self._with_retries(
                lambda p=current_prompt, a=attempt: self._complete(
                    task,
                    system_json,
                    p,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    json_mode=True,
                    context={**context, "_attempt": a},
                )
            )
            try:
                result = schema.model_validate(extract_json(text))
                if check is not None:
                    check(result)
                return result
            except (ValueError, ValidationError) as exc:
                last_error = exc
                log.warning("Respuesta no válida en %s (intento %d): %s", task, attempt + 1, _short_error(exc))
                current_prompt = (
                    f"{prompt}\n\nTu respuesta anterior no se pudo usar por este motivo: {_short_error(exc)}. "
                    "Corrígelo y devuelve solo el objeto JSON completo."
                )
        raise LLMError(f"El modelo no devolvió un JSON válido para {task}: {_short_error(last_error)}", retryable=True)

    async def stream_text(
        self,
        task: str,
        system: str,
        prompt: str,
        *,
        temperature: float,
        max_tokens: int,
        context: dict | None = None,
    ) -> AsyncIterator[str]:
        """Texto en trozos. Solo reintenta si el fallo ocurre antes del primer trozo."""
        context = context or {}
        attempt = 0
        while True:
            started = False
            try:
                async for chunk in self._stream(
                    task, system, prompt, temperature=temperature, max_tokens=max_tokens, context=context
                ):
                    if chunk:
                        started = True
                        yield chunk
                return
            except LLMError as exc:
                if started or not exc.retryable or attempt >= MAX_ATTEMPTS - 1:
                    raise
                delay = self.retry_base_delay * (2**attempt)
                log.warning("Error transitorio en %s (%s); reintento en %.1f s", task, exc, delay)
                await asyncio.sleep(delay)
                attempt += 1

    async def _with_retries(self, call: Callable[[], Awaitable[str]]) -> str:
        """Reintento con espera exponencial ante errores transitorios (máx. 3 intentos)."""
        for attempt in range(MAX_ATTEMPTS):
            try:
                return await call()
            except LLMError as exc:
                if not exc.retryable or attempt == MAX_ATTEMPTS - 1:
                    raise
                delay = self.retry_base_delay * (2**attempt)
                log.warning("Error transitorio del proveedor %s (%s); reintento en %.1f s", self.name, exc, delay)
                await asyncio.sleep(delay)
        raise LLMError("No se pudo completar la petición")  # pragma: no cover
