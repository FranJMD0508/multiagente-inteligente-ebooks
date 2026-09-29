"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Workspace } from "@/components/workspace/Workspace";
import { useEbook } from "@/lib/api/hooks";

function EbookView() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { ebook, ready } = useEbook(id);
  // La animación "el libro se abre" solo se reproduce al llegar desde el inicio.
  const [fresh] = useState(() => search.get("nuevo") === "1");

  useEffect(() => {
    if (search.get("nuevo") === "1") router.replace(`/ebook/${id}`, { scroll: false });
  }, [search, router, id]);

  useEffect(() => {
    if (ebook) document.title = `${ebook.title} · Folio`;
  }, [ebook]);

  if (!ready) return null;
  if (!ebook) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="hoja max-w-md px-8 py-10 text-center">
          <h1 className="font-display text-[24px] font-medium tracking-[-0.03em]">No encontramos este ebook</h1>
          <p className="mt-2 text-[15px] text-grafito">Puede que se haya eliminado o que el enlace no sea correcto.</p>
          <Link
            href="/biblioteca"
            className="mt-6 inline-flex h-10 items-center rounded-full bg-tinta px-5 text-[14.5px] font-medium text-sobre-tinta hover:bg-tinta-hover"
          >
            Ir a la biblioteca
          </Link>
        </div>
      </div>
    );
  }
  return <Workspace key={ebook.id} ebook={ebook} fresh={fresh} />;
}

export default function EbookPage() {
  return (
    <Suspense fallback={null}>
      <EbookView />
    </Suspense>
  );
}
