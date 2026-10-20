// Imagen propia de la portada (D-15): se reduce y comprime en el navegador y se
// calcula el velo de tela mínimo para que el texto blanco siga leyéndose
// (contraste de 4,5:1 o más, igual que la tela sola; RA-03 y WCAG 2.2).

import { luminance } from "./design";

export const COVER_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const COVER_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const MAX_SIDE = 1400;
const QUALITY = 0.86;

export type Rgb = [number, number, number];

export class CoverImageError extends Error {}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new CoverImageError("No pudimos abrir la imagen. Prueba con otra en JPG, PNG o WebP."));
    img.src = src;
  });
}

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new CoverImageError("No pudimos leer el archivo."));
    reader.readAsDataURL(file);
  });
}

/** Valida, reduce (lado mayor ≤ 1400 px) y comprime en JPEG. */
export async function prepareCoverImage(file: File): Promise<{ blob: Blob; dataUrl: string }> {
  if (!COVER_IMAGE_TYPES.includes(file.type)) throw new CoverImageError("Usa una imagen JPG, PNG o WebP.");
  if (file.size > COVER_IMAGE_MAX_BYTES) throw new CoverImageError("La imagen pesa más de 8 MB. Prueba con una más ligera.");
  const original = await fileToDataUrl(file);
  const img = await loadImage(original);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new CoverImageError("Tu navegador no pudo procesar la imagen.");
  // Fondo blanco por si la imagen trae transparencia (el JPEG no la admite).
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new CoverImageError("No pudimos comprimir la imagen."))), "image/jpeg", QUALITY),
  );
  return { blob, dataUrl: await fileToDataUrl(blob) };
}

const brightCache = new Map<string, Rgb>();

/** Color medio del 5 % de píxeles más claros (donde peor se leería el texto blanco). */
export async function brightColor(src: string): Promise<Rgb> {
  const cached = brightCache.get(src);
  if (cached) return cached;
  const img = await loadImage(src);
  const w = 48;
  const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [255, 255, 255];
  ctx.drawImage(img, 0, 0, w, h);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    // Imagen de otro origen sin CORS: se asume el peor caso (blanco).
    return [255, 255, 255];
  }
  const pixels: { rgb: Rgb; l: number }[] = [];
  for (let i = 0; i < data.length; i += 4) {
    const rgb: Rgb = [data[i], data[i + 1], data[i + 2]];
    pixels.push({ rgb, l: 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] });
  }
  pixels.sort((a, b) => b.l - a.l);
  const top = pixels.slice(0, Math.max(1, Math.round(pixels.length * 0.05)));
  const avg = top
    .reduce<Rgb>((acc, p) => [acc[0] + p.rgb[0], acc[1] + p.rgb[1], acc[2] + p.rgb[2]], [0, 0, 0])
    .map((v) => v / top.length) as Rgb;
  brightCache.set(src, avg);
  return avg;
}

function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(rgb: Rgb): string {
  return "#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

/** Contraste del texto blanco sobre la imagen con un velo de tela de opacidad `veil`. */
export function contrastWithVeil(bright: Rgb, cloth: string, veil: number): number {
  const c = hexToRgb(cloth);
  const mixed = bright.map((v, i) => v * (1 - veil) + c[i] * veil) as Rgb;
  return 1.05 / (luminance(toHex(mixed)) + 0.05);
}

/**
 * Velo mínimo (0 a 1) para llegar a 4,5:1, redondeado hacia arriba con un pequeño margen.
 * Con 1 el título queda sobre la tela sola, que siempre cumple (se valida al elegirla).
 */
export function minVeilFor(bright: Rgb, cloth: string, target = 4.6): number {
  // Una tela al límite (4,5:1) no permite llegar a 4,6 aunque tape toda la imagen.
  const goal = Math.min(target, Math.max(4.5, contrastWithVeil(bright, cloth, 1) - 0.01));
  if (contrastWithVeil(bright, cloth, 0) >= goal) return 0;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (contrastWithVeil(bright, cloth, mid) >= goal) hi = mid;
    else lo = mid;
  }
  return Math.min(1, Math.ceil(hi * 100) / 100);
}
