"""Claude (Anthropic) con el SDK oficial. El SDK se importa solo si se elige este proveedor.

Notas sobre los modelos actuales (Claude Sonnet 5 y posteriores):
- No admiten parámetros de muestreo (`temperature`, `top_p`): devuelven 400, y el
  SDK 1.x ni siquiera los acepta. El tono lo fijan los prompts (RNF-01).
- El razonamiento es adaptativo por defecto. Se controla con
  `output_config.effort` (`ANTHROPIC_EFFORT`, "low" por defecto para no alargar
  la espera, RNF-02). Si un modelo no lo admite, se quita y se recuerda.
- Las respuestas pueden terminar con `stop_reason: "refusal"`: se trata como
  bloqueo del proveedor.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator

from .base import TRANSIENT_STATUS, LLMBlockedError, LLMError, LLMProvider, parse_retry_after

log = logging.getLogger("folio.llm.anthropic")

# El razonamiento consume parte de max_tokens: se deja margen para que la respuesta no se corte.
MIN_MAX_TOKENS = 4096
# Motivos de parada que significan que el texto quedó cortado.
TRUNCATED = {"max_tokens", "model_context_window_exceeded"}


class AnthropicProvider(LLMProvider):
    name = "anthropic"

    def __init__(self, api_key: str, model: str, *, effort: str = "low", timeout_s: float = 60.0, http_client=None) -> None:
        super().__init__(model, timeout_s=timeout_s)
        import anthropic  # importación perezosa

        self._sdk = anthropic
        # Los reintentos los gestiona la capa común (base.py). `http_client` debe ser de httpx2 (SDK 1.x).
        self._client = anthropic.AsyncAnthropic(api_key=api_key, timeout=timeout_s, max_retries=0, http_client=http_client)
        self.effort = effort.strip()
        self._send_effort = bool(self.effort)

    async def aclose(self) -> None:
        await self._client.close()

    def _params(self, system: str, prompt: str, *, max_tokens: int) -> dict:
        params: dict = {
            "model": self.model,
            "system": system,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max(max_tokens, MIN_MAX_TOKENS),
        }
        if self._send_effort:
            params["output_config"] = {"effort": self.effort}
        return params

    def _translate(self, exc: Exception) -> LLMError:
        sdk = self._sdk
        if isinstance(exc, sdk.APITimeoutError):
            return LLMError("Claude tardó demasiado en responder", retryable=True)
        if isinstance(exc, sdk.APIConnectionError):
            return LLMError(f"No se pudo conectar con Claude: {exc}", retryable=True)
        if isinstance(exc, sdk.APIStatusError):
            status = exc.status_code
            retryable = status in TRANSIENT_STATUS
            retry_after = parse_retry_after(getattr(exc.response, "headers", None)) if retryable else None
            return LLMError(f"Claude respondió {status}: {exc.message}", retryable=retryable, status=status, retry_after=retry_after)
        return LLMError(f"Error inesperado con Claude: {exc}")

    def _effort_rejected(self, exc: Exception) -> bool:
        """Si el modelo no admite `output_config.effort`, se deja de enviar."""
        if self._send_effort and isinstance(exc, self._sdk.BadRequestError) and "effort" in str(exc).lower():
            log.warning("El modelo %s no admite 'effort'; se envía sin él.", self.model)
            self._send_effort = False
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
            try:
                message = await self._client.messages.create(**self._params(system, prompt, max_tokens=max_tokens))
            except Exception as exc:  # noqa: BLE001 - se traduce a LLMError
                if self._effort_rejected(exc):
                    continue
                raise self._translate(exc) from exc
            if getattr(message, "stop_reason", None) == "refusal":
                raise LLMBlockedError("Claude se negó a responder esta petición")
            return "".join(block.text for block in message.content if getattr(block, "type", "") == "text")
        raise LLMError("Claude rechazó la petición")

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
            started = False
            try:
                async with self._client.messages.stream(**self._params(system, prompt, max_tokens=max_tokens)) as stream:
                    async for text in stream.text_stream:
                        started = True
                        yield text
                    final = await stream.get_final_message()
                stop = getattr(final, "stop_reason", None)
                if stop == "refusal":
                    raise LLMBlockedError("Claude se negó a terminar esta respuesta")
                if stop in TRUNCATED:
                    # El texto se cortó por el límite de tokens: no es un capítulo completo.
                    raise LLMError("La respuesta de Claude se cortó por el límite de tokens", retryable=True)
                return
            except LLMError:
                raise
            except Exception as exc:  # noqa: BLE001
                if not started and self._effort_rejected(exc):
                    continue
                raise self._translate(exc) from exc
