# Runtime Integrity Boundaries

Date: 2026-07-11

This note records behavior-affecting integrity fixes and the remaining limits.
It is not an expert certification of saju doctrine.

## Closed integrity defects

### Engine-owned immutable configuration

Every engine now owns a recursively frozen effective configuration. Defaults,
school presets, compiled rules, and public reference tables can no longer be
mutated through one consumer and thereby change later engine results.

Configuration is data-only. Functions, accessors, Date, Map, Set, symbol, and
bigint values are rejected because freezing those values would not guarantee a
stable digest or immutable engine policy.

### Defensive solar-term cache

Solar-term caches store frozen internal records and return a fresh array with
fresh term objects on every call. Mutating a report or trace term cannot alter
the year/month pillars of a later request.

### Fail-closed legacy contract

`LegacySajuOutputV1` requires every calculation node it publishes. Disabling
a required engine toggle raises `LegacyContractConfigError`; a missing engine
node raises `LegacyContractOutputError`. The bridge no longer substitutes
four Jia-Zi pillars, zero strength, or empty rule results.

Invalid legacy timezones raise `LegacyTimezoneError` instead of silently
assuming UTC+09:00.

### Honest SHA-256 digests

`sha256Hex` is now a standards-compliant SHA-256 implementation over UTF-8
text or exact bytes. Config and analysis-ZIP digest fields keep their existing
shape, but their values intentionally change from the former non-cryptographic
64-hex placeholder.

Consumers must not compare new digests with artifacts made by earlier
versions. Earlier `sha256` labels did not contain SHA-256 values.

### Strict request and schema validation

Impossible dates and clock times, invalid offsets, unsupported calendars,
invalid sex values, and out-of-range coordinates fail before calculation.
Unknown explicit config schema versions are rejected rather than stamped as
the current version without a migration.

## Remaining limitations

- The `U` sex option still needs an explicit fortune-direction policy and
  surfaced diagnostics.
- Saryeong-aware hidden stems currently need a single position-aware context;
  the month context must not be applied to year/day/hour branches.
- Raw policy strings and numeric ranges still need a centralized compiler so
  typos cannot select fallback models silently.
- `rules/facts.ts`, `compat/springLegacy.ts`, `rules/yongshin.ts`, and
  `rules/gyeokguk.ts` remain large orchestration hotspots. They should be
  split behind stable facades in behavior-preserving commits.
- External expert review and complete-D1 truth remain separate release gates.

These limitations keep expert-release certification blocked. They do not
invalidate the runtime isolation fixes above.
