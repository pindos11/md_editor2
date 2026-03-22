import argparse
import uvicorn
from app.core.app_factory import create_app


def main() -> None:
    parser = argparse.ArgumentParser(description="Local-first markdown workspace server")
    parser.add_argument("--root", required=True, help="Root folder to manage.")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind.")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind.")
    args = parser.parse_args()
    uvicorn.run(create_app(args.root), host=args.host, port=args.port)
