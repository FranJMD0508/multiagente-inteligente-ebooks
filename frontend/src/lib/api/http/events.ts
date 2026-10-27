// Stream de eventos del servidor (SSE, docs/03 §6) para todos los ebooks del
// usuario. Se lee con fetch (y no con EventSource) para poder mandar el token en
// la cabecera y controlar la reconexión.
//
// Respaldo: algunos proxies (por ejemplo, un túnel público) aceptan la conexión
// pero no dejan pasar los eventos hasta el final. Si el stream lleva un rato en
// silencio mientras algún ebook está en marcha, se piden esos ebooks cada pocos
// segundos. Con el stream funcionando no hace falta: los eventos llegan antes.

import type { Ebook, SectionId } from "@/lib/types";
import { API_URL } from "../mode";
import { announce, getState, setConnection } from "../store";
import { getToken, notifyUnauthorized, request } from "./client";
import { appendToken, applyServer, currentSession, forgetEbook } from "./sync";

const POLL_MS = 2500;
const WORKING = new Set(["investigando", "redactando_cap1", "redactando", "maquetando"]);

/** ¿El ebook está cambiando en el servidor (agentes trabajando o referencias comprobándose)? */
function inMotion(e: Ebook): boolean {
  return (
    WORKING.has(e.status) ||
    Boolean(e.busy) ||
    e.referencesState === "sugiriendo" ||
    e.references.some((r) => r.check === "pendiente")
  );
}

let lastData = 0;
let polling = false;

async function pollActive() {
  if (polling || Date.now() - lastData < POLL_MS) return;
  const active = Object.values(getState().ebooks).filter(inMotion);
  if (!active.length) return;
  polling = true;
  const since = currentSession();
  try {
    await Promise.all(
      active.map((e) =>
        request<Ebook>("GET", `/ebooks/${encodeURIComponent(e.id)}`)
          .then((fresh) => applyServer(fresh, since))
          .catch(() => undefined),
      ),
    );
  } finally {
    polling = false;
  }
}

type ServerEvent =
  | { type: "ebook.updated"; ebookId: string; ebook: Ebook }
  | { type: "ebook.deleted"; ebookId: string }
  | { type: "token"; ebookId: string; chapter: number; section: SectionId; delta: string; rev?: number }
  | { type: "notice"; ebookId: string; text: string }
  | { type: string; ebookId?: string };

function handle(event: ServerEvent) {
  switch (event.type) {
    case "ebook.updated":
      applyServer((event as { ebook: Ebook }).ebook);
      break;
    case "ebook.deleted":
      forgetEbook(event.ebookId!);
      break;
    case "token": {
      const t = event as { ebookId: string; chapter: number; section: SectionId; delta: string; rev?: number };
      appendToken(t.ebookId, t.chapter, t.section, t.delta, t.rev);
      break;
    }
    case "notice":
      announce((event as { text: string }).text);
      break;
    default:
      // Eventos del contrato (agent.started, chapter.completed…): la instantánea
      // del ebook ya trae su efecto.
      break;
  }
}

let controller: AbortController | null = null;

/**
 * Abre el stream y lo mantiene vivo. `onReconnect` se llama al recuperar la
 * conexión para volver a pedir la biblioteca (pudo cambiar mientras tanto).
 */
export function connectEvents(onReconnect: () => Promise<void>) {
  disconnectEvents();
  const ctrl = new AbortController();
  controller = ctrl;
  lastData = 0;
  const poller = setInterval(() => void pollActive(), POLL_MS);
  ctrl.signal.addEventListener("abort", () => clearInterval(poller));
  let attempt = 0;
  let first = true;

  const loop = async () => {
    while (!ctrl.signal.aborted) {
      try {
        const token = getToken();
        if (!token) {
          setConnection(null);
          return;
        }
        const res = await fetch(`${API_URL}/api/events`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
          signal: ctrl.signal,
          cache: "no-store",
        });
        if (res.status === 401) {
          setConnection(null);
          notifyUnauthorized(token);
          return;
        }
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        setConnection("conectado");
        if (!first) {
          try {
            await onReconnect();
          } catch (err) {
            // Sin leer la biblioteca no se sigue: se cierra esta conexión para no dejarla abierta.
            await res.body.cancel().catch(() => undefined);
            throw err;
          }
        }
        first = false;
        attempt = 0;

        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          lastData = Date.now();
          buffer += value;
          let sep: number;
          while ((sep = buffer.search(/\r?\n\r?\n/)) >= 0) {
            const block = buffer.slice(0, sep);
            buffer = buffer.slice(sep).replace(/^\r?\n\r?\n/, "");
            const data = block
              .split(/\r?\n/)
              .filter((l) => l.startsWith("data:"))
              .map((l) => l.slice(5).replace(/^ /, ""))
              .join("\n");
            if (!data) continue; // comentarios ": ping"
            try {
              handle(JSON.parse(data) as ServerEvent);
            } catch (err) {
              console.error("Evento SSE ilegible", err);
            }
          }
        }
      } catch (err) {
        if (ctrl.signal.aborted) return;
        console.warn("Se cortó el stream de eventos", err);
      }
      if (ctrl.signal.aborted) return;
      setConnection("reconectando");
      first = false;
      const delay = [1000, 2000, 5000, 10000][Math.min(attempt++, 3)];
      await new Promise((r) => setTimeout(r, delay));
    }
  };
  void loop();
}

export function disconnectEvents() {
  controller?.abort();
  controller = null;
  setConnection(null);
}
