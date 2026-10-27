"""Modelos del dominio. Son el espejo exacto de `frontend/src/lib/types.ts`.

Los nombres en Python van en snake_case y se serializan en camelCase con
`dump()`, que además omite los campos `None` (en TypeScript son opcionales `?:`).
"""

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

EbookStatus = Literal[
    "investigando",
    "indice_pendiente",
    "redactando_cap1",
    "cap1_pendiente",
    "redactando",
    "maquetando",
    "listo",
    "error",
]
Sensitivity = Literal["financiero", "salud_emocional", "salud_fisica", "autoayuda_general", "ninguno"]
SENSITIVITIES: tuple[str, ...] = ("financiero", "salud_emocional", "salud_fisica", "autoayuda_general", "ninguno")
AgentId = Literal["investigador", "redactor", "ejercicios", "maquetador"]
SectionId = Literal["introduccion", "desarrollo", "ejemplos", "conclusion"]
SECTION_ORDER: tuple[str, ...] = ("introduccion", "desarrollo", "ejemplos", "conclusion")
SECTION_LABELS: dict[str, str] = {
    "introduccion": "Introducción",
    "desarrollo": "Desarrollo",
    "ejemplos": "Ejemplos cotidianos",
    "conclusion": "Conclusión",
}
ChapterStatus = Literal["pendiente", "generando", "generado", "aprobado", "editado", "error"]
ExercisePref = Literal["auto", "checklist", "reto"]
CoverTemplate = Literal["clasica", "centrada", "franja", "marco", "editorial"]
BookFont = Literal["Roboto", "Arial", "Helvetica"]
PageSize = Literal["A5", "A4", "Carta", "6x9"]
TitleFont = Literal["Lexend", "Onest", "Roboto"]
TitleSize = Literal["s", "m", "l"]
TitleAlign = Literal["start", "center"]
ReferenceKind = Literal["libro", "articulo", "web"]
ReferenceCheck = Literal["verificada", "no_encontrada", "pendiente", "sin_verificar"]
ChapterAdjustChip = Literal["mas_cercano", "mas_ejemplos", "mas_corto", "menos_formal", "otro_ejercicio"]
ADJUST_CHIP_LABELS: dict[str, str] = {
    "mas_cercano": "Más cercano",
    "mas_ejemplos": "Más ejemplos",
    "mas_corto": "Más corto",
    "menos_formal": "Menos formal",
    "otro_ejercicio": "Otro tipo de ejercicio",
}

MIN_CHAPTERS = 5
MAX_CHAPTERS = 7


