"use client";

// Sesión del usuario (RD-01). En el modo demo es simulada y vive en
// localStorage; con backend usa cuentas reales (FastAPI, contraseña con hash y
// token JWT). La interfaz de este contexto es la misma en los dos modos.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ApiError, getToken, onUnauthorized, request, setToken, TOKEN_STORAGE_KEY } from "@/lib/api/http/client";
import { disconnectEvents } from "@/lib/api/http/events";
import { resetSync } from "@/lib/api/http/sync";
import { API_MODE } from "@/lib/api/mode";
import { clearSession, showToast } from "@/lib/api/store";

export interface User {
  name: string;
  email: string;
}

type Result = { ok: true } | { ok: false; error: string };

interface AuthContextValue {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<Result>;
  /** Solo en el modo demo (no hay proveedor de Google configurado en el servidor). */
  loginWithGoogle: (() => void) | null;
  register: (name: string, email: string, password: string) => Promise<Result>;
  logout: () => void;
  rename: (name: string) => void;
  deleteAccount: () => Promise<Result>;
  /** Pide el enlace para restablecer la contraseña. */
  recover: (email: string) => Promise<Result>;
  /** Crea una contraseña nueva con el token del enlace. */
  resetPassword: (token: string, password: string) => Promise<Result>;
}

const SESSION_KEY = "folio:sesion";
const USERS_KEY = "folio:usuarios";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HTTP = API_MODE === "http";

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

function validate(email: string, password: string, name?: string): string | null {
  if (name !== undefined && name.trim().length < 2) return "Escribe tu nombre.";
  if (!EMAIL_RE.test(email)) return "Escribe un correo válido, por ejemplo tu@correo.com.";
  if (password.length < 6) return "La contraseña debe tener al menos 6 caracteres.";
  return null;
}

const fail = (err: unknown): Result => ({ ok: false, error: (err as Error).message });

function readSession(): User | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null; // Sesión ilegible o sin almacenamiento.
  }
}

