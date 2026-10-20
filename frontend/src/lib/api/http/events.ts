// Stream de eventos del servidor (SSE, docs/03 §6) para todos los ebooks del
// usuario. Se lee con fetch (y no con EventSource) para poder mandar el token en
// la cabecera y controlar la reconexión.

import type { Ebook, SectionId } from "@/lib/types";
import { API_URL } from "../mode";
import { announce, setConnection } from "../store";
import { getToken, notifyUnauthorized } from "./client";
import { appendToken, applyServer, forgetEbook } from "./sync";

type ServerEvent =
  | { type: "ebook.updated"; ebookId: string; ebook: Ebook }
  | { type: "ebook.deleted"; ebookId: string }
  | { type: "token"; ebookId: string; chapter: number; section: SectionId; delta: string }
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
      const t = event as { ebookId: string; chapter: number; section: SectionId; delta: string };
      appendToken(t.ebookId, t.chapter, t.section, t.delta);
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
          notifyUnauthorized();
          return;
        }
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        setConnection("conectado");
        if (!first) await onReconnect();
        first = false;
        attempt = 0;

        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
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
