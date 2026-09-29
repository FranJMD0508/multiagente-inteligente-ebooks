"use client";

import { AnimatePresence, motion } from "motion/react";
import { useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** Aviso discreto cuando se pierde la conexión (docs/07 §7). */
export function OfflineNotice() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-[#1b1d23] px-4 py-3 text-[14px] text-white shadow-xl"
        >
          <span aria-hidden className="size-2 rounded-full bg-aviso" />
          Sin conexión. Seguimos escribiendo tu libro y la pantalla se pondrá al día al reconectar.
        </motion.div>
      )}
    </AnimatePresence>
  );
}
