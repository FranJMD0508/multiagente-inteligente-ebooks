import { Check } from "lucide-react";
import { bookFontStack } from "@/lib/design";
import { SECTION_LABELS, SECTION_ORDER, type Chapter, type Ebook, type Exercise } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Prose } from "./Prose";

export function ExerciseBox({ exercise }: { exercise: Exercise }) {
  return (
    <div className="rounded-lg border border-[#d7e9e6] bg-[#f4faf9] p-[1em]">
      <p className="mb-[0.6em] font-display text-[1em] font-medium text-[#0b5a53]">{exercise.title}</p>
      {exercise.type === "checklist" ? (
        <ul className="grid gap-[0.45em]">
          {exercise.items.map((item, i) => (
            <li key={i} className="flex gap-[0.6em]">
              <span aria-hidden className="mt-[0.2em] grid size-[1em] flex-none place-items-center rounded-[3px] border border-[#0e7c74]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <ol className="grid list-decimal gap-[0.45em] pl-[1.3em] marker:text-[#0e7c74]">
          {exercise.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      )}
    </div>
  );
}

interface ChapterPageProps {
  ebook: Ebook;
  chapter: Chapter;
  /** Página inicial aproximada del capítulo (para el número al pie). */
  page?: number;
  className?: string;
}

/** Hoja del libro con un capítulo: cabecera, número, título, capitular y secciones. */
export function ChapterPage({ ebook, chapter, page, className }: ChapterPageProps) {
  const writing = chapter.status === "generando";
  const sections = chapter.sections;
  const visible = SECTION_ORDER.filter((s) => (sections?.[s] ?? "").length > 0 || chapter.currentSection === s);

  return (
    <article
      aria-label={`Capítulo ${chapter.number}: ${chapter.title}`}
      className={cn("hoja-libro relative grid content-start gap-[1.1em] rounded-[4px] px-[9%] pb-[6%] pt-[7%] leading-[1.62]", className)}
      style={{ fontFamily: bookFontStack(ebook.design.font), fontSize: `${ebook.design.bodySizePt * 1.26}px` }}
    >
      <header className="flex justify-between gap-4 text-[0.72em] tracking-[0.03em] text-[#6e7480]">
        <span className="truncate">{ebook.design.author}</span>
        <span className="truncate">{ebook.title}</span>
      </header>
      <div className="grid gap-[0.4em] pt-[0.6em]">
        <span className="text-[0.72em] font-medium uppercase tracking-[0.1em] text-[#0e7c74]">Capítulo {chapter.number}</span>
        <h3 className="font-display text-[1.75em] font-semibold leading-[1.12] tracking-[-0.03em] text-[#1b1d23]">{chapter.title}</h3>
      </div>
      {!sections && !writing && <p className="text-[0.9em] text-[#6e7480]">Este capítulo todavía no se ha escrito.</p>}
      {visible.map((s, idx) => (
        <section key={s} className="grid gap-[0.6em]">
          <h4 className="font-display text-[1.12em] font-medium text-[#1b1d23]">{SECTION_LABELS[s]}</h4>
          <Prose text={sections?.[s] ?? ""} dropCap={idx === 0} caret={writing && chapter.currentSection === s} />
        </section>
      ))}
      {(chapter.exercise || chapter.currentSection === "ejercicio") && (
        <section className="grid gap-[0.6em]">
          <h4 className="font-display text-[1.12em] font-medium text-[#1b1d23]">Ejercicio práctico</h4>
          {chapter.exercise ? (
            <ExerciseBox exercise={chapter.exercise} />
          ) : (
            <p className="flex items-center gap-2 text-[0.9em] text-[#0b5a53]">
              <span className="anillo size-3.5 [--fondo-anillo:#fff]" aria-hidden />
              El Agente de Ejercicios está creando el cierre del capítulo…
            </p>
          )}
        </section>
      )}
      {page !== undefined && <footer className="pt-[1em] text-center font-display text-[0.75em] text-[#6e7480]">{page}</footer>}
    </article>
  );
}

export function StructureChips({ chapter }: { chapter: Chapter }) {
  const ex = chapter.exercise;
  const items = [
    ...SECTION_ORDER.map((s) => SECTION_LABELS[s]),
    ex ? (ex.type === "reto" ? `Reto de ${ex.duration === "48h" ? "48" : "24"} h` : "Checklist") : "Ejercicio",
  ];
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Estructura del capítulo">
      {items.map((label) => (
        <li key={label} className="inline-flex items-center gap-1.5 rounded-full bg-control px-3 py-1 text-[13px] text-texto">
          <Check className="size-3.5 text-tinta" strokeWidth={2.5} aria-hidden />
          {label}
        </li>
      ))}
    </ul>
  );
}
