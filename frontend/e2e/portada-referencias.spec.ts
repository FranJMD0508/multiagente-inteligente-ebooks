// Pruebas de aceptación de las funciones añadidas en la fase 4:
// - RD-04 · Edición de portada: plantillas, letra, tamaño y alineación del
//   título, imagen propia con velo accesible y contraportada.
// - RD-09 · Ayuda con las referencias: sugeridas por el Investigador,
//   verificadas en Crossref y Open Library, editables y exportadas en APA 7.
// Las fuentes bibliográficas se simulan (utils.simularFuentes), sin red.

import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { ebookPorId, entrar, evidencia, EVIDENCIAS, guardarDato, idActual, ir } from "./utils";

const IMAGEN = path.join(__dirname, "fixtures", "portada-clara.jpg");

async function abrirLibroListo(page: Page) {
  await ir(page, "biblioteca/");
  await page.getByRole("link", { name: /Ahorra sin dejar de vivir/ }).first().click();
  await page.waitForURL(/\/ebook\/?\?id=/);
  await expect(page.getByRole("tab", { name: "Portada y estilo" })).toBeVisible();
}

const ratio = (texto: string) => Number(texto.match(/(\d+,\d+):1/)?.[1].replace(",", "."));

test("RD-04 · Portada: plantillas, título, imagen con velo accesible y contraportada", async ({ page }) => {
  const info = test.info();
  await entrar(page);
  await abrirLibroListo(page);
  const id = idActual(page);
  await page.getByRole("tab", { name: "Portada y estilo" }).click();

  const plantillas = page.getByRole("radiogroup", { name: "Plantilla de portada" });
  await expect(plantillas.getByRole("radio")).toHaveCount(5);
  for (const nombre of ["Clásica", "Centrada", "Franja", "Marco", "Editorial"]) {
    await expect(plantillas.getByRole("radio", { name: nombre, exact: true })).toBeVisible();
  }
  await plantillas.getByRole("radio", { name: "Marco", exact: true }).click();
  await page.getByRole("radiogroup", { name: "Letra del título" }).getByRole("radio", { name: "Onest" }).click();
  await page.getByRole("radiogroup", { name: "Tamaño del título" }).getByRole("radio", { name: "Grande" }).click();
  let ebook = await ebookPorId(page, id);
  expect(ebook.design).toMatchObject({ coverTemplate: "marco", titleAlign: "center", titleFont: "Onest", titleSize: "l" });

  // Imagen clara: Folio calcula el velo mínimo para que el título siga teniendo 4,5:1 o más.
  await page.locator('input[type="file"]').setInputFiles(IMAGEN);
  await expect(page.getByText("Imagen de portada")).toBeVisible();
  const velo = page.getByRole("slider", { name: /Velo de color/ });
  await expect(velo).toBeVisible();
  const insignia = page.getByText(/^Contraste \d+,\d:1$/).last();
  await expect.poll(async () => ratio(await insignia.innerText())).toBeGreaterThanOrEqual(4.5);
  ebook = await ebookPorId(page, id);
  const img = ebook.design.coverImage;
  expect(img.placement).toBe("fondo");
  expect(img.minVeil, "una imagen clara necesita velo").toBeGreaterThan(0.3);
  expect(img.veil).toBeGreaterThanOrEqual(img.minVeil);
  expect(Number(await velo.getAttribute("min")), "el control no deja bajar del mínimo").toBeCloseTo(img.minVeil, 2);
  await evidencia(page, info, "RD-04-imagen-fondo");

  await page.getByRole("radio", { name: "En recuadro" }).click();
  await page.getByLabel("Texto alternativo").fill("Formas de colores sobre un fondo claro");
  await expect.poll(async () => (await ebookPorId(page, id)).design.coverImage.placement).toBe("recuadro");
  await evidencia(page, info, "RD-04-imagen-recuadro");

  await page.getByRole("tab", { name: "Contraportada" }).click();
  const sinopsis = page.getByLabel("Sinopsis");
  const antes = await sinopsis.inputValue();
  expect(antes.length, "el Maquetador ya propuso una sinopsis").toBeGreaterThan(60);
  await page.getByRole("button", { name: "Pedir otra sinopsis" }).click();
  await expect(sinopsis).not.toHaveValue(antes);
  await expect(page.getByText("Es la última página del PDF.")).toBeVisible();
  await evidencia(page, info, "RD-04-contraportada");
  guardarDato("RD-04-diseno.json", (await ebookPorId(page, id)).design);
});

