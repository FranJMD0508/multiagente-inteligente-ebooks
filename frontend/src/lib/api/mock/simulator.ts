// Simulador del pipeline multiagente (docs/03 §3). Reproduce en el navegador el
// grafo de la fase 4: Investigador → pausa → Redactor + Ejercicios (cap. 1) →
// pausa → capítulos 2..N → Maquetador. Incluye streaming y errores simulables.

import { getNiche } from "@/lib/niches";
import {
  SECTION_LABELS,
  SECTION_ORDER,
  type ActivityEntry,
  type AgentId,
  type Chapter,
  type ChapterAdjustChip,
  type Ebook,
  type OutlineItem,
} from "@/lib/types";
import { uid } from "@/lib/uid";
import { announce, getEbook, updateEbook } from "../store";
import { generateChapter, generateOutline, regenerateOutlineItem } from "./content";

export const simSettings = {
  speed: 1 as number, // 1 = normal, 2.5 = rápida
  simulateError: false,
};

const tasks = new Map<string, AbortController>();
const errorsShown = new Set<string>();

class AbortedError extends Error {
  constructor() {
    super("aborted");
    this.name = "AbortedError";
  }
}
class SimulatedFailure extends Error {
  constructor(public chapter: number) {
    super("simulated");
    this.name = "SimulatedFailure";
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new AbortedError());
    const t = setTimeout(resolve, ms / simSettings.speed);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new AbortedError());
    });
  });
}

function run(id: string, fn: (signal: AbortSignal) => Promise<void>) {
  tasks.get(id)?.abort();
  const ctrl = new AbortController();
  tasks.set(id, ctrl);
  fn(ctrl.signal)
    .catch((err) => {
      if (!(err instanceof AbortedError)) console.error(err);
    })
    .finally(() => {
      if (tasks.get(id) === ctrl) tasks.delete(id);
    });
}

export function cancelTask(id: string) {
  tasks.get(id)?.abort();
  tasks.delete(id);
}

// ---------- bitácora ----------

function log(id: string, agent: AgentId, message: string, state: ActivityEntry["state"] = "hecho"): string {
  const entry: ActivityEntry = { id: uid(), agent, message, state };
  updateEbook(id, (e) => ({ ...e, activity: [...e.activity, entry].slice(-40) }));
  return entry.id;
}

function editLog(id: string, entryId: string, message: string, state: ActivityEntry["state"]) {
  updateEbook(id, (e) => ({
    ...e,
    activity: e.activity.map((a) => (a.id === entryId ? { ...a, message, state } : a)),
  }));
}

function toChapters(items: OutlineItem[]): Chapter[] {
  return items.map((item, i) => ({ ...item, number: i + 1, status: "pendiente" }));
}

function patchChapter(id: string, number: number, fn: (c: Chapter) => Chapter) {
  updateEbook(id, (e) => ({ ...e, chapters: e.chapters.map((c) => (c.number === number ? fn(c) : c)) }));
}

// ---------- Investigador ----------

async function research(id: string, signal: AbortSignal) {
  const start = getEbook(id);
  if (!start) return;
  const niche = getNiche(start.nicheId);
  updateEbook(id, (e) => ({ ...e, status: "investigando", chapters: [], activity: [], error: undefined, busy: undefined }));

  const reading = log(id, "investigador", "Leyendo tu idea…", "trabajando");
  await sleep(900, signal);
  editLog(id, reading, `Tema válido: ${niche.label.toLowerCase()}`, "hecho");
  await sleep(700, signal);
  log(id, "investigador", `Público: ${start.audience.charAt(0).toLowerCase()}${start.audience.slice(1)}`);
  await sleep(600, signal);
  if (start.sensitivity !== "ninguno") {
    log(id, "investigador", "Tema sensible: se incluirá un aviso legal");
    await sleep(500, signal);
  }

  const outline = generateOutline(start.prompt, start.nicheId, start.desiredChapters);
  updateEbook(id, (e) => ({ ...e, title: outline.title, subtitle: outline.subtitle }));
  const total = outline.items.length;
  const proposing = log(id, "investigador", `Proponiendo capítulos · 0 de ${total}`, "trabajando");
  for (let k = 0; k < total; k++) {
    await sleep(650, signal);
    const item = outline.items[k];
    updateEbook(id, (e) => ({ ...e, chapters: [...e.chapters, { ...item, number: k + 1, status: "pendiente" }] }));
    editLog(id, proposing, `Proponiendo capítulos · ${k + 1} de ${total}`, "trabajando");
  }
  await sleep(500, signal);
  editLog(id, proposing, `Índice propuesto: ${total} capítulos`, "hecho");
  updateEbook(id, (e) => ({ ...e, status: "indice_pendiente" }));
  announce("Es tu turno: revisa el índice.");
}

// ---------- Redactor + Ejercicios ----------

