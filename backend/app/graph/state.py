"""Estado mínimo del grafo. El contenido del ebook vive en el store, no aquí."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, TypedDict

if TYPE_CHECKING:
    from ..models import Ebook, Sections


class GraphState(TypedDict, total=False):
    ebook_id: str
    # Por dónde entra el grafo: "inicio" | "indice" | "cap1" | "redactar" | "maquetar".
    entry: str
    # Acción de la última reanudación ("approve", "regenerate", "regenerate_item", "adjust") y sus parámetros.
    action: str | None
    params: dict[str, Any]
    # Resultado del guardarraíl.
    rejected: bool
    # Capítulo que acaba de escribir el Redactor y cuándo empezó (ms desde epoch).
    chapter: int | None
    chapter_started_ms: float | None
    # Si el ajuste del capítulo 1 falló y se restauró la versión anterior.
    skip_exercise: bool


ENTRY_NODES = {
    "inicio": "guardarrail",
    "indice": "marcar_indice",
    "cap1": "marcar_cap1",
    "redactar": "redactor",
    "maquetar": "maquetador",
}

WORKING_STATUSES = ("investigando", "redactando_cap1", "redactando", "maquetando")
PAUSE_STATUSES = ("indice_pendiente", "cap1_pendiente")


# Dato interno del ebook: la persona aprobó el capítulo 1 (RF-05). Solo con él se escribe el resto.
APPROVED_KEY = "chapterOneApproved"


def chapter_one_approved(ebook: Ebook, internal: dict[str, Any]) -> bool:
    """¿Aprobó la persona el capítulo 1? Lo dice el indicador explícito, que se guarda al
    aprobar; nunca se deduce de que el capítulo esté escrito. Los ebooks anteriores al
    indicador solo cuentan como aprobados si su estado lo garantiza (redacción del resto,
    maquetación o listo)."""
    flag = internal.get(APPROVED_KEY)
    if flag is not None:
        return bool(flag)
    if ebook.status in ("redactando", "maquetando", "listo"):
        return True
    return ebook.status == "error" and ebook.error is not None and ebook.error.resume_status in ("redactando", "maquetando")


def sections_complete(sections: Sections | None) -> bool:
    """Las cuatro secciones tienen texto."""
    return sections is not None and all(
        getattr(sections, s).strip() for s in ("introduccion", "desarrollo", "ejemplos", "conclusion")
    )


def entry_for_status(status: str) -> str:
    """Entrada del grafo para retomar un ebook según su estado."""
    return {
        "investigando": "inicio",
        "indice_pendiente": "indice",
        "redactando_cap1": "redactar",
        "cap1_pendiente": "cap1",
        "redactando": "redactar",
        "maquetando": "maquetar",
    }.get(status, "inicio")
