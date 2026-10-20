"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useSyncExternalStore } from "react";
import { useStore } from "@/lib/api/hooks";
import { dismissToast } from "@/lib/api/store";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

const bar =
  "fixed bottom-5 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-2xl bg-[#1b1d23] px-4 py-3 text-[14px] text-white shadow-[0_12px_32px_rgb(20_24_33/0.28)]";

/**
 * Avisos discretos al pie (docs/07 §7): sin conexión, reconectando con el
 * servidor o un error al guardar. Solo se muestra uno a la vez.
 */
export function OfflineNotice() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  const { connection, toast } = useStore();

  let content: React.ReactNode = null;
  let key = "";
  if (!online) {
    key = "offline";
    content = (
      <>
        <span aria-hidden className="size-2 flex-none rounded-full bg-aviso" />
        Sin conexión. Seguimos escribiendo tu libro y la pantalla se pondrá al día al reconectar.
      </>
    );
  } else if (connection === "reconectando") {
    key = "reconectando";
    content = (
      <>
        <span aria-hidden className="anillo size-3.5 flex-none [--fondo-anillo:#1b1d23]" />
        Se cortó la conexión con el servidor. Reconectando…
      </>
    );
  } else if (toast) {
    key = toast.id;
    content = (
      <>
        <span aria-hidden className="size-2 flex-none rounded-full bg-[#f2867c]" />
        <span className="min-w-0">{toast.text}</span>
        <button
          type="button"
          onClick={dismissToast}
          aria-label="Cerrar aviso"
          className="-mr-1 grid size-7 flex-none place-items-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
        >
          <X className="size-4" />
        </button>
      </>
    );
  }

  return (
    <AnimatePresence>
      {content && (
        <motion.div
          key={key}
          role="status"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
          className={bar}
        >
          {content}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
