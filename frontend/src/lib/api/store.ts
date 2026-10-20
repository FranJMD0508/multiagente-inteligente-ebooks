// Caché del lado del cliente. En el modo demo la llena el simulador y se guarda
// en localStorage; con backend la llena el adaptador HTTP con las respuestas
// REST y los eventos SSE, y no se guarda en el navegador.

import { normalizeEbook } from "@/lib/design";
import type { Ebook } from "@/lib/types";
import { uid } from "@/lib/uid";

export interface StoreState {
  ready: boolean;
  owner: string | null;
  ebooks: Record<string, Ebook>;
  /** Ids ordenados del más reciente al más antiguo. */
  order: string[];
  announcement: { id: string; text: string } | null;
  /** Aviso visible breve (por ejemplo, un error al guardar con backend). */
  toast: { id: string; text: string } | null;
  /** Conexión en vivo con el servidor (solo con backend). */
  connection: "conectado" | "reconectando" | null;
}

const EMPTY: StoreState = { ready: false, owner: null, ebooks: {}, order: [], announcement: null, toast: null, connection: null };

let state: StoreState = EMPTY;
const listeners = new Set<() => void>();
let persistTimer: ReturnType<typeof setTimeout> | null = null;
/** Solo el modo demo guarda los datos en el navegador. */
let persistLocally = true;

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
  if (!persistLocally || !state.owner || typeof window === "undefined") return;
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
      ebooks = Object.fromEntries(Object.entries(parsed.ebooks ?? {}).map(([id, e]) => [id, normalizeEbook(e)]));
      order = (parsed.order ?? []).filter((id) => ebooks[id]);
      found = true;
    }
  } catch {
    found = false;
  }
  state = { ...EMPTY, ready: true, owner, ebooks, order };
  emit();
  return found;
}

/** Carga los ebooks que devuelve el servidor (modo con backend: sin localStorage). */
export function loadRemote(owner: string, ebooks: Ebook[]) {
  persistLocally = false;
  state = {
    ...EMPTY,
    ready: true,
    owner,
    ebooks: Object.fromEntries(ebooks.map((e) => [e.id, normalizeEbook(e)])),
    order: ebooks.map((e) => e.id),
    connection: state.connection,
  };
  emit();
}

export function clearSession() {
  state = { ...EMPTY, ready: true };
  emit();
}

export function getEbook(id: string): Ebook | undefined {
  return state.ebooks[id];
}

export function putEbook(ebook: Ebook, { toFront = true } = {}) {
  const e = normalizeEbook(ebook);
  setState((s) => ({
    ...s,
    ebooks: { ...s.ebooks, [e.id]: e },
    order: toFront ? [e.id, ...s.order.filter((x) => x !== e.id)] : s.order.includes(e.id) ? s.order : [...s.order, e.id],
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
    ebooks: Object.fromEntries(ebooks.map((e) => [e.id, normalizeEbook(e)])),
    order: ebooks.map((e) => e.id),
  }));
}

/** Mensaje breve para lectores de pantalla (región aria-live). */
export function announce(text: string) {
  state = { ...state, announcement: { id: uid(), text } };
  emit();
}

/** Aviso visible (y anunciado) que se cierra solo. */
export function showToast(text: string) {
  const id = uid();
  state = { ...state, toast: { id, text }, announcement: { id, text } };
  emit();
  setTimeout(() => {
    if (state.toast?.id === id) {
      state = { ...state, toast: null };
      emit();
    }
  }, 6000);
}

export function dismissToast() {
  state = { ...state, toast: null };
  emit();
}

export function setConnection(connection: StoreState["connection"]) {
  if (state.connection === connection) return;
  state = { ...state, connection };
  emit();
}
