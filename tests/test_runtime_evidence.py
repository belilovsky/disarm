#!/usr/bin/env python3
"""Regression test for the release-parity verifier using an isolated local origin."""

from __future__ import annotations

import http.server
import importlib.util
import json
import subprocess
import sys
import threading
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
CHECK = ROOT / "scripts" / "check_runtime_evidence.py"
CHECKER_SPEC = importlib.util.spec_from_file_location("runtime_evidence_checker", CHECK)
assert CHECKER_SPEC and CHECKER_SPEC.loader
CHECKER = importlib.util.module_from_spec(CHECKER_SPEC)
CHECKER_SPEC.loader.exec_module(CHECKER)


class ProtectedStaticHandler(http.server.SimpleHTTPRequestHandler):
    adapter_drift = False

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self) -> None:  # noqa: N802 - HTTP handler API
        if self.path == "/":
            self.send_response(302)
            self.send_header("Location", "/login")
            self.end_headers()
            return
        if self.path == "/data/avds-adapter.json" and self.adapter_drift:
            payload = json.dumps({"adapter_version": "0.0.0"}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        super().do_GET()

    def log_message(self, format: str, *args) -> None:  # noqa: A003 - HTTP handler API
        return


class RuntimeEvidenceTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), ProtectedStaticHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base_url = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=3)

    def test_matching_public_contracts_pass(self) -> None:
        result = subprocess.run(
            [sys.executable, str(CHECK), "--base-url", self.base_url, "--timeout", "3", "--json"],
            cwd=ROOT,
            check=False,
            text=True,
            capture_output=True,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        payload = json.loads(result.stdout)
        self.assertEqual(payload["result"], "RUNTIME_EVIDENCE_OK")
        self.assertEqual(payload["root"], {"status": 302, "location": "/login"})
        self.assertTrue(payload["local_release_id"].startswith("content-"))
        self.assertEqual(payload["public_release_id"], payload["local_release_id"])
        self.assertEqual(payload["public_health_status"], "ok")
        self.assertEqual(payload["public_adapter_version"], "1.3.5")
        self.assertEqual(payload["public_avds_percent"], 97)

    def test_adapter_drift_fails_closed(self) -> None:
        ProtectedStaticHandler.adapter_drift = True
        try:
            result = subprocess.run(
                [sys.executable, str(CHECK), "--base-url", self.base_url, "--timeout", "3", "--json"],
                cwd=ROOT,
                check=False,
                text=True,
                capture_output=True,
            )
        finally:
            ProtectedStaticHandler.adapter_drift = False
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        payload = json.loads(result.stdout)
        self.assertEqual(payload["result"], "RUNTIME_EVIDENCE_CONFLICT")
        self.assertIn("AVDS adapter mismatch: local 1.3.5 != public 0.0.0", payload["failures"])

    def test_transport_timeout_is_normalized(self) -> None:
        with patch.object(CHECKER, "urlopen", side_effect=TimeoutError("read operation timed out")):
            with self.assertRaisesRegex(RuntimeError, "read operation timed out"):
                CHECKER.request("https://example.test/release.json", timeout=0.01)


if __name__ == "__main__":
    unittest.main()
