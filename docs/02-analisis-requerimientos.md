# 02 · Análisis de requerimientos

> Aquí se interpreta cada requerimiento de [`requerimientos.txt`](./requerimientos.txt) y se traduce en **implicaciones concretas para la interfaz (UI)** y **para el backend**, junto con **criterios de aceptación** verificables.
> Al final aparecen los **requerimientos derivados** de las decisiones del equipo y una **matriz de trazabilidad**.

Convenciones:
- **UI** = lo que ve o hace el usuario en el frontend.
- **BE** = responsabilidad del backend o de los agentes.
- **CA** = criterio de aceptación.

---

## 1. Requerimientos funcionales

### RF-01 · Selección de nicho y temática cotidiana

**Qué pide:** permitir que se elija o se parametrice un nicho de crecimiento personal basado en situaciones reales, **descartando la ficción de forma explícita**.

**Interpretación:** la entrada del usuario tiene dos caminos: (a) un **prompt libre** ("Quiero un ebook sobre cómo ahorrar siendo estudiante") o (b) **nichos sugeridos** en forma de chips o tarjetas. En ambos casos el sistema **valida** que el tema sea de no ficción.

- **UI**
  - Pantalla de inicio con prompt central y chips de nichos sugeridos (inspiración Gemini).
  - Parámetros opcionales que se despliegan como "ajustes": público objetivo, número de capítulos (5, 6, 7 o "que decida el sistema") y título tentativo.
  - Si el tema es ficción, se muestra un **mensaje amable, no un error**, con sugerencias de cómo reformular la idea como guía práctica. Ejemplo: *"Aquí creamos guías prácticas sobre situaciones reales. ¿Qué tal 'Cómo escribir tu primera historia: hábitos de un escritor'?"*
- **BE**
  - Guardarraíl de clasificación a la entrada (tema válido / ficción / fuera de alcance), antes de lanzar el pipeline completo.
  - Catálogo de nichos sugeridos, servido por la API para poder actualizarlo sin tocar el frontend.
- **CA**
  - ✔ Se puede crear un ebook tanto con un prompt libre como eligiendo un nicho sugerido.
  - ✔ Un prompt de ficción ("escribe una novela de dragones") **no inicia** el pipeline y muestra alternativas.
  - ✔ Los parámetros opcionales tienen valores por defecto sensatos; el usuario puede enviar solo el prompt.

### RF-02 · Generación estratégica de temarios (5 a 7 capítulos)

**Qué pide:** el Agente Investigador propone una estructura con un **límite estricto** de 5 a 7 capítulos.

- **UI**
  - El índice propuesto aparece como una lista editable: título más resumen por capítulo.
  - **El rango se respeta en la propia interfaz**: con 5 capítulos, el botón "Eliminar capítulo" queda deshabilitado; con 7, se deshabilita "Agregar capítulo". Un tooltip explica por qué.
  - Se ve siempre un contador del tipo "6 de 5-7 capítulos".
- **BE**
  - Salida estructurada (esquema JSON) validada: si el LLM devuelve menos de 5 o más de 7 capítulos, se reintenta o se corrige antes de mostrar el resultado.
  - La API rechaza (422) cualquier edición que deje el índice fuera del rango.
- **CA**
  - ✔ Ningún índice mostrado, aprobado o exportado tiene menos de 5 ni más de 7 capítulos.
  - ✔ La UI impide llegar a un estado inválido y el backend lo vuelve a validar.

### RF-03 · Estructura estandarizada del capítulo

**Qué pide:** cada capítulo incluye obligatoriamente **Introducción, Desarrollo (tono conversacional y directo), Ejemplos cotidianos, Conclusión y Ejercicio práctico de cierre**.

- **UI**
  - La vista previa y el editor muestran las cinco secciones como **bloques con nombre fijo**.
  - En el editor, **no se puede eliminar** una sección obligatoria; solo se edita su contenido.
  - Mientras se genera un capítulo, un indicador marca en qué sección va el agente (Introducción ✓ → Desarrollo … → Ejemplos ○).
- **BE**
  - El Agente Redactor produce las cuatro primeras secciones y el Agente de Ejercicios produce la quinta.
  - Hay validación estructural: si falta una sección, se regenera esa sección.
  - En el Markdown final: `# Capítulo N: Título` (H1), `## Introducción`, `## Desarrollo`, etc. (H2) y subtemas en H3.
