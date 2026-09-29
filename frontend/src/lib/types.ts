// Tipos del dominio de Folio. Siguen el contrato de docs/03-arquitectura.md §7:
// los cumplen los mocks de esta fase y, más adelante, la API real.

export type EbookStatus =
  | "investigando"
  | "indice_pendiente"
  | "redactando_cap1"
  | "cap1_pendiente"
  | "redactando"
  | "maquetando"
  | "listo"
  | "error";

export type Sensitivity =
  | "financiero"
  | "salud_emocional"
  | "salud_fisica"
  | "autoayuda_general"
  | "ninguno";

export type AgentId = "investigador" | "redactor" | "ejercicios" | "maquetador";

export type SectionId = "introduccion" | "desarrollo" | "ejemplos" | "conclusion";

export const SECTION_ORDER: SectionId[] = ["introduccion", "desarrollo", "ejemplos", "conclusion"];

export const SECTION_LABELS: Record<SectionId, string> = {
  introduccion: "Introducción",
  desarrollo: "Desarrollo",
  ejemplos: "Ejemplos cotidianos",
  conclusion: "Conclusión",
};

export type ChapterStatus = "pendiente" | "generando" | "generado" | "aprobado" | "editado" | "error";

export type Exercise =
  | { type: "checklist"; title: string; items: string[] }
  | { type: "reto"; title: string; duration: "24h" | "48h"; steps: string[] };

export type ExercisePref = "auto" | "checklist" | "reto";

export interface OutlineItem {
  id: string;
  title: string;
  summary: string;
  keyPoints: string[];
}

export interface ChapterContent {
  sections: Record<SectionId, string>;
  exercise?: Exercise;
}

export interface Chapter extends OutlineItem {
  number: number;
  status: ChapterStatus;
  sections?: Record<SectionId, string>;
  exercise?: Exercise;
  /** Sección que se está escribiendo ahora mismo (streaming). */
  currentSection?: SectionId | "ejercicio";
}

export type CoverTemplate = "clasica" | "centrada" | "franja";
export type BookFont = "Roboto" | "Arial" | "Helvetica";
export type PageSize = "A5" | "A4" | "Carta" | "6x9";

export interface EbookDesign {
  coverTemplate: CoverTemplate;
  clothColor: string;
  font: BookFont;
  bodySizePt: 11 | 12 | 13;
  pageSize: PageSize;
  author: string;
}

export interface ActivityEntry {
  id: string;
  agent: AgentId;
  message: string;
  state: "hecho" | "trabajando";
}

/** Trabajo en curso durante una pausa (regenerar índice, ajustar el capítulo 1…). */
export interface BusyState {
  kind: "indice" | "capitulo_indice" | "capitulo1";
  chapterId?: string;
  message: string;
}

export interface EbookError {
  message: string;
  chapter?: number;
  retryable: boolean;
  resumeStatus: EbookStatus;
}

export interface Ebook {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
  nicheId: string;
  audience: string;
  desiredChapters: 5 | 6 | 7 | "auto";
  exercisePref: ExercisePref;
  status: EbookStatus;
  sensitivity: Sensitivity;
  chapters: Chapter[];
  /** Versiones anteriores del índice (para volver atrás). */
  outlineHistory: OutlineItem[][];
  /** Versiones anteriores del capítulo 1 (para volver atrás). */
  chapterOneHistory: ChapterContent[];
  chapterOneVersion: number;
  design: EbookDesign;
  activity: ActivityEntry[];
  busy?: BusyState;
  error?: EbookError;
  createdAt: string;
  updatedAt: string;
}

export interface NewEbookInput {
  prompt: string;
  nicheId?: string;
  audience?: string;
  desiredChapters: 5 | 6 | 7 | "auto";
  exercisePref: ExercisePref;
  author: string;
}

export interface QuickAdjustments {
  chips: ChapterAdjustChip[];
  note: string;
}

export type ChapterAdjustChip = "mas_cercano" | "mas_ejemplos" | "mas_corto" | "menos_formal" | "otro_ejercicio";

export const ADJUST_CHIP_LABELS: Record<ChapterAdjustChip, string> = {
  mas_cercano: "Más cercano",
  mas_ejemplos: "Más ejemplos",
  mas_corto: "Más corto",
  menos_formal: "Menos formal",
  otro_ejercicio: "Otro tipo de ejercicio",
};

export const MIN_CHAPTERS = 5;
export const MAX_CHAPTERS = 7;
