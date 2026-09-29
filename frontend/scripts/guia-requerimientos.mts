/**
 * Genera la guía en PDF «Cómo se cumple cada requerimiento» en docs/guia/.
 *
 *   npm run guia:capturas   (recorre la app y toma las capturas señaladas)
 *   npm run guia:pdf
 *
 * Toma los resultados de docs/verificacion/ y busca las líneas de código en el
 * momento de generarla, así que la guía siempre coincide con el repositorio.
 * Usa Microsoft Edge (o el Chromium de Playwright) y las fuentes de Google Fonts.
 * Se imprime dos veces: la primera sirve para leer en qué página cae cada sección
 * y la segunda escribe esos números en el índice.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium, type Browser } from "@playwright/test";
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFRef, PDFString, type PDFObject } from "pdf-lib";
import QRCode from "qrcode";

const FRONTEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAIZ = path.resolve(FRONTEND, "..");
const VERIF = path.join(RAIZ, "docs", "verificacion");
const SALIDA = path.join(RAIZ, "docs", "guia");
const HTML = path.join(SALIDA, "guia-requerimientos.html");
const PDF = path.join(SALIDA, "Folio-guia-de-requerimientos.pdf");
const SITIO = "https://franjmd0508.github.io/multiagente-inteligente-ebooks/";
const REPO = "https://github.com/FranJMD0508/multiagente-inteligente-ebooks";

// ---------------------------------------------------------------------------
// Datos medidos por las pruebas (docs/verificacion)
// ---------------------------------------------------------------------------

function leerJson<T>(nombre: string): T {
  return JSON.parse(fs.readFileSync(path.join(VERIF, nombre), "utf8")) as T;
}

const legibilidad = leerJson<{ valor: number; nivel: string; palabras: number; frases: number; silabasPorPalabra: number; palabrasPorFrase: number }>(
  "RA-02-legibilidad.json",
);
const estilosPdf = leerJson<{ tamano: string; familia: string; color: string; fondo: string }>("RA-03-estilos-pdf.json");
const personas = leerJson<{ nombres: string[]; mujeres: number; hombres: number }>("RER-03-personas.json");
const ejercicios = leerJson<string[]>("RF-04-ejercicios.json");
const tiempo = leerJson<{ capitulo1Segundos: number }>("RNF-02-tiempo.json");
const encabezados = leerJson<{ markdown: string[]; pdf: string[] }>("RA-01-encabezados.json");
const markdownEjemplo = fs.readFileSync(path.join(VERIF, "ebook-ejemplo.md"), "utf8").split(/\r?\n/);

const num = (n: number, decimales = 1) => n.toLocaleString("es-ES", { maximumFractionDigits: decimales });
const miles = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

function rgb(color: string): [number, number, number] {
  const [r, g, b] = (color.match(/\d+/g) ?? ["0", "0", "0"]).map(Number);
  return [r, g, b];
}
function luminancia([r, g, b]: [number, number, number]) {
  const canal = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}
function hex([r, g, b]: [number, number, number]) {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}

const md = {
  h1: encabezados.markdown.filter((l) => l.startsWith("# ")).length,
  h2: encabezados.markdown.filter((l) => l.startsWith("## ")).length,
  h3: encabezados.markdown.filter((l) => l.startsWith("### ")).length,
  listas: markdownEjemplo.filter((l) => /^\s*([-*]|\d+\.) /.test(l)).length,
  checklist: markdownEjemplo.filter((l) => /^\s*- \[ \] /.test(l)).length,
  citas: markdownEjemplo.filter((l) => l.startsWith("> ")).length,
};
const colorTexto = rgb(estilosPdf.color);
const contrasteCuerpo = (luminancia([255, 255, 255]) + 0.05) / (luminancia(colorTexto) + 0.05);
const cuerpoPx = parseFloat(estilosPdf.tamano);
const segundos = num(tiempo.capitulo1Segundos);
const etiquetaEjercicio = (e: string) => (e.startsWith("reto") ? `Reto ${e.replace("reto ", "").replace("h", " h")}` : "Checklist");

// Personas de los ejemplos (content.ts alterna mujer y hombre).
const PERSONAS = [...fs.readFileSync(path.join(FRONTEND, "src/lib/api/mock/content.ts"), "utf8").matchAll(/\{ name: "([^"]+)", context: "([^"]+)"/g)].map(
  (m, i) => ({ nombre: m[1], contexto: m[2], mujer: i % 2 === 0 }),
);

// ---------------------------------------------------------------------------
// Referencias al código: la línea se busca al generar la guía
// ---------------------------------------------------------------------------

interface Ref {
  archivo: string;
  buscar: string;
  desc: string;
}

const lineasCitadas: string[] = [];
function linea(archivo: string, buscar: string): number {
  const lineas = fs.readFileSync(path.join(FRONTEND, archivo), "utf8").split(/\r?\n/);
  const i = lineas.findIndex((l) => l.includes(buscar));
  if (i < 0) throw new Error(`No encontré «${buscar}» en ${archivo}`);
  lineasCitadas.push(`${archivo}:${i + 1}  ${lineas[i].trim().slice(0, 90)}`);
  return i + 1;
}

// ---------------------------------------------------------------------------
// Contenido
// ---------------------------------------------------------------------------

type Estado = "cumple" | "interfaz" | "pendiente";
type ClaveParte = "rf" | "rnf" | "ra" | "rer";

const ESTADOS: Record<Estado, { etiqueta: string; texto: string }> = {
  cumple: { etiqueta: "Cumple", texto: "Funciona hoy en el sistema y lo comprueba una prueba automática." },
  interfaz: {
    etiqueta: "Cumple en la interfaz",
    texto: "La interfaz ya lo soporta y la prueba pasa con el contenido simulado. El resultado final depende de la IA real, que llega en la fase 4.",
  },
  pendiente: {
    etiqueta: "Pendiente · fase 4",
    texto: "Está diseñado y se ve en la interfaz, pero la pieza principal es el backend, que se construye en la fase 4.",
  },
};

interface Parte {
  clave: ClaveParte;
  numero: string;
  nombre: string;
  /** Título del divisor en dos líneas (el espacio va al final de la primera). */
  lineas: [string, string];
  corto: string;
  singular: string;
  tela: string;
  desc: string;
}

const PARTES: Parte[] = [
  {
    clave: "rf",
    numero: "Parte I",
    nombre: "Requerimientos funcionales",
    lineas: ["Requerimientos ", "funcionales"],
    corto: "Funcionales",
    singular: "Requerimiento funcional",
    tela: "#2F6B58",
    desc: "Lo que Folio hace: las funciones que ves y tocas, desde elegir el tema hasta descargar el libro.",
  },
  {
    clave: "rnf",
    numero: "Parte II",
    nombre: "Requerimientos no funcionales",
    lineas: ["Requerimientos ", "no funcionales"],
    corto: "No funcionales",
    singular: "Requerimiento no funcional",
    tela: "#3B4A9E",
    desc: "Cómo lo hace: el tono del texto, la velocidad, la coherencia entre capítulos y la arquitectura de los agentes.",
  },
  {
    clave: "ra",
    numero: "Parte III",
    nombre: "Requerimientos de accesibilidad",
    lineas: ["Requerimientos ", "de accesibilidad"],
    corto: "Accesibilidad",
    singular: "Requerimiento de accesibilidad",
    tela: "#1E5E73",
    desc: "Para que cualquier persona pueda leer el libro: encabezados para lectores de pantalla, lenguaje claro y un PDF con buen contraste.",
  },
  {
    clave: "rer",
    numero: "Parte IV",
    nombre: "Requerimientos éticos y de responsabilidad",
    lineas: ["Requerimientos éticos ", "y de responsabilidad"],
    corto: "Éticos",
    singular: "Requerimiento ético y de responsabilidad",
    tela: "#8C2F45",
    desc: "El uso responsable del contenido: originalidad, avisos legales en temas sensibles y ejemplos sin estereotipos.",
  },
];
const parte = (clave: ClaveParte) => PARTES.find((p) => p.clave === clave)!;

type Bloque = "arbol" | "escala" | "personas" | "md-inicio" | "md-checklist" | "md-final";

/** Un paso del recorrido «Dónde verlo»: qué hacer y qué se ve (captura señalada o bloque). */
interface Paso {
  titulo: string;
  texto: string;
  /** Nombre de la captura en docs/guia/capturas (la genera npm run guia:capturas). */
  captura?: string;
  bloques?: Bloque[];
}

interface Req {
  id: string;
  parte: ClaveParte;
  titulo: string;
  estado: Estado;
  donde: string;
  pide: string;
  dilo: string;
  cumple: string[];
  recorrido: Paso[];
  prueba: { nombres: string[]; comprueba: string; resultado: string[] };
  codigo: Ref[];
  falta?: string;
  preguntas: [string, string][];
}