interface WriteOptions {
  adjustments?: ChapterAdjustChip[];
  note?: string;
  version?: number;
}

async function writeChapter(id: string, number: number, signal: AbortSignal, opts: WriteOptions = {}) {
  const ebook = getEbook(id);
  const chapter = ebook?.chapters.find((c) => c.number === number);
  if (!ebook || !chapter) return;

  const content = generateChapter({
    ebookSeed: ebook.id,
    nicheId: ebook.nicheId,
    number,
    total: ebook.chapters.length,
    item: chapter,
    exercisePref: ebook.exercisePref,
    adjustments: opts.adjustments,
    note: opts.note,
    version: opts.version,
  });

  patchChapter(id, number, (c) => ({
    ...c,
    status: "generando",
    currentSection: "introduccion",
    sections: { introduccion: "", desarrollo: "", ejemplos: "", conclusion: "" },
    exercise: undefined,
  }));
  const entry = log(id, "redactor", `Escribiendo el capítulo ${number}: Introducción`, "trabajando");

  const shouldFail = simSettings.simulateError && number === 4 && !errorsShown.has(id);

  for (const section of SECTION_ORDER) {
    patchChapter(id, number, (c) => ({ ...c, currentSection: section }));
    editLog(id, entry, `Escribiendo el capítulo ${number}: ${SECTION_LABELS[section]}`, "trabajando");
    const tokens = content.sections[section].split(/(\s+)/);
    for (let i = 0; i < tokens.length; i += 6) {
      await sleep(42, signal);
      const chunk = tokens.slice(i, i + 6).join("");
      patchChapter(id, number, (c) => ({
        ...c,
        sections: { ...c.sections!, [section]: (c.sections?.[section] ?? "") + chunk },
      }));
      if (shouldFail && section === "desarrollo" && i > 30) {
        errorsShown.add(id);
        throw new SimulatedFailure(number);
      }
    }
    await sleep(250, signal);
  }
  editLog(id, entry, `Capítulo ${number} escrito`, "hecho");

  patchChapter(id, number, (c) => ({ ...c, currentSection: "ejercicio" }));
  const exEntry = log(
    id,
    "ejercicios",
    content.exercise?.type === "reto" ? `Creando un ${content.exercise.title.toLowerCase()}` : "Creando un checklist de autoevaluación",
    "trabajando",
  );
  await sleep(1100, signal);
  patchChapter(id, number, (c) => ({ ...c, exercise: content.exercise, currentSection: undefined, status: "generado" }));
  editLog(id, exEntry, `Ejercicio del capítulo ${number} listo`, "hecho");
}

async function writeFirst(id: string, signal: AbortSignal) {
  updateEbook(id, (e) => ({ ...e, status: "redactando_cap1", error: undefined }));
  await writeChapter(id, 1, signal, { version: 1 });
  updateEbook(id, (e) => ({ ...e, status: "cap1_pendiente", chapterOneVersion: 1 }));
  announce("Es tu turno: revisa el capítulo 1.");
}

async function writeRest(id: string, signal: AbortSignal) {
  updateEbook(id, (e) => ({ ...e, status: "redactando", error: undefined }));
  const ebook = getEbook(id);
  if (!ebook) return;
  for (const chapter of ebook.chapters) {
    const current = getEbook(id)?.chapters.find((c) => c.number === chapter.number);
    if (!current || ["generado", "aprobado", "editado"].includes(current.status)) continue;
    try {
      await writeChapter(id, chapter.number, signal);
      announce(`Capítulo ${chapter.number} terminado.`);
    } catch (err) {
      if (err instanceof SimulatedFailure) {
        patchChapter(id, err.chapter, (c) => ({ ...c, status: "error", currentSection: undefined }));
        updateEbook(id, (e) => ({
          ...e,
          status: "error",
          activity: e.activity.map((a) => (a.state === "trabajando" ? { ...a, state: "hecho" } : a)),
          error: {
            message: `No pudimos terminar el capítulo ${err.chapter}`,
            chapter: err.chapter,
            retryable: true,
            resumeStatus: "redactando",
          },
        }));
        announce(`No pudimos terminar el capítulo ${err.chapter}. Puedes reintentarlo.`);
        return;
      }
      throw err;
    }
  }
  await finish(id, signal);
}

async function finish(id: string, signal: AbortSignal) {
  updateEbook(id, (e) => ({ ...e, status: "maquetando" }));
  const entry = log(id, "maquetador", "Armando la portada, el aviso legal y el índice", "trabajando");
  await sleep(2400, signal);
  editLog(id, entry, "Libro armado", "hecho");
  updateEbook(id, (e) => ({ ...e, status: "listo" }));
  announce("Tu ebook está listo.");
}

// ---------- API pública del simulador ----------

