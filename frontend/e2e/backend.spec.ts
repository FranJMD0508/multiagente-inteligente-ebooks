// Prueba de punta a punta con el backend real: FastAPI + LangGraph + SQLite,
// con el proveedor de IA "demo" (playwright.backend.config.ts). Recorre el
// flujo completo como lo haría una persona: crea una cuenta, rechaza ficción,
// pasa las dos pausas, edita, personaliza la portada, agrega una referencia,
// exporta Markdown y PDF desde el servidor, y comprueba que todo persiste.
//
//   npm run test:e2e:backend

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";

const IMAGEN = path.join(__dirname, "fixtures", "portada-clara.jpg");

test("@backend Flujo completo con el backend multiagente", async ({ page }) => {
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  const correo = `ana-${Date.now()}@folio.test`;

  // ----- Cuenta real (RD-01) -----
  await page.goto("registro/");
  await expect(page.getByRole("button", { name: "Continuar con Google" }), "sin Google con backend").toHaveCount(0);
  await page.getByLabel("Nombre").fill("Ana Prueba");
  await page.getByLabel("Correo").fill(correo);
  await page.getByLabel("Contraseña").fill("secreto123");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page.getByText("¿Sobre qué quieres escribir hoy?")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Hola, Ana/ })).toBeVisible();

  // ----- Guardarraíl en el servidor (RF-01) -----
  await page.locator("#idea").fill("Escribe una novela de dragones y caballeros");
  await page.keyboard.press("Enter");
  await expect(page.getByText(/¿Probamos con alguna de estas ideas\?/)).toBeVisible();
  await expect(page).not.toHaveURL(/\/ebook/);

  // ----- Investigador → pausa 1 (RF-02, RF-05) -----
  await page.locator("#idea").fill("Cómo organizar la semana cuando estudias y trabajas, sin culpa");
  await page.getByRole("button", { name: /Capítulos: automático/ }).click();
  await page.getByRole("radio", { name: "5", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Proponer índice" }).click();
  await page.waitForURL(/\/ebook\/?\?id=/);
  await expect(page.getByRole("heading", { name: "Tu turno: revisa el índice" })).toBeVisible({ timeout: 90_000 });
  const filas = page.getByRole("list", { name: "Índice del ebook" }).getByRole("listitem");
  await expect(filas).toHaveCount(5);
  await page.getByRole("button", { name: "Agregar capítulo" }).click();
  await expect(filas).toHaveCount(6);

  // Persistencia en el servidor: al recargar sigue en la misma pausa con 6 capítulos.
  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tu turno: revisa el índice" })).toBeVisible();
  await expect(filas).toHaveCount(6);

  // ----- Redactor + Ejercicios → pausa 2 (RF-03, RF-04, RF-05) -----
  await page.getByRole("button", { name: "Aprobar índice" }).click();
  await expect(page.getByRole("heading", { name: "Tu turno: revisa el capítulo 1" })).toBeVisible({ timeout: 120_000 });
  const hoja = page.getByRole("article", { name: /Capítulo 1/ });
  for (const s of ["Introducción", "Desarrollo", "Ejemplos cotidianos", "Conclusión", "Ejercicio práctico"]) {
    await expect(hoja.getByRole("heading", { name: s, exact: true })).toBeVisible();
  }

  // ----- Capítulos 2..N y Maquetador -----
  await page.getByRole("button", { name: "Aprobar y escribir el resto" }).click();
  await expect(page.getByText("Tu ebook está listo", { exact: true })).toBeVisible({ timeout: 180_000 });

  // ----- Edición y portada (RD-03, RD-04) -----
  const intro = page.getByRole("textbox", { name: "Introducción del capítulo 1" });
  await intro.click();
  await intro.press("Control+End");
  await intro.pressSequentially("\n\n# Un título manual");
  await expect(intro).toHaveValue(/### Un título manual/);

  await page.getByRole("tab", { name: "Portada y estilo" }).click();
  await page.getByRole("radiogroup", { name: "Plantilla de portada" }).getByRole("radio", { name: "Editorial", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles(IMAGEN);
  await expect(page.getByText("Imagen de portada")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("tab", { name: "Contraportada" }).click();
  await expect(page.getByLabel("Sinopsis")).not.toHaveValue("");

  // ----- Referencias (RD-09) -----
  await page.getByRole("tab", { name: /Referencias/ }).click();
  await page.getByRole("button", { name: "Escríbela a mano" }).click();
  const formulario = page.locator("form").filter({ hasText: "Nueva referencia" });
  await formulario.getByLabel("Autores").fill("Burkeman, Oliver");
  await formulario.getByLabel("Título").fill("Four thousand weeks: Time management for mortals");
  await formulario.getByLabel("Año").fill("2021");
  await formulario.getByLabel("Editorial").fill("Farrar, Straus and Giroux");
  await formulario.getByRole("button", { name: "Guardar referencia" }).click();
  const lista = page.getByRole("list", { name: "Referencias del libro" });
  await expect(lista).toContainText("Burkeman, O. (2021). Four thousand weeks: Time management for mortals. Farrar, Straus and Giroux.");

  // ----- Exportación desde el servidor (RF-06, RA-01, RÉR-01) -----
  await page.waitForTimeout(1200); // deja que se guarden las ediciones agrupadas
  await page.getByRole("button", { name: "Exportar" }).click();
  const dialogo = page.getByRole("dialog", { name: "Exportar tu ebook" });
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), "folio-export-"));

  const [pdf] = await Promise.all([page.waitForEvent("download"), dialogo.getByRole("button", { name: "Descargar PDF" }).click()]);
  const pdfPath = path.join(carpeta, "ebook.pdf");
  await pdf.saveAs(pdfPath);
  const bytes = fs.readFileSync(pdfPath).toString("latin1");
  expect(bytes.startsWith("%PDF")).toBe(true);
  expect(bytes, "PDF etiquetado").toContain("/StructTreeRoot");
  expect([...new Set(bytes.match(/\/S \/H[1-3]\b/g) ?? [])].map((t) => t.slice(4)).sort()).toEqual(["H1", "H2", "H3"]);

  await dialogo.getByRole("radio", { name: /Markdown/ }).click();
  const [md] = await Promise.all([page.waitForEvent("download"), dialogo.getByRole("button", { name: "Descargar Markdown" }).click()]);
  const mdPath = path.join(carpeta, "ebook.md");
  await md.saveAs(mdPath);
  const texto = fs.readFileSync(mdPath, "utf8");
  expect(texto.startsWith("# ")).toBe(true);
  expect(texto.match(/^# Capítulo \d+: /gm)).toHaveLength(6);
  expect(texto).toContain("### Un título manual");
  expect(texto).toContain("# Referencias");
  expect(texto).toContain("Burkeman, O. (2021). *Four thousand weeks: Time management for mortals*. Farrar, Straus and Giroux.");
  expect(texto).toContain("*Contenido original generado con asistencia de IA.*");
  expect(texto).toMatch(/<!-- folio: generado-con-ia=true;/);
  await page.keyboard.press("Escape");

  // ----- La sesión y los datos viven en el servidor -----
  const titulo = (await page.title()).replace(/ · Folio$/, "");
  await page.getByRole("button", { name: "Cuenta de Ana Prueba" }).first().click();
  await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
  await page.waitForURL(/login/);
  await page.getByLabel("Correo").fill(correo);
  await page.getByLabel("Contraseña").fill("secreto123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("¿Sobre qué quieres escribir hoy?")).toBeVisible();
  await page.goto("biblioteca/");
  await expect(page.getByRole("main").getByText(titulo).first()).toBeVisible();

  expect(errores, "sin errores en la página").toEqual([]);
});
