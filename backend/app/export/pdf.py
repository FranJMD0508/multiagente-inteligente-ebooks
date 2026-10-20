"""PDF etiquetado con Chromium headless (Playwright) y metadatos con pypdf (RF-06, RA-01, RA-03, P-11).

Playwright necesita lanzar procesos, y en Windows eso solo funciona con el
bucle Proactor. Para no depender del bucle del servidor (uvicorn con --reload
usa Selector), el navegador vive en un hilo propio con su propio bucle y se
reutiliza entre exportaciones.
"""

from __future__ import annotations

import asyncio
import html as html_lib
import io
import logging
import re
import sys
import threading
from concurrent.futures import Future

from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject, TextStringObject

log = logging.getLogger("folio.pdf")


class PdfUnavailable(Exception):
    """No hay navegador disponible para generar el PDF."""


class PdfRenderer:
    def __init__(self, channel: str = "") -> None:
        self.channel = channel.strip()
        self._loop: asyncio.AbstractEventLoop | None = None
        self._thread: threading.Thread | None = None
        self._ready = threading.Event()
        self._playwright = None
        self._browser = None
        self._launch_lock: asyncio.Lock | None = None
        self._start_lock = threading.Lock()

    # ----- hilo propio -----

    def _ensure_thread(self) -> asyncio.AbstractEventLoop:
        with self._start_lock:
            if self._loop is not None and self._thread is not None and self._thread.is_alive():
                return self._loop

            def run() -> None:
                loop = asyncio.ProactorEventLoop() if sys.platform == "win32" else asyncio.new_event_loop()  # type: ignore[attr-defined]
                asyncio.set_event_loop(loop)
                self._loop = loop
                self._launch_lock = asyncio.Lock()
                self._ready.set()
                loop.run_forever()
                loop.close()

            self._ready.clear()
            self._thread = threading.Thread(target=run, name="folio-pdf", daemon=True)
            self._thread.start()
            self._ready.wait(10)
            assert self._loop is not None
            return self._loop

    def _submit(self, coro) -> Future:
        loop = self._ensure_thread()
        return asyncio.run_coroutine_threadsafe(coro, loop)

    # ----- navegador -----

    async def _get_browser(self):
        assert self._launch_lock is not None
        async with self._launch_lock:
            if self._browser is not None and self._browser.is_connected():
                return self._browser
            from playwright.async_api import async_playwright

            if self._playwright is None:
                self._playwright = await async_playwright().start()
            errors = []
            channels = [self.channel or None]
            if self.channel:
                channels.append(None)  # si falla Edge, se prueba el Chromium de Playwright
            for channel in channels:
                try:
                    self._browser = await self._playwright.chromium.launch(channel=channel, headless=True)
                    log.info("Navegador para PDF listo (%s).", channel or "chromium de Playwright")
                    return self._browser
                except Exception as exc:  # noqa: BLE001
                    errors.append(f"{channel or 'chromium'}: {exc}")
            raise PdfUnavailable(
                "No se encontró un navegador para generar el PDF. Instala uno con "
                "`python -m playwright install chromium` o configura PDF_BROWSER_CHANNEL. " + " | ".join(errors)[:600]
            )

    async def _render(self, html: str) -> bytes:
        browser = await self._get_browser()
        page = await browser.new_page()
        try:
            await page.set_content(html, wait_until="load")
            await page.evaluate("document.fonts.ready.then(() => true)")
            return await page.pdf(tagged=True, outline=True, prefer_css_page_size=True, print_background=True)
        finally:
            await page.close()

    async def render(self, html: str) -> bytes:
        """HTML → PDF (bytes), en el hilo del navegador."""
        return await asyncio.wrap_future(self._submit(self._render(html)))

    async def available(self) -> bool:
        try:
            await asyncio.wrap_future(self._submit(self._get_browser()))
            return True
        except Exception:  # noqa: BLE001
            return False

    async def _shutdown(self) -> None:
        try:
            if self._browser is not None:
                await self._browser.close()
        finally:
            self._browser = None
            if self._playwright is not None:
                await self._playwright.stop()
                self._playwright = None

    async def close(self) -> None:
        if self._loop is None or self._thread is None or not self._thread.is_alive():
            return
        try:
            await asyncio.wait_for(asyncio.wrap_future(self._submit(self._shutdown())), 10)
        except Exception:  # noqa: BLE001
            log.warning("No se pudo cerrar el navegador del PDF limpiamente.")
        self._loop.call_soon_threadsafe(self._loop.stop)
        self._thread.join(5)
        self._loop = None
        self._thread = None


