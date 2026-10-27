# Folio: contexto completo para preparar la exposición ante el jurado

> **Para qué sirve este archivo:** entregárselo a una sesión de Claude (chat) para estudiar el proyecto completo y ensayar la exposición grupal ante el jurado.
> **Proyecto:** Folio, sistema multiagente que escribe ebooks cortos de crecimiento personal.
> **Materia:** Ingeniería del Software, UJAP, período 2026-2CR, prof. Ifigenia Requena (sección 309C1).
> **Entrega previa relacionada:** "Modelos de calidad por tipo de software" (grupal, informe + enlace a la presentación, entregada el 24-10-2026).
> **Fecha de este documento:** 27-10-2026.
> **Sitio publicado (se abre desde el teléfono):** https://franjmd0508.github.io/multiagente-inteligente-ebooks/
> **Repositorio:** https://github.com/FranJMD0508/multiagente-inteligente-ebooks

---

## 0. Instrucciones para Claude (léelas antes de todo)

Vas a ayudar a un equipo universitario a preparar la defensa oral de su proyecto. Tu papel:

1. **Tutor:** explica cualquier parte de Folio con las palabras de este documento. Si algo no aparece aquí, dilo ("eso no está en el contexto") y no lo inventes. Nada de cifras, nombres de archivos ni artículos de ley que no estén en este texto.
2. **Jurado simulado:** cuando te lo pidan, haz preguntas como lo haría el jurado, **de una en una**, espera la respuesta y evalúala con la rúbrica de la sección 1 (Dominio y Asertividad en la escala 2-4-6). Señala:
   - errores de contenido (comparando con este documento),
   - vocabulario impreciso (ver la sección 13, "Errores de vocabulario que bajan la nota"),
   - dudas o rodeos que restan firmeza,
   - y propone una versión mejor de la respuesta, corta y segura.
3. **Entrenador de la presentación:** ayuda a repartir el guion (sección 11) entre los integrantes, a cronometrarlo y a ensayar la demostración en vivo.
4. **Tarjetas de repaso:** si te las piden, genera preguntas cortas con su respuesta a partir de las secciones 4 a 9 y 14.

Formas útiles de empezar:
- "Hazme un simulacro de 10 preguntas del jurado, una por una, y califícame con la rúbrica."
- "Explícame el grafo de agentes como si yo tuviera que defenderlo en 1 minuto."
- "Repasemos el modelo de calidad: pregúntame característica por característica."
- "Dame las 15 cifras que tengo que saberme de memoria y pregúntamelas."
- "Soy el integrante que explica la ética y el AI Act: ensaya conmigo mi parte."

Importante: **la respuesta honesta siempre gana puntos**. Si el jurado pregunta por algo que todavía no está hecho (ver la sección 16), la respuesta correcta es reconocerlo y explicar el plan, no disimularlo.

---

## 1. La evaluación: rúbrica del jurado

Rúbrica tal como la entregó la profesora:

### Primera sección

| Criterio | 0 | 1 | 2 | Puntos |
|---|---|---|---|---|
| **Interactividad** | No usa herramienta interactiva | Se apoya en herramienta interactiva pero no la sabe usar | Usa herramienta interactiva y la aprovecha | 2 |
| **Coherencia** | La presentación guarda poca relación con el proyecto | Estrecha relación con el proyecto, pero la exhibe con debilidad | Expresa con firmeza su responsabilidad profesional con la calidad del software usado en el desarrollo de IA | 2 |
| **Demostración** | No demuestran el modelo | Hay un modelo que no se explica con claridad | Explican contundentemente el modelo propuesto | 2 |
| **Impacto** | No se evidencia el impacto en la realidad | Se observa el impacto existente pero no lo describen | Describen claramente el impacto del modelo en la realidad del desarrollo de IA | 2 |

### Segunda sección

| Criterio | 2 | 4 | 6 | Puntos |
|---|---|---|---|---|
| **Dominio** | Se observa poca dedicación en el desarrollo del proyecto | Manejan los conceptos, pero no evidencian seguridad, hay errores en el manejo de vocabulario | Responden con firmeza demostrando conocimiento profundo de su modelo | 6 |
| **Asertividad** | Hay errores en sus respuestas | Se evidencia conocimiento, pero hay debilidades en el vocabulario | Demuestra profundo conocimiento del tema y del modelo propuesto | 6 |
| **Total** | — | — | — | **20** |

> La segunda sección vale 12 de los 20 puntos y se juega en las **preguntas del jurado**. Por eso este documento dedica tanto espacio al banco de preguntas (sección 12) y al vocabulario (sección 13).

### Cómo sacar la nota máxima en cada criterio con Folio

| Criterio | Qué quiere ver el jurado | Qué hacemos nosotros |
|---|---|---|
| **Interactividad (2)** | Que la herramienta interactiva no sea decoración: que se use bien y aporte | 1) **Demostración en vivo** de Folio en el sitio publicado: crear un ebook, pasar las dos pausas, editar la portada, verificar referencias y exportar el PDF. 2) Un **código QR** al sitio para que el jurado lo abra en su teléfono y pruebe a pedir una novela (verá que la rechaza con alternativas). 3) Presentación interactiva (la del enlace entregado) con navegación no lineal hacia el diagrama del grafo y la tabla del modelo de calidad. 4) Ensayado: con **Ajustes → Demostración → Velocidad: Rápida** el flujo completo cabe en 2 o 3 minutos. Plan B: capturas de la guía en PDF |
| **Coherencia (2)** | Que todo lo que se dice se relacione con el proyecto y que el equipo **asuma con firmeza la responsabilidad profesional** por la calidad del software de IA | Cada afirmación va con evidencia: "cada requerimiento tiene su prueba automática", "dos rondas de revisión de código encontraron 46 errores y cada uno tiene ahora su prueba", "decimos qué falta medir". Frases de la sección 10 |
| **Demostración (2)** | Que el **modelo propuesto** se explique de forma contundente | Explicar dos cosas y enlazarlas: el **modelo del sistema** (cuatro agentes + orquestador + humano en el bucle, sección 5) y el **modelo de calidad** (ISO/IEC 25010 + ISO/IEC 25059 para sistemas de IA, con métricas y resultados, sección 6). Mostrar el modelo funcionando en la demo |
| **Impacto (2)** | Que se describa con claridad el **impacto del modelo en la realidad del desarrollo de IA** | Sección 9: supervisión humana como práctica de diseño, verificación de referencias contra alucinaciones, accesibilidad, transparencia legible por máquina y el modelo de calidad como plantilla reutilizable para otros proyectos de IA generativa |
| **Dominio (6)** | Respuestas firmes y conocimiento profundo del modelo | Saberse las cifras (sección 14), el porqué de cada decisión (sección 15) y responder con la estructura **afirmación → evidencia → límite** |
| **Asertividad (6)** | Respuestas sin errores y con vocabulario preciso | Usar el vocabulario exacto (sección 13); no decir "la IA aprende", "es 100 % seguro" ni "no tiene sesgos" |

**Estructura de cada respuesta ante el jurado (20 a 40 segundos):**
1. **Afirmación directa** en la primera frase ("Sí, y lo garantiza el grafo").
2. **Evidencia concreta**: dónde está, cómo se prueba o una cifra.
3. **Límite honesto** si lo hay ("Lo que falta es medirlo con el modelo real; el plan es…").

---

## 2. Folio en 30 segundos y en 2 minutos

**En 30 segundos.** Folio es una aplicación web en la que **cuatro agentes de IA** (Investigador, Redactor, Ejercicios y Maquetador) escriben y maquetan **ebooks cortos de crecimiento personal**: de 5 a 7 capítulos, sobre situaciones reales, nunca ficción. La persona **aprueba en dos puntos de control obligatorios** (el índice y el capítulo 1), puede editar todo, diseñar la portada y revisar referencias bibliográficas **verificadas en Crossref y Open Library**, y exporta en **Markdown y PDF accesible**. La IA propone; la persona decide.

**En 2 minutos.**
- **Problema:** escribir un ebook práctico implica investigar, estructurar, redactar con un tono constante, crear ejercicios y maquetar. Un chat de IA genérico da textos planos, sin estructura editorial, difíciles de exportar y sin que la persona valide el rumbo antes de que se genere todo.
- **Solución:** un **sistema multiagente orquestado** (LangGraph) donde cada agente hace una sola cosa, con **humano en el bucle**: el grafo se detiene en dos pausas que no se pueden saltar. El capítulo 1 aprobado se vuelve el **ancla** de tono y formato del resto.
- **Calidad y ética desde el diseño:** aviso legal automático que no se puede quitar en temas sensibles, ejemplos sin estereotipos, referencias verificadas para no inventar fuentes, PDF etiquetado para lectores de pantalla y una marca legible por máquina que dice que el contenido se generó con IA.
- **Evidencia:** cada requerimiento tiene una prueba automática; 20 pruebas de aceptación en el navegador, 147 del backend y una punta a punta; 0 infracciones de accesibilidad con axe-core en 20 pantallas.
- **Escenario de IA:** IA estrecha, generativa de texto, multiagente con humano en el bucle; **riesgo limitado** según el AI Act (obligaciones de transparencia).

---

## 3. El problema, los usuarios y lo que produce el sistema

### Usuarios (dos perfiles a la vez)

| Perfil | Quién es | Qué necesita |
|---|---|---|
| **Creadora de contenido** (persona "Valeria", 28 años) | Tiene una comunidad sobre finanzas personales y vende guías digitales | Control sobre el índice y el tono, editar a mano, portada con su nombre y un PDF listo para vender |
| **Docente u orientador** (persona "Andrés", 41 años) | Orientador universitario que quiere material breve sobre estrés y gestión del tiempo | Lenguaje claro, aviso legal en salud emocional y un PDF que funcione con lectores de pantalla |
| **Lector final** (indirecto) | Quien recibe o compra el ebook | Legibilidad, accesibilidad, ejercicios útiles, sin sesgos y con transparencia |

### Propuesta de valor

| Valor | Cómo se logra |
|---|---|
| Rapidez | Agentes especializados en cadena; menos de 60 s por capítulo (RNF-02) |
| Control | Dos pausas obligatorias, edición manual y diseño propio |
| Calidad editorial | Estructura fija por capítulo (RF-03), tono definido (RNF-01), coherencia (RNF-03) |
| Utilidad real | Cada capítulo cierra con un ejercicio accionable: checklist o reto de 24 a 48 h (RF-04) |
| Listo para publicar | `.md` y PDF accesibles (RF-06, RA-01, RA-03) |
| Responsabilidad | Originalidad (RÉR-01), aviso legal (RÉR-02) y sin estereotipos (RÉR-03) |

### Anatomía de un ebook de Folio

