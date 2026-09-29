"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { Cover } from "@/components/book/Cover";
import { ExerciseBox } from "@/components/book/ChapterPage";
import { Prose } from "@/components/book/Prose";
import { Button } from "@/components/ui/Button";
import { useEbook, useStore } from "@/lib/api/hooks";
import { loadForUser } from "@/lib/api/store";
import { useAuth } from "@/lib/auth";
import { bookFontStack, PAGE_SIZES } from "@/lib/design";
import { DISCLAIMERS } from "@/lib/guardrails";
import { ebookHref } from "@/lib/routes";
import { SECTION_LABELS, SECTION_ORDER } from "@/lib/types";

// Vista de impresión: el navegador genera el PDF ("Guardar como PDF"), que en
// Chrome y Edge sale etiquetado (RA-01). En la fase 4 el PDF lo generará el
// Agente Maquetador en el servidor.

function PrintView() {
  const search = useSearchParams();
  const id = search.get("id") ?? "";
  const { user, ready: authReady } = useAuth();
  const store = useStore();
  const { ebook } = useEbook(id);

  useEffect(() => {
    if (user && store.owner !== user.email) loadForUser(user.email);
  }, [user, store.owner]);

  useEffect(() => {
    if (!ebook) return;
    const name = search.get("archivo");
    document.title = name || ebook.title;
    let cancelled = false;
    document.fonts.ready.then(() => {
      setTimeout(() => !cancelled && window.print(), 500);
    });
    return () => {
      cancelled = true;
    };
  }, [ebook, search]);

  if (!authReady) return null;
  if (!user) {
    return (
      <p className="p-10 text-center">
        Inicia sesión para imprimir tus ebooks. <Link href="/login">Entrar</Link>
      </p>
    );
  }
  if (!ebook) return <p className="p-10 text-center text-grafito">Cargando…</p>;

  const size = PAGE_SIZES.find((p) => p.id === ebook.design.pageSize)?.css ?? "148mm 210mm";
  const legal = ebook.sensitivity !== "ninguno" ? DISCLAIMERS[ebook.sensitivity] : null;
  const small = ebook.design.pageSize === "A5" || ebook.design.pageSize === "6x9";

  return (
    <>
      <style>{`
        @page { size: ${size}; margin: ${small ? "16mm 15mm 18mm" : "22mm 20mm 24mm"}; }
        html, body { background: #fff !important; }
        .libro { font-family: ${bookFontStack(ebook.design.font)}; font-size: ${ebook.design.bodySizePt}pt; color: #1b1d23; line-height: 1.55; }
        .salto { break-before: page; }
        .libro h1, .libro h2, .libro h3, .libro h4 { break-after: avoid; }
        @media screen { .libro { max-width: 720px; margin: 0 auto; padding: 48px 32px 96px; } .salto { margin-top: 64px; padding-top: 48px; border-top: 1px dashed #d5dae1; } }
      `}</style>
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-linea bg-barra px-4 py-3">
        <Link href={ebookHref(ebook.id)} className="inline-flex items-center gap-2 text-[14px] text-grafito hover:text-texto">
          <ArrowLeft className="size-4" /> Volver al ebook
        </Link>
        <p className="hidden text-[13.5px] text-grafito sm:block">En el diálogo de impresión elige «Guardar como PDF».</p>
        <Button variant="primario" size="sm" onClick={() => window.print()}>
          <Printer /> Imprimir o guardar PDF
        </Button>
      </div>

      <article className="libro bg-white" lang="es">
        <section className="grid min-h-[80vh] place-items-center">
          <Cover
            title={ebook.title}
            subtitle={ebook.subtitle}
            author={ebook.design.author}
            cloth={ebook.design.clothColor}
            template={ebook.design.coverTemplate}
            className="w-[70%] max-w-[320px] shadow-none [print-color-adjust:exact]"
          />
        </section>

        {/* Portadilla: el título del libro es el H1 del documento (RA-01) */}
        <section className="salto grid min-h-[60vh] content-center gap-3">
          <h1 className="font-display" style={{ fontSize: "2.4em", fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
            {ebook.title}
          </h1>
          {ebook.subtitle && <p style={{ fontSize: "1.15em", color: "#3d434e" }}>{ebook.subtitle}</p>}
          {ebook.design.author && <p style={{ color: "#3d434e" }}>Por {ebook.design.author}</p>}
        </section>

        {legal && (
          <section className="salto">
            <h2 style={{ fontSize: "1.3em", fontWeight: 600, marginBottom: "0.8em" }}>Aviso legal</h2>
            <p>{legal.text}</p>
          </section>
        )}

        <section className="salto">
          <h2 style={{ fontSize: "1.5em", fontWeight: 600, marginBottom: "0.8em" }}>Índice</h2>
          <ol style={{ display: "grid", gap: "0.45em" }}>
            {ebook.chapters.map((c) => (
              <li key={c.id}>
                {c.number}. {c.title}
              </li>
            ))}
          </ol>
        </section>

        {ebook.chapters.map((c) => (
          <section key={c.id} className="salto">
            <p style={{ fontSize: "0.75em", letterSpacing: "0.1em", textTransform: "uppercase", color: "#0b5a53", fontWeight: 500 }}>
              Capítulo {c.number}
            </p>
            <h1 className="font-display" style={{ fontSize: "1.9em", fontWeight: 600, lineHeight: 1.12, letterSpacing: "-0.02em", margin: "0.3em 0 1em" }}>
              {c.title}
            </h1>
            {c.sections &&
              SECTION_ORDER.map((s, i) => (
                <div key={s} style={{ marginBottom: "1.2em" }}>
                  <h2 className="font-display" style={{ fontSize: "1.2em", fontWeight: 500, margin: "0.8em 0 0.5em" }}>
                    {SECTION_LABELS[s]}
                  </h2>
                  <Prose text={c.sections![s]} dropCap={i === 0} headingLevel={3} />
                </div>
              ))}
            {c.exercise && (
              <div style={{ marginTop: "1.2em" }}>
                <h2 className="font-display" style={{ fontSize: "1.2em", fontWeight: 500, margin: "0.8em 0 0.5em" }}>
                  Ejercicio práctico
                </h2>
                <ExerciseBox exercise={c.exercise} />
              </div>
            )}
          </section>
        ))}

        <p className="salto" style={{ fontSize: "0.85em", color: "#5a606c" }}>
          Contenido original generado con asistencia de IA.
        </p>
      </article>
    </>
  );
}

export default function PrintPage() {
  return (
    <Suspense fallback={null}>
      <PrintView />
    </Suspense>
  );
}
