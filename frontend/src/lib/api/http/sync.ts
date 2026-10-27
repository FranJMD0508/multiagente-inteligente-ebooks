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
  /** Envío en curso (o el que se lanzará al vencer el temporizador); `false` si falló. */
  flush?: () => Promise<boolean>;
  inflight?: Promise<boolean>;
}

const pending = new Map<string, Map<string, Pending>>();
let seqCounter = 0;

/**
 * Sesión en curso. `resetSync` (al cerrar la sesión) la cambia, y lo que responda el
 * servidor a una petición de la sesión anterior se descarta: en un equipo compartido,
 * los ebooks de una cuenta no deben aparecer en la biblioteca de la siguiente.
 */
let session = 0;
export const currentSession = () => session;
export const isStale = (since: number) => since !== session;

/** Limpiezas de otros módulos al olvidar un ebook (`id`) o toda la sesión (`undefined`). */
const forgetHooks: ((id?: string) => void)[] = [];
export function onForget(fn: (id?: string) => void) {
  forgetHooks.push(fn);
}

/** `a` es más reciente que `b` según la revisión del servidor (sube con cada cambio y cada token). */
const newer = (a: Ebook | undefined, b: Ebook) => a?.rev !== undefined && b.rev !== undefined && a.rev > b.rev;

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

/**
 * Guarda en la caché el ebook que manda el servidor, con los cambios pendientes encima.
 * Una instantánea anterior a la que ya se tiene (por ejemplo, la respuesta REST de un
 * cambio de portada que llega después de los tokens del capítulo en curso) se descarta.
 * Con `since` (la sesión al hacer la petición), se descarta también si la sesión cambió.
 */
export function applyServer(e: Ebook, since?: number) {
  if (since !== undefined && isStale(since)) return;
  if (newer(getState().ebooks[e.id], e)) return;
  const next = withPending(normalizeEbook(e));
  setState((s) => ({
    ...s,
    ebooks: { ...s.ebooks, [next.id]: next },
    order: s.order.includes(next.id) ? s.order : [next.id, ...s.order],
  }));
}

/** Sustituye toda la biblioteca (al conectar o reconectar), respetando lo pendiente. */
export function applyServerList(list: Ebook[], since?: number) {
  if (since !== undefined && isStale(since)) return;
  const ids = new Set(list.map((e) => e.id));
  const ebooks: Record<string, Ebook> = {};
  // La lista completa manda (se pide al conectar o reconectar, también tras reiniciarse el servidor).
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
  forgetHooks.forEach((fn) => fn(id));
  removeEbook(id);
}

/** Concatena un trozo de texto que llega en streaming (`rev`: la revisión del servidor tras él). */
export function appendToken(id: string, chapter: number, section: SectionId, delta: string, rev?: number) {
  const e = getState().ebooks[id];
  if (!e) return;
  setState((s) => ({
    ...s,
    ebooks: {
      ...s.ebooks,
      [id]: {
        ...e,
        ...(rev !== undefined ? { rev } : {}),
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

  const run = async (): Promise<boolean> => {
    const since = session;
    try {
      const result = await entry.send();
      if (isStale(since)) return false;
      if (ops.get(key)?.seq === seq) ops.delete(key);
      if (result) applyServer(result);
      return true;
    } catch (err) {
      if (isStale(since)) return false;
      if (ops.get(key)?.seq === seq) ops.delete(key);
      const message = (err as Error).message;
      showToast(opts.errorPrefix ? `${opts.errorPrefix} ${message}` : message);
      opts.onError?.(err as Error);
      void resync(id);
      return false;
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

/**
 * Envía ya las ediciones que esperaban (antes de aprobar o exportar, por ejemplo). Si
 * alguna no se pudo guardar, lanza un error: aprobar el índice viejo o exportar sin la
 * última edición sería peor que no hacerlo.
 */
export async function flushPending(id: string) {
  const ops = pending.get(id);
  if (!ops) return;
  // Los que esperan su temporizador se envían ya, y se espera a los que están en camino.
  const results = await Promise.all([...ops.values()].map((p) => p.flush?.() ?? Promise.resolve(true)));
  if (results.includes(false)) {
    throw new Error("No pudimos guardar tus últimos cambios, así que no seguimos. Revisa la conexión e inténtalo de nuevo.");
  }
}

/** Al cerrar la sesión no debe quedar nada pendiente de otra cuenta. */
export function resetSync() {
  session++;
  pending.forEach((ops) => ops.forEach((p) => p.timer && clearTimeout(p.timer)));
  pending.clear();
  creatingIds.clear();
  forgetHooks.forEach((fn) => fn());
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
  const since = session;
  try {
    const result = await send();
    if (result) applyServer(result, since);
  } catch (err) {
    if (isStale(since)) return;
    showToast((err as Error).message);
    void resync(id);
  }
}
