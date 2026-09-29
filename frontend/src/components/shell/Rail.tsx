"use client";

import { Library, Plus } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/book/BrandMark";
import { Tooltip } from "@/components/ui/Tooltip";
import { UserMenu } from "./UserMenu";

function RailLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <Tooltip content={label}>
      <Link
        href={href}
        aria-label={label}
        className="grid size-10 place-items-center rounded-xl text-grafito transition-colors hover:bg-control hover:text-texto [&_svg]:size-[19px]"
      >
        {children}
      </Link>
    </Tooltip>
  );
}

/** Barra lateral reducida a iconos para dejar espacio al libro abierto. */
export function Rail() {
  return (
    <div className="flex h-full flex-col items-center gap-3 py-5">
      <Link href="/" aria-label="Folio, ir al inicio" className="mb-2 grid size-10 place-items-center rounded-xl">
        <BrandMark />
      </Link>
      <RailLink href="/" label="Nuevo ebook">
        <Plus />
      </RailLink>
      <RailLink href="/biblioteca" label="Biblioteca">
        <Library />
      </RailLink>
      <div className="mt-auto">
        <UserMenu compact />
      </div>
    </div>
  );
}
