#!/usr/bin/env python3
from __future__ import annotations

import json
import hashlib
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "disarm.json"
AVDS_COVERAGE_PATH = ROOT / "data" / "avds-coverage.json"
AVDS_ADOPTION_PATH = ROOT / ".well-known" / "avds-adoption.json"
AVDS_ADAPTER_PATH = ROOT / "data" / "avds-adapter.json"
AVDS_SYSTEM_CONTRACT_PATH = ROOT / "data" / "avds-system-contract.json"
AVDS_COMPONENT_CONTRACT_PATH = ROOT / "data" / "avds-component-contracts.json"
AVDS_RESPONSIVE_CONTRACT_PATH = ROOT / "data" / "avds-responsive-contract.json"
DISARM_PROVENANCE_PATH = ROOT / "data" / "disarm-provenance.json"
AVDS_LOCALE_CONTRACT_PATH = ROOT / "data" / "avds-locale-contract.json"
AVDS_DATA_VIZ_CONTRACT_PATH = ROOT / "data" / "avds-data-visualization-contract.json"
AVDS_VISUAL_REGRESSION_PATH = ROOT / "data" / "avds-visual-regression.json"
RELEASE_PATH = ROOT / "release.json"
HEALTH_PATH = ROOT / "health.json"
INDEX_PATH = ROOT / "index.html"
STYLE_PATH = ROOT / "assets" / "avds-disarm-adapter.css"
APP_SCRIPT_PATH = ROOT / "assets" / "app.js"
ROBOTS_PATH = ROOT / "robots.txt"
SITEMAP_PATH = ROOT / "sitemap.xml"


def fail(message: str) -> None:
    print(f"FAIL {message}")
    raise SystemExit(1)


def require(condition: bool, message: str) -> None:
    if not condition:
        fail(message)


def load_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # pragma: no cover - hard failure path
        fail(f"cannot parse JSON {path}: {exc}")


def expected_adapter_asset() -> str:
    adapter = load_json(AVDS_ADAPTER_PATH)
    style_digest = hashlib.sha256(STYLE_PATH.read_bytes()).hexdigest()[:12]
    return f"/assets/avds-disarm-adapter.css?v={adapter.get('adapter_version')}&sha={style_digest}"


def check_html() -> None:
    html = INDEX_PATH.read_text(encoding="utf-8")
    require('<html lang="ru"' in html, "index.html missing lang=ru")
    require('href="#main-content"' in html, "index.html missing skip-link")
    require('id="main-content"' in html, "index.html missing #main-content anchor")
    require('rel="canonical" href="https://disarm.qdev.run/"' in html, "index.html missing canonical URL")
    require("og:title" in html and "og:description" in html and "og:image" in html, "index.html missing core OG tags")
    require('Локализованный обозреватель фреймворка DISARM' not in html, "static metadata overstates the incomplete localization")
    app_js = APP_SCRIPT_PATH.read_text(encoding="utf-8")
    require("ogDescription.setAttribute('content', localizedDescription)" in app_js, "localized Open Graph description must use the selected locale string")
    require("Content-Security-Policy" in html, "index.html missing CSP meta")
    app_digest = hashlib.sha256(APP_SCRIPT_PATH.read_bytes()).hexdigest()[:12]
    require(re.search(r'<script[^>]+src="assets/app\.js\?[^\"]*&sha=' + app_digest + r'"></script>', html) is not None, "index.html app.js cache key does not match current asset")
    require(len(re.findall(r'<section[^>]+class="[^"]*tabpanel', html)) == 7, "unexpected tabpanel count")
    require(len(re.findall(r'<button[^>]+class="[^"]*avds-pill-tab', html)) == 7, "unexpected top-level tab count")
    require(len(re.findall(r'<input[^>]+type="search"', html)) >= 4, "too few search inputs")
    require('avds-coverage-badge' not in html and 'AVDS 4.7.0-97' not in html, "reader-facing HTML exposes an AVDS operator badge")
    require('href=".well-known/avds-adoption.json"' not in html, "reader-facing HTML links to AVDS adoption evidence")
    require(f'href="{expected_adapter_asset().lstrip("/")}"' in html, "index.html missing versioned AVDS adapter")
    require('href="assets/style.css' not in html, "index.html still loads the unversioned legacy override")
    require('id="data-state"' in html and 'role="status"' in html, "index.html missing data-state contract")
    require('id="data-retry"' in html and 'disabled hidden' in html, "index.html missing disabled retry state")
    require('id="app-loading"' in html and 'avds-loading-skeleton' in html, "index.html missing loading skeleton")
    require('id="theme-select"' in html, "index.html missing AVDS theme picker")
    require('id="text-scale-select"' in html and 'value="200"' in html, "index.html missing 200 percent text-scale control")
    require('id="a11y-transcript"' in html and 'class="avds-sr-only"' in html, "index.html missing screen-reader transcript")
    require('role="grid"' in html and 'aria-describedby="red-matrix-help"' in html, "index.html missing red matrix accessibility contract")
    require('data/disarm-provenance.json' not in html, "reader-facing HTML links to the raw provenance JSON")
    require('https://github.com/DISARMFoundation/DISARMframeworks-17' in html, "reader-facing source link is missing")
    require('id="incident-geo-map"' in html and 'id="incident-geo-list"' in html, "index.html missing incident map-list composition")

    local_refs = re.findall(r'''(?:href|src)=["']([^"']+)["']''', html)
    for ref in local_refs:
        if ref.startswith(("http://", "https://", "mailto:", "#", "data:")):
            continue
        local_path = ref.split("?", 1)[0].lstrip("/")
        if local_path == "_avds/avds.css":
            continue
        require(local_path, f"empty local asset ref: {ref}")
        require((ROOT / local_path).is_file(), f"missing local asset referenced by index.html: {ref}")


