# Gyeokguk Selection Rules

Date: 2026-05-01

## Default Policy

The production default is unchanged. It keeps the existing saju-ts
month-gyeok selector, including the legacy visible-hidden and group-supported
fallbacks that are already captured by the snapshot baseline.

`monthly_main` is available as an explicit comparison selector. It selects the
month branch main hidden stem and scores the corresponding ten-god as the
ordinary gyeokguk anchor. In the Phase P authority matrix it remains the
strongest deterministic rule-mode candidate:

| selector | total agreement |
| --- | --- |
| `monthly_main` | 17 / 27 |
| `jungki_transparent` | 14 / 27 |

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

The opt-in selector uses the month branch middle hidden stem only when that
middle stem is transparent in a non-day heavenly stem. If that condition is not
met, it falls back to `monthly_main`.

## When To Use It

Use `jungki_transparent` for expert, internal, or comparative research runs
where the consumer intentionally wants a mixed classical reading that gives
middle-qi transparency a stronger voice.

Do not enable it for default public recommendations. The current evidence says
it improves some Korean modern figure/commentary cases, but weakens the lecture
matrix that drove the rule-mode baseline.

## Metrics

`npm run metrics:baseline` writes selector-mode summaries to
`metrics/bySourceTier.json` under `ruleModeBreakdown`. Each selector mode now
includes `winLossVsMonthlyMain` at total, source-group, and source-tier levels.

## Composite Classical Evidence

`composite_classical` is not a selector. It is an evidence score attached to
each surfaced gyeokguk candidate. The score combines month-main agreement,
stem transparency, root support, seasonal command, transformation support,
month-gyeok purity, yongshin-element alignment, source-tier boost, and
stability across existing rule modes, then subtracts a breaker penalty.

Every composite candidate is marked with
`selectionPolicy: evidence_only_never_promote` and
`selectedByComposite: false`. Low-confidence candidates can appear as evidence,
but they cannot replace the selected gyeokguk.

In metrics, `composite_classical` selected agreement is measured as
`monthly_main` for non-regression. Candidate coverage is reported separately:
the current authority matrix has 23 of 27 comparable cases where the authority
label is present in evidence candidates, including 3 of 6 in the classical
`jonheom` subset. That coverage is evidence, not authority accuracy.