- **CA**
  - ✔ El 100 % de los capítulos exportados contiene las cinco secciones, en ese orden.
  - ✔ Las ediciones manuales conservan la estructura.

### RF-04 · Ejercicios prácticos rápidos

**Qué pide:** **solo** dinámicas de acción rápida: *checklists* de autoevaluación o retos de 24 a 48 horas.

- **UI**
  - El ejercicio se muestra con un formato propio: un checklist con casillas o una tarjeta de reto con duración (24 h / 48 h).
  - Al revisar el índice o el capítulo 1, el usuario puede indicar su preferencia (checklist, reto o que decida el sistema). *(Propuesta; ver 06-decisiones.)*
- **BE**
  - El Agente de Ejercicios tiene un esquema de salida cerrado: `{ tipo: "checklist" | "reto", titulo, duracion?: "24h" | "48h", items[] }`.
  - Cualquier otro tipo de dinámica (ensayos, proyectos largos, cuestionarios extensos) se rechaza.
- **CA**
  - ✔ Todos los ejercicios son del tipo `checklist` o `reto`, y los retos duran 24 h o 48 h.

### RF-05 · Puntos de validación humana (Human-in-the-Loop)

**Qué pide:** el sistema **se detiene** en dos momentos críticos y espera aprobación: (1) después de la propuesta de índice y (2) después de la redacción final del capítulo 1, para validar tono y formato.

Es el requerimiento **que más determina la experiencia de usuario**.

- **UI**
  - **Punto de control 1 (índice):**
    - Acciones: **Aprobar y continuar**, **editar** en línea (títulos y resúmenes), **reordenar** (arrastrar y soltar, con alternativa por teclado), **agregar o eliminar** capítulos dentro del rango, **regenerar todo** con indicaciones ("hazlo más práctico") y **regenerar un capítulo** concreto.
  - **Punto de control 2 (capítulo 1):**
    - Vista de lectura del capítulo completo.
    - Acciones: **Aprobar y generar el resto**, **pedir cambios** con texto libre o chips rápidos ("Más cercano", "Más ejemplos", "Más corto", "Menos formal") y **editar a mano**.
    - Mensaje clave: *"Este capítulo será la referencia de tono y formato para los demás."*
  - La pausa tiene que ser **evidente**: el pipeline se ve detenido y "esperando por ti", y en la biblioteca aparece la insignia **"Esperando tu aprobación"**.
  - El usuario puede **irse y volver después**: el ebook sigue pausado en el mismo punto.
- **BE**
  - Orquestación con interrupciones reales del flujo (`interrupt()` de LangGraph) y un **checkpointer persistente**, de modo que la pausa sobreviva a cierres de pestaña o reinicios del servidor.
  - Endpoints para aprobar o regenerar en cada punto de control.
  - Después de aprobar el capítulo 1 se extrae la **guía de estilo** (ver RNF-03).
- **CA**
  - ✔ El pipeline **nunca** pasa a redactar sin un índice aprobado, ni genera los capítulos 2 a N sin el capítulo 1 aprobado.
  - ✔ Al cerrar el navegador durante una pausa y volver, el estado se recupera intacto.
  - ✔ Las regeneraciones conservan un historial mínimo (se puede volver a la versión anterior). *(Propuesta.)*

### RF-06 · Exportación multiformato (.md y PDF)

**Qué pide:** entregar un Markdown con sintaxis limpia (encabezados, listas, citas) y permitir la **compilación directa a PDF** estructurado y listo para maquetar o vender.

- **UI**
  - Diálogo de exportación con los formatos **Markdown (.md)** y **PDF**, nombre de archivo editable y resumen del contenido (capítulos, páginas estimadas, aviso legal incluido o no).
  - **Vista previa paginada** del PDF antes de descargar.
  - El ebook exportado queda disponible en la biblioteca para volver a descargarlo.
- **BE**
  - El Agente Maquetador/Exportador ensambla el `.md` (portada → aviso → índice → capítulos).
  - Conversión MD → HTML → PDF con una plantilla que cumple RA-01 y RA-03 (motor por definir; ver 03-arquitectura).
  - Almacenamiento de los archivos generados, con URL de descarga.
- **CA**
  - ✔ El `.md` exportado pasa un *linter* de Markdown sin errores de jerarquía.
  - ✔ El PDF tiene marcadores o esquema navegable por capítulo y etiquetas de encabezados.

---

## 2. Requerimientos no funcionales

