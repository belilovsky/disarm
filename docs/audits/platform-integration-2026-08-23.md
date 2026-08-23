# Platform integration audit — DISARM — 2026-08-23

## Scope and authority

- **Canonical source observed:** `/Users/belilovsky/Documents/Codex/2026-08-11/disarm-avds-coverage`; it is readable, clean, and has no `.git` metadata. Git SHA, default branch, repository URL and source authority are therefore **unverifiable**.
- **Runtime/public entrypoint:** `https://disarm.qdev.run`.
- **Evidence cut-off:** `2026-08-23T15:40:05Z` for authority/AV DS observation; local and public gates were rerun immediately afterwards in this audit cycle.
- **Release identity:** `content-3b5708d0f2311e4329204459`, content manifest SHA-256 `3b5708d0f2311e432920445996601117e6e99351cc76ab7651d13ca285e84173`, generated `2026-08-23T16:13:03Z`.
- **Boundaries:** no authenticated Platform registry, canonical VCS authority, QazStack registry, or authenticated DISARM browser session was available. No credential, PIN, external registry, shared host configuration, or other project was changed.

## Verdict

`blocked` — **`1/11 = 9%` covered**.

The sole covered relation is the shipped AV DS adapter: local source, public contracts and the live release receipt agree. The required root manifest is absent; Platform catalog and bilateral capability evidence are authentication-gated. A static content health receipt proves release integrity, not process liveness or an authenticated product journey.

| State | Count | Meaning in this audit |
| --- | ---: | --- |
| covered | 1 | Fresh product and runtime evidence agree. |
| documented | 4 | Project-side contract exists; bilateral or authenticated proof is incomplete. |
| missing | 1 | Required root contract is absent. |
| stale | 0 | No accepted item relies on expired evidence. |
| conflicting | 0 | No currently observed sources disagree. |
| not_applicable | 0 | No Platform-authoritative capability exception was observable. |
| unverifiable | 5 | Required relation cannot be observed without Platform authority. |

`covered` requires fresh source and operational proof. `documented` is not implementation or runtime acceptance. `missing` is an absent required contract or proof. `stale` is evidence outside its declared observation window. `conflicting` is disagreeing evidence. `not_applicable` requires an authoritative mode, owner, boundary and review date. `unverifiable` is an access/environment limitation, never a pass.

## `qdev-project.json` and migration

| Check | State | Evidence | Closure owner, action and proof |
| --- | --- | --- | --- |
| Root-level manifest in observed source | **missing** | `/Users/belilovsky/Documents/Codex/2026-08-11/disarm-avds-coverage/qdev-project.json` is absent. | **DISARM product owner + Platform catalog owner:** obtain the authoritative `qdev-project-manifest-v1` schema in the Platform Portal, add the root manifest in canonical VCS and validate it. **Proof:** schema pass at a committed source revision; identity, lifecycle, owner, route and every capability mode agree with the catalog. |
| Canonical source SHA/default branch/repository | **unverifiable** | The checkout has no `.git`, `HEAD`, branch or remote metadata; `release.json.source_revision` is `null` with status `unverifiable`. | **Source/release owner:** provide/restore the canonical VCS checkout or immutable source record. **Proof:** `git rev-parse HEAD`, default branch and remote agree with manifest, catalog and release receipt. |
| Platform registry/schema/catalog | **unverifiable** | Safe `HEAD https://platform.qdev.run/site-registry.json` returned `302` to `https://platform.qdev.run/__auth/login`. | **Platform catalog owner:** allow an authorized evidence read or provide an immutable approved snapshot. **Proof:** schema, DISARM record and capability/consumer registry are observable and agree with the manifest. |

The local `data/platform-capabilities.json`, public `.well-known` adoption object, README and release receipt are product evidence only. None is a substitute for the root manifest.

## Coverage matrix

