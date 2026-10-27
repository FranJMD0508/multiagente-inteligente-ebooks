"""Segunda revisión de código del backend (2026-10-27): imágenes de portada con proporciones
extremas, secciones marcadas sin `##`, streams que terminan sin motivo de fin, escape del `.md`,
encabezados vacíos y streams de una cuenta borrada."""

from __future__ import annotations

import io
import json
import time

import httpx
import pytest
from PIL import Image

from app.agents.redactor import ChapterStreamParser, normalize_markdown
from app.cover_image import ImageBadShape, bright_color
from app.export.markdown import escape_html
from app.llm import LLMError
from app.llm.openai import OpenAIProvider
from app.models import ReferenceData
from app.references.apa import format_reference, sort_references
from app.references.lookup import parse_isbn

from .conftest import IDEA_FINANZAS, register, wait_status
from .test_revision_llm import CONCLUSION, DEV, EXAMPLES, INTRO, chunk, gemini, run_parser, sse


def png(size: tuple[int, int], color, mode: str = "RGB") -> bytes:
    out = io.BytesIO()
    Image.new(mode, size, color).save(out, format="PNG")
    return out.getvalue()


# ---------- Hallazgo 1: una imagen diminuta y muy alargada agotaba la memoria ----------


async def test_una_imagen_muy_alargada_se_rechaza_rapido(client, auth):
    res = await client.post(
        "/api/ebooks", json={"prompt": IDEA_FINANZAS, "desiredChapters": 5, "exercisePref": "auto", "author": "Ana"}, headers=auth
    )
    eid = res.json()["id"]
    data = png((60, 600_000), (255, 255, 255))  # menos de 1 MB en PNG (con optimización, unos KB)
    assert len(data) < 1_000_000
    started = time.perf_counter()
    res = await client.post(f"/api/ebooks/{eid}/cover-image", files={"file": ("p.png", data, "image/png")}, headers=auth)
    assert res.status_code == 415 and "alargada" in res.json()["detail"]["message"]
    assert time.perf_counter() - started < 2


def test_proporciones_normales_y_png_con_alfa_grande():
    with pytest.raises(ImageBadShape):
        bright_color(png((100, 900), (0, 0, 0)))
    assert bright_color(png((100, 800), (10, 20, 30))) == (10, 20, 30)  # 8:1 todavía vale
    # PNG con alfa grande: se reduce antes de componer sobre blanco y el resultado no cambia.
    image = Image.new("RGBA", (4000, 3000), (0, 0, 0, 255))
    image.paste((0, 0, 0, 0), (0, 0, 4000, 300))  # una franja transparente arriba (cuenta como blanco)
    out = io.BytesIO()
    image.save(out, format="PNG")
    assert all(v > 250 for v in bright_color(out.getvalue()))


def test_la_orientacion_exif_se_sigue_aplicando_al_reducir_primero():
    # 300×100 con la mitad derecha blanca y orientación 6 (girada 90°): al girarla queda 100×300.
    image = Image.new("RGB", (300, 100), (0, 0, 0))
    image.paste((255, 255, 255), (150, 0, 300, 100))
    exif = Image.Exif()
    exif[0x0112] = 6
    out = io.BytesIO()
    image.save(out, format="JPEG", quality=95, exif=exif)
    assert all(v > 245 for v in bright_color(out.getvalue()))


# ---------- Hallazgo 3: secciones marcadas con ###, negrita o la etiqueta sola ----------


def _as_style(style: str) -> str:
    def mark(label: str) -> str:
        return {"h3": f"### {label}", "negrita": f"**{label}**", "sola": f"{label}:", "numerada": f"## {label}"}[style]

    labels = ("Introducción", "Desarrollo", "Ejemplos cotidianos", "Conclusión")
    if style == "numerada":
        labels = tuple(f"{i}. {label}" for i, label in enumerate(labels, start=1))
    bodies = (INTRO, DEV, EXAMPLES, CONCLUSION)
    return "".join(mark(label) + body[body.index("\n") :] for label, body in zip(labels, bodies)) + "\n" + mark("Ejercicio práctico") + "\n- Una idea\n"


