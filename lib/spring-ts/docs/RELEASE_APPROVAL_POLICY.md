# Saju Engine Release Approval Policy

The engine PR stays Draft until every automated readiness gate passes and the
GitHub required review is complete. Regression success alone is not evidence
of expert-level judgement accuracy.

## Exact default-change approval

`tools/measure_default_change.mjs` and `tools/measure_regression.mjs` compute
the same SHA-256 fingerprint from the exact, sorted per-field snapshot diff.
An intentional default-output change remains blocked unless
`test/baseline/default-change-approvals.json` contains a matching approved
entry:

```json
{
  "fingerprint": "sha256:<64 hex characters>",
  "status": "approved",
  "reviewedBy": "independent reviewer identity",
  "reviewedAt": "YYYY-MM-DD",
  "evidence": [
    {
      "kind": "blind_holdout",
      "reference": "versioned evidence path or immutable review URL",
      "summary": "What was independently adjudicated and with what result."
    }
  ]
}
```

The fingerprint is printed by either comparison command. Any changed field
changes the fingerprint and invalidates the approval. Missing fields, removed
fixtures, and dropped cards are structural regressions and cannot be waived by
the manifest. An approved manifest entry is an auditable record, not reviewer
authentication; GitHub branch protection must also require the designated
expert/code-owner review before merge.

The current `origin/main..HEAD` fingerprint is recorded as `pending`. Do not
change it to `approved` without independent evidence covering every changed
judgement and service-visible output.

## Authority-source promotion

`T3_AUTHORED_INTERPRETATION` records with
`authorityTruthEligible: true` require:

- `authorityReview.status: "approved"`
- non-empty `authorityReview.reviewedBy`
- valid `authorityReview.reviewedAt`

Until then they fail the source audit and cannot enter accuracy denominators.
T4/T5 eligibility still requires complete source metadata. T0-T2 sources
remain comparison-only.

## Required release gates

```bash
npm --prefix ../saju-ts run test:release-tools
npm --prefix ../saju-ts run validate:school-sources
npm run test:jonggyeok-authority:release
node tools/measure_default_change.mjs --baseline origin/main --branch HEAD
npm run quality:gate:release
COMPOSITE_GATE_BASELINE_REF=origin/main npm run test:composite-quality-gate
```

The release quality gate rejects `N/A` and `PARTIAL`. A dimension with mixed
`PASS` and `N/A` fixtures is `PARTIAL`, not `PASS`. RPI scores include the
missing-fixture coverage penalty and cannot award full points for partial
coverage.

The strict jonggyeok gate requires at least 20 independently reviewable,
authority-eligible birth-time cases and an 80% calibrated match. Pillar-only
intake rows do not satisfy this requirement.
