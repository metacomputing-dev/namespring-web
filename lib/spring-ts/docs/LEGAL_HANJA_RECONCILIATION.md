# Legal Hanja Reconciliation

As of 2026-05-01, `spring-ts` separates Korean legal-name Hanja into explicit
status buckets instead of relying only on `legalRegistrable?: boolean`.

## Official Basis

- Current rule anchor: `data/sources/legal-hanja.sources.json`
- Current law effective date: 2025-07-19
- 2024 expansion effective date: 2024-06-11
- Appendix 1 amendment date: 2024-05-30
- Official announced allowed count: 9,389

The official rule defines the legal range through Article 37: Education Ministry
basic Hanja, Appendix 1 additional Hanja, and Appendix 2 variants. The local
source registry treats law.go.kr and Supreme Court sources as `T5_OFFICIAL`.

## Local Candidate Pool

`data/inmyeongyong_9389_full.json` still contains 9,495 entries from the
`delvier/KoreaSCourtCode` mirror. The mirror records the official denominator as
9,389, so the local pool has an unresolved +106 delta.

This PR does not remove the +106 entries because the official Appendix 1 HWPX is
not yet fully machine-extracted. Instead, the delta is visible in
`data/legal-hanja-reconciliation.json`, and third-party mirror data remains
non-authority truth until each entry is T5-confirmed.

## Status Buckets

- `allowed`: orthodox Hanja appears in the active legal pool.
- `variantAllowed`: input is a known variant and its orthodox form appears in
  the active legal pool.
- `hangulOnly`: no Hanja glyph is present.
- `unknown`: the active pool is intentionally non-definitive or the official
  delta is not yet resolved.
- `notAllowed`: local full-pool lookup misses the normalized Hanja.

Default `curated` mode preserves legacy behavior: seed hits are `allowed`, and
non-seed entries are `unknown`. Opt-in `inmyeongyong_full` mode gives local
mirror-backed `allowed` / `variantAllowed` / `notAllowed` decisions against the
local full pool while still exposing the official +106 reconciliation gap in
data.

## Candidate Generation

`precisionConfig.hanjaPool='inmyeongyong_full'` now switches recommendation
generation to the local full-Hanja mirror data file. The converter emits one
candidate entry per usable reading and excludes rows whose reading or positive
stroke count cannot be justified. Legal non-standard glyph rows from the mirror
are preserved. Unihan 17.0.0 now fills local zero-stroke rows when
`kTotalStrokes` is available and exposes `kRSUnicode` radical-stroke metadata as
an overlay. Because radical-to-Five-Element mapping is interpretive, not Unicode
authority data, `radicalElementHint` is surfaced as a
`T3_AUTHORED_INTERPRETATION` hint and is not used as a hard legal or scoring
truth.

Generated full-pool entries still keep stroke-derived scoring elements as an
interim scoreable fallback; those derived resource elements are not used for
pre-score candidate exclusion.

Generated candidates outside the active legal pool are removed before scoring,
and `SpringResponse.meta.candidateRejections` exposes grouped rejection reasons
for caller/UI messaging.

## Verification

Run:

```powershell
npm run test:legal-hanja
npm run test:hanja
npm run test:hanja-pool
npm run test:unihan
```

Broader release checks should also run `npm run typecheck`, `npm run
test:snapshot`, and `npm run quality:gate`.
