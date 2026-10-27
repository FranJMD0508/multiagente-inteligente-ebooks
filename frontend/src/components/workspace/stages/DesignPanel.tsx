"use client";

/* eslint-disable @next/next/no-img-element -- miniatura de la imagen de portada (data: URL o asset del servidor) */
import { Check, ImagePlus, Lock, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import { Tabs, ToggleGroup } from "radix-ui";
import { useEffect, useId, useState } from "react";
import { BackCover } from "@/components/book/BackCover";
import { Cover, EbookCover } from "@/components/book/Cover";
import { Button, IconButton } from "@/components/ui/Button";
import { FieldShell, Input, Textarea } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { Switch } from "@/components/ui/Switch";
import { api, IS_DEMO } from "@/lib/api";
import { isRemote, resolveAsset } from "@/lib/assets";
import { cn } from "@/lib/cn";
import { brightColor, contrastWithVeil, COVER_IMAGE_TYPES, minVeilFor, type Rgb } from "@/lib/cover-image";
import {
  accessibleCloth,
  BODY_SIZES,
  BOOK_FONTS,
  CLOTHS,
  contrastRatio,
  COVER_TEMPLATES,
  formatRatio,
  PAGE_SIZES,
  TITLE_FONTS,
  TITLE_SIZES,
} from "@/lib/design";
import type { BookFont, CoverImage, CoverTemplate, Ebook, PageSize, TitleAlign, TitleFont, TitleSize } from "@/lib/types";

export type StyleView = "portada" | "contraportada" | "interior";

function Group({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <span className="text-[13.5px] font-medium text-grafito">{label}</span>
      {children}
      {hint && <p className="text-[12.5px] text-tenue">{hint}</p>}
    </div>
  );
}

function ContrastBadge({ ratio }: { ratio: number }) {
  const ok = ratio >= 4.5;
  return (
    <span
      className={cn(
        "inline-flex flex-none items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-medium tabular-nums",
        ok ? "bg-menta text-tinta-oscura" : "bg-error-suave text-error",
      )}
    >
      {ok ? <Check className="size-3.5" strokeWidth={2.5} aria-hidden /> : <TriangleAlert className="size-3.5" aria-hidden />}
      Contraste {formatRatio(ratio)}
    </span>
  );
}

const subTab =
  "rounded-full px-3.5 py-1.5 text-[13.5px] text-grafito transition-[background-color,color,box-shadow] duration-150 hover:text-texto data-[state=active]:bg-pagina data-[state=active]:font-medium data-[state=active]:text-texto data-[state=active]:shadow-[0_1px_3px_rgb(var(--sombra)/0.12)]";

/** Pestaña "Portada y estilo": portada, contraportada e interior del libro (RD-04, RA-03). */
export function DesignPanel({ ebook, view, onView }: { ebook: Ebook; view: StyleView; onView: (v: StyleView) => void }) {
  return (
    <Tabs.Root value={view} onValueChange={(v) => onView(v as StyleView)} className="grid gap-5">
      <Tabs.List aria-label="Qué quieres diseñar" className="flex w-fit flex-wrap gap-0.5 rounded-full bg-control p-1">
        <Tabs.Trigger value="portada" className={subTab}>
          Portada
        </Tabs.Trigger>
        <Tabs.Trigger value="contraportada" className={subTab}>
          Contraportada
        </Tabs.Trigger>
        <Tabs.Trigger value="interior" className={subTab}>
          Interior
        </Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="portada" className="focus-visible:outline-none">
        <CoverSettings ebook={ebook} />
      </Tabs.Content>
      <Tabs.Content value="contraportada" className="focus-visible:outline-none">
        <BackCoverSettings ebook={ebook} />
      </Tabs.Content>
      <Tabs.Content value="interior" className="focus-visible:outline-none">
        <InteriorSettings ebook={ebook} />
      </Tabs.Content>
    </Tabs.Root>
  );
}

// ---------------------------------------------------------------------------
// Portada
// ---------------------------------------------------------------------------

function CoverSettings({ ebook }: { ebook: Ebook }) {
  const d = ebook.design;
  const ratio = contrastRatio(d.clothColor, "#FFFFFF");
  const ok = ratio >= 4.5;
  const suggestion = ok ? null : accessibleCloth(d.clothColor);
  const isCustom = !CLOTHS.some((c) => c.value.toLowerCase() === d.clothColor.toLowerCase());

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldShell label="Título" error={ebook.title.trim() ? undefined : "Escribe un título para tu libro."}>
          {(id, describedBy) => (
            <Input
              id={id}
              value={ebook.title}
              aria-invalid={!ebook.title.trim() || undefined}
              aria-describedby={describedBy}
              onChange={(e) => api.updateMeta(ebook.id, { title: e.target.value })}
            />
          )}
        </FieldShell>
        <FieldShell label="Autor">
          {(id) => <Input id={id} value={d.author} onChange={(e) => api.updateDesign(ebook.id, { author: e.target.value })} />}
        </FieldShell>
        <FieldShell label="Subtítulo" className="sm:col-span-2">
          {(id) => <Input id={id} value={ebook.subtitle} onChange={(e) => api.updateMeta(ebook.id, { subtitle: e.target.value })} />}
        </FieldShell>
      </div>

      <Group label="Plantilla de portada">
        <ToggleGroup.Root
          type="single"
          aria-label="Plantilla de portada"
          value={d.coverTemplate}
          onValueChange={(v) => {
            if (!v) return;
            const t = COVER_TEMPLATES.find((x) => x.id === v)!;
            api.updateDesign(ebook.id, { coverTemplate: v as CoverTemplate, titleAlign: t.align });
          }}
          className="grid max-w-[400px] grid-cols-5 gap-1.5"
        >
          {COVER_TEMPLATES.map((t) => (
            <ToggleGroup.Item
              key={t.id}
              value={t.id}
              aria-label={t.label}
              className="group grid min-w-0 justify-items-center gap-1.5 rounded-xl p-1 text-[12.5px] text-grafito data-[state=on]:font-medium data-[state=on]:text-texto"
            >
              <span aria-hidden className="block w-full max-w-[60px] rounded-[5px] ring-offset-2 ring-offset-pagina transition-shadow group-hover:ring-1 group-hover:ring-borde-control group-data-[state=on]:ring-2 group-data-[state=on]:ring-tinta">
                <Cover
                  title={ebook.title}
                  author={d.author}
                  cloth={d.clothColor}
                  template={t.id}
                  titleFont={d.titleFont}
                  titleSize={d.titleSize}
                  titleAlign={t.align}
                  image={d.coverImage}
                  className="w-full shadow-none"
                />
              </span>
              {t.label}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>
      </Group>

      <Group label="Color de tela">
        <div className="flex flex-wrap items-center gap-2.5">
          <ToggleGroup.Root
            type="single"
            aria-label="Color de tela"
            value={isCustom ? "" : CLOTHS.find((c) => c.value.toLowerCase() === d.clothColor.toLowerCase())?.value}
            onValueChange={(v) => v && api.updateDesign(ebook.id, { clothColor: v })}
            className="flex flex-wrap gap-2"
          >
            {CLOTHS.map((c) => (
              <ToggleGroup.Item
                key={c.value}
                value={c.value}
                aria-label={c.name}
                title={c.name}
                className="size-8 rounded-full ring-offset-2 ring-offset-pagina data-[state=on]:ring-2 data-[state=on]:ring-texto"
                style={{ background: c.value }}
              />
            ))}
          </ToggleGroup.Root>
          <label
            className={cn(
              "relative grid size-8 cursor-pointer place-items-center overflow-hidden rounded-full border border-dashed border-borde-control focus-within:ring-2 focus-within:ring-tinta",
              isCustom && "ring-2 ring-texto ring-offset-2 ring-offset-pagina",
            )}
            title="Color personalizado"
          >
            <span className="sr-only">Color personalizado</span>
            <input
              type="color"
              value={d.clothColor}
              onChange={(e) => api.updateDesign(ebook.id, { clothColor: e.target.value.toUpperCase() })}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
            />
            <span
              aria-hidden
              className="size-4 rounded-full"
              style={{ background: isCustom ? d.clothColor : "conic-gradient(#2F6B58,#1E5E73,#3B4A9E,#8C2F45,#9A6A12,#2F6B58)" }}
            />
          </label>
          <span className="ml-auto">
            <ContrastBadge ratio={ratio} />
          </span>
        </div>
        {!ok && suggestion && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-error-suave px-3 py-2 text-[13px] text-texto" role="alert">
            El texto blanco no se leería bien sobre este color (mínimo 4,5:1).
            <Button size="sm" onClick={() => api.updateDesign(ebook.id, { clothColor: suggestion })}>
              <span aria-hidden className="size-3.5 rounded-full" style={{ background: suggestion }} />
              Usar el tono accesible
            </Button>
          </div>
        )}
      </Group>

      <CoverImageSettings ebook={ebook} />

      <Group label="Título de la portada">
        <div className="grid gap-3">
          <TitleRow label="Letra">
            <Segmented<TitleFont>
              label="Letra del título"
              value={d.titleFont}
              onChange={(v) => api.updateDesign(ebook.id, { titleFont: v })}
              options={TITLE_FONTS.map((f) => ({ value: f, label: f }))}
              size="sm"
            />
          </TitleRow>
          <TitleRow label="Tamaño">
            <Segmented<TitleSize>
              label="Tamaño del título"
              value={d.titleSize}
              onChange={(v) => api.updateDesign(ebook.id, { titleSize: v })}
              options={TITLE_SIZES.map((s) => ({ value: s.id, label: s.label }))}
              size="sm"
            />
          </TitleRow>
          <TitleRow label="Alineación">
            <Segmented<TitleAlign>
              label="Alineación del título"
              value={d.titleAlign}
              onChange={(v) => api.updateDesign(ebook.id, { titleAlign: v })}
              options={[
                { value: "start", label: "A la izquierda" },
                { value: "center", label: "Centrado" },
              ]}
              size="sm"
            />
          </TitleRow>
        </div>
      </Group>
    </div>
  );
}

function TitleRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <span aria-hidden className="w-[76px] text-[13px] text-tenue">
        {label}
      </span>
      {children}
    </div>
  );
}

