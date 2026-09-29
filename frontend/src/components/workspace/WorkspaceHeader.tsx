"use client";

import { Copy, Download, Ellipsis, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MiniCover } from "@/components/book/Cover";
import { Button, IconButton } from "@/components/ui/Button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { FieldShell, Input } from "@/components/ui/Field";
import { MenuContent, MenuItem, MenuRoot, MenuSeparator, MenuTrigger } from "@/components/ui/Menu";
import { api } from "@/lib/api";
import { wordCount } from "@/lib/api/mock/content";
import { estimatePages } from "@/lib/format";
import { getNiche } from "@/lib/niches";
import { ebookHref } from "@/lib/routes";
import type { Ebook } from "@/lib/types";

function useSavedLabel(updatedAt: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, (now - new Date(updatedAt).getTime()) / 1000);
  if (s < 60) return "Guardado hace unos segundos";
  if (s < 3600) return `Guardado hace ${Math.round(s / 60)} min`;
  return "Guardado";
}

export function WorkspaceHeader({ ebook, onExport }: { ebook: Ebook; onExport: () => void }) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(ebook.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const saved = useSavedLabel(ebook.updatedAt);
  const ready = ebook.status === "listo";
  const words = ebook.chapters.reduce((acc, c) => acc + wordCount(c.sections), 0);
  const detail = ready
    ? `Listo · ${ebook.chapters.length} capítulos · unas ${estimatePages(words, ebook.design.pageSize, ebook.chapters.length, ebook.sensitivity !== "ninguno")} páginas`
    : getNiche(ebook.nicheId).label;

  return (
    <header className="flex items-center gap-3 px-4 pb-3 pt-4 sm:px-6">
      <MiniCover cloth={ebook.design.clothColor} className="h-9 w-[26px]" />
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-[17px] font-medium leading-tight tracking-[-0.02em] sm:text-[19px]">{ebook.title}</h1>
        <p className="truncate text-[13px] text-tenue">{detail}</p>
      </div>
      <span className="hidden text-[13px] text-tenue md:inline" aria-live="off">
        {saved}
      </span>
      {ready && (
        <Button variant="primario" onClick={onExport} className="max-sm:px-3">
          <Download /> <span className="max-sm:sr-only">Exportar</span>
        </Button>
      )}
      <MenuRoot>
        <MenuTrigger asChild>
          <IconButton label="Más opciones">
            <Ellipsis />
          </IconButton>
        </MenuTrigger>
        <MenuContent>
          <MenuItem
            onSelect={() => {
              setTitle(ebook.title);
              setRenaming(true);
            }}
          >
            <Pencil /> Renombrar
          </MenuItem>
          <MenuItem
            disabled={!["listo", "indice_pendiente", "cap1_pendiente"].includes(ebook.status)}
            onSelect={() => {
              const id = api.duplicate(ebook.id);
              if (id) router.push(ebookHref(id));
            }}
          >
            <Copy /> Duplicar
          </MenuItem>
          <MenuSeparator />
          <MenuItem danger onSelect={() => setConfirmDelete(true)}>
            <Trash2 /> Eliminar
          </MenuItem>
        </MenuContent>
      </MenuRoot>

      <Dialog open={renaming} onOpenChange={setRenaming} title="Renombrar ebook">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            api.updateMeta(ebook.id, { title: title.trim() });
            setRenaming(false);
          }}
        >
          <FieldShell label="Título">{(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />}</FieldShell>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setRenaming(false)}>Cancelar</Button>
            <Button variant="primario" type="submit" disabled={!title.trim()}>
              Guardar
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="¿Eliminar este ebook?"
        description={`Se eliminará “${ebook.title}” de tu biblioteca. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        danger
        onConfirm={() => {
          api.remove(ebook.id);
          router.replace("/biblioteca");
        }}
      />
    </header>
  );
}