@pytest.mark.parametrize("style", ["h3", "negrita", "sola", "numerada"])
@pytest.mark.parametrize("size", [1, 3, 10_000])
def test_el_parser_reconoce_secciones_sin_doble_almohadilla(style, size):
    parser = run_parser(_as_style(style), size)
    assert parser.missing() == []
    s = parser.result()
    assert s.introduccion.startswith("Te pasa a menudo") and s.desarrollo.startswith("Apunta cada gasto")
    assert s.ejemplos.startswith("Daniela") and s.conclusion.startswith("Empieza hoy")
    assert "Una idea" not in s.conclusion  # el ejercicio lo escribe otro agente


def test_con_estilo_doble_almohadilla_los_subtitulos_siguen_siendo_texto():
    text = INTRO + DEV.replace("veas.", "veas.\n\n### Ejemplos\n\nUn subtítulo.\n\n**Conclusión**\n\nY una negrita sola.") + EXAMPLES + CONCLUSION
    s = run_parser(text, 5).result()
    assert "### Ejemplos" in s.desarrollo and "**Conclusión**" in s.desarrollo
    assert s.ejemplos.startswith("Daniela")


def test_sin_estilo_doble_almohadilla_una_lista_no_cambia_de_seccion():
    text = "### Introducción\n\nTe pasa a menudo: llegas a fin de mes y no sabes dónde se fue el dinero.\n\n- Conclusión\n\n" + "### Desarrollo\n\nApunta cada gasto durante siete días seguidos y sin juzgarte nunca.\n"
    s = run_parser(text, 2).result()
    assert "- Conclusión" in s.introduccion and s.desarrollo.startswith("Apunta")


# ---------- Hallazgo 4: un capítulo cortado lo avisa el proveedor, no la puntuación ----------


async def test_gemini_avisa_si_el_stream_termina_sin_motivo_de_fin():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, headers={"content-type": "text/event-stream"}, content=sse(chunk("## Introducción\n\nHola, esto se cor")))

    provider = gemini(handler)
    with pytest.raises(LLMError) as err:
        _ = [c async for c in provider.stream_text("redactor.capitulo", "s", "u", temperature=0.8, max_tokens=100)]
    assert err.value.retryable and "antes de terminar" in str(err.value)
    await provider.aclose()