export const simulator = {
  startResearch(id: string) {
    run(id, (signal) => research(id, signal));
  },

  approveOutline(id: string) {
    updateEbook(id, (e) => ({ ...e, chapters: toChapters(e.chapters) }));
    run(id, (signal) => writeFirst(id, signal));
  },

  regenerateOutline(id: string, feedback: string) {
    const ebook = getEbook(id);
    if (!ebook) return;
    const snapshot: OutlineItem[] = ebook.chapters.map(({ id: cid, title, summary, keyPoints }) => ({ id: cid, title, summary, keyPoints }));
    updateEbook(id, (e) => ({
      ...e,
      outlineHistory: [...e.outlineHistory, snapshot],
      busy: { kind: "indice", message: "El Investigador está preparando otra versión…" },
    }));
    run(id, async (signal) => {
      const entry = log(id, "investigador", feedback ? `Rehaciendo el índice: “${feedback.slice(0, 60)}”` : "Rehaciendo el índice", "trabajando");
      await sleep(2600, signal);
      const current = getEbook(id)!;
      const outline = generateOutline(current.prompt, current.nicheId, current.desiredChapters, current.outlineHistory.length);
      updateEbook(id, (e) => ({ ...e, chapters: toChapters(outline.items), busy: undefined }));
      editLog(id, entry, "Nueva versión del índice lista", "hecho");
      announce("Nueva versión del índice lista.");
    });
  },

  regenerateOutlineItem(id: string, chapterId: string) {
    updateEbook(id, (e) => ({ ...e, busy: { kind: "capitulo_indice", chapterId, message: "Buscando otra propuesta para este capítulo…" } }));
    run(id, async (signal) => {
      await sleep(1500, signal);
      updateEbook(id, (e) => {
        const target = e.chapters.find((c) => c.id === chapterId);
        if (!target) return { ...e, busy: undefined };
        const alt = regenerateOutlineItem(e.nicheId, target, e.chapters.map((c) => c.title));
        return {
          ...e,
          busy: undefined,
          chapters: e.chapters.map((c) => (c.id === chapterId ? { ...c, ...alt } : c)),
        };
      });
      announce("Capítulo reemplazado en el índice.");
    });
  },

  approveChapterOne(id: string) {
    patchChapter(id, 1, (c) => ({ ...c, status: c.status === "editado" ? "editado" : "aprobado" }));
    run(id, (signal) => writeRest(id, signal));
  },

  adjustChapterOne(id: string, adjustments: ChapterAdjustChip[], note: string) {
    const ebook = getEbook(id);
    const ch1 = ebook?.chapters[0];
    if (!ebook || !ch1?.sections) return;
    updateEbook(id, (e) => ({
      ...e,
      chapterOneHistory: [...e.chapterOneHistory, { sections: ch1.sections!, exercise: ch1.exercise }],
      busy: { kind: "capitulo1", message: "El Redactor está aplicando tus ajustes…" },
    }));
    run(id, async (signal) => {
      const version = (getEbook(id)?.chapterOneVersion ?? 1) + 1;
      await writeChapter(id, 1, signal, { adjustments, note, version });
      updateEbook(id, (e) => ({ ...e, busy: undefined, chapterOneVersion: version }));
      announce(`Versión ${version} del capítulo 1 lista.`);
    });
  },

  retry(id: string) {
    const ebook = getEbook(id);
    if (!ebook?.error) return;
    const failed = ebook.error.chapter;
    if (failed) patchChapter(id, failed, (c) => ({ ...c, status: "pendiente", sections: undefined, exercise: undefined }));
    run(id, (signal) => writeRest(id, signal));
  },

  /** Retoma el trabajo interrumpido al recargar (en la fase 4 lo hará el servidor). */
  resume(ebook: Ebook) {
    const id = ebook.id;
    if (tasks.has(id)) return;
    if (ebook.busy) {
      updateEbook(id, (e) => {
        if (e.busy?.kind === "capitulo1" && e.chapterOneHistory.length) {
          const prev = e.chapterOneHistory[e.chapterOneHistory.length - 1];
          return {
            ...e,
            busy: undefined,
            chapterOneHistory: e.chapterOneHistory.slice(0, -1),
            chapters: e.chapters.map((c) => (c.number === 1 ? { ...c, ...prev, status: "generado", currentSection: undefined } : c)),
          };
        }
        return { ...e, busy: undefined };
      });
    }
    switch (ebook.status) {
      case "investigando":
        run(id, (signal) => research(id, signal));
        break;
      case "redactando_cap1":
        run(id, (signal) => writeFirst(id, signal));
        break;
      case "redactando":
        updateEbook(id, (e) => ({
          ...e,
          chapters: e.chapters.map((c) => (c.status === "generando" ? { ...c, status: "pendiente", sections: undefined, exercise: undefined, currentSection: undefined } : c)),
        }));
        run(id, (signal) => writeRest(id, signal));
        break;
      case "maquetando":
        run(id, (signal) => finish(id, signal));
        break;
    }
  },
};
