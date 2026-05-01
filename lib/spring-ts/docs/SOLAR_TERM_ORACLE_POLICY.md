# Solar-Term Oracle Policy

This policy covers the KASI 24-solar-term fixture used by `spring-ts` tests.

## Source Registry

- Source registry: `data/sources/kasi-solar-terms.sources.json`
- Fixture: `data/kasi-solar-terms/kasi_2026_24terms.json`
- Fetcher: `scripts/fetch-kasi-solar-terms.ts`

KASI's public-data `SpcdeInfoService/get24DivisionsInfo` operation is treated
as `T5_OFFICIAL` for date-level 24-solar-term records. It requires a
data.go.kr service key and is used by the fetcher as an optional cross-check.

The committed minute-level fixture is normalized from KASI's `calendarData`
table. That page is hosted by KASI and exposes KST minute values, but it also
warns that the table is not the official publication and points users to the
published monthly almanac. For that reason the fixture keeps
`authorityTruthEligible: false`; it is a regression oracle, not an authority
accuracy denominator.

## Time Basis

- Calendar basis: Gregorian date unless the source explicitly says otherwise.
- Time zone: Korea Standard Time, `Asia/Seoul`, UTC+9.
- Fixture timestamps use ISO strings with an explicit `+09:00` offset.
- Tests parse the KST ISO timestamp into UTC milliseconds before comparing the
  local solar-term solver.

## Tolerance

The fixture has minute resolution. The policy therefore separates two values:

- `aspirationalErrorMinutes: 2`: desired envelope for a fully hardened
  precision path.
- `allowedEngineErrorMinutes: 10`: current baseline envelope for regression
  gating. The test reports the maximum delta so future precision work can
  tighten this without changing fixture shape.

For `spring-ts` monthly fortune, the existing `jie_based` mode uses a day-level
12-jie approximation. It is compared against the KASI fixture with
`allowedSpringApproxDayErrorDays: 1`.

## Commands

```bash
npm run test:kasi-solar
KASI_24TERMS_FETCHED_AT=2026-05-01T00:00:00Z npx tsx scripts/fetch-kasi-solar-terms.ts 2026
KASI_DATA_GO_KR_SERVICE_KEY=... npx tsx scripts/fetch-kasi-solar-terms.ts 2026 --require-data-go-kr
```
