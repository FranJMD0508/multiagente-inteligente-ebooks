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
from collections.abc import AsyncIterator, Awaitable, Callable, Mapping
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

log = logging.getLogger("folio.llm")

T = TypeVar("T", bound=BaseModel)

MAX_ATTEMPTS = 3  # intentos ante 429, 5xx o tiempo agotado
TRANSIENT_STATUS = {408, 409, 429, 500, 502, 503, 504, 529}
# Si el proveedor pide esperar más que esto (Retry-After o retryDelay), no se espera: se falla ya
# y la persona puede reintentar más tarde, en vez de quedarse mirando una pantalla que no avanza.
# Un límite por minuto (el plan gratuito de Gemini pide unos 30-60 s) sí se espera; uno diario, no.
MAX_RETRY_WAIT_S = 65.0
# Tiempo máximo de una llamada JSON completa (todos sus intentos y esperas).
JSON_TIMEOUT_S = 150.0

JSON_INSTRUCTION = (
    "\n\nFormato de salida: responde únicamente con un objeto JSON válido, sin texto antes ni después "
    "y sin bloques de código."
)


class LLMError(Exception):
    """Fallo al hablar con el proveedor. `retryable` indica si tiene sentido reintentar y
    `retry_after`, cuántos segundos pidió esperar el proveedor (429 con Retry-After o retryDelay)."""

    def __init__(
        self, message: str, *, retryable: bool = False, status: int | None = None, retry_after: float | None = None
    ) -> None:
        super().__init__(message)
        self.retryable = retryable
        self.status = status
        self.retry_after = retry_after


class LLMBlockedError(LLMError):
    """El proveedor se negó a responder (filtros de seguridad)."""


def parse_retry_after(headers: Mapping[str, str] | None) -> float | None:
    """Segundos de `retry-after-ms` o `retry-after` (número o fecha HTTP), si vienen."""
    if not headers:
        return None
    try:
        ms = headers.get("retry-after-ms")
        if ms:
            return max(0.0, float(ms) / 1000)
        value = headers.get("retry-after")
        if not value:
            return None
        try:
            return max(0.0, float(value))
        except ValueError:
            when = parsedate_to_datetime(value)
            return max(0.0, (when - datetime.now(UTC)).total_seconds())
    except (TypeError, ValueError, OverflowError):
        return None


async def _sleep(seconds: float) -> None:
    """Espera entre reintentos (aparte para poder medirla en las pruebas)."""
    await asyncio.sleep(seconds)


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
    json_timeout_s: float = JSON_TIMEOUT_S

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
        """Pide JSON, lo valida con `schema` (y `check`) y reintenta una vez si no sirve.

        Todos los intentos juntos tienen un tiempo límite (`json_timeout_s`): sin él, entre
        reintentos y esperas, una llamada podría tardar varios minutos."""
        try:
            async with asyncio.timeout(self.json_timeout_s):
                return await self._generate_json(
                    task, system, prompt, schema, temperature=temperature, max_tokens=max_tokens, context=context, check=check
                )
        except TimeoutError as exc:
            raise LLMError(f"El modelo tardó demasiado en responder a {task}", retryable=True) from exc

    async def _generate_json(
        self,
        task: str,
        system: str,
        prompt: str,
        schema: type[T],
        *,
        temperature: float,
        max_tokens: int,
        context: dict | None,
        check: Callable[[T], None] | None,
    ) -> T:
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
                delay = None if started else self._retry_delay(exc, attempt)
                if delay is None:
                    raise
                log.warning("Error transitorio en %s (%s); reintento en %.1f s", task, exc, delay)
                await _sleep(delay)
                attempt += 1

    def _retry_delay(self, exc: LLMError, attempt: int) -> float | None:
        """Espera antes del siguiente intento, o None si no hay que reintentar.

        Espera exponencial; si el proveedor dijo cuánto esperar (429), se respeta, hasta
        `MAX_RETRY_WAIT_S`. Si pide más, no se reintenta."""
        if not exc.retryable or attempt >= MAX_ATTEMPTS - 1:
            return None
        delay = self.retry_base_delay * (2**attempt)
        if exc.retry_after is not None:
            if exc.retry_after > MAX_RETRY_WAIT_S:
                log.warning("El proveedor %s pide esperar %.0f s; no se reintenta.", self.name, exc.retry_after)
                return None
            delay = max(delay, exc.retry_after)
        return delay

    async def _with_retries(self, call: Callable[[], Awaitable[str]]) -> str:
        """Reintento con espera exponencial ante errores transitorios (máx. 3 intentos)."""
        for attempt in range(MAX_ATTEMPTS):
            try:
                return await call()
            except LLMError as exc:
                delay = self._retry_delay(exc, attempt)
                if delay is None:
                    raise
                log.warning("Error transitorio del proveedor %s (%s); reintento en %.1f s", self.name, exc, delay)
                await _sleep(delay)
        raise LLMError("No se pudo completar la petición")  # pragma: no cover
