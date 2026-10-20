// Interfaz común de la capa de datos. La cumplen el modo demo (todo en el
// navegador, mock/api.ts) y el modo con backend (FastAPI + SSE, http/api.ts).
// Los componentes solo conocen esta interfaz (a través de `api`).

import type {
  ChapterAdjustChip,
  EbookDesign,
  NewEbookInput,
  ReferenceCandidate,
  ReferenceData,
  SectionId,
  TopicCheck,
} from "@/lib/types";

export type ReferencePatch = Partial<ReferenceData> & { chapters?: number[] };
export type ExportFormat = "pdf" | "md";

export interface FolioApi {
  /** Carga la biblioteca del usuario y retoma o escucha el trabajo pendiente. */
  openLibrary(owner: string, author: string): void;
  /** Guardarraíl de entrada (RF-01): ficción o tema fuera de alcance. */
  checkTopic(prompt: string): Promise<TopicCheck>;
  createEbook(input: NewEbookInput): string;

  // Punto de control 1: índice
  updateOutlineItem(id: string, chapterId: string, patch: { title?: string; summary?: string }): void;
  addOutlineItem(id: string): string | null;
  removeOutlineItem(id: string, chapterId: string): void;
  reorderOutline(id: string, orderedIds: string[]): void;
  regenerateOutline(id: string, feedback: string): void;
  regenerateOutlineItem(id: string, chapterId: string): void;
  restorePreviousOutline(id: string): void;
  cancelBusy(id: string): void;
  approveOutline(id: string): void;

  // Punto de control 2: capítulo 1
  adjustChapterOne(id: string, chips: ChapterAdjustChip[], note: string): void;
  restorePreviousChapterOne(id: string): void;
  editChapterOneManually(id: string, sections: Record<SectionId, string>): void;
  approveChapterOne(id: string): void;

  // Edición, portada y estilo
  editSection(id: string, number: number, section: SectionId, text: string): void;
  updateDesign(id: string, patch: Partial<EbookDesign>): void;
  /** Sube una imagen de portada; lanza un Error con un mensaje para mostrar si no se puede. */
  uploadCoverImage(id: string, file: File): Promise<void>;
  removeCoverImage(id: string): void;
  /** El Maquetador propone otra sinopsis para la contraportada. */
  suggestBackCover(id: string): Promise<void>;
  updateMeta(id: string, patch: { title?: string; subtitle?: string }): void;
  retry(id: string): void;

  // Referencias
  lookupReferences(query: string): Promise<ReferenceCandidate[]>;
  addReference(id: string, data: ReferenceData, chapters?: number[]): void;
  updateReference(id: string, refId: string, patch: ReferencePatch): void;
  removeReference(id: string, refId: string): void;
  verifyReference(id: string, refId: string): void;
  acceptReferenceMatch(id: string, refId: string): void;
  suggestReferences(id: string): void;

  /** Exporta el libro. Devuelve el mensaje que se muestra al terminar. */
  exportEbook(id: string, format: ExportFormat, filename: string): Promise<string>;

  // Biblioteca
  duplicate(id: string): string | null;
  remove(id: string): void;
  clearLibrary(): void;
  restoreExamples(author: string): void;
}
