#!/usr/bin/env bash
set -euo pipefail

# The login boundary requests /favicon.ico. Keep it derived from the canonical
# project SVG so the edge regex can serve the icon without changing nginx.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
sips -s format ico "$ROOT/favicon.svg" --out "$ROOT/favicon.ico" >/dev/null
echo "FAVICON_ICO_BUILT path=$ROOT/favicon.ico"
