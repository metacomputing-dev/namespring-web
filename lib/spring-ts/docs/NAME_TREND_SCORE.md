# Hangul Name Trend Score

PR-2.4 adds an optional Hangul given-name trend signal from the Supreme Court
Electronic Family Relation Registration statistics page.

## Data Scope

- Source registry: `data/sources/name-trend.sources.json`
- Fixture: `data/hangul-name-trends.json`
- Years: 2008, 2012, 2016, 2020, 2024
- Rows: top 20 male and top 20 female names per fixture year, excluding `기타`

The fixture is intentionally small. It is not a bulk mirror of the court
statistics service.

## Runtime Policy

Trend evidence is display-only and opt-in:

```ts
precisionConfig: {
  surfaceNameTrend: true
}
```

When enabled, reports may include `nameTrend`, `trendFit`, `trendRisk`, and
`eraFitScore`. Default and legacy report modes do not emit trend fields, do
not change total scores, and do not change candidate order.

The versioned `getCandidateSearch()` surface is a separate presentation
contract. Under `spring-ts.candidate-presentation.v2`, the raw final score
remains unchanged, while `eraFit` is the last evidence axis inside a bounded
12-point raw-score window. The full canonical axis order and tie-break contract
live only in `CANDIDATE_PRESENTATION_POLICY.md` and are emitted in
`ordering.rankingBasis`. Missing trend evidence receives no trend bonus, while
rarity and a statistical gender tendency never hard-reject a candidate.

Pre-2008 birth years, neutral gender, missing birth year, and names outside the
small fixture are treated as `unknown`, not as negative evidence.