/**
 * Color más claro de la imagen (para medir el contraste del texto con el velo). Si el diseño
 * ya lo trae (con backend lo calcula el servidor), se usa ese: así el panel mide con los
 * mismos números que el velo mínimo.
 */
function useBrightColor(src: string | undefined, known: Rgb | null | undefined): Rgb | null {
  const [state, setState] = useState<{ src: string; rgb: Rgb } | null>(null);
  useEffect(() => {
    if (!src || known) return;
    let alive = true;
    brightColor(resolveAsset(src))
      .then((rgb) => alive && setState({ src, rgb }))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [src, known]);
  if (known) return known;
  return state && state.src === src ? state.rgb : null;
}

const pct = (n: number) => `${Math.round(n * 100)} %`;

function CoverImageSettings({ ebook }: { ebook: Ebook }) {
  const d = ebook.design;
  const image = d.coverImage;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const bright = useBrightColor(image?.src, image?.bright);
  const inputId = useId();
  const veilId = useId();
  const focusId = useId();

  // Si cambia la tela, el velo mínimo para 4,5:1 también cambia. Con backend lo
  // recalcula el servidor (es quien manda), así que solo se hace en el modo demo. Con
  // una tela sin contraste (que no se exporta) no se toca: subiría el velo al 100 %.
  useEffect(() => {
    if (!IS_DEMO || !image || !bright || contrastRatio(d.clothColor, "#FFFFFF") < 4.5) return;
    const minVeil = minVeilFor(bright, d.clothColor);
    if (Math.abs(minVeil - image.minVeil) > 0.004) {
      api.updateDesign(ebook.id, { coverImage: { ...image, minVeil, veil: Math.max(image.veil, minVeil) } });
    }
  }, [bright, d.clothColor, image, ebook.id]);

  async function upload(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      await api.uploadCoverImage(ebook.id, file);
    } catch (err) {
      setError((err as Error).message || "No pudimos usar esa imagen.");
    } finally {
      setBusy(false);
    }
  }

  const patch = (p: Partial<CoverImage>) => image && api.updateDesign(ebook.id, { coverImage: { ...image, ...p } });
  const ratio = image && bright ? contrastWithVeil(bright, d.clothColor, image.veil) : null;

  const fileInput = (
    <input
      id={inputId}
      type="file"
      accept={COVER_IMAGE_TYPES.join(",")}
      className="sr-only"
      onChange={(e) => {
        void upload(e.target.files?.[0]);
        e.target.value = "";
      }}
    />
  );

  return (
    <Group label="Imagen">
      {!image ? (
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void upload(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed px-4 py-3.5 transition-colors focus-within:ring-2 focus-within:ring-tinta",
            dragging ? "border-tinta bg-menta/40" : "border-borde-control hover:border-tenue",
          )}
        >
          {fileInput}
          <span className="grid size-10 flex-none place-items-center rounded-full bg-control text-tinta">
            {busy ? <span aria-hidden className="anillo size-4 [--fondo-anillo:var(--control)]" /> : <ImagePlus className="size-[18px]" aria-hidden />}
          </span>
          <span className="grid min-w-0 gap-0.5">
            <span className="text-[14.5px] font-medium">{busy ? "Preparando la imagen…" : "Subir una imagen"}</span>
            <span className="text-[13px] text-grafito">
              Arrástrala aquí o elígela. JPG, PNG o WebP hasta 8 MB, y solo si es tuya o tienes permiso para usarla.
            </span>
          </span>
        </label>
      ) : (
        <div className="grid gap-4 rounded-2xl bg-barra p-3.5">
          <div className="flex flex-wrap items-center gap-3">
            <img
              src={resolveAsset(image.src)}
              alt=""
              crossOrigin={isRemote(image.src) ? "anonymous" : undefined}
              className="size-12 flex-none rounded-lg object-cover"
              style={{ objectPosition: `50% ${image.focusY}%` }}
            />
            <div className="min-w-[140px] flex-1">
              <p className="text-[14.5px] font-medium">Imagen de portada</p>
              <p className="text-[13px] text-grafito">
                {image.placement === "fondo" ? "Cubre la portada bajo un velo de color." : "Va en un recuadro sobre la tela."}
              </p>
            </div>
            <div className="ml-auto flex flex-none items-center gap-1">
              <label
                htmlFor={inputId}
                className="inline-flex h-8 cursor-pointer items-center rounded-full border border-borde-control bg-pagina px-3 text-[13.5px] font-medium hover:border-tenue focus-within:ring-2 focus-within:ring-tinta"
              >
                {fileInput}
                {busy ? "Preparando…" : "Cambiar"}
              </label>
              <IconButton label="Quitar imagen" size="sm" onClick={() => api.removeCoverImage(ebook.id)}>
                <Trash2 />
              </IconButton>
            </div>
          </div>

          <Segmented<CoverImage["placement"]>
            label="Cómo se coloca la imagen"
            value={image.placement}
            onChange={(v) => patch({ placement: v })}
            options={[
              { value: "fondo", label: "De fondo" },
              { value: "recuadro", label: "En recuadro" },
            ]}
            size="sm"
          />

          {image.placement === "fondo" && (
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor={veilId} className="text-[13.5px] font-medium text-grafito">
                  Velo de color · {pct(image.veil)}
                </label>
                {ratio !== null && <ContrastBadge ratio={ratio} />}
              </div>
              <input
                id={veilId}
                type="range"
                min={Math.min(image.minVeil, 1)}
                max={1}
                step={0.01}
                value={image.veil}
                onChange={(e) => patch({ veil: Number(e.target.value) })}
                aria-valuetext={pct(image.veil)}
                className="h-6 w-full cursor-pointer accent-tinta"
              />
              <p className="text-[12.5px] text-tenue">
                {image.minVeil >= 1
                  ? "La imagen es tan clara que el título solo se lee sobre la tela: prueba a ponerla en recuadro."
                  : image.minVeil > 0
                    ? `No baja de ${pct(image.minVeil)}: con menos, el título no se leería bien sobre esta imagen.`
                    : "La imagen es oscura: el título se lee bien incluso sin velo."}
              </p>
            </div>
          )}

          <div className="grid gap-1.5">
            <label htmlFor={focusId} className="text-[13.5px] font-medium text-grafito">
              Encuadre
            </label>
            <input
              id={focusId}
              type="range"
              min={0}
              max={100}
              step={1}
              value={image.focusY}
              onChange={(e) => patch({ focusY: Number(e.target.value) })}
              aria-valuetext={image.focusY < 34 ? "Parte de arriba" : image.focusY > 66 ? "Parte de abajo" : "Centro"}
              className="h-6 w-full cursor-pointer accent-tinta"
            />
            <div aria-hidden className="flex justify-between text-[12px] text-tenue">
              <span>Arriba</span>
              <span>Abajo</span>
            </div>
          </div>

          <FieldShell label="Texto alternativo" hint="Describe la imagen para quien usa lector de pantalla. Déjalo vacío si es decorativa.">
            {(id, describedBy) => (
              <Input
                id={id}
                value={image.alt}
                onChange={(e) => patch({ alt: e.target.value })}
                placeholder="Por ejemplo: una agenda abierta junto a una taza de café"
                aria-describedby={describedBy}
              />
            )}
          </FieldShell>
        </div>
      )}
      {error && (
        <p role="alert" className="text-[13px] text-error">
          {error}
        </p>
      )}
    </Group>
  );
}

