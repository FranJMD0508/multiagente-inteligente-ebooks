// Lecturas recomendadas del modo demo. Son obras reales; sus datos se
// comprobaron en Open Library (ISBN de la edición citada) y Crossref (DOI) el
// 2026-10-20. En el modo demo se vuelven a verificar en vivo desde el navegador.

import type { ReferenceData } from "@/lib/types";

export interface Reading extends ReferenceData {
  note: string;
}

const housel: Reading = {
  kind: "libro",
  authors: ["Housel, Morgan"],
  year: "2020",
  title: "The psychology of money: Timeless lessons on wealth, greed, and happiness",
  publisher: "Harriman House",
  isbn: "9780857197689",
  note: "Explica con historias cortas por qué decidimos mal con el dinero aunque sepamos la teoría.",
};

const robin: Reading = {
  kind: "libro",
  authors: ["Robin, Vicki", "Dominguez, Joe"],
  year: "2008",
  title: "Your money or your life: Transforming your relationship with money and achieving financial independence",
  publisher: "Penguin Books",
  isbn: "9780143115762",
  note: "Propone llevar la cuenta del dinero en horas de vida, una idea útil para revisar gastos.",
};

const burkeman: Reading = {
  kind: "libro",
  authors: ["Burkeman, Oliver"],
  year: "2021",
  title: "Four thousand weeks: Time management for mortals",
  publisher: "Farrar, Straus and Giroux",
  isbn: "9780374159122",
  note: "Una mirada realista a la gestión del tiempo: elegir qué dejar fuera en lugar de hacerlo todo.",
};

const newportDeep: Reading = {
  kind: "libro",
  authors: ["Newport, Cal"],
  year: "2016",
  title: "Deep work: Rules for focused success in a distracted world",
  publisher: "Grand Central Publishing",
  isbn: "9781455586691",
  note: "Ideas prácticas para proteger bloques de concentración en semanas muy cargadas.",
};

const fisher: Reading = {
  kind: "libro",
  authors: ["Fisher, Roger", "Ury, William", "Patton, Bruce"],
  year: "2011",
  title: "Getting to yes: Negotiating agreement without giving in",
  edition: "3",
  publisher: "Penguin",
  isbn: "9780143118756",
  note: "El método de negociación por intereses, base de muchas técnicas para resolver desacuerdos.",
};

const stone: Reading = {
  kind: "libro",
  authors: ["Stone, Douglas", "Patton, Bruce", "Heen, Sheila"],
  year: "2010",
  title: "Difficult conversations: How to discuss what matters most",
  edition: "2",
  publisher: "Penguin",
  isbn: "9780143118442",
  note: "Separa lo que pasó, lo que sentimos y lo que está en juego en una conversación difícil.",
};

const rosenberg: Reading = {
  kind: "libro",
  authors: ["Rosenberg, Marshall B."],
  year: "2015",
  title: "Nonviolent communication: A language of life",
  edition: "3",
  publisher: "PuddleDancer Press",
  isbn: "9781892005281",
  note: "Un modelo sencillo para expresar necesidades y pedir cambios sin culpar.",
};

const newportSoGood: Reading = {
  kind: "libro",
  authors: ["Newport, Cal"],
  year: "2012",
  title: "So good they can't ignore you: Why skills trump passion in the quest for work you love",
  publisher: "Business Plus",
  isbn: "9781455509126",
  note: "Defiende que la satisfacción en el trabajo llega al desarrollar habilidades valiosas.",
};

const jay: Reading = {
  kind: "libro",
  authors: ["Jay, Meg"],
  year: "2012",
  title: "The defining decade: Why your twenties matter, and how to make the most of them now",
  publisher: "Twelve",
  note: "Casos reales sobre las decisiones de trabajo y vida adulta que se toman entre los 20 y los 30.",
};

const clear: Reading = {
  kind: "libro",
  authors: ["Clear, James"],
  year: "2018",
  title: "Atomic habits: An easy & proven way to build good habits & break bad ones",
  publisher: "Avery",
  isbn: "9780735211292",
  note: "Cómo diseñar el entorno para que los hábitos pequeños se mantengan solos.",
};

