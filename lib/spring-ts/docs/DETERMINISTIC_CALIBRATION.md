# Deterministic Calibration

Phase 8.2 adds a calibration harness for comparing rule-weight options without
AI, ML, random search, or runtime default mutation.

## Scope

- Script: `scripts/compute-deterministic-calibration.ts`
- Artifact: `metrics/deterministic-calibration.json`
- Input: `metrics/bySourceTier.json#d1TruthCoverage.fixtures`
- Test: `test/integration/deterministic-calibration.test.ts`
- Command: `npm run metrics:deterministic-calibration`

The input must use `spring-ts.by-source-tier.v2`, and the output uses
`spring-ts.deterministic-calibration.v2`. A missing, older, malformed, or
internally inconsistent complete-D1 contract is rejected before the engine
grid runs. The output stores `inputMetricDigest`, a SHA-256 binding to the exact
`bySourceTier.json` bytes used for the run.

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

The only truth input is the dedicated `d1TruthCoverage.fixtures` contract.
`schoolPresetBreakdown.rows` is score-comparison data and carries no truth
semantics. Generic aliases such as `authorityTruthEligible`,
`completeD1TruthEligible`, and `truthBucket` are not accepted as substitutes.

A fixture can enter the objective only when its canonical coverage status is
`COMPLETE`: all three doctrine fields and all four naming-calibration fields
are present, `coveredFieldCount` is `7`, `missingRequiredFields` is empty, and
both component-completeness flags agree. Authority and oracle values may be
combined upstream using the quality gate's field precedence, but every
contributing reference must already have passed its declared scope policy.
Calibration additionally requires a non-`none` effective reference at `T3+`.

The v2 artifact names this denominator explicitly:

- `sourceTierObjective.completeD1ObjectiveStatus`
- `sourceTierObjective.completeD1ObjectiveFixtureCount`
- `sourceTierObjective.completeD1TruthPolicy`
- `grid[].objective.excludedFromCompleteD1ObjectiveFixtureCount`

`T2`, `T1`, `T0`, `NO_REFERENCE`, `PARTIAL`, and `NONE` fixtures remain visible
for diagnostics but cannot promote rule weights. When fewer than three
eligible fixtures exist, the artifact reports
`INSUFFICIENT_COMPLETE_D1_TRUTH` and selects `current_default`.

## Promotion Rule

A non-default candidate may only move to human review when:

- at least three high-tier complete-D1 fixtures exist,
- `completeD1ObjectiveStatus` is `READY`,
- per-tier and per-source-group non-regression holds,
- low-tier fixture improvements are not counted as positive authority credit.

Until those conditions are true, the selected candidate remains
`current_default`.
