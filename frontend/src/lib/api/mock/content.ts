// Generador de contenido simulado. Imita lo que harán el Investigador, el
// Redactor y el Agente de Ejercicios en la fase 4, para poder probar la
// interfaz con textos realistas en español.

import type {
  ChapterAdjustChip,
  ChapterContent,
  Exercise,
  ExercisePref,
  OutlineItem,
  SectionId,
} from "@/lib/types";
import { uid } from "@/lib/uid";

type Seed = [title: string, summary: string, keyPoints: [string, string, string]];

interface NicheBook {
  title: string;
  subtitle: string;
  pain: string;
  problems: string[];
  results: string[];
  outline: Seed[];
}

const BOOKS: Record<string, NicheBook> = {
  finanzas: {
    title: "Ahorra sin dejar de vivir",
    subtitle: "Finanzas para universitarios, sin complicarte",
    pain: "el dinero se te va sin saber en qué",
    problems: [
      "A mitad de mes ya no sabía en qué se le había ido el dinero.",
      "Cada vez que salía con sus amigos gastaba más de lo que había planeado.",
      "Tenía una deuda pequeña en la tarjeta que no dejaba de crecer.",
    ],
    results: [
      "llegó a fin de mes con algo guardado por primera vez.",
      "notó que gastaba menos sin sentir que se privaba de todo.",
      "dejó de sentir ansiedad cada vez que revisaba su cuenta.",
    ],
    outline: [
      ["El mes empieza el día que cobras", "Reparte lo que recibes antes de gastarlo.", ["Decide el destino de tu dinero el mismo día que llega", "Separa lo necesario, lo que disfrutas y lo que guardas", "Automatiza lo que puedas"]],
      ["Gastos hormiga: lo que no ves también cuenta", "Detecta las pequeñas fugas de cada semana.", ["Anota tus gastos pequeños durante siete días", "Distingue entre costumbre y necesidad", "Pon un tope semanal a los antojos"]],
      ["Tu primer presupuesto en una servilleta", "Un método de 10 minutos, sin hojas de cálculo.", ["Suma lo que entra y lo que sale", "Asigna un porcentaje a cada montón", "Revisa tu servilleta cada domingo"]],
      ["Ahorrar sin dejar de salir con amigos", "Planes baratos y acuerdos claros.", ["Propón planes que no dependan de gastar", "Habla de dinero sin incomodidad", "Guarda un fondo pequeño para salidas"]],
      ["Deudas, tarjetas y préstamos entre amigos", "Cuándo sí, cuándo no y cómo salir.", ["Entiende cuánto cuesta de verdad una deuda", "Usa la tarjeta como herramienta y no como sueldo", "Pon por escrito los préstamos entre amigos"]],
      ["Tu fondo para imprevistos, paso a paso", "Empieza con poco y hazlo automático.", ["Define una meta pequeña y alcanzable", "Guarda primero y gasta después", "Protege tu fondo de las tentaciones"]],
      ["Tu dinero dentro de un año", "Metas simples para seguir creciendo.", ["Escribe una meta con fecha", "Revisa tu progreso cada mes", "Celebra los avances sin gastar de más"]],
    ],
  },
  tiempo: {
    title: "Semanas que rinden",
    subtitle: "Organiza tu tiempo cuando estudias y trabajas",
    pain: "los días se te escapan sin avanzar en lo importante",
    problems: [
      "Sentía que la semana se le escapaba sin avanzar en lo importante.",
      "Dejaba los trabajos para la última noche y terminaba sin energía.",
      "Su agenda estaba tan llena que no le quedaba tiempo para descansar.",
    ],
    results: [
      "terminaba sus tareas con más calma y menos culpa.",
      "recuperó las tardes del domingo para descansar.",
      "entregó sus trabajos a tiempo sin desvelarse.",
    ],
    outline: [
      ["Tu semana cabe en una hoja", "Mira toda tu semana antes de empezarla.", ["Anota primero tus compromisos fijos", "Reserva bloques para lo importante", "Deja espacios libres a propósito"]],
      ["Lo urgente, lo importante y lo que puede esperar", "Decide qué va primero sin culpa.", ["Separa las tareas urgentes de las importantes", "Elige tres prioridades por día", "Aprende a posponer con intención"]],
      ["Bloques cortos, avances reales", "Trabaja en tramos de 25 a 50 minutos.", ["Divide las tareas grandes en pasos pequeños", "Trabaja con un temporizador", "Descansa antes de cansarte"]],
      ["Cuando estudias y trabajas a la vez", "Estrategias para los días más llenos.", ["Aprovecha los tiempos muertos", "Negocia tus horarios con claridad", "Prepara la noche anterior"]],
      ["Adiós a la procrastinación de última hora", "Empieza aunque no tengas ganas.", ["Usa la regla de los dos minutos", "Hazlo imperfecto primero", "Quita las distracciones antes de empezar"]],
      ["Descansar también es parte del plan", "El descanso que te deja rendir más.", ["Programa tu descanso como una tarea", "Protege tus horas de sueño", "Desconéctate un rato cada día"]],
      ["Tu sistema para cada domingo", "Una revisión semanal de 15 minutos.", ["Revisa lo que funcionó", "Ajusta el plan de la semana siguiente", "Anota una mejora concreta"]],
    ],
  },
  conflictos: {
    title: "Hablar claro sin pelear",
    subtitle: "Resuelve conflictos en casa, en clase y en el trabajo",
    pain: "una discusión se te fue de las manos",
    problems: [
      "Las discusiones por la limpieza del piso eran cada vez más frecuentes.",
      "En su equipo de clase nadie se atrevía a decir lo que le molestaba.",
      "Una conversación con un compañero terminó en gritos.",
    ],
    results: [
      "las conversaciones difíciles empezaron a durar menos y a terminar mejor.",
      "el ambiente en casa se volvió más tranquilo.",
      "el equipo terminó el proyecto sin rencores.",
    ],
    outline: [
      ["Por qué discutimos (y por qué no está mal)", "El conflicto como señal, no como fracaso.", ["Reconoce qué hay detrás de una discusión", "Separa a la persona del problema", "Elige el momento para hablar"]],
      ["Escuchar para entender, no para responder", "La escucha que baja la tensión.", ["Deja terminar a la otra persona", "Repite con tus palabras lo que entendiste", "Pregunta antes de suponer"]],
      ["Decir lo que te molesta sin atacar", "Frases que abren conversaciones.", ["Habla de lo que sientes y no de cómo es la otra persona", "Describe hechos concretos", "Pide algo claro y posible"]],
      ["Acuerdos de convivencia que sí se cumplen", "Reglas claras para compartir espacios.", ["Pongan las reglas por escrito", "Repartan las tareas de forma justa", "Revisen los acuerdos cada mes"]],
      ["Conflictos en equipos de trabajo y de clase", "Cuando hay una nota o un proyecto de por medio.", ["Definan los roles desde el inicio", "Hablen de los problemas a tiempo", "Busquen soluciones y no culpables"]],
      ["Cuando la conversación se calienta", "Qué hacer si todo se sale de control.", ["Pide una pausa sin abandonar la conversación", "Baja el volumen y la velocidad", "Retoma el tema con calma"]],
      ["Reparar después de una pelea", "Cómo pedir disculpas y volver a confiar.", ["Reconoce tu parte sin excusas", "Propón un cambio concreto", "Da tiempo para recuperar la confianza"]],
    ],
  },
  empleo: {
    title: "Tu primer empleo sin miedo",
    subtitle: "Los primeros 90 días, paso a paso",
    pain: "empezar en un trabajo nuevo te da nervios",
    problems: [
      "Los primeros días sentía que no entendía nada de lo que hablaba el equipo.",
      "Le daba vergüenza preguntar lo mismo dos veces.",
      "Cometió un error en un informe y no sabía cómo decirlo.",
    ],
    results: [
      "se sentía parte del equipo y sabía a quién acudir.",
      "su jefa le confió una tarea más importante.",
      "aprendió en semanas lo que creía que le tomaría meses.",
    ],
    outline: [
      ["Antes del primer día", "Prepárate para empezar con buen pie.", ["Investiga cómo trabaja el equipo", "Prepara preguntas para tu primera semana", "Organiza tu logística con tiempo"]],
      ["La primera semana: observar y preguntar", "Aprende cómo funcionan las cosas.", ["Anota nombres, procesos y herramientas", "Pregunta sin miedo a parecer nuevo", "Identifica a quién acudir para cada cosa"]],
      ["Aprender rápido sin agobiarte", "Un método para absorber lo nuevo.", ["Resume cada día lo que aprendiste", "Practica primero lo que más usarás", "Pide ejemplos de trabajos bien hechos"]],
      ["Comunicarte con quien te dirige", "Expectativas claras desde el principio.", ["Acuerda qué se espera de ti", "Informa tus avances antes de que te pregunten", "Pide retroalimentación con frecuencia"]],
      ["Errores: qué hacer cuando algo sale mal", "Equivocarte sin hundirte.", ["Avisa pronto y con una propuesta", "Aprende qué falló en el proceso", "No cargues con la culpa en silencio"]],
      ["Ganarte la confianza del equipo", "Pequeños gestos que suman.", ["Cumple lo que prometes", "Ofrece ayuda en lo que sabes hacer", "Reconoce el trabajo de los demás"]],
      ["Tus primeros 90 días en perspectiva", "Evalúa lo aprendido y define tu siguiente paso.", ["Haz un balance honesto", "Conversa sobre tu crecimiento", "Define una meta para los próximos meses"]],
    ],
  },
  habitos: {
    title: "Hábitos que se quedan",
    subtitle: "Pequeños cambios que duran más de dos semanas",
    pain: "tus propósitos duran menos de dos semanas",
    problems: [
      "Empezaba rutinas nuevas cada lunes y las abandonaba el jueves.",
      "Quería leer más, pero siempre terminaba viendo videos en el celular.",
      "Se proponía hacer ejercicio, pero nunca encontraba el momento.",
    ],
    results: [
      "llevaba tres semanas seguidas cumpliendo su hábito.",
      "el hábito dejó de sentirse como un esfuerzo.",
      "había leído dos libros casi sin darse cuenta.",
    ],
    outline: [
      ["Por qué los propósitos no duran", "Lo que la motivación no puede hacer por ti.", ["Entiende la diferencia entre meta y hábito", "Empieza con algo ridículamente pequeño", "Diseña tu entorno a tu favor"]],
      ["El hábito más pequeño posible", "Dos minutos que cambian la semana.", ["Reduce el hábito a su versión mínima", "Engánchalo a algo que ya haces", "Celebra cada vez que lo cumples"]],
      ["Tu entorno trabaja por ti", "Cambia lo que tienes alrededor.", ["Deja a la vista lo que quieres hacer", "Esconde lo que quieres evitar", "Prepara todo la noche anterior"]],
      ["Cuando fallas un día", "Volver sin empezar de cero.", ["Nunca falles dos veces seguidas", "Ajusta el hábito en vez de abandonarlo", "Háblate con amabilidad"]],
      ["Registrar sin obsesionarte", "Ver tu progreso te ayuda a seguir.", ["Marca cada día que lo cumples", "Revisa tu registro cada semana", "Mide lo que importa y no todo"]],
      ["Hábitos que se contagian", "El apoyo de otras personas.", ["Busca a alguien con tu misma meta", "Comparte tu avance", "Rodéate de gente que ya lo hace"]],
      ["De hábito a identidad", "Cuando ya no necesitas esforzarte tanto.", ["Piensa en quién quieres ser", "Suma un hábito nuevo solo cuando el anterior sea fácil", "Revisa tus rutinas cada trimestre"]],
    ],
  },
  estres: {
    title: "Respira, estudia, descansa",
    subtitle: "Maneja el estrés en época de exámenes",
    pain: "la presión de los exámenes te quita el sueño",
    problems: [
      "En época de exámenes dormía poco y estudiaba con el corazón acelerado.",
      "Sentía un nudo en el estómago cada vez que pensaba en todo lo pendiente.",
      "Le costaba concentrarse porque su cabeza no paraba.",
    ],
    results: [
      "llegó al examen con la mente más clara.",
      "dormía mejor y estudiaba con más calma.",
      "aprendió a reconocer las señales antes de que el estrés le ganara.",
    ],
    outline: [
      ["Qué es el estrés y para qué sirve", "Entender lo que pasa en tu cuerpo.", ["Reconoce las señales del estrés", "Distingue el estrés útil del que te agota", "Identifica tus principales detonantes"]],
      ["Respirar para bajar el ritmo", "Técnicas de un minuto.", ["Practica una respiración lenta y contada", "Haz pausas cortas durante el estudio", "Respira antes de empezar un examen"]],
      ["Organizar para preocuparte menos", "Un plan reduce la incertidumbre.", ["Saca de tu cabeza lo que tienes pendiente", "Divide el temario en partes pequeñas", "Planifica también los descansos"]],
      ["Dormir bien en época de exámenes", "El sueño también es parte del estudio.", ["Mantén horarios regulares", "Deja las pantallas antes de dormir", "Evita estudiar toda la noche"]],
      ["Cuerpo en movimiento, mente más tranquila", "Actividad física sencilla.", ["Camina diez minutos al día", "Estírate entre bloques de estudio", "Elige algo que disfrutes"]],
      ["Hablar de lo que te pasa", "Pedir apoyo también es cuidarte.", ["Cuéntale a alguien de confianza", "Pon en palabras lo que sientes", "Reconoce cuándo buscar ayuda profesional"]],
      ["Tu kit contra el estrés", "Herramientas para tener a mano.", ["Arma tu lista de recursos", "Prepara un plan para los días difíciles", "Revisa qué te funcionó y qué no"]],
    ],
  },
  comunicacion: {
    title: "Decir que no sin culpa",
    subtitle: "Comunicación asertiva para el día a día",
    pain: "te cuesta decir lo que piensas sin sentirte mal",
    problems: [
      "Decía que sí a todo y terminaba sin tiempo para lo suyo.",
      "Le costaba pedir ayuda por miedo a molestar.",
      "Cuando algo le molestaba, se lo guardaba hasta explotar.",
    ],
    results: [
      "recuperó tiempo para lo que de verdad le importaba.",
      "sus relaciones se volvieron más honestas.",
      "se sintió con más confianza para hablar en las reuniones.",
    ],
    outline: [
      ["Qué es ser asertivo (y qué no)", "Entre callar y explotar hay otro camino.", ["Distingue entre pasivo, agresivo y asertivo", "Reconoce tu estilo habitual", "Recuerda que tus necesidades también cuentan"]],
      ["Decir que no sin culpa", "Negarte con respeto y claridad.", ["Responde sin justificarte de más", "Ofrece alternativas cuando quieras", "Sostén tu respuesta con calma"]],
      ["Pedir lo que necesitas", "Hacer peticiones claras.", ["Di qué necesitas y para cuándo", "Usa un tono firme y amable", "Acepta que la otra persona puede negarse"]],
      ["Poner límites en el trabajo", "Cuidar tu tiempo y tu energía.", ["Define tus límites antes de necesitarlos", "Comunícalos con anticipación", "Repite el límite si no se respeta"]],
      ["Recibir críticas sin derrumbarte", "Escuchar sin tomarlo como un ataque.", ["Separa el comentario de tu valor personal", "Pide ejemplos concretos", "Quédate con lo que te sirve"]],
      ["Conversaciones difíciles con la familia", "Hablar claro con quien más quieres.", ["Elige un buen momento", "Habla desde tu experiencia", "Busca acuerdos en lugar de ganar"]],
      ["Tu forma de comunicarte, paso a paso", "Practicar hasta que salga natural.", ["Ensaya las frases clave", "Empieza con situaciones fáciles", "Revisa tus avances cada semana"]],
    ],
  },
  estudio: {
    title: "Estudiar menos horas, aprender más",
    subtitle: "Técnicas para tu primer año de universidad",
    pain: "estudias mucho y recuerdas poco",
    problems: [
      "Leía los apuntes una y otra vez, pero en el examen se le olvidaba todo.",
      "Estudiaba muchas horas seguidas y terminaba sin recordar casi nada.",
      "Se distraía con el celular cada cinco minutos.",
    ],
    results: [
      "subió sus notas estudiando menos horas.",
      "recordaba mejor los temas sin memorizarlos de golpe.",
      "terminó el semestre con menos estrés y mejores resultados.",
    ],
    outline: [
      ["Estudiar no es leer muchas veces", "Lo que de verdad ayuda a recordar.", ["Cambia la relectura por la práctica", "Explica con tus palabras lo que aprendiste", "Pon a prueba tu memoria"]],
      ["Tu plan de estudio semanal", "Menos horas, mejor repartidas.", ["Reparte el estudio en varios días", "Asigna a cada sesión un objetivo claro", "Deja espacio para repasar"]],
      ["Tomar apuntes que sí sirven", "Notas para entender, no para copiar.", ["Escribe preguntas en el margen", "Resume cada clase en cinco líneas", "Conecta ideas con esquemas simples"]],
      ["Concentrarte en un mundo de notificaciones", "Proteger tu atención.", ["Aleja el celular mientras estudias", "Trabaja en bloques con descanso", "Prepara tu espacio antes de empezar"]],
      ["Repasar sin empezar de cero", "El repaso espaciado.", ["Repasa al día siguiente, a la semana y al mes", "Usa tarjetas de preguntas", "Enfócate en lo que más te cuesta"]],
      ["Preparar un examen en una semana", "Un plan realista cuando hay poco tiempo.", ["Prioriza los temas con más peso", "Haz simulacros con tiempo", "Descansa la noche anterior"]],
      ["Aprender de cada nota", "Mejorar después de cada evaluación.", ["Revisa en qué te equivocaste", "Ajusta tu método", "Celebra lo que salió bien"]],
    ],
  },
};

