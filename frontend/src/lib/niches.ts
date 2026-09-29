import type { Sensitivity } from "./types";

export interface Niche {
  id: string;
  label: string;
  short: string;
  cloth: string;
  sensitivity: Sensitivity;
  /** Idea de ejemplo que se escribe en la caja al tocar el chip (no se envía sola). */
  idea: string;
  audience: string;
  keywords: string[];
}

// Catálogo de nichos sugeridos (RF-01). En la fase 4 lo servirá la API (GET /niches).
export const NICHES: Niche[] = [
  {
    id: "finanzas",
    label: "Finanzas para universitarios",
    short: "Finanzas",
    cloth: "#2F6B58",
    sensitivity: "financiero",
    idea: "Una guía para universitarios que llegan a fin de mes sin dinero: presupuesto, gastos hormiga y primeros ahorros.",
    audience: "Estudiantes que manejan su primer dinero",
    keywords: ["dinero", "ahorr", "finanz", "presupuest", "gasto", "deuda", "sueldo", "beca", "tarjeta", "inversi"],
  },
  {
    id: "tiempo",
    label: "Gestión del tiempo",
    short: "Tiempo",
    cloth: "#3B4A9E",
    sensitivity: "ninguno",
    idea: "Cómo organizar la semana cuando estudias y trabajas, sin vivir con culpa por lo que no hiciste.",
    audience: "Personas que estudian y trabajan a la vez",
    keywords: ["tiempo", "semana", "agenda", "productiv", "procrastin", "organiz", "horario", "rutina diaria"],
  },
  {
    id: "conflictos",
    label: "Resolver conflictos",
    short: "Conflictos",
    cloth: "#8C2F45",
    sensitivity: "autoayuda_general",
    idea: "Cómo resolver discusiones con compañeros de piso o de equipo sin que se conviertan en peleas.",
    audience: "Jóvenes que conviven o trabajan en equipo",
    keywords: ["conflict", "discusi", "pelea", "convivencia", "compañer", "acuerdo", "negoci"],
  },
  {
    id: "empleo",
    label: "Primer empleo",
    short: "Primer empleo",
    cloth: "#1E5E73",
    sensitivity: "ninguno",
    idea: "Qué hacer en los primeros tres meses de tu primer empleo para aprender rápido y ganarte la confianza del equipo.",
    audience: "Personas que empiezan su primer trabajo",
    keywords: ["empleo", "trabajo", "entrevista", "currículum", "curriculum", "jefe", "oficina", "pasant"],
  },
  {
    id: "habitos",
    label: "Hábitos y rutinas",
    short: "Hábitos",
    cloth: "#9A6A12",
    sensitivity: "autoayuda_general",
    idea: "Cómo crear hábitos pequeños que duren más de dos semanas, sin depender de la motivación.",
    audience: "Personas que quieren mejorar sus rutinas",
    keywords: ["hábito", "habito", "rutina", "constancia", "disciplina", "motivaci"],
  },
  {
    id: "estres",
    label: "Manejo del estrés",
    short: "Estrés",
    cloth: "#9A6A12",
    sensitivity: "salud_emocional",
    idea: "Herramientas sencillas para manejar el estrés en época de exámenes y dormir mejor.",
    audience: "Estudiantes en época de exámenes",
    keywords: ["estrés", "estres", "ansiedad", "emocion", "calma", "dormir", "sueño", "burnout", "agotamiento"],
  },
  {
    id: "comunicacion",
    label: "Comunicación asertiva",
    short: "Comunicación",
    cloth: "#8C2F45",
    sensitivity: "autoayuda_general",
    idea: "Cómo decir que no sin culpa y pedir lo que necesitas en el trabajo y en casa.",
    audience: "Personas a las que les cuesta poner límites",
    keywords: ["asertiv", "comunica", "decir que no", "límite", "limite", "hablar en público"],
  },
  {
    id: "estudio",
    label: "Organización del estudio",
    short: "Estudio",
    cloth: "#3B4A9E",
    sensitivity: "ninguno",
    idea: "Técnicas para estudiar menos horas y recordar más, pensadas para el primer año de universidad.",
    audience: "Estudiantes de primer año",
    keywords: ["estudi", "examen", "memoriz", "apunte", "semestre", "repaso"],
  },
];

export const GENERAL_NICHE: Niche = {
  id: "general",
  label: "Crecimiento personal",
  short: "Crecimiento personal",
  cloth: "#1E5E73",
  sensitivity: "autoayuda_general",
  idea: "",
  audience: "Personas que quieren mejorar en su día a día",
  keywords: [],
};

export function getNiche(id: string | undefined): Niche {
  return NICHES.find((n) => n.id === id) ?? GENERAL_NICHE;
}

/** Detecta el nicho a partir del texto libre (versión simulada del guardarraíl de entrada). */
export function detectNiche(prompt: string): Niche {
  const text = prompt.toLowerCase();
  let best: { niche: Niche; score: number } | null = null;
  for (const niche of NICHES) {
    const score = niche.keywords.reduce((acc, kw) => (text.includes(kw) ? acc + 1 : acc), 0);
    if (score > 0 && (!best || score > best.score)) best = { niche, score };
  }
  return best?.niche ?? GENERAL_NICHE;
}
