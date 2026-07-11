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

## Repository contract

`HanjaRepository`, `FourframeRepository`, and `NameStatRepository` expose explicit asynchronous `init()` and `close()` lifecycles. Concurrent initialization is single-flight, failed initialization can be retried, and closing during initialization prevents a late database from being published.

The default loader fetches the pinned `sql.js@1.14.0` WASM artifact and verifies its SHA-256 digest before execution. A custom `wasmUrl` must include `wasmSha256`; callers that inject a custom `initializeSqlJs` loader own that loader's integrity boundary.

Every returned row is decoded against a required-field and finite-number contract. Missing fields, malformed JSON, invalid enums, non-finite or negative statistics, and unsafe JSON object keys throw the non-retryable `RepositoryDataError`; they are never converted into empty fallback data.

## Package boundary

The package publishes only the compiled ESM runtime graph under `dist/`. Database migration utilities remain source-only development tools and are not included in the package.
