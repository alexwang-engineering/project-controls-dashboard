from __future__ import annotations

import importlib.util
import tempfile
import threading
import unittest
from functools import partial
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen


MODULE_PATH = Path(__file__).resolve().parent / "review_server.py"
SPEC = importlib.util.spec_from_file_location("review_server", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("Could not load review_server.py for testing.")
review_server = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(review_server)


class ReviewServerSecurityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        web_root = Path(self.temporary_directory.name)
        (web_root / "index.html").write_text(
            "<!doctype html><title>Controlled app</title>",
            encoding="utf-8",
        )
        assets = web_root / "assets"
        assets.mkdir()
        (assets / "app.js").write_text("export {};", encoding="utf-8")
        review_server.WEB_ROOT = web_root

        handler = partial(
            review_server.ReviewRequestHandler,
            directory=str(web_root),
        )
        self.server = review_server.ReviewServer((review_server.HOST, 0), handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.origin = f"http://{review_server.HOST}:{self.server.server_port}"

    def tearDown(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        self.temporary_directory.cleanup()

    def test_serves_spa_routes_with_defence_in_depth_headers(self) -> None:
        with urlopen(f"{self.origin}/milestones", timeout=2) as response:
            body = response.read().decode("utf-8")
            self.assertIn("Controlled app", body)
            for name, expected_value in review_server.SECURITY_HEADERS.items():
                with self.subTest(header=name):
                    self.assertEqual(response.headers[name], expected_value)
            self.assertEqual(response.headers["Cache-Control"], "no-store")

    def test_serves_known_assets_without_directory_listing(self) -> None:
        with urlopen(f"{self.origin}/assets/app.js", timeout=2) as response:
            self.assertEqual(response.status, 200)
            self.assertEqual(response.headers["X-Frame-Options"], "DENY")

        with self.assertRaises(HTTPError) as directory_error:
            urlopen(f"{self.origin}/assets/", timeout=2)
        self.assertEqual(directory_error.exception.code, 404)
        directory_error.exception.close()

    def test_rejects_paths_that_resolve_outside_the_web_root(self) -> None:
        with self.assertRaises(HTTPError) as traversal_error:
            urlopen(f"{self.origin}/%2e%2e/review_server.py", timeout=2)
        self.assertEqual(traversal_error.exception.code, 404)
        traversal_error.exception.close()

        head_request = Request(
            f"{self.origin}/%2e%2e/review_server.py",
            method="HEAD",
        )
        with self.assertRaises(HTTPError) as head_traversal_error:
            urlopen(head_request, timeout=2)
        self.assertEqual(head_traversal_error.exception.code, 404)
        head_traversal_error.exception.close()

    def test_head_requests_use_the_same_directory_boundary(self) -> None:
        head_request = Request(f"{self.origin}/assets/", method="HEAD")
        with self.assertRaises(HTTPError) as directory_error:
            urlopen(head_request, timeout=2)
        self.assertEqual(directory_error.exception.code, 404)
        directory_error.exception.close()


if __name__ == "__main__":
    unittest.main()
