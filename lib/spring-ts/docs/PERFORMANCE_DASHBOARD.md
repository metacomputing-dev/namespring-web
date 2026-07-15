# Performance Dashboard

Phase 9.2 adds a deterministic dashboard for rule performance and candidate
diversity. The dashboard is intentionally aggregate-only: it connects existing
metric files without storing raw names, birth data, source URLs, assignment
keys, or feedback text.

## Artifact

Run:

```bash
npm run metrics:performance-dashboard
```

This writes:

- `metrics/performance-dashboard.json`

The artifact currently includes:

- `rpiTrendReport` for the current RPI snapshot and axis statuses.
- `sourceTierCoverageReport` separates declared-scope-eligible source-record
  inventory from complete seven-field D1 fixture truth. The former is not a
  proxy for the latter.
- `completeD1PromotionGate` blocks default promotion until the deterministic
  objective has enough fixtures with all three doctrine and four naming-score
  truth fields.
- `ruleModeComparisonReport` for `monthly_main`, `jungki_transparent`, and
  `composite_classical`.
- `namingCandidateDiversityReport` for school-preset spread and candidate
  ranking strategy variants.

## Validation

Run:

```bash
npm run test:performance-dashboard
```

The test regenerates the dashboard twice into temporary directories, compares
both runs to each other, and verifies the committed artifact matches the
generated output. Input metric schemas and the shared D1 truth-coverage
contract are checked fail-closed; stale schemas, corrupt counts, or inconsistent
COMPLETE/PARTIAL/NONE rows are rejected. The calibration and rule A/B artifacts
must also carry matching SHA-256 input bindings, and their complete-D1 counts
and statuses must agree with the baseline/RPI snapshot. The test also checks
aggregate-only privacy constraints and confirms the artifact does not reference
the top-level `namespring` folder.

## Interpretation

This dashboard is a measurement surface, not an authority truth source. A
positive user-feedback or candidate-ranking result still cannot promote a rule
default while the complete-D1 gate is blocked. Name-input shape inventory is
reported only as input completeness and never as authority coverage.
