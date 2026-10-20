"use client";

import { CircleAlert, RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { api } from "@/lib/api";
import type { Ebook } from "@/lib/types";
import { StageHeader } from "./StageHeader";

/** Idea elegida entre las alternativas; el inicio la recoge al montarse. */
export const IDEA_KEY = "folio:idea-sugerida";

/** Error reintentable que no pertenece a un capítulo (al investigar o al maquetar). */
export function StageError({ ebook }: { ebook: Ebook }) {
  return (
    <div role="alert" className="grid gap-2 rounded-2xl bg-error-suave px-4 py-3.5">
      <p className="flex items-center gap-1.5 text-[14px] font-medium text-error">
        <CircleAlert className="size-4 flex-none" aria-hidden /> {ebook.error?.message ?? "Algo salió mal"}
      </p>
      <p className="text-[13.5px] text-texto">Lo que ya estaba hecho sigue a salvo.</p>
      {ebook.error?.retryable !== false && (
        <Button size="sm" variant="primario" className="w-fit" onClick={() => api.retry(ebook.id)}>
          <RotateCw /> Reintentar
        </Button>
      )}
    </div>
  );
}

/** El guardarraíl del servidor rechazó el tema (RF-01): no es un error, se proponen alternativas. */
export function TopicRejected({ ebook }: { ebook: Ebook }) {
  const router = useRouter();
  function pickIdea(idea: string) {
    try {
      sessionStorage.setItem(IDEA_KEY, idea);
    } catch {
      // Sin almacenamiento: el inicio se abre vacío.
    }
    api.remove(ebook.id);
    router.push("/");
  }
  return (
    <div className="grid gap-5">
      <StageHeader title="Probemos con otra idea" subtitle={ebook.error?.message ?? "Folio crea guías prácticas sobre situaciones reales."} />
      <div className="grid gap-3 rounded-2xl bg-control px-4 py-3.5">
        <p className="text-[14.5px]">El Investigador propone estas ideas parecidas, de no ficción:</p>
        <div className="flex flex-wrap gap-2">
          {(ebook.error?.alternatives ?? []).map((alt) => (
            <Chip key={alt} onClick={() => pickIdea(alt)}>
              {alt}
            </Chip>
          ))}
        </div>
      </div>
      <Button className="w-fit" onClick={() => pickIdea("")}>
        Escribir otra idea
      </Button>
    </div>
  );
}