def check_accessibility_preferences() -> None:
    css = STYLE_PATH.read_text(encoding="utf-8")
    require("@media (prefers-reduced-motion: reduce)" in css, "missing reduced-motion contract")
    require("@media (forced-colors: active)" in css, "missing forced-colors contract")
    require("transition-duration: calc(var(--disarm-motion-unit) * .01) !important" in css, "reduced-motion transition guard missing")
    require("outline: calc(var(--disarm-unit) * 2) solid Highlight" in css, "forced-colors focus guard missing")
    require("@media print" in css, "missing print theme contract")
    require("avds-skeleton-shimmer" in css, "missing skeleton state contract")
    require(".avds-sr-only" in css, "missing screen-reader-only utility")
    require('--disarm-text-scale: 1' in css and 'html[data-text-scale="200"]' in css, "missing text-scale accessibility contract")
    require('data-avds-theme="institutional"' in css, "missing institutional theme mapping")
    require('data-avds-theme="editorial"' in css, "missing editorial theme mapping")
    require('data-avds-theme="analytics"' in css, "missing analytics theme mapping")
    require('data-avds-theme="map"' in css, "missing map theme mapping")
    require(
        re.search(r"#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)", css) is None,
        "AVDS adapter contains hard-coded color literals",
    )


def check_layout_token_governance() -> None:
    css = STYLE_PATH.read_text(encoding="utf-8")
    require("--disarm-unit: 1px" in css, "missing local AVDS scalar length token")
    require("--disarm-motion-unit: 1ms" in css, "missing local AVDS scalar motion token")
    require("--disarm-z-raised: 1" in css and "--disarm-z-sticky: 20" in css, "missing local AVDS z-index tokens")
    # The root bridge owns the scalar definitions. The responsive media feature
    # values stay literal because CSS custom properties cannot be used there.
    governed = css.split("html, body {", 1)[1]
    governed = re.sub(r"@media \(max-width: (?:1100|760)px\)", "@media (governed)", governed)
    require(
        re.search(r"(?<![\\w-])\\d+(?:\\.\\d+)?(?:px|ms)(?![\\w-])", governed) is None,
        "active adapter contains an ungoverned raw pixel or motion literal",
    )
    require(re.search(r"z-index:\s*\\d+", governed) is None, "active adapter contains an ungoverned raw z-index")
    require("calc(var(--disarm-unit)" in governed, "AVDS scalar length token is not consumed")
    require("calc(var(--disarm-motion-unit)" in governed, "AVDS scalar motion token is not consumed")


def check_seo_files() -> None:
    robots = ROBOTS_PATH.read_text(encoding="utf-8")
    sitemap = SITEMAP_PATH.read_text(encoding="utf-8")
    require("User-agent: *" in robots, "robots.txt missing user-agent")
    require("Allow: /" in robots, "robots.txt missing allow rule")
    require("Sitemap: https://disarm.qdev.run/sitemap.xml" in robots, "robots.txt missing sitemap URL")
    require("<loc>https://disarm.qdev.run/</loc>" in sitemap, "sitemap.xml missing canonical loc")
    require("<urlset" in sitemap and "</urlset>" in sitemap, "sitemap.xml malformed")


