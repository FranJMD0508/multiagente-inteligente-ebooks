import { SECTION_LABELS, type Ebook, type EbookStatus } from "./types";

export type PhaseState = "espera" | "trabajando" | "tu_turno" | "listo" | "error";

export interface Phase {
  key: string;
  label: string;
  who: string;
  state: PhaseState;
}

const STEP: Record<Exclude<EbookStatus, "error">, number> = {
  investigando: 0,
  indice_pendiente: 1,
  redactando_cap1: 2,
  cap1_pendiente: 3,
  redactando: 4,
  maquetando: 5,
  listo: 6,
};

export function stepOf(ebook: Ebook): number {
  if (ebook.status === "error") return STEP[(ebook.error?.resumeStatus ?? "redactando") as Exclude<EbookStatus, "error">] ?? 4;
  return STEP[ebook.status];
}

/** Capítulo que se está escribiendo ahora mismo, si lo hay. */
export function writingChapter(ebook: Ebook) {
  return ebook.chapters.find((c) => c.status === "generando");
}

/** Fases visibles del proceso (docs/07 §6.1). */
export function derivePhases(ebook: Ebook): Phase[] {
  const step = stepOf(ebook);
  const busy = ebook.busy;
  const expected = ebook.desiredChapters === "auto" ? 6 : ebook.desiredChapters;
  const total = ebook.status === "investigando" ? expected : ebook.chapters.length || expected;
  const writing = writingChapter(ebook);
  const at = (target: number, working: boolean, turn = false): PhaseState => {
    if (step > target) return "listo";
    if (step === target) return turn ? "tu_turno" : working ? "trabajando" : "espera";
    return "espera";
  };

  const indexWorking = step === 0 || (step === 1 && (busy?.kind === "indice" || busy?.kind === "capitulo_indice"));
  const ch1Working = step === 2 || (step === 3 && busy?.kind === "capitulo1");

  let restWho = "Redactor + Ejercicios";
  if (step === 4 && writing) {
    restWho = writing.currentSection === "ejercicio" ? `Ejercicios · capítulo ${writing.number}` : `Redactor escribiendo el ${writing.number}`;
  }

  const phases: Phase[] = [
    { key: "indice", label: "Índice", who: "Investigador", state: indexWorking ? "trabajando" : step >= 1 ? "listo" : "espera" },
    { key: "rev-indice", label: "Revisión del índice", who: "Tú", state: step === 1 ? (busy ? "espera" : "tu_turno") : at(1, false) },
    { key: "cap1", label: "Capítulo 1", who: step === 2 && writing?.currentSection === "ejercicio" ? "Ejercicios" : "Redactor + Ejercicios", state: ch1Working ? "trabajando" : at(2, false) },
    { key: "rev-cap1", label: "Revisión del capítulo 1", who: "Tú", state: step === 3 ? (busy ? "espera" : "tu_turno") : at(3, false) },
    { key: "resto", label: `Capítulos 2 a ${total}`, who: restWho, state: at(4, true) },
    { key: "final", label: "Libro final", who: "Maquetador", state: at(5, true) },
  ];

  if (ebook.status === "error") {
    const failed = phases[4];
    failed.state = "error";
    failed.who = ebook.error?.chapter ? `Falló el capítulo ${ebook.error.chapter}` : "Con error";
  }
  return phases;
}

export function currentSectionLabel(ebook: Ebook): string | null {
  const w = writingChapter(ebook);
  if (!w?.currentSection) return null;
  return w.currentSection === "ejercicio" ? "Ejercicio práctico" : SECTION_LABELS[w.currentSection];
}

export type LibraryGroup = "turno" | "progreso" | "listo" | "error";

export function statusInfo(ebook: Ebook): { label: string; detail: string; group: LibraryGroup } {
  const done = ebook.chapters.filter((c) => ["generado", "aprobado", "editado"].includes(c.status)).length;
  switch (ebook.status) {
    case "indice_pendiente":
      return { label: "Tu turno", detail: "Revisar índice", group: "turno" };
    case "cap1_pendiente":
      return { label: "Tu turno", detail: "Revisar capítulo 1", group: "turno" };
    case "investigando":
      return { label: "Investigando", detail: "Armando el índice", group: "progreso" };
    case "redactando_cap1":
      return { label: "Escribiendo", detail: "Capítulo 1", group: "progreso" };
    case "redactando":
      return { label: "Escribiendo", detail: `${done} de ${ebook.chapters.length}`, group: "progreso" };
    case "maquetando":
      return { label: "Maquetando", detail: "Armando el libro", group: "progreso" };
    case "error":
      return { label: "Con error", detail: ebook.error?.message ?? "", group: "error" };
    default:
      return { label: "Listo", detail: "", group: "listo" };
  }
}