```
Portada (plantilla, tela, imagen opcional, título, autor)
Portadilla (título en H1)
Aviso legal (solo si el tema es sensible; no se puede quitar)
Índice (5 a 7 capítulos)
Capítulo N (x5-7), siempre en este orden:
   Introducción → Desarrollo → Ejemplos cotidianos → Conclusión → Ejercicio práctico
Referencias (APA 7, verificadas)
Contraportada (sinopsis que propone el Maquetador)
Nota "Contenido original generado con asistencia de IA" + marca legible por máquina
```

Extensión objetivo: 15 a 30 páginas, unas 800 a 1.200 palabras por capítulo.

Fuera del alcance (decisión consciente, principio YAGNI): ficción, libros de más de 7 capítulos, publicación directa en Amazon o Hotmart, imágenes generadas con IA, edición colaborativa en tiempo real, pagos y traducción.

---

## 4. Requerimientos y cómo se cumplen

La fuente de verdad es `docs/requerimientos.txt` (salió de la entrevista con el cliente y no se modifica). Son 16 requerimientos originales más 9 derivados (RD).

### 4.1 Requerimientos originales

| Código | Qué pide | Cómo lo cumple Folio | Estado |
|---|---|---|---|
| **RF-01** | Nichos de crecimiento personal sobre situaciones reales, descartando la ficción | Chips de nichos + **guardarraíl en dos pasos**: antes de crear el ebook (patrones de ficción + clasificación del LLM) y otra vez dentro del grafo. Si pides una novela, responde con amabilidad y propone 3 alternativas prácticas | ✅ |
| **RF-02** | Índice de 5 a 7 capítulos, límite estricto | La interfaz no deja salir del rango (no se puede borrar el quinto ni agregar el octavo) y el backend lo vuelve a validar (422 si no) | ✅ |
| **RF-03** | Cada capítulo con Introducción, Desarrollo, Ejemplos cotidianos, Conclusión y Ejercicio | El prompt exige las cuatro secciones con `##` exactos; el código comprueba la estructura y reintenta si falta alguna; el editor no permite borrarlas | ✅ |
| **RF-04** | Solo checklists de autoevaluación o retos de 24 a 48 h | El agente de Ejercicios solo produce esos dos tipos (checklist de 5-7 ítems o reto de 3-5 pasos) y se valida la respuesta | ✅ |
| **RF-05** | Dos pausas obligatorias: tras el índice y tras el capítulo 1 | `interrupt()` de LangGraph en dos nodos del grafo; el estado se guarda en SQLite y la pausa sobrevive a cerrar la pestaña o reiniciar el servidor | ✅ |
| **RF-06** | Exportar a `.md` limpio y a PDF estructurado | Markdown con H1/H2/H3, listas y citas; PDF generado con Chromium a partir de HTML | ✅ |
| **RNF-01** | Tono conversacional, empático, directo y de profundidad intermedia | Prompt del Redactor con reglas explícitas, temperatura 0,8, lista de muletillas prohibidas y ajustes de tono en la pausa del capítulo 1 | 🟡 |
| **RNF-02** | Menos de 60 s por capítulo | Streaming desde el primer token, límite de 60 s por intento, un reintento automático y luego error reintentable. En la simulación: 7,2 s el capítulo 1 | 🟡 |
| **RNF-03** | Coherencia de términos y estilo, sin repeticiones ni contradicciones | Capítulo 1 aprobado como ancla, guía de estilo extraída de él, capítulos escritos en secuencia y cada uno recibe el resumen de los anteriores | 🟡 |
| **RNF-04** | Backend modular con los cuatro agentes y prompts fáciles de cambiar | Un módulo por agente y un archivo `.md` por tarea en `backend/app/prompts/<agente>/` | ✅ |
| **RA-01** | Jerarquía H1/H2/H3 para lectores de pantalla | `.md` sin saltos de nivel; PDF **etiquetado** (`/StructTreeRoot`) con marcadores | ✅ |
| **RA-02** | Lenguaje claro para público joven o diverso | Reglas de frases cortas y vocabulario cotidiano en el prompt. Texto de prueba: INFLESZ 78,8, "bastante fácil" | 🟡 |
| **RA-03** | Fondo blanco, alto contraste, Arial/Helvetica/Roboto, 11 pt mínimo | La interfaz no deja bajar de 11 pt ni elegir otra letra; el servidor lo valida; la portada calcula el contraste en vivo | ✅ |
| **RÉR-01** | Contenido original, sin copiar fuentes protegidas | Instrucciones explícitas en los prompts; con Gemini, si la respuesta se corta por `RECITATION` se pide otra; referencias verificadas | 🟡 |
| **RÉR-02** | Aviso legal automático en finanzas, emociones o autoayuda | El Investigador clasifica la sensibilidad; el Maquetador inserta el aviso; la API no deja quitarlo | ✅ |
| **RÉR-03** | Sin estereotipos de género, discriminación ni soluciones poco éticas | Reglas en los prompts, personas diversas que rotan y alternan género, datos de demo revisados | 🟡 |

**✅ Cumple** = funciona y lo comprueba una prueba automática.
**🟡 Implementado; falta medirlo con el modelo real** = los mecanismos existen y las pruebas pasan con el proveedor demo, pero la *calidad del texto* (tono, tiempo real, coherencia, claridad, originalidad, sesgos) hay que medirla con capítulos escritos por Gemini. Explicación en la sección 16.

**Resumen:** de 18 requerimientos verificados (16 originales + RD-04 y RD-09), **12 cumplen con prueba** y **6 están implementados pero pendientes de medición con el modelo real**.

### 4.2 Requerimientos derivados (RD)

| Código | Qué es |
|---|---|
| RD-01 | Cuentas: registro, inicio y cierre de sesión; cada usuario ve solo sus ebooks |
| RD-02 | Biblioteca con estados, búsqueda, filtros, renombrar, duplicar, descargar y eliminar |
| RD-03 | Editor previo a la exportación que respeta la estructura fija y la jerarquía |
| RD-04 | Portada y estilo del PDF: cinco plantillas, tela, imagen propia con velo que mantiene el contraste, letra, tamaño y alineación del título, contraportada con sinopsis, tamaño de página |
| RD-05 | Proceso visible en tiempo real: qué agente trabaja y el texto en vivo |
| RD-06 | Aplicación accesible: WCAG 2.2 AA |
| RD-07 | Reanudación: un ebook interrumpido se retoma donde quedó |
| RD-08 | Diseño adaptable: escritorio, tableta y móvil (en móvil, pestañas "Decidir" y "Tu libro") |
| RD-09 | Ayuda con referencias bibliográficas: sugeridas, verificadas, editables, en APA 7 |

---

## 5. El modelo del sistema: cómo funciona por dentro

### 5.1 Arquitectura por capas

```
Navegador ── REST ──▶ API (FastAPI)
          ◀── SSE ───        │
                             ▼
                   Orquestador (LangGraph)
                   ├─ Investigador ─┐
                   ├─ Redactor ─────┼──▶ Capa LLM (Gemini · Claude · OpenAI · demo)
                   ├─ Ejercicios ───┘
                   └─ Maquetador ─────▶ Motor PDF (Chromium + pypdf)
                             │
                   SQLite: ebooks, cuentas, imágenes y checkpoints del grafo
                   Crossref y Open Library: verificación de referencias
```

| Capa | Tecnología | Responsabilidad |
|---|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind 4, Radix UI, Motion, dnd-kit | Toda la interfaz. Habla solo con la fachada `api` |
| API | FastAPI (Python 3.13) | Autenticación, ebooks, pausas, edición, diseño, referencias, exportación y eventos en vivo |
| Orquestador | LangGraph | Grafo de agentes, interrupciones para la supervisión humana y persistencia del avance |
| Agentes | Módulos Python + prompts en archivos `.md` | Un módulo por rol (RNF-04) |
| Capa LLM | Interfaz propia `LLMProvider` | Cambiar de proveedor con una variable (`LLM_PROVIDER`) sin tocar a los agentes |
| Motor PDF | Chromium headless (Playwright) + pypdf | HTML → PDF etiquetado con marcadores y metadatos |
| Datos | SQLite local | Cuentas (contraseña con scrypt, sesión con JWT), ebooks, imágenes y checkpoints |

### 5.2 Los cuatro agentes (y dos funciones del orquestador)

| Agente | Tareas (un prompt por tarea) | Produce |
|---|---|---|
| **Investigador** | `indice.md`, `capitulo_alternativo.md`, `lecturas.md` | Título, subtítulo, público, sensibilidad del tema, *brief* de investigación, índice de 5-7 capítulos; reemplazo de un capítulo; 4-8 lecturas reales |
| **Redactor** | `capitulo.md`, `guia_estilo.md` | Cada capítulo en Markdown con sus cuatro secciones, en streaming; la guía de estilo a partir del capítulo 1 aprobado |
| **Ejercicios** | `ejercicio.md` | Checklist (5-7 ítems) o reto de 24/48 h (3-5 pasos) |
| **Maquetador / Exportador** | `contraportada.md` + plantillas | Sinopsis de 60-110 palabras; ensamblado del `.md` y del PDF |
| Orquestador (función) | `guardarrail.md` | ¿Es válido el tema? Motivo amable, nicho, sensibilidad y 3 alternativas |
| Orquestador (función) | Extracción de la guía de estilo | Al aprobar el capítulo 1 (RNF-03) |

Cada prompt es un archivo con un encabezado YAML (temperatura y máximo de tokens) y dos bloques: sistema y usuario. Ejemplo real del Redactor:

```
---
descripcion: Redactor · escribe un capítulo en Markdown con sus cuatro secciones (RF-03, RNF-01, RNF-03, RA-02, RÉR-01, RÉR-03).
temperatura: 0.8
max_tokens: 8192
---
---sistema---
Eres el Agente Redactor de Folio. Escribes capítulos de ebooks cortos de no ficción...
TONO Y ESTILO (RNF-01, RA-02)
- Conversacional, empático y directo... Tuteas siempre a quien lee...
- Frases cortas (casi siempre de menos de 25 palabras)...
- Evita estas muletillas: "en el mundo actual", "sumérgete", "desbloquea"...
```

Cambiar el comportamiento de un agente es **editar su archivo**, sin tocar código. Eso es exactamente lo que pide RNF-04.

### 5.3 El grafo de agentes y la supervisión humana

```
inicio → guardarraíl ── rechazado ──▶ fin (con 3 alternativas)
             │ válido
             ▼
        investigador (índice + brief + sensibilidad)
             ▼
        marcar_indice → PUNTO DE CONTROL 1: interrupt()  ◀── Tú decides
             │  regenerar todo ──▶ investigador
             │  otro capítulo ──▶ investigador_capitulo ──▶ marcar_indice
             │  aprobar
             ▼
        redactor (capítulo 1) → ejercicios
             ▼
        marcar_cap1 → PUNTO DE CONTROL 2: interrupt()   ◀── Tú decides
             │  ajustar (Más cercano, Más ejemplos...) ──▶ redactor
             │  aprobar
             ▼
        guia_estilo → redactor (cap. 2) → ejercicios → ... → redactor (cap. N) → ejercicios
             ▼
        maquetador (contraportada) → listo para revisar, editar y exportar
```

