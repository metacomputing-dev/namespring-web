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
- `hangulOnly`: no Hanja code point is present.
- `unknown`: the active pool is intentionally non-definitive or the official
  delta is not yet resolved.
- `notAllowed`: full-pool lookup definitively misses the normalized Hanja.

Default `curated` mode preserves legacy behavior: seed hits are `allowed`, and
non-seed entries are `unknown`. Opt-in `inmyeongyong_full` mode gives definitive
`allowed` / `variantAllowed` / `notAllowed` decisions against the local full
pool while still exposing the official +106 reconciliation gap in data.

## Verification

Run:

```powershell
npm run test:legal-hanja
npm run test:hanja
```

Broader release checks should also run `npm run typecheck`, `npm run
test:snapshot`, and `npm run quality:gate`.
