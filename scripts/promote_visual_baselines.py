#!/usr/bin/env python3
"""Promote reviewed DISARM visual-regression captures into the contract baseline.

The command is intentionally explicit: it verifies every declared route and
viewport before replacing a baseline and recomputing its SHA-256 receipt.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = ROOT / "data" / "avds-visual-regression.json"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def parse_actual(values: list[str]) -> dict[str, Path]:
    parsed: dict[str, Path] = {}
    for value in values:
        key, separator, path = value.partition("=")
        if not separator or not key or not path:
            raise SystemExit(f"FAIL invalid --actual value: {value}")
        parsed[key] = Path(path).resolve()
    return parsed


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--actual", action="append", default=[], metavar="ID=PATH")
    parser.add_argument("--write", action="store_true", help="replace reviewed baseline files and hashes")
    args = parser.parse_args()
    if not args.write:
        raise SystemExit("FAIL pass --write after reviewing every supplied capture")

    manifest_path = args.manifest.resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("schema_version") != "disarm-avds-visual-regression-v1":
        raise SystemExit("FAIL unexpected visual-regression manifest schema")
    supplied = parse_actual(args.actual)
    baselines = manifest.get("baselines", [])
    ids = {item.get("id") for item in baselines}
    if set(supplied) != ids:
        raise SystemExit(f"FAIL expected actual IDs={sorted(ids)} got={sorted(supplied)}")

    for item in baselines:
        actual = supplied[item["id"]]
        if not actual.is_file():
            raise SystemExit(f"FAIL missing capture: {item['id']}")
        with Image.open(actual) as image:
            expected_size = (item["viewport"]["width"], item["viewport"]["height"])
            if image.size != expected_size:
                raise SystemExit(f"FAIL capture size {item['id']} expected={expected_size} got={image.size}")
        target = (ROOT / item["file"]).resolve()
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(actual, target)
        item["sha256"] = sha256(target)
        print(f"PROMOTED {item['id']} sha256={item['sha256']}")

    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"VISUAL_BASELINES_PROMOTED cases={len(baselines)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
