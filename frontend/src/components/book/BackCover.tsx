import { cn } from "@/lib/cn";
import { titleFontStack } from "@/lib/design";
import type { Ebook } from "@/lib/types";

/**
 * Contraportada (2:3, color de tela): título, sinopsis, autor y la nota de IA.
 * Medidas en cqw, como la portada, para que escale igual en la vista previa y en
 * el PDF (backend/app/export/templates).
 */
export function BackCover({ ebook, className }: { ebook: Ebook; className?: string }) {
  const d = ebook.design;
  const blurb = d.backCover.blurb.trim();
  // La sinopsis se achica si es larga, para que siempre quepa en la página.
  const words = blurb.split(/\s+/).filter(Boolean).length;
  const size = words > 110 ? 3.7 : words > 85 ? 4.1 : words > 60 ? 4.5 : 5;
  return (
    <div
      className={cn("portada portada-trasera @container", className)}
      style={{ ["--tela" as string]: d.clothColor }}
    >
      <div className="absolute inset-0 flex flex-col gap-[4.5cqw] overflow-hidden px-[11cqw] py-[11cqw]">
        <span className="text-[5.4cqw] font-semibold leading-tight tracking-[-0.01em] opacity-90" style={{ fontFamily: titleFontStack(d.titleFont) }}>
          {ebook.title}
        </span>
        <span aria-hidden className="h-px w-[16cqw] flex-none bg-white/60" />
        <p className={cn("leading-[1.48]", !blurb && "italic opacity-70")} style={{ fontSize: `${size}cqw` }}>
          {blurb || "Escribe la sinopsis o pide una propuesta al Maquetador."}
        </p>
        {d.author && <span className="text-[4.6cqw] opacity-90">{d.author}</span>}
        <span className="mt-auto text-[3.6cqw] leading-snug opacity-80">Contenido original generado con asistencia de IA.</span>
      </div>
    </div>
  );
}
