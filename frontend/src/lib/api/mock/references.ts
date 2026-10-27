// Referencias en el modo demo: el Investigador "sugiere" lecturas reales del
// nicho y Folio las verifica en vivo contra Crossref y Open Library desde el
// navegador. Con backend, esto lo hace el servidor.

import { normalize, verifyReference } from "@/lib/references/lookup";
import type { ActivityEntry, Reference } from "@/lib/types";
import { uid } from "@/lib/uid";
import { announce, getEbook, updateEbook } from "../store";
import { readingsFor } from "./readings";
import { simSettings } from "./simulator";

function patchReference(id: string, refId: string, fn: (r: Reference) => Reference) {
  updateEbook(id, (e) => ({ ...e, references: e.references.map((r) => (r.id === refId ? fn(r) : r)) }));
}

const latest = new Map<string, number>();
let verifySeq = 0;

/** Verifica una referencia y guarda el resultado (si sigue existiendo y nadie la volvió a pedir). */
export async function verifyInBackground(id: string, refId: string): Promise<Reference | undefined> {
  const ref = getEbook(id)?.references.find((r) => r.id === refId);
  if (!ref) return undefined;
  // Clave por ebook y referencia: un duplicado comparte los ids de sus referencias.
  const key = `${id}:${refId}`;
  const mine = ++verifySeq;
  latest.set(key, mine);
  patchReference(id, refId, (r) => ({ ...r, check: "pendiente", match: undefined, checkedWith: undefined }));
  const result = await verifyReference(ref);
  if (latest.get(key) === mine) {
    patchReference(id, refId, (r) => ({ ...r, ...result }));
    latest.delete(key);
  }
  return getEbook(id)?.references.find((r) => r.id === refId);
}

function log(id: string, message: string, state: ActivityEntry["state"]): string {
  const entry: ActivityEntry = { id: uid(), agent: "investigador", message, state };
  updateEbook(id, (e) => ({ ...e, activity: [...e.activity, entry].slice(-40) }));
  return entry.id;
}

function editLog(id: string, entryId: string, message: string) {
  updateEbook(id, (e) => ({
    ...e,
    activity: e.activity.map((a) => (a.id === entryId ? { ...a, message, state: "hecho" } : a)),
  }));
}

const running = new Set<string>();

/** Lecturas recomendadas del Investigador (en segundo plano: no frena la redacción). */
export async function suggestReadings(id: string) {
  const ebook = getEbook(id);
  if (!ebook || running.has(id)) return;
  running.add(id);
  try {
    updateEbook(id, (e) => ({ ...e, referencesState: "sugiriendo" }));
    const entry = log(id, "Buscando lecturas recomendadas", "trabajando");
    await new Promise((r) => setTimeout(r, 2200 / simSettings.speed));
    const current = getEbook(id);
    if (!current) return;
    const taken = new Set(current.references.map((r) => normalize(r.title)));
    const total = current.chapters.length || 5;
    const fresh: Reference[] = readingsFor(current.nicheId)
      .filter((r) => !taken.has(normalize(r.title)))
      .map((r, i) => ({
        ...r,
        id: uid(),
        chapters: [((i * 2) % total) + 1],
        origin: "sugerida" as const,
        check: "pendiente" as const,
      }));
    updateEbook(id, (e) => ({ ...e, references: [...e.references, ...fresh] }));
    const results = await Promise.all(fresh.map((r) => verifyInBackground(id, r.id)));
    const verified = results.filter((r) => r?.check === "verificada").length;
    updateEbook(id, (e) => ({ ...e, referencesState: "listo" }));
    editLog(
      id,
      entry,
      fresh.length ? `${fresh.length} lecturas sugeridas · ${verified} verificadas` : "No hay lecturas nuevas que sugerir",
    );
    if (fresh.length) announce(`${fresh.length} lecturas sugeridas.`);
  } finally {
    running.delete(id);
  }
}
