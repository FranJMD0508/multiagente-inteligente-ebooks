# 06 · Registro de decisiones y preguntas abiertas

> Toda decisión relevante de producto, UX o arquitectura se registra aquí con su fecha y su motivo.
> Estados: **Decidida** · **Propuesta** (recomendada, falta validarla) · **Pendiente** (sin decidir).

## Decisiones

| # | Fecha | Decisión | Estado | Motivo / notas |
|---|---|---|---|---|
| D-01 | 2026-09-28 | Los ebooks tienen **5 a 7 capítulos** (unas 15 a 30 páginas); no 5 a 7 páginas | Decidida | Se deduce de RF-02 y RF-03: cada capítulo tiene cinco secciones obligatorias. |
| D-02 | 2026-09-28 | Modelo de interacción **híbrido**: prompt de entrada estilo Gemini + espacio de trabajo estructurado con pipeline y puntos de control | Decidida | Une la familiaridad del chat con el control que exige RF-05. |
| D-03 | 2026-09-28 | Alcance del MVP: incluye **biblioteca, cuentas de usuario, editor previo a la exportación y personalización de portada y estilo** | Decidida | Ver RD-01 a RD-04 en 02-analisis-requerimientos. |
| D-04 | 2026-09-28 | Stack: **Next.js + React + TypeScript + Tailwind + shadcn/ui** (frontend) y **Python + FastAPI + LangGraph** (backend) | Decidida | Python es el ecosistema más maduro para multiagentes y LangGraph trae HITL nativo (`interrupt`). |
| D-05 | 2026-09-28 | El usuario objetivo son **ambos perfiles** (creadores que venden y uso personal o educativo) | Decidida | La UI no da por hecho un fin comercial. |
| D-06 | 2026-09-28 | Proveedor de LLM **por definir**; los agentes consumen una capa de abstracción | Decidida | Así se puede elegir más adelante por costo o calidad sin rehacer nada. |
| D-07 | 2026-09-28 | Orden de trabajo: **documentación → diseño → frontend con mocks → backend** | Decidida | El frontend se valida primero, con datos simulados que cumplen el contrato de la API. |
| D-08 | 2026-09-28 | Las skills de diseño y frontend se instalan **en el proyecto** (`.claude/skills/`, versionadas) | Decidida | Todo el equipo tiene las mismas skills al clonar el repo. Ver `docs/skills.md`. |
| D-09 | 2026-09-28 | Los capítulos 2 a N se generan **en secuencia** | Propuesta | Favorece la coherencia (RNF-03). La espera se compensa con streaming y lectura progresiva. |
| D-10 | 2026-09-28 | Si el usuario edita el capítulo 1 en el punto de control 2, **su versión pasa a ser el ancla** | Propuesta | La guía de estilo refleja lo que el usuario realmente aprobó. |
| D-11 | 2026-09-28 | El **aviso legal no se puede quitar** en temas sensibles | Propuesta | Interpretación literal de RÉR-02 ("debe incluir automáticamente"). |
| D-12 | 2026-09-28 | El editor final tiene **secciones fijas** y solo permite H3 como encabezado manual | Propuesta | Protege RF-03 y RA-01. |
| D-13 | 2026-09-28 | Autenticación, base de datos y almacenamiento con **Supabase** | Reemplazada por D-35 | Cubre Auth + Postgres (que también sirve para el checkpointer de LangGraph) + Storage en un solo servicio con plan gratuito. |
| D-14 | 2026-09-28 | Comunicación en tiempo real con **SSE** (no WebSockets) | Propuesta | El flujo es principalmente servidor → cliente; SSE es más simple y se reconecta de forma nativa. |
| D-15 | 2026-09-28 | Portadas **tipográficas por plantilla**, con subida opcional de imagen; sin imágenes generadas por IA en el MVP | Decidida (ampliada en D-37) | Mantiene el alcance acotado y evita problemas de derechos o calidad. |
| D-16 | 2026-09-28 | Tema **claro y oscuro** desde el inicio | Propuesta | Inspiración Gemini y accesibilidad. |
| D-17 | 2026-09-28 | El producto se llama **Folio** | Decidida | Nombre editorial, corto y fácil de recordar (una hoja de libro). Resuelve P-09. |
| D-18 | 2026-09-28 | Dirección visual **“Mesa en calma” con alma de libro**: limpia, moderna y redondeada; el libro se expresa en objetos (página, cinta, portadas) | Decidida | Se descartaron “Cuaderno” y “Lomo” (demasiado cuadrado y tosco). Ver 07 §1. |
| D-19 | 2026-09-28 | Tipografía: **Lexend** (títulos), **Onest** (interfaz), **Roboto** (cuerpo del ebook) | Decidida | Se descartó Literata: las serif “elegantes” cansan. Lexend se diseñó para reducir el cansancio visual. |
| D-20 | 2026-09-28 | Pantalla de inicio en variante **Página** | Decidida | Es la más limpia y fiel a Gemini; la caja de texto sigue como protagonista. |
| D-21 | 2026-09-28 | Espacio de trabajo **Libro abierto**: izquierda decides, derecha tu libro | Decidida | Una sola regla para todas las etapas. Se descartaron “Tres columnas” y “Enfoque”. |
| D-22 | 2026-09-28 | Punto de control 2 con **ajustes rápidos** (chips + campo libre) y **editar a mano** | Decidida (recomendación aceptada) | Rápido y sin exigir que el usuario sepa escribir instrucciones. Los comentarios sobre el texto quedan como posible mejora futura. |
| D-23 | 2026-09-28 | El proceso se muestra **por fases**, con el agente responsable y **“Tú”** en las pausas | Decidida (recomendación aceptada) | Refleja el flujo real (los capítulos 2 a N repiten Redactor + Ejercicios) y explica las pausas HITL. |
| D-24 | 2026-09-28 | La **cinta marcapáginas** solo marca “Tu turno” | Decidida | Es la única señal visual que pide atención. |
| D-25 | 2026-09-28 | Cada ebook tiene un **color de tela** (portada) según su nicho, editable | Decidida | Da identidad en la biblioteca, la barra lateral y el PDF. |
| D-26 | 2026-09-28 | La revisión final vive en `/ebook/[id]` con pestañas **Texto** y **Portada y estilo**; **Exportar** va en la cabecera | Decidida (recomendación aceptada) | Mantiene la regla del libro abierto. Reemplaza la ruta `/ebook/[id]/editar` del documento 04. |
| D-27 | 2026-09-28 | La **hoja del libro** en la vista previa es siempre blanca, también en tema oscuro | Decidida (recomendación aceptada) | Representa el PDF real (RA-03). |
| D-28 | 2026-09-28 | En móvil, el libro abierto pasa a las pestañas **Decidir** y **Tu libro**, con la acción principal fija abajo | Decidida (recomendación aceptada) | Uso cómodo con una mano. |
| D-29 | 2026-09-29 | Frontend con **Next.js 16 + React 19 + Tailwind 4**, Radix UI (accesibilidad), Motion (animación) y dnd-kit (reordenar con teclado) | Decidida | Componentes accesibles sin el aspecto por defecto de shadcn; dnd-kit ofrece reordenar por teclado con anuncios. |
| D-30 | 2026-09-29 | Capa de datos con una **fachada `api` y una caché del cliente**; en la fase 3 la alimenta un simulador en el navegador | Decidida | La fase 4 solo cambia la fachada (REST + SSE) y los componentes no se tocan. |
| D-31 | 2026-09-29 | En la fase con mocks, el **PDF se genera con la vista de impresión del navegador** y el Markdown se descarga directamente | Decidida (temporal) | Chrome y Edge generan PDF etiquetado (RA-01). En la fase 4 lo hará el Agente Maquetador. |
| D-33 | 2026-09-29 | Publicar el frontend en **GitHub Pages** con exportación estática y rutas por parámetro (`/ebook?id=`) | Decidida | Gratis, permanente, se publica sola desde `main` y no requiere cuentas extra. Se puede migrar a Vercel cuando haya backend. |
| D-32 | 2026-09-29 | **Autenticación simulada** y datos por usuario en `localStorage`, con una biblioteca de ejemplo en el primer acceso | Decidida (solo en el modo demo) | Permite probar todos los estados sin backend. Con backend, las cuentas son reales (D-35). |
| D-34 | 2026-10-20 | Proveedor de LLM por defecto: **Gemini** (`gemini-3.5-flash-lite` desde el 2026-10-27; antes `gemini-3.8-flash`, que tardaba unos 80 s por capítulo y no cumplía RNF-02), API REST, detrás de una capa intercambiable con **Claude**, **OpenAI** y un proveedor **demo** sin conexión | Decidida | El equipo tiene acceso al plan gratuito de Google AI Studio. La capa permite cambiar con `LLM_PROVIDER` sin tocar a los agentes. Resuelve P-02. |
| D-35 | 2026-10-20 | Datos en **SQLite local**: ebooks, cuentas y archivos en `backend/data/folio.sqlite`, y el checkpointer de LangGraph en `checkpoints.sqlite`. Cuentas propias con contraseña (scrypt) y token JWT | Decidida | Cero configuración para ejecutar y evaluar el proyecto. Supabase (D-13) queda como migración futura si se despliega. |
| D-36 | 2026-10-20 | Motor PDF: **Chromium headless** (Playwright; Edge en Windows) con PDF etiquetado y marcadores, y metadatos añadidos con pypdf | Decidida | Mismo motor que ya validaba RA-01 en las pruebas del frontend; WeasyPrint exige GTK en Windows. Resuelve P-03. |
| D-37 | 2026-10-20 | Edición de portada ampliada: **imagen propia** (de fondo con velo de tela o en recuadro), cinco plantillas (Clásica, Centrada, Franja, Marco y Editorial), **letra, tamaño y alineación del título** y **contraportada** con sinopsis que propone el Maquetador | Decidida | Lo pidió el equipo el 2026-10-20. El velo mínimo se calcula a partir de la imagen para que el título blanco mantenga 4,5:1 o más, y el control no deja bajar de ahí (RA-03, WCAG). La imagen debe ser propia o con permiso. |
| D-38 | 2026-10-20 | **Ayuda con las referencias**: el Investigador sugiere lecturas reales, Folio las verifica en **Crossref** y **Open Library**, el usuario busca por DOI, ISBN o título, agrega y corrige, y se exportan en **APA 7** (en español) al final del libro | Decidida | Lo pidió el equipo el 2026-10-20. Los LLM pueden inventar referencias: la verificación marca las que no aparecen y la exportación lo advierte. No se insertan citas automáticas en el texto para no atribuir ideas que la fuente no dice; el usuario copia la cita "(Autor, año)" donde corresponda. Aclara P-01: el Investigador no copia texto de la web; solo consulta bases bibliográficas para verificar. |
| D-39 | 2026-10-20 | Marca de contenido generado con IA legible por máquina: comentario `<!-- folio: generado-con-ia=true; … -->` al final del `.md` y metadatos del PDF (Keywords y Creator) | Decidida | Cumple el espíritu del art. 50.2 del AI Act sin romper la jerarquía de encabezados (el `.md` sigue empezando por `# Título`). Resuelve P-11. |
| D-40 | 2026-10-20 | Dos modos de datos con la misma fachada `api`: **demo** (`NEXT_PUBLIC_API_MODE=mock`, agentes simulados en el navegador; es lo que se publica en GitHub Pages) y **backend** (`http`, FastAPI + LangGraph). Las ediciones son optimistas y el avance llega por **un solo stream SSE por usuario** (`/api/events`), además del stream por ebook del contrato | Decidida | Un stream por ebook agotaría las 6 conexiones por origen del navegador con varios libros en curso. |
| D-41 | 2026-10-20 | Guardarraíl en dos pasos: el inicio consulta `POST /api/topics/check` (patrones de ficción + clasificación del LLM) antes de crear el ebook, y el grafo lo vuelve a validar | Decidida | El usuario recibe las alternativas en el mismo inicio, como en el diseño, y el backend no confía solo en el cliente (RF-01). |

