# Time Policy

This document covers `spring-ts` birth-time and timezone policy.

## Defaults

- `sajuTimePolicy.trueSolarTime`: `off`
- `sajuTimePolicy.longitudeCorrection`: `on`
- `sajuTimePolicy.yaza`: `off`
- `sajuTimePolicy.yazaMode`: `23:00` when yaza is enabled

`trueSolarTime: 'on'` means longitude correction plus equation-of-time.
`longitudeCorrection: 'on'` alone applies longitude correction without
equation-of-time. These are calculation policies; they do not change the
source timezone of birth or oracle fixtures.

## Unknown Birth Hour

When the caller provides year/month/day but omits hour or minute, the engine
still runs a saju calculation with a documented fallback time:

- fallback hour: `12`
- fallback minute: `0`

The result is valid for a provisional reading, but it must be labeled. The
adapter surfaces `inputUncertainty.unknownHour`, adds a partial interpretation
note, and downgrades currently surfaced hour-sensitive confidence tiers by one
step where possible:

- `definite -> practical`
- `practical -> candidate`
- `candidate` and `deferred` remain unchanged

Affected axes are `hourPillar`, `yongshin`, `gyeokguk`, `strength`, `tenGod`,
and `fortuneTiming`. Raw saju sub-scores are not rewritten; the existing
`unknownHourGuard` continues to reduce adaptive evaluator priority for
unknown-hour input.

## KST And KASI Fixtures

KASI calendar fixtures are civil-time source records. Store fixture timestamps
with `Asia/Seoul`, UTC+9, and explicit `+09:00` ISO timestamps where time is
present. True-solar correction is applied only as an engine calculation policy,
not as a mutation of the KASI source record.

KASI solar-term fixtures remain regression oracles under
`docs/SOLAR_TERM_ORACLE_POLICY.md`. The lunar-solar conversion fixtures follow
`docs/LUNAR_SOLAR_CONVERSION_ORACLE_POLICY.md`.