def check_release_publish_contract() -> None:
    """Keep receipt publication explicit even though receipts cannot hash themselves."""
    release = load_json(RELEASE_PATH)
    health = load_json(HEALTH_PATH)
    publish_files = release.get("deployment_contract", {}).get("required_publish_files")
    require(
        publish_files == ["release.json", "health.json"],
        "release publish allowlist must include both self-referential receipts",
    )
    require(release.get("release_id", "").startswith("content-"), "release receipt has no content identity")
    published_paths = {item.get("path") for item in release.get("manifest", {}).get("artifacts", [])}
    require("supporting-data/disarm-1x-archive-unknown-revision.json" not in published_paths, "unverified archive data must remain outside the public release")
    require(health.get("release_id") == release.get("release_id"), "health receipt release identity mismatch")
    require(
        health.get("release_manifest_sha256") == release.get("artifact_manifest_sha256"),
        "health receipt manifest identity mismatch",
    )


def check_disarm_data() -> None:
    data = load_json(DATA_PATH)

    required = ["phases", "tactics", "techniques", "counters", "incidents"]
    for key in required:
        require(bool(data.get(key)), f"missing or empty data key: {key}")

    buckets = [
        "phases",
        "tactics",
        "techniques",
        "counters",
        "incidents",
        "metatechniques",
        "detections",
        "tasks",
        "tools",
    ]

    id_index: dict[str, dict] = {}
    counts: dict[str, int] = {}

    for bucket in buckets:
        items = data.get(bucket, [])
        counts[bucket] = len(items)
        seen: set[str] = set()
        for item in items:
            require(isinstance(item, dict), f"{bucket} contains non-object item")
            disarm_id = item.get("disarm_id")
            require(bool(disarm_id), f"{bucket} contains object without disarm_id")
            require(disarm_id not in seen, f"duplicate id in {bucket}: {disarm_id}")
            seen.add(disarm_id)
            require(disarm_id not in id_index, f"cross-bucket duplicate id: {disarm_id}")
            id_index[disarm_id] = item

    missing_refs: list[tuple[str, str]] = []

    for tech in data.get("techniques", []):
        require(tech.get("tactic_id"), f"technique missing tactic_id: {tech.get('disarm_id')}")
        require(tech["tactic_id"] in id_index, f"technique {tech['disarm_id']} points to missing tactic {tech['tactic_id']}")
        for ref in tech.get("counters", []) + tech.get("incidents", []) + tech.get("detections", []):
            if ref not in id_index:
                missing_refs.append((tech["disarm_id"], ref))

    for counter in data.get("counters", []):
        for ref in counter.get("techniques", []):
            if ref not in id_index:
                missing_refs.append((counter["disarm_id"], ref))

    phase_ids = {p["disarm_id"] for p in data.get("phases", [])}
    for tactic in data.get("tactics", []):
        require(tactic.get("phase_id") in phase_ids, f"tactic {tactic['disarm_id']} points to missing phase {tactic.get('phase_id')}")

    phase_to_tactics = data.get("phase_to_tactics", {})
    tactic_to_techniques = data.get("tactic_to_techniques", {})
    tactic_to_counters = data.get("tactic_to_counters", {})

    for phase_id, tactic_ids in phase_to_tactics.items():
        require(phase_id in phase_ids, f"phase_to_tactics unknown phase {phase_id}")
        for tactic_id in tactic_ids:
            require(tactic_id in id_index, f"phase_to_tactics missing tactic {phase_id}->{tactic_id}")

    tactic_ids = {t["disarm_id"] for t in data.get("tactics", [])}
    for tactic_id, technique_ids in tactic_to_techniques.items():
        require(tactic_id in tactic_ids, f"tactic_to_techniques unknown tactic {tactic_id}")
        for technique_id in technique_ids:
            require(technique_id in id_index, f"tactic_to_techniques missing technique {tactic_id}->{technique_id}")

    for tactic_id, counter_ids in tactic_to_counters.items():
        require(tactic_id in tactic_ids, f"tactic_to_counters unknown tactic {tactic_id}")
        for counter_id in counter_ids:
            require(counter_id in id_index, f"tactic_to_counters missing counter {tactic_id}->{counter_id}")

    require(
        not missing_refs,
        "broken refs: " + ", ".join(f"{owner}->{ref}" for owner, ref in missing_refs[:10]),
    )

    print(
        "counts "
        + " ".join(
            f"{key}={counts[key]}"
            for key in ["phases", "tactics", "techniques", "counters", "incidents", "metatechniques", "detections", "tools", "tasks"]
        )
    )


