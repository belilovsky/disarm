#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://disarm.qdev.run}"
# The public projection includes a ~380 KB JSON corpus.  Advertise gzip and
# allow the edge a little more time for a cold/static-file transfer so the
# smoke gate measures availability rather than an uncompressed transport race.
CURL_ARGS=(--http1.1 --compressed --connect-timeout 5 --max-time 20 --retry 2 --retry-delay 1 --retry-all-errors -ks)

echo "== DISARM live smoke =="
echo "base=$BASE_URL"

check_status() {
  local path="$1"
  local expected="$2"
  local got
  if ! got="$(curl "${CURL_ARGS[@]}" -o /dev/null -w '%{http_code}' "$BASE_URL$path")"; then
    echo "FAIL request path=$path transport_error"
    exit 1
  fi
  if [[ "$got" != "$expected" ]]; then
    echo "FAIL status path=$path expected=$expected got=$got"
    exit 1
  fi
  echo "ok status path=$path code=$got"
}

check_header_contains() {
  local path="$1"
  local header="$2"
  local needle="$3"
  local value
  if ! value="$(curl "${CURL_ARGS[@]}" -I "$BASE_URL$path" | awk -F': ' -v key="$header" 'BEGIN{IGNORECASE=1} tolower($1)==tolower(key){print $2}' | tr -d '\r' | tail -1)"; then
    echo "FAIL header request path=$path header=$header transport_error"
    exit 1
  fi
  if [[ -z "$value" || "$value" != *"$needle"* ]]; then
    echo "FAIL header path=$path header=$header expected_fragment=$needle actual=${value:-<missing>}"
    exit 1
  fi
  echo "ok header path=$path header=$header"
}

# The entrypoint is intentionally protected by the server-side PIN boundary.
# Public, non-sensitive contracts below remain available for provenance and UI checks.
check_status / 302
check_header_contains / "Location" "/login"
check_status /release.json 200
check_status /health.json 200
check_status /data/disarm.json 200
check_status /data/avds-coverage.json 200
check_status /data/avds-adapter.json 200
check_status /data/avds-system-contract.json 200
check_status /data/avds-component-contracts.json 200
check_status /data/avds-responsive-contract.json 200
check_status /data/disarm-provenance.json 200
check_status /data/avds-locale-contract.json 200
check_status /data/avds-data-visualization-contract.json 200
check_status /data/avds-visual-regression.json 200
check_status /data/platform-capabilities.json 200
check_status /assets/avds-disarm-adapter.css 200
check_status /data/externalgroups.json 404
check_status /README.md 404
check_status /docs/FINAL_QA_PASS_2026-06-12.md 404
check_status /scripts/smoke_static.sh 404
check_status /index.html.bak.20260608T202227Z 404

check_header_contains / "X-Frame-Options" "SAMEORIGIN"
check_header_contains / "X-Content-Type-Options" "nosniff"
check_header_contains / "Referrer-Policy" "strict-origin-when-cross-origin"
check_header_contains / "Content-Security-Policy" "default-src 'self'"
check_header_contains / "Permissions-Policy" "camera=()"
check_header_contains / "Strict-Transport-Security" "max-age="

echo "LIVE_SMOKE_OK"
python3 scripts/check_avds_accessibility.py "$BASE_URL"
