// Pruebas de aceptación: una por cada requerimiento de docs/requerimientos.txt.
// Cada prueba ejecuta el flujo real en el navegador, comprueba el criterio y
// guarda una captura de evidencia en e2e/evidencias/.
//
// Ejecutar:  npm run test:e2e
// Contra el sitio publicado:  E2E_BASE_URL=https://franjmd0508.github.io/multiagente-inteligente-ebooks npm run test:e2e

import fs from "node:fs";
import path from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { inflesz } from "./legibilidad";
import { contraste, crearEbook, ebookPorId, entrar, estado, evidencia, EVIDENCIAS, guardarDato, idActual, ir } from "./utils";

const MUJERES = ["Daniela", "Valentina", "Camila", "Lucía", "Mariana", "Sofía"];
const HOMBRES = ["Mateo", "José", "Andrés", "Samuel", "Tomás", "Diego"];
const SECCIONES = ["Introducción", "Desarrollo", "Ejemplos cotidianos", "Conclusión", "Ejercicio práctico"];

// ---------------------------------------------------------------------------
test.describe("Entrada y temario", () => {
  test("RF-01 · Nichos de situaciones reales; la ficción se rechaza", async ({ page }) => {
    const info = test.info();
    await entrar(page);

    const ideas = page.getByRole("group", { name: "Ideas para empezar" }).getByRole("button");
    expect(await ideas.count()).toBeGreaterThanOrEqual(5);
    await page.getByRole("button", { name: "Finanzas para universitarios" }).click();
    await expect(page.locator("#idea")).toHaveValue(/universitarios/);

    const antes = (await estado(page)).order.length;
    await page.locator("#idea").fill("Escribe una novela de dragones para adolescentes");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Folio crea guías prácticas sobre situaciones reales.")).toBeVisible();
    await expect(page).not.toHaveURL(/\/ebook\/?\?id=/);
    expect((await estado(page)).order.length, "no se creó ningún ebook de ficción").toBe(antes);
    await evidencia(page, info, "RF-01");
  });

  test("RF-02 · El temario siempre tiene entre 5 y 7 capítulos", async ({ page }) => {
    const info = test.info();
    await entrar(page);
    await crearEbook(page, { nicho: "Gestión del tiempo", capitulos: "5" });

    const filas = page.getByRole("list", { name: "Índice del ebook" }).getByRole("listitem");
    await expect(filas).toHaveCount(5);
    const quitar = page.getByRole("button", { name: /No se puede quitar/ });
    await expect(quitar).toHaveCount(5);
    for (const boton of await quitar.all()) await expect(boton).toBeDisabled();
    await evidencia(page, info, "RF-02-minimo");

    const agregar = page.getByRole("button", { name: "Agregar capítulo" });
    await agregar.click();
    await agregar.click();
    await expect(filas).toHaveCount(7);
    await expect(page.getByRole("button", { name: /7 capítulos · máximo alcanzado/ })).toBeDisabled();
    await evidencia(page, info, "RF-02-maximo");

    await crearEbook(page, { nicho: "Primer empleo" });
    await expect(page.getByRole("list", { name: "Índice del ebook" }).getByRole("listitem")).toHaveCount(6);
  });
});

