import { API_URL } from "./api/mode";

/**
 * Resuelve la URL de un recurso del ebook (por ejemplo, la imagen de portada).
 * El servidor guarda rutas relativas (/api/assets/…); el modo demo, data: URLs.
 */
export function resolveAsset(src: string): string {
  return src.startsWith("/api/") ? `${API_URL}${src}` : src;
}

/**
 * ¿Viene del servidor? Esas imágenes se piden con CORS para que el navegador
 * pueda medir sus colores (velo mínimo) también cuando las sirve desde la caché.
 */
export function isRemote(src: string): boolean {
  return src.startsWith("/api/") || /^https?:/.test(src);
}
