"""Capa LLM: adaptador de Gemini (petición y respuesta, normal y SSE), reintentos, JSON tolerante y prompts."""

from __future__ import annotations

import json

import httpx
import pytest
from pydantic import BaseModel

from app.config import Settings
from app.llm import DemoProvider, LLMBlockedError, LLMError, get_provider
from app.llm.base import extract_json
from app.llm.gemini import GeminiProvider
from app.prompts import parse_prompt, prompts


class Out(BaseModel):
    titulo: str
    n: int


def gemini(handler, **kw) -> GeminiProvider:
    provider = GeminiProvider("clave-falsa", "gemini-3.8-flash", transport=httpx.MockTransport(handler), **kw)
    provider.retry_base_delay = 0
    return provider


def candidate(text: str, thought: str | None = None, finish: str = "STOP") -> dict:
    parts = []
    if thought:
        parts.append({"text": thought, "thought": True})
    parts.append({"text": text})
    return {"candidates": [{"content": {"role": "model", "parts": parts}, "finishReason": finish}]}


async def test_gemini_generate_json_peticion_y_respuesta():
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json=candidate('```json\n{"titulo": "Hola", "n": 3}\n```', thought="pensando…"))

    provider = gemini(handler)
    result = await provider.generate_json("t", "Eres útil.", "Dame JSON", Out, temperature=0.2, max_tokens=500)
    assert result == Out(titulo="Hola", n=3)

    request = seen[0]
    assert request.method == "POST"
    assert str(request.url) == "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent"
    assert request.headers["x-goog-api-key"] == "clave-falsa"
    body = json.loads(request.content)
    assert body["systemInstruction"]["parts"][0]["text"].startswith("Eres útil.")
    assert body["contents"] == [{"role": "user", "parts": [{"text": "Dame JSON"}]}]
    config = body["generationConfig"]
    assert config["temperature"] == 0.2 and config["maxOutputTokens"] == 500
    assert config["responseMimeType"] == "application/json"
    assert config["thinkingConfig"] == {"thinkingLevel": "low"}
    await provider.aclose()


async def test_gemini_stream_sse_ignora_el_razonamiento():
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        lines = [
            "data: " + json.dumps(candidate("", thought="voy a pensar")),
            "",
            "data: " + json.dumps(candidate("## Introducción\n\nHola, ")),
            "",
            ": comentario",
            "data: " + json.dumps(candidate("¿qué tal?")),
            "",
            "data: " + json.dumps({"candidates": [{"content": {"parts": []}, "finishReason": "STOP"}], "usageMetadata": {}}),
            "",
        ]
        return httpx.Response(200, headers={"content-type": "text/event-stream"}, content="\n".join(lines).encode("utf-8"))

    provider = gemini(handler)
    chunks = [c async for c in provider.stream_text("redactor.capitulo", "sistema", "usuario", temperature=0.8, max_tokens=4000)]
    assert "".join(chunks) == "## Introducción\n\nHola, ¿qué tal?"
    request = seen[0]
    assert str(request.url).endswith("/models/gemini-3.8-flash:streamGenerateContent?alt=sse")
    body = json.loads(request.content)
    assert "responseMimeType" not in body["generationConfig"]
    await provider.aclose()


async def test_gemini_reintenta_sin_thinking_y_lo_recuerda():
    bodies: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        bodies.append(body)
        if "thinkingConfig" in body["generationConfig"]:
            return httpx.Response(400, json={"error": {"code": 400, "message": "Thinking level is not supported for this model."}})
        return httpx.Response(200, json=candidate('{"titulo": "Ok", "n": 1}'))

    provider = gemini(handler)
    await provider.generate_json("t", "s", "p", Out, temperature=0, max_tokens=100)
    await provider.generate_json("t", "s", "p", Out, temperature=0, max_tokens=100)
    assert ["thinkingConfig" in b["generationConfig"] for b in bodies] == [True, False, False]
    await provider.aclose()


async def test_gemini_sin_nivel_de_razonamiento_no_lo_envia():
    bodies: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        bodies.append(json.loads(request.content))
        return httpx.Response(200, json=candidate('{"titulo": "Ok", "n": 1}'))

    provider = gemini(handler, thinking_level="")
    await provider.generate_json("t", "s", "p", Out, temperature=0, max_tokens=100)
    assert "thinkingConfig" not in bodies[0]["generationConfig"]
    await provider.aclose()


