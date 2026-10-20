// Ensamblado del ebook en Markdown (RF-06, RA-01): portada → aviso legal →
// índice → capítulos → referencias → contraportada, con jerarquía H1/H2/H3.
// Con backend lo hace el Agente Maquetador (backend/app/export/markdown.py);
// aquí sirve para el modo demo. Las dos versiones producen el mismo archivo.

import { DISCLAIMERS } from "./guardrails";
import { formatReferenceMarkdown, sortReferences } from "./references/apa";
import { SECTION_LABELS, SECTION_ORDER, type Ebook, type Exercise } from "./types";

export function exerciseToMarkdown(ex: Exercise): string {
  if (ex.type === "checklist") {
    return [`**${ex.title}**`, "", ...ex.items.map((i) => `- [ ] ${i}`)].join("\n");
  }
  return [`**${ex.title}**`, "", ...ex.steps.map((s, i) => `${i + 1}. ${s}`)].join("\n");
}

export function buildMarkdown(ebook: Ebook): string {
  const out: string[] = [];
  out.push(`# ${ebook.title}`);
  if (ebook.subtitle) out.push("", `*${ebook.subtitle}*`);
  if (ebook.design.author) out.push("", `Por ${ebook.design.author}`);

  if (ebook.sensitivity !== "ninguno") {
    out.push("", "## Aviso legal", "", `> ${DISCLAIMERS[ebook.sensitivity].text}`);
  }

  out.push("", "## Índice", "");
  ebook.chapters.forEach((c) => out.push(`${c.number}. ${c.title}`));
  const refs = sortReferences(ebook.references ?? []);

  for (const c of ebook.chapters) {
    out.push("", "---", "", `# Capítulo ${c.number}: ${c.title}`);
    if (!c.sections) continue;
    for (const s of SECTION_ORDER) {
      out.push("", `## ${SECTION_LABELS[s]}`, "", c.sections[s].trim());
    }
    if (c.exercise) out.push("", "## Ejercicio práctico", "", exerciseToMarkdown(c.exercise));
  }

  if (refs.length) {
    out.push("", "---", "", "# Referencias");
    refs.forEach((r) => out.push("", formatReferenceMarkdown(r)));
  }

  const back = ebook.design.backCover;
  if (back?.enabled && back.blurb.trim()) out.push("", "---", "", "# Sobre este libro", "", back.blurb.trim());

  // Marca legible por máquina de contenido generado con IA (P-11, AI Act art. 50.2).
  const date = new Date().toISOString().slice(0, 10);
  out.push(
    "",
    "---",
    "",
    "*Contenido original generado con asistencia de IA.*",
    "",
    `<!-- folio: generado-con-ia=true; herramienta=Folio; proveedor=demo; fecha=${date} -->`,
    "",
  );
  return out.join("\n");
}

export function slugify(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "ebook"
  );
}

export function downloadText(filename: string, text: string, mime = "text/markdown;charset=utf-8") {
  downloadBlob(filename, new Blob([text], { type: mime }));
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
