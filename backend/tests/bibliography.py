"""Respuestas simuladas de Crossref y Open Library (las pruebas no usan la red)."""

from __future__ import annotations

from urllib.parse import unquote

import httpx

CROSSREF_WORKS = {
    "10.1177/1529100612453266": {
        "DOI": "10.1177/1529100612453266",
        "type": "journal-article",
        "title": ["Improving Students’ Learning With Effective Learning Techniques"],
        "subtitle": ["Promising Directions From Cognitive and Educational Psychology"],
        "author": [
            {"given": "John", "family": "Dunlosky"},
            {"given": "Katherine A.", "family": "Rawson"},
            {"given": "Elizabeth J.", "family": "Marsh"},
            {"given": "Mitchell J.", "family": "Nathan"},
            {"given": "Daniel T.", "family": "Willingham"},
        ],
        "container-title": ["Psychological Science in the Public Interest"],
        "volume": "14",
        "issue": "1",
        "page": "4-58",
        "issued": {"date-parts": [[2013, 1]]},
        "publisher": "SAGE Publications",
    },
    "10.1080/15298860309032": {
        "DOI": "10.1080/15298860309032",
        "type": "journal-article",
        "title": ["Self-Compassion: An Alternative Conceptualization of a Healthy Attitude Toward Oneself"],
        "author": [{"given": "KRISTIN", "family": "NEFF"}],
        "container-title": ["Self and Identity"],
        "volume": "2",
        "issue": "2",
        "page": "85-101",
        "issued": {"date-parts": [[2003, 4]]},
        "publisher": "Informa UK Limited",
    },
    "10.2307/2136404": {
        "DOI": "10.2307/2136404",
        "type": "journal-article",
        "title": ["A Global Measure of Perceived Stress"],
        "author": [
            {"given": "Sheldon", "family": "Cohen"},
            {"given": "Tom", "family": "Kamarck"},
            {"given": "Robin", "family": "Mermelstein"},
        ],
        "container-title": ["Journal of Health and Social Behavior"],
        "volume": "24",
        "issue": "4",
        "page": "385",
        "issued": {"date-parts": [[1983, 12]]},
    },
}

OL_EDITIONS = {
    "9780735211292": {
        "title": "Atomic Habits",
        "subtitle": "Tiny Changes, Remarkable Results : an Easy & Proven Way to Build Good Habits & Break Bad Ones",
        "publishers": ["Avery, an Imprint of Penguin Random House LLC"],
        "publish_date": "Oct 16, 2018",
        "edition_name": "1st edition",
    },
    "9780143118756": {
        "title": "Getting to Yes",
        "subtitle": "Negotiating Agreement Without Giving In",
        "publishers": ["Penguin Books"],
        "publish_date": "Apr 19, 2011",
        "edition_name": "3rd ed.",
    },
}

OL_DOCS = [
    {
        "title": "Atomic Habits",
        "subtitle": "Tiny Changes, Remarkable Results",
        "author_name": ["James Clear"],
        "first_publish_year": 2016,
        "publisher": ["Avery"],
        "isbn": ["0735211299", "9780735211292"],
    },
    {
        "title": "Getting to Yes",
        "author_name": ["Roger Fisher", "William Ury", "Bruce Patton"],
        "first_publish_year": 1981,
        "publisher": ["Penguin Books"],
        "isbn": ["9780143118756"],
    },
    {
        "title": "Mindset",
        "subtitle": "The New Psychology of Success",
        "author_name": ["Carol S. Dweck"],
        "first_publish_year": 2006,
        "publisher": ["Random House"],
        "isbn": ["9781400062751"],
    },
]

calls: list[str] = []


def _matches(doc: dict, text: str) -> bool:
    words = [w for w in text.lower().replace(":", " ").split() if len(w) > 3]
    title = (doc.get("title", "") + " " + doc.get("subtitle", "")).lower()
    return bool(words) and sum(1 for w in words if w in title) >= max(1, len(words) // 2)


def handler(request: httpx.Request) -> httpx.Response:
    url = request.url
    calls.append(str(url))
    if url.host == "api.crossref.org":
        if url.path.startswith("/works/"):
            doi = unquote(url.path[len("/works/") :])
            work = CROSSREF_WORKS.get(doi)
            return httpx.Response(200, json={"message": work}) if work else httpx.Response(404, text="Resource not found.")
        if url.path == "/works":
            query = url.params.get("query.bibliographic", "")
            items = [w for w in CROSSREF_WORKS.values() if _matches({"title": w["title"][0]}, query)]
            return httpx.Response(200, json={"message": {"items": items[: int(url.params.get("rows", 4))]}})
    if url.host == "openlibrary.org":
        if url.path.startswith("/isbn/"):
            isbn = url.path[len("/isbn/") :].removesuffix(".json")
            edition = OL_EDITIONS.get(isbn)
            return httpx.Response(200, json=edition) if edition else httpx.Response(404, json={"error": "notfound"})
        if url.path == "/search.json":
            if "isbn" in url.params:
                docs = [d for d in OL_DOCS if url.params["isbn"] in d.get("isbn", [])]
            else:
                text = url.params.get("q") or url.params.get("title") or ""
                docs = [d for d in OL_DOCS if _matches(d, text)]
            return httpx.Response(200, json={"docs": docs[: int(url.params.get("limit", 4))]})
    return httpx.Response(404)


def transport() -> httpx.MockTransport:
    return httpx.MockTransport(handler)


def offline_transport() -> httpx.MockTransport:
    def fail(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("sin conexión", request=request)

    return httpx.MockTransport(fail)
