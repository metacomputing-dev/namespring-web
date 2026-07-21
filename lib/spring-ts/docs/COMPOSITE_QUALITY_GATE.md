# Composite Behavior Gate

This document separates the current-diff behavior gate from expert-release
certification. The two decisions must not be inferred from one another.

## Current-Diff Guardrails

`composite_classical` is evidence-only. It can annotate a gyeokguk candidate,
but it cannot select or promote one. The default selector remains unchanged
unless a separately approved default-change diff says otherwise.

Run the behavior gate from `lib/spring-ts`:

```bash
npm run test:composite-quality-gate
```

For CI, compare explicit refs:

```bash
COMPOSITE_GATE_BASELINE_REF=origin/main COMPOSITE_GATE_BRANCH_REF=HEAD npm run test:composite-quality-gate
```

The test checks:

- no unapproved default-snapshot diff;
- runtime candidates retain `evidence_only_never_promote`;
- composite evidence never marks a candidate as selected;
- regular baseline fixtures do not select jonggyeok.

These are maintainability and regression controls. They are not proof of
doctrinal accuracy.

## Historical Phase-P Observation

The counts formerly described as T3/T4 quality thresholds (17/27 selected
agreement, 23/27 candidate visibility, 20/21 and 3/6 label-group coverage) are
frozen Phase-P observations. Their source rows have not passed the current
complete-D1 authority contract, so they cannot approve a merge, a default
promotion, or a commercial expert release.

`npm run metrics:baseline` exposes them only under:

- `ruleModeBreakdown.authorityScope = historical_observation_only`;
- `ruleModeBreakdown.releaseEligible = false`;
- `ruleModeBreakdown.historicalCompositeObservation`;
- `ruleModeBreakdown.modes.*.byHistoricalLabelTier`.

The artifact intentionally has no `compositeQualityGate` and no current T3/T4
source-tier dashboard.

## Certified Release Decision

Current source eligibility and doctrinal accuracy come from the source-policy
and complete seven-field D1 quality gates. A certified release also requires
the external-expert signoff gate. Historical Phase-P observations cannot
substitute for either requirement.
