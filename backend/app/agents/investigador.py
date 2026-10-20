"""Agente Investigador: índice del libro (RF-02), capítulo alternativo y lecturas recomendadas."""

from __future__ import annotations

import re
import unicodedata

from pydantic import BaseModel, Field

from ..guardrails import SENSITIVITY_LABELS
from ..llm import LLMProvider
from ..models import MAX_CHAPTERS, MIN_CHAPTERS, SENSITIVITIES, Chapter, Reference, ReferenceData
from ..niches import get_niche
from ..references.apa import http_url
from .common import Text, ask_json, clean_title, outline_text

# ---------- Esquemas de salida del LLM ----------


class Brief(BaseModel):
    conceptos: list[Text] = Field(default_factory=list)
    terminos: list[Text] = Field(default_factory=list)
    enfoque: Text = ""


class OutlineChapterOut(BaseModel):
    titulo: Text
    resumen: Text = ""
    puntosClave: list[Text] = Field(default_factory=list)


class OutlineOut(BaseModel):
    titulo: Text
    subtitulo: Text = ""
    publico: Text = ""
    sensibilidad: Text = "ninguno"
    brief: Brief = Field(default_factory=Brief)
    capitulos: list[OutlineChapterOut]


class ReadingOut(BaseModel):
    tipo: Text = "libro"
    autores: list[Text] = Field(default_factory=list)
    anio: Text = ""
    titulo: Text
    editorial: Text = ""
    edicion: Text = ""
    revista: Text = ""
    volumen: Text = ""
    numero: Text = ""
    paginas: Text = ""
    doi: Text = ""
    isbn: Text = ""
    url: Text = ""
    capitulos: list[int] = Field(default_factory=list)
    motivo: Text = ""


class ReadingsOut(BaseModel):
    lecturas: list[ReadingOut] = Field(default_factory=list)


# ---------- Validaciones ----------


def _check_chapter(ch: OutlineChapterOut, where: str) -> None:
    ch.titulo = clean_title(ch.titulo)
    if len(ch.titulo) < 3:
        raise ValueError(f"{where}: el título está vacío")
    if not ch.resumen:
        raise ValueError(f"{where}: falta el resumen")
    points = [p.strip().lstrip("-•").strip() for p in ch.puntosClave if p.strip()]
    if len(points) < 3:
        raise ValueError(f"{where}: necesita exactamente 3 puntos clave y tiene {len(points)}")
    ch.puntosClave = points[:3]


def check_outline(result: OutlineOut, desired: int | str) -> None:
    """RF-02: exactamente N capítulos (o entre 5 y 7 si es automático)."""
    chapters = result.capitulos
    target = None if desired == "auto" else int(desired)
    if target is not None and len(chapters) > target:
        # Se conserva el último capítulo, que suele cerrar el libro.
        chapters = [*chapters[: target - 1], chapters[-1]]
    if target is None and len(chapters) > MAX_CHAPTERS:
        chapters = [*chapters[: MAX_CHAPTERS - 1], chapters[-1]]
    if target is not None and len(chapters) < target:
        raise ValueError(f"se pidieron exactamente {target} capítulos y llegaron {len(chapters)}")
    if len(chapters) < MIN_CHAPTERS:
        raise ValueError(f"el índice debe tener entre {MIN_CHAPTERS} y {MAX_CHAPTERS} capítulos")
    for i, ch in enumerate(chapters, start=1):
        _check_chapter(ch, f"capítulo {i}")
    titles = [_norm(c.titulo) for c in chapters]
    if len(set(titles)) != len(titles):
        raise ValueError("hay capítulos con el mismo título")
    result.capitulos = chapters
    result.titulo = result.titulo.strip().strip('"“”«»').rstrip(".")
    if not result.titulo:
        raise ValueError("falta el título del libro")
    if result.sensibilidad not in SENSITIVITIES:
        result.sensibilidad = "ninguno"


def _norm(text: str) -> str:
    text = unicodedata.normalize("NFD", text.lower())
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


# ---------- Tareas ----------


async def propose_outline(
    llm: LLMProvider,
    *,
    idea: str,
    niche_id: str,
    audience: str,
    sensitivity: str,
    desired: int | str,
    previous: list[Chapter] | None = None,
    feedback: str = "",
    variant: int = 0,
) -> OutlineOut:
    niche = get_niche(niche_id)
    if desired == "auto":
        count_text = f"elige entre {MIN_CHAPTERS} y {MAX_CHAPTERS} según lo que necesite el tema (la lista `capitulos` debe tener exactamente ese número)"
    else:
        count_text = f"exactamente {desired}"
    regenerate = ""
    if previous:
        regenerate = (
            "\nEsta es una versión nueva del índice. El índice anterior era:\n"
            f"{outline_text(previous)}\n"
            + (f'Lo que pidió la persona: "{feedback.strip()}"\n' if feedback.strip() else "La persona no dio detalles: propón un enfoque distinto.\n")
            + "Propón un índice claramente distinto que atienda su comentario, sin perder el foco del tema. "
            "Mantén el mismo título del libro."
        )
    values = {
        "idea": idea,
        "nicho": niche.label if niche.id != "general" else "Crecimiento personal (sin nicho concreto)",
        "publico": audience,
        "sensibilidad": SENSITIVITY_LABELS.get(sensitivity, sensitivity),
        "num_capitulos": count_text,
        "regenerar": regenerate,
    }
    context = {"idea": idea, "niche_id": niche_id, "desired": desired, "variant": variant, "feedback": feedback}
    return await ask_json(
        llm,
        "investigador/indice",
        "investigador.indice",
        OutlineOut,
        values,
        context,
        check=lambda r: check_outline(r, desired),
    )


