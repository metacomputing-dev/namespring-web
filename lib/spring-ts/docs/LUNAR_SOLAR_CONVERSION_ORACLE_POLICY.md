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

## Production Conversion (감사 B1 · 결정③, 2026-07-08)

`spring-ts` now converts lunar input to solar before analysis:

- **Default (builtin)**: `src/calendar/korean-lunar-calendar.ts` — clean port of
  usingsky/korean_lunar_calendar_js (MIT, KASI/KARI standard data, table range
  1000–2050). Product-guaranteed range: **lunar year 1900–2050** (adapter guard).
  Offline-deterministic; the browser path uses the same table.
- **Opt-in (KASI API)**: `precisionConfig.lunarConversionSource: 'kasi'` calls
  `getSpcifyLunCalInfo` first (Node only, service-key env trio) and falls back
  to the builtin table on any failure, marked `lunarConversion.kasiFallback`.
- The conversion record is surfaced as `SajuSummary.lunarConversion`
  (`{lunar, solar, source}`) plus a user-facing note, so users can verify the
  converted solar date. Solar-input reports never carry the field.
- Unconvertible input (partial lunar date, out-of-range year, nonexistent leap
  month) keeps saju disabled with
  `disabledReason: "lunar-conversion-unavailable"` and
  `calendarPolicy.conversionStatus: 'partial-lunar-input' | 'conversion-failed'`.

Verification: `npm run test:lunar-calendar` (KASI 13-case oracle both ways +
Seollal 151 / leap-month 151-year / Chuseok 22 anchors + 55,122-day round-trip
sweep), `npm run test:kasi-lunar-api` (offline mock server), and
`npm run test:calendar-policy` (adapter wiring + solar equivalence).

This retains the original guard against the worst failure mode: a lunar birth
date is never silently treated as a Gregorian solar date.

## Commands

```bash
npm run test:kasi-lunar
npm run test:calendar-policy
KASI_LUNISOLAR_FETCHED_AT=2026-05-01T00:00:00Z npx tsx scripts/fetch-kasi-lunar-solar.ts
KASI_LUNISOLAR_SERVICE_KEY=... npx tsx scripts/fetch-kasi-lunar-solar.ts --require-data-go-kr
```
