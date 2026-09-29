# 07 · Diseño de interfaz: Folio

> **Estado:** propuesta v1 (2026-09-28), pendiente de revisión final del equipo antes de construir el frontend.
> **Referencia visual:** [`diseno/mesa-de-diseno.html`](./diseno/mesa-de-diseno.html). Se abre en cualquier navegador y contiene maquetas de todas las pantallas, los estados y el sistema visual.
> **Base:** [04 · Experiencia de usuario](./04-experiencia-usuario.md) (qué hace cada pantalla) y [05 · Brief de diseño](./05-brief-diseno.md) (punto de partida). Si algo de este documento contradice al 04, **manda este**.

---

## 1. Decisiones de diseño en una tabla

| Tema | Decisión |
|---|---|
| Nombre del producto | **Folio** |
| Dirección visual | **“Mesa en calma” con alma de libro**: limpia, moderna y aireada, con formas redondeadas. El carácter de libro lo dan los *objetos* (página, cinta, portadas) y no la tipografía. |
| Tipografía | **Lexend** para títulos, **Onest** para la interfaz y **Roboto** para el cuerpo del ebook (RA-03). Sin serif “elegantes”, porque cansan. |
| Pantalla de inicio | Variante **Página**: una sola página sobre la mesa, con la caja de texto como protagonista. |
| Espacio de trabajo | **Libro abierto**: *a la izquierda decides, a la derecha ves tu libro*. |
| Proceso visible | Por **fases**, cada una con quién trabaja en ella; el usuario aparece como **“Tú”** en las pausas. |
| Punto de control 2 | **Ajustes rápidos** (chips + campo libre) y **editar a mano**. |
| Revisión final | En el mismo espacio de trabajo: pestañas **Texto** y **Portada y estilo**, con **Exportar** en la cabecera. |
| Biblioteca | Una estantería de portadas con color de tela; la cinta marca los libros que esperan tu revisión. |
| Móvil | El libro abierto se convierte en las pestañas **Decidir** y **Tu libro**, con la acción principal fija abajo. |

---

## 2. Principios

1. **La calma de Gemini, la identidad de un libro.** Mucho aire, un solo foco por pantalla, sin degradados violeta, destellos ni glassmorphism.
2. **El libro está en los objetos.** La página, la cinta marcapáginas, la portada con su color de tela, la cabecera, la capitular y el número de página. Cada uno tiene una función; ninguno es decoración.
3. **Una regla que no cambia.** En el espacio de trabajo, la página izquierda siempre es lo que decides y la derecha siempre es tu libro.
4. **Se ve el trabajo.** Las fases, la bitácora de actividad y el texto en vivo evitan los spinners genéricos.
5. **No se puede romper el libro.** La interfaz impide los estados inválidos: salir del rango de 5 a 7 capítulos, borrar secciones obligatorias, quitar el aviso legal o bajar de 11 pt.
6. **La cinta solo aparece cuando es tu turno.** Es la única señal que pide atención.

---

## 3. Sistema visual

### 3.1 Color

**Tema claro**

| Token | Valor | Uso |
|---|---|---|
| `mesa` | `#EEF0F3` | Fondo general (la “mesa” donde se apoyan las páginas) |
| `barra` | `#F7F8FA` | Barra lateral y filas secundarias |
| `pagina` | `#FFFFFF` | Páginas, tarjetas, campos |
| `texto` | `#1B1D23` | Texto principal |
| `grafito` | `#5A606C` | Texto secundario |
| `tenue` | `#6E7480` | Metadatos, cabeceras, números de página (4,7:1 sobre blanco) |
| `linea` | `#E3E6EB` | Bordes y separadores |
| `tinta` | `#0E7C74` | Acción principal, foco, estados activos, cinta (5,0:1 sobre blanco) |
| `menta` | `#DFF1EE` | Fondo de “Tu turno” y de avisos positivos |
| `tinta-oscura` | `#0B5A53` | Texto sobre menta |
| `error` | `#B3261E` | Errores |

**Tema oscuro**

