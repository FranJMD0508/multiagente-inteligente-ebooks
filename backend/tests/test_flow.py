"""Flujo completo por la API: índice → pausa → capítulo 1 → pausa → resto → listo → exportar."""

from __future__ import annotations

import re

import pytest

from app.agents.ejercicios import validate_exercise
from app.export.pdf import struct_tags
from app.models import ChallengeExercise, ChecklistExercise

from .conftest import IDEA_FINANZAS, wait_idle, wait_references, wait_status

SECTIONS = ("introduccion", "desarrollo", "ejemplos", "conclusion")


def messages(ebook) -> list[str]:
    return [a.message for a in ebook.activity]


def heading_levels(markdown: str) -> list[int]:
    levels = []
    in_comment = False
    for line in markdown.splitlines():
        if line.startswith("<!--"):
            in_comment = True
        if in_comment:
            in_comment = "-->" not in line
            continue
        match = re.match(r"^(#{1,6}) ", line)
        if match:
            levels.append(len(match.group(1)))
    return levels


async def test_flujo_completo(client, auth, services):
    # ----- crear -----
    res = await client.post(
        "/api/ebooks",
        json={"prompt": IDEA_FINANZAS, "desiredChapters": 6, "exercisePref": "auto", "author": "Ana Pérez"},
        headers=auth,
    )
    assert res.status_code == 201, res.text
    created = res.json()
    eid = created["id"]
    assert created["status"] == "investigando"
    assert created["design"]["titleFont"] == "Lexend" and created["design"]["backCover"] == {"enabled": True, "blurb": ""}
    assert created["references"] == [] and created["referencesState"] == "pendiente"

    # ----- punto de control 1: índice -----
    await wait_status(services, eid, "indice_pendiente")
    ebook = services.store.get(eid)
    assert len(ebook.chapters) == 6
    assert all(len(c.key_points) == 3 for c in ebook.chapters)
    assert [c.number for c in ebook.chapters] == [1, 2, 3, 4, 5, 6]
    assert ebook.sensitivity == "financiero"
    log = messages(ebook)
    assert log[0] == "Tema válido: finanzas para universitarios"
    assert log[1].startswith("Público: estudiantes")
    assert "Tema sensible: se incluirá un aviso legal" in log
    assert log[-1] == "Índice propuesto: 6 capítulos"
    assert ebook.title == "Ahorra sin dejar de vivir"

    # Editar el índice: se renumera; con 4 capítulos se rechaza.
    chapters = [{"id": c.id, "title": c.title, "summary": c.summary, "keyPoints": c.key_points} for c in ebook.chapters]
    chapters[1]["title"] = "Gastos hormiga, sin culpas"
    edited = chapters[:5]
    res = await client.put(f"/api/ebooks/{eid}/outline", json={"chapters": edited}, headers=auth)
    assert res.status_code == 200, res.text
    body = res.json()
    assert len(body["chapters"]) == 5 and body["chapters"][1]["title"] == "Gastos hormiga, sin culpas"
    assert [c["number"] for c in body["chapters"]] == [1, 2, 3, 4, 5]
    res = await client.put(f"/api/ebooks/{eid}/outline", json={"chapters": edited[:4]}, headers=auth)
    assert res.status_code == 422 and res.json()["detail"]["code"] == "capitulos"
    before_regen = [c["title"] for c in body["chapters"]]

    # Regenerar con comentario.
    res = await client.post(f"/api/ebooks/{eid}/outline/regenerate", json={"feedback": "más práctico"}, headers=auth)
    assert res.status_code == 202
    assert res.json()["busy"]["kind"] == "indice"
    await wait_idle(services, eid)
    ebook = services.store.get(eid)
    assert ebook.status == "indice_pendiente"
    assert len(ebook.outline_history) == 1
    assert "Nueva versión del índice lista" in messages(ebook)
    regenerated = [c.title for c in ebook.chapters]

    # Cancelar una regeneración en curso: vuelve la versión anterior.
    services.llm.delay_ms = 80  # el demo tarda ~0,8 s en el JSON
    res = await client.post(f"/api/ebooks/{eid}/outline/regenerate", json={"feedback": "otro enfoque"}, headers=auth)
    assert res.status_code == 202
    res = await client.post(f"/api/ebooks/{eid}/cancel", headers=auth)
    assert res.status_code == 200
    services.llm.delay_ms = 0
    ebook = services.store.get(eid)
    assert ebook.busy is None
    assert [c.title for c in ebook.chapters] == regenerated
    assert len(ebook.outline_history) == 1
    assert await services.runner.paused_at(eid) == "outline"
    assert all(a.state == "hecho" for a in ebook.activity)

    # Volver a la versión anterior del índice.
    res = await client.post(f"/api/ebooks/{eid}/outline/restore", headers=auth)
    assert [c["title"] for c in res.json()["chapters"]] == before_regen
    assert res.json()["outlineHistory"] == []

    # ----- aprobar el índice → capítulo 1 -----
    res = await client.post(f"/api/ebooks/{eid}/outline/approve", headers=auth)
    assert res.status_code == 202
    assert res.json()["status"] == "redactando_cap1"
    await wait_status(services, eid, "cap1_pendiente")
    ebook = services.store.get(eid)
    first = ebook.chapters[0]
    assert all(getattr(first.sections, s).strip() for s in SECTIONS)
    assert isinstance(first.exercise, ChallengeExercise)  # capítulo impar → reto
    assert validate_exercise(first.exercise) == []
    assert ebook.chapter_one_version == 1
    assert all(c.status == "pendiente" for c in ebook.chapters[1:])
    assert "### " in first.sections.desarrollo
    assert "Ejercicio del capítulo 1 listo" in messages(ebook)

    # Lecturas recomendadas en segundo plano.
    await wait_references(services, eid)
    ebook = services.store.get(eid)
    assert ebook.references_state == "listo"
    assert ebook.references and all(r.origin == "sugerida" and r.note for r in ebook.references)
    assert any(r.check == "verificada" for r in ebook.references)
    assert any(re.match(r"\d+ lecturas? sugeridas? · \d+ verificadas?", m) for m in messages(ebook))

    # ----- ajustes del capítulo 1 -----
    res = await client.post(
        f"/api/ebooks/{eid}/chapters/1/regenerate",
        json={"chips": ["mas_corto", "otro_ejercicio"], "note": "Con ejemplos de gente que estudia y trabaja"},
        headers=auth,
    )
    assert res.status_code == 202 and res.json()["busy"]["kind"] == "capitulo1"
    await wait_idle(services, eid)
    ebook = services.store.get(eid)
    assert ebook.status == "cap1_pendiente"
    assert ebook.chapter_one_version == 2
    assert len(ebook.chapter_one_history) == 1
    assert isinstance(ebook.chapters[0].exercise, ChecklistExercise)  # otro tipo de ejercicio

    res = await client.post(f"/api/ebooks/{eid}/chapters/1/restore", headers=auth)
    assert res.status_code == 200
    restored = res.json()
    assert restored["chapterOneVersion"] == 1 and restored["chapterOneHistory"] == []
    assert restored["chapters"][0]["exercise"]["type"] == "reto"

    # ----- aprobar el capítulo 1 → resto del libro -----
    res = await client.post(f"/api/ebooks/{eid}/chapters/1/approve", headers=auth)
    assert res.status_code == 202 and res.json()["status"] == "redactando"
    await wait_status(services, eid, "listo")
    ebook = services.store.get(eid)
    assert ebook.chapters[0].status == "aprobado"
    for chapter in ebook.chapters:
        assert all(getattr(chapter.sections, s).strip() for s in SECTIONS), chapter.number
        assert chapter.exercise is not None and validate_exercise(chapter.exercise) == []
        expected = ChallengeExercise if chapter.number % 2 == 1 else ChecklistExercise
        assert isinstance(chapter.exercise, expected)
    assert ebook.design.back_cover.blurb
    assert "Libro armado" in messages(ebook)
    assert "Tomando el capítulo 1 como referencia de tono" in messages(ebook)
    assert services.store.internal(eid).get("styleGuide")

    # Edición final: H1/H2 pasan a H3.
    res = await client.patch(
        f"/api/ebooks/{eid}/chapters/2",
        json={"section": "desarrollo", "text": "## Un subtítulo\n\nTexto nuevo del desarrollo."},
        headers=auth,
    )
    assert res.status_code == 200
    chapter2 = res.json()["chapters"][1]
    assert chapter2["status"] == "editado"
    assert chapter2["sections"]["desarrollo"].startswith("### Un subtítulo")

    # ----- exportar a Markdown -----
    res = await client.post(f"/api/ebooks/{eid}/exports", json={"format": "md"}, headers=auth)
    assert res.status_code == 200
    assert res.headers["content-disposition"].startswith("attachment;")
    assert "ahorra-sin-dejar-de-vivir.md" in res.headers["content-disposition"]
    md = res.text
    assert md.startswith("# Ahorra sin dejar de vivir\n")
    assert "## Aviso legal" in md and "> Este libro tiene fines educativos" in md
    assert "## Índice" in md
    levels = heading_levels(md)
    assert all(b <= a + 1 for a, b in zip(levels, levels[1:])), "la jerarquía de encabezados no debe saltar niveles"
    h1 = [line for line in md.splitlines() if line.startswith("# ")]
    assert sum(1 for line in h1 if line.startswith("# Capítulo ")) == len(ebook.chapters)
    assert "# Referencias" in h1 and "# Sobre este libro" in h1
    assert "*Contenido original generado con asistencia de IA.*" in md
    assert re.search(r"<!-- folio: generado-con-ia=true; herramienta=Folio; proveedor=demo; .*fecha=\d{4}-\d{2}-\d{2} -->", md)
    assert "- [ ] " in md and "1. " in md

    # ----- exportar a PDF (si hay navegador) -----
    if not await services.pdf.available():
        pytest.skip("No hay navegador para generar el PDF en esta máquina")
    res = await client.post(f"/api/ebooks/{eid}/exports", json={"format": "pdf", "filename": "Mi libro"}, headers=auth)
    assert res.status_code == 200, res.text
    assert res.headers["content-type"] == "application/pdf"
    assert 'filename="Mi libro.pdf"' in res.headers["content-disposition"]
    pdf = res.content
    assert pdf.startswith(b"%PDF")
    assert b"/StructTreeRoot" in pdf
    tags = struct_tags(pdf)
    assert {"/H1", "/H2", "/H3"} <= tags
    from io import BytesIO

    from pypdf import PdfReader

    meta = PdfReader(BytesIO(pdf)).metadata
    assert meta.title == "Ahorra sin dejar de vivir"
    assert meta["/Keywords"] == "generado con IA"
    assert meta["/Creator"] == "Folio (asistido por IA)"
