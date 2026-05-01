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
- `sourceTierCoverageReport` for source-tier eligibility and fixture coverage.
- `sourceTierPromotionGate` for the authority-truth gate that blocks default
  promotion when objective source truth is insufficient.
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
generated output. It also checks aggregate-only privacy constraints and confirms
the artifact does not reference the top-level `namespring` folder.

## Interpretation

This dashboard is a measurement surface, not an authority truth source. A
positive user-feedback or candidate-ranking result still cannot promote a rule
default while the source-tier gate is blocked by insufficient authority truth.
