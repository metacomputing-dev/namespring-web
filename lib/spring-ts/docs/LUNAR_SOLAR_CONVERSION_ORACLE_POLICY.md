# Lunar-Solar Conversion Oracle Policy

This policy covers the KASI lunar-solar conversion fixture used by `spring-ts`
tests.

## Source Registry

- Source registry: `data/sources/kasi-lunar-solar.sources.json`
- Fixture: `data/kasi-lunar-solar/kasi_lunar_solar_2025_2026_cases.json`
- Fetcher: `scripts/fetch-kasi-lunar-solar.ts`

KASI's public-data `LrsrCldInfoService` is treated as `T5_OFFICIAL` for direct
date-conversion facts. `getLunCalInfo` maps a Gregorian solar date to lunar
fields. `getSpcifyLunCalInfo` is preferred for lunar-to-solar checks because it
accepts the explicit `leapMonth` value (`평` or `윤`). `getSolCalInfo` is kept as
a source entry but is not the preferred leap-month oracle because the public
request shape does not expose a leap-month discriminator.

The committed fixture is normalized from KASI's monthly lunisolar table. It is
a small set of direct date facts covering leap month, lunar month end/start,
lunar new year, and solar year rollover cases.

## Calendar Basis

- Solar input basis: Gregorian date.
- Time zone: Korea Standard Time, `Asia/Seoul`, UTC+9.
- Lunar leap month is stored as boolean `isLeapMonth`.
- KASI raw leap-month values are preserved as `raw.lunLeapmonth` with `평` or
  `윤`.

## Current Product Limit

`spring-ts` accepts `BirthInfo.calendarType: 'lunar'` and `isLeapMonth`, but the
current `saju-ts` bridge does not yet contain a production lunar-to-solar
conversion layer. Until that layer exists, lunar user input is retained in
`partialBirthInput`, `sajuEnabled` remains `false`, and the report surfaces
`disabledReason: "lunar-input-requires-kasi-conversion"`.

This avoids the worst failure mode: silently treating a lunar birth date as a
Gregorian solar date.

## Commands

```bash
npm run test:kasi-lunar
npm run test:calendar-policy
KASI_LUNISOLAR_FETCHED_AT=2026-05-01T00:00:00Z npx tsx scripts/fetch-kasi-lunar-solar.ts
KASI_LUNISOLAR_SERVICE_KEY=... npx tsx scripts/fetch-kasi-lunar-solar.ts --require-data-go-kr
```
