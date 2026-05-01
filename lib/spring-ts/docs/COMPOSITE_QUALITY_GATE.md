# Composite Quality Gate

This document defines the merge gate for `composite_classical` while
`monthly_main` remains the production default.

## Scope

- Default behavior must not change unless a PR explicitly updates the default
  snapshot and explains the intended shift.
- `composite_classical` is evidence-only. It may add candidate evidence, but it
  must not promote or replace the selected gyeokguk.
- Source-tier performance must stay visible in generated metrics so reviewers
  can separate T3 authored interpretation behavior from T4 primary-text
  behavior.
- The regular baseline must not over-select jonggyeok. Focused jonggyeok
  fixtures remain observation-only and are not part of this denominator.

## Gate Commands

Run the full composite gate from `lib/spring-ts`:

```bash
npm run quality:gate
```

The composite-specific test can also be run directly:

```bash
npm run test:composite-quality-gate
```

For CI, set the baseline ref explicitly:

```bash
COMPOSITE_GATE_BASELINE_REF=origin/main COMPOSITE_GATE_BRANCH_REF=HEAD npm run test:composite-quality-gate
```

## Merge Criteria

The gate must pass all of these checks:

| Check | Required Threshold | Source |
| --- | --- | --- |
| `monthly_main` default snapshot regression | `0` diffs against the baseline ref | `tools/measure_regression.mjs` |
| `monthly_main` authority subset selected agreement | at least `17 / 27` | `tools/measure_alternative_gyeokguk_rules.ts` |
| `composite_classical` selected agreement | not worse than `monthly_main` | `tools/measure_alternative_gyeokguk_rules.ts` |
| total composite candidate coverage | at least `23 / 27` | `tools/measure_alternative_gyeokguk_rules.ts` |
| T3 composite candidate coverage | at least `20 / 21` | `metrics/bySourceTier.json` |
| T4 composite candidate coverage | at least `3 / 6` | `metrics/bySourceTier.json` |
| regular-baseline selected jonggyeok ratio | `0 / 15` | `test/fixtures/spring_ts_baseline_cases.json` |

## Dashboard Output

`npm run metrics:baseline` publishes the dashboard data in
`metrics/bySourceTier.json`:

- `ruleModeBreakdown.compositeQualityGate.status`
- `ruleModeBreakdown.compositeQualityGate.checks`
- `ruleModeBreakdown.compositeQualityGate.sourceTierDashboard`
- `ruleModeBreakdown.modes.composite_classical.bySourceTier`

Reviewers should use `sourceTierDashboard` when a future PR changes composite
candidate evidence. A T3 improvement must not hide a T4 regression, and selected
agreement remains measured separately from candidate coverage.
