# Gyeokguk Selection Rules

Date: 2026-07-11

## Default Policy

The production default is unchanged. It keeps the existing saju-ts
month-gyeok selector, including the visible-hidden and group-supported
fallbacks captured by the snapshot baseline.

`monthly_main` is an explicit comparison selector. It uses the month branch
main hidden stem and the corresponding ten-god as the ordinary gyeokguk
anchor. The recorded 17/27 result is a historical Phase-P label observation,
not current authority accuracy and not a release threshold.

## Opt-In Policy

`monthly_main` and `jungki_transparent` are available only through explicit
precision config:

```ts
await engine.getSajuReport({
  ...request,
  options: {
    precisionConfig: {
      // or 'monthly_main'
      gyeokgukSelectionRule: 'jungki_transparent',
    },
  },
});
```

`jungki_transparent` uses the month branch middle hidden stem only when that
stem is transparent in a non-day heavenly stem. Otherwise it falls back to
`monthly_main`.

Do not enable this selector for default public recommendations. The present
repository has comparison behavior and historical labels, but it does not yet
have complete-D1 expert truth proving that either selector is doctrinally
superior.

## Historical Metrics

`npm run metrics:baseline` writes Phase-P observations to
`metrics/bySourceTier.json` under `ruleModeBreakdown`. Every mode is marked:

- `measurementClassification: HISTORICAL_PHASE_P_OBSERVATION`;
- `authorityScope: historical_observation_only`;
- `releaseEligible: false`.

Comparison fields are explicitly historical:

- `historicalWinLossVsMonthlyMain`;
- `byHistoricalLabelTier`;
- `historicalCandidateCoverage`;
- `historicalNonRegressionVsMonthlyMain`.

The historical label-tier names are not current source-tier certifications.

## Composite Classical Evidence

`composite_classical` is not a selector. It attaches an evidence score to
each surfaced gyeokguk candidate. The score combines month-main agreement,
stem transparency, root support, seasonal command, transformation support,
month-gyeok purity, yongshin-element alignment, a source-record feature, and
stability across rule modes, then subtracts a breaker penalty.

Runtime candidates are marked
`selectionPolicy: evidence_only_never_promote` and
`selectedByComposite: false`. They cannot replace the selected gyeokguk.

The historical 23/27 total and 3/6 Jonheom candidate-visibility figures remain
useful for reproducing Phase-P behavior, but they are not authority evidence,
accuracy measurements, or release approval.
