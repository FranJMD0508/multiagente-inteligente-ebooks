"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Ribbon } from "@/components/book/Ribbon";
import { PromptBox, type ChapterChoice, type PromptBoxHandle } from "@/components/home/PromptBox";
import { Chip } from "@/components/ui/Chip";
import { api } from "@/lib/api";
import { useEbookList } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth";
import { NICHES } from "@/lib/niches";
import { usePrefs } from "@/lib/prefs";
import { ebookHref } from "@/lib/routes";
import { IDEA_KEY } from "@/components/workspace/StageError";

const MIN_LENGTH = 12;

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { prefs } = usePrefs();
  const { ebooks } = useEbookList();
  const box = useRef<PromptBoxHandle>(null);

  const [idea, setIdea] = useState("");
  const [nicheId, setNicheId] = useState<string | undefined>();
  const [chapters, setChapters] = useState<ChapterChoice>("auto");
  const [audience, setAudience] = useState("");
  // Respuesta del guardarraíl cuando la idea es ficción o queda fuera de alcance (RF-01).
  const [rejection, setRejection] = useState<{ reason: string; alternatives: string[] } | null>(null);
  const [checking, setChecking] = useState(false);
  const fiction = rejection !== null;

  // Idea elegida entre las alternativas que propuso el guardarraíl del servidor.
  useEffect(() => {
    try {
      const pending = sessionStorage.getItem(IDEA_KEY);
      if (pending === null) return;
      sessionStorage.removeItem(IDEA_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única al montar
      setIdea(pending);
      box.current?.focus();
    } catch {
      // Sin almacenamiento.
    }
  }, []);

  const firstName = (user?.name ?? "").split(" ")[0];
  const canSubmit = idea.trim().length >= MIN_LENGTH && !checking;

  async function submit() {
    if (checking) return;
    setChecking(true);
    const verdict = await api.checkTopic(idea);
    setChecking(false);
    if (!verdict.ok) {
      setRejection({ reason: verdict.reason, alternatives: verdict.alternatives });
      return;
    }
    const id = api.createEbook({
      prompt: idea,
      nicheId: nicheId ?? verdict.nicheId,
      audience,
      desiredChapters: chapters === "auto" ? "auto" : (Number(chapters) as 5 | 6 | 7),
      exercisePref: prefs.exercisePref,
      author: prefs.authorName || user?.name || "",
    });
    router.push(ebookHref(id, { nuevo: true }));
  }

  function applyIdea(text: string, niche?: string, aud?: string) {
    setIdea(text);
    setNicheId(niche);
    if (aud !== undefined) setAudience(aud);
    setRejection(null);
    box.current?.focus();
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8 sm:py-12">
      <section aria-labelledby="saludo" className="hoja w-full max-w-[760px] px-5 pb-6 pt-7 sm:px-14 sm:pb-8 sm:pt-9">
        <Ribbon className="right-10 sm:right-14" />
        <div className="mb-8 flex justify-between pr-10 text-[12.5px] tracking-[0.04em] text-tenue sm:mb-10">
          <span>Folio</span>
          <span className="hidden sm:inline">Nuevo ebook</span>
        </div>

        <div className="text-center">
          <h1 id="saludo" className="font-display text-[36px] font-medium leading-[1.05] tracking-[-0.035em] sm:text-[46px]">
            Hola, <span className="text-tinta">{firstName}</span>
          </h1>
          <p className="mt-3 text-[18px] text-grafito sm:text-[20px]">¿Sobre qué quieres escribir hoy?</p>
        </div>

        <div className="mt-8">
          <PromptBox
            ref={box}
            value={idea}
            onChange={(v) => {
              setIdea(v);
              if (fiction) setRejection(null);
              if (!v.trim()) setNicheId(undefined);
            }}
            chapters={chapters}
            onChaptersChange={setChapters}
            audience={audience}
            onAudienceChange={setAudience}
            onSubmit={submit}
            canSubmit={canSubmit}
            busy={checking}
          />
        </div>

        <AnimatePresence initial={false}>
          {fiction && (
            <motion.div
              key="ficcion"
              role="status"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 rounded-2xl bg-control px-4 py-3.5 text-left">
                <p className="text-[14.5px] text-texto">
                  <strong className="font-semibold">{rejection?.reason}</strong>
                  {rejection?.reason.includes("¿") ? null : " ¿Probamos con alguna de estas ideas?"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {rejection?.alternatives.map((alt) => (
                    <Chip key={alt} onClick={() => applyIdea(alt)}>
                      {alt}
                    </Chip>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-6 flex flex-wrap justify-center gap-2" role="group" aria-label="Ideas para empezar">
          {NICHES.slice(0, 5).map((n) => (
            <Chip key={n.id} cloth={n.cloth} pressed={nicheId === n.id && idea === n.idea} onClick={() => applyIdea(n.idea, n.id, "")}>
              {n.label}
            </Chip>
          ))}
        </div>

        {ebooks.length === 0 && (
          <p className="mx-auto mt-6 max-w-[46ch] text-center text-[13.5px] text-tenue">
            Escribes tu idea, apruebas el índice y el primer capítulo, y en unos minutos descargas tu ebook.
          </p>
        )}

        <p className="mt-8 text-center font-display text-[13px] text-tenue" aria-hidden>
          1
        </p>
      </section>
    </div>
  );
}
