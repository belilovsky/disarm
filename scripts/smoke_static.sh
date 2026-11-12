#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "== DISARM static smoke =="

python3 scripts/build_corpus.py --check
node --check assets/app.js
node --check assets/data-core.js
node --check assets/i18n-runtime.js
python3 scripts/build_ui_locales.py --check
node scripts/check_product_regressions.cjs
node --check assets/disarm-login.js
python3 scripts/check_pin_contract.py
python3 scripts/check_exports.py --output "${DISARM_EXPORT_EVIDENCE:-/tmp/disarm-export-contracts}"
python3 -m json.tool data/disarm.json >/dev/null
python3 -m json.tool data/avds-coverage.json >/dev/null
python3 -m json.tool data/avds-adapter.json >/dev/null
python3 -m json.tool data/avds-system-contract.json >/dev/null
python3 -m json.tool data/avds-component-contracts.json >/dev/null
python3 -m json.tool data/avds-responsive-contract.json >/dev/null
python3 -m json.tool data/disarm-provenance.json >/dev/null
python3 -m json.tool data/avds-locale-contract.json >/dev/null
python3 -m json.tool data/avds-data-visualization-contract.json >/dev/null
python3 -m json.tool data/avds-visual-regression.json >/dev/null
python3 -m json.tool data/platform-capabilities.json >/dev/null
python3 -m json.tool qdev-project.json >/dev/null
python3 -m json.tool release.json >/dev/null
python3 -m json.tool health.json >/dev/null
python3 scripts/check_integrity.py
python3 scripts/check_platform_contract.py
python3 scripts/check_ci_contract.py
python3 scripts/build_release_receipt.py --check
python3 -m unittest discover -s tests -p 'test_*.py'

for file in index.html assets/app.js assets/avds-disarm-adapter.css assets/avds-static-token-contract.css assets/avds-static-preview-bundle.css data/disarm.json data/avds-coverage.json data/avds-adapter.json data/avds-system-contract.json data/avds-component-contracts.json data/avds-responsive-contract.json data/disarm-provenance.json data/avds-locale-contract.json data/avds-data-visualization-contract.json data/avds-visual-regression.json data/platform-capabilities.json qdev-project.json release.json health.json favicon.svg favicon.ico robots.txt sitemap.xml; do
  test -s "$file"
  echo "ok $file"
done

echo "SMOKE_OK"
