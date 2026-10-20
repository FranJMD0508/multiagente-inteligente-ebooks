"""`python -m app`: arranca uvicorn con un apagado ordenado aunque haya streams SSE abiertos."""

from __future__ import annotations

import argparse

import uvicorn


def main() -> None:
    parser = argparse.ArgumentParser(description="Servidor de Folio")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--reload", action="store_true", help="Recarga al cambiar el código (desarrollo)")
    args = parser.parse_args()
    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        # Los streams SSE no terminan solos: tras 3 s se cierran y se guarda todo.
        timeout_graceful_shutdown=3,
    )


if __name__ == "__main__":
    main()