| Area | Requirement | Project evidence | Platform/runtime evidence | State | Next closure action |
| --- | --- | --- | --- | --- | --- |
| Identity | required | Public receipts identify `project_id: disarm`; no root manifest or VCS identity. | Public release is content-addressed; Platform registry is auth-gated. | **missing** | Add/validate manifest and reconcile catalog, VCS and runtime identity. |
| QazStack | capability mode unknown | `data/platform-capabilities.json` documents a static, read-only, no-primitives boundary. | Consumer contract and primitives registry cannot be observed. | **unverifiable** | Platform/QazStack owner accepts an explicit exception or records the consumer contract/receipt. |
| AV DS | shipped UI | Static adapter `1.3.5`, AV DS `4.7.0`, maturity `97%`; token/component/responsive/a11y contracts and local checks pass. | Public adapter/adoption/release/health contracts match `content-3b5708d0f2311e4329204459`; runtime gate and contrast gate pass. | **covered** | Keep content receipt and browser evidence release-bound. |
| QazPipe | capability mode unknown | Static committed public projection; no ingestion or queue. | No Platform profile or consumer receipt observable. | **unverifiable** | Declare accepted N/A mode with owner, boundary, degradation rule and review date, or add contract. |
| QazLake | capability mode unknown | `data/disarm.json` public projection and provenance/degraded-state contracts exist. | No Platform projection/query contract observable. | **unverifiable** | Record accepted N/A or reviewed data contract including owner, freshness, access boundary and fallback. |
| QazCompute | capability mode unknown | No model, job or server-side computation; local non-mutation boundary exists. | No Platform compute contract/receipt observable. | **unverifiable** | Record accepted N/A/non-mutation exception before any compute feature. |
| QazGeo | capability mode unknown | Country reference points and list alternative are disclosed; no QazGeo client. | No geographic profile/dataset receipt observable. | **unverifiable** | Record accepted N/A or a precision/source/fallback data contract. |
| Identity/security | required | PIN-protected root, no accounts/roles/mutations in source, protected source paths denied; headers tested. | `302 /login` is fresh; session policy and Platform Identity relation are not observable. | **documented** | Declare approved identity mode; provide anonymous/authenticated/session/logout/CSRF/audit proof without exposing credentials. |
| Data/privacy | required | Provenance, public projection and locale-aware missing-attribution states are in source; source scan found no secrets/PII in public projection. | No Platform retention/access record observable. | **documented** | Data steward confirms retention/access policy and accepts the public projection. |
| Routes/UI | required | Route ledger, empty/degraded states, keyboard/focus and local 14-cell desktop/mobile evidence exist. | Public root/login shell is fresh; no authorized product-route browser session. | **documented** | Authorized UI owner supplies exact-release desktop/mobile route-state proof without sharing credentials. |
| Delivery/operations | required | CI, integrity, receipt, static smoke and unit checks pass; rollback contract requires timestamped snapshots. | `release.json`/`health.json` agree with live content release, `health.status: ok`, root remains `302 /login`. | **documented** | Operations owner adds process-readiness/observability and independent rollback/backup receipt if required by the accepted lifecycle. |

## Cross-system consistency

| Claim / edge | Product evidence | Platform evidence | Result |
| --- | --- | --- | --- |
| DISARM identity → catalog/runtime | `release.json`, `health.json`, public route | Registry and manifest/schema auth-gated | **missing/unverifiable** |
| DISARM → QazStack | local static N/A boundary | consumer/primitives registry unavailable | **unverifiable** |
| DISARM → AV DS | `data/avds-adapter.json`, adoption/system contracts | public contracts and release receipt match | **covered** |
| DISARM → QazPipe/QazLake/QazCompute/QazGeo | product boundary declarations | capability modes/receipts unavailable | **unverifiable** |
| DISARM → Identity | server PIN boundary and no-mutation source | Platform identity/session evidence unavailable | **documented** |

## Checks run