def check_avds_coverage() -> None:
    audit = load_json(AVDS_COVERAGE_PATH)
    categories = audit.get("categories", [])
    values = {"pass": 1, "partial": 0.5, "fail": 0}
    require(audit.get("schema_version") == "disarm-avds-maturity-v2", "unexpected AVDS coverage schema")
    require(re.fullmatch(r"4\.\d+\.\d+", str(audit.get("avds_version", ""))) is not None, "invalid AVDS version")
    require(len(categories) == 10, "AVDS maturity must contain exactly ten categories")
    require(len({item.get("id") for item in categories}) == 10, "AVDS maturity category ids must be unique")
    computed_scores = []
    for category in categories:
        checks = category.get("checks", [])
        require(len(checks) == 5, f"AVDS category {category.get('id')} must contain five checks")
        require(all(item.get("status") in values for item in checks), f"AVDS category {category.get('id')} has invalid status")
        score = round(sum(values[item["status"]] for item in checks) * 100 / len(checks))
        require(score == category.get("score"), f"AVDS category {category.get('id')} score mismatch")
        computed_scores.append(score)
    overall = round(sum(computed_scores) / len(computed_scores))
    require(overall == audit.get("coverage_percent"), "AVDS maturity percent mismatch")
    require(audit.get("summary", {}).get("score") == overall, "AVDS maturity summary mismatch")
    routes = audit.get("route_coverage", {})
    require(routes.get("passed") == 20 and routes.get("total") == 20, "legacy route coverage mismatch")
    require(routes.get("coverage_percent") == 100, "legacy route coverage percent mismatch")


def check_avds_adoption() -> None:
    adoption = load_json(AVDS_ADOPTION_PATH)
    audit = load_json(AVDS_COVERAGE_PATH)
    coverage = adoption.get("coverage", {})
    work = adoption.get("work", {})
    require(adoption.get("schema_version") == "avds-adoption-badge-v1", "unexpected shared AVDS adoption schema")
    require(adoption.get("project_id") == "disarm", "unexpected AVDS adoption project")
    require(coverage.get("required") == 100, "AVDS adoption denominator mismatch")
    require(coverage.get("percent") == audit.get("coverage_percent"), "AVDS adoption score drift")
    require(coverage.get("implemented") + work.get("remaining") == 100, "AVDS adoption remainder mismatch")
    require(sum(item.get("units", 0) for item in work.get("items", [])) == work.get("remaining"), "AVDS adoption item units mismatch")


