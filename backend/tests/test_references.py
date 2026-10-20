"""Búsqueda y verificación de referencias con respuestas simuladas de Crossref y Open Library."""

from __future__ import annotations

from app.models import ReferenceData
from app.references.lookup import ReferenceClient, lookup, name_to_apa, parse_doi, parse_isbn
from app.references.verify import title_similarity, verify_reference

from . import bibliography
from .conftest import IDEA_FINANZAS, register, wait_for, wait_status


def client(transport=None) -> ReferenceClient:
    return ReferenceClient(transport=transport or bibliography.transport())


def test_identificadores():
    assert parse_doi("https://doi.org/10.1177/1529100612453266") == "10.1177/1529100612453266"
    assert parse_doi("doi: 10.2307/2136404.") == "10.2307/2136404"
    assert parse_isbn("978-0-7352-1129-2") == "9780735211292"
    assert parse_isbn("0-7352-1129-9") == "0735211299"
    assert parse_isbn("hábitos atómicos") is None
    assert name_to_apa("James Clear") == "Clear, James"
    assert name_to_apa("Carol S. Dweck") == "Dweck, Carol S."


def test_similitud_de_titulos():
    assert title_similarity("Atomic habits", "Atomic Habits", "Tiny Changes, Remarkable Results") == 1.0
    assert title_similarity("Atomic habits: An easy & proven way", "Atomic Habits: Tiny Changes") >= 0.8
    assert title_similarity("Hábitos atómicos", "Habitos atomicos") == 1.0
    assert title_similarity("Atomic habits", "Deep work") < 0.8


async def test_verificar_por_isbn_con_datos_de_la_edicion():
    rc = client()
    r = ReferenceData(kind="libro", authors=["Clear, James"], year="2019", title="Atomic habits", isbn="9780735211292")
    result = await verify_reference(rc, r)
    assert result.check == "verificada" and result.checked_with == "openlibrary"
    # El año de esa edición difiere; la editorial ("Avery, an Imprint of…") no se marca porque falta en lo guardado → sí se propone.
    assert result.match.year == "2018"
    assert result.match.publisher == "Avery, an Imprint of Penguin Random House LLC"
    assert result.match.title is None
    await rc.aclose()


async def test_editorial_y_titulo_guardados_no_se_marcan():
    rc = client()
    r = ReferenceData(kind="libro", authors=["Clear, James"], year="2018", title="Atomic habits", publisher="Avery", isbn="9780735211292")
    result = await verify_reference(rc, r)
    assert result.check == "verificada"
    assert result.match is None  # nada que corregir: se omite
    await rc.aclose()


async def test_verificar_por_doi():
    rc = client()
    r = ReferenceData(
        kind="articulo",
        authors=["Dunlosky, John"],
        year="2013",
        title="Improving students' learning with effective learning techniques",
        journal="Psychological Science in the Public Interest",
        volume="14",
        doi="10.1177/1529100612453266",
    )
    result = await verify_reference(rc, r)
    assert result.check == "verificada" and result.checked_with == "crossref"
    assert result.match.issue == "1" and result.match.pages == "4–58"
    assert result.match.volume is None and result.match.year is None
    await rc.aclose()


async def test_autores_en_mayusculas_de_crossref():
    rc = client()
    r = ReferenceData(kind="articulo", authors=["Neff, Kristin D."], year="2003", title="Self-compassion: An alternative conceptualization of a healthy attitude toward oneself", doi="10.1080/15298860309032")
    result = await verify_reference(rc, r)
    assert result.check == "verificada"
    assert result.match.journal == "Self and Identity"
    await rc.aclose()


async def test_doi_inexistente_se_corrige_si_la_obra_existe():
    rc = client()
    r = ReferenceData(kind="articulo", authors=["Cohen, Sheldon"], year="1983", title="A global measure of perceived stress", doi="10.9999/no-existe")
    result = await verify_reference(rc, r)
    assert result.check == "verificada"
    assert result.match.doi == "10.2307/2136404"
    await rc.aclose()


async def test_libro_sin_isbn_por_titulo_y_autor():
    rc = client()
    r = ReferenceData(kind="libro", authors=["Dweck, Carol S."], year="2006", title="Mindset: The new psychology of success")
    result = await verify_reference(rc, r)
    assert result.check == "verificada" and result.checked_with == "openlibrary"
    assert result.match.isbn == "9781400062751" and result.match.publisher == "Random House"
    await rc.aclose()