| Token | Valor | Nota |
|---|---|---|
| `mesa` | `#121417` | |
| `barra` | `#181B20` | |
| `superficie` | `#1F2329` | Tarjetas y páginas de la interfaz |
| `texto` | `#E8EAEE` | |
| `grafito` | `#A4ABB7` | |
| `tinta` | `#4FB8AD` | Versión aclarada para mantener el contraste |
| `menta` | `#173C38` | |
| **Hoja del libro** | `#FFFFFF` | **La vista previa del ebook sigue siendo blanca en tema oscuro**, porque representa el PDF real (RA-03). |

**Telas de portada** (una por nicho; el usuario puede cambiarla). Todas superan 4,5:1 con texto blanco:

| Tela | Valor | Nicho sugerido |
|---|---|---|
| Botella | `#2F6B58` | Finanzas |
| Añil | `#3B4A9E` | Tiempo y estudio |
| Vino | `#8C2F45` | Conflictos y comunicación |
| Ocre | `#9A6A12` | Bienestar y hábitos |
| Petróleo | `#1E5E73` | Vida laboral y vida adulta |

### 3.2 Tipografía

| Rol | Fuente | Uso | Escala sugerida |
|---|---|---|---|
| Display | **Lexend** 500 | Saludo del inicio | 40/44 px, tracking −0,035em |
| Título de pantalla | Lexend 500 | “Biblioteca”, “Tu turno: revisa el índice” | 24–28 px |
| Título de libro / capítulo | Lexend 500–600 | Portadas, índice, capítulos, capitular | 18–22 px |
| Interfaz | **Onest** 400–600 | Botones, menús, formularios, estados | 16 px base; 14 y 12,5 px para secundarios |
| Cuerpo del ebook | **Roboto** 400 | Vista previa y PDF | 11 pt como mínimo en el PDF (RA-03) |

### 3.3 Forma, espacio e iconos

- **Página:** radio de 16 px, dos hojas apiladas debajo (sombras finas) y una sombra suave de elevación.
- **Tarjetas:** radio de 12–16 px y un solo nivel (nunca tarjetas dentro de tarjetas).
- **Controles:** píldora para botones, chips, pestañas y selectores segmentados.
- **Portadas:** proporción 2:3, esquinas algo más redondeadas del lado derecho y un sombreado de lomo a la izquierda.
- **Espaciado:** escala de 4 px, con más aire sobre los títulos que debajo.
- **Iconos:** una sola familia de trazo fino (1,5 px) con puntas redondeadas; nunca emojis ni glifos.

### 3.4 Elementos de libro

| Elemento | Función |
|---|---|
| **Página** | Superficie principal. El inicio es una página y el espacio de trabajo es un libro abierto. |
| **Cinta marcapáginas** | Marca **solo** lo que el usuario tiene que revisar (“Tu turno”). |
| **Portada con tela** | Identidad de cada ebook en la biblioteca, la barra lateral, la cabecera y el PDF. |
| **Cabecera** | Autor y título en la parte superior de la vista previa, como en un libro real. |
| **Capitular** | Primera letra del capítulo en Lexend y color tinta. |
| **Número de página** | Al pie de cada página de la vista previa. |

---

## 4. Estructura de la aplicación

### 4.1 Rutas

| Ruta | Pantalla |
|---|---|
| `/login`, `/registro`, `/recuperar` | Acceso |
| `/` | Inicio (nuevo ebook) |
| `/biblioteca` | Biblioteca |
| `/ebook/[id]` | Espacio de trabajo. Muestra la etapa actual del ebook, incluida la revisión final (con pestañas Texto y Portada y estilo). |
| `/ajustes` | Ajustes |

> Cambio respecto al 04: la revisión final **no** tiene ruta propia. Se hace dentro de `/ebook/[id]` para mantener la regla del libro abierto.

### 4.2 Estructura común

- **Barra lateral completa** (inicio, biblioteca y ajustes): marca, “Nuevo ebook”, Biblioteca, Recientes con mini portadas e insignias de estado, y usuario.
- **Riel de iconos** (en el espacio de trabajo): la barra lateral se reduce a iconos para dejar espacio al libro abierto.

---

## 5. Pantallas

