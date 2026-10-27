"""Agente Redactor: escribe cada capítulo en streaming (RF-03, RNF-01, RNF-03) y extrae la guía de estilo."""

from __future__ import annotations

import re
import unicodedata
import zlib
from collections.abc import AsyncIterator
from dataclasses import dataclass, field

from pydantic import BaseModel, Field

from ..guardrails import SENSITIVITY_LABELS
from ..llm import LLMProvider
from ..models import ADJUST_CHIP_LABELS, SECTION_LABELS, SECTION_ORDER, Ebook, Sections
from ..prompts import prompts
from .common import Text, ask_json, bullet_list, outline_text

# ---------- Personas para los ejemplos (RÉR-03) ----------
# Alternan mujer y hombre, con edades, familias, orígenes y trabajos variados que
# no siguen estereotipos. El paso impar entre capítulos garantiza que capítulos
# seguidos no repitan género ni persona.
PEOPLE: list[dict] = [
    {"nombre": "Daniela", "edad": 22, "contexto": "estudia de noche y trabaja en una cafetería"},
    {"nombre": "Mateo", "edad": 20, "contexto": "cobra una beca y hace diseños por encargo los fines de semana"},
    {"nombre": "Valentina", "edad": 21, "contexto": "estudia Ingeniería Mecánica y juega en el equipo de fútbol de la universidad"},
    {"nombre": "José", "edad": 24, "contexto": "estudia Enfermería y hace entregas en bicicleta los fines de semana"},
    {"nombre": "Camila", "edad": 23, "contexto": "comparte piso con dos amigas y estudia Economía"},
    {"nombre": "Andrés", "edad": 26, "contexto": "acaba de empezar su primer empleo en una oficina contable"},
    {"nombre": "Lucía", "edad": 34, "contexto": "estudia a distancia desde un pueblo pequeño mientras cría a su hijo"},
    {"nombre": "Samuel", "edad": 19, "contexto": "vive con su abuela y la acompaña a sus citas médicas"},
    {"nombre": "Mariana", "edad": 18, "contexto": "es la primera de su familia en ir a la universidad"},
    {"nombre": "Tomás", "edad": 38, "contexto": "volvió a estudiar después de unos años trabajando en la construcción"},
    {"nombre": "Sofía", "edad": 29, "contexto": "trabaja medio tiempo en un taller de reparación de celulares"},
    {"nombre": "Diego", "edad": 25, "contexto": "estudia Derecho y cuida a su hermano menor por las tardes"},
    {"nombre": "Rosa", "edad": 52, "contexto": "es enfermera del turno de noche y está aprendiendo a programar"},
    {"nombre": "Kevin", "edad": 31, "contexto": "cría a sus dos hijas y trabaja como recepcionista en un hotel"},
    {"nombre": "Aisha", "edad": 27, "contexto": "llegó al país hace dos años y trabaja en un almacén de logística"},
    {"nombre": "Julián", "edad": 45, "contexto": "es maestro de primaria y se mueve en silla de ruedas"},
    {"nombre": "Yesenia", "edad": 36, "contexto": "maneja un camión de reparto y estudia Contabilidad los sábados"},
    {"nombre": "Luis", "edad": 61, "contexto": "se jubiló hace poco y quiere ordenar sus finanzas"},
]


def people_for(ebook_id: str, number: int, *, extra: bool = False) -> list[dict]:
    """Dos personas sugeridas (de géneros distintos) para el capítulo `number`."""
    seed = zlib.crc32(ebook_id.encode("utf-8"))
    base = seed + number * 5
    picked = [PEOPLE[base % len(PEOPLE)], PEOPLE[(base + 7) % len(PEOPLE)]]
    if extra:
        picked.append(PEOPLE[(base + 12) % len(PEOPLE)])
    return picked


# ---------- Construcción del prompt ----------


def _chapter_text(sections: Sections | None) -> str:
    if sections is None:
        return ""
    return "\n\n".join(f"## {SECTION_LABELS[s]}\n\n{getattr(sections, s).strip()}" for s in SECTION_ORDER)


def _first_sentences(text: str, limit: int = 450) -> str:
    plain = re.sub(r"\s+", " ", re.sub(r"[#>*_-]+", " ", text)).strip()
    return plain if len(plain) <= limit else plain[:limit].rsplit(" ", 1)[0] + "…"


