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
| D-13 | 2026-09-28 | Autenticación, base de datos y almacenamiento con **Supabase** | Propuesta | Cubre Auth + Postgres (que también sirve para el checkpointer de LangGraph) + Storage en un solo servicio con plan gratuito. |
| D-14 | 2026-09-28 | Comunicación en tiempo real con **SSE** (no WebSockets) | Propuesta | El flujo es principalmente servidor → cliente; SSE es más simple y se reconecta de forma nativa. |
| D-15 | 2026-09-28 | Portadas **tipográficas por plantilla**, con subida opcional de imagen; sin imágenes generadas por IA en el MVP | Propuesta | Mantiene el alcance acotado y evita problemas de derechos o calidad. |
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
| D-32 | 2026-09-29 | **Autenticación simulada** y datos por usuario en `localStorage`, con una biblioteca de ejemplo en el primer acceso | Decidida (temporal) | Permite probar todos los estados sin backend; se reemplaza por el proveedor real en la fase 4. |

## Preguntas abiertas

| # | Pregunta | Afecta a | Notas |
|---|---|---|---|
| P-01 | ¿El Agente Investigador consulta la web (búsqueda) o trabaja solo con el conocimiento del LLM? | RÉR-01, costos, tiempos | Consultar la web mejora la actualidad pero complica la originalidad y la latencia. |
| P-02 | ¿Qué proveedor de LLM se usará? | Backend, costos, RNF-02 | Candidatos: Gemini, Claude y OpenAI. Conviene decidirlo con una prueba comparativa de tono (RNF-01). |
| P-03 | ¿Qué motor PDF: WeasyPrint o Chromium headless? | RF-06, RA-01 | Hace falta una prueba de concepto de PDF etiquetado con NVDA. |
| P-04 | ¿Tamaño de página por defecto: A5, A4, Carta o 6×9"? | RD-04, extensión objetivo | Propuesta: A5 por defecto y el resto opcional. |
| P-05 | ¿El ebook lleva una conclusión general o un cierre final además de los capítulos? | RF-03, maquetación | Los requerimientos no lo piden. |
| P-06 | ¿Hay un límite de regeneraciones por punto de control? | Costos, UX | Por ahora sin límite, con posibilidad de fijarlo más adelante. |
| P-07 | ¿Solo en español o se prevén otros idiomas? | UI (i18n), prompts | Por ahora solo español; conviene no bloquear la i18n. |
| P-08 | ¿Dónde se despliega? (Vercel + Render/Railway/Fly, u otro) | Infraestructura | Se decide en la fase 4. |
| ~~P-09~~ | ~~¿Nombre del producto?~~ | — | **Resuelta en D-17: Folio.** |
| P-10 | ¿Entregables académicos concretos (SRS, UML, fechas de entrega)? | Documentación | Si el curso pide formatos específicos, se adapta esta documentación. |
