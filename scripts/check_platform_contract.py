#!/usr/bin/env python3
"""Fail-closed validation for DISARM's product-local Platform capability boundary."""

from __future__ import annotations

import json
import hashlib
import sys
from pathlib import Path

from jsonschema import Draft7Validator


ROOT = Path(__file__).resolve().parents[1]
CONTRACT_PATH = ROOT / "data" / "platform-capabilities.json"
MANIFEST_PATH = ROOT / "qdev-project.json"
PLATFORM_SCHEMA_PATH = ROOT / "contracts" / "qdev-project-manifest-v1.json"
PLATFORM_SCHEMA_SHA256 = "95529bcb534b0b9b20b53fa24e93e3ebeafdba640cff9d99540026fcfbf2ab26"
REQUIRED_CAPABILITIES = {"qazstack", "avds", "qazpipe", "qazlake", "qazcompute", "qazgeo", "identity"}
VALID_STATES = {"documented", "not_applicable"}


def fail(message: str) -> None:
    print(f"FAIL {message}")
    raise SystemExit(1)


def require(condition: bool, message: str) -> None:
    if not condition:
        fail(message)


def load_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        fail(f"cannot parse {path}: {exc}")


def main() -> int:
    contract = load_json(CONTRACT_PATH)
    manifest = load_json(MANIFEST_PATH)
    schema = load_json(PLATFORM_SCHEMA_PATH)
    schema_digest = hashlib.sha256(PLATFORM_SCHEMA_PATH.read_bytes()).hexdigest()
    require(schema_digest == PLATFORM_SCHEMA_SHA256, "vendored Platform manifest schema digest drift")
    require(
        schema.get("$id") == "https://platform.qdev.run/schemas/qdev-project-manifest-v1.json",
        "vendored Platform manifest schema identity mismatch",
    )
    require(
        contract.get("schema_version") == "disarm-platform-capability-boundaries-v1",
        "unexpected Platform capability boundary schema",
    )
    project = contract.get("project", {})
    require(project.get("id") == "disarm", "unexpected Platform project id")
    require(project.get("public_entrypoint") == "https://disarm.qdev.run/", "unexpected public entrypoint")
    manifest_meta = contract.get("platform_manifest", {})
    require(manifest_meta.get("state") == "present", "root manifest must be present")
    require(manifest_meta.get("path") == "qdev-project.json", "manifest path mismatch")
    errors = sorted(Draft7Validator(schema).iter_errors(manifest), key=lambda error: list(error.path))
    if errors:
        fail(f"manifest schema validation failed: {errors[0].message}")
    require(manifest.get("project_id") == project.get("id"), "manifest project id mismatch")
    require(manifest.get("profile") == "public-web", "manifest profile mismatch")
    require(manifest.get("lifecycle") == project.get("lifecycle"), "manifest lifecycle mismatch")
    require(manifest.get("runtime", {}).get("kind") == "static", "manifest runtime kind mismatch")
    require(manifest.get("operations", {}).get("health_path") == "/health.json", "manifest health path mismatch")
    require(manifest.get("operations", {}).get("release_revision_path") == "/release.json", "manifest release path mismatch")

    capabilities = contract.get("capabilities", [])
    observed = {item.get("id") for item in capabilities}
    require(observed == REQUIRED_CAPABILITIES, "capability set is incomplete or contains an unknown id")
    for item in capabilities:
        capability_id = item["id"]
        require(item.get("state") in VALID_STATES, f"invalid capability state: {capability_id}")
        require(bool(item.get("owner")), f"capability owner missing: {capability_id}")
        require(bool(item.get("boundary")), f"capability boundary missing: {capability_id}")
        require(bool(item.get("review_by")), f"capability review point missing: {capability_id}")
        if item.get("state") == "not_applicable":
            require(bool(item.get("rationale")), f"not_applicable capability lacks rationale: {capability_id}")

    avds = next(item for item in capabilities if item["id"] == "avds")
    require(avds.get("contract") == "/data/avds-adapter.json", "AVDS adapter contract mismatch")
    for ref in avds.get("evidence", []):
        require((ROOT / ref.lstrip("/")).is_file(), f"AVDS evidence is missing: {ref}")

    manifest_caps = manifest.get("capabilities", {})
    require(manifest_caps.get("avds", {}).get("mode") == "required", "manifest AVDS mode mismatch")
    require(manifest_caps.get("qazstack", {}).get("mode") == "optional", "manifest QazStack mode mismatch")
    require(manifest_caps.get("data", {}).get("qazpipe") is False, "manifest QazPipe boundary mismatch")
    require(manifest_caps.get("data", {}).get("qazlake") is False, "manifest QazLake boundary mismatch")
    require(manifest_caps.get("compute", {}).get("mode") == "not-applicable", "manifest compute boundary mismatch")
    require(manifest_caps.get("geo", {}).get("mode") == "not-applicable", "manifest geo boundary mismatch")

    privacy = contract.get("data_and_privacy", {})
    require((ROOT / privacy.get("source_contract", "").lstrip("/")).is_file(), "data provenance contract missing")
    require("not uploaded" in privacy.get("processing_boundary", ""), "local browser data boundary is not explicit")
    require(bool(privacy.get("degraded_state")), "degraded data state is not explicit")

    delivery = contract.get("routes_and_delivery", {})
    require("seven tab panels" in delivery.get("route_ledger", ""), "route ledger is not explicit")
    for command in delivery.get("source_gates", []):
        require(command, "empty source gate")
    release_gates = delivery.get("release_gates", [])
    require(bool(release_gates), "release gates are missing")
    require(
        any("check_runtime_evidence.py" in command for command in release_gates),
        "source-to-runtime parity gate is missing",
    )
    require("/login" in delivery.get("runtime_boundary", ""), "authenticated runtime boundary is not explicit")
    print("PLATFORM_CONTRACT_OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
