"""Imagen de portada: color de las zonas más claras y velo mínimo de tela (RA-03, WCAG 2.2).

Port de `frontend/src/lib/cover-image.ts` (`brightColor`, `contrastWithVeil` y
`minVeilFor`): si cambias algo aquí, cámbialo allí también. El servidor es quien
manda: calcula el color al subir la imagen y el velo mínimo en cada cambio de la
imagen o de la tela, sin fiarse del que envía el cliente.
"""

from __future__ import annotations

import io
import math

from .design import luminance

Rgb = tuple[float, float, float]

BRIGHT_WIDTH = 48  # se reduce a 48 px de ancho, como el frontend
BRIGHT_SHARE = 0.05  # el 5 % de píxeles más claros
MAX_PIXELS = 40_000_000  # una imagen de más píxeles se rechaza (protege la memoria del servidor)
# Una portada con una proporción más extrema (p. ej. 60×600 000 px, unos KB en PNG) no tiene
# sentido y, reducida a 48 px de ancho, daría cientos de miles de píxeles que ordenar.
MAX_ASPECT = 8
WORST_CASE: Rgb = (255.0, 255.0, 255.0)  # si no se puede leer la imagen, se asume blanco


class ImageUnreadable(Exception):
    """El archivo no es una imagen que se pueda abrir."""


class ImageTooLarge(Exception):
    """La imagen tiene demasiados píxeles."""


class ImageBadShape(Exception):
    """La imagen es demasiado alargada para una portada."""


def _js_round(value: float) -> int:
    """`Math.round` de JavaScript (redondea .5 hacia arriba; `round` de Python lo haría al par)."""
    return math.floor(value + 0.5)


def bright_color(data: bytes) -> Rgb:
    """Color medio del 5 % de píxeles más claros (donde peor se leería el texto blanco).

    Igual que `brightColor` del frontend: la imagen se reduce a 48 px de ancho, la
    claridad de cada píxel es 0,2126·R + 0,7152·G + 0,0722·B y se promedian los más
    claros. Las zonas transparentes cuentan como blanco (el frontend sube siempre un
    JPEG sobre fondo blanco).
    """
    from PIL import Image, ImageOps, UnidentifiedImageError

    try:
        with Image.open(io.BytesIO(data)) as img:
            width, height = img.size
            if width <= 0 or height <= 0:
                raise ImageUnreadable("la imagen no tiene tamaño")
            if width * height > MAX_PIXELS:
                raise ImageTooLarge(f"{width}×{height} píxeles")
            if max(width, height) > MAX_ASPECT * min(width, height):
                raise ImageBadShape(f"{width}×{height} píxeles")
            if img.getexif().get(0x0112, 1) in (5, 6, 7, 8):  # orientación EXIF girada 90°
                width, height = height, width
            target = (BRIGHT_WIDTH, max(1, _js_round(height / width * BRIGHT_WIDTH)))
            # En un JPEG grande se decodifica directamente a menor escala (más rápido y con menos memoria).
            img.draft("RGB", (target[0] * 4, target[1] * 4))
            if img.mode == "PA" or (img.mode == "P" and "transparency" in img.info):
                img = img.convert("RGBA")  # una paleta se reduciría sin suavizado
            # Se reduce antes de girar o componer sobre blanco: a tamaño completo, las copias
            # intermedias de un PNG con alfa de 6000×6000 ocupaban cientos de MB.
            side = 4 * max(target)
            img.thumbnail((side, side), Image.Resampling.BILINEAR)
            frame = ImageOps.exif_transpose(img)
            if frame.mode in ("RGBA", "LA"):
                rgba = frame.convert("RGBA")
                frame = Image.alpha_composite(Image.new("RGBA", rgba.size, (255, 255, 255, 255)), rgba)
            small = frame.convert("RGB").resize(target, Image.Resampling.BILINEAR)
            raw = small.tobytes()
    except (ImageUnreadable, ImageTooLarge, ImageBadShape):
        raise
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError, SyntaxError) as exc:
        raise ImageUnreadable(str(exc)) from exc

    pixels = [(raw[i], raw[i + 1], raw[i + 2]) for i in range(0, len(raw) - 2, 3)]
    if not pixels:
        return WORST_CASE
    # Orden estable de más a menos claro, como `Array.prototype.sort` en el frontend.
    ordered = sorted(pixels, key=lambda p: 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2], reverse=True)
    top = ordered[: max(1, _js_round(len(ordered) * BRIGHT_SHARE))]
    return tuple(sum(p[c] for p in top) / len(top) for c in range(3))  # type: ignore[return-value]


def _hex_to_rgb(color: str) -> tuple[int, int, int]:
    h = color.replace("#", "")
    full = "".join(c * 2 for c in h) if len(h) == 3 else h
    n = int(full, 16)
    return (n >> 16) & 255, (n >> 8) & 255, n & 255


def _to_hex(rgb: Rgb) -> str:
    return "#" + "".join(f"{_js_round(v):02x}" for v in rgb)


def contrast_with_veil(bright: Rgb, cloth: str, veil: float) -> float:
    """Contraste del texto blanco sobre la imagen con un velo de tela de opacidad `veil`."""
    c = _hex_to_rgb(cloth)
    mixed = tuple(v * (1 - veil) + c[i] * veil for i, v in enumerate(bright))
    return 1.05 / (luminance(_to_hex(mixed)) + 0.05)  # type: ignore[arg-type]


def min_veil_for(bright: Rgb, cloth: str, target: float = 4.6) -> float:
    """Velo mínimo (0 a 1) para llegar a 4,5:1, redondeado hacia arriba con un pequeño margen.

    Con 1 el título queda sobre la tela sola, que siempre cumple (se valida al elegirla)."""
    # Una tela al límite (4,5:1) no permite llegar a 4,6 aunque tape toda la imagen.
    goal = min(target, max(4.5, contrast_with_veil(bright, cloth, 1) - 0.01))
    if contrast_with_veil(bright, cloth, 0) >= goal:
        return 0
    lo, hi = 0.0, 1.0
    for _ in range(20):
        mid = (lo + hi) / 2
        if contrast_with_veil(bright, cloth, mid) >= goal:
            hi = mid
        else:
            lo = mid
    return min(1, math.ceil(hi * 100) / 100)
