#!/usr/bin/env python3
"""Minimal server-side PIN authentication for disarm.qdev.run.

The service is intentionally dependency-free. Nginx asks ``/auth/check`` before
serving the static site; successful sign-in issues a signed, HttpOnly cookie.
Secrets are supplied only through the systemd environment file.
"""

from __future__ import annotations

import argparse
import base64
import hmac
import json
import os
import secrets
import threading
import time
from dataclasses import dataclass, field
from hashlib import sha256
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Mapping
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import parse_qs, urlparse, urlencode


COOKIE_NAME = "__Host-disarm_session"
TOKEN_VERSION = "v1"
MAX_BODY_BYTES = 4096
DEFAULT_SESSION_SECONDS = 90 * 24 * 60 * 60
MAX_FAILURES = 8
FAILURE_WINDOW_SECONDS = 15 * 60


def runtime_health(root: Path) -> dict:
    release = json.loads((root / 'release.json').read_text())
    health = json.loads((root / 'health.json').read_text())
    assert release['release_id'] == health['release_id']
    required = {'index.html', 'assets/app.js', 'data/disarm.json', 'login.html'}
    manifest = {item['path']: item for item in release['manifest']['artifacts']}
    assert required <= manifest.keys()
    for path in required:
        assert sha256((root / path).read_bytes()).hexdigest() == manifest[path]['sha256']
    corpus = json.loads((root / 'data/disarm.json').read_text())
    counts = {'phases': 4, 'tactics': 13, 'techniques': 71, 'counters': 140, 'incidents': 63}
    assert all(len(corpus[key]) == count for key, count in counts.items())
    return {'schema_version': 'disarm-runtime-health-v1', 'project_id': 'disarm',
            'status': 'ok', 'pin_service': 'ok', 'release_id': release['release_id'],
            'corpus_sha256': manifest['data/disarm.json']['sha256'], 'counts': counts,
            'auth_source_sha256': sha256(Path(__file__).read_bytes()).hexdigest(),
            'checked_at': datetime.now(timezone.utc).isoformat()}


def _base64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _signature(payload: str, secret: bytes) -> str:
    return _base64url(hmac.new(secret, payload.encode("ascii"), sha256).digest())


def issue_session(secret: bytes, now: int, lifetime: int) -> str:
    """Return a signed, expiring bearer token with no personal data."""
    expires_at = now + lifetime
    nonce = _base64url(secrets.token_bytes(24))
    payload = f"{TOKEN_VERSION}.{expires_at}.{nonce}"
    return f"{payload}.{_signature(payload, secret)}"


def session_is_valid(token: str | None, secret: bytes, now: int) -> bool:
    if not token:
        return False
    parts = token.split(".")
    if len(parts) != 4 or parts[0] != TOKEN_VERSION:
        return False
    _, expires_at_raw, nonce, supplied_signature = parts
    if not nonce or not expires_at_raw.isdecimal():
        return False
    expires_at = int(expires_at_raw)
    if expires_at <= now:
        return False
    payload = ".".join(parts[:3])
    return hmac.compare_digest(supplied_signature, _signature(payload, secret))


def safe_return_path(referer: str | None, allowed_origin: str) -> str:
    """Extract only a local absolute return path from the login page referer."""
    if not referer:
        return "/"
    try:
        parsed = urlparse(referer)
        allowed = urlparse(allowed_origin)
    except ValueError:
        return "/"
    if (parsed.scheme, parsed.netloc) != (allowed.scheme, allowed.netloc):
        return "/"
    candidate = parse_qs(parsed.query).get("next", ["/"])[0]
    if not candidate.startswith("/") or candidate.startswith("//") or "\\" in candidate:
        return "/"
    return candidate


@dataclass(frozen=True)
class Settings:
    pin: str
    secret: bytes
    allowed_origin: str
    session_seconds: int = DEFAULT_SESSION_SECONDS

    @classmethod
    def from_environment(cls) -> "Settings":
        pin = os.environ.get("DISARM_AUTH_PIN", "")
        secret = os.environ.get("DISARM_AUTH_SECRET", "")
        allowed_origin = os.environ.get("DISARM_AUTH_ORIGIN", "https://disarm.qdev.run")
        lifetime = int(os.environ.get("DISARM_AUTH_SESSION_SECONDS", str(DEFAULT_SESSION_SECONDS)))
        if not pin or len(secret.encode("utf-8")) < 32:
            raise ValueError("DISARM_AUTH_PIN and a 32-byte DISARM_AUTH_SECRET are required")
        if urlparse(allowed_origin).scheme != "https" or not urlparse(allowed_origin).netloc:
            raise ValueError("DISARM_AUTH_ORIGIN must be an https origin")
        if not 60 <= lifetime <= 365 * 24 * 60 * 60:
            raise ValueError("DISARM_AUTH_SESSION_SECONDS must be from 60 seconds to 365 days")
        return cls(pin=pin, secret=secret.encode("utf-8"), allowed_origin=allowed_origin, session_seconds=lifetime)


@dataclass
class LoginAttempts:
    failures: dict[str, list[float]] = field(default_factory=dict)
    lock: threading.Lock = field(default_factory=threading.Lock)

    def _recent(self, client_ip: str, now: float) -> list[float]:
        attempts = [stamp for stamp in self.failures.get(client_ip, []) if stamp > now - FAILURE_WINDOW_SECONDS]
        if attempts:
            self.failures[client_ip] = attempts
        else:
            self.failures.pop(client_ip, None)
        return attempts

    def is_limited(self, client_ip: str, now: float) -> bool:
        with self.lock:
            return len(self._recent(client_ip, now)) >= MAX_FAILURES

    def record_failure(self, client_ip: str, now: float) -> None:
        with self.lock:
            self.failures[client_ip] = self._recent(client_ip, now) + [now]

    def clear(self, client_ip: str) -> None:
        with self.lock:
            self.failures.pop(client_ip, None)


