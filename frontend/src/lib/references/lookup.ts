// Búsqueda y verificación de referencias en Crossref (artículos, DOI) y Open
// Library (libros, ISBN) desde el navegador. Ambas APIs admiten CORS. Con
// backend, esto lo hace el servidor (backend/app/references/); las reglas son
// las mismas.

import type { ReferenceCandidate, ReferenceCheck, ReferenceData } from "@/lib/types";
import { familyName } from "./apa";

const TIMEOUT_MS = 8000;
const DOI_RE = /10\.\d{4,9}\/\S+/i;

export function extractDoi(text: string): string | null {
  const m = text
    .trim()
    .replace(/^(https?:\/\/(dx\.)?doi\.org\/|doi:\s*)/i, "")
    .match(DOI_RE);
  return m ? m[0].replace(/[.,;)\]]+$/, "") : null;
}

export function extractIsbn(text: string): string | null {
  const digits = text.replace(/^\s*isbn(-1[03])?:?/i, "").replace(/[\s-]/g, "");
  return /^(\d{9}[\dXx]|\d{13})$/.test(digits) ? digits.toUpperCase() : null;
}

/** Quita etiquetas HTML que a veces trae Crossref en los títulos (<i>, <sub>…). */
const stripTags = (text: string) => text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

async function getJson<T>(url: string): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Normalización ----------

export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Similitud de Dice sobre bigramas (0..1). */
function dice(a: string, b: string): number {
  const x = normalize(a);
  const y = normalize(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const grams = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  };
  const gx = grams(x);
  const gy = grams(y);
  let inter = 0;
  gx.forEach((n, g) => (inter += Math.min(n, gy.get(g) ?? 0)));
  return (2 * inter) / (x.length - 1 + (y.length - 1));
}

const mainTitle = (t: string) => t.split(":")[0].trim() || t;

/** Compara títulos con y sin subtítulo y se queda con la mejor coincidencia. */
export function titleSimilarity(stored: string, title: string, subtitle?: string): number {
  const full = subtitle ? `${title}: ${subtitle}` : title;
  return Math.max(dice(stored, title), dice(stored, full), dice(mainTitle(stored), mainTitle(full)));
}

function authorsOverlap(stored: string[], found: string[]): boolean {
  if (!stored.length || !found.length) return true;
  // "García Márquez, Gabriel" debe coincidir con "Gabriel García Márquez".
  const mine = new Set(stored.flatMap((a) => normalize(familyName(a)).split(" ")).filter((t) => t.length >= 3));
  if (!mine.size) return true;
  const theirs = new Set(found.flatMap((a) => normalize(a).split(" ")).filter((t) => t.length >= 3));
  return [...mine].some((t) => theirs.has(t));
}

const yearOf = (text: string | number | undefined) => String(text ?? "").match(/\d{4}/)?.[0] ?? "";

/** "James Clear" → "Clear, James" (la última palabra se toma como apellido). */
export function personToApa(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name.trim();
  return `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(" ")}`;
}

// ---------- Crossref ----------

interface CrossrefWork {
  title?: string[];
  subtitle?: string[];
  author?: { family?: string; given?: string; name?: string }[];
  issued?: { "date-parts"?: number[][] };
  "container-title"?: string[];
  volume?: string;
  issue?: string;
  page?: string;
  publisher?: string;
  DOI?: string;
  type?: string;
  ISBN?: string[];
}

function fromCrossref(w: CrossrefWork): ReferenceCandidate {
  const isBook = /^(book|monograph|edited-book|reference-book)/.test(w.type ?? "");
  return {
    source: "crossref",
    kind: isBook ? "libro" : "articulo",
    authors: (w.author ?? []).map((a) => (a.family ? (a.given ? `${a.family}, ${a.given}` : a.family) : (a.name ?? ""))).filter(Boolean),
    year: yearOf(w.issued?.["date-parts"]?.[0]?.[0]),
    title: stripTags([w.title?.[0], w.subtitle?.[0]].filter(Boolean).join(": ")),
    journal: isBook ? undefined : w["container-title"]?.[0] && stripTags(w["container-title"][0]),
    volume: w.volume,
    issue: w.issue,
    pages: w.page,
    publisher: isBook ? w.publisher : undefined,
    doi: w.DOI,
    isbn: w.ISBN?.[0]?.replace(/-/g, ""),
  };
}

