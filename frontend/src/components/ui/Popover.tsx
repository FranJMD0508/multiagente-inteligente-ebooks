"use client";

import { Popover as RPopover } from "radix-ui";

export const PopoverRoot = RPopover.Root;
export const PopoverTrigger = RPopover.Trigger;
export const PopoverClose = RPopover.Close;

export function PopoverContent({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <RPopover.Portal>
      <RPopover.Content
        aria-label={label}
        sideOffset={8}
        align="start"
        className="z-50 w-[min(90vw,300px)] rounded-2xl border border-linea bg-pagina p-4 text-texto shadow-[0_12px_32px_rgb(var(--sombra)/0.16)] focus:outline-none data-[state=open]:animate-[aparecer_140ms_ease-out] motion-reduce:animate-none"
      >
        {children}
      </RPopover.Content>
    </RPopover.Portal>
  );
}
