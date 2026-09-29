"use client";

import { Library, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/book/BrandMark";
import { MiniCover } from "@/components/book/Cover";
import { useEbookList } from "@/lib/api/hooks";
import { cn } from "@/lib/cn";
import { dateGroup } from "@/lib/format";
import { statusInfo } from "@/lib/phases";
import { UserMenu } from "./UserMenu";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { ebooks } = useEbookList();
  const recent = ebooks.slice(0, 12);
  const groups = new Map<string, typeof recent>();
  for (const e of recent) {
    const g = dateGroup(e.updatedAt);
    groups.set(g, [...(groups.get(g) ?? []), e]);
  }

  return (
    <div className="flex h-full flex-col gap-5 px-4 pb-4 pt-5">
      <Link href="/" onClick={onNavigate} className="w-fit rounded-md px-1" aria-label="Folio, ir al inicio">
        <Wordmark />
      </Link>

      <Link
        href="/"
        onClick={onNavigate}
        className="inline-flex h-10 w-fit items-center gap-2 rounded-full bg-pagina px-4 text-[14.5px] font-medium text-texto shadow-[0_1px_4px_rgb(var(--sombra)/0.1)] transition-shadow hover:shadow-[0_2px_10px_rgb(var(--sombra)/0.14)]"
      >
        <Plus className="size-4" /> Nuevo ebook
      </Link>

      <nav aria-label="Principal" className="-mt-1">
        <Link
          href="/biblioteca"
          onClick={onNavigate}
          aria-current={pathname === "/biblioteca" ? "page" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[14.5px] text-texto transition-colors hover:bg-control",
            pathname === "/biblioteca" && "bg-pagina font-medium shadow-[0_1px_4px_rgb(var(--sombra)/0.08)]",
          )}
        >
          <Library className="size-[18px] text-grafito" /> Biblioteca
        </Link>
      </nav>

      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        {recent.length === 0 ? (
          <p className="px-3 text-[13px] text-tenue">Tus ebooks aparecerán aquí.</p>
        ) : (
          [...groups.entries()].map(([group, items]) => (
            <section key={group} className="mb-4">
              <h2 className="mb-1 px-3 text-[12.5px] font-medium text-tenue">{group}</h2>
              <ul className="grid grid-cols-1 gap-0.5">
                {items.map((e) => {
                  const info = statusInfo(e);
                  const active = pathname === `/ebook/${e.id}`;
                  const turn = info.group === "turno";
                  return (
                    <li key={e.id}>
                      <Link
                        href={`/ebook/${e.id}`}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[14px] text-texto transition-colors hover:bg-control",
                          (active || turn) && "bg-pagina shadow-[0_1px_4px_rgb(var(--sombra)/0.07)]",
                        )}
                      >
                        <MiniCover cloth={e.design.clothColor} />
                        <span className="min-w-0 flex-1 truncate">{e.title}</span>
                        <span
                          className={cn(
                            "whitespace-nowrap text-[12px]",
                            turn ? "font-semibold text-tinta-oscura" : info.group === "error" ? "text-error" : "text-tenue",
                          )}
                        >
                          {info.label}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>

      <UserMenu />
    </div>
  );
}
