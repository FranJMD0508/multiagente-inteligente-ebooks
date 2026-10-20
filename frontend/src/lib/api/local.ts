// Transformaciones puras del ebook (Ebook → Ebook). Las usan el modo demo, que
// las aplica y ya, y el modo con backend, que las aplica al instante en la caché
// (actualización optimista) mientras el servidor confirma el cambio.

import { defaultDesign } from "@/lib/design";
import { detectNiche, getNiche } from "@/lib/niches";
import {
  MAX_CHAPTERS,
  MIN_CHAPTERS,
  type Chapter,
  type Ebook,
  type NewEbookInput,
  type Reference,
  type ReferenceData,
  type SectionId,
} from "@/lib/types";
import type { ReferencePatch } from "./contract";

export function renumber(chapters: Chapter[]): Chapter[] {
  return chapters.map((c, i) => ({ ...c, number: i + 1 }));
}

/** Ebook recién creado, antes de que el Investigador empiece. */
export function newEbook(id: string, input: NewEbookInput): Ebook {
  const niche = input.nicheId ? getNiche(input.nicheId) : detectNiche(input.prompt);
  const now = new Date().toISOString();
  return {
    id,
    title: "Tu nuevo ebook",
    subtitle: "",
    prompt: input.prompt.trim(),
    nicheId: niche.id,
    audience: input.audience?.trim() || niche.audience,
    desiredChapters: input.desiredChapters,
    exercisePref: input.exercisePref,
    status: "investigando",
    sensitivity: niche.sensitivity,
    chapters: [],
    outlineHistory: [],
    chapterOneHistory: [],
    chapterOneVersion: 0,
    design: defaultDesign(niche.cloth, input.author),
    references: [],
    referencesState: "pendiente",
    activity: [],
    createdAt: now,
    updatedAt: now,
  };
}

// ---------- Punto de control 1 ----------

export const patchOutlineItem =
  (chapterId: string, patch: { title?: string; summary?: string }) =>
  (e: Ebook): Ebook => ({ ...e, chapters: e.chapters.map((c) => (c.id === chapterId ? { ...c, ...patch } : c)) });

export const addOutlineItem =
  (newId: string) =>
  (e: Ebook): Ebook =>
    e.chapters.length >= MAX_CHAPTERS
      ? e
      : {
          ...e,
          chapters: renumber([
            ...e.chapters,
            {
              id: newId,
              number: e.chapters.length + 1,
              title: "Nuevo capítulo",
              summary: "Escribe de qué tratará este capítulo.",
              keyPoints: ["Explica la idea principal", "Muestra cómo aplicarla", "Propón un primer paso"],
              status: "pendiente",
            },
          ]),
        };

export const removeOutlineItem =
  (chapterId: string) =>
  (e: Ebook): Ebook =>
    e.chapters.length <= MIN_CHAPTERS ? e : { ...e, chapters: renumber(e.chapters.filter((c) => c.id !== chapterId)) };

export const reorderOutline =
  (orderedIds: string[]) =>
  (e: Ebook): Ebook => {
    const byId = new Map(e.chapters.map((c) => [c.id, c]));
    return { ...e, chapters: renumber(orderedIds.map((cid) => byId.get(cid)!).filter(Boolean)) };
  };

export function restorePreviousOutline(e: Ebook): Ebook {
  const prev = e.outlineHistory[e.outlineHistory.length - 1];
  if (!prev) return e;
  return {
    ...e,
    outlineHistory: e.outlineHistory.slice(0, -1),
    chapters: prev.map((item, i) => ({ ...item, number: i + 1, status: "pendiente" as const })),
  };
}

/** Deshace el trabajo en curso de una pausa (regenerar el índice o ajustar el capítulo 1). */
export function cancelBusy(e: Ebook): Ebook {
  let next = e;
  if (e.busy?.kind === "indice") next = restorePreviousOutline(e);
  if (e.busy?.kind === "capitulo1") {
    const prev = e.chapterOneHistory[e.chapterOneHistory.length - 1];
    next = {
      ...e,
      chapterOneHistory: prev ? e.chapterOneHistory.slice(0, -1) : e.chapterOneHistory,
      chapters: e.chapters.map((c) =>
        c.number === 1 ? { ...c, ...(prev ?? {}), status: "generado", currentSection: undefined } : c,
      ),
    };
  }
  return { ...next, busy: undefined };
}