def check_avds_system_contract() -> None:
    contract = load_json(AVDS_SYSTEM_CONTRACT_PATH)
    require(contract.get("schema_version") == "disarm-avds-system-contract-v1", "unexpected AVDS system contract schema")
    require(contract.get("consumer") == "https://disarm.qdev.run/", "AVDS system contract consumer mismatch")
    upstream = contract.get("upstream", {})
    require(upstream.get("release_version") == "4.7.0", "AVDS system contract release mismatch")
    require(re.fullmatch(r"[0-9a-f]{40}", str(upstream.get("source_commit", ""))) is not None, "invalid AVDS source commit")
    observation = contract.get("current_upstream_observation", {})
    observed_release = observation.get("release", {})
    observed_version = str(observed_release.get("version", ""))
    require(re.fullmatch(r"\d+\.\d+\.\d+", observed_version) is not None, "invalid observed AVDS release version")
    require(re.fullmatch(r"[0-9a-f]{40}", str(observed_release.get("source_commit", ""))) is not None, "invalid observed AVDS source commit")
    observed_package = observation.get("ui_package", {})
    require(observed_package.get("version") == observed_version, "observed AVDS UI package version mismatch")
    migration = observation.get("migration", {})
    require(migration.get("portfolio_pilots") == "planned" and migration.get("stable_system") == "planned", "observed AVDS migration gate changed; re-evaluate the consumer decision")
    decision = observation.get("consumer_decision", {})
    adapter = load_json(AVDS_ADAPTER_PATH)
    require(decision.get("status") == "hold-pinned-consumer-baseline", "AVDS consumer migration decision changed")
    require(decision.get("adapter_avds_release_version") == adapter.get("avds_release_version"), "AVDS consumer decision pin drift")
    require(decision.get("adapter_package") == f"@sgeo/ui-kit@{adapter.get('design_package_version')}", "AVDS consumer package decision drift")
    observed_documents = observation.get("source_documents", [])
    require({item.get("url") for item in observed_documents} == {
        "https://avds.digital/release.json",
        "https://avds.digital/.well-known/avds-ui-contract.json",
        "https://avds.digital/.well-known/avds-development-system.json",
    }, "observed AVDS source-document set mismatch")
    require(all(re.fullmatch(r"[0-9a-f]{64}", str(item.get("sha256", ""))) for item in observed_documents), "invalid observed AVDS source-document digest")
    require(bool(contract.get("local_deviations")), "AVDS local deviations are missing")
    fonts = contract.get("fonts_and_icons", {})
    require(fonts.get("font_license_status") == "local-license-evidence-present", "font license evidence is missing")
    licenses = fonts.get("font_licenses", [])
    require(len(licenses) == 3, "font license register is incomplete")
    for license_item in licenses:
        target = ROOT / str(license_item.get("file", ""))
        require(target.is_file(), f"font license file missing: {target}")
        require(bool(license_item.get("license")) and bool(license_item.get("source")), "font license provenance is incomplete")
    required_sections = [
        "tokens", "fonts_and_icons", "themes", "component_contracts", "state_contract",
        "compositions", "responsive_contract", "data_visualization_contract",
        "accessibility_contract", "content_standard", "quality_contract",
    ]
    for section in required_sections:
        require(section in contract, f"AVDS system contract section missing: {section}")
    for item in contract.get("connected_files", []):
        path = item.get("path")
        if not path:
            continue
        if "*" in str(path):
            continue
        target = ROOT / str(path)
        require(target.is_file(), f"AVDS connected file missing: {path}")
        digest = hashlib.sha256(target.read_bytes()).hexdigest()
        require(digest == item.get("sha256"), f"AVDS connected file hash mismatch: {path}")


def check_avds_component_contracts() -> None:
    contract = load_json(AVDS_COMPONENT_CONTRACT_PATH)
    html = INDEX_PATH.read_text(encoding="utf-8")
    css = STYLE_PATH.read_text(encoding="utf-8")
    components = contract.get("components", [])
    require(contract.get("schema_version") == "disarm-avds-component-contracts-v1", "unexpected AVDS component contract schema")
    require(contract.get("adapter_version") == "1.3.10", "component contract adapter mismatch")
    require(len(components) == 10, "AVDS component registry must contain ten components")
    require(len({item.get("id") for item in components}) == 10, "AVDS component ids must be unique")
    for component in components:
        for field in ["id", "selector", "variants", "states", "size", "keyboard", "allowed_children"]:
            require(bool(component.get(field)), f"AVDS component contract missing {field}: {component.get('id')}")
        status = component.get("status", "implemented")
        if status == "retired":
            require(component.get("required_markup") == [], f"retired AVDS component still requires markup: {component.get('id')}")
            forbidden = component.get("forbidden_markup", [])
            require(bool(forbidden), f"retired AVDS component lacks forbidden markup: {component.get('id')}")
            require(all(marker not in html for marker in forbidden), f"retired AVDS component markup is still present: {component.get('id')}")
            continue
        require(status == "implemented", f"unknown AVDS component status: {component.get('id')}")
        require(bool(component.get("required_markup")), f"AVDS component contract missing required markup: {component.get('id')}")
        require(all(marker in html for marker in component["required_markup"]), f"AVDS component markup drift: {component['id']}")
        selector = str(component["selector"])
        class_tokens = re.findall(r"\.([a-zA-Z0-9_-]+)", selector)
        require(any(token in html or token in css for token in class_tokens), f"AVDS component selector drift: {component['id']}")


def check_avds_responsive_contract() -> None:
    contract = load_json(AVDS_RESPONSIVE_CONTRACT_PATH)
    viewports = contract.get("viewports", [])
    expected = [320, 390, 768, 820, 1024, 1440, 1920, 3840]
    require(contract.get("schema_version") == "disarm-avds-responsive-contract-v1", "unexpected AVDS responsive contract schema")
    require([item.get("width") for item in viewports] == expected, "AVDS responsive widths mismatch")
    for viewport in viewports:
        require(bool(viewport.get("composition")), f"responsive composition missing: {viewport.get('width')}")
        require(viewport.get("order") == ["masthead", "tabs", "workspace", "active panel", "footer"], f"responsive order mismatch: {viewport.get('width')}")
        require(bool(viewport.get("rails")), f"responsive rail rule missing: {viewport.get('width')}")
        require(viewport.get("status") == "verified-local", f"responsive browser proof missing: {viewport.get('width')}")