@dataclass
class ChapterRequest:
    """Todo lo que el Redactor necesita para escribir el capítulo `number`."""

    ebook: Ebook
    number: int
    brief: dict | None = None
    style_guide: dict | None = None
    adjustments: list[str] = field(default_factory=list)
    note: str = ""
    previous_version: Sections | None = None
    version: int = 1

    def render(self) -> tuple[str, str, float, int, dict]:
        ebook = self.ebook
        chapter = ebook.chapter(self.number)
        assert chapter is not None
        total = len(ebook.chapters)
        if self.number == 1:
            position = "primer capítulo: presenta el tema del libro y engancha a quien lee"
        elif self.number == total:
            position = "último capítulo: cierra el libro y ayuda a mirar hacia delante"
        else:
            position = f"capítulo intermedio; el siguiente es «{ebook.chapters[self.number].title}»"

        brief = self.brief or {}
        brief_text = "\n".join(
            filter(
                None,
                [
                    f"Conceptos: {', '.join(brief.get('conceptos', []))}" if brief.get("conceptos") else "",
                    f"Términos que se usan siempre igual: {', '.join(brief.get('terminos', []))}" if brief.get("terminos") else "",
                    f"Enfoque: {brief.get('enfoque')}" if brief.get("enfoque") else "",
                ],
            )
        ) or "No hay brief: apóyate en el índice."

        guide = self.style_guide or {}
        if guide:
            glossary = "; ".join(f"{g.get('termino')}: {g.get('definicion')}" for g in guide.get("glosario", []) if g.get("termino"))
            guide_text = "\n".join(
                filter(
                    None,
                    [
                        f"Persona: {guide.get('persona', '')}",
                        f"Registro: {guide.get('registro', '')}",
                        f"Glosario: {glossary}" if glossary else "",
                        "Reglas:\n" + bullet_list(guide.get("reglas", [])) if guide.get("reglas") else "",
                    ],
                )
            )
        else:
            guide_text = "Todavía no hay guía de estilo: sigue las reglas generales."

        if self.number >= 2 and ebook.chapters[0].sections is not None:
            reference = _chapter_text(ebook.chapters[0].sections)
        else:
            reference = "No aplica: estás escribiendo el capítulo 1, que servirá de referencia para el resto."

        previous_parts = []
        for prev in ebook.chapters[1 : self.number - 1]:
            if prev.sections is None:
                continue
            previous_parts.append(
                f"Capítulo {prev.number}: {prev.title}\nResumen: {prev.summary}\n"
                f"Conclusión: {_first_sentences(prev.sections.conclusion)}\n"
                f"Ejemplos usados: {_first_sentences(prev.sections.ejemplos, 220)}"
            )
        previous = "\n\n".join(previous_parts) or (
            "No aplica." if self.number <= 2 else "Los capítulos anteriores aún no tienen texto."
        )

        people = people_for(ebook.id, self.number, extra="mas_ejemplos" in self.adjustments)
        people_text = "\n".join(f"- {p['nombre']}, {p['edad']} años, {p['contexto']}." for p in people)

        if ebook.sensitivity != "ninguno":
            sensitive = (
                f"Sí: el tema es {SENSITIVITY_LABELS.get(ebook.sensitivity, ebook.sensitivity)}. Tu texto es educativo e informativo: "
                "no des diagnósticos, tratamientos ni consejos médicos, psicológicos o financieros prescriptivos, no recomiendes "
                "productos financieros concretos y no prometas resultados. Cuando un problema lo requiera, sugiere con naturalidad "
                "buscar a un profesional (psicología, medicina, finanzas o derecho). El libro ya incluye un aviso legal."
            )
        else:
            sensitive = "No es un tema sensible. Aun así, no prometas resultados garantizados."

        if self.adjustments or self.note.strip() or self.previous_version is not None:
            chips = [ADJUST_CHIP_LABELS[c] for c in self.adjustments if c in ADJUST_CHIP_LABELS and c != "otro_ejercicio"]
            parts = []
            if chips:
                parts.append("Cambios rápidos: " + ", ".join(chips) + ".")
            if "mas_corto" in self.adjustments:
                parts.append("Más corto significa unas 550-750 palabras en total, sin perder ninguna sección.")
            if "mas_ejemplos" in self.adjustments:
                parts.append("Más ejemplos significa dos o tres situaciones distintas en «Ejemplos cotidianos».")
            if self.note.strip():
                parts.append(f'Comentario de la persona: "{self.note.strip()}"')
            if self.previous_version is not None:
                parts.append(
                    "Esta es la versión anterior del capítulo. Reescríbela aplicando los ajustes y conserva lo que ya funcionaba:\n"
                    + _chapter_text(self.previous_version)
                )
            adjustments = "\n".join(parts) or "Ninguno."
        else:
            adjustments = "Ninguno."

        template = prompts.get("redactor/capitulo")
        system, user = template.render(
            titulo_libro=ebook.title,
            subtitulo=ebook.subtitle or "(sin subtítulo)",
            publico=ebook.audience,
            indice=outline_text(ebook.chapters),
            numero=self.number,
            total=total,
            titulo_capitulo=chapter.title,
            resumen=chapter.summary,
            puntos_clave=bullet_list(chapter.key_points),
            posicion=position,
            brief=brief_text,
            guia_estilo=guide_text,
            capitulo_referencia=reference,
            capitulos_previos=previous,
            personas=people_text,
            aviso_sensible=sensitive,
            ajustes=adjustments,
        )
        context = {
            "ebook_id": ebook.id,
            "niche_id": ebook.niche_id,
            "number": self.number,
            "total": total,
            "item": {"title": chapter.title, "summary": chapter.summary, "keyPoints": chapter.key_points},
            "adjustments": list(self.adjustments),
            "note": self.note,
            "version": self.version,
            "people": people,
        }
        return system, user, template.temperature, template.max_tokens, context


