"""Adaptadores de Claude y OpenAI con sus SDK y un transporte HTTP simulado (sin red)."""

from __future__ import annotations

import json

import httpx
import pytest
from pydantic import BaseModel

from app.llm.anthropic import AnthropicProvider
from app.llm.openai import OpenAIProvider


class Out(BaseModel):
    titulo: str


async def test_anthropic_mensaje_json():
    # El SDK de Anthropic usa `httpx2` (bifurcación de httpx con la misma API).
    httpx2 = pytest.importorskip("httpx2")
    seen: list[dict] = []

    def handler(request):
        body = json.loads(request.content)
        seen.append(body)
        return httpx2.Response(
            200,
            json={
                "id": "msg_1",
                "type": "message",
                "role": "assistant",
                "model": body["model"],
                "content": [{"type": "text", "text": '{"titulo": "Hola"}'}],
                "stop_reason": "end_turn",
                "stop_sequence": None,
                "usage": {"input_tokens": 1, "output_tokens": 1},
            },
        )

    provider = AnthropicProvider("clave", "claude-sonnet-5", http_client=httpx2.AsyncClient(transport=httpx2.MockTransport(handler)))
    result = await provider.generate_json("t", "Sistema", "Usuario", Out, temperature=0.3, max_tokens=200)
    assert result.titulo == "Hola"
    # Claude Sonnet 5 no admite temperature; el razonamiento se acota con effort y se deja margen de tokens.
    assert seen[0]["model"] == "claude-sonnet-5" and "temperature" not in seen[0]
    assert seen[0]["output_config"] == {"effort": "low"} and seen[0]["max_tokens"] == 4096
    assert seen[0]["system"].startswith("Sistema") and seen[0]["messages"] == [{"role": "user", "content": "Usuario"}]
    await provider.aclose()


async def test_openai_json_y_streaming():
    seen: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        seen.append(body)
        if body.get("stream"):
            chunks = [
                {"id": "c", "object": "chat.completion.chunk", "created": 0, "model": "m", "choices": [{"index": 0, "delta": {"content": text}, "finish_reason": None}]}
                for text in ("## Intro", "ducción\n\nHola")
            ] + [{"id": "c", "object": "chat.completion.chunk", "created": 0, "model": "m", "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}]}]
            payload = "".join(f"data: {json.dumps(c)}\n\n" for c in chunks) + "data: [DONE]\n\n"
            return httpx.Response(200, headers={"content-type": "text/event-stream"}, content=payload.encode())
        if "temperature" in body:
            return httpx.Response(400, json={"error": {"message": "Unsupported value: 'temperature' does not support 0.3 with this model.", "type": "invalid_request_error", "param": "temperature", "code": "unsupported_value"}})
        return httpx.Response(
            200,
            json={
                "id": "c",
                "object": "chat.completion",
                "created": 0,
                "model": "m",
                "choices": [{"index": 0, "message": {"role": "assistant", "content": '{"titulo": "Vale"}'}, "finish_reason": "stop"}],
            },
        )

    provider = OpenAIProvider("clave", "gpt-5-mini", http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    result = await provider.generate_json("t", "Sistema", "Usuario", Out, temperature=0.3, max_tokens=200)
    assert result.titulo == "Vale"
    # El modelo rechazó la temperatura: se reintentó sin ella y se recuerda.
    assert "temperature" in seen[0] and "temperature" not in seen[1]
    assert seen[1]["response_format"] == {"type": "json_object"} and seen[1]["max_completion_tokens"] == 200
    text = "".join([c async for c in provider.stream_text("redactor.capitulo", "s", "u", temperature=0.8, max_tokens=100)])
    assert text == "## Introducción\n\nHola"
    assert "temperature" not in seen[-1]
    await provider.aclose()
