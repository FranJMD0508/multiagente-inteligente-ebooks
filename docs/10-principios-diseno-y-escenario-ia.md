# 10 · Principios del diseño y escenario de IA

> Investigación para la clase de Ingeniería del Software (prof. Ifigenia Requena), semana del 13 al 17 de octubre de 2026. Según la planificación, esa semana toca "ética en IA y cumplimiento de estándares".
> Responde dos preguntas aplicadas a Folio: **¿qué elementos se consideran principios del diseño?** y **¿con qué escenario de IA estamos trabajando?**
> Se basa en el material del aula virtual (clases del AI Act, "Marco legal para el desarrollo de IA" y la guía del informe de modelo de calidad), en los textos oficiales y en la bibliografía de la sección [Fuentes](#fuentes).

## Respuesta corta (para decirla en clase)

**Principios del diseño.** Son las reglas que guían cómo se toman las decisiones de diseño. Se dan en tres niveles y Folio aplica los tres:
1. **Diseño de software** (Pressman): trazabilidad con los requerimientos, abstracción, modularidad, ocultamiento de información, independencia funcional (alta cohesión y bajo acoplamiento), interfaces cuidadas, diseño de datos y diseño iterativo.
2. **Diseño de la interfaz** (Mandel, Nielsen y las metas de diseño de WebApps): dejar el control al usuario, reducir la carga de memoria, consistencia, visibilidad del estado del sistema, prevención de errores, simplicidad e identidad.
3. **Diseño visual**: contraste, jerarquía, alineación, proximidad, repetición, equilibrio, espacio en blanco, énfasis y unidad.

**Escenario de IA.** Folio es un sistema de **IA generativa de texto** (procesamiento de lenguaje natural con un modelo de lenguaje grande), organizado como **sistema multiagente orquestado con humano en el bucle**. Es **IA estrecha**: hace una sola tarea. Según el AI Act de la UE es de **riesgo limitado**, con obligaciones de **transparencia** (art. 50). No es una práctica prohibida (art. 5) ni de alto riesgo (anexo III), porque no toma decisiones sobre personas. Aun así, adopta por voluntad propia la **supervisión humana** que el art. 14 exige al alto riesgo. En Venezuela le aplica el **Código de Ética para el desarrollo y aplicación responsable de la IA** (MINCYT, febrero de 2026), que no es vinculante.

---

## Parte 1 · Principios del diseño

### 1.1 Qué se entiende por "principios del diseño"

Un **principio de diseño** es una regla general que orienta las decisiones y permite juzgar si un diseño es bueno. Conviene no confundirlo con los **elementos del diseño**, que son los ingredientes con los que se diseña:

| Elementos (con qué se diseña) | Principios (cómo se combinan) |
|---|---|
| Color, tipografía, forma, línea, espacio, iconos e imágenes | Contraste, jerarquía, alineación, proximidad, repetición, equilibrio, espacio en blanco, énfasis y unidad |

En Ingeniería del Software la expresión se usa en tres niveles, y lo más seguro en clase es nombrarlos todos:

| Nivel | Pregunta que responde | Autores de referencia |
|---|---|---|
| Diseño de software | ¿Cómo se organiza el sistema por dentro? | Pressman (conceptos y principios de diseño), SOLID |
| Diseño de la interfaz y la interacción | ¿Cómo lo usa una persona? | Mandel (reglas de oro), Nielsen (heurísticas), Pressman (metas de diseño de WebApps) |
| Diseño visual | ¿Cómo se ve y cómo se lee? | Principios gráficos clásicos (contraste, alineación, repetición, proximidad...) |

Folio además tiene **sus propios principios escritos** en [07 §2](./07-diseno-interfaz.md): la calma de Gemini con la identidad de un libro, el libro está en los objetos, una regla que no cambia, se ve el trabajo, no se puede romper el libro y la cinta solo aparece cuando es tu turno. Más abajo se muestra a qué principio clásico corresponde cada uno.

### 1.2 Principios del diseño de software según Pressman

Pressman (capítulo "Principios que guían la práctica") propone nueve principios para el modelado del diseño. Folio los cumple así:

| # | Principio | Cómo lo cumple Folio | Evidencia |
|---|---|---|---|
| 1 | El diseño debe poder rastrearse hasta el modelo de requerimientos | Cada pantalla y cada componente se justifica con un RF, RNF, RA o RÉR, y cada requerimiento tiene su prueba de aceptación | [02](./02-analisis-requerimientos.md), [07 §13](./07-diseno-interfaz.md), [09](./09-verificacion-requerimientos.md), `frontend/e2e/requisitos.spec.ts` |
| 2 | Siempre hay que tener en cuenta la arquitectura del sistema | Se definió primero la arquitectura en capas (cliente, API, orquestador, agentes, capa LLM y datos) y el frontend se construyó respetando ese contrato | [03 §1](./03-arquitectura.md) |
| 3 | El diseño de los datos es tan importante como el de las funciones | Hay modelo entidad-relación, tipos de dominio y una máquina de estados del ebook | [03 §4, §5 y §7](./03-arquitectura.md), `frontend/src/lib/types.ts` |
| 4 | Las interfaces internas y externas deben diseñarse con cuidado | El contrato REST y los eventos SSE están tipados; los componentes solo hablan con la fachada `api` | [03 §6](./03-arquitectura.md), `frontend/src/lib/api/index.ts` |
| 5 | La interfaz de usuario debe ajustarse al usuario final y ser fácil de usar | Se diseñó para dos perfiles concretos (creadora y docente), con WCAG 2.2 AA | [01 §4](./01-vision-producto.md), [04](./04-experiencia-usuario.md), [07 §10](./07-diseno-interfaz.md) |
| 6 | Los componentes deben tener independencia funcional | Un agente por rol (RNF-04) y un componente por etapa del espacio de trabajo | [03 §2](./03-arquitectura.md), `frontend/src/components/workspace/stages/` |
| 7 | Los componentes deben estar acoplados con holgura entre sí y con el entorno | El proveedor de LLM se cambia sin tocar a los agentes (D-06), y los datos simulados se cambian por la API real sin tocar los componentes (D-30) | [06](./06-decisiones.md) |
| 8 | Las representaciones del diseño deben entenderse con facilidad | Diagramas de flujo, del grafo de agentes, de estados y entidad-relación, y maquetas navegables | [03](./03-arquitectura.md), `docs/diseno/mesa-de-diseno.html` |
| 9 | El diseño debe desarrollarse de forma iterativa y buscar más sencillez en cada vuelta | Trabajo por fases (D-07); se descartaron direcciones visuales ("Cuaderno", "Lomo") y se eligió SSE en vez de WebSockets por ser más simple (D-14) | [06](./06-decisiones.md) |

### 1.3 Conceptos de diseño (Pressman) presentes en Folio

| Concepto | Qué significa | En Folio |
|---|---|---|
| **Abstracción** | Trabajar con la idea esencial y ocultar el detalle | La capa LLM abstrae al proveedor; `PipelineEvent` abstrae el avance de cualquier agente |
| **Arquitectura** | Estructura general de componentes y relaciones | Cliente-servidor por capas con un orquestador de agentes (LangGraph) |
| **Patrones** | Soluciones probadas a problemas recurrentes | Fachada (`api`), adaptador (`mock` / `http`), máquina de estados (`EbookStatus`), cadena de procesamiento (agentes en secuencia), publicación-suscripción (SSE y la caché del cliente con sus hooks) |
| **Separación de intereses** | Cada parte resuelve un solo problema | Editar y exportar ocurren fuera del grafo de agentes (03 §3); en pantalla, la izquierda es "lo que decides" y la derecha "tu libro" |
| **Modularidad** | Dividir el sistema en módulos manejables | Cuatro agentes con sus prompts en archivos independientes (RNF-04) |
| **Ocultamiento de información** | Un módulo no expone cómo funciona por dentro | Los componentes no saben si los datos vienen del simulador o del servidor |
| **Independencia funcional** | Alta cohesión y bajo acoplamiento | El Redactor no maqueta y el Maquetador no redacta |
| **Refinamiento** | Ir de lo general a lo detallado | Visión (01) → requerimientos (02) → arquitectura (03) → diseño (07) → código |
| **Refactorización** | Mejorar el diseño sin cambiar lo que hace | La ruta `/ebook/[id]/editar` se integró en el espacio de trabajo (D-26) y las rutas pasaron a usar parámetros para publicar en GitHub Pages (D-33) |

Equivalencias con otros principios conocidos: **responsabilidad única** (cada agente y cada etapa hacen una cosa), **inversión de dependencias** (los componentes dependen de la fachada, no de una implementación), **KISS** (SSE en vez de WebSockets) y **YAGNI** (pagos, imágenes con IA y publicación en marketplaces quedaron fuera del alcance, 01 §7).

### 1.4 Principios del diseño de la interfaz

#### Las tres reglas de oro de Mandel (citadas por Pressman)

| Regla | Qué pide | En Folio |
|---|---|---|
| **Dejar el control al usuario** | Interacción interrumpible y reversible, personalizable, sin tecnicismos y con manipulación directa | Los dos puntos de control (RF-05) son esta regla llevada al proceso: la IA propone y la persona decide. Se puede salir y volver, recuperar versiones anteriores, arrastrar capítulos y editar en el mismo lugar. No se habla de "tokens" ni de "modelos" |
| **Reducir la carga de memoria** | Metáfora del mundo real, valores predeterminados con sentido y revelación progresiva | La metáfora del libro abierto, la página y la cinta. Valores por defecto: A5, Roboto 11 pt y color de tela según el nicho. Los ajustes son opcionales y están dentro de la caja de texto |
| **Hacer la interfaz consistente** | Contexto claro, indicadores visuales coherentes y consistencia en toda la aplicación | La misma regla izquierda/derecha en todas las etapas, la cinta siempre significa "Tu turno" y los estados siempre combinan forma, ícono y texto |

#### Las diez heurísticas de usabilidad de Nielsen

| Heurística | En Folio |
|---|---|
| 1. Visibilidad del estado del sistema | Fases con el agente responsable, bitácora, texto que aparece en vivo y "Guardado hace unos segundos" |
| 2. Relación con el mundo real | Lenguaje de libro (índice, capítulo, portada) y tuteo en español |
| 3. Control y libertad del usuario | "Mantener la versión actual", volver a versiones anteriores, regenerar y Cancelar |
| 4. Consistencia y estándares | Regla del libro abierto y componentes propios reutilizados en todas las pantallas |
| 5. Prevención de errores | No se puede salir de 5 a 7 capítulos, borrar secciones obligatorias, quitar el aviso legal ni bajar de 11 pt ("No se puede romper el libro") |
| 6. Reconocer antes que recordar | Chips de nichos, chips de ajustes rápidos y un resumen en chips al exportar |
| 7. Flexibilidad y eficiencia | Reordenar con teclado, chips o campo libre, y ajustes opcionales |
| 8. Diseño estético y minimalista | Un foco por pantalla y un solo color de acento |
| 9. Ayudar a reconocer y recuperarse de errores | "No pudimos terminar el capítulo 4. Lo que ya estaba escrito sigue a salvo." con el botón Reintentar; ante una ficción se ofrecen alternativas en vez de un error |
| 10. Ayuda y documentación | Tooltips en los límites y notas en contexto ("Este capítulo marcará el tono y el formato de todo el libro") |

#### Metas de diseño de una WebApp (Pressman, capítulo de diseño de WebApps)

Viene bien porque la unidad VII del curso incluye Ingeniería web.

| Meta | En Folio |
|---|---|
| Simplicidad | La caja de texto es la protagonista del inicio y hay una sola acción principal por etapa |
| Consistencia | Tokens de diseño compartidos y la misma estructura en todas las etapas |
| Identidad | "Mesa en calma con alma de libro", el nombre Folio y un color de tela por nicho |
| Robustez | Estados de error reintentable, sin conexión y reanudación del trabajo pendiente |
| Navegabilidad | Barra lateral, biblioteca con filtros y, en móvil, las pestañas "Decidir" y "Tu libro" |
| Atractivo visual | Sistema visual propio y movimiento con significado (07 §3 y §8) |
| Compatibilidad | Diseño adaptable en cuatro rangos de ancho, tema claro y oscuro, `prefers-reduced-motion` y sitio estático |

### 1.5 Principios del diseño visual

| Principio | En Folio |
|---|---|
| **Contraste** | Texto `#1B1D23` sobre blanco y el color tinta a 5,0:1; los pares se verificaron con WCAG AA. La portada valida el contraste en vivo (`frontend/src/lib/design.ts`) |
| **Jerarquía** | Tres fuentes con roles claros (Lexend para títulos, Onest para la interfaz y Roboto para el libro) y botones principales distintos de los secundarios |
| **Alineación** | Escala de espaciado de 4 px y una retícula de dos páginas |
| **Proximidad** | Las acciones de cada etapa aparecen juntas; los ajustes del prompt van dentro de la misma caja |
| **Repetición** | Píldoras, radios de 12 a 16 px e íconos de trazo fino en toda la app |
| **Equilibrio** | El libro abierto: dos páginas que se compensan (decides y ves) |
| **Espacio en blanco** | La "mesa" deja aire alrededor de cada página |
| **Énfasis** | La cinta es la única señal que pide atención, y el anillo de la fase activa es lo único que se mueve |
| **Unidad** | Todo responde a la metáfora del libro: página, cinta, portada, cabecera, capitular y número de página |

Los principios propios de Folio (07 §2) encajan con los clásicos: *un solo foco por pantalla* es simplicidad y énfasis; *una regla que no cambia* es consistencia; *se ve el trabajo* es visibilidad del estado; *no se puede romper el libro* es prevención de errores; *la cinta solo aparece cuando es tu turno* es énfasis; *el libro está en los objetos* es unidad e identidad.

### 1.6 Diseño "por defecto": ética, accesibilidad y privacidad desde el diseño

En la clase del AI Act se habla de un paradigma de **"ética por diseño"**: los requisitos éticos se resuelven en el diseño y no al final. Folio lo aplica así:

- **Ética por diseño:** la interfaz impide quitar el aviso legal en temas sensibles (RÉR-02), el ejercicio solo puede ser un checklist o un reto (RF-04) y los datos de ejemplo evitan estereotipos (RÉR-03).
- **Accesibilidad por diseño:** WCAG 2.2 AA, teclado completo, anuncios con `aria-live`, PDF etiquetado con H1/H2/H3 (RA-01) y cuerpo de 11 pt como mínimo (RA-03).
- **Supervisión humana por diseño:** las dos pausas obligatorias forman parte del grafo de agentes (`interrupt()`); no son una opción que se pueda desactivar.

---

## Parte 2 · ¿Con qué escenario de IA estamos trabajando?

### 2.1 Qué está preguntando la profesora

En el aula virtual la pregunta se conecta con tres materiales:

1. **Clase "AI Act de la Unión Europea":** el reglamento clasifica los sistemas de IA en **cuatro niveles de riesgo**: inaceptable (prohibido), alto, limitado (transparencia) y mínimo.
2. **Actividad de la semana 8:** pide revisar el art. 5 (prácticas prohibidas), los requisitos del alto riesgo y el **art. 14 (supervisión humana)** "y los aspectos inherentes a la herramienta de inteligencia artificial cuya calidad te encuentras modelando junto a tu equipo".
3. **Clase "Marco legal para el desarrollo de IA":** compara el AI Act (ley obligatoria basada en riesgos), el **Código Ético de IA de Venezuela** (2026) y la **Declaración de Nueva Delhi** (2026). Termina con "Reflexiona": (1) la proximidad real de la superinteligencia como amenaza, (2) la intersección del marco legal con tu proyecto y (3) cómo se cumplen las fases propuestas en tu proyecto.

Además, el paso 1 de la guía del informe de modelo de calidad pide **delimitar la categoría de IA** (IA generativa, aprendizaje automático, PLN o visión por computadora).

Por eso la respuesta completa tiene tres partes: **qué tipo de IA es Folio**, **en qué nivel de riesgo cae** y **qué marco legal y ético le aplica**.

### 2.2 Ficha del escenario de Folio

| Dimensión | Escenario de Folio |
|---|---|
| Capacidad | **IA estrecha** (ANI): hace una sola tarea. No es IA general (AGI) ni superinteligencia (ASI) |
| Categoría (paso 1 del informe) | **IA generativa de texto**, basada en **procesamiento de lenguaje natural** con un modelo de lenguaje grande (LLM) |
| Modelo de base | Un **modelo de IA de uso general** de un proveedor externo, todavía por elegir (P-02). Folio no entrena modelos |
| Arquitectura | **Sistema multiagente cooperativo**: cuatro agentes especializados (Investigador, Redactor, Ejercicios y Maquetador) coordinados por un orquestador (LangGraph) |
| Tipo de flujo | **Flujo de trabajo predefinido**: el grafo fija el orden de los pasos y el LLM redacta dentro de cada paso. Es más predecible y fácil de auditar que un agente autónomo que decide su propio camino |
| Nivel de autonomía | **Humano en el bucle** (*human-in-the-loop*): dos pausas obligatorias (índice y capítulo 1) más edición manual antes de exportar |
| Decisiones sobre personas | **Ninguna**. Folio no evalúa, no califica ni clasifica a nadie; produce contenido que una persona revisa |
| Nivel de riesgo (AI Act) | **Riesgo limitado**: obligaciones de transparencia (art. 50) |
| Rol según el AI Act | El equipo de Folio sería el **proveedor** del sistema (art. 3.3); quien lo use de forma profesional, el **implantador** (art. 3.4); la empresa del LLM tiene sus propias obligaciones como proveedora de un modelo de uso general |
| Marco aplicable en Venezuela | Código de Ética para el desarrollo y aplicación responsable de la IA (MINCYT, 19 de febrero de 2026): nueve principios, no vinculante |
| Estado actual | El sitio publicado **funciona con datos simulados**: todavía no llama a ningún modelo de IA. La clasificación vale para el sistema completo de la fase 4 |

### 2.3 Clasificación de riesgo según el AI Act, paso a paso

El reglamento se aplica en orden: primero se descarta lo prohibido, luego el alto riesgo y por último se revisan las obligaciones de transparencia.

**Paso 1. ¿Es una práctica prohibida (art. 5)? No.**
El art. 5 prohíbe, entre otras cosas, la manipulación subliminal o engañosa que cause daños, explotar vulnerabilidades por edad, discapacidad o situación económica, la puntuación social, predecir delitos a partir de perfiles y reconocer emociones en el trabajo o en centros educativos. Folio no hace nada de eso. Además, sus reglas de negocio van en sentido contrario: aviso legal en temas sensibles, ejemplos sin estereotipos y aprobación humana.

**Paso 2. ¿Es de alto riesgo (art. 6 y anexo III)? No.**
Aquí hay una trampa fácil. La diapositiva de clase resume el alto riesgo como "IA en salud, finanzas, educación, justicia", y Folio escribe sobre finanzas personales, emociones y estudio. Pero el reglamento **no clasifica por el tema del contenido, sino por el uso**: el anexo III enumera usos concretos que deciden algo sobre una persona. En educación, por ejemplo, son de alto riesgo los sistemas que deciden el acceso o la admisión, **evalúan resultados de aprendizaje**, asignan el nivel educativo o vigilan exámenes. En finanzas, los que evalúan la solvencia o fijan la calificación crediticia. Folio solo genera un texto educativo que la persona revisa y aprueba: no decide nada sobre nadie. Aunque un orientador use el ebook en clase, la IA no evalúa a ningún estudiante.

**Paso 3. ¿Tiene obligaciones de transparencia (art. 50)? Sí, y por eso es de riesgo limitado.**

| Apartado | Qué exige | Situación de Folio |
|---|---|---|
| 50.1 | Informar a las personas de que interactúan con un sistema de IA, salvo que sea obvio | Cumple en parte: los agentes aparecen con su nombre durante todo el proceso. Falta decirlo de forma explícita desde la primera interacción (el inicio o el registro), como pide el 50.5 |
| 50.2 | El proveedor de un sistema que genera texto sintético debe **marcar el resultado en un formato legible por máquina** y detectable como generado por IA | **Brecha.** El `.md` y el PDF llevan la nota visible "Contenido original generado con asistencia de IA", pero no tienen una marca en los metadatos que una máquina pueda leer |
| 50.4 (segundo párrafo) | Quien publique texto generado por IA para informar sobre asuntos de interés público debe revelarlo, **salvo que haya pasado por revisión humana o control editorial** y alguien asuma la responsabilidad editorial | En general no aplica: un ebook de crecimiento personal no es información de interés público. Si aplicara, las pausas obligatorias y el editor dan justamente ese control editorial |

**Paso 4. Lo que aplica a todos.** El art. 4 pide a proveedores e implantadores fomentar la **alfabetización en IA** de su personal. El resto es voluntario: códigos de conducta y buenas prácticas.

| Nivel | ¿Folio? | Motivo |
|---|---|---|
| Inaceptable (prohibido) | No | No manipula, no puntúa personas, no reconoce emociones |
| Alto riesgo | No | No hace ninguno de los usos del anexo III; genera contenido revisado por una persona |
| **Limitado (transparencia)** | **Sí** | Genera texto sintético e interactúa con personas (art. 50) |
| Mínimo | No | Lo sería si no generara contenido; las obligaciones del art. 50 lo colocan un nivel más arriba |

**Fechas que conviene conocer** (con el "Omnibus digital" de la UE, Reglamento (UE) 2026/1744, en vigor desde el 27 de julio de 2026):

| Fecha | Qué empezó o empieza a aplicarse |
|---|---|
| 2 de febrero de 2025 | Prácticas prohibidas (art. 5) y alfabetización en IA (art. 4) |
| 2 de agosto de 2025 | Obligaciones de los proveedores de modelos de uso general (afecta a la empresa del LLM, no a Folio) |
| 2 de agosto de 2026 | Obligaciones de transparencia del art. 50 |
| 2 de diciembre de 2026 | Marcado legible por máquina (50.2) para los sistemas que ya estaban en el mercado antes del 2 de agosto de 2026 |
| 2 de diciembre de 2027 | Sistemas de alto riesgo del anexo III (antes era agosto de 2026) |

**Alcance.** El AI Act obliga a quien ofrece el sistema en la UE o cuando sus resultados se usan en la UE (art. 2.1). Tampoco se aplica a la investigación y el desarrollo previos a la puesta en servicio (art. 2.8). Hoy Folio es un prototipo universitario en Venezuela, así que el reglamento sirve como **marco de referencia**, que es como lo usa el curso. El ejercicio consiste en clasificar el sistema como si se lanzara al público.

**Qué cambiaría el escenario.** Folio subiría de nivel si:
- **Corrigiera o calificara** las respuestas de los lectores a los ejercicios dentro de una institución educativa: sería alto riesgo (anexo III, evaluar resultados de aprendizaje).
- **Diera asesoría financiera personalizada** con base en los datos de una persona, o evaluara su solvencia: se acercaría al alto riesgo.
- **Infiriera las emociones** de estudiantes o trabajadores a partir de lo que escriben: estaría prohibido (art. 5.1.f).
- **Perfilara a los usuarios**: dentro del anexo III, elaborar perfiles siempre es alto riesgo (art. 6.3).

### 2.4 Lo que Folio ya hace "como si fuera de alto riesgo"

El enlace de la profesora apunta al **art. 14, supervisión humana**. Aunque no es obligatorio para Folio, el sistema ya incorpora prácticas que el AI Act exige al alto riesgo. En la clase de marco legal esto aparece como el "eje convergente 1: la supremacía humana en el bucle".

| Requisito del alto riesgo | Práctica equivalente en Folio |
|---|---|
| Supervisión humana (art. 14) | Dos pausas obligatorias en el grafo (`interrupt()`), edición manual y la regla "la IA propone, tú decides" |
| Registros (art. 12) | Tabla `EVENTO` en el modelo de datos y la bitácora visible de cada agente |
| Transparencia hacia quien lo usa (art. 13) | Fases visibles con el agente responsable y la nota de transparencia al exportar |
| Datos y gestión de sesgos (art. 10) | Instrucciones contra estereotipos en los prompts (RÉR-03) y datos de ejemplo revisados |
| Precisión y robustez (art. 15) | Límite de 60 s por capítulo, un reintento automático y errores que se pueden reintentar sin perder lo escrito |

### 2.5 Contraste con los otros marcos del curso

**Código de Ética de IA de Venezuela (2026).** Es el marco que de verdad nos aplica. No es una ley: no impone sanciones, pero orienta a todos los actores (investigación, desarrollo, despliegue y uso).

| Principio | Cómo lo cumple Folio | Pendiente |
|---|---|---|
| 1. IA humanista | La persona decide en los puntos de control; la IA no manipula | — |
| 2. Equidad y no discriminación | Ejemplos sin estereotipos (RÉR-03); no se perfila a los usuarios | Revisar con muestras reales del LLM en la fase 4 |
| 3. Responsabilidad ambiental | Salida acotada (800 a 1.200 palabras por capítulo) y capítulos en secuencia, sin generar de más | Considerar el consumo energético al elegir el LLM |
| 4. Seguridad | Autenticación y datos por usuario (fase 4) | Definir protección de datos en el backend |
| 5. Privacidad | No se piden datos innecesarios | Los prompts pueden contener datos sensibles (emociones, dinero): elegir un proveedor que no entrene con ellos (P-12) |
| 6. Transparencia | Agentes nombrados y nota "generado con asistencia de IA" | Marca legible por máquina (P-11) |
| 7. Rendición de cuentas | La responsabilidad final es de la persona que aprueba; queda registro de eventos | — |
| 8. Ciencia abierta | Repositorio público y documentación abierta | — |
| 9. Excelencia | Pruebas de aceptación por requerimiento y verificación documentada (09) | — |

**Recomendación de la UNESCO sobre la ética de la IA (2021).** Sus diez principios coinciden en lo esencial con los anteriores. Los más visibles en Folio son *supervisión y decisión humanas*, *transparencia y explicabilidad*, *equidad y no discriminación*, *privacidad* y *proporcionalidad e inocuidad*: la IA solo hace lo necesario para un ebook corto y práctico. La guía del informe de calidad de la profesora pide incluir estos factores éticos.

**Declaración de Nueva Delhi (febrero de 2026).** Es un compromiso diplomático firmado por entre 88 y 91 países y organizaciones, según la fuente, y centrado en democratizar el acceso a la IA, en la IA segura y confiable y en el capital humano. A un proyecto como Folio le toca de forma indirecta: una herramienta accesible, en español y pensada para docentes y creadores independientes va en la línea de "democratizar".

### 2.6 Otras formas de leer "escenario"

Por si en clase la pregunta se plantea desde la teoría de agentes o desde el debate sobre la superinteligencia.

**Entorno de trabajo según Russell y Norvig (PEAS y propiedades):**

| PEAS | Folio |
|---|---|
| Medida de rendimiento | Ebook de 5 a 7 capítulos con la estructura de RF-03, tono de RNF-01, menos de 60 s por capítulo, aprobado por la persona, accesible y sin estereotipos |
| Entorno | La aplicación web, la persona usuaria, el estado del ebook y el modelo de lenguaje |
| Actuadores | Texto generado (índice, capítulos y ejercicios), eventos de avance y archivos `.md` y PDF |
| Sensores | El prompt, el nicho, los parámetros, las aprobaciones, el feedback y las ediciones |

| Propiedad | Folio | Por qué |
|---|---|---|
| Observable | Parcialmente | Los agentes ven el estado del ebook, pero no la intención completa de la persona; por eso existen los puntos de control |
| Determinista o estocástico | Estocástico | El mismo prompt puede dar textos distintos |
| Episódico o secuencial | Secuencial | Cada capítulo depende del índice, de la guía de estilo y de los capítulos anteriores |
| Estático o dinámico | Estático | El grafo se pausa mientras la persona decide |
| Discreto o continuo | Discreto | Estados, capítulos y secciones finitos |
| Uno o varios agentes | Multiagente cooperativo | Cuatro agentes y una persona que trabajan por el mismo objetivo |

**Superinteligencia (punto 1 del "Reflexiona").** Folio trabaja con IA estrecha. Sus riesgos reales no tienen que ver con una superinteligencia, sino con problemas cotidianos: contenido incorrecto en temas sensibles, sesgos en los ejemplos, dependencia del texto generado y privacidad de lo que la persona escribe. El diseño responde a cada uno: aviso legal, instrucciones contra estereotipos, aprobación y edición humana, y minimización de datos.

### 2.7 Brechas y recomendaciones para la fase 4

1. **Marca legible por máquina (art. 50.2).** Añadir metadatos al PDF y un encabezado de metadatos al `.md` que indiquen que el contenido se generó con IA. Registrado como P-11.
2. **Aviso explícito de uso de IA desde la primera interacción (art. 50.1 y 50.5).** Una línea en el inicio o en el registro, con el tono de la app y sin el copy de "potenciado por IA".
3. **Privacidad de los prompts.** Elegir un proveedor de LLM que no use los datos de los clientes para entrenar y tratar los prompts con minimización de datos. Registrado como P-12, ligado a P-02.
4. **Documentar la evaluación de riesgo.** Este documento sirve de base. Hay que revisarlo si cambia el propósito de Folio (ver "Qué cambiaría el escenario").
5. **Alfabetización en IA del equipo (art. 4).** El propio curso y esta documentación cuentan como evidencia.

---

## Parte 3 · Para la clase

### Guion de 3 minutos

1. **Qué es Folio:** cuatro agentes de IA escriben ebooks cortos de crecimiento personal; la persona aprueba el índice y el capítulo 1.
2. **Principios del diseño, en tres niveles:** de software (trazabilidad, modularidad, bajo acoplamiento: el proveedor de LLM y los datos se cambian sin tocar el resto), de interfaz (dejar el control al usuario, consistencia, prevención de errores: "no se puede romper el libro") y visual (contraste, jerarquía y un solo punto de énfasis: la cinta).
3. **Escenario de IA:** IA estrecha, generativa de texto, multiagente con humano en el bucle.
4. **Nivel de riesgo:** limitado. No es alto riesgo porque no decide nada sobre personas, aunque escriba sobre finanzas o emociones. Sus obligaciones son de transparencia.
5. **Lo que suma:** aplica por voluntad propia la supervisión humana del art. 14 y cumple los principios del Código Ético venezolano. Pendientes: marca legible por máquina y privacidad de los prompts.

### Preguntas que pueden salir

- **"Si habla de finanzas y de salud emocional, ¿no es de alto riesgo?"** No. El AI Act clasifica por el uso, no por el tema. Sería alto riesgo si evaluara la solvencia de alguien o calificara a estudiantes. Folio escribe un texto educativo que la persona aprueba, y en esos temas agrega un aviso legal que no se puede quitar.
- **"¿Quién es responsable de lo que escribe la IA?"** La persona que aprueba y publica, porque tiene el control editorial. Folio, como proveedor, responde por la transparencia y por las salvaguardas del diseño.
- **"¿Dónde está la supervisión humana?"** En el grafo de agentes: dos interrupciones obligatorias que guardan el estado y esperan la aprobación. No se pueden saltar.
- **"¿El AI Act aplica en Venezuela?"** Solo si el sistema se ofrece en la UE o sus resultados se usan allí. Aquí aplica el Código de Ética del MINCYT, que no es vinculante. Usamos el AI Act como referencia de buenas prácticas.
- **"¿Es un agente autónomo?"** No. Es un flujo de trabajo con pasos fijos donde el LLM redacta dentro de cada paso. Eso lo hace predecible y auditable.

---

## Fuentes

**Material del curso (aula virtual UJAP, Ingeniería del Software 2026-2CR)**
- Requena, I. *AI Act de la Unión Europea* (clase).
- Requena, I. *ACT IA EU*, semana 8 (actividad sobre los arts. 5 y 14 y los requisitos del alto riesgo).
- Requena, I. *Marco legal para el desarrollo de Inteligencia Artificial* (clase 4, contraste UE, Venezuela y Delhi).
- Requena, I. *Informe de Modelo de Calidad en Ingeniería de Software* (secuencia de 8 pasos).
- Planificación académica 2026-2CR.

**Normativa y marcos**
- Reglamento (UE) 2024/1689 (AI Act), arts. 2, 3, 4, 5, 6, 14 y 50 y anexo III: [artificialintelligenceact.eu/es](https://artificialintelligenceact.eu/es/article/50/) · [anexo III](https://artificialintelligenceact.eu/annex/3/)
- Comisión Europea, [directrices sobre las obligaciones de transparencia del art. 50](https://digital-strategy.ec.europa.eu/en/policies/guidelines-ai-transparency-obligations) (2026)
- Omnibus digital sobre IA: [Gibson Dunn (27-05-2026)](https://www.gibsondunn.com/eu-ai-act-omnibus-agreement-postponed-high-risk-deadlines-and-other-key-changes/) · [Usercentrics (31-07-2026)](https://usercentrics.com/knowledge-hub/eu-ai-act-high-risk-delay-article-50-transparency-consent/)
- MINCYT, [Código de Ética para el Desarrollo y Aplicación Responsable de la IA](https://mincyt.gob.ve/venezuela-presenta-el-codigo-de-etica-para-el-desarrollo-y-aplicacion-responsable-de-la-ia/) (2026) · [Baker McKenzie, análisis](https://www.bakermckenzie.com/en/insight/publications/2026/03/venezuela-code-of-ethics-for-artificial-intelligence)
- UNESCO, [Recomendación sobre la ética de la inteligencia artificial](https://www.unesco.org/en/artificial-intelligence/recommendation-ethics) (2021)
- [Declaración de Nueva Delhi sobre el impacto de la IA](https://www.newsonair.gov.in/india-ai-impact-summit-2026-adopts-new-delhi-declaration) (2026)

**Diseño e IA**
- Pressman, R. S. *Ingeniería del software: un enfoque práctico* (7.ª ed.). McGraw-Hill. Capítulos de principios que guían la práctica, conceptos de diseño, diseño de la interfaz de usuario y diseño de WebApps. Resumen de los principios: [Universidad Veracruzana](https://www.uv.mx/personal/asumano/files/2012/08/PrincipiosDisenio.pdf)
- Mandel, T. (1997). *The Elements of User Interface Design*. Wiley.
- Nielsen, J. [10 Usability Heuristics for User Interface Design](https://www.nngroup.com/articles/ten-usability-heuristics/). Nielsen Norman Group.
- Russell, S. y Norvig, P. *Inteligencia artificial: un enfoque moderno*, cap. 2 (agentes inteligentes).
- Anthropic (2024). [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) (diferencia entre flujos de trabajo y agentes).