Ideas que hay que saber explicar:

- **`interrupt()`**: función de LangGraph que **detiene el grafo** y guarda su estado. El grafo no continúa hasta que llega la decisión de la persona (aprobar, regenerar, ajustar). No es un botón de la interfaz que se pueda saltar: está **dentro del flujo**.
- **Checkpointer en SQLite**: LangGraph guarda un *checkpoint* después de cada paso. Si se cierra la pestaña o **se cae el servidor**, el ebook sigue en la misma pausa o en el mismo capítulo al volver (RD-07). Se probó matando el servidor a mitad de un capítulo.
- **Cada punto de control son dos nodos**: `marcar_*` cambia el estado y avisa; `punto_control_*` solo llama a `interrupt()`. Así, cuando LangGraph reanuda (vuelve a ejecutar el nodo interrumpido), ningún efecto se repite.
- **Un capítulo por paso**: si algo falla en el capítulo 4, se reintenta el 4, sin perder los anteriores.
- **El contenido vive en la base de datos; el grafo solo guarda por dónde va.** Por eso editar el índice durante una pausa no exige pasar por el grafo.
- **Defensa extra de RF-05:** se guarda la marca de "capítulo 1 aprobado" y el Redactor no escribe el resto sin ella, aunque el servidor se reinicie justo en la pausa. Este error lo encontró una revisión de código y ahora tiene su prueba.
- **Es un flujo de trabajo predefinido, no un agente autónomo:** el grafo fija el orden y el LLM redacta dentro de cada paso. Es más predecible y fácil de auditar (idea de Anthropic, *Building effective agents*: diferencia entre *workflows* y agentes).

### 5.4 Estados del ebook

`borrador → investigando → indice_pendiente → redactando_cap1 → cap1_pendiente → redactando → maquetando → listo`, más `error` (reintentable) desde cualquier etapa de trabajo. En la biblioteca, `indice_pendiente` y `cap1_pendiente` se muestran como **"Esperando tu aprobación"**. Estados de cada capítulo: pendiente, generando, generado, aprobado, editado y error.

### 5.5 Capa LLM intercambiable

- Interfaz propia `LLMProvider` con cuatro implementaciones: **Gemini** (por defecto, `gemini-3.5-flash-lite` por API REST, razonamiento corto `thinkingLevel=low` para no alargar la espera), **Claude** (`claude-sonnet-5`), **OpenAI** y **demo** (sin conexión, textos de plantilla con la misma forma, para pruebas).
- Se elige con la variable `LLM_PROVIDER`. Los agentes no saben qué proveedor hay detrás (inversión de dependencias, bajo acoplamiento).
- Maneja reintentos ante límite de cuota (429), respuestas cortadas por límite de tokens, JSON inválido (pide corregirlo) y errores de red traducidos a mensajes humanos.
- Por qué Gemini: el equipo tiene acceso al plan gratuito de Google AI Studio (decisión D-34).

### 5.6 Tiempo real: SSE y streaming

- El servidor envía eventos con **SSE** (*Server-Sent Events*): el texto aparece en vivo mientras el Redactor escribe, más eventos como `ebook.updated`, `checkpoint.required` o `notice` (mensajes que el lector de pantalla anuncia, por ejemplo "Capítulo 3 terminado").
- **Por qué SSE y no WebSockets** (D-14): la comunicación es casi toda del servidor al cliente; SSE es más simple y se reconecta solo (principio KISS).
- Dos pestañas abiertas con la misma cuenta se mantienen sincronizadas.

### 5.7 Referencias verificadas (contra las alucinaciones)

1. Al aprobar el índice, el Investigador propone de 4 a 8 obras **reales** (libros y artículos revisados por pares). El prompt le prohíbe inventar DOI o ISBN.
2. Folio **verifica** cada una: con DOI en **Crossref**, con ISBN en **Open Library** y, si no, buscando por título y autor. Coincide si el título se parece un 80 % o más **y** al menos un apellido coincide.
3. Resultado: **verificada** (con la fuente), **no encontrada** (posible invención: la interfaz y la exportación lo advierten) o **sin verificar** (sin conexión o página web). Si la fuente trae datos distintos (año, DOI, páginas), se ofrecen para corregir con un clic.
4. La persona puede buscar por DOI, ISBN o título, agregar a mano, editar y copiar la cita.
5. Se exportan como "Referencias" en **APA 7** (versión en español: "y" entre autores, "s. f." sin fecha), ordenadas por apellido.

Esto es importante para el **impacto**: un LLM puede **alucinar** referencias (inventar libros o DOI que no existen). Folio no confía en el modelo: **comprueba contra fuentes externas** y lo marca.

### 5.8 Exportación accesible

- **Markdown:** título (H1), subtítulo, autor, aviso legal (cita), índice, capítulos en H1 con secciones en H2 y subtemas en H3, referencias, contraportada, nota de IA y un comentario legible por máquina: `<!-- folio: generado-con-ia=true; … -->`.
- **PDF:** plantilla HTML (Jinja2) → Chromium headless → **PDF etiquetado** (árbol de estructura `/StructTreeRoot` con H1/H2/H3) con marcadores, fuentes incrustadas como TrueType (licencia OFL), fondo blanco, texto `#1B1D23`, Roboto/Arial/Helvetica de 11 a 13 pt, número de página y tamaño A5, A4, Carta o 6×9 pulgadas. pypdf añade título, autor y la marca de IA en los metadatos (`Keywords: generado con IA`).
- Detalle técnico que demuestra rigor: Chromium perdía los espacios en los marcadores de títulos largos ("estudia,descansa"); se corrige después de generar el PDF y hay una prueba para eso.

### 5.9 Portada (RD-04)

Cinco plantillas (Clásica, Centrada, Franja, Marco y Editorial), color de "tela" según el nicho, **imagen propia** de fondo (con un velo del color de la tela que mantiene el contraste del título en **4,5:1 o más**) o en recuadro (con texto alternativo), letra, tamaño y alineación del título, y contraportada con sinopsis que propone el Maquetador. El servidor calcula el velo mínimo con el **mismo algoritmo** que el navegador (se probó con 56 casos) y lo aplica solo: no se puede exportar una portada ilegible.

### 5.10 Datos y seguridad

- SQLite local (`backend/data/`), decisión D-35 (Supabase queda como migración futura).
- Contraseñas con **scrypt** (función de derivación lenta, resistente a fuerza bruta), ejecutada en un hilo aparte y con un hash de relleno para no delatar por el tiempo de respuesta si una cuenta existe.
- Sesión con **JWT** que lleva una huella de la contraseña: si la cambias, se cierran todas las sesiones.
- Cada persona solo ve y modifica sus ebooks (probado), y la imagen de portada tiene que ser de su cuenta.
- Recuperación de contraseña con enlace temporal (sin correo real: el enlace aparece en la consola del servidor).

### 5.11 Dos modos con la misma fachada (y por qué el sitio público funciona sin servidor)

- Los componentes de la interfaz solo usan la fachada `api` (patrón **fachada** + **adaptador**).
- **Modo demo** (`NEXT_PUBLIC_API_MODE=mock`): los cuatro agentes se **simulan en el navegador**, con datos por usuario en `localStorage`. Es lo que se publica en **GitHub Pages**: gratis, siempre disponible y sin costo de IA.
- **Modo backend** (`http`): la misma interfaz habla con FastAPI + LangGraph y el LLM real. En Windows, `iniciar-folio.ps1` arranca los dos juntos.
- Así se cumplió el orden de trabajo de D-07: documentación → diseño → frontend con datos simulados → backend. El cambio de simulación a servidor real **no tocó los componentes** (ocultamiento de información).

---

## 6. El modelo de calidad (el "modelo propuesto" que evalúa la rúbrica)

> **Ojo, equipo:** la entrega del 24-10 ("Modelos de calidad por tipo de software") tiene su propio informe con los componentes vistos en clase. Este documento **no tiene una copia de ese informe**. Lo que sigue reconstruye el modelo de calidad a partir de lo que el proyecto realmente hace y mide. **Si su informe usa otros nombres, métricas o umbrales, manden los del informe** y usen esta sección para respaldarlos con evidencia.

### 6.1 Paso 1: delimitar el tipo de software y la categoría de IA

Folio es **software de IA generativa de texto** (procesamiento de lenguaje natural con un modelo de lenguaje grande), organizado como **sistema multiagente orquestado con humano en el bucle**, entregado como **aplicación web**. No entrena modelos: usa un **modelo de IA de uso general** de un proveedor externo (Gemini por defecto).

Por qué importa el tipo: un modelo de calidad genérico (ISO/IEC 25010) no cubre lo propio de la IA: que la salida **no es determinista**, que puede **alucinar**, que puede tener **sesgos** y que la persona necesita **controlarla y entenderla**. Para eso existe la extensión para sistemas de IA.

### 6.2 Normas de base

- **ISO/IEC 25010** (familia SQuaRE): modelo de calidad del producto de software. En su versión de 2023 tiene nueve características: adecuación funcional, eficiencia de desempeño, compatibilidad, capacidad de interacción (antes "usabilidad"), fiabilidad, seguridad (*security*), mantenibilidad, flexibilidad (antes "portabilidad") y protección (*safety*, nueva en 2023).
- **ISO/IEC 25059:2023**, modelo de calidad para **sistemas de IA**: extiende el 25010 con subcaracterísticas propias de la IA:
  - **Controlabilidad por el usuario** (dentro de usabilidad): la persona puede intervenir y controlar el sistema a tiempo.
  - **Transparencia** (dentro de usabilidad): se comunica lo necesario sobre el sistema y su funcionamiento.
  - **Adaptabilidad funcional** (dentro de adecuación funcional): capacidad de adquirir información de los datos y mejorar.
  - **Corrección funcional** (redefinida): en IA se acepta que haya errores y se miden.
  - **Robustez** (dentro de fiabilidad): mantener el desempeño ante entradas o condiciones adversas.
  - **Intervenibilidad** (dentro de seguridad): un operador puede intervenir para evitar daños.
  - En **calidad en uso**: **mitigación de riesgos sociales y éticos** y transparencia.

> Si en clase el modelo se trabajó con otra base (McCall, Boehm, FURPS o ISO/IEC 9126), la idea es la misma: características → subcaracterísticas → métricas → umbrales → evidencia. Las equivalencias más útiles: usabilidad (McCall, FURPS) ≈ capacidad de interacción; corrección y fiabilidad (McCall) ≈ adecuación funcional y fiabilidad; mantenibilidad y flexibilidad (McCall) ≈ mantenibilidad; portabilidad e interoperabilidad (McCall) ≈ flexibilidad y compatibilidad.

### 6.3 El modelo de calidad de Folio: características, métricas y evidencia

