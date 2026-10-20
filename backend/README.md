# Folio · backend multiagente

API REST + SSE en **FastAPI** con un orquestador **LangGraph** y cuatro agentes (Investigador, Redactor, Ejercicios y Maquetador/Exportador) que escriben y maquetan los ebooks de Folio. Sustituye al simulador del navegador (`frontend/src/lib/api/mock/`). El JSON de cada ebook es el tipo `Ebook` de `frontend/src/lib/types.ts`.

- **Proveedor de LLM intercambiable:** Gemini (por defecto), Claude, OpenAI o `demo` (sin red y sin clave).
- **Dos pausas obligatorias** con `interrupt()` y checkpoints en SQLite: si reinicias el servidor, cada ebook sigue donde estaba.
- **Streaming** del texto de cada capítulo por SSE, sección por sección.
- **Exportación** a Markdown y a PDF etiquetado (Chromium/Edge vía Playwright), con lecturas recomendadas en APA 7 verificadas en Crossref y Open Library.

## Requisitos

- Python 3.12 o 3.13.
- Para el PDF, un navegador Chromium: en Windows se usa **Microsoft Edge**, que ya viene instalado. En Linux o macOS, `python -m playwright install chromium`.
- Una clave de LLM es opcional: sin ella se usa el proveedor `demo`.

## Instalación

**Windows (PowerShell)**

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env      # y rellena tu clave si tienes una
python -m app                    # http://127.0.0.1:8000  (documentación en /docs)
```

**Linux / macOS**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m playwright install chromium   # para el PDF
cp .env.example .env
python -m app
```

`python -m app` acepta `--host`, `--port` y `--reload`. También vale `uvicorn app.main:app --port 8000 --timeout-graceful-shutdown 3` (la opción final evita que el apagado se quede esperando a los streams SSE abiertos).

Los datos se guardan en `backend/data/` (ignorada por git): `folio.sqlite` (usuarios, ebooks e imágenes), `checkpoints.sqlite` (estado del grafo) y `secret.key` (si no defines `SECRET_KEY`).

## Usarlo con el frontend

Con el backend en marcha, en otra terminal:

```powershell
cd frontend
Copy-Item .env.example .env.local   # NEXT_PUBLIC_API_MODE=http y NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev                         # http://localhost:3000 → crea una cuenta y escribe tu idea
```

Desde la raíz del repositorio, `.\iniciar-folio.ps1` hace las dos cosas en dos ventanas. La prueba de punta a punta con el backend real (proveedor demo y una base de datos temporal) es `npm run test:e2e:backend` dentro de `frontend/`.

## Configuración (`backend/.env`)

Todas las variables están comentadas en [`.env.example`](.env.example). Las principales:

| Variable | Por defecto | Para qué sirve |
|---|---|---|
| `LLM_PROVIDER` | `gemini` | `gemini`, `anthropic`, `openai` o `demo`. Sin clave, se usa `demo` y se avisa en el log |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | `gemini-3.8-flash` | Alternativa barata: `gemini-3.5-flash-lite` |
| `GEMINI_THINKING_LEVEL` | `low` | Vacío = no se envía. Si el modelo no lo admite, se quita solo |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ANTHROPIC_EFFORT` | `claude-sonnet-5`, `low` | Esfuerzo de razonamiento (`output_config.effort`); vacío = no se envía |
| `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL` | `gpt-5-mini` | La URL permite usar APIs compatibles |
| `CHAPTER_TIMEOUT_S` | `60` | Tiempo límite por capítulo y por intento (RNF-02) |
| `UI_STEP_DELAY_MS` | `300` | Pausa entre capítulos que aparecen uno a uno en el índice |
| `DEMO_DELAY_MS` | `35` | Velocidad del streaming del proveedor demo |
| `FRONTEND_ORIGINS` | `http://localhost:3000,…` | CORS |
| `FRONTEND_URL` | `http://localhost:3000` | Para el enlace de recuperar contraseña |
| `CROSSREF_MAILTO` | | Correo de contacto en el `User-Agent` (lo pide Crossref) |
| `REFERENCES_LOOKUP` | `true` | `false` = no consulta la red (referencias `sin_verificar`) |
| `PDF_BROWSER_CHANNEL` | `msedge` en Windows | `chrome`, `msedge` o vacío (Chromium de Playwright) |

### Clave gratuita de Gemini

