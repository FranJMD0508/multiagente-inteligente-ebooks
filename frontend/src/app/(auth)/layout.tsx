"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Cover } from "@/components/book/Cover";
import { useAuth } from "@/lib/auth";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && user) router.replace("/");
  }, [ready, user, router]);

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden md:block">
        <div className="absolute left-[calc(50%-420px)] top-1/2 w-[170px] -translate-y-1/2 -rotate-[9deg]">
          <Cover title="Semanas que rinden" subtitle="Gestión del tiempo" author="Folio" cloth="#3B4A9E" className="w-full" />
        </div>
        <div className="absolute right-[calc(50%-420px)] top-[46%] w-[170px] -translate-y-1/2 rotate-[7deg]">
          <Cover title="Ahorra sin dejar de vivir" subtitle="Finanzas para universitarios" author="Folio" cloth="#2F6B58" className="w-full" />
        </div>
      </div>
      {ready && !user ? children : null}
    </main>
  );
}
