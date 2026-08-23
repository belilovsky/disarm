#!/usr/bin/env python3
"""Generate and validate DISARM's content-addressed static release receipt."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RECEIPT = ROOT / "release.json"
HEALTH_RECEIPT = ROOT / "health.json"
FIXED_FILES = [
    "index.html",
    "assets/app.js",
    "assets/avds-disarm-adapter.css",
    "assets/avds-static-token-contract.css",
    "assets/avds-static-preview-bundle.css",
    "data/disarm.json",
    "data/avds-coverage.json",
    "data/avds-adapter.json",
    "data/avds-system-contract.json",
    "data/avds-component-contracts.json",
    "data/avds-responsive-contract.json",
    "data/disarm-provenance.json",
    "data/avds-locale-contract.json",
    "data/avds-data-visualization-contract.json",
    "data/avds-visual-regression.json",
    "data/platform-capabilities.json",
    "qdev-project.json",
    ".well-known/avds-adoption.json",
    "favicon.svg",
    "favicon.ico",
    "robots.txt",
    "sitemap.xml",
    "fonts/avds/avds-fonts.css",
]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def source_revision() -> tuple[str | None, str]:
    """Return the current immutable source revision when this is a Git checkout."""
    try:
        revision = subprocess.run(
            ["git", "-C", str(ROOT), "rev-parse", "HEAD"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return None, "unverifiable: checkout has no Git metadata"
    return revision, "git-commit"


def artifact_paths() -> list[str]:
    paths = list(FIXED_FILES)
    paths.extend(str(path.relative_to(ROOT)) for path in sorted((ROOT / "fonts" / "avds").glob("*.woff2")))
    return sorted(dict.fromkeys(paths))


def build_manifest() -> dict:
    artifacts = []
    for relative in artifact_paths():
        path = ROOT / relative
        if not path.is_file():
            raise FileNotFoundError(relative)
        artifacts.append({"path": relative, "bytes": path.stat().st_size, "sha256": sha256(path)})
    return {"project_id": "disarm", "artifacts": artifacts}


def expected_receipt() -> dict:
    manifest = build_manifest()
    manifest_bytes = json.dumps(manifest, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    manifest_sha = hashlib.sha256(manifest_bytes).hexdigest()
    adapter = json.loads((ROOT / "data" / "avds-adapter.json").read_text(encoding="utf-8"))
    coverage = json.loads((ROOT / "data" / "avds-coverage.json").read_text(encoding="utf-8"))
    revision, revision_status = source_revision()
    return {
        "schema_version": "disarm-release-identity-v1",
        "project_id": "disarm",
        "public_url": "https://disarm.qdev.run/",
        "release_id": f"content-{manifest_sha[:24]}",
        "revision_kind": "content_sha256_manifest",
        "source_revision": revision,
        "source_revision_status": revision_status,
        "artifact_manifest_sha256": manifest_sha,
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "deployment_contract": {
            "mode": "immutable-static-files",
            "required_targets": ["edge", "origin"],
            "required_publish_files": ["release.json", "health.json"],
            "root_auth_boundary": "302 /login",
            "rollback": "timestamped snapshot before any write on both targets",
        },
        "avds": {
            "version": adapter["avds_release_version"],
            "adapter_version": adapter["adapter_version"],
            "coverage_percent": coverage["coverage_percent"],
        },
        "manifest": manifest,
    }


def expected_health(receipt: dict) -> dict:
    return {
        "schema_version": "disarm-static-health-v1",
        "project_id": receipt["project_id"],
        "release_id": receipt["release_id"],
        "release_manifest_sha256": receipt["artifact_manifest_sha256"],
        "health_kind": "static_release_content",
        "status": "ok",
        "checks": {
            "artifact_manifest": "ok",
            "release_identity": "ok",
            "public_data_projection": "present",
            "auth_boundary": "expected_302_login",
        },
        "generated_at": receipt["generated_at"],
    }


def check() -> int:
    if not RECEIPT.is_file():
        print("FAIL release.json is missing")
        return 1
    try:
        actual = json.loads(RECEIPT.read_text(encoding="utf-8"))
        expected = expected_receipt()
        actual_health = json.loads(HEALTH_RECEIPT.read_text(encoding="utf-8"))
        expected_health_payload = expected_health(actual)
    except (OSError, ValueError, FileNotFoundError) as exc:
        print(f"FAIL release/health receipt cannot be validated: {exc}")
        return 1
    for key in ("schema_version", "project_id", "public_url", "release_id", "revision_kind", "artifact_manifest_sha256", "deployment_contract", "avds", "manifest"):
        if actual.get(key) != expected.get(key):
            print(f"FAIL release receipt drift: {key}")
            return 1
    if actual.get("release_id") != expected["release_id"]:
        print("FAIL release receipt release_id mismatch")
        return 1
    if actual_health != expected_health_payload:
        print("FAIL static health receipt drift")
        return 1
    print(f"RELEASE_RECEIPT_OK release_id={actual['release_id']}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="validate the existing receipt")
    args = parser.parse_args()
    if args.check:
        return check()
    receipt = expected_receipt()
    RECEIPT.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    HEALTH_RECEIPT.write_text(json.dumps(expected_health(receipt), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"RELEASE_RECEIPT_BUILT release_id={receipt['release_id']}")
    return check()


if __name__ == "__main__":
    sys.exit(main())
