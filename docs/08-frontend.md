# 08 · Frontend

> **Estado:** implementado el 2026-09-29 en [`frontend/`](../frontend) (fase 3, con datos simulados) y conectado al backend el 2026-10-20 (fase 4, ver [11-backend](./11-backend.md)). Sigue el diseño de [07-diseno-interfaz](./07-diseno-interfaz.md) y el contrato de [03-arquitectura](./03-arquitectura.md).
> Cómo ejecutarlo: [`frontend/README.md`](../frontend/README.md).

## 1. Qué incluye

| Área | Implementado |
|---|---|
| Acceso (RD-01) | Entrar, crear cuenta, recuperar contraseña y “Continuar con Google” (simulados). Datos separados por usuario. |
| Inicio (RF-01) | Página sobre la mesa con cinta, saludo, caja de texto con píldoras (capítulos 5/6/7/automático y público) y chips de nichos. Rechazo amable de ficción con alternativas. |
| Espacio de trabajo | Libro abierto (izquierda decides, derecha tu libro), animación “el libro se abre”, fases con “Tú” y pestañas **Decidir / Tu libro** en móvil. |
| Investigación | Bitácora del Investigador, capítulos que aparecen uno a uno y portada con el título tentativo. |
| Punto de control 1 (RF-02, RF-05) | Edición en el mismo lugar, reordenar arrastrando o con el teclado (instrucciones en español), agregar o quitar dentro del rango 5-7 con el límite explicado, regenerar un capítulo o todo el índice con indicaciones, cancelar y volver a la versión anterior, aviso legal visible. |
| Capítulo 1 y punto de control 2 (RF-03, RF-04, RNF-01) | Avance por secciones en vivo; ajustes rápidos, campo libre, editar a mano, versiones y aviso de que el capítulo marcará el tono. |
| Redacción del resto (RNF-02, RNF-03) | Avance por capítulo con barra de secciones, tiempo estimado, lectura progresiva (“Leer ahora”), streaming con cursor y error con reintento. |
| Revisión final (RD-03, RD-04, RD-09) | Pestaña **Texto**: editor por secciones con nombres fijos, barra de formato (negrita, cursiva, lista, cita, H3), H1/H2 convertidos en H3 (RA-01) y aviso legal bloqueado. Pestaña **Portada y estilo**, en tres vistas con su vista previa a la derecha: **Portada** (título, subtítulo y autor; cinco plantillas; telas y color propio con validación de contraste y tono accesible sugerido; **imagen propia** de fondo con un velo de tela que no baja del mínimo para 4,5:1, o en recuadro, con encuadre y texto alternativo; **letra, tamaño y alineación del título**), **Contraportada** (activar, sinopsis editable y "Pedir otra sinopsis" al Maquetador) e **Interior** (letra, tamaño y página, RA-03). Pestaña **Referencias**: lecturas sugeridas por el Investigador y verificadas en Crossref y Open Library, búsqueda por título, DOI o ISBN, alta y edición a mano, corrección con los datos de la fuente, "Copiar cita" (APA 7) y aviso de las que no se encontraron. |
| Exportación (RF-06) | Modo demo: **Markdown** descargado desde el navegador y **PDF** mediante una vista de impresión con `@page` según el tamaño elegido (“Guardar como PDF”). Con backend: los dos archivos los genera el Agente Maquetador en el servidor (PDF etiquetado). El libro incluye las referencias en APA 7 y la contraportada; el diálogo avisa si alguna referencia no se encontró. |
| Biblioteca (RD-02, RD-07) | Estantería de portadas, cinta en los libros que esperan revisión, filtros con contador, búsqueda, renombrar, duplicar, descargar, eliminar con confirmación y estado vacío. El trabajo interrumpido se retoma al volver. |
| Ajustes | Perfil, nombre de autor, tema (claro, oscuro o sistema), ejercicio preferido, reducir movimiento, opciones de demostración y cuenta. |
| Transversal (RD-06, RD-08) | Tema oscuro (la hoja del libro sigue blanca), `aria-live` con anuncios resumidos, foco visible, enlace “Saltar al contenido”, `prefers-reduced-motion` más la opción propia, y diseño responsive con cajón en móvil. |

## 2. Capa de datos: dos modos con la misma fachada

```
componentes ──► api (lib/api/index.ts) ──┬─► mock/api.ts  (modo demo: simulador en el navegador)
     ▲                                    └─► http/api.ts  (backend: REST + SSE)
     └── useEbook / useEbookList ◄── caché (store.ts)
```