async def test_reintentos_ante_429_y_errores_definitivos():
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] < 3:
            return httpx.Response(429, json={"error": {"message": "Resource exhausted"}})
        return httpx.Response(200, json=candidate('{"titulo": "Por fin", "n": 2}'))

    provider = gemini(handler)
    assert (await provider.generate_json("t", "s", "p", Out, temperature=0, max_tokens=100)).titulo == "Por fin"
    assert calls["n"] == 3

    provider_401 = gemini(lambda r: httpx.Response(401, json={"error": {"message": "API key not valid"}}))
    with pytest.raises(LLMError) as info:
        await provider_401.generate_json("t", "s", "p", Out, temperature=0, max_tokens=100)
    assert info.value.status == 401 and not info.value.retryable

    blocked = gemini(lambda r: httpx.Response(200, json={"promptFeedback": {"blockReason": "SAFETY"}}))
    with pytest.raises(LLMBlockedError):
        await blocked.generate_json("t", "s", "p", Out, temperature=0, max_tokens=100)
    for p in (provider, provider_401, blocked):
        await p.aclose()


async def test_json_invalido_se_corrige_una_vez():
    prompts_seen: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        prompts_seen.append(body["contents"][0]["parts"][0]["text"])
        if len(prompts_seen) == 1:
            return httpx.Response(200, json=candidate('{"titulo": "Falta n"}'))
        return httpx.Response(200, json=candidate('Aquí va: {"titulo": "Completo", "n": 5} ¡listo!'))

    provider = gemini(handler)
    result = await provider.generate_json("t", "s", "Pide algo", Out, temperature=0, max_tokens=100)
    assert result.n == 5
    assert "no se pudo usar" in prompts_seen[1] and "n" in prompts_seen[1]
    await provider.aclose()


def test_extract_json_tolerante():
    assert extract_json('```json\n{"a": "}"}\n```') == {"a": "}"}
    assert extract_json('Texto {"a": {"b": [1, 2]}} y más {"c": 1}') == {"a": {"b": [1, 2]}}
    with pytest.raises(ValueError):
        extract_json("sin json")
    with pytest.raises(ValueError):
        extract_json('{"a": 1')


def test_sin_clave_se_usa_el_demo(tmp_path, caplog):
    settings = Settings(_env_file=None, llm_provider="gemini", gemini_api_key="", data_dir=tmp_path)
    provider = get_provider(settings)
    assert isinstance(provider, DemoProvider)
    assert "GEMINI_API_KEY" in caplog.text
    with_key = get_provider(Settings(_env_file=None, llm_provider="gemini", gemini_api_key="x", data_dir=tmp_path))
    assert isinstance(with_key, GeminiProvider) and with_key.model == "gemini-3.8-flash"


def test_prompts_tienen_reglas_explicitas():
    names = prompts.names()
    for expected in (
        "orquestador/guardarrail",
        "investigador/indice",
        "investigador/capitulo_alternativo",
        "investigador/lecturas",
        "redactor/capitulo",
        "redactor/guia_estilo",
        "ejercicios/ejercicio",
        "maquetador/contraportada",
    ):
        assert expected in names
    assert prompts.get("orquestador/guardarrail").temperature == 0
    chapter = prompts.get("redactor/capitulo")
    text = chapter.system
    for rule in ("## Introducción", "## Desarrollo", "## Ejemplos cotidianos", "## Conclusión", "tuteas", "estereotipos", "No copies", "sumérgete"):
        assert rule.lower() in text.lower(), rule
    system, user = chapter.render(numero=3, total=6, titulo_libro="Mi libro")
    assert "CAPÍTULO QUE ESCRIBES AHORA: 3 DE 6" in user and "{numero}" not in user
    # Los ejemplos JSON con llaves se conservan tal cual.
    _, user = prompts.get("ejercicios/ejercicio").render(tipo="reto")
    assert '{"tipo": "reto"' in user


def test_formato_de_prompt():
    template = parse_prompt("x", "---\ndescripcion: Prueba\ntemperatura: 0.4\nmax_tokens: 99\n---\n---sistema---\nHola {nombre}\n---usuario---\nDime {cosa} y {otra}")
    assert template.temperature == 0.4 and template.max_tokens == 99
    assert template.render(nombre="Ana", cosa="algo") == ("Hola Ana", "Dime algo y {otra}")


def test_demo_fail_desde_la_configuracion(tmp_path):
    from app.llm import get_provider

    from .conftest import make_settings

    provider = get_provider(make_settings(tmp_path, llm_provider="demo", demo_fail="redactor.capitulo@4x2, ejercicios.ejercicio"))
    rules = [(r.task, r.times) for r in provider.fail_rules]
    assert rules == [("redactor.capitulo", 2), ("ejercicios.ejercicio", 1)]
    assert provider.fail_rules[0].when({"number": 4}) and not provider.fail_rules[0].when({"number": 3})
