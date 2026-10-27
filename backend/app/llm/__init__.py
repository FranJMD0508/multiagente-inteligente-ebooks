"""Capa de abstracción del LLM (D-06). Los agentes piden `get_provider()` y nada más."""

from __future__ import annotations

import logging

from ..config import Settings
from .base import LLMBlockedError, LLMError, LLMProvider
from .demo import DemoProvider

log = logging.getLogger("folio.llm")

__all__ = ["LLMBlockedError", "LLMError", "LLMProvider", "DemoProvider", "get_provider"]


def get_provider(settings: Settings) -> LLMProvider:
    """Crea el proveedor según `LLM_PROVIDER`. Sin clave, usa el demo y lo avisa en el log."""
    provider = _create(settings)
    provider.json_timeout_s = settings.llm_json_timeout_s
    return provider


def _create(settings: Settings) -> LLMProvider:
    choice = settings.llm_provider
    if choice == "gemini":
        if settings.gemini_api_key:
            from .gemini import GeminiProvider

            return GeminiProvider(
                settings.gemini_api_key,
                settings.gemini_model,
                thinking_level=settings.gemini_thinking_level,
                base_url=settings.gemini_base_url,
                timeout_s=settings.llm_timeout_s,
            )
        _warn_missing("gemini", "GEMINI_API_KEY")
    elif choice == "anthropic":
        if settings.anthropic_api_key:
            from .anthropic import AnthropicProvider

            return AnthropicProvider(
                settings.anthropic_api_key,
                settings.anthropic_model,
                effort=settings.anthropic_effort,
                timeout_s=settings.llm_timeout_s,
            )
        _warn_missing("anthropic", "ANTHROPIC_API_KEY")
    elif choice == "openai":
        if settings.openai_api_key:
            from .openai import OpenAIProvider

            return OpenAIProvider(
                settings.openai_api_key,
                settings.openai_model,
                base_url=settings.openai_base_url,
                timeout_s=settings.llm_timeout_s,
            )
        _warn_missing("openai", "OPENAI_API_KEY")
    demo = DemoProvider(delay_ms=settings.demo_delay_ms)
    for rule in filter(None, (r.strip() for r in settings.demo_fail.split(","))):
        demo.inject_rule(rule)
    return demo


def _warn_missing(provider: str, variable: str) -> None:
    log.warning(
        "LLM_PROVIDER=%s pero falta %s: se usa el proveedor 'demo' (textos simulados, sin conexión). "
        "Añade la clave en backend/.env para usar el modelo real.",
        provider,
        variable,
    )
