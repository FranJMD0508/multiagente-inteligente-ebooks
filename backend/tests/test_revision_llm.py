"""Hallazgos de la revisión en la capa LLM y el Redactor: respuestas cortadas por el límite de
tokens (Gemini, Claude y OpenAI), el reparto del stream en secciones, esperas ante 429,
tiempo límite global de las llamadas JSON y errores de httpx."""

from __future__ import annotations

import asyncio
import json

import httpx
import pytest
from pydantic import BaseModel

from app.agents.redactor import ChapterStreamParser
from app.llm import DemoProvider, LLMError
from app.llm import base as llm_base
from app.llm.gemini import GeminiProvider
from app.llm.openai import OpenAIProvider

from .conftest import IDEA_FINANZAS, wait_status


class Out(BaseModel):
    titulo: str


def gemini(handler) -> GeminiProvider:
    provider = GeminiProvider("clave-falsa", "gemini-3.8-flash", transport=httpx.MockTransport(handler))
    provider.retry_base_delay = 0
    return provider


def sse(*events: dict) -> bytes:
    return "".join(f"data: {json.dumps(e)}\n\n" for e in events).encode("utf-8")


def chunk(text: str, finish: str | None = None) -> dict:
    candidate: dict = {"content": {"role": "model", "parts": [{"text": text}]}}
    if finish:
        candidate["finishReason"] = finish
    return {"candidates": [candidate]}


def run_parser(text: str, size: int) -> ChapterStreamParser:
    parser = ChapterStreamParser()
    for i in range(0, len(text), size):
        parser.feed(text[i : i + size])
    parser.finish()
    return parser


INTRO = "## Introducción\n\nTe pasa a menudo: llegas a fin de mes y no sabes dónde se fue el dinero de la semana.\n\n"
DEV = "## Desarrollo\n\nApunta cada gasto durante siete días seguidos y sin juzgarte por nada de lo que veas.\n\n"
EXAMPLES = "## Ejemplos cotidianos\n\nDaniela, de 22 años, estudia de noche y trabaja en una cafetería cerca de casa.\n\n"
CONCLUSION = "## Conclusión\n\nEmpieza hoy con una libreta pequeña y revisa tus notas el domingo por la tarde.\n"


# ---------- Hallazgo 9: el parser solo cambia de sección con # o ## y hacia delante ----------


@pytest.mark.parametrize("size", [1, 4, 11, 10_000])
def test_parser_no_cambia_de_seccion_con_negritas_h3_ni_palabras_sueltas(size):
    text = (
        INTRO
        + "## Desarrollo\n\nPrimero, la idea central del capítulo explicada con calma y en pocas frases.\n\n"
        "**Ejemplos:** el café de la mañana, el taxi de los viernes y las suscripciones olvidadas.\n\n"
        "### Ejemplos\n\nUn subtítulo dentro del desarrollo no cambia de sección.\n\n"
        "Conclusión\n\nEsta palabra sola tampoco cambia de sección.\n\n"
        + EXAMPLES
        + CONCLUSION
    )
    s = run_parser(text, size).result()
    assert "**Ejemplos:** el café de la mañana" in s.desarrollo
    assert "### Ejemplos\n\nUn subtítulo dentro del desarrollo" in s.desarrollo
    assert "Conclusión\n\nEsta palabra sola" in s.desarrollo
    assert s.ejemplos.startswith("Daniela") and "café de la mañana" not in s.ejemplos
    assert s.conclusion.startswith("Empieza hoy") and "palabra sola" not in s.conclusion


@pytest.mark.parametrize("size", [1, 5, 10_000])
def test_parser_solo_avanza_y_une_las_repeticiones(size):
    text = (
        INTRO
        + DEV
        + "## Introducción\n\nEsta vuelta atrás no debe mover el texto a la introducción.\n"
        + "## Desarrollo\nY esta repetición sigue en el desarrollo como un párrafo nuevo.\n\n"
        + EXAMPLES
        + CONCLUSION
    )
    parser = run_parser(text, size)
    s = parser.result()
    assert s.introduccion == "Te pasa a menudo: llegas a fin de mes y no sabes dónde se fue el dinero de la semana."
    assert s.desarrollo == (
        "Apunta cada gasto durante siete días seguidos y sin juzgarte por nada de lo que veas.\n\n"
        "Esta vuelta atrás no debe mover el texto a la introducción.\n\n"
        "Y esta repetición sigue en el desarrollo como un párrafo nuevo."
    )
    assert parser.missing() == []


