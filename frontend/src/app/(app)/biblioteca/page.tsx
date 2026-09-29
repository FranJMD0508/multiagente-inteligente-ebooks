"use client";

import { Copy, Download, Ellipsis, FolderOpen, Pencil, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Cover } from "@/components/book/Cover";
import { Button, IconButton } from "@/components/ui/Button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { FieldShell, Input } from "@/components/ui/Field";
import { MenuContent, MenuItem, MenuRoot, MenuSeparator, MenuTrigger } from "@/components/ui/Menu";
import { api } from "@/lib/api";
import { useEbookList } from "@/lib/api/hooks";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/format";
import { buildMarkdown, downloadText, slugify } from "@/lib/markdown";
import { statusInfo, type LibraryGroup } from "@/lib/phases";
import type { Ebook } from "@/lib/types";

type Filter = "todos" | LibraryGroup;

const DONE = ["generado", "aprobado", "editado"];

function BookCard({ ebook, onRename, onDelete }: { ebook: Ebook; onRename: () => void; onDelete: () => void }) {
  const router = useRouter();
  const info = statusInfo(ebook);
  const turn = info.group === "turno";
  const progress = ebook.chapters.length
    ? ebook.chapters.filter((c) => DONE.includes(c.status)).length / ebook.chapters.length
    : 0;

  return (
    <li className="group relative grid min-w-0 grid-cols-1 content-start gap-2.5">
      <Link
        href={`/ebook/${ebook.id}`}
        className="block rounded-[6px] transition-transform duration-200 ease-out group-hover:-translate-y-1 motion-reduce:transition-none"
        aria-label={`Abrir “${ebook.title}”, ${info.label}${info.detail ? `: ${info.detail}` : ""}`}
      >
        <Cover
          title={ebook.title}
          subtitle={ebook.subtitle}
          author={ebook.design.author}
          cloth={ebook.design.clothColor}
          template={ebook.design.coverTemplate}
          className="w-full"
        >
          {turn && <span aria-hidden className="cinta right-[5%] h-[22%] w-[8%]" />}
        </Cover>
      </Link>
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14.5px] font-medium">{ebook.title}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-tenue">
            {info.group !== "listo" && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[12px] font-medium",
                  turn ? "bg-menta text-tinta-oscura" : info.group === "error" ? "bg-error-suave text-error" : "bg-control text-texto",
                )}
              >
                {info.label}
              </span>
            )}
            <span>{info.group === "listo" ? `Listo · ${relativeTime(ebook.updatedAt)}` : info.detail}</span>
          </p>
          {info.group === "progreso" && (
            <span className="mt-2 block h-1 overflow-hidden rounded-full bg-borde-control" aria-hidden>
              <span className="block h-full rounded-full bg-tinta transition-[width] duration-500" style={{ width: `${Math.max(6, progress * 100)}%` }} />
            </span>
          )}
        </div>
        <MenuRoot>
          <MenuTrigger asChild>
            <IconButton label={`Opciones de “${ebook.title}”`} size="sm" className="-mr-1.5">
              <Ellipsis />
            </IconButton>
          </MenuTrigger>
          <MenuContent>
            <MenuItem onSelect={() => router.push(`/ebook/${ebook.id}`)}>
              <FolderOpen /> {info.group === "listo" ? "Abrir" : "Continuar"}
            </MenuItem>
            <MenuItem onSelect={onRename}>
              <Pencil /> Renombrar
            </MenuItem>
            <MenuItem disabled={ebook.status !== "listo"} onSelect={() => downloadText(`${slugify(ebook.title)}.md`, buildMarkdown(ebook))}>
              <Download /> Descargar Markdown
            </MenuItem>
            <MenuItem disabled={!["listo", "indice_pendiente", "cap1_pendiente"].includes(ebook.status)} onSelect={() => api.duplicate(ebook.id)}>
              <Copy /> Duplicar
            </MenuItem>
            <MenuSeparator />
            <MenuItem danger onSelect={onDelete}>
              <Trash2 /> Eliminar
            </MenuItem>
          </MenuContent>
        </MenuRoot>
      </div>
    </li>
  );
}

