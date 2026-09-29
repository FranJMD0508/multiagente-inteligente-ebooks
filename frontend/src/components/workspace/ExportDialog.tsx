"use client";

import { Download, FileText, Info } from "lucide-react";
import { RadioGroup } from "radix-ui";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { FieldShell, Input } from "@/components/ui/Field";
import { wordCount } from "@/lib/api/mock/content";
import { cn } from "@/lib/cn";
import { PAGE_SIZES } from "@/lib/design";
import { estimatePages } from "@/lib/format";
import { buildMarkdown, downloadText, slugify } from "@/lib/markdown";
import { printUrl } from "@/lib/routes";
import type { Ebook } from "@/lib/types";

type Format = "pdf" | "md";

export function ExportDialog({ ebook, open, onOpenChange }: { ebook: Ebook; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [format, setFormat] = useState<Format>("pdf");
  const [name, setName] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const slug = slugify(ebook.title);
  const filename = name ?? `${slug}.${format}`;
  const words = ebook.chapters.reduce((acc, c) => acc + wordCount(c.sections), 0);
  const pages = estimatePages(words, ebook.design.pageSize, ebook.chapters.length, ebook.sensitivity !== "ninguno");
  const page = PAGE_SIZES.find((p) => p.id === ebook.design.pageSize)?.label;

  function download() {
    if (format === "md") {
      const file = filename.endsWith(".md") ? filename : `${filename.replace(/\.[a-z]+$/i, "")}.md`;
      downloadText(file, buildMarkdown(ebook));
      setDone("Tu archivo Markdown se descargó.");
    } else {
      window.open(printUrl(ebook.id, filename.replace(/\.pdf$/i, "")), "_blank", "noopener");
      setDone("Se abrió la vista de impresión en otra pestaña. Elige «Guardar como PDF».");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setDone(null);
          setName(null);
        }
        onOpenChange(o);
      }}
      title="Exportar tu ebook"
    >
      <div className="grid gap-4">
        <RadioGroup.Root
          aria-label="Formato"
          value={format}
          onValueChange={(v) => {
            setFormat(v as Format);
            setName(null);
            setDone(null);
          }}
          className="grid grid-cols-2 gap-2"
        >
          {[
            { value: "pdf", title: "PDF", text: "Listo para leer, compartir o vender" },
            { value: "md", title: "Markdown", text: "Texto limpio para otras herramientas" },
          ].map((o) => (
            <RadioGroup.Item
              key={o.value}
              value={o.value}
              className={cn(
                "grid gap-0.5 rounded-2xl border px-3.5 py-3 text-left transition-colors",
                format === o.value ? "border-tinta bg-menta/50 ring-1 ring-tinta" : "border-borde-control hover:border-tenue",
              )}
            >
              <span className="flex items-center gap-1.5 text-[15px] font-semibold">
                <FileText className="size-4 text-tinta" aria-hidden /> {o.title}
              </span>
              <span className="text-[13px] text-grafito">{o.text}</span>
            </RadioGroup.Item>
          ))}
        </RadioGroup.Root>

        <FieldShell label="Nombre del archivo">
          {(id) => <Input id={id} value={filename} onChange={(e) => setName(e.target.value)} />}
        </FieldShell>

        <ul className="flex flex-wrap gap-1.5" aria-label="Resumen del archivo">
          {[
            `${ebook.chapters.length} capítulos`,
            `unas ${pages} páginas`,
            ebook.sensitivity !== "ninguno" ? "Aviso legal incluido" : "Sin aviso legal",
            `${page} · ${ebook.design.font} ${ebook.design.bodySizePt} pt`,
          ].map((t) => (
            <li key={t} className="rounded-full bg-control px-2.5 py-1 text-[12.5px] text-texto">
              {t}
            </li>
          ))}
        </ul>

        {format === "pdf" && (
          <p className="text-[13px] text-grafito">
            En esta versión el PDF se genera desde el navegador: se abrirá la vista de impresión y ahí eliges «Guardar como PDF».
          </p>
        )}

        <p className="flex items-center gap-2 text-[13px] text-grafito">
          <Info className="size-4 flex-none text-tinta" aria-hidden />
          Contenido original generado con asistencia de IA.
        </p>

        {done && (
          <p role="status" className="rounded-xl bg-menta px-3 py-2 text-[13.5px] text-tinta-oscura">
            {done}
          </p>
        )}

        <div className="mt-1 flex justify-end gap-2">
          <Button onClick={() => onOpenChange(false)}>{done ? "Cerrar" : "Cancelar"}</Button>
          <Button variant="primario" onClick={download}>
            <Download /> {format === "pdf" ? "Descargar PDF" : "Descargar Markdown"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