| Característica | Subcaracterística | Qué significa en Folio | Métrica | Umbral | Resultado y evidencia |
|---|---|---|---|---|---|
| Adecuación funcional | Completitud | Están todas las funciones pedidas | Requerimientos con prueba que pasa / total | 100 % de RF | 6/6 RF y 12/18 requerimientos totales con prueba automática; 6 pendientes de medición con el modelo real |
| Adecuación funcional | Corrección (IA) | La salida respeta la forma exigida aunque el LLM no sea determinista | Capítulos con las 4 secciones en orden; índices con 5-7 capítulos; ejercicios válidos | 100 % (con reintento) | Validación en código + reintento; pruebas `test_agents.py` (11) y `test_flow.py` |
| Adecuación funcional | Adaptabilidad (IA) | Se ajusta a lo que la persona aprueba | Capítulos 2-N generados con la guía de estilo del capítulo 1 | Todos | Guía de estilo + capítulo ancla. **Ojo:** Folio no aprende ni se reentrena; se adapta *dentro de cada libro* |
| Eficiencia de desempeño | Comportamiento temporal | Un capítulo no hace esperar demasiado | Tiempo por capítulo (percentil 95) | < 60 s | 7,2 s en la simulación; límite de 60 s + 1 reintento en el backend; **falta medir con Gemini** |
| Compatibilidad | Interoperabilidad | El resultado se usa fuera de Folio y se conecta con fuentes externas | Formatos estándar; APIs externas | `.md` + PDF; APA 7 | Markdown limpio, PDF etiquetado, Crossref y Open Library |
| Capacidad de interacción | **Controlabilidad por el usuario (IA)** | La IA propone y la persona decide | Pausas obligatorias; acciones de control | 2 pausas no saltables | 2 `interrupt()`; aprobar, regenerar, otro capítulo, ajustar, editar a mano, cancelar y volver a la versión anterior |
| Capacidad de interacción | **Transparencia (IA)** | Se sabe qué hace la IA y qué generó | Agente visible en cada fase; marca de IA en las salidas | 100 % de las exportaciones | Fases con el agente responsable, bitácora, nota visible y marca legible por máquina en `.md` y PDF (D-39) |
| Capacidad de interacción | Accesibilidad | La usa cualquier persona | Infracciones WCAG 2.2 AA (axe-core) | 0 | **0 infracciones en 20 pantallas** (tema claro y oscuro); teclado completo; `prefers-reduced-motion` |
| Capacidad de interacción | Protección contra errores del usuario | No se puede romper el libro | Acciones imposibles | — | No se puede salir de 5-7 capítulos, borrar secciones, quitar el aviso legal ni bajar de 11 pt |
| Fiabilidad | **Robustez (IA)** | Sigue funcionando ante fallos del modelo o del servidor | Recuperación tras fallo | Sin pérdida de lo escrito | Reintento automático, error reintentable, reanudación tras reiniciar el servidor (`test_resume_retry.py`, 5 pruebas) y reconexión del stream |
| Fiabilidad | Disponibilidad | Se puede mostrar siempre | Sitio publicado | Disponible | GitHub Pages en modo demo |
| Seguridad | Confidencialidad y autenticidad | Cada quien ve lo suyo | Accesos indebidos | 0 | scrypt + JWT con huella de contraseña; pruebas de aislamiento entre cuentas (`test_auth.py`, `test_revision_seguridad.py`) |
| Seguridad | **Intervenibilidad (IA)** | Se puede detener o corregir a la IA a tiempo | Puntos de intervención | En cada etapa | Pausas, cancelar durante una regeneración (restaura la versión anterior), editar cualquier capítulo antes de exportar |
| Mantenibilidad | Modularidad | Cambiar una parte no rompe las demás | Un módulo y un prompt por agente | 4 agentes | `backend/app/agents/` y `backend/app/prompts/<agente>/` (RNF-04) |
| Mantenibilidad | Modificabilidad | Cambiar de proveedor o de prompt es fácil | Archivos tocados para cambiar de LLM | 0 de código | Variable `LLM_PROVIDER` |
| Mantenibilidad | Capacidad de prueba | Todo se puede probar sin red | Pruebas automáticas | Una por requerimiento | 20 e2e + 147 backend + 1 punta a punta; el backend se prueba sin internet con el proveedor demo |
| Flexibilidad | Adaptabilidad al entorno | Funciona en distintos dispositivos y contextos | Rangos de ancho; temas | 4 rangos | Escritorio, tableta y móvil; tema claro y oscuro; dos modos (demo y backend) |
| Protección (*safety*) | Mitigación de riesgos | No causar daño con el contenido | Temas sensibles con aviso | 100 % | Aviso legal automático y no removible (RÉR-02); guardarraíl de ficción |

**Calidad en uso**

| Característica | En Folio | Evidencia |
|---|---|---|
| Efectividad | Se llega a un ebook completo y exportado | Prueba punta a punta y demo en vivo |
| Eficiencia | De una idea a un ebook en una sesión | Flujo completo de unos 25 s con el proveedor demo |
| Satisfacción | Interfaz calmada, sin copy de "IA mágica" | Sistema de diseño propio ("Mesa en calma") |
| Libre de riesgos / **mitigación de riesgos sociales y éticos (IA)** | Aviso legal, sin estereotipos, transparencia y supervisión humana | RÉR-02, RÉR-03, AI Act (sección 7) |
| Cobertura del contexto | Español, escritorio y móvil, lectores de pantalla | WCAG 2.2 AA y PDF etiquetado |

### 6.4 Cómo se verificó la calidad (la pirámide de pruebas)

| Nivel | Qué hay | Resultado |
|---|---|---|
| Unitarias e integración del backend (`pytest`) | 147 pruebas: flujo completo por la API, SSE, reanudación y reintentos, guardarraíl, agentes, referencias y APA, capa LLM, autenticación, PDF, edición en vivo y todas las correcciones de las revisiones | **147/147**, unos 55 s, **sin salir a internet** (Crossref, Open Library y Gemini simulados) |
| Aceptación en el navegador (Playwright) | **Una prueba por requerimiento** (`requisitos.spec.ts`, 18) + portada y referencias (2) | **20/20**, también contra el sitio publicado |
| Punta a punta con el backend real | Crear cuenta → ficción rechazada → índice → recargar y seguir en la pausa → aprobar → capítulo 1 → resto → editar → portada con imagen → referencia → PDF y `.md` → cerrar sesión y volver | **1/1**, unos 25 s |
| Accesibilidad automática | axe-core en 20 pantallas, tema claro y oscuro | **0 infracciones** |
| Recorridos manuales guiados | 54 comprobaciones con el backend real (escritura en vivo, cancelar, dos pestañas, referencias contra Crossref y Open Library reales, caída y reconexión del servidor…) y más rondas de flujo multiagente | Errores encontrados y corregidos |
| **Revisión de código independiente** | Dos rondas, cada una con una revisión del backend y otra del frontend | **46 errores** que ninguna prueba cubría: 27 en la primera ronda (13 backend + 14 frontend) y 19 en la segunda, sobre esas correcciones (7 + 12, ninguno crítico); todos corregidos y cada uno con una prueba que falla con el código viejo y pasa con el nuevo |
| Integración continua | GitHub Actions: despliegue del sitio y pruebas del backend en cada cambio | Verde |

Ejemplos de errores reales que encontró la verificación (sirven para demostrar responsabilidad profesional):
- **Sesgo (RÉR-03):** los ejemplos repetían "mujer enfermera" y "hombre futbolista"; y un libro salió con 6 mujeres y 0 hombres porque las personas se elegían al azar. Ahora rotan a lo largo del libro y alternan el género, y hay una prueba.
- **Accesibilidad (RA-01):** el PDF no tenía H1. Se agregó una portadilla con el título en H1.
- **Supervisión humana (RF-05):** si el servidor se caía justo en la pausa del capítulo 1, al volver podía seguir escribiendo sin aprobación. Corregido con una marca persistente.
- **Contraste (RA-03):** con la tela Ocre y una imagen muy clara, el título quedaba en 4,3:1 (por debajo de 4,5:1). Ahora el velo puede llegar al 100 % y lo calcula el servidor.
- **Seguridad (RD-01):** cambiar la contraseña no cerraba las sesiones y el inicio de sesión delataba por tiempo si una cuenta existía. Corregido.
- **Robustez (segunda ronda):** una imagen de portada de pocos KB pero muy alargada ocupaba 3 GB de memoria en el servidor; si el modelo marcaba las secciones con negrita en vez de `##`, el capítulo fallaba; y si fallaba el guardado de la última edición, se aprobaba o exportaba la versión anterior. Corregido y probado.

---

## 7. Escenario de IA, nivel de riesgo y ética

### 7.1 Ficha del escenario

| Dimensión | Folio |
|---|---|
| Capacidad | **IA estrecha** (ANI): una sola tarea. No es IA general (AGI) ni superinteligencia (ASI) |
| Categoría | **IA generativa de texto**, basada en **PLN** con un **LLM** |
| Modelo de base | Modelo de IA de uso general de un proveedor externo (Gemini por defecto); Folio no entrena modelos |
| Arquitectura | **Sistema multiagente cooperativo** coordinado por un orquestador (LangGraph) |
| Tipo de flujo | **Flujo de trabajo predefinido**: el orden lo fija el grafo; el LLM redacta dentro de cada paso |
| Autonomía | **Humano en el bucle** (*human-in-the-loop*): dos pausas obligatorias + edición antes de exportar |
| Decisiones sobre personas | **Ninguna**: no evalúa, no califica ni clasifica a nadie |
| Riesgo (AI Act) | **Riesgo limitado**: obligaciones de **transparencia** (art. 50) |
| Rol (AI Act) | El equipo sería el **proveedor** (art. 3.3); quien lo use profesionalmente, el **implantador** (art. 3.4) |
| Marco en Venezuela | **Código de Ética para el desarrollo y aplicación responsable de la IA** (MINCYT, 19-02-2026): nueve principios, **no vinculante** |

### 7.2 Clasificación según el AI Act, paso a paso

1. **¿Práctica prohibida (art. 5)?** No. No manipula, no explota vulnerabilidades, no hace puntuación social, no predice delitos ni reconoce emociones en el trabajo o la escuela.
2. **¿Alto riesgo (art. 6 y anexo III)?** No. **El AI Act clasifica por el uso, no por el tema.** Escribir sobre finanzas o emociones no lo vuelve de alto riesgo; lo sería si **decidiera algo sobre una persona**: evaluar su solvencia, calificar a estudiantes, decidir admisiones. Folio genera un texto educativo que la persona aprueba.
3. **¿Obligaciones de transparencia (art. 50)?** Sí, por generar texto sintético e interactuar con personas. Por eso es **riesgo limitado**.
   - 50.1 (informar que se interactúa con una IA): los agentes aparecen con su nombre durante todo el proceso. Mejora pendiente: decirlo de forma explícita desde la primera pantalla (inicio o registro).
   - 50.2 (marcar la salida en formato legible por máquina): **cumplido en la fase 4** (D-39): comentario `<!-- folio: generado-con-ia=true; … -->` en el `.md` y `Keywords`/`Creator` en los metadatos del PDF, además de la nota visible.
   - 50.4 (texto de interés público): en general no aplica; y si aplicara, las pausas y el editor dan el **control editorial** humano que exime de la obligación.