async function crossrefByDoi(doi: string): Promise<ReferenceCandidate | null> {
  const data = await getJson<{ message: CrossrefWork }>(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
  return data ? fromCrossref(data.message) : null;
}

async function crossrefSearch(query: string, rows = 4): Promise<ReferenceCandidate[]> {
  const data = await getJson<{ message: { items: CrossrefWork[] } }>(
    `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(query)}&rows=${rows}`,
  );
  return (data?.message.items ?? []).map(fromCrossref).filter((c) => c.title);
}

// ---------- Open Library ----------

interface OlDoc {
  title?: string;
  subtitle?: string;
  author_name?: string[];
  first_publish_year?: number;
  publisher?: string[];
  isbn?: string[];
}

function fromOpenLibrary(d: OlDoc): ReferenceCandidate {
  return {
    source: "openlibrary",
    kind: "libro",
    authors: (d.author_name ?? []).slice(0, 6).map(personToApa),
    year: yearOf(d.first_publish_year),
    title: [d.title, d.subtitle].filter(Boolean).join(": "),
    publisher: d.publisher?.[0],
    isbn: d.isbn?.find((i) => i.length === 13) ?? d.isbn?.[0],
  };
}

const OL_FIELDS = "title,subtitle,author_name,first_publish_year,publisher,isbn";

async function openLibrarySearch(params: Record<string, string>, limit = 4): Promise<ReferenceCandidate[]> {
  const qs = new URLSearchParams({ ...params, limit: String(limit), fields: OL_FIELDS });
  const data = await getJson<{ docs: OlDoc[] }>(`https://openlibrary.org/search.json?${qs}`);
  return (data?.docs ?? []).map(fromOpenLibrary).filter((c) => c.title);
}

/** Datos de una edición concreta (año y editorial de ese ISBN) más los autores de la obra. */
async function openLibraryByIsbn(isbn: string): Promise<ReferenceCandidate | null> {
  const [editionResult, searchResult] = await Promise.allSettled([
    getJson<{ title?: string; subtitle?: string; publishers?: string[]; publish_date?: string; edition_name?: string }>(
      `https://openlibrary.org/isbn/${isbn}.json`,
    ),
    openLibrarySearch({ isbn }, 1),
  ]);
  if (editionResult.status === "rejected" && searchResult.status === "rejected") throw editionResult.reason;
  const edition = editionResult.status === "fulfilled" ? editionResult.value : null;
  const search = searchResult.status === "fulfilled" ? searchResult.value : [];
  if (!edition && !search.length) return null;
  const base = search[0];
  const edNumber = edition?.edition_name?.match(/^(\d+)/)?.[1];
  return {
    source: "openlibrary",
    kind: "libro",
    authors: base?.authors ?? [],
    year: yearOf(edition?.publish_date) || base?.year || "",
    title: edition?.title ? [edition.title, edition.subtitle].filter(Boolean).join(": ") : (base?.title ?? ""),
    publisher: edition?.publishers?.[0] ?? base?.publisher,
    edition: edNumber && edNumber !== "1" ? edNumber : undefined,
    isbn,
  };
}

// ---------- API pública ----------

/** Busca por DOI, ISBN o texto libre (título, autor…). Devuelve hasta 8 candidatos. */
export async function lookupReferences(query: string): Promise<ReferenceCandidate[]> {
  const q = query.trim();
  if (!q) return [];
  const doi = extractDoi(q);
  if (doi) {
    const hit = await crossrefByDoi(doi);
    return hit ? [hit] : [];
  }
  const isbn = extractIsbn(q);
  if (isbn) {
    const hit = await openLibraryByIsbn(isbn);
    return hit ? [hit] : [];
  }
  const [books, articles] = await Promise.allSettled([openLibrarySearch({ q }), crossrefSearch(q)]);
  const out = [
    ...(books.status === "fulfilled" ? books.value : []),
    ...(articles.status === "fulfilled" ? articles.value : []),
  ];
  if (books.status === "rejected" && articles.status === "rejected") throw books.reason;
  // Lo más parecido a lo que se buscó, primero (igual que backend/app/references/lookup.py).
  // `sort` es estable: a igual parecido se mantiene el orden de las fuentes.
  const score = (c: ReferenceCandidate) => Math.round(titleSimilarity(q, c.title) * 10) / 10;
  return out.sort((a, b) => score(b) - score(a)).slice(0, 8);
}

export interface VerifyResult {
  check: ReferenceCheck;
  checkedWith?: "crossref" | "openlibrary";
  match?: Partial<ReferenceData>;
}

const THRESHOLD = 0.8;

/** Campos que conviene corregir: el año si difiere; volumen, número y páginas si difieren o faltan; el resto solo si falta. */
export function diffMatch(stored: ReferenceData, found: ReferenceCandidate): Partial<ReferenceData> | undefined {
  const match: Partial<ReferenceData> = {};
  if (found.year && yearOf(stored.year) !== found.year) match.year = found.year;
  for (const key of ["volume", "issue"] as const) {
    const f = found[key]?.trim();
    if (f && normalize(f) !== normalize(stored[key] ?? "")) match[key] = f;
  }
  // Crossref a veces solo da la primera página ("385" frente a "385-396"): eso no es una diferencia.
  const pages = (v?: string) => (v ?? "").trim().replace(/\s*[-–—]+\s*/g, "-");
  const fp = pages(found.pages);
  const sp = pages(stored.pages);
  if (fp && fp !== sp && !(sp && sp.split("-")[0] === fp)) match.pages = found.pages;
  // La editorial no se usa en los artículos ni la revista en los libros (APA 7).
  const missing = stored.kind === "articulo" ? (["doi", "journal"] as const) : (["doi", "isbn", "publisher"] as const);
  for (const key of missing) {
    const f = found[key]?.trim();
    if (f && !stored[key]?.trim()) match[key] = f;
  }
  if (!stored.authors.some((a) => a.trim()) && found.authors.length) match.authors = found.authors;
  return Object.keys(match).length ? match : undefined;
}

function best(stored: ReferenceData, candidates: ReferenceCandidate[]): ReferenceCandidate | null {
  let top: { c: ReferenceCandidate; score: number } | null = null;
  for (const c of candidates) {
    const score = titleSimilarity(stored.title, c.title);
    if (score >= THRESHOLD && authorsOverlap(stored.authors, c.authors) && (!top || score > top.score)) top = { c, score };
  }
  return top?.c ?? null;
}

/** Comprueba que una referencia exista. Nunca lanza: sin red devuelve "sin_verificar". */
export async function verifyReference(ref: ReferenceData): Promise<VerifyResult> {
  if (ref.kind === "web") return { check: "sin_verificar" };
  try {
    let found: ReferenceCandidate | null = null;
    const doi = ref.doi ? extractDoi(ref.doi) : null;
    const isbn = ref.isbn ? extractIsbn(ref.isbn) : null;
    if (doi) {
      const hit = await crossrefByDoi(doi);
      found = hit && titleSimilarity(ref.title, hit.title) >= THRESHOLD ? hit : null;
    }
    if (!found && isbn) {
      const hit = await openLibraryByIsbn(isbn);
      found = hit && titleSimilarity(ref.title, hit.title) >= THRESHOLD ? hit : null;
    }
    if (!found) {
      const author = ref.authors[0] ? familyName(ref.authors[0]) : "";
      found =
        ref.kind === "libro"
          ? best(ref, await openLibrarySearch({ title: mainTitle(ref.title), ...(author ? { author } : {}) }, 5))
          : best(ref, await crossrefSearch([ref.title, author, ref.year].filter(Boolean).join(" "), 5));
    }
    if (!found) return { check: "no_encontrada" };
    return { check: "verificada", checkedWith: found.source, match: diffMatch(ref, found) };
  } catch {
    return { check: "sin_verificar" };
  }
}

/** Convierte un candidato en los datos de una referencia nueva. */
export function candidateToData(c: ReferenceCandidate): ReferenceData {
  const { source: _source, ...data } = c;
  void _source;
  return data;
}
