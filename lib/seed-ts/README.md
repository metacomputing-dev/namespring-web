# @namespring/seed-ts

Deterministic Korean naming primitives and browser-compatible data repositories.

## Analysis contract

`SeedTs.analyze(userInfo)` is synchronous and performs no database or network I/O. It validates name entries, clones caller-owned input, returns a deeply frozen result, and throws a structured `SeedValidationError` or `SeedCalculationError` instead of manufacturing fallback values.

All 81 four-frame meanings are available synchronously from a versioned embedded snapshot. They populate each frame's display-only `entry`, while `luckScore` remains `null` and the narrative snapshot does not alter the score. The returned `fourFrameEnrichment` field records that boundary and its provenance explicitly.

Every calculator exposes a `pending | ready | excluded` `calculationStatus`. Pure-Hangul analysis marks Hanja and four-frame calculators as `excluded`; their score is explicitly zero and remains safe to read after the frozen result is returned.

Engine-produced structured Seed errors never retain caller input. The former public
`received` field has been replaced by a non-identifying `receivedSummary`
descriptor such as `{ type: 'string' }`, `{ type: 'array' }`, or
`{ type: 'object' }`; `toJSON()` exposes only that descriptor. Consumers must
migrate from inspecting rejected values to branching on `kind`, `code`, and
`path`. This is an intentional privacy hardening of the public error contract.

`SeedTs.analyze()` now enforces one or two surname syllables, one to four
given-name syllables, at most 512 Unicode characters for each `meaning`, and at
most 32 for each `radical`. Direct `Energy` construction and scoring accept only
the exported `Polarity` and `Element` singleton instances. Inputs outside these
bounds or structural lookalikes that older builds happened to process now fail
closed; callers must normalize or reject them before invoking Seed.

`SEED_SCORING_POLICY.authorityDecisions` describes only the approval state of
the shipped numeric weights, relation adjustments, directional adjacency,
enabled-component aggregation, and unresolved length-normalization policy.
Every listed item remains `expert-review-required`; the metadata does not
grant doctrinal or content authority and does not change any valid score. It is
not a complete authority inventory for onset/nucleus mappings, stroke-to-element
mappings, four-frame construction, or narrative content; those remain governed
by their separate source and expert-review gates.

Pure-Hangul mode is resolved before derived stroke/element validation. Native-Korean UI entries may therefore carry `0`/empty derived placeholders only when they are immediately normalized into deterministic Hangul-only entries; the same placeholders still fail closed in non-pure analysis.

## Four-frame catalog provenance

The runtime catalog is generated from the canonical
`namespring/public/data/fourframe.db` table ordered by `number`. Its generated
module records:

- schema version and deterministic content-derived snapshot version;
- source DB SHA-256 and canonical JSON SHA-256;
- canonicalization rule and the required 81-row count.

`src/fourframe-catalog.ts` validates the generated snapshot through the shared
`compileFourFrameContract()` compiler, verifies every display field and array,
then deeply freezes the catalog. Spring's legacy
`src/fourframe-contract.ts` is only a compatibility re-export of that same
seed-owned compiler.

To refresh the snapshot after an approved canonical DB change:

1. Update only `namespring/public/data/fourframe.db` through the reviewed data pipeline.
2. Run `npm run generate:fourframe-catalog` in `lib/seed-ts`.
3. Run `npm run check:fourframe-catalog` and `npm run test:fourframe-catalog`.
4. Run the full seed, spring, and frontend build gates before committing the DB
   and generated snapshot together.

The generator writes only `src/fourframe-catalog.generated.ts`; do not manually
edit embedded narrative strings or provenance hashes.

Database parity proves snapshot integrity, not doctrinal authority or external
expert review. The embedded narrative is display-only, is excluded from every
score, and remains subject to the separate content/authority release gates.

## Service-visible text boundary

`FOURFRAME_MEANING_CATALOG` and `getFourframeMeaningByNumber()` expose the
immutable canonical snapshot used by DB parity and hash checks. They are never
rewritten. `FourFrameCalculator.Frame.entry` is a separate deeply frozen display
DTO: it substitutes the candidate's `fullHangul` and applies the shared
seed-owned policy in `src/service-text-policy.ts`.

Spring imports that same policy instead of maintaining a second sanitizer in
its engine module. `npm run test:service-text-policy` audits every string in all
81 sanitized display rows. Medical and mental-health claim rules are blocking;
broader certainty, destiny, longevity, catastrophe, and medical-career wording
is reported as review debt because blind word-wide replacement can corrupt
sentence meaning. Call `assertServiceTextPolicy(value, { includeReview: true })`
for a strict editorial gate. A clean blocking audit does not imply that the
remaining review debt has expert authority approval.