class PinAuthHandler(BaseHTTPRequestHandler):
    server_version = ""
    sys_version = ""

    @property
    def settings(self) -> Settings:
        return self.server.settings  # type: ignore[attr-defined]

    @property
    def attempts(self) -> LoginAttempts:
        return self.server.attempts  # type: ignore[attr-defined]

    def log_message(self, format: str, *args: object) -> None:
        # Nginx records access logs; never add PIN-bearing request bodies here.
        return

    def _client_ip(self) -> str:
        return self.headers.get("X-Real-IP", self.client_address[0]).strip() or self.client_address[0]

    def _send(self, status: HTTPStatus, headers: Mapping[str, str] | None = None) -> None:
        self.send_response(status)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", "0")
        for name, value in (headers or {}).items():
            self.send_header(name, value)
        self.end_headers()

    def _cookie_value(self) -> str | None:
        try:
            cookie = SimpleCookie(self.headers.get("Cookie", ""))
            morsel = cookie.get(COOKIE_NAME)
            return morsel.value if morsel else None
        except (ValueError, KeyError):
            return None

    def _session_cookie(self) -> str:
        token = issue_session(self.settings.secret, int(time.time()), self.settings.session_seconds)
        return (
            f"{COOKIE_NAME}={token}; Max-Age={self.settings.session_seconds}; "
            "Path=/; Secure; HttpOnly; SameSite=Lax"
        )

    @staticmethod
    def _cleared_cookie() -> str:
        return f"{COOKIE_NAME}=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax"

    def _valid_origin(self) -> bool:
        origin = self.headers.get("Origin")
        return origin is None or hmac.compare_digest(origin, self.settings.allowed_origin)

    def _read_pin(self) -> str | None:
        content_length = self.headers.get("Content-Length", "")
        if not content_length.isdecimal() or int(content_length) > MAX_BODY_BYTES:
            return None
        body = self.rfile.read(int(content_length)).decode("utf-8", "replace")
        values = parse_qs(body, keep_blank_values=True, strict_parsing=False)
        pins = values.get("pin", [])
        return pins[0] if len(pins) == 1 else None

    def do_GET(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
        path = urlparse(self.path).path
        if path == '/auth/health' and getattr(self.server, 'serving_root', None):
            try:
                body = runtime_health(self.server.serving_root)
                status = HTTPStatus.OK
            except (OSError, ValueError, KeyError, AssertionError):
                body = {'schema_version': 'disarm-runtime-health-v1', 'project_id': 'disarm', 'status': 'error'}
                status = HTTPStatus.SERVICE_UNAVAILABLE
            encoded = json.dumps(body, separators=(',', ':')).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)
            return
        if path == "/auth/check":
            if session_is_valid(self._cookie_value(), self.settings.secret, int(time.time())):
                self._send(HTTPStatus.NO_CONTENT)
            else:
                self._send(HTTPStatus.UNAUTHORIZED)
            return
        if path == "/auth/logout":
            self._send(HTTPStatus.SEE_OTHER, {"Location": "/login", "Set-Cookie": self._cleared_cookie()})
            return
        self._send(HTTPStatus.NOT_FOUND)

    def _login_error_path(self, reason: str) -> str:
        referer = self.headers.get("Referer")
        locale = "ru"
        if referer:
            parsed = urlparse(referer)
            allowed = urlparse(self.settings.allowed_origin)
            if (parsed.scheme, parsed.netloc) == (allowed.scheme, allowed.netloc):
                requested = parse_qs(parsed.query).get("locale", ["ru"])[0]
                if requested in {"ru", "kk", "en"}:
                    locale = requested
        return "/login?" + urlencode({"error": reason, "locale": locale, "next": safe_return_path(referer, self.settings.allowed_origin)})

    def do_POST(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
        if urlparse(self.path).path != "/auth/login":
            self._send(HTTPStatus.NOT_FOUND)
            return
        if not self._valid_origin():
            self._send(HTTPStatus.FORBIDDEN)
            return

        client_ip = self._client_ip()
        now = time.time()
        if self.attempts.is_limited(client_ip, now):
            self._send(HTTPStatus.SEE_OTHER, {"Location": self._login_error_path("limited")})
            return

        submitted_pin = self._read_pin()
        if not submitted_pin or not submitted_pin.isascii() or not hmac.compare_digest(submitted_pin, self.settings.pin):
            self.attempts.record_failure(client_ip, now)
            self._send(HTTPStatus.SEE_OTHER, {"Location": self._login_error_path("invalid")})
            return

        self.attempts.clear(client_ip)
        destination = safe_return_path(self.headers.get("Referer"), self.settings.allowed_origin)
        self._send(HTTPStatus.SEE_OTHER, {"Location": destination, "Set-Cookie": self._session_cookie()})


def run(settings: Settings, host: str, port: int, root: Path | None = None) -> None:
    server = ThreadingHTTPServer((host, port), PinAuthHandler)
    server.settings = settings  # type: ignore[attr-defined]
    server.attempts = LoginAttempts()  # type: ignore[attr-defined]
    server.serving_root = root
    server.serve_forever()


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve DISARM PIN authentication")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=18081, type=int)
    parser.add_argument("--root", type=Path)
    args = parser.parse_args()
    run(Settings.from_environment(), args.host, args.port, args.root)


if __name__ == "__main__":
    main()
