// Capturas señaladas para la guía en PDF (docs/guia/). No es una prueba de
// aceptación: recorre la app como lo haría una persona, toma cada pantalla a
// doble resolución y guarda en un JSON la posición de los elementos que la
// guía resalta con números.
//
// Ejecutar:  npm run guia:capturas   (después, npm run guia:pdf)

import fs from "node:fs";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { crearEbook, entrar, idActual, ir } from "./utils";

const SALIDA = path.join(__dirname, "..", "..", "docs", "guia", "capturas");
const VENTANA = { width: 1440, height: 900 };
const IMAGEN_CLARA = path.join(__dirname, "fixtures", "portada-clara.jpg");

interface Caja {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface Marca {
  texto: string;
  loc: Locator;
  /** Une todas las coincidencias en un solo recuadro (si no, un recuadro por elemento). */
  unir?: boolean;
  margen?: number;
}
interface Opciones {
  /** Zona de la captura: un elemento, una caja, la pantalla entera o el espacio de trabajo (sin el riel). */
  region?: Locator | Locator[] | Caja | "pantalla" | "trabajo";
  margen?: number;
  marcas?: Marca[];
}

test.use({ deviceScaleFactor: 2, viewport: VENTANA });

const ampliar = (c: Caja, m: number): Caja => ({ x: c.x - m, y: c.y - m, width: c.width + 2 * m, height: c.height + 2 * m });

function recortar(c: Caja, limite: Caja): Caja | null {
  const x = Math.max(c.x, limite.x);
  const y = Math.max(c.y, limite.y);
  const r = Math.min(c.x + c.width, limite.x + limite.width);
  const b = Math.min(c.y + c.height, limite.y + limite.height);
  return r - x > 2 && b - y > 2 ? { x, y, width: r - x, height: b - y } : null;
}

function unir(cajas: Caja[]): Caja {
  const x = Math.min(...cajas.map((c) => c.x));
  const y = Math.min(...cajas.map((c) => c.y));
  const r = Math.max(...cajas.map((c) => c.x + c.width));
  const b = Math.max(...cajas.map((c) => c.y + c.height));
  return { x, y, width: r - x, height: b - y };
}

async function cajasDe(loc: Locator): Promise<Caja[]> {
  // Reintenta: el texto en vivo vuelve a dibujar sus elementos constantemente.
  for (let intento = 0; intento < 6; intento++) {
    const cajas: Caja[] = [];
    for (const el of await loc.all()) {
      const c = await el.boundingBox();
      if (c && c.width >= 1 && c.height >= 1) cajas.push(c);
    }
    if (cajas.length) return cajas;
    await loc.page().waitForTimeout(120);
  }
  return [];
}

async function captura(page: Page, nombre: string, { region = "pantalla", margen = 16, marcas = [] }: Opciones = {}) {
  await page.waitForTimeout(500);
  const pantalla: Caja = { x: 0, y: 0, ...VENTANA };
  let zona: Caja;
  if (region === "pantalla") zona = pantalla;
  else if (region === "trabajo") zona = { x: 68, y: 0, width: VENTANA.width - 68, height: VENTANA.height };
  else if (!Array.isArray(region) && "x" in region) zona = region;
  else {
    const cajas = (await Promise.all((Array.isArray(region) ? region : [region]).map(cajasDe))).flat();
    if (!cajas.length) throw new Error(`${nombre}: la región no está visible`);
    zona = ampliar(unir(cajas), margen);
  }
  zona = recortar(zona, pantalla)!;
  zona = { x: Math.round(zona.x), y: Math.round(zona.y), width: Math.round(zona.width), height: Math.round(zona.height) };

  const salida = [];
  for (const [i, m] of marcas.entries()) {
    let cajas = await cajasDe(m.loc);
    if (m.unir && cajas.length) cajas = [unir(cajas)];
    const dentro = cajas.map((c) => recortar(ampliar(c, m.margen ?? 6), zona)).filter((c): c is Caja => c !== null);
    if (!dentro.length) throw new Error(`${nombre}: la marca ${i + 1} («${m.texto}») no se ve en la captura`);
    salida.push({
      texto: m.texto,
      cajas: dentro.map((c) => ({ x: Math.round(c.x - zona.x), y: Math.round(c.y - zona.y), w: Math.round(c.width), h: Math.round(c.height) })),
    });
  }

  fs.mkdirSync(SALIDA, { recursive: true });
  await page.screenshot({ path: path.join(SALIDA, `${nombre}.jpg`), type: "jpeg", quality: 80, clip: zona });
  fs.writeFileSync(path.join(SALIDA, `${nombre}.json`), JSON.stringify({ ancho: zona.width, alto: zona.height, marcas: salida }, null, 2) + "\n");
}

async function velocidad(page: Page, v: "normal" | "rapida" | "turbo") {
  await page.evaluate((valor) => localStorage.setItem("folio:preferencias", JSON.stringify({ simSpeed: valor })), v);
  await page.reload();
}

/**
 * Lleva un elemento al centro de la vista (desplaza su contenedor y, si hace falta, la ventana).
 * Con `ajuste`, después desplaza ese contenedor unos píxeles más (negativo: hacia arriba).
 */
async function centrar(loc: Locator, bloque: ScrollLogicalPosition = "center", ajuste = 0) {
  await loc.evaluate(
    (el, [b, a]) => {
      el.scrollIntoView({ block: b as ScrollLogicalPosition, inline: "nearest" });
      if (!a) return;
      let p = el.parentElement;
      while (p && !(p.scrollHeight > p.clientHeight && /(auto|scroll)/.test(getComputedStyle(p).overflowY))) p = p.parentElement;
      (p ?? document.scrollingElement)?.scrollBy(0, Number(a));
    },
    [bloque, ajuste] as const,
  );
  await loc.page().waitForTimeout(300);
}

test("capturas de la guía @guia", async ({ page, context }) => {
  test.setTimeout(900_000);
  await entrar(page, "turbo");

  const decides = page.getByLabel("Lo que decides", { exact: true });
  const libro = page.getByLabel("Tu libro", { exact: true });
  const fases = page.getByRole("navigation", { name: "Proceso del ebook" });
  const fase = (n: number) => fases.locator("ol > li").nth(n);
  const cinta = page.locator(".cinta:visible").first();
  const hojaInicio = page.locator("section.hoja").first();
  const ideas = page.getByRole("group", { name: "Ideas para empezar" });

  // ------------------------------------------------------------------ RF-01
  await ideas.getByRole("button", { name: "Gestión del tiempo" }).click();
  await captura(page, "rf01-inicio", {
    region: hojaInicio,
    margen: 0,
    marcas: [
      { texto: "Los nichos de situaciones reales, como chips. Toca uno…", loc: ideas.getByRole("button") },
      { texto: "…y la caja se llena con una idea que puedes editar.", loc: page.locator("#idea") },
    ],
  });

  await page.locator("#idea").fill("Escribe una novela de dragones para adolescentes");
  await page.keyboard.press("Enter");
  const rechazo = page.getByText("Folio crea guías prácticas sobre situaciones reales.");
  await expect(rechazo).toBeVisible();
  await captura(page, "rf01-ficcion", {
    region: hojaInicio,
    margen: 0,
    marcas: [
      { texto: "Escribes una idea de ficción y la envías.", loc: page.locator("#idea") },
      { texto: "El libro no se crea: Folio explica que escribe guías prácticas sobre situaciones reales…", loc: rechazo },
      {
        texto: "…y propone tres alternativas de no ficción. Tocar una la pone en la caja.",
        loc: page.getByRole("button", { name: /Cómo escribir tu primera historia|Leer más y mejor|Organiza tu tiempo para escribir/ }),
      },
    ],
  });

  // ------------------------------------------------------------------ RF-02
  await ir(page, "");
  await ideas.getByRole("button", { name: "Gestión del tiempo" }).click();
  const pildora = page.getByRole("button", { name: /Capítulos: automático|\d capítulos/ });
  await pildora.click();
  await captura(page, "rf02-selector", {
    region: hojaInicio,
    margen: 0,
    marcas: [
      { texto: "La píldora “Capítulos” abre las opciones…", loc: pildora },
      { texto: "…y solo hay cuatro: 5, 6, 7 o automático. No se puede pedir otro número.", loc: page.getByRole("radio"), unir: true },
    ],
  });
  await page.getByRole("radio", { name: "5", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Proponer índice" }).click();
  await page.waitForURL(/\/ebook\/?\?id=/);
  await expect(page.getByRole("heading", { name: "Tu turno: revisa el índice" })).toBeVisible({ timeout: 90_000 });

  await captura(page, "rf02-minimo", {
    region: decides,
    margen: 0,
    marcas: [
      { texto: "El rango siempre a la vista: 5 capítulos, entre 5 y 7.", loc: page.getByText(/5 capítulos · entre 5 y 7/) },
      { texto: "Con 5, las papeleras están desactivadas: no se puede bajar del mínimo.", loc: page.getByRole("button", { name: /No se puede quitar/ }) },
      { texto: "“Agregar capítulo” sigue disponible hasta llegar a 7.", loc: page.getByRole("button", { name: "Agregar capítulo" }) },
    ],
  });
  await page.getByRole("button", { name: "Agregar capítulo" }).click();
  await page.getByRole("button", { name: "Agregar capítulo" }).click();
  const maximo = page.getByRole("button", { name: /7 capítulos · máximo alcanzado/ });
  await expect(maximo).toBeDisabled();
  await captura(page, "rf02-maximo", {
    region: decides,
    margen: 0,
    marcas: [
      { texto: "Ahora son 7 capítulos, el máximo.", loc: page.getByText(/7 capítulos · entre 5 y 7/) },
      { texto: "Las papeleras vuelven a funcionar: se puede quitar.", loc: page.getByRole("button", { name: /^Quitar/ }) },
      { texto: "El botón de agregar se desactiva y lo explica: “7 capítulos · máximo alcanzado”.", loc: maximo },
    ],
  });

  // ------------------------------------------------------------------ RF-05 y RÉR-02 (pausa 1)
  await crearEbook(page, { nicho: "Finanzas para universitarios" });
  const id = idActual(page);
  await captura(page, "rf05-pausa1", {
    region: "trabajo",
    marcas: [
      { texto: "Cae la cinta marcapáginas: es tu turno.", loc: cinta },
      { texto: "La fase activa es “Revisión del índice · Tú”.", loc: fase(1) },
      { texto: "Mientras no toques “Aprobar índice”, no se escribe nada.", loc: page.getByRole("button", { name: "Aprobar índice" }) },
    ],
  });

  const avisoLinea = page.getByText(/Incluirá un aviso legal porque el tema es financiero/);
  await page.getByRole("button", { name: "Ver el texto" }).click();
  await captura(page, "rer02-indice", {
    region: [avisoLinea, page.getByText(/No sustituye la asesoría de un profesional en finanzas/), page.getByRole("button", { name: "Agregar capítulo" })],
    margen: 36,
    marcas: [
      { texto: "Desde el índice avisa que el libro llevará aviso legal y por qué: el tema es financiero.", loc: avisoLinea },
      { texto: "“Ver el texto” muestra el aviso completo.", loc: page.getByText(/No sustituye la asesoría de un profesional en finanzas/).locator("..") },
    ],
  });
  await page.keyboard.press("Escape");
  await captura(page, "rer02-etiqueta", {
    region: libro,
    margen: 0,
    marcas: [{ texto: "En “Tu libro”, el orden ya incluye el aviso: Portada · Aviso legal · Índice.", loc: page.getByText("Portada · Aviso legal · Índice", { exact: true }) }],
  });

  await page.getByRole("link", { name: "Biblioteca" }).first().click();
  await expect(page.getByRole("heading", { name: "Biblioteca", exact: true })).toBeVisible();
  await captura(page, "rf05-biblioteca", {
    region: page.locator("main"),
    margen: 0,
    marcas: [
      { texto: "El libro que espera tu aprobación lleva la cinta en la portada…", loc: page.locator("a:has(.cinta)").first() },
      { texto: "…y el filtro “Tu turno” reúne todos los libros en pausa.", loc: page.getByLabel("Filtrar por estado").getByText(/Tu turno/) },
    ],
  });
  await ir(page, `ebook?id=${id}`);
  await expect(page.getByRole("heading", { name: "Tu turno: revisa el índice" })).toBeVisible();

  // ------------------------------------------------------------------ RF-05, RF-03, RNF-01 y RNF-03 (pausa 2)
  await page.getByRole("button", { name: "Aprobar índice" }).click();
  await expect(page.getByRole("heading", { name: "Tu turno: revisa el capítulo 1" })).toBeVisible({ timeout: 90_000 });
  await captura(page, "rf05-pausa2", {
    region: "trabajo",
    marcas: [
      { texto: "Otra vez la cinta: segunda pausa.", loc: cinta },
      { texto: "La fase activa es “Revisión del capítulo 1 · Tú”; los capítulos 2 en adelante esperan.", loc: fase(3) },
      { texto: "Solo al tocar “Aprobar y escribir el resto” se escribe lo demás.", loc: page.getByRole("button", { name: "Aprobar y escribir el resto" }) },
    ],
  });

  const hoja1 = page.getByRole("article", { name: /Capítulo 1/ });
  const secciones = hoja1.locator("section > h4");
  // "Tu libro" se desplaza por separado y queda al final del capítulo recién escrito.
  await centrar(secciones.nth(0), "start", -60);
  await captura(page, "rf03-estructura", {
    region: "trabajo",
    marcas: [
      { texto: "La lista “Estructura” marca las cinco secciones del capítulo, en orden.", loc: page.getByRole("list", { name: "Estructura del capítulo" }), unir: true },
      { texto: "En “Tu libro”, el capítulo empieza por la Introducción…", loc: secciones.nth(0) },
      { texto: "…y sigue con el Desarrollo.", loc: secciones.nth(1) },
    ],
  });
  await centrar(secciones.nth(2), "start");
  await captura(page, "rf03-final", {
    region: libro,
    margen: 0,
    marcas: [
      { texto: "Después vienen los Ejemplos cotidianos…", loc: secciones.nth(2) },
      { texto: "…la Conclusión…", loc: secciones.nth(3) },
      { texto: "…y el Ejercicio práctico, que prepara el Agente de Ejercicios.", loc: secciones.nth(4) },
    ],
  });
  await centrar(secciones.nth(0), "start");

  const ancla = page.getByText("Este capítulo marcará el tono y el formato de todo el libro.");
  const tituloPausa2 = page.getByRole("heading", { name: "Tu turno: revisa el capítulo 1" });
  await captura(page, "rnf03-ancla", {
    region: [tituloPausa2, ancla, page.getByRole("list", { name: "Estructura del capítulo" })],
    margen: 28,
    marcas: [{ texto: "La pausa 2 avisa que este capítulo será la referencia de tono y formato para todo el libro.", loc: ancla.locator("..") }],
  });

  await page.getByRole("button", { name: "Más cercano" }).click();
  await captura(page, "rnf01-ajustes", {
    region: [page.getByText("¿Qué ajustamos?"), page.getByRole("button", { name: "Aprobar y escribir el resto" })],
    margen: 28,
    marcas: [
      {
        texto: "Cinco ajustes de un toque; aquí está elegido “Más cercano”.",
        loc: page.getByRole("button", { name: /^(Más cercano|Más ejemplos|Más corto|Menos formal|Otro tipo de ejercicio)$/ }),
        unir: true,
      },
      { texto: "Un campo libre para pedir otro cambio con tus palabras.", loc: page.getByPlaceholder(/Algo más que quieras ajustar/) },
      { texto: "“Aplicar ajustes” genera una versión nueva del capítulo.", loc: page.getByRole("button", { name: "Aplicar ajustes" }) },
    ],
  });
  await page.getByRole("button", { name: "Aplicar ajustes" }).click();
  await expect(page.getByText(/^Versión 2 ·/)).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole("heading", { name: "Tu turno: revisa el capítulo 1" })).toBeVisible();
  await captura(page, "rnf01-version2", {
    region: "trabajo",
    marcas: [
      { texto: "Ahora es la versión 2.", loc: page.getByText(/^Versión 2 ·/) },
      { texto: "El texto cambió: la introducción empieza con “Te lo digo claro”, más cercano.", loc: hoja1.getByText(/^Te lo digo claro/) },
      { texto: "Siempre puedes volver a la versión anterior.", loc: page.getByText("Volver a la versión anterior", { exact: true }) },
    ],
  });

  // ------------------------------------------------------------------ RNF-03 y RNF-02 (redacción del resto, velocidad normal)
  await velocidad(page, "normal");
  await expect(page.getByRole("heading", { name: "Tu turno: revisa el capítulo 1" })).toBeVisible();
  await page.getByRole("button", { name: "Aprobar y escribir el resto" }).click();
  await expect(page.getByRole("heading", { name: "Escribiendo tu libro" })).toBeVisible();
  const avance = page.getByRole("list", { name: "Avance por capítulo" }).getByRole("listitem");
  await expect(avance.filter({ hasText: "Escribiendo" })).toHaveCount(1, { timeout: 30_000 });
  await page.waitForTimeout(3500);
  await captura(page, "rnf03-orden", {
    region: decides,
    margen: 0,
    marcas: [
      { texto: "Solo un capítulo se escribe a la vez…", loc: avance.filter({ hasText: "Escribiendo" }) },
      { texto: "…los demás esperan su turno.", loc: avance.filter({ hasText: "En espera" }), unir: true },
      { texto: "El recordatorio: cada capítulo sigue el tono y el formato del capítulo 1.", loc: page.getByText("Cada capítulo sigue el tono y el formato del capítulo 1 que aprobaste.") },
    ],
  });
  // «Leer ahora» aparece cuando termina el capítulo 2.
  await expect(page.getByRole("button", { name: /Leer ahora/ }).first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2500);
  await captura(page, "rnf02-resto", {
    region: decides,
    margen: 0,
    marcas: [
      { texto: "Qué capítulo va y cuánto falta, aproximadamente.", loc: page.getByText(/Capítulo \d de \d · falta/) },
      { texto: "El avance del capítulo en curso, sección por sección.", loc: avance.filter({ hasText: "Escribiendo" }) },
      { texto: "“Leer ahora”: los capítulos terminados se pueden leer mientras se escriben los demás.", loc: page.getByRole("button", { name: /Leer ahora/ }).first() },
    ],
  });
  await velocidad(page, "turbo");
  await expect(page.getByText("Tu ebook está listo", { exact: true })).toBeVisible({ timeout: 180_000 });

  // ------------------------------------------------------------------ RNF-04 (fases)
  await captura(page, "rnf04-fases", {
    region: fases,
    margen: 14,
    marcas: [
      { texto: "Agente Investigador: propone el índice.", loc: fase(0) },
      { texto: "Tú: las dos pausas de aprobación.", loc: fase(1).or(fase(3)) },
      { texto: "Agente Redactor y Agente de Ejercicios: escriben los capítulos.", loc: fase(2).or(fase(4)) },
      { texto: "Agente Maquetador: arma el libro final.", loc: fase(5) },
    ],
  });

  // ------------------------------------------------------------------ RF-04, RÉR-02, RÉR-03 y RA-02 (libro listo)
  const vista = page.getByLabel("Vista previa del libro");
  const seccionLibro = (titulo: string, n: number) => vista.locator(`section:has(> h4:text-is("${titulo}"))`).nth(n);

  const ejercicio1 = seccionLibro("Ejercicio práctico", 0).locator("div.rounded-lg").first();
  const titulo1 = (await ejercicio1.locator("p").first().textContent())?.trim();
  await centrar(ejercicio1);
  await captura(page, "rf04-cap1", {
    region: libro,
    margen: 0,
    marcas: [{ texto: `Final del capítulo 1: “${titulo1}”, con pasos concretos.`, loc: ejercicio1 }],
  });
  const ejercicio2 = seccionLibro("Ejercicio práctico", 1).locator("div.rounded-lg").first();
  const titulo2 = (await ejercicio2.locator("p").first().textContent())?.trim();
  await centrar(ejercicio2);
  await captura(page, "rf04-cap2", {
    region: libro,
    margen: 0,
    marcas: [{ texto: `Final del capítulo 2: “${titulo2}”, una lista para marcar.`, loc: ejercicio2 }],
  });

  const persona = async (n: number) => (await seccionLibro("Ejemplos cotidianos", n).locator("p").first().textContent())?.trim().split(" ")[0];
  for (const n of [0, 1]) {
    const ejemplos = seccionLibro("Ejemplos cotidianos", n);
    await centrar(ejemplos);
    await captura(page, `rer03-cap${n + 1}`, {
      region: libro,
      margen: 0,
      marcas: [{ texto: `Ejemplo del capítulo ${n + 1}: ${await persona(n)}, con un contexto concreto y una solución responsable.`, loc: ejemplos }],
    });
  }

  const intro = seccionLibro("Introducción", 0);
  await centrar(intro, "start");
  await captura(page, "ra02-lectura", {
    region: libro,
    margen: 0,
    marcas: [{ texto: "Frases cortas, de tú a tú y sin tecnicismos: sobre este texto se calcula la legibilidad.", loc: intro }],
  });

  const avisoPagina = vista.getByText("Aviso legal", { exact: true }).first();
  await centrar(avisoPagina);
  await captura(page, "rer02-libro", {
    region: libro,
    margen: 0,
    marcas: [{ texto: "En el libro, el aviso va justo después de la portada y antes del índice.", loc: avisoPagina.locator("..") }],
  });

  // ------------------------------------------------------------------ RF-06 y RÉR-01 (exportar)
  await page.evaluate(() => window.scrollTo(0, 0));
  await captura(page, "rf06-boton", {
    region: { x: 68, y: 0, width: VENTANA.width - 68, height: 112 },
    marcas: [
      { texto: "Cuando el libro está listo, lo dice aquí…", loc: page.getByText(/^Listo · \d capítulos/) },
      { texto: "…y aparece el botón “Exportar”.", loc: page.getByRole("button", { name: "Exportar" }) },
    ],
  });
  await page.getByRole("button", { name: "Exportar" }).click();
  const dialogo = page.getByRole("dialog", { name: "Exportar tu ebook" });
  await expect(dialogo).toBeVisible();
  await captura(page, "rf06-dialogo", {
    region: dialogo,
    margen: 24,
    marcas: [
      { texto: "Eliges el formato: PDF o Markdown.", loc: dialogo.getByRole("radio"), unir: true },
      { texto: "El nombre del archivo, que puedes cambiar.", loc: dialogo.getByLabel("Nombre del archivo") },
      { texto: "Un resumen: capítulos, páginas, aviso legal, tamaño de página y letra.", loc: dialogo.getByLabel("Resumen del archivo"), unir: true },
      { texto: "Y descargas.", loc: dialogo.getByRole("button", { name: /^Descargar/ }) },
    ],
  });
  await captura(page, "rer01-nota", {
    region: dialogo,
    margen: 24,
    marcas: [{ texto: "La nota de transparencia: “Contenido original generado con asistencia de IA”.", loc: dialogo.getByText("Contenido original generado con asistencia de IA.") }],
  });
  await page.keyboard.press("Escape");

  const impresion = await context.newPage();
  await impresion.addInitScript(() => {
    window.print = () => {};
  });
  await ir(impresion, `imprimir/?id=${id}`);
  await expect(impresion.getByRole("heading", { name: "Índice" })).toBeVisible();
  await captura(impresion, "rf06-impresion", {
    region: "pantalla",
    marcas: [
      { texto: "Tocas “Imprimir o guardar PDF”…", loc: impresion.getByRole("button", { name: /Imprimir o guardar PDF/ }) },
      { texto: "…y en el diálogo del navegador eliges “Guardar como PDF”.", loc: impresion.getByText(/elige «Guardar como PDF»/) },
      { texto: "El libro ya viene maquetado con el tamaño de página elegido, empezando por la portada.", loc: impresion.locator(".portada").first() },
    ],
  });
  const h1Cap = impresion.getByRole("heading", { level: 1 }).nth(1);
  await h1Cap.evaluate((el) => el.scrollIntoView({ block: "start" }));
  await impresion.evaluate(() => window.scrollBy(0, -60));
  await captura(impresion, "ra01-pdf", {
    region: "pantalla",
    marcas: [
      { texto: "H1: el título de cada capítulo.", loc: h1Cap },
      { texto: "H2: cada sección (Introducción, Desarrollo…).", loc: impresion.getByRole("heading", { level: 2, name: "Introducción" }).first() },
      { texto: "H3: los subtemas dentro del Desarrollo.", loc: impresion.getByRole("heading", { level: 3 }).first() },
    ],
  });
  await impresion.close();

  // ------------------------------------------------------------------ RF-03, RA-01 y RÉR-02 (editor)
  await page.getByRole("tab", { name: "Texto" }).click();
  await captura(page, "rf03-editor", {
    region: decides,
    margen: 0,
    marcas: [
      { texto: "En “Texto”, cada sección tiene su nombre fijo con candado: cambias el contenido, no la estructura.", loc: decides.getByText(/^(Introducción|Desarrollo)$/) },
    ],
  });
  const introEditor = page.getByRole("textbox", { name: "Introducción del capítulo 1" });
  await introEditor.click();
  await introEditor.press("Control+End");
  await introEditor.pressSequentially("\n\n# Un título manual");
  await expect(introEditor).toHaveValue(/### Un título manual/);
  await captura(page, "ra01-editor", {
    region: [page.getByLabel("Formato del texto"), introEditor],
    margen: 28,
    marcas: [
      { texto: "La barra de formato solo ofrece subtítulo H3 (más negrita, cursiva, lista y cita).", loc: page.getByLabel("Formato del texto"), unir: true },
      { texto: "El consejo recuerda que ### es un subtítulo.", loc: page.getByText(/^Consejo: una línea que empieza con ###/) },
      { texto: "Escribiste “# Un título manual” y quedó “### Un título manual”: no rompe la jerarquía.", loc: introEditor },
    ],
  });

  await page.getByLabel("Capítulo que quieres editar").selectOption({ label: "Aviso legal" });
  await captura(page, "rer02-editor", {
    region: [page.getByLabel("Capítulo que quieres editar"), page.getByText(/no se puede quitar \(RÉR-02\)/)],
    margen: 32,
    marcas: [
      { texto: "En el selector eliges “Aviso legal”…", loc: page.getByLabel("Capítulo que quieres editar") },
      { texto: "…y aparece con candado: se incluye solo y no se puede quitar.", loc: page.getByText(/no se puede quitar \(RÉR-02\)/).locator("..") },
    ],
  });

  // ------------------------------------------------------------------ RA-03 (portada y estilo)
  await page.getByRole("tab", { name: "Portada y estilo" }).click();
  await page.getByRole("tab", { name: "Interior" }).click();
  const tamPagina = page.getByRole("radiogroup", { name: "Tamaño de página" });
  await centrar(tamPagina);
  await captura(page, "ra03-opciones", {
    region: [page.getByRole("radiogroup", { name: "Letra del cuerpo" }), page.getByRole("radiogroup", { name: "Tamaño del cuerpo" }), tamPagina],
    margen: 44,
    marcas: [
      { texto: "Letra del cuerpo: solo Roboto, Arial o Helvetica.", loc: page.getByRole("radiogroup", { name: "Letra del cuerpo" }), unir: true },
      { texto: "Tamaño del cuerpo: 11, 12 o 13 pt. No existe una opción menor de 11.", loc: page.getByRole("radiogroup", { name: "Tamaño del cuerpo" }), unir: true },
      { texto: "Tamaño de página: A5, A4, Carta o 6 × 9 in.", loc: tamPagina, unir: true },
    ],
  });
  await page.getByRole("tab", { name: "Portada", exact: true }).click();
  await page.locator('input[type="color"]').fill("#f5d76e");
  const advertencia = page.getByText(/El texto blanco no se leería bien/);
  await expect(advertencia).toBeVisible();
  await centrar(advertencia);
  const colorTela = page.getByText("Color de tela", { exact: true });
  await captura(page, "ra03-aviso", {
    region: [colorTela, advertencia, libro.locator(".portada").first()],
    margen: 22,
    marcas: [
      { texto: "Con un amarillo claro, el indicador marca “Contraste 1,4:1”…", loc: page.getByText(/^Contraste \d/) },
      { texto: "…Folio avisa que el texto blanco no se leería bien (mínimo 4,5:1)…", loc: advertencia },
      { texto: "…y ofrece “Usar el tono accesible”.", loc: page.getByRole("button", { name: "Usar el tono accesible" }) },
    ],
  });
  await page.getByRole("button", { name: "Usar el tono accesible" }).click();
  await expect(advertencia).toHaveCount(0);
  await captura(page, "ra03-corregido", {
    region: [colorTela, libro.locator(".portada").first()],
    margen: 22,
    marcas: [
      { texto: "El color se oscurece hasta cumplir: el indicador pasa a verde.", loc: page.getByText(/^Contraste \d/) },
      { texto: "La portada se actualiza al instante con el tono accesible.", loc: libro.locator(".portada").first() },
    ],
  });

  // ------------------------------------------------------------------ Ajustes: RF-04, RNF-02 y RA-03 (tema oscuro)
  await ir(page, "ajustes");
  const seccion = (titulo: string) => page.locator("section", { has: page.getByRole("heading", { name: titulo, exact: true }) });
  await centrar(seccion("Preferencias"));
  await captura(page, "rf04-ajustes", {
    region: seccion("Preferencias"),
    marcas: [
      { texto: "“Ejercicio preferido”: que decida Folio (alterna), solo checklist o solo reto de 24-48 h.", loc: page.getByRole("radiogroup", { name: "Ejercicio preferido" }), unir: true },
    ],
  });
  await page.getByRole("radiogroup", { name: "Velocidad de los agentes" }).getByRole("radio", { name: "Rápida" }).click();
  await centrar(seccion("Demostración"));
  await captura(page, "rnf02-velocidad", {
    region: seccion("Demostración"),
    marcas: [
      { texto: "Velocidad de los agentes: Normal para medir tiempos; Rápida para demostrar.", loc: page.getByRole("radiogroup", { name: "Velocidad de los agentes" }), unir: true },
      { texto: "Simular un error: el capítulo 4 falla una vez, para probar “Reintentar”.", loc: page.getByLabel("Simular un error") },
      { texto: "Restaurar ejemplos: vuelve a cargar la biblioteca de demostración.", loc: page.getByRole("button", { name: "Restaurar ejemplos" }) },
    ],
  });
  await page.getByRole("radiogroup", { name: "Tema" }).getByRole("radio", { name: "Oscuro" }).click();
  await ir(page, `ebook?id=${id}`);
  await expect(page.getByRole("tab", { name: "Texto" })).toBeVisible();
  // La vista previa se desplaza sola al capítulo elegido; se vuelve a la primera hoja.
  await page.waitForTimeout(800);
  await centrar(vista.locator(".hoja-libro").first(), "start");
  const appOscura = page.getByRole("tablist", { name: "Revisión final" }).or(page.getByRole("textbox", { name: "Introducción del capítulo 1" }));
  const hojaBlanca = vista.locator(".hoja-libro").first();
  await captura(page, "ra03-oscuro", {
    region: [appOscura, hojaBlanca],
    margen: 64,
    marcas: [
      { texto: "Con el tema oscuro cambia la app…", loc: appOscura, unir: true },
      { texto: "…pero la hoja del libro sigue blanca, como saldrá en el PDF.", loc: hojaBlanca },
    ],
  });
  await ir(page, "ajustes");
  await page.getByRole("radiogroup", { name: "Tema" }).getByRole("radio", { name: "Claro" }).click();

  // ------------------------------------------------------------------ RNF-02 y RNF-04 (capítulo 1 en vivo, velocidad normal)
  await velocidad(page, "normal");
  await crearEbook(page, { nicho: "Hábitos y rutinas" });
  await page.getByRole("button", { name: "Aprobar índice" }).click();
  await expect(page.getByRole("heading", { name: "Escribiendo el capítulo 1" })).toBeVisible();
  await page.waitForTimeout(1800);
  await captura(page, "rnf02-cap1", {
    region: "trabajo",
    marcas: [
      { texto: "“Suele tardar menos de un minuto”: lo avisa desde el principio.", loc: page.getByText(/Suele tardar menos de un minuto/) },
      { texto: "Las secciones se marcan a medida que el Redactor avanza.", loc: page.getByRole("list", { name: "Secciones del capítulo" }), unir: true },
      { texto: "El texto aparece en vivo: esta es la línea que se está escribiendo, con el cursor al final.", loc: libro.locator(":has(> .cursor-tinta)").first() },
    ],
  });
  const actividad = page.getByLabel("Actividad de los agentes").getByRole("listitem");
  await captura(page, "rnf04-bitacora", {
    region: page.getByLabel("Actividad de los agentes"),
    margen: 28,
    marcas: [
      { texto: "Cada línea dice qué agente trabajó y qué hizo: aquí, el Investigador (el índice y las lecturas sugeridas)…", loc: actividad.filter({ hasText: "Investigador" }) },
      { texto: "…y ahora el Redactor, escribiendo el capítulo 1.", loc: actividad.filter({ hasText: "Redactor" }) },
    ],
  });

  // ------------------------------------------------------------------ RÉR-02: tema emocional y tema sin aviso
  await velocidad(page, "turbo");
  await crearEbook(page, { idea: "Cómo manejar la ansiedad y el estrés antes de un examen importante" });
  await captura(page, "rer02-emocional", {
    region: [page.getByRole("button", { name: "Agregar capítulo" }), page.getByRole("button", { name: "Aprobar índice" })],
    margen: 36,
    marcas: [{ texto: "Con un tema de ansiedad, el aviso es otro: “el tema toca la salud emocional”.", loc: page.getByText(/Incluirá un aviso legal porque el tema toca la salud emocional/) }],
  });
  await ir(page, "biblioteca");
  await page.getByRole("link", { name: /Semanas que rinden/ }).first().click();
  await expect(page.getByRole("heading", { name: "Tu turno: revisa el índice" })).toBeVisible();
  await centrar(page.getByRole("button", { name: "Aprobar índice" }));
  await captura(page, "rer02-sinaviso", {
    region: "trabajo",
    marcas: [
      {
        texto: "Gestión del tiempo no es un tema sensible: entre “Agregar capítulo” y los botones no aparece la línea del aviso…",
        loc: page.getByRole("button", { name: "Agregar capítulo" }).or(page.getByRole("button", { name: "Aprobar índice" })),
        unir: true,
      },
      { texto: "…y el libro va de la portada directo al índice: “Portada · Índice”.", loc: page.getByText("Portada · Índice", { exact: true }) },
    ],
  });
});

// Funciones añadidas en la fase 4, sobre el libro de ejemplo "Ahorra sin dejar de
// vivir". Crossref y Open Library se simulan (utils.simularFuentes, dentro de entrar).
test("capturas de la guía: funciones de la fase 4 @guia", async ({ page }) => {
  test.setTimeout(300_000);
  await entrar(page, "turbo");

  const libro = page.getByLabel("Tu libro", { exact: true });
  const portada = libro.locator(".portada").first();
  const contraste = (texto: string) => Number(texto.match(/(\d+,\d+):1/)?.[1].replace(",", "."));

  await ir(page, "biblioteca/");
  await page.getByRole("link", { name: /Ahorra sin dejar de vivir/ }).first().click();
  await page.waitForURL(/\/ebook\/?\?id=/);
  await expect(page.getByRole("tab", { name: "Portada y estilo" })).toBeVisible();

  // ------------------------------------------------------------------ RD-04 · Portada
  await page.getByRole("tab", { name: "Portada y estilo" }).click();
  const vistas = page.getByRole("tablist", { name: "Qué quieres diseñar" });
  const plantillas = page.getByRole("radiogroup", { name: "Plantilla de portada" });
  const letra = page.getByRole("radiogroup", { name: "Letra del título" });
  const tamano = page.getByRole("radiogroup", { name: "Tamaño del título" });
  const alineacion = page.getByRole("radiogroup", { name: "Alineación del título" });
  await plantillas.getByRole("radio", { name: "Marco", exact: true }).click();
  await letra.getByRole("radio", { name: "Onest" }).click();
  await tamano.getByRole("radio", { name: "Grande" }).click();
  // Las opciones del título al pie de la página izquierda, para que también se vean las plantillas.
  await centrar(alineacion, "end", 40);
  await captura(page, "rd04-plantillas", {
    region: [plantillas, alineacion, portada],
    margen: 22,
    marcas: [
      { texto: "Cinco plantillas: Clásica, Centrada, Franja, Marco y Editorial. Aquí está elegida Marco.", loc: plantillas },
      { texto: "Letra del título: Lexend, Onest o Roboto.", loc: letra },
      { texto: "Tamaño: pequeño, mediano o grande.", loc: tamano },
      { texto: "Alineación: a la izquierda o centrada. Cada plantilla propone una y puedes cambiarla.", loc: alineacion },
      { texto: "La portada cambia al instante: Marco, Onest y tamaño grande.", loc: portada },
    ],
  });

  await page.locator('input[type="file"]').setInputFiles(IMAGEN_CLARA);
  await expect(page.getByText("Imagen de portada")).toBeVisible();
  const velo = page.getByRole("slider", { name: /Velo de color/ });
  const insignia = page.getByText(/^Contraste \d+,\d:1$/).last();
  await expect.poll(async () => contraste(await insignia.innerText())).toBeGreaterThanOrEqual(4.5);
  const colocacion = page.getByRole("radiogroup", { name: "Cómo se coloca la imagen" });
  const minimo = page.getByText(/^No baja de \d+ %/);
  await centrar(velo);
  const veloActual = (await velo.getAttribute("aria-valuetext")) ?? "";
  const contrasteActual = (await insignia.innerText()).replace("Contraste ", "");
  await captura(page, "rd04-velo", {
    region: [page.getByText("Imagen de portada", { exact: true }), minimo, portada],
    margen: 18,
    marcas: [
      { texto: "La imagen queda de fondo. También puede ir en recuadro.", loc: colocacion },
      { texto: `El velo: Folio lo calculó para esta imagen (${veloActual}) y el control no deja bajar de ahí.`, loc: velo.or(minimo), unir: true },
      { texto: `Con ese velo, el título blanco tiene un contraste de ${contrasteActual}: cumple el mínimo de 4,5:1.`, loc: insignia },
      { texto: "La portada con la imagen bajo el velo de la tela.", loc: portada },
    ],
  });

  await colocacion.getByRole("radio", { name: "En recuadro" }).click();
  const alternativo = page.getByLabel("Texto alternativo");
  await alternativo.fill("Formas de colores sobre un fondo claro");
  await centrar(alternativo);
  await captura(page, "rd04-recuadro", {
    region: [colocacion, alternativo, portada],
    margen: 18,
    marcas: [
      { texto: "“En recuadro”: la imagen va sobre la tela, sin velo, y el título queda sobre el color liso.", loc: colocacion },
      { texto: "El texto alternativo describe la imagen para quien usa lector de pantalla.", loc: alternativo },
      { texto: "La portada con la imagen en recuadro.", loc: portada },
    ],
  });

  await vistas.getByRole("tab", { name: "Contraportada" }).click();
  const sinopsis = page.getByLabel("Sinopsis");
  const sinopsisAntes = await sinopsis.inputValue();
  const otraSinopsis = page.getByRole("button", { name: "Pedir otra sinopsis" });
  await otraSinopsis.click();
  await expect(sinopsis).not.toHaveValue(sinopsisAntes);
  await captura(page, "rd04-contraportada", {
    region: [vistas, otraSinopsis, libro.locator(".portada-trasera").first()],
    margen: 26,
    marcas: [
      { texto: "Tres vistas, cada una con su vista previa a la derecha: Portada, Contraportada e Interior.", loc: vistas },
      { texto: "“Incluir contraportada”: cierra el PDF con el color de tela.", loc: page.getByRole("switch", { name: "Incluir contraportada" }) },
      {
        texto: "La sinopsis que propone el Maquetador: la puedes editar, y debajo ves cuántas palabras lleva.",
        loc: sinopsis.or(page.getByText(/palabras · lo ideal son de 60 a 110/)),
        unir: true,
      },
      { texto: "“Pedir otra sinopsis” le pide una nueva al Maquetador.", loc: page.getByRole("button", { name: "Pedir otra sinopsis" }) },
      { texto: "A la derecha, la contraportada: es la última página del PDF.", loc: libro.locator(".portada-trasera").first() },
    ],
  });

  // ------------------------------------------------------------------ RD-09 · Referencias
  await page.getByRole("tab", { name: /Referencias/ }).click();
  const lista = page.getByRole("list", { name: "Referencias del libro" });
  await expect(lista.getByText(/Verificada en Open Library/)).toHaveCount(3);
  const primera = lista.getByRole("listitem").first();
  const [, autor, anio] = (await primera.locator("p.font-book").innerText()).trim().match(/^([^,]+),.*?\((\d{4}|s\. f\.)\)/) ?? [];
  const resumenRefs = page.getByText(/^\d+ referencias? · \d+ verificadas?/);
  const hojaRefs = libro.locator('[data-hoja="referencias"]');
  await captura(page, "rd09-lista", {
    region: [resumenRefs, primera, hojaRefs],
    margen: 22,
    marcas: [
      { texto: "El resumen: cuántas referencias hay y cuántas se verificaron.", loc: resumenRefs },
      { texto: "Cada una dice si se verificó, dónde, y si la sugirió el Investigador o la agregaste tú.", loc: primera.getByText(/sugerida por el Investigador/).locator("..") },
      { texto: "La referencia ya en APA 7, con el motivo por el que te sirve.", loc: primera.locator("p.font-book, p.font-book + p"), unir: true },
      { texto: `“Copiar cita” copia “(${autor}, ${anio})” para pegarla donde uses la idea.`, loc: primera.getByRole("button", { name: "Copiar cita" }) },
      { texto: "En “Tu libro”, las referencias van al final, en su propia página.", loc: hojaRefs },
    ],
  });

  const buscador = page.getByRole("search");
  await page.getByPlaceholder("Título, autor, DOI o ISBN").fill("https://doi.org/10.1177/1529100612453266");
  await page.getByRole("button", { name: "Buscar" }).click();
  const resultados = page.getByRole("list", { name: "Resultados de la búsqueda" });
  await expect(resultados).toContainText("Dunlosky");
  await captura(page, "rd09-doi", {
    region: [buscador, resultados],
    margen: 28,
    marcas: [
      { texto: "Pegas el DOI, o el enlace de doi.org, y tocas “Buscar”.", loc: buscador },
      { texto: "Crossref devuelve la obra y Folio la muestra ya en APA 7. “Agregar” la suma a tu lista.", loc: resultados.getByRole("listitem") },
    ],
  });
  await resultados.getByRole("button", { name: "Agregar" }).click();
  await expect(lista.getByText("Verificada en Crossref")).toBeVisible();

  await page.getByRole("button", { name: "Escríbela a mano" }).click();
  const formulario = page.locator("form").filter({ hasText: "Nueva referencia" });
  await formulario.getByLabel("Autores").fill("Pérez, Ana");
  await formulario.getByLabel("Título").fill("Un libro inventado sobre ahorro");
  await formulario.getByLabel("Año").fill("2021");
  await formulario.getByLabel("Editorial").fill("Editorial Imaginaria");
  await formulario.getByRole("button", { name: "Guardar referencia" }).click();
  const inventada = lista.getByRole("listitem").filter({ hasText: "Un libro inventado sobre ahorro" });
  await expect(inventada.getByText("No la encontramos")).toBeVisible();
  await centrar(inventada);
  await captura(page, "rd09-inventada", {
    region: inventada,
    margen: 24,
    marcas: [
      { texto: "No aparece en Crossref ni en Open Library: queda como “No la encontramos”.", loc: inventada.getByText("No la encontramos") },
      { texto: "Folio dice qué hacer: revisarla o quitarla antes de publicar.", loc: inventada.getByText(/^No aparece en Crossref ni en Open Library/) },
      {
        texto: "Como cualquier otra, puedes copiar la cita, editarla, volver a comprobarla o quitarla.",
        loc: inventada.getByRole("button", { name: /^(Copiar cita|Editar|Comprobar|Quitar referencia)$/ }),
        unir: true,
      },
    ],
  });

  await page.getByRole("button", { name: "Exportar" }).click();
  const dialogo = page.getByRole("dialog", { name: "Exportar tu ebook" });
  const aviso = dialogo.getByText(/Una referencia no se encontró/);
  await expect(aviso).toBeVisible();
  await captura(page, "rd09-exportar", {
    region: dialogo,
    margen: 24,
    marcas: [
      { texto: "El resumen cuenta las referencias que irán al final del libro, en APA 7.", loc: dialogo.getByText(/referencias? en APA 7/) },
      { texto: "Si una no se encontró, lo avisa antes de descargar, y “Revisarlas” te lleva a la pestaña Referencias.", loc: aviso },
    ],
  });
  await page.keyboard.press("Escape");
});