def check_disarm_provenance() -> None:
    provenance = load_json(DISARM_PROVENANCE_PATH)
    dataset = provenance.get("dataset", {})
    coverage = provenance.get("coverage", {})
    require(provenance.get("schema_version") == "disarm-provenance-v1", "unexpected DISARM provenance schema")
    license_sources = dataset.get("license_sources", [])
    require(dataset.get("license") == "CC-BY-SA-4.0", "DISARM provenance license mismatch")
    require(dataset.get("license_status") == "resolved_by_current_foundation_terms", "DISARM license basis missing")
    require(
        {(item.get("document"), item.get("license"), item.get("url")) for item in license_sources}
        == {
            ("README.md", "CC-BY-4.0", "https://github.com/DISARMFoundation/DISARMframeworks-17/blob/v1.7.0/README.md"),
            ("LICENSE.md", "CC-BY-SA-4.0", "https://github.com/DISARMFoundation/DISARMframeworks-17/blob/v1.7.0/LICENSE.md"),
            ("Foundation Terms of Service", "CC-BY-SA-4.0", "https://www.disarm.foundation/terms-of-service"),
        },
        "DISARM license source evidence mismatch",
    )
    source_data = load_json(DATA_PATH)
    require(source_data.get("license") == "CC-BY-SA-4.0", "DISARM data license mismatch")
    require(source_data.get("license_status") == "resolved_by_current_foundation_terms", "DISARM data license basis missing")
    require(source_data.get("license_sources") == license_sources, "DISARM data license source evidence mismatch")
    require("extended_techniques" not in source_data, "unverified DISARM archive records must not be in the public core JSON")
    require("supplemental_counts" not in source_data, "unverified DISARM archive counts must not be exposed in public data")
    require(dataset.get("source") == "https://github.com/DISARMFoundation/DISARMframeworks-17", "DISARM provenance source mismatch")
    require(coverage.get("techniques") == 71 and coverage.get("counters") == 140, "DISARM provenance coverage mismatch")
    require(dataset.get("source_revision") == "216a8828c7d0f6a67ad2a8867c716bf961914776", "DISARM SQLite source revision mismatch")
    require(dataset.get("source_artifact") == "generated_files/DISARM_database.sqlite", "DISARM SQLite source artifact mismatch")
    require(dataset.get("source_artifact_sha256") == "753eef8df1ce9678c41e16f7f45ccc59fce095c7be00f81f832be689bf43ad38", "DISARM SQLite artifact digest mismatch")
    require("supplemental_layers" not in provenance, "unverified DISARM archive metadata must not be exposed in public provenance")
    require("archive_extended" not in provenance, "unverified DISARM archive identifier must not be exposed in public provenance")
    require(len(provenance.get("interpretation_rules", [])) >= 3, "DISARM provenance interpretation rules incomplete")
    require(len(provenance.get("known_limits", [])) >= 3, "DISARM provenance limits incomplete")


def check_locale_contract() -> None:
    contract = load_json(AVDS_LOCALE_CONTRACT_PATH)
    html = INDEX_PATH.read_text(encoding="utf-8")
    js = (ROOT / "assets" / "app.js").read_text(encoding="utf-8")
    require(contract.get("schema_version") == "disarm-avds-locale-contract-v1", "unexpected AVDS locale contract schema")
    require(contract.get("active_locale") == "ru", "AVDS active locale mismatch")
    locales = contract.get("supported_locales", {})
    require(set(locales) == {"ru", "kk", "en"}, "AVDS locale set mismatch")
    require(locales["ru"].get("status") == "implemented", "RU locale is not marked implemented")
    require(locales["kk"].get("status") == "implemented" and locales["en"].get("status") == "implemented", "KK/EN authored locale status must be implemented")
    for locale in ("ru", "kk", "en"):
        disclosure = locales[locale].get("visible_disclosure", "")
        require(bool(disclosure) and disclosure in js, f"{locale} visible locale disclosure is missing from the runtime copy")
    require('id="locale-select"' in html and 'LOCALE_COPY' in js and 'setupLocale' in js, "RU/KK/EN locale picker is missing")
    require('TEXT_SCALE_KEY' in js and 'setupTextScale' in js, "text-scale persistence is missing")
    for ready_copy in [
        "Данные загружены из локального среза DISARM.",
        "Деректер жергілікті DISARM үзіндісінен жүктелді.",
        "Data loaded from the local DISARM snapshot.",
    ]:
        require(ready_copy in js, "locale ready-state copy must not imply unproven freshness")
    require(contract.get("number_rules", {}).get("grouping"), "locale number rules missing")
    require(contract.get("date_rules", {}).get("display"), "locale date rules missing")
    require(contract.get("unit_rules", {}).get("unknown"), "locale unit rules missing")
    require(contract.get("copy_rules", {}).get("empty") and contract.get("copy_rules", {}).get("error"), "locale state copy missing")


