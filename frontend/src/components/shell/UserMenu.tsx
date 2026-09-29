"use client";

import { LogOut, Monitor, Moon, Settings, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { MenuContent, MenuItem, MenuRoot, MenuSeparator, MenuTrigger } from "@/components/ui/Menu";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("grid size-8 flex-none place-items-center rounded-full bg-tinta text-[13px] font-semibold text-sobre-tinta", className)}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { user, logout } = useAuth();
  const { setTheme } = useTheme();
  const router = useRouter();
  if (!user) return null;
  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={`Cuenta de ${user.name}`}
          className={cn(
            "flex items-center gap-2.5 rounded-full text-left text-[14px] text-texto transition-colors hover:bg-control",
            compact ? "p-1" : "w-full px-2 py-1.5",
          )}
        >
          <Avatar name={user.name} />
          {!compact && (
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{user.name}</span>
              <span className="block truncate text-[12px] text-tenue">{user.email}</span>
            </span>
          )}
        </button>
      </MenuTrigger>
      <MenuContent align={compact ? "start" : "start"}>
        <MenuItem onSelect={() => router.push("/ajustes")}>
          <Settings /> Ajustes
        </MenuItem>
        <MenuSeparator />
        <MenuItem onSelect={() => setTheme("light")}>
          <Sun /> Tema claro
        </MenuItem>
        <MenuItem onSelect={() => setTheme("dark")}>
          <Moon /> Tema oscuro
        </MenuItem>
        <MenuItem onSelect={() => setTheme("system")}>
          <Monitor /> Tema del sistema
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          onSelect={() => {
            logout();
            router.replace("/login");
          }}
        >
          <LogOut /> Cerrar sesión
        </MenuItem>
      </MenuContent>
    </MenuRoot>
  );
}
