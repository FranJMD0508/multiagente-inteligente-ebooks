"""Formato APA 7 en español (el frontend tiene una copia en TypeScript: estos casos deben coincidir)."""

from __future__ import annotations

from app.models import ReferenceData
from app.references.apa import format_author, format_authors, format_reference, in_text_citation, sort_references


def ref(**kw) -> ReferenceData:
    return ReferenceData(**{"kind": "libro", "title": "Título", **kw})


def test_autores():
    assert format_author("Clear, James") == "Clear, J."
    assert format_author("Dweck, Carol S.") == "Dweck, C. S."
    assert format_author("Sartre, Jean-Paul") == "Sartre, J.-P."
    assert format_author("Tolkien, J.R.R.") == "Tolkien, J. R. R."
    assert format_author("García Márquez, Gabriel José") == "García Márquez, G. J."
    assert format_author("Organización Mundial de la Salud") == "Organización Mundial de la Salud"

    assert format_authors(["Clear, James"]) == "Clear, J."
    assert format_authors(["Fisher, Roger", "Ury, William"]) == "Fisher, R. y Ury, W."
    assert format_authors(["Fisher, Roger", "Ury, William", "Patton, Bruce"]) == "Fisher, R., Ury, W. y Patton, B."
    many = [f"Autor{i}, Nombre" for i in range(1, 23)]
    text = format_authors(many)
    assert text.startswith("Autor1, N., Autor2, N.")
    assert "Autor19, N., . . . Autor22, N." in text
    assert "Autor20" not in text and "Autor21" not in text


def test_libro():
    r = ref(authors=["Clear, James"], year="2018", title="Hábitos atómicos", publisher="Diana")
    assert format_reference(r) == "Clear, J. (2018). *Hábitos atómicos*. Diana."
    r = ref(authors=["Fisher, Roger", "Ury, William", "Patton, Bruce"], year="2011", title="Getting to yes", publisher="Penguin Books", edition="3")
    assert format_reference(r) == "Fisher, R., Ury, W. y Patton, B. (2011). *Getting to yes* (3.ª ed.). Penguin Books."
    r = ref(authors=["Clear, James"], year="2018", title="Atomic habits", publisher="Avery", doi="https://doi.org/10.1234/abc")
    assert format_reference(r) == "Clear, J. (2018). *Atomic habits*. Avery. https://doi.org/10.1234/abc"
    r = ref(authors=["Clear, James"], year="2018", title="Atomic habits", publisher="Avery", url="https://jamesclear.com")
    assert format_reference(r).endswith("Avery. https://jamesclear.com")


def test_articulo():
    r = ReferenceData(
        kind="articulo",
        authors=["Dunlosky, John", "Rawson, Katherine A."],
        year="2013",
        title="Improving students' learning with effective learning techniques",
        journal="Psychological Science in the Public Interest",
        volume="14",
        issue="1",
        pages="4-58",
        doi="10.1177/1529100612453266",
    )
    assert format_reference(r) == (
        "Dunlosky, J. y Rawson, K. A. (2013). Improving students' learning with effective learning techniques. "
        "*Psychological Science in the Public Interest*, *14*(1), 4–58. https://doi.org/10.1177/1529100612453266"
    )
    html = format_reference(r, "html")
    assert "<em>Psychological Science in the Public Interest</em>, <em>14</em>(1), 4–58." in html
    assert '<a href="https://doi.org/10.1177/1529100612453266">' in html


def test_web_sin_autor_y_sin_fecha():
    r = ReferenceData(kind="web", authors=["Organización Mundial de la Salud"], year="2022", title="Salud mental: fortalecer nuestra respuesta", publisher="OMS", url="https://www.who.int/es")
    assert format_reference(r) == "Organización Mundial de la Salud. (2022). *Salud mental: fortalecer nuestra respuesta*. OMS. https://www.who.int/es"
    r = ReferenceData(kind="web", authors=["Pérez, Ana"], year="2021", title="Mi página", publisher="Blog", edition="2", url="https://ejemplo.org")
    assert format_reference(r) == "Pérez, A. (2021). *Mi página*. Blog. https://ejemplo.org"  # la edición solo va en libros
    r = ref(title="Guía de ahorro", year="2020", publisher="Banco Central")
    assert format_reference(r) == "*Guía de ahorro*. (2020). Banco Central."
    r = ref(authors=["Pérez, Ana"], year="", title="Sin fecha", publisher="Editorial")
    assert format_reference(r) == "Pérez, A. (s. f.). *Sin fecha*. Editorial."


def test_titulo_con_interrogacion():
    r = ref(authors=["Johnson, Spencer"], year="1998", title="¿Quién se ha llevado mi queso?", publisher="Urano")
    assert format_reference(r) == "Johnson, S. (1998). *¿Quién se ha llevado mi queso?* Urano."
    r = ReferenceData(kind="articulo", authors=["Pérez, Ana"], year="2020", title="¿Funciona el repaso espaciado?", journal="Revista", volume="3")
    assert format_reference(r) == "Pérez, A. (2020). ¿Funciona el repaso espaciado? *Revista*, *3*."


def test_citas_en_el_texto():
    assert in_text_citation(ref(authors=["Clear, James"], year="2018")) == "(Clear, 2018)"
    assert in_text_citation(ref(authors=["Fisher, Roger", "Ury, William"], year="2011")) == "(Fisher y Ury, 2011)"
    assert in_text_citation(ref(authors=["Fisher, Roger", "Ury, William", "Patton, Bruce"], year="2011")) == "(Fisher et al., 2011)"
    assert in_text_citation(ref(authors=["Clear, James"], year="s. f.")) == "(Clear, s. f.)"
    assert in_text_citation(ref(title="Guía de ahorro", year="2020")) == "(Guía de ahorro, 2020)"
    assert in_text_citation(ReferenceData(kind="articulo", title="Un artículo", year="2020")) == "(«Un artículo», 2020)"


def test_orden_alfabetico():
    refs = [
        ref(authors=["Ury, William"], year="1991", title="B"),
        ref(authors=["Álvarez, Luisa"], year="2001", title="A"),
        ref(title="Zeta sin autor", year="2000"),
        ref(authors=["Clear, James"], year="2018", title="C"),
    ]
    ordered = [r.authors[0].split(",")[0] if r.authors else r.title for r in sort_references(refs)]
    assert ordered == ["Álvarez", "Clear", "Ury", "Zeta sin autor"]