const REQS: Req[] = [
  // ------------------------------------------------------------------ RF
  {
    id: "RF-01",
    parte: "rf",
    titulo: "Selección de nicho y temática cotidiana",
    estado: "cumple",
    donde: "Inicio",
    pide: "El sistema debe permitir seleccionar o parametrizar nichos de crecimiento personal basados en situaciones reales (ej. finanzas para universitarios, gestión del tiempo, resolución de conflictos) descartando explícitamente contenido de ficción.",
    dilo: "En el inicio eliges un nicho de la vida real o escribes tu propia idea. Si la idea es de ficción, Folio no crea el libro y te propone tres alternativas prácticas.",
    cumple: [
      "El inicio ofrece cinco nichos como chips: Finanzas para universitarios, Gestión del tiempo, Resolver conflictos, Primer empleo y Hábitos y rutinas.",
      "Un chip llena la caja con una idea editable. Si escribes tu propia idea, Folio detecta su nicho por las palabras clave (el catálogo tiene ocho).",
      "Si la idea suena a ficción (novela, cuento, poema, dragones…), no se crea el ebook: aparece “Folio crea guías prácticas sobre situaciones reales” con tres alternativas.",
    ],
    recorrido: [
      {
        titulo: "Abre el inicio y toca un chip",
        texto: "Entra con “Continuar con Google”. En el inicio verás los nichos como chips; toca “Gestión del tiempo”.",
        captura: "rf01-inicio",
      },
      {
        titulo: "Pide un libro de ficción",
        texto: "Borra la caja, escribe “Escribe una novela de dragones para adolescentes” y toca la flecha. Después abre la Biblioteca: no se creó ningún libro.",
        captura: "rf01-ficcion",
      },
    ],
    prueba: {
      nombres: ["RF-01 · Nichos de situaciones reales; la ficción se rechaza"],
      comprueba: "Que hay cinco nichos o más, que un chip rellena la idea y que una idea de ficción no crea ningún ebook.",
      resultado: ["<b>5</b> nichos en el inicio", "<b>0</b> ebooks creados con ficción"],
    },
    codigo: [
      { archivo: "src/lib/niches.ts", buscar: "export const NICHES", desc: "Catálogo de nichos, con su sensibilidad y su color de tela" },
      { archivo: "src/lib/niches.ts", buscar: "export function detectNiche", desc: "Detecta el nicho de una idea escrita a mano" },
      { archivo: "src/lib/guardrails.ts", buscar: "export function isFiction", desc: "Guardarraíl de ficción (lista de patrones)" },
      { archivo: "src/app/(app)/page.tsx", buscar: "if (isFiction(idea))", desc: "Bloquea el envío y muestra las alternativas" },
    ],
    preguntas: [
      [
        "¿Cómo sabe que algo es ficción?",
        "Hoy, con una lista de patrones (novela, cuento, poema, saga, personajes, dragones…). En la fase 4 lo clasificará el backend con el modelo de lenguaje antes de arrancar a los agentes, y la respuesta amable será la misma.",
      ],
      [
        "¿Y si escribo un tema que no está en los chips?",
        "Se acepta si es de no ficción. Folio lo asigna al nicho más parecido o, si no encaja en ninguno, a “Crecimiento personal”, que lleva aviso legal de autoayuda.",
      ],
      [
        "¿Por qué no mostrar un simple error?",
        "Porque el tono de Folio es empático (RNF-01): en lugar de un “no”, ofrece tres caminos parecidos que sí puede escribir.",
      ],
    ],
  },
  {
    id: "RF-02",
    parte: "rf",
    titulo: "Temario de 5 a 7 capítulos",
    estado: "cumple",
    donde: "Inicio y revisión del índice",
    pide: "El Agente Investigador debe generar una propuesta de estructura con un límite estricto de entre 5 y 7 capítulos.",
    dilo: "El índice siempre tiene entre 5 y 7 capítulos. Con 5 no puedes quitar y con 7 no puedes agregar. Y aunque alguien se saltara la interfaz, la capa de datos vuelve a validar el rango.",
    cumple: [
      "Al crear el ebook solo hay cuatro opciones: 5, 6, 7 o automático (el Investigador propone 6).",
      "En la revisión del índice, con 5 capítulos las papeleras se desactivan; con 7, el botón dice “7 capítulos · máximo alcanzado” y no responde.",
      "La regla también vive en la capa de datos (<code>addOutlineItem</code> y <code>removeOutlineItem</code>), no solo en los botones. En la fase 4, el backend la valida otra vez.",
    ],
    recorrido: [
      { titulo: "Abre las opciones de capítulos", texto: "En el inicio, toca la píldora “Capítulos: automático”, debajo de la caja.", captura: "rf02-selector" },
      {
        titulo: "Crea el libro con 5 capítulos",
        texto: "Elige 5, toca un chip y envía. Cuando aparezca “Tu turno: revisa el índice”, fíjate en los botones de cada capítulo.",
        captura: "rf02-minimo",
      },
      { titulo: "Intenta pasar de 7", texto: "Toca “Agregar capítulo” dos veces.", captura: "rf02-maximo" },
    ],
    prueba: {
      nombres: ["RF-02 · El temario siempre tiene entre 5 y 7 capítulos"],
      comprueba: "Crea un libro de 5 capítulos (quitar desactivado), sube a 7 (agregar desactivado) y comprueba que “automático” da 6.",
      resultado: ["<b>5</b> → quitar desactivado", "<b>7</b> → agregar desactivado", "Automático = <b>6</b>"],
    },
    codigo: [
      { archivo: "src/lib/types.ts", buscar: "export const MIN_CHAPTERS", desc: "Límites: MIN_CHAPTERS = 5 y MAX_CHAPTERS = 7" },
      { archivo: "src/lib/api/index.ts", buscar: "addOutlineItem(id: string)", desc: "No deja pasar de 7" },
      { archivo: "src/lib/api/index.ts", buscar: "removeOutlineItem(id: string", desc: "No deja bajar de 5" },
      { archivo: "src/components/workspace/stages/OutlineReview.tsx", buscar: "const atMax = count >= MAX_CHAPTERS", desc: "Botones y mensaje del límite" },
      { archivo: "src/lib/api/mock/content.ts", buscar: "export function chapterCount", desc: "Capítulos que propone el Investigador" },
    ],
    preguntas: [
      [
        "¿Qué pasa si pido otra versión del índice?",
        "El Investigador propone otro temario, siempre dentro del rango. También puedes regenerar un solo capítulo con el ícono de flecha circular.",
      ],
      [
        "¿Por qué validar dos veces?",
        "Porque la interfaz se puede saltar, por ejemplo llamando a la API directamente. Una regla de negocio tiene que vivir donde están los datos, no solo en los botones.",
      ],
      [
        "¿“Automático” siempre es 6?",
        "En la simulación, sí. En la fase 4, el Investigador podrá proponer 5, 6 o 7 según el tema, y el backend rechazará cualquier otro número.",
      ],
    ],
  },
  {
    id: "RF-03",
    parte: "rf",
    titulo: "Estructura estandarizada del capítulo",
    estado: "cumple",
    donde: "Revisión del capítulo 1 y “Tu libro”",
    pide: "Cada capítulo generado debe incluir de manera obligatoria: Introducción, Desarrollo (con tono conversacional y directo), Ejemplos cotidianos, Conclusión y Ejercicio práctico de cierre.",
    dilo: "Todos los capítulos traen las mismas cinco secciones, en el mismo orden. Puedes editar lo que dicen, pero no puedes borrarlas.",
    cumple: [
      "El orden está fijado en el código (<code>SECTION_ORDER</code>): Introducción, Desarrollo, Ejemplos cotidianos y Conclusión. El Agente de Ejercicios agrega la quinta, Ejercicio práctico.",
      "En la revisión del capítulo 1, la lista “Estructura” marca las cinco con un visto.",
      "En la revisión final, cada sección tiene su nombre fijo con un candado: cambias el texto, no la estructura.",
    ],
    recorrido: [
      {
        titulo: "Llega a la revisión del capítulo 1",
        texto: "Aprueba el índice de un libro nuevo, o abre “Hablar claro sin pelear”, que ya está en esa pausa.",
        captura: "rf03-estructura",
      },
      { titulo: "Baja hasta el final del capítulo", texto: "Desplázate por “Tu libro”, a la derecha.", captura: "rf03-final" },
      { titulo: "Intenta cambiar la estructura", texto: "En un libro listo, abre la pestaña “Texto”.", captura: "rf03-editor" },
    ],
    prueba: {
      nombres: ["RF-03 · Cada capítulo tiene las cinco secciones obligatorias en orden"],
      comprueba: "Lee los encabezados de sección de cada capítulo y exige exactamente esos cinco, en ese orden.",
      resultado: [`<b>${md.h1 - 1} de ${md.h1 - 1}</b> capítulos con las 5 secciones`],
    },
    codigo: [
      { archivo: "src/lib/types.ts", buscar: "export const SECTION_ORDER", desc: "Orden fijo de las secciones" },
      { archivo: "src/lib/api/mock/content.ts", buscar: "export function generateChapter", desc: "El Redactor genera las cuatro primeras" },
      { archivo: "src/components/book/ChapterPage.tsx", buscar: "export function ChapterPage", desc: "Hoja del capítulo, en ese orden" },
      { archivo: "src/components/book/ChapterPage.tsx", buscar: "export function StructureChips", desc: "Lista “Estructura” de la pausa 2" },
      { archivo: "src/components/workspace/stages/TextEditor.tsx", buscar: "Los nombres de sección son fijos", desc: "Editor con secciones fijas" },
    ],
    preguntas: [
      [
        "¿Y el tono conversacional del Desarrollo?",
        "Se explica en RNF-01. Lo que exige este requerimiento es que cada sección exista y esté en su lugar.",
      ],
      [
        "¿Puedo agregar una sección extra?",
        "Puedes agregar subtítulos (<code>###</code>) dentro de una sección, pero no secciones nuevas ni quitar las que hay.",
      ],
      [
        "¿Por qué el ejercicio lo hace otro agente?",
        "Porque RNF-04 pide separar funciones: el Redactor escribe las cuatro primeras secciones y el Agente de Ejercicios diseña el cierre con las reglas de RF-04.",
      ],
    ],
  },
  {
    id: "RF-04",
    parte: "rf",
    titulo: "Ejercicios prácticos rápidos",
    estado: "cumple",
    donde: "Final de cada capítulo",
    pide: "El sistema debe estar programado para generar únicamente dinámicas de acción rápida como checklists de autoevaluación o retos de 24 a 48 horas.",
    dilo: "El ejercicio solo puede ser de dos tipos: un checklist de autoevaluación o un reto de 24 o 48 horas. En el modelo de datos no existe una tercera opción.",
    cumple: [
      "El tipo <code>Exercise</code> es cerrado: <code>checklist</code>, o <code>reto</code> con duración <code>24h</code> o <code>48h</code>. Cualquier otro valor no compila.",
      "Por defecto alternan: retos en los capítulos impares y checklists en los pares. En Ajustes → Ejercicio preferido puedes fijar uno, y en la pausa 2 está “Otro tipo de ejercicio”.",
      "En el libro aparece como un recuadro al final del capítulo: un reto con pasos numerados o una lista para marcar.",
    ],
    recorrido: [
      {
        titulo: "Mira el final del capítulo 1",
        texto: "Abre “Ahorra sin dejar de vivir” (listo) y baja en “Tu libro” hasta “Ejercicio práctico”.",
        captura: "rf04-cap1",
      },
      { titulo: "Compáralo con el capítulo 2", texto: "Sigue bajando hasta el ejercicio del capítulo 2.", captura: "rf04-cap2" },
      {
        titulo: "Muestra la preferencia",
        texto: "En Ajustes → Preferencias está “Ejercicio preferido”. Solo ofrece las dos formas permitidas.",
        captura: "rf04-ajustes",
      },
    ],
    prueba: {
      nombres: ["RF-04 · Solo checklists de autoevaluación o retos de 24-48 horas"],
      comprueba: "Revisa el ejercicio de los seis capítulos del libro de prueba y exige que cada uno sea un checklist o un reto de 24 o 48 horas.",
      resultado: ejercicios.map((e, i) => `Cap. ${i + 1} · <b>${etiquetaEjercicio(e)}</b>`),
    },
    codigo: [
      { archivo: "src/lib/types.ts", buscar: "export type Exercise =", desc: "Tipo cerrado: checklist, o reto de 24 h o 48 h" },
      { archivo: "src/lib/api/mock/content.ts", buscar: "function generateExercise", desc: "Agente de Ejercicios (simulado)" },
      { archivo: "src/components/book/ChapterPage.tsx", buscar: "export function ExerciseBox", desc: "Recuadro del ejercicio en el libro" },
    ],
    preguntas: [
      [
        "¿Por qué alternan?",
        "Para dar ritmo al libro: un capítulo te hace actuar y el siguiente te hace revisar. Si prefieres uno solo, lo eliges en Ajustes.",
      ],
      [
        "¿Y si alguien quiere un ejercicio de una semana?",
        "No se puede: la duración solo admite 24 o 48 horas. En la fase 4, el prompt del Agente de Ejercicios repetirá la regla y el backend validará su respuesta.",
      ],
    ],
  },
  {
    id: "RF-05",
    parte: "rf",
    titulo: "Puntos de validación humana (HITL)",
    estado: "cumple",
    donde: "Revisión del índice y del capítulo 1",
    pide: "El sistema debe detener su ejecución autónoma en dos fases críticas para requerir la aprobación del usuario: (1) pausa tras la propuesta de índice y temas de los capítulos; (2) pausa tras la redacción final del primer capítulo para validar tono y formato antes de proceder con el resto.",
    dilo: "Folio se detiene dos veces y no sigue sin ti: después del índice y después del capítulo 1. La pausa se guarda, así que aunque cierres el navegador, al volver sigue esperando.",
    cumple: [
      "Al terminar el índice, el libro queda en el estado <code>indice_pendiente</code> y solo “Aprobar índice” lo mueve. Lo mismo pasa con <code>cap1_pendiente</code> y “Aprobar y escribir el resto”.",
      "La pausa se nota: cae la cinta marcapáginas, la fase activa dice “Tú” y en la biblioteca el libro aparece como “Tu turno”.",
      "En cada pausa puedes editar, reordenar, pedir otra versión o ajustar el tono antes de aprobar.",
      "El estado se guarda: al recargar, el sistema retoma el libro en el mismo punto.",
    ],
    recorrido: [
      {
        titulo: "Crea un libro y espera la primera pausa",
        texto: "Cuando el Investigador termina el índice, el sistema se detiene. Espera todo lo que quieras o recarga la página: sigue en el mismo punto.",
        captura: "rf05-pausa1",
      },
      { titulo: "Mira la Biblioteca", texto: "Sal del libro y abre la Biblioteca.", captura: "rf05-biblioteca" },
      {
        titulo: "Aprueba el índice y llega a la segunda pausa",
        texto: "Vuelve al libro y toca “Aprobar índice”. El Redactor escribe solo el capítulo 1 y se detiene otra vez.",
        captura: "rf05-pausa2",
      },
    ],
    prueba: {
      nombres: ["RF-05 · Pausa 1: el sistema se detiene tras proponer el índice", "RF-05 · Pausa 2: se detiene tras escribir el capítulo 1"],
      comprueba: "Espera con el libro en pausa y comprueba que no se escribió ningún capítulo; recarga y verifica que sigue en pausa; y confirma que los capítulos 2 en adelante esperan la segunda aprobación.",
      resultado: ["<b>0</b> capítulos escritos durante la pausa", "La pausa <b>sobrevive</b> a recargar"],
    },
    codigo: [
      { archivo: "src/lib/api/mock/simulator.ts", buscar: '({ ...e, status: "indice_pendiente" })', desc: "Pausa 1: el proceso termina en indice_pendiente" },
      { archivo: "src/lib/api/mock/simulator.ts", buscar: 'status: "cap1_pendiente", chapterOneVersion: 1', desc: "Pausa 2: termina en cap1_pendiente" },
      { archivo: "src/lib/api/mock/simulator.ts", buscar: "approveOutline(id: string)", desc: "Solo sigue al aprobar el índice" },
      { archivo: "src/lib/api/mock/simulator.ts", buscar: "approveChapterOne(id: string)", desc: "Solo sigue al aprobar el capítulo 1" },
      { archivo: "src/lib/api/mock/simulator.ts", buscar: "resume(ebook: Ebook)", desc: "Retoma el trabajo tras recargar" },
      { archivo: "src/lib/phases.ts", buscar: "export function derivePhases", desc: "Fases con “Tú” en las pausas" },
    ],
    preguntas: [
      ["¿Qué es HITL?", "<i>Human in the loop</i>: una persona dentro del circuito. El sistema automatiza el trabajo, pero en los puntos críticos decide un humano."],
      [
        "¿Cómo será en la fase 4?",
        "LangGraph tiene la función <code>interrupt()</code>, que detiene el grafo de agentes y guarda su estado en un <i>checkpointer</i> persistente. La interfaz ya espera exactamente ese comportamiento.",
      ],
      [
        "¿Por qué justo esas dos pausas?",
        "El índice define de qué trata el libro y el capítulo 1 define cómo suena. Corregir ahí es barato; corregir con seis capítulos escritos, no.",
      ],
    ],
  },
  {
    id: "RF-06",
    parte: "rf",
    titulo: "Exportación a Markdown y PDF",
    estado: "cumple",
    donde: "Exportar",
    pide: "El sistema debe entregar el producto final formateado en Markdown (.md) con sintaxis limpia (encabezados, listas, bloques de citas) y permitir la compilación directa a un documento PDF estructurado y listo para maquetación o venta.",
    dilo: "Cuando el libro está listo, Exportar te da dos formatos: Markdown limpio, para otras herramientas, y un PDF estructurado con la portada, la letra y el tamaño de página que elegiste.",
    cumple: [
      "Markdown: portada (título, subtítulo y autor), aviso legal como cita (<code>&gt;</code>), índice numerado, capítulos con encabezados, listas, checklists (<code>- [ ]</code>) y la nota de transparencia al final.",
      "PDF: se abre una vista de impresión con el tamaño elegido (A5, A4, Carta o 6 × 9 in) y se guarda como PDF desde el navegador. Sale etiquetado y con marcadores.",
      `En el repositorio hay un ejemplo real de cada uno en <code>docs/verificacion/</code>: <code>ebook-ejemplo.md</code> y <code>ebook-ejemplo.pdf</code> (${"{PAGINAS_EJEMPLO}"} páginas).`,
    ],
    recorrido: [
      { titulo: "Abre un libro listo", texto: "Abre “Ahorra sin dejar de vivir” desde la Biblioteca.", captura: "rf06-boton" },
      { titulo: "Toca Exportar", texto: "Se abre el diálogo de exportación.", captura: "rf06-dialogo" },
      {
        titulo: "Descarga el Markdown y ábrelo",
        texto: "Elige Markdown → “Descargar Markdown” y abre el archivo con cualquier editor de texto. Así empieza, y así se ve un ejercicio:",
        bloques: ["md-inicio", "md-checklist"],
      },
      { titulo: "Descarga el PDF", texto: "Vuelve a Exportar y elige PDF → “Descargar PDF”. Se abre la vista de impresión:", captura: "rf06-impresion" },
    ],
    prueba: {
      nombres: ["RF-06 · Exportación a Markdown y a PDF"],
      comprueba: "Descarga el Markdown y comprueba que tiene encabezados, listas y citas; después genera el PDF desde la vista de impresión.",
      resultado: [
        `<b>${md.h1 + md.h2 + md.h3}</b> encabezados`,
        `<b>${md.listas}</b> elementos de lista`,
        `<b>${md.checklist}</b> casillas de checklist`,
        `<b>${md.citas}</b> cita (aviso legal)`,
        `PDF de <b>{PAGINAS_EJEMPLO}</b> páginas`,
      ],
    },
    codigo: [
      { archivo: "src/lib/markdown.ts", buscar: "export function buildMarkdown", desc: "Arma el Markdown completo" },
      { archivo: "src/components/workspace/ExportDialog.tsx", buscar: "function download()", desc: "Diálogo de exportación" },
      { archivo: "src/app/imprimir/page.tsx", buscar: "@page { size:", desc: "Vista de impresión con el tamaño de página" },
    ],
    preguntas: [
      [
        "¿Por qué el PDF sale del navegador y no de un servidor?",
        "Porque en esta fase no hay backend. El motor de impresión de Chrome y Edge genera un PDF etiquetado de buena calidad. En la fase 4 lo generará el Agente Maquetador en el servidor, con el mismo diseño.",
      ],
      [
        "¿Qué lo hace “listo para maquetación o venta”?",
        "Trae portada, aviso legal, índice y capítulos con jerarquía; usa tamaños de página estándar (6 × 9 in es habitual en autopublicación) y tipografía accesible. El Markdown sirve para llevarlo a otra herramienta de maquetación.",
      ],
    ],
  },

  // ------------------------------------------------------------------ RNF
  {
    id: "RNF-01",
    parte: "rnf",
    titulo: "Tono y estilo de redacción",
    estado: "interfaz",
    donde: "Revisión del capítulo 1",
    pide: "La IA debe mantener una temperatura/configuración de generación que garantice un tono conversacional, empático, directo e intermedio en profundidad (evitando explicaciones académicas densas o textos superficiales de rellenado).",
    dilo: "El texto te habla de tú a tú, y en la revisión del capítulo 1 puedes ajustar el tono con un toque. La temperatura del modelo real se configura en la fase 4.",
    cumple: [
      "El contenido de prueba está escrito en segunda persona, con frases cortas y pasos concretos (“En este capítulo vas a ver…”, “Elige una idea y pruébala esta semana”).",
      "En la revisión del capítulo 1 hay cinco ajustes de un toque (Más cercano, Más ejemplos, Más corto, Menos formal y Otro tipo de ejercicio) y un campo libre.",
      "Cada ajuste crea una versión nueva (versión 2, 3…) y siempre puedes volver a la anterior.",
    ],
    recorrido: [
      { titulo: "Elige un ajuste en la revisión del capítulo 1", texto: "En la segunda pausa, toca “Más cercano”.", captura: "rnf01-ajustes" },
      { titulo: "Aplica y compara", texto: "Toca “Aplicar ajustes” y espera unos segundos.", captura: "rnf01-version2" },
    ],
    prueba: {
      nombres: ["RNF-01 · Tono conversacional y ajustes de tono"],
      comprueba: "Comprueba el tuteo del texto, que están los cinco ajustes y que la versión 2 aplica el ajuste pedido.",
      resultado: ["<b>5</b> ajustes de tono", "Versión <b>2</b> con el ajuste aplicado"],
    },
    codigo: [
      { archivo: "src/lib/types.ts", buscar: "export const ADJUST_CHIP_LABELS", desc: "Los cinco ajustes de tono" },
      { archivo: "src/lib/api/mock/content.ts", buscar: "Te lo digo claro", desc: "Efecto de “Más cercano” en el texto" },
      { archivo: "src/lib/api/mock/simulator.ts", buscar: "adjustChapterOne(", desc: "Crea la nueva versión del capítulo 1" },
    ],
    falta: "La temperatura y el prompt de estilo del Redactor real, más una rúbrica de tono (tuteo, empatía, frases directas y profundidad intermedia) para evaluar muestras de capítulos, junto con los ajustes que haga cada persona en la pausa 2 (docs/02 §2).",
    preguntas: [
      [
        "¿Qué es la temperatura?",
        "Un parámetro del modelo de lenguaje: con un valor bajo, el texto es predecible; con uno alto, más variado. Para este tono se usará un valor intermedio, que se afinará con pruebas en la fase 4.",
      ],
    ],
  },
  {
    id: "RNF-02",
    parte: "rnf",
    titulo: "Menos de 60 segundos por capítulo",
    estado: "interfaz",
    donde: "Escribiendo",
    pide: "La generación individual de cada capítulo no debe exceder un tiempo razonable de procesamiento (ej. menos de 60 segundos por capítulo) para mantener un flujo de trabajo fluido durante las pausas de validación.",
    dilo: `El texto aparece en vivo mientras se escribe, con el avance por secciones y el tiempo estimado. En la simulación, el capítulo 1 tarda unos ${segundos} segundos; con la IA real se medirá en la fase 4.`,
    cumple: [
      "Streaming: las palabras aparecen poco a poco, con un cursor, como si alguien escribiera.",
      "A la izquierda se ve en qué sección va el Redactor y la bitácora de los agentes; arriba, el tiempo estimado (“falta menos de un minuto”).",
      "Puedes leer los capítulos terminados con “Leer ahora” mientras se escriben los demás, o salir: el trabajo sigue.",
      `Medido con la velocidad normal: capítulo 1 en ${segundos} s.`,
    ],
    recorrido: [
      {
        titulo: "Pon la velocidad en Normal",
        texto: "En Ajustes → Demostración. Con “Normal” ves el tiempo de referencia; “Rápida” sirve para demostrar sin esperar.",
        captura: "rnf02-velocidad",
      },
      { titulo: "Aprueba un índice y mira el capítulo 1", texto: "Crea un ebook, aprueba el índice y mira las dos mitades de la pantalla.", captura: "rnf02-cap1" },
      { titulo: "Aprueba el capítulo 1 y mira el resto", texto: "Toca “Aprobar y escribir el resto”.", captura: "rnf02-resto" },
    ],
    prueba: {
      nombres: ["RNF-02 · Cada capítulo se genera en menos de 60 segundos, con streaming"],
      comprueba: "Mide el capítulo 1 con la velocidad normal y comprueba que el texto crece mientras se escribe.",
      resultado: [`Capítulo 1 en <b>${segundos} s</b>`, "El texto <b>crece</b> durante la escritura"],
    },
    codigo: [
      { archivo: "src/lib/api/mock/simulator.ts", buscar: "for (let i = 0; i < tokens.length; i += 6)", desc: "Streaming del texto por fragmentos" },
      { archivo: "src/components/workspace/stages/Writing.tsx", buscar: "function remainingText", desc: "Tiempo estimado" },
      { archivo: "src/components/workspace/previews/ChapterScroller.tsx", buscar: "export function ChapterScroller", desc: "Lectura en vivo del capítulo" },
    ],
    falta: "Medir el tiempo real con el proveedor de IA elegido. La meta es que el 95 % de los capítulos tarde menos de 60 segundos (docs/02 §2).",
    preguntas: [
      [
        "¿Por qué la simulación es tan rápida?",
        "Está calibrada para demostrar el flujo, no para medir. Por eso este requerimiento queda como “Cumple en la interfaz” hasta medir con la IA real.",
      ],
      [
        "¿Y si un capítulo falla?",
        "Aparece un error con “Reintentar”. Puedes probarlo en Ajustes → Demostración → Simular un error: el capítulo 4 falla una vez.",
      ],
      [
        "¿Cómo llegará el texto en vivo desde el backend?",
        "Por SSE (<i>Server-Sent Events</i>): el servidor envía eventos <code>token</code> y la interfaz los agrega al capítulo, igual que hoy.",
      ],
    ],
  },
  {
    id: "RNF-03",
    parte: "rnf",
    titulo: "Consistencia y cohesión textual",
    estado: "interfaz",
    donde: "Pausa 2 y redacción",
    pide: "Los agentes redactores deben mantener coherencia terminológica y de estilo a lo largo de los 5 a 7 capítulos sin reiteraciones redundantes ni contradicciones entre secciones.",
    dilo: "El capítulo 1 que apruebas es la referencia de tono y formato para todo el libro, y los capítulos se escriben uno detrás de otro para que cada uno conozca a los anteriores.",
    cumple: [
      "La interfaz lo dice dos veces: en la pausa (“Este capítulo marcará el tono y el formato de todo el libro”) y durante la redacción (“Cada capítulo sigue el tono y el formato del capítulo 1 que aprobaste”).",
      "La redacción es secuencial: nunca hay dos capítulos escribiéndose a la vez. Los demás aparecen “En espera”.",
      "Todos los capítulos comparten la estructura de RF-03 y los títulos del índice aprobado.",
    ],
    recorrido: [
      { titulo: "Lee el aviso de la segunda pausa", texto: "En la revisión del capítulo 1, justo debajo del título.", captura: "rnf03-ancla" },
      { titulo: "Aprueba y mira el orden", texto: "Toca “Aprobar y escribir el resto” y mira la lista de capítulos.", captura: "rnf03-orden" },
    ],
    prueba: {
      nombres: ["RNF-03 · El capítulo 1 marca el tono y el resto se escribe en orden"],
      comprueba: "Muestrea el estado durante toda la redacción y exige que nunca haya dos capítulos escribiéndose a la vez.",
      resultado: ["Como máximo <b>1</b> capítulo a la vez", "Aviso de tono en la pausa y en la redacción"],
    },
    codigo: [
      { archivo: "src/lib/api/mock/simulator.ts", buscar: "async function writeRest", desc: "Escritura secuencial de los capítulos 2 en adelante" },
      { archivo: "src/components/workspace/stages/ChapterOneReview.tsx", buscar: "Este capítulo marcará el tono", desc: "Aviso en la pausa 2" },
      { archivo: "src/components/workspace/stages/Writing.tsx", buscar: "Cada capítulo sigue el tono", desc: "Nota durante la redacción" },
    ],
    falta: "Una guía de estilo extraída del capítulo 1 y los resúmenes de los capítulos anteriores, que el Redactor recibirá en cada llamada (docs/03 §8).",
    preguntas: [
      [
        "¿No sería más rápido escribir en paralelo?",
        "Sí, pero cada capítulo perdería el contexto de los anteriores y habría más repeticiones y contradicciones. Aquí se prioriza la coherencia.",
      ],
      [
        "¿Cómo se evitarán las repeticiones con la IA real?",
        "El Redactor recibirá los resúmenes de los capítulos ya escritos y la guía de estilo del capítulo 1, con la instrucción de no repetir ideas.",
      ],
    ],
  },
  {
    id: "RNF-04",
    parte: "rnf",
    titulo: "Arquitectura modular de cuatro agentes",
    estado: "pendiente",
    donde: "Fases y bitácora",
    pide: "El backend del sistema debe estar estructurado de forma modular (dividiendo funciones entre Agente Investigador, Agente Redactor, Agente de Ejercicios y Agente Maquetador/Exportador) permitiendo la fácil sustitución o reajuste de los prompts de cada rol.",
    dilo: "La arquitectura de cuatro agentes está diseñada y la interfaz ya los muestra trabajando por separado. El backend, con un módulo y un archivo de prompt por agente, se construye en la fase 4.",
    cumple: [
      "Diseño: <code>docs/03-arquitectura.md</code> define un módulo por agente (<code>backend/app/agents/…</code>) y un archivo de prompt por rol (<code>backend/app/prompts/…</code>), para cambiar un prompt sin tocar el código.",
      "La simulación ya separa las responsabilidades: investigar, redactar, crear ejercicios y maquetar son funciones distintas.",
      "La interfaz muestra al responsable de cada fase (Investigador, Redactor + Ejercicios, Maquetador, y “Tú” en las pausas) y la bitácora dice qué hace cada agente.",
      "Los componentes solo hablan con la fachada <code>api</code>: el backend real se conecta sin cambiar la interfaz.",
    ],
    recorrido: [
      { titulo: "Lee la barra de fases", texto: "Está arriba en cualquier libro. Cada fase dice quién trabaja.", captura: "rnf04-fases" },
      {
        titulo: "Mira la bitácora mientras trabajan",
        texto: "Mientras el Investigador o el Redactor trabajan, a la izquierda aparece la actividad de los agentes.",
        captura: "rnf04-bitacora",
      },
    ],
    prueba: {
      nombres: ["RNF-04 · Los cuatro agentes trabajan por separado y se ven"],
      comprueba: "Comprueba que las fases muestran a Investigador, Redactor + Ejercicios y Maquetador, y que en la bitácora participan exactamente los cuatro agentes.",
      resultado: ["<b>4</b> agentes en la bitácora", "Fases con su responsable"],
    },
    codigo: [
      { archivo: "src/lib/api/mock/simulator.ts", buscar: "async function research", desc: "Agente Investigador (simulado)" },
      { archivo: "src/lib/api/mock/simulator.ts", buscar: "async function writeChapter", desc: "Agente Redactor (simulado)" },
      { archivo: "src/lib/api/mock/content.ts", buscar: "function generateExercise", desc: "Agente de Ejercicios (simulado)" },
      { archivo: "src/lib/api/mock/simulator.ts", buscar: "async function finish", desc: "Agente Maquetador (simulado)" },
      { archivo: "src/lib/api/index.ts", buscar: "export const api = {", desc: "Fachada donde se conectará el backend" },
    ],
    falta: "Construir el backend con FastAPI y LangGraph: los cuatro agentes como módulos y sus prompts en archivos independientes.",
    preguntas: [
      [
        "Si no hay backend, ¿por qué dices que es modular?",
        "Porque el diseño ya está definido y la simulación respeta esa división. Lo honesto es decir que el requerimiento queda pendiente hasta la fase 4, y así está marcado.",
      ],
      [
        "¿Qué significa cambiar un prompt “fácilmente”?",
        "Cada agente leerá su prompt de un archivo propio. Para ajustar el tono del Redactor editas su archivo; no tocas el código ni a los otros agentes.",
      ],
      [
        "¿Qué es LangGraph?",
        "Una librería de Python para construir flujos de agentes como un grafo de pasos, con pausas (<code>interrupt()</code>) y estado guardado. Encaja con las dos pausas de RF-05.",
      ],
    ],
  },

  // ------------------------------------------------------------------ RA
  {
    id: "RA-01",
    parte: "ra",
    titulo: "Jerarquía H1, H2 y H3 en Markdown y PDF",
    estado: "cumple",
    donde: "Exportar y editor",
    pide: "Los PDFs y archivos Markdown exportados deben mantener una jerarquía clara de encabezados (H1, H2, H3) para garantizar la lectura adecuada a través de lectores de pantalla (screen readers).",
    dilo: "El libro exportado usa tres niveles de encabezado, sin saltos: H1 para el título y los capítulos, H2 para las secciones y H3 para los subtemas. El PDF va etiquetado para lectores de pantalla.",
    cumple: [
      "Markdown: <code>#</code> para el título y cada capítulo, <code>##</code> para las secciones y <code>###</code> para los subtemas.",
      "PDF etiquetado: tiene árbol de estructura (<code>StructTreeRoot</code>), marcadores, idioma <code>es</code> y exactamente los niveles H1, H2 y H3.",
      "En el editor, si alguien escribe <code>#</code> o <code>##</code> a mano, se convierte en <code>###</code> para no romper la jerarquía.",
    ],
    recorrido: [
      { titulo: "Descarga el Markdown y mira los #", texto: "Cada # es un nivel de encabezado: # es H1, ## es H2 y ### es H3.", bloques: ["arbol"] },
      { titulo: "Abre la vista de impresión", texto: "Es lo que se guarda como PDF: los mismos tres niveles, y el PDF sale etiquetado.", captura: "ra01-pdf" },
      {
        titulo: "Intenta romper la jerarquía",
        texto: "En la revisión final, abre “Texto” y escribe “# Un título manual” al final de la Introducción.",
        captura: "ra01-editor",
      },
    ],
    prueba: {
      nombres: ["RA-01 · Jerarquía H1/H2/H3 en Markdown y PDF etiquetado"],
      comprueba: "Recorre los encabezados del Markdown (sin saltos, máximo nivel 3, un H1 por capítulo), lee las etiquetas del PDF y comprueba la conversión del editor.",
      resultado: [`Markdown: <b>${md.h1}</b> H1 · <b>${md.h2}</b> H2 · <b>${md.h3}</b> H3`, `PDF: etiquetas <b>${encabezados.pdf.join(", ")}</b>`, "<code>#</code> → <code>###</code> en el editor"],
    },
    codigo: [
      { archivo: "src/lib/markdown.ts", buscar: "`# Capítulo ${c.number}", desc: "Capítulos como H1 en el Markdown" },
      { archivo: "src/components/workspace/stages/TextEditor.tsx", buscar: "function sanitize(", desc: "Convierte # y ## en ###" },
      { archivo: "src/app/imprimir/page.tsx", buscar: "Portadilla: el título del libro es el H1", desc: "Niveles del PDF: título y capítulos en H1" },
    ],
    preguntas: [
      [
        "¿Qué es un PDF etiquetado?",
        "Un PDF que, además del aspecto de cada página, guarda su estructura: qué es título, qué es párrafo y en qué orden se lee. Es lo que usan los lectores de pantalla.",
      ],
      [
        "¿Por qué no usar H4?",
        "El requerimiento pide H1 a H3 y con tres niveles basta para un libro corto. Más niveles complican la navegación con lector de pantalla.",
      ],
      [
        "¿Cómo lo compruebo sin lector de pantalla?",
        "En Acrobat Reader, abre el panel de Etiquetas (Ver → Mostrar/ocultar → Paneles laterales → Etiquetas). O abre el Markdown y cuenta los #.",
      ],
    ],
  },
  {
    id: "RA-02",
    parte: "ra",
    titulo: "Lenguaje claro y comprensible",
    estado: "interfaz",
    donde: "El texto del libro",
    pide: "El contenido redactado debe utilizar una sintaxis directa y explicaciones simples para garantizar un nivel de lecturabilidad accesible a un público joven o diverso sin formación técnica previa.",
    dilo: `Medimos la legibilidad del libro con INFLESZ, una escala hecha para textos en español: salió ${num(legibilidad.valor)}, “${legibilidad.nivel}”. La prueba exige 55 o más.`,
    cumple: [
      `El libro de prueba obtiene INFLESZ ${num(legibilidad.valor)} (“${legibilidad.nivel}”), con ${num(legibilidad.palabrasPorFrase)} palabras por frase y ${num(legibilidad.silabasPorPalabra)} sílabas por palabra, sobre ${miles(legibilidad.palabras)} palabras.`,
      "En la escala INFLESZ, de 55 a 65 es “normal” y de 65 a 80, “bastante fácil”: el texto queda por encima de lo normal.",
      "Frases cortas, segunda persona, sin tecnicismos y con ejemplos de la vida diaria.",
    ],
    recorrido: [
      { titulo: "Lee un párrafo en voz alta", texto: "Abre un capítulo de “Ahorra sin dejar de vivir”.", captura: "ra02-lectura" },
      {
        titulo: "Muestra la medición",
        texto: `La prueba calcula el índice INFLESZ sobre todo el libro exportado, sin los títulos: ${num(legibilidad.valor)}.`,
        bloques: ["escala"],
      },
    ],
    prueba: {
      nombres: ["RA-02 · Lenguaje claro (índice de legibilidad INFLESZ)"],
      comprueba: "Calcula el índice sobre el texto del libro exportado (sin encabezados) y exige 55 o más.",
      resultado: [
        `INFLESZ <b>${num(legibilidad.valor)}</b>`,
        `<b>${num(legibilidad.palabrasPorFrase)}</b> palabras por frase`,
        `<b>${num(legibilidad.silabasPorPalabra)}</b> sílabas por palabra`,
        `<b>${miles(legibilidad.frases)}</b> frases analizadas`,
      ],
    },
    codigo: [{ archivo: "e2e/legibilidad.ts", buscar: "export function inflesz", desc: "Cálculo del índice INFLESZ" }],
    falta: "Las reglas de lenguaje claro en el prompt del Redactor y medir el mismo índice sobre los textos reales de la IA.",
    preguntas: [
      [
        "¿Qué es INFLESZ?",
        "Una escala de legibilidad para español (Barrio-Cantalejo y colaboradores, 2008) basada en la fórmula de perspicuidad de Szigriszt-Pazos. Cuenta sílabas por palabra y palabras por frase: cuanto más alto, más fácil.",
      ],
      [
        "¿Una fórmula basta para decir que un texto es claro?",
        "No del todo: mide la forma, no si la explicación se entiende. Por eso se complementa con el tono de RNF-01 y con la revisión de la persona en las pausas.",
      ],
    ],
  },
  {
    id: "RA-03",
    parte: "ra",
    titulo: "Contraste y tipografía limpia en el PDF",
    estado: "cumple",
    donde: "Portada y estilo, vista de impresión",
    pide: "El archivo PDF generado debe emplear fondos neutros (preferiblemente blanco) con texto en alto contraste (negro/gris oscuro) y fuentes tipográficas legibles (ej. Arial, Helvetica o Roboto) en tamaños mínimos de 11pt para el cuerpo de texto.",
    dilo: "El PDF siempre sale con hoja blanca, texto casi negro y Roboto, Arial o Helvetica desde 11 pt: no hay forma de elegir menos. Y si eliges un color de portada con poco contraste, Folio te avisa y lo corrige.",
    cumple: [
      "“Portada y estilo” solo ofrece Roboto, Arial y Helvetica, y tamaños de 11, 12 y 13 pt.",
      "La hoja del libro es siempre blanca, también con el tema oscuro de la app.",
      "Color de tela personalizado: si el texto blanco queda por debajo de 4,5:1, aparece un aviso y “Usar el tono accesible”, que oscurece el color hasta cumplir.",
      `Medido en la vista de impresión: cuerpo de ${num(cuerpoPx, 2)} px (${num(cuerpoPx * 0.75)} pt) en Roboto, texto ${hex(colorTexto)} sobre blanco, contraste ${num(contrasteCuerpo)}:1.`,
    ],
    recorrido: [
      { titulo: "Abre Portada y estilo", texto: "En un libro listo, abre la pestaña “Portada y estilo” y baja hasta la letra.", captura: "ra03-opciones" },
      { titulo: "Elige un color con poco contraste", texto: "En “Color de tela”, abre el color personalizado y elige un amarillo claro.", captura: "ra03-aviso" },
      { titulo: "Usa el tono accesible", texto: "Toca “Usar el tono accesible”.", captura: "ra03-corregido" },
      { titulo: "Cambia al tema oscuro", texto: "En Ajustes → Preferencias → Tema, elige “Oscuro” y vuelve al libro.", captura: "ra03-oscuro" },
    ],
    prueba: {
      nombres: ["RA-03 · Fondo blanco, alto contraste, letra legible y 11 pt como mínimo"],
      comprueba: "Comprueba las opciones permitidas, el aviso y la corrección del contraste, y mide tamaño, fuente, fondo y contraste reales en la vista de impresión.",
      resultado: [
        `<b>${num(cuerpoPx, 2)} px</b> = ${num(cuerpoPx * 0.75)} pt`,
        "<b>Roboto</b>",
        "Fondo <b>blanco</b>",
        `Contraste <b>${num(contrasteCuerpo)}:1</b>`,
      ],
    },
    codigo: [
      { archivo: "src/lib/design.ts", buscar: "export const BOOK_FONTS", desc: "Letras permitidas" },
      { archivo: "src/lib/design.ts", buscar: "export const BODY_SIZES", desc: "Tamaños permitidos: 11, 12 y 13 pt" },
      { archivo: "src/lib/design.ts", buscar: "export function accessibleCloth", desc: "Tono accesible (4,5:1 como mínimo)" },
      { archivo: "src/components/workspace/stages/DesignPanel.tsx", buscar: "const ratio = contrastRatio(", desc: "Validación del contraste en vivo" },
      { archivo: "src/app/globals.css", buscar: ".hoja-libro {", desc: "Hoja del libro siempre blanca" },
    ],
    preguntas: [
      [
        "¿Qué significa 4,5:1?",
        `Es la relación de luminancia entre el texto y el fondo. WCAG pide al menos 4,5:1 para texto normal. El cuerpo del libro tiene ${num(contrasteCuerpo)}:1; el máximo posible, negro sobre blanco, es 21:1.`,
      ],
      ["¿Por qué 14,67 px son 11 pt?", "Un punto es 1/72 de pulgada y un píxel CSS, 1/96. Entonces 11 pt × 96 ÷ 72 = 14,67 px."],
      ["¿Y el tema oscuro?", "Cambia la app, no el libro: la hoja siempre es blanca, porque así saldrá el PDF."],
    ],
  },

  // ------------------------------------------------------------------ RÉR
  {
    id: "RÉR-01",
    parte: "rer",
    titulo: "Originalidad y prevención de plagio",
    estado: "interfaz",
    donde: "Exportar y archivos exportados",
    pide: "Los agentes deben incluir instrucciones explícitas para generar contenido sintético original, evitando la copia textual de fuentes protegidas por derechos de autor durante la etapa de investigación.",
    dilo: "Hoy todo el texto sale de plantillas propias del proyecto, y cada exportación declara “Contenido original generado con asistencia de IA”. Las instrucciones antiplagio irán en los prompts de la fase 4.",
    cumple: [
      "El contenido simulado sale de plantillas escritas para el proyecto; no se copia de ninguna fuente externa.",
      "Transparencia: el diálogo de exportación, el Markdown y el PDF incluyen la nota “Contenido original generado con asistencia de IA”.",
    ],
    recorrido: [
      { titulo: "Abre Exportar", texto: "En un libro listo, toca “Exportar”.", captura: "rer01-nota" },
      { titulo: "Mira el final del Markdown", texto: "Descarga el Markdown y baja hasta el final del archivo.", bloques: ["md-final"] },
    ],
    prueba: {
      nombres: ["RÉR-01 · Contenido original y nota de transparencia"],
      comprueba: "Comprueba la nota en el diálogo de exportación y al final del Markdown.",
      resultado: ["Nota en el <b>diálogo</b>", "Nota al final del <b>Markdown</b>"],
    },
    codigo: [
      { archivo: "src/components/workspace/ExportDialog.tsx", buscar: "Contenido original generado con asistencia de IA", desc: "Nota en el diálogo" },
      { archivo: "src/lib/markdown.ts", buscar: "*Contenido original generado con asistencia de IA.*", desc: "Nota al final del Markdown" },
    ],
    falta: "Instrucciones explícitas de originalidad en los prompts del Investigador y del Redactor y, si hace falta, una verificación de similitud antes de exportar (docs/02 §4).",
    preguntas: [
      [
        "¿Cómo se evitará el plagio con un modelo real?",
        "Con tres capas: instrucciones en los prompts (explicar con palabras propias, no reproducir textos largos), un Investigador que resume ideas en lugar de copiar y, si hace falta, una verificación de similitud antes de exportar.",
      ],
      ["¿Por qué avisar que hubo IA?", "Por transparencia con quien compra o lee el libro. Forma parte de la categoría de ética y responsabilidad."],
    ],
  },
  {
    id: "RÉR-02",
    parte: "rer",
    titulo: "Aviso legal en temas sensibles",
    estado: "cumple",
    donde: "Índice, libro y editor",
    pide: "Todo eBook enfocado en temas como finanzas personales, gestión de emociones o autoayuda debe incluir automáticamente un aviso legal visible aclarando que el contenido es meramente educativo e informativo, y no sustituye la asesoría profesional (financiera, médica o psicológica).",
    dilo: "Si el tema es sensible, el aviso legal se agrega solo: se anuncia desde el índice, va entre la portada y el índice del libro, y no se puede borrar.",
    cumple: [
      "Cada nicho tiene una sensibilidad (financiera, salud emocional, salud física o autoayuda) con su propio texto de aviso.",
      "Se anuncia desde la primera pausa: “Incluirá un aviso legal porque el tema es financiero”, con “Ver el texto”.",
      "En el libro va entre la portada y el índice. En el editor aparece con candado y no se puede quitar.",
      "Gestión del tiempo, Organización del estudio y Primer empleo no lo llevan: son habilidades prácticas.",
    ],
    recorrido: [
      { titulo: "Crea un libro de finanzas", texto: "En la primera pausa, mira debajo del índice y toca “Ver el texto”.", captura: "rer02-indice" },
      { titulo: "Mira el orden del libro", texto: "A la derecha, en “Tu libro”, debajo de la portada.", captura: "rer02-etiqueta" },
      { titulo: "Ábrelo cuando esté listo", texto: "En “Tu libro”, baja una hoja después de la portada.", captura: "rer02-libro" },
      { titulo: "Intenta borrarlo", texto: "En la revisión final, abre “Texto” y elige “Aviso legal” en el selector.", captura: "rer02-editor" },
      {
        titulo: "Prueba con un tema emocional",
        texto: "Crea un ebook con la idea “Cómo manejar la ansiedad y el estrés antes de un examen importante”.",
        captura: "rer02-emocional",
      },
      {
        titulo: "Prueba con un tema que no es sensible",
        texto: "Abre “Semanas que rinden” (Gestión del tiempo), que está en la primera pausa.",
        captura: "rer02-sinaviso",
      },
    ],
    prueba: {
      nombres: ["RÉR-02 · El aviso legal se anuncia desde el índice", "RÉR-02 · Aviso legal automático y no removible en temas sensibles"],
      comprueba: "Comprueba el aviso en el índice, su posición en el Markdown (entre la portada y el índice), el bloqueo en el editor, el caso emocional y que un tema no sensible no lo lleva.",
      resultado: ["Finanzas: <b>con aviso</b>", "Estrés y ansiedad: <b>con aviso</b>", "Gestión del tiempo: <b>sin aviso</b>"],
    },
    codigo: [
      { archivo: "src/lib/guardrails.ts", buscar: "export const DISCLAIMERS", desc: "Textos del aviso por categoría" },
      { archivo: "src/lib/niches.ts", buscar: 'sensitivity: "financiero"', desc: "Sensibilidad de cada nicho" },
      { archivo: "src/components/workspace/stages/OutlineReview.tsx", buscar: "Incluirá un aviso legal porque", desc: "Aviso en la pausa 1" },
      { archivo: "src/components/workspace/stages/TextEditor.tsx", buscar: "no se puede quitar (RÉR-02)", desc: "Bloque con candado en el editor" },
      { archivo: "src/lib/markdown.ts", buscar: '"## Aviso legal"', desc: "Posición en el libro exportado" },
    ],
    preguntas: [
      [
        "¿Por qué Gestión del tiempo no lleva aviso?",
        "Porque es una habilidad práctica, no un consejo financiero, médico ni psicológico. Es una decisión registrada: si el equipo prefiere que todos los libros lo lleven, es un cambio de una línea en <code>niches.ts</code>.",
      ],
      [
        "¿Qué pasa si escribo el tema a mano?",
        "Folio detecta el nicho por las palabras (por ejemplo, “ansiedad” → salud emocional) y aplica su aviso. En la fase 4 lo clasificará el backend.",
      ],
      [
        "¿Se puede quitar editando el archivo descargado?",
        "Fuera de Folio, cualquiera puede editar un archivo. Lo que garantiza el sistema es que todo lo que exporta lo incluye.",
      ],
    ],
  },
  {
    id: "RÉR-03",
    parte: "rer",
    titulo: "Mitigación de sesgos y estereotipos",
    estado: "interfaz",
    donde: "Ejemplos cotidianos",
    pide: "Las situaciones cotidianas y ejemplos de la vida real generados no deben promover estereotipos de género, discriminación ni soluciones poco éticas a problemas económicos o sociales.",
    dilo: "Los ejemplos usan doce personas, seis mujeres y seis hombres, con estudios y trabajos que no siguen estereotipos. Rotan a lo largo del libro y alternan el género.",
    cumple: [
      "Perfiles pensados contra el estereotipo: Valentina estudia Ingeniería Mecánica y juega fútbol, José estudia Enfermería, Diego cuida a su hermano menor, Sofía repara celulares y Samuel acompaña a su abuela al médico.",
      `Las personas rotan por libro y dos capítulos seguidos nunca repiten género. En el libro de la prueba salieron ${personas.nombres.join(", ")}: ${personas.mujeres} mujeres y ${personas.hombres} hombres.`,
      "Las soluciones son hábitos responsables: planificar, ahorrar, conversar, pedir ayuda. Nada de atajos poco éticos.",
      "La misma regla se aplica a los libros de ejemplo y a los textos de ejemplo de la app.",
    ],
    recorrido: [
      { titulo: "Lee los ejemplos del capítulo 1", texto: "Abre “Ahorra sin dejar de vivir” y busca “Ejemplos cotidianos”.", captura: "rer03-cap1" },
      {
        titulo: "Compáralos con el capítulo 2",
        texto: "Sigue bajando hasta los ejemplos del capítulo 2: cambian la persona y su género.",
        captura: "rer03-cap2",
      },
      {
        titulo: "Repasa las doce personas",
        texto: "Estas son todas las personas de los ejemplos, con perfiles que evitan los estereotipos de género.",
        bloques: ["personas"],
      },
    ],
    prueba: {
      nombres: ["RÉR-03 · Ejemplos con personas diversas"],
      comprueba: "Extrae las personas de todos los ejemplos del libro y exige que aparezcan mujeres y hombres.",
      resultado: [`<b>${personas.mujeres}</b> mujeres · <b>${personas.hombres}</b> hombres`, personas.nombres.join(" · ")],
    },
    codigo: [
      { archivo: "src/lib/api/mock/content.ts", buscar: "const PEOPLE = [", desc: "Las doce personas y sus contextos" },
      { archivo: "src/lib/api/mock/content.ts", buscar: "const bookSeed = hash(req.ebookSeed)", desc: "Rotación por libro y alternancia de género" },
    ],
    falta: "Reglas de diversidad en los prompts del Redactor y del Agente de Ejercicios, y una revisión automática de sesgos antes de mostrar cada capítulo.",
    preguntas: [
      [
        "¿Doce personas no son pocas?",
        "Para la simulación alcanzan; lo importante es la regla. Con la IA real, el Redactor creará personas nuevas siguiendo reglas de diversidad y una revisión automática buscará sesgos.",
      ],
      [
        "¿Qué encontró la verificación aquí?",
        "Dos defectos: algunos perfiles repetían estereotipos y un libro salió con seis mujeres y ningún hombre. Se reescribieron los perfiles y ahora rotan alternando el género.",
      ],
    ],
  },
];

