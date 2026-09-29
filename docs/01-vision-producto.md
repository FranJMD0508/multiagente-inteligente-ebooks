# 01 · Visión del producto

> Fuente de verdad de los requerimientos: [`requerimientos.txt`](./requerimientos.txt).
> Este documento explica **qué** es el producto y **para quién**. El **cómo** está en los documentos 03 (arquitectura) y 04 (experiencia de usuario).

## 1. Resumen

**Folio** es una aplicación web en la que un **sistema de cuatro agentes de IA** investiga, redacta, crea ejercicios y maqueta **ebooks cortos de crecimiento personal** (entre 5 y 7 capítulos, unas 15 a 30 páginas) sobre situaciones de la vida real. El usuario conserva el control creativo mediante **dos puntos de validación humana**. Al terminar obtiene un archivo **Markdown** limpio y un **PDF** accesible, listo para leer, compartir o vender.

## 2. Problema

Escribir un ebook práctico, aunque sea corto, implica varios trabajos distintos: investigar el tema, armar una estructura coherente, redactar con un tono consistente, diseñar ejercicios útiles y maquetar el resultado. Para un creador independiente o un docente esto significa días de trabajo. Por otro lado, pedirle un ebook a un chat de IA genérico suele dar textos planos, repetitivos o "de relleno", sin estructura editorial, con un formato difícil de exportar y sin que la persona pueda validar el rumbo antes de que se genere todo el contenido.

## 3. Propuesta de valor

| Para el usuario | Cómo lo logra el sistema |
|---|---|
| **Rapidez**: pasa de una idea a un ebook terminado en una sola sesión | Hay agentes especializados trabajando en cadena, y cada capítulo se genera en menos de 60 segundos (RNF-02) |
| **Control**: el resultado es suyo, no el de la IA | Hay dos pausas obligatorias de aprobación (índice y capítulo 1), además de edición manual y personalización del diseño |
| **Calidad editorial**: estructura, tono y coherencia | Todos los capítulos siguen la misma estructura (RF-03), el tono es conversacional y empático (RNF-01) y hay coherencia entre capítulos (RNF-03) |
| **Utilidad real**: el lector sale con algo que hacer | Cada capítulo cierra con un ejercicio accionable: un checklist o un reto de 24 a 48 horas (RF-04) |
| **Listo para publicar** | Exporta a `.md` y PDF con jerarquía accesible, buen contraste y tipografía legible (RF-06, RA-01, RA-03) |
| **Responsabilidad** | El contenido es original (RÉR-01), incluye un aviso legal automático en temas sensibles (RÉR-02) y evita estereotipos (RÉR-03) |

## 4. Usuarios

La herramienta está pensada para **dos perfiles a la vez**. La interfaz no da por hecho ningún fin comercial: sirve igual para vender que para uso personal o educativo.

### Persona A: creadora de contenido

- **Valeria, 28 años.** Tiene una comunidad en redes sociales sobre finanzas personales y vende guías digitales en plataformas como Hotmart o Gumroad.
- **Objetivo:** sacar ebooks nuevos con frecuencia, que se vean profesionales y que suenen a ella.
- **Frustraciones:** redactar le quita mucho tiempo; lo que genera la IA "suena a IA"; maquetar el PDF es tedioso.
- **Qué necesita de la herramienta:** control sobre el índice y el tono, poder editar el texto a mano, una portada con su nombre y un PDF listo para vender.

### Persona B: docente u orientador

- **Andrés, 41 años.** Es orientador en una universidad y quiere material breve sobre gestión del tiempo y manejo del estrés para sus estudiantes de primer año.
- **Objetivo:** tener recursos claros, accesibles y con ejercicios que los estudiantes puedan aplicar de inmediato.
- **Frustraciones:** el material disponible es muy académico o muy superficial.
- **Qué necesita de la herramienta:** lenguaje claro (RA-02), un aviso legal cuando el tema toca la salud emocional (RÉR-02) y un PDF que funcione con lectores de pantalla (RA-01).

### Lector final (usuario indirecto)

Es quien compra o recibe el ebook. No usa la aplicación, pero condiciona muchos requerimientos: legibilidad, accesibilidad, tono cercano, ejercicios prácticos, ausencia de sesgos y transparencia (el aviso legal).

