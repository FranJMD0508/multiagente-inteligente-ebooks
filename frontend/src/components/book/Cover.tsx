import { cn } from "@/lib/cn";
import type { CoverTemplate } from "@/lib/types";

interface CoverProps {
  title: string;
  subtitle?: string;
  author?: string;
  cloth: string;
  template?: CoverTemplate;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Portada del ebook (proporción 2:3, lomo sombreado). Es un contenedor de
 * consulta: el contenido interior usa unidades cqw, así escala igual en la
 * biblioteca, en la vista previa y en la impresión. (El padding va en la capa
 * interior porque las unidades cqw de un elemento se resuelven contra su
 * contenedor ancestro, no contra sí mismo.)
 */
export function Cover({ title, subtitle, author, cloth, template = "clasica", className, children }: CoverProps) {
  const style = { ["--tela" as string]: cloth };

  let body: React.ReactNode;
  if (template === "franja") {
    body = (
      <div className="absolute inset-0 flex flex-col overflow-hidden rounded-[inherit]">
        <div className="flex flex-1 items-start px-[11cqw] pt-[12cqw]">
          {subtitle && <span className="text-[6cqw] leading-tight opacity-90">{subtitle}</span>}
        </div>
        <div className="flex h-[42%] flex-col gap-[3cqw] bg-white px-[11cqw] py-[9cqw]">
          <span className="font-display text-[11cqw] font-semibold leading-[1.05] tracking-[-0.02em]" style={{ color: cloth }}>
            {title}
          </span>
          {author && <span className="mt-auto text-[5.5cqw] text-[#3d434e]">{author}</span>}
        </div>
      </div>
    );
  } else if (template === "centrada") {
    body = (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-[5cqw] px-[12cqw] text-center">
        <span className="font-display text-[12cqw] font-semibold leading-[1.05] tracking-[-0.02em]">{title}</span>
        <span aria-hidden className="h-px w-[22cqw] bg-white/60" />
        {subtitle && <span className="text-[5.8cqw] leading-snug opacity-90">{subtitle}</span>}
        {author && <span className="absolute bottom-[9cqw] text-[5.5cqw] opacity-90">{author}</span>}
      </div>
    );
  } else {
    body = (
      <div className="absolute inset-0 flex flex-col gap-[4cqw] py-[11cqw] pl-[14cqw] pr-[10cqw]">
        {subtitle && <span className="text-[6cqw] leading-tight opacity-90">{subtitle}</span>}
        <span className="font-display text-[12.5cqw] font-semibold leading-[1.05] tracking-[-0.02em]">{title}</span>
        {author && <span className="mt-auto text-[5.5cqw] opacity-90">{author}</span>}
      </div>
    );
  }

  return (
    <div className={cn("portada @container", className)} style={style}>
      {body}
      {children}
    </div>
  );
}

export function MiniCover({ cloth, className }: { cloth: string; className?: string }) {
  return <span aria-hidden className={cn("mini-portada h-6 w-[17px]", className)} style={{ ["--tela" as string]: cloth }} />;
}
