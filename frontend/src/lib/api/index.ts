// Punto único de acceso a los datos. En esta fase (frontend con mocks) toda
// la lógica vive en el navegador; en la fase 4 se sustituirá por un adaptador
// HTTP que hable con FastAPI (REST + SSE, docs/03 §6) manteniendo esta misma
// interfaz, para que ningún componente tenga que cambiar.

import { detectNiche, getNiche } from "@/lib/niches";
import {
  MAX_CHAPTERS,
  MIN_CHAPTERS,
  type Chapter,
  type ChapterAdjustChip,
  type Ebook,
  type EbookDesign,
  type NewEbookInput,
  type SectionId,
} from "@/lib/types";
import { uid } from "@/lib/uid";
import { createSeedEbooks } from "./mock/seed";
import { cancelTask, simulator } from "./mock/simulator";
import { getEbook, getState, loadForUser, putEbook, removeEbook, replaceAll, updateEbook } from "./store";

function renumber(chapters: Chapter[]): Chapter[] {
  return chapters.map((c, i) => ({ ...c, number: i + 1 }));
}

export const api = {
  /** Carga (o crea con ejemplos) la biblioteca del usuario y retoma el trabajo pendiente. */
  openLibrary(owner: string, author: string) {
    const found = loadForUser(owner);
    if (!found) replaceAll(createSeedEbooks(author));
    Object.values(getState().ebooks).forEach((e) => simulator.resume(e));
  },

  createEbook(input: NewEbookInput): string {
    const niche = input.nicheId ? getNiche(input.nicheId) : detectNiche(input.prompt);
    const now = new Date().toISOString();
    const ebook: Ebook = {
      id: uid(),
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
      design: {
        coverTemplate: "clasica",
        clothColor: niche.cloth,
        font: "Roboto",
        bodySizePt: 11,
        pageSize: "A5",
        author: input.author,
      },
      activity: [],
      createdAt: now,
      updatedAt: now,
    };
    putEbook(ebook);
    simulator.startResearch(ebook.id);
    return ebook.id;
  },

  // ----- Punto de control 1: índice -----

  updateOutlineItem(id: string, chapterId: string, patch: { title?: string; summary?: string }) {
    updateEbook(id, (e) => ({ ...e, chapters: e.chapters.map((c) => (c.id === chapterId ? { ...c, ...patch } : c)) }));
  },

  addOutlineItem(id: string): string | null {
    const e = getEbook(id);
    if (!e || e.chapters.length >= MAX_CHAPTERS) return null;
    const newId = uid();
    updateEbook(id, (eb) => ({
      ...eb,
      chapters: renumber([
        ...eb.chapters,
        {
          id: newId,
          number: eb.chapters.length + 1,
          title: "Nuevo capítulo",
          summary: "Escribe de qué tratará este capítulo.",
          keyPoints: ["Explica la idea principal", "Muestra cómo aplicarla", "Propón un primer paso"],
          status: "pendiente",
        },
      ]),
    }));
    return newId;
  },

  removeOutlineItem(id: string, chapterId: string) {
    const e = getEbook(id);
    if (!e || e.chapters.length <= MIN_CHAPTERS) return;
    updateEbook(id, (eb) => ({ ...eb, chapters: renumber(eb.chapters.filter((c) => c.id !== chapterId)) }));
  },

  reorderOutline(id: string, orderedIds: string[]) {
    updateEbook(id, (e) => {
      const byId = new Map(e.chapters.map((c) => [c.id, c]));
      return { ...e, chapters: renumber(orderedIds.map((cid) => byId.get(cid)!).filter(Boolean)) };
    });
  },

  regenerateOutline(id: string, feedback: string) {
    simulator.regenerateOutline(id, feedback);
  },

  regenerateOutlineItem(id: string, chapterId: string) {
    simulator.regenerateOutlineItem(id, chapterId);
  },

  restorePreviousOutline(id: string) {
    updateEbook(id, (e) => {
      const prev = e.outlineHistory[e.outlineHistory.length - 1];
      if (!prev) return e;
      return {
        ...e,
        outlineHistory: e.outlineHistory.slice(0, -1),
        chapters: prev.map((item, i) => ({ ...item, number: i + 1, status: "pendiente" as const })),
      };
    });
  },

  /** Cancela el trabajo en curso durante una pausa y conserva la versión anterior. */
  cancelBusy(id: string) {
    cancelTask(id);
    const e = getEbook(id);
    if (e?.busy?.kind === "indice") api.restorePreviousOutline(id);
    if (e?.busy?.kind === "capitulo1") {
      updateEbook(id, (eb) => {
        const prev = eb.chapterOneHistory[eb.chapterOneHistory.length - 1];
        return {
          ...eb,
          chapterOneHistory: prev ? eb.chapterOneHistory.slice(0, -1) : eb.chapterOneHistory,
          chapters: eb.chapters.map((c) =>
            c.number === 1 ? { ...c, ...(prev ?? {}), status: "generado", currentSection: undefined } : c,
          ),
        };
      });
    }
    updateEbook(id, (eb) => ({ ...eb, busy: undefined }));
  },

  approveOutline(id: string) {
    simulator.approveOutline(id);
  },

  // ----- Punto de control 2: capítulo 1 -----

  adjustChapterOne(id: string, chips: ChapterAdjustChip[], note: string) {
    simulator.adjustChapterOne(id, chips, note);
  },

  restorePreviousChapterOne(id: string) {
    updateEbook(id, (e) => {
      const prev = e.chapterOneHistory[e.chapterOneHistory.length - 1];
      if (!prev) return e;
      return {
        ...e,
        chapterOneHistory: e.chapterOneHistory.slice(0, -1),
        chapterOneVersion: Math.max(1, e.chapterOneVersion - 1),
        chapters: e.chapters.map((c) => (c.number === 1 ? { ...c, sections: prev.sections, exercise: prev.exercise } : c)),
      };
    });
  },

  approveChapterOne(id: string) {
    simulator.approveChapterOne(id);
  },

  // ----- Edición y diseño -----

  editSection(id: string, number: number, section: SectionId, text: string) {
    updateEbook(id, (e) => ({
      ...e,
      chapters: e.chapters.map((c) =>
        c.number === number && c.sections ? { ...c, status: "editado", sections: { ...c.sections, [section]: text } } : c,
      ),
    }));
  },

  editChapterOneManually(id: string, sections: Record<SectionId, string>) {
    updateEbook(id, (e) => {
      const ch1 = e.chapters[0];
      if (!ch1?.sections) return e;
      return {
        ...e,
        chapterOneHistory: [...e.chapterOneHistory, { sections: ch1.sections, exercise: ch1.exercise }],
        chapterOneVersion: e.chapterOneVersion + 1,
        chapters: e.chapters.map((c) => (c.number === 1 ? { ...c, sections, status: "editado" } : c)),
      };
    });
  },

  updateDesign(id: string, patch: Partial<EbookDesign>) {
    updateEbook(id, (e) => ({ ...e, design: { ...e.design, ...patch } }));
  },

  updateMeta(id: string, patch: { title?: string; subtitle?: string }) {
    updateEbook(id, (e) => ({ ...e, ...patch }));
  },

  retry(id: string) {
    simulator.retry(id);
  },

  // ----- Biblioteca -----

  duplicate(id: string): string | null {
    const e = getEbook(id);
    if (!e || !["listo", "indice_pendiente", "cap1_pendiente"].includes(e.status)) return null;
    const now = new Date().toISOString();
    const copy: Ebook = { ...structuredClone(e), id: uid(), title: `${e.title} (copia)`, createdAt: now, updatedAt: now };
    putEbook(copy);
    return copy.id;
  },

  remove(id: string) {
    cancelTask(id);
    removeEbook(id);
  },

  clearLibrary() {
    Object.keys(getState().ebooks).forEach(cancelTask);
    replaceAll([]);
  },

  restoreExamples(author: string) {
    Object.keys(getState().ebooks).forEach(cancelTask);
    replaceAll(createSeedEbooks(author));
  },
};

export type FolioApi = typeof api;
