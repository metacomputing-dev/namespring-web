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
`eraFitScore`. Default mode does not emit trend fields, does not change total
scores, and does not change candidate order.

Pre-2008 birth years, neutral gender, missing birth year, and names outside the
small fixture are treated as `unknown`, not as negative evidence.