function EmptyShelf() {
  return (
    <div className="hoja mx-auto mt-6 grid max-w-md justify-items-center gap-3 px-8 py-12 text-center">
      <div aria-hidden className="flex items-end gap-2">
        {[52, 62, 46].map((h, i) => (
          <span key={i} className="w-7 rounded-[3px_6px_6px_3px] border-2 border-dashed border-borde-control" style={{ height: h }} />
        ))}
      </div>
      <h2 className="mt-2 font-display text-[21px] font-medium tracking-[-0.025em]">Tu estantería está vacía</h2>
      <p className="max-w-[32ch] text-[14.5px] text-grafito">Escribe una idea y en unos minutos tendrás tu primer ebook.</p>
      <Link
        href="/"
        className="mt-2 inline-flex h-10 items-center gap-2 rounded-full bg-tinta px-5 text-[14.5px] font-medium text-sobre-tinta hover:bg-tinta-hover"
      >
        <Plus className="size-4" /> Crear mi primer ebook
      </Link>
    </div>
  );
}

export default function LibraryPage() {
  const { ebooks } = useEbookList();
  const [filter, setFilter] = useState<Filter>("todos");
  const [query, setQuery] = useState("");
  const [renaming, setRenaming] = useState<Ebook | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [deleting, setDeleting] = useState<Ebook | null>(null);

  const counts = useMemo(() => {
    const c = { todos: ebooks.length, turno: 0, progreso: 0, listo: 0, error: 0 };
    ebooks.forEach((e) => c[statusInfo(e).group]++);
    return c;
  }, [ebooks]);

  const visible = ebooks.filter(
    (e) => (filter === "todos" || statusInfo(e).group === filter) && e.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const filters: { id: Filter; label: string }[] = [
    { id: "todos", label: "Todos" },
    { id: "turno", label: "Tu turno" },
    { id: "progreso", label: "Escribiendo" },
    { id: "listo", label: "Listos" },
    ...(counts.error > 0 ? [{ id: "error" as Filter, label: "Con error" }] : []),
  ];

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-8 sm:py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-[30px] font-medium leading-none tracking-[-0.035em] sm:text-[34px]">Biblioteca</h1>
        {ebooks.length > 0 && (
          <div className="relative ml-auto w-full sm:w-[300px]">
            <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-tenue" />
            <label htmlFor="buscar" className="sr-only">
              Buscar por título
            </label>
            <Input id="buscar" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por título" className="rounded-full pl-10" />
          </div>
        )}
      </div>

      {ebooks.length === 0 ? (
        <EmptyShelf />
      ) : (
        <>
          <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13.5px] transition-colors",
                  filter === f.id ? "border-texto bg-texto text-pagina" : "border-borde-control bg-pagina text-texto hover:border-tenue",
                )}
              >
                {f.label}
                <span className={filter === f.id ? "text-pagina/70" : "text-tenue"}>{counts[f.id]}</span>
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <div className="mt-12 text-center">
              <p className="text-[15px] text-grafito">No hay ebooks que coincidan con tu búsqueda.</p>
              <Button
                className="mt-4"
                onClick={() => {
                  setQuery("");
                  setFilter("todos");
                }}
              >
                Ver todos los ebooks
              </Button>
            </div>
          ) : (
            <ul className="mt-7 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5" aria-label="Tus ebooks">
              {visible.map((e) => (
                <BookCard
                  key={e.id}
                  ebook={e}
                  onRename={() => {
                    setNewTitle(e.title);
                    setRenaming(e);
                  }}
                  onDelete={() => setDeleting(e)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      <Dialog open={Boolean(renaming)} onOpenChange={(o) => !o && setRenaming(null)} title="Renombrar ebook">
        <form
          className="grid gap-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (renaming && newTitle.trim()) api.updateMeta(renaming.id, { title: newTitle.trim() });
            setRenaming(null);
          }}
        >
          <FieldShell label="Título">{(id) => <Input id={id} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} autoFocus />}</FieldShell>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setRenaming(null)}>Cancelar</Button>
            <Button variant="primario" type="submit" disabled={!newTitle.trim()}>
              Guardar
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="¿Eliminar este ebook?"
        description={`Se eliminará “${deleting?.title ?? ""}” de tu biblioteca. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        danger
        onConfirm={() => {
          if (deleting) api.remove(deleting.id);
          setDeleting(null);
        }}
      />
    </div>
  );
}
