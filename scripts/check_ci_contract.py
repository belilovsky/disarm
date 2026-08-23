#!/usr/bin/env python3
"""Validate the portable CI definitions without claiming that CI has run."""

from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_WORKFLOW = ROOT / ".github" / "workflows" / "source-quality.yml"
RELEASE_WORKFLOW = ROOT / ".github" / "workflows" / "release-evidence.yml"


def require(condition: bool, message: str) -> None:
    if not condition:
        print(f"FAIL {message}")
        raise SystemExit(1)


def text(path: Path) -> str:
    require(path.is_file(), f"missing CI workflow: {path.relative_to(ROOT)}")
    return path.read_text(encoding="utf-8")


def main() -> int:
    source = text(SOURCE_WORKFLOW)
    release = text(RELEASE_WORKFLOW)
    for needle in (
        "actions/checkout@v4",
        "actions/setup-node@v4",
        "actions/setup-python@v5",
        "./scripts/smoke_static.sh",
        "python3 scripts/build_avds_adoption.py --check",
        "python3 scripts/build_release_receipt.py --check",
        "permissions:\n  contents: read",
    ):
        require(needle in source, f"source CI workflow missing: {needle}")
    for needle in (
        "workflow_dispatch:",
        "actions/checkout@v4",
        "actions/setup-python@v5",
        "scripts/check_runtime_evidence.py",
        "./scripts/smoke_live.sh",
        "permissions:\n  contents: read",
    ):
        require(needle in release, f"release CI workflow missing: {needle}")
    print("CI_CONTRACT_OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
