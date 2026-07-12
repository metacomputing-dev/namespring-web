# @namespring/seed-ts

Deterministic Korean naming primitives and browser-compatible data repositories.

## Analysis contract

`SeedTs.analyze(userInfo)` is synchronous and performs no database or network I/O. It validates name entries, clones caller-owned input, returns a deeply frozen result, and throws a structured `SeedValidationError` or `SeedCalculationError` instead of manufacturing fallback values.

All 81 four-frame meanings are available synchronously from a versioned embedded snapshot. They populate each frame's display-only `entry`, while `luckScore` remains `null` and the narrative snapshot does not alter the score. The returned `fourFrameEnrichment` field records that boundary and its provenance explicitly.

Every calculator exposes a `pending | ready | excluded` `calculationStatus`. Pure-Hangul analysis marks Hanja and four-frame calculators as `excluded`; their score is explicitly zero and remains safe to read after the frozen result is returned.

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

The default loader fetches the pinned `sql.js@1.14.0` WASM artifact and verifies its SHA-256 digest before execution. A custom `wasmUrl` must include `wasmSha256`; callers that inject a custom `initializeSqlJs` loader own that loader's integrity boundary. The digest protects integrity, not availability: the default URL remains a third-party CDN dependency. Products that require same-origin or offline availability must provide a reviewed self-hosted URL and matching digest; there is no silent unpinned fallback.

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

The package publishes only the compiled ESM runtime graph under `dist/`. Database migration utilities remain source-only development tools and are not included in the package.