test("RD-09 · Referencias sugeridas, verificadas, editables y en APA 7", async ({ page, context }) => {
  const info = test.info();
  await entrar(page);
  await abrirLibroListo(page);
  const id = idActual(page);
  await page.getByRole("tab", { name: /Referencias/ }).click();

  const lista = page.getByRole("list", { name: "Referencias del libro" });
  await expect(lista.getByRole("listitem")).toHaveCount(3);
  await expect(lista.getByText(/Verificada en Open Library/)).toHaveCount(3);
  await expect(lista).toContainText("Clear, J. (2018). Atomic habits: An easy & proven way to build good habits & break bad ones. Avery.");

  // Buscar por DOI y agregar: queda verificada en Crossref.
  await page.getByPlaceholder("Título, autor, DOI o ISBN").fill("https://doi.org/10.1177/1529100612453266");
  await page.getByRole("button", { name: "Buscar" }).click();
  const resultados = page.getByRole("list", { name: "Resultados de la búsqueda" });
  await expect(resultados).toContainText("Dunlosky, J., Rawson, K. A., Marsh, E. J., Nathan, M. J. y Willingham, D. T. (2013).");
  await resultados.getByRole("button", { name: "Agregar" }).click();
  await expect(lista.getByRole("listitem")).toHaveCount(4);
  await expect(lista.getByText("Verificada en Crossref")).toBeVisible();

  // Una referencia que no existe: Folio avisa que no la encontró.
  await page.getByRole("button", { name: "Escríbela a mano" }).click();
  const formulario = page.locator("form").filter({ hasText: "Nueva referencia" });
  await formulario.getByLabel("Autores").fill("Pérez, Ana");
  await formulario.getByLabel("Título").fill("Un libro inventado sobre ahorro");
  await formulario.getByLabel("Año").fill("2021");
  await formulario.getByLabel("Editorial").fill("Editorial Imaginaria");
  await formulario.getByRole("button", { name: "Capítulo 2" }).click();
  await formulario.getByRole("button", { name: "Guardar referencia" }).click();
  await expect(lista.getByText("No la encontramos")).toBeVisible();
  await expect(page.getByRole("tab", { name: /Referencias\s*1 por revisar/ })).toBeVisible();
  await evidencia(page, info, "RD-09-referencias");

  // Cita en el texto (APA 7 en español).
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const fila = lista.getByRole("listitem").filter({ hasText: "Housel" });
  await fila.getByRole("button", { name: "Copiar cita" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("(Housel, 2020)");

  // La exportación avisa de la referencia sin encontrar y la incluye en APA 7.
  await page.getByRole("button", { name: "Exportar" }).click();
  const dialogo = page.getByRole("dialog", { name: "Exportar tu ebook" });
  await expect(dialogo.getByText(/Una referencia no se encontró/)).toBeVisible();
  await expect(dialogo.getByText("5 referencias en APA 7")).toBeVisible();
  await dialogo.getByRole("radio", { name: /Markdown/ }).click();
  const [descarga] = await Promise.all([page.waitForEvent("download"), dialogo.getByRole("button", { name: "Descargar Markdown" }).click()]);
  fs.mkdirSync(EVIDENCIAS, { recursive: true });
  const md = path.join(EVIDENCIAS, "ebook-referencias.md");
  await descarga.saveAs(md);
  const texto = fs.readFileSync(md, "utf8");
  expect(texto).toContain("# Referencias");
  expect(texto).toContain("Clear, J. (2018). *Atomic habits: An easy & proven way to build good habits & break bad ones*. Avery.");
  expect(texto).toContain("*Psychological Science in the Public Interest*, *14*(1), 4–58. https://doi.org/10.1177/1529100612453266");
  expect(texto).toContain("# Sobre este libro");
  expect(texto).toMatch(/<!-- folio: generado-con-ia=true;/);
  const orden = ["# Capítulo 6:", "# Referencias", "# Sobre este libro", "*Contenido original generado con asistencia de IA.*"].map((t) => texto.indexOf(t));
  expect(orden, "referencias y contraportada van al final, en orden").toEqual([...orden].sort((a, b) => a - b));
  await dialogo.getByRole("button", { name: "Revisarlas" }).click();
  await expect(page.getByRole("tab", { name: /Referencias/ })).toHaveAttribute("aria-selected", "true");
  guardarDato("RD-09-referencias.json", (await ebookPorId(page, id)).references);
});
