# CLAUDE.md

Guía para Claude Code (y cualquier agente de IA) que trabaje en este repositorio.

## Qué es

**Folio** es una aplicación web en la que **cuatro agentes de IA** (Investigador, Redactor, Ejercicios y Maquetador/Exportador) redactan y maquetan **ebooks cortos de crecimiento personal**: de 5 a 7 capítulos, unas 15 a 30 páginas, siempre sobre situaciones reales y nunca ficción. El usuario aprueba en **dos puntos de control** (el índice y el capítulo 1), puede editar el texto, diseñar la portada (imagen propia, plantillas, título) y la contraportada, revisar las **referencias** que sugiere el Investigador (verificadas en Crossref y Open Library, en APA 7) y al final exporta en **Markdown y PDF**.

Es un proyecto universitario de Ingeniería de Software (UJAP). Repositorio: https://github.com/FranJMD0508/multiagente-inteligente-ebooks

## Fase actual

| Fase | Estado |
|---|---|
| 1. Análisis y documentación | Completada: ver `docs/` |
| 2. Diseño de la interfaz | Completada: `docs/07-diseno-interfaz.md` |
| 3. Frontend con datos simulados (mocks) | Completada: `frontend/` y `docs/08-frontend.md` |
| 4. Backend multiagente e integración | Completada (2026-10-20): `backend/` y `docs/11-backend.md`, más edición de portada (D-37) y referencias (D-38) |

**Dos modos con la misma fachada** (`frontend/src/lib/api/index.ts`, interfaz `FolioApi` en `contract.ts`): `NEXT_PUBLIC_API_MODE=mock` (por defecto; agentes simulados en el navegador, es lo que se publica en GitHub Pages) y `http` (backend FastAPI + LangGraph, con `NEXT_PUBLIC_API_URL`). Los componentes solo usan `api` y los hooks `useEbook` / `useEbookList`; **cualquier función nueva se implementa en los dos modos** (`mock/api.ts` y `http/api.ts`) y las transformaciones compartidas van en `lib/api/local.ts`. El JSON del ebook es el tipo `Ebook` de `frontend/src/lib/types.ts`, replicado en `backend/app/models.py`: si cambias uno, cambia el otro.

## Documentación (leer antes de trabajar)

| Documento | Contenido |
|---|---|
| `docs/requerimientos.txt` | **Fuente de verdad**: RF, RNF, RA y RÉR originales. No se modifica. |
| `docs/01-vision-producto.md` | Problema, usuarios, anatomía del ebook, alcance y glosario |
| `docs/02-analisis-requerimientos.md` | Cada requerimiento traducido a UI, backend y criterios de aceptación; requerimientos derivados (RD); trazabilidad |
| `docs/03-arquitectura.md` | Componentes, grafo de agentes, estados, modelo de datos, API, eventos SSE, tipos TS y estrategia de mocks |
| `docs/04-experiencia-usuario.md` | Pantallas, flujos, puntos de control, estados, responsive, accesibilidad y microcopy |
| `docs/05-brief-diseno.md` | Inspiración (Gemini), definición de "que no parezca IA", restricciones y proceso de diseño |
| `docs/06-decisiones.md` | Decisiones (D-xx) y preguntas abiertas (P-xx) |
| `docs/07-diseno-interfaz.md` | **Diseño de la interfaz**: sistema visual, pantallas, estados, movimiento y responsive. Manda sobre 04 y 05 si hay diferencias. |
| `docs/diseno/mesa-de-diseno.html` | Maquetas de todas las pantallas (abrir en el navegador) |
| `docs/09-verificacion-requerimientos.md` | Verificación requerimiento por requerimiento, con evidencias en `docs/verificacion/` |
| `docs/guia/Folio-guia-de-requerimientos.pdf` | Guía de estudio con la marca de Folio: dónde ver cada requerimiento paso a paso, con capturas señaladas (se genera con `npm run guia:capturas` y `npm run guia:pdf`) |
| `docs/08-frontend.md` | Implementación del frontend: qué incluye, capa de datos (modo demo y con backend) y limitaciones |
| `docs/11-backend.md` | Backend: grafo de agentes, prompts, referencias, exportación, pruebas y limitaciones |
| `docs/10-principios-diseno-y-escenario-ia.md` | Principios del diseño (software, interfaz y visual) aplicados a Folio, y su escenario de IA: tipo de IA, nivel de riesgo del AI Act y marcos éticos (para la clase) |
| `docs/12-contexto-exposicion.md` | Contexto completo para estudiar con Claude y preparar la exposición ante el jurado: rúbrica, modelo de calidad, guion de la demo y banco de preguntas |
| `docs/skills.md` | Skills del proyecto y cuándo usar cada una |