def check_data_visualization_contract() -> None:
    contract = load_json(AVDS_DATA_VIZ_CONTRACT_PATH)
    html = INDEX_PATH.read_text(encoding="utf-8")
    js = (ROOT / "assets" / "app.js").read_text(encoding="utf-8")
    require(contract.get("schema_version") == "disarm-avds-data-visualization-v1", "unexpected data visualization contract schema")
    require(contract.get("palettes", {}).get("semantic", {}).get("success"), "data semantic palette missing")
    require(contract.get("units_and_precision", {}).get("precision"), "data precision rule missing")
    missing = contract.get("missing_and_incomplete", {})
    require(missing.get("status") == "implemented" and missing.get("missing_label") == "нет данных", "data missing-value rule missing")
    require(contract.get("tabular_alternatives", {}).get("status") == "implemented", "data tabular alternative rule missing")
    require('data-viz="comparison-bar"' in js and 'data-table-alternative="true"' in js, "comparison visual lacks table alternative marker")
    require('compare-card__source' in js and 'https://github.com/DISARMFoundation/DISARMframeworks-17' in js, "comparison visual lacks reader-facing source link")
    require('data/disarm-provenance.json' not in js, "reader-facing JavaScript links to the raw provenance JSON")
    require('DISARM 1.7.0 SQLite core' in contract.get("sources", {}).get("comparison", ""), "data visualization contract does not identify the primary source layer")
    require('data/disarm-provenance.json' not in contract.get("sources", {}).get("comparison", ""), "data visualization contract directs readers to raw provenance JSON")
    require('compare-card__axis' in js and 'Шкала: от 0 до' in js, "comparison visual lacks explicit scale axis")
    period = contract.get("period_comparison", {})
    require(period.get("status") == "implemented", "period comparison contract must be implemented")
    require(period.get("measure") == "count of DISARM incident records grouped by year_started", "period comparison measure missing")
    require(period.get("zero_baseline") == "relative change is shown as n/a when the selected base year has no records", "period comparison zero-base rule missing")
    require("catalogue records only" in period.get("boundary", ""), "period comparison coverage boundary missing")
    require('incident-period-a' in html and 'incident-period-b' in html and 'renderIncidentPeriodComparison' in js and 'relativeDelta' in js, "period comparison runtime missing")
    maps = contract.get("maps", {})
    require(maps.get("status") == "implemented", "incident map contract must be implemented")
    require(maps.get("projection") == "equirectangular reference-point map", "incident map projection missing")
    require("country reference point" in maps.get("semantics", "").lower(), "incident map location boundary missing")
    require("renderIncidentGeoMap" in js and "COUNTRY_POINTS" in js and "incident-geo-list" in js, "incident map-list runtime missing")


def check_visual_regression_contract() -> None:
    contract = load_json(AVDS_VISUAL_REGRESSION_PATH)
    require(contract.get("schema_version") == "disarm-avds-visual-regression-v1", "unexpected visual-regression contract schema")
    require(contract.get("status") == "implemented", "visual-regression contract must be implemented")
    baselines = contract.get("baselines", [])
    require(len(baselines) == 4, "visual-regression baseline count mismatch")
    require({item.get("id") for item in baselines} == {"overview-1440", "overview-320", "red-1440", "red-320"}, "visual-regression baseline ids mismatch")
    require((ROOT / "scripts" / "check_visual_regression.py").is_file(), "visual-regression pixel-diff gate is missing")
    require((ROOT / "scripts" / "promote_visual_baselines.py").is_file(), "visual-regression baseline promotion guard is missing")
    for baseline in baselines:
        target = ROOT / str(baseline.get("file", ""))
        require(target.is_file(), f"visual-regression baseline missing: {baseline.get('id')}")
        digest = hashlib.sha256(target.read_bytes()).hexdigest()
        require(digest == baseline.get("sha256"), f"visual-regression baseline checksum mismatch: {baseline.get('id')}")
        viewport = baseline.get("viewport", {})
        require(viewport.get("width") in {320, 1440} and viewport.get("height") in {900, 1000}, f"visual-regression viewport mismatch: {baseline.get('id')}")
        limits = baseline.get("limits", {})
        require(limits.get("max_changed_pixels") == 0 and limits.get("max_mean_channel_delta") == 0, f"visual-regression limits are not fail-closed: {baseline.get('id')}")


