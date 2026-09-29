import type { Sensitivity } from "./types";

// Versión simulada del guardarraíl de entrada (docs/03 §2). En la fase 4 esta
// clasificación la hará el backend antes de lanzar el pipeline.

const FICTION_PATTERNS = [
  /\bnovelas?\b/,
  /\bcuentos?\b/,
  /\brelatos?\b/,
  /\bfan ?fic/,
  /\bpoemas?\b/,
  /\bpoes[ií]a\b/,
  /ciencia ficci[oó]n/,
  /\bfantas[ií]a\b/,
  /\bdragon(es)?\b/,
  /\bguion\b/,
  /\bsaga\b/,
  /\bpersonajes?\b/,
  /historia de (amor|terror|misterio|aventuras)/,
  /\bf[aá]bulas?\b/,
];

export function isFiction(prompt: string): boolean {
  const text = prompt.toLowerCase();
  return FICTION_PATTERNS.some((re) => re.test(text));
}

export const FICTION_ALTERNATIVES = [
  "Cómo escribir tu primera historia: hábitos de quien escribe",
  "Leer más y mejor en 30 días",
  "Organiza tu tiempo para escribir cada semana",
];

export const DISCLAIMERS: Record<Exclude<Sensitivity, "ninguno">, { reason: string; text: string }> = {
  financiero: {
    reason: "el tema es financiero",
    text: "Este libro tiene fines educativos e informativos. No sustituye la asesoría de un profesional en finanzas. Antes de tomar decisiones importantes sobre tu dinero, consulta a una persona experta.",
  },
  salud_emocional: {
    reason: "el tema toca la salud emocional",
    text: "Este libro tiene fines educativos e informativos. No sustituye la atención de un profesional de la psicología o de la salud. Si sientes que no puedes con lo que te pasa, busca ayuda profesional.",
  },
  salud_fisica: {
    reason: "el tema toca la salud física",
    text: "Este libro tiene fines educativos e informativos. No sustituye la consulta con un profesional de la salud.",
  },
  autoayuda_general: {
    reason: "es un tema de autoayuda",
    text: "Este libro tiene fines educativos e informativos. No sustituye la asesoría de un profesional (psicológica, médica, financiera o legal) cuando la necesites.",
  },
};
