"use client";

// Autenticación simulada (RD-01). En la fase 4 se reemplaza por el proveedor
// real (propuesta: Supabase Auth); la interfaz de este contexto se mantiene.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { clearSession } from "@/lib/api/store";

export interface User {
  name: string;
  email: string;
}

interface AuthContextValue {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => { ok: true } | { ok: false; error: string };
  loginWithGoogle: () => void;
  register: (name: string, email: string, password: string) => { ok: true } | { ok: false; error: string };
  logout: () => void;
  rename: (name: string) => void;
}

const SESSION_KEY = "folio:sesion";
const USERS_KEY = "folio:usuarios";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AuthContext = createContext<AuthContextValue | null>(null);

function readUsers(): Record<string, { name: string }> {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function nameFromEmail(email: string): string {
  const base = email.split("@")[0].split(/[._-]/)[0] || "Hola";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      // Lectura única del almacenamiento del navegador al montar.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setUser(JSON.parse(raw));
    } catch {
      // Sesión ilegible: se ignora.
    }
    setReady(true);
  }, []);

  const persist = useCallback((u: User | null) => {
    setUser(u);
    try {
      if (u) localStorage.setItem(SESSION_KEY, JSON.stringify(u));
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      // Sin almacenamiento: la sesión dura lo que la pestaña.
    }
  }, []);

  const login = useCallback<AuthContextValue["login"]>(
    (email, password) => {
      const clean = email.trim().toLowerCase();
      if (!EMAIL_RE.test(clean)) return { ok: false, error: "Escribe un correo válido, por ejemplo tu@correo.com." };
      if (password.length < 6) return { ok: false, error: "La contraseña debe tener al menos 6 caracteres." };
      const known = readUsers()[clean];
      persist({ email: clean, name: known?.name ?? nameFromEmail(clean) });
      return { ok: true };
    },
    [persist],
  );

  const register = useCallback<AuthContextValue["register"]>(
    (name, email, password) => {
      const clean = email.trim().toLowerCase();
      if (name.trim().length < 2) return { ok: false, error: "Escribe tu nombre." };
      if (!EMAIL_RE.test(clean)) return { ok: false, error: "Escribe un correo válido, por ejemplo tu@correo.com." };
      if (password.length < 6) return { ok: false, error: "La contraseña debe tener al menos 6 caracteres." };
      try {
        const users = readUsers();
        users[clean] = { name: name.trim() };
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
      } catch {
        // Continúa aunque no se pueda guardar.
      }
      persist({ email: clean, name: name.trim() });
      return { ok: true };
    },
    [persist],
  );

  const loginWithGoogle = useCallback(() => persist({ email: "fran@folio.demo", name: "Fran" }), [persist]);

  const logout = useCallback(() => {
    persist(null);
    clearSession();
  }, [persist]);

  const rename = useCallback(
    (name: string) => {
      if (!user || !name.trim()) return;
      const next = { ...user, name: name.trim() };
      persist(next);
      try {
        const users = readUsers();
        users[user.email] = { name: next.name };
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
      } catch {
        // Sin almacenamiento.
      }
    },
    [persist, user],
  );

  const value = useMemo(
    () => ({ user, ready, login, loginWithGoogle, register, logout, rename }),
    [user, ready, login, loginWithGoogle, register, logout, rename],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