| Gate | Result | Evidence |
| --- | --- | --- |
| Root manifest / source identity | **blocked** | Root manifest missing; checkout has no Git metadata. |
| Platform registry safe observation | **blocked externally** | `302` to Platform login; no schema/catalog/registry was inferred. |
| AV DS upstream | **pass** | `check_avds_update.py`: AV DS `4.7.0`, source `79342b07b061938c14101a213d1dd0c7a412d689`. Exact AV DS source object is not local, so source-level component API currency remains unverified. |
| Local integrity and contracts | **pass** | Adoption receipt, release receipt, integrity, Platform and CI contracts pass. |
| Unit and static smoke | **pass** | 3 tests pass; all allowlisted local artifacts and static contracts pass. |
| Runtime parity | **pass** | `RUNTIME_EVIDENCE_OK`: public and local release `content-3b5708d0f2311e4329204459`, adapter `1.3.5`, maturity `97`, health `ok`, root `302 /login`. |
| Public boundary/security smoke | **pass within static scope** | Public contracts/allowlist, protected source paths and headers pass; contrast: 15 token pairs at 4.5 minimum. |
| Browser/UI | **pass locally; documented publicly** | Local 14-cell desktop/mobile acceptance has no overflow or console/page errors; public evidence reaches protected `/login` only, without PIN entry. |
| EdPol public copy | **blocked externally** | Authored UI corpus has zero exact matches. Eleven provenance-bound candidates remain in imported source data for the DISARM data steward/Foundation. |

## Remediation queue

| Priority | Owner | Finding | Concrete action | Closure proof |
| --- | --- | --- | --- | --- |
| P0 | DISARM product owner + Platform catalog owner | Missing root manifest and no bilateral identity authority. | Provide authoritative schema, add root manifest in canonical VCS, reconcile catalog. | Schema pass; commit SHA/default branch; manifest, catalog and runtime IDs agree. |
| P1 | Platform/QazStack owner + DISARM owner | Capability modes and cross-system consumer records are unverifiable. | Accept explicit exceptions or establish each consumer/data contract. | Registry ↔ manifest agreement, owner/boundary/review date, verification command and runtime receipt. |
| P1 | DISARM data steward / DISARM Foundation | 11 provenance-bound source-corpus EdPol candidates cannot be safely rewritten in the product projection. | Supply revised licensed source text or approve a provenance exception. | New source digest/provenance receipt plus clean exact policy scan, or approved exception record. |
| P1 | Identity/UI operations owner | No authenticated exact-release browser proof. | Run desktop/mobile route-state checks in an authorized session without recording a credential. | Timestamped evidence with matching release identity, keyboard/focus and state results. |
| P2 | Operations owner | Static health is content integrity, not process liveness. | If lifecycle requires it, add independent readiness/observability/rollback receipt. | Fresh process/readiness evidence tied to the same release. |

## Audit boundary

This report is for this checkout only. It does not claim changes in Platform, QazStack, the PIN/login service, shared web-server configuration, data source authorities or any other project. The current local candidate and public static receipt match; no restart, commit, push or PR was made.

## Guarded deployment and public browser evidence — 2026-08-23T16:17Z

The project-owned `/login` browser surface requested `/favicon.ico` and received `404`. The edge already has a static `*.ico` rule, so the local canonical fix was to generate `favicon.ico` from `favicon.svg`, add it to the release allowlist and make static smoke require it. No shared nginx configuration or login/PIN implementation was changed.

- Snapshots before the only write: edge `/var/www/disarm.qdev.run-backups/20260823T161432Z-content-3b5708d0f2311e4329204459/current-root`; origin `/srv/www/disarm.qdev.run-backups/20260823T161432Z-content-3b5708d0f2311e4329204459/current-root`.
- Only `favicon.ico`, `release.json` and `health.json` changed on the serving roots. All 81 allowlisted artifacts match local SHA-256 on both edge and origin.
- `RUNTIME_EVIDENCE_OK` and `LIVE_SMOKE_OK` passed after promotion; public `favicon.ico` is `200 image/x-icon`; root remains `302 /login` and `health.status` is `ok`.
- Fresh browser evidence at `1440×960` and `390×844` reaches `/login`, has the expected H1/PIN boundary and reports zero console/page errors. No PIN was entered, so authenticated product-route acceptance remains an external P1.