4. **Para todos (art. 4):** alfabetización en IA del equipo.

| Nivel | ¿Folio? | Por qué |
|---|---|---|
| Inaceptable | No | No hace ninguna práctica del art. 5 |
| Alto | No | No hace ninguno de los usos del anexo III |
| **Limitado** | **Sí** | Genera texto sintético (art. 50) |
| Mínimo | No | Lo sería si no generara contenido |

**Fechas clave** (con el "Omnibus digital", Reglamento (UE) 2026/1744, en vigor desde el 27-07-2026): prácticas prohibidas y alfabetización desde el 2-02-2025; modelos de uso general desde el 2-08-2025; transparencia del art. 50 desde el 2-08-2026; marcado legible por máquina para sistemas ya en el mercado, 2-12-2026; alto riesgo del anexo III, 2-12-2027.

**Alcance:** el AI Act obliga si el sistema se ofrece en la UE o sus resultados se usan allí; no aplica a investigación y desarrollo previos a la puesta en servicio. Para un prototipo universitario en Venezuela es un **marco de referencia** de buenas prácticas.

**Qué subiría el nivel de riesgo:** calificar las respuestas de los lectores en una institución educativa (alto riesgo); dar asesoría financiera personalizada o evaluar solvencia (cerca del alto riesgo); inferir emociones de estudiantes o trabajadores (prohibido); perfilar usuarios (alto riesgo).

### 7.3 Lo que Folio ya hace "como si fuera de alto riesgo"

| Exigencia del alto riesgo | Práctica de Folio |
|---|---|
| Supervisión humana (art. 14) | Dos `interrupt()` obligatorios, edición manual, "la IA propone, tú decides" |
| Registros (art. 12) | Eventos y bitácora visible de cada agente |
| Transparencia hacia quien lo usa (art. 13) | Fases con el agente responsable y nota de IA al exportar |
| Datos y sesgos (art. 10) | Instrucciones contra estereotipos y datos de ejemplo revisados |
| Precisión y robustez (art. 15) | Límite de 60 s, reintento automático, errores reintentables sin perder lo escrito |

### 7.4 Código de Ética de IA de Venezuela (MINCYT, 2026), principio por principio

| Principio | Cómo lo cumple Folio | Pendiente |
|---|---|---|
| 1. IA humanista | La persona decide en los puntos de control; la IA no manipula | — |
| 2. Equidad y no discriminación | Ejemplos sin estereotipos (RÉR-03); no se perfila a los usuarios | Medir con muestras reales del LLM |
| 3. Responsabilidad ambiental | Salida acotada (800-1.200 palabras por capítulo), capítulos en secuencia, sin generar de más | Considerar el consumo al elegir el modelo |
| 4. Seguridad | Autenticación, contraseñas con scrypt y datos por usuario | — |
| 5. Privacidad | No se piden datos innecesarios | Elegir un plan del proveedor que no entrene con los prompts (P-12) |
| 6. Transparencia | Agentes nombrados, nota visible y marca legible por máquina | Aviso explícito en la primera pantalla |
| 7. Rendición de cuentas | La responsabilidad final es de quien aprueba; queda registro | — |
| 8. Ciencia abierta | Repositorio público y documentación abierta | — |
| 9. Excelencia | Pruebas por requerimiento y verificación documentada | — |

**Otros marcos:** la **Recomendación de la UNESCO** sobre la ética de la IA (2021): los principios más visibles en Folio son supervisión y decisión humanas, transparencia y explicabilidad, equidad, privacidad y proporcionalidad. La **Declaración de Nueva Delhi** (febrero de 2026, firmada por entre 88 y 91 países y organizaciones según la fuente) se centra en democratizar el acceso a la IA: una herramienta accesible, en español, pensada para docentes y creadores independientes va en esa línea.

### 7.5 Entorno según Russell y Norvig (por si preguntan desde la teoría de agentes)

**PEAS:** medida de rendimiento (ebook de 5-7 capítulos con RF-03, tono de RNF-01, < 60 s por capítulo, aprobado, accesible y sin estereotipos); entorno (la app, la persona, el estado del ebook y el LLM); actuadores (texto, eventos, archivos `.md` y PDF); sensores (prompt, nicho, parámetros, aprobaciones, ajustes y ediciones).

**Propiedades:** parcialmente observable (no conoce la intención completa: por eso hay pausas), **estocástico** (el mismo prompt da textos distintos), **secuencial** (cada capítulo depende de los anteriores), estático (el grafo se pausa mientras la persona decide), discreto y **multiagente cooperativo**.

**Superinteligencia:** Folio es IA estrecha. Sus riesgos reales son cotidianos (contenido incorrecto en temas sensibles, sesgos, dependencia del texto generado y privacidad), y el diseño responde a cada uno.

---

## 8. Principios del diseño aplicados (tres niveles)

**1. Diseño de software (Pressman).** Trazabilidad con los requerimientos (cada pantalla y prueba apunta a un RF/RNF/RA/RÉR), arquitectura primero, diseño de datos (tipos, estados y modelo entidad-relación), interfaces cuidadas (contrato REST y eventos tipados), independencia funcional (alta cohesión, bajo acoplamiento: el Redactor no maqueta y el Maquetador no redacta), y diseño iterativo (se descartaron direcciones visuales, se eligió SSE por simple). Conceptos: abstracción (capa LLM), patrones (fachada, adaptador, máquina de estados, cadena de procesamiento, publicación-suscripción), separación de intereses, modularidad, ocultamiento de información, refinamiento y refactorización. Equivalencias: responsabilidad única, inversión de dependencias, KISS y YAGNI.

**2. Diseño de la interfaz (Mandel, Nielsen y metas de WebApps de Pressman).**
- Reglas de oro de Mandel: **dejar el control al usuario** (las dos pausas son esta regla llevada al proceso), **reducir la carga de memoria** (metáfora del libro abierto, valores por defecto: A5, Roboto 11 pt), **consistencia** (izquierda decides, derecha ves tu libro, en todas las etapas).
- Heurísticas de Nielsen más visibles: visibilidad del estado (fases, texto en vivo, "Guardado hace unos segundos"), prevención de errores ("no se puede romper el libro"), recuperación de errores ("No pudimos terminar el capítulo 4. Lo que ya estaba escrito sigue a salvo." + Reintentar; ante una ficción se ofrecen alternativas), control y libertad (volver a versiones anteriores, cancelar).

**3. Diseño visual.** Contraste (texto `#1B1D23` sobre blanco; el acento tinta `#0E7C74` a 5,0:1), jerarquía (Lexend para títulos, Onest para la interfaz, Roboto para el libro), alineación (escala de 4 px), repetición, equilibrio (dos páginas), espacio en blanco ("la mesa"), **énfasis único** (la cinta marcapáginas solo aparece cuando es "Tu turno") y unidad (todo responde a la metáfora del libro).

**"Que no parezca IA":** decisión de diseño explícita: nada de degradados violeta, destellos ✨, glassmorphism, tarjetas iguales en grilla ni copy del tipo "potenciado por IA". La dirección se llama **"Mesa en calma con alma de libro"**, inspirada en la calma de Gemini.

**Ética, accesibilidad y supervisión "por diseño":** los requisitos éticos se resuelven en el diseño y no al final (no se puede quitar el aviso legal; el ejercicio solo puede ser checklist o reto; las pausas forman parte del grafo y no son opcionales).

---

## 9. Impacto del modelo en la realidad del desarrollo de IA

Ideas para el criterio **Impacto** (describirlas con claridad, una por una):

1. **La supervisión humana como requisito de arquitectura, no como botón.** Muchos productos de IA generan todo de una vez y dejan la revisión para el final. Folio pone la supervisión **dentro del grafo** (`interrupt()` + checkpointer): no se puede saltar ni se pierde si se cae el servidor. Es un patrón aplicable a cualquier sistema de IA generativa que produzca algo que alguien va a publicar.
2. **No confiar en lo que el modelo afirma: verificarlo.** Los LLM alucinan referencias. Folio las contrasta con **Crossref y Open Library** y marca las que no existen. Es un ejemplo concreto de calidad del software de IA: **validar la salida del modelo con fuentes externas**.
3. **Calidad medible en sistemas no deterministas.** La salida cambia cada vez, así que Folio valida la **forma** en código (5-7 capítulos, cuatro secciones, ejercicios válidos) y reintenta si no se cumple. El modelo de calidad separa lo que se puede asegurar con pruebas automáticas de lo que hay que medir sobre el texto (tono, legibilidad, sesgos).
4. **Pruebas sin depender del modelo.** El proveedor **demo** permite probar todo el flujo multiagente sin internet, sin costo y con resultados repetibles. Así las pruebas no dependen de un servicio externo ni de que el modelo responda igual.
5. **Independencia del proveedor.** La capa LLM permite cambiar Gemini por Claude u OpenAI con una variable. En un mercado de IA que cambia cada pocos meses, eso protege el proyecto (bajo acoplamiento).
6. **Transparencia verificable.** La marca "generado con IA" va en los metadatos del PDF y en el `.md`, legible por máquina, como pide el art. 50.2 del AI Act.
7. **Accesibilidad como parte de la calidad de la IA.** El producto generado (no solo la app) sale accesible: PDF etiquetado, jerarquía H1/H2/H3, 11 pt mínimo y contraste verificado.
8. **Ética operativa, no declarativa.** Los sesgos se detectaron con una prueba (un libro con 6 mujeres y 0 hombres) y se corrigieron en el código. El aviso legal en temas sensibles no depende de la buena voluntad del usuario.
9. **Impacto social en el contexto local.** Una herramienta en español, gratuita en su modo demo, para docentes, orientadores y creadores independientes: material práctico, accesible y responsable en una sola sesión.
10. **El modelo de calidad es reutilizable:** ISO/IEC 25010 + 25059 + AI Act + Código Ético venezolano, con métricas y evidencia, sirve de plantilla para evaluar otros sistemas de IA generativa.

---

## 10. Responsabilidad profesional (criterio Coherencia): frases para decir con firmeza

