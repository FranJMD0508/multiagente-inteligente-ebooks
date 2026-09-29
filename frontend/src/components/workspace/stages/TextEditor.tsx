"use client";

import { Bold, ChevronDown, ChevronLeft, ChevronRight, Heading3, Italic, List, Lock, Quote } from "lucide-react";
import { useEffect, useLayoutEffect, useRef } from "react";
import { ExerciseBox } from "@/components/book/ChapterPage";
import { IconButton } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { api } from "@/lib/api";
import { DISCLAIMERS } from "@/lib/guardrails";
import { SECTION_LABELS, SECTION_ORDER, type Ebook, type SectionId } from "@/lib/types";

/** RA-01: en el editor no se crean H1 ni H2 manuales; se convierten en H3. */
function sanitize(text: string) {
  return text.replace(/^#{1,2}\s+/gm, "### ");
}

function AutoTextarea({
  value,
  onChange,
  onFocus,
  label,
  textareaRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onFocus: () => void;
  label: string;
  textareaRef: (el: HTMLTextAreaElement | null) => void;
}) {
  const local = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const el = local.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return (
    <textarea
      ref={(el) => {
        local.current = el;
        textareaRef(el);
      }}
      aria-label={label}
      value={value}
      onFocus={onFocus}
      onChange={(e) => onChange(sanitize(e.target.value))}
      rows={3}
      className="w-full resize-none overflow-hidden rounded-xl border border-linea bg-barra px-3.5 py-3 font-book text-[15px] leading-relaxed text-texto transition-colors hover:border-borde-control focus:border-tinta focus:bg-pagina focus:outline-none focus:ring-3 focus:ring-tinta/15 focus-visible:outline-none"
    />
  );
}

interface TextEditorProps {
  ebook: Ebook;
  /** 0 = aviso legal (si existe); 1..N = capítulos. */
  selected: number;
  onSelect: (n: number) => void;
}

export function TextEditor({ ebook, selected, onSelect }: TextEditorProps) {
  const refs = useRef<Partial<Record<SectionId, HTMLTextAreaElement | null>>>({});
  const lastFocused = useRef<SectionId>("introduccion");
  const legal = ebook.sensitivity !== "ninguno" ? DISCLAIMERS[ebook.sensitivity] : null;
  const min = legal ? 0 : 1;
  const max = ebook.chapters.length;
  const chapter = ebook.chapters.find((c) => c.number === selected);

  useEffect(() => {
    if (selected < min) onSelect(min);
  }, [selected, min, onSelect]);

  function edit(section: SectionId, text: string) {
    if (!chapter) return;
    api.editSection(ebook.id, chapter.number, section, text);
  }

  function format(kind: "bold" | "italic" | "list" | "quote" | "h3") {
    const section = lastFocused.current;
    const el = refs.current[section];
    if (!el || !chapter?.sections) return;
    const { selectionStart: start, selectionEnd: end, value } = el;
    let next = value;
    let cursor = end;
    if (kind === "bold" || kind === "italic") {
      const mark = kind === "bold" ? "**" : "*";
      const selectedText = value.slice(start, end) || (kind === "bold" ? "texto en negrita" : "texto en cursiva");
      next = value.slice(0, start) + mark + selectedText + mark + value.slice(end);
      cursor = start + mark.length + selectedText.length + mark.length;
    } else {
      const prefix = kind === "list" ? "- " : kind === "quote" ? "> " : "### ";
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const block = value.slice(lineStart, end);
      const prefixed = block
        .split("\n")
        .map((l) => (l.startsWith(prefix) ? l : prefix + l.replace(/^(- |> |### )/, "")))
        .join("\n");
      next = value.slice(0, lineStart) + prefixed + value.slice(end);
      cursor = lineStart + prefixed.length;
    }
    edit(section, sanitize(next));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  }

  const tools = [
    { kind: "bold" as const, label: "Negrita", icon: <Bold /> },
    { kind: "italic" as const, label: "Cursiva", icon: <Italic /> },
    { kind: "list" as const, label: "Lista", icon: <List /> },
    { kind: "quote" as const, label: "Cita", icon: <Quote /> },
    { kind: "h3" as const, label: "Subtítulo (H3)", icon: <Heading3 /> },
  ];

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <label htmlFor="capitulo-editar" className="sr-only">
            Capítulo que quieres editar
          </label>
          <select
            id="capitulo-editar"
            value={selected}
            onChange={(e) => onSelect(Number(e.target.value))}
            className="h-10 w-full appearance-none truncate rounded-full border border-borde-control bg-pagina pl-4 pr-10 text-[14px] text-texto hover:border-tenue focus:border-tinta focus:outline-none"
          >
            {legal && <option value={0}>Aviso legal</option>}
            {ebook.chapters.map((c) => (
              <option key={c.id} value={c.number}>
                Capítulo {c.number} · {c.title}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-tenue" />
        </div>
        <IconButton label="Anterior" variant="secundario" onClick={() => onSelect(Math.max(min, selected - 1))} disabled={selected <= min}>
          <ChevronLeft />
        </IconButton>
        <IconButton label="Siguiente" variant="secundario" onClick={() => onSelect(Math.min(max, selected + 1))} disabled={selected >= max}>
          <ChevronRight />
        </IconButton>
      </div>

      {selected === 0 && legal ? (
        <div className="grid gap-2 rounded-2xl border border-linea bg-barra p-4">
          <p className="flex items-center gap-2 font-display text-[15px] font-medium text-tinta-oscura">
            <Lock aria-hidden className="size-4" /> Aviso legal
          </p>
          <p className="font-book text-[15px] leading-relaxed">{legal.text}</p>
          <p className="text-[13px] text-grafito">Se incluye automáticamente porque {legal.reason} y no se puede quitar (RÉR-02).</p>
        </div>
      ) : chapter?.sections ? (
        <>
          <div role="toolbar" aria-label="Formato del texto" className="flex w-fit items-center gap-0.5 rounded-xl bg-control p-1">
            {tools.map((t) => (
              <Tooltip key={t.kind} content={t.label}>
                <button
                  type="button"
                  aria-label={t.label}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => format(t.kind)}
                  className="grid size-8 place-items-center rounded-lg text-grafito hover:bg-pagina hover:text-texto [&_svg]:size-4"
                >
                  {t.icon}
                </button>
              </Tooltip>
            ))}
          </div>
          <p className="-mt-2 text-[12.5px] text-tenue">
            Consejo: una línea que empieza con ### es un subtítulo; **así** queda en negrita y *así* en cursiva.
          </p>
          {SECTION_ORDER.map((s) => (
            <section key={s} className="grid gap-1.5">
              <h3 className="flex items-center gap-1.5 font-display text-[14px] font-medium text-tinta-oscura">
                <Lock aria-hidden className="size-3.5 text-tenue" />
                {SECTION_LABELS[s]}
              </h3>
              <AutoTextarea
                label={`${SECTION_LABELS[s]} del capítulo ${chapter.number}`}
                value={chapter.sections![s]}
                onChange={(v) => edit(s, v)}
                onFocus={() => (lastFocused.current = s)}
                textareaRef={(el) => (refs.current[s] = el)}
              />
            </section>
          ))}
          {chapter.exercise && (
            <section className="grid gap-1.5">
              <h3 className="flex items-center gap-1.5 font-display text-[14px] font-medium text-tinta-oscura">
                <Lock aria-hidden className="size-3.5 text-tenue" /> Ejercicio práctico
              </h3>
              <div className="font-book text-[15px] text-[#1f2127]">
                <ExerciseBox exercise={chapter.exercise} />
              </div>
            </section>
          )}
          <p className="flex items-center gap-2 text-[13px] text-grafito">
            <Lock aria-hidden className="size-3.5 text-tenue" />
            Los nombres de sección son fijos para mantener la estructura del libro.
          </p>
        </>
      ) : null}
    </div>
  );
}
