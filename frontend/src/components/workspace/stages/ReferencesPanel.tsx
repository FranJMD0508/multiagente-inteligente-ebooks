"use client";

import { BookOpen, Check, CircleAlert, Copy, FileText, Globe, Pencil, Plus, RotateCw, Search, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";
import { ReferenceText } from "@/components/book/ReferenceText";
import { Button, IconButton } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { FieldShell, Input, Textarea } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { Tooltip } from "@/components/ui/Tooltip";
import { api } from "@/lib/api";
import { announce, showToast } from "@/lib/api/store";
import { cn } from "@/lib/cn";
import { formatReferenceText, inTextCitation, sortReferences } from "@/lib/references/apa";
import { candidateToData } from "@/lib/references/lookup";
import type { Ebook, Reference, ReferenceCandidate, ReferenceData, ReferenceKind } from "@/lib/types";

const KIND_LABEL: Record<ReferenceKind, string> = { libro: "Libro", articulo: "Artículo", web: "Página web" };
const SOURCE_LABEL = { crossref: "Crossref", openlibrary: "Open Library" } as const;

const FIELD_LABEL: Partial<Record<keyof ReferenceData, string>> = {
  year: "el año",
  doi: "el DOI",
  isbn: "el ISBN",
  publisher: "la editorial",
  journal: "la revista",
  volume: "el volumen",
  issue: "el número",
  pages: "las páginas",
  authors: "los autores",
};

/** Pestaña "Referencias" de la revisión final. */
export function ReferencesPanel({ ebook }: { ebook: Ebook }) {
  const [adding, setAdding] = useState<ReferenceData | null>(null);
  const refs = sortReferences(ebook.references);
  const verified = refs.filter((r) => r.check === "verificada").length;
  const missing = refs.filter((r) => r.check === "no_encontrada").length;
  const suggesting = ebook.referencesState === "sugiriendo";

  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <p className="text-[14.5px]">
          {refs.length === 0
            ? "Todavía no hay referencias."
            : `${refs.length} ${refs.length === 1 ? "referencia" : "referencias"} · ${verified} ${verified === 1 ? "verificada" : "verificadas"}`}
          {missing > 0 && <span className="text-error"> · {missing} sin encontrar</span>}
        </p>
        <p className="text-[13.5px] text-grafito">
          El Investigador sugiere lecturas reales y Folio comprueba en Crossref y Open Library que existan. Salen al final del libro en
          formato APA 7.
        </p>
      </div>

      <Finder ebook={ebook} onManual={(data) => setAdding(data)} />

      <AnimatePresence initial={false}>
        {adding && (
          <motion.div
            key="nueva"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <ReferenceForm
              title="Nueva referencia"
              initial={adding}
              chapters={[]}
              total={ebook.chapters.length}
              onCancel={() => setAdding(null)}
              onSave={(data, chapters) => {
                api.addReference(ebook.id, data, chapters);
                announce("Referencia agregada. Folio la está comprobando.");
                setAdding(null);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {suggesting && (
        <p role="status" className="flex items-center gap-2.5 rounded-2xl bg-barra px-4 py-3 text-[14px]">
          <span aria-hidden className="anillo size-4 [--fondo-anillo:var(--barra)]" />
          El Investigador está buscando lecturas recomendadas…
        </p>
      )}
      {ebook.referencesState === "error" && (
        <p role="alert" className="flex items-center gap-2 rounded-2xl bg-error-suave px-4 py-3 text-[14px]">
          <CircleAlert aria-hidden className="size-4 flex-none text-error" />
          El Investigador no pudo sugerir lecturas esta vez. Puedes pedirlas de nuevo o agregarlas tú.
        </p>
      )}

      {refs.length > 0 && (
        <ol className="grid gap-2.5" aria-label="Referencias del libro">
          {refs.map((r) => (
            <ReferenceItem key={r.id} ebook={ebook} reference={r} />
          ))}
        </ol>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => api.suggestReferences(ebook.id)} disabled={suggesting}>
          <BookOpen /> {refs.some((r) => r.origin === "sugerida") ? "Pedir más sugerencias" : "Pedir sugerencias al Investigador"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Buscador por título, autor, DOI o ISBN
// ---------------------------------------------------------------------------

function Finder({ ebook, onManual }: { ebook: Ebook; onManual: (data: ReferenceData) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ReferenceCandidate[] | null>(null);
  const [state, setState] = useState<"idle" | "buscando" | "error">("idle");
  const inputId = useId();
  const taken = new Set(ebook.references.map((r) => r.title.toLowerCase()));

  async function search() {
    const q = query.trim();
    if (q.length < 3) return;
    setState("buscando");
    try {
      setResults(await api.lookupReferences(q));
      setState("idle");
    } catch {
      setResults(null);
      setState("error");
    }
  }

  return (
    <div className="grid gap-3">
      <form
        role="search"
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Buscar una referencia
        </label>
        <div className="relative min-w-0 flex-1">
          <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-tenue" />
          <Input
            id={inputId}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Título, autor, DOI o ISBN"
            className="rounded-full pl-10"
          />
        </div>
        <Button type="submit" disabled={query.trim().length < 3 || state === "buscando"}>
          {state === "buscando" ? "Buscando…" : "Buscar"}
        </Button>
      </form>

      <div role="status" aria-live="polite" className="contents">
        {state === "error" && (
          <p className="text-[13.5px] text-grafito">No pudimos buscar ahora (¿sin conexión?). Puedes escribirla a mano.</p>
        )}
        {results && results.length === 0 && state === "idle" && (
          <p className="text-[13.5px] text-grafito">No encontramos nada con eso. Prueba con el DOI o el ISBN, o escríbela a mano.</p>
        )}
      </div>

      {results && results.length > 0 && (
        <ul className="grid gap-1.5" aria-label="Resultados de la búsqueda">
          {results.map((c, i) => {
            const already = taken.has(c.title.toLowerCase());
            return (
              <li key={`${c.source}-${i}`} className="flex items-start gap-3 rounded-xl bg-barra px-3.5 py-2.5">
                <KindIcon kind={c.kind} />
                <div className="min-w-0 flex-1">
                  <p className="font-book text-[14px] leading-snug [overflow-wrap:anywhere]">
                    <ReferenceText reference={c} />
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-tenue">{SOURCE_LABEL[c.source]}</p>
                </div>
                <Button
                  size="sm"
                  disabled={already}
                  onClick={() => {
                    api.addReference(ebook.id, candidateToData(c));
                    announce("Referencia agregada.");
                    setResults((list) => list?.filter((x) => x !== c) ?? null);
                  }}
                >
                  {already ? "Ya está" : (
                    <>
                      <Plus /> Agregar
                    </>
                  )}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2 text-[13.5px] text-grafito">
        ¿No aparece?
        <button
          type="button"
          onClick={() => onManual({ kind: "libro", authors: [], year: "", title: query.trim() && !/^\d|10\./.test(query.trim()) ? query.trim() : "" })}
          className="font-medium text-tinta-oscura underline decoration-tinta/40 underline-offset-4 hover:decoration-tinta"
        >
          Escríbela a mano
        </button>
      </div>
    </div>
  );
}

function KindIcon({ kind }: { kind: ReferenceKind }) {
  const Icon = kind === "articulo" ? FileText : kind === "web" ? Globe : BookOpen;
  return (
    <span className="mt-0.5 grid size-7 flex-none place-items-center rounded-full bg-pagina text-tinta" title={KIND_LABEL[kind]}>
      <Icon className="size-3.5" aria-hidden />
      <span className="sr-only">{KIND_LABEL[kind]}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Una referencia de la lista
// ---------------------------------------------------------------------------

function CheckBadge({ reference }: { reference: Reference }) {
  const r = reference;
  if (r.check === "verificada")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-menta px-2 py-0.5 text-[12px] font-medium text-tinta-oscura">
        <Check className="size-3" strokeWidth={2.75} aria-hidden /> Verificada{r.checkedWith ? ` en ${SOURCE_LABEL[r.checkedWith]}` : ""}
      </span>
    );
  if (r.check === "pendiente")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-control px-2 py-0.5 text-[12px] text-grafito">
        <span aria-hidden className="anillo size-3 [--fondo-anillo:var(--control)]" /> Comprobando…
      </span>
    );
  if (r.check === "no_encontrada")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-error-suave px-2 py-0.5 text-[12px] font-medium text-error">
        <CircleAlert className="size-3" aria-hidden /> No la encontramos
      </span>
    );
  return <span className="inline-flex items-center rounded-full bg-control px-2 py-0.5 text-[12px] text-grafito">Sin verificar</span>;
}

function matchSentence(r: Reference): string | null {
  if (!r.match) return null;
  const source = r.checkedWith ? SOURCE_LABEL[r.checkedWith] : "La fuente";
  const keys = Object.keys(r.match) as (keyof ReferenceData)[];
  if (keys.length === 1 && keys[0] === "year") return `${source} dice que es de ${r.match.year}, no de ${r.year || "s. f."}.`;
  const names = keys.map((k) => FIELD_LABEL[k] ?? k);
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}` : names[0];
  return `${source} tiene datos que faltan o no coinciden: ${list}.`;
}

function ReferenceItem({ ebook, reference: r }: { ebook: Ebook; reference: Reference }) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const citation = inTextCitation(r);
  const sentence = matchSentence(r);

  async function copy() {
    try {
      await navigator.clipboard.writeText(citation);
      announce(`Cita ${citation} copiada.`);
      showToast(`Copiaste ${citation}. Pégala en el texto donde uses la idea.`);
    } catch {
      showToast(`No pudimos copiar. La cita es ${citation}.`);
    }
  }

  if (editing) {
    return (
      <li>
        <ReferenceForm
          title="Editar referencia"
          initial={r}
          chapters={r.chapters}
          total={ebook.chapters.length}
          onCancel={() => setEditing(false)}
          onSave={(data, chapters) => {
            const changed: Partial<ReferenceData> & { chapters?: number[] } = { chapters };
            (Object.keys(data) as (keyof ReferenceData)[]).forEach((k) => {
              if (JSON.stringify(data[k] ?? "") !== JSON.stringify(r[k] ?? "")) (changed as Record<string, unknown>)[k] = data[k] ?? "";
            });
            // Campos que el formulario dejó vacíos y antes tenían valor.
            (["publisher", "edition", "journal", "volume", "issue", "pages", "doi", "isbn", "url"] as const).forEach((k) => {
              if (r[k] && !data[k]) changed[k] = "";
            });
            api.updateReference(ebook.id, r.id, changed);
            setEditing(false);
          }}
        />
      </li>
    );
  }

  return (
    <li
      className={cn(
        "grid gap-2 rounded-2xl px-4 py-3.5",
        r.check === "no_encontrada" ? "bg-error-suave/60 ring-1 ring-error/25" : "bg-barra",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <CheckBadge reference={r} />
        <span className="text-[12px] text-tenue">
          {KIND_LABEL[r.kind]} · {r.origin === "sugerida" ? "sugerida por el Investigador" : "agregada por ti"}
        </span>
      </div>

      <p className="font-book text-[14.5px] leading-relaxed [overflow-wrap:anywhere]">
        <ReferenceText reference={r} />
      </p>

      {r.note && <p className="text-[13px] text-grafito">{r.note}</p>}

      {r.check === "no_encontrada" && (
        <p className="text-[13px] text-texto">
          No aparece en Crossref ni en Open Library. Puede tener un dato mal o no existir: revísala o quítala antes de publicar.
        </p>
      )}
      {r.check === "sin_verificar" && (
        <p className="text-[13px] text-grafito">
          {r.kind === "web" ? "Las páginas web no se comprueban: abre el enlace para confirmar que sigue disponible." : "No pudimos consultar las bases ahora. Vuelve a intentarlo más tarde."}
        </p>
      )}
      {sentence && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-pagina px-3 py-2 text-[13px]">
          <span>{sentence}</span>
          <Button size="sm" onClick={() => api.acceptReferenceMatch(ebook.id, r.id)}>
            Usar esos datos
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {r.chapters.length > 0 && (
          <span className="mr-1 text-[12.5px] text-tenue">
            {r.chapters.length === 1 ? "Capítulo" : "Capítulos"} {r.chapters.join(", ")}
          </span>
        )}
        <Tooltip content={`Copia ${citation} para citarla en el texto`}>
          <Button size="sm" variant="quieto" onClick={copy}>
            <Copy /> Copiar cita
          </Button>
        </Tooltip>
        <Button size="sm" variant="quieto" onClick={() => setEditing(true)}>
          <Pencil /> Editar
        </Button>
        {r.check !== "pendiente" && r.kind !== "web" && (
          <Button size="sm" variant="quieto" onClick={() => api.verifyReference(ebook.id, r.id)}>
            <RotateCw /> Comprobar
          </Button>
        )}
        <IconButton label="Quitar referencia" size="sm" className="ml-auto" onClick={() => setConfirm(true)}>
          <Trash2 />
        </IconButton>
      </div>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="¿Quitar esta referencia?"
        description={formatReferenceText(r)}
        confirmLabel="Quitar"
        danger
        onConfirm={() => {
          api.removeReference(ebook.id, r.id);
          announce("Referencia quitada.");
        }}
      />
    </li>
  );
}

// ---------------------------------------------------------------------------
// Formulario (nueva o editar)
// ---------------------------------------------------------------------------

interface FormProps {
  title: string;
  initial: Partial<ReferenceData>;
  chapters: number[];
  total: number;
  onSave: (data: ReferenceData, chapters: number[]) => void;
  onCancel: () => void;
}

function ReferenceForm({ title, initial, chapters: initialChapters, total, onSave, onCancel }: FormProps) {
  const [kind, setKind] = useState<ReferenceKind>(initial.kind ?? "libro");
  const [authors, setAuthors] = useState((initial.authors ?? []).join("\n"));
  const [values, setValues] = useState<Partial<ReferenceData>>(initial);
  const [chapters, setChapters] = useState<number[]>(initialChapters);
  const [errors, setErrors] = useState<{ title?: string; year?: string }>({});

  const set = (k: keyof ReferenceData) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const field = (k: keyof ReferenceData, label: string, opts: { hint?: string; placeholder?: string; className?: string; error?: string } = {}) => (
    <FieldShell label={label} hint={opts.hint} error={opts.error} className={opts.className}>
      {(id, describedBy) => (
        <Input
          id={id}
          value={(values[k] as string | undefined) ?? ""}
          onChange={set(k)}
          placeholder={opts.placeholder}
          aria-describedby={describedBy}
          aria-invalid={Boolean(opts.error)}
        />
      )}
    </FieldShell>
  );

  function submit() {
    const t = (values.title ?? "").trim();
    const y = (values.year ?? "").trim();
    const next: typeof errors = {};
    if (!t) next.title = "Escribe el título.";
    if (y && !/^(\d{4}[a-z]?|s\. ?f\.)$/i.test(y)) next.year = "Usa el año con cuatro cifras, o déjalo vacío si no tiene fecha.";
    setErrors(next);
    if (Object.keys(next).length) return;
    const data: ReferenceData = {
      kind,
      authors: authors
        .split("\n")
        .map((a) => a.trim())
        .filter(Boolean),
      year: y,
      title: t,
    };
    const keys: Record<ReferenceKind, (keyof ReferenceData)[]> = {
      libro: ["publisher", "edition", "isbn", "doi", "url"],
      articulo: ["journal", "volume", "issue", "pages", "doi", "url"],
      web: ["publisher", "url"],
    };
    keys[kind].forEach((k) => {
      const v = (values[k] as string | undefined)?.trim();
      if (v) (data as unknown as Record<string, string>)[k] = v;
    });
    onSave(data, [...chapters].sort((a, b) => a - b));
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="grid gap-4 rounded-2xl border border-linea bg-pagina p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-[16px] font-medium tracking-[-0.01em]">{title}</h3>
        <IconButton label="Cancelar" size="sm" onClick={onCancel}>
          <X />
        </IconButton>
      </div>

      <Segmented<ReferenceKind>
        label="Tipo de referencia"
        value={kind}
        onChange={setKind}
        options={[
          { value: "libro", label: "Libro" },
          { value: "articulo", label: "Artículo" },
          { value: "web", label: "Página web" },
        ]}
        size="sm"
      />

      <FieldShell label="Autores" hint="Uno por línea, como «Apellido, Nombre». Si es una organización, escribe su nombre tal cual.">
        {(id, describedBy) => (
          <Textarea id={id} rows={2} value={authors} onChange={(e) => setAuthors(e.target.value)} placeholder={"Clear, James"} aria-describedby={describedBy} />
        )}
      </FieldShell>

      <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
        {field("title", kind === "web" ? "Título de la página" : "Título", { error: errors.title })}
        {field("year", "Año", { placeholder: "2018", error: errors.year })}
      </div>

      {kind === "libro" && (
        <div className="grid gap-3 sm:grid-cols-[1fr_110px]">
          {field("publisher", "Editorial")}
          {field("edition", "Edición", { placeholder: "1" })}
          {field("isbn", "ISBN", { className: "sm:col-span-2", placeholder: "978…" })}
        </div>
      )}
      {kind === "articulo" && (
        <div className="grid gap-3 sm:grid-cols-3">
          {field("journal", "Revista", { className: "sm:col-span-3" })}
          {field("volume", "Volumen")}
          {field("issue", "Número")}
          {field("pages", "Páginas", { placeholder: "68-78" })}
        </div>
      )}
      {kind === "web" && field("publisher", "Nombre del sitio")}
      {kind !== "web" ? field("doi", "DOI", { placeholder: "10.1037/…", hint: "Si lo tiene, ayuda a verificarla." }) : field("url", "Enlace", { placeholder: "https://…" })}

      {total > 0 && (
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-[13.5px] font-medium text-grafito">Capítulos con los que se relaciona (opcional)</legend>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: total }, (_, i) => i + 1).map((n) => {
              const on = chapters.includes(n);
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setChapters((list) => (on ? list.filter((x) => x !== n) : [...list, n]))}
                  className={cn(
                    "grid size-9 place-items-center rounded-full border font-display text-[14px] transition-colors",
                    on ? "border-texto bg-texto text-pagina" : "border-borde-control hover:border-tenue",
                  )}
                >
                  <span className="sr-only">Capítulo </span>
                  {n}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="flex justify-end gap-2">
        <Button onClick={onCancel}>Cancelar</Button>
        <Button type="submit" variant="primario">
          Guardar referencia
        </Button>
      </div>
    </form>
  );
}
