// Caché del lado del cliente. En esta fase la llenan los mocks; en la fase 4
// la llenará el adaptador HTTP con las respuestas REST y los eventos SSE.

import type { Ebook } from "@/lib/types";
import { uid } from "@/lib/uid";

export interface StoreState {
  ready: boolean;
  owner: string | null;
  ebooks: Record<string, Ebook>;
  /** Ids ordenados del más reciente al más antiguo. */
  order: string[];
  announcement: { id: string; text: string } | null;
}

const EMPTY: StoreState = { ready: false, owner: null, ebooks: {}, order: [], announcement: null };

let state: StoreState = EMPTY;
const listeners = new Set<() => void>();
let persistTimer: ReturnType<typeof setTimeout> | null = null;

const keyFor = (owner: string) => `folio:datos:${owner}`;

export function getState(): StoreState {
  return state;
}

export function getServerState(): StoreState {
  return EMPTY;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  listeners.forEach((l) => l());
}

function schedulePersist() {
  if (!state.owner || typeof window === "undefined") return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    if (!state.owner) return;
    try {
      localStorage.setItem(keyFor(state.owner), JSON.stringify({ ebooks: state.ebooks, order: state.order }));
    } catch {
      // Sin almacenamiento disponible: los datos viven solo en memoria.
    }
  }, 400);
}

export function setState(updater: (s: StoreState) => StoreState) {
  state = updater(state);
  emit();
  schedulePersist();
}

/** Carga los ebooks del usuario. Devuelve false si no había datos guardados. */
export function loadForUser(owner: string): boolean {
  let ebooks: Record<string, Ebook> = {};
  let order: string[] = [];
  let found = false;
  try {
    const raw = localStorage.getItem(keyFor(owner));
    if (raw) {
      const parsed = JSON.parse(raw) as { ebooks: Record<string, Ebook>; order: string[] };
      ebooks = parsed.ebooks ?? {};
      order = (parsed.order ?? []).filter((id) => ebooks[id]);
      found = true;
    }
  } catch {
    found = false;
  }
  state = { ready: true, owner, ebooks, order, announcement: null };
  emit();
  return found;
}

export function clearSession() {
  state = { ...EMPTY, ready: true };
  emit();
}

export function getEbook(id: string): Ebook | undefined {
  return state.ebooks[id];
}

export function putEbook(ebook: Ebook, { toFront = true } = {}) {
  setState((s) => ({
    ...s,
    ebooks: { ...s.ebooks, [ebook.id]: ebook },
    order: toFront ? [ebook.id, ...s.order.filter((x) => x !== ebook.id)] : s.order.includes(ebook.id) ? s.order : [...s.order, ebook.id],
  }));
}

export function updateEbook(id: string, fn: (e: Ebook) => Ebook) {
  const current = state.ebooks[id];
  if (!current) return;
  const next = { ...fn(current), updatedAt: new Date().toISOString() };
  setState((s) => ({ ...s, ebooks: { ...s.ebooks, [id]: next } }));
}

export function removeEbook(id: string) {
  setState((s) => {
    const ebooks = { ...s.ebooks };
    delete ebooks[id];
    return { ...s, ebooks, order: s.order.filter((x) => x !== id) };
  });
}

export function replaceAll(ebooks: Ebook[]) {
  setState((s) => ({
    ...s,
    ebooks: Object.fromEntries(ebooks.map((e) => [e.id, e])),
    order: ebooks.map((e) => e.id),
  }));
}

/** Mensaje breve para lectores de pantalla (región aria-live). */
export function announce(text: string) {
  state = { ...state, announcement: { id: uid(), text } };
  emit();
}
