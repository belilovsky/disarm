#!/usr/bin/env python3
"""Verify DISARM AVDS visual baselines with a deterministic pixel-diff gate."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageStat


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = ROOT / "data" / "avds-visual-regression.json"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def compare(baseline: Path, actual: Path) -> tuple[int, float]:
    with Image.open(baseline) as expected_image, Image.open(actual) as actual_image:
        expected = expected_image.convert("RGBA")
        observed = actual_image.convert("RGBA")
        if expected.size != observed.size:
            raise ValueError(f"dimension mismatch expected={expected.size} actual={observed.size}")
        diff = ImageChops.difference(expected, observed)
        changed_pixels = sum(1 for pixel in diff.getdata() if pixel != (0, 0, 0, 0))
        mean_delta = sum(ImageStat.Stat(diff).mean) / 4
    return changed_pixels, mean_delta


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument(
        "--actual",
        action="append",
        default=[],
        metavar="ID=PATH",
        help="One freshly captured screenshot per baseline ID.",
    )
    args = parser.parse_args()
    manifest_path = args.manifest.resolve()
    manifest = json.loads(manifest_path.read_text())
    if manifest.get("schema_version") != "disarm-avds-visual-regression-v1":
        raise SystemExit("FAIL unexpected visual-regression manifest schema")
    if not args.actual:
        raise SystemExit("FAIL supply every baseline with --actual ID=PATH")

    supplied: dict[str, Path] = {}
    for item in args.actual:
        key, separator, value = item.partition("=")
        if not separator or not key or not value:
            raise SystemExit(f"FAIL invalid --actual value: {item}")
        supplied[key] = Path(value).resolve()

    baselines = manifest.get("baselines", [])
    baseline_ids = {item["id"] for item in baselines}
    if set(supplied) != baseline_ids:
        raise SystemExit(f"FAIL expected actual IDs={sorted(baseline_ids)} got={sorted(supplied)}")

    for item in baselines:
        baseline = (ROOT / item["file"]).resolve()
        actual = supplied[item["id"]]
        if not baseline.is_file() or not actual.is_file():
            raise SystemExit(f"FAIL missing screenshot id={item['id']}")
        if sha256(baseline) != item["sha256"]:
            raise SystemExit(f"FAIL baseline checksum changed id={item['id']}")
        try:
            changed_pixels, mean_delta = compare(baseline, actual)
        except ValueError as error:
            raise SystemExit(f"FAIL visual regression id={item['id']} {error}") from error
        limits = item["limits"]
        if changed_pixels > limits["max_changed_pixels"] or mean_delta > limits["max_mean_channel_delta"]:
            raise SystemExit(
                f"FAIL visual regression id={item['id']} changed_pixels={changed_pixels} mean_delta={mean_delta:.6f}"
            )
        print(f"ok visual id={item['id']} changed_pixels={changed_pixels} mean_delta={mean_delta:.6f}")
    print(f"VISUAL_REGRESSION_OK cases={len(baselines)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
