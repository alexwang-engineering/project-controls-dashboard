#!/usr/bin/python3

from __future__ import annotations

import argparse
import os
import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse


HOST = "127.0.0.1"
WEB_ROOT = Path(__file__).resolve().parent / "web"
CONTENT_SECURITY_POLICY = (
    "default-src 'self'; "
    "base-uri 'none'; "
    "object-src 'none'; "
    "form-action 'self'; "
    "frame-ancestors 'none'; "
    "frame-src 'none'; "
    "script-src 'self'; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: blob:; "
    "font-src 'self' data:; "
    "connect-src 'self'; "
    "worker-src 'self'; "
    "media-src 'none'; "
    "manifest-src 'self'"
)

SECURITY_HEADERS = {
    "Content-Security-Policy": CONTENT_SECURITY_POLICY,
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
}


class ReviewRequestHandler(SimpleHTTPRequestHandler):
    server_version = "ProjectControlsDashboard"
    sys_version = ""

    def _prepare_request_path(self) -> bool:
        url_path = unquote(urlparse(self.path).path)
        relative_path = url_path.lstrip("/")
        requested_file = (WEB_ROOT / relative_path).resolve()

        try:
            requested_file.relative_to(WEB_ROOT.resolve())
        except ValueError:
            self.send_error(404)
            return False

        if url_path != "/" and requested_file.is_dir():
            self.send_error(404)
            return False

        # BrowserRouter routes such as /risks should load the SPA entry point.
        if url_path != "/" and not requested_file.exists():
            if "." not in Path(relative_path).name:
                self.path = "/index.html"

        return True

    def do_GET(self) -> None:  # noqa: N802 - HTTP handler API
        if not self._prepare_request_path():
            return

        super().do_GET()

    def do_HEAD(self) -> None:  # noqa: N802 - HTTP handler API
        if not self._prepare_request_path():
            return

        super().do_HEAD()

    def end_headers(self) -> None:
        for name, value in SECURITY_HEADERS.items():
            self.send_header(name, value)
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, format: str, *args: object) -> None:
        return


class ReviewServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


def stop_when_parent_exits(server: ReviewServer, parent_pid: int) -> None:
    while True:
        time.sleep(2)
        try:
            os.kill(parent_pid, 0)
        except ProcessLookupError:
            server.shutdown()
            return
        except PermissionError:
            server.shutdown()
            return


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Serve the packaged dashboard locally.")
    parser.add_argument("--port", type=int, default=43_127)
    parser.add_argument("--parent-pid", type=int, required=True)
    return parser.parse_args()


def main() -> None:
    arguments = parse_arguments()
    if not (WEB_ROOT / "index.html").is_file():
        raise SystemExit("The review bundle does not contain web/index.html.")

    handler = partial(ReviewRequestHandler, directory=str(WEB_ROOT))
    try:
        server = ReviewServer((HOST, arguments.port), handler)
    except OSError:
        raise SystemExit(
            "The app local port is already in use. Close any older copy and reopen."
        ) from None

    watcher = threading.Thread(
        target=stop_when_parent_exits,
        args=(server, arguments.parent_pid),
        daemon=True,
    )
    watcher.start()
    server.serve_forever(poll_interval=0.5)
    server.server_close()


if __name__ == "__main__":
    main()
