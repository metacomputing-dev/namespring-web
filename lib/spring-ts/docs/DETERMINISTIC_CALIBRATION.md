# Deterministic Calibration

Phase 8.2 adds a calibration harness for comparing rule-weight options without
AI, ML, random search, or runtime default mutation.

## Scope

- Script: `scripts/compute-deterministic-calibration.ts`
- Artifact: `metrics/deterministic-calibration.json`
- Test: `test/integration/deterministic-calibration.test.ts`
- Command: `npm run metrics:deterministic-calibration`

The script evaluates a fixed request-option grid through
`SpringEngine.analyze({ mode: "evaluate" })`. It does not call
`computeSajuNameScore()` directly, because the engine owns the current runtime
defaults for scorer and evaluator modes.

## Grid Policy

The grid is one-axis-at-a-time:

- current default
- empty `precisionConfig` anchor
- Korean preset anchor
- each school preset with `useSchoolPreset: true`
- scorer modes for balance, yongshin, strength, ten-god, and gyeokguk
- evaluator modes for saju priority curve, multi-axis evaluation, and unknown
  hour guard damping

Full Cartesian search is deliberately disabled. The harness should show
deterministic deltas and guardrails, not discover a high-dimensional optimum.

## Source-Tier Objective

Only scorable records with `sourceTier.authorityTruthEligible === true` and
tier rank `T3+` can enter the promotion objective. `T2`, `T1`, `T0`, and
`NO_REFERENCE` rows have objective weight `0`; they are visible as guardrails
but cannot promote rule weights.

Current baseline rows are `T2_REFERENCE_IMPLEMENTATION` or `NO_REFERENCE`, so
the artifact reports `INSUFFICIENT_AUTHORITY_TRUTH` and selects
`current_default`.

## Promotion Rule

A non-default candidate may only move to human review when:

- enough eligible high-tier scorable fixtures exist,
- the source-tier objective is ready,
- per-tier and per-source-group non-regression holds,
- low-tier fixture improvements are not counted as positive authority credit.

Until those conditions are true, the selected candidate remains
`current_default`.
