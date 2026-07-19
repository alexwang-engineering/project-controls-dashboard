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


class ReviewRequestHandler(SimpleHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802 - HTTP handler API
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
