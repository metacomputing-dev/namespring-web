# Phonetic Rules

As of 2026-05-01, `spring-ts` separates machine-verifiable Hangul syllable
decomposition from authored Korean name sound-flow heuristics.

## Source Registry

- Source registry: `data/sources/phonetic.sources.json`
- Runtime module: `src/phonetic-rules.ts`
- Unicode Hangul decomposition mechanics: `T5_OFFICIAL`
- Standard-pronunciation references: `T5_OFFICIAL`
- Naming warning severity and score policy: `T3_AUTHORED_INTERPRETATION`
- Interpretive phonetic warnings are not authority-truth denominators.

## Runtime Policy

- `precisionConfig.surfacePhoneticEvidence` is off by default.
- Opt-in reports may include `phonetic.phoneticScore`,
  `phonetic.familyNameFitScore`, transition rows, warnings, and evidence.
- The phonetic score is display-only and does not affect total score, candidate
  generation, Hanja legality, Hanja/Saju scoring, or legacy report ordering.
- The versioned `getCandidateSearch()` presentation contract is the sole
  exception: `spring-ts.candidate-presentation.v2` may use phonetic evidence
  after risk inside a bounded 12-point raw-score window. It does not mutate the
  raw score or reject a candidate, and the response discloses the rule in
  `ordering.rankingBasis`. See `CANDIDATE_PRESENTATION_POLICY.md`.
- Rules check deterministic Hangul boundaries: surname-to-given and internal
  given-name transitions.

## Rule Scope

The implementation checks:

- initial, medial, and final syllable continuity
- batchim-to-next-initial collision
- nasal assimilation and rieul/nasal boundary contexts
- repeated initial or coda-to-initial phonemes
- complex batchim boundaries without claiming the exact realized sound

The module intentionally avoids broad hard/soft-sound claims. Official
pronunciation sources explain why coda/onset contact matters; the naming
warning severity is an authored, display-only interpretation.

## Verification

Run:

```powershell
npm run typecheck
npm run test:phonetic
npm run test:quality-gate
npm run test:baseline-metrics
npm run quality:gate
```
