# 08 · Frontend (fase 3): implementación con datos simulados

> **Estado:** implementado el 2026-09-29 en [`frontend/`](../frontend). Sigue el diseño de [07-diseno-interfaz](./07-diseno-interfaz.md) y el contrato de [03-arquitectura](./03-arquitectura.md).
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
| Revisión final (RD-03, RD-04) | Pestaña **Texto**: editor por secciones con nombres fijos, barra de formato (negrita, cursiva, lista, cita, H3), H1/H2 convertidos en H3 (RA-01) y aviso legal bloqueado. Pestaña **Portada y estilo**: plantillas, telas, color personalizado con validación de contraste y tono accesible sugerido, letra, tamaño y página (RA-03). |
| Exportación (RF-06) | **Markdown** descargado desde el navegador. **PDF** mediante una vista de impresión con `@page` según el tamaño elegido (“Guardar como PDF”). |
| Biblioteca (RD-02, RD-07) | Estantería de portadas, cinta en los libros que esperan revisión, filtros con contador, búsqueda, renombrar, duplicar, descargar, eliminar con confirmación y estado vacío. El trabajo interrumpido se retoma al volver. |
| Ajustes | Perfil, nombre de autor, tema (claro, oscuro o sistema), ejercicio preferido, reducir movimiento, opciones de demostración y cuenta. |
| Transversal (RD-06, RD-08) | Tema oscuro (la hoja del libro sigue blanca), `aria-live` con anuncios resumidos, foco visible, enlace “Saltar al contenido”, `prefers-reduced-motion` más la opción propia, y diseño responsive con cajón en móvil. |

## 2. Cómo funciona la capa de datos simulada

```
componentes ──► api (lib/api/index.ts) ──► simulador (mock/simulator.ts)
     ▲                                          │
     └── useEbook / useEbookList ◄── caché (store.ts) ◄── updateEbook(...)
```

- **`store.ts`** es la caché del cliente. Se expone con `useSyncExternalStore` y se persiste en `localStorage` (`folio:datos:<correo>`).
- **`simulator.ts`** reproduce el grafo de docs/03 §3: investigar → pausa → capítulo 1 → pausa → capítulos 2..N → maquetar. Cada tarea se puede cancelar (`AbortController`) y el trabajo interrumpido se retoma al recargar la página.
- **`content.ts`** genera índices por nicho y capítulos con las cinco secciones, ejemplos con personas diversas (RÉR-03) y ejercicios de tipo checklist o reto de 24/48 h.
- **`guardrails.ts`** simula el guardarraíl de entrada (ficción) y los avisos legales por categoría.

## 3. Paso a la fase 4 (backend real)

1. Sustituir los métodos de `api` por llamadas a FastAPI (`/api/ebooks`, `/outline/approve`, `/chapters/1/regenerate`…).
2. Abrir el stream SSE de `/api/ebooks/{id}/events` y traducir cada evento (`agent.progress`, `token`, `checkpoint.required`…) a `updateEbook` sobre la caché.
3. Reemplazar `lib/auth.tsx` por el proveedor real (propuesta: Supabase Auth) manteniendo su interfaz.
4. Mover la exportación de PDF al Agente Maquetador (PDF etiquetado desde el servidor).
5. Eliminar `mock/` y la sección “Demostración” de Ajustes.

## 4. Verificación realizada

- `npm run lint`, `tsc --noEmit` y `npm run build` sin errores.
- Recorrido completo automatizado con Playwright (Edge) en escritorio (1440 × 900) y móvil (390 × 844): acceso, ficción, investigación, punto de control 1 (editar, pedir otra versión, reordenar con teclado), capítulo 1 con ajustes, redacción, error simulado y reintento, revisión final, exportación a Markdown, vista de impresión, biblioteca, ajustes y tema oscuro. **Sin errores de consola.**

Además hay **pruebas de aceptación por requerimiento** (`frontend/e2e/requisitos.spec.ts`, 18 pruebas). El resultado y las evidencias están en [09-verificacion-requerimientos](./09-verificacion-requerimientos.md).

## 5. Limitaciones conocidas de esta fase

- Los textos de los capítulos son plantillas: sirven para probar la interfaz, no para evaluar la calidad de la redacción (eso depende del LLM de la fase 4).
- El campo libre de ajustes del capítulo 1 solo se interpreta de forma básica (por ejemplo, “estudia y trabaja”).
- El PDF depende del diálogo de impresión del navegador; en Chrome y Edge sale etiquetado.
- Los datos viven en el navegador: no se comparten entre dispositivos.
