from __future__ import annotations

import json
import os
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


HOST = "127.0.0.1"
PORT = 4173
OLLAMA_BASE = "http://127.0.0.1:11434"
ROOT = Path(__file__).resolve().parent


class AbyssHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, directory: str | None = None, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        if self.path.startswith("/api/ollama/"):
            self.send_response(HTTPStatus.NO_CONTENT)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def do_GET(self) -> None:
        if self.path.startswith("/api/ollama/tags"):
            self._proxy_ollama("/api/tags", method="GET")
            return
        super().do_GET()

    def do_POST(self) -> None:
        if self.path.startswith("/api/ollama/generate"):
            self._proxy_ollama("/api/generate", method="POST")
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def log_message(self, format: str, *args) -> None:
        print(format % args)

    def _proxy_ollama(self, target_path: str, method: str) -> None:
        body = b""
        if method == "POST":
            length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(length) if length else b""

        request = Request(
            url=f"{OLLAMA_BASE}{target_path}",
            data=body if method == "POST" else None,
            method=method,
            headers={"Content-Type": "application/json"}
        )

        try:
            with urlopen(request, timeout=60) as response:
                payload = response.read()
                content_type = response.headers.get("Content-Type", "application/json")
                self.send_response(response.status)
                self.send_header("Content-Type", content_type)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(payload)
        except HTTPError as error:
            payload = error.read() or json.dumps({"error": str(error)}).encode("utf-8")
            self.send_response(error.code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(payload)
        except URLError:
            payload = json.dumps(
                {"error": "Ollama is unavailable. Start Ollama and make sure gemma3:4b is installed."}
            ).encode("utf-8")
            self.send_response(HTTPStatus.BAD_GATEWAY)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(payload)


def main() -> None:
    os.chdir(ROOT)
    server = ThreadingHTTPServer((HOST, PORT), AbyssHandler)
    print(f"Abyss Watchers dev server running at http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
