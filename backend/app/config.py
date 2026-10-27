"""Configuración del backend, leída de variables de entorno y de `backend/.env`."""

from __future__ import annotations

import sys
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


def _default_pdf_channel() -> str:
    # En Windows se usa Edge, que ya viene instalado; en el resto, el Chromium de Playwright.
    return "msedge" if sys.platform == "win32" else ""


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ----- Proveedor de LLM -----
    llm_provider: Literal["gemini", "anthropic", "openai", "demo"] = "gemini"

    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"
    gemini_thinking_level: str = "low"
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta"

    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-5"
    # Esfuerzo de razonamiento de Claude (output_config.effort). Vacío = no se envía.
    anthropic_effort: str = "low"

    openai_api_key: str = ""
    openai_model: str = "gpt-5-mini"
    openai_base_url: str = ""

    # Tiempo máximo de una llamada al LLM que no es un capítulo (s).
    llm_timeout_s: float = 60.0
    # Tiempo máximo de una petición JSON completa, con todos sus reintentos y esperas (s).
    llm_json_timeout_s: float = 150.0
    # Pausa entre trozos del proveedor demo (ms). 0 en las pruebas.
    demo_delay_ms: int = 35
    # Solo para probar la interfaz con el proveedor demo: fallos simulados, separados por
    # comas, con la forma `tarea[@capítulo][xveces]`. Ejemplo: `redactor.capitulo@4x2`
    # hace fallar dos veces el capítulo 4 (el intento y el reintento automático).
    demo_fail: str = ""

    # ----- Pipeline -----
    # Tiempo límite por intento al escribir un capítulo (RNF-02).
    chapter_timeout_s: float = 60.0
    # Pausa entre capítulos que aparecen uno a uno en el índice (ms).
    ui_step_delay_ms: int = 300

    # ----- Datos y seguridad -----
    data_dir: Path = BACKEND_DIR / "data"
    secret_key: str = ""
    access_token_days: int = 30

    # ----- Web -----
    frontend_url: str = "http://localhost:3000"
    frontend_origins: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3100"

    # ----- Referencias (Crossref y Open Library) -----
    crossref_mailto: str = ""
    references_lookup: bool = True
    references_timeout_s: float = 8.0

    # ----- PDF -----
    pdf_browser_channel: str = _default_pdf_channel()
    # Tiempo máximo para generar un PDF (s).
    pdf_timeout_s: float = 90.0

    log_level: str = "INFO"

    @field_validator("data_dir", mode="before")
    @classmethod
    def _resolve_data_dir(cls, value: object) -> object:
        if isinstance(value, str) and value and not Path(value).is_absolute():
            return BACKEND_DIR / value
        return value

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.frontend_origins.split(",") if o.strip()]

    @property
    def db_path(self) -> Path:
        return self.data_dir / "folio.sqlite"

    @property
    def checkpoints_path(self) -> Path:
        return self.data_dir / "checkpoints.sqlite"


@lru_cache
def get_settings() -> Settings:
    return Settings()
