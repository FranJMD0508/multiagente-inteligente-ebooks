"use client";

import { useEffect, useRef } from "react";
import { ChapterPage } from "@/components/book/ChapterPage";
import type { Chapter, Ebook } from "@/lib/types";

/** Página derecha con un capítulo. Sigue el texto mientras se escribe, salvo que el usuario suba. */
export function ChapterScroller({ ebook, chapter }: { ebook: Ebook; chapter: Chapter }) {
  const ref = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const length = Object.values(chapter.sections ?? {}).join("").length;

  useEffect(() => {
    follow.current = true;
    ref.current?.scrollTo({ top: 0 });
  }, [chapter.id]);

  useEffect(() => {
    const el = ref.current;
    if (el && chapter.status === "generando" && follow.current) el.scrollTop = el.scrollHeight;
  }, [length, chapter.status]);

  return (
    <div
      ref={ref}
      tabIndex={0}
      aria-label={`Vista previa del capítulo ${chapter.number}`}
      onScroll={(e) => {
        const el = e.currentTarget;
        follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
      }}
      className="h-full overflow-y-auto"
    >
      <ChapterPage ebook={ebook} chapter={chapter} className="min-h-full rounded-none bg-transparent" />
    </div>
  );
}
