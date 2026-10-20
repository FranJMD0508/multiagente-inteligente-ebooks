// Modo demo de la capa de datos: toda la lógica vive en el navegador. Los
// cuatro agentes se simulan (simulator.ts) y los datos se guardan en
// localStorage. Es lo que se publica en GitHub Pages.

import { brightColor, minVeilFor, prepareCoverImage } from "@/lib/cover-image";
import { FICTION_ALTERNATIVES, isFiction } from "@/lib/guardrails";
import { buildMarkdown, downloadText } from "@/lib/markdown";
import { detectNiche } from "@/lib/niches";
import { lookupReferences } from "@/lib/references/lookup";
import { printUrl } from "@/lib/routes";
import type { ChapterAdjustChip, EbookDesign, NewEbookInput, ReferenceData, SectionId } from "@/lib/types";
import { uid } from "@/lib/uid";
import type { FolioApi, ReferencePatch } from "../contract";
import * as local from "../local";
import { getEbook, getState, loadForUser, putEbook, removeEbook, replaceAll, updateEbook } from "../store";
import { generateBlurb } from "./content";
import { suggestReadings, verifyInBackground } from "./references";
import { createSeedEbooks } from "./seed";
import { cancelTask, simSettings, simulator } from "./simulator";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms / simSettings.speed));