## Reglas de negocio innegociables

1. **Solo no ficción** de crecimiento personal sobre situaciones reales; la ficción se rechaza con alternativas amables (RF-01).
2. **Entre 5 y 7 capítulos**, siempre. La UI no permite salir del rango y el backend lo vuelve a validar (RF-02).
3. Cada capítulo tiene, en este orden: **Introducción → Desarrollo → Ejemplos cotidianos → Conclusión → Ejercicio práctico** (RF-03). Estas secciones no se pueden eliminar.
4. Los ejercicios son **solo** un checklist de autoevaluación o un reto de 24 a 48 h (RF-04).
5. Hay **dos pausas obligatorias**: después del índice y después del capítulo 1. El capítulo 1 aprobado es la referencia de tono y formato para el resto (RF-05).
6. **Exportación a `.md` y PDF** (RF-06) con jerarquía H1/H2/H3 y PDF etiquetado (RA-01), fondo blanco, texto de alto contraste, Roboto/Arial/Helvetica y **11 pt como mínimo** (RA-03).
7. En temas sensibles (finanzas, emociones, salud, autoayuda) hay un **aviso legal automático** que no se puede quitar (RÉR-02).
8. **Cuatro agentes modulares** con los prompts en archivos independientes (RNF-04).
9. Tono **conversacional, empático y directo** en los ebooks (RNF-01) y también en el microcopy de la app.
10. **Sin estereotipos** en los ejemplos, tampoco en los datos de demo ni en los placeholders (RÉR-03).

## Stack

- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui (muy personalizado) y Motion.
- **Backend:** Python 3.13, FastAPI y LangGraph (`interrupt()` + checkpointer en SQLite), con streaming SSE, Playwright (PDF etiquetado) y pypdf.
- **LLM:** Gemini por defecto (REST), intercambiable con Claude, OpenAI o `demo` (`LLM_PROVIDER`). Siempre a través de `backend/app/llm/`. Los prompts están en `backend/app/prompts/<agente>/<tarea>.md`.
- **Datos:** SQLite local en `backend/data/` (D-35). Supabase queda como migración futura.

## Diseño: reglas clave (detalle en `docs/07-diseno-interfaz.md`)

- **Dirección:** “Mesa en calma” con alma de libro. Limpia, moderna, aireada y redondeada, con la calma de **Gemini**. El carácter de libro está en los **objetos**: la página sobre la mesa, la cinta marcapáginas, las portadas con color de tela, la cabecera, la capitular y el número de página.
- **Tipografía:** **Lexend** (títulos), **Onest** (interfaz) y **Roboto** (cuerpo del ebook). **Nada de serif “elegantes”**: al usuario le cansan.
- **Color:** mesa `#EEF0F3`, página `#FFFFFF`, texto `#1B1D23` y un único acento, la tinta `#0E7C74`. Telas de portada por nicho. La hoja del libro es siempre blanca, también en tema oscuro.
- **Espacio de trabajo = libro abierto:** *a la izquierda decides, a la derecha ves tu libro*, en todas las etapas.
- **La cinta solo marca “Tu turno”.** El proceso se muestra por fases, con el agente responsable y “Tú” en las pausas.
- **Que no parezca IA:** nada de degradados violeta, ✨, glassmorphism, grids de tres tarjetas iguales, tema shadcn por defecto ni copy del tipo “potenciado por IA” (lista completa en `docs/05-brief-diseno.md` §3).
- Antes de construir UI: cargar `impeccable` y `frontend-design`, y seguir `docs/07-diseno-interfaz.md` y las maquetas de `docs/diseno/`.
- **WCAG 2.2 AA**, tema claro y oscuro, `prefers-reduced-motion` y buenos Core Web Vitals.

