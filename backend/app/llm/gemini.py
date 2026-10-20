"""Google Gemini por la API REST (proveedor por defecto).

Se usa httpx directamente en lugar del SDK para no depender de sus cambios.
Documentación de la API: https://ai.google.dev/api/generate-content
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator

import httpx

from .base import TRANSIENT_STATUS, LLMBlockedError, LLMError, LLMProvider

log = logging.getLogger("folio.llm.gemini")

BLOCK_REASONS = {"SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "IMAGE_SAFETY"}


class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(
        self,
        api_key: str,
        model: str,
        *,
        thinking_level: str = "low",
        base_url: str = "https://generativelanguage.googleapis.com/v1beta",
        timeout_s: float = 60.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        super().__init__(model, timeout_s=timeout_s)
        self.api_key = api_key
        self.thinking_level = thinking_level.strip()
        self.base_url = base_url.rstrip("/")
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(timeout_s, connect=10.0),
            transport=transport,
        )
        # Modelos que rechazaron `thinkingConfig`: ya no se les envía.
        self._no_thinking: set[str] = set()

    async def aclose(self) -> None:
        await self._client.aclose()

    # ----- petición -----

    def _headers(self) -> dict[str, str]:
        return {"x-goog-api-key": self.api_key, "Content-Type": "application/json"}

    def _body(self, system: str, prompt: str, *, temperature: float, max_tokens: int, json_mode: bool) -> dict:
        generation: dict = {"temperature": temperature, "maxOutputTokens": max_tokens}
        if json_mode:
            generation["responseMimeType"] = "application/json"
        if self.thinking_level and self.model not in self._no_thinking:
            generation["thinkingConfig"] = {"thinkingLevel": self.thinking_level}
        return {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": generation,
        }

    def _drop_thinking_if_rejected(self, status: int, content: bytes, body: dict) -> bool:
        """Si el modelo no admite `thinkingConfig`, lo quita y lo recuerda. True si hay que reintentar."""
        if status != 400 or "thinkingConfig" not in body["generationConfig"]:
            return False
        if "thinking" not in content.decode("utf-8", "replace").lower():
            return False
        log.warning("El modelo %s no admite thinkingConfig; se reintenta sin él.", self.model)
        self._no_thinking.add(self.model)
        body["generationConfig"].pop("thinkingConfig", None)
        return True

    @staticmethod
    def _error_message(content: bytes) -> str:
        try:
            data = json.loads(content)
            return str(data.get("error", {}).get("message") or data)[:300]
        except (ValueError, AttributeError):
            return content.decode("utf-8", "replace")[:300]

    def _raise_for_status(self, status: int, content: bytes) -> None:
        if status == 200:
            return
        message = f"Gemini respondió {status}: {self._error_message(content)}"
        raise LLMError(message, retryable=status in TRANSIENT_STATUS, status=status)

    @staticmethod
    def _text_from(data: dict, *, final: bool) -> str:
        """Texto de `candidates[0].content.parts[*].text`, sin las partes de razonamiento."""
        feedback = data.get("promptFeedback") or {}
        if feedback.get("blockReason"):
            raise LLMBlockedError(f"Gemini bloqueó la petición ({feedback['blockReason']})")
        candidates = data.get("candidates") or []
        if not candidates:
            if final:
                raise LLMError("Gemini no devolvió ninguna respuesta", retryable=True)
            return ""
        candidate = candidates[0]
        parts = (candidate.get("content") or {}).get("parts") or []
        text = "".join(p.get("text", "") for p in parts if not p.get("thought"))
        reason = candidate.get("finishReason")
        if reason in BLOCK_REASONS:
            raise LLMBlockedError(f"Gemini detuvo la respuesta por seguridad ({reason})")
        if reason == "RECITATION":
            # Evita reproducir textos protegidos (RÉR-01): se pide otra versión.
            raise LLMError("Gemini detuvo la respuesta por parecerse a un texto existente", retryable=True)
        if final and not text and reason == "MAX_TOKENS":
            raise LLMError("La respuesta se cortó por el límite de tokens", retryable=False)
        return text

    async def _post(self, url: str, body: dict) -> httpx.Response:
        try:
            return await self._client.post(url, json=body, headers=self._headers())
        except httpx.TimeoutException as exc:
            raise LLMError("Gemini tardó demasiado en responder", retryable=True) from exc
        except httpx.TransportError as exc:
            raise LLMError(f"No se pudo conectar con Gemini: {exc}", retryable=True) from exc

    # ----- interfaz del proveedor -----

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
        url = f"{self.base_url}/models/{self.model}:generateContent"
        body = self._body(system, prompt, temperature=temperature, max_tokens=max_tokens, json_mode=json_mode)
        response = await self._post(url, body)
        if self._drop_thinking_if_rejected(response.status_code, response.content, body):
            response = await self._post(url, body)
        self._raise_for_status(response.status_code, response.content)
        try:
            data = response.json()
        except ValueError as exc:
            raise LLMError("Gemini devolvió una respuesta ilegible", retryable=True) from exc
        return self._text_from(data, final=True)

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
        url = f"{self.base_url}/models/{self.model}:streamGenerateContent?alt=sse"
        body = self._body(system, prompt, temperature=temperature, max_tokens=max_tokens, json_mode=False)
        for _ in range(2):
            try:
                async with self._client.stream("POST", url, json=body, headers=self._headers()) as response:
                    if response.status_code != 200:
                        content = await response.aread()
                        if self._drop_thinking_if_rejected(response.status_code, content, body):
                            continue
                        self._raise_for_status(response.status_code, content)
                    async for line in response.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        payload = line[5:].strip()
                        if not payload or payload == "[DONE]":
                            continue
                        try:
                            data = json.loads(payload)
                        except ValueError:
                            log.debug("Línea SSE ilegible de Gemini: %s", payload[:120])
                            continue
                        text = self._text_from(data, final=False)
                        if text:
                            yield text
                    return
            except httpx.TimeoutException as exc:
                raise LLMError("Gemini tardó demasiado en responder", retryable=True) from exc
            except httpx.TransportError as exc:
                raise LLMError(f"Se cortó la conexión con Gemini: {exc}", retryable=True) from exc
