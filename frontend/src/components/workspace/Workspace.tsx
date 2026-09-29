"use client";

import { motion } from "motion/react";
import { Tabs } from "radix-ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { BookPreview } from "@/components/book/BookPreview";
import { cn } from "@/lib/cn";
import type { Ebook } from "@/lib/types";
import { ExportDialog } from "./ExportDialog";
import { PhaseStrip } from "./PhaseStrip";
import { ChapterScroller } from "./previews/ChapterScroller";
import { OutlinePreview } from "./previews/OutlinePreview";
import { ChapterOneReview } from "./stages/ChapterOneReview";
import { ChapterOneWriting } from "./stages/ChapterOneWriting";
import { CoverPreview } from "./stages/DesignPanel";
import { FinalReview, type FinalTab } from "./stages/FinalReview";
import { OutlineReview } from "./stages/OutlineReview";
import { Researching } from "./stages/Researching";
import { Writing } from "./stages/Writing";
import { WorkspaceHeader } from "./WorkspaceHeader";

type MobileTab = "decidir" | "libro";

const tabClass =
  "flex-1 rounded-full px-4 py-1.5 text-[14px] text-grafito data-[state=active]:bg-pagina data-[state=active]:font-medium data-[state=active]:text-texto data-[state=active]:shadow-[0_1px_3px_rgb(var(--sombra)/0.12)]";

export function Workspace({ ebook, fresh }: { ebook: Ebook; fresh: boolean }) {
  const [mobileTab, setMobileTab] = useState<MobileTab>("decidir");
  const [reading, setReading] = useState<number | undefined>();
  const [finalTab, setFinalTab] = useState<FinalTab>("texto");
  const [selected, setSelected] = useState(1);
  const [exportOpen, setExportOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const prevStatus = useRef(ebook.status);

  // Celebración breve cuando el libro termina mientras el usuario mira.
  useEffect(() => {
    if (prevStatus.current !== "listo" && ebook.status === "listo") setCelebrate(true);
    prevStatus.current = ebook.status;
  }, [ebook.status]);

  const onSelect = useCallback((n: number) => setSelected(n), []);
  const s = ebook.status;

  // ----- Página izquierda: lo que decides -----
  let left: React.ReactNode;
  if (s === "investigando") left = <Researching ebook={ebook} />;
  else if (s === "indice_pendiente") left = <OutlineReview ebook={ebook} />;
  else if (s === "redactando_cap1") left = <ChapterOneWriting ebook={ebook} />;
  else if (s === "cap1_pendiente") left = <ChapterOneReview ebook={ebook} />;
  else if (s === "listo")
    left = (
      <FinalReview
        ebook={ebook}
        tab={finalTab}
        onTab={setFinalTab}
        selected={selected}
        onSelect={onSelect}
        celebrate={celebrate}
        onDismiss={() => setCelebrate(false)}
      />
    );
  else
    left = (
      <Writing
        ebook={ebook}
        reading={reading}
        onRead={(n) => {
          setReading(n);
          setMobileTab("libro");
        }}
      />
    );

  // ----- Página derecha: tu libro -----
  let right: React.ReactNode;
  if (s === "investigando" || s === "indice_pendiente") right = <OutlinePreview ebook={ebook} />;
  else if (s === "redactando_cap1" || s === "cap1_pendiente") right = <ChapterScroller ebook={ebook} chapter={ebook.chapters[0]} />;
  else if (s === "listo") right = finalTab === "estilo" ? <CoverPreview ebook={ebook} /> : <BookPreview ebook={ebook} focusChapter={selected} />;
  else if (s === "maquetando") right = <BookPreview ebook={ebook} />;
  else {
    const writing = ebook.chapters.find((c) => c.status === "generando");
    const failed = ebook.chapters.find((c) => c.status === "error");
    const chosen = ebook.chapters.find((c) => c.number === reading);
    const chapter = writing && !chosen ? writing : (chosen ?? failed ?? writing ?? ebook.chapters[0]);
    right = <ChapterScroller ebook={ebook} chapter={chapter} />;
  }

  const ease = [0.2, 0.8, 0.2, 1] as const;

  return (
    <div className="flex flex-1 flex-col lg:h-dvh lg:min-h-0">
      <WorkspaceHeader ebook={ebook} onExport={() => setExportOpen(true)} />
      <PhaseStrip ebook={ebook} />

      <Tabs.Root value={mobileTab} onValueChange={(v) => setMobileTab(v as MobileTab)} className="px-4 pt-3 lg:hidden">
        <Tabs.List aria-label="Vista" className="flex gap-0.5 rounded-full bg-control p-1">
          <Tabs.Trigger value="decidir" className={tabClass}>
            Decidir
          </Tabs.Trigger>
          <Tabs.Trigger value="libro" className={tabClass}>
            Tu libro
          </Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>

      <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-3 sm:px-6 sm:pb-6 lg:pt-4" style={{ perspective: 1800 }}>
        <div className="grid min-h-0 flex-1 rounded-[18px] shadow-[0_18px_44px_rgb(var(--sombra)/0.1),0_2px_6px_rgb(var(--sombra)/0.05)] lg:grid-cols-[1.1fr_1fr]">
          <motion.section
            aria-label="Lo que decides"
            initial={fresh ? { x: "46%" } : false}
            animate={{ x: 0 }}
            transition={{ duration: 0.55, ease }}
            className={cn(
              "pagina-izq relative z-[1] min-h-0 rounded-[18px] px-5 pb-5 pt-7 sm:px-8 sm:pt-8 lg:overflow-y-auto lg:rounded-r-none",
              mobileTab === "libro" && "max-lg:hidden",
            )}
          >
            {left}
          </motion.section>
          <motion.section
            aria-label="Tu libro"
            initial={fresh ? { opacity: 0, rotateY: -70 } : false}
            animate={{ opacity: 1, rotateY: 0 }}
            transition={{ duration: 0.6, ease, delay: fresh ? 0.12 : 0 }}
            style={{ transformOrigin: "left center" }}
            className={cn(
              "pagina-der min-h-0 overflow-hidden rounded-[18px] max-lg:h-[76dvh] lg:rounded-l-none",
              mobileTab === "decidir" && "max-lg:hidden",
            )}
          >
            {right}
          </motion.section>
        </div>
      </div>

      {s === "listo" && <ExportDialog ebook={ebook} open={exportOpen} onOpenChange={setExportOpen} />}
    </div>
  );
}
