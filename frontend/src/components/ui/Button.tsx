import { forwardRef } from "react";
import { cn } from "@/lib/cn";

type Variant = "primario" | "secundario" | "quieto" | "peligro";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap select-none transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-[1.05em] [&_svg]:shrink-0";

const variants: Record<Variant, string> = {
  primario: "bg-tinta text-sobre-tinta hover:bg-tinta-hover shadow-[0_1px_2px_rgb(var(--sombra)/0.12)]",
  secundario: "bg-pagina text-texto border border-borde-control hover:border-tenue",
  quieto: "text-grafito hover:text-texto hover:bg-control",
  peligro: "bg-error text-white hover:opacity-90",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13.5px]",
  md: "h-10 px-4 text-[14.5px]",
  lg: "h-12 px-6 text-[15.5px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secundario", size = "md", className, type = "button", ...props },
  ref,
) {
  return <button ref={ref} type={type} className={cn(base, variants[variant], sizes[size], className)} {...props} />;
});

export const IconButton = forwardRef<HTMLButtonElement, ButtonProps & { label: string }>(function IconButton(
  { label, className, variant = "quieto", size = "md", type = "button", ...props },
  ref,
) {
  const dims = size === "sm" ? "size-8" : size === "lg" ? "size-12" : "size-10";
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(base, variants[variant], dims, "px-0", className)}
      {...props}
    />
  );
});