### 5.1 Acceso (RD-01)
- La misma página del inicio con el formulario, y dos portadas asomando detrás.
- Titular: “Tu próximo ebook empieza aquí”. Botón “Continuar con Google”, correo y contraseña, “Entrar”, “¿Olvidaste tu contraseña?” y “Crear cuenta”.
- Estados: credenciales inválidas (mensaje en línea que conserva el correo) y cargando.

### 5.2 Inicio (RF-01)
- Una página sobre la mesa, con la cinta asomando y la cabecera “Folio · Nuevo ebook”.
- Saludo “Hola, {nombre}” (el nombre en color tinta) y la pregunta “¿Sobre qué quieres escribir hoy?”.
- Caja de texto protagonista, con píldoras de ajustes opcionales dentro (número de capítulos 5/6/7/automático y público objetivo) y botón de enviar redondo.
- Chips de nichos con su color de tela: rellenan la caja **sin enviarla**.
- Número de página “1” al pie.

### 5.3 Espacio de trabajo: anatomía
1. **Cabecera:** mini portada, título, nicho o estado, indicador de guardado, menú y, en la revisión final, el botón **Exportar**.
2. **Proceso por fases** (ver §6).
3. **Libro abierto:** a la izquierda la etapa (fondo blanco con una leve sombra de pliegue hacia el centro) y a la derecha la vista previa.

| Etapa | Página izquierda: lo que decides | Página derecha: tu libro |
|---|---|---|
| Investigación | Bitácora del Investigador e índice que va apareciendo | Portada con el título tentativo e índice parcial |
| Punto de control 1 | Índice editable | Portada, aviso legal e índice |
| Capítulo 1 en redacción | Avance por secciones | Capítulo 1 en vivo |
| Punto de control 2 | Ajustes rápidos y aprobación | Capítulo 1 maquetado |
| Redacción del resto | Avance por capítulo | El capítulo en curso, en vivo |
| Revisión final | Pestañas Texto y Portada y estilo | El libro completo con paginación |

### 5.4 Investigación (RF-02, RNF-02)
- Transición principal: **el libro se abre** (ver §8).
- Título “Estamos armando tu índice” con el texto “Suele tardar menos de un minuto. Puedes salir: te avisaremos cuando sea tu turno.”
- Bitácora con líneas concretas: tema válido, público, tema sensible (si aplica) y “Proponiendo capítulos · 4 de 6”.
- Los capítulos aparecen uno a uno; los que faltan se muestran como esqueletos.

### 5.5 Punto de control 1: índice (RF-02, RF-05, RÉR-02)
- Cae la cinta, la fase “Revisión del índice · Tú” se activa y aparece el título “Tu turno: revisa el índice”, con el subtítulo “6 capítulos · entre 5 y 7 · arrastra para reordenar”.
- Cada fila tiene asa de arrastre, número, título, resumen, **editar** y **regenerar este capítulo**.
- “Agregar capítulo” (fila con borde discontinuo) y el aviso “Incluirá un aviso legal porque el tema es financiero” cuando aplica.
- Acciones: “Pedir otra versión” (secundaria) y **“Aprobar índice”** (principal).
- **Estados:**
  1. *Editar en el mismo lugar*: la fila se abre con campos de título y resumen y los botones Cancelar y Guardar.
  2. *Límite visible*: con 7 capítulos, “Agregar” queda deshabilitado y un tooltip dice “Un ebook de Folio tiene entre 5 y 7 capítulos…”; con 5, lo mismo para “Eliminar”.
  3. *Pedir otra versión*: campo libre y chips (“Más práctico”, “Otro enfoque”, “Menos capítulos”) con el botón “Proponer otra versión”.
  4. *Reescribiendo*: el índice actual se atenúa y aparecen esqueletos con el texto “El Investigador está preparando otra versión…” y el enlace “Mantener la versión actual”. Siempre se puede volver a la versión anterior.
- **Teclado:** con el foco en una fila, se puede subir o bajar el capítulo sin arrastrar.