## Repository contract

`HanjaRepository`, `FourframeRepository`, and `NameStatRepository` expose explicit asynchronous `init()` and `close()` lifecycles. Concurrent initialization is single-flight, failed initialization can be retried, and closing during initialization prevents a late database from being published.

Repository-owned loader, fetch, and response-body waits use a generation-scoped
`AbortSignal`. `close()` settles those callers even when an injected transport
ignores the signal, and a later generation starts with fresh repository state.
The optional third argument of an injected `initializeSqlJs` loader carries the
same signal; two-argument loaders remain compatible and are safely raced by the
repository lifecycle wrapper.

Every public repository lookup validates its query before SQLite binding.
Blank names or search keywords, `limit = 0`, negative or non-integer limits,
string-coerced numbers, invalid enums, and reversed stroke ranges throw the
non-retryable `RepositoryQueryValidationError` with code
`REPOSITORY_QUERY_INVALID`. They no longer return `null`, match every row, or
rely on SQLite coercion. Callers migrating from the old behavior should catch
that class or code and correct the request; valid not-found queries still
return `null` or an empty list according to the method's existing contract.
Repository limits are integers from 1 through 1,000, four-frame keywords are at
most 200 Unicode characters, and name-stat names are at most 64. Raw string
input is also capped before trimming so whitespace padding cannot create
unbounded validation work.

The default loader uses the same-package `assets/sql-wasm-1.14.1.wasm`
artifact. The package contract pins its byte length and SHA-256 digest, and the
runtime verifies the SHA-256 digest before execution. The package also ships
the upstream MIT notice. Browser bundlers can emit the
asset from its static `import.meta.url` reference, so the default runtime has
no third-party CDN dependency and never falls back to one. Default
initialization is module-wide single-flight by URL and digest; failures are
evicted so a later call can retry. A custom `wasmUrl` must include
`wasmSha256`, while callers that inject a custom `initializeSqlJs` loader
own that loader's integrity boundary and are intentionally excluded from the
default shared cache.

Each caller of the default module-wide WASM flight owns a subscriber lease.
Closing one repository cancels only its subscriber; another active subscriber
continues to share the same fetch. When the last pending subscriber closes, the
flight is identity-checked, evicted, and its underlying transport is aborted so
an immediate retry cannot inherit a permanently pending load. Successful
entries remain cached as before.

Successful default URL/digest entries stay cached for the process lifetime.
This bounds normal products to one reviewed bundled artifact while avoiding
repeat transport and hashing. Arbitrarily many caller-selected pinned URLs are
therefore not intended as a long-running multi-tenant loading strategy.

`HanjaRepository`, `FourframeRepository`, and `NameStatRepository`
separately verify database artifacts before publishing them. Canonical mode
pins the byte length, SHA-256, SQLite `user_version`, table name, full
normalized column schema, and exact row count from the generated database-asset
manifest. NameStat keeps loading lazy and applies the complete verification only
to the selected shard. `dbUrl` or `shardBaseUrl` selects only where canonical
bytes are fetched from; changing a URL does not change or disable the expected
contract.

An intentionally different, reviewed artifact must use
`databaseIntegrity: { mode: 'pinned', contract }`. The complete alternate
contract is cloned and deeply frozen at construction, and its table/schema
family must match the repository's canonical family. Transport and execution
injection remain narrow trust boundaries: a custom `fetch` changes how bytes
arrive, and a custom `initializeSqlJs` loader owns WASM loading, but neither
bypasses database byte, schema, or row-count verification.

NameStat alternate datasets use
`databaseIntegrity: { mode: 'pinned', contracts: [...] }` with one contract
for every canonical shard key. Partial sets, duplicate or unknown shard keys,
duplicate asset IDs, and cross-family schemas fail during construction; missing
entries are never filled from the canonical set. The resolved set is cloned,
deeply frozen, and restored to canonical shard order.

NameStat rows store the raw 19-way choseong, including `ㄲ/ㄸ/ㅃ/ㅆ/ㅉ`.
Routing alone folds those five values into the corresponding 14 base shards.
The generator, manifest builder, runtime lookup, and committed 50,194-row
parity audit enforce this distinction without rewriting the deployed DB files.

Every returned row is decoded against a required-field and finite-number contract. Missing fields, malformed JSON, invalid enums, non-finite or negative statistics, and unsafe JSON object keys throw the non-retryable `RepositoryDataError`; they are never converted into empty fallback data.

## Package boundary

The package publishes the compiled ESM runtime graph under `dist/` plus the
exact `assets/sql-wasm-1.14.1.wasm` binary and
`assets/sql.js-LICENSE.txt` notice. Database migration utilities remain
source-only development tools and are not included in the package.