const fogg: Reading = {
  kind: "libro",
  authors: ["Fogg, B. J."],
  year: "2019",
  title: "Tiny habits: The small changes that change everything",
  publisher: "Houghton Mifflin Harcourt",
  isbn: "9780358003328",
  note: "El método de anclar hábitos mínimos a rutinas que ya existen.",
};

const ryanDeci: Reading = {
  kind: "articulo",
  authors: ["Ryan, Richard M.", "Deci, Edward L."],
  year: "2000",
  title: "Self-determination theory and the facilitation of intrinsic motivation, social development, and well-being",
  journal: "American Psychologist",
  volume: "55",
  issue: "1",
  pages: "68-78",
  doi: "10.1037/0003-066X.55.1.68",
  note: "El artículo de referencia sobre motivación interna: autonomía, competencia y relación.",
};

const sapolsky: Reading = {
  kind: "libro",
  authors: ["Sapolsky, Robert M."],
  year: "2004",
  title: "Why zebras don't get ulcers",
  edition: "3",
  publisher: "Holt Paperbacks",
  isbn: "9780805073690",
  note: "Explica de forma amena qué hace el estrés en el cuerpo y por qué se vuelve crónico.",
};

const walker: Reading = {
  kind: "libro",
  authors: ["Walker, Matthew"],
  year: "2017",
  title: "Why we sleep: Unlocking the power of sleep and dreams",
  publisher: "Scribner",
  isbn: "9781501144318",
  note: "Un repaso divulgativo de por qué el sueño afecta al ánimo, la memoria y el estudio.",
};

const neff: Reading = {
  kind: "articulo",
  authors: ["Neff, Kristin"],
  year: "2003",
  title: "Self-compassion: An alternative conceptualization of a healthy attitude toward oneself",
  journal: "Self and Identity",
  volume: "2",
  issue: "2",
  pages: "85-101",
  doi: "10.1080/15298860309032",
  note: "Define la autocompasión y la distingue de la autoestima; útil para hablarse con más amabilidad.",
};

const brown: Reading = {
  kind: "libro",
  authors: ["Brown, Peter C.", "Roediger, Henry L.", "McDaniel, Mark A."],
  year: "2014",
  title: "Make it stick: The science of successful learning",
  publisher: "The Belknap Press of Harvard University Press",
  isbn: "9780674729018",
  note: "Las técnicas de estudio con más evidencia: recuperar, espaciar y mezclar.",
};

const oakley: Reading = {
  kind: "libro",
  authors: ["Oakley, Barbara"],
  year: "2014",
  title: "A mind for numbers: How to excel at math and science (even if you flunked algebra)",
  publisher: "TarcherPerigee",
  isbn: "9780399165245",
  note: "Explica el modo enfocado y el difuso de pensar, y cómo alternarlos al estudiar.",
};

const dunlosky: Reading = {
  kind: "articulo",
  authors: ["Dunlosky, John", "Rawson, Katherine A.", "Marsh, Elizabeth J.", "Nathan, Mitchell J.", "Willingham, Daniel T."],
  year: "2013",
  title: "Improving students' learning with effective learning techniques: Promising directions from cognitive and educational psychology",
  journal: "Psychological Science in the Public Interest",
  volume: "14",
  issue: "1",
  pages: "4-58",
  doi: "10.1177/1529100612453266",
  note: "Revisión que compara diez técnicas de estudio según la evidencia disponible.",
};

const dweck: Reading = {
  kind: "libro",
  authors: ["Dweck, Carol S."],
  year: "2006",
  title: "Mindset: The new psychology of success",
  publisher: "Random House",
  isbn: "9781400062751",
  note: "La diferencia entre pensar que las capacidades son fijas o que se desarrollan.",
};

export const READINGS: Record<string, Reading[]> = {
  finanzas: [housel, robin, clear],
  tiempo: [burkeman, newportDeep, clear],
  conflictos: [fisher, stone, rosenberg],
  empleo: [newportSoGood, jay, dweck],
  habitos: [clear, fogg, ryanDeci],
  estres: [sapolsky, walker, neff],
  comunicacion: [rosenberg, stone, neff],
  estudio: [brown, oakley, dunlosky],
  general: [dweck, clear, neff],
};

export function readingsFor(nicheId: string): Reading[] {
  return READINGS[nicheId] ?? READINGS.general;
}