- "Como ingenieros, **somos responsables de lo que el sistema produce**, aunque el texto lo escriba un modelo de IA. Por eso la IA propone y la persona decide en dos pausas que no se pueden saltar."
- "**No damos nada por cumplido sin evidencia**: cada requerimiento tiene una prueba automática que lo demuestra."
- "**No escondemos lo que falta.** Seis requerimientos tratan de cómo escribe la IA; tienen sus mecanismos, pero todavía hay que medirlos con el modelo real, y así lo documentamos."
- "Sometimos el código a **revisiones independientes**: encontraron 46 errores, en dos rondas, que nuestras pruebas no veían. Los corregimos todos y cada uno quedó con su prueba para que no vuelva."
- "La calidad del software de IA no es solo que funcione: es que sea **transparente, controlable, robusto, accesible y justo**. Por eso usamos la extensión ISO/IEC 25059 para sistemas de IA."
- "La ética la pusimos **en el diseño**, no en un documento aparte: el aviso legal no se puede quitar, los ejemplos se prueban contra estereotipos y las referencias se verifican."
- "Si el contenido puede afectar la salud, el dinero o las emociones de alguien, el sistema **lo dice y recomienda ayuda profesional**."

---

## 11. Guion de la exposición y de la demostración

> Ajusten el reparto al número de integrantes y al tiempo que les den. Si son 4, un bloque por persona; la demo la hace quien maneja mejor el sitio, y las preguntas las responde quien domina cada tema (ver "Reparto de preguntas" al final).

| Bloque | Tiempo | Contenido | Criterio que asegura |
|---|---|---|---|
| 1. Apertura | 1 min | Problema y Folio en 30 segundos (sección 2). QR al sitio en pantalla | Coherencia |
| 2. El modelo del sistema | 2-3 min | Cuatro agentes, grafo con las dos pausas, capa LLM y SSE (sección 5). Mostrar el diagrama | Demostración |
| 3. Demostración en vivo | 3-4 min | Ver guion de la demo abajo | Interactividad + Demostración |
| 4. El modelo de calidad | 2-3 min | Tipo de software → ISO/IEC 25010 + 25059 → tabla de características con métricas y resultados → pirámide de pruebas (sección 6) | Demostración + Coherencia |
| 5. Ética y riesgo | 1-2 min | Riesgo limitado del AI Act y por qué no es alto riesgo; Código Ético venezolano; lo que hace "como si fuera alto riesgo" (sección 7) | Coherencia |
| 6. Impacto y cierre | 1-2 min | 3 o 4 impactos de la sección 9, lo que falta (honestidad) y una frase de responsabilidad profesional | Impacto + Coherencia |

### Guion de la demo en vivo (sitio publicado, modo demo)

Antes de empezar: abrir el sitio, entrar con **"Continuar con Google"** (acceso simulado) y poner **Ajustes → Demostración → Velocidad: Rápida**. Tener una pestaña de respaldo con un libro ya terminado en la biblioteca de ejemplo.

1. **Guardarraíl (RF-01):** escribir "Escribe una novela de fantasía sobre dragones". Folio la rechaza con amabilidad y propone alternativas prácticas. Decir: "Solo no ficción sobre situaciones reales; se valida antes de crear y otra vez en el servidor".
2. **Idea válida:** "Cómo manejar el estrés en época de exámenes y dormir mejor", 5 capítulos. Mostrar las **fases con el agente responsable** (Investigador trabajando).
3. **Punto de control 1 (RF-02, RF-05):** aparece la **cinta "Tu turno"**. Intentar borrar un capítulo con 5 (no deja), arrastrar para reordenar, pedir "otro capítulo" en lugar de uno. Aprobar.
4. **Punto de control 2:** ver el capítulo 1 escribiéndose **en vivo** con sus secciones. Tocar **"Más cercano" → Aplicar** (versión 2). Decir: "Este capítulo se vuelve el ancla de tono del resto". Aprobar.
5. **Redacción del resto (RNF-03):** los capítulos se escriben **uno detrás de otro**, nunca a la vez.
6. **Revisión final:** mostrar el **aviso legal** (tema de estrés = sensible) y que no se puede quitar; editar un párrafo.
7. **Portada (RD-04):** cambiar plantilla, subir una imagen y ver cómo el velo protege el contraste del título; contraportada.
8. **Referencias (RD-09):** ver las lecturas sugeridas con su estado (verificada / no encontrada), buscar una por título o ISBN.
9. **Exportar (RF-06, RA-01, RA-03):** descargar `.md` y PDF. Si hay tiempo, abrir el PDF y mostrar los marcadores (H1/H2/H3).

**Qué decir si preguntan "¿esto es IA de verdad?":** "El sitio público simula a los agentes en el navegador para que esté disponible siempre y sin costo. El backend real con LangGraph y Gemini existe en el repositorio, usa exactamente la misma interfaz y tiene sus 147 pruebas. Con la clave de Gemini en `backend/.env`, `iniciar-folio.ps1` lo arranca todo." (Además hay un enlace con IA real: la laptop del equipo corre el backend con Gemini y lo publica con un túnel. Muéstrenlo en vivo: suma mucho en Demostración. Ese enlace cambia si la laptop se reinicia, y el plan gratuito de Gemini limita las peticiones por minuto y por día: si sale un aviso de cuota, se espera un minuto y se pulsa Reintentar.)

**Plan B si falla internet o el proyector:** la guía en PDF (`docs/guia/Folio-guia-de-requerimientos.pdf`) tiene capturas señaladas de cada paso, y el PDF de ejemplo generado por el servidor está en `docs/verificacion/ebook-ejemplo-servidor.pdf`.

### Reparto de preguntas (para que nadie se quede en blanco)

| Tema | Quién responde |
|---|---|
| Arquitectura, LangGraph, agentes, capa LLM, SSE | Integrante de backend |
| Interfaz, accesibilidad, diseño, demo | Integrante de frontend/diseño |
| Modelo de calidad, pruebas y métricas | Integrante de calidad |
| AI Act, Código Ético, riesgos e impacto | Integrante de ética/legal |

---

## 12. Banco de preguntas del jurado con respuestas firmes

### Sobre el sistema y el modelo

1. **¿Qué es exactamente un agente en Folio?**
   Un módulo con un rol único y su propio prompt: Investigador, Redactor, Ejercicios y Maquetador. No son programas autónomos que decidan su camino: el orquestador (LangGraph) fija el orden y cada agente usa el LLM para su tarea.

2. **¿Por qué cuatro agentes y no un solo prompt grande?**
   Por modularidad y calidad: cada uno tiene instrucciones específicas y una salida validable. Si el tono falla, se ajusta el prompt del Redactor sin tocar el índice ni la maquetación. Además, lo exige RNF-04.

3. **¿Qué es LangGraph y por qué lo usaron?**
   Una librería para orquestar flujos con LLM como grafos de estado. La elegimos porque trae `interrupt()` para pausar el grafo esperando a una persona y un *checkpointer* que guarda el avance. Eso resuelve RF-05 (pausas) y RD-07 (reanudación) de forma nativa.

4. **¿Cómo garantizan que las pausas no se puedan saltar?**
   Están dentro del grafo: el nodo `punto_control_*` llama a `interrupt()` y el grafo no avanza hasta recibir la decisión. Además se guarda una marca de "capítulo 1 aprobado" y el Redactor no escribe el resto sin ella, aunque el servidor se reinicie en plena pausa. Hay pruebas para ambos casos.

5. **¿Qué pasa si se cae el servidor a mitad de un capítulo?**
   El checkpointer de LangGraph guarda un punto después de cada paso. Al volver, el ebook retoma el mismo capítulo sin perder los anteriores. Lo probamos matando el proceso a mitad del trabajo (`test_resume_retry.py`).

6. **¿Cómo logran la coherencia entre capítulos si el LLM no tiene memoria?**
   Le pasamos el contexto explícitamente: el índice completo, el *brief*, la guía de estilo extraída del capítulo 1, el capítulo 1 aprobado como referencia y el resumen y la conclusión de los anteriores. Y los capítulos se escriben en secuencia, nunca en paralelo.

7. **¿Qué es el "capítulo ancla"?**
   El capítulo 1 una vez aprobado (o editado a mano) por la persona. Es la referencia de tono y formato para el resto. Si la persona lo edita, su versión pasa a ser el ancla (D-10).

8. **¿Cómo controlan que el capítulo tenga las cinco partes?**
   El prompt exige los encabezados exactos; el código revisa la estructura al terminar y reintenta si falta alguna sección; cualquier encabezado extra se baja a nivel 3 para no romper la jerarquía. El ejercicio lo hace otro agente y se valida que sea checklist o reto.

9. **¿Qué es la temperatura y cuál usan?**
   Un parámetro que controla qué tan variada es la respuesta del modelo: más baja, más predecible; más alta, más creativa. El Redactor usa 0,8 para un tono natural; tareas de clasificación usan valores más bajos. Está en el encabezado de cada prompt (lo pide RNF-01).

10. **¿Qué es SSE y por qué no WebSockets?**
    *Server-Sent Events*: una conexión HTTP por la que el servidor envía eventos al navegador. Nuestro flujo es casi todo servidor → cliente (texto en vivo, avances), así que SSE es más simple y se reconecta solo. WebSockets sería bidireccional y más complejo sin necesidad (principio KISS).

11. **¿Por qué Gemini? ¿Y si mañana quieren otro modelo?**
    Por el plan gratuito de Google AI Studio. Pero los agentes no dependen de Gemini: hablan con una interfaz `LLMProvider`. Cambiar a Claude u OpenAI es cambiar la variable `LLM_PROVIDER`; no se toca el código de los agentes.

12. **¿Cómo evitan que la IA invente referencias?**
    No confiamos en el modelo: cada referencia se verifica en Crossref (por DOI) u Open Library (por ISBN), o por título y autor. Solo es "verificada" si el título coincide al 80 % o más y coincide al menos un apellido. Las que no aparecen se marcan "no encontrada" y la exportación lo advierte.

13. **¿Cómo rechazan la ficción?**
    En dos pasos: antes de crear el ebook (patrones de ficción + clasificación del LLM) y otra vez dentro del grafo. No mostramos un error seco: explicamos el motivo con amabilidad y proponemos 3 alternativas prácticas.

14. **¿Cómo saben que el PDF es accesible?**
    Chromium genera un **PDF etiquetado**: tiene un árbol de estructura con H1, H2 y H3 que leen los lectores de pantalla, y marcadores para navegar. Las pruebas verifican el `/StructTreeRoot`, los niveles de encabezado y los metadatos. Lo que falta es revisarlo con un lector real como NVDA.

15. **¿Qué patrones de diseño usaron?**
    Fachada (`api` en el frontend), adaptador (modo demo y modo servidor detrás de la misma fachada; proveedores de LLM detrás de `LLMProvider`), máquina de estados (estados del ebook), cadena de procesamiento (agentes en secuencia) y publicación-suscripción (SSE).

### Sobre la calidad

16. **¿Cuál es su modelo de calidad?**
    Partimos de ISO/IEC 25010 y lo extendimos con ISO/IEC 25059, el modelo de calidad para sistemas de IA. Agrega lo que la IA necesita: controlabilidad por el usuario, transparencia, robustez, intervenibilidad, corrección funcional (aceptando que la IA se equivoca) y mitigación de riesgos éticos. Para cada característica definimos una métrica, un umbral y una evidencia en el proyecto.

