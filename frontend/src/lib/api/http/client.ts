// Cliente REST del backend (FastAPI). Añade el token de sesión, traduce los
// errores a mensajes en español y avisa cuando la sesión caduca.

import { API_URL } from "../mode";

const TOKEN_KEY = "folio:token";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public detail?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Sin almacenamiento: la sesión dura lo que la pestaña.
  }
}

let unauthorizedHandler: (() => void) | null = null;

/** El proveedor de sesión se registra aquí para cerrar la sesión si el token caduca. */
export function onUnauthorized(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

function messageFrom(status: number, body: unknown): { message: string; code?: string } {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    const d = detail as { message?: string; code?: string };
    if (d.message) return { message: d.message, code: d.code };
  }
  if (typeof detail === "string") return { message: detail };
  if (Array.isArray(detail)) return { message: "Algún dato no es válido. Revísalo e inténtalo de nuevo.", code: "validacion" };
  if (status === 404) return { message: "No encontramos lo que buscabas." };
  if (status >= 500) return { message: "El servidor tuvo un problema. Inténtalo de nuevo en un momento." };
  return { message: "No pudimos completar la acción. Inténtalo de nuevo." };
}

interface RequestOptions {
  body?: unknown;
  form?: FormData;
  /** Devuelve la respuesta sin leerla (descargas). */
  raw?: boolean;
  signal?: AbortSignal;
}

export async function request<T = unknown>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method,
      headers,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      signal: opts.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError("No pudimos conectar con el servidor de Folio. Revisa que esté en marcha.", 0, "sin_conexion");
  }

  if (res.status === 401 && token) {
    setToken(null);
    unauthorizedHandler?.();
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const { message, code } = messageFrom(res.status, body);
    throw new ApiError(message, res.status, code, (body as { detail?: unknown } | null)?.detail);
  }
  if (opts.raw) return res as unknown as T;
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
