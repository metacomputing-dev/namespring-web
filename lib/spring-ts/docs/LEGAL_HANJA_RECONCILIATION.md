# Legal Hanja Reconciliation

As of 2026-07-18, `spring-ts` separates Korean legal-name Hanja into explicit
status buckets instead of relying only on `legalRegistrable?: boolean`.

## Official Basis

- Current rule anchor: `data/sources/legal-hanja.sources.json`
- Current law effective date: 2025-07-19
- 2024 expansion effective date: 2024-06-11
- Appendix 1 amendment date: 2024-05-30
- Official announced character count: 9,389
- Current official lookup glyph representations: 9,495
- Current non-empty designated-reading pairs: 10,381

The official rule defines the legal range through Article 37: Education Ministry
basic Hanja, Appendix 1 additional Hanja, and Appendix 2 variants. The local
source registry treats law.go.kr and Supreme Court sources as `T5_OFFICIAL`.

## Local Candidate Pool

`data/inmyeongyong_9389_full.json` contains 9,495 entries originally ingested
from the `delvier/KoreaSCourtCode` mirror. A 2026-07-18 extraction of all 35
stroke buckets from the current official eFamily lookup confirmed exact parity:
zero glyph differences and zero non-empty designated-reading-pair differences.
The committed receipt pins both ordered SHA-256 digests and is checked offline
before release tests.

The announced 9,389 characters and the lookup's 9,495 Unicode/PUA glyph
representations are different counting layers. The +106 representation delta
is not an unresolved legality gap, but it must not be reverse-engineered into an
Appendix 2 canonical mapping. That mapping remains separately unextracted.

## Status Buckets

- `allowed`: the exact raw glyph and supplied Hangul reading appear as a pair in
  the official lookup snapshot.
- `variantAllowed`: reserved for a separately extracted current Appendix 2
  canonical map; the legacy input-alias file never creates this status.
- `hangulOnly`: no Hanja glyph is present.
- `unknown`: reserved for a future explicitly unavailable authority state.
- `notAllowed`: the official lookup misses the raw glyph or supplied reading.

`curated` and `inmyeongyong_full` select different recommendation candidate
pools, but both use the same strict official raw glyph-reading authority.
Search aliases remain useful for discovery and deduplication but never grant
legal eligibility.

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
npm run test:hanja-pool-lazy
npm run test:unihan
npm run check:official-hanja-authority
```

Broader release checks should also run `npm run typecheck`, `npm run
test:snapshot`, and `npm run quality:gate`.
