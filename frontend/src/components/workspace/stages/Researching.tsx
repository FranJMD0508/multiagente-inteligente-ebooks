import { GripVertical } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { Ebook } from "@/lib/types";
import { ActivityLog } from "../ActivityLog";
import { StageHeader } from "../StageHeader";

export function Researching({ ebook }: { ebook: Ebook }) {
  const expected = ebook.desiredChapters === "auto" ? 6 : ebook.desiredChapters;
  return (
    <div className="grid gap-6">
      <StageHeader
        title="Estamos armando tu índice"
        subtitle="Suele tardar menos de un minuto. Puedes salir: te avisaremos cuando sea tu turno."
      />
      <ActivityLog entries={ebook.activity} limit={6} />
      <ol className="grid gap-2" aria-label="Capítulos propuestos hasta ahora">
        <AnimatePresence initial={false}>
          {ebook.chapters.map((c) => (
            <motion.li
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.26, ease: [0.2, 0.8, 0.2, 1] }}
              className="flex items-center gap-3 rounded-xl bg-barra px-3 py-2.5"
            >
              <GripVertical aria-hidden className="size-4 text-borde-control" />
              <span className="w-4 font-display text-[14px] font-medium text-tinta">{c.number}</span>
              <span className="text-[14.5px] font-medium">{c.title}</span>
            </motion.li>
          ))}
        </AnimatePresence>
        {Array.from({ length: Math.max(0, expected - ebook.chapters.length) }).map((_, i) => (
          <li key={`sk-${i}`} aria-hidden className="esqueleto h-11 rounded-xl" style={{ width: `${100 - i * 6}%` }} />
        ))}
      </ol>
    </div>
  );
}