1. Entra en [Google AI Studio](https://aistudio.google.com/apikey) con una cuenta de Google.
2. Pulsa **Create API key** (crea un proyecto si te lo pide). El plan gratuito no necesita tarjeta y tiene un límite de peticiones por minuto y por día, de sobra para probar Folio.
3. Copia la clave en `backend/.env`: `GEMINI_API_KEY=tu-clave`.
4. Reinicia el servidor. `GET /api/health` debe responder `"provider": "gemini"`.

En el plan gratuito Google puede usar los prompts para mejorar sus productos (P-12 en `docs/06-decisiones.md`): no escribas datos personales sensibles en las ideas de prueba.

### Cambiar de proveedor

- **Claude:** `LLM_PROVIDER=anthropic` y `ANTHROPIC_API_KEY=…`. Los modelos actuales (Claude Sonnet 5 y posteriores) no admiten `temperature`, así que no se envía: el tono lo fijan los prompts. La profundidad del razonamiento se ajusta con `ANTHROPIC_EFFORT`.
- **OpenAI:** `LLM_PROVIDER=openai` y `OPENAI_API_KEY=…` (y `OPENAI_MODEL` si quieres otro). Si el modelo rechaza `temperature` (los de razonamiento solo aceptan la de por defecto), se reintenta sin ella y se recuerda.
- **Sin conexión:** `LLM_PROVIDER=demo`. Textos simulados, deterministas, con las mismas formas que los reales.

Los SDK de Anthropic y OpenAI solo se importan si se eligen. Gemini se usa por REST con `httpx` para no depender de su SDK.

## Pruebas

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest        # Linux/macOS: .venv/bin/python -m pytest
```

Las pruebas usan el proveedor `demo`, una base de datos temporal y **no salen a la red** (Crossref y Open Library se simulan con `httpx.MockTransport`). La exportación a PDF se prueba si hay navegador; si no, se salta. Cubren: cuentas, el flujo completo por la API (con edición, regeneración, cancelación, ajustes, restauración, exportación a `.md` y PDF), eventos SSE contra un uvicorn real, guardarraíl y validaciones, reinicios y reintentos, APA 7, verificación de referencias, el adaptador de Gemini (petición, respuesta normal y SSE) y los de Claude y OpenAI con sus SDK, el reparto del stream en secciones y los ejercicios.

## Mapa de carpetas

```
backend/
├── app/
│   ├── main.py            FastAPI: CORS, routers, errores, arranque y apagado
│   ├── __main__.py        python -m app
│   ├── config.py          Settings (.env)
│   ├── models.py          Modelos = tipos de frontend/src/lib/types.ts (camelCase)
│   ├── store.py           Ebooks en memoria + SQLite con escritura diferida; usuarios e imágenes
│   ├── events.py          Bus de eventos por usuario y formato SSE
│   ├── tasks.py           Una tarea asyncio por ebook (+ tareas secundarias con nombre)
│   ├── services.py        Contenedor de servicios
│   ├── auth.py            scrypt + sal, JWT HS256, mensajes de validación
│   ├── niches.py          Catálogo de nichos (port de niches.ts)
│   ├── guardrails.py      Patrones de ficción, avisos legales (port de guardrails.ts)
│   ├── design.py          Contraste WCAG y tamaños de página
│   ├── api/               auth, ebooks, references, exports, assets, events, meta (health, niches, topics)
│   ├── graph/             builder (grafo), nodes, runner, state, guardrail, activity (bitácora), mutations
│   ├── agents/            investigador, redactor, ejercicios, maquetador (+ common)
│   ├── prompts/           un .md por tarea (ver más abajo)
│   ├── llm/               base (interfaz y reintentos), gemini, anthropic, openai, demo
│   ├── references/        apa (APA 7), lookup (Crossref y Open Library), verify, service (en segundo plano)
│   └── export/            markdown, html (Jinja2), pdf (Playwright + pypdf), templates/, fonts/ (OFL)
└── tests/
```

## Prompts (RNF-04)

Cada tarea tiene su archivo en `app/prompts/<agente>/<tarea>.md`:

```
---
descripcion: Qué hace el prompt
temperatura: 0.8
max_tokens: 6000
---
---sistema---
Instrucciones de sistema…
---usuario---
Mensaje con {placeholders}…
```

Solo se sustituyen los `{placeholders}` en minúsculas que envía el agente; las llaves de los ejemplos JSON se quedan tal cual. Los archivos se releen si cambian (recarga en caliente): puedes ajustar un prompt sin reiniciar el servidor.

| Archivo | Agente · tarea | Temp. |
|---|---|---|
| `orquestador/guardarrail.md` | Clasifica la idea: válida o no, nicho, sensibilidad, público y 3 alternativas | 0 |
| `investigador/indice.md` | Título, subtítulo, brief e índice con exactamente N capítulos | 0,7 |
| `investigador/capitulo_alternativo.md` | Otro capítulo para una posición del índice | 0,8 |
| `investigador/lecturas.md` | 4 a 8 obras reales y conocidas (sin inventar DOI ni ISBN) | 0,2 |
| `redactor/capitulo.md` | Capítulo en Markdown con las 4 secciones, en streaming | 0,8 |
| `redactor/guia_estilo.md` | Guía de estilo extraída del capítulo 1 aprobado | 0,3 |
| `ejercicios/ejercicio.md` | Checklist (5-7) o reto de 24/48 h (3-5 pasos) | 0,7 |
| `maquetador/contraportada.md` | Sinopsis de 60 a 110 palabras | 0,7 |

## Cómo funciona el orquestador

```
START ─(entry)─► guardarrail ─► investigador ─► marcar_indice ─► punto_control_indice ⏸
   "indice" / "cap1" ─► marcar_*        "redactar" ─► redactor        "maquetar" ─► maquetador
punto_control_indice ─ approve ─► redactor
                     ─ regenerate ─► investigador (modo regenerar) ─► marcar_indice
                     ─ regenerate_item ─► investigador_capitulo ─► marcar_indice
redactor ─► ejercicios ─► cap. 1 sin aprobar ─► marcar_cap1 ─► punto_control_cap1 ⏸
                      ─► quedan capítulos ─► redactor   ─► no quedan ─► maquetador ─► END
punto_control_cap1 ─ adjust ─► redactor ─► ejercicios ─► marcar_cap1
                   ─ approve ─► guia_estilo ─► redactor
guardarrail ─ rechazado ─► END (ebook en error, no reintentable, con alternativas)
```

- Cada punto de control son dos nodos: `marcar_*` fija el estado y emite `checkpoint.required` solo si cambia; `punto_control_*` solo llama a `interrupt()`. Así, al reanudar (LangGraph vuelve a ejecutar el nodo interrumpido) no se repite nada.
- `thread_id` = id del ebook. El estado del grafo es mínimo (`ebook_id`, `entry`, última acción y sus parámetros); el contenido vive en el store.
- **Cancelar** un cambio en una pausa cancela la tarea, restaura la versión anterior (como `api.cancelBusy`) y recoloca el grafo en la pausa con un **hilo nuevo** que entra por `indice` o `cap1`. Se eligió esta opción frente a `aupdate_state(as_node=…)` porque también funciona si la cancelación llega antes de que la tarea arranque o si falta el checkpoint (ambas se probaron; la de hilo nuevo es la que se usa).
- **Al arrancar**, los ebooks en `investigando`, `redactando_cap1`, `redactando` o `maquetando` se retoman (`ainvoke(None)` sobre el checkpoint o, si falta, un hilo nuevo según el estado). Los capítulos a medias vuelven a `pendiente`; los cambios a medias en una pausa se deshacen como en `simulator.resume`.
- **Errores:** cada capítulo tiene un tiempo límite (`CHAPTER_TIMEOUT_S`) y un reintento automático; después queda en `error` reintentable (`{message: "No pudimos terminar el capítulo N", chapter, retryable: true, resumeStatus}`). `POST /retry` vuelve a ejecutar el nodo que falló. Si falla un cambio durante una pausa (regenerar el índice, ajustar el capítulo 1), no hay error: se conserva la versión anterior y llega un `notice`.

## API (`/api`)

Todas las rutas, salvo `auth`, `health`, `niches` y `assets`, piden `Authorization: Bearer <token>`. Las rutas que modifican un ebook devuelven el **ebook completo** (200, o 202 si lanzan trabajo). Errores: `{"detail": {"code": "...", "message": "frase para mostrar"}}`.

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `GET /health` | | `{ok, provider, model}` |
| `GET /niches` | | Catálogo (los 8 nichos de `niches.ts`) |
| `POST /auth/register` | `{name, email, password}` | 201 `{token, user}` |
| `POST /auth/login` | `{email, password}` | `{token, user}` |
| `GET` / `PATCH /auth/me` | `{name}` | `user` |
| `DELETE /auth/me` | | 204 (borra la cuenta y sus ebooks) |
| `POST /auth/recover` | `{email}` | 202 siempre; el enlace sale en el log |
| `POST /auth/reset` | `{token, password}` | `{token, user}` |
| `POST /topics/check` | `{prompt}` | `{ok: true, nicheId?}` o `{ok: false, reason, alternatives}` |
| `GET /ebooks` | | Ebooks completos, más recientes primero |
| `POST /ebooks` | `{id?, prompt, nicheId?, audience?, desiredChapters, exercisePref, author}` | 201 ebook |
| `GET` / `PATCH` / `DELETE /ebooks/{id}` | `{title?, subtitle?}` | ebook · 204 |
| `POST /ebooks/{id}/duplicate` | `{newId?}` | 201 ebook (solo `listo` o en pausa) |
| `PUT /ebooks/{id}/outline` | `{chapters: [{id, title, summary, keyPoints}]}` | ebook (5 a 7, si no 422) |
| `POST /ebooks/{id}/outline/regenerate` | `{feedback}` | 202 |
| `POST /ebooks/{id}/outline/chapters/{chapterId}/regenerate` | | 202 |
| `POST /ebooks/{id}/outline/restore` · `/outline/approve` | | 200 · 202 |
| `POST /ebooks/{id}/cancel` | | ebook |
| `POST /ebooks/{id}/chapters/1/regenerate` | `{chips, note}` | 202 |
| `POST /ebooks/{id}/chapters/1/restore` · `/approve` | | 200 · 202 |
| `PUT /ebooks/{id}/chapters/1/manual` | `{sections}` | ebook |
| `PATCH /ebooks/{id}/chapters/{n}` | `{section, text}` | ebook (`#`/`##` → `###`, estado `editado`) |
| `PUT /ebooks/{id}/design` | `Partial<EbookDesign>` | ebook (validado) |
| `POST /ebooks/{id}/cover-image` | multipart `file` (JPG/PNG/WebP ≤ 5 MB) | 201 `{url: "/api/assets/{id}"}` |
| `GET /assets/{assetId}` | | La imagen (sin sesión, caché larga) |
| `POST /ebooks/{id}/back-cover/suggest` | | ebook con una sinopsis nueva |
| `POST /ebooks/{id}/retry` | | 202 |
| `POST /ebooks/{id}/references` | `ReferenceData & {id?, chapters?}` | 202 (se verifica en segundo plano) |
| `PATCH /ebooks/{id}/references/{refId}` | `Partial<ReferenceData> & {chapters?}` | 200, o 202 si hay que volver a verificar |
| `DELETE /ebooks/{id}/references/{refId}` | | ebook |
| `POST /ebooks/{id}/references/{refId}/verify` · `/accept-match` | | 202 · 200 |
| `POST /ebooks/{id}/references/suggest` | | 202 |
| `GET /references/lookup?q=` | | `ReferenceCandidate[]` (≤ 8) |
| `POST /ebooks/{id}/exports` | `{format: "md" \| "pdf", filename?}` | El archivo (`Content-Disposition: attachment`), solo en `listo` |
| `GET /events` | | SSE de todos los ebooks del usuario |
| `GET /ebooks/{id}/events` | | SSE de un ebook |

Las rutas SSE aceptan el token por cabecera o por `?token=` (EventSource no envía cabeceras).

## Eventos SSE

Una línea `data: <json>` y una línea en blanco por evento; `: ping` cada 15 s; `retry: 3000` al conectar. **Al conectar llega una instantánea `ebook.updated` de cada ebook**, así una reconexión no pierde nada. Todos los eventos llevan `ebookId`.

| Evento | Datos |
|---|---|
| `ebook.updated` | `ebook` (instantánea completa tras cada cambio) |
| `ebook.deleted` | |
| `token` | `chapter`, `section`, `delta` (concaténalo a `chapters[chapter-1].sections[section]`) |
| `run.started` · `ebook.ready` | |
| `agent.started` · `agent.completed` | `agent`, `chapter?` |
| `agent.progress` | `agent`, `message`, `chapter?` (cada entrada o cambio de la bitácora) |
| `section.started` | `chapter`, `section` (`introduccion` … `conclusion` y `ejercicio`) |
| `checkpoint.required` | `checkpoint`: `outline` o `chapter1` |
| `chapter.completed` | `chapter`, `durationMs` |
| `run.failed` | `error`, `retryable` |
| `notice` | `text` (los mismos anuncios que el simulador: "Es tu turno: revisa el índice.", "Capítulo 3 terminado.", "Tu ebook está listo."…) |

El orden importa: cada instantánea se serializa al publicarse, así que aplicar instantáneas y tokens en orden reconstruye el texto exacto.

## Cómo se cumple cada requerimiento

| Req. | Dónde |
|---|---|
| RF-01 nichos y no ficción | `niches.py`, `guardrails.py`, `graph/guardrail.py`, `prompts/orquestador/guardarrail.md`, `POST /topics/check` |
| RF-02 5 a 7 capítulos | `agents/investigador.py` (`check_outline`), `prompts/investigador/indice.md`, validación de `PUT /outline` |
| RF-03 estructura del capítulo | `prompts/redactor/capitulo.md`, `ChapterStreamParser` (reparte y valida las 4 secciones), `PATCH /chapters/{n}` |
| RF-04 ejercicios rápidos | `agents/ejercicios.py` (`decide_type`, `to_exercise`, `validate_exercise`), `prompts/ejercicios/ejercicio.md` |
| RF-05 dos pausas HITL | `graph/builder.py` (`interrupt()`), checkpointer SQLite, rutas `/outline/*` y `/chapters/1/*` |
| RF-06 Markdown y PDF | `export/markdown.py`, `export/html.py`, `export/pdf.py`, `POST /exports` |
| RNF-01 tono | Prompts del Redactor (temperatura 0,8, reglas de tono y muletillas prohibidas) |
| RNF-02 < 60 s por capítulo | `CHAPTER_TIMEOUT_S`, reintento automático, streaming, `chapter.completed.durationMs` |
| RNF-03 coherencia | Brief del Investigador, guía de estilo, capítulo 1 completo y resúmenes previos en cada prompt (`ChapterRequest`) |
| RNF-04 modularidad | `agents/` (un módulo por agente), `prompts/` (un archivo por tarea), `llm/` (proveedor intercambiable) |
| RA-01 jerarquía H1/H2/H3 | `normalize_markdown`, plantilla del PDF, `page.pdf(tagged=True, outline=True)`, prueba de `/StructTreeRoot` y `/H1`-`/H3` |
| RA-02 lenguaje claro | Reglas de todos los prompts (frases cortas, vocabulario cotidiano) |
| RA-03 contraste y tipografía | Plantilla del PDF (fondo blanco, `#1B1D23`, Roboto/Arial/Helvetica ≥ 11 pt, fuentes incrustadas), contraste ≥ 4,5:1 en `PUT /design` |
| RÉR-01 originalidad | Reglas explícitas en los prompts; Gemini `RECITATION` se reintenta; lecturas verificadas en Crossref/Open Library |
| RÉR-02 aviso legal | `guardrails.DISCLAIMERS` en el `.md` y el PDF según la sensibilidad (no se puede quitar) |
| RÉR-03 sin estereotipos | Reglas de los prompts y personas sugeridas diversas por capítulo (`agents/redactor.PEOPLE`) |
| P-11 marca de IA | Nota visible, comentario `<!-- folio: generado-con-ia=true… -->` en el `.md` y metadatos del PDF (`Keywords`, `Creator`) |

## Notas y decisiones

- **Contraportada en el PDF:** página completa de tela; la nota de IA va abajo. Sin contraportada, la nota va en una página final.
- **Portada en el PDF:** ocupa la página entera, así que su proporción es la del tamaño de página (no 2:3). En `franja`, la imagen en recuadro se limita al 28 % del alto para que quepa en la parte de tela.
- **Verificación de referencias:** además de las reglas comunes, no se marca la editorial en artículos ni la revista en libros, y una sola página que coincide con el inicio del rango guardado no cuenta como diferencia. Si el DOI o el ISBN guardado no existe o lleva a otra obra y la obra aparece por título, se propone el identificador correcto en `match`.
- **APA:** igual que `frontend/src/lib/references/apa.ts`: el autor corporativo lleva punto ("OMS. (2022)."), la edición solo aparece en libros y la cita de un artículo sin autor usa «título». Los dos separan las iniciales pegadas ("Tolkien, J.R.R." → "J. R. R.").
- **Al cancelar** un cambio en curso, las entradas de la bitácora que quedaban "trabajando" pasan a "hecho" con el sufijo " · cancelado".
- **Recuperar contraseña:** en local no se envían correos; el enlace (válido 1 h y de un solo uso) aparece en el log como advertencia.
- Las fuentes de `app/export/fonts/` (Roboto, Lexend y Onest) son de Google Fonts con licencia SIL Open Font License (`OFL-*.txt`).
