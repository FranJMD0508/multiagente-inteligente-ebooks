"use client";

import { ToggleGroup } from "radix-ui";
import { cn } from "@/lib/cn";

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
}

export function Segmented<T extends string>({ label, value, options, onChange, size = "md", className }: SegmentedProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      aria-label={label}
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      className={cn("inline-flex flex-wrap gap-0.5 rounded-full bg-control p-1", className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          className={cn(
            "rounded-full text-grafito transition-[background-color,color,box-shadow] duration-150 hover:text-texto data-[state=on]:bg-pagina data-[state=on]:font-medium data-[state=on]:text-texto data-[state=on]:shadow-[0_1px_3px_rgb(var(--sombra)/0.12)]",
            size === "sm" ? "px-2.5 py-1 text-[12.5px]" : "px-3.5 py-1.5 text-[13.5px]",
          )}
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