El modo se elige al compilar con `NEXT_PUBLIC_API_MODE` (`mock` por defecto; `http` para usar el backend, con `NEXT_PUBLIC_API_URL`). Las dos implementaciones cumplen la interfaz `FolioApi` (`lib/api/contract.ts`) y comparten las transformaciones puras del ebook (`lib/api/local.ts`), así que los componentes no saben con cuál hablan.

**Modo demo** (lo que se publica en GitHub Pages):

- **`store.ts`** es la caché del cliente, expuesta con `useSyncExternalStore` y guardada en `localStorage` (`folio:datos:<correo>`). Normaliza los ebooks guardados con versiones anteriores (`normalizeEbook`).
- **`mock/simulator.ts`** reproduce el grafo de docs/03 §3: investigar → pausa → capítulo 1 → pausa → capítulos 2..N → maquetar (con contraportada). Cada tarea se puede cancelar y el trabajo interrumpido se retoma al recargar.
- **`mock/content.ts`** genera índices, capítulos, ejercicios y sinopsis con personas diversas (RÉR-03).
- **`mock/references.ts`** y **`mock/readings.ts`**: lecturas reales por nicho que se verifican en vivo contra Crossref y Open Library desde el navegador (las dos APIs admiten CORS).

**Modo con backend** (`http/`):

- **`client.ts`**: peticiones REST con el token de sesión (JWT) y errores traducidos a mensajes en español.
- **`sync.ts`**: las ediciones se aplican al instante en la caché y quedan como operaciones pendientes hasta que el servidor responde. Cada instantánea que llega del servidor se combina con ellas, así nunca se pierde lo que estás escribiendo. Las pulsaciones se agrupan (300 a 600 ms) antes de enviarse.
- **`events.ts`**: un solo stream SSE por usuario (`/api/events`), leído con `fetch` para poder enviar el token, con reconexión progresiva y recarga de la biblioteca al reconectar. `ebook.updated` reemplaza la instantánea, `token` añade texto en streaming y `notice` se anuncia por `aria-live`.
- La sesión (`lib/auth.tsx`) usa cuentas reales: registro, entrada, recuperar contraseña (en una instalación local el enlace aparece en la consola del servidor) y eliminar cuenta.

Funciones compartidas por los dos modos: **`lib/references/apa.ts`** (formato APA 7 en español, el mismo que `backend/app/references/apa.py`), **`lib/references/lookup.ts`** (búsqueda y verificación) y **`lib/cover-image.ts`** (reduce la imagen en el navegador y calcula el velo mínimo: mezcla el color del 5 % de píxeles más claros con la tela hasta que el texto blanco llega a 4,5:1).

## 3. Cómo usar el backend

1. Arranca el backend (ver [`backend/README.md`](../backend/README.md)).
2. Copia `frontend/.env.example` como `frontend/.env.local` (trae `NEXT_PUBLIC_API_MODE=http`).
3. Ejecuta `npm run dev` y crea una cuenta: los ebooks, las pausas y las exportaciones viven en el servidor.

## 4. Verificación realizada

- `npm run lint`, `tsc --noEmit` y `npm run build` sin errores.
- Recorrido completo automatizado con Playwright (Edge) en escritorio (1440 × 900) y móvil (390 × 844): acceso, ficción, investigación, punto de control 1 (editar, pedir otra versión, reordenar con teclado), capítulo 1 con ajustes, redacción, error simulado y reintento, revisión final, exportación a Markdown, vista de impresión, biblioteca, ajustes y tema oscuro. **Sin errores de consola.**

Además hay **pruebas de aceptación por requerimiento** (`frontend/e2e/requisitos.spec.ts`, 18 pruebas) y de las funciones de la fase 4 (`frontend/e2e/portada-referencias.spec.ts`: portada ampliada y contraportada, RD-04; referencias, RD-09). En las pruebas, Crossref y Open Library se simulan para no depender de la red. El resultado y las evidencias están en [09-verificacion-requerimientos](./09-verificacion-requerimientos.md).

## 5. Limitaciones conocidas

- **Modo demo:** los textos son plantillas (sirven para probar la interfaz, no la calidad de la redacción), el campo libre de ajustes del capítulo 1 se interpreta de forma básica, el PDF depende del diálogo de impresión del navegador y los datos viven en el navegador.
- **Con backend:** no hay "Continuar con Google" ni envío de correos; la recuperación de contraseña muestra el enlace en la consola del servidor.
- La imagen de portada debe ser propia o con permiso: Folio no genera imágenes con IA (D-15).
- Las referencias no se citan solas en el texto: Folio da la cita "(Autor, año)" para pegarla donde corresponda (D-38).
- Con una imagen muy clara de fondo, el velo mínimo es alto (el título tiene que leerse); para ver más la imagen conviene ponerla "En recuadro".