### 5.6 Punto de control 2: capítulo 1 (RF-03, RF-04, RF-05, RNF-01)
- Título “Tu turno: revisa el capítulo 1” con el subtítulo “Versión N · ~palabras · páginas”.
- Aviso destacado en menta: **“Este capítulo marcará el tono y el formato de todo el libro.”**
- **Estructura:** chips con visto para Introducción, Desarrollo, Ejemplos cotidianos, Conclusión y el tipo de ejercicio (checklist o reto de 24/48 h).
- **“¿Qué ajustamos?”:** chips “Más cercano”, “Más ejemplos”, “Más corto”, “Menos formal” y “Otro tipo de ejercicio” (se pueden elegir varios), más un campo libre opcional.
- Acciones: “Editar a mano” y “Aplicar ajustes” (secundarias) y **“Aprobar y escribir el resto”** (principal).
- Cada ajuste aplicado genera una **versión nueva**, y se puede volver a la anterior.
- Si el usuario edita a mano, su versión pasa a ser el capítulo ancla (D-10).

### 5.7 Redacción del resto (RNF-02, RNF-03, RD-05)
- Título “Escribiendo tu libro” con el subtítulo “Capítulo 3 de 6 · faltan unos 3 minutos · puedes salir cuando quieras”.
- Lista de avance por capítulo:
  - Terminado: “Listo”, con el enlace “Leer ahora”.
  - En curso: resaltado, con la sección actual y una barra de cinco segmentos (las secciones).
  - Pendiente: “En espera”.
- Nota: “Cada capítulo sigue el tono y el formato del capítulo 1 que aprobaste.”
- En la derecha, el texto aparece en vivo con cursor tinta.
- Al terminar, el Maquetador arma el libro y aparece “Tu ebook está listo”.

### 5.8 Revisión final (RD-03, RD-04, RF-06, RA-01, RA-03, RÉR-01, RÉR-02)

**Pestaña Texto (editor)**
- Selector de capítulo con flechas de anterior y siguiente.
- Barra de formato mínima: negrita, cursiva, lista, cita y H3. **No hay H1 ni H2 manuales.**
- Una sección por bloque. El **nombre de la sección es fijo** (candado) y el contenido es editable.
- Guardado automático: “Guardado hace unos segundos”.
- El **aviso legal** aparece como bloque bloqueado, con el texto “Se incluye automáticamente porque el tema es financiero”.
- En la derecha, la página correspondiente se actualiza en vivo y hay paginación (“Página 11 de 22”).

**Pestaña Portada y estilo**
- Título, autor y subtítulo.
- Plantilla de portada: Clásica, Centrada o Franja.
- Color de tela, con **validación de contraste en vivo** (“Contraste 7,2:1 ✓”). Si no cumple, se sugiere el tono accesible más cercano.
- Letra del cuerpo: Roboto, Arial o Helvetica. Tamaño: 11, 12 o 13 pt. Página: A5, A4, Carta o 6 × 9 in.
- Nota fija: “Fondo blanco y texto oscuro fijos para que el PDF se lea bien (RA-03).”
- En la derecha, la portada grande se actualiza al instante.

**Exportar** (se abre desde la cabecera)
- Formatos: **PDF** (“Listo para leer, compartir o vender”) y **Markdown** (“Texto limpio para otras herramientas”).
- Nombre de archivo editable y un resumen en chips: capítulos, páginas, aviso legal, tamaño y letra.
- Nota: “Contenido original generado con asistencia de IA.”
- Botones: Cancelar y **Descargar PDF / Descargar Markdown**.

### 5.9 Biblioteca (RD-02, RD-07)
- Título “Biblioteca”, buscador (“Buscar por título”) y filtros con contador: Todos, Tu turno, Escribiendo, Listos.
- Cuadrícula de portadas. Cada libro muestra su título, estado y fecha.
  - **Tu turno**: la cinta cuelga de la portada y lleva la píldora menta “Tu turno”.
  - **Escribiendo**: barra de progreso con “3 de 6”.
  - **Listo**: “Listo · hace 2 días”.
- Acciones por libro (menú): abrir, renombrar, descargar, duplicar y eliminar (con confirmación en la propia página).
- Estado vacío: estantería con portadas punteadas, el título “Tu estantería está vacía” y el botón “Crear mi primer ebook”.