// ---------------------------------------------------------------------------
// Piezas de HTML
// ---------------------------------------------------------------------------

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const ancla = (id: string) => id.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const ICONOS: Record<Estado, string> = {
  cumple:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="6.5"/><path d="M5.2 8.3l1.9 1.9 3.8-4.1"/></svg>',
  interfaz:
    '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 1.5a6.5 6.5 0 0 1 0 13z" fill="currentColor"/></svg>',
  pendiente:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6.5"/><path d="M8 4.6V8l2.4 1.6"/></svg>',
};
const ICONO_PREGUNTA =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z"/></svg>';

const estadoHtml = (e: Estado) => `<span class="estado estado-${e}">${ICONOS[e]}${ESTADOS[e].etiqueta}</span>`;
const marca = (clase = "") =>
  `<span class="marca ${clase}"><svg viewBox="0 0 32 32" aria-hidden="true"><rect x="7" y="4" width="18" height="24" rx="3.5" fill="currentColor"/><path d="M17.5 4h5v12l-2.5-2-2.5 2z" fill="#0E7C74"/></svg>Folio</span>`;

type Paginas = Map<string, number> | null;
const paginaDe = (paginas: Paginas, clave: string) => (paginas ? String(paginas.get(clave) ?? "") : "00");

// ---------------------------------------------------------------------------
// Capturas señaladas: la zona importante queda iluminada, el resto se oscurece
// y cada marca lleva un número que se explica debajo.
// ---------------------------------------------------------------------------

