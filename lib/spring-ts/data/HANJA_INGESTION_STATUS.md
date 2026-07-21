# Hanja data ingestion and authority status

## Current production contract

The opt-in `inmyeongyong_full` pool contains 9,495 Unicode/PUA glyph
representations. On 2026-07-18, all 35 stroke buckets from the current official
eFamily lookup were extracted and reconciled against the committed pool:

- 11,498 official response rows
- 9,495 distinct raw glyph representations
- 10,381 distinct non-empty designated-reading pairs
- zero local-only or official-only glyphs
- zero local-only or official-only non-empty reading pairs

The offline authority receipt is
`official-hanja-lookup-authority.generated.json`. Release verification checks
its fixed counts and SHA-256 digests without depending on network availability.
Use `npm run refresh:official-hanja-authority -- --write` only for an intentional
reviewed refresh from the official endpoint.

The Supreme Court's announced 9,389-character count and the lookup's 9,495
Unicode/PUA representations are different counting layers. The +106 difference
does not mean 106 illegal local rows. It also does not establish a canonical
Appendix 2 mapping.

## Runtime policy

- `curated` remains the conservative default candidate pool; it does not weaken
  legal authority. Every emitted Hanja still requires the exact raw glyph and
  supplied Hangul reading pair in the official lookup snapshot.
- `inmyeongyong_full` expands candidate breadth under that same strict legal
  authority contract.
- `byeolpyo2_variants.json` contains 112 compatibility aliases for search and
  deduplication only. It is not authority evidence and cannot make an off-list
  glyph legally registrable.
- The lookup glyph U+25874 has no non-empty designated reading. Pair-level
  eligibility therefore fails closed instead of inventing a reading.
- The compact synchronous authority artifact carries glyph membership and exact
  readings; the 1 MB descriptive full-pool payload remains behind the opt-in
  dynamic import boundary.

## Remaining work

1. Extract and independently verify the current Appendix 2 canonical variant
   mapping. Until then, `variantAllowed` is reserved and never inferred from
   compatibility aliases.
2. Review the 2,541 rows without local meaning text using an authority-governed
   enrichment workflow. Unihan metadata must not be promoted into Korean legal
   or naming-doctrine truth.
3. Replace interim stroke-derived scoring-element fallbacks with independently
   sourced naming-doctrine data before claiming expert-grade full-pool scoring.

## Verification

```powershell
npm run check:official-hanja-authority
npm run check:hanja-glyph-registry
npm run test:legal-hanja
npm run test:hanja
npm run test:hanja-pool
npm run test:hanja-pool-lazy
npm run test:unihan
npm run typecheck
```

## Primary sources

- Official eFamily personal-name Hanja lookup and endpoint
- Current Article 37 and Appendices 1/2 at law.go.kr
- Supreme Court 2024 expansion announcement

The exact URLs, access date, extraction method, hashes, and source tiers are
recorded in `sources/legal-hanja.sources.json` and the generated authority
receipt.