// ---------- Punto de control 2 ----------

export function restorePreviousChapterOne(e: Ebook): Ebook {
  const prev = e.chapterOneHistory[e.chapterOneHistory.length - 1];
  if (!prev) return e;
  return {
    ...e,
    chapterOneHistory: e.chapterOneHistory.slice(0, -1),
    chapterOneVersion: Math.max(1, e.chapterOneVersion - 1),
    chapters: e.chapters.map((c) => (c.number === 1 ? { ...c, sections: prev.sections, exercise: prev.exercise } : c)),
  };
}

export const editChapterOneManually =
  (sections: Record<SectionId, string>) =>
  (e: Ebook): Ebook => {
    const ch1 = e.chapters[0];
    if (!ch1?.sections) return e;
    return {
      ...e,
      chapterOneHistory: [...e.chapterOneHistory, { sections: ch1.sections, exercise: ch1.exercise }],
      chapterOneVersion: e.chapterOneVersion + 1,
      chapters: e.chapters.map((c) => (c.number === 1 ? { ...c, sections, status: "editado" } : c)),
    };
  };

// ---------- Edición ----------

export const editSection =
  (number: number, section: SectionId, text: string) =>
  (e: Ebook): Ebook => ({
    ...e,
    chapters: e.chapters.map((c) =>
      c.number === number && c.sections ? { ...c, status: "editado", sections: { ...c.sections, [section]: text } } : c,
    ),
  });

export function duplicateOf(e: Ebook, newId: string): Ebook {
  const now = new Date().toISOString();
  return { ...structuredClone(e), id: newId, title: `${e.title} (copia)`, createdAt: now, updatedAt: now };
}

export const canDuplicate = (e: Ebook) => ["listo", "indice_pendiente", "cap1_pendiente"].includes(e.status);

// ---------- Referencias ----------

const BIBLIO_KEYS: (keyof ReferenceData)[] = [
  "kind",
  "authors",
  "year",
  "title",
  "publisher",
  "edition",
  "journal",
  "volume",
  "issue",
  "pages",
  "doi",
  "isbn",
  "url",
];

/** ¿El cambio toca datos bibliográficos? Entonces hay que volver a verificar. */
export function changesBibliography(patch: ReferencePatch): boolean {
  return BIBLIO_KEYS.some((k) => k in patch);
}

export function newReference(id: string, data: ReferenceData, chapters: number[] = []): Reference {
  return { ...cleanReferenceData(data), id, chapters, origin: "usuario", check: "pendiente" };
}

/** Quita espacios sobrantes y campos vacíos. */
export function cleanReferenceData<T extends Partial<ReferenceData>>(data: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (k === "authors" && Array.isArray(v)) out[k] = v.map((a: string) => a.trim()).filter(Boolean);
    else if (typeof v === "string") {
      const t = v.trim();
      if (t || k === "title" || k === "year") out[k] = t;
    } else if (v !== undefined) out[k] = v;
  }
  return out as T;
}

export const addReference = (ref: Reference) => (e: Ebook): Ebook => ({ ...e, references: [...e.references, ref] });

export const updateReference =
  (refId: string, patch: ReferencePatch) =>
  (e: Ebook): Ebook => ({
    ...e,
    references: e.references.map((r) => {
      if (r.id !== refId) return r;
      const merged: Reference = { ...r, ...cleanReferenceData(patch) };
      // Un campo vaciado en el formulario se borra de verdad.
      for (const [k, v] of Object.entries(patch)) {
        if ((v === "" || v === undefined) && k !== "title" && k !== "year") delete (merged as unknown as Record<string, unknown>)[k];
      }
      return changesBibliography(patch) ? { ...merged, check: "pendiente", match: undefined, checkedWith: undefined } : merged;
    }),
  });

export const removeReference = (refId: string) => (e: Ebook): Ebook => ({
  ...e,
  references: e.references.filter((r) => r.id !== refId),
});

export const acceptReferenceMatch =
  (refId: string) =>
  (e: Ebook): Ebook => ({
    ...e,
    references: e.references.map((r) => (r.id === refId && r.match ? { ...r, ...r.match, match: undefined, check: "verificada" } : r)),
  });