def check_avds_adapter() -> None:
    adapter = load_json(AVDS_ADAPTER_PATH)
    require(adapter.get("schema_version") == "disarm-avds-static-adapter-v1", "unexpected AVDS adapter schema")
    require(adapter.get("adapter_version") == "1.3.10", "unexpected AVDS adapter version")
    require(adapter.get("avds_release_version") == "4.7.0", "AVDS adapter release version mismatch")
    require(adapter.get("design_package_version") == "4.5.1", "AVDS adapter package version mismatch")
    require(adapter.get("asset") == expected_adapter_asset(), "AVDS adapter asset mismatch")
    require(adapter.get("consumer_system_contract") == "/data/avds-system-contract.json", "AVDS system contract link mismatch")
    require(adapter.get("consumer_maturity_contract") == "/data/avds-coverage.json", "AVDS maturity contract link mismatch")
    require(adapter.get("component_contract") == "/data/avds-component-contracts.json", "AVDS component contract link mismatch")
    require(adapter.get("responsive_contract") == "/data/avds-responsive-contract.json", "AVDS responsive contract link mismatch")
    require(adapter.get("data_provenance") == "/data/disarm-provenance.json", "DISARM provenance link mismatch")
    require(adapter.get("locale_contract") == "/data/avds-locale-contract.json", "AVDS locale contract link mismatch")
    require(adapter.get("visual_regression_contract") == "/data/avds-visual-regression.json", "AVDS visual-regression contract link mismatch")


def main() -> None:
    require(DATA_PATH.is_file(), f"missing {DATA_PATH}")
    require(INDEX_PATH.is_file(), f"missing {INDEX_PATH}")
    require(ROBOTS_PATH.is_file(), f"missing {ROBOTS_PATH}")
    require(SITEMAP_PATH.is_file(), f"missing {SITEMAP_PATH}")
    require(AVDS_COVERAGE_PATH.is_file(), f"missing {AVDS_COVERAGE_PATH}")
    require(AVDS_ADOPTION_PATH.is_file(), f"missing {AVDS_ADOPTION_PATH}")
    require(AVDS_ADAPTER_PATH.is_file(), f"missing {AVDS_ADAPTER_PATH}")
    require(AVDS_SYSTEM_CONTRACT_PATH.is_file(), f"missing {AVDS_SYSTEM_CONTRACT_PATH}")
    require(AVDS_COMPONENT_CONTRACT_PATH.is_file(), f"missing {AVDS_COMPONENT_CONTRACT_PATH}")
    require(AVDS_RESPONSIVE_CONTRACT_PATH.is_file(), f"missing {AVDS_RESPONSIVE_CONTRACT_PATH}")
    require(DISARM_PROVENANCE_PATH.is_file(), f"missing {DISARM_PROVENANCE_PATH}")
    require(AVDS_LOCALE_CONTRACT_PATH.is_file(), f"missing {AVDS_LOCALE_CONTRACT_PATH}")
    require(AVDS_DATA_VIZ_CONTRACT_PATH.is_file(), f"missing {AVDS_DATA_VIZ_CONTRACT_PATH}")
    require(AVDS_VISUAL_REGRESSION_PATH.is_file(), f"missing {AVDS_VISUAL_REGRESSION_PATH}")
    require(RELEASE_PATH.is_file(), f"missing {RELEASE_PATH}")
    require(HEALTH_PATH.is_file(), f"missing {HEALTH_PATH}")
    require(STYLE_PATH.is_file(), f"missing {STYLE_PATH}")
    check_html()
    check_accessibility_preferences()
    check_layout_token_governance()
    check_seo_files()
    check_release_publish_contract()
    check_disarm_data()
    check_avds_coverage()
    check_avds_adoption()
    check_avds_system_contract()
    check_avds_component_contracts()
    check_avds_responsive_contract()
    check_disarm_provenance()
    check_locale_contract()
    check_data_visualization_contract()
    check_visual_regression_contract()
    check_avds_adapter()
    print("INTEGRITY_OK")


if __name__ == "__main__":
    main()
