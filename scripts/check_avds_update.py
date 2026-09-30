#!/usr/bin/env python3
"""Fail-closed AVDS release compatibility gate.

The gate keeps the consumer's pinned AVDS identity aligned with the three
public AVDS documents and refreshes hashes of declared local contract files.
With --write it performs only those bounded contract updates; it never changes
product data, CSS, or component composition.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import time
import urllib.request
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SYSTEM_PATH = ROOT / "data" / "avds-system-contract.json"
ADAPTER_PATH = ROOT / "data" / "avds-adapter.json"
COVERAGE_PATH = ROOT / "data" / "avds-coverage.json"
URLS = {
    "release": "https://avds.digital/release.json",
    "ui": "https://avds.digital/.well-known/avds-ui-contract.json",
    "development": "https://avds.digital/.well-known/avds-development-system.json",
}


def fail(message: str) -> None:
    print(f"FAIL {message}")
    raise SystemExit(1)


def fetch(url: str) -> tuple[dict, str]:
    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    error: Exception | None = None
    for attempt in range(1, 4):
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                raw = response.read()
            break
        except Exception as exc:  # pragma: no cover - network failure path
            error = exc
            if attempt == 3:
                fail(f"cannot fetch {url} after {attempt} attempts: {exc}")
            time.sleep(attempt)
    else:  # pragma: no cover - loop either returns data or exits through fail
        fail(f"cannot fetch {url}: {error}")
    try:
        return json.loads(raw.decode("utf-8")), hashlib.sha256(raw).hexdigest()
    except Exception as exc:
        fail(f"invalid JSON from {url}: {exc}")


def load(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        fail(f"cannot parse {path}: {exc}")


def dump(path: Path, value: dict) -> None:
    rendered = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    if not path.is_file() or path.read_text(encoding="utf-8") != rendered:
        path.write_text(rendered, encoding="utf-8")


def local_file_hash_mismatches(system: dict) -> list[str]:
    mismatches: list[str] = []
    for item in system.get("connected_files", []):
        path = item.get("path")
        if not path or "*" in str(path):
            continue
        target = ROOT / str(path)
        if not target.is_file():
            mismatches.append(f"connected file is missing: {path}")
            continue
        digest = hashlib.sha256(target.read_bytes()).hexdigest()
        if item.get("sha256") != digest:
            mismatches.append(f"connected file hash drift: {path}")
    return mismatches


def refresh_local_file_hashes(system: dict) -> int:
    refreshed = 0
    for item in system.get("connected_files", []):
        path = item.get("path")
        if not path or "*" in str(path):
            continue
        target = ROOT / str(path)
        if not target.is_file():
            fail(f"connected file is missing: {path}")
        digest = hashlib.sha256(target.read_bytes()).hexdigest()
        if item.get("sha256") != digest:
            item["sha256"] = digest
            refreshed += 1
    return refreshed


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="write the bounded upstream identity update")
    args = parser.parse_args()

    release, release_hash = fetch(URLS["release"])
    ui, ui_hash = fetch(URLS["ui"])
    development, development_hash = fetch(URLS["development"])
    system = load(SYSTEM_PATH)
    adapter = load(ADAPTER_PATH)
    coverage = load(COVERAGE_PATH)

    version = str(release.get("version", ""))
    source_commit = str(release.get("sourceSha", ""))
    build_id = str(release.get("buildId", ""))
    built_at = str(release.get("builtAt", ""))
    artifact_sha = str(release.get("artifactDigest", {}).get("sha256", ""))
    packages = ui.get("packages", {})
    logical_package = packages.get("logical", {})
    source_package = ui.get("source_package", {})
    package_version = str(logical_package.get("version", source_package.get("version", "")))
    package_name = str(logical_package.get("name", source_package.get("name", "@sgeo/ui-kit")))
    package_identity = f"{package_name}@{package_version}"
    development_version = str(development.get("contractVersion", ""))
    version_match = re.fullmatch(r"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)", version)
    if version_match is None:
        fail(f"invalid upstream AVDS version: {version}")
    if not re.fullmatch(r"[0-9a-f]{40}", source_commit):
        fail("upstream sourceSha is not a 40-character commit")
    for label, value in [("buildId", build_id), ("builtAt", built_at), ("artifact sha256", artifact_sha), ("ui package", package_identity), ("development contract", development_version)]:
        if not value:
            fail(f"upstream {label} is missing")

    consumer_version = str(adapter.get("avds_release_version", ""))
    consumer_match = re.fullmatch(r"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)", consumer_version)
    if consumer_match is None:
        fail(f"invalid pinned consumer AVDS version: {consumer_version}")
    if int(version_match.group(1)) != int(consumer_match.group(1)):
        compatibility = packages.get("compatibility", {})
        delivery = packages.get("delivery", {})
        migration = development.get("migration", {})
        print("UPSTREAM_MIGRATION_REQUIRED")
        print(f"- latest AVDS release: {version} ({source_commit}, build {build_id})")
        print(f"- latest logical UI package: {package_identity}")
        print(f"- pinned DISARM adapter: AVDS {consumer_version}, package @sgeo/ui-kit@{adapter.get('design_package_version')}")
        print(f"- legacy package contract: {compatibility.get('logicalName', 'unknown')} {compatibility.get('version', 'unknown')}; supportedThrough={compatibility.get('supportedThrough', 'unknown')}")
        print(f"- distribution: mode={delivery.get('mode', 'unknown')}, published={delivery.get('published', 'unknown')}, registry={delivery.get('registry', 'unknown')}")
        print("- migration: " + ", ".join(f"{key}={migration.get(key, 'unknown')}" for key in ("goldenPaths", "portfolioPilots", "stableSystem")))
        print("- refusing to rewrite the consumer pin: current local files do not prove this major-version migration")
        raise SystemExit(2)

    upstream = system.get("upstream", {})
    mismatches = []
    expected = {
        "release_version": version,
        "source_commit": source_commit,
        "build_id": build_id,
        "built_at": built_at,
        "artifact_sha256": artifact_sha,
        "design_package": package_identity,
        "development_contract_version": development_version,
    }
    for key, value in expected.items():
        if str(upstream.get(key, "")) != value:
            mismatches.append(f"system.upstream.{key}={upstream.get(key)!r} expected {value!r}")
    if str(adapter.get("avds_release_version", "")) != version:
        mismatches.append(f"adapter.avds_release_version={adapter.get('avds_release_version')!r} expected {version!r}")
    if str(coverage.get("avds_version", "")) != version:
        mismatches.append(f"coverage.avds_version={coverage.get('avds_version')!r} expected {version!r}")
    document_hashes = {item.get("url"): item.get("sha256") for item in upstream.get("source_documents", [])}
    for key, url in URLS.items():
        if document_hashes.get(url) != {"release": release_hash, "ui": ui_hash, "development": development_hash}[key]:
            mismatches.append(f"system source hash for {url} is not pinned to the fetched document")
    mismatches.extend(local_file_hash_mismatches(system))

    if mismatches and not args.write:
        print("UPSTREAM_DRIFT")
        for mismatch in mismatches:
            print(f"- {mismatch}")
        raise SystemExit(2)

    if args.write:
        upstream.update(expected)
        upstream["source_documents"] = [
            {"url": URLS["release"], "sha256": release_hash},
            {"url": URLS["ui"], "sha256": ui_hash},
            {"url": URLS["development"], "sha256": development_hash},
        ]
        system["upstream"] = upstream
        system["synced_at"] = str(date.today())
        refreshed_hashes = refresh_local_file_hashes(system)
        adapter["avds_release_version"] = version
        coverage["avds_version"] = version
        coverage["generated_at"] = str(date.today())
        dump(SYSTEM_PATH, system)
        dump(ADAPTER_PATH, adapter)
        dump(COVERAGE_PATH, coverage)
        print(f"UPSTREAM_SYNCED version={version} source={source_commit} build={build_id} local_hashes={refreshed_hashes}")
    else:
        print(f"UPSTREAM_OK version={version} source={source_commit} build={build_id}")


if __name__ == "__main__":
    main()
