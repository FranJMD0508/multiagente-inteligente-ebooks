# Skills del proyecto (Claude Code)

El proyecto trae **45 skills** de diseño, UX y frontend en `.claude/skills/`, versionadas en el repo. Cualquier persona del equipo que abra el proyecto con Claude Code las tiene disponibles sin instalar nada.

- **Origen y versiones:** `skills-lock.json` (en la raíz).
- **Restaurar o reinstalar:** `npx skills experimental_install`.
- **Actualizar:** `npx skills update -p`.
- **Agregar una nueva:** `npx skills add <owner/repo> --skill <nombre> --agent claude-code --copy -y`.

> Las skills se ejecutan con los mismos permisos que el agente. Antes de agregar una nueva, revisa su contenido.

## Cuándo usar cada una

### 1. Ideación y dirección visual

| Skill | Úsala para |
|---|---|
| `brainstorming` | **Antes de cualquier trabajo creativo.** Explora la intención, los requisitos y las alternativas mediante preguntas. |
| `impeccable` | Skill "navaja suiza" de diseño: shape, critique, audit, polish, distill, colorize, typeset, animate... Es la principal para evitar el "look IA". |
| `frontend-design` | Dirección estética intencional y distintiva al crear UI nueva (Anthropic). |
| `design-taste-frontend` | Diseño anti-*slop*: deduce la dirección desde el brief y evita el look genérico. |
| `high-end-visual-design` | Fuentes, espaciados, sombras y estructuras "de agencia premium". |
| `minimalist-ui` | Interfaces editoriales limpias: monocromo cálido y contraste tipográfico. Encaja con la identidad "editorial". |
| `top-design` | Experiencias de nivel Awwwards (con moderación: esto es una herramienta, no una landing). |
| `ui-ux-pro-max` | Base de datos de estilos, paletas, pares tipográficos y patrones UX por tipo de producto. |
| `apple-design` | Movimiento fluido y físico, gestos y *springs* al estilo Apple, llevados a la web. |
| `canvas-design` | Piezas visuales estáticas (PNG/PDF): moodboards, portadas de ejemplo. |
| `theme-factory` | Temas prediseñados de color y fuente para artefactos; útil para explorar portadas o plantillas PDF. |

### 2. Fundamentos, sistema de diseño y UX

| Skill | Úsala para |
|---|---|
| `visual-design-foundations` | Tipografía, teoría del color, sistemas de espaciado e iconografía. |
| `design-system-patterns` | Tokens de diseño, *theming* (claro/oscuro) y arquitectura de componentes. |
| `tailwind-design-system` | Sistema de diseño con Tailwind CSS v4 y tokens. |
| `web-typography` | Elegir y combinar tipografías, interlineado, tipografía responsive y carga de fuentes. |
| `refactoring-ui` | Arreglar jerarquía, espaciado, color y profundidad cuando algo "se ve raro". |
| `ux-heuristics` | Evaluación heurística de usabilidad (Nielsen y otros). |
| `design-everyday-things` | *Affordances*, significantes, restricciones y retroalimentación (Norman). Ideal para los puntos de control. |
| `lean-ux` | Diseño guiado por hipótesis y experimentos rápidos. |
| `interaction-design` | Microinteracciones, transiciones, estados de carga y retroalimentación. |
| `microinteractions` | Diseño fino de disparadores, reglas, retroalimentación y bucles (Saffer). |
| `responsive-design` | Container queries, tipografía fluida, CSS Grid y estrategia mobile-first. |
| `accessibility-compliance` | Implementar interfaces que cumplan WCAG 2.2. |
| `avoid-ai-writing` | Limpiar el microcopy (¡y los prompts de los agentes!) de muletillas "de IA". |

### 3. Movimiento y animación

| Skill | Úsala para |
|---|---|
| `emil-design-eng` | Filosofía de pulido de UI y de decisiones de animación (Emil Kowalski). |
| `motion-framer` | Implementar animaciones con Motion (framer-motion) en React. |
| `animation-vocabulary` | Traducir una descripción vaga ("lo que rebota al abrir") al término exacto. |
| `find-animation-opportunities` | Encontrar dónde falta movimiento (y dónde sobra). |
| `improve-animations` | Auditar las animaciones existentes y proponer planes de mejora. |
| `review-animations` | Revisión estricta del código de animación. |
| `vercel-react-view-transitions` | Transiciones entre vistas con la View Transition API de React. |

### 4. Implementación frontend (Next.js / React)

| Skill | Úsala para |
|---|---|
| `shadcn` | Añadir, componer y personalizar componentes de shadcn/ui. |
| `nextjs-app-router-patterns` | App Router, Server Components, streaming y rutas paralelas. |
| `vercel-react-best-practices` | Rendimiento y buenas prácticas de React/Next.js (Vercel). |
| `vercel-composition-patterns` | Patrones de composición de componentes React. |
| `react-state-management` | Elegir y aplicar el manejo de estado (Zustand, TanStack Query...). |
| `pick-ui-library` | Elegir la librería adecuada para una tarea (drag and drop, toasts, editores...). |

### 5. Calidad, rendimiento y pruebas

| Skill | Úsala para |
|---|---|
| `web-quality-audit` | Auditoría completa: rendimiento, accesibilidad, SEO y buenas prácticas. |
| `performance` | Optimizar tiempos de carga. |
| `core-web-vitals` | Mejorar LCP, INP y CLS. |
| `high-perf-browser` | Rendimiento a nivel de red, carga de recursos y renderizado. |
| `accessibility` | Auditar la accesibilidad (WCAG 2.2). |
| `best-practices` | Seguridad, compatibilidad y calidad del código web. |
| `web-design-guidelines` | Revisar la UI contra las Web Interface Guidelines. |
| `webapp-testing` | Probar la app local con Playwright y tomar capturas. |

## Combinaciones recomendadas

- **Diseñar una pantalla nueva:** `brainstorming` → `impeccable` (shape) → `frontend-design` → `shadcn` + `motion-framer` → `impeccable` (critique/polish).
- **"Esto se ve genérico o hecho por IA":** `impeccable` (critique, bolder o distill) + `design-taste-frontend` + `refactoring-ui`.
- **Definir el sistema de diseño:** `design-system-patterns` + `tailwind-design-system` + `web-typography` + `visual-design-foundations`.
- **Antes de dar por terminada una pantalla:** `ux-heuristics` + `accessibility` + `review-animations` + `web-quality-audit` + `webapp-testing` (capturas).
- **Escribir microcopy:** `avoid-ai-writing` + la guía de voz en `04-experiencia-usuario.md` §8.
