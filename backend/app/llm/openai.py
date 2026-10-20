"""OpenAI con el SDK oficial (Chat Completions). El SDK se importa solo si se elige."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator

from .base import TRANSIENT_STATUS, LLMBlockedError, LLMError, LLMProvider, parse_retry_after

log = logging.getLogger("folio.llm.openai")


class OpenAIProvider(LLMProvider):
    name = "openai"

    def __init__(self, api_key: str, model: str, *, base_url: str = "", timeout_s: float = 60.0, http_client=None) -> None:
        super().__init__(model, timeout_s=timeout_s)
        import openai  # importación perezosa

        self._sdk = openai
        self._client = openai.AsyncOpenAI(
            api_key=api_key,
            base_url=base_url or None,
            timeout=timeout_s,
            max_retries=0,
            http_client=http_client,
        )
        # Algunos modelos (los de razonamiento) solo aceptan la temperatura por defecto.
        self._send_temperature = True

    async def aclose(self) -> None:
        await self._client.close()

    def _params(self, system: str, prompt: str, *, temperature: float, max_tokens: int) -> dict:
        params: dict = {
            "model": self.model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}],
            "max_completion_tokens": max_tokens,
        }
        if self._send_temperature:
            params["temperature"] = temperature
        return params

    def _translate(self, exc: Exception) -> LLMError:
        sdk = self._sdk
        if isinstance(exc, sdk.APITimeoutError):
            return LLMError("OpenAI tardó demasiado en responder", retryable=True)
        if isinstance(exc, sdk.APIConnectionError):
            return LLMError(f"No se pudo conectar con OpenAI: {exc}", retryable=True)
        if isinstance(exc, sdk.APIStatusError):
            status = exc.status_code
            retryable = status in TRANSIENT_STATUS
            retry_after = parse_retry_after(getattr(exc.response, "headers", None)) if retryable else None
            return LLMError(f"OpenAI respondió {status}: {exc.message}", retryable=retryable, status=status, retry_after=retry_after)
        return LLMError(f"Error inesperado con OpenAI: {exc}")

    def _temperature_rejected(self, exc: Exception) -> bool:
        if isinstance(exc, self._sdk.BadRequestError) and "temperature" in str(exc).lower() and self._send_temperature:
            log.warning("El modelo %s no acepta 'temperature'; se envía sin ella.", self.model)
            self._send_temperature = False
            return True
        return False

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
    ) -> str:
        for _ in range(2):
            params = self._params(system, prompt, temperature=temperature, max_tokens=max_tokens)
            if json_mode:
                params["response_format"] = {"type": "json_object"}
            try:
                response = await self._client.chat.completions.create(**params)
            except Exception as exc:  # noqa: BLE001
                if self._temperature_rejected(exc):
                    continue
                raise self._translate(exc) from exc
            if not response.choices:
                raise LLMError("OpenAI no devolvió ninguna respuesta", retryable=True)
            return response.choices[0].message.content or ""
        raise LLMError("OpenAI rechazó la petición")

    async def _stream(
        self,
        task: str,
        system: str,
        prompt: str,
        *,
        temperature: float,
        max_tokens: int,
        context: dict,
    ) -> AsyncIterator[str]:
        for _ in range(2):
            try:
                stream = await self._client.chat.completions.create(
                    **self._params(system, prompt, temperature=temperature, max_tokens=max_tokens), stream=True
                )
                finish = None
                async for chunk in stream:
                    if not chunk.choices:
                        continue
                    choice = chunk.choices[0]
                    if choice.delta and choice.delta.content:
                        yield choice.delta.content
                    finish = choice.finish_reason or finish
                if finish == "length":
                    # El texto se cortó por el límite de tokens: no es un capítulo completo.
                    raise LLMError("La respuesta de OpenAI se cortó por el límite de tokens", retryable=True)
                if finish == "content_filter":
                    raise LLMBlockedError("OpenAI detuvo la respuesta por sus filtros de contenido")
                return
            except LLMError:
                raise
            except Exception as exc:  # noqa: BLE001
                if self._temperature_rejected(exc):
                    continue
                raise self._translate(exc) from exc
