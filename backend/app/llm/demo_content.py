"""Datos del proveedor demo (port de `frontend/src/lib/api/mock/content.ts`).

Índices por nicho, problemas y resultados para los ejemplos, y lecturas reales
y conocidas para la bibliografía. Todo en español y sin estereotipos (RÉR-03).
"""

from __future__ import annotations

# (título, resumen, [3 puntos clave])
Seed = tuple[str, str, list[str]]

BOOKS: dict[str, dict] = {
    "finanzas": {
        "title": "Ahorra sin dejar de vivir",
        "subtitle": "Finanzas para universitarios, sin complicarte",
        "pain": "el dinero se te va sin saber en qué",
        "problems": [
            "A mitad de mes ya no sabía en qué se le había ido el dinero.",
            "Cada vez que salía con sus amigos gastaba más de lo que había planeado.",
            "Tenía una deuda pequeña en la tarjeta que no dejaba de crecer.",
        ],
        "results": [
            "llegó a fin de mes con algo guardado por primera vez.",
            "notó que gastaba menos sin sentir que se privaba de todo.",
            "dejó de sentir ansiedad cada vez que revisaba su cuenta.",
        ],
        "outline": [
            ("El mes empieza el día que cobras", "Reparte lo que recibes antes de gastarlo.", ["Decide el destino de tu dinero el mismo día que llega", "Separa lo necesario, lo que disfrutas y lo que guardas", "Automatiza lo que puedas"]),
            ("Gastos hormiga: lo que no ves también cuenta", "Detecta las pequeñas fugas de cada semana.", ["Anota tus gastos pequeños durante siete días", "Distingue entre costumbre y necesidad", "Pon un tope semanal a los antojos"]),
            ("Tu primer presupuesto en una servilleta", "Un método de 10 minutos, sin hojas de cálculo.", ["Suma lo que entra y lo que sale", "Asigna un porcentaje a cada montón", "Revisa tu servilleta cada domingo"]),
            ("Ahorrar sin dejar de salir con amigos", "Planes baratos y acuerdos claros.", ["Propón planes que no dependan de gastar", "Habla de dinero sin incomodidad", "Guarda un fondo pequeño para salidas"]),
            ("Deudas, tarjetas y préstamos entre amigos", "Cuándo sí, cuándo no y cómo salir.", ["Entiende cuánto cuesta de verdad una deuda", "Usa la tarjeta como herramienta y no como sueldo", "Pon por escrito los préstamos entre amigos"]),
            ("Tu fondo para imprevistos, paso a paso", "Empieza con poco y hazlo automático.", ["Define una meta pequeña y alcanzable", "Guarda primero y gasta después", "Protege tu fondo de las tentaciones"]),
            ("Tu dinero dentro de un año", "Metas simples para seguir creciendo.", ["Escribe una meta con fecha", "Revisa tu progreso cada mes", "Celebra los avances sin gastar de más"]),
        ],
    },
    "tiempo": {
        "title": "Semanas que rinden",
        "subtitle": "Organiza tu tiempo cuando estudias y trabajas",
        "pain": "los días se te escapan sin avanzar en lo importante",
        "problems": [
            "Sentía que la semana se le escapaba sin avanzar en lo importante.",
            "Dejaba los trabajos para la última noche y terminaba sin energía.",
            "Su agenda estaba tan llena que no le quedaba tiempo para descansar.",
        ],
        "results": [
            "terminaba sus tareas con más calma y menos culpa.",
            "recuperó las tardes del domingo para descansar.",
            "entregó sus trabajos a tiempo sin desvelarse.",
        ],
        "outline": [
            ("Tu semana cabe en una hoja", "Mira toda tu semana antes de empezarla.", ["Anota primero tus compromisos fijos", "Reserva bloques para lo importante", "Deja espacios libres a propósito"]),
            ("Lo urgente, lo importante y lo que puede esperar", "Decide qué va primero sin culpa.", ["Separa las tareas urgentes de las importantes", "Elige tres prioridades por día", "Aprende a posponer con intención"]),
            ("Bloques cortos, avances reales", "Trabaja en tramos de 25 a 50 minutos.", ["Divide las tareas grandes en pasos pequeños", "Trabaja con un temporizador", "Descansa antes de cansarte"]),
            ("Cuando estudias y trabajas a la vez", "Estrategias para los días más llenos.", ["Aprovecha los tiempos muertos", "Negocia tus horarios con claridad", "Prepara la noche anterior"]),
            ("Adiós a la procrastinación de última hora", "Empieza aunque no tengas ganas.", ["Usa la regla de los dos minutos", "Hazlo imperfecto primero", "Quita las distracciones antes de empezar"]),
            ("Descansar también es parte del plan", "El descanso que te deja rendir más.", ["Programa tu descanso como una tarea", "Protege tus horas de sueño", "Desconéctate un rato cada día"]),
            ("Tu sistema para cada domingo", "Una revisión semanal de 15 minutos.", ["Revisa lo que funcionó", "Ajusta el plan de la semana siguiente", "Anota una mejora concreta"]),
        ],
    },
    "conflictos": {
        "title": "Hablar claro sin pelear",
        "subtitle": "Resuelve conflictos en casa, en clase y en el trabajo",
        "pain": "una discusión se te fue de las manos",
        "problems": [
            "Las discusiones por la limpieza del piso eran cada vez más frecuentes.",
            "En su equipo de clase nadie se atrevía a decir lo que le molestaba.",
            "Una conversación con un compañero terminó en gritos.",
        ],
        "results": [
            "las conversaciones difíciles empezaron a durar menos y a terminar mejor.",
            "el ambiente en casa se volvió más tranquilo.",
            "el equipo terminó el proyecto sin rencores.",
        ],
        "outline": [
            ("Por qué discutimos (y por qué no está mal)", "El conflicto como señal, no como fracaso.", ["Reconoce qué hay detrás de una discusión", "Separa a la persona del problema", "Elige el momento para hablar"]),
            ("Escuchar para entender, no para responder", "La escucha que baja la tensión.", ["Deja terminar a la otra persona", "Repite con tus palabras lo que entendiste", "Pregunta antes de suponer"]),
            ("Decir lo que te molesta sin atacar", "Frases que abren conversaciones.", ["Habla de lo que sientes y no de cómo es la otra persona", "Describe hechos concretos", "Pide algo claro y posible"]),
            ("Acuerdos de convivencia que sí se cumplen", "Reglas claras para compartir espacios.", ["Pongan las reglas por escrito", "Repartan las tareas de forma justa", "Revisen los acuerdos cada mes"]),
            ("Conflictos en equipos de trabajo y de clase", "Cuando hay una nota o un proyecto de por medio.", ["Definan los roles desde el inicio", "Hablen de los problemas a tiempo", "Busquen soluciones y no culpables"]),
            ("Cuando la conversación se calienta", "Qué hacer si todo se sale de control.", ["Pide una pausa sin abandonar la conversación", "Baja el volumen y la velocidad", "Retoma el tema con calma"]),
            ("Reparar después de una pelea", "Cómo pedir disculpas y volver a confiar.", ["Reconoce tu parte sin excusas", "Propón un cambio concreto", "Da tiempo para recuperar la confianza"]),
        ],
    },
    "empleo": {
        "title": "Tu primer empleo sin miedo",
        "subtitle": "Los primeros 90 días, paso a paso",
        "pain": "empezar en un trabajo nuevo te da nervios",
        "problems": [
            "Los primeros días sentía que no entendía nada de lo que hablaba el equipo.",
            "Le daba vergüenza preguntar lo mismo dos veces.",
            "Cometió un error en un informe y no sabía cómo decirlo.",
        ],
        "results": [
            "se sentía parte del equipo y sabía a quién acudir.",
            "su jefa le confió una tarea más importante.",
            "aprendió en semanas lo que creía que le tomaría meses.",
        ],
        "outline": [
            ("Antes del primer día", "Prepárate para empezar con buen pie.", ["Investiga cómo trabaja el equipo", "Prepara preguntas para tu primera semana", "Organiza tu logística con tiempo"]),
            ("La primera semana: observar y preguntar", "Aprende cómo funcionan las cosas.", ["Anota nombres, procesos y herramientas", "Pregunta sin miedo a parecer nuevo", "Identifica a quién acudir para cada cosa"]),
            ("Aprender rápido sin agobiarte", "Un método para absorber lo nuevo.", ["Resume cada día lo que aprendiste", "Practica primero lo que más usarás", "Pide ejemplos de trabajos bien hechos"]),
            ("Comunicarte con quien te dirige", "Expectativas claras desde el principio.", ["Acuerda qué se espera de ti", "Informa tus avances antes de que te pregunten", "Pide retroalimentación con frecuencia"]),
            ("Errores: qué hacer cuando algo sale mal", "Equivocarte sin hundirte.", ["Avisa pronto y con una propuesta", "Aprende qué falló en el proceso", "No cargues con la culpa en silencio"]),
            ("Ganarte la confianza del equipo", "Pequeños gestos que suman.", ["Cumple lo que prometes", "Ofrece ayuda en lo que sabes hacer", "Reconoce el trabajo de los demás"]),
            ("Tus primeros 90 días en perspectiva", "Evalúa lo aprendido y define tu siguiente paso.", ["Haz un balance honesto", "Conversa sobre tu crecimiento", "Define una meta para los próximos meses"]),
        ],
    },
    "habitos": {
        "title": "Hábitos que se quedan",
        "subtitle": "Pequeños cambios que duran más de dos semanas",
        "pain": "tus propósitos duran menos de dos semanas",
        "problems": [
            "Empezaba rutinas nuevas cada lunes y las abandonaba el jueves.",
            "Quería leer más, pero siempre terminaba viendo videos en el celular.",
            "Se proponía hacer ejercicio, pero nunca encontraba el momento.",
        ],
        "results": [
            "llevaba tres semanas seguidas cumpliendo su hábito.",
            "el hábito dejó de sentirse como un esfuerzo.",
            "había leído dos libros casi sin darse cuenta.",
        ],
        "outline": [
            ("Por qué los propósitos no duran", "Lo que la motivación no puede hacer por ti.", ["Entiende la diferencia entre meta y hábito", "Empieza con algo ridículamente pequeño", "Diseña tu entorno a tu favor"]),
            ("El hábito más pequeño posible", "Dos minutos que cambian la semana.", ["Reduce el hábito a su versión mínima", "Engánchalo a algo que ya haces", "Celebra cada vez que lo cumples"]),
            ("Tu entorno trabaja por ti", "Cambia lo que tienes alrededor.", ["Deja a la vista lo que quieres hacer", "Esconde lo que quieres evitar", "Prepara todo la noche anterior"]),
            ("Cuando fallas un día", "Volver sin empezar de cero.", ["Nunca falles dos veces seguidas", "Ajusta el hábito en vez de abandonarlo", "Háblate con amabilidad"]),
            ("Registrar sin obsesionarte", "Ver tu progreso te ayuda a seguir.", ["Marca cada día que lo cumples", "Revisa tu registro cada semana", "Mide lo que importa y no todo"]),
            ("Hábitos que se contagian", "El apoyo de otras personas.", ["Busca a alguien con tu misma meta", "Comparte tu avance", "Rodéate de gente que ya lo hace"]),
            ("De hábito a identidad", "Cuando ya no necesitas esforzarte tanto.", ["Piensa en quién quieres ser", "Suma un hábito nuevo solo cuando el anterior sea fácil", "Revisa tus rutinas cada trimestre"]),
        ],
    },
    "estres": {
        "title": "Respira, estudia, descansa",
        "subtitle": "Maneja el estrés en época de exámenes",
        "pain": "la presión de los exámenes te quita el sueño",
        "problems": [
            "En época de exámenes dormía poco y estudiaba con el corazón acelerado.",
            "Sentía un nudo en el estómago cada vez que pensaba en todo lo pendiente.",
            "Le costaba concentrarse porque su cabeza no paraba.",
        ],
        "results": [
            "llegó al examen con la mente más clara.",
            "dormía mejor y estudiaba con más calma.",
            "aprendió a reconocer las señales antes de que el estrés le ganara.",
        ],
        "outline": [
            ("Qué es el estrés y para qué sirve", "Entender lo que pasa en tu cuerpo.", ["Reconoce las señales del estrés", "Distingue el estrés útil del que te agota", "Identifica tus principales detonantes"]),
            ("Respirar para bajar el ritmo", "Técnicas de un minuto.", ["Practica una respiración lenta y contada", "Haz pausas cortas durante el estudio", "Respira antes de empezar un examen"]),
            ("Organizar para preocuparte menos", "Un plan reduce la incertidumbre.", ["Saca de tu cabeza lo que tienes pendiente", "Divide el temario en partes pequeñas", "Planifica también los descansos"]),
            ("Dormir bien en época de exámenes", "El sueño también es parte del estudio.", ["Mantén horarios regulares", "Deja las pantallas antes de dormir", "Evita estudiar toda la noche"]),
            ("Cuerpo en movimiento, mente más tranquila", "Actividad física sencilla.", ["Camina diez minutos al día", "Estírate entre bloques de estudio", "Elige algo que disfrutes"]),
            ("Hablar de lo que te pasa", "Pedir apoyo también es cuidarte.", ["Cuéntale a alguien de confianza", "Pon en palabras lo que sientes", "Reconoce cuándo buscar ayuda profesional"]),
            ("Tu kit contra el estrés", "Herramientas para tener a mano.", ["Arma tu lista de recursos", "Prepara un plan para los días difíciles", "Revisa qué te funcionó y qué no"]),
        ],
    },
    "comunicacion": {
        "title": "Decir que no sin culpa",
        "subtitle": "Comunicación asertiva para el día a día",
        "pain": "te cuesta decir lo que piensas sin sentirte mal",
        "problems": [
            "Decía que sí a todo y terminaba sin tiempo para lo suyo.",
            "Le costaba pedir ayuda por miedo a molestar.",
            "Cuando algo le molestaba, se lo guardaba hasta explotar.",
        ],
        "results": [
            "recuperó tiempo para lo que de verdad le importaba.",
            "sus relaciones se volvieron más honestas.",
            "se sintió con más confianza para hablar en las reuniones.",
        ],
        "outline": [
            ("Qué es ser asertivo (y qué no)", "Entre callar y explotar hay otro camino.", ["Distingue entre pasivo, agresivo y asertivo", "Reconoce tu estilo habitual", "Recuerda que tus necesidades también cuentan"]),
            ("Decir que no sin culpa", "Negarte con respeto y claridad.", ["Responde sin justificarte de más", "Ofrece alternativas cuando quieras", "Sostén tu respuesta con calma"]),
            ("Pedir lo que necesitas", "Hacer peticiones claras.", ["Di qué necesitas y para cuándo", "Usa un tono firme y amable", "Acepta que la otra persona puede negarse"]),
            ("Poner límites en el trabajo", "Cuidar tu tiempo y tu energía.", ["Define tus límites antes de necesitarlos", "Comunícalos con anticipación", "Repite el límite si no se respeta"]),
            ("Recibir críticas sin derrumbarte", "Escuchar sin tomarlo como un ataque.", ["Separa el comentario de tu valor personal", "Pide ejemplos concretos", "Quédate con lo que te sirve"]),
            ("Conversaciones difíciles con la familia", "Hablar claro con quien más quieres.", ["Elige un buen momento", "Habla desde tu experiencia", "Busca acuerdos en lugar de ganar"]),
            ("Tu forma de comunicarte, paso a paso", "Practicar hasta que salga natural.", ["Ensaya las frases clave", "Empieza con situaciones fáciles", "Revisa tus avances cada semana"]),
        ],
    },
    "estudio": {
        "title": "Estudiar menos horas, aprender más",
        "subtitle": "Técnicas para tu primer año de universidad",
        "pain": "estudias mucho y recuerdas poco",
        "problems": [
            "Leía los apuntes una y otra vez, pero en el examen se le olvidaba todo.",
            "Estudiaba muchas horas seguidas y terminaba sin recordar casi nada.",
            "Se distraía con el celular cada cinco minutos.",
        ],
        "results": [
            "subió sus notas estudiando menos horas.",
            "recordaba mejor los temas sin memorizarlos de golpe.",
            "terminó el semestre con menos estrés y mejores resultados.",
        ],
        "outline": [
            ("Estudiar no es leer muchas veces", "Lo que de verdad ayuda a recordar.", ["Cambia la relectura por la práctica", "Explica con tus palabras lo que aprendiste", "Pon a prueba tu memoria"]),
            ("Tu plan de estudio semanal", "Menos horas, mejor repartidas.", ["Reparte el estudio en varios días", "Asigna a cada sesión un objetivo claro", "Deja espacio para repasar"]),
            ("Tomar apuntes que sí sirven", "Notas para entender, no para copiar.", ["Escribe preguntas en el margen", "Resume cada clase en cinco líneas", "Conecta ideas con esquemas simples"]),
            ("Concentrarte en un mundo de notificaciones", "Proteger tu atención.", ["Aleja el celular mientras estudias", "Trabaja en bloques con descanso", "Prepara tu espacio antes de empezar"]),
            ("Repasar sin empezar de cero", "El repaso espaciado.", ["Repasa al día siguiente, a la semana y al mes", "Usa tarjetas de preguntas", "Enfócate en lo que más te cuesta"]),
            ("Preparar un examen en una semana", "Un plan realista cuando hay poco tiempo.", ["Prioriza los temas con más peso", "Haz simulacros con tiempo", "Descansa la noche anterior"]),
            ("Aprender de cada nota", "Mejorar después de cada evaluación.", ["Revisa en qué te equivocaste", "Ajusta tu método", "Celebra lo que salió bien"]),
        ],
    },
}

