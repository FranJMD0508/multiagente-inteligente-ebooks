import { cn } from "@/lib/cn";

interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pressed?: boolean;
  /** Color de tela opcional (muestra un pequeño lomo a la izquierda). */
  cloth?: string;
}

export function Chip({ pressed, cloth, className, children, type = "button", ...props }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={cn(
        "inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13.5px] transition-colors duration-150",
        pressed
          ? "border-texto bg-texto text-pagina"
          : "border-borde-control bg-pagina text-texto hover:border-tenue",
        className,
      )}
      {...props}
    >
      {cloth && (
        <span
          aria-hidden
          className="mini-portada h-3.5 w-2.5"
          style={{ ["--tela" as string]: cloth }}
        />
      )}
      {children}
    </button>
  );
}
