"use client";

import { Dialog } from "radix-ui";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Wordmark } from "@/components/book/BrandMark";
import { IconButton } from "@/components/ui/Button";
import { OfflineNotice } from "@/components/states/OfflineNotice";
import { cn } from "@/lib/cn";
import { cleanPath } from "@/lib/routes";
import { Rail } from "./Rail";
import { Sidebar } from "./Sidebar";
import { UserMenu } from "./UserMenu";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const inBook = cleanPath(pathname) === "/ebook";
  const [drawer, setDrawer] = useState(false);

  return (
    <div className="flex min-h-dvh">
      <a
        href="#contenido"
        className="sr-only z-50 rounded-full bg-tinta px-4 py-2 text-sobre-tinta focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Saltar al contenido
      </a>

      <aside
        aria-label="Navegación"
        className={cn(
          "sticky top-0 hidden h-dvh flex-none border-r border-linea bg-barra lg:block",
          inBook ? "w-[68px]" : "w-[272px]",
        )}
      >
        {inBook ? <Rail /> : <Sidebar />}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-linea bg-barra/90 px-3 py-2 backdrop-blur lg:hidden">
          <Dialog.Root open={drawer} onOpenChange={setDrawer}>
            <Dialog.Trigger asChild>
              <IconButton label="Abrir menú">
                <Menu />
              </IconButton>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgb(12_14_18/0.36)] data-[state=open]:animate-[fundido_160ms_ease-out]" />
              <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-[min(86vw,300px)] bg-barra shadow-2xl focus:outline-none data-[state=open]:animate-[deslizar_200ms_cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:animate-none">
                <Dialog.Title className="sr-only">Menú</Dialog.Title>
                <Dialog.Description className="sr-only">Navegación de Folio</Dialog.Description>
                <Dialog.Close asChild>
                  <IconButton label="Cerrar menú" size="sm" className="absolute right-3 top-4">
                    <X />
                  </IconButton>
                </Dialog.Close>
                <Sidebar onNavigate={() => setDrawer(false)} />
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
          <Link href="/" aria-label="Folio, ir al inicio">
            <Wordmark className="text-[17px]" />
          </Link>
          <div className="ml-auto">
            <UserMenu compact />
          </div>
        </header>

        <main id="contenido" className="flex min-w-0 flex-1 flex-col">
          {children}
        </main>
      </div>
      <OfflineNotice />
    </div>
  );
}
