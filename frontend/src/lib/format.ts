export function relativeTime(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.round(diff / 60_000);
  if (min < 2) return "hace un momento";
  if (min < 60) return `hace ${min} minutos`;
  const hours = Math.round(min / 60);
  if (hours < 24) return hours === 1 ? "hace 1 hora" : `hace ${hours} horas`;
  const days = Math.round(hours / 24);
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return weeks === 1 ? "hace 1 semana" : `hace ${weeks} semanas`;
  const months = Math.round(days / 30);
  return months <= 1 ? "hace 1 mes" : `hace ${months} meses`;
}

export function dateGroup(iso: string, now = Date.now()): "Hoy" | "Últimos 7 días" | "Anteriores" {
  const diff = now - new Date(iso).getTime();
  const day = 86_400_000;
  if (diff < day && new Date(iso).getDate() === new Date(now).getDate()) return "Hoy";
  if (diff < 7 * day) return "Últimos 7 días";
  return "Anteriores";
}

export function pluralize(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Páginas estimadas del ebook según su extensión y tamaño de página. */
export function estimatePages(words: number, pageSize: string, chapters: number, hasLegal: boolean): number {
  const perPage = pageSize === "A5" || pageSize === "6x9" ? 280 : 480;
  return Math.max(chapters + 2, Math.round(words / perPage) + chapters + 1 + (hasLegal ? 1 : 0));
}