GENERAL: dict = {
    "pain": "quieres mejorar, pero no sabes por dónde empezar",
    "problems": [
        "Sentía que quería cambiar algo, pero no sabía por dónde empezar.",
        "Había intentado mejorar varias veces sin conseguirlo.",
        "Le costaba mantener la constancia más de unos días.",
    ],
    "results": [
        "notó avances que antes le parecían imposibles.",
        "se sintió con más control sobre su día a día.",
        "tenía un plan claro para seguir mejorando.",
    ],
    "outline": [
        ("Por qué este tema importa más de lo que crees", "Entiende qué está en juego y por dónde empezar.", ["Reconoce tu punto de partida", "Identifica qué quieres cambiar", "Define un primer paso pequeño"]),
        ("Lo que casi nadie te explica", "Las ideas clave, sin complicaciones.", ["Separa los mitos de lo que funciona", "Aprende los conceptos básicos", "Relaciónalo con tu día a día"]),
        ("Pequeños cambios que sí funcionan", "Acciones concretas para empezar esta semana.", ["Empieza con algo sencillo", "Hazlo a la misma hora cada día", "Anota lo que vas notando"]),
        ("Cuando las cosas se complican", "Qué hacer ante los obstáculos más comunes.", ["Anticipa los momentos difíciles", "Ten un plan B sencillo", "Pide ayuda cuando haga falta"]),
        ("Construye tu propio sistema", "Ordena lo aprendido en una rutina a tu medida.", ["Elige las herramientas que te sirven", "Crea una rutina simple", "Revísala cada semana"]),
        ("Hazlo parte de tu vida", "Mantén el avance sin depender de la motivación.", ["Celebra los avances", "Rodéate de apoyo", "Ajusta sin abandonar"]),
        ("Tu siguiente paso", "Mira lo que lograste y define hacia dónde seguir.", ["Haz un balance honesto", "Escribe una meta nueva", "Comparte lo que aprendiste"]),
    ],
}

