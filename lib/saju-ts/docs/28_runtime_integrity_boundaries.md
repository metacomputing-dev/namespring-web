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

The year-policy cache is bounded to 512 entries. Approximate-mode keys omit
algorithm, aberration, and precision options that cannot affect that mode, so
equivalent requests share one entry instead of creating policy-cardinality
leaks.

Default graph evaluation materializes only the 36 Jie boundaries needed for
the requested year and its adjacent years. Explicit `alwaysCompute=true`
retains the complete 72-term diagnostic surface. Regression tests require the
selective and full paths to produce byte-identical legacy output.

### Bounded official-calendar responses

The KASI lunar-calendar transport keeps its timeout active until the response
body is fully consumed and rejects bodies over 256 KiB by declared or observed
size. A server that sends headers and then stalls, or streams an oversized
payload, now fails closed instead of holding a worker or growing memory
without a bound.

### Finite signal and normalization semantics

An explicit finite zero is an authoritative rule veto. HUA_QI, ZHUAN_WANG,
follow-pattern, competition, and compiled-rule readers fall back only when a
signal is absent, non-numeric, or non-finite.

Normalization denominators that are zero, negative, or non-finite contribute
zero. They are never replaced with a tiny positive denominator that could
inflate an invalid signal into a maximum score.

### Yongshin consensus semantics

Consensus confidence measures scale-invariant top-two selection clarity.
Conflict level is computed separately from disagreement among active method
axes. A clear selection and a method conflict can therefore coexist without
one field being used as a proxy for the other.

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