// ---------------------------------------------------------------------------
// Contraportada
// ---------------------------------------------------------------------------

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

function BackCoverSettings({ ebook }: { ebook: Ebook }) {
  const back = ebook.design.backCover;
  const [suggesting, setSuggesting] = useState(false);
  const count = words(back.blurb);
  const switchId = useId();

  async function suggest() {
    setSuggesting(true);
    try {
      await api.suggestBackCover(ebook.id);
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between gap-4 rounded-2xl bg-barra px-4 py-3">
        <label htmlFor={switchId} className="grid gap-0.5">
          <span className="text-[14.5px] font-medium">Incluir contraportada</span>
          <span className="text-[13px] text-grafito">Cierra el PDF con el color de tela. En el Markdown sale como «Sobre este libro».</span>
        </label>
        <Switch
          id={switchId}
          label="Incluir contraportada"
          checked={back.enabled}
          onChange={(v) => api.updateDesign(ebook.id, { backCover: { ...back, enabled: v } })}
        />
      </div>

      <FieldShell
        label="Sinopsis"
        hint={`${count} ${count === 1 ? "palabra" : "palabras"} · lo ideal son de 60 a 110.`}
      >
        {(id, describedBy) => (
          <Textarea
            id={id}
            rows={8}
            value={back.blurb}
            disabled={!back.enabled}
            aria-describedby={describedBy}
            onChange={(e) => api.updateDesign(ebook.id, { backCover: { ...back, blurb: e.target.value } })}
            placeholder="Para quién es el libro y qué se lleva quien lo lea."
            className="font-book text-[15px] disabled:opacity-60"
          />
        )}
      </FieldShell>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={suggest} disabled={suggesting || !back.enabled}>
          {suggesting ? <span aria-hidden className="anillo size-4 [--fondo-anillo:var(--pagina)]" /> : <RefreshCw />}
          {back.blurb.trim() ? "Pedir otra sinopsis" : "Proponer una sinopsis"}
        </Button>
        <span role="status" className="text-[13px] text-grafito">
          {suggesting ? "El Maquetador está escribiendo una propuesta…" : ""}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Interior
// ---------------------------------------------------------------------------

function InteriorSettings({ ebook }: { ebook: Ebook }) {
  const d = ebook.design;
  return (
    <div className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Group label="Letra del cuerpo">
          <Segmented<BookFont>
            label="Letra del cuerpo"
            value={d.font}
            onChange={(v) => api.updateDesign(ebook.id, { font: v })}
            options={BOOK_FONTS.map((f) => ({ value: f, label: f }))}
            size="sm"
          />
        </Group>
        <Group label="Tamaño del cuerpo">
          <Segmented
            label="Tamaño del cuerpo"
            value={String(d.bodySizePt)}
            onChange={(v) => api.updateDesign(ebook.id, { bodySizePt: Number(v) as 11 | 12 | 13 })}
            options={BODY_SIZES.map((s) => ({ value: String(s), label: `${s} pt` }))}
            size="sm"
          />
        </Group>
      </div>

      <Group label="Tamaño de página">
        <Segmented<PageSize>
          label="Tamaño de página"
          value={d.pageSize}
          onChange={(v) => api.updateDesign(ebook.id, { pageSize: v })}
          options={PAGE_SIZES.map((p) => ({ value: p.id, label: p.label }))}
          size="sm"
        />
      </Group>

      <p className="flex items-center gap-2 text-[13px] text-grafito">
        <Lock aria-hidden className="size-3.5 flex-none text-tenue" />
        Fondo blanco y texto oscuro fijos para que el PDF se lea bien (RA-03).
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vistas previas (página derecha)
// ---------------------------------------------------------------------------

function PreviewFrame({ label, children, note }: { label: string; children: React.ReactNode; note: string }) {
  return (
    <div className="flex h-full flex-col items-center gap-5 overflow-y-auto px-6 pb-8 pt-6 sm:px-10">
      <div className="flex w-full justify-between text-[12px] tracking-[0.04em] text-[#6e7480]">
        <span>{label}</span>
      </div>
      {children}
      <p className="text-center text-[13px] text-[#6e7480]">{note}</p>
    </div>
  );
}

export function CoverPreview({ ebook }: { ebook: Ebook }) {
  return (
    <PreviewFrame
      label={`Portada · ${PAGE_SIZES.find((p) => p.id === ebook.design.pageSize)?.label}`}
      note="Los cambios se ven al instante en todo el libro."
    >
      <EbookCover ebook={ebook} className="mt-2 w-[min(70%,300px)]" />
    </PreviewFrame>
  );
}

export function BackCoverPreview({ ebook }: { ebook: Ebook }) {
  return (
    <PreviewFrame
      label="Contraportada"
      note={
        !ebook.design.backCover.enabled
          ? "La contraportada está desactivada y no saldrá en el PDF."
          : !ebook.design.backCover.blurb.trim()
            ? "Sin sinopsis, la contraportada no se incluye en el PDF."
            : "Es la última página del PDF."
      }
    >
      <BackCover
        ebook={ebook}
        className={cn(
          "mt-2 w-[min(70%,300px)] transition-opacity",
          (!ebook.design.backCover.enabled || !ebook.design.backCover.blurb.trim()) && "opacity-40",
        )}
      />
    </PreviewFrame>
  );
}
