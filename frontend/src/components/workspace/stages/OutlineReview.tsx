"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Plus, RotateCw, ShieldCheck, Trash2, Undo2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Button, IconButton } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Input, Textarea } from "@/components/ui/Field";
import { PopoverContent, PopoverRoot, PopoverTrigger } from "@/components/ui/Popover";
import { Tooltip } from "@/components/ui/Tooltip";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { DISCLAIMERS } from "@/lib/guardrails";
import { MAX_CHAPTERS, MIN_CHAPTERS, type Chapter, type Ebook } from "@/lib/types";
import { StageHeader } from "../StageHeader";

const LIMIT_TEXT = "Un ebook de Folio tiene entre 5 y 7 capítulos.";
const QUICK_IDEAS = ["Más práctico", "Otro enfoque", "Más ejemplos cotidianos", "Menos teoría"];

function titleOf(ebook: Ebook, id: string | number) {
  return ebook.chapters.find((c) => c.id === id)?.title ?? "el capítulo";
}

function announcements(ebook: Ebook): Announcements {
  const pos = (id: string | number) => ebook.chapters.findIndex((c) => c.id === id) + 1;
  return {
    onDragStart: ({ active }) => `Tomaste “${titleOf(ebook, active.id)}”, en la posición ${pos(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `“${titleOf(ebook, active.id)}” pasa a la posición ${pos(over.id)}.` : undefined),
    onDragEnd: ({ active, over }) => (over ? `Soltaste “${titleOf(ebook, active.id)}” en la posición ${pos(over.id)}.` : undefined),
    onDragCancel: ({ active }) => `Cancelaste el movimiento de “${titleOf(ebook, active.id)}”.`,
  };
}

interface RowProps {
  ebook: Ebook;
  chapter: Chapter;
  disabled: boolean;
  regenerating: boolean;
}

function OutlineRow({ ebook, chapter, disabled, regenerating }: RowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: chapter.id,
    disabled,
  });
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(chapter.title);
  const [summary, setSummary] = useState(chapter.summary);
  const atMin = ebook.chapters.length <= MIN_CHAPTERS;

  function save() {
    if (!title.trim()) return;
    api.updateOutlineItem(ebook.id, chapter.id, { title: title.trim(), summary: summary.trim() });
    setEditing(false);
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "relative rounded-2xl bg-barra transition-shadow",
        isDragging && "z-10 bg-pagina shadow-[0_10px_30px_rgb(var(--sombra)/0.18)]",
        editing && "bg-pagina ring-2 ring-tinta",
        regenerating && "overflow-hidden",
      )}
    >
      {editing ? (
        <form
          className="grid gap-2.5 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label className="sr-only" htmlFor={`t-${chapter.id}`}>
            Título del capítulo {chapter.number}
          </label>
          <Input id={`t-${chapter.id}`} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus className="font-medium" />
          <label className="sr-only" htmlFor={`s-${chapter.id}`}>
            Resumen del capítulo {chapter.number}
          </label>
          <Textarea id={`s-${chapter.id}`} rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} className="text-[14px]" />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              onClick={() => {
                setTitle(chapter.title);
                setSummary(chapter.summary);
                setEditing(false);
              }}
            >
              Cancelar
            </Button>
            <Button size="sm" variant="primario" type="submit" disabled={!title.trim()}>
              Guardar
            </Button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-[auto_auto_1fr_auto] items-start gap-2 py-2.5 pl-1.5 pr-2">
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}
            disabled={disabled}
            aria-label={`Reordenar el capítulo ${chapter.number}: ${chapter.title}`}
            className="grid size-8 cursor-grab touch-none place-items-center rounded-lg text-tenue hover:bg-control hover:text-texto active:cursor-grabbing disabled:cursor-default disabled:opacity-40"
          >
            <GripVertical className="size-4" />
          </button>
          <span className="mt-1.5 w-5 text-center font-display text-[15px] font-medium text-tinta">{chapter.number}</span>
          <div className="min-w-0 py-1">
            <p className="text-[15px] font-medium leading-snug">{chapter.title}</p>
            <p className="mt-0.5 text-[13.5px] leading-snug text-grafito">{chapter.summary}</p>
          </div>
          <div className="flex items-center">
            <IconButton
              label={`Editar el capítulo ${chapter.number}`}
              size="sm"
              disabled={disabled}
              onClick={() => {
                setTitle(chapter.title);
                setSummary(chapter.summary);
                setEditing(true);
              }}
            >
              <Pencil />
            </IconButton>
            <IconButton
              label={`Proponer otro capítulo en lugar de “${chapter.title}”`}
              size="sm"
              disabled={disabled}
              onClick={() => api.regenerateOutlineItem(ebook.id, chapter.id)}
            >
              <RotateCw />
            </IconButton>
            <Tooltip content={atMin ? `${LIMIT_TEXT} Agrega uno antes de quitar otro.` : `Quitar “${chapter.title}”`}>
              <span tabIndex={atMin ? 0 : -1} className="inline-flex rounded-full">
                <IconButton
                  label={atMin ? `No se puede quitar: mínimo ${MIN_CHAPTERS} capítulos` : `Quitar el capítulo ${chapter.number}`}
                  size="sm"
                  disabled={disabled || atMin}
                  onClick={() => api.removeOutlineItem(ebook.id, chapter.id)}
                >
                  <Trash2 />
                </IconButton>
              </span>
            </Tooltip>
          </div>
        </div>
      )}
      {regenerating && (
        <div className="absolute inset-0 grid place-items-center rounded-2xl bg-pagina/85" role="status">
          <span className="flex items-center gap-2 text-[13.5px] font-medium text-tinta-oscura">
            <span aria-hidden className="anillo size-4 [--fondo-anillo:var(--pagina)]" />
            Buscando otra propuesta para este capítulo…
          </span>
        </div>
      )}
    </li>
  );
}

export function OutlineReview({ ebook }: { ebook: Ebook }) {
  const [asking, setAsking] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [ideas, setIdeas] = useState<string[]>([]);
  const busy = ebook.busy;
  const rewriting = busy?.kind === "indice";
  const locked = Boolean(busy);
  const count = ebook.chapters.length;
  const atMax = count >= MAX_CHAPTERS;
  const legal = ebook.sensitivity !== "ninguno" ? DISCLAIMERS[ebook.sensitivity] : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const ids = ebook.chapters.map((c) => c.id);
    api.reorderOutline(ebook.id, arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  }

  function requestVersion() {
    const text = [feedback.trim(), ...ideas].filter(Boolean).join(". ");
    api.regenerateOutline(ebook.id, text);
    setAsking(false);
    setFeedback("");
    setIdeas([]);
  }

  return (
    <div className="grid gap-5">
      <StageHeader
        turn={!locked}
        title={rewriting ? "Preparando otra versión del índice" : "Tu turno: revisa el índice"}
        subtitle={
          <>
            {count} capítulos · entre {MIN_CHAPTERS} y {MAX_CHAPTERS}
            <span className="hidden sm:inline"> · arrastra para reordenar</span>
          </>
        }
      />

      {rewriting ? (
        <div className="grid gap-3" role="status">
          <p className="flex items-center gap-2.5 text-[14px] font-medium text-tinta-oscura">
            <span aria-hidden className="anillo size-4 [--fondo-anillo:var(--pagina)]" />
            {busy.message}
          </p>
          <ol className="grid gap-2 opacity-45" aria-hidden>
            {ebook.chapters.map((c) => (
              <li key={c.id} className="rounded-2xl bg-barra px-4 py-3 text-[14.5px]">
                <span className="mr-3 font-display text-tinta">{c.number}</span>
                {c.title}
              </li>
            ))}
          </ol>
          <Button className="w-fit" onClick={() => api.cancelBusy(ebook.id)}>
            <Undo2 /> Mantener la versión actual
          </Button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
          accessibility={{
            announcements: announcements(ebook),
            screenReaderInstructions: {
              draggable:
                "Para reordenar, pulsa Espacio o Intro para tomar el capítulo, usa las flechas arriba y abajo para moverlo, y pulsa Espacio o Intro para soltarlo. Pulsa Escape para cancelar.",
            },
          }}
        >
          <SortableContext items={ebook.chapters.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <ol className="grid gap-2" aria-label="Índice del ebook">
              {ebook.chapters.map((c) => (
                <OutlineRow
                  key={c.id}
                  ebook={ebook}
                  chapter={c}
                  disabled={locked}
                  regenerating={busy?.kind === "capitulo_indice" && busy.chapterId === c.id}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      {!rewriting && (
        <>
          <Tooltip content={atMax ? `${LIMIT_TEXT} Quita uno para agregar otro.` : "Agregar un capítulo al final"}>
            <span tabIndex={atMax ? 0 : -1} className="block rounded-2xl">
              <button
                type="button"
                disabled={atMax || locked}
                onClick={() => api.addOutlineItem(ebook.id)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-borde-control py-3 text-[14px] text-grafito transition-colors hover:border-tenue hover:text-texto disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="size-4" />
                {atMax ? `${MAX_CHAPTERS} capítulos · máximo alcanzado` : "Agregar capítulo"}
              </button>
            </span>
          </Tooltip>

          {legal && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-grafito">
              <ShieldCheck aria-hidden className="size-[18px] text-tinta" />
              Incluirá un aviso legal porque {legal.reason}.
              <PopoverRoot>
                <PopoverTrigger className="rounded text-tinta-oscura underline decoration-tinta/40 underline-offset-4 hover:decoration-tinta">
                  Ver el texto
                </PopoverTrigger>
                <PopoverContent label="Texto del aviso legal">
                  <p className="mb-1 text-[14px] font-medium">Aviso legal</p>
                  <p className="text-[13.5px] leading-relaxed text-grafito">{legal.text}</p>
                </PopoverContent>
              </PopoverRoot>
            </p>
          )}

          {ebook.outlineHistory.length > 0 && !locked && (
            <button
              type="button"
              onClick={() => api.restorePreviousOutline(ebook.id)}
              className="flex w-fit items-center gap-1.5 text-[13.5px] text-grafito underline decoration-borde-control underline-offset-4 hover:text-texto"
            >
              <Undo2 className="size-3.5" /> Volver a la versión anterior del índice
            </button>
          )}
        </>
      )}

      <AnimatePresence initial={false}>
        {asking && !rewriting && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="grid gap-3 rounded-2xl bg-barra p-4">
              <label htmlFor="otra-version" className="text-[14px] font-medium">
                ¿Qué cambiarías del índice?
              </label>
              <Textarea
                id="otra-version"
                rows={2}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Por ejemplo: quiero un capítulo sobre cómo ganar dinero extra mientras estudio."
              />
              <div className="flex flex-wrap gap-2" aria-label="Ideas rápidas">
                {QUICK_IDEAS.map((idea) => (
                  <Chip
                    key={idea}
                    pressed={ideas.includes(idea)}
                    onClick={() => setIdeas((prev) => (prev.includes(idea) ? prev.filter((x) => x !== idea) : [...prev, idea]))}
                  >
                    {idea}
                  </Chip>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" onClick={() => setAsking(false)}>
                  Cancelar
                </Button>
                <Button size="sm" variant="primario" onClick={requestVersion}>
                  <RotateCw /> Proponer otra versión
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!rewriting && (
        <div className="sticky bottom-0 -mx-5 mt-2 flex flex-wrap justify-end gap-2 bg-gradient-to-t from-pagina from-70% to-transparent px-5 pb-1 pt-6 sm:-mx-8 sm:px-8">
          {!asking && (
            <Button onClick={() => setAsking(true)} disabled={locked}>
              <RotateCw /> Pedir otra versión
            </Button>
          )}
          <Button variant="primario" onClick={() => api.approveOutline(ebook.id)} disabled={locked}>
            Aprobar índice
          </Button>
        </div>
      )}
    </div>
  );
}
