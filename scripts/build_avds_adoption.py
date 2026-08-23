#!/usr/bin/env python3
"""Build the shared AVDS badge evidence from DISARM's maturity audit."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "avds-coverage.json"
OUTPUT = ROOT / ".well-known" / "avds-adoption.json"
UNIT_COST = {"pass": 0, "partial": 1, "fail": 2}


def build() -> dict[str, object]:
    audit = json.loads(SOURCE.read_text(encoding="utf-8"))
    checks = [
        (category["id"], check)
        for category in audit["categories"]
        for check in category["checks"]
    ]
    required = len(checks) * 2
    items = [
        {
            "id": f"{category_id}:{check['id']}",
            "title": check.get("gap") or f"Complete evidence for {check['id']}",
            "status": "remaining",
            "units": UNIT_COST[check["status"]],
        }
        for category_id, check in checks
        if check["status"] != "pass"
    ]
    remaining = sum(item["units"] for item in items)
    implemented = required - remaining
    identity = hashlib.sha1(
        json.dumps(audit, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    generated_at = str(audit.get("generated_at", ""))
    if len(generated_at) == 10:
        verified_at = f"{generated_at}T00:00:00Z"
    else:
        verified_at = dt.datetime.fromtimestamp(SOURCE.stat().st_mtime, dt.timezone.utc).isoformat()
    return {
        "schema_version": "avds-adoption-badge-v1",
        "project_id": "disarm",
        "version": audit["avds_version"],
        "coverage": {
            "scope": "disarm-ten-category-system-contract-maturity",
            "basis": "evidenced_check_points_over_required_check_points_floor",
            "required": required,
            "implemented": implemented,
            "percent": implemented * 100 // required,
        },
        "work": {
            "status": "complete" if remaining == 0 else "in_progress",
            "remaining": remaining,
            "items": items,
            "details_url": "https://disarm.qdev.run/data/avds-coverage.json",
        },
        "evidence": {
            "revision_kind": "content_sha1",
            "source_revision": identity,
            "runtime_revision": identity,
            "verified_at": verified_at,
            "checks_url": "https://disarm.qdev.run/.well-known/avds-adoption.json",
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    rendered = json.dumps(build(), ensure_ascii=False, indent=2) + "\n"
    if args.check:
        if not OUTPUT.is_file() or OUTPUT.read_text(encoding="utf-8") != rendered:
            raise SystemExit("AVDS adoption evidence is stale; run scripts/build_avds_adoption.py")
    else:
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(rendered, encoding="utf-8")
        print(f"Wrote {OUTPUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
