"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { simSettings } from "@/lib/api/mock/simulator";
import type { ExercisePref } from "@/lib/types";

export interface Prefs {
  /** Nombre de autor que se usa como valor inicial en las portadas. */
  authorName: string;
  exercisePref: ExercisePref;
  reduceMotion: boolean;
  /** Opciones de demostración (solo en la fase con datos simulados). */
  simSpeed: "normal" | "rapida";
  simulateError: boolean;
}

const DEFAULTS: Prefs = {
  authorName: "",
  exercisePref: "auto",
  reduceMotion: false,
  simSpeed: "normal",
  simulateError: false,
};

const KEY = "folio:preferencias";

interface PrefsContextValue {
  prefs: Prefs;
  setPrefs: (patch: Partial<Prefs>) => void;
}

const PrefsContext = createContext<PrefsContextValue | null>(null);

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setState] = useState<Prefs>(DEFAULTS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      // Lectura única del almacenamiento del navegador al montar.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setState({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {
      // Preferencias ilegibles: se usan las de por defecto.
    }
  }, []);

  useEffect(() => {
    simSettings.speed = prefs.simSpeed === "rapida" ? 2.5 : 1;
    simSettings.simulateError = prefs.simulateError;
    document.documentElement.dataset.reduceMotion = String(prefs.reduceMotion);
  }, [prefs]);

  const setPrefs = useCallback((patch: Partial<Prefs>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // Sin almacenamiento.
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ prefs, setPrefs }), [prefs, setPrefs]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): PrefsContextValue {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs debe usarse dentro de PrefsProvider");
  return ctx;
}
