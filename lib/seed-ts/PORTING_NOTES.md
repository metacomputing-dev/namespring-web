# seed-ts porting notes

## Current status
- Legacy `Main.kt` parity suite passes.
- Search/evaluate paths use real calculation logic (no fixture shortcut).
- Legacy pass-gate behavior is applied in search selection.
- Compatibility hanja normalization regression is covered by test.

## Key parity decisions
- Stats hanja combinations are loaded as raw strings (no compatibility normalization).
- Hanja lookup fallback follows legacy behavior:
  - exact `hangul+hanja`
  - fallback by `hanja`
  - default fallback values (`hoeksu=10`, earth/earth, eumyang=0)
- Search uses top-K min-heap selection to match Kotlin priority-queue behavior.

## Added regression coverage
- `test/main-legacy-parity.test.mjs`
- `test/compatibility-regression.test.mjs`

## SQLite migration-ready points
- Keep `HanjaRepository` / `StatsRepository` interfaces as stable ports.
- Added `SqliteHanjaRepository` and `SqliteStatsRepository` implementing same ports.
- Seed runtime wiring can switch repositories via `SeedOptions` without evaluator/search logic changes.
- Added schema file: `src/main/resources/seed/data/sqlite/schema.sql`
- Added build script: `scripts/build-sqlite.mjs` (`npm run sqlite:build`)
- Migration order:
  1. ingest `hanja` + `stats` data into sqlite schema
  2. implement sqlite repositories
  3. run existing parity tests unchanged
  4. optimize query plans/indexes after parity lock

## Non-goals for this phase
- Saju deep logic expansion (deferred by request).
- API contract changes outside existing seed-ts surface.
