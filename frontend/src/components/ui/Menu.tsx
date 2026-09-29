"use client";

import { DropdownMenu } from "radix-ui";
import { cn } from "@/lib/cn";

export const MenuRoot = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export function MenuContent({ children, align = "end" }: { children: React.ReactNode; align?: "start" | "end" }) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={6}
        className="z-50 min-w-[190px] rounded-2xl border border-linea bg-pagina p-1.5 text-texto shadow-[0_12px_32px_rgb(var(--sombra)/0.16)] data-[state=open]:animate-[aparecer_140ms_ease-out] motion-reduce:animate-none"
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

export function MenuItem({
  children,
  onSelect,
  danger,
  disabled,
}: {
  children: React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        "flex cursor-default items-center gap-2.5 rounded-xl px-3 py-2 text-[14px] outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-control [&_svg]:size-4 [&_svg]:text-tenue",
        danger && "text-error [&_svg]:text-error",
      )}
    >
      {children}
    </DropdownMenu.Item>
  );
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-linea" />;
}
