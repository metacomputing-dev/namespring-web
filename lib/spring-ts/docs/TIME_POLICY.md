# Time Policy

This document covers `spring-ts` birth-time and timezone policy.

## Defaults

- `sajuTimePolicy.trueSolarTime`: `off`
- `sajuTimePolicy.longitudeCorrection`: `on`
- `sajuTimePolicy.longitudeReference`: `civilOffsetMeridian`
- `sajuTimePolicy.yaza`: `on`
- `sajuTimePolicy.yazaMode`: `23:00`

`trueSolarTime: 'on'` enables the equation-of-time component.
`longitudeCorrection` independently controls the longitude component. When
longitude correction is on, the product default
`longitudeReference: 'civilOffsetMeridian'` derives the reference meridian
from the UTC offset in force at the birth civil time, including historical
standard-time changes and daylight saving time.

`longitudeReference: 'legacyPreset'` is a regional compatibility opt-in. The
Korean/modern presets use a fixed 135-degree reference meridian and the
traditional Chinese preset uses 120 degrees. It is not a global compatibility
mode. `longitudeCorrection: 'off'` means an actual zero longitude correction;
equation-of-time may remain on.

Longitude correction uses the shortest signed angular distance between the
physical longitude and reference meridian. The request longitude remains in
the physical `-180..180` range and is never rewritten or clamped. These are
calculation policies; they do not change the source timezone of birth or
oracle fixtures.

`sajuTimePolicy` is the authoritative product surface. Conflicting top-level
legacy flags or nested calendar time fields supplied through the advanced raw
`sajuConfig` escape hatch are ignored for time correction and day-boundary
selection. This prevents low-level configuration from bypassing location
validation or silently changing the selected product policy.

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
Before those two saju evaluations, it verifies that every civil minute from
`HH:00` through `HH:59` maps to exactly one instant in the resolved timezone.
If any minute falls in a clock-transition gap or fold, analysis fails closed
with `BIRTH_TIME_RANGE_TRANSITION`; exact supplied minutes retain the narrower
`BIRTH_TIME_NONEXISTENT` and `BIRTH_TIME_AMBIGUOUS` diagnostics.

For a fully resolvable hour, the engine surfaces
`inputUncertainty.unknownMinute` and always records reduced
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

Supplied time-policy toggles and modes are also validated at runtime. Unknown
values do not fall back to product defaults; they fail closed with
`BIRTH_TIME_POLICY_INVALID`.

An empty string is an explicitly supplied non-numeric value, so it fails closed
with `BIRTH_TIME_INVALID`. Only an omitted field, `null`, or `undefined` enters
the unknown-hour or unknown-minute policy.

## Global Location And Time-Zone Contract

The backend calculation path accepts a complete explicit tuple: `latitude`,
`longitude`, and `timezone`. `timezone` may be an IANA zone or a strict fixed
offset with an explicit `UTC` or `GMT` prefix; a bare value such as `+09:00`
is not accepted. Built-in place-name resolution is limited to the supported
Korean region table; an overseas place name alone is not geocoded.

A supported Korean region label selects that registry entry's canonical
coordinate/timezone tuple. If coordinates are supplied alongside the label,
they must match the registry tuple apart from insignificant numeric rounding;
otherwise the request fails with `BIRTH_LOCATION_CONFLICT`. Callers that need
an arbitrary GPS point must omit the region label and send the complete
`latitude + longitude + timezone` tuple. This is a deterministic selector
contract, not a claim that the registry point describes every address inside
the administrative region.

With longitude correction on:

- latitude and longitude must be supplied together;
- explicit coordinates require an explicit timezone;
- timezone-only input cannot borrow Seoul longitude;
- unresolved place text cannot silently become Seoul.

Invalid coordinates fail with `BIRTH_LOCATION_INVALID`, incomplete tuples with
`BIRTH_LOCATION_PARTIAL`, unsupported place text with
`BIRTH_LOCATION_UNRESOLVED`, public location fields that resolve to different
regions with `BIRTH_LOCATION_CONFLICT`, and a supported-region/timezone
conflict with `BIRTH_LOCATION_TIMEZONE_MISMATCH`.

Omitting all location input retains the Seoul default for backward
compatibility. When longitude correction is explicitly off, timezone-only
input is accepted because longitude is not used. In that case public time
provenance exposes the timezone, null coordinates, and
`coordinatesApplied: false`; it never relabels the Seoul compatibility
coordinates as if they belonged to the supplied timezone.

The lower-level exported saju-ts legacy facade has no separate product-policy
location resolver. It therefore accepts either no location fields (the Seoul
compatibility default) or a complete `timezone + latitude + longitude` tuple;
partial tuples fail closed even when a caller later disables longitude
correction.

A fully explicit arbitrary coordinate/timezone tuple is checked for type,
range, and timezone validity, but is not geospatially verified against a
global timezone polygon database. Region/timezone mismatch detection is
available only for built-in Korean regions.

## Civil-Time Gap And Fold

An IANA civil birth time must map to exactly one instant. A nonexistent
spring-forward time fails with `BIRTH_TIME_NONEXISTENT`; an ambiguous
fall-back time fails with `BIRTH_TIME_AMBIGUOUS`. The engine does not silently
select the earlier or later occurrence. Fixed-offset timezone input is unique
by definition and can identify an occurrence explicitly.

Malformed or unsupported timezone tokens fail with `BIRTH_TIMEZONE_INVALID`.
The release runtime must also demonstrate the historical timezone-data
capabilities required by the calculation path; a runtime that cannot do so
fails with `BIRTH_TIMEZONE_DATA_UNSUPPORTED` instead of silently falling back
to modern offsets.

## Historical Korean Time

`Asia/Seoul` is resolved from the host ICU/IANA timezone data at the birth
civil time. The regression matrix covers pre-1908 Seoul LMT, the 1908, 1912,
1954, and 1961 standard-time periods, all twelve Korean DST seasons represented
by midpoint fixtures, and the 1987-1988 transitions. The pre-1908
`GMT+08:27:52` value is normalized to the public minute-based contract as 508
minutes.

Under `civilOffsetMeridian`, the UTC offset actually in force is used as the
reference. DST is therefore already reflected in longitude correction and
must not be added a second time; `dstCorrectionMinutes` is explanatory
metadata.

Timezone data is not bundled by the engine. The release runtime must pass the
`Asia/Seoul` ICU/tzdata capability guard and the historical fixture suite.
Passing these checks is not evidence of exhaustive global historical-time
accuracy.

## KST And KASI Fixtures

KASI calendar fixtures are civil-time source records. Store fixture timestamps
whose source is explicitly modern KST with `Asia/Seoul`, UTC+9, and explicit
`+09:00` ISO timestamps where time is present. Do not generalize fixed
`+09:00` to historical birth input; historical civil time must resolve through
`Asia/Seoul` at the supplied date and time. True-solar correction is applied
only as an engine calculation policy, not as a mutation of the KASI source
record.

KASI solar-term fixtures remain regression oracles under
`docs/SOLAR_TERM_ORACLE_POLICY.md`. The lunar-solar conversion fixtures follow
`docs/LUNAR_SOLAR_CONVERSION_ORACLE_POLICY.md`.

## Release Limitation

This checkpoint establishes a backend calculation contract, not a claim of
commercially validated worldwide accuracy. The regression cities and
historical fixtures are representative, not exhaustive. Global geocoding,
coordinate-to-timezone polygon verification, cross-runtime tzdb
certification, and external authority review remain outside the completed
scope.

These limitations do not by themselves lift PR #653's Draft status or the
independent authority, exact-diff, expert-signoff, and release-quality gates.
