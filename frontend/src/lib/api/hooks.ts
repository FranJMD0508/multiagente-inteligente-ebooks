"use client";

import { useSyncExternalStore } from "react";
import type { Ebook } from "@/lib/types";
import { getServerState, getState, subscribe, type StoreState } from "./store";

export function useStore(): StoreState {
  return useSyncExternalStore(subscribe, getState, getServerState);
}

export function useEbook(id: string | undefined): { ebook: Ebook | undefined; ready: boolean } {
  const s = useStore();
  return { ebook: id ? s.ebooks[id] : undefined, ready: s.ready };
}

export function useEbookList(): { ebooks: Ebook[]; ready: boolean } {
  const s = useStore();
  return { ebooks: s.order.map((id) => s.ebooks[id]).filter(Boolean), ready: s.ready };
}