### RNF-01 · Tono y estilo de redacción

**Qué pide:** tono conversacional, empático y directo, con profundidad intermedia: ni académico ni superficial.

- **UI:** los chips de "pedir cambios" en el punto de control 2 sirven para ajustar el tono sin necesidad de saber escribir prompts. El microcopy de la propia app usa el mismo tono (tuteo, cercano).
- **BE:** configuración de generación (temperatura y parámetros) y un prompt del Redactor con reglas de estilo explícitas y ejemplos positivos y negativos.
- **CA:** ✔ Revisión con una rúbrica de tono (conversacional, empático, directo, profundidad intermedia) sobre una muestra de capítulos.

### RNF-02 · Desempeño y tiempos de respuesta

**Qué pide:** menos de 60 segundos por capítulo, para mantener fluido el trabajo durante las pausas.

- **UI**
  - **Streaming**: el texto aparece a medida que se genera; nada de una pantalla en blanco con un spinner.
  - Se muestra el avance por capítulo y por sección, junto con una estimación de tiempo restante.
  - El usuario puede **leer los capítulos terminados** mientras se generan los siguientes.
- **BE**
  - Streaming de tokens y eventos por SSE.
  - Tiempo límite por capítulo con reintento automático.
  - Longitud de salida acotada: unas 800 a 1.200 palabras equivalen a ~1.600 tokens, lo que da entre 15 y 40 s con proveedores típicos.
- **CA:** ✔ El percentil 95 del tiempo de generación por capítulo es menor de 60 s en un entorno de referencia.

### RNF-03 · Consistencia y cohesión textual

**Qué pide:** coherencia terminológica y de estilo en los 5 a 7 capítulos, sin repeticiones ni contradicciones.

- **UI:** *(opcional, para dar transparencia)* un panel "Guía de estilo" con el tono y el glosario que se extrajeron del capítulo 1.
- **BE**
  - **Guía de estilo** extraída del capítulo ancla: persona gramatical, registro, glosario, formato de los ejemplos y de los ejercicios.
  - A cada capítulo nuevo se le pasa: la guía de estilo, el índice completo y **resúmenes de los capítulos anteriores**, para evitar repetir ejemplos o ideas.
  - Por eso los capítulos se generan en secuencia (ver 06-decisiones).
- **CA:** ✔ No se repiten ejemplos entre capítulos; los términos clave se usan de forma uniforme.

### RNF-04 · Modularidad de la arquitectura multiagente

**Qué pide:** un backend modular con cuatro agentes (Investigador, Redactor, Ejercicios, Maquetador/Exportador) cuyos prompts se puedan sustituir o ajustar con facilidad.

- **UI:** el pipeline visible representa **exactamente** a esos cuatro agentes, con nombre, estado y actividad actual.
- **BE:** un módulo por agente; los prompts viven en archivos independientes y versionados (no incrustados en el código); el proveedor de LLM se inyecta.
- **CA:** ✔ Cambiar el prompt de un agente implica editar un solo archivo y no requiere tocar el orquestador.

---

## 3. Requerimientos de accesibilidad

> Los RA hablan del **producto generado** (MD/PDF). Como requerimiento derivado (RD-06), la **aplicación** también debe ser accesible.

### RA-01 · Formato legible en Markdown/PDF

- **UI:** la vista previa muestra la jerarquía real del documento. El editor permite títulos y subtítulos (H2/H3) pero no permite "saltar" niveles.
- **BE:** en el MD, un solo H1 por capítulo, H2 para las secciones y H3 para los subtemas. En el PDF, un **PDF etiquetado** (*tagged PDF*) con estructura de encabezados, marcadores y orden de lectura correcto.
- **CA:** ✔ Un lector de pantalla (NVDA o VoiceOver) navega el PDF por encabezados.

### RA-02 · Lenguaje claro y comprensible

- **BE:** reglas en los prompts sobre oraciones cortas, vocabulario cotidiano y explicación de cualquier término técnico. *(Opcional: medir la lecturabilidad con el índice Fernández-Huerta o INFLESZ.)*
- **UI:** *(opcional)* indicador de lecturabilidad en la revisión del capítulo 1.
- **CA:** ✔ El índice de lecturabilidad cae en el rango "bastante fácil / normal" en una muestra de capítulos.

### RA-03 · Contraste y tipografía limpia en la salida PDF

