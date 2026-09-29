"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { BrandMark } from "@/components/book/BrandMark";
import { AppShell } from "@/components/shell/AppShell";
import { api } from "@/lib/api";
import { useStore } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth";
import { usePrefs } from "@/lib/prefs";

function Loading() {
  return (
    <div className="grid min-h-dvh place-items-center" aria-busy="true">
      <span className="flex items-center gap-3 text-[14px] text-tenue">
        <BrandMark />
        Abriendo tu biblioteca…
      </span>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const { prefs } = usePrefs();
  const store = useStore();
  const router = useRouter();

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  useEffect(() => {
    if (user && store.owner !== user.email) api.openLibrary(user.email, prefs.authorName || user.name);
  }, [user, store.owner, prefs.authorName]);

  if (!ready || !user || !store.ready || store.owner !== user.email) return <Loading />;
  return <AppShell>{children}</AppShell>;
}
