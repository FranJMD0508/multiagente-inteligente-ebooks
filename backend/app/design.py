"""Utilidades de diseño: contraste WCAG y medidas de página (port de `frontend/src/lib/design.ts`)."""

from __future__ import annotations

import re

HEX_RE = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")

# Medidas de página (ancho, alto) en milímetros y su valor CSS.
PAGE_SIZES: dict[str, dict] = {
    "A5": {"css": "148mm 210mm", "w": 148.0, "h": 210.0, "small": True},
    "A4": {"css": "210mm 297mm", "w": 210.0, "h": 297.0, "small": False},
    "Carta": {"css": "8.5in 11in", "w": 215.9, "h": 279.4, "small": False},
    "6x9": {"css": "6in 9in", "w": 152.4, "h": 228.6, "small": True},
}


def _parse_hex(color: str) -> tuple[int, int, int]:
    h = color.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    n = int(h, 16)
    return (n >> 16) & 255, (n >> 8) & 255, n & 255


def _channel(c: float) -> float:
    s = c / 255
    return s / 12.92 if s <= 0.03928 else ((s + 0.055) / 1.055) ** 2.4


def luminance(color: str) -> float:
    r, g, b = _parse_hex(color)
    return 0.2126 * _channel(r) + 0.7152 * _channel(g) + 0.0722 * _channel(b)


def contrast_ratio(a: str, b: str) -> float:
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def _to_hex(rgb: tuple[float, float, float]) -> str:
    return "#" + "".join(f"{round(v):02X}" for v in rgb)


def accessible_cloth(color: str, minimum: float = 4.5) -> str:
    """Oscurece un color hasta que el texto blanco alcance el contraste mínimo (RA-03)."""
    rgb: tuple[float, float, float] = tuple(float(v) for v in _parse_hex(color))  # type: ignore[assignment]
    for _ in range(40):
        if contrast_ratio(_to_hex(rgb), "#FFFFFF") >= minimum:
            break
        rgb = tuple(v * 0.94 for v in rgb)  # type: ignore[assignment]
    return _to_hex(rgb)


def format_ratio(ratio: float) -> str:
    return f"{ratio:.1f}".replace(".", ",") + ":1"


def book_font_stack(font: str) -> str:
    if font == "Roboto":
        return "'Roboto', Arial, sans-serif"
    if font == "Arial":
        return "Arial, 'Helvetica Neue', Helvetica, sans-serif"
    return "Helvetica, 'Helvetica Neue', Arial, sans-serif"
