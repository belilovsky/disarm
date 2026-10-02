#!/usr/bin/env python3
"""Fail closed when the public DISARM contracts do not identify this source candidate.

This is deliberately a verifier, not a deployer.  It makes no writes and it
does not follow the protected root redirect; production parity is accepted only
when the public machine-readable contracts agree with the local candidate.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener, urlopen


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_CONTRACTS = (
    "release.json",
    "health.json",
    ".well-known/avds-adoption.json",
    "data/avds-adapter.json",
    "data/avds-system-contract.json",
    "data/platform-capabilities.json",
    "data/disarm-provenance.json",
)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[override]
        return None


def load_local(path: str) -> dict:
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def request(url: str, timeout: float, allow_redirect: bool = True) -> tuple[int, dict[str, str], bytes]:
    opener = urlopen if allow_redirect else build_opener(NoRedirect()).open
    req = Request(url, headers={"Accept": "application/json"})
    try:
        with opener(req, timeout=timeout) as response:
            return response.status, dict(response.headers.items()), response.read()
    except HTTPError as exc:
        return exc.code, dict(exc.headers.items()), exc.read()
    except (URLError, TimeoutError) as exc:
        # A busy edge can time out during TLS negotiation or while reading a
        # response body.  Normalize both urllib and socket timeouts into the
        # verifier's fail-closed result instead of leaking a traceback from
        # the gate itself.
        reason = getattr(exc, "reason", str(exc))
        raise RuntimeError(str(reason)) from exc


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="https://disarm.qdev.run", help="public origin without a trailing slash")
    parser.add_argument("--timeout", type=float, default=8, help="per-request timeout in seconds")
    parser.add_argument("--json", action="store_true", help="emit a machine-readable result")
    args = parser.parse_args()
    base_url = args.base_url.rstrip("/")
    local_adapter = load_local("data/avds-adapter.json")
    local_coverage = load_local("data/avds-coverage.json")
    local_release = load_local("release.json")
    local_health = load_local("health.json")
    failures: list[str] = []
    observations: dict[str, object] = {"base_url": base_url, "contracts": {}}

    try:
        root_status, root_headers, _ = request(f"{base_url}/", args.timeout, allow_redirect=False)
    except RuntimeError as exc:
        failures.append(f"root transport error: {exc}")
    else:
        location = root_headers.get("Location", root_headers.get("location", ""))
        observations["root"] = {"status": root_status, "location": location}
        if root_status != 302 or urlparse(location).path != "/login":
            failures.append(f"root protection mismatch: expected 302 /login, got {root_status} {location or '<no location>'}")

    public: dict[str, dict] = {}
    for path in PUBLIC_CONTRACTS:
        try:
            status, _, body = request(f"{base_url}/{path}", args.timeout)
        except RuntimeError as exc:
            failures.append(f"{path} transport error: {exc}")
            continue
        observations["contracts"][path] = {"status": status}
        if status != 200:
            failures.append(f"{path} expected 200, got {status}")
            continue
        try:
            public[path] = json.loads(body.decode("utf-8"))
        except json.JSONDecodeError as exc:
            failures.append(f"{path} is not valid JSON: {exc.msg}")

    public_adapter = public.get("data/avds-adapter.json", {})
    public_adoption = public.get(".well-known/avds-adoption.json", {})
    public_release = public.get("release.json", {})
    public_health = public.get("health.json", {})
    if public_release:
        observations["public_release_id"] = public_release.get("release_id")
        if public_release.get("release_id") != local_release.get("release_id"):
            failures.append(
                "release identity mismatch: "
                f"local {local_release.get('release_id')} != public {public_release.get('release_id')}"
            )
    if public_health:
        observations["public_health_status"] = public_health.get("status")
        if public_health.get("release_id") != local_health.get("release_id"):
            failures.append(
                "health release mismatch: "
                f"local {local_health.get('release_id')} != public {public_health.get('release_id')}"
            )
        if public_health.get("status") != "ok" or public_health.get("health_kind") != "static_release_content":
            failures.append("static health receipt is not an ok content receipt")
    if public_adapter:
        observations["public_adapter_version"] = public_adapter.get("adapter_version")
        if public_adapter.get("adapter_version") != local_adapter.get("adapter_version"):
            failures.append(
                "AVDS adapter mismatch: "
                f"local {local_adapter.get('adapter_version')} != public {public_adapter.get('adapter_version')}"
            )
    if public_adoption:
        public_percent = public_adoption.get("coverage", {}).get("percent")
        observations["public_avds_percent"] = public_percent
        if public_percent != local_coverage.get("coverage_percent"):
            failures.append(
                "AVDS maturity mismatch: "
                f"local {local_coverage.get('coverage_percent')} != public {public_percent}"
            )

    observations["local_adapter_version"] = local_adapter.get("adapter_version")
    observations["local_avds_percent"] = local_coverage.get("coverage_percent")
    observations["local_release_id"] = local_release.get("release_id")
    observations["result"] = "RUNTIME_EVIDENCE_OK" if not failures else "RUNTIME_EVIDENCE_CONFLICT"
    observations["failures"] = failures
    if args.json:
        print(json.dumps(observations, ensure_ascii=False, sort_keys=True))
    else:
        for failure in failures:
            print(f"FAIL {failure}")
        print(observations["result"])
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