async def test_obra_inventada_y_sin_conexion():
    rc = client()
    invented = ReferenceData(kind="libro", authors=["Inventado, Autor"], year="2021", title="El arte de ahorrar sin esfuerzo en la luna")
    assert (await verify_reference(rc, invented)).check == "no_encontrada"
    wrong_author = ReferenceData(kind="libro", authors=["Pérez, Ana"], year="2018", title="Atomic habits")
    assert (await verify_reference(rc, wrong_author)).check == "no_encontrada"
    web = ReferenceData(kind="web", title="Una página", url="https://ejemplo.org")
    assert (await verify_reference(rc, web)).check == "sin_verificar"
    await rc.aclose()

    offline = client(bibliography.offline_transport())
    r = ReferenceData(kind="libro", authors=["Clear, James"], year="2018", title="Atomic habits", isbn="9780735211292")
    assert (await verify_reference(offline, r)).check == "sin_verificar"
    await offline.aclose()


async def test_busqueda_libre_doi_e_isbn():
    rc = client()
    by_text = await lookup(rc, "atomic habits")
    assert by_text and by_text[0].source in ("crossref", "openlibrary") and len(by_text) <= 8
    assert any(c.title.startswith("Atomic Habits") and c.authors == ["Clear, James"] for c in by_text)
    by_doi = await lookup(rc, "https://doi.org/10.2307/2136404")
    assert len(by_doi) == 1 and by_doi[0].kind == "articulo" and by_doi[0].volume == "24"
    by_isbn = await lookup(rc, "978-0-14-311875-6")
    assert len(by_isbn) == 1 and by_isbn[0].edition == "3" and by_isbn[0].year == "2011"
    assert by_isbn[0].authors == ["Fisher, Roger", "Ury, William", "Patton, Bruce"]
    await rc.aclose()


async def test_referencias_por_la_api(client, services):
    headers = await register(client)
    res = await client.post("/api/ebooks", json={"prompt": IDEA_FINANZAS, "desiredChapters": 5, "exercisePref": "auto", "author": "Ana"}, headers=headers)
    eid = res.json()["id"]
    await wait_status(services, eid, "indice_pendiente")

    res = await client.post(
        f"/api/ebooks/{eid}/references",
        json={"id": "ref-propia-1", "kind": "libro", "authors": ["Clear, James"], "year": "2019", "title": "Atomic habits", "isbn": "9780735211292", "chapters": [1, 9], "extra": "se ignora"},
        headers=headers,
    )
    assert res.status_code == 202
    added = next(r for r in res.json()["references"] if r["id"] == "ref-propia-1")
    assert added["origin"] == "usuario" and added["check"] == "pendiente" and added["chapters"] == [1]

    def checked() -> bool:
        return services.store.get(eid).references[0].check != "pendiente"

    await wait_for(checked)
    ref = services.store.get(eid).references[0]
    assert ref.check == "verificada" and ref.match.year == "2018"

    res = await client.post(f"/api/ebooks/{eid}/references/ref-propia-1/accept-match", headers=headers)
    accepted = res.json()["references"][0]
    assert accepted["year"] == "2018" and "match" not in accepted and accepted["check"] == "verificada"

    # Cambiar solo los capítulos no vuelve a verificar; cambiar el título sí.
    res = await client.patch(f"/api/ebooks/{eid}/references/ref-propia-1", json={"chapters": [2, 3]}, headers=headers)
    assert res.status_code == 200 and res.json()["references"][0]["check"] == "verificada"
    res = await client.patch(f"/api/ebooks/{eid}/references/ref-propia-1", json={"title": "Un libro que no existe en ningún catálogo"}, headers=headers)
    assert res.status_code == 202 and res.json()["references"][0]["check"] == "pendiente"
    await wait_for(checked)
    assert services.store.get(eid).references[0].check == "no_encontrada"

    res = await client.get("/api/references/lookup", params={"q": "mindset"}, headers=headers)
    assert res.status_code == 200 and res.json()[0]["source"] == "openlibrary"

    res = await client.delete(f"/api/ebooks/{eid}/references/ref-propia-1", headers=headers)
    assert res.json()["references"] == []

    res = await client.post(f"/api/ebooks/{eid}/references/suggest", headers=headers)
    assert res.status_code == 202 and res.json()["referencesState"] == "sugiriendo"
    await wait_for(lambda: services.store.get(eid).references_state == "listo" and not services.tasks.side_running(eid, "lecturas"))
    titles = [r.title for r in services.store.get(eid).references]
    assert titles and len(titles) == len(set(titles))


async def test_primera_pagina_y_editorial_de_articulos_no_se_marcan():
    rc = client()
    r = ReferenceData(
        kind="articulo",
        authors=["Cohen, Sheldon", "Kamarck, Tom", "Mermelstein, Robin"],
        year="1983",
        title="A global measure of perceived stress",
        journal="Journal of Health and Social Behavior",
        volume="24",
        issue="4",
        pages="385–396",
        doi="10.2307/2136404",
    )
    result = await verify_reference(rc, r)
    assert result.check == "verificada" and result.match is None
    await rc.aclose()


async def test_la_busqueda_ordena_por_parecido():
    rc = client()
    found = await lookup(rc, "mindset")
    assert found[0].title.startswith("Mindset")
    await rc.aclose()