PERIODS = ["dos semanas", "un mes", "unas semanas", "tres semanas"]

# ---------- Lecturas reales y conocidas (formato de salida del prompt de lecturas) ----------


def _book(authors, year, title, publisher, isbn="", edition="", motivo=""):
    return {
        "tipo": "libro",
        "autores": authors,
        "anio": year,
        "titulo": title,
        "editorial": publisher,
        "edicion": edition,
        "isbn": isbn,
        "motivo": motivo,
    }


def _article(authors, year, title, journal, volume, issue, pages, doi, motivo=""):
    return {
        "tipo": "articulo",
        "autores": authors,
        "anio": year,
        "titulo": title,
        "revista": journal,
        "volumen": volume,
        "numero": issue,
        "paginas": pages,
        "doi": doi,
        "motivo": motivo,
    }


ATOMIC = _book(["Clear, James"], 2018, "Atomic habits: An easy & proven way to build good habits & break bad ones", "Avery", "9780735211292", motivo="Te ayuda a entender por qué los cambios pequeños y repetidos terminan marcando la diferencia.")
MINDSET = _book(["Dweck, Carol S."], 2006, "Mindset: The new psychology of success", "Random House", "9781400062751", motivo="Explica cómo cambia tu forma de aprender cuando ves tus capacidades como algo que puede crecer.")
GRIT = _book(["Duckworth, Angela"], 2016, "Grit: The power of passion and perseverance", "Scribner", "9781501111105", motivo="Muestra por qué la constancia pesa tanto como el talento en las metas largas.")
SELF_COMPASSION = _book(["Neff, Kristin"], 2011, "Self-compassion: The proven power of being kind to yourself", "William Morrow", "9780061733512", motivo="Te da herramientas para tratarte con amabilidad cuando las cosas no salen como esperabas.")
CRUCIAL = _book(["Patterson, Kerry", "Grenny, Joseph", "McMillan, Ron", "Switzler, Al"], 2012, "Crucial conversations: Tools for talking when stakes are high", "McGraw-Hill", "9780071771320", edition="2", motivo="Ofrece pasos concretos para hablar de temas delicados sin que la conversación explote.")
DIFFICULT = _book(["Stone, Douglas", "Patton, Bruce", "Heen, Sheila"], 2010, "Difficult conversations: How to discuss what matters most", "Penguin Books", "9780143118442", motivo="Te ayuda a separar lo que pasó, lo que sientes y lo que está en juego en una discusión.")

