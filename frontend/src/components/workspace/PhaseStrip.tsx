import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { derivePhases, type PhaseState } from "@/lib/phases";
import type { Ebook } from "@/lib/types";

const STATE_TEXT: Record<PhaseState, string> = {
  espera: "en espera",
  trabajando: "trabajando",
  tu_turno: "tu turno",
  listo: "listo",
  error: "con error",
};

export function PhaseDot({ state, className }: { state: PhaseState; className?: string }) {
  if (state === "listo") {
    return (
      <span aria-hidden className={cn("grid size-[18px] flex-none place-items-center rounded-full bg-tinta text-sobre-tinta", className)}>
        <Check className="size-3" strokeWidth={3} />
      </span>
    );
  }
  if (state === "trabajando") return <span aria-hidden className={cn("anillo size-[18px] flex-none", className)} />;
  if (state === "tu_turno") {
    return (
      <span
        aria-hidden
        className={cn("grid size-[18px] flex-none place-items-center rounded-full border-2 border-tinta bg-pagina shadow-[0_0_0_4px_var(--menta)]", className)}
      >
        <span className="size-[7px] rounded-full bg-tinta" />
      </span>
    );
  }
  if (state === "error") {
    return (
      <span aria-hidden className={cn("grid size-[18px] flex-none place-items-center rounded-full border-2 border-error bg-pagina", className)}>
        <span className="size-[7px] rounded-full bg-error" />
      </span>
    );
  }
  return <span aria-hidden className={cn("size-[18px] flex-none rounded-full border-2 border-borde-control bg-pagina", className)} />;
}

/** Proceso por fases, con quién trabaja en cada una y "Tú" en las pausas (docs/07 §6). */
export function PhaseStrip({ ebook }: { ebook: Ebook }) {
  const phases = derivePhases(ebook);
  const currentIndex = phases.findIndex((p) => p.state === "trabajando" || p.state === "tu_turno" || p.state === "error");
  const current = phases[currentIndex];

  return (
    <nav aria-label="Proceso del ebook" className="px-4 sm:px-6">
      {/* Escritorio: todas las fases */}
      <ol className="hidden items-center gap-2 overflow-x-auto pb-1 lg:flex">
        {phases.map((p, i) => (
          <li
            key={p.key}
            aria-current={i === currentIndex ? "step" : undefined}
            className="flex min-w-0 items-center gap-2"
          >
            {i > 0 && <span aria-hidden className="h-px w-5 flex-none bg-borde-control xl:w-8" />}
            <PhaseDot state={p.state} />
            <span className="grid min-w-0 leading-tight">
              <span
                className={cn(
                  "whitespace-nowrap text-[13px]",
                  p.state === "tu_turno" ? "font-semibold text-tinta-oscura" : p.state === "espera" ? "text-tenue" : p.state === "error" ? "font-medium text-error" : "font-medium text-texto",
                )}
              >
                {p.label}
              </span>
              <span className={cn("whitespace-nowrap text-[11.5px]", p.state === "error" ? "text-error" : "text-tenue")}>
                {p.who}
                <span className="sr-only"> ({STATE_TEXT[p.state]})</span>
              </span>
            </span>
          </li>
        ))}
      </ol>

      {/* Móvil y tablet: solo la fase actual */}
      <div className="flex items-center gap-3 lg:hidden">
        <PhaseDot state={current?.state ?? "listo"} />
        <p className="min-w-0 flex-1 truncate text-[13.5px]">
          <span className={cn("font-medium", current?.state === "tu_turno" && "text-tinta-oscura", current?.state === "error" && "text-error")}>
            {current ? (current.state === "tu_turno" ? "Tu turno · " : "") + current.label : "Libro final"}
          </span>
          <span className="text-tenue"> · {current?.who ?? "Maquetador"}</span>
        </p>
        <span className="flex-none text-[12px] tabular-nums text-tenue">
          Paso {currentIndex === -1 ? phases.length : currentIndex + 1} de {phases.length}
        </span>
      </div>
    </nav>
  );
}