def stream_chapter(llm: LLMProvider, request: ChapterRequest) -> AsyncIterator[str]:
    system, user, temperature, max_tokens, context = request.render()
    return llm.stream_text("redactor.capitulo", system, user, temperature=temperature, max_tokens=max_tokens, context=context)


# ---------- Reparto del stream en secciones ----------


def _fold(text: str) -> str:
    text = unicodedata.normalize("NFD", text.lower())
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", " ", text)).strip()


SECTION_ALIASES: dict[str, str] = {
    "introduccion": "introduccion",
    "desarrollo": "desarrollo",
    "ejemplos cotidianos": "ejemplos",
    "ejemplos": "ejemplos",
    "ejemplos de la vida diaria": "ejemplos",
    "conclusion": "conclusion",
    "conclusiones": "conclusion",
}
_HEADING_RE = re.compile(r"^\s{0,3}(#{1,6})\s*(.*?)\s*#*\s*$")
_RULE_RE = re.compile(r"^\s*([-*_])(\s*\1){2,}\s*$")


_LIVE_HEADING_RE = re.compile(r"^ {0,3}(?:#{1,2}|#{4,6})[ \t]+", re.M)


def live_markdown(text: str) -> str:
    """Normalización mientras se edita: solo convierte `#`, `##` y `####…` seguidos de espacio
    en `###` (igual que el editor del frontend), sin recortar espacios ni líneas. Así el
    texto que devuelve el servidor coincide con el que tiene la persona en pantalla. La
    limpieza completa (`normalize_markdown`) se aplica al exportar."""
    return _LIVE_HEADING_RE.sub("### ", text.replace("\r\n", "\n"))


def normalize_markdown(text: str) -> str:
    """RA-01: dentro de una sección solo hay H3. `#`, `##` y `####…` pasan a `###`."""
    lines = []
    for line in text.replace("\r\n", "\n").split("\n"):
        if _RULE_RE.match(line) or re.match(r"^\s*=+\s*$", line):
            continue  # separadores y subrayados de encabezado (evitan H1/H2 escondidos)
        if re.match(r"^\s{0,3}#{1,6}\s*$", line):
            lines.append("")  # un "#" o "##" solo sería un encabezado vacío (RA-01)
            continue
        m = re.match(r"^\s{0,3}#{1,6}\s+(\S.*?)\s*#*\s*$", line)
        if m:
            lines.append(f"### {m.group(1)}")
        else:
            lines.append(line)
    out = "\n".join(lines)
    return re.sub(r"\n{3,}", "\n\n", out).strip()


@dataclass
class ParserEvent:
    kind: str  # "section" | "text"
    section: str
    text: str = ""


MIN_SECTION_WORDS = 8
_NUMBER_PREFIX_RE = re.compile(r"^\d+ ")  # "## 1. Introducción" → "introduccion" tras `_fold`
_NOT_A_LABEL_RE = re.compile(r"^\s*(?:[-+>]|\*\s)")  # elementos de lista y citas


def _section_label(text: str) -> str:
    """Etiqueta normalizada de un posible encabezado de sección (sin tildes, signos ni numeración)."""
    return _NUMBER_PREFIX_RE.sub("", _fold(text))


