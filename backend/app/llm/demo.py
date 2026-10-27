"""Proveedor demo: sin red, determinista y con textos plausibles en español.

Sirve para las pruebas y para usar Folio sin clave de ningún LLM. Recibe la
tarea (`task`) y los datos estructurados de la petición (`context`) y fabrica
una respuesta con la misma forma que pediría el prompt real.
"""

from __future__ import annotations

import asyncio
import json
import re
import zlib
from collections.abc import AsyncIterator, Callable
from dataclasses import dataclass

from ..guardrails import FICTION_ALTERNATIVES, FICTION_REASON, HARMFUL_ALTERNATIVES, HARMFUL_REASON, is_fiction, is_harmful
from ..niches import detect_niche, get_niche
from .base import LLMError, LLMProvider
from .demo_content import BOOKS, GENERAL, PERIODS, READINGS


@dataclass
class FailRule:
    """Fallo simulado para las pruebas: `times` veces en la tarea `task` cuando `when(context)`."""

    task: str
    times: int = 1
    when: Callable[[dict], bool] | None = None
    hang: bool = False  # en lugar de fallar, se queda colgado (para probar el tiempo límite)


def _hash(text: str) -> int:
    return zlib.crc32(text.encode("utf-8"))


def _lower_first(text: str) -> str:
    return text[:1].lower() + text[1:] if text else text


def _upper_first(text: str) -> str:
    return text[:1].upper() + text[1:] if text else text


def topic_from_prompt(prompt: str) -> str:
    """Tema corto a partir de la idea libre (igual que el mock del frontend)."""
    t = re.sub(r"\s+", " ", prompt.strip())
    t = re.sub(r"^(quiero|me gustaría|necesito)\s+(un|una)\s+(ebook|libro|guía)\s+(sobre|de|para)\s+", "", t, flags=re.I)
    t = re.sub(r"^(un|una)\s+(ebook|libro|guía)\s+(práctica\s+)?(sobre|de|para)\s+", "", t, flags=re.I)
    t = re.split(r"[:.;!?]", t)[0]
    return " ".join(t.split(" ")[:8]).rstrip(",")


def _book(niche_id: str) -> dict:
    return BOOKS.get(niche_id) or {**GENERAL, "title": "", "subtitle": ""}