READINGS: dict[str, list[dict]] = {
    "habitos": [
        ATOMIC,
        _book(["Duhigg, Charles"], 2012, "The power of habit: Why we do what we do in life and business", "Random House", "9781400069286", motivo="Explica el ciclo de señal, rutina y recompensa que hay detrás de cada hábito."),
        _book(["Fogg, B. J."], 2019, "Tiny habits: The small changes that change everything", "Houghton Mifflin Harcourt", "9780358003328", motivo="Propone empezar con versiones mínimas de cada hábito para que no dependan de la motivación."),
        _article(["Lally, Phillippa", "van Jaarsveld, Cornelia H. M.", "Potts, Henry W. W.", "Wardle, Jane"], 2010, "How are habits formed: Modelling habit formation in the real world", "European Journal of Social Psychology", "40", "6", "998-1009", "10.1002/ejsp.674", motivo="Es el estudio que muestra que un hábito tarda semanas en volverse automático, no 21 días."),
        SELF_COMPASSION,
    ],
    "finanzas": [
        _book(["Housel, Morgan"], 2020, "The psychology of money: Timeless lessons on wealth, greed, and happiness", "Harriman House", "9780857197689", motivo="Muestra que manejar bien el dinero tiene más que ver con el comportamiento que con las fórmulas."),
        _book(["Thaler, Richard H.", "Sunstein, Cass R."], 2008, "Nudge: Improving decisions about health, wealth, and happiness", "Yale University Press", "9780300122237", motivo="Te ayuda a diseñar tu entorno para que ahorrar sea la opción más fácil."),
        _book(["Mullainathan, Sendhil", "Shafir, Eldar"], 2013, "Scarcity: Why having too little means so much", "Times Books", "9780805092646", motivo="Explica por qué la falta de dinero o de tiempo cambia la forma en que decidimos."),
        ATOMIC,
    ],
    "tiempo": [
        _book(["Newport, Cal"], 2016, "Deep work: Rules for focused success in a distracted world", "Grand Central Publishing", "9781455586691", motivo="Te enseña a proteger bloques de concentración en una semana llena de interrupciones."),
        _book(["Allen, David"], 2015, "Getting things done: The art of stress-free productivity", "Penguin Books", "9780143126560", motivo="Propone un sistema para sacar los pendientes de tu cabeza y decidir qué hacer después."),
        _book(["Burkeman, Oliver"], 2021, "Four thousand weeks: Time management for mortals", "Farrar, Straus and Giroux", "9780374159122", motivo="Te invita a elegir qué dejar fuera en lugar de intentar hacerlo todo."),
        _article(["Steel, Piers"], 2007, "The nature of procrastination: A meta-analytic and theoretical review of quintessential self-regulatory failure", "Psychological Bulletin", "133", "1", "65-94", "10.1037/0033-2909.133.1.65", motivo="Resume décadas de investigación sobre por qué posponemos lo que sabemos que debemos hacer."),
    ],
    "conflictos": [
        _book(["Fisher, Roger", "Ury, William", "Patton, Bruce"], 2011, "Getting to yes: Negotiating agreement without giving in", "Penguin Books", "9780143118756", edition="3", motivo="Te enseña a negociar centrándote en los intereses y no en las posiciones."),
        DIFFICULT,
        CRUCIAL,
    ],
    "comunicacion": [
        _book(["Rosenberg, Marshall B."], 2015, "Nonviolent communication: A language of life", "PuddleDancer Press", "9781892005281", edition="3", motivo="Propone una forma de expresar lo que necesitas sin culpar a la otra persona."),
        CRUCIAL,
        DIFFICULT,
        _book(["Cain, Susan"], 2012, "Quiet: The power of introverts in a world that can't stop talking", "Crown", "9780307352149", motivo="Ayuda a comunicarte desde tu forma de ser, también si te cuesta hablar en grupo."),
    ],
    "empleo": [
        _book(["Grant, Adam"], 2013, "Give and take: A revolutionary approach to success", "Viking", "9780670026555", motivo="Muestra cómo ayudar a otras personas en el trabajo, sin descuidarte, construye confianza."),
        MINDSET,
        _book(["Newport, Cal"], 2012, "So good they can't ignore you: Why skills trump passion in the quest for work you love", "Business Plus", "9781455509126", motivo="Te anima a construir habilidades valiosas en tus primeros empleos."),
        _article(["Edmondson, Amy"], 1999, "Psychological safety and learning behavior in work teams", "Administrative Science Quarterly", "44", "2", "350-383", "10.2307/2666999", motivo="Explica por qué los equipos aprenden más cuando preguntar no da miedo."),
    ],
    "estres": [
        _book(["McGonigal, Kelly"], 2015, "The upside of stress: Why stress is good for you, and how to get good at it", "Avery", "9781583335611", motivo="Cambia la forma de ver el estrés y propone maneras de usarlo a tu favor."),
        _book(["Walker, Matthew"], 2017, "Why we sleep: Unlocking the power of sleep and dreams", "Scribner", "9781501144318", motivo="Explica por qué dormir bien es parte del estudio y no tiempo perdido."),
        SELF_COMPASSION,
        _article(["Cohen, Sheldon", "Kamarck, Tom", "Mermelstein, Robin"], 1983, "A global measure of perceived stress", "Journal of Health and Social Behavior", "24", "4", "385-396", "10.2307/2136404", motivo="Presenta la escala de estrés percibido, una de las más usadas para medirlo."),
    ],
    "estudio": [
        _book(["Brown, Peter C.", "Roediger, Henry L.", "McDaniel, Mark A."], 2014, "Make it stick: The science of successful learning", "Belknap Press", "9780674729018", motivo="Reúne lo que la investigación sabe sobre cómo recordar mejor lo que estudias."),
        _book(["Oakley, Barbara"], 2014, "A mind for numbers: How to excel at math and science (even if you flunked algebra)", "TarcherPerigee", "9780399165245", motivo="Explica técnicas sencillas para concentrarte y repasar con menos esfuerzo."),
        _article(["Dunlosky, John", "Rawson, Katherine A.", "Marsh, Elizabeth J.", "Nathan, Mitchell J.", "Willingham, Daniel T."], 2013, "Improving students' learning with effective learning techniques: Promising directions from cognitive and educational psychology", "Psychological Science in the Public Interest", "14", "1", "4-58", "10.1177/1529100612453266", motivo="Compara las técnicas de estudio más comunes y dice cuáles funcionan de verdad."),
        _article(["Roediger, Henry L.", "Karpicke, Jeffrey D."], 2006, "Test-enhanced learning: Taking memory tests improves long-term retention", "Psychological Science", "17", "3", "249-255", "10.1111/j.1467-9280.2006.01693.x", motivo="Muestra por qué ponerte a prueba ayuda más que releer los apuntes."),
    ],
    "general": [ATOMIC, MINDSET, GRIT, SELF_COMPASSION],
}
