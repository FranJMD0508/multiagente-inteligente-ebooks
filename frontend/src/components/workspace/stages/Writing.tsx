import { CircleAlert, Check, Info, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { simSettings } from "@/lib/api/mock/simulator";
import { SECTION_LABELS, SECTION_ORDER, type Chapter, type Ebook } from "@/lib/types";
import { ActivityLog } from "../ActivityLog";
import { StageHeader } from "../StageHeader";

const DONE = ["generado", "aprobado", "editado"];

function SectionBar({ chapter }: { chapter: Chapter }) {
  const steps = [...SECTION_ORDER, "ejercicio"] as const;
  const idx = steps.findIndex((s) => s === chapter.currentSection);
  return (
    <span aria-hidden className="mt-2 flex gap-1">
      {steps.map((s, i) => (
        <span
          key={s}
          className={cn(
            "h-[5px] w-7 rounded-full",
            i < idx ? "bg-tinta" : i === idx ? "bg-[linear-gradient(90deg,var(--tinta)_45%,var(--borde-control)_45%)]" : "bg-borde-control",
          )}
        />
      ))}
    </span>
  );
}

function remainingText(ebook: Ebook): string {
  const left = ebook.chapters.filter((c) => !DONE.includes(c.status)).length;
  const seconds = (left * 16) / simSettings.speed;
  if (seconds < 60) return "falta menos de un minuto";
  const minutes = Math.round(seconds / 60);
  return minutes === 1 ? "falta un minuto" : `faltan unos ${minutes} minutos`;
}

export function Writing({ ebook, onRead, reading }: { ebook: Ebook; onRead: (n: number) => void; reading?: number }) {
  const total = ebook.chapters.length;
  const writing = ebook.chapters.find((c) => c.status === "generando");
  const layout = ebook.status === "maquetando";
  const failed = ebook.status === "error";

  const subtitle = layout
    ? "El Maquetador está armando la portada, el aviso legal y el índice."
    : failed
      ? "La redacción está en pausa hasta que reintentes."
      : `Capítulo ${writing?.number ?? "…"} de ${total} · ${remainingText(ebook)} · puedes salir cuando quieras`;

  return (
    <div className="grid gap-5">
      <StageHeader title={layout ? "Armando tu libro" : "Escribiendo tu libro"} subtitle={subtitle} />

      <ol className="grid gap-2" aria-label="Avance por capítulo">
        {ebook.chapters.map((c) => {
          const done = DONE.includes(c.status);
          const now = c.status === "generando";
          const error = c.status === "error";
          return (
            <li
              key={c.id}
              className={cn(
                "grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl px-3.5 py-3",
                now ? "bg-pagina ring-2 ring-tinta" : error ? "bg-error-suave ring-1 ring-error/40" : "bg-barra",
                reading === c.number && done && "ring-1 ring-borde-control",
              )}
            >
              <span className={cn("w-5 text-center font-display text-[15px] font-medium", done || now ? "text-tinta" : "text-tenue")}>
                {c.number}
              </span>
              <div className="min-w-0">
                <p className={cn("text-[14.5px] font-medium leading-snug", !done && !now && !error && "text-grafito")}>{c.title}</p>
                {now && (
                  <>
                    <p className="text-[13px] text-grafito">
                      {c.currentSection === "ejercicio" ? "Ejercicios · creando el cierre" : `Redactor · ${SECTION_LABELS[c.currentSection ?? "introduccion"]}`}
                    </p>
                    <SectionBar chapter={c} />
                  </>
                )}
                {done && c.number === 1 && <p className="text-[13px] text-tenue">Aprobado · marca el tono del libro</p>}
                {done && c.number > 1 && (
                  <button
                    type="button"
                    onClick={() => onRead(c.number)}
                    className="text-[13px] text-tinta-oscura underline decoration-tinta/40 underline-offset-4 hover:decoration-tinta"
                  >
                    {reading === c.number ? "Leyendo ahora" : "Leer ahora"}
                  </button>
                )}
                {error && (
                  <div className="mt-1 grid gap-2">
                    <p className="flex items-center gap-1.5 text-[13.5px] font-medium text-error">
                      <CircleAlert className="size-4" aria-hidden /> {ebook.error?.message ?? "No pudimos terminar este capítulo"}
                    </p>
                    <p className="text-[13px] text-grafito">Lo que ya estaba escrito sigue a salvo.</p>
                    <Button size="sm" variant="primario" className="w-fit" onClick={() => api.retry(ebook.id)}>
                      <RotateCw /> Reintentar
                    </Button>
                  </div>
                )}
              </div>
              <span className={cn("flex items-center gap-1 text-[13px]", done ? "text-tinta-oscura" : now ? "font-medium text-texto" : "text-tenue")}>
                {done ? (
                  <>
                    <Check className="size-3.5" strokeWidth={2.5} aria-hidden /> Listo
                  </>
                ) : now ? (
                  "Escribiendo"
                ) : error ? (
                  ""
                ) : (
                  "En espera"
                )}
              </span>
            </li>
          );
        })}
      </ol>

      {layout ? (
        <ActivityLog entries={ebook.activity} limit={2} showAgent />
      ) : (
        !failed && (
          <p className="flex items-center gap-2 text-[13.5px] text-grafito">
            <Info aria-hidden className="size-4 flex-none text-tinta" />
            Cada capítulo sigue el tono y el formato del capítulo 1 que aprobaste.
          </p>
        )
      )}
    </div>
  );
}
