"use client";

import { useStore } from "@/lib/api/hooks";

/**
 * Región aria-live que anuncia eventos del pipeline de forma resumida
 * ("Capítulo 2 terminado", "Es tu turno: revisa el índice"), nunca token a token.
 */
export function Announcer() {
  const { announcement } = useStore();
  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {announcement ? <span key={announcement.id}>{announcement.text}</span> : null}
    </div>
  );
}