def test_missing_detecta_un_capitulo_cortado():
    cut = INTRO + DEV + EXAMPLES + "## Conclusión\n\nEmpieza hoy con una libreta pequeña y revisa tus notas el domingo por la"
    assert run_parser(cut, 7).missing() == ["conclusion"]
    # Termina en un final de frase, en una lista o justo antes del ejercicio: completo.
    assert run_parser(INTRO + DEV + EXAMPLES + CONCLUSION, 7).missing() == []
    listed = INTRO + DEV + EXAMPLES + "## Conclusión\n\nPara esta semana, elige una de estas tres ideas:\n\n- Anota tus gastos del día"
    assert run_parser(listed, 7).missing() == []
    closed = INTRO + DEV + EXAMPLES + "## Conclusión\n\nEmpieza hoy con una libreta pequeña y revisa tus notas el domingo por\n\n## Ejercicio práctico\n- x"
    assert run_parser(closed, 7).missing() == []


# ---------- Hallazgo 8: respuesta cortada por el límite de tokens ----------


async def test_gemini_avisa_si_el_stream_se_corta_por_el_limite_de_tokens():
    def handler(request: httpx.Request) -> httpx.Response:
        body = sse(chunk("## Introducción\n\nHola, "), chunk("esto se corta a me", finish="MAX_TOKENS"))
        return httpx.Response(200, headers={"content-type": "text/event-stream"}, content=body)

    provider = gemini(handler)
    received: list[str] = []
    with pytest.raises(LLMError) as info:
        async for piece in provider.stream_text("redactor.capitulo", "s", "u", temperature=0.8, max_tokens=50):
            received.append(piece)
    assert info.value.retryable and "límite de tokens" in str(info.value)
    assert "".join(received) == "## Introducción\n\nHola, esto se corta a me"
    await provider.aclose()


async def test_openai_avisa_si_el_stream_se_corta_por_el_limite_de_tokens():
    def handler(request: httpx.Request) -> httpx.Response:
        chunks = [
            {"id": "c", "object": "chat.completion.chunk", "created": 0, "model": "m", "choices": [{"index": 0, "delta": {"content": "Hola, esto se cor"}, "finish_reason": None}]},
            {"id": "c", "object": "chat.completion.chunk", "created": 0, "model": "m", "choices": [{"index": 0, "delta": {}, "finish_reason": "length"}]},
        ]
        payload = "".join(f"data: {json.dumps(c)}\n\n" for c in chunks) + "data: [DONE]\n\n"
        return httpx.Response(200, headers={"content-type": "text/event-stream"}, content=payload.encode())

    provider = OpenAIProvider("clave", "gpt-5-mini", http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    with pytest.raises(LLMError) as info:
        async for _ in provider.stream_text("redactor.capitulo", "s", "u", temperature=0.8, max_tokens=50):
            pass
    assert info.value.retryable
    await provider.aclose()


async def test_anthropic_avisa_si_el_stream_se_corta_por_el_limite_de_tokens():
    httpx2 = pytest.importorskip("httpx2")
    from app.llm.anthropic import AnthropicProvider

    events = [
        ("message_start", {"type": "message_start", "message": {"id": "m", "type": "message", "role": "assistant", "model": "claude-sonnet-5", "content": [], "stop_reason": None, "stop_sequence": None, "usage": {"input_tokens": 1, "output_tokens": 1}}}),
        ("content_block_start", {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}}),
        ("content_block_delta", {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "Hola, esto se cor"}}),
        ("content_block_stop", {"type": "content_block_stop", "index": 0}),
        ("message_delta", {"type": "message_delta", "delta": {"stop_reason": "max_tokens", "stop_sequence": None}, "usage": {"output_tokens": 50}}),
        ("message_stop", {"type": "message_stop"}),
    ]
    payload = "".join(f"event: {name}\ndata: {json.dumps(data)}\n\n" for name, data in events).encode()

    def handler(request):
        return httpx2.Response(200, headers={"content-type": "text/event-stream"}, content=payload)

    provider = AnthropicProvider("clave", "claude-sonnet-5", http_client=httpx2.AsyncClient(transport=httpx2.MockTransport(handler)))
    received: list[str] = []
    with pytest.raises(LLMError) as info:
        async for piece in provider.stream_text("redactor.capitulo", "s", "u", temperature=0.8, max_tokens=50):
            received.append(piece)
    assert info.value.retryable and "".join(received) == "Hola, esto se cor"
    await provider.aclose()


