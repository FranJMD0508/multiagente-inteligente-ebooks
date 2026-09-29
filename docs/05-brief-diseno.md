# 05 · Brief de diseño (punto de partida para la fase de diseño)

> Este documento **no es el diseño**: reúne lo necesario para diseñarlo bien. La dirección visual definitiva sale de la fase de diseño (brainstorming → direcciones → prototipo) y se documentará aparte.
>
> **Resultado (2026-09-28):** el diseño está en [07-diseno-interfaz](./07-diseno-interfaz.md). La tensión de §5 sobre la tipografía se resolvió sin serif: el carácter de libro lo dan los objetos (página, cinta, portadas) y se usa Lexend para los títulos. Las preguntas de §8 quedaron resueltas en D-17 a D-28.

## 1. Objetivo

Diseñar una interfaz **impecable, con identidad propia y que no parezca hecha por IA**, inspirada en la calma, la amplitud y la fluidez de **Gemini**, para una herramienta cuyo resultado final es un **libro**.

## 2. Qué tomar de Gemini (y qué no)

La inspiración está en la **estructura y la sensación**. La **identidad visual** tiene que ser nuestra.

| Referencia | Qué tomar | Qué evitar copiar |
|---|---|---|
| **Gemini: inicio** | El saludo personalizado; la caja de prompt como protagonista absoluta; mucho espacio en blanco; los chips de sugerencias; la sensación de calma y de "una sola cosa que hacer" | El degradado azul-violeta-rosa del saludo y el icono de destello ✦: son la firma de Google y el cliché visual de "producto de IA" |
| **Gemini: barra lateral** | Colapsable y discreta; historial agrupado por fecha; "Nuevo" siempre a mano | — |
| **Gemini Deep Research** | **El patrón exacto de nuestro punto de control 1**: presenta un plan, deja "Editar plan" o "Iniciar", y después muestra el avance con actividad concreta | La estética de "informe técnico" |
| **Gemini Canvas** | Conversación y documento **lado a lado**; el documento como objeto de trabajo, no como un mensaje | — |
| **Material 3 Expressive** | Superficies suaves, formas redondeadas con intención y movimiento con física (*springs*) | Aplicar Material tal cual: la app acabaría pareciendo "de Google" |

Otras referencias que vale la pena mirar durante el brainstorming: **NotebookLM** (fuentes y documento), **iA Writer** / **Reflect** (tipografía y escritura), **Linear** (oficio, detalle y velocidad percibida), **Readwise Reader** (lectura cómoda) y **Things 3** (calma y jerarquía).

## 3. "Que no parezca IA": definición operativa

### Patrones prohibidos (el "look IA genérico")

- Degradados violeta/azul/rosa sin propósito, "blobs" de aurora y fondos con brillos.
- Glassmorphism y sombras difusas en todo.
- ✨ Destellos, estrellitas y emojis usados como iconografía.
- Inter o la fuente del sistema **sin jerarquía**: todo con el mismo peso y tamaños parecidos.
- La cuadrícula de tres tarjetas iguales con icono, título y párrafo.
- Todo centrado, con ritmo de espaciado uniforme e igual `border-radius` en todos los elementos.
- El tema por defecto de shadcn/ui sin personalizar (el "look shadcn").
- Spinners genéricos y loaders que no dicen qué está pasando.
- Copy de relleno: "Desbloquea tu potencial", "Potenciado por IA", "Magia", "Revolucionario".

### Lo que sí buscamos

- **Identidad editorial:** es una herramienta para hacer libros. El contenido del libro (vista previa, lectura) usa **tipografía de libro** y la interfaz usa una sans funcional. El contraste entre "herramienta" y "obra" es parte de la identidad.
- **Oficio visible:** jerarquía tipográfica clara, grilla consistente, alineaciones precisas, estados cuidados (hover, focus, activo, deshabilitado) y detalles pequeños bien resueltos.
- **Movimiento con significado:** la animación cuenta lo que pasa. El libro "toma forma", los capítulos "se asientan" en el índice y el agente activo "respira". Nada de animar por decorar.
- **Color con intención:** una paleta contenida con un acento propio y memorable, usado con disciplina.
- **Texto humano:** microcopy cercano, concreto y en español natural (ver 04-experiencia-usuario §8).