### 5.10 Ajustes
- **Perfil:** nombre y nombre de autor (el valor inicial de las portadas).
- **Preferencias:** tema (Claro / Oscuro / Sistema), ejercicio preferido (Que decida Folio / Checklist / Reto) y reducir movimiento.
- **Cuenta:** cambiar contraseña, cerrar sesión y eliminar cuenta.

---

## 6. Proceso y agentes

### 6.1 Fases visibles

| # | Fase | Quién |
|---|---|---|
| 1 | Índice | Investigador |
| 2 | Revisión del índice | **Tú** |
| 3 | Capítulo 1 | Redactor + Ejercicios |
| 4 | Revisión del capítulo 1 | **Tú** |
| 5 | Capítulos 2 a N | Redactor + Ejercicios |
| 6 | Libro final | Maquetador |

En la fase activa, el texto secundario detalla la actividad (por ejemplo, “Redactor escribiendo el 3”).

### 6.2 Estados

| Estado | Forma | Uso |
|---|---|---|
| En espera | Círculo hueco gris | Fase futura |
| Trabajando | Anillo tinta que gira despacio | Fase activa (lo único que se mueve) |
| Tu turno | Círculo con halo menta y punto tinta, más la cinta | Pausa HITL |
| Listo | Círculo tinta relleno con visto | Fase terminada |
| Con error | Círculo rojo con punto, mensaje y “Reintentar” | Fallo reintentable |

El estado nunca depende solo del color: también cambian la forma, el ícono y el texto.

### 6.3 Voz de los agentes
Cada agente usa su nombre de rol y verbos concretos: “Investigador · Proponiendo capítulos (4 de 6)”, “Redactor · Escribiendo el capítulo 3: Ejemplos cotidianos”, “Ejercicios · Creando un reto de 48 horas”, “Maquetador · Armando la portada y el índice”. **Nunca** “Procesando…”. Los agentes no tienen avatares ni personajes.

---

## 7. Estados transversales

| Situación | Diseño |
|---|---|
| **Ficción** (RF-01) | Debajo de la caja del inicio: “**Folio crea guías prácticas sobre situaciones reales.** ¿Probamos con alguna de estas ideas?” más 2 o 3 reformulaciones como chips. No es un error. |
| **Error reintentable** | Fila con borde rojo suave, el mensaje “No pudimos terminar el capítulo 4”, el texto “Lo que ya estaba escrito sigue a salvo.” y el botón **Reintentar**. |
| **Sin conexión** | Aviso oscuro discreto, “Sin conexión. Seguimos escribiendo tu libro.”, y reconexión automática. |
| **Libro listo** | Tarjeta con portada, el título “Tu ebook está listo” y el texto “Revísalo, dale tu estilo y descárgalo.” |
| **Vacío** | Estantería punteada y el botón “Crear mi primer ebook”. |
| **Cargando datos** | Esqueletos con la forma del contenido real. |

---

## 8. Movimiento

| # | Momento | Descripción | Duración aprox. |
|---|---|---|---|
| 1 | **El libro se abre** (momento principal) | Al enviar la idea, la página del inicio se desliza a la izquierda y aparece la derecha | 450 ms, salida suave |
| 2 | **Cae la cinta** | La cinta baja desde el borde cuando es tu turno; es la única animación que pide atención | 300 ms |
| 3 | **Los capítulos se asientan** | Entrada escalonada de los capítulos en el índice | 60 ms entre elementos |
| 4 | **La tinta escribe** | Streaming palabra a palabra con cursor tinta; el resto queda quieto | — |
| 5 | **El trabajo respira** | El anillo de la fase activa gira despacio | 1,1 s por vuelta |

Con `prefers-reduced-motion` o la opción “Reducir movimiento” se eliminan los desplazamientos y los giros, y quedan solo cambios de opacidad.

---

## 9. Responsive (RD-08)

