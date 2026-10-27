"use client";

import { CircleAlert, Download, FileText, Info } from "lucide-react";
import { RadioGroup } from "radix-ui";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { FieldShell, Input } from "@/components/ui/Field";
import { api, IS_DEMO } from "@/lib/api";
import type { ExportFormat } from "@/lib/api/contract";
import { wordCount } from "@/lib/api/mock/content";
import { cn } from "@/lib/cn";
import { contrastRatio, PAGE_SIZES } from "@/lib/design";
import { estimatePages, pluralize } from "@/lib/format";
import { slugify } from "@/lib/markdown";
import type { Ebook } from "@/lib/types";

interface ExportDialogProps {
  ebook: Ebook;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Lleva a la pestaña Referencias para revisar las que no se encontraron. */
  onReviewReferences?: () => void;
}

export function ExportDialog({ ebook, open, onOpenChange, onReviewReferences }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [name, setName] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const slug = slugify(ebook.title);
  const filename = name ?? `${slug}.${format}`;
  const words = ebook.chapters.reduce((acc, c) => acc + wordCount(c.sections), 0);
  const pages = estimatePages(words, ebook.design.pageSize, ebook.chapters.length, ebook.sensitivity !== "ninguno");
  const page = PAGE_SIZES.find((p) => p.id === ebook.design.pageSize)?.label;
  const refs = ebook.references.length;
  const missing = ebook.references.filter((r) => r.check === "no_encontrada").length;
  const lowContrast = contrastRatio(ebook.design.clothColor, "#FFFFFF") < 4.5;

  async function download() {
    setError(null);
    setDone(null);
    setWorking(true);
    try {
      setDone(await api.exportEbook(ebook.id, format, filename));
    } catch (err) {
      setError((err as Error).message || "No pudimos exportar el libro. Inténtalo de nuevo.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setDone(null);
          setError(null);
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
            setFormat(v as ExportFormat);
            setName(null);
            setDone(null);
            setError(null);
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
            refs ? pluralize(refs, "referencia en APA 7", "referencias en APA 7") : "Sin referencias",
            ebook.design.backCover.enabled && ebook.design.backCover.blurb.trim() ? "Con contraportada" : "Sin contraportada",
            `${page} · ${ebook.design.font} ${ebook.design.bodySizePt} pt`,
          ].map((t) => (
            <li key={t} className="rounded-full bg-control px-2.5 py-1 text-[12.5px] text-texto">
              {t}
            </li>
          ))}
        </ul>

        {lowContrast && (
          <p className="flex items-center gap-2 rounded-xl bg-error-suave px-3 py-2 text-[13px] text-texto">
            <CircleAlert className="size-4 flex-none text-error" aria-hidden />
            {IS_DEMO
              ? "El color de tela elegido no tiene contraste suficiente: se exportará con un tono más oscuro del mismo color, que sí lo tiene."
              : "El color de tela elegido no tiene contraste suficiente: se exportará con el último color válido."}
          </p>
        )}

        {missing > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-error-suave px-3 py-2 text-[13px] text-texto">
            <CircleAlert className="size-4 flex-none text-error" aria-hidden />
            {missing === 1 ? "Una referencia no se encontró" : `${missing} referencias no se encontraron`} en Crossref ni en Open
            Library.
            {onReviewReferences && (
              <button
                type="button"
                onClick={onReviewReferences}
                className="font-medium text-texto underline decoration-error/50 underline-offset-4 hover:decoration-error"
              >
                Revisarlas
              </button>
            )}
          </div>
        )}

        {format === "pdf" && IS_DEMO && (
          <p className="text-[13px] text-grafito">
            En la versión de demostración el PDF se genera desde el navegador: se abrirá la vista de impresión y ahí eliges «Guardar como PDF».
          </p>
        )}
        {format === "pdf" && !IS_DEMO && (
          <p className="text-[13px] text-grafito">El Maquetador arma el PDF etiquetado en el servidor; tarda unos segundos.</p>
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
        {error && (
          <p role="alert" className="rounded-xl bg-error-suave px-3 py-2 text-[13.5px] text-texto">
            {error}
          </p>
        )}

        <div className="mt-1 flex justify-end gap-2">
          <Button onClick={() => onOpenChange(false)}>{done ? "Cerrar" : "Cancelar"}</Button>
          <Button variant="primario" onClick={download} disabled={working} aria-busy={working}>
            {working ? (
              <span aria-hidden className="anillo size-4 [--fondo-anillo:var(--tinta)] [background:conic-gradient(var(--sobre-tinta)_0_30%,color-mix(in_oklab,var(--sobre-tinta)_35%,transparent)_30%_100%)]" />
            ) : (
              <Download />
            )}
            {working ? "Preparando…" : format === "pdf" ? "Descargar PDF" : "Descargar Markdown"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
