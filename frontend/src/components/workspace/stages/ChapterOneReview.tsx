"use client";

import { Bookmark, Pencil, RotateCw, Undo2 } from "lucide-react";
import { useState } from "react";
import { StructureChips } from "@/components/book/ChapterPage";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Dialog } from "@/components/ui/Dialog";
import { FieldShell, Textarea } from "@/components/ui/Field";
import { api } from "@/lib/api";
import { wordCount } from "@/lib/api/mock/content";
import {
  ADJUST_CHIP_LABELS,
  SECTION_LABELS,
  SECTION_ORDER,
  type ChapterAdjustChip,
  type Ebook,
  type SectionId,
} from "@/lib/types";
import { SectionProgress } from "./ChapterOneWriting";
import { StageHeader } from "../StageHeader";

function ManualEditor({ ebook, open, onOpenChange }: { ebook: Ebook; open: boolean; onOpenChange: (o: boolean) => void }) {
  const ch1 = ebook.chapters[0];
  const [draft, setDraft] = useState<Record<SectionId, string> | null>(null);
  const value = draft ?? ch1.sections!;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setDraft(null);
        onOpenChange(o);
      }}
      title="Editar el capítulo 1 a mano"
      description="Tu versión será la referencia de tono y formato para el resto del libro. Los nombres de sección son fijos."
      className="w-[min(94vw,720px)]"
    >
      <form
        className="grid max-h-[62vh] gap-4 overflow-y-auto pr-1"
        onSubmit={(e) => {
          e.preventDefault();
          api.editChapterOneManually(ebook.id, value);
          setDraft(null);
          onOpenChange(false);
        }}
      >
        {SECTION_ORDER.map((s) => (
          <FieldShell key={s} label={SECTION_LABELS[s]}>
            {(id) => (
              <Textarea
                id={id}
                rows={s === "desarrollo" ? 9 : 4}
                value={value[s]}
                onChange={(e) => setDraft({ ...value, [s]: e.target.value })}
                className="font-book text-[14.5px]"
              />
            )}
          </FieldShell>
        ))}
        <div className="sticky bottom-0 flex justify-end gap-2 bg-pagina pt-2">
          <Button onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="primario" type="submit">
            Guardar mi versión
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function ChapterOneReview({ ebook }: { ebook: Ebook }) {
  const ch1 = ebook.chapters[0];
  const [chips, setChips] = useState<ChapterAdjustChip[]>([]);
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const busy = ebook.busy?.kind === "capitulo1";
  const words = wordCount(ch1.sections);
  const pages = Math.max(2, Math.round(words / 280) + 1);
  const canAdjust = chips.length > 0 || note.trim().length > 0;

  function toggle(chip: ChapterAdjustChip) {
    setChips((prev) => (prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]));
  }

  function apply() {
    api.adjustChapterOne(ebook.id, chips, note);
    setChips([]);
    setNote("");
  }

  return (
    <div className="grid gap-5">
      <StageHeader
        turn={!busy}
        title={busy ? "Aplicando tus ajustes al capítulo 1" : "Tu turno: revisa el capítulo 1"}
        subtitle={`Versión ${ebook.chapterOneVersion || 1} · unas ${words.toLocaleString("es")} palabras · ${pages} páginas${ch1.status === "editado" ? " · editado por ti" : ""}`}
      />

      <p className="flex items-center gap-2.5 rounded-2xl bg-menta px-4 py-3 text-[14.5px] font-medium text-tinta-oscura">
        <Bookmark aria-hidden className="size-[18px] flex-none" />
        Este capítulo marcará el tono y el formato de todo el libro.
      </p>

      {busy ? (
        <div className="grid gap-4 rounded-2xl bg-barra p-4" role="status">
          <p className="text-[14px] font-medium">{ebook.busy?.message}</p>
          <SectionProgress current={ch1.currentSection} done={ch1.status === "generado"} />
          <Button className="w-fit" size="sm" onClick={() => api.cancelBusy(ebook.id)}>
            <Undo2 /> Cancelar y conservar la versión anterior
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-2">
            <h3 className="text-[13.5px] font-medium text-grafito">Estructura</h3>
            <StructureChips chapter={ch1} />
          </div>

          <div className="grid gap-2">
            <h3 id="ajustes" className="text-[13.5px] font-medium text-grafito">
              ¿Qué ajustamos?
            </h3>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="ajustes">
              {(Object.keys(ADJUST_CHIP_LABELS) as ChapterAdjustChip[]).map((chip) => (
                <Chip key={chip} pressed={chips.includes(chip)} onClick={() => toggle(chip)}>
                  {ADJUST_CHIP_LABELS[chip]}
                </Chip>
              ))}
            </div>
            <label htmlFor="nota-cap1" className="sr-only">
              Algo más que quieras ajustar
            </label>
            <Textarea
              id="nota-cap1"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Algo más que quieras ajustar (opcional). Por ejemplo: que los ejemplos incluyan a quien estudia y trabaja."
              className="mt-1"
            />
          </div>

          {ebook.chapterOneHistory.length > 0 && (
            <button
              type="button"
              onClick={() => api.restorePreviousChapterOne(ebook.id)}
              className="flex w-fit items-center gap-1.5 text-[13.5px] text-grafito underline decoration-borde-control underline-offset-4 hover:text-texto"
            >
              <Undo2 className="size-3.5" /> Volver a la versión anterior
            </button>
          )}
        </>
      )}

      {!busy && (
        <div className="sticky bottom-0 -mx-5 mt-1 flex flex-wrap justify-end gap-2 bg-gradient-to-t from-pagina from-70% to-transparent px-5 pb-1 pt-6 sm:-mx-8 sm:px-8">
          <Button onClick={() => setEditing(true)}>
            <Pencil /> Editar a mano
          </Button>
          <Button onClick={apply} disabled={!canAdjust}>
            <RotateCw /> Aplicar ajustes
          </Button>
          <Button variant="primario" onClick={() => api.approveChapterOne(ebook.id)}>
            Aprobar y escribir el resto
          </Button>
        </div>
      )}

      {ch1.sections && <ManualEditor ebook={ebook} open={editing} onOpenChange={setEditing} />}
    </div>
  );
}