**Qué pide:** fondo neutro (preferiblemente blanco), texto de alto contraste (negro o gris oscuro), fuentes legibles (Arial, Helvetica o Roboto) y **cuerpo de 11 pt como mínimo**.

- **UI**
  - El panel "Portada y estilo" **solo ofrece opciones que cumplen**: fondo del cuerpo blanco fijo, color de texto fijo, familias tipográficas permitidas y un selector de tamaño que empieza en 11 pt.
  - Si el usuario elige un color de acento, se **valida su contraste** (≥ 4,5:1 sobre blanco) antes de aplicarlo; si no cumple, se sugiere el tono accesible más cercano.
  - La portada sí admite más libertad de color, pero el texto de la portada también debe superar el contraste mínimo.
- **BE:** una plantilla PDF con estas restricciones fijadas; los valores del usuario se validan en el servidor.
- **CA:** ✔ Ningún PDF exportado tiene cuerpo de texto menor de 11 pt ni contraste de texto menor de 4,5:1.

---

## 4. Requerimientos éticos y de responsabilidad

### RÉR-01 · Originalidad y prevención de plagio

- **BE:** instrucciones explícitas en los prompts del Investigador y del Redactor para **sintetizar, no copiar**. Si el Investigador consulta fuentes externas, trabaja con resúmenes y nunca con texto literal. *(Opcional: una verificación de similitud antes de exportar.)*
- **UI:** una nota discreta de transparencia en la exportación: "Contenido original generado con asistencia de IA".
- **CA:** ✔ Ningún párrafo reproduce literalmente fuentes protegidas (verificación por muestreo).

### RÉR-02 · Descargo de responsabilidad en temas sensibles

**Qué pide:** todo ebook de finanzas personales, gestión de emociones o autoayuda incluye **automáticamente** un aviso legal visible.

- **UI**
  - Cuando se detecta un tema sensible, aparece desde el índice la indicación **"Este ebook incluirá un aviso legal"**, con opción de ver el texto.
  - El aviso **no se puede eliminar** en temas sensibles, ni desde el editor ni desde la configuración del PDF.
- **BE**
  - Clasificación del tema en la etapa de investigación: `financiero | salud_emocional | salud_fisica | autoayuda_general | ninguno`.
  - Textos de aviso predefinidos por categoría, que el Maquetador inserta después de la portada.
- **CA:** ✔ El 100 % de los ebooks de temas sensibles exportados contiene el aviso, en una página visible y antes del primer capítulo.

### RÉR-03 · Mitigación de sesgos y estereotipos

- **BE:** reglas de diversidad en los prompts del Redactor y del Agente de Ejercicios (nombres, géneros, contextos socioeconómicos variados y sin roles estereotipados); prohibición de soluciones poco éticas a problemas económicos o sociales. *(Opcional: una pasada de revisión automática antes de mostrar cada capítulo.)*
- **UI:** no requiere elementos específicos. Los ejemplos de la propia interfaz (placeholders, nichos, textos de demo) también deben cumplir esta regla.
- **CA:** ✔ Revisión por muestreo sin estereotipos de género ni discriminación.

---

## 5. Requerimientos derivados (decisiones del equipo)

Surgen de las decisiones del 2026-09-28 (ver [06-decisiones](./06-decisiones.md)). Se numeran **RD** para no mezclarlos con los requerimientos originales.

| ID | Requerimiento | Descripción |
|---|---|---|
| **RD-01** | Autenticación | Registro, inicio de sesión y cierre de sesión. Cada usuario ve solo sus ebooks. |
| **RD-02** | Biblioteca / historial | Barra lateral y vista de biblioteca con los ebooks del usuario, su estado (en progreso, esperando aprobación, listo), búsqueda y filtros, y acciones para abrir, renombrar, descargar y eliminar. |
| **RD-03** | Editor previo a la exportación | Edición manual del contenido de cualquier capítulo, respetando la estructura fija (RF-03) y la jerarquía (RA-01). |
| **RD-04** | Portada y estilo del PDF | Título, subtítulo, autor, plantilla de portada, color de acento y tamaño de página, siempre dentro de las restricciones de RA-03. |
| **RD-05** | Pipeline visible en tiempo real | El usuario ve qué agente trabaja, en qué paso va y el texto en streaming (apoya RNF-02 y RF-05). |
| **RD-06** | Accesibilidad de la aplicación | La interfaz web cumple **WCAG 2.2 AA**: teclado, foco visible, contraste, lector de pantalla y `prefers-reduced-motion`. |
| **RD-07** | Reanudación | Cualquier ebook interrumpido (pausa o error) se retoma desde la biblioteca en el punto donde quedó. |
| **RD-08** | Diseño responsive | Funciona en escritorio (prioridad), tablet y móvil. En móvil los paneles se convierten en pestañas. |

