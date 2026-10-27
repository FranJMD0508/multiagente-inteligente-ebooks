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

export type CoverTemplate = "clasica" | "centrada" | "franja" | "marco" | "editorial";
export type BookFont = "Roboto" | "Arial" | "Helvetica";
export type PageSize = "A5" | "A4" | "Carta" | "6x9";
/** Letra del título de la portada (sin serif "elegantes", D-19). */
export type TitleFont = "Lexend" | "Onest" | "Roboto";
export type TitleSize = "s" | "m" | "l";
export type TitleAlign = "start" | "center";

/** Imagen propia en la portada (D-15). */
export interface CoverImage {
  /** data: URL en el modo demo; URL del servidor (/api/assets/…) con backend. */
  src: string;
  /** "fondo": cubre la portada bajo un velo del color de tela; "recuadro": va en una ventana. */
  placement: "fondo" | "recuadro";
  /** Opacidad del velo de tela sobre la imagen de fondo (0 a 1). */
  veil: number;
  /** Velo mínimo para que el texto blanco tenga un contraste de 4,5:1 o más sobre la imagen. */
  minVeil: number;
  /** Encuadre vertical de la imagen (0 = arriba, 100 = abajo). */
  focusY: number;
  /** Texto alternativo para lectores de pantalla. */
  alt: string;
  /**
   * Color medio (RGB) de las zonas más claras, del que salen el velo mínimo y el contraste
   * que muestra el panel. Con backend lo calcula el servidor, que es quien manda.
   */
  bright?: [number, number, number] | null;
}

export interface BackCover {
  enabled: boolean;
  /** Sinopsis de la contraportada (la propone el Maquetador; el usuario la edita). */
  blurb: string;
}

export interface EbookDesign {
  coverTemplate: CoverTemplate;
  clothColor: string;
  titleFont: TitleFont;
  titleSize: TitleSize;
  titleAlign: TitleAlign;
  coverImage?: CoverImage;
  backCover: BackCover;
  font: BookFont;
  bodySizePt: 11 | 12 | 13;
  pageSize: PageSize;
  author: string;
}

// ---------- Referencias bibliográficas ----------

export type ReferenceKind = "libro" | "articulo" | "web";
/**
 * verificada: existe en Crossref u Open Library · no_encontrada: no aparece (posible invención)
 * pendiente: se está comprobando · sin_verificar: no se pudo consultar (sin conexión o sin datos suficientes)
 */
export type ReferenceCheck = "verificada" | "no_encontrada" | "pendiente" | "sin_verificar";

export interface ReferenceData {
  kind: ReferenceKind;
  /** Un autor por elemento, en la forma "Apellido, Nombre" (o el nombre de una organización). */
  authors: string[];
  /** Año ("2018") o "s. f." si no tiene fecha. */
  year: string;
  title: string;
  /** Editorial (libro) o nombre del sitio (web). */
  publisher?: string;
  /** Número de edición, solo si no es la primera ("3"). */
  edition?: string;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  doi?: string;
  isbn?: string;
  url?: string;
}

export interface Reference extends ReferenceData {
  id: string;
  /** Capítulos con los que se relaciona (puede estar vacío). */
  chapters: number[];
  origin: "sugerida" | "usuario";
  check: ReferenceCheck;
  checkedWith?: "crossref" | "openlibrary";
  /** Datos de la fuente consultada cuando no coinciden con los guardados (para corregir con un clic). */
  match?: Partial<ReferenceData>;
  /** Por qué se sugiere esta lectura (solo las sugeridas por el Investigador). */
  note?: string;
}

/** Resultado de buscar por DOI, ISBN o título. */
export interface ReferenceCandidate extends ReferenceData {
  source: "crossref" | "openlibrary";
}

export type TopicCheck =
  | { ok: true; nicheId?: string }
  | { ok: false; reason: string; alternatives: string[] };

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
  /** Si el guardarraíl rechazó el tema (ficción): ideas alternativas. */
  alternatives?: string[];
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
  /** Referencias y lecturas recomendadas (sección final del libro, en APA 7). */
  references: Reference[];
  /** pendiente: aún no se piden · sugiriendo: el Investigador las busca · listo · error. */
  referencesState: "pendiente" | "sugiriendo" | "listo" | "error";
  activity: ActivityEntry[];
  busy?: BusyState;
  error?: EbookError;
  createdAt: string;
  updatedAt: string;
  /**
   * Revisión del servidor: sube con cada cambio y con cada trozo de texto en streaming.
   * Sirve para descartar una instantánea anterior a la que ya se tiene (solo con backend).
   */
  rev?: number;
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
