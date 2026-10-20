// Modo con backend de la capa de datos: FastAPI + LangGraph (backend/). Cumple
// la misma interfaz que el modo demo, así que los componentes no cambian. Las
// ediciones son optimistas (sync.ts) y el avance de los agentes llega por SSE.

import { brightColor, minVeilFor, prepareCoverImage } from "@/lib/cover-image";
import { contrastRatio } from "@/lib/design";
import { downloadBlob } from "@/lib/markdown";
import type { Ebook, EbookDesign, ReferenceCandidate, ReferenceData, TopicCheck } from "@/lib/types";
import { uid } from "@/lib/uid";
import type { FolioApi, ReferencePatch } from "../contract";
import * as local from "../local";
import { getEbook, getState, putEbook, setState, showToast, updateEbook } from "../store";
import { resolveAsset } from "@/lib/assets";
import { ApiError, request } from "./client";
import { connectEvents } from "./events";
import { action, applyServer, applyServerList, creatingIds, flushPending, forgetEbook, holdLocal, mutate, setResync } from "./sync";

const path = (id: string, rest = "") => `/ebooks/${encodeURIComponent(id)}${rest}`;

async function loadLibrary(owner: string) {
  const list = await request<Ebook[]>("GET", "/ebooks");
  setState((s) => ({ ...s, ready: true, owner }));
  applyServerList(list);
}

setResync(async (id) => {
  try {
    applyServer(await request<Ebook>("GET", path(id)));
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) forgetEbook(id);
  }
});

/** Envía el índice completo tal como queda en la caché (PUT con semántica de "poner"). */
function syncOutline(id: string, debounce = 0) {
  const chapters = getEbook(id)?.chapters ?? [];
  const outline = chapters.map(({ id: cid, title, summary, keyPoints }) => ({ id: cid, title, summary, keyPoints }));
  mutate(
    id,
    "outline",
    (e) => ({
      ...e,
      chapters: outline.map((o, i) => ({ ...(e.chapters.find((c) => c.id === o.id) ?? { status: "pendiente" as const }), ...o, number: i + 1 })),
    }),
    () => request<Ebook>("PUT", path(id, "/outline"), { body: { chapters: outline } }),
    { debounce },
  );
}

/** Cambios de diseño acumulados mientras esperan a enviarse. */
const designPatches = new Map<string, Partial<EbookDesign>>();

function sendDesign(id: string, patch: Partial<EbookDesign>, debounce = 250) {
  // Una tela sin contraste suficiente (RA-03) se muestra con su aviso, pero no se
  // guarda: el servidor la rechazaría. Se envía cuando se elige un color válido.
  if (patch.clothColor !== undefined) {
    const cloth = patch.clothColor;
    if (contrastRatio(cloth, "#FFFFFF") < 4.5) {
      holdLocal(id, "tela", (e) => ({ ...e, design: { ...e.design, clothColor: cloth } }));
      const waiting = designPatches.get(id);
      if (waiting) delete waiting.clothColor;
      const { clothColor: _held, ...rest } = patch;
      void _held;
      if (!Object.keys(rest).length) return;
      patch = rest;
    } else {
      holdLocal(id, "tela", null);
    }
  }
  const acc = { ...(designPatches.get(id) ?? {}), ...patch };
  designPatches.set(id, acc);
  mutate(
    id,
    "design",
    (e) => ({ ...e, design: { ...e.design, ...acc } }),
    async () => {
      designPatches.delete(id);
      // `undefined` no viaja en JSON: quitar la imagen se envía como null.
      const body = Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, v === undefined ? null : v]));
      return request<Ebook>("PUT", path(id, "/design"), { body });
    },
    { debounce },
  );
}

const metaPatches = new Map<string, { title?: string; subtitle?: string }>();

function referencePath(id: string, refId: string, rest = "") {
  return path(id, `/references/${encodeURIComponent(refId)}${rest}`);
}

