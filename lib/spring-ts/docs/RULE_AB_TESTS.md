# Rule A/B Tests

Phase 8.3 defines deterministic A/B tests for rule-only changes. The system can
measure feedback on expert presets and ranking strategies, but experiment
results do not change runtime defaults by themselves.

## Scope

- Public API: `src/experiments.ts`
- Script: `scripts/compute-rule-ab-tests.ts`
- Artifact: `metrics/rule-ab-tests.json`
- Test: `test/integration/rule-ab-tests.test.ts`
- Command: `npm run metrics:rule-ab-tests`

The assignment helper hashes a caller-provided pseudonymous key into a stable
bucket. It returns only assignment metadata and never stores the raw key,
personal fields, free text, source text, source URLs, or raw feedback.

## Experiment Arms

`default_vs_expert_preset_feedback` compares the current default against:

- `schoolPreset="korean_modern"` with `precisionConfig.useSchoolPreset=true`
- `schoolPreset="classical_text"` with `precisionConfig.useSchoolPreset=true`
- `schoolPreset="naming_safe"` with `precisionConfig.useSchoolPreset=true`

`candidate_ranking_strategy_feedback` compares the current score-descending
order against:

- `precisionConfig.paretoFrontierCandidates=true`
- Pareto ordering plus `precisionConfig.yongshinMode="consensus_aware"` and
  `precisionConfig.nameElementStrategy="safeFallback"`

These arms reuse existing rule switches. They do not introduce AI, ML,
random search, or hidden runtime mutation.

## Promotion Criteria

The criteria are pre-registered in code and in
`metrics/rule-ab-tests.json`:

- each variant must meet the minimum exposure gate,
- the treatment must clear the positive feedback delta threshold,
- the source-tier default promotion gate must pass,
- deterministic calibration must be ready,
- low-tier feedback can be diagnostic but cannot promote a default.

Current calibration remains `INSUFFICIENT_AUTHORITY_TRUTH`, so both synthetic
winning comparisons are recorded as blocked and `current_default` remains the
default.

## Reference Notes

Experiment-design references collected during this phase are linked from:

- `../../../../spring-master/rule-ab-tests-experimentation-references-2026-05-02.md`

The local policy follows the same practical pattern: define hypotheses and
metrics before running the experiment, monitor guardrails, and avoid shipping
from a single positive metric when trust or authority gates fail.