// ---------------------------------------------------------------------------
test.describe.serial("Libro completo de finanzas", () => {
  let context: BrowserContext;
  let page: Page;
  let id = "";
  let markdown = "";
  let pdfPath = "";

  test.beforeAll(async ({ browser }) => {
    const use = test.info().project.use;
    context = await browser.newContext({ baseURL: use.baseURL, locale: use.locale, viewport: use.viewport, acceptDownloads: true });
    page = await context.newPage();
    await entrar(page);
    await crearEbook(page, { nicho: "Finanzas para universitarios" });
    id = idActual(page);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test("RF-05 · Pausa 1: el sistema se detiene tras proponer el índice", async () => {
    const info = test.info();
    await page.waitForTimeout(3000);
    let ebook = await ebookPorId(page, id);
    expect(ebook.status).toBe("indice_pendiente");
    expect(ebook.chapters.every((c: { sections?: unknown }) => !c.sections), "no se escribió ningún capítulo").toBe(true);

    await page.reload();
    await expect(page.getByRole("heading", { name: "Tu turno: revisa el índice" })).toBeVisible();
    ebook = await ebookPorId(page, id);
    expect(ebook.status, "la pausa sobrevive a recargar la página").toBe("indice_pendiente");
    await evidencia(page, info, "RF-05-pausa-indice");
  });

  test("RÉR-02 · El aviso legal se anuncia desde el índice", async () => {
    const info = test.info();
    await expect(page.getByText(/Incluirá un aviso legal porque el tema es financiero/)).toBeVisible();
    await page.getByRole("button", { name: "Ver el texto" }).click();
    await expect(page.getByText(/No sustituye la asesoría de un profesional en finanzas/)).toBeVisible();
    await evidencia(page, info, "RER-02-indice");
    await page.keyboard.press("Escape");
  });

  test("RF-05 · Pausa 2: se detiene tras escribir el capítulo 1", async () => {
    const info = test.info();
    await page.getByRole("button", { name: "Aprobar índice" }).click();
    await expect(page.getByRole("heading", { name: "Tu turno: revisa el capítulo 1" })).toBeVisible({ timeout: 90_000 });
    await page.waitForTimeout(3000);
    const ebook = await ebookPorId(page, id);
    expect(ebook.status).toBe("cap1_pendiente");
    expect(ebook.chapters[0].sections).toBeTruthy();
    expect(
      ebook.chapters.slice(1).every((c: { status: string; sections?: unknown }) => c.status === "pendiente" && !c.sections),
      "los capítulos 2 a N esperan la aprobación",
    ).toBe(true);
    await evidencia(page, info, "RF-05-pausa-capitulo1");
  });

  test("RF-03 · Cada capítulo tiene las cinco secciones obligatorias en orden", async () => {
    const info = test.info();
    const hoja = page.getByRole("article", { name: /Capítulo 1/ });
    await expect(hoja.locator("section > h4")).toHaveText(SECCIONES);
    await expect(page.getByRole("list", { name: "Estructura del capítulo" }).getByRole("listitem")).toHaveCount(5);
    await evidencia(page, info, "RF-03-capitulo");
  });

  test("RNF-01 · Tono conversacional y ajustes de tono", async () => {
    const info = test.info();
    const texto = await page.getByRole("article", { name: /Capítulo 1/ }).innerText();
    expect(texto, "el texto habla de tú a tú").toMatch(/\b(vas a|te|tu|puedes|elige|haz)\b/i);
    for (const chip of ["Más cercano", "Más ejemplos", "Más corto", "Menos formal", "Otro tipo de ejercicio"]) {
      await expect(page.getByRole("button", { name: chip })).toBeVisible();
    }
    await page.getByRole("button", { name: "Más cercano" }).click();
    await page.getByRole("button", { name: "Aplicar ajustes" }).click();
    await expect(page.getByText(/^Versión 2 ·/)).toBeVisible({ timeout: 90_000 });
    await expect(page.getByRole("heading", { name: "Tu turno: revisa el capítulo 1" })).toBeVisible();
    await expect(page.getByRole("article", { name: /Capítulo 1/ })).toContainText("Te lo digo claro");
    await evidencia(page, info, "RNF-01-tono");
  });

  test("RNF-03 · El capítulo 1 marca el tono y el resto se escribe en orden", async () => {
    const info = test.info();
    await expect(page.getByText("Este capítulo marcará el tono y el formato de todo el libro.")).toBeVisible();
    await page.getByRole("button", { name: "Aprobar y escribir el resto" }).click();
    await expect(page.getByRole("heading", { name: "Escribiendo tu libro" })).toBeVisible();
    await expect(page.getByText("Cada capítulo sigue el tono y el formato del capítulo 1 que aprobaste.")).toBeVisible();
    await evidencia(page, info, "RNF-03-redaccion");

    let maxSimultaneos = 0;
    for (let i = 0; i < 40; i++) {
      const ebook = await ebookPorId(page, id);
      const escribiendo = ebook.chapters.filter((c: { status: string }) => c.status === "generando").length;
      maxSimultaneos = Math.max(maxSimultaneos, escribiendo);
      if (ebook.status === "listo") break;
    }
    expect(maxSimultaneos, "nunca se escriben dos capítulos a la vez").toBeLessThanOrEqual(1);
  });

  test("RNF-04 · Los cuatro agentes trabajan por separado y se ven", async () => {
    const info = test.info();
    await expect(page.getByText("Tu ebook está listo", { exact: true })).toBeVisible({ timeout: 120_000 });
    const fases = page.getByRole("navigation", { name: "Proceso del ebook" });
    for (const quien of ["Investigador", "Redactor + Ejercicios", "Maquetador"]) {
      await expect(fases.getByText(quien).first()).toBeVisible();
    }
    const ebook = await ebookPorId(page, id);
    const agentes = [...new Set(ebook.activity.map((a: { agent: string }) => a.agent))].sort();
    expect(agentes).toEqual(["ejercicios", "investigador", "maquetador", "redactor"]);
    await evidencia(page, info, "RNF-04-agentes");
  });

  test("RF-04 · Solo checklists de autoevaluación o retos de 24-48 horas", async () => {
    const info = test.info();
    const ebook = await ebookPorId(page, id);
    const tipos: string[] = [];
    for (const c of ebook.chapters) {
      expect(c.exercise, `capítulo ${c.number} tiene ejercicio`).toBeTruthy();
      if (c.exercise.type === "reto") expect(["24h", "48h"]).toContain(c.exercise.duration);
      else expect(c.exercise.type).toBe("checklist");
      tipos.push(c.exercise.type === "reto" ? `reto ${c.exercise.duration}` : "checklist");
    }
    guardarDato("RF-04-ejercicios.json", tipos);
    await page.getByLabel("Vista previa del libro").getByText("Ejercicio práctico").first().scrollIntoViewIfNeeded();
    await evidencia(page, info, "RF-04-ejercicio");
  });

  test("RF-06 · Exportación a Markdown y a PDF", async () => {
    const info = test.info();
    await page.getByRole("button", { name: "Exportar" }).click();
    await expect(page.getByRole("dialog", { name: "Exportar tu ebook" })).toBeVisible();
    await evidencia(page, info, "RF-06-exportar");

    await page.getByRole("radio", { name: /Markdown/ }).click();
    const [descarga] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Descargar Markdown" }).click()]);
    fs.mkdirSync(EVIDENCIAS, { recursive: true });
    const mdPath = path.join(EVIDENCIAS, "ebook.md");
    await descarga.saveAs(mdPath);
    markdown = fs.readFileSync(mdPath, "utf8");
    expect(markdown.startsWith("# ")).toBe(true);
    expect(markdown).toContain("## Índice");
    expect(markdown, "listas").toMatch(/^- /m);
    expect(markdown, "bloque de cita").toMatch(/^> /m);
    await page.keyboard.press("Escape");

    const vista = await context.newPage();
    await vista.addInitScript(() => {
      window.print = () => {};
    });
    await ir(vista, `imprimir/?id=${id}`);
    await expect(vista.getByRole("heading", { name: "Índice" })).toBeVisible();
    pdfPath = path.join(EVIDENCIAS, "ebook.pdf");
    await vista.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true, tagged: true, outline: true });
    expect(fs.readFileSync(pdfPath).subarray(0, 4).toString()).toBe("%PDF");
    await evidencia(vista, info, "RF-06-pdf");
    await vista.close();
  });

  test("RA-01 · Jerarquía H1/H2/H3 en Markdown y PDF etiquetado", async () => {
    const info = test.info();
    const encabezados = markdown.split("\n").filter((l) => /^#{1,6} /.test(l));
    const niveles = encabezados.map((l) => l.match(/^#+/)![0].length);
    for (let i = 1; i < niveles.length; i++) {
      expect(niveles[i] - niveles[i - 1], `sin saltos de nivel: "${encabezados[i]}"`).toBeLessThanOrEqual(1);
    }
    expect(Math.max(...niveles)).toBeLessThanOrEqual(3);
    const ebook = await ebookPorId(page, id);
    expect(encabezados.filter((l) => /^# Capítulo \d+: /.test(l))).toHaveLength(ebook.chapters.length);

    const pdf = fs.readFileSync(pdfPath).toString("latin1");
    expect(pdf, "el PDF está etiquetado").toContain("/StructTreeRoot");
    const etiquetas = [...new Set(pdf.match(/\/S \/H[1-6]\b/g) ?? [])].map((e) => e.slice(4)).sort();
    expect(etiquetas, "el PDF usa H1, H2 y H3").toEqual(["H1", "H2", "H3"]);
    guardarDato("RA-01-encabezados.json", { markdown: encabezados, pdf: etiquetas });

    await page.getByRole("tab", { name: "Texto" }).click();
    const intro = page.getByRole("textbox", { name: "Introducción del capítulo 1" });
    await intro.click();
    await intro.press("Control+End");
    await intro.pressSequentially("\n\n# Un título manual");
    await expect(intro, "un H1 manual se convierte en subtítulo H3").toHaveValue(/### Un título manual/);
    await evidencia(page, info, "RA-01-editor");
  });

  test("RA-02 · Lenguaje claro (índice de legibilidad INFLESZ)", async () => {
    const info = test.info();
    const cuerpo = markdown
      .split("\n")
      .filter((l) => !/^#/.test(l))
      .join("\n");
    const resultado = inflesz(cuerpo);
    guardarDato("RA-02-legibilidad.json", resultado);
    info.annotations.push({ type: "INFLESZ", description: `${resultado.valor} (${resultado.nivel})` });
    expect(resultado.valor, "normal o más fácil").toBeGreaterThanOrEqual(55);
  });

  test("RA-03 · Fondo blanco, alto contraste, letra legible y 11 pt como mínimo", async () => {
    const info = test.info();
    await page.getByRole("tab", { name: "Portada y estilo" }).click();
    await expect(page.getByRole("radiogroup", { name: "Letra del cuerpo" }).getByRole("radio")).toHaveText(["Roboto", "Arial", "Helvetica"]);
    await expect(page.getByRole("radiogroup", { name: "Tamaño del cuerpo" }).getByRole("radio")).toHaveText(["11 pt", "12 pt", "13 pt"]);

    await page.locator('input[type="color"]').fill("#f5d76e");
    await expect(page.getByText("El texto blanco no se leería bien")).toBeVisible();
    await evidencia(page, info, "RA-03-contraste");
    await page.getByRole("button", { name: "Usar el tono accesible" }).click();
    await expect(page.getByText("El texto blanco no se leería bien")).toHaveCount(0);
    const ebook = await ebookPorId(page, id);
    expect(contraste(ebook.design.clothColor, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);

    const vista = await context.newPage();
    await vista.addInitScript(() => {
      window.print = () => {};
    });
    await ir(vista, `imprimir/?id=${id}`);
    const css = await vista.locator("article.libro").evaluate((el) => {
      const s = getComputedStyle(el);
      return { tamano: s.fontSize, familia: s.fontFamily, color: s.color, fondo: s.backgroundColor };
    });
    guardarDato("RA-03-estilos-pdf.json", css);
    expect(parseFloat(css.tamano), "11 pt = 14,67 px").toBeGreaterThanOrEqual(14.6);
    expect(css.familia).toMatch(/Roboto|Arial|Helvetica/);
    expect(css.fondo).toBe("rgb(255, 255, 255)");
    expect(contraste(css.color, css.fondo)).toBeGreaterThanOrEqual(7);
    await vista.close();
  });

  test("RÉR-01 · Contenido original y nota de transparencia", async () => {
    const info = test.info();
    expect(markdown).toContain("*Contenido original generado con asistencia de IA.*");
    await page.getByRole("button", { name: "Exportar" }).click();
    await expect(page.getByRole("dialog").getByText("Contenido original generado con asistencia de IA.")).toBeVisible();
    await evidencia(page, info, "RER-01-transparencia");
    await page.keyboard.press("Escape");
  });

  test("RÉR-02 · Aviso legal automático y no removible en temas sensibles", async () => {
    const info = test.info();
    const aviso = markdown.indexOf("## Aviso legal");
    const indice = markdown.indexOf("## Índice");
    const cap1 = markdown.indexOf("# Capítulo 1:");
    expect(aviso, "el aviso está en el libro").toBeGreaterThan(0);
    expect(aviso, "va antes del índice").toBeLessThan(indice);
    expect(indice).toBeLessThan(cap1);

    await page.getByRole("tab", { name: "Texto" }).click();
    await page.getByLabel("Capítulo que quieres editar").selectOption({ label: "Aviso legal" });
    await expect(page.getByText(/no se puede quitar \(RÉR-02\)/)).toBeVisible();
    await expect(page.getByRole("textbox", { name: /aviso/i })).toHaveCount(0);
    await evidencia(page, info, "RER-02-editor");

    await crearEbook(page, { idea: "Cómo manejar la ansiedad y el estrés antes de un examen importante" });
    await expect(page.getByText(/Incluirá un aviso legal porque el tema toca la salud emocional/)).toBeVisible();
    await evidencia(page, info, "RER-02-emocional");

    await crearEbook(page, { nicho: "Gestión del tiempo" });
    await expect(page.getByText(/Incluirá un aviso legal/)).toHaveCount(0);
  });

  test("RÉR-03 · Ejemplos con personas diversas", async () => {
    const ebook = await ebookPorId(page, id);
    const nombres: string[] = ebook.chapters.flatMap((c: { sections?: { ejemplos: string } }) =>
      (c.sections?.ejemplos ?? "")
        .split("\n\n")
        .map((p) => p.trim().split(" ")[0])
        .filter(Boolean),
    );
    const mujeres = nombres.filter((n) => MUJERES.includes(n));
    const hombres = nombres.filter((n) => HOMBRES.includes(n));
    guardarDato("RER-03-personas.json", { nombres, mujeres: mujeres.length, hombres: hombres.length });
    test.info().annotations.push({ type: "Personas en los ejemplos", description: nombres.join(", ") });
    expect(mujeres.length).toBeGreaterThan(0);
    expect(hombres.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
test("RNF-02 · Cada capítulo se genera en menos de 60 segundos, con streaming", async ({ page }) => {
  const info = test.info();
  test.setTimeout(240_000);
  await entrar(page, "normal");
  await crearEbook(page, { nicho: "Hábitos y rutinas" });
  await page.getByRole("button", { name: "Aprobar índice" }).click();
  const inicio = Date.now();
  await expect(page.getByRole("heading", { name: "Escribiendo el capítulo 1" })).toBeVisible();

  const hoja = page.getByRole("article", { name: /Capítulo 1/ });
  const antes = (await hoja.innerText()).length;
  await page.waitForTimeout(2500);
  const despues = (await hoja.innerText()).length;
  expect(despues, "el texto aparece mientras se escribe").toBeGreaterThan(antes);
  await evidencia(page, info, "RNF-02-streaming");

  await expect(page.getByRole("heading", { name: "Tu turno: revisa el capítulo 1" })).toBeVisible({ timeout: 60_000 });
  const segundos = (Date.now() - inicio) / 1000;
  guardarDato("RNF-02-tiempo.json", { capitulo1Segundos: Math.round(segundos * 10) / 10 });
  info.annotations.push({ type: "Tiempo del capítulo 1", description: `${segundos.toFixed(1)} s` });
  expect(segundos).toBeLessThan(60);
});