async def alternative_chapter(
    llm: LLMProvider,
    *,
    book_title: str,
    idea: str,
    audience: str,
    niche_id: str,
    chapters: list[Chapter],
    target: Chapter,
) -> OutlineChapterOut:
    others = {_norm(c.title) for c in chapters}

    def check(result: OutlineChapterOut) -> None:
        _check_chapter(result, "capítulo")
        if _norm(result.titulo) in others:
            raise ValueError("el capítulo propuesto repite un título que ya está en el índice")

    values = {
        "titulo_libro": book_title,
        "idea": idea,
        "publico": audience,
        "indice": outline_text(chapters),
        "numero": target.number,
        "capitulo_actual": f"{target.title} — {target.summary}\nPuntos clave: " + "; ".join(target.key_points),
    }
    context = {
        "niche_id": niche_id,
        "item": {"title": target.title, "summary": target.summary, "keyPoints": target.key_points},
        "taken": [c.title for c in chapters],
    }
    return await ask_json(llm, "investigador/capitulo_alternativo", "investigador.capitulo_alternativo", OutlineChapterOut, values, context, check)


async def suggest_readings(
    llm: LLMProvider,
    *,
    book_title: str,
    idea: str,
    audience: str,
    niche_id: str,
    chapters: list[Chapter],
    concepts: list[str],
    exclude_titles: list[str],
    max_count: int,
    min_count: int = 2,
) -> list[ReadingOut]:
    values = {
        "titulo_libro": book_title,
        "idea": idea,
        "publico": audience,
        "indice": outline_text(chapters),
        "conceptos": ", ".join(concepts) if concepts else "(sin brief)",
        "excluir": "; ".join(exclude_titles) if exclude_titles else "ninguna",
        "cantidad": f"entre {min_count} y {max_count} lecturas (menos si no estás seguro de suficientes obras)",
    }
    context = {
        "niche_id": niche_id,
        "exclude": exclude_titles,
        "max": max_count,
        "total_chapters": len(chapters),
    }
    result = await ask_json(llm, "investigador/lecturas", "investigador.lecturas", ReadingsOut, values, context)
    excluded = {_norm(t) for t in exclude_titles}
    out: list[ReadingOut] = []
    for reading in result.lecturas:
        key = _norm(reading.titulo)
        if not key or key in excluded:
            continue
        excluded.add(key)
        out.append(reading)
    return out[:max_count]


# ---------- Conversión a referencias ----------

_KIND = {"libro": "libro", "book": "libro", "articulo": "articulo", "artículo": "articulo", "article": "articulo", "web": "web", "sitio web": "web"}


def clean_doi(value: str | None) -> str | None:
    if not value:
        return None
    v = value.strip()
    v = re.sub(r"^(https?://(dx\.)?doi\.org/|doi:\s*)", "", v, flags=re.I)
    return v if re.match(r"^10\.\d{4,9}/\S+$", v) else None


def clean_isbn(value: str | None) -> str | None:
    if not value:
        return None
    digits = re.sub(r"[^0-9Xx]", "", value).upper()
    return digits if len(digits) in (10, 13) else None


def clean_year(value: str | None) -> str:
    match = re.search(r"\b(1[5-9]\d{2}|20\d{2})\b", value or "")
    return match.group(1) if match else "s. f."


def clean_edition(value: str | None) -> str | None:
    if not value:
        return None
    digits = re.sub(r"\D", "", value)
    if digits:
        return None if digits == "1" else digits
    return value.strip() or None


def reading_to_reference_data(reading: ReadingOut) -> ReferenceData:
    kind = _KIND.get(reading.tipo.strip().lower(), "libro")
    return ReferenceData(
        kind=kind,  # type: ignore[arg-type]
        authors=[a.strip() for a in reading.autores if a.strip()],
        year=clean_year(reading.anio),
        title=reading.titulo.strip(),
        publisher=reading.editorial or None,
        edition=clean_edition(reading.edicion),
        journal=reading.revista or None if kind == "articulo" else None,
        volume=reading.volumen or None if kind == "articulo" else None,
        issue=reading.numero or None if kind == "articulo" else None,
        pages=reading.paginas.replace("-", "–") if reading.paginas and kind == "articulo" else None,
        doi=clean_doi(reading.doi),
        isbn=clean_isbn(reading.isbn) if kind == "libro" else None,
        url=http_url(reading.url),  # solo http(s)
    )


def reading_to_reference(reading: ReadingOut, ref_id: str, total_chapters: int) -> Reference:
    data = reading_to_reference_data(reading)
    chapters = sorted({c for c in reading.capitulos if 1 <= c <= total_chapters})
    return Reference(
        **data.model_dump(),
        id=ref_id,
        chapters=chapters,
        origin="sugerida",
        check="pendiente",
        note=reading.motivo or None,
    )


def normalized_title(text: str) -> str:
    return _norm(text)