interface DatosCaptura {
  ancho: number;
  alto: number;
  marcas: { texto: string; cajas: { x: number; y: number; w: number; h: number }[] }[];
}

const CAPTURAS = path.join(SALIDA, "capturas");
const ANCHO_TEXTO = 175.9;
const ALTO_MAXIMO = 84;
let mascaras = 0;

const leyenda = (textos: string[]) =>
  `<ol class="leyenda">${textos.map((t, i) => `<li><span class="n">${i + 1}</span><span>${t}</span></li>`).join("")}</ol>`;

function capturaSenalada(nombre: string) {
  const archivo = path.join(CAPTURAS, `${nombre}.json`);
  if (!fs.existsSync(archivo)) throw new Error(`Falta la captura ${nombre}. Ejecuta antes: npm run guia:capturas`);
  const { ancho: W, alto: H, marcas } = JSON.parse(fs.readFileSync(archivo, "utf8")) as DatosCaptura;
  // Ancho en la página: todo el texto, sin pasar de ALTO_MAXIMO de alto ni ampliar más de 0,27 mm por píxel.
  const anchoMm = Math.min(ANCHO_TEXTO, (ALTO_MAXIMO * W) / H, W * 0.27);
  const escala = anchoMm / W;
  const r = 2.5 / escala;
  const radio = (2.4 / escala).toFixed(1);
  const radioMarca = (1.3 / escala).toFixed(1);
  const id = `senal-${++mascaras}`;
  const cajas = marcas.flatMap((m) => m.cajas);
  const rect = (c: { x: number; y: number; w: number; h: number }, extra: string) =>
    `<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="${radioMarca}" ${extra}/>`;
  const limitar = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
  const numeros = marcas
    .map((m, i) => {
      const c = m.cajas[0];
      // El número va a la izquierda del recuadro; si no cabe, a la derecha; si tampoco, dentro.
      let cx = c.x - r - 5;
      let cy = c.y + Math.min(c.h / 2, r * 1.25);
      if (cx < r + 2) cx = c.x + c.w + r + 5;
      if (cx > W - r - 2) {
        cx = c.x + r + 4;
        cy = c.y + r + 4;
      }
      cy = limitar(cy, r + 2, H - r - 2);
      return `<g><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="#0E7C74" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke"/><text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-family="Lexend, sans-serif" font-weight="600" font-size="${(r * 1.12).toFixed(1)}" fill="#fff">${i + 1}</text></g>`;
    })
    .join("");
  // Las capturas verticales llevan la leyenda al lado para aprovechar el ancho.
  const lado = W / H < 1.3;
  return `<figure class="captura${lado ? " lado" : ""}">
    <div class="captura-img" style="width:${anchoMm.toFixed(1)}mm">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(marcas.map((m) => m.texto).join(" "))}">
      <defs>
        <clipPath id="${id}-borde"><rect width="${W}" height="${H}" rx="${radio}"/></clipPath>
        <mask id="${id}"><rect width="${W}" height="${H}" fill="#fff"/>${cajas.map((c) => rect(c, 'fill="#000"')).join("")}</mask>
      </defs>
      <g clip-path="url(#${id}-borde)">
        <image href="capturas/${nombre}.jpg" width="${W}" height="${H}"/>
        <rect width="${W}" height="${H}" fill="#141821" fill-opacity="0.3" mask="url(#${id})"/>
      </g>
      ${cajas.map((c) => rect(c, 'fill="none" stroke="#fff" stroke-width="5" vector-effect="non-scaling-stroke"')).join("")}
      ${cajas.map((c) => rect(c, 'fill="none" stroke="#0E7C74" stroke-width="2.6" vector-effect="non-scaling-stroke"')).join("")}
      ${numeros}
      <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="${radio}" fill="none" stroke="#D5DAE1" stroke-width="1" vector-effect="non-scaling-stroke"/>
    </svg>
    </div>
    ${leyenda(marcas.map((m) => esc(m.texto)))}
  </figure>`;
}

/** Fragmento del Markdown de ejemplo con líneas señaladas (cada expresión marca la primera línea que coincide). */
function fragmentoMd(desde: number, hasta: number, marcas: [RegExp, string][]) {
  const lineas = markdownEjemplo.slice(desde - 1, hasta);
  const numeroDe = new Map<number, number>();
  marcas.forEach(([re], i) => {
    const j = lineas.findIndex((l, k) => re.test(l) && !numeroDe.has(k));
    if (j < 0) throw new Error(`El fragmento ${desde}-${hasta} no tiene una línea que cumpla ${re}`);
    numeroDe.set(j, i + 1);
  });
  const filas = lineas
    .map((l, k) => {
      const n = numeroDe.get(k);
      return `<div class="md-linea${n ? " marcada" : ""}"><span class="md-num">${desde + k}</span><code>${esc(l) || " "}</code>${n ? `<span class="n">${n}</span>` : "<span></span>"}</div>`;
    })
    .join("");
  return `<figure class="fragmento">
    <div class="md-archivo"><span class="md-cab">ahorra-sin-dejar-de-vivir.md</span>${filas}</div>
    ${leyenda(marcas.map(([, t]) => t))}
  </figure>`;
}

const lineaDe = (buscar: (l: string) => boolean, desde = 0) => markdownEjemplo.findIndex((l, i) => i >= desde && buscar(l)) + 1;

