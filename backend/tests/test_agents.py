"""Agentes: reparto del stream en secciones (RF-03), ejercicios (RF-04), personas diversas (RÉR-03) y Markdown."""

from __future__ import annotations

import pytest

from app.agents.ejercicios import ExerciseOut, decide_type, to_exercise, validate_exercise
from app.agents.redactor import PEOPLE, ChapterStreamParser, normalize_markdown, people_for


def run_parser(text: str, chunk: int) -> ChapterStreamParser:
    parser = ChapterStreamParser()
    for i in range(0, len(text), chunk):
        parser.feed(text[i : i + chunk])
    parser.finish()
    return parser


CHAPTER = (
    "# Capítulo 2: Gastos hormiga\n\n"
    "## Introduccion\n\nTe pasa a menudo: llegas a fin de mes y no sabes dónde se fue el dinero de la semana.\n\n"
    "## DESARROLLO\n\n#### Anota lo pequeño\n\nApunta cada gasto durante siete días seguidos y sin juzgarte nada.\n\n- Café\n- Transporte\n\n"
    "> Lo que no se mide no se puede cambiar, así que empieza por mirar.\n\n"
    "**Ejemplos cotidianos**\n\nDaniela, de 22 años, estudia de noche y trabaja en una cafetería cerca de casa.\n\n"
    "## Conclusión:\n\nEmpieza hoy con una libreta pequeña y revisa tus notas el domingo por la tarde.\n\n"
    "## Ejercicio práctico\n\n- [ ] Esto no debe aparecer\n"
)


@pytest.mark.parametrize("chunk", [1, 3, 7, 50, 10_000])
def test_parser_reparte_las_secciones(chunk):
    parser = run_parser(CHAPTER, chunk)
    s = parser.result()
    assert s.introduccion.startswith("Te pasa a menudo")
    assert s.desarrollo.startswith("### Anota lo pequeño")
    assert "- Café\n- Transporte" in s.desarrollo and "> Lo que no se mide" in s.desarrollo
    assert s.ejemplos.startswith("Daniela, de 22 años")
    assert s.conclusion.startswith("Empieza hoy") and "Esto no debe aparecer" not in s.conclusion
    assert "Capítulo 2" not in s.introduccion
    assert parser.missing() == []
    # Lo que se emitió en trozos coincide con el resultado final.
    assert parser.sections["desarrollo"].strip() == s.desarrollo


def test_parser_texto_antes_del_primer_encabezado_y_secciones_vacias():
    parser = run_parser("Hola, este texto llegó sin encabezado y es la introducción del capítulo completo.\n\n## Desarrollo\n\nCorto", 5)
    assert parser.result().introduccion.startswith("Hola, este texto")
    assert set(parser.missing()) == {"desarrollo", "ejemplos", "conclusion"}


def test_parser_no_retiene_texto_normal():
    parser = ChapterStreamParser()
    parser.feed("## Introducción\n\nDesarrollar un hábito ")
    events = parser.feed("cuesta al principio")
    # "Desarrollar…" podía ser el encabezado "Desarrollo"; al llegar más texto se emite todo.
    assert "".join(e.text for e in events if e.kind == "text").endswith("cuesta al principio")
    assert parser.current == "introduccion"


def test_normalize_markdown_ra01():
    text = "# Uno\n\n## Dos\n\n#### Cuatro\n\nTexto\n\n---\n\nOtro\n===\n"
    assert normalize_markdown(text) == "### Uno\n\n### Dos\n\n### Cuatro\n\nTexto\n\nOtro"


def test_tipo_de_ejercicio_como_el_mock():
    assert [decide_type("auto", n) for n in range(1, 5)] == ["reto", "checklist", "reto", "checklist"]
    assert decide_type("checklist", 1) == "checklist" and decide_type("reto", 2) == "reto"
    assert decide_type("auto", 1, flip=True) == "checklist"


def test_validacion_de_ejercicios_rf04():
    reto = to_exercise(ExerciseOut(tipo="reto", titulo="Reto: tu semana", duracion="48 horas", pasos=["1. Uno", "Dos", "Tres"]), "reto", "24h")
    assert reto.title == "Reto de 48 horas: tu semana" and reto.duration == "48h" and reto.steps[0] == "Uno"
    assert validate_exercise(reto) == []
    checklist = to_exercise(ExerciseOut(tipo="checklist", titulo="Mi checklist", items=["- [ ] Anoto mis gastos", "b", "c", "d", "e", "f", "g", "h"]), "checklist", "48h")
    assert checklist.title == "Checklist de autoevaluación: mi checklist" and len(checklist.items) == 7
    assert checklist.items[0] == "Anoto mis gastos"
    with pytest.raises(ValueError):
        to_exercise(ExerciseOut(tipo="checklist", items=["a", "b"]), "checklist", "48h")
    with pytest.raises(ValueError):
        to_exercise(ExerciseOut(tipo="reto", pasos=["a", "b", "c"]), "checklist", "48h")


def test_personas_diversas_rer03():
    # La lista alterna mujer y hombre; dos capítulos seguidos no repiten persona.
    assert len(PEOPLE) % 2 == 0
    for number in range(1, 8):
        first, second = people_for("libro-1", number)
        assert first != second
        nxt = people_for("libro-1", number + 1)[0]
        assert nxt["nombre"] != first["nombre"]
    ages = {p["edad"] for p in PEOPLE}
    assert min(ages) < 25 and max(ages) > 50