17. **Denme un ejemplo de métrica con su resultado.**
    Accesibilidad: infracciones WCAG 2.2 AA detectadas por axe-core; umbral 0; resultado 0 en 20 pantallas, en tema claro y oscuro. Otro: tiempo por capítulo, umbral 60 s; 7,2 s en la simulación, con límite y reintento en el servidor; falta medirlo con Gemini.

18. **¿Cómo prueban un sistema cuyo resultado cambia cada vez?**
    Separando dos cosas. La **forma** (5-7 capítulos, cuatro secciones, tipo de ejercicio, aviso legal, jerarquía) se valida en código y con pruebas automáticas usando un proveedor demo determinista. El **contenido** (tono, coherencia, sesgos, legibilidad) se mide sobre textos reales con rúbricas e índices como INFLESZ.

19. **¿Cuántas pruebas tienen?**
    20 pruebas de aceptación en el navegador (una por requerimiento más portada y referencias), 147 del backend y una punta a punta con el backend real. Además, axe-core en 20 pantallas y recorridos manuales con 54 comprobaciones.

20. **¿Cómo saben que sus pruebas sirven?**
    Porque encontraron errores reales: un libro con 6 mujeres y 0 hombres, un PDF sin H1, un contraste de 4,3:1. Y las 46 correcciones de las revisiones de código tienen pruebas que fallan con el código viejo y pasan con el nuevo.

21. **¿Qué es INFLESZ?**
    Un índice de legibilidad para textos en español (escala de Flesch adaptada por Barrio-Cantalejo). De 65 a 80 es "bastante fácil". Nuestro texto de prueba dio 78,8. Ojo: lo medimos sobre el texto de la simulación; falta medirlo con capítulos de Gemini.

### Sobre ética, riesgo y responsabilidad

22. **Si habla de finanzas y emociones, ¿no es de alto riesgo?**
    No. El AI Act clasifica por el uso, no por el tema. Sería alto riesgo si evaluara la solvencia de alguien o calificara a estudiantes. Folio produce un texto educativo que una persona aprueba, y en esos temas agrega un aviso legal que no se puede quitar.

23. **¿Quién es responsable de lo que escribe la IA?**
    La persona que aprueba y publica, porque tiene el control editorial. Nosotros, como proveedores, respondemos por la transparencia y por las salvaguardas del diseño: pausas, aviso legal, verificación de referencias y reglas contra sesgos.

24. **¿El AI Act aplica en Venezuela?**
    Solo si el sistema se ofrece en la UE o sus resultados se usan allí. En Venezuela aplica el Código de Ética del MINCYT (2026), que no es vinculante. Usamos el AI Act como referencia de buenas prácticas.

25. **¿Cómo cumplen la transparencia?**
    Los agentes aparecen con su nombre en cada fase; el libro lleva la nota "Contenido original generado con asistencia de IA"; y hay una marca legible por máquina en el `.md` y en los metadatos del PDF (art. 50.2).

26. **¿Cómo evitan los sesgos?**
    Reglas explícitas en los prompts (diversidad de nombres, edades, géneros, orígenes y trabajos; roles que no dependen del género), personas de ejemplo que rotan y alternan el género, y una prueba que lo comprueba. Esa prueba nos encontró un sesgo real que corregimos. No decimos "no tiene sesgos": decimos que los **mitigamos y los medimos**.

27. **¿Qué pasa con la privacidad de lo que escribe el usuario?**
    No pedimos datos innecesarios y las contraseñas van con scrypt. Pero un prompt puede contener datos sensibles (emociones, dinero) y viaja al proveedor del LLM. Es una pregunta abierta (P-12): hay que usar un plan que no entrene con los datos de los clientes.

28. **¿La IA puede reemplazar a un psicólogo o asesor financiero?**
    No, y el sistema lo dice: en temas sensibles el aviso legal aclara que el contenido es educativo e informativo y no sustituye la asesoría profesional, y el Redactor sugiere buscar ayuda profesional cuando corresponde.

29. **¿Usaron IA para programar el proyecto?** *(Adapten la respuesta a cómo trabajaron de verdad.)*
    Sí, como herramienta, con las mismas reglas que pedimos a Folio: supervisión humana, documentación y requerimientos antes del código, una prueba por requerimiento y revisiones de código. El repositorio tiene un archivo de instrucciones (`CLAUDE.md`) para cualquier asistente de IA que trabaje en él. La responsabilidad por la calidad sigue siendo nuestra.

### Preguntas difíciles (prepárenlas especialmente)

30. **¿Por qué hay dos enlaces (demo y con IA)?**
    GitHub Pages solo publica páginas estáticas: no puede ejecutar el backend ni guardar una clave de API de forma segura. Por eso el sitio de Pages simula a los agentes con la misma interfaz y siempre está disponible. La versión con IA real (Gemini) corre en un equipo del equipo con el backend completo y se publica con un túnel de Cloudflare; para un despliegue permanente haría falta un servidor con Python y Chromium (P-08).

31. **¿Probaron con Gemini de verdad?**
    Sí. Con la clave real (27-10-2026) un libro de 5 capítulos sale en poco más de 1 minuto: índice en unos 11 s y cada capítulo en unos 10 s, muy por debajo del límite de 60 s (RNF-02). Medimos tres modelos y elegimos por datos: `gemini-3.8-flash` tardaba unos 80 s por capítulo (no cumplía RNF-02), `gemini-3.5-flash` unos 17 s pero su cuota gratuita diaria se agota con un libro, y `gemini-3.5-flash-lite` cumple con margen y tiene cuota para varios libros al día. Las pruebas automáticas siguen usando el proveedor demo para ser repetibles y no gastar cuota. Lo que falta es medir con rigor el tono, la coherencia y los sesgos sobre varios libros reales (hoy hay una revisión puntual).

32. **¿Qué harían diferente?**
    Medir antes la calidad del texto con el modelo real, revisar el PDF con NVDA, publicar el backend (P-08) y agregar el aviso de IA explícito en la primera pantalla.

33. **¿Cuál es la principal limitación?**
    La calidad del texto depende del modelo, que no es determinista. Por eso la persona aprueba en dos pausas y puede editar todo: la última palabra es humana.

34. **¿Esto escala a muchos usuarios?**
    Hoy no está pensado para eso: SQLite local y un solo servidor (es un prototipo). La migración prevista es a Supabase (Postgres, autenticación y almacenamiento), que además sirve para el checkpointer de LangGraph. La arquitectura por capas lo permite sin cambiar los agentes.

35. **¿Por qué no generar la portada con IA?**
    Fue una decisión de alcance (D-15): evita problemas de derechos y de calidad visual. La portada es tipográfica con plantillas, y la persona puede subir su propia imagen.

---

## 13. Vocabulario preciso

### Glosario

| Término | Definición corta para decirla en voz alta |
|---|---|
| **LLM** (modelo de lenguaje grande) | Modelo de IA entrenado con grandes volúmenes de texto que genera texto a partir de instrucciones |
| **IA generativa** | IA que produce contenido nuevo (texto, imágenes) en vez de solo clasificar o predecir |
| **Prompt** | Instrucción que se le da al modelo. En Folio, cada agente tiene los suyos en archivos aparte |
| **Prompt de sistema** | La parte fija que define el rol y las reglas del agente |
| **Temperatura** | Parámetro que regula la variabilidad de la respuesta |
| **Token** | Fragmento de texto con el que trabaja el modelo; el streaming envía el texto token a token |
| **Streaming** | Mostrar la respuesta mientras se genera, no al final |
| **Sistema multiagente** | Varios agentes especializados que cooperan hacia un objetivo |
| **Orquestador** | El componente que decide el orden de los agentes (LangGraph) |
| **Grafo de estado** | Representación del flujo como nodos (pasos) y aristas (transiciones) con un estado compartido |
| **Humano en el bucle** (*human-in-the-loop*, HITL) | Diseño en el que una persona aprueba o corrige en puntos definidos del proceso |
| **Punto de control** | Cada pausa obligatoria para la aprobación humana (índice y capítulo 1) |
| **`interrupt()`** | Función de LangGraph que detiene el grafo y espera una decisión externa |
| **Checkpointer** | Mecanismo que guarda el estado del grafo después de cada paso para poder reanudar |
| **Guardarraíl** | Control que filtra entradas o salidas no permitidas (aquí: la ficción) |
| **Alucinación** | Cuando el modelo afirma algo falso con seguridad (por ejemplo, una referencia inexistente) |
| **No determinista / estocástico** | Que la misma entrada puede producir salidas distintas |
| **Capítulo ancla** | El capítulo 1 aprobado, referencia de tono y formato |
| **Guía de estilo** | Resumen interno (persona gramatical, registro, términos, formato) extraído del capítulo ancla |
| **SSE** | *Server-Sent Events*: eventos del servidor al navegador por una conexión HTTP |
| **API REST** | Interfaz del servidor basada en recursos y métodos HTTP |
| **Fachada** | Patrón que ofrece una interfaz simple que oculta la complejidad interna |
| **Adaptador** | Patrón que permite intercambiar implementaciones (demo o servidor; Gemini o Claude) |
| **PDF etiquetado** | PDF con estructura semántica (encabezados, párrafos) que leen los lectores de pantalla |
| **WCAG 2.2 AA** | Pautas internacionales de accesibilidad web, nivel AA |
| **Contraste 4,5:1** | Relación mínima de luminancia entre texto y fondo para texto normal (WCAG AA) |
| **APA 7** | Séptima edición de las normas de citación de la American Psychological Association |
| **DOI / ISBN** | Identificadores únicos de artículos (DOI) y libros (ISBN) |
| **Crossref / Open Library** | Bases públicas para verificar artículos (Crossref) y libros (Open Library) |
| **JWT** | Token firmado que identifica la sesión |
| **scrypt** | Función para derivar y guardar contraseñas de forma segura y lenta para atacantes |
| **ISO/IEC 25010** | Modelo de calidad del producto de software (familia SQuaRE) |
| **ISO/IEC 25059** | Extensión del modelo de calidad para sistemas de IA |
| **AI Act** | Reglamento (UE) 2024/1689 sobre inteligencia artificial, basado en niveles de riesgo |
| **Riesgo limitado** | Nivel del AI Act con obligaciones de transparencia (art. 50) |
| **Proveedor / implantador** | Quien desarrolla y ofrece el sistema / quien lo usa profesionalmente (AI Act) |
| **IA estrecha (ANI)** | IA que hace una tarea específica; lo opuesto a la IA general (AGI) |
| **Trazabilidad** | Poder seguir cada requerimiento hasta su diseño, código y prueba |
| **Prueba de aceptación (e2e)** | Prueba que recorre la aplicación como lo haría una persona |
| **Integración continua** | Ejecución automática de pruebas y despliegue en cada cambio (GitHub Actions) |

