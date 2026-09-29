import { Check } from "lucide-react";
import type { ActivityEntry, AgentId } from "@/lib/types";

const AGENT: Record<AgentId, string> = {
  investigador: "Investigador",
  redactor: "Redactor",
  ejercicios: "Ejercicios",
  maquetador: "Maquetador",
};

/** Bitácora de los agentes: rol + verbo concreto, nunca "Procesando…". */
export function ActivityLog({ entries, limit = 5, showAgent = false }: { entries: ActivityEntry[]; limit?: number; showAgent?: boolean }) {
  const items = entries.slice(-limit);
  if (items.length === 0) return null;
  return (
    <ul className="grid gap-2 text-[14px]" aria-label="Actividad de los agentes">
      {items.map((a) => (
        <li key={a.id} className="flex items-center gap-2.5">
          {a.state === "trabajando" ? (
            <span aria-hidden className="anillo size-4 flex-none [--fondo-anillo:var(--pagina)]" />
          ) : (
            <Check aria-hidden className="size-4 flex-none text-tinta" strokeWidth={2.5} />
          )}
          <span className={a.state === "trabajando" ? "font-medium text-texto" : "text-grafito"}>
            {showAgent && <span className="font-medium text-texto">{AGENT[a.agent]} · </span>}
            {a.message}
          </span>
        </li>
      ))}
    </ul>
  );
}
