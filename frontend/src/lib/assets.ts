import { API_URL } from "./api/mode";

/**
 * Resuelve la URL de un recurso del ebook (por ejemplo, la imagen de portada).
 * El servidor guarda rutas relativas (/api/assets/…); el modo demo, data: URLs.
 */
export function resolveAsset(src: string): string {
  return src.startsWith("/api/") ? `${API_URL}${src}` : src;
}
