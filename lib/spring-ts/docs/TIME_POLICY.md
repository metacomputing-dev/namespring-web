# Time Policy

This document covers `spring-ts` birth-time and timezone policy.

## Defaults

- `sajuTimePolicy.trueSolarTime`: `off`
- `sajuTimePolicy.longitudeCorrection`: `on`
- `sajuTimePolicy.yaza`: `on`
- `sajuTimePolicy.yazaMode`: `23:00`

`trueSolarTime: 'on'` means longitude correction plus equation-of-time.
`longitudeCorrection: 'on'` alone applies longitude correction without
equation-of-time. These are calculation policies; they do not change the
source timezone of birth or oracle fixtures.

The default day boundary is therefore the 23:00 yaza policy. Callers can
explicitly select `yaza: 'off'` for the midnight policy or `yazaMode: '23:30'`
for the legacy 23:30 variant.

## Missing Birth Time

Hour and minute omissions have separate contracts.

When the hour is missing, any supplied minute is unusable. The engine uses
`12:00`, surfaces `inputUncertainty.unknownHour`, and marks all of these axes as
affected:

- `yearPillar`, `monthPillar`, `dayPillar`, `hourPillar`
- `yongshin`, `gyeokguk`, `strength`, `tenGod`
- `relations`, `shinsal`, `fortuneTiming`

The available `yongshin`, `gyeokguk`, and `strength` judgment tiers are lowered
by one step where possible:

- `definite -> practical`
- `practical -> candidate`
- `candidate` and `deferred` remain unchanged

Raw saju sub-scores are not rewritten. The default `unknownHourGuard` also
reduces adaptive evaluator priority for unknown-hour input.

When the hour is known but the minute is missing, the engine calculates at
`HH:00` and compares that result with `HH:59` under the selected time policy.
It surfaces `inputUncertainty.unknownMinute` and always records reduced
precision for continuous fortune timing, including daeun start age and UTC
boundaries. If the two endpoints cross a discrete boundary, only the changed
axes are marked and only applicable `yongshin`, `gyeokguk`, or `strength` tiers
are lowered by one step. The evaluator guard is applied only for such a
boundary-sensitive minute range. A stable range has no tier shift or evaluator
dampening, but retains the continuous-timing precision notice.

## Input Validation

An omitted time is different from an invalid time. A supplied hour or minute
must be an integer in `0..23` or `0..59`; out-of-range, fractional, or coercible
string values fail closed with `BIRTH_TIME_INVALID` instead of becoming an
unknown-time fallback.

For backward compatibility, an empty string is treated as missing. Thus an
empty minute with a known hour follows the `HH:00`/`HH:59` policy, while empty
hour and minute values follow the `12:00` unknown-hour policy.

## Overseas Release Limitation

Global overseas `timezone` plus `longitude` input is not yet a supported or
commercially validated claim. The legacy school presets carry fixed LMT
baseline longitudes (`135` for the Korean/modern presets and `120` for the
traditional Chinese preset). Outside their intended region, those baselines
can interact with the local standard meridian and raw longitude to apply the
wrong correction or produce an effective longitude outside the valid range;
the New York case has reproduced this failure.

This is a fail-closed release limitation. Clamping the derived longitude is not
a valid fix because it hides a baseline-policy error. Global support requires a
dedicated timezone/longitude baseline policy and overseas regression fixtures
before overseas commercialization or a WIP-readiness claim that includes
global input.

## KST And KASI Fixtures

KASI calendar fixtures are civil-time source records. Store fixture timestamps
with `Asia/Seoul`, UTC+9, and explicit `+09:00` ISO timestamps where time is
present. True-solar correction is applied only as an engine calculation policy,
not as a mutation of the KASI source record.

KASI solar-term fixtures remain regression oracles under
`docs/SOLAR_TERM_ORACLE_POLICY.md`. The lunar-solar conversion fixtures follow
`docs/LUNAR_SOLAR_CONVERSION_ORACLE_POLICY.md`.
