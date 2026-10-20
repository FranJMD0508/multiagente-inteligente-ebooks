"""Aplicación FastAPI de Folio: CORS, routers, arranque (carga el store y retoma trabajos) y apagado ordenado.

Ejecutar:  uvicorn app.main:app --port 8000   (o `python -m app`)
"""

from __future__ import annotations

import asyncio
import logging
import signal
import threading
from collections.abc import Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .api import assets, auth, ebooks, events, exports, meta, references
from .config import Settings, get_settings
from .services import Services


def _configure_logging(level: str) -> None:
    logging.basicConfig(level=level.upper(), format="%(asctime)s %(levelname)-7s %(name)s · %(message)s")
    # Los SDK y httpx son muy habladores en INFO.
    for noisy in ("httpx", "httpcore", "aiosqlite", "anthropic", "openai"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def _close_streams_on_exit(services: Services) -> Callable[[], None]:
    """Al pulsar Ctrl+C, cierra los streams SSE para que uvicorn no espere por ellos.

    uvicorn espera a que terminen las respuestas en curso antes de apagarse, y un
    stream SSE no termina nunca. Se envuelve su manejador de señales: primero se
    cierran los streams y luego sigue el apagado normal. Devuelve cómo deshacerlo.
    """
    if threading.current_thread() is not threading.main_thread():
        return lambda: None
    loop = asyncio.get_running_loop()
    previous: dict[int, object] = {}

    def handler(sig, frame):  # noqa: ANN001
        loop.call_soon_threadsafe(services.bus.close_all)
        original = previous.get(sig)
        if callable(original):
            original(sig, frame)

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            previous[sig] = signal.getsignal(sig)
            signal.signal(sig, handler)
        except (ValueError, OSError):  # pragma: no cover - plataformas sin esa señal
            previous.pop(sig, None)

    def restore() -> None:
        for sig, original in previous.items():
            try:
                signal.signal(sig, original)  # type: ignore[arg-type]
            except (ValueError, OSError, TypeError):  # pragma: no cover
                pass

    return restore


def create_app(settings: Settings | None = None, services: Services | None = None) -> FastAPI:
    """Crea la app. Las pruebas pasan sus propios `services` ya iniciados."""
    settings = settings or (services.settings if services else get_settings())
    owns_services = services is None

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        restore_signals = lambda: None  # noqa: E731
        if owns_services:
            _configure_logging(settings.log_level)
            svc = Services(settings)
            await svc.start()
            app.state.services = svc
            restore_signals = _close_streams_on_exit(svc)
        try:
            yield
        finally:
            if owns_services:
                restore_signals()
                await app.state.services.stop()

    app = FastAPI(
        title="Folio API",
        description="Backend multiagente de Folio: Investigador, Redactor, Ejercicios y Maquetador.",
        version="1.0.0",
        lifespan=lifespan,
    )
    if services is not None:
        app.state.services = services

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition"],
    )

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        errors = [
            {"field": ".".join(str(p) for p in err.get("loc", ())[1:]), "message": err.get("msg", "")}
            for err in exc.errors()
        ]
        return JSONResponse(
            status_code=422,
            content={"detail": {"code": "validacion", "message": "Revisa los datos: hay un valor que no es válido.", "errors": errors}},
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        # Los errores propios ya traen {code, message}; los de FastAPI/Starlette se traducen.
        detail = exc.detail
        if not isinstance(detail, dict):
            messages = {
                400: ("peticion", "La petición no tiene un formato válido (revisa que el cuerpo sea JSON en UTF-8)."),
                404: ("no_encontrado", "No encontramos esa ruta."),
                405: ("metodo", "Ese método no está permitido en esta ruta."),
            }
            code, message = messages.get(exc.status_code, ("error", str(detail)))
            detail = {"code": code, "message": message}
        return JSONResponse(status_code=exc.status_code, content={"detail": detail}, headers=getattr(exc, "headers", None))

    for module in (meta, auth, ebooks, references, exports, assets, events):
        app.include_router(module.router, prefix="/api")
    return app


app = create_app()
