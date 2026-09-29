import fs from "node:fs";
import path from "node:path";
import { expect, type Page, type TestInfo } from "@playwright/test";

export const EVIDENCIAS = path.join(__dirname, "evidencias");
/** Clave de los datos del usuario de demostración ("Continuar con Google"). */
const DATOS = "folio:datos:fran@folio.demo";

type Velocidad = "normal" | "rapida" | "turbo";

/** Navega a una ruta relativa al sitio (funciona también con basePath de GitHub Pages). */
export async function ir(page: Page, ruta: string) {
  await page.goto(ruta.replace(/^\//, ""));
}

/** Entra como usuario de demostración con la velocidad de simulación indicada. */
export async function entrar(page: Page, velocidad: Velocidad = "turbo") {
  await ir(page, "login/");
  await page.evaluate((v) => localStorage.setItem("folio:preferencias", JSON.stringify({ simSpeed: v })), velocidad);
  await page.reload();
  await page.getByRole("button", { name: "Continuar con Google" }).click();
  await expect(page.getByText("¿Sobre qué quieres escribir hoy?")).toBeVisible();
}

interface NuevoEbook {
  nicho?: string;
  idea?: string;
  capitulos?: "5" | "6" | "7";
}

/** Crea un ebook desde el inicio y espera a la primera pausa (índice). */
export async function crearEbook(page: Page, { nicho, idea, capitulos }: NuevoEbook) {
  await ir(page, "");
  await expect(page.locator("#idea")).toBeVisible();
  if (nicho) await page.getByRole("group", { name: "Ideas para empezar" }).getByRole("button", { name: nicho }).click();
  if (idea) await page.locator("#idea").fill(idea);
  if (capitulos) {
    await page.getByRole("button", { name: /Capítulos: automático|\d capítulos/ }).click();
    await page.getByRole("radio", { name: capitulos, exact: true }).click();
    await page.keyboard.press("Escape");
  }
  await page.getByRole("button", { name: "Proponer índice" }).click();
  await page.waitForURL(/\/ebook\/?\?id=/);
  await expect(page.getByRole("heading", { name: "Tu turno: revisa el índice" })).toBeVisible({ timeout: 90_000 });
}

export function idActual(page: Page): string {
  const id = new URL(page.url()).searchParams.get("id");
  if (!id) throw new Error(`No hay ebook abierto en ${page.url()}`);
  return id;
}

/** Datos guardados del usuario (la caché se persiste con ~400 ms de retraso). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function estado(page: Page): Promise<{ order: string[]; ebooks: Record<string, any> }> {
  await page.waitForTimeout(700);
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '{"order":[],"ebooks":{}}'), DATOS);
}

export async function ebookPorId(page: Page, id: string) {
  return (await estado(page)).ebooks[id];
}

/** Captura de pantalla de evidencia, guardada en e2e/evidencias y adjunta al informe HTML. */
export async function evidencia(page: Page, info: TestInfo, nombre: string) {
  fs.mkdirSync(EVIDENCIAS, { recursive: true });
  const file = path.join(EVIDENCIAS, `${nombre}.jpg`);
  await page.waitForTimeout(450);
  await page.screenshot({ path: file, type: "jpeg", quality: 82 });
  await info.attach(nombre, { path: file, contentType: "image/jpeg" });
}

export function guardarDato(nombre: string, datos: unknown) {
  fs.mkdirSync(EVIDENCIAS, { recursive: true });
  fs.writeFileSync(path.join(EVIDENCIAS, nombre), JSON.stringify(datos, null, 2));
}

// ---------- Contraste WCAG ----------

function canal(c: number) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function luminancia([r, g, b]: number[]) {
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}
function rgb(color: string): number[] {
  if (color.startsWith("#")) {
    const n = parseInt(color.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  return (color.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
}
export function contraste(a: string, b: string): number {
  const [la, lb] = [luminancia(rgb(a)), luminancia(rgb(b))].sort((x, y) => y - x);
  return (la + 0.05) / (lb + 0.05);
}