const GENERAL: Omit<NicheBook, "title" | "subtitle"> = {
  pain: "quieres mejorar, pero no sabes por dónde empezar",
  problems: [
    "Sentía que quería cambiar algo, pero no sabía por dónde empezar.",
    "Había intentado mejorar varias veces sin conseguirlo.",
    "Le costaba mantener la constancia más de unos días.",
  ],
  results: [
    "notó avances que antes le parecían imposibles.",
    "se sintió con más control sobre su día a día.",
    "tenía un plan claro para seguir mejorando.",
  ],
  outline: [
    ["Por qué este tema importa más de lo que crees", "Entiende qué está en juego y por dónde empezar.", ["Reconoce tu punto de partida", "Identifica qué quieres cambiar", "Define un primer paso pequeño"]],
    ["Lo que casi nadie te explica", "Las ideas clave, sin complicaciones.", ["Separa los mitos de lo que funciona", "Aprende los conceptos básicos", "Relaciónalo con tu día a día"]],
    ["Pequeños cambios que sí funcionan", "Acciones concretas para empezar esta semana.", ["Empieza con algo sencillo", "Hazlo a la misma hora cada día", "Anota lo que vas notando"]],
    ["Cuando las cosas se complican", "Qué hacer ante los obstáculos más comunes.", ["Anticipa los momentos difíciles", "Ten un plan B sencillo", "Pide ayuda cuando haga falta"]],
    ["Construye tu propio sistema", "Ordena lo aprendido en una rutina a tu medida.", ["Elige las herramientas que te sirven", "Crea una rutina simple", "Revísala cada semana"]],
    ["Hazlo parte de tu vida", "Mantén el avance sin depender de la motivación.", ["Celebra los avances", "Rodéate de apoyo", "Ajusta sin abandonar"]],
    ["Tu siguiente paso", "Mira lo que lograste y define hacia dónde seguir.", ["Haz un balance honesto", "Escribe una meta nueva", "Comparte lo que aprendiste"]],
  ],
};