class DemoProvider(LLMProvider):
    name = "demo"

    def __init__(self, *, delay_ms: int = 35) -> None:
        super().__init__("demo-determinista")
        self.delay_ms = delay_ms
        self.fail_rules: list[FailRule] = []
        self.calls: list[str] = []

    # ----- utilidades para pruebas -----

    def inject_failure(self, task: str, times: int = 1, when: Callable[[dict], bool] | None = None, hang: bool = False) -> None:
        self.fail_rules.append(FailRule(task=task, times=times, when=when, hang=hang))

    def inject_rule(self, rule: str) -> None:
        """Fallo simulado desde la configuración (`DEMO_FAIL`): `tarea[@capítulo][xveces]`."""
        m = re.fullmatch(r"([a-z_.]+)(?:@(\d+))?(?:x(\d+))?", rule.strip())
        if not m:
            raise ValueError(f"DEMO_FAIL no válido: {rule!r} (usa tarea[@capítulo][xveces])")
        task, chapter, times = m.group(1), m.group(2), int(m.group(3) or 1)
        when = (lambda ctx, n=int(chapter): ctx.get("number") == n) if chapter else None
        self.inject_failure(task, times=times, when=when)

    async def _maybe_fail(self, task: str, context: dict) -> None:
        for rule in self.fail_rules:
            if rule.task == task and rule.times > 0 and (rule.when is None or rule.when(context)):
                rule.times -= 1
                if rule.hang:
                    await asyncio.sleep(3600)
                raise LLMError(f"Fallo simulado en {task}", retryable=False)

    async def _pause(self, factor: float = 1.0) -> None:
        if self.delay_ms > 0:
            await asyncio.sleep(self.delay_ms * factor / 1000)
        else:
            await asyncio.sleep(0)

    # ----- interfaz del proveedor -----

    async def _complete(
        self,
        task: str,
        system: str,
        prompt: str,
        *,
        temperature: float,
        max_tokens: int,
        json_mode: bool,
        context: dict,
    ) -> str:
        self.calls.append(task)
        await self._maybe_fail(task, context)
        await self._pause(10)
        builders: dict[str, Callable[[dict], dict]] = {
            "orquestador.guardarrail": self._guardrail,
            "investigador.indice": self._outline,
            "investigador.capitulo_alternativo": self._alternative,
            "investigador.lecturas": self._readings,
            "redactor.guia_estilo": self._style_guide,
            "ejercicios.ejercicio": self._exercise,
            "maquetador.contraportada": self._back_cover,
        }
        if task not in builders:
            raise LLMError(f"El proveedor demo no sabe responder a {task}")
        return json.dumps(builders[task](context), ensure_ascii=False)

    async def _stream(
        self,
        task: str,
        system: str,
        prompt: str,
        *,
        temperature: float,
        max_tokens: int,
        context: dict,
    ) -> AsyncIterator[str]:
        self.calls.append(task)
        await self._maybe_fail(task, context)
        if task != "redactor.capitulo":
            raise LLMError(f"El proveedor demo no sabe escribir {task}")
        text = self._chapter(context)
        # Trozos de unas 6 palabras, como el simulador del frontend.
        tokens = re.split(r"(\s+)", text)
        for i in range(0, len(tokens), 12):
            await self._pause()
            yield "".join(tokens[i : i + 12])

    # ----- Guardarraíl -----

    def _guardrail(self, ctx: dict) -> dict:
        idea = ctx.get("idea", "")
        if is_fiction(idea):
            return {
                "valido": False,
                "motivo": FICTION_REASON,
                "nichoId": "general",
                "sensibilidad": "ninguno",
                "publico": "",
                "alternativas": FICTION_ALTERNATIVES,
            }
        if is_harmful(idea):
            return {
                "valido": False,
                "motivo": HARMFUL_REASON,
                "nichoId": "general",
                "sensibilidad": "ninguno",
                "publico": "",
                "alternativas": HARMFUL_ALTERNATIVES,
            }
        niche = detect_niche(idea)
        return {
            "valido": True,
            "motivo": f"Guía práctica sobre {niche.label.lower()}",
            "nichoId": niche.id,
            "sensibilidad": niche.sensitivity,
            "publico": niche.audience,
            "alternativas": [],
        }

    # ----- Investigador -----

    def _outline(self, ctx: dict) -> dict:
        desired = ctx.get("desired", "auto")
        count = 6 if desired == "auto" else int(desired)
        niche_id = ctx.get("niche_id", "general")
        book = BOOKS.get(niche_id)
        seeds = (book or GENERAL)["outline"]
        variant = int(ctx.get("variant", 0))
        # Otra versión: rota el orden de los capítulos intermedios.
        ordered = [seeds[0], *reversed(seeds[1:6]), seeds[6]] if variant % 2 == 1 else list(seeds)
        chosen = ordered if count == 7 else [*ordered[: count - 1], ordered[6]]
        if book:
            title, subtitle = book["title"], book["subtitle"]
        else:
            title = _upper_first(topic_from_prompt(ctx.get("idea", ""))) or "Tu guía práctica"
            subtitle = "Una guía práctica para tu día a día"
        niche = get_niche(niche_id)
        return {
            "titulo": title,
            "subtitulo": subtitle,
            "publico": niche.audience,
            "sensibilidad": niche.sensitivity,
            "brief": {
                "conceptos": [seed[2][0] for seed in chosen][:6],
                "terminos": [_lower_first(seed[0].split(":")[0]) for seed in chosen][:4],
                "enfoque": "Guía práctica y cercana, con pasos pequeños y ejemplos de la vida diaria. Evita la teoría densa y las promesas exageradas.",
            },
            "capitulos": [{"titulo": t, "resumen": s, "puntosClave": list(kp)} for t, s, kp in chosen],
        }

    def _alternative(self, ctx: dict) -> dict:
        item = ctx.get("item", {})
        taken = set(ctx.get("taken", []))
        book = BOOKS.get(ctx.get("niche_id", ""))
        pool = [*(book["outline"] if book else []), *GENERAL["outline"]]
        for title, summary, kp in pool:
            if title not in taken and title != item.get("title"):
                return {"titulo": title, "resumen": summary, "puntosClave": list(kp)}
        return {
            "titulo": item.get("title", "Otra mirada al tema"),
            "resumen": (item.get("summary", "") + " Con más ejemplos prácticos.").strip(),
            "puntosClave": list(item.get("keyPoints", ["Explica la idea principal", "Muestra cómo aplicarla", "Propón un primer paso"])),
        }

    def _readings(self, ctx: dict) -> dict:
        excluded = {re.sub(r"\W+", " ", t.lower()).strip() for t in ctx.get("exclude", [])}
        pool = READINGS.get(ctx.get("niche_id", ""), []) + READINGS["general"]
        total = max(1, int(ctx.get("total_chapters", 5)))
        out: list[dict] = []
        seen: set[str] = set()
        for i, entry in enumerate(pool):
            key = re.sub(r"\W+", " ", entry["titulo"].lower()).strip()
            if key in excluded or key in seen:
                continue
            seen.add(key)
            out.append({**entry, "capitulos": [i % total + 1]})
            if len(out) >= int(ctx.get("max", 6)):
                break
        return {"lecturas": out}

    # ----- Redactor -----

    def _style_guide(self, ctx: dict) -> dict:
        return {
            "persona": "Tuteo y segunda persona, como alguien cercano que conoce el tema y no juzga.",
            "registro": "Conversacional y directo, con frases cortas y vocabulario cotidiano.",
            "glosario": [{"termino": t, "definicion": "Término que se usa siempre igual en el libro."} for t in ctx.get("terms", [])[:4]],
            "reglas": [
                "Párrafos de dos a cuatro frases.",
                "Un subtítulo ### por cada punto clave en el desarrollo.",
                "Una lista corta con pasos concretos en el desarrollo.",
                "Ejemplos con nombre, contexto y resultado realista.",
                "La conclusión propone un primer paso para esta semana.",
            ],
        }

    def _chapter(self, ctx: dict) -> str:
        item = ctx.get("item", {})
        number = int(ctx.get("number", 1))
        total = int(ctx.get("total", 6))
        adjustments = set(ctx.get("adjustments", []))
        book = _book(ctx.get("niche_id", "general"))
        seed = _hash(f"{ctx.get('ebook_id', '')}:{number}:{ctx.get('version', 0)}")
        kps = list(item.get("keyPoints", []))
        while len(kps) < 3:
            kps.append(["Da un primer paso", "Revisa cómo te fue", "Pide apoyo si lo necesitas"][len(kps)])
        kp1, kp2, kp3 = kps[:3]
        short = "mas_corto" in adjustments
        close = "mas_cercano" in adjustments or "menos_formal" in adjustments

        intro = [
            f"{item.get('summary', '')} En este capítulo vas a ver por qué importa y cómo empezar hoy, con pasos concretos y sin complicarte.".strip()
        ]
        if not short:
            intro.append(
                f"Te lo digo claro: si alguna vez sentiste que {book['pain']}, no estás fallando. Le pasa a muchísima gente y tiene solución."
                if close
                else f"Si alguna vez sentiste que {book['pain']}, no te pasa solo a ti. Le pasa a mucha gente, y la buena noticia es que tiene solución."
            )

        templates = [
            lambda kp: f"{'Vamos al grano' if close else 'Empecemos por lo básico'}: {_lower_first(kp)}. No hace falta hacerlo perfecto desde el primer día. Lo importante es que lo intentes esta misma semana y observes qué cambia.",
            lambda kp: f"Aquí está una de las ideas centrales: {_lower_first(kp)}. Cuando lo pones en práctica, las decisiones pequeñas empiezan a sumar y dejas de depender solo de la fuerza de voluntad.",
            lambda kp: f"Un error común es pensar que esto es solo para personas muy organizadas. En realidad, funciona mejor cuando lo haces simple y a tu medida: {_lower_first(kp)}, sin buscar la perfección.",
        ]
        development: list[str] = []
        for i, kp in enumerate((kp1, kp2, kp3)):
            if short and i == 2:
                continue
            development.append(f"### {kp}")
            development.append(templates[(i + seed) % 3](kp))
            if i == 1 and not short:
                development.append(
                    "- Empieza hoy, aunque sea con poco.\n"
                    "- Hazlo visible: anótalo donde lo veas cada día.\n"
                    "- Al final de la semana, revisa cómo te fue."
                )
                development.append("> Lo pequeño y constante pesa más que lo perfecto y ocasional.")

        people = ctx.get("people") or [{"nombre": "Daniela", "edad": 22, "contexto": "estudia de noche y trabaja en una cafetería"}]
        count = 2 if "mas_ejemplos" in adjustments else 1
        examples: list[str] = []
        for i in range(count):
            person = people[i % len(people)]
            problem = book["problems"][(seed + i) % len(book["problems"])]
            result = book["results"][(seed + i + 1) % len(book["results"])]
            period = PERIODS[(seed + i + 2) % len(PERIODS)]
            kp = kp1 if i == 0 else kp2
            examples.append(
                f"{person['nombre']}, de {person['edad']} años, {person['contexto']}. {problem} Decidió probar una idea de este capítulo: "
                f"«{kp}». Lo hizo de forma sencilla, sin cambiar toda su rutina de golpe. Al cabo de {period}, {result}"
            )

        last = number == total
        conclusion = " ".join(
            [
                f"Lo más importante de este capítulo cabe en tres ideas: {_lower_first(kp1)}, {_lower_first(kp2)} y {_lower_first(kp3)}. No tienes que aplicarlo todo de golpe.",
                "Con este capítulo cierras el libro, pero no el camino. Vuelve a estas páginas cuando lo necesites y quédate con lo que te funcione."
                if last
                else "Elige una idea y pruébala esta semana. En el siguiente capítulo seguimos avanzando.",
            ]
        )
        return "\n\n".join(
            [
                "## Introducción",
                "\n\n".join(intro),
                "## Desarrollo",
                "\n\n".join(development),
                "## Ejemplos cotidianos",
                "\n\n".join(examples),
                "## Conclusión",
                conclusion,
            ]
        )

    # ----- Ejercicios -----

    def _exercise(self, ctx: dict) -> dict:
        item = ctx.get("item", {})
        kps = list(item.get("keyPoints", [])) or ["Da un primer paso"]
        if ctx.get("type") == "reto":
            duration = ctx.get("duration", "48h")
            hours = "48" if duration == "48h" else "24"
            return {
                "tipo": "reto",
                "titulo": f"Reto de {hours} horas: {_lower_first(item.get('title', 'pon en práctica lo aprendido'))}",
                "duracion": duration,
                "pasos": [
                    "Elige un momento concreto de hoy para empezar y anótalo.",
                    f"Pon en práctica esta idea: {_lower_first(kps[0])}.",
                    f"Si te queda tiempo, suma esta otra: {_lower_first(kps[1])}." if len(kps) > 1 else "Repite la acción al día siguiente.",
                    "Al terminar, escribe en una frase cómo te fue y qué cambiarías.",
                ],
            }
        return {
            "tipo": "checklist",
            "titulo": "Checklist de autoevaluación: marca lo que ya haces",
            "items": [
                *[f"Ya probé esto: {_lower_first(kp)}" for kp in kps[:3]],
                "Tengo claro cuál será mi primer paso esta semana",
                "Sé a quién pedir apoyo si lo necesito",
            ],
        }

    # ----- Maquetador -----

    def _back_cover(self, ctx: dict) -> dict:
        titles = [_lower_first(t) for t in ctx.get("chapters", [])][:3]
        while len(titles) < 3:
            titles.append("cómo dar el primer paso")
        audience = _lower_first(ctx.get("audience", "personas que quieren mejorar en su día a día"))
        book = _book(ctx.get("niche_id", "general"))
        opening = (
            f"Si sientes que {book['pain']}, este libro es para ti."
            if int(ctx.get("variant", 0)) % 2 == 0
            else f"Este libro está pensado para {audience}."
        )
        blurb = (
            f"{opening} En «{ctx.get('title', 'este libro')}» encontrarás ideas claras y pasos pequeños que puedes aplicar desde esta semana. "
            f"Verás temas como {titles[0]}, {titles[1]} y {titles[2]}, con ejemplos de personas que viven situaciones parecidas a la tuya. "
            "Cada capítulo termina con un ejercicio breve para que lo pruebes en tu día a día. "
            "Sin tecnicismos ni fórmulas mágicas: una guía para avanzar a tu ritmo."
        )
        return {"sinopsis": blurb}