---

## 6. Ambigüedades detectadas y cómo se resolvieron

| # | Ambigüedad | Resolución |
|---|---|---|
| 1 | ¿"5 a 7 páginas" o "5 a 7 capítulos"? | **5 a 7 capítulos**, unas 15 a 30 páginas en total. *(Decisión del equipo.)* |
| 2 | ¿Quién es el usuario: vendedor o uso personal? | **Ambos.** La interfaz no da por hecho un fin comercial. |
| 3 | ¿El usuario puede editar a mano o solo aprobar y regenerar? | **Puede editar**, en los puntos de control y en el editor final (RD-03). |
| 4 | ¿El Investigador consulta fuentes externas (web)? | **Pendiente.** Afecta a RÉR-01 y a los costos. Ver 06-decisiones. |
| 5 | ¿El usuario puede quitar el aviso legal? | **No** en temas sensibles. *(Propuesta pendiente de validar.)* |
| 6 | ¿Qué pasa si el usuario edita el capítulo 1 en el punto de control 2? | La versión editada pasa a ser el capítulo ancla y la guía de estilo se extrae de ella. |
| 7 | ¿Los capítulos 2 a N se generan en paralelo o en secuencia? | **En secuencia** (mejor coherencia, RNF-03), con streaming y lectura progresiva para que la espera se sienta corta. |
| 8 | ¿El ebook lleva una conclusión general o un cierre final? | **Pendiente.** Los requerimientos no lo piden; se podría proponer como opcional. |

---

## 7. Matriz de trazabilidad

| Requerimiento | Pantalla / componente UI | Módulo backend |
|---|---|---|
| RF-01 | Inicio (prompt + chips de nichos), mensaje de redirección de ficción | Guardarraíl de entrada, catálogo de nichos |
| RF-02 | Punto de control 1 (índice editable, contador 5-7) | Agente Investigador, validación de esquema |
| RF-03 | Vista previa por secciones, editor con bloques fijos | Agente Redactor, validador estructural |
| RF-04 | Bloque de ejercicio (checklist / reto) | Agente de Ejercicios |
| RF-05 | Punto de control 1, punto de control 2, insignia "Esperando tu aprobación" | Orquestador LangGraph (`interrupt`, checkpointer) |
| RF-06 | Diálogo de exportación, vista previa paginada | Agente Maquetador/Exportador, motor PDF, almacenamiento |
| RNF-01 | Chips de ajuste de tono, microcopy | Prompt del Redactor, configuración del LLM |
| RNF-02 | Streaming, progreso por capítulo, lectura progresiva | SSE, tiempos límite, reintentos |
| RNF-03 | Panel "Guía de estilo" (opcional) | Guía de estilo, resúmenes acumulados |
| RNF-04 | Pipeline con los cuatro agentes | Módulos por agente, prompts en archivos |
| RA-01 | Vista previa con jerarquía, editor sin saltos de nivel | Plantilla MD, PDF etiquetado |
| RA-02 | Indicador de lecturabilidad (opcional) | Reglas de prompt, métrica de lecturabilidad |
| RA-03 | Panel "Portada y estilo" con opciones restringidas y validación de contraste | Plantilla PDF, validación en el servidor |
| RÉR-01 | Nota de transparencia en la exportación | Prompts antiplagio, verificación de similitud (opcional) |
| RÉR-02 | Indicador "Incluirá aviso legal", aviso no removible | Clasificador de sensibilidad, textos de aviso |
| RÉR-03 | Ejemplos de la UI sin estereotipos | Reglas de diversidad en prompts, revisión (opcional) |
| RD-01 | Login, registro | Autenticación |
| RD-02 | Barra lateral, biblioteca | API de ebooks (listado, filtros) |
| RD-03 | Editor | API de capítulos (PATCH) |
| RD-04 | Panel "Portada y estilo" | API de diseño, plantilla PDF |
| RD-05 | Panel de pipeline | Eventos SSE |
| RD-06 | Toda la app | — |
| RD-07 | Biblioteca → reanudar | Checkpointer persistente |
| RD-08 | Toda la app | — |