// Personas diversas para los ejemplos cotidianos (RÉR-03).
const PEOPLE = [
  { name: "Daniela", context: "estudia de noche y trabaja en una cafetería", studyWork: true },
  { name: "Mateo", context: "cobra una beca y hace diseños por encargo los fines de semana", studyWork: true },
  { name: "Valentina", context: "estudia Enfermería y cuida a su hermano menor por las tardes", studyWork: false },
  { name: "José", context: "hace entregas en bicicleta mientras termina la universidad", studyWork: true },
  { name: "Camila", context: "comparte piso con dos amigas y estudia Ingeniería", studyWork: false },
  { name: "Andrés", context: "acaba de empezar su primer empleo en una oficina contable", studyWork: false },
  { name: "Lucía", context: "estudia a distancia desde un pueblo pequeño", studyWork: false },
  { name: "Samuel", context: "vive con su abuela y estudia Diseño Gráfico", studyWork: false },
  { name: "Mariana", context: "es la primera de su familia en ir a la universidad", studyWork: false },
  { name: "Tomás", context: "volvió a estudiar después de unos años trabajando", studyWork: true },
  { name: "Sofía", context: "trabaja medio tiempo en una tienda de ropa", studyWork: true },
  { name: "Diego", context: "juega en el equipo de fútbol de la universidad y estudia Derecho", studyWork: false },
];

