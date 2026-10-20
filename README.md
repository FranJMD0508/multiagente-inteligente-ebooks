# Folio · multiagente inteligente de ebooks

**Folio** es una aplicación web en la que un **sistema de cuatro agentes de IA** investiga, redacta, crea ejercicios y maqueta **ebooks cortos de crecimiento personal** (5 a 7 capítulos) sobre situaciones de la vida real, como finanzas para universitarios, gestión del tiempo o resolución de conflictos.

El usuario mantiene el control en **dos puntos de validación**, el índice y el primer capítulo. Además puede editar el contenido, diseñar la portada (con imagen propia) y la contraportada, revisar las **referencias bibliográficas** que sugiere el Investigador (verificadas en Crossref y Open Library, en APA 7) y al final exporta el libro en **Markdown** y **PDF accesible**.

## Cómo funciona

```
Idea / nicho ──► Investigador ──► ⏸ Apruebas el índice
                                        │
                 Redactor + Ejercicios ◄┘
                        │
                        ▼
                 ⏸ Apruebas el capítulo 1 (define el tono)
                        │
                        ▼
      Redactor + Ejercicios (capítulos 2..N) ──► Maquetador ──► Editas, diseñas y exportas (.md / PDF)
```

| Agente | Rol |
|---|---|
| **Investigador** | Valida el tema, detecta si es sensible, propone un índice de 5 a 7 capítulos y sugiere lecturas reales que Folio verifica |
| **Redactor** | Escribe cada capítulo (introducción, desarrollo, ejemplos y conclusión) con un tono cercano y coherente |
| **Ejercicios** | Cierra cada capítulo con un checklist o un reto de 24 a 48 h |
| **Maquetador / Exportador** | Escribe la contraportada y arma el libro (portada, aviso legal, índice, capítulos, referencias en APA 7) en `.md` y PDF etiquetado |

## Estado del proyecto

- [x] Fase 1: análisis de requerimientos y documentación
- [x] Fase 2: diseño de la interfaz
- [x] Fase 3: frontend (Next.js) con datos simulados
- [x] Fase 4: backend multiagente (FastAPI + LangGraph) e integración, más edición de portada y referencias bibliográficas

## Probarlo

### Con los agentes de IA reales (backend)

Requisitos: Python 3.12 o 3.13 y Node.js 20 o superior. En Windows, desde la raíz del repositorio:

```powershell
.\iniciar-folio.ps1   # instala lo que falte, arranca backend y frontend y abre http://localhost:3000
```

Para que escriba con Gemini, pon tu clave gratuita de [Google AI Studio](https://aistudio.google.com/apikey) en `backend/.env` (`GEMINI_API_KEY=…`). Sin clave funciona con el proveedor `demo`, que genera textos de plantilla. Crea una cuenta y escribe tu idea. Los pasos manuales (y para Linux o macOS) están en [`backend/README.md`](backend/README.md).

### Versión de demostración (sin backend)

**En línea:** https://franjmd0508.github.io/multiagente-inteligente-ebooks/ (se publica sola en cada push a `main`). Ahí los cuatro agentes se simulan en el navegador, con streaming y pausas incluidas. Entra con **“Continuar con Google”**. En **Ajustes → Demostración** puedes acelerar la simulación, provocar un error o vaciar la biblioteca.

En tu computadora: `cd frontend`, `npm install` y `npm run dev` (sin `.env.local`, arranca en modo demostración). Más detalle en [`frontend/README.md`](frontend/README.md).

## Stack

- **Frontend:** Next.js · React · TypeScript · Tailwind CSS · Radix UI · Motion
- **Backend:** Python · FastAPI · LangGraph (checkpoints en SQLite) · SSE · Playwright (PDF)
- **LLM:** Gemini por defecto, intercambiable con Claude, OpenAI o un proveedor demo sin conexión
- **Referencias:** Crossref y Open Library

## Documentación

| | |
|---|---|
| [Requerimientos originales](docs/requerimientos.txt) | RF, RNF, RA y RÉR |
| [01 · Visión del producto](docs/01-vision-producto.md) | Problema, usuarios, alcance y glosario |
| [02 · Análisis de requerimientos](docs/02-analisis-requerimientos.md) | Implicaciones, criterios de aceptación y trazabilidad |
| [03 · Arquitectura](docs/03-arquitectura.md) | Componentes, agentes, estados, datos y API |
| [04 · Experiencia de usuario](docs/04-experiencia-usuario.md) | Pantallas, flujos, estados y microcopy |
| [05 · Brief de diseño](docs/05-brief-diseno.md) | Inspiración, principios y proceso de diseño |
| [06 · Decisiones](docs/06-decisiones.md) | Registro de decisiones y preguntas abiertas |
| [07 · Diseño de interfaz](docs/07-diseno-interfaz.md) | Sistema visual, pantallas, estados y movimiento de Folio |
| [Maquetas](docs/diseno/mesa-de-diseno.html) | Todas las pantallas en una página (abrir en el navegador) |
| [08 · Frontend](docs/08-frontend.md) | Qué se implementó y cómo funciona la capa de datos (modo demo y con backend) |
| [09 · Verificación de requerimientos](docs/09-verificacion-requerimientos.md) | Cada requerimiento: cómo se cumple, dónde está, cómo verlo y su prueba automática |
| [10 · Principios de diseño y escenario de IA](docs/10-principios-diseno-y-escenario-ia.md) | Principios aplicados, tipo de IA, nivel de riesgo y marcos éticos |
| [11 · Backend](docs/11-backend.md) | Grafo de agentes, prompts, referencias, exportación y pruebas |
| [Skills del proyecto](docs/skills.md) | Skills de Claude Code para diseño y frontend |

## Trabajar con Claude Code

El repo incluye `CLAUDE.md` con el contexto del proyecto y **45 skills** de diseño, UX y frontend en `.claude/skills/`. No hace falta instalar nada: están disponibles al abrir el proyecto con Claude Code. Para restaurarlas o actualizarlas:

```bash
npx skills experimental_install   # restaura desde skills-lock.json
npx skills update -p              # actualiza las skills del proyecto
```