async def test_openai_avisa_si_el_stream_termina_sin_motivo_de_fin():
    def handler(request: httpx.Request) -> httpx.Response:
        body = {"id": "c", "object": "chat.completion.chunk", "created": 0, "model": "m", "choices": [{"index": 0, "delta": {"content": "Hola, esto se cor"}, "finish_reason": None}]}
        payload = f"data: {json.dumps(body)}\n\ndata: [DONE]\n\n"
        return httpx.Response(200, headers={"content-type": "text/event-stream"}, content=payload.encode())

    provider = OpenAIProvider("clave-falsa", "gpt-x", http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    with pytest.raises(LLMError) as err:
        _ = [c async for c in provider.stream_text("redactor.capitulo", "s", "u", temperature=0.8, max_tokens=100)]
    assert err.value.retryable and "antes de terminar" in str(err.value)
    await provider.aclose()


# ---------- Hallazgo 5: el escape del .md no tiene excepciones para el código ----------


def test_el_md_escapa_el_html_aunque_parezca_codigo():
    for raw in (
        "\\`<img src=x onerror=alert(1)>\\`",
        "Texto ~~~<img src=x onerror=alert(1)>~~~ en mitad de una línea",
        "```x\n\n<img src=x onerror=alert(1)>\n\n```",
        "<javascript:alert(1)@x.y>",
    ):
        out = escape_html(raw)
        assert "<img" not in out and "<javascript" not in out, raw
    assert escape_html("Escríbeme a <ana@example.com> o mira <https://ejemplo.com/guía>.") == (
        "Escríbeme a <ana@example.com> o mira <https://ejemplo.com/guía>."
    )
    assert escape_html("Tom & Jerry, 3 < 5") == "Tom & Jerry, 3 < 5"


# ---------- Hallazgo 6: un "#" o "##" solo no deja un encabezado vacío ----------


def test_un_encabezado_vacio_se_quita_al_limpiar():
    assert normalize_markdown("Primer párrafo.\n\n##\n\n#\nSegundo párrafo.") == "Primer párrafo.\n\nSegundo párrafo."
    parser = ChapterStreamParser()
    parser.feed(INTRO + DEV + EXAMPLES.replace("\n\nDaniela", "\n\n##\n\nDaniela") + CONCLUSION)
    parser.finish()
    assert "##" not in parser.result().ejemplos


# ---------- Hallazgo 7: borrar la cuenta cierra sus streams ----------


async def test_borrar_la_cuenta_cierra_sus_streams(client, services):
    headers = await register(client)
    me = (await client.get("/api/auth/me", headers=headers)).json()
    sub = services.bus.subscribe(me["id"])
    assert (await client.delete("/api/auth/me", headers=headers)).status_code == 204
    assert sub.closed and services.bus.subscriber_count(me["id"]) == 0


# ---------- Hallazgo 2: el panel mide el contraste con el color claro del servidor ----------


async def test_el_diseno_trae_el_color_claro_que_calculo_el_servidor(client, auth):
    res = await client.post(
        "/api/ebooks", json={"prompt": IDEA_FINANZAS, "desiredChapters": 5, "exercisePref": "auto", "author": "Ana"}, headers=auth
    )
    eid = res.json()["id"]
    res = await client.post(f"/api/ebooks/{eid}/cover-image", files={"file": ("p.png", png((64, 96), (250, 240, 200)), "image/png")}, headers=auth)
    url = res.json()["url"]
    # El cliente manda otro color claro (o ninguno): manda el del servidor.
    image = {"src": url, "placement": "fondo", "veil": 0.3, "minVeil": 0, "focusY": 50, "alt": "", "bright": [0, 0, 0]}
    cover = (await client.put(f"/api/ebooks/{eid}/design", json={"coverImage": image}, headers=auth)).json()["design"]["coverImage"]
    assert cover["bright"] == [250.0, 240.0, 200.0] and cover["veil"] >= cover["minVeil"] > 0


# ---------- Hallazgo 7 (frontend): una instantánea vieja no borra el texto que llegó después ----------


async def test_la_revision_sube_con_cada_cambio_y_cada_token(services, client, auth):
    res = await client.post(
        "/api/ebooks", json={"prompt": IDEA_FINANZAS, "desiredChapters": 5, "exercisePref": "auto", "author": "Ana"}, headers=auth
    )
    eid = res.json()["id"]
    await wait_status(services, eid, "indice_pendiente")
    first = services.store.get(eid).rev
    services.store.update(eid, lambda e: setattr(e, "subtitle", "Otro subtítulo"))
    second = services.store.get(eid).rev
    me = (await client.get("/api/auth/me", headers=auth)).json()
    sub = services.bus.subscribe(me["id"])
    services.store.append_token(eid, 1, "introduccion", "Hola")
    third = services.store.get(eid).rev
    assert first < second < third
    event = json.loads(sub.queue.get_nowait())
    assert event["type"] == "token" and event["rev"] == third
    services.bus.unsubscribe(sub)


# ---------- Hallazgo 10 (frontend): mismas reglas de APA en el servidor y en el navegador ----------


def test_apa_igual_que_el_frontend():
    article = ReferenceData(kind="articulo", authors=["Pérez, Ana"], year="s.f", title="Hábitos", journal="Revista", volume="3", pages="85--101")
    text = format_reference(article)
    assert "(s. f.)" in text and "85–101" in text and "––" not in text
    same_author = [
        ReferenceData(authors=["Pérez, Ana"], year="2020", title="Arb"),
        ReferenceData(authors=["Pérez, Ana"], year="2020", title="Ára"),
    ]
    assert [r.title for r in sort_references(same_author)] == ["Ára", "Arb"]
    assert parse_isbn("ISBN-13: 978-0-13-468599-1") == "9780134685991"
    assert parse_isbn("ISBN-10: 0-13-468599-1") == "0134685991"
