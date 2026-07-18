#!/usr/bin/python3

from __future__ import annotations

import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse


HOST = "127.0.0.1"
PORT = 43127
IDLE_SHUTDOWN_SECONDS = 30 * 60
WEB_ROOT = Path(__file__).resolve().parent / "web"
last_request_at = time.monotonic()


class ReviewRequestHandler(SimpleHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802 - HTTP handler API
        global last_request_at
        last_request_at = time.monotonic()

        url_path = unquote(urlparse(self.path).path)
        relative_path = url_path.lstrip("/")
        requested_file = WEB_ROOT / relative_path

        # BrowserRouter routes such as /risks should load the SPA entry point.
        if url_path != "/" and not requested_file.exists():
            if "." not in Path(relative_path).name:
                self.path = "/index.html"

        super().do_GET()

    def log_message(self, format: str, *args: object) -> None:
        return


class ReviewServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


def stop_when_idle(server: ReviewServer) -> None:
    while True:
        time.sleep(60)
        if time.monotonic() - last_request_at < IDLE_SHUTDOWN_SECONDS:
            continue
        server.shutdown()
        return


def main() -> None:
    if not (WEB_ROOT / "index.html").is_file():
        raise SystemExit("The review bundle does not contain web/index.html.")

    handler = partial(ReviewRequestHandler, directory=str(WEB_ROOT))
    try:
        server = ReviewServer((HOST, PORT), handler)
    except OSError:
        # A previously launched review server already owns the fixed local port.
        return

    watcher = threading.Thread(target=stop_when_idle, args=(server,), daemon=True)
    watcher.start()
    server.serve_forever(poll_interval=0.5)
    server.server_close()


if __name__ == "__main__":
    main()
