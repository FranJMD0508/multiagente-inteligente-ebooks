/* eslint-disable @next/next/no-img-element -- la portada se exporta a estático y a PDF: <img> simple */
import { isRemote, resolveAsset } from "@/lib/assets";
import { cn } from "@/lib/cn";
import { titleFontStack } from "@/lib/design";
import type { CoverImage, CoverTemplate, Ebook, TitleAlign, TitleFont, TitleSize } from "@/lib/types";

interface CoverProps {
  title: string;
  subtitle?: string;
  author?: string;
  cloth: string;
  template?: CoverTemplate;
  titleFont?: TitleFont;
  titleSize?: TitleSize;
  titleAlign?: TitleAlign;
  image?: CoverImage;
  className?: string;
  children?: React.ReactNode;
}

const SIZES: Record<TitleSize, number> = { s: 10, m: 12.5, l: 15 };

/**
 * Portada del ebook (proporción 2:3, lomo sombreado). Es un contenedor de
 * consulta: el contenido interior usa unidades cqw, así escala igual en la
 * biblioteca, en la vista previa y en la impresión. (El padding va en la capa
 * interior porque las unidades cqw de un elemento se resuelven contra su
 * contenedor ancestro, no contra sí mismo.) El PDF del servidor reproduce estas
 * mismas medidas (backend/app/export/templates).
 */
