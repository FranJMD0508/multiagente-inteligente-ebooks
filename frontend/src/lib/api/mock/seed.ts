// Datos de demostración: una biblioteca con libros en distintas etapas.

import { getNiche } from "@/lib/niches";
import type { ActivityEntry, Chapter, Ebook, EbookStatus } from "@/lib/types";
import { uid } from "@/lib/uid";
import { generateChapter, generateOutline } from "./content";

interface SeedSpec {
  nicheId: string;
  status: EbookStatus;
  written: number; // capítulos ya escritos
  hoursAgo: number;
  chapters: 5 | 6 | 7;
}

const SPECS: SeedSpec[] = [
  { nicheId: "tiempo", status: "indice_pendiente", written: 0, hoursAgo: 1, chapters: 6 },
  { nicheId: "conflictos", status: "cap1_pendiente", written: 1, hoursAgo: 5, chapters: 6 },
  { nicheId: "finanzas", status: "listo", written: 6, hoursAgo: 49, chapters: 6 },
  { nicheId: "empleo", status: "listo", written: 5, hoursAgo: 24 * 8, chapters: 5 },
];

function done(agent: ActivityEntry["agent"], message: string): ActivityEntry {
  return { id: uid(), agent, message, state: "hecho" };
}

export function createSeedEbooks(author: string): Ebook[] {
  return SPECS.map((spec) => {
    const niche = getNiche(spec.nicheId);
    const id = uid();
    const outline = generateOutline(niche.idea, niche.id, spec.chapters);
    const chapters: Chapter[] = outline.items.map((item, i) => {
      const number = i + 1;
      if (number > spec.written) return { ...item, number, status: "pendiente" };
      const content = generateChapter({
        ebookSeed: id,
        nicheId: niche.id,
        number,
        total: outline.items.length,
        item,
        exercisePref: "auto",
        version: 1,
      });
      return {
        ...item,
        number,
        status: number === 1 && spec.status !== "cap1_pendiente" ? "aprobado" : "generado",
        sections: content.sections,
        exercise: content.exercise,
      };
    });
    const date = new Date(Date.now() - spec.hoursAgo * 3600_000).toISOString();
    const activity: ActivityEntry[] = [
      done("investigador", `Tema válido: ${niche.label.toLowerCase()}`),
      done("investigador", `Índice propuesto: ${chapters.length} capítulos`),
    ];
    if (spec.written >= 1) activity.push(done("redactor", "Capítulo 1 escrito"));
    if (spec.status === "listo") activity.push(done("maquetador", "Libro armado"));
    return {
      id,
      title: outline.title,
      subtitle: outline.subtitle,
      prompt: niche.idea,
      nicheId: niche.id,
      audience: niche.audience,
      desiredChapters: spec.chapters,
      exercisePref: "auto",
      status: spec.status,
      sensitivity: niche.sensitivity,
      chapters,
      outlineHistory: [],
      chapterOneHistory: [],
      chapterOneVersion: spec.written >= 1 ? 1 : 0,
      design: {
        coverTemplate: "clasica",
        clothColor: niche.cloth,
        font: "Roboto",
        bodySizePt: 11,
        pageSize: "A5",
        author,
      },
      activity,
      createdAt: date,
      updatedAt: date,
    } satisfies Ebook;
  });
}