| Ancho | Comportamiento |
|---|---|
| ≥ 1280 px | Experiencia completa: riel de iconos y libro abierto con las dos páginas |
| 1024–1279 px | Libro abierto con proporción 1,1 : 1 y la vista previa algo más angosta |
| 768–1023 px | Pestañas “Decidir” y “Tu libro”; barra lateral como cajón |
| < 768 px | Pestañas, acción principal fija abajo (al alcance del pulgar) y barra lateral como cajón con menú |

---

## 10. Accesibilidad (RD-06)

- WCAG 2.2 AA en los dos temas. Pares verificados: tinta sobre blanco 5,0:1, tenue sobre blanco 4,7:1 y telas con texto blanco ≥ 4,7:1.
- Todo se puede hacer con teclado, incluido reordenar el índice. El foco es visible (2 px, color tinta, separado 2 px).
- Anuncios resumidos con `aria-live="polite"`: “Capítulo 2 terminado”, “Es tu turno: revisa el índice”, “Tu ebook está listo”.
- Objetivos táctiles de 24 × 24 px como mínimo y de 44 × 44 px en móvil.
- `lang="es"`, texto base de 16 px y funcionamiento con zoom al 200 %.

---

## 11. Textos clave (microcopy)

| Lugar | Texto |
|---|---|
| Inicio | “Hola, {nombre}” · “¿Sobre qué quieres escribir hoy?” |
| Investigación | “Estamos armando tu índice” |
| Punto de control 1 | “Tu turno: revisa el índice” · “Aprobar índice” · “Pedir otra versión” |
| Límite | “Un ebook de Folio tiene entre 5 y 7 capítulos. Elimina uno para agregar otro.” |
| Punto de control 2 | “Este capítulo marcará el tono y el formato de todo el libro.” · “Aprobar y escribir el resto” |
| Redacción | “Escribiendo tu libro” · “Leer ahora” |
| Aviso legal | “Incluirá un aviso legal porque el tema es financiero.” |
| Exportar | “Exportar tu ebook” · “Contenido original generado con asistencia de IA.” |
| Listo | “Tu ebook está listo. Revísalo, dale tu estilo y descárgalo.” |
| Error | “No pudimos terminar el capítulo {n}. Lo que ya estaba escrito sigue a salvo.” |

---

## 12. Pendiente para una siguiente iteración de diseño

- **Logotipo definitivo.** La marca actual (un libro con cinta) es provisional.
- Maquetas completas del **tema oscuro** (los tokens ya están definidos).
- Diseño detallado de las **tres plantillas de portada** y de las páginas interiores del PDF: aviso legal, índice y página de capítulo.
- Definir el **mapeo final nicho → color de tela** para nichos nuevos.
- Crear cuenta y recuperar contraseña (derivan del diseño de Acceso).

---

## 13. Trazabilidad

| Requerimiento | Dónde se resuelve |
|---|---|
| RF-01 | Inicio (chips de nichos) y estado de ficción |
| RF-02 | Investigación y punto de control 1 (límite 5-7) |
| RF-03 | Estructura en el punto de control 2, bloques fijos del editor, vista previa |
| RF-04 | Chip de ejercicio en el punto de control 2, preferencia en Ajustes |
| RF-05 | Puntos de control 1 y 2, fase “Tú”, cinta, insignia “Tu turno” |
| RF-06 | Diálogo Exportar |
| RNF-01 | Chips de tono en el punto de control 2 |
| RNF-02 | Bitácora, streaming, tiempo estimado, lectura progresiva |
| RNF-03 | Nota “sigue el tono del capítulo 1” |
| RNF-04 | Fases con los cuatro agentes nombrados |
| RA-01 | Editor sin H1/H2 manuales, vista previa con jerarquía |
| RA-02 | Microcopy claro (y en los prompts, en el backend) |
| RA-03 | Portada y estilo con opciones restringidas y validación de contraste; hoja siempre blanca |
| RÉR-01 | Nota de transparencia en Exportar |
| RÉR-02 | Aviso en el punto de control 1, bloque bloqueado en el editor, resumen en Exportar |
| RÉR-03 | Ejemplos diversos en los datos de demostración |
| RD-01 a RD-08 | Acceso, Biblioteca, Editor, Portada y estilo, Fases, Accesibilidad, Reanudación (Biblioteca), Móvil |