/** Guarda quién tiene la sesión (con backend, el token va aparte: folio:token). */
function saveSession(u: User | null) {
  try {
    if (u) localStorage.setItem(SESSION_KEY, JSON.stringify(u));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Sin almacenamiento: la sesión dura lo que la pestaña.
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  // Sesión guardada: en el modo demo se lee de localStorage; con backend se
  // comprueba el token con GET /auth/me.
  useEffect(() => {
    let cancelled = false;
    if (HTTP) {
      if (!getToken()) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única al montar
        setReady(true);
        return;
      }
      request<User>("GET", "/auth/me")
        .then((u) => {
          if (cancelled) return;
          setUser({ name: u.name, email: u.email });
          saveSession({ name: u.name, email: u.email });
        })
        .catch((err) => {
          if (cancelled) return;
          if (err instanceof ApiError && err.status === 401) {
            // El token ya no vale: se cierra la sesión.
            setToken(null);
            saveSession(null);
          } else {
            // El servidor no responde (se está reiniciando, sin red…): se sigue con la
            // última sesión conocida y la app se pondrá al día al reconectar.
            const cached = readSession();
            if (cached) setUser(cached);
          }
        })
        .finally(() => !cancelled && setReady(true));
      return () => {
        cancelled = true;
      };
    }
    const cached = readSession();
    if (cached) setUser(cached);
    setReady(true);
  }, []);

  const persist = useCallback((u: User | null) => {
    setUser(u);
    saveSession(u);
  }, []);

  const logout = useCallback(() => {
    if (HTTP) {
      setToken(null);
      disconnectEvents();
      resetSync();
    }
    persist(null);
    clearSession();
  }, [persist]);

  // Si el servidor rechaza el token (caducó), se cierra la sesión. Si otra pestaña cierra la
  // sesión (o entra con otra cuenta), esta la sigue: el token es el mismo para todas.
  useEffect(() => {
    if (!HTTP) return;
    onUnauthorized(() => logout());
    const onStorage = (e: StorageEvent) => {
      if (e.key !== TOKEN_STORAGE_KEY && e.key !== null) return;
      if (!getToken()) logout();
      else if (e.newValue && e.oldValue && e.newValue !== e.oldValue) window.location.reload();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      onUnauthorized(null);
      window.removeEventListener("storage", onStorage);
    };
  }, [logout]);

  const login = useCallback<AuthContextValue["login"]>(
    async (email, password) => {
      const clean = email.trim().toLowerCase();
      const invalid = validate(clean, password);
      if (invalid) return { ok: false, error: invalid };
      if (HTTP) {
        try {
          const res = await request<{ token: string; user: User }>("POST", "/auth/login", { body: { email: clean, password } });
          setToken(res.token);
          persist({ name: res.user.name, email: res.user.email });
          return { ok: true };
        } catch (err) {
          return fail(err);
        }
      }
      const known = readUsers()[clean];
      persist({ email: clean, name: known?.name ?? nameFromEmail(clean) });
      return { ok: true };
    },
    [persist],
  );

  const register = useCallback<AuthContextValue["register"]>(
    async (name, email, password) => {
      const clean = email.trim().toLowerCase();
      const invalid = validate(clean, password, name);
      if (invalid) return { ok: false, error: invalid };
      if (HTTP) {
        try {
          const res = await request<{ token: string; user: User }>("POST", "/auth/register", {
            body: { name: name.trim(), email: clean, password },
          });
          setToken(res.token);
          persist({ name: res.user.name, email: res.user.email });
          return { ok: true };
        } catch (err) {
          return fail(err);
        }
      }
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

  const loginWithGoogle = useMemo(
    () => (HTTP ? null : () => persist({ email: "fran@folio.demo", name: "Fran" })),
    [persist],
  );

  const rename = useCallback(
    (name: string) => {
      if (!user || !name.trim() || name.trim() === user.name) return;
      const next = { ...user, name: name.trim() };
      persist(next);
      if (HTTP) {
        request("PATCH", "/auth/me", { body: { name: next.name } }).catch((err) => {
          // Con un 401 la sesión ya se cerró: no se revive al usuario anterior.
          if ((err instanceof ApiError && err.status === 401) || !getToken()) return;
          persist(user);
          showToast(`No pudimos cambiar tu nombre. ${(err as Error).message}`);
        });
        return;
      }
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

  const deleteAccount = useCallback<AuthContextValue["deleteAccount"]>(async () => {
    if (HTTP) {
      try {
        await request("DELETE", "/auth/me");
      } catch (err) {
        return fail(err);
      }
    }
    // En la demo es la biblioteca; con backend, una copia que guardaban versiones anteriores.
    if (user) {
      try {
        localStorage.removeItem(`folio:datos:${user.email}`);
      } catch {
        // Sin almacenamiento.
      }
    }
    logout();
    return { ok: true };
  }, [logout, user]);

  const recover = useCallback<AuthContextValue["recover"]>(async (email) => {
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) return { ok: false, error: "Escribe un correo válido, por ejemplo tu@correo.com." };
    if (!HTTP) return { ok: true };
    try {
      await request("POST", "/auth/recover", { body: { email: clean } });
      return { ok: true };
    } catch (err) {
      return fail(err);
    }
  }, []);

  const resetPassword = useCallback<AuthContextValue["resetPassword"]>(
    async (token, password) => {
      if (password.length < 6) return { ok: false, error: "La contraseña debe tener al menos 6 caracteres." };
      try {
        const res = await request<{ token: string; user: User }>("POST", "/auth/reset", { body: { token, password } });
        setToken(res.token);
        persist({ name: res.user.name, email: res.user.email });
        return { ok: true };
      } catch (err) {
        return fail(err);
      }
    },
    [persist],
  );

  const value = useMemo(
    () => ({ user, ready, login, loginWithGoogle, register, logout, rename, deleteAccount, recover, resetPassword }),
    [user, ready, login, loginWithGoogle, register, logout, rename, deleteAccount, recover, resetPassword],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