export function Cover({
  title,
  subtitle,
  author,
  cloth,
  template = "clasica",
  titleFont = "Lexend",
  titleSize = "m",
  titleAlign,
  image,
  className,
  children,
}: CoverProps) {
  const style = { ["--tela" as string]: cloth };
  const align: TitleAlign = titleAlign ?? (template === "centrada" || template === "marco" ? "center" : "start");
  const centered = align === "center";
  const scale = template === "centrada" || template === "marco" ? 0.96 : 1;
  const titleStyle: React.CSSProperties = {
    fontFamily: titleFontStack(titleFont),
    fontSize: `${SIZES[titleSize] * scale}cqw`,
  };
  const titleClass = "font-semibold leading-[1.05] tracking-[-0.02em] [overflow-wrap:anywhere]";
  const textAlign = centered ? "items-center text-center" : "items-start text-left";
  const background = image?.placement === "fondo" ? image : undefined;
  const framed = image?.placement === "recuadro" ? image : undefined;

  const Framed = framed ? (
    <img
      src={resolveAsset(framed.src)}
      alt={framed.alt}
      crossOrigin={isRemote(framed.src) ? "anonymous" : undefined}
      className="aspect-[4/3] max-h-[60cqw] min-h-[12cqw] w-full shrink rounded-[2cqw] object-cover shadow-[0_0.6cqw_2cqw_rgb(0_0_0/0.18)]"
      style={{ objectPosition: `50% ${framed.focusY}%` }}
    />
  ) : null;

  // Imagen de fondo bajo un velo de tela; el lomo se vuelve a pintar encima.
  const Background = background ? (
    <span aria-hidden={!background.alt} className="absolute inset-0 overflow-hidden rounded-[inherit]">
      <img
        src={resolveAsset(background.src)}
        alt={background.alt}
        crossOrigin={isRemote(background.src) ? "anonymous" : undefined}
        className="absolute inset-0 size-full object-cover"
        style={{ objectPosition: `50% ${background.focusY}%` }}
      />
      <span className="absolute inset-0" style={{ background: cloth, opacity: background.veil }} />
      <span className="absolute inset-0 bg-[linear-gradient(90deg,rgb(0_0_0/0.28)_0,rgb(255_255_255/0.16)_6%,transparent_13%)]" />
    </span>
  ) : null;

  let body: React.ReactNode;
  if (template === "franja") {
    body = (
      <div className="absolute inset-0 flex flex-col overflow-hidden rounded-[inherit]">
        <div className="relative flex flex-1 flex-col">
          {Background}
          <div className={cn("relative flex flex-1 flex-col gap-[4cqw] px-[11cqw] pt-[12cqw] pb-[6cqw]", textAlign)}>
            {subtitle && <span className="text-[6cqw] leading-tight opacity-90">{subtitle}</span>}
            {Framed}
          </div>
        </div>
        <div className={cn("flex h-[42%] flex-col gap-[3cqw] bg-white px-[11cqw] py-[9cqw]", textAlign)}>
          <span className={titleClass} style={{ ...titleStyle, color: cloth }}>
            {title}
          </span>
          {author && <span className="mt-auto text-[5.5cqw] text-[#3d434e]">{author}</span>}
        </div>
      </div>
    );
  } else if (template === "centrada") {
    body = (
      <>
        {Background}
        <div className={cn("absolute inset-0 flex flex-col justify-center gap-[5cqw] px-[12cqw]", textAlign)}>
          {Framed}
          <span className={titleClass} style={titleStyle}>
            {title}
          </span>
          <span aria-hidden className="h-px w-[22cqw] flex-none bg-white/60" />
          {subtitle && <span className="text-[5.8cqw] leading-snug opacity-90">{subtitle}</span>}
        </div>
        {author && (
          <span className={cn("absolute bottom-[9cqw] px-[12cqw] text-[5.5cqw] opacity-90", centered ? "inset-x-0 text-center" : "left-0")}>
            {author}
          </span>
        )}
      </>
    );
  } else if (template === "marco") {
    body = (
      <>
        {Background}
        <div className="absolute inset-[6cqw] rounded-[1.5cqw] border-[0.6cqw] border-white/85">
          <div className={cn("absolute inset-0 flex flex-col gap-[4cqw] p-[4cqw] pt-[9cqw]", textAlign)}>
            {Framed}
            <span className={titleClass} style={titleStyle}>
              {title}
            </span>
            {subtitle && <span className="text-[5.6cqw] leading-snug opacity-90">{subtitle}</span>}
            {author && <span className="mt-auto text-[5.2cqw] opacity-90">{author}</span>}
          </div>
        </div>
      </>
    );
  } else if (template === "editorial") {
    body = (
      <>
        {Background}
        <div className={cn("absolute inset-0 flex flex-col gap-[4cqw] p-[11cqw]", textAlign)}>
          {author && <span className="text-[5cqw] font-medium uppercase tracking-[0.08em] opacity-90">{author}</span>}
          {Framed}
          <div className={cn("mt-auto flex flex-col gap-[3.5cqw]", textAlign)}>
            <span aria-hidden className="h-[0.8cqw] w-[14cqw] flex-none rounded-full bg-white" />
            <span className={titleClass} style={titleStyle}>
              {title}
            </span>
            {subtitle && <span className="text-[5.8cqw] leading-snug opacity-90">{subtitle}</span>}
          </div>
        </div>
      </>
    );
  } else {
    body = (
      <>
        {Background}
        <div className={cn("absolute inset-0 flex flex-col gap-[4cqw] py-[11cqw] pl-[14cqw] pr-[10cqw]", textAlign)}>
          {subtitle && <span className="text-[6cqw] leading-tight opacity-90">{subtitle}</span>}
          {Framed}
          <span className={titleClass} style={titleStyle}>
            {title}
          </span>
          {author && <span className="mt-auto text-[5.5cqw] opacity-90">{author}</span>}
        </div>
      </>
    );
  }

  return (
    <div className={cn("portada @container", className)} style={style}>
      {body}
      {children}
    </div>
  );
}

/** Portada con todo el diseño de un ebook. */
export function EbookCover({
  ebook,
  title,
  className,
  children,
}: {
  ebook: Ebook;
  /** Título alternativo (por ejemplo, "…" mientras el Investigador lo propone). */
  title?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const d = ebook.design;
  return (
    <Cover
      title={title ?? ebook.title}
      subtitle={ebook.subtitle}
      author={d.author}
      cloth={d.clothColor}
      template={d.coverTemplate}
      titleFont={d.titleFont}
      titleSize={d.titleSize}
      titleAlign={d.titleAlign}
      image={d.coverImage}
      className={className}
    >
      {children}
    </Cover>
  );
}

export function MiniCover({ cloth, className }: { cloth: string; className?: string }) {
  return <span aria-hidden className={cn("mini-portada h-6 w-[17px]", className)} style={{ ["--tela" as string]: cloth }} />;
}
