"use client";

import { AlertDialog, Dialog as RDialog } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, IconButton } from "./Button";

const overlay =
  "fixed inset-0 z-50 bg-[rgb(12_14_18/0.36)] data-[state=open]:animate-[fundido_160ms_ease-out] motion-reduce:animate-none";
const panel =
  "fixed left-1/2 top-1/2 z-50 w-[min(92vw,480px)] -translate-x-1/2 -translate-y-1/2 rounded-[20px] bg-pagina p-6 text-texto shadow-[0_1px_3px_rgb(var(--sombra)/0.08),0_24px_60px_rgb(var(--sombra)/0.2)] focus:outline-none data-[state=open]:animate-[aparecer_180ms_cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:animate-none";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({ open, onOpenChange, title, description, children, className }: DialogProps) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className={overlay} />
        <RDialog.Content className={cn(panel, className)}>
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="grid gap-1">
              <RDialog.Title className="font-display text-[20px] font-medium tracking-[-0.02em]">{title}</RDialog.Title>
              {description ? (
                <RDialog.Description className="text-[14px] text-grafito">{description}</RDialog.Description>
              ) : (
                <RDialog.Description className="sr-only">{title}</RDialog.Description>
              )}
            </div>
            <RDialog.Close asChild>
              <IconButton label="Cerrar" size="sm" className="-mr-1 -mt-1">
                <X />
              </IconButton>
            </RDialog.Close>
          </div>
          {children}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

interface ConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  danger?: boolean;
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm, danger }: ConfirmProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={overlay} />
        <AlertDialog.Content className={cn(panel, "w-[min(92vw,420px)]")}>
          <AlertDialog.Title className="font-display text-[19px] font-medium tracking-[-0.02em]">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-[14.5px] text-grafito">{description}</AlertDialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="secundario">Cancelar</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant={danger ? "peligro" : "primario"} onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
