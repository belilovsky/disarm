# EdPol editorial audit — DISARM — 2026-08-23

Mode: `rewrite`. Authority: `edpol-editorial-language-policy-v1` `1.1.0`, canonical checkout SHA `a22f16bc96aed09ed1ecfeffa3694e78293fbe67`, policy SHA-256 `3d2c66102da7f3066b6609581067a838035d7813a73366587a1437f55d2bdb76`.

## Result

- Product-authored UI scope (`index.html`, `assets/app.js`): **pass** — zero automated policy candidates after rewrite.
- Imported DISARM corpus (`data/disarm.json`): **blocked external-source exception** — 11 candidates: 3 policy-exact mechanical transitions, 1 review-only formulaic contrast and 7 raw `Unknown` values.

## Closed locally

- Removed decorative emoji from the playbook permalink and status/action confirmations.
- Replaced duplicate/ornamental overview labels with direct task language.
- Rendered source enum `Unknown` as locale-specific explicit absence text; the raw licensed corpus is untouched.

## External closure

The remaining excerpts are verbatim/derived DISARM Foundation source content, not product-authored UI copy. Rewriting them locally would alter the licensed data projection and its provenance.

| Finding | Owner | Required action | Closure proof |
| --- | --- | --- | --- |
| `thus` / `таким образом` in source descriptions | DISARM data steward / DISARM Foundation | Publish a corrected upstream corpus revision or approve an EdPol exception for quoted source content. | Upstream revision or signed exception linked from `data/disarm-provenance.json`. |
| Formulaic contrast in an incident quotation | DISARM data steward / DISARM Foundation | Confirm it is an immutable source quotation or publish revised source text. | Provenance-bound exception or updated corpus hash. |
| Seven raw `Unknown` values | DISARM data steward / DISARM Foundation | Supply known attribution or formal missing-value semantics. | Updated source value/provenance; until then the UI projects an explicit absence label. |

The scan is style-candidate detection, not an AI-authorship determination. It does not establish legal clearance, full RU/KK/EN parity or source truth.

---

## Final local-candidate rewrite — 2026-08-23

Fresh public-policy observation used `edpol-editorial-language-policy-v1` `1.1.0` (SHA-256 `3d2c66102da7f3066b6609581067a838035d7813a73366587a1437f55d2bdb76`), typography policy SHA-256 `7d0324ba83f5c5d7ec704963637fd7b1e4c10dcfe3371e48ea929d3fdf81db2d`, and AI-origin policy SHA-256 `0905dbd672a055f752f87424070b632262cbb7bed5bebcbd6bce8ef20bd11295`. No external EdPol checkout was changed or treated as source authority in this project-only pass.

### Closed in product-authored copy

- Rewrote the ready-data status in RU, KK and EN from an unsupported freshness assertion to an exact local-snapshot statement.
- Added a static integrity rule that requires all three wording variants, preventing a future fallback to unproven “current” or “updated” claims.

The deterministic publication scan of `index.html` and `assets/app.js` remains **pass**: 0 exact policy matches, 0 skipped files. The imported `data/disarm.json` remains **blocked** only as the provenance-bound external-source exception documented above; it was not edited.

The final local candidate was regenerated and rechecked after this rewrite. Its later public release is `content-3b5708d0f2311e4329204459`; the favicon-only promotion did not alter product-authored editorial copy or the status above.

---

## Rewrite revalidation — 2026-08-23T15:24:23Z

Fresh authority: `edpol-editorial-language-policy-v1` `1.1.0`, SHA-256 `3d2c66102da7f3066b6609581067a838035d7813a73366587a1437f55d2bdb76`; typography policy `7d0324ba83f5c5d7ec704963637fd7b1e4c10dcfe3371e48ea929d3fdf81db2d`; AI-origin policy `0905dbd672a055f752f87424070b632262cbb7bed5bebcbd6bce8ef20bd11295`.

- `index.html` and `assets/app.js`: **pass** — 2/2 files scanned, 0 skipped, 0 exact policy matches under the deterministic publication gate.
- Rendered RU/KK/EN ready-state text remains an explicit local-snapshot statement; the mobile empty-search state gives a concrete recovery action.
- `data/disarm.json`: **blocked external-source exception** — 11 redacted candidates (3 policy-exact, 1 editorial-risk, 7 structural placeholders). This is a provenance-bound upstream corpus, not product-authored copy; rewriting it locally would alter the licensed source projection. Owner and closure proof remain the DISARM data steward/Foundation, as listed above.

This revalidation assesses editorial policy and source boundaries only; it does not infer AI authorship.

---

## Final authority recheck — 2026-08-23T15:40Z

The three public policy digests were fetched again and remain unchanged: editorial language `3d2c66102da7f3066b6609581067a838035d7813a73366587a1437f55d2bdb76`, typography `7d0324ba83f5c5d7ec704963637fd7b1e4c10dcfe3371e48ea929d3fdf81db2d`, and AI-origin `0905dbd672a055f752f87424070b632262cbb7bed5bebcbd6bce8ef20bd11295`. The deterministic authored-UI publication scan remains **pass** (`index.html`, `assets/app.js`: 2/2 scanned, 0 skipped, 0 exact matches). The 11 imported-corpus candidates remain external and provenance-bound; no corpus text was changed.
