import type { BookFont, CoverTemplate, PageSize } from "./types";

export const CLOTHS = [
  { name: "Botella", value: "#2F6B58" },
  { name: "Petróleo", value: "#1E5E73" },
  { name: "Añil", value: "#3B4A9E" },
  { name: "Vino", value: "#8C2F45" },
  { name: "Ocre", value: "#9A6A12" },
] as const;

export const COVER_TEMPLATES: { id: CoverTemplate; label: string }[] = [
  { id: "clasica", label: "Clásica" },
  { id: "centrada", label: "Centrada" },
  { id: "franja", label: "Franja" },
];

export const BOOK_FONTS: BookFont[] = ["Roboto", "Arial", "Helvetica"];
export const BODY_SIZES = [11, 12, 13] as const;
export const PAGE_SIZES: { id: PageSize; label: string; css: string }[] = [
  { id: "A5", label: "A5", css: "148mm 210mm" },
  { id: "A4", label: "A4", css: "210mm 297mm" },
  { id: "Carta", label: "Carta", css: "8.5in 11in" },
  { id: "6x9", label: "6 × 9 in", css: "6in 9in" },
];

export function bookFontStack(font: BookFont): string {
  if (font === "Roboto") return "var(--font-roboto), Roboto, Arial, sans-serif";
  if (font === "Arial") return "Arial, 'Helvetica Neue', Helvetica, sans-serif";
  return "Helvetica, 'Helvetica Neue', Arial, sans-serif";
}

// ---------- Contraste (WCAG 2.2) ----------

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function toHex([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
}

/**
 * Oscurece un color hasta que el texto blanco alcance el contraste mínimo (RA-03).
 * Devuelve el mismo color si ya cumple.
 */
export function accessibleCloth(hex: string, min = 4.5): string {
  let rgb = parseHex(hex);
  for (let i = 0; i < 40 && contrastRatio(toHex(rgb), "#FFFFFF") < min; i++) {
    rgb = rgb.map((v) => v * 0.94) as [number, number, number];
  }
  return toHex(rgb);
}

export function formatRatio(ratio: number): string {
  return ratio.toLocaleString("es", { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + ":1";
}
