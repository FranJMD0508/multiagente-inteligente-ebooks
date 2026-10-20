"""Estado mínimo del grafo. El contenido del ebook vive en el store, no aquí."""

from __future__ import annotations

from typing import Any, TypedDict


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