### Errores de vocabulario que bajan la nota (y qué decir en su lugar)

| No digan | Digan |
|---|---|
| "La IA aprende de cada usuario" | "No se reentrena; se adapta dentro de cada libro con la guía de estilo y el capítulo ancla" |
| "Es 100 % seguro" / "no tiene sesgos" | "Mitigamos los sesgos y lo comprobamos con pruebas" |
| "El agente decide qué hacer" | "El orquestador fija el orden; cada agente cumple su tarea con el LLM" |
| "Es un chatbot" | "Es un sistema multiagente con un flujo de trabajo predefinido y supervisión humana" |
| "Entrenamos un modelo" | "Usamos un modelo de uso general de un proveedor externo; no entrenamos modelos" |
| "Es de alto riesgo porque habla de salud" | "Es de riesgo limitado: el AI Act clasifica por el uso, no por el tema" |
| "El AI Act nos obliga" | "Lo usamos como marco de referencia; en Venezuela aplica el Código Ético del MINCYT, no vinculante" |
| "Pausa opcional" / "botón de aprobar" | "Punto de control obligatorio dentro del grafo (`interrupt()`)" |
| "Base de datos en la nube" | "SQLite local; Supabase es la migración prevista" |
| "Funciona con Gemini" (sin matiz) | "Está integrado con Gemini; las pruebas usan el proveedor demo y falta medir la calidad con el modelo real" |
| "Usabilidad" (si citan la norma de 2023) | "Capacidad de interacción" (nombre en ISO/IEC 25010:2023) |

---

## 14. Datos y cifras para memorizar

| Dato | Valor |
|---|---|
| Agentes | 4: Investigador, Redactor, Ejercicios y Maquetador/Exportador |
| Pausas obligatorias | 2: índice y capítulo 1 |
| Capítulos por ebook | 5 a 7 (unas 15 a 30 páginas; 800 a 1.200 palabras por capítulo) |
| Secciones por capítulo | 5: Introducción, Desarrollo, Ejemplos cotidianos, Conclusión, Ejercicio |
| Tipos de ejercicio | 2: checklist (5-7 ítems) o reto de 24/48 h (3-5 pasos) |
| Requerimientos originales | 16 (6 RF, 4 RNF, 3 RA, 3 RÉR) + 9 derivados (RD) |
| Estado de la verificación | 12 cumplen con prueba; 6 implementados, falta medirlos con el modelo real |
| Pruebas | 20 aceptación (navegador) · 147 backend · 1 punta a punta |
| Accesibilidad | 0 infracciones axe-core en 20 pantallas, claro y oscuro; WCAG 2.2 AA |
| Errores encontrados por revisión de código | 46 en dos rondas: 27 (13 backend + 14 frontend) y 19 (7 + 12), todos corregidos y con prueba |
| Recorrido manual con backend real | 54 comprobaciones |
| Tiempo por capítulo | Límite 60 s + 1 reintento; 7,2 s en la simulación |
| Libro completo con proveedor demo | Unos 25 s (6 capítulos) |
| Legibilidad del texto de prueba | INFLESZ 78,8 ("bastante fácil"; 9,1 palabras por frase) |
| Lecturas sugeridas | 4 a 8; coinciden si el título se parece un 80 % y coincide un apellido |
| Plantillas de portada | 5: Clásica, Centrada, Franja, Marco, Editorial |
| Tamaños de página | 4: A5 (por defecto), A4, Carta, 6×9 pulgadas |
| Tipografía del PDF | Roboto, Arial o Helvetica, 11 a 13 pt (mínimo 11) |
| Contraste mínimo del título sobre imagen | 4,5:1 |
| Temperatura del Redactor | 0,8 |
| Modelo por defecto | Gemini `gemini-3.5-flash-lite` (con la clave real: índice en unos 11 s, capítulo en unos 10 s, libro de 5 capítulos en poco más de 1 minuto) |
| Decisiones registradas | D-01 a D-41 |
| Nivel de riesgo AI Act | Limitado (art. 50) |
| Código Ético de Venezuela | MINCYT, 19-02-2026, 9 principios, no vinculante |
| Colores | Mesa `#EEF0F3`, página `#FFFFFF`, texto `#1B1D23`, tinta `#0E7C74` |
| Tipografías de la app | Lexend (títulos), Onest (interfaz), Roboto (libro) |

---

## 15. Decisiones clave y su porqué (registro D-xx)

| Decisión | Qué | Por qué |
|---|---|---|
| D-01 | 5 a 7 **capítulos**, no páginas | Se deduce de RF-02 y RF-03 |
| D-02 | Interacción híbrida: caja de texto tipo Gemini + espacio de trabajo con pausas | Familiaridad del chat + control del proceso |
| D-04 | Next.js + React + TypeScript; Python + FastAPI + LangGraph | Python es el ecosistema más maduro para multiagentes; LangGraph trae pausas y persistencia |
| D-06 / D-34 | Capa LLM intercambiable; Gemini por defecto | Elegir por costo o calidad sin rehacer nada; plan gratuito de Google AI Studio |
| D-07 | Documentación → diseño → frontend con datos simulados → backend | Validar la experiencia antes de gastar en IA |
| D-09 | Capítulos 2 a N en secuencia | Coherencia (RNF-03) |
| D-10 | Si la persona edita el capítulo 1, su versión es el ancla | La guía refleja lo que realmente aprobó |
| D-11 | El aviso legal no se puede quitar | Lectura literal de RÉR-02 ("debe incluir automáticamente") |
| D-14 | SSE, no WebSockets | Flujo servidor → cliente; más simple |
| D-15 / D-37 | Portadas tipográficas con imagen propia; sin imágenes generadas con IA | Alcance y derechos |
| D-18 / D-19 | "Mesa en calma con alma de libro"; Lexend, Onest, Roboto; sin serif "elegantes" | Calma, legibilidad y que no parezca IA |
| D-21 | Libro abierto: izquierda decides, derecha tu libro | Una sola regla en todas las etapas |
| D-24 | La cinta marcapáginas solo marca "Tu turno" | Única señal que pide atención |
| D-33 | GitHub Pages con exportación estática | Gratis, permanente, se publica sola |
| D-35 | SQLite local (Supabase a futuro) | Simple para un prototipo |
| D-36 | PDF con Chromium headless | PDF etiquetado; WeasyPrint exige GTK en Windows |
| D-38 | Referencias sugeridas, verificadas y editables en APA 7 | Transparencia de fuentes (RÉR-01) y contra las alucinaciones |
| D-39 | Marca de IA legible por máquina | Art. 50.2 del AI Act |
| D-40 | Dos modos (demo y backend) con la misma fachada | Sitio público siempre disponible y backend real intercambiable |
| D-41 | Guardarraíl en dos pasos | Rechazar la ficción antes de gastar y volver a validar en el servidor |

---

## 16. Limitaciones honestas y siguientes pasos

1. **Medir la calidad del texto con el modelo real** (RNF-01, RNF-02, RNF-03, RA-02, RÉR-01, RÉR-03): tono con una rúbrica, tiempo por capítulo (percentil 95 < 60 s), coherencia, INFLESZ, originalidad y sesgos sobre libros escritos por Gemini. Requiere una clave de Gemini en `backend/.env`.
2. **Revisar el PDF con un lector de pantalla real** (NVDA).
3. **Publicar el backend** (P-08): hace falta un servidor con Python y Chromium; Supabase para cuentas y datos.
4. **Privacidad de los prompts** (P-12): usar un plan del proveedor que no entrene con los datos.
5. **Aviso explícito de uso de IA en la primera pantalla** (AI Act art. 50.1).
6. **Correo real** para recuperar la contraseña (hoy el enlace aparece en la consola del servidor).
7. Solo español por ahora (P-07), sin bloquear la internacionalización.

---

## 17. Proceso de desarrollo (por si preguntan cómo trabajaron)

| Fase | Qué se hizo | Fecha |
|---|---|---|
| 1. Análisis y documentación | Visión, análisis de requerimientos (con criterios de aceptación y trazabilidad), arquitectura, experiencia de usuario, brief de diseño y registro de decisiones | 28-09-2026 |
| 2. Diseño de la interfaz | Sistema visual, maquetas navegables de todas las pantallas (`docs/diseno/mesa-de-diseno.html`) | 28-09-2026 |
| 3. Frontend con datos simulados | Interfaz completa con los agentes simulados; publicada en GitHub Pages; pruebas de aceptación por requerimiento | 29-09-2026 |
| 4. Backend multiagente e integración | FastAPI + LangGraph, cuatro agentes, capa LLM, referencias, exportación, portada ampliada, revisiones de código y verificación | 20-10-2026 |

- **Metodología:** iterativa e incremental por fases, con documentación primero y verificación al final de cada fase.
- **Trazabilidad:** requerimiento → análisis (docs/02) → arquitectura (docs/03) → diseño (docs/07) → código → prueba (`requisitos.spec.ts`) → verificación con evidencias (docs/09).
- **Control de versiones:** Git y GitHub, commits con *Conventional Commits* en español (`feat:`, `fix:`, `docs:`).
- **Integración continua:** GitHub Actions publica el sitio y ejecuta las pruebas del backend.
- **Documentación del repositorio:** docs/01 (visión), 02 (requerimientos), 03 (arquitectura), 04 (experiencia de usuario), 05 (brief de diseño), 06 (decisiones), 07 (diseño de la interfaz), 08 (frontend), 09 (verificación de requerimientos), 10 (principios del diseño y escenario de IA), 11 (backend) y una guía de estudio en PDF con capturas señaladas.

---

## 18. Dónde está cada cosa (por si el jurado pide verlo)

| Qué | Dónde |
|---|---|
| Sitio publicado | https://franjmd0508.github.io/multiagente-inteligente-ebooks/ |
| Repositorio | https://github.com/FranJMD0508/multiagente-inteligente-ebooks |
| Requerimientos originales | `docs/requerimientos.txt` |
| Verificación requerimiento por requerimiento | `docs/09-verificacion-requerimientos.md` |
| Principios del diseño y escenario de IA | `docs/10-principios-diseno-y-escenario-ia.md` |
| Backend (grafo, prompts, pruebas) | `docs/11-backend.md` |
| Guía de estudio con capturas | `docs/guia/Folio-guia-de-requerimientos.pdf` |
| PDF de ejemplo generado por el servidor | `docs/verificacion/ebook-ejemplo-servidor.pdf` |
| Prompts de los agentes | `backend/app/prompts/<agente>/<tarea>.md` |
| Grafo de agentes | `backend/app/graph/` (`builder.py`, `nodes.py`) |
| Capa LLM | `backend/app/llm/` |
| Pruebas de aceptación | `frontend/e2e/requisitos.spec.ts` |
| Pruebas del backend | `backend/tests/` |
