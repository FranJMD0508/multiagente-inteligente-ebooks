// Sincronización entre la caché del cliente y el servidor.
//
// Las ediciones se aplican al instante en la caché (optimistas) y quedan como
// "operaciones pendientes" hasta que el servidor las confirma. Cada vez que llega
// el ebook del servidor (respuesta REST o evento SSE) se vuelven a aplicar encima
// las operaciones pendientes: así una instantánea anterior a tu cambio no borra
// lo que acabas de escribir. Las operaciones son idempotentes ("poner X").

import { normalizeEbook } from "@/lib/design";
import type { Ebook, SectionId } from "@/lib/types";
import { getEbook, getState, removeEbook, setState, showToast, updateEbook } from "../store";

type Op = (e: Ebook) => Ebook;

interface Pending {
  seq: number;
  apply: Op;
  timer: ReturnType<typeof setTimeout> | null;
  send: () => Promise<Ebook | void>;
  /** Envío en curso (o el que se lanzará al vencer el temporizador). */
  flush?: () => Promise<void>;
  inflight?: Promise<void>;
}

const pending = new Map<string, Map<string, Pending>>();
let seqCounter = 0;

function opsFor(id: string): Map<string, Pending> {
  let ops = pending.get(id);
  if (!ops) {
    ops = new Map();
    pending.set(id, ops);
  }
  return ops;
}

function withPending(e: Ebook): Ebook {
  const ops = pending.get(e.id);
  if (!ops?.size) return e;
  let next = e;
  // Primero lo que espera confirmación del servidor y al final lo que solo vive en el navegador.
  ops.forEach((op, key) => !key.startsWith(LOCAL) && (next = op.apply(next)));
  ops.forEach((op, key) => key.startsWith(LOCAL) && (next = op.apply(next)));
  return next;
}

const LOCAL = "local:";

/**
 * Cambio que se ve en la caché pero no se envía al servidor, porque todavía no
 * es válido (por ejemplo, una tela sin contraste: la interfaz avisa y propone un
 * tono accesible). Con `apply = null` se descarta.
 */
export function holdLocal(id: string, key: string, apply: Op | null) {
  const ops = opsFor(id);
  const k = LOCAL + key;
  if (!apply) {
    ops.delete(k);
    return;
  }
  ops.set(k, { seq: -1, apply, timer: null, send: async () => undefined });
  updateEbook(id, apply);
}

/** Guarda en la caché el ebook que manda el servidor, con los cambios pendientes encima. */
export function applyServer(e: Ebook) {
  const next = withPending(normalizeEbook(e));
  setState((s) => ({
    ...s,
    ebooks: { ...s.ebooks, [next.id]: next },
    order: s.order.includes(next.id) ? s.order : [next.id, ...s.order],
  }));
}

/** Sustituye toda la biblioteca (al conectar o reconectar), respetando lo pendiente. */
export function applyServerList(list: Ebook[]) {
  const ids = new Set(list.map((e) => e.id));
  const ebooks: Record<string, Ebook> = {};
  list.forEach((e) => (ebooks[e.id] = withPending(normalizeEbook(e))));
  // Los que se están creando ahora mismo (aún sin confirmar) se conservan.
  const creating = getState().order.filter((id) => !ids.has(id) && creatingIds.has(id));
  creating.forEach((id) => {
    const e = getEbook(id);
    if (e) ebooks[id] = e;
  });
  setState((s) => ({ ...s, ebooks, order: [...creating, ...list.map((e) => e.id)] }));
}

export const creatingIds = new Set<string>();

export function forgetEbook(id: string) {
  pending.get(id)?.forEach((p) => p.timer && clearTimeout(p.timer));
  pending.delete(id);
  removeEbook(id);
}

/** Concatena un trozo de texto que llega en streaming. */
export function appendToken(id: string, chapter: number, section: SectionId, delta: string) {
  const e = getState().ebooks[id];
  if (!e) return;
  setState((s) => ({
    ...s,
    ebooks: {
      ...s.ebooks,
      [id]: {
        ...e,
        chapters: e.chapters.map((c) =>
          c.number === chapter
            ? {
                ...c,
                currentSection: section,
                sections: {
                  introduccion: "",
                  desarrollo: "",
                  ejemplos: "",
                  conclusion: "",
                  ...c.sections,
                  [section]: (c.sections?.[section] ?? "") + delta,
                },
              }
            : c,
        ),
      },
    },
  }));
}

interface MutateOptions {
  /** Espera antes de enviar (para agrupar pulsaciones de teclado). */
  debounce?: number;
  /** Si falla, ¿qué decir? (por defecto, el mensaje del servidor). */
  errorPrefix?: string;
  onError?: (err: Error) => void;
}

/**
 * Aplica `apply` en la caché ya mismo y la envía al servidor con `send`.
 * Con la misma `key`, solo cuenta la última operación (por ejemplo, el texto de una sección).
 */
export function mutate(id: string, key: string, apply: Op, send: () => Promise<Ebook | void>, opts: MutateOptions = {}) {
  updateEbook(id, apply);
  const ops = opsFor(id);
  const prev = ops.get(key);
  if (prev?.timer) clearTimeout(prev.timer);
  const seq = ++seqCounter;
  const entry: Pending = { seq, apply, timer: null, send };
  ops.set(key, entry);

  const run = async () => {
    try {
      const result = await entry.send();
      if (ops.get(key)?.seq === seq) ops.delete(key);
      if (result) applyServer(result);
    } catch (err) {
      if (ops.get(key)?.seq === seq) ops.delete(key);
      const message = (err as Error).message;
      showToast(opts.errorPrefix ? `${opts.errorPrefix} ${message}` : message);
      opts.onError?.(err as Error);
      void resync(id);
    }
  };
  // Un solo envío por operación, aunque lo pidan el temporizador y flushPending a la vez.
  entry.flush = () => {
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = null;
    entry.inflight ??= run();
    return entry.inflight;
  };

  if (opts.debounce) entry.timer = setTimeout(() => void entry.flush?.(), opts.debounce);
  else void entry.flush();
}

/** Envía ya las ediciones que esperaban (antes de exportar, por ejemplo). */
export async function flushPending(id: string) {
  const ops = pending.get(id);
  if (!ops) return;
  // Los que esperan su temporizador se envían ya, y se espera a los que están en camino.
  // Los errores ya se avisan dentro de cada envío: aquí no se propagan.
  await Promise.all([...ops.values()].map((p) => p.flush?.()));
}

/** Al cerrar la sesión no debe quedar nada pendiente de otra cuenta. */
export function resetSync() {
  pending.forEach((ops) => ops.forEach((p) => p.timer && clearTimeout(p.timer)));
  pending.clear();
  creatingIds.clear();
}

let resyncImpl: ((id: string) => Promise<void>) | null = null;

export function setResync(fn: (id: string) => Promise<void>) {
  resyncImpl = fn;
}

async function resync(id: string) {
  await resyncImpl?.(id).catch(() => undefined);
}

/** Acción puntual (aprobar, regenerar…): cambio optimista opcional y respuesta del servidor. */
export async function action(id: string, send: () => Promise<Ebook | void>, optimistic?: Op) {
  if (optimistic) updateEbook(id, optimistic);
  try {
    const result = await send();
    if (result) applyServer(result);
  } catch (err) {
    showToast((err as Error).message);
    void resync(id);
  }
}
