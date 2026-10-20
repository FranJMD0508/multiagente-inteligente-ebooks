"""Cargador de prompts (RNF-04).

Cada tarea tiene su archivo `.md` en esta carpeta, agrupado por agente:

    ---
    descripcion: Qué hace el prompt
    temperatura: 0.8
    max_tokens: 4096
    ---
    ---sistema---
    Instrucciones de sistema…
    ---usuario---
    Plantilla del mensaje con {placeholders}…

Solo se sustituyen los `{placeholders}` en minúsculas que el agente envía, así
los ejemplos de JSON con llaves se pueden escribir tal cual. Los archivos se
releen si cambian en disco (recarga en caliente), sin reiniciar el servidor.
"""

from __future__ import annotations

import re
import threading
from dataclasses import dataclass
from pathlib import Path

import yaml

PROMPTS_DIR = Path(__file__).resolve().parent
_PLACEHOLDER = re.compile(r"\{([a-z][a-z0-9_]*)\}")
_SYSTEM_MARK = "---sistema---"
_USER_MARK = "---usuario---"


@dataclass(frozen=True)
class PromptTemplate:
    name: str
    description: str
    temperature: float
    max_tokens: int
    system: str
    user: str

    def render(self, **values: object) -> tuple[str, str]:
        """Devuelve (sistema, usuario) con los placeholders sustituidos."""
        return _fill(self.system, values), _fill(self.user, values)


def _fill(template: str, values: dict[str, object]) -> str:
    def replace(match: re.Match[str]) -> str:
        key = match.group(1)
        if key not in values:
            return match.group(0)
        value = values[key]
        return "" if value is None else str(value)

    return _PLACEHOLDER.sub(replace, template).strip()


def parse_prompt(name: str, text: str) -> PromptTemplate:
    text = text.replace("\r\n", "\n")
    meta: dict = {}
    if text.startswith("---\n"):
        end = text.find("\n---\n", 4)
        if end == -1:
            raise ValueError(f"El prompt {name} tiene un front matter sin cerrar")
        meta = yaml.safe_load(text[4:end]) or {}
        text = text[end + 5 :]
    if _SYSTEM_MARK not in text or _USER_MARK not in text:
        raise ValueError(f"El prompt {name} necesita los bloques {_SYSTEM_MARK} y {_USER_MARK}")
    after_system = text.split(_SYSTEM_MARK, 1)[1]
    system, user = after_system.split(_USER_MARK, 1)
    return PromptTemplate(
        name=name,
        description=str(meta.get("descripcion", "")),
        temperature=float(meta.get("temperatura", 0.7)),
        max_tokens=int(meta.get("max_tokens", 2048)),
        system=system.strip(),
        user=user.strip(),
    )


class PromptLibrary:
    """Caché de plantillas con recarga en caliente por fecha de modificación."""

    def __init__(self, base_dir: Path = PROMPTS_DIR) -> None:
        self.base_dir = base_dir
        self._cache: dict[str, tuple[float, PromptTemplate]] = {}
        self._lock = threading.Lock()

    def get(self, name: str) -> PromptTemplate:
        """`name` es la ruta relativa sin extensión, p. ej. `redactor/capitulo`."""
        path = self.base_dir / f"{name}.md"
        mtime = path.stat().st_mtime
        with self._lock:
            cached = self._cache.get(name)
            if cached and cached[0] == mtime:
                return cached[1]
            template = parse_prompt(name, path.read_text(encoding="utf-8"))
            self._cache[name] = (mtime, template)
            return template

    def names(self) -> list[str]:
        return sorted(str(p.relative_to(self.base_dir).with_suffix("")).replace("\\", "/") for p in self.base_dir.rglob("*.md"))


prompts = PromptLibrary()
