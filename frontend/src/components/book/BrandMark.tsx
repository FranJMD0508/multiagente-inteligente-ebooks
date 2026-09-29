import { cn } from "@/lib/cn";

/** Marca provisional de Folio: un libro con su cinta marcapáginas. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("relative inline-block h-[22px] w-[17px] flex-none rounded-[3.5px] bg-texto", className)}>
      <span
        className="absolute right-[4px] top-0 h-[12px] w-[5px] bg-tinta"
        style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%)" }}
      />
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-display text-[19px] font-semibold tracking-[-0.02em] text-texto", className)}>
      <BrandMark />
      Folio
    </span>
  );
}
