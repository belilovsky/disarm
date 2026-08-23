#!/usr/bin/env python3
"""Verify the public AVDS semantic contrast pairs used by the DISARM adapter."""

from __future__ import annotations

import argparse
import re
import urllib.request


THEMES = {
    "institutional": [
        ("p-ink", "p-paper-cream", "body"),
        ("p-ink-muted", "p-paper-cream", "muted"),
        ("p-editorial-navy", "p-paper-cream", "link"),
    ],
    "editorial": [
        ("p-ink", "p-gold-paper-bg", "body"),
        ("p-ink-muted", "p-gold-paper-bg", "muted"),
        ("p-editorial-navy", "p-gold-paper-bg", "link"),
    ],
    "analytics": [
        ("p-neutral-900", "p-neutral-25", "body"),
        ("p-neutral-500", "p-neutral-25", "muted"),
        ("p-blue-600", "p-neutral-25", "link"),
    ],
    "map": [
        ("p-neutral-900", "p-neutral-25", "body"),
        ("p-neutral-600", "p-neutral-25", "muted"),
        ("p-blue-700", "p-neutral-25", "link"),
    ],
    "dark": [
        ("p-neutral-50", "p-neutral-950", "body"),
        ("p-neutral-400", "p-neutral-950", "muted"),
        ("p-blue-500", "p-neutral-950", "link"),
    ],
}


def luminance(value: str) -> float:
    channels = [int(value[index:index + 2], 16) / 255 for index in (1, 3, 5)]
    linear = [channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4 for channel in channels]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def ratio(foreground: str, background: str) -> float:
    high, low = sorted((luminance(foreground), luminance(background)), reverse=True)
    return (high + 0.05) / (low + 0.05)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("base", nargs="?", default="https://disarm.qdev.run", help="public consumer base URL")
    args = parser.parse_args()
    url = args.base.rstrip("/") + "/_avds/avds.css"
    request = urllib.request.Request(url, headers={"Accept": "text/css"})
    with urllib.request.urlopen(request, timeout=20) as response:
        css = response.read().decode("utf-8")
    palette = {key: value.lower() for key, value in re.findall(r"--(p-[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})", css)}
    failures = []
    checked = 0
    for theme, pairs in THEMES.items():
        for foreground, background, role in pairs:
            if foreground not in palette or background not in palette:
                failures.append(f"{theme}:{role}:missing-token")
                continue
            value = ratio(palette[foreground], palette[background])
            checked += 1
            if value < 4.5:
                failures.append(f"{theme}:{role}:{value:.2f}")
    if failures:
        raise SystemExit("ACCESSIBILITY_CONTRAST_FAIL " + ",".join(failures))
    print(f"ACCESSIBILITY_CONTRAST_OK pairs={checked} min=4.5 source={url}")


if __name__ == "__main__":
    main()
