"use client";

import { Check, Lock, TriangleAlert } from "lucide-react";
import { ToggleGroup } from "radix-ui";
import { Cover } from "@/components/book/Cover";
import { Button } from "@/components/ui/Button";
import { FieldShell, Input } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { accessibleCloth, BODY_SIZES, BOOK_FONTS, CLOTHS, contrastRatio, COVER_TEMPLATES, formatRatio, PAGE_SIZES } from "@/lib/design";
import type { BookFont, CoverTemplate, Ebook, PageSize } from "@/lib/types";

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <span className="text-[13.5px] font-medium text-grafito">{label}</span>
      {children}
    </div>
  );
}

export function DesignPanel({ ebook }: { ebook: Ebook }) {
  const d = ebook.design;
  const ratio = contrastRatio(d.clothColor, "#FFFFFF");
  const ok = ratio >= 4.5;
  const suggestion = ok ? null : accessibleCloth(d.clothColor);
  const isCustom = !CLOTHS.some((c) => c.value.toLowerCase() === d.clothColor.toLowerCase());

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldShell label="Título">
          {(id) => <Input id={id} value={ebook.title} onChange={(e) => api.updateMeta(ebook.id, { title: e.target.value })} />}
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
          onValueChange={(v) => v && api.updateDesign(ebook.id, { coverTemplate: v as CoverTemplate })}
          className="flex flex-wrap gap-3"
        >
          {COVER_TEMPLATES.map((t) => (
            <ToggleGroup.Item
              key={t.id}
              value={t.id}
              className="group grid justify-items-center gap-1.5 rounded-xl p-1.5 text-[12.5px] text-grafito data-[state=on]:text-texto"
            >
              <span className="block w-[64px] rounded-[5px] ring-offset-2 ring-offset-pagina group-data-[state=on]:ring-2 group-data-[state=on]:ring-tinta">
                <Cover title={ebook.title} author={d.author} cloth={d.clothColor} template={t.id} className="w-full shadow-none" />
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
          <label className={cn("relative grid size-8 cursor-pointer place-items-center overflow-hidden rounded-full border border-dashed border-borde-control", isCustom && "ring-2 ring-texto ring-offset-2 ring-offset-pagina")} title="Color personalizado">
            <span className="sr-only">Color personalizado</span>
            <input
              type="color"
              value={d.clothColor}
              onChange={(e) => api.updateDesign(ebook.id, { clothColor: e.target.value.toUpperCase() })}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
            />
            <span aria-hidden className="size-4 rounded-full" style={{ background: isCustom ? d.clothColor : "conic-gradient(#2F6B58,#1E5E73,#3B4A9E,#8C2F45,#9A6A12,#2F6B58)" }} />
          </label>
          <span
            className={cn(
              "ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-medium",
              ok ? "bg-menta text-tinta-oscura" : "bg-error-suave text-error",
            )}
          >
            {ok ? <Check className="size-3.5" strokeWidth={2.5} /> : <TriangleAlert className="size-3.5" />}
            Contraste {formatRatio(ratio)}
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
        <Lock aria-hidden className="size-3.5 text-tenue" />
        Fondo blanco y texto oscuro fijos para que el PDF se lea bien (RA-03).
      </p>
    </div>
  );
}

export function CoverPreview({ ebook }: { ebook: Ebook }) {
  return (
    <div className="flex h-full flex-col items-center gap-5 overflow-y-auto px-6 pb-8 pt-6 sm:px-10">
      <div className="flex w-full justify-between text-[12px] tracking-[0.04em] text-[#6e7480]">
        <span>Portada</span>
        <span>{PAGE_SIZES.find((p) => p.id === ebook.design.pageSize)?.label}</span>
      </div>
      <Cover
        title={ebook.title}
        subtitle={ebook.subtitle}
        author={ebook.design.author}
        cloth={ebook.design.clothColor}
        template={ebook.design.coverTemplate}
        className="mt-2 w-[min(70%,300px)]"
      />
      <p className="text-center text-[13px] text-[#6e7480]">Los cambios se ven al instante en todo el libro.</p>
    </div>
  );
}
