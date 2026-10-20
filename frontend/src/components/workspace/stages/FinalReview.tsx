"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Tabs } from "radix-ui";
import { IconButton } from "@/components/ui/Button";
import type { Ebook } from "@/lib/types";
import { DesignPanel, type StyleView } from "./DesignPanel";
import { ReferencesPanel } from "./ReferencesPanel";
import { TextEditor } from "./TextEditor";

export type FinalTab = "texto" | "estilo" | "referencias";

interface FinalReviewProps {
  ebook: Ebook;
  tab: FinalTab;
  onTab: (t: FinalTab) => void;
  selected: number;
  onSelect: (n: number) => void;
  styleView: StyleView;
  onStyleView: (v: StyleView) => void;
  celebrate: boolean;
  onDismiss: () => void;
}

const tabClass =
  "rounded-full px-4 py-1.5 text-[14px] text-grafito transition-[background-color,color,box-shadow] hover:text-texto data-[state=active]:bg-pagina data-[state=active]:font-medium data-[state=active]:text-texto data-[state=active]:shadow-[0_1px_3px_rgb(var(--sombra)/0.12)]";

export function FinalReview({ ebook, tab, onTab, selected, onSelect, styleView, onStyleView, celebrate, onDismiss }: FinalReviewProps) {
  const toReview = ebook.references.filter((r) => r.check === "no_encontrada").length;
  return (
    <div className="grid gap-5">
      <AnimatePresence initial={false}>
        {celebrate && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 rounded-2xl bg-menta px-4 py-3"
            role="status"
          >
            <span aria-hidden className="mini-portada h-11 w-8" style={{ ["--tela" as string]: ebook.design.clothColor }} />
            <div className="min-w-0 flex-1">
              <p className="font-display text-[16px] font-medium tracking-[-0.02em] text-tinta-oscura">Tu ebook está listo</p>
              <p className="text-[13.5px] text-texto">Revísalo, dale tu estilo y descárgalo.</p>
            </div>
            <IconButton label="Cerrar aviso" size="sm" onClick={onDismiss}>
              <X />
            </IconButton>
          </motion.div>
        )}
      </AnimatePresence>

      <Tabs.Root value={tab} onValueChange={(v) => onTab(v as FinalTab)} className="grid gap-5">
        <Tabs.List aria-label="Revisión final" className="flex w-fit max-w-full flex-wrap gap-0.5 rounded-full bg-control p-1">
          <Tabs.Trigger value="texto" className={tabClass}>
            Texto
          </Tabs.Trigger>
          <Tabs.Trigger value="estilo" className={tabClass}>
            Portada y estilo
          </Tabs.Trigger>
          <Tabs.Trigger value="referencias" className={tabClass}>
            Referencias
            {toReview > 0 && " "}
            {toReview > 0 && (
              <span className="ml-1.5 inline-grid min-w-5 place-items-center rounded-full bg-error px-1 text-[11.5px] font-semibold leading-5 text-white">
                {toReview}
                <span className="sr-only"> por revisar</span>
              </span>
            )}
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="texto" className="focus-visible:outline-none">
          <TextEditor ebook={ebook} selected={selected} onSelect={onSelect} />
        </Tabs.Content>
        <Tabs.Content value="estilo" className="focus-visible:outline-none">
          <DesignPanel ebook={ebook} view={styleView} onView={onStyleView} />
        </Tabs.Content>
        <Tabs.Content value="referencias" className="focus-visible:outline-none">
          <ReferencesPanel ebook={ebook} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
