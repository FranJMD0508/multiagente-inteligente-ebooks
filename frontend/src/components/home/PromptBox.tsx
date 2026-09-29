"use client";

import { ArrowUp, BookOpen, Users } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Input } from "@/components/ui/Field";
import { PopoverContent, PopoverRoot, PopoverTrigger } from "@/components/ui/Popover";
import { Segmented } from "@/components/ui/Segmented";
import { cn } from "@/lib/cn";

export type ChapterChoice = "auto" | "5" | "6" | "7";

interface PromptBoxProps {
  value: string;
  onChange: (value: string) => void;
  chapters: ChapterChoice;
  onChaptersChange: (value: ChapterChoice) => void;
  audience: string;
  onAudienceChange: (value: string) => void;
  onSubmit: () => void;
  canSubmit: boolean;
}

export interface PromptBoxHandle {
  focus: () => void;
}

const pill =
  "inline-flex h-8 items-center gap-1.5 rounded-full bg-control px-3 text-[13px] text-grafito transition-colors hover:text-texto data-[state=open]:bg-texto data-[state=open]:text-pagina [&_svg]:size-3.5";

export const PromptBox = forwardRef<PromptBoxHandle, PromptBoxProps>(function PromptBox(
  { value, onChange, chapters, onChaptersChange, audience, onAudienceChange, onSubmit, canSubmit },
  ref,
) {
  const area = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => ({ focus: () => area.current?.focus() }));

  // Crece con el texto hasta un máximo razonable.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [value]);

  return (
    <form
      className="grid gap-3 rounded-[22px] border border-linea bg-pagina p-4 pb-3 text-left shadow-[0_2px_6px_rgb(var(--sombra)/0.05),0_12px_30px_rgb(var(--sombra)/0.08)] transition-shadow focus-within:border-borde-control focus-within:shadow-[0_2px_6px_rgb(var(--sombra)/0.06),0_16px_40px_rgb(var(--sombra)/0.12)] sm:p-5 sm:pb-3.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit();
      }}
    >
      <label htmlFor="idea" className="sr-only">
        Describe tu ebook
      </label>
      <textarea
        id="idea"
        ref={area}
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (canSubmit) onSubmit();
          }
        }}
        placeholder="Describe tu ebook: el tema, para quién es y qué quieres que logre quien lo lea."
        className="w-full resize-none bg-transparent text-[16.5px] leading-relaxed text-texto placeholder:text-tenue focus:outline-none focus-visible:outline-none"
      />
      <div className="flex items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <PopoverRoot>
            <PopoverTrigger className={pill}>
              <BookOpen />
              {chapters === "auto" ? "Capítulos: automático" : `${chapters} capítulos`}
            </PopoverTrigger>
            <PopoverContent label="Número de capítulos">
              <p className="mb-1 text-[14px] font-medium">¿Cuántos capítulos?</p>
              <p className="mb-3 text-[13px] text-grafito">Un ebook de Folio tiene entre 5 y 7 capítulos.</p>
              <Segmented
                label="Número de capítulos"
                value={chapters}
                onChange={onChaptersChange}
                options={[
                  { value: "auto", label: "Automático" },
                  { value: "5", label: "5" },
                  { value: "6", label: "6" },
                  { value: "7", label: "7" },
                ]}
              />
            </PopoverContent>
          </PopoverRoot>
          <PopoverRoot>
            <PopoverTrigger className={cn(pill, "max-w-[60vw] sm:max-w-[280px]")}>
              <Users />
              <span className="truncate">{audience ? `Para: ${audience}` : "Público"}</span>
            </PopoverTrigger>
            <PopoverContent label="Público objetivo">
              <label htmlFor="publico" className="mb-1 block text-[14px] font-medium">
                ¿Para quién es?
              </label>
              <p className="mb-3 text-[13px] text-grafito">Opcional. Si lo dejas vacío, Folio lo deduce de tu idea.</p>
              <Input
                id="publico"
                value={audience}
                onChange={(e) => onAudienceChange(e.target.value)}
                placeholder="Por ejemplo: estudiantes de primer año"
              />
            </PopoverContent>
          </PopoverRoot>
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          aria-label="Proponer índice"
          title="Proponer índice"
          className="grid size-10 flex-none place-items-center rounded-full bg-tinta text-sobre-tinta transition-[background-color,opacity,transform] duration-150 hover:bg-tinta-hover active:scale-95 disabled:opacity-35"
        >
          <ArrowUp className="size-[18px]" strokeWidth={2.2} />
        </button>
      </div>
    </form>
  );
});