function bloque(b: Bloque) {
  if (b === "arbol") return arbolEncabezados();
  if (b === "escala") return escalaInflesz();
  if (b === "personas") return tablaPersonas();
  if (b === "md-inicio") {
    const fin = lineaDe((l) => l === "## Índice") + 7;
    return fragmentoMd(1, fin, [
      [/^# /, "El título del libro es un encabezado H1 (<code>#</code>)."],
      [/^## Aviso legal/, "Las partes del libro son H2 (<code>##</code>)."],
      [/^> /, "El aviso legal va como bloque de cita (<code>&gt;</code>)."],
      [/^\d+\. /, "El índice es una lista numerada."],
    ]);
  }
  if (b === "md-checklist") {
    const casilla = lineaDe((l) => l.startsWith("- [ ] "));
    const seccion = markdownEjemplo.slice(0, casilla).lastIndexOf("## Ejercicio práctico") + 1;
    return fragmentoMd(seccion, casilla + 2, [
      [/^## Ejercicio práctico/, "Cada sección del capítulo es un H2."],
      [/^- \[ \] /, "Los checklists usan casillas (<code>- [ ]</code>)."],
    ]);
  }
  const total = markdownEjemplo.length;
  const ultima = markdownEjemplo.findLastIndex((l) => l.trim() !== "") + 1;
  return fragmentoMd(Math.max(1, ultima - 5), Math.min(total, ultima), [[/Contenido original/, "Al final del libro, la nota de transparencia."]]);
}

function pasoVisual(paso: Paso, n: number) {
  return `<div class="paso-visual">
    <div class="pv-cab"><span class="pv-num">${n}</span><div><p class="pv-titulo">${paso.titulo}</p><p class="pv-texto">${paso.texto}</p></div></div>
    ${paso.captura ? capturaSenalada(paso.captura) : ""}
    ${(paso.bloques ?? []).map(bloque).join("")}
  </div>`;
}

function arbolEncabezados() {
  const muestra = encabezados.markdown.slice(0, 12);
  const filas = muestra
    .map((l) => {
      const nivel = l.match(/^#+/)?.[0].length ?? 1;
      return `<li class="n${nivel}"><span class="marca-h">H${nivel}</span><code>${esc(l)}</code></li>`;
    })
    .join("");
  return `<div class="arbol">
    <p class="etq">Así empiezan los encabezados del Markdown exportado</p>
    <ol>${filas}</ol>
    <p class="sigue">… y así hasta el capítulo ${md.h1 - 1}: ${md.h1} H1, ${md.h2} H2 y ${md.h3} H3 en total, sin saltar niveles.</p>
  </div>`;
}

function escalaInflesz() {
  const tramos: [number, number, string][] = [
    [0, 40, "Muy difícil"],
    [40, 55, "Algo difícil"],
    [55, 65, "Normal"],
    [65, 80, "Bastante fácil"],
    [80, 100, "Muy fácil"],
  ];
  const v = Math.min(100, Math.max(0, legibilidad.valor));
  return `<div class="escala">
    <p class="etq">Escala INFLESZ · dónde queda el libro de prueba</p>
    <div class="escala-barra">
      ${tramos.map(([a, b, n], i) => `<div class="tramo t${i}" style="width:${b - a}%"><span>${n}</span><small>${a}–${b}</small></div>`).join("")}
      <div class="escala-marca" style="left:${v}%"><b>${num(legibilidad.valor)}</b></div>
      <div class="escala-min" style="left:55%"><span>mínimo exigido: 55</span></div>
    </div>
  </div>`;
}

function tablaPersonas() {
  const columna = (mujer: boolean) =>
    PERSONAS.filter((p) => p.mujer === mujer)
      .map((p) => `<li><b>${esc(p.nombre)}</b> ${esc(p.contexto)}</li>`)
      .join("");
  return `<div class="personas">
    <p class="etq">Las doce personas de los ejemplos (content.ts)</p>
    <div class="personas-cols">
      <div><p class="personas-t">Mujeres</p><ul>${columna(true)}</ul></div>
      <div><p class="personas-t">Hombres</p><ul>${columna(false)}</ul></div>
    </div>
  </div>`;
}

function ficha(r: Req, indice: number, total: number, ctx: Contexto) {
  const p = parte(r.parte);
  const conDatos = (t: string) => t.replaceAll("{PAGINAS_EJEMPLO}", String(ctx.paginasEjemplo));
  const codigo = r.codigo
    .map((c) => `<tr><td class="ruta">${esc(c.archivo)}<span class="ln">:${linea(c.archivo, c.buscar)}</span></td><td class="desc">${c.desc}</td></tr>`)
    .join("");
  return `<article class="ficha" id="${ancla(r.id)}" style="--tela:${p.tela}">
    <header class="ficha-cab">
      <div class="lomo"></div>
      <div>
        <p class="kicker">${p.singular} · ${indice} de ${total}</p>
        <h2><span class="id">${r.id} </span><span class="titulo">${r.titulo}</span></h2>
      </div>
      ${estadoHtml(r.estado)}
    </header>

    <blockquote class="pide"><p class="etq">Qué pide el documento</p><p>${r.pide}</p></blockquote>

    <div class="dilo"><p class="etq">Tu turno · dilo así</p><p class="frase">${r.dilo}</p></div>

    <section class="cumple"><h3>Cómo lo cumple</h3><ul class="puntos">${r.cumple.map((c) => `<li>${conDatos(c)}</li>`).join("")}</ul></section>

    <section class="comprueba">
      <h3>Cómo se comprueba</h3>
      <p>${r.prueba.nombres.map((n) => `<span class="prueba-nombre">${esc(n)}</span>`).join("")}</p>
      <p>${r.prueba.comprueba}</p>
      <div class="chips"><span class="chip chip-ok">${ICONOS.cumple}Prueba superada</span>${r.prueba.resultado.map((x) => `<span class="chip">${conDatos(x)}</span>`).join("")}</div>
    </section>

    <section class="recorrido">
      <h3>Dónde verlo, paso a paso</h3>
      ${r.recorrido.map((paso, i) => pasoVisual(paso, i + 1)).join("")}
    </section>

    <section class="bloque-codigo">
      <h3>Dónde está en el código</h3>
      <table class="codigo"><tbody>${codigo}</tbody></table>
    </section>

    ${r.falta ? `<section class="falta"><h3>Qué falta en la fase 4</h3><p>${r.falta}</p></section>` : ""}

    <section class="preguntas">
      <h3>Si te preguntan…</h3>
      <dl>${r.preguntas.map(([q, a]) => `<div class="pregunta"><span class="q-ico">${ICONO_PREGUNTA}</span><div><dt>${q}</dt><dd>${a}</dd></div></div>`).join("")}</dl>
    </section>
  </article>`;
}

// ---------------------------------------------------------------------------
// Páginas
// ---------------------------------------------------------------------------

interface Contexto {
  qr: string;
  paginasEjemplo: number;
}

const SECCIONES = {
  contenido: "Contenido",
  antes: "Antes de empezar",
  resumen: "Los 16 requerimientos de un vistazo",
  mapa: "Dónde aparece cada requerimiento",
  guion: "Guion de demostración en 5 minutos",
  faq: "Preguntas frecuentes",
  defectos: "Lo que encontró la verificación",
  fase4: "Qué falta para la fase 4",
  glosario: "Glosario",
  pruebas: "Cómo repetir las pruebas",
} as const;

function portada() {
  const tomos = PARTES.map((p, i) => {
    const n = REQS.filter((r) => r.parte === p.clave).length;
    const alto = [36, 31, 33, 30][i];
    return `<div class="tomo" style="--tela:${p.tela};height:${alto}mm"><b>${p.clave === "rer" ? "RÉR" : p.clave.toUpperCase()}</b><span>${n} ${p.corto.toLowerCase()}</span></div>`;
  }).join("");
  return `<section class="portada">
    ${marca("marca-portada")}
    <p class="edicion">Guía de estudio · 2026</p>
    <div class="hoja-portada">
      <span class="cinta" aria-hidden="true"></span>
      <div class="cabeza"><span>Folio</span><span>Guía de requerimientos</span></div>
      <p class="kicker">Qué pide, dónde verlo y cómo explicarlo</p>
      <h1><span class="linea">Cómo se cumple </span><em class="linea">cada requerimiento</em></h1>
      <p class="sub">Los 16 requerimientos del proyecto, uno por uno: qué pide cada uno, cómo mostrarlo en Folio, qué prueba lo demuestra y en qué parte del código está.</p>
      <div class="estante">${tomos}</div>
      <p class="folio-num">1</p>
    </div>
    <div class="pie"><span>Equipo Folio · Ingeniería de Software · UJAP</span><span>Septiembre de 2026</span></div>
  </section>`;
}

function contenido(paginas: Paginas) {
  const fila = (clave: string, texto: string, destino: string) =>
    `<li><a href="#${destino}"><span class="t">${texto}</span><span class="n">${paginaDe(paginas, clave)}</span></a></li>`;
  const grupos = PARTES.map((p) => {
    const reqs = REQS.filter((r) => r.parte === p.clave);
    return `<div class="indice-grupo" style="--tela:${p.tela}">
      <a class="indice-parte" href="#parte-${p.clave}"><span class="mini-tomo"></span><span class="t">${p.numero} · ${p.nombre}</span><span class="n">${paginaDe(paginas, p.nombre)}</span></a>
      <ul class="indice-lista">${reqs.map((r) => fila(r.id, `<b>${r.id}</b> ${r.titulo}`, ancla(r.id))).join("")}</ul>
    </div>`;
  }).join("");
  return `<section class="seccion" id="contenido">
    <p class="kicker">Guía de requerimientos</p>
    <h1>${SECCIONES.contenido}</h1>
    <div class="indice">
      <div>
        <p class="indice-cab">Para empezar</p>
        <ul class="indice-lista">
          ${fila(SECCIONES.antes, SECCIONES.antes, "antes")}
          ${fila(SECCIONES.resumen, SECCIONES.resumen, "resumen")}
          ${fila(SECCIONES.mapa, SECCIONES.mapa, "mapa")}
        </ul>
        ${grupos}
      </div>
      <div>
        <p class="indice-cab">Para cerrar</p>
        <ul class="indice-lista">
          ${fila(SECCIONES.guion, SECCIONES.guion, "guion")}
          ${fila(SECCIONES.faq, SECCIONES.faq, "faq")}
          ${fila(SECCIONES.defectos, SECCIONES.defectos, "defectos")}
          ${fila(SECCIONES.fase4, SECCIONES.fase4, "fase4")}
          ${fila(SECCIONES.glosario, SECCIONES.glosario, "glosario")}
          ${fila(SECCIONES.pruebas, SECCIONES.pruebas, "pruebas")}
        </ul>
        <div class="indice-nota">
          <p class="etq">Cómo está hecha</p>
          <p>Las capturas las toma un recorrido automático por la app (<code>npm run guia:capturas</code>), que también mide dónde está cada elemento señalado. El PDF se arma con <code>npm run guia:pdf</code> a partir de esas capturas, los resultados de las pruebas y el código actual: los números de línea se buscan al generarlo.</p>
          <p>La versión en texto, con las mismas evidencias, está en <code>docs/09-verificacion-requerimientos.md</code>.</p>
        </div>
      </div>
    </div>
  </section>`;
}

const LIBROS: { titulo: string; nicho: string; tela: string; estado: string; turno: boolean; usos: string[] }[] = [
  { titulo: "Semanas que rinden", nicho: "Gestión del tiempo", tela: "#3B4A9E", estado: "Tu turno · índice", turno: true, usos: ["RF-02", "RF-05", "RÉR-02"] },
  { titulo: "Hablar claro sin pelear", nicho: "Resolver conflictos", tela: "#8C2F45", estado: "Tu turno · capítulo 1", turno: true, usos: ["RF-03", "RF-05", "RNF-01", "RNF-03"] },
  {
    titulo: "Ahorra sin dejar de vivir",
    nicho: "Finanzas para universitarios",
    tela: "#2F6B58",
    estado: "Listo · 6 capítulos",
    turno: false,
    usos: ["RF-04", "RF-06", "RA-01", "RA-03", "RÉR-01", "RÉR-02", "RÉR-03"],
  },
  { titulo: "Tu primer empleo sin miedo", nicho: "Primer empleo", tela: "#1E5E73", estado: "Listo · 5 capítulos", turno: false, usos: ["RF-02", "RÉR-02 (sin aviso)"] },
];

function idChip(id: string) {
  const base = id.split(" ")[0];
  const r = REQS.find((x) => x.id === base);
  const tela = r ? parte(r.parte).tela : "#5A606C";
  return `<a class="id-chip" style="--tela:${tela}" href="#${ancla(base)}">${id}</a>`;
}

function antesDeEmpezar(ctx: Contexto) {
  const anatomia: [string, string][] = [
    ["Qué pide el documento", "El texto original de requerimientos.txt, palabra por palabra."],
    ["Tu turno · dilo así", "La explicación corta para decir en voz alta. Marcada con la cinta, como en Folio."],
    ["Cómo lo cumple", "Lo que hace el sistema para cumplirlo."],
    ["Dónde verlo, paso a paso", "Qué tocar en el sitio y una captura por paso, con lo importante señalado."],
    ["Cómo se comprueba", "La prueba automática que lo demuestra y lo que midió."],
    ["Dónde está en el código", "Archivo y línea, para abrirlo si te lo piden."],
    ["Qué falta en la fase 4", "Solo aparece si una parte depende del backend."],
    ["Si te preguntan…", "Preguntas probables del jurado, con su respuesta."],
  ];
  return `<section class="seccion" id="antes">
    <p class="kicker">Cómo usar esta guía</p>
    <h1>${SECCIONES.antes}</h1>
    <p class="entrada">Esta guía te acompaña para demostrar, uno por uno, los 16 requerimientos de <code>docs/requerimientos.txt</code> en la versión publicada de Folio, y para explicarlos con tus palabras. Cada requerimiento tiene su ficha: qué pide, qué decir, dónde tocar, qué prueba lo demuestra y en qué archivo está.</p>

    <div class="acceso">
      <div class="qr">${ctx.qr}</div>
      <div>
        <p class="etq">Abre Folio en tu teléfono o computador</p>
        <p class="url">${SITIO.replace("https://", "")}</p>
        <ol class="pasos">
          <li>Escanea el código o escribe la dirección.</li>
          <li>Toca <b>“Continuar con Google”</b>. El acceso es simulado: no pide ninguna cuenta real.</li>
          <li>Para ir rápido, abre <b>Ajustes → Demostración → Velocidad de los agentes: Rápida</b>. Para medir tiempos (RNF-02), déjala en Normal.</li>
          <li>Si la biblioteca queda desordenada, usa <b>Ajustes → Demostración → Restaurar ejemplos</b>.</li>
        </ol>
      </div>
    </div>

    <h3>Los libros de ejemplo</h3>
    <p class="nota">La biblioteca trae cuatro libros en distintas etapas. Te ahorran esperar cuando quieres mostrar una pantalla concreta.</p>
    <table class="libros"><tbody>
      ${LIBROS.map(
        (l) => `<tr>
        <td class="libro"><span class="mini-portada" style="--tela:${l.tela}"></span><span><b>${l.titulo}</b><small>${l.nicho}</small></span></td>
        <td class="libro-estado">${l.turno ? '<span class="mini-cinta"></span>' : ""}${l.estado}</td>
        <td class="libro-usos">${l.usos.map(idChip).join("")}</td>
      </tr>`,
      ).join("")}
    </tbody></table>

    <div class="sin-corte"><h3>Cómo leer cada ficha</h3>
    <p class="nota">En las capturas, lo que importa queda iluminado y el resto se oscurece. Los números verdes coinciden con la lista que hay debajo de cada captura.</p>
    <dl class="anatomia">${anatomia.map(([t, d], i) => `<div><dt><span class="num">${i + 1}</span>${t}</dt><dd>${d}</dd></div>`).join("")}</dl></div>

    <h3>Qué significa cada estado</h3>
    <div class="estados">
      ${(Object.keys(ESTADOS) as Estado[]).map((e) => `<div class="estado-fila">${estadoHtml(e)}<p>${ESTADOS[e].texto}</p></div>`).join("")}
    </div>
    <div class="clave">
      <p class="etq">La idea clave para explicar los “Cumple en la interfaz”</p>
      <p>Hoy los cuatro agentes se simulan en el navegador con textos de plantilla. Los requerimientos sobre <b>cómo escribe la IA</b> (tono, tiempos, coherencia, claridad, originalidad y sesgos) ya tienen su interfaz, sus reglas y sus pruebas; quedan cumplidos del todo cuando el Redactor sea un modelo de lenguaje real, en la fase 4. Decirlo así es honesto y muestra que el equipo sabe qué falta.</p>
    </div>
  </section>`;
}

function resumen(paginas: Paginas) {
  const cuenta = (e: Estado) => REQS.filter((r) => r.estado === e).length;
  const filas = REQS.map((r) => {
    const p = parte(r.parte);
    return `<tr style="--tela:${p.tela}">
      <td class="r-id"><a href="#${ancla(r.id)}">${r.id}</a></td>
      <td class="r-titulo">${r.titulo}</td>
      <td class="r-donde">${r.donde}</td>
      <td class="r-estado">${estadoHtml(r.estado)}</td>
      <td class="r-pag">${paginaDe(paginas, r.id)}</td>
    </tr>`;
  }).join("");
  return `<section class="seccion" id="resumen">
    <p class="kicker">Resumen</p>
    <h1>${SECCIONES.resumen}</h1>
    <p class="entrada">${cuenta("cumple")} se cumplen hoy por completo, ${cuenta("interfaz")} están listos en la interfaz a la espera de la IA real y ${cuenta("pendiente")} depende del backend de la fase 4. Las 18 pruebas automáticas pasan en local y también contra el sitio publicado.</p>
    <div class="barra" role="img" aria-label="${cuenta("cumple")} cumplen, ${cuenta("interfaz")} cumplen en la interfaz, ${cuenta("pendiente")} pendiente">
      <span class="b-cumple" style="flex:${cuenta("cumple")}"></span><span class="b-interfaz" style="flex:${cuenta("interfaz")}"></span><span class="b-pendiente" style="flex:${cuenta("pendiente")}"></span>
    </div>
    <div class="barra-leyenda">
      <span><i class="b-cumple"></i><b>${cuenta("cumple")}</b> Cumple</span>
      <span><i class="b-interfaz"></i><b>${cuenta("interfaz")}</b> Cumple en la interfaz</span>
      <span><i class="b-pendiente"></i><b>${cuenta("pendiente")}</b> Pendiente · fase 4</span>
      <span class="barra-pruebas"><b>18 de 18</b> pruebas superadas</span>
    </div>
    <table class="resumen">
      <thead><tr><th>ID</th><th>Requerimiento</th><th>Dónde lo ves</th><th>Estado</th><th>Pág.</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>
  </section>`;
}

function mapa() {
  const paradas: { nombre: string; quien: string; que: string; tu?: boolean; ids: string[] }[] = [
    { nombre: "Inicio", quien: "Tú", que: "Eliges un nicho o escribes tu idea. La ficción se rechaza con alternativas.", ids: ["RF-01", "RF-02", "RÉR-02"] },
    { nombre: "Investigación", quien: "Agente Investigador", que: "Propone título, subtítulo e índice de 5 a 7 capítulos.", ids: ["RF-02", "RNF-04"] },
    { nombre: "Revisión del índice", quien: "Tú · primera pausa", que: "Editas, reordenas, agregas o quitas capítulos y apruebas.", tu: true, ids: ["RF-05", "RF-02", "RÉR-02"] },
    { nombre: "Capítulo 1", quien: "Redactor + Ejercicios", que: "Se escribe en vivo, sección por sección, y termina con su ejercicio.", ids: ["RF-03", "RF-04", "RNF-02"] },
    { nombre: "Revisión del capítulo 1", quien: "Tú · segunda pausa", que: "Ajustas el tono y apruebas. Este capítulo marca el resto.", tu: true, ids: ["RF-05", "RNF-01", "RNF-03"] },
    { nombre: "Capítulos 2 en adelante", quien: "Redactor + Ejercicios", que: "Se escriben uno detrás de otro, con ejemplos de personas diversas.", ids: ["RNF-02", "RNF-03", "RA-02", "RÉR-03"] },
    { nombre: "Libro final", quien: "Agente Maquetador", que: "Revisas el texto y eliges portada, letra, tamaño y página.", ids: ["RA-01", "RA-03", "RÉR-02"] },
    { nombre: "Exportar", quien: "Tú", que: "Descargas el libro en Markdown o PDF.", ids: ["RF-06", "RA-01", "RÉR-01"] },
  ];
  return `<section class="seccion" id="mapa">
    <p class="kicker">Mapa</p>
    <h1>${SECCIONES.mapa}</h1>
    <p class="entrada">El recorrido de un libro en Folio tiene ocho paradas. En las dos marcadas con la cinta decides tú; en el resto trabaja un agente. Usa este mapa para saber en qué pantalla mostrar cada requerimiento.</p>
    <ol class="ruta">
      ${paradas
        .map(
          (p, i) => `<li class="${p.tu ? "tu" : ""}">
        <span class="punto">${i + 1}</span>
        <div><p class="nombre">${p.nombre}${p.tu ? '<span class="mini-cinta"></span>' : ""}</p><p class="quien">${p.quien}</p><p class="que">${p.que}</p></div>
        <div class="ids">${p.ids.map(idChip).join("")}</div>
      </li>`,
        )
        .join("")}
    </ol>
  </section>`;
}

function divisor(p: Parte, paginas: Paginas) {
  const reqs = REQS.filter((r) => r.parte === p.clave);
  return `<section class="divisor" id="parte-${p.clave}" style="--tela:${p.tela}">
    ${marca("marca-blanca")}
    <div class="dentro">
      <p class="num">${p.numero}</p>
      <h1><span class="linea">${p.lineas[0]}</span><span class="linea">${p.lineas[1]}</span></h1>
      <p class="desc">${p.desc}</p>
      <ul>${reqs.map((r) => `<li><a href="#${ancla(r.id)}"><span class="i">${r.id}</span><span class="t">${r.titulo}</span><span class="n">${paginaDe(paginas, r.id)}</span></a></li>`).join("")}</ul>
    </div>
  </section>`;
}

function guion() {
  const pasos: { hora: string; donde: string; accion: string; decir: string; ids: string[] }[] = [
    {
      hora: "0:00",
      donde: "Inicio",
      accion: "Muestra los chips de nichos y escribe “Escribe una novela de dragones”.",
      decir: "Folio escribe guías prácticas de crecimiento personal sobre situaciones reales. Si le pido ficción, no crea el libro y me propone alternativas.",
      ids: ["RF-01"],
    },
    {
      hora: "0:40",
      donde: "Inicio",
      accion: "Toca “Finanzas para universitarios”, elige 5 capítulos y envía.",
      decir: "Elijo el tema y el número de capítulos, que solo puede ir de 5 a 7. Ahora trabaja el Investigador.",
      ids: ["RF-02", "RNF-04"],
    },
    {
      hora: "1:10",
      donde: "Revisión del índice",
      accion: "Señala la cinta, las papeleras desactivadas y el aviso legal. Agrega capítulos hasta 7 y aprueba.",
      decir: "Primera pausa: el sistema se detiene y me espera. Con 5 no puedo quitar y con 7 no puedo agregar. Como el tema es financiero, ya me avisa que llevará aviso legal.",
      ids: ["RF-05", "RF-02", "RÉR-02"],
    },
    {
      hora: "2:00",
      donde: "Capítulo 1",
      accion: "Mira “Tu libro” mientras se escribe.",
      decir: "El texto aparece en vivo, sección por sección. Cada capítulo tiene las mismas cinco partes.",
      ids: ["RNF-02", "RF-03"],
    },
    {
      hora: "2:30",
      donde: "Revisión del capítulo 1",
      accion: "Toca “Más cercano” → “Aplicar ajustes”. Muestra el ejercicio del final y aprueba.",
      decir: "Segunda pausa: este capítulo marca el tono de todo el libro y lo puedo ajustar con un toque. El ejercicio solo puede ser un checklist o un reto de 24 a 48 horas.",
      ids: ["RF-05", "RNF-01", "RNF-03", "RF-04"],
    },
    {
      hora: "3:20",
      donde: "Escribiendo tu libro",
      accion: "Señala que solo un capítulo dice “Escribiendo”.",
      decir: "Los capítulos se escriben en orden, siguiendo al capítulo 1, para que el libro sea coherente. Los ejemplos usan personas diversas, sin estereotipos.",
      ids: ["RNF-03", "RÉR-03"],
    },
    {
      hora: "3:45",
      donde: "Libro final",
      accion: "En Texto, elige “Aviso legal” (bloqueado). En Portada y estilo, pon un amarillo claro y usa el tono accesible.",
      decir: "El aviso legal no se puede quitar. El PDF sale con hoja blanca, Roboto, Arial o Helvetica desde 11 pt, y la portada siempre tiene buen contraste.",
      ids: ["RÉR-02", "RA-03", "RA-01"],
    },
    {
      hora: "4:20",
      donde: "Exportar",
      accion: "Descarga el Markdown y abre la vista de impresión del PDF.",
      decir: "Exporto en Markdown y PDF, con encabezados H1, H2 y H3 para lectores de pantalla y la nota de contenido original.",
      ids: ["RF-06", "RA-01", "RÉR-01"],
    },
    {
      hora: "4:45",
      donde: "Cierre",
      accion: "Vuelve a la biblioteca.",
      decir: `El texto es claro: INFLESZ ${num(legibilidad.valor)}. Lo que depende de la IA real ya tiene su interfaz y sus pruebas; en la fase 4 conectamos el backend de cuatro agentes.`,
      ids: ["RA-02", "RNF-04"],
    },
  ];
  return `<section class="seccion" id="guion">
    <p class="kicker">Para la presentación</p>
    <h1>${SECCIONES.guion}</h1>
    <p class="entrada">Un solo recorrido que toca los 16 requerimientos. Antes de empezar, pon la velocidad en Rápida y ten a mano los libros de ejemplo por si el tiempo aprieta.</p>
    <ol class="guion">
      ${pasos
        .map(
          (s) => `<li>
        <span class="hora">${s.hora}</span>
        <div>
          <p class="g-donde">${s.donde}</p>
          <p class="g-accion">${s.accion}</p>
          <p class="g-decir">“${s.decir}”</p>
          <div class="ids">${s.ids.map(idChip).join("")}</div>
        </div>
      </li>`,
        )
        .join("")}
    </ol>
    <div class="clave">
      <p class="etq">Si el tiempo aprieta</p>
      <p>Después del paso 3, salta a “Hablar claro sin pelear”, que ya está en la segunda pausa, y luego a “Ahorra sin dejar de vivir”, que ya está listo para exportar.</p>
    </div>
  </section>`;
}

function preguntasFrecuentes() {
  const faq: [string, string][] = [
    [
      "¿Por qué no hay IA real todavía?",
      "El proyecto va por fases: análisis, diseño, interfaz con datos simulados y, después, backend. La interfaz respeta el contrato de la API (docs/03), así que las reglas se validan antes de pagar por un modelo y el backend se conecta sin cambiar los componentes.",
    ],
    [
      "¿Qué son los datos simulados (mocks)?",
      "Código que imita al backend dentro del navegador: genera índices y capítulos de plantilla, con streaming y pausas, y guarda todo en el almacenamiento local del navegador.",
    ],
    [
      "¿Dónde se guardan los libros?",
      "En el navegador (localStorage), separados por usuario. Por eso no se comparten entre dispositivos. En la fase 4 irán a una base de datos (la propuesta es Supabase).",
    ],
    [
      "¿Cómo sé que las pruebas son de verdad?",
      "Son 18 pruebas de Playwright que abren Edge, usan la app como lo haría una persona y fallan si algo no se cumple. Pasan en local y contra el sitio publicado, y encontraron cuatro defectos reales que se corrigieron.",
    ],
    [
      "¿Por qué seis requerimientos no están en “Cumple”?",
      "Porque hablan de cómo escribe la IA. Marcarlos como cumplidos con textos de plantilla no sería honesto: la interfaz está lista y la prueba pasa, pero la confirmación final llega con el modelo real.",
    ],
    [
      "¿Qué pasa si recargo en medio de la redacción?",
      "El trabajo se retoma donde iba y las pausas se conservan (RF-05).",
    ],
    [
      "¿Con qué está hecho?",
      "Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS 4, Radix UI y Motion. Backend (fase 4): Python con FastAPI y LangGraph, con streaming por SSE. El modelo de lenguaje todavía no está decidido y se usará a través de una capa de abstracción.",
    ],
    [
      "¿Cómo se publica el sitio?",
      "Con GitHub Pages. Cada push a la rama main que toque el frontend compila una versión estática y la publica sola.",
    ],
  ];
  return `<section class="seccion" id="faq">
    <p class="kicker">Para la ronda de preguntas</p>
    <h1>${SECCIONES.faq}</h1>
    <p class="entrada">Preguntas generales sobre el proyecto que no son de un requerimiento en particular.</p>
    <dl class="faq">${faq.map(([q, a]) => `<div class="pregunta"><span class="q-ico">${ICONO_PREGUNTA}</span><div><dt>${q}</dt><dd>${a}</dd></div></div>`).join("")}</dl>
  </section>`;
}

function defectos() {
  const filas: [string, string, string][] = [
    ["RÉR-03", "Algunos perfiles repetían estereotipos (mujer enfermera y cuidadora, hombre futbolista).", "Se reescribieron con roles no estereotipados."],
    ["RÉR-03", "Las personas se elegían al azar por capítulo y un libro salió con seis mujeres y ningún hombre: la prueba falló.", "Ahora rotan a lo largo del libro y alternan el género."],
    ["RA-01", "El PDF no tenía H1: el título estaba oculto y los niveles empezaban en H2.", "Portadilla visible con el título en H1; capítulos en H1, secciones en H2 y subtemas en H3."],
    ["RA-01", "En la vista previa, los subtemas tenían el mismo nivel que las secciones.", "Los subtemas bajaron un nivel."],
  ];
  return `<section class="seccion" id="defectos">
    <p class="kicker">Calidad</p>
    <h1>${SECCIONES.defectos}</h1>
    <p class="entrada">Las pruebas no solo confirmaron: encontraron cuatro defectos reales, que se corrigieron antes de publicar. Es un buen ejemplo para explicar por qué cada requerimiento tiene su prueba.</p>
    <table class="tabla"><thead><tr><th>Req.</th><th>Qué pasaba</th><th>Cómo se corrigió</th></tr></thead>
    <tbody>${filas.map(([id, p, c]) => `<tr><td>${idChip(id)}</td><td>${p}</td><td>${c}</td></tr>`).join("")}</tbody></table>
  </section>`;
}

function fase4() {
  const filas: [string[], string][] = [
    [["RNF-04"], "Backend con FastAPI y LangGraph: los cuatro agentes como módulos y un archivo de prompt por agente."],
    [["RF-05"], "Pausas con <code>interrupt()</code> de LangGraph y un checkpointer persistente. La interfaz ya espera ese comportamiento."],
    [["RNF-01"], "Temperatura y prompt de estilo del Redactor, con una rúbrica de tono."],
    [["RNF-02"], "Medir el tiempo real por capítulo con el proveedor elegido (meta: el 95 % por debajo de 60 s)."],
    [["RNF-03"], "Guía de estilo extraída del capítulo 1 y resúmenes de los capítulos anteriores en cada llamada."],
    [["RA-02"], "Reglas de lenguaje claro en el prompt y medir INFLESZ sobre los textos reales."],
    [["RÉR-01"], "Instrucciones de originalidad en los prompts y, si hace falta, verificación de similitud."],
    [["RÉR-03"], "Reglas de diversidad en los prompts y revisión automática de sesgos."],
    [["RF-01", "RÉR-02"], "Clasificar la ficción y los temas sensibles con el modelo, en el servidor."],
    [["RF-06", "RA-01", "RA-03"], "PDF generado en el servidor por el Agente Maquetador, con las mismas reglas de estructura, letra y contraste."],
  ];
  return `<section class="seccion" id="fase4">
    <p class="kicker">Lo que viene</p>
    <h1>${SECCIONES.fase4}</h1>
    <p class="entrada">La interfaz ya espera al backend. Esto es lo que se agrega para que los requerimientos marcados como “Cumple en la interfaz” o “Pendiente” queden cumplidos del todo. El paso a paso técnico está en <code>docs/08-frontend.md</code> §3.</p>
    <table class="tabla"><thead><tr><th>Req.</th><th>Qué se agrega</th></tr></thead>
    <tbody>${filas.map(([ids, t]) => `<tr><td class="ids-celda">${ids.map(idChip).join("")}</td><td>${t}</td></tr>`).join("")}</tbody></table>
  </section>`;
}

function glosario() {
  const terminos: [string, string][] = [
    ["Agente", "Un programa con un rol concreto (investigar, redactar, crear ejercicios o maquetar) que usa un modelo de lenguaje con sus propias instrucciones."],
    ["Aviso legal", "Texto que aclara que el libro es educativo y no sustituye a un profesional. Obligatorio en temas sensibles (RÉR-02)."],
    ["Checkpointer", "La pieza de LangGraph que guarda el estado del grafo para retomarlo después de una pausa."],
    ["Contraste", "Relación de luminancia entre el texto y el fondo. WCAG pide al menos 4,5:1 para texto normal."],
    ["Fachada api", "El único punto por el que la interfaz pide datos. Hoy responde la simulación; en la fase 4, el backend."],
    ["Guardarraíl", "Una regla que filtra la entrada antes de que trabajen los agentes; aquí, rechazar la ficción."],
    ["HITL", "Human in the loop: una persona aprueba los pasos críticos de un proceso automático."],
    ["INFLESZ", "Escala de legibilidad para textos en español. De 65 a 80 es “bastante fácil”."],
    ["LangGraph", "Librería de Python para construir flujos de agentes como un grafo, con pausas y estado guardado."],
    ["Lector de pantalla", "Programa que lee en voz alta lo que hay en pantalla: NVDA, VoiceOver o TalkBack."],
    ["localStorage", "Almacenamiento del navegador donde hoy se guardan los libros de cada usuario."],
    ["Markdown", "Formato de texto con marcas simples: # para títulos, - para listas y > para citas."],
    ["Mock", "Código que imita al backend para construir y probar la interfaz sin él."],
    ["Nicho", "El área temática del libro: finanzas, tiempo, conflictos, primer empleo…"],
    ["PDF etiquetado", "PDF que guarda la estructura del documento (títulos, párrafos, orden de lectura) además de su aspecto."],
    ["Playwright", "Herramienta que controla un navegador para automatizar pruebas como si fuera una persona."],
    ["Punto de control", "Cada una de las dos pausas en las que apruebas: el índice y el capítulo 1."],
    ["SSE", "Server-Sent Events: canal por el que el servidor envía eventos al navegador en tiempo real."],
    ["Streaming", "Mostrar el texto a medida que se genera, en lugar de esperar a que termine."],
    ["Temperatura", "Parámetro del modelo que regula cuánto varía el texto: baja es predecible y alta, más creativa."],
    ["WCAG 2.2 AA", "Pautas internacionales de accesibilidad web. AA es el nivel que se exige habitualmente."],
  ];
  return `<section class="seccion" id="glosario">
    <p class="kicker">Referencia</p>
    <h1>${SECCIONES.glosario}</h1>
    <dl class="glosario">${terminos.map(([t, d]) => `<div><dt>${t}</dt><dd>${d}</dd></div>`).join("")}</dl>
  </section>`;
}

function comoProbar() {
  return `<section class="seccion" id="pruebas">
    <p class="kicker">Referencia</p>
    <h1>${SECCIONES.pruebas}</h1>
    <p class="entrada">Cualquiera del equipo puede volver a comprobarlo todo. Hace falta Node.js 20 o superior y Microsoft Edge.</p>
    <h3>En tu computador</h3>
    <pre><code>cd frontend
npm install
npm run test:e2e</code></pre>
    <p>Tarda cerca de un minuto y medio. Guarda las capturas en <code>frontend/e2e/evidencias/</code> y un informe HTML en <code>frontend/e2e/informe/</code>.</p>
    <h3>Contra el sitio publicado</h3>
    <pre><code># Git Bash, macOS o Linux
E2E_BASE_URL=${SITIO.replace(/\/$/, "")} npm run test:e2e

# PowerShell
$env:E2E_BASE_URL="${SITIO.replace(/\/$/, "")}"; npm run test:e2e</code></pre>
    <h3>Volver a generar esta guía</h3>
    <pre><code>npm run guia:capturas   # recorre la app y toma las capturas señaladas (~2 min)
npm run guia:pdf        # arma el PDF (~30 s)</code></pre>
    <p>Las capturas quedan en <code>docs/guia/capturas/</code>, cada una con un JSON que dice dónde van las marcas.</p>
    <h3>Dónde está cada cosa</h3>
    <table class="tabla"><tbody>
      <tr><td><code>docs/09-verificacion-requerimientos.md</code></td><td>Esta verificación en texto, con las mismas evidencias.</td></tr>
      <tr><td><code>docs/verificacion/</code></td><td>Capturas, datos medidos y los ejemplos exportados (.md y .pdf).</td></tr>
      <tr><td><code>frontend/e2e/requisitos.spec.ts</code></td><td>Las 18 pruebas de aceptación, una por requerimiento.</td></tr>
      <tr><td><code>frontend/e2e/capturas-guia.spec.ts</code></td><td>El recorrido que toma las capturas de esta guía.</td></tr>
      <tr><td><code>frontend/scripts/guia-requerimientos.mts</code></td><td>El generador de esta guía.</td></tr>
    </tbody></table>
  </section>`;
}

function contraportada(ctx: Contexto) {
  return `<section class="contraportada">
    <div class="contra-centro">
      ${marca("marca-grande")}
      <p class="contra-texto">Ebooks cortos de crecimiento personal, escritos por cuatro agentes y aprobados por ti.</p>
      <div class="contra-qr">${ctx.qr}</div>
      <p class="contra-url">${SITIO.replace("https://", "")}</p>
      <p class="contra-url">${REPO.replace("https://", "")}</p>
    </div>
    <p class="contra-pie">Equipo Folio · Ingeniería de Software · UJAP · 2026</p>
  </section>`;
}

// ---------------------------------------------------------------------------
// Estilos
// ---------------------------------------------------------------------------

const CSS = `
@page {
  size: letter;
  margin: 23mm 20mm 21mm;
  @top-left { content: "Folio"; font-family: Lexend, sans-serif; font-weight: 600; font-size: 8.5pt; color: #1B1D23; vertical-align: bottom; padding-bottom: 6mm; }
  @top-right { content: "Guía de requerimientos"; font-family: Onest, sans-serif; font-size: 8pt; color: #6E7480; vertical-align: bottom; padding-bottom: 6mm; }
  @bottom-center { content: counter(page); font-family: Lexend, sans-serif; font-weight: 500; font-size: 8.5pt; color: #5A606C; vertical-align: top; padding-top: 7mm; }
}
@page rf { @top-right { content: "Parte I · Requerimientos funcionales"; } }
@page rnf { @top-right { content: "Parte II · Requerimientos no funcionales"; } }
@page ra { @top-right { content: "Parte III · Accesibilidad"; } }
@page rer { @top-right { content: "Parte IV · Éticos y de responsabilidad"; } }
@page completa { margin: 0; @top-left { content: none; } @top-right { content: none; } @bottom-center { content: none; } }

:root {
  --mesa: #EEF0F3; --texto: #1B1D23; --grafito: #5A606C; --tenue: #6E7480; --linea: #E3E6EB;
  --control: #F1F3F6; --borde: #D5DAE1; --tinta: #0E7C74; --tinta-oscura: #0B5A53; --menta: #DFF1EE;
  --cuerpo: #353A43;
}
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: Onest, "Segoe UI", sans-serif; font-size: 9.8pt; line-height: 1.5; color: var(--texto); background: #fff; }
/* pre-wrap conserva el espacio al final de cada línea: sin él, Edge junta las palabras en los marcadores del PDF. */
h1, h2, h3 { font-family: Lexend, sans-serif; font-weight: 500; letter-spacing: -0.02em; margin: 0; white-space: pre-wrap; }
p { margin: 0 0 2mm; }
a { color: inherit; text-decoration: none; }
b, strong { font-weight: 600; }
code, pre { font-family: "Roboto Mono", Consolas, monospace; }
code { font-size: 0.86em; background: var(--control); border-radius: 1mm; padding: 0.15mm 0.9mm; }
.kicker { font-family: Lexend, sans-serif; font-weight: 600; font-size: 7.4pt; letter-spacing: 0.13em; text-transform: uppercase; color: var(--tinta); margin-bottom: 2.2mm; }
.etq { font-family: Lexend, sans-serif; font-weight: 600; font-size: 6.9pt; letter-spacing: 0.11em; text-transform: uppercase; color: var(--tenue); margin-bottom: 1.4mm; }
.nota { color: var(--grafito); font-size: 9pt; }

/* Marca */
.marca { display: inline-flex; align-items: center; gap: 1.6mm; font-family: Lexend, sans-serif; font-weight: 600; font-size: 13pt; letter-spacing: -0.02em; color: var(--texto); }
.marca svg { width: 6.2mm; height: 6.2mm; }

/* Portada */
.portada { page: completa; position: relative; width: 215.9mm; height: 279.3mm; overflow: hidden; background: var(--mesa); break-after: page; }
.marca-portada { position: absolute; left: 22mm; top: 18mm; }
.edicion { position: absolute; right: 22mm; top: 20mm; font-size: 8.5pt; color: var(--grafito); margin: 0; }
.hoja-portada { position: absolute; left: 28mm; right: 28mm; top: 44mm; height: 184mm; background: #fff; border-radius: 5.5mm; padding: 13mm 16mm 9mm; display: flex; flex-direction: column;
  box-shadow: 0 2.4mm 0 -1.4mm #fff, 0 2.4mm 0 -1.1mm #DADEE4, 0 4.6mm 0 -2.8mm #fff, 0 4.6mm 0 -2.5mm #DADEE4, 0 8mm 18mm rgba(20, 24, 33, 0.08); }
.cinta { position: absolute; right: 17mm; top: -1mm; width: 8.5mm; height: 30mm; background: var(--tinta); clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%); }
.hoja-portada .cabeza { display: flex; justify-content: space-between; font-size: 7.6pt; color: var(--tenue); padding-right: 20mm; margin-bottom: 20mm; }
.hoja-portada h1 { font-size: 34pt; line-height: 1.06; letter-spacing: -0.035em; max-width: 125mm; }
.hoja-portada h1 em { font-style: normal; color: var(--tinta); }
.linea { display: block; }
.hoja-portada .sub { font-size: 11.5pt; line-height: 1.5; color: var(--grafito); margin-top: 6mm; max-width: 118mm; }
.estante { margin-top: auto; display: flex; gap: 3.2mm; align-items: flex-end; padding: 0 2mm; border-bottom: 0.7mm solid var(--linea); }
.tomo { width: 23mm; border-radius: 0.8mm 2mm 2mm 0.8mm; color: #fff; padding: 3mm 2.4mm 2.6mm 4.2mm; display: flex; flex-direction: column; justify-content: space-between;
  background-color: var(--tela); background-image: linear-gradient(90deg, rgba(0,0,0,0.28) 0, rgba(255,255,255,0.16) 7%, transparent 15%); }
.tomo b { font-family: Lexend, sans-serif; font-size: 13pt; font-weight: 600; letter-spacing: -0.02em; }
.tomo span { font-size: 6.6pt; line-height: 1.25; }
.folio-num { text-align: center; font-size: 7.6pt; color: var(--tenue); margin: 5mm 0 0; }
.portada .pie { position: absolute; left: 28mm; right: 28mm; bottom: 19mm; display: flex; justify-content: space-between; font-size: 8.8pt; color: var(--grafito); }

/* Secciones */
.seccion { break-before: page; }
.seccion > h1 { font-size: 25pt; line-height: 1.12; letter-spacing: -0.03em; margin-bottom: 4mm; }
.entrada { font-size: 11pt; line-height: 1.55; color: var(--cuerpo); max-width: 158mm; margin-bottom: 6mm; }
.seccion h3 { font-size: 11pt; font-weight: 600; letter-spacing: -0.01em; margin: 5.5mm 0 2.2mm; break-after: avoid; }

/* Contenido */
.indice { display: grid; grid-template-columns: 1.15fr 1fr; gap: 10mm; margin-top: 6mm; }
.indice-cab { font-family: Lexend, sans-serif; font-weight: 600; font-size: 7.4pt; letter-spacing: 0.12em; text-transform: uppercase; color: var(--tenue); margin: 0 0 1mm; }
.indice-lista { list-style: none; margin: 0; padding: 0; }
.indice-lista a, .indice-parte { display: flex; align-items: baseline; gap: 3mm; padding: 1.1mm 0; border-bottom: 0.25mm solid var(--linea); font-size: 9.4pt; }
.indice-lista .t, .indice-parte .t { flex: 1; }
.indice-lista b { font-family: Lexend, sans-serif; font-weight: 600; color: var(--tela, var(--texto)); display: inline-block; min-width: 13mm; }
.indice .n { font-family: Lexend, sans-serif; font-weight: 500; font-size: 9pt; color: var(--grafito); font-variant-numeric: tabular-nums; }
.indice-grupo { margin-top: 4.6mm; }
.indice-parte { font-family: Lexend, sans-serif; font-weight: 500; font-size: 10.2pt; border-bottom: 0.4mm solid var(--tela); align-items: center; }
.mini-tomo { width: 2.6mm; height: 4.4mm; border-radius: 0.4mm 0.9mm 0.9mm 0.4mm; background: var(--tela); flex: none; }
.indice-nota { margin-top: 9mm; background: var(--mesa); border-radius: 3.5mm; padding: 5mm 5.5mm 3mm; font-size: 9pt; color: var(--cuerpo); }

/* Antes de empezar */
.acceso { display: grid; grid-template-columns: 36mm 1fr; gap: 7mm; align-items: center; background: var(--mesa); border-radius: 4mm; padding: 6mm; break-inside: avoid; }
.qr { background: #fff; border-radius: 3mm; padding: 3.2mm; }
.qr svg { display: block; width: 100%; height: auto; }
.url { font-family: "Roboto Mono", monospace; font-size: 9.2pt; color: var(--tinta-oscura); font-weight: 500; margin-bottom: 3mm; }
.libros { width: 100%; border-collapse: collapse; }
.libros td { padding: 2.2mm 0; border-bottom: 0.25mm solid var(--linea); vertical-align: middle; }
.libro { display: flex; align-items: center; gap: 3mm; }
.libro small { display: block; font-size: 8pt; color: var(--tenue); }
.mini-portada { width: 5.6mm; height: 8.2mm; border-radius: 0.5mm 1.2mm 1.2mm 0.5mm; flex: none; background-color: var(--tela); background-image: linear-gradient(90deg, rgba(0,0,0,0.25) 0, rgba(255,255,255,0.18) 12%, transparent 26%); }
.libro-estado { font-size: 8.8pt; color: var(--grafito); white-space: nowrap; padding-right: 4mm !important; }
.libro-usos { text-align: right; }
.mini-cinta { display: inline-block; width: 2.2mm; height: 3.8mm; background: var(--tinta); clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%); margin: 0 1.6mm 0 0; vertical-align: -0.4mm; }
.anatomia { display: grid; grid-template-columns: 1fr 1fr; gap: 2.5mm 8mm; margin: 0; }
.anatomia div { break-inside: avoid; }
.anatomia dt { font-weight: 600; font-size: 9.4pt; display: flex; align-items: center; gap: 2mm; }
.anatomia dd { margin: 0.4mm 0 0 6.8mm; font-size: 8.8pt; color: var(--grafito); }
.anatomia .num { width: 4.8mm; height: 4.8mm; border-radius: 50%; background: var(--mesa); font-family: Lexend, sans-serif; font-size: 7pt; font-weight: 600; display: inline-grid; place-items: center; flex: none; }
.estados { display: grid; gap: 2.4mm; }
.estado-fila { display: grid; grid-template-columns: 44mm 1fr; gap: 4mm; align-items: center; }
.estado-fila p { margin: 0; font-size: 9pt; color: var(--cuerpo); }
.sin-corte { break-inside: avoid; }
.clave { margin-top: 6mm; border-left: 0.9mm solid var(--tinta); background: #F7F8FA; border-radius: 0 3mm 3mm 0; padding: 4mm 5mm 2.5mm; break-inside: avoid; font-size: 9.4pt; color: var(--cuerpo); }

/* Estado */
.estado { display: inline-flex; align-items: center; gap: 1.5mm; padding: 1.1mm 2.8mm 1.1mm 2.1mm; border-radius: 99px; font-weight: 600; font-size: 7.9pt; line-height: 1.1; white-space: nowrap; justify-self: start; }
.estado svg { width: 3.4mm; height: 3.4mm; flex: none; }
.estado-cumple { background: var(--menta); color: var(--tinta-oscura); }
.estado-interfaz { background: #FAF0D7; color: #6B4700; }
.estado-pendiente { background: #ECEEF2; color: #454B56; }

/* Resumen */
.barra { display: flex; gap: 0.8mm; height: 3.2mm; margin: 0 0 2.4mm; }
.barra span { border-radius: 99px; }
.b-cumple { background: var(--tinta); } .b-interfaz { background: #E1B350; } .b-pendiente { background: #B8BEC8; }
.barra-leyenda { display: flex; gap: 6mm; font-size: 8.8pt; color: var(--grafito); margin-bottom: 6mm; align-items: center; }
.barra-leyenda i { display: inline-block; width: 2.6mm; height: 2.6mm; border-radius: 50%; margin-right: 1.4mm; vertical-align: -0.2mm; }
.barra-leyenda b { color: var(--texto); font-family: Lexend, sans-serif; margin-right: 0.8mm; }
.barra-pruebas { margin-left: auto; }
table { border-collapse: collapse; width: 100%; }
.resumen th, .tabla th { text-align: left; font-family: Lexend, sans-serif; font-weight: 600; font-size: 7pt; letter-spacing: 0.1em; text-transform: uppercase; color: var(--tenue); padding: 0 3mm 2mm 0; border-bottom: 0.4mm solid var(--texto); }
.resumen td { padding: 1.5mm 3mm 1.5mm 0; border-bottom: 0.25mm solid var(--linea); vertical-align: middle; font-size: 9pt; }
.resumen tr { break-inside: avoid; }
.r-id a { font-family: Lexend, sans-serif; font-weight: 600; color: var(--tela); white-space: nowrap; }
.r-titulo { font-weight: 500; }
.r-donde { color: var(--grafito); font-size: 8.6pt !important; }
.r-pag { text-align: right; font-family: Lexend, sans-serif; font-weight: 500; color: var(--grafito); padding-right: 0 !important; }
.resumen th:last-child { text-align: right; padding-right: 0; }

/* Chips de requerimiento */
.ids { display: flex; flex-wrap: wrap; gap: 1.4mm; }
.id-chip { display: inline-block; font-family: Lexend, sans-serif; font-weight: 600; font-size: 7.2pt; line-height: 1; padding: 1.1mm 2.2mm; border-radius: 99px; color: #fff; background: var(--tela); white-space: nowrap; margin: 0.4mm 0 0.4mm 1.2mm; }
.ids .id-chip { margin: 0; }

/* Mapa */
.ruta { list-style: none; margin: 2mm 0 0; padding: 0; position: relative; }
.ruta::before { content: ""; position: absolute; left: 4.2mm; top: 6mm; bottom: 8mm; width: 0.6mm; background: var(--linea); }
.ruta li { position: relative; display: grid; grid-template-columns: 9mm 1fr 52mm; gap: 5mm; padding: 2.2mm 0; break-inside: avoid; }
.ruta .punto { width: 9mm; height: 9mm; border-radius: 50%; background: #fff; border: 0.6mm solid var(--borde); display: grid; place-items: center; font-family: Lexend, sans-serif; font-weight: 600; font-size: 9pt; color: var(--grafito); position: relative; z-index: 1; }
.ruta li.tu .punto { background: var(--tinta); border-color: var(--tinta); color: #fff; }
.ruta .nombre { font-family: Lexend, sans-serif; font-weight: 500; font-size: 12pt; margin: 0.6mm 0 0.2mm; display: flex; align-items: center; gap: 2mm; }
.ruta .nombre .mini-cinta { margin: 0; }
.ruta .quien { font-size: 8.2pt; color: var(--tinta-oscura); font-weight: 500; margin: 0 0 0.8mm; }
.ruta .que { font-size: 9.2pt; color: var(--cuerpo); margin: 0; }
.ruta .ids { justify-content: flex-end; padding-top: 1.6mm; align-content: flex-start; }

/* Divisores */
.divisor { page: completa; position: relative; width: 215.9mm; height: 279.3mm; overflow: hidden; break-before: page; break-after: page; color: #fff;
  background-color: var(--tela); background-image: linear-gradient(90deg, rgba(0,0,0,0.32) 0, rgba(255,255,255,0.13) 7mm, transparent 19mm); }
.marca-blanca { position: absolute; left: 36mm; top: 22mm; color: #fff; }
.marca-blanca svg rect { fill: #fff; }
.divisor .dentro { position: absolute; left: 36mm; right: 26mm; top: 62mm; bottom: 26mm; display: flex; flex-direction: column; }
.divisor .num { font-family: Lexend, sans-serif; font-weight: 500; font-size: 10.5pt; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.88); margin: 0; }
.divisor h1 { font-size: 36pt; line-height: 1.06; letter-spacing: -0.035em; color: #fff; margin: 5mm 0 6mm; max-width: 140mm; }
.divisor .desc { font-size: 12pt; line-height: 1.55; color: rgba(255,255,255,0.92); max-width: 128mm; }
.divisor ul { list-style: none; padding: 0; margin: auto 0 0; border-top: 0.3mm solid rgba(255,255,255,0.35); }
.divisor li a { display: flex; align-items: baseline; gap: 5mm; padding: 3.2mm 0; border-bottom: 0.3mm solid rgba(255,255,255,0.35); color: #fff; }
.divisor .i { font-family: Lexend, sans-serif; font-weight: 600; font-size: 11pt; width: 20mm; flex: none; }
.divisor .t { flex: 1; font-size: 11pt; }
.divisor .n { font-family: Lexend, sans-serif; font-weight: 500; font-size: 10pt; color: rgba(255,255,255,0.9); }

/* Fichas */
.parte-rf { page: rf; } .parte-rnf { page: rnf; } .parte-ra { page: ra; } .parte-rer { page: rer; }
.ficha { break-before: page; }
.ficha-cab { display: grid; grid-template-columns: 2.2mm 1fr auto; gap: 5mm; margin-bottom: 5mm; }
.lomo { border-radius: 1mm; background: var(--tela); }
.ficha-cab .kicker { color: var(--tela); margin-bottom: 1.2mm; }
.ficha h2 { display: flex; flex-direction: column; gap: 1.4mm; }
.ficha h2 .id { font-family: Lexend, sans-serif; font-size: 27pt; line-height: 1; font-weight: 600; letter-spacing: -0.035em; color: var(--tela); }
.ficha h2 .titulo { font-size: 15pt; line-height: 1.2; font-weight: 500; letter-spacing: -0.02em; }
.ficha-cab .estado { align-self: start; margin-top: 0.6mm; }
.pide { margin: 0 0 4mm; padding: 0.6mm 0 0.6mm 4.6mm; border-left: 0.8mm solid var(--tela); font-size: 9.2pt; color: var(--grafito); line-height: 1.5; }
.pide p:last-child { margin: 0; }
.dilo { position: relative; background: var(--menta); border-radius: 3.2mm; padding: 4mm 16mm 4.2mm 5.5mm; margin-bottom: 4.5mm; break-inside: avoid; }
.dilo .etq { color: var(--tinta-oscura); }
.dilo .frase { font-family: Lexend, sans-serif; font-size: 10.6pt; line-height: 1.48; color: #0A3D38; letter-spacing: -0.01em; margin: 0; }
.dilo::after { content: ""; position: absolute; right: 6mm; top: 0; width: 5mm; height: 11mm; background: var(--tinta); clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%); }
.ficha h3 { font-size: 10.4pt; font-weight: 600; letter-spacing: -0.01em; margin: 0 0 2.2mm; break-after: avoid; }
.ficha section { margin-top: 4.5mm; }
ul.puntos { margin: 0; padding-left: 4mm; color: var(--cuerpo); }
ul.puntos li { margin-bottom: 1.4mm; padding-left: 0.6mm; }
ul.puntos li::marker { color: var(--tela); }
ol.pasos { list-style: none; counter-reset: paso; margin: 0; padding: 0; color: var(--cuerpo); }
ol.pasos li { counter-increment: paso; position: relative; padding-left: 7.4mm; margin-bottom: 1.7mm; }
ol.pasos li::before { content: counter(paso); position: absolute; left: 0; top: 0.1mm; width: 4.9mm; height: 4.9mm; border-radius: 50%; background: var(--tinta); color: #fff; font-family: Lexend, sans-serif; font-weight: 600; font-size: 7.2pt; line-height: 4.9mm; text-align: center; }
.cumple ul.puntos { columns: 2; column-gap: 8mm; }
.cumple ul.puntos li { break-inside: avoid; }
.recorrido > h3 { margin-bottom: 3.5mm; }
.paso-visual { break-inside: avoid; margin: 0 0 6.5mm; }
.pv-cab { display: grid; grid-template-columns: 7mm 1fr; gap: 3mm; align-items: start; margin-bottom: 3mm; }
.pv-num { width: 7mm; height: 7mm; border-radius: 1.8mm; background: var(--texto); color: #fff; font-family: Lexend, sans-serif; font-weight: 600; font-size: 10pt; display: grid; place-items: center; }
.pv-titulo { font-family: Lexend, sans-serif; font-weight: 500; font-size: 11.4pt; letter-spacing: -0.01em; margin: 0.5mm 0 0.6mm; }
.pv-texto { color: var(--cuerpo); margin: 0; }
.captura, .fragmento { margin: 0; }
.captura svg { display: block; width: 100%; height: auto; }
.captura.lado { display: grid; grid-template-columns: auto 1fr; gap: 6mm; align-items: start; }
.captura.lado .leyenda { margin-top: 1mm; }
.leyenda { list-style: none; margin: 2.8mm 0 0; padding: 0; display: grid; gap: 1.5mm; }
.leyenda li { display: grid; grid-template-columns: 5.2mm 1fr; gap: 2.2mm; align-items: start; font-size: 9.2pt; line-height: 1.45; color: var(--cuerpo); }
.leyenda .n, .md-linea .n { width: 5.2mm; height: 5.2mm; border-radius: 50%; background: var(--tinta); color: #fff; font-family: Lexend, sans-serif; font-weight: 600; font-size: 7.6pt; line-height: 5.2mm; text-align: center; }
.fragmento + .fragmento { margin-top: 5mm; }
.md-archivo { border: 0.3mm solid var(--borde); border-radius: 3mm; overflow: hidden; background: #fff; font-family: "Roboto Mono", monospace; font-size: 7.8pt; line-height: 1.6; }
.md-cab { display: block; background: var(--mesa); padding: 1.6mm 3.5mm; font-size: 7.4pt; color: var(--grafito); border-bottom: 0.3mm solid var(--linea); }
.md-linea { display: grid; grid-template-columns: 10mm 1fr 8mm; align-items: start; }
.md-linea.marcada { background: #E3F2EF; }
.md-num { color: var(--tenue); text-align: right; padding-right: 3mm; }
.md-linea code { background: none; padding: 0; font-size: inherit; white-space: pre-wrap; color: var(--texto); }
.md-linea .n { justify-self: center; margin-top: 0.2mm; width: 4.6mm; height: 4.6mm; line-height: 4.6mm; font-size: 7pt; }
.paso-visual .arbol, .paso-visual .escala, .paso-visual .personas { margin-top: 0; }
.comprueba { border: 0.3mm solid var(--linea); border-radius: 3.2mm; padding: 4.2mm 5mm 3.4mm; break-inside: avoid; }
.comprueba p { color: var(--cuerpo); }
.prueba-nombre { display: inline-block; font-family: "Roboto Mono", monospace; font-size: 7.7pt; color: var(--tinta-oscura); background: var(--control); padding: 0.7mm 2mm; border-radius: 1mm; margin: 0 1.6mm 1.2mm 0; }
.chips { display: flex; flex-wrap: wrap; gap: 1.6mm; margin-bottom: 1mm; }
.chip { display: inline-flex; align-items: center; gap: 1.2mm; background: var(--mesa); border-radius: 99px; padding: 0.9mm 2.7mm; font-size: 8.3pt; }
.chip b { font-family: Lexend, sans-serif; font-weight: 600; }
.chip svg { width: 3.2mm; height: 3.2mm; }
.chip-ok { background: var(--menta); color: var(--tinta-oscura); font-weight: 600; }
.codigo td { padding: 1.15mm 0; border-bottom: 0.25mm solid var(--linea); vertical-align: top; }
.codigo tr { break-inside: avoid; }
.codigo td.ruta { font-family: "Roboto Mono", monospace; font-size: 7.6pt; white-space: nowrap; padding-right: 5mm; width: 1%; color: var(--texto); }
.codigo .ln { color: var(--tinta); font-weight: 500; }
.codigo td.desc { font-size: 8.8pt; color: var(--grafito); }
.bloque-codigo { break-inside: avoid; }
.falta { border: 0.3mm dashed var(--borde); background: #F7F8FA; border-radius: 3.2mm; padding: 3.6mm 5mm 2.2mm; break-inside: avoid; color: var(--cuerpo); }
.falta h3 { font-size: 9.4pt; margin-bottom: 1.2mm; }
.pregunta { display: grid; grid-template-columns: 5mm 1fr; column-gap: 2.6mm; padding: 2mm 0; border-bottom: 0.25mm solid var(--linea); break-inside: avoid; }
.pregunta:last-child { border-bottom: 0; }
.q-ico { color: var(--tinta); padding-top: 0.4mm; }
.q-ico svg { width: 4.4mm; height: 4.4mm; display: block; }
dl { margin: 0; }
dt { font-weight: 600; margin-bottom: 0.6mm; }
dd { margin: 0; color: var(--cuerpo); }

/* Extras de las fichas */
.arbol { margin-top: 5.5mm; background: var(--mesa); border-radius: 3.2mm; padding: 4.2mm 5mm 3.6mm; break-inside: avoid; }
.arbol ol { list-style: none; margin: 0; padding: 0; font-size: 8.4pt; columns: 2; column-gap: 8mm; }
.arbol li { break-inside: avoid; }
.arbol li { display: flex; align-items: center; gap: 2.4mm; padding: 0.55mm 0; }
.arbol li.n2 { padding-left: 6mm; } .arbol li.n3 { padding-left: 12mm; }
.arbol code { background: none; padding: 0; font-size: 8pt; color: var(--texto); }
.marca-h { font-family: Lexend, sans-serif; font-weight: 600; font-size: 6.6pt; padding: 0.5mm 1.4mm; border-radius: 99px; background: var(--tela); color: #fff; }
.arbol li.n2 .marca-h { background: #fff; color: var(--tela); }
.arbol li.n3 .marca-h { background: transparent; color: var(--grafito); border: 0.25mm solid var(--borde); }
.arbol .sigue { color: var(--grafito); margin: 2mm 0 0; font-size: 8.4pt; }
.escala { margin-top: 5.5mm; border: 0.3mm solid var(--linea); border-radius: 3.2mm; padding: 4.2mm 5mm 12mm; break-inside: avoid; }
.escala-barra { position: relative; display: flex; gap: 0.6mm; margin-top: 11mm; }
.tramo { height: 7mm; border-radius: 1.2mm; position: relative; }
.tramo span { position: absolute; left: 0; right: 0; top: 7.8mm; text-align: center; font-size: 7.4pt; color: var(--grafito); white-space: nowrap; }
.tramo small { position: absolute; left: 0; right: 0; top: 1.6mm; text-align: center; font-size: 6.8pt; color: rgba(0,0,0,0.55); }
.t0 { background: #E9EBEF; } .t1 { background: #DDE9E7; } .t2 { background: #BFE0DA; } .t3 { background: #7CC3B8; } .t4 { background: #3E9E93; }
.t3 small, .t4 small { color: #fff; }
.escala-marca { position: absolute; top: -9.5mm; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; }
.escala-marca b { font-family: Lexend, sans-serif; font-size: 10pt; background: var(--texto); color: #fff; border-radius: 99px; padding: 0.8mm 2.4mm; }
.escala-marca::after { content: ""; width: 0.6mm; height: 11mm; background: var(--texto); margin-top: 0.4mm; }
.escala-min { position: absolute; top: -4.5mm; transform: translateX(-50%); font-size: 6.8pt; color: var(--grafito); white-space: nowrap; }
.personas { margin-top: 5.5mm; background: var(--mesa); border-radius: 3.2mm; padding: 4.2mm 5mm 3mm; break-inside: avoid; }
.personas-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 7mm; }
.personas-t { font-family: Lexend, sans-serif; font-weight: 600; font-size: 9pt; margin-bottom: 1.2mm; }
.personas ul { list-style: none; margin: 0; padding: 0; font-size: 8.4pt; color: var(--cuerpo); }
.personas li { padding: 0.8mm 0; border-bottom: 0.25mm solid #DADEE4; }
.personas li:last-child { border-bottom: 0; }

/* Guion */
.guion { list-style: none; margin: 0; padding: 0; }
.guion li { display: grid; grid-template-columns: 13mm 1fr; gap: 5mm; padding: 3.2mm 0; border-bottom: 0.25mm solid var(--linea); break-inside: avoid; }
.hora { font-family: Lexend, sans-serif; font-weight: 600; font-size: 11pt; color: var(--tinta); font-variant-numeric: tabular-nums; }
.g-donde { font-family: Lexend, sans-serif; font-weight: 500; font-size: 10.6pt; margin: 0 0 0.6mm; }
.g-accion { color: var(--cuerpo); margin-bottom: 1.2mm; }
.g-decir { font-family: Lexend, sans-serif; font-size: 9.6pt; color: #0A3D38; background: var(--menta); border-radius: 2.4mm; padding: 2.2mm 3.2mm; margin-bottom: 1.8mm; }

/* Tablas de cierre */
.tabla td { padding: 2.4mm 4mm 2.4mm 0; border-bottom: 0.25mm solid var(--linea); vertical-align: top; font-size: 9pt; color: var(--cuerpo); }
.tabla tr { break-inside: avoid; }
.tabla td:first-child { white-space: nowrap; }
.tabla .id-chip { margin-left: 0; }
.ids-celda .id-chip { margin: 0 1mm 1mm 0; }
.faq .pregunta { padding: 3mm 0; }
.glosario { columns: 2; column-gap: 9mm; }
.glosario div { break-inside: avoid; padding: 2mm 0; border-bottom: 0.25mm solid var(--linea); }
.glosario dt { font-family: Lexend, sans-serif; font-weight: 500; font-size: 10pt; }
.glosario dd { font-size: 8.9pt; }
pre { background: var(--texto); color: #E8EAEE; border-radius: 3mm; padding: 3.2mm 5mm; font-size: 8.4pt; line-height: 1.55; white-space: pre-wrap; break-inside: avoid; margin: 0 0 3mm; }
pre code { background: none; padding: 0; font-size: inherit; color: inherit; }

/* Contraportada */
.contraportada { page: completa; position: relative; width: 215.9mm; height: 279.3mm; overflow: hidden; background: var(--mesa); break-before: page; }
.contra-centro { position: absolute; left: 0; right: 0; top: 78mm; display: flex; flex-direction: column; align-items: center; text-align: center; }
.marca-grande { font-size: 26pt; gap: 3mm; }
.marca-grande svg { width: 13mm; height: 13mm; }
.contra-texto { font-size: 12pt; color: var(--grafito); max-width: 110mm; margin: 6mm 0 12mm; line-height: 1.5; }
.contra-qr { width: 34mm; background: #fff; border-radius: 3mm; padding: 3mm; margin-bottom: 5mm; }
.contra-qr svg { display: block; width: 100%; height: auto; }
.contra-url { font-family: "Roboto Mono", monospace; font-size: 8.6pt; color: var(--grafito); margin: 0 0 1mm; }
.contra-pie { position: absolute; left: 0; right: 0; bottom: 20mm; text-align: center; font-size: 8.6pt; color: var(--grafito); }
`;

// ---------------------------------------------------------------------------
// Documento
// ---------------------------------------------------------------------------

function construirHtml(ctx: Contexto, paginas: Paginas): string {
  lineasCitadas.length = 0;
  const partes = PARTES.map((p) => {
    const reqs = REQS.filter((r) => r.parte === p.clave);
    return `<div class="parte-${p.clave}">${divisor(p, paginas)}${reqs.map((r, i) => ficha(r, i + 1, reqs.length, ctx)).join("")}</div>`;
  }).join("");
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Folio · Guía de requerimientos</title>
<meta name="author" content="Equipo Folio">
<meta name="description" content="Cómo se cumple cada requerimiento de Folio: qué pide, dónde verlo y cómo explicarlo.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600&family=Onest:wght@400;500;600&family=Roboto+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
${portada()}
${contenido(paginas)}
${antesDeEmpezar(ctx)}
${resumen(paginas)}
${mapa()}
${partes}
${guion()}
${preguntasFrecuentes()}
${defectos()}
${fase4()}
${glosario()}
${comoProbar()}
${contraportada(ctx)}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Números de página: se leen de los marcadores del PDF de la primera pasada
// ---------------------------------------------------------------------------

function texto(o: PDFObject | undefined): string {
  return o instanceof PDFString || o instanceof PDFHexString ? o.decodeText() : "";
}

function buscarDestino(arbol: PDFObject | undefined, nombre: string): PDFArray | undefined {
  if (!(arbol instanceof PDFDict)) return undefined;
  const nombres = arbol.lookup(PDFName.of("Names"));
  if (nombres instanceof PDFArray) {
    for (let i = 0; i + 1 < nombres.size(); i += 2) {
      if (texto(nombres.lookup(i)) !== nombre) continue;
      const valor = nombres.lookup(i + 1);
      if (valor instanceof PDFArray) return valor;
      if (valor instanceof PDFDict) {
        const d = valor.lookup(PDFName.of("D"));
        if (d instanceof PDFArray) return d;
      }
    }
  }
  const hijos = arbol.lookup(PDFName.of("Kids"));
  if (hijos instanceof PDFArray) {
    for (let i = 0; i < hijos.size(); i++) {
      const encontrado = buscarDestino(hijos.lookup(i), nombre);
      if (encontrado) return encontrado;
    }
  }
  return undefined;
}

async function leerMarcadores(pdf: Uint8Array): Promise<Map<string, number>> {
  const doc = await PDFDocument.load(pdf);
  const paginas = doc.getPages().map((p) => p.ref.toString());
  const nombres = doc.catalog.lookup(PDFName.of("Names"));
  const arbolDestinos = nombres instanceof PDFDict ? nombres.lookup(PDFName.of("Dests")) : undefined;
  const titulos = new Map<string, number>();

  const destinoDe = (nodo: PDFDict): PDFArray | undefined => {
    let dest = nodo.lookup(PDFName.of("Dest"));
    const accion = nodo.lookup(PDFName.of("A"));
    if (!dest && accion instanceof PDFDict) dest = accion.lookup(PDFName.of("D"));
    if (dest instanceof PDFArray) return dest;
    if (dest instanceof PDFString || dest instanceof PDFHexString) return buscarDestino(arbolDestinos, dest.decodeText());
    if (dest instanceof PDFName) return buscarDestino(arbolDestinos, dest.decodeText());
    return undefined;
  };

  const visitar = (primero: PDFObject | undefined) => {
    let nodo = primero instanceof PDFRef ? doc.context.lookup(primero) : primero;
    while (nodo instanceof PDFDict) {
      const titulo = texto(nodo.lookup(PDFName.of("Title"))).replace(/\s+/g, " ").trim();
      const dest = destinoDe(nodo);
      const pagina = dest ? paginas.indexOf(String(dest.get(0))) : -1;
      if (titulo && pagina >= 0 && !titulos.has(titulo)) titulos.set(titulo, pagina + 1);
      visitar(nodo.get(PDFName.of("First")));
      const siguiente = nodo.get(PDFName.of("Next"));
      nodo = siguiente instanceof PDFRef ? doc.context.lookup(siguiente) : undefined;
    }
  };
  const raiz = doc.catalog.lookup(PDFName.of("Outlines"));
  if (raiz instanceof PDFDict) visitar(raiz.get(PDFName.of("First")));

  // Claves que usa la guía: el ID de cada ficha y el título de cada sección o parte.
  const claves = new Map<string, number>();
  const buscar = (prefijo: string) => [...titulos].find(([t]) => t === prefijo || t.startsWith(`${prefijo} `))?.[1];
  for (const r of REQS) {
    const n = buscar(r.id);
    if (n) claves.set(r.id, n);
  }
  for (const s of [...Object.values(SECCIONES), ...PARTES.map((p) => p.nombre)]) {
    const n = titulos.get(s);
    if (n) claves.set(s, n);
  }
  return claves;
}

// ---------------------------------------------------------------------------
// Impresión
// ---------------------------------------------------------------------------

async function abrirNavegador(): Promise<Browser> {
  try {
    return await chromium.launch({ channel: "msedge" });
  } catch {
    return chromium.launch();
  }
}

async function main() {
  fs.mkdirSync(SALIDA, { recursive: true });
  const qr = await QRCode.toString(SITIO, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#1B1D23", light: "#FFFFFF00" } });
  const paginasEjemplo = (await PDFDocument.load(fs.readFileSync(path.join(VERIF, "ebook-ejemplo.pdf")))).getPageCount();
  const ctx: Contexto = { qr, paginasEjemplo };

  const navegador = await abrirNavegador();
  try {
    const pagina = await navegador.newPage();
    const imprimir = async (paginas: Paginas) => {
      fs.writeFileSync(HTML, construirHtml(ctx, paginas));
      await pagina.goto(pathToFileURL(HTML).href, { waitUntil: "networkidle" });
      const fuentes = await pagina.evaluate(async () => {
        await document.fonts.ready;
        return ["600 12pt Lexend", "400 12pt Onest", "400 12pt 'Roboto Mono'"].filter((f) => !document.fonts.check(f));
      });
      if (fuentes.length) console.warn(`Aviso: no se cargaron las fuentes ${fuentes.join(", ")} (¿sin conexión?).`);
      return pagina.pdf({ preferCSSPageSize: true, printBackground: true, tagged: true, outline: true });
    };

    const borrador = await imprimir(null);
    const paginas = await leerMarcadores(borrador);
    const esperadas = [...REQS.map((r) => r.id), ...Object.values(SECCIONES).filter((s) => s !== SECCIONES.contenido), ...PARTES.map((p) => p.nombre)];
    const faltan = esperadas.filter((c) => !paginas.has(c));
    if (faltan.length) console.warn(`Aviso: no encontré la página de ${faltan.join(", ")}.`);

    const final = await imprimir(paginas);
    fs.writeFileSync(PDF, final);
    const total = (await PDFDocument.load(final)).getPageCount();
    console.log(`Guía generada: ${path.relative(RAIZ, PDF)} (${total} páginas, ${(final.length / 1024 / 1024).toFixed(1)} MB)`);
    if (process.argv.includes("--lineas")) console.log(lineasCitadas.join("\n"));
  } finally {
    await navegador.close();
  }
}

await main();