## Preguntas abiertas

| # | Pregunta | Afecta a | Notas |
|---|---|---|---|
| P-01 | ¿El Agente Investigador consulta la web (búsqueda) o trabaja solo con el conocimiento del LLM? | RÉR-01, costos, tiempos | **Aclarada en D-38:** redacta con el conocimiento del LLM y solo consulta Crossref y Open Library para verificar referencias. La búsqueda web general sigue fuera del alcance. |
| ~~P-02~~ | ~~¿Qué proveedor de LLM se usará?~~ | — | **Resuelta en D-34: Gemini por defecto, intercambiable.** |
| ~~P-03~~ | ~~¿Qué motor PDF: WeasyPrint o Chromium headless?~~ | — | **Resuelta en D-36: Chromium headless.** Queda pendiente la revisión con NVDA. |
| P-04 | ¿Tamaño de página por defecto: A5, A4, Carta o 6×9"? | RD-04, extensión objetivo | Propuesta: A5 por defecto y el resto opcional. |
| P-05 | ¿El ebook lleva una conclusión general o un cierre final además de los capítulos? | RF-03, maquetación | Los requerimientos no lo piden. |
| P-06 | ¿Hay un límite de regeneraciones por punto de control? | Costos, UX | Por ahora sin límite, con posibilidad de fijarlo más adelante. |
| P-07 | ¿Solo en español o se prevén otros idiomas? | UI (i18n), prompts | Por ahora solo español; conviene no bloquear la i18n. |
| P-08 | ¿Dónde se despliega? (Vercel + Render/Railway/Fly, u otro) | Infraestructura | Por ahora el backend se ejecuta en local (D-35) y GitHub Pages publica el modo demo. Para publicarlo con backend hace falta un servidor con Python y Chromium. |
| ~~P-09~~ | ~~¿Nombre del producto?~~ | — | **Resuelta en D-17: Folio.** |
| P-10 | ¿Entregables académicos concretos (SRS, UML, fechas de entrega)? | Documentación | Si el curso pide formatos específicos, se adapta esta documentación. |
| ~~P-11~~ | ~~¿Cómo se marca el `.md` y el PDF como generados por IA en un formato legible por máquina?~~ | — | **Resuelta en D-39.** Ver [10 §2.3](./10-principios-diseno-y-escenario-ia.md). |
| P-12 | ¿Qué garantías de privacidad da el proveedor de LLM sobre los prompts (no entrenar con ellos, tiempo de retención)? | P-02, privacidad | Los prompts pueden traer datos sensibles (emociones, dinero). Lo pide el principio 5 del Código de Ética de IA de Venezuela. Ver [10 §2.5](./10-principios-diseno-y-escenario-ia.md). |
