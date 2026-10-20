# Folio · frontend

Interfaz de Folio construida con **Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4**, con Radix UI para los componentes accesibles, Motion para las animaciones y dnd-kit para reordenar el índice.

Funciona en dos modos con la misma interfaz (`NEXT_PUBLIC_API_MODE`):

- **Demo** (`mock`, por defecto): los cuatro agentes se simulan en el navegador (incluido el streaming y las dos pausas) y los datos se guardan en `localStorage`, separados por usuario. Es lo que se publica en GitHub Pages.
- **Con backend** (`http`): habla con el backend multiagente de [`../backend`](../backend) (FastAPI + LangGraph) por REST y SSE, con cuentas reales y el PDF generado en el servidor.

## Versión publicada

https://franjmd0508.github.io/multiagente-inteligente-ebooks/

El workflow `.github/workflows/desplegar-frontend.yml` compila una exportación estática (`GITHUB_PAGES=true`, con `basePath` y `trailingSlash`) y la publica en GitHub Pages en cada push a `main` que toque `frontend/`. Por eso los ebooks usan rutas con parámetros (`/ebook?id=…`, `/imprimir?id=…`) en lugar de rutas dinámicas.

> Si generas la exportación en Windows, Next 16 escribe los archivos de precarga como carpetas y aparecen 404 inofensivos en la consola. En el runner Linux del workflow no pasa.

## Cómo ejecutarlo

Requisitos: Node.js 20 o superior.

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

Otros comandos:

```bash
npm run test:e2e   # pruebas de aceptación: una por requerimiento + portada y referencias (usa Edge; ~2,5 min)
npm run test:e2e:backend  # punta a punta con el backend real
npm run guia:capturas  # capturas señaladas para la guía (recorre la app)
npm run guia:pdf   # guía en PDF: dónde ver cada requerimiento, paso a paso (docs/guia/)
npm run build      # build de producción
npm run start      # sirve el build
npm run lint       # ESLint (incluye las reglas del React Compiler)
npx tsc --noEmit   # comprobación de tipos
```

En el modo demo, entra con **“Continuar con Google”** o cualquier correo con una contraseña de 6 caracteres o más: la autenticación también es simulada. La primera vez se carga una biblioteca de ejemplo con libros en distintas etapas.

### Con el backend

```bash
cp .env.example .env.local   # NEXT_PUBLIC_API_MODE=http y NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

Con el backend en marcha (ver [`backend/README.md`](../backend/README.md)), crea una cuenta y escribe tu idea. `npm run test:e2e:backend` recorre el flujo completo contra el backend real (lo arranca solo, con el proveedor demo y una base de datos temporal).

## Opciones de demostración

En **Ajustes → Demostración**:

- **Velocidad de los agentes:** normal o rápida.
- **Simular un error:** el capítulo 4 falla una vez, para probar el reintento.
- **Restaurar ejemplos / Vaciar biblioteca:** para ver la biblioteca de ejemplo o el estado vacío.

## Estructura

```
src/
├── app/
│   ├── (auth)/          login · registro · recuperar
│   ├── (app)/           inicio · biblioteca · ajustes · ebook/[id] (espacio de trabajo)
│   └── imprimir/        vista de impresión para exportar a PDF (modo demo)
├── components/
│   ├── book/            portada, contraportada, cinta, hoja del capítulo, referencia APA, vista previa
│   ├── workspace/       libro abierto, fases, etapas (portada y estilo, referencias…) y exportación
│   ├── shell/           barra lateral, riel de iconos, menú de usuario
│   ├── home/            caja de texto del inicio
│   └── ui/              botones, campos, diálogos, menús, pestañas…
└── lib/
    ├── types.ts         contrato del dominio (docs/03 §7)
    ├── api/             capa de datos: fachada `api` (contract.ts), caché, hooks y transformaciones (local.ts)
    │   ├── mock/        modo demo: simulador del pipeline, contenido, lecturas y ejemplos
    │   └── http/        modo con backend: REST, SSE y ediciones optimistas
    ├── references/      APA 7, búsqueda y verificación en Crossref y Open Library
    ├── cover-image.ts   imagen de portada: compresión y velo mínimo para 4,5:1
    ├── phases.ts        fases visibles del proceso
    ├── guardrails.ts    detección de ficción y avisos legales
    ├── design.ts        telas, plantillas, letras del título y validación de contraste
    └── markdown.ts      exportación a Markdown
```

## Cómo se conecta con el backend

Los componentes solo usan `api` (`src/lib/api/index.ts`) y los hooks `useEbook` / `useEbookList`. `api` es `mockApi` o `httpApi` según `NEXT_PUBLIC_API_MODE`; las dos cumplen la interfaz `FolioApi` (`src/lib/api/contract.ts`). Con backend, las ediciones se aplican al instante y se confirman con el servidor, y el avance de los agentes llega por un stream SSE por usuario. Hay más detalle en `docs/08-frontend.md`.