## Convenciones

- **Idioma:** español en la UI, la documentación, los commits y los comentarios. Identificadores de código en inglés.
- **Microcopy:** tuteo, verbos concretos y ninguna muletilla de IA (ver `docs/04-experiencia-usuario.md` §8).
- **Commits:** Conventional Commits en español (`feat: ...`, `docs: ...`, `fix: ...`).
- **Decisiones nuevas o cambios de alcance:** se registran en `docs/06-decisiones.md`.
- Si algo contradice `docs/requerimientos.txt`, **se pregunta antes de implementarlo**.

## Estructura

```
docs/            documentación
.claude/skills/  skills del proyecto (versionadas; ver docs/skills.md)
frontend/        Next.js 16 + React 19 + Tailwind 4 (modo demo y con backend)
backend/         FastAPI + LangGraph (fase 4)
iniciar-folio.ps1  arranca backend y frontend juntos en Windows
```

## Comandos

Versión publicada: https://franjmd0508.github.io/multiagente-inteligente-ebooks/ (GitHub Pages, workflow `desplegar-frontend.yml`).

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
npm run lint         # ESLint con reglas del React Compiler
npx tsc --noEmit     # tipos
npm run build        # build de producción
npm run test:e2e     # pruebas de aceptación: una por requerimiento + portada y referencias (modo demo, Playwright + Edge)
npm run test:e2e:backend  # punta a punta con el backend real (proveedor demo, base de datos temporal)
npm run guia:capturas  # recorre la app y toma las capturas señaladas de la guía
npm run guia:pdf     # regenera docs/guia/Folio-guia-de-requerimientos.pdf
```

```powershell
cd backend
.\.venv\Scripts\python.exe -m app        # http://127.0.0.1:8000 (documentación en /docs)
.\.venv\Scripts\python.exe -m pytest     # pruebas del backend (proveedor demo, sin red)
```

- **Cada requerimiento tiene su prueba** en `frontend/e2e/requisitos.spec.ts`; la portada (RD-04) y las referencias (RD-09), en `frontend/e2e/portada-referencias.spec.ts`; el backend, en `backend/tests/`. Si cambias algo que afecte a un requerimiento, ejecuta las pruebas y actualiza `docs/09-verificacion-requerimientos.md` y la guía en PDF (`npm run guia:capturas` y `npm run guia:pdf`).

- **Next.js 16 trae cambios incompatibles** con versiones anteriores: antes de escribir código de Next, lee la guía correspondiente en `frontend/node_modules/next/dist/docs/` (ver `frontend/AGENTS.md`). Por ejemplo, `params` es asíncrono en las páginas de servidor y el antiguo `middleware` ahora se llama `proxy`.
- Rutas de ebooks con parámetros (`/ebook?id=…`), no dinámicas: el sitio se exporta como estático para GitHub Pages. Usa los helpers de `src/lib/routes.ts`.
- Los tokens de diseño viven en `frontend/src/app/globals.css` (tema oscuro con `data-theme`). Se usan como clases de Tailwind: `bg-mesa`, `text-tinta`, `font-display`…
- En componentes con `@container` (la portada), el padding va en una capa interior: las unidades `cqw` de un elemento se resuelven contra su contenedor ancestro, no contra sí mismo.