## 5. Qué produce el sistema: anatomía de un ebook

```
┌──────────────────────────────┐
│ Portada                      │  título, subtítulo, autor y estilo elegido por el usuario
├──────────────────────────────┤
│ Aviso legal (condicional)    │  obligatorio si el tema es sensible (RÉR-02)
├──────────────────────────────┤
│ Índice                       │  5 a 7 capítulos (RF-02)
├──────────────────────────────┤
│ Capítulo N  (× 5-7)          │  estructura fija (RF-03):
│   · Introducción             │
│   · Desarrollo               │  tono conversacional y directo
│   · Ejemplos cotidianos      │  sin estereotipos (RÉR-03)
│   · Conclusión               │
│   · Ejercicio práctico       │  checklist o reto de 24-48 h (RF-04)
└──────────────────────────────┘
```

**Extensión objetivo:** de 15 a 30 páginas en total, es decir, unas 2 a 4 páginas por capítulo. Como referencia, en formato A5 con cuerpo de 11 pt, eso equivale a unas **800 a 1.200 palabras por capítulo**. La cifra final depende del tamaño de página elegido (ver [06-decisiones](./06-decisiones.md)).

## 6. Temáticas (nichos)

Solo **no ficción de crecimiento personal aplicada a situaciones reales** (RF-01). Algunos ejemplos de nichos:

- Finanzas para universitarios
- Gestión del tiempo y productividad
- Resolución de conflictos
- Hábitos y rutinas
- Comunicación asertiva
- Manejo del estrés y bienestar emocional
- Primer empleo y vida laboral
- Organización del estudio

El sistema **rechaza la ficción** (novelas, cuentos, fan fiction, etc.). Cuando el usuario pide algo así, la interfaz le propone de forma amable reformular la idea como una guía práctica.

## 7. Alcance

### Dentro del alcance

- Crear un ebook a partir de un prompt libre o de un nicho sugerido.
- Pipeline de cuatro agentes con avance visible en tiempo real.
- Dos puntos de validación humana, con opciones para aprobar, editar o regenerar.
- Editor para ajustar el contenido antes de exportar.
- Personalización de la portada y del estilo del PDF, dentro de las restricciones de accesibilidad.
- Exportación a `.md` y PDF.
- Biblioteca con los ebooks del usuario (historial y reanudación).
- Cuentas de usuario (registro e inicio de sesión).

### Fuera del alcance (por ahora)

- Ficción de cualquier tipo.
- Ebooks largos (más de 7 capítulos).
- Publicación directa en marketplaces (Amazon KDP, Hotmart, etc.).
- Generación de imágenes con IA para portadas o ilustraciones.
- Edición colaborativa en tiempo real entre varios usuarios.
- Pagos y suscripciones.
- Traducción automática a otros idiomas.

## 8. Glosario

| Término | Definición |
|---|---|
| **Nicho** | Área temática de crecimiento personal sobre la que trata el ebook (p. ej., finanzas para universitarios). |
| **Temario / Índice** | Lista de 5 a 7 capítulos, cada uno con título y resumen, que propone el Agente Investigador. |
| **Agente** | Componente del backend con un rol y un prompt propios. Hay cuatro: Investigador, Redactor, Ejercicios y Maquetador/Exportador. |
| **Pipeline** | Secuencia de trabajo de los agentes, desde la investigación hasta la exportación. |
| **Punto de control (checkpoint) / HITL** | Pausa obligatoria en la que el sistema espera la aprobación del usuario (*Human-in-the-Loop*). Hay dos: después del índice y después del capítulo 1. |
| **Capítulo ancla** | El capítulo 1 una vez aprobado. Sirve de referencia de tono y formato para el resto de capítulos. |
| **Guía de estilo** | Resumen interno (persona gramatical, registro, glosario de términos, formato) que se extrae del capítulo ancla para mantener la coherencia (RNF-03). |
| **Ejercicio práctico** | Cierre accionable de cada capítulo: un *checklist* de autoevaluación o un *reto de 24-48 h*. |
| **Aviso legal / Disclaimer** | Texto visible que aclara que el contenido es educativo y no sustituye la asesoría profesional. |
| **Maquetación** | Armado del documento final: portada, aviso, índice, capítulos, jerarquía de encabezados y estilo visual. |
