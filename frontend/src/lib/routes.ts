// Rutas de la app. Los ebooks usan parámetros de consulta (/ebook?id=…) en
// lugar de rutas dinámicas para que el sitio pueda exportarse como estático
// (GitHub Pages): los ids se crean en el navegador y no se conocen al compilar.

/** Prefijo del sitio cuando se publica en una subcarpeta (GitHub Pages). */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function ebookHref(id: string, { nuevo = false } = {}): string {
  return `/ebook?id=${encodeURIComponent(id)}${nuevo ? "&nuevo=1" : ""}`;
}

/** URL absoluta de la vista de impresión (se abre con window.open, que no aplica basePath). */
export function printUrl(id: string, archivo: string): string {
  return `${BASE_PATH}/imprimir/?id=${encodeURIComponent(id)}&archivo=${encodeURIComponent(archivo)}`;
}

/** Normaliza la ruta actual (sin barra final) para compararla. */
export function cleanPath(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
}