export const httpApi: FolioApi = {
  openLibrary(owner) {
    setState((s) => ({ ...s, owner, ready: false }));
    loadLibrary(owner).catch((err) => {
      if (getState().owner !== owner) return; // la sesión se cerró mientras tanto (por ejemplo, un 401)
      setState((s) => ({ ...s, ready: true, owner }));
      showToast((err as Error).message);
    });
    connectEvents(() => loadLibrary(owner));
  },

  async checkTopic(prompt) {
    try {
      return await request<TopicCheck>("POST", "/topics/check", { body: { prompt } });
    } catch (err) {
      // Si el guardarraíl no responde, el servidor vuelve a validar al crear.
      console.warn("No se pudo validar el tema", err);
      return { ok: true };
    }
  },

  createEbook(input) {
    const id = uid();
    creatingIds.add(id);
    putEbook(local.newEbook(id, input));
    request<Ebook>("POST", "/ebooks", { body: { id, ...input } })
      .then((ebook) => applyServer(ebook))
      .catch((err) => {
        forgetEbook(id);
        showToast(`No pudimos crear el ebook. ${(err as Error).message}`);
      })
      .finally(() => creatingIds.delete(id));
    return id;
  },

  // ----- Punto de control 1: índice -----

  updateOutlineItem(id, chapterId, patch) {
    updateEbook(id, local.patchOutlineItem(chapterId, patch));
    syncOutline(id, 300);
  },

  addOutlineItem(id) {
    const before = getEbook(id)?.chapters.length ?? 0;
    const newId = uid();
    updateEbook(id, local.addOutlineItem(newId));
    if ((getEbook(id)?.chapters.length ?? 0) === before) return null;
    syncOutline(id);
    return newId;
  },

  removeOutlineItem(id, chapterId) {
    updateEbook(id, local.removeOutlineItem(chapterId));
    syncOutline(id);
  },

  reorderOutline(id, orderedIds) {
    updateEbook(id, local.reorderOutline(orderedIds));
    syncOutline(id);
  },

  regenerateOutline(id, feedback) {
    void action(
      id,
      async () => {
        await flushPending(id);
        return request<Ebook>("POST", path(id, "/outline/regenerate"), { body: { feedback } });
      },
      (e) => ({ ...e, busy: { kind: "indice", message: "El Investigador está preparando otra versión…" } }),
    );
  },

  regenerateOutlineItem(id, chapterId) {
    void action(
      id,
      async () => {
        await flushPending(id);
        return request<Ebook>("POST", path(id, `/outline/chapters/${encodeURIComponent(chapterId)}/regenerate`));
      },
      (e) => ({ ...e, busy: { kind: "capitulo_indice", chapterId, message: "Buscando otra propuesta para este capítulo…" } }),
    );
  },

  restorePreviousOutline(id) {
    void action(id, () => request<Ebook>("POST", path(id, "/outline/restore")), local.restorePreviousOutline);
  },

  cancelBusy(id) {
    void action(id, () => request<Ebook>("POST", path(id, "/cancel")), local.cancelBusy);
  },

  approveOutline(id) {
    void action(
      id,
      async () => {
        await flushPending(id);
        return request<Ebook>("POST", path(id, "/outline/approve"));
      },
      (e) => ({ ...e, status: "redactando_cap1" }),
    );
  },

  // ----- Punto de control 2: capítulo 1 -----

  adjustChapterOne(id, chips, note) {
    void action(
      id,
      () => request<Ebook>("POST", path(id, "/chapters/1/regenerate"), { body: { chips, note } }),
      (e) => ({ ...e, busy: { kind: "capitulo1", message: "El Redactor está aplicando tus ajustes…" } }),
    );
  },

  restorePreviousChapterOne(id) {
    void action(id, () => request<Ebook>("POST", path(id, "/chapters/1/restore")), local.restorePreviousChapterOne);
  },

  editChapterOneManually(id, sections) {
    void action(id, () => request<Ebook>("PUT", path(id, "/chapters/1/manual"), { body: { sections } }), local.editChapterOneManually(sections));
  },

  approveChapterOne(id) {
    void action(
      id,
      () => request<Ebook>("POST", path(id, "/chapters/1/approve")),
      (e) => ({
        ...e,
        status: "redactando",
        chapters: e.chapters.map((c) => (c.number === 1 && c.status !== "editado" ? { ...c, status: "aprobado" } : c)),
      }),
    );
  },

  // ----- Edición, portada y estilo -----

  editSection(id, number, section, text) {
    mutate(
      id,
      `seccion:${number}:${section}`,
      local.editSection(number, section, text),
      () => request<Ebook>("PATCH", path(id, `/chapters/${number}`), { body: { section, text } }),
      { debounce: 600, errorPrefix: "No pudimos guardar tu edición." },
    );
  },

  updateDesign(id, patch) {
    sendDesign(id, patch);
  },

  async uploadCoverImage(id, file) {
    const { blob } = await prepareCoverImage(file);
    const form = new FormData();
    form.append("file", blob, "portada.jpg");
    // El servidor devuelve una ruta relativa (/api/assets/…); se guarda así y se resuelve al pintarla.
    const { url: src } = await request<{ url: string }>("POST", path(id, "/cover-image"), { form });
    const ebook = getEbook(id);
    if (!ebook) return;
    const minVeil = minVeilFor(await brightColor(resolveAsset(src)), ebook.design.clothColor);
    const prev = ebook.design.coverImage;
    sendDesign(
      id,
      {
        coverImage: {
          src,
          placement: prev?.placement ?? "fondo",
          minVeil,
          veil: Math.max(minVeil, prev?.veil ?? 0.35),
          focusY: 50,
          // El texto alternativo describía la imagen anterior: se pide de nuevo.
          alt: "",
        },
      },
      0,
    );
  },

  removeCoverImage(id) {
    sendDesign(id, { coverImage: undefined }, 0);
  },

  async suggestBackCover(id) {
    try {
      applyServer(await request<Ebook>("POST", path(id, "/back-cover/suggest")));
    } catch (err) {
      showToast((err as Error).message);
    }
  },

  updateMeta(id, patch) {
    // Un título vacío (mientras se borra para escribir otro) se ve en pantalla pero no se
    // envía: el servidor exige un título. Se guarda en cuanto vuelve a tener texto.
    if (patch.title !== undefined) {
      const title = patch.title;
      if (!title.trim()) {
        holdLocal(id, "titulo", (e) => ({ ...e, title }));
        const waiting = metaPatches.get(id);
        if (waiting) delete waiting.title;
        const { title: _held, ...rest } = patch;
        void _held;
        if (!Object.keys(rest).length) return;
        patch = rest;
      } else {
        holdLocal(id, "titulo", null);
      }
    }
    const acc = { ...(metaPatches.get(id) ?? {}), ...patch };
    metaPatches.set(id, acc);
    mutate(
      id,
      "meta",
      (e) => ({ ...e, ...acc }),
      () => {
        metaPatches.delete(id);
        return request<Ebook>("PATCH", path(id), { body: acc });
      },
      { debounce: 500 },
    );
  },

  retry(id) {
    void action(id, () => request<Ebook>("POST", path(id, "/retry")));
  },

  // ----- Referencias -----

  lookupReferences(query) {
    return request<ReferenceCandidate[]>("GET", `/references/lookup?q=${encodeURIComponent(query)}`);
  },

  addReference(id, data: ReferenceData, chapters = []) {
    const ref = local.newReference(uid(), data, chapters);
    void action(
      id,
      () => request<Ebook>("POST", path(id, "/references"), { body: { ...local.cleanReferenceData(data), id: ref.id, chapters } }),
      (e) => (e.references.some((r) => r.id === ref.id) ? e : local.addReference(ref)(e)),
    );
  },

  updateReference(id, refId, patch: ReferencePatch) {
    void action(id, () => request<Ebook>("PATCH", referencePath(id, refId), { body: patch }), local.updateReference(refId, patch));
  },

  removeReference(id, refId) {
    void action(id, () => request<Ebook>("DELETE", referencePath(id, refId)), local.removeReference(refId));
  },

  verifyReference(id, refId) {
    void action(
      id,
      () => request<Ebook>("POST", referencePath(id, refId, "/verify")),
      (e) => ({ ...e, references: e.references.map((r) => (r.id === refId ? { ...r, check: "pendiente" } : r)) }),
    );
  },

  acceptReferenceMatch(id, refId) {
    void action(id, () => request<Ebook>("POST", referencePath(id, refId, "/accept-match")), local.acceptReferenceMatch(refId));
  },

  suggestReferences(id) {
    void action(id, () => request<Ebook>("POST", path(id, "/references/suggest")), (e) => ({ ...e, referencesState: "sugiriendo" }));
  },

  // ----- Exportar (Agente Maquetador en el servidor) -----

  async exportEbook(id, format, filename) {
    await flushPending(id);
    const base = filename.replace(/\.(md|pdf)$/i, "").trim() || "ebook";
    const res = await request<Response>("POST", path(id, "/exports"), { body: { format, filename: `${base}.${format}` }, raw: true });
    downloadBlob(`${base}.${format}`, await res.blob());
    return format === "pdf" ? "Tu PDF se descargó." : "Tu archivo Markdown se descargó.";
  },

  // ----- Biblioteca -----

  duplicate(id) {
    const e = getEbook(id);
    if (!e || !local.canDuplicate(e)) return null;
    const newId = uid();
    creatingIds.add(newId);
    putEbook(local.duplicateOf(e, newId));
    request<Ebook>("POST", path(id, "/duplicate"), { body: { newId } })
      .then(applyServer)
      .catch((err) => {
        forgetEbook(newId);
        showToast(`No pudimos duplicar el ebook. ${(err as Error).message}`);
      })
      .finally(() => creatingIds.delete(newId));
    return newId;
  },

  remove(id) {
    forgetEbook(id);
    request("DELETE", path(id)).catch((err) => {
      showToast((err as Error).message);
      void loadLibrary(getState().owner ?? "");
    });
  },

  clearLibrary() {
    const ids = [...getState().order];
    ids.forEach((id) => httpApi.remove(id));
  },

  restoreExamples() {
    showToast("Los ejemplos solo están en la versión de demostración.");
  },
};