class CamelModel(BaseModel):
    """Base con alias camelCase: acepta ambos nombres al validar."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        validate_by_name=True,
        validate_by_alias=True,
        serialize_by_alias=True,
        extra="ignore",
    )

    def dump(self) -> dict[str, Any]:
        """JSON tal y como lo espera el frontend."""
        return self.model_dump(mode="json", by_alias=True, exclude_none=True)


# ---------- Capítulos y ejercicios ----------


class Sections(CamelModel):
    introduccion: str = ""
    desarrollo: str = ""
    ejemplos: str = ""
    conclusion: str = ""


class ChecklistExercise(CamelModel):
    type: Literal["checklist"] = "checklist"
    title: str
    items: list[str]


class ChallengeExercise(CamelModel):
    type: Literal["reto"] = "reto"
    title: str
    duration: Literal["24h", "48h"]
    steps: list[str]


Exercise = Annotated[ChecklistExercise | ChallengeExercise, Field(discriminator="type")]


class OutlineItem(CamelModel):
    id: str
    title: str
    summary: str
    key_points: list[str] = Field(default_factory=list)


class Chapter(OutlineItem):
    number: int
    status: ChapterStatus = "pendiente"
    sections: Sections | None = None
    exercise: Exercise | None = None
    current_section: Literal["introduccion", "desarrollo", "ejemplos", "conclusion", "ejercicio"] | None = None


class ChapterContent(CamelModel):
    sections: Sections
    exercise: Exercise | None = None


# ---------- Diseño ----------


class CoverImage(CamelModel):
    src: str
    placement: Literal["fondo", "recuadro"] = "fondo"
    veil: float = 0.55
    min_veil: float = 0.0
    focus_y: float = 50.0
    alt: str = ""
    # Color medio de las zonas más claras (RGB). Lo pone el servidor, que es quien manda, para
    # que el panel mida el contraste con los mismos números que el velo mínimo.
    bright: list[float] | None = None


class BackCover(CamelModel):
    enabled: bool = True
    blurb: str = ""


class EbookDesign(CamelModel):
    cover_template: CoverTemplate = "clasica"
    cloth_color: str = "#1E5E73"
    title_font: TitleFont = "Lexend"
    title_size: TitleSize = "m"
    title_align: TitleAlign = "start"
    cover_image: CoverImage | None = None
    back_cover: BackCover = Field(default_factory=BackCover)
    font: BookFont = "Roboto"
    body_size_pt: Literal[11, 12, 13] = 11
    page_size: PageSize = "A5"
    author: str = ""


# ---------- Referencias ----------


class ReferenceData(CamelModel):
    kind: ReferenceKind = "libro"
    authors: list[str] = Field(default_factory=list)
    year: str = "s. f."
    title: str
    publisher: str | None = None
    edition: str | None = None
    journal: str | None = None
    volume: str | None = None
    issue: str | None = None
    pages: str | None = None
    doi: str | None = None
    isbn: str | None = None
    url: str | None = None


BIBLIO_FIELDS: tuple[str, ...] = (
    "kind",
    "authors",
    "year",
    "title",
    "publisher",
    "edition",
    "journal",
    "volume",
    "issue",
    "pages",
    "doi",
    "isbn",
    "url",
)


class ReferenceMatch(CamelModel):
    """Partial<ReferenceData>: solo los campos de la fuente que difieren de lo guardado."""

    kind: ReferenceKind | None = None
    authors: list[str] | None = None
    year: str | None = None
    title: str | None = None
    publisher: str | None = None
    edition: str | None = None
    journal: str | None = None
    volume: str | None = None
    issue: str | None = None
    pages: str | None = None
    doi: str | None = None
    isbn: str | None = None
    url: str | None = None


class Reference(ReferenceData):
    id: str
    chapters: list[int] = Field(default_factory=list)
    origin: Literal["sugerida", "usuario"] = "usuario"
    check: ReferenceCheck = "pendiente"
    checked_with: Literal["crossref", "openlibrary"] | None = None
    match: ReferenceMatch | None = None
    note: str | None = None


class ReferenceCandidate(ReferenceData):
    source: Literal["crossref", "openlibrary"]


# ---------- Ebook ----------


class ActivityEntry(CamelModel):
    id: str
    agent: AgentId
    message: str
    state: Literal["hecho", "trabajando"] = "hecho"


class BusyState(CamelModel):
    kind: Literal["indice", "capitulo_indice", "capitulo1"]
    chapter_id: str | None = None
    message: str


class EbookError(CamelModel):
    message: str
    chapter: int | None = None
    retryable: bool = True
    resume_status: EbookStatus = "investigando"
    alternatives: list[str] | None = None


class Ebook(CamelModel):
    id: str
    title: str = "Tu nuevo ebook"
    subtitle: str = ""
    prompt: str
    niche_id: str = "general"
    audience: str = ""
    desired_chapters: Literal[5, 6, 7, "auto"] = "auto"
    exercise_pref: ExercisePref = "auto"
    status: EbookStatus = "investigando"
    sensitivity: Sensitivity = "autoayuda_general"
    chapters: list[Chapter] = Field(default_factory=list)
    outline_history: list[list[OutlineItem]] = Field(default_factory=list)
    chapter_one_history: list[ChapterContent] = Field(default_factory=list)
    chapter_one_version: int = 0
    design: EbookDesign = Field(default_factory=EbookDesign)
    references: list[Reference] = Field(default_factory=list)
    references_state: Literal["pendiente", "sugiriendo", "listo", "error"] = "pendiente"
    activity: list[ActivityEntry] = Field(default_factory=list)
    busy: BusyState | None = None
    error: EbookError | None = None
    created_at: str
    updated_at: str
    # Revisión: sube con cada cambio y cada token (el cliente descarta instantáneas anteriores).
    rev: int = 0

    def chapter(self, number: int) -> Chapter | None:
        return next((c for c in self.chapters if c.number == number), None)


class User(CamelModel):
    id: str
    name: str
    email: str