export const mockApi: FolioApi = {
  openLibrary(owner, author) {
    const found = loadForUser(owner);
    if (!found) replaceAll(createSeedEbooks(author));
    Object.values(getState().ebooks).forEach((e) => {
      simulator.resume(e);
      // Verificaciones que quedaron a medias al recargar.
      e.references.filter((r) => r.check === "pendiente").forEach((r) => void verifyInBackground(e.id, r.id));
    });
  },

  async checkTopic(prompt) {
    if (isFiction(prompt)) {
      return { ok: false, reason: "Folio crea guías prácticas sobre situaciones reales.", alternatives: FICTION_ALTERNATIVES };
    }
    return { ok: true, nicheId: detectNiche(prompt).id };
  },

  createEbook(input: NewEbookInput) {
    const ebook = local.newEbook(uid(), input);
    putEbook(ebook);
    simulator.startResearch(ebook.id);
    return ebook.id;
  },

  // ----- Punto de control 1: índice -----

  updateOutlineItem(id, chapterId, patch) {
    updateEbook(id, local.patchOutlineItem(chapterId, patch));
  },

  addOutlineItem(id) {
    const before = getEbook(id)?.chapters.length ?? 0;
    const newId = uid();
    updateEbook(id, local.addOutlineItem(newId));
    return (getEbook(id)?.chapters.length ?? 0) > before ? newId : null;
  },

  removeOutlineItem(id, chapterId) {
    updateEbook(id, local.removeOutlineItem(chapterId));
  },

  reorderOutline(id, orderedIds) {
    updateEbook(id, local.reorderOutline(orderedIds));
  },

  regenerateOutline(id, feedback) {
    simulator.regenerateOutline(id, feedback);
  },

  regenerateOutlineItem(id, chapterId) {
    simulator.regenerateOutlineItem(id, chapterId);
  },

  restorePreviousOutline(id) {
    updateEbook(id, local.restorePreviousOutline);
  },

  cancelBusy(id) {
    cancelTask(id);
    updateEbook(id, local.cancelBusy);
  },

  approveOutline(id) {
    simulator.approveOutline(id);
  },

  // ----- Punto de control 2: capítulo 1 -----

  adjustChapterOne(id, chips: ChapterAdjustChip[], note) {
    simulator.adjustChapterOne(id, chips, note);
  },

  restorePreviousChapterOne(id) {
    updateEbook(id, local.restorePreviousChapterOne);
  },

  editChapterOneManually(id, sections: Record<SectionId, string>) {
    updateEbook(id, local.editChapterOneManually(sections));
  },

  approveChapterOne(id) {
    simulator.approveChapterOne(id);
  },

  // ----- Edición, portada y estilo -----

  editSection(id, number, section, text) {
    updateEbook(id, local.editSection(number, section, text));
  },

  updateDesign(id, patch: Partial<EbookDesign>) {
    updateEbook(id, (e) => ({ ...e, design: { ...e.design, ...patch } }));
  },

  async uploadCoverImage(id, file) {
    const { dataUrl } = await prepareCoverImage(file);
    const ebook = getEbook(id);
    if (!ebook) return;
    const minVeil = minVeilFor(await brightColor(dataUrl), ebook.design.clothColor);
    const prev = ebook.design.coverImage;
    updateEbook(id, (e) => ({
      ...e,
      design: {
        ...e.design,
        coverImage: {
          src: dataUrl,
          placement: prev?.placement ?? "fondo",
          minVeil,
          veil: Math.max(minVeil, prev?.veil ?? 0.35),
          focusY: 50,
          alt: prev?.alt ?? "",
        },
      },
    }));
  },

  removeCoverImage(id) {
    updateEbook(id, (e) => ({ ...e, design: { ...e.design, coverImage: undefined } }));
  },

  async suggestBackCover(id) {
    await wait(1200);
    updateEbook(id, (e) => {
      const variant = (e.activity.filter((a) => a.message.startsWith("Nueva sinopsis")).length + 1) % 3;
      return {
        ...e,
        design: { ...e.design, backCover: { enabled: true, blurb: generateBlurb(e, variant) } },
        activity: [...e.activity, { id: uid(), agent: "maquetador" as const, message: "Nueva sinopsis para la contraportada", state: "hecho" as const }].slice(-40),
      };
    });
  },

  updateMeta(id, patch) {
    updateEbook(id, (e) => ({ ...e, ...patch }));
  },

  retry(id) {
    simulator.retry(id);
  },

  // ----- Referencias -----

  lookupReferences(query) {
    return lookupReferences(query);
  },

  addReference(id, data: ReferenceData, chapters = []) {
    const ref = local.newReference(uid(), data, chapters);
    updateEbook(id, local.addReference(ref));
    void verifyInBackground(id, ref.id);
  },

  updateReference(id, refId, patch: ReferencePatch) {
    updateEbook(id, local.updateReference(refId, patch));
    if (local.changesBibliography(patch)) void verifyInBackground(id, refId);
  },

  removeReference(id, refId) {
    updateEbook(id, local.removeReference(refId));
  },

  verifyReference(id, refId) {
    void verifyInBackground(id, refId);
  },

  acceptReferenceMatch(id, refId) {
    updateEbook(id, local.acceptReferenceMatch(refId));
  },

  suggestReferences(id) {
    void suggestReadings(id);
  },

  // ----- Exportar -----

  async exportEbook(id, format, filename) {
    const ebook = getEbook(id);
    if (!ebook) throw new Error("No encontramos este ebook.");
    const base = filename.replace(/\.(md|pdf)$/i, "").trim() || "ebook";
    if (format === "md") {
      downloadText(`${base}.md`, buildMarkdown(ebook));
      return "Tu archivo Markdown se descargó.";
    }
    window.open(printUrl(id, base), "_blank", "noopener");
    return "Se abrió la vista de impresión en otra pestaña. Elige «Guardar como PDF».";
  },

  // ----- Biblioteca -----

  duplicate(id) {
    const e = getEbook(id);
    if (!e || !local.canDuplicate(e)) return null;
    const copy = local.duplicateOf(e, uid());
    putEbook(copy);
    return copy.id;
  },

  remove(id) {
    cancelTask(id);
    removeEbook(id);
  },

  clearLibrary() {
    Object.keys(getState().ebooks).forEach(cancelTask);
    replaceAll([]);
  },

  restoreExamples(author) {
    Object.keys(getState().ebooks).forEach(cancelTask);
    replaceAll(createSeedEbooks(author));
  },
};