## 4. Personalidad de la marca (propuesta para validar)

| Es | No es |
|---|---|
| Calmada | Sosa |
| Cálida | Infantil |
| Editorial | Anticuada |
| Precisa | Fría o técnica |
| Confiable | Corporativa |
| Moderna | "Futurista de IA" |

Metáfora de trabajo: **"un estudio editorial silencioso"**. Cuatro especialistas trabajan para ti mientras tú decides.

## 5. Restricciones que el diseño debe respetar

- **Salida PDF (RA-03):** el cuerpo del libro lleva fondo blanco, texto negro o gris oscuro, Roboto/Arial/Helvetica y 11 pt como mínimo. La **vista previa del libro** en la app debe reflejarlo con fidelidad, aunque la interfaz alrededor tenga más libertad.
  - *Tensión a resolver en diseño:* la identidad editorial pide una serif para el contenido, pero RA-03 exige una sans en el PDF. Propuesta: la **interfaz** puede usar una serif en títulos o saludos; la **vista previa del PDF** usa la fuente real de exportación.
- **Accesibilidad (RD-06):** WCAG 2.2 AA en los dos temas (claro y oscuro).
- **Tema claro y oscuro** desde el inicio (Gemini tiene ambos).
- **Español** en todo el copy; los textos suelen ser más largos que en inglés, así que los componentes deben aguantarlo.
- **Stack:** Tailwind CSS + shadcn/ui **muy personalizado** + Motion. Los componentes se pueden usar como base, pero el resultado no debe verse "de fábrica".
- **Rendimiento:** buenos Core Web Vitals. Las animaciones usan `transform` y `opacity`, las fuentes se cargan con `next/font` y se evitan capas pesadas de blur.

## 6. Pantallas clave para diseñar (prioridad)

1. **Inicio / Nuevo ebook**: la primera impresión y la pantalla más "Gemini".
2. **Espacio de trabajo en el punto de control 1** (índice editable + pipeline + vista previa).
3. **Espacio de trabajo en el punto de control 2** (lectura del capítulo 1 + pedir cambios).
4. **Espacio de trabajo durante la redacción** (streaming y lectura progresiva).
5. **Revisión final**: editor, portada y estilo, exportación.
6. **Biblioteca**.
7. Acceso (login/registro) y ajustes.

## 7. Proceso de diseño propuesto

| Paso | Qué se hace | Skills a usar |
|---|---|---|
| 1. Brainstorming | Explorar conceptos, metáforas y direcciones con preguntas | `brainstorming` |
| 2. Direcciones visuales | Dos o tres direcciones distintas (paleta, tipografía, forma, movimiento), vistas en la pantalla de inicio | `impeccable`, `frontend-design`, `design-taste-frontend`, `high-end-visual-design`, `top-design`, `ui-ux-pro-max` |
| 3. Sistema de diseño | Tokens de color, tipografía, espaciado, radios, sombras y movimiento, para claro y oscuro | `design-system-patterns`, `tailwind-design-system`, `web-typography`, `visual-design-foundations`, `shadcn` |
| 4. Prototipo | Pantallas clave en Next.js con mocks, navegables | `nextjs-app-router-patterns`, `vercel-composition-patterns`, `motion-framer`, `emil-design-eng`, `microinteractions` |
| 5. Revisión | Crítica heurística, accesibilidad, animaciones y rendimiento | `impeccable` (critique/audit/polish), `ux-heuristics`, `refactoring-ui`, `accessibility`, `review-animations`, `web-quality-audit` |

## 8. Preguntas para la fase de diseño

1. ¿Qué nombre tendrá el producto? (Afecta al logo, al tono y a la portada de acceso.)
2. ¿Qué color de acento lo representa? ¿Hay alguna asociación deseada (papel, tinta, calidez) o alguna a evitar?
3. ¿Serif editorial en la interfaz o una sans con carácter en todo?
4. ¿Cómo se representa visualmente a los cuatro agentes: iconos, avatares abstractos, solo texto?
5. ¿Cómo se organizan las zonas del espacio de trabajo en escritorio? (Ver 04 §4.4.)
6. ¿Tema claro como principal y oscuro como alternativo, o igual de prioritarios?