_LABEL_PREFIXES = tuple(SECTION_ALIASES) + ("ejercicio",)


class ChapterStreamParser:
    """Reparte el texto del LLM entre las cuatro secciones mientras llega.

    Cambia de sección con un encabezado `#` o `##` que nombre una de las cuatro
    (`## Introducción|Desarrollo|Ejemplos cotidianos|Conclusión`, con o sin tildes,
    numeración ni dos puntos, y en cualquier caso) y solo hacia delante en ese orden. Si
    el capítulo usa ese estilo, un `### Ejemplos`, un `**Ejemplos:**` o la palabra
    "Conclusión" sola en su línea son texto de la sección en curso. Si el modelo marca las
    secciones de otra forma (`### Desarrollo`, `**Desarrollo**` o la etiqueta sola en su
    línea) y todavía no ha usado ningún `#`/`##` de sección, esas líneas también cambian
    de sección (siempre hacia delante), para no dar por incompleto un capítulo bien escrito. Si un encabezado repite una sección ya empezada, se descarta y lo que
    sigue se une a la sección en curso como un párrafo nuevo. Cualquier otro
    encabezado se convierte en `###`; si aparece un "Ejercicio", lo que sigue se
    ignora. Retiene el final del búfer cuando podría ser un encabezado a medio llegar.
    """

    def __init__(self) -> None:
        self.current: str | None = None
        self.sections: dict[str, str] = {s: "" for s in SECTION_ORDER}
        self._buffer = ""
        self._at_line_start = True
        self._pending = ""  # saltos de línea retenidos (no se emiten al final de una sección)
        self._hash_style = False  # el modelo ya marcó una sección con `#`/`##`
        self.stopped = False

    # ----- interfaz -----

    def feed(self, chunk: str) -> list[ParserEvent]:
        if self.stopped:
            return []
        self._buffer += chunk.replace("\r\n", "\n").replace("\r", "\n")
        return self._drain(final=False)

    def finish(self) -> list[ParserEvent]:
        if self.stopped:
            return []
        return self._drain(final=True)

    def result(self) -> Sections:
        return Sections(**{s: normalize_markdown(t) for s, t in self.sections.items()})

    def missing(self) -> list[str]:
        """Secciones vacías o casi vacías al terminar (validación de RF-03).

        Un capítulo cortado por el límite de tokens o por la conexión no llega aquí: los
        proveedores lo avisan con un `LLMError` (motivo de fin `MAX_TOKENS`, `length`,
        `max_tokens` o ninguno)."""
        return [s for s, t in self.sections.items() if len(re.findall(r"\w+", t)) < MIN_SECTION_WORDS]

    # ----- internos -----

    def _drain(self, *, final: bool) -> list[ParserEvent]:
        events: list[ParserEvent] = []
        while not self.stopped:
            nl = self._buffer.find("\n")
            if nl == -1:
                break
            line, self._buffer = self._buffer[:nl], self._buffer[nl + 1 :]
            self._line(line, events)
        if self.stopped:
            self._buffer = ""
            return events
        if self._buffer:
            if final:
                line, self._buffer = self._buffer, ""
                self._line(line, events, newline=False)
            elif not self._at_line_start:
                self._text(self._buffer, events)
                self._buffer = ""
            elif not self._could_be_heading(self._buffer):
                self._text_line_start(self._buffer, events)
                self._buffer = ""
                self._at_line_start = False
        return events

    def _could_be_heading(self, partial: str) -> bool:
        # Una línea que empieza por "#" puede cambiar de sección o cerrar el capítulo; sin el
        # estilo `##`, también la que todavía podría ser una etiqueta ("**Desa", "Conclu").
        s = partial.lstrip()
        if not s or s[0] == "#":
            return True
        if self._hash_style or _NOT_A_LABEL_RE.match(partial):
            return False
        folded = _section_label(s)
        return not folded or folded.startswith("ejercicio") or any(label.startswith(folded) for label in _LABEL_PREFIXES)

    def _fallback_section(self, line: str) -> tuple[str | None, bool]:
        """(sección, es_parada) para `### Desarrollo`, `**Desarrollo**` o "Desarrollo" sola en su
        línea, solo si el capítulo no usa `##` para las secciones y solo hacia delante."""
        if self._hash_style or _NOT_A_LABEL_RE.match(line) or not line.strip():
            return None, False
        heading = _HEADING_RE.match(line)
        if heading and len(heading.group(1)) <= 2:
            return None, False
        label = _section_label(heading.group(2) if heading else line)
        section = SECTION_ALIASES.get(label)
        if section is not None:
            if self.current is None or SECTION_ORDER.index(section) > SECTION_ORDER.index(self.current):
                return section, False
            return None, False
        if self.current == "conclusion" and label.startswith("ejercicio"):
            return None, True
        return None, False

    def _section_from(self, line: str) -> tuple[str | None, bool, str | None]:
        """(sección, es_parada, texto_de_otro_encabezado) para una línea completa.

        `texto_de_otro_encabezado` es "" si la línea es un encabezado vacío (se descarta).
        """
        heading = _HEADING_RE.match(line)
        if not heading:
            return None, False, None
        level = len(heading.group(1))
        label = heading.group(2)
        folded = _section_label(label)
        # Encabezado de sección: solo de nivel 1 o 2 ("## Desarrollo"; un "### Ejemplos" es un subtítulo).
        if level <= 2 and folded in SECTION_ALIASES:
            return SECTION_ALIASES[folded], False, None
        # "## Ejercicio práctico" (o un reto/checklist de nivel 1-2 tras la conclusión): fin del capítulo.
        if level <= 2 and self.current is not None:
            if folded.startswith("ejercicio") or (
                self.current == "conclusion" and re.match(r"^(reto de|checklist)", folded)
            ):
                return None, True, None
        if label and not line.lstrip()[level:level + 1].isspace():
            return None, False, None  # "#motivación": sin espacio no es un encabezado
        return None, False, label.strip()

    def _line(self, line: str, events: list[ParserEvent], newline: bool = True) -> None:
        if not self._at_line_start:
            # El principio de esta línea ya se emitió: el resto es texto normal.
            self._text(line + ("\n" if newline else ""), events)
            self._at_line_start = True
            return
        section, stop, other_heading = self._section_from(line)
        if section is not None:
            self._hash_style = True
        elif not stop:
            fallback, stop = self._fallback_section(line)
            if fallback is not None:
                section, other_heading = fallback, None
        if stop:
            self.stopped = True
            return
        if section is not None:
            if self.current is None or SECTION_ORDER.index(section) > SECTION_ORDER.index(self.current):
                self.current = section
                self._pending = ""
                events.append(ParserEvent("section", section))
            elif self.sections[self.current]:
                # Repite una sección ya empezada: no se vuelve atrás; lo que sigue es un párrafo nuevo.
                self._pending = "\n\n"
            return
        if _RULE_RE.match(line):
            return  # separadores "---": no forman parte del texto
        if other_heading is not None:
            if self.current is None or not other_heading:
                return  # el título del capítulo antes de la introducción, o un "#" vacío
            self._text(f"### {other_heading}" + ("\n" if newline else ""), events)
            return
        self._text_line_start(line + ("\n" if newline else ""), events)

    def _text_line_start(self, text: str, events: list[ParserEvent]) -> None:
        if self.current is None:
            if not text.strip():
                return
            # Texto antes del primer encabezado: se asume que es la introducción.
            self.current = "introduccion"
            events.append(ParserEvent("section", "introduccion"))
        self._text(text, events)

    def _text(self, text: str, events: list[ParserEvent]) -> None:
        if self.current is None:
            return
        section = self.current
        if not self.sections[section]:
            text = text.lstrip()
            if not text:
                return
        full = self._pending + text
        stripped = full.rstrip("\n")
        self._pending = full[len(stripped) :]
        if stripped:
            self.sections[section] += stripped
            events.append(ParserEvent("text", section, stripped))


# ---------- Guía de estilo ----------


class GlossaryEntry(BaseModel):
    termino: Text
    definicion: Text = ""


class StyleGuideOut(BaseModel):
    persona: Text = ""
    registro: Text = ""
    glosario: list[GlossaryEntry] = Field(default_factory=list)
    reglas: list[Text] = Field(default_factory=list)


async def extract_style_guide(llm: LLMProvider, ebook: Ebook, brief: dict | None) -> StyleGuideOut:
    first = ebook.chapters[0]
    values = {
        "titulo_libro": ebook.title,
        "publico": ebook.audience,
        "capitulo_1": _chapter_text(first.sections),
    }
    context = {"title": ebook.title, "terms": (brief or {}).get("terminos", [])}
    return await ask_json(llm, "redactor/guia_estilo", "redactor.guia_estilo", StyleGuideOut, values, context)
