"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { IconButton } from "@/components/ui/Button";
import { wordCount } from "@/lib/api/mock/content";
import { bookFontStack } from "@/lib/design";
import { DISCLAIMERS } from "@/lib/guardrails";
import type { Ebook } from "@/lib/types";
import { ChapterPage } from "./ChapterPage";
import { Cover } from "./Cover";

interface BookPreviewProps {
  ebook: Ebook;
  /** Capítulo al que desplazarse (por ejemplo, el que se edita). */
  focusChapter?: number;
}

/** Libro completo, página a página: portada, aviso legal, índice y capítulos. */
export function BookPreview({ ebook, focusChapter }: BookPreviewProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const legal = ebook.sensitivity !== "ninguno" ? DISCLAIMERS[ebook.sensitivity] : null;
  const fontStyle = { fontFamily: bookFontStack(ebook.design.font), fontSize: `${ebook.design.bodySizePt * 1.26}px` };

  // Número de página aproximado de cada capítulo (A5 ≈ 280 palabras por página).
  const starts = useMemo(() => {
    const perPage = ebook.design.pageSize === "A5" || ebook.design.pageSize === "6x9" ? 280 : 480;
    const result: number[] = [];
    let page = legal ? 4 : 3;
    for (const c of ebook.chapters) {
      result.push(page);
      page += Math.max(1, Math.ceil(wordCount(c.sections) / perPage));
    }
    return result;
  }, [ebook.chapters, ebook.design.pageSize, legal]);

  const sheets = 1 + (legal ? 1 : 0) + 1 + ebook.chapters.length;

  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setCurrent(Number((visible.target as HTMLElement).dataset.sheet));
      },
      { root, threshold: [0.25, 0.5, 0.75] },
    );
    root.querySelectorAll("[data-sheet]").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [sheets]);

  function scrollToSelector(selector: string) {
    const root = scroller.current;
    const el = root?.querySelector<HTMLElement>(selector);
    if (!root || !el) return;
    const top = el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 20;
    root.scrollTo({ top, behavior: "smooth" });
  }

  useEffect(() => {
    if (focusChapter) scrollToSelector(`[data-chapter="${focusChapter}"]`);
  }, [focusChapter]);

  function go(delta: number) {
    const target = Math.min(sheets - 1, Math.max(0, current + delta));
    scrollToSelector(`[data-sheet="${target}"]`);
  }

  let sheet = 0;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto bg-mesa px-[6%] py-6" tabIndex={0} aria-label="Vista previa del libro">
        <div className="mx-auto grid max-w-[560px] gap-6">
          <div data-sheet={sheet++} className="hoja-libro grid place-items-center rounded-[4px] p-[12%] shadow-sm">
            <Cover
              title={ebook.title}
              subtitle={ebook.subtitle}
              author={ebook.design.author}
              cloth={ebook.design.clothColor}
              template={ebook.design.coverTemplate}
              className="w-full max-w-[300px]"
            />
          </div>
          {legal && (
            <div data-sheet={sheet++} className="hoja-libro rounded-[4px] px-[10%] py-[12%] shadow-sm" style={fontStyle}>
              <h3 className="mb-3 font-display text-[1.2em] font-medium text-[#1b1d23]">Aviso legal</h3>
              <p className="leading-[1.62] text-[#26282e]">{legal.text}</p>
            </div>
          )}
          <div data-sheet={sheet++} className="hoja-libro rounded-[4px] px-[10%] py-[12%] shadow-sm" style={fontStyle}>
            <h3 className="mb-4 font-display text-[1.4em] font-medium text-[#1b1d23]">Índice</h3>
            <ol className="grid gap-2">
              {ebook.chapters.map((c, i) => (
                <li key={c.id} className="flex items-baseline gap-3 text-[#26282e]">
                  <span className="font-display text-[#0e7c74]">{c.number}</span>
                  <span className="flex-1">{c.title}</span>
                  <span aria-hidden className="mx-1 hidden flex-1 border-b border-dotted border-[#c8ccd3] sm:block" />
                  <span className="font-display text-[0.9em] text-[#6e7480]">{starts[i]}</span>
                </li>
              ))}
            </ol>
          </div>
          {ebook.chapters.map((c, i) => (
            <div key={c.id} data-sheet={sheet++} data-chapter={c.number} className="scroll-mt-6 shadow-sm">
              <ChapterPage ebook={ebook} chapter={c} page={starts[i]} />
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-center gap-3 border-t border-linea bg-pagina py-2 text-[13px] text-grafito">
        <IconButton label="Hoja anterior" size="sm" onClick={() => go(-1)} disabled={current === 0}>
          <ChevronLeft />
        </IconButton>
        <span className="tabular-nums">
          Hoja {current + 1} de {sheets}
        </span>
        <IconButton label="Hoja siguiente" size="sm" onClick={() => go(1)} disabled={current >= sheets - 1}>
          <ChevronRight />
        </IconButton>
      </div>
    </div>
  );
}