const PERIODS = ["dos semanas", "un mes", "unas semanas", "tres semanas"];

// ---------- utilidades ----------

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(list: T[], seed: number): T {
  return list[seed % list.length];
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function upperFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function bookFor(nicheId: string): NicheBook | undefined {
  return BOOKS[nicheId];
}

/** Tema corto a partir del prompt libre, para títulos genéricos. */
export function topicFromPrompt(prompt: string): string {
  let t = prompt.trim().replace(/\s+/g, " ");
  t = t.replace(/^(quiero|me gustaría|necesito)\s+(un|una)\s+(ebook|libro|guía)\s+(sobre|de|para)\s+/i, "");
  t = t.replace(/^(un|una)\s+(ebook|libro|guía)\s+(práctica\s+)?(sobre|de|para)\s+/i, "");
  t = t.split(/[:.;!?]/)[0];
  const words = t.split(" ").slice(0, 8).join(" ");
  return words.replace(/,$/, "");
}

// ---------- Investigador: índice ----------

export interface OutlineResult {
  title: string;
  subtitle: string;
  items: OutlineItem[];
}

export function chapterCount(desired: 5 | 6 | 7 | "auto"): number {
  return desired === "auto" ? 6 : desired;
}

export function generateOutline(
  prompt: string,
  nicheId: string,
  desired: 5 | 6 | 7 | "auto",
  variant = 0,
): OutlineResult {
  const count = chapterCount(desired);
  const book = bookFor(nicheId);
  const seeds = book?.outline ?? GENERAL.outline;
  // Otra versión: rota el orden de los capítulos intermedios y cambia el último.
  const ordered = variant % 2 === 1 ? [seeds[0], ...seeds.slice(1, 6).reverse(), seeds[6]] : seeds;
  const chosen = count === 7 ? ordered : [...ordered.slice(0, count - 1), ordered[6]];
  const items: OutlineItem[] = chosen.map(([title, summary, keyPoints]) => ({
    id: uid(),
    title,
    summary,
    keyPoints: [...keyPoints],
  }));
  if (book) return { title: book.title, subtitle: book.subtitle, items };
  const topic = topicFromPrompt(prompt) || "Tu guía práctica";
  return {
    title: upperFirst(topic),
    subtitle: "Una guía práctica para tu día a día",
    items,
  };
}

/** Propuesta alternativa para un solo capítulo del índice. */
export function regenerateOutlineItem(nicheId: string, item: OutlineItem, taken: string[]): OutlineItem {
  const book = bookFor(nicheId);
  const pool = [...(book?.outline ?? []), ...GENERAL.outline];
  const alt = pool.find(([title]) => !taken.includes(title) && title !== item.title);
  if (!alt) return { ...item, id: uid(), summary: item.summary + " Con más ejemplos prácticos." };
  return { id: uid(), title: alt[0], summary: alt[1], keyPoints: [...alt[2]] };
}

// ---------- Redactor + Ejercicios: capítulo ----------

export interface ChapterRequest {
  ebookSeed: string;
  nicheId: string;
  number: number;
  total: number;
  item: OutlineItem;
  exercisePref: ExercisePref;
  adjustments?: ChapterAdjustChip[];
  note?: string;
  version?: number;
}

export function generateChapter(req: ChapterRequest): ChapterContent {
  const { item, number, total } = req;
  const adj = new Set(req.adjustments ?? []);
  const book = bookFor(req.nicheId) ?? { ...GENERAL, title: "", subtitle: "" };
  const seed = hash(`${req.ebookSeed}:${number}:${req.version ?? 0}`);
  const [kp1, kp2, kp3] = item.keyPoints.length >= 3 ? item.keyPoints : [...item.keyPoints, "Da un primer paso", "Revisa cómo te fue"];
  const short = adj.has("mas_corto");
  const close = adj.has("mas_cercano") || adj.has("menos_formal");

  // Introducción
  const intro = [
    `${item.summary} En este capítulo vas a ver por qué importa y cómo empezar hoy, con pasos concretos y sin complicarte.`,
  ];
  if (!short) {
    intro.push(
      close
        ? `Te lo digo claro: si alguna vez sentiste que ${book.pain}, no estás fallando. Le pasa a muchísima gente y tiene solución.`
        : `Si alguna vez sentiste que ${book.pain}, no te pasa solo a ti. Le pasa a mucha gente, y la buena noticia es que tiene solución.`,
    );
  }

  // Desarrollo, con subtítulos H3 por idea clave (RA-01)
  const templates = [
    (kp: string) =>
      `${close ? "Vamos al grano" : "Empecemos por lo básico"}: ${lowerFirst(kp)}. No hace falta hacerlo perfecto desde el primer día. Lo importante es que lo intentes esta misma semana y observes qué cambia.`,
    (kp: string) =>
      `Aquí está una de las claves: ${lowerFirst(kp)}. Cuando lo pones en práctica, las decisiones pequeñas empiezan a sumar y dejas de depender solo de la fuerza de voluntad.`,
    (kp: string) =>
      `Un error común es pensar que esto es solo para personas muy organizadas. En realidad, funciona mejor cuando lo haces simple y a tu medida: ${lowerFirst(kp)}, sin buscar la perfección.`,
  ];
  const development: string[] = [];
  [kp1, kp2, kp3].forEach((kp, i) => {
    if (short && i === 2) return;
    development.push(`### ${kp}`);
    development.push(templates[(i + seed) % 3](kp));
    if (i === 1 && !short) {
      development.push(
        [
          "- Empieza hoy, aunque sea con poco.",
          "- Hazlo visible: anótalo donde lo veas cada día.",
          "- Al final de la semana, revisa cómo te fue.",
        ].join("\n"),
      );
    }
  });

  // Ejemplos cotidianos
  const wantsStudyWork = /trabaj/i.test(req.note ?? "") && /estudi/i.test(req.note ?? "");
  const pool = wantsStudyWork ? PEOPLE.filter((p) => p.studyWork) : PEOPLE;
  const exampleCount = adj.has("mas_ejemplos") ? 2 : 1;
  const examples: string[] = [];
  for (let i = 0; i < exampleCount; i++) {
    const person = pick(pool, seed + number * 3 + i * 5);
    const problem = pick(book.problems, seed + i);
    const result = pick(book.results, seed + i + 1);
    const period = pick(PERIODS, seed + i + 2);
    const kp = i === 0 ? kp1 : kp2;
    examples.push(
      `${person.name} ${person.context}. ${problem} Decidió probar algo distinto: ${lowerFirst(kp)}. Lo hizo de forma sencilla, sin cambiar toda su rutina de golpe. Al cabo de ${period}, ${result}`,
    );
  }

  // Conclusión
  const last = number === total;
  const conclusion = [
    `Lo más importante de este capítulo cabe en tres ideas: ${lowerFirst(kp1)}, ${lowerFirst(kp2)} y ${lowerFirst(kp3)}. No tienes que aplicarlo todo de golpe.`,
    last
      ? "Con este capítulo cierras el libro, pero no el camino. Vuelve a estas páginas cuando lo necesites y quédate con lo que te funcione."
      : "Elige una idea y pruébala esta semana. En el siguiente capítulo seguimos avanzando.",
  ].join(" ");

  const sections: Record<SectionId, string> = {
    introduccion: intro.join("\n\n"),
    desarrollo: development.join("\n\n"),
    ejemplos: examples.join("\n\n"),
    conclusion,
  };

  return { sections, exercise: generateExercise(req, adj.has("otro_ejercicio")) };
}

function generateExercise(req: ChapterRequest, flip: boolean): Exercise {
  const { item, number, exercisePref } = req;
  let type: "checklist" | "reto" =
    exercisePref === "auto" ? (number % 2 === 1 ? "reto" : "checklist") : exercisePref;
  if (flip) type = type === "reto" ? "checklist" : "reto";
  const [kp1, kp2] = item.keyPoints;
  if (type === "reto") {
    const duration: "24h" | "48h" = number % 3 === 0 ? "24h" : "48h";
    return {
      type: "reto",
      duration,
      title: `Reto de ${duration === "48h" ? "48" : "24"} horas`,
      steps: [
        "Elige un momento concreto de hoy para empezar y anótalo.",
        `Pon en práctica esta idea: ${lowerFirst(kp1)}.`,
        kp2 ? `Si te queda tiempo, suma esta otra: ${lowerFirst(kp2)}.` : "Repite la acción al día siguiente.",
        "Al terminar, escribe en una frase cómo te fue y qué cambiarías.",
      ],
    };
  }
  return {
    type: "checklist",
    title: "Checklist de autoevaluación: marca lo que ya haces",
    items: [...item.keyPoints, "Tengo claro cuál será mi primer paso esta semana", "Sé a quién pedir apoyo si lo necesito"],
  };
}

export function wordCount(content: Partial<Record<SectionId, string>> | undefined): number {
  if (!content) return 0;
  return Object.values(content)
    .join(" ")
    .replace(/[#\-]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}
