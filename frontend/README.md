# Folio · frontend

Interfaz de Folio construida con **Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4**, con Radix UI para los componentes accesibles, Motion para las animaciones y dnd-kit para reordenar el índice.

En esta fase **no hay backend**. Los cuatro agentes se simulan en el navegador (incluido el streaming de texto y las dos pausas) y los datos se guardan en `localStorage`, separados por usuario.

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
npm run test:e2e   # pruebas de aceptación: una por requerimiento (usa Edge; ~1,5 min)
npm run guia:capturas  # capturas señaladas para la guía (recorre la app)
npm run guia:pdf   # guía en PDF: dónde ver cada requerimiento, paso a paso (docs/guia/)
npm run build      # build de producción
npm run start      # sirve el build
npm run lint       # ESLint (incluye las reglas del React Compiler)
npx tsc --noEmit   # comprobación de tipos
```

Para entrar, usa **“Continuar con Google”** o cualquier correo con una contraseña de 6 caracteres o más: la autenticación también es simulada. La primera vez se carga una biblioteca de ejemplo con libros en distintas etapas.

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
│   └── imprimir/[id]/   vista de impresión para exportar a PDF
├── components/
│   ├── book/            portada, cinta, hoja del capítulo, vista previa del libro
│   ├── workspace/       libro abierto, fases, etapas y exportación
│   ├── shell/           barra lateral, riel de iconos, menú de usuario
│   ├── home/            caja de texto del inicio
│   └── ui/              botones, campos, diálogos, menús, pestañas…
└── lib/
    ├── types.ts         contrato del dominio (docs/03 §7)
    ├── api/             capa de datos: fachada `api`, caché y hooks
    │   └── mock/        simulador del pipeline, generador de contenido y ejemplos
    ├── phases.ts        fases visibles del proceso
    ├── guardrails.ts    detección de ficción y avisos legales
    ├── design.ts        telas, plantillas y validación de contraste
    └── markdown.ts      exportación a Markdown
```

## Cómo se conecta con el backend (fase 4)

Los componentes solo usan `api` (`src/lib/api/index.ts`) y los hooks `useEbook` / `useEbookList`. Para conectar FastAPI hay que:

1. Reemplazar las funciones de `api` por llamadas REST (contrato en `docs/03-arquitectura.md` §6).
2. Suscribirse al stream SSE de cada ebook y volcar los eventos en la caché (`store.ts`) con `updateEbook`.
3. Quitar `mock/` y las opciones de demostración.

Los componentes no tienen que cambiar. Hay más detalle en `docs/08-frontend.md`.