_HEADING_RE = re.compile(r"<h([1-6])\b[^>]*>(.*?)</h\1>", re.S | re.I)
_TAG_RE = re.compile(r"<[^>]+>")
_SPACE_RE = re.compile(r"\s+")


def heading_texts(html: str) -> list[str]:
    """Texto de los encabezados del HTML, en orden de documento (el mismo de los marcadores)."""
    texts = []
    for _, inner in _HEADING_RE.findall(html):
        text = _SPACE_RE.sub(" ", html_lib.unescape(_TAG_RE.sub("", inner))).strip()
        if text:
            texts.append(text)
    return texts


def _fix_outline_titles(writer: PdfWriter, headings: list[str]) -> None:
    """Chromium junta sin espacio las líneas de un encabezado que ocupa varias líneas
    ("Respira, estudia,descansa") al crear los marcadores. Se restaura el texto real
    de cada encabezado, solo cuando coincide con el marcador si se ignoran los espacios."""
    outlines = writer._root_object.get("/Outlines")  # noqa: SLF001 - pypdf no expone el árbol de otro modo
    if outlines is None or not headings:
        return
    squeeze = [_SPACE_RE.sub("", h) for h in headings]
    pointer = 0
    stack = [outlines.get_object().get("/First")]
    while stack:
        ref = stack.pop()
        if ref is None:
            continue
        node = ref.get_object()
        title = str(node.get("/Title", ""))
        key = _SPACE_RE.sub("", title)
        for i in range(pointer, len(squeeze)):
            if squeeze[i] == key:
                if headings[i] != title:
                    node[NameObject("/Title")] = TextStringObject(headings[i])
                pointer = i + 1
                break
        # Recorrido en preorden: primero los hijos, luego el siguiente hermano.
        stack.append(node.get("/Next"))
        stack.append(node.get("/First"))


def add_metadata(
    pdf: bytes,
    *,
    title: str,
    author: str,
    subject: str,
    keywords: str = "generado con IA",
    headings: list[str] | None = None,
) -> bytes:
    """Metadatos del PDF (P-11), conservando el árbol de estructura etiquetado.
    Con `headings`, corrige además el texto de los marcadores (ver `_fix_outline_titles`)."""
    reader = PdfReader(io.BytesIO(pdf))
    writer = PdfWriter(clone_from=reader)
    if headings:
        try:
            _fix_outline_titles(writer, headings)
        except Exception:  # noqa: BLE001 - los marcadores son una ayuda; nunca deben romper la exportación
            log.warning("No se pudieron corregir los marcadores del PDF.", exc_info=True)
    writer.add_metadata(
        {
            "/Title": title,
            "/Author": author or "Folio",
            "/Subject": subject,
            "/Keywords": keywords,
            "/Creator": "Folio (asistido por IA)",
        }
    )
    try:
        prefs = writer.create_viewer_preferences()
        prefs.display_doctitle = True  # el visor muestra el título y no el nombre del archivo (PDF/UA)
    except Exception:  # noqa: BLE001 - es una mejora opcional
        pass
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def struct_tags(pdf: bytes) -> set[str]:
    """Etiquetas del árbol de estructura (/H1, /H2, /P…). Útil para comprobar RA-01."""
    reader = PdfReader(io.BytesIO(pdf))
    root = reader.trailer["/Root"]
    tree = root.get("/StructTreeRoot")
    if tree is None:
        return set()
    found: set[str] = set()
    stack = [tree.get_object()]
    seen = 0
    while stack and seen < 200_000:
        seen += 1
        node = stack.pop()
        if hasattr(node, "get_object"):
            node = node.get_object()
        if isinstance(node, dict):
            tag = node.get("/S")
            if tag is not None:
                found.add(str(tag))
            kids = node.get("/K")
            if kids is not None:
                stack.extend(kids if isinstance(kids, list) else [kids])
        elif isinstance(node, list):
            stack.extend(node)
    return found