class TruncatingDemo(DemoProvider):
    """Demo que corta el capítulo 2 a media frase y luego avisa del límite de tokens."""

    def __init__(self, *, signal: bool) -> None:
        super().__init__(delay_ms=0)
        self.signal = signal

    async def _stream(self, task, system, prompt, *, temperature, max_tokens, context):
        text = "".join([piece async for piece in super()._stream(task, system, prompt, temperature=temperature, max_tokens=max_tokens, context=context)])
        if context.get("number") != 2:
            yield text
            return
        yield text[: text.rindex(" ", 0, len(text) - 20)]  # se corta a media frase de la conclusión
        if self.signal:
            raise LLMError("La respuesta se cortó por el límite de tokens", retryable=True)


@pytest.mark.parametrize("signal", [True, False])
async def test_un_capitulo_cortado_no_se_acepta(client, auth, services, signal):
    services.llm = TruncatingDemo(signal=signal)
    res = await client.post("/api/ebooks", json={"prompt": IDEA_FINANZAS, "desiredChapters": 5, "exercisePref": "auto", "author": "Ana"}, headers=auth)
    eid = res.json()["id"]
    await wait_status(services, eid, "indice_pendiente")
    await client.post(f"/api/ebooks/{eid}/outline/approve", headers=auth)
    await wait_status(services, eid, "cap1_pendiente")
    await client.post(f"/api/ebooks/{eid}/chapters/1/approve", headers=auth)
    await wait_status(services, eid, "error", timeout=30)
    ebook = services.store.get(eid)
    assert ebook.error.chapter == 2 and ebook.error.retryable
    assert ebook.chapter(2).status == "error" and ebook.chapter(2).exercise is None


# ---------- Sospechas: 429 con espera, tiempo límite global y errores de httpx ----------


async def test_429_respeta_la_espera_que_pide_el_proveedor(monkeypatch):
    waits: list[float] = []

    async def fake_sleep(seconds: float) -> None:
        waits.append(seconds)

    monkeypatch.setattr(llm_base, "_sleep", fake_sleep)
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] == 1:
            error = {"error": {"code": 429, "message": "Resource exhausted", "details": [{"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": "7s"}]}}
            return httpx.Response(429, json=error)
        if calls["n"] == 2:
            return httpx.Response(429, headers={"Retry-After": "3"}, json={"error": {"message": "Slow down"}})
        return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": '{"titulo": "Ya"}'}]}, "finishReason": "STOP"}]})

    provider = gemini(handler)
    assert (await provider.generate_json("t", "s", "p", Out, temperature=0, max_tokens=100)).titulo == "Ya"
    assert waits == [7.0, 3.0]
    await provider.aclose()

    # Si pide esperar demasiado, no se espera: se falla enseguida.
    waits.clear()
    too_long = gemini(lambda r: httpx.Response(429, headers={"Retry-After": "120"}, json={"error": {"message": "Quota"}}))
    with pytest.raises(LLMError) as info:
        await too_long.generate_json("t", "s", "p", Out, temperature=0, max_tokens=100)
    assert info.value.status == 429 and info.value.retry_after == 120 and waits == []
    await too_long.aclose()


async def test_las_llamadas_json_tienen_un_tiempo_limite_global():
    provider = DemoProvider(delay_ms=0)
    provider.json_timeout_s = 0.2
    provider.inject_failure("maquetador.contraportada", hang=True)
    loop = asyncio.get_running_loop()
    start = loop.time()
    with pytest.raises(LLMError) as info:
        await provider.generate_json("maquetador.contraportada", "s", "p", Out, temperature=0, max_tokens=100)
    assert loop.time() - start < 5 and info.value.retryable


async def test_cualquier_error_de_httpx_se_traduce_a_llmerror():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.DecodingError("respuesta mal comprimida", request=request)

    provider = gemini(handler)
    with pytest.raises(LLMError) as info:
        await provider.generate_json("t", "s", "p", Out, temperature=0, max_tokens=100)
    assert info.value.retryable
    with pytest.raises(LLMError):
        async for _ in provider.stream_text("redactor.capitulo", "s", "u", temperature=0.8, max_tokens=50):
            pass
    await provider.aclose()
