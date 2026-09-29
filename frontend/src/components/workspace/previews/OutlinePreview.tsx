import { AnimatePresence, motion } from "motion/react";
import { Cover } from "@/components/book/Cover";
import type { Ebook } from "@/lib/types";

/** Página derecha durante el índice: portada, aviso legal e índice. */
export function OutlinePreview({ ebook }: { ebook: Ebook }) {
  const researching = ebook.status === "investigando";
  const noTitle = researching && ebook.chapters.length === 0 && ebook.title === "Tu nuevo ebook";
  return (
    <div className="flex h-full flex-col items-center gap-5 overflow-y-auto px-6 pb-8 pt-6 text-[#1f2127] sm:px-10">
      <div className="flex w-full justify-between text-[12px] tracking-[0.04em] text-[#6e7480]">
        <span>Tu libro</span>
        <span>Vista previa</span>
      </div>
      <Cover
        title={noTitle ? "…" : ebook.title}
        subtitle={ebook.subtitle}
        author={ebook.design.author}
        cloth={ebook.design.clothColor}
        template={ebook.design.coverTemplate}
        className="w-[min(46%,190px)]"
      />
      <p className="w-full text-[12.5px] text-[#6e7480]">
        Portada{ebook.sensitivity !== "ninguno" ? " · Aviso legal" : ""} · Índice
      </p>
      <div className="w-full">
        <h3 className="mb-3 font-display text-[17px] font-medium tracking-[-0.02em] text-[#1b1d23]">Índice</h3>
        <ol className="grid gap-2 text-[14px]">
          <AnimatePresence initial={false}>
            {ebook.chapters.map((c) => (
              <motion.li
                key={c.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="flex gap-3"
              >
                <span className="w-4 flex-none font-display text-[#0e7c74]">{c.number}</span>
                <span className="text-[#33363d]">{c.title}</span>
              </motion.li>
            ))}
          </AnimatePresence>
          {researching &&
            Array.from({ length: Math.max(0, (ebook.desiredChapters === "auto" ? 6 : ebook.desiredChapters) - ebook.chapters.length) }).map((_, i) => (
              <li key={`sk-${i}`} aria-hidden className="h-3.5 rounded-full bg-[#eef0f3]" style={{ width: `${82 - i * 8}%` }} />
            ))}
        </ol>
      </div>
    </div>
  );
}
