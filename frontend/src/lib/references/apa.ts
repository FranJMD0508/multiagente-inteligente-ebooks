// Formato APA 7 (versión en español) para las referencias del ebook.
// El backend tiene la misma lógica en backend/app/references/apa.py: si cambias
// una regla aquí, cámbiala también allí.

import type { ReferenceData } from "@/lib/types";

/** Fragmento de texto con o sin cursiva (para pintarlo en React, Markdown o HTML). */
export interface Run {
  text: string;
  italic?: boolean;
}

function initials(given: string): string {
  // "J.R.R." se trata como tres nombres: "J. R. R." (igual que backend/app/references/apa.py).
  return given
    .replace(/\./g, ". ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((name) =>
      name
        .split("-")
        .map((part) => (part ? `${part.charAt(0).toLocaleUpperCase("es")}.` : ""))
        .join("-"),
    )
    .join(" ");
}

/** "Clear, James" → "Clear, J."; sin coma se trata como organización y se deja igual. */
export function formatAuthorName(raw: string): string {
  const name = raw.trim();
  const comma = name.indexOf(",");
  if (comma < 0) return name;
  const family = name.slice(0, comma).trim();
  const given = name.slice(comma + 1).trim();
  return given ? `${family}, ${initials(given)}` : family;
}

export function familyName(raw: string): string {
  const comma = raw.indexOf(",");
  return (comma < 0 ? raw : raw.slice(0, comma)).trim();
}

/** Lista de autores: "A." · "A. y B." · "A., B. y C." · con 21 o más: 19 primeros, ". . ." y el último. */
export function formatAuthors(authors: string[]): string {
  const list = authors.map((a) => a.trim()).filter(Boolean).map(formatAuthorName);
  if (list.length === 0) return "";
  if (list.length === 1) return list[0];
  if (list.length >= 21) return `${list.slice(0, 19).join(", ")}, . . . ${list[list.length - 1]}`;
  return `${list.slice(0, -1).join(", ")} y ${list[list.length - 1]}`;
}

/** Añade un punto final salvo que ya termine en puntuación de cierre. */
function closed(text: string): string {
  const t = text.trim();
  return /[.?!]$/.test(t) ? t : `${t}.`;
}

function yearText(year: string | undefined): string {
  const y = (year ?? "").trim();
  return !y || /^s\.?\s*f\.?$/i.test(y) ? "s. f." : y;
}

function doiUrl(ref: ReferenceData): string {
  if (ref.doi) return `https://doi.org/${ref.doi.trim().replace(/^(https?:\/\/(dx\.)?doi\.org\/|doi:\s*)/i, "")}`;
  return ref.url?.trim() ?? "";
}

function editionText(edition: string | undefined): string {
  const e = (edition ?? "").trim();
  if (!e || e === "1") return "";
  return /^\d+$/.test(e) ? `${e}.ª ed.` : e;
}

/** Referencia completa en fragmentos (la cursiva va en el título del libro o de la revista). */
export function referenceRuns(ref: ReferenceData): Run[] {
  const runs: Run[] = [];
  const authors = formatAuthors(ref.authors);
  const year = `(${yearText(ref.year)}).`;
  const title = ref.title.trim();
  const link = doiUrl(ref);
  const italicTitle = ref.kind !== "articulo";
  const edition = ref.kind === "libro" ? editionText(ref.edition) : "";

  // Título con su punto final (fuera de la cursiva) y, en los libros, la edición.
  let titleRuns: Run[];
  if (!italicTitle) titleRuns = [{ text: closed(title) }];
  else if (edition) titleRuns = [{ text: title, italic: true }, { text: ` (${edition}).` }];
  else titleRuns = [{ text: title, italic: true }, { text: /[.?!]$/.test(title) ? "" : "." }];

  if (authors) {
    runs.push({ text: `${closed(authors)} ${year} ` });
    runs.push(...titleRuns);
  } else {
    // Sin autor, el título ocupa su lugar.
    runs.push(...titleRuns);
    runs.push({ text: ` ${year}` });
  }

  if (ref.kind === "articulo") {
    if (ref.journal) {
      runs.push({ text: " " });
      runs.push({ text: ref.journal.trim(), italic: true });
      if (ref.volume) {
        runs.push({ text: ", " });
        runs.push({ text: ref.volume.trim(), italic: true });
        if (ref.issue) runs.push({ text: `(${ref.issue.trim()})` });
      }
      runs.push({ text: ref.pages ? `, ${ref.pages.trim().replace(/\s*[-–—]+\s*/g, "–")}.` : "." });
    }
  } else if (ref.publisher) {
    runs.push({ text: ` ${closed(ref.publisher)}` });
  }

  if (link) runs.push({ text: ` ${link}` });
  return mergeRuns(runs);
}

function mergeRuns(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const r of runs) {
    if (!r.text) continue;
    const last = out[out.length - 1];
    if (last && Boolean(last.italic) === Boolean(r.italic)) last.text += r.text;
    else out.push({ ...r });
  }
  return out;
}

export function formatReferenceMarkdown(ref: ReferenceData): string {
  return referenceRuns(ref)
    .map((r) => (r.italic ? `*${r.text.trim()}*${r.text.endsWith(" ") ? " " : ""}` : r.text))
    .join("");
}

export function formatReferenceText(ref: ReferenceData): string {
  return referenceRuns(ref)
    .map((r) => r.text)
    .join("");
}

/** Cita en el texto: (Clear, 2018) · (Fisher y Ury, 2011) · (Fisher et al., 2011). */
export function inTextCitation(ref: ReferenceData): string {
  const families = ref.authors.map((a) => a.trim()).filter(Boolean).map(familyName);
  const year = yearText(ref.year);
  let who: string;
  if (families.length === 0) who = ref.kind === "articulo" ? `«${ref.title.trim()}»` : ref.title.trim();
  else if (families.length === 1) who = families[0];
  else if (families.length === 2) who = `${families[0]} y ${families[1]}`;
  else who = `${families[0]} et al.`;
  return `(${who}, ${year})`;
}

const fold = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** Misma clave que backend/app/references/apa.py: apellido sin tildes ni signos, año y título. */
function sortKey(ref: ReferenceData): [string, string, string] {
  const first = ref.authors.find((a) => a.trim());
  const lead = fold(first ? familyName(first) : ref.title).replace(/[^a-z0-9 ]+/g, "");
  return [lead, yearText(ref.year), fold(ref.title)];
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Orden alfabético de la lista de referencias (primer apellido o, si no hay, título). */
export function sortReferences<T extends ReferenceData>(refs: T[]): T[] {
  return [...refs].sort((a, b) => {
    const [ka, kb] = [sortKey(a), sortKey(b)];
    return cmp(ka[0], kb[0]) || cmp(ka[1], kb[1]) || cmp(ka[2], kb[2]);
  });
}
