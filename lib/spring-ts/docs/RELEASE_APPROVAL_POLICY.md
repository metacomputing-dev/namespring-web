# Saju Engine Release Approval Policy

The engine PR stays Draft until every automated readiness gate passes and the
designated review below is complete. Regression success alone is not evidence
of expert-level judgement accuracy.

## Review mechanism (2026-07-10 owner decision)

Every "review" control in this policy is implemented as a two-layer mechanism
adopted by the project owner:

1. **AI cross-verification** — a multi-model adversarial panel (blind
   analysis, reconciliation, refutation rounds) produces a dossier that is
   committed to the repository and referenced from `evidence[]`.
2. **Owner signature** — the project owner reads the dossier and signs
   (`reviewedBy`) as the accountable human. The signature is an auditable
   accountability record, not a claim of domain-expert authority.

This mechanism is **not** external human expert certification, and no PR,
document, or user-facing text may present it as such. When an external
myeongri expert later joins the project, their review supersedes this
mechanism per control without invalidating past audit records. Records whose
judgements *originate from* the AI panel additionally follow the
panel-adjudicated exception in `NO_AI_POLICY.md`.

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
  "reviewedBy": "reviewer identity (project owner under the current mechanism)",
  "reviewedAt": "YYYY-MM-DD",
  "evidence": [
    {
      "kind": "dossier",
      "reference": "versioned evidence path or immutable review URL",
      "summary": "What was adjudicated, by which panel, and with what result."
    }
  ]
}
```

The fingerprint is printed by either comparison command. Any changed field
changes the fingerprint and invalidates the approval. Missing fields, removed
fixtures, and dropped cards are structural regressions and cannot be waived by
the manifest. An approved manifest entry is an auditable record, not reviewer
authentication.

Do not flip a `pending` fingerprint to `approved` without dossier evidence
covering every changed judgement and service-visible output.

## Authority-source promotion

`T3_AUTHORED_INTERPRETATION` records with
`authorityTruthEligible: true` require:

- `authorityReview.status: "approved"`
- non-empty `authorityReview.reviewedBy`
- valid `authorityReview.reviewedAt`

Until then they fail the source audit and cannot enter accuracy denominators.
T4/T5 eligibility still requires complete source metadata. T0-T2 sources
remain comparison-only. Reviews follow the two-layer mechanism above.

## Required release gates

```bash
npm --prefix ../saju-ts run test:release-tools
npm --prefix ../saju-ts run validate:school-sources
npm run test:jonggyeok-authority:release
node tools/measure_default_change.mjs --baseline origin/main --branch HEAD
npm run quality:gate:release
COMPOSITE_GATE_BASELINE_REF=origin/main npm run test:composite-quality-gate
```

The release quality gate rejects `N/A` and `PARTIAL` on measurable dimensions.
A dimension with mixed `PASS` and missing-truth `N/A` fixtures is `PARTIAL`,
not `PASS`; fixtures that are structurally out of a dimension's scope (e.g.
non-edge fixtures for the D5 edge-stability axis) are `NOT_APPLICABLE` and do
not count against completeness. RPI scores include the missing-fixture
coverage penalty and cannot award full points for partial coverage.

The strict jonggyeok gate requires at least 20 reviewed, authority-eligible
birth-time cases whose declared pillars are reproduced by the engine calendar
(chart-fidelity check), and an 80% calibrated match. Pillar-only intake rows
do not satisfy this requirement.
