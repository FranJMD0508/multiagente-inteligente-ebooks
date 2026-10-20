"""Cambios sobre el ebook que comparten la API y el orquestador (mismas reglas que `api/index.ts`).

Todas son funciones síncronas pensadas para `store.update(id, fn)`.
"""

from __future__ import annotations

from ..models import Chapter, ChapterContent, Ebook, OutlineItem


def to_chapters(items: list[OutlineItem] | list[Chapter]) -> list[Chapter]:
    """Índice → capítulos pendientes, numerados desde 1."""
    return [
        Chapter(id=item.id, title=item.title, summary=item.summary, key_points=list(item.key_points), number=i + 1, status="pendiente")
        for i, item in enumerate(items)
    ]


def outline_snapshot(e: Ebook) -> list[OutlineItem]:
    return [OutlineItem(id=c.id, title=c.title, summary=c.summary, key_points=list(c.key_points)) for c in e.chapters]


def renumber(chapters: list[Chapter]) -> list[Chapter]:
    for i, chapter in enumerate(chapters):
        chapter.number = i + 1
    return chapters


def restore_previous_outline(e: Ebook) -> None:
    """Vuelve a la versión anterior del índice (api.restorePreviousOutline)."""
    if not e.outline_history:
        return
    previous = e.outline_history.pop()
    e.chapters = to_chapters(previous)


def restore_previous_chapter_one(e: Ebook) -> None:
    """Vuelve a la versión anterior del capítulo 1 (api.restorePreviousChapterOne)."""
    if not e.chapter_one_history or not e.chapters:
        return
    previous = e.chapter_one_history.pop()
    e.chapter_one_version = max(1, e.chapter_one_version - 1)
    first = e.chapters[0]
    first.sections = previous.sections
    first.exercise = previous.exercise


def undo_chapter_one_adjustment(e: Ebook) -> None:
    """Cancela un ajuste en curso del capítulo 1 (api.cancelBusy / simulator.resume)."""
    if e.chapters:
        first = e.chapters[0]
        if e.chapter_one_history:
            previous = e.chapter_one_history.pop()
            first.sections = previous.sections
            first.exercise = previous.exercise
        first.status = "generado"
        first.current_section = None
    e.busy = None


def push_chapter_one_history(e: Ebook) -> None:
    first = e.chapters[0]
    if first.sections is not None:
        e.chapter_one_history.append(ChapterContent(sections=first.sections.model_copy(), exercise=first.exercise))


def reset_generating_chapters(e: Ebook) -> None:
    """Al retomar tras un reinicio, los capítulos a medias vuelven a pendiente."""
    for chapter in e.chapters:
        if chapter.status == "generando":
            chapter.status = "pendiente"
            chapter.sections = None
            chapter.exercise = None
            chapter.current_section = None
