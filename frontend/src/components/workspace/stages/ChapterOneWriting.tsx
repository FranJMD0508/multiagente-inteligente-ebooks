import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { SECTION_LABELS, SECTION_ORDER, type Ebook } from "@/lib/types";
import { ActivityLog } from "../ActivityLog";
import { StageHeader } from "../StageHeader";

/** Avance por secciones mientras el Redactor escribe el capítulo 1. */
export function SectionProgress({ current, done }: { current?: string; done: boolean }) {
  const steps = [...SECTION_ORDER.map((s) => ({ id: s as string, label: SECTION_LABELS[s] })), { id: "ejercicio", label: "Ejercicio práctico" }];
  const currentIndex = done ? steps.length : Math.max(0, steps.findIndex((s) => s.id === current));
  return (
    <ol className="grid gap-2" aria-label="Secciones del capítulo">
      {steps.map((s, i) => {
        const state = i < currentIndex ? "listo" : i === currentIndex ? "ahora" : "espera";
        return (
          <li key={s.id} className="flex items-center gap-3 text-[14.5px]">
            {state === "listo" ? (
              <span aria-hidden className="grid size-[18px] place-items-center rounded-full bg-tinta text-sobre-tinta">
                <Check className="size-3" strokeWidth={3} />
              </span>
            ) : state === "ahora" ? (
              <span aria-hidden className="anillo size-[18px] [--fondo-anillo:var(--pagina)]" />
            ) : (
              <span aria-hidden className="size-[18px] rounded-full border-2 border-borde-control" />
            )}
            <span className={cn(state === "espera" ? "text-tenue" : "text-texto", state === "ahora" && "font-medium")}>
              {s.label}
              <span className="sr-only"> ({state === "listo" ? "lista" : state === "ahora" ? "escribiéndose" : "pendiente"})</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function ChapterOneWriting({ ebook }: { ebook: Ebook }) {
  const ch1 = ebook.chapters[0];
  return (
    <div className="grid gap-6">
      <StageHeader
        title="Escribiendo el capítulo 1"
        subtitle="Suele tardar menos de un minuto. Puedes salir: te avisaremos cuando sea tu turno."
      />
      <div className="rounded-2xl bg-barra p-4">
        <p className="mb-3 text-[14px] text-grafito">
          <span className="font-medium text-texto">{ch1?.title}</span>
        </p>
        <SectionProgress current={ch1?.currentSection} done={ch1?.status === "generado"} />
      </div>
      <ActivityLog entries={ebook.activity} limit={3} showAgent />
    </div>
  );
}
