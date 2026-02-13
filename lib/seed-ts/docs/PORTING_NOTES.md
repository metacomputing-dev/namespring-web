# Seed TS Porting Notes

## Scope
- Ported the core name-evaluation flow into TypeScript with project-local resources.
- Kept `Seed.evaluate`, `Seed.search`, and a compatibility `SeedTs.analyze`.
- Excluded real SAJU integration for now (`SAJU_JAWON_BALANCE` is intentionally fixed/stubbed).

## Current module layout
- `src/core/types.ts`: contracts and repository interfaces.
- `src/core/resource.ts`: data root resolution + gzip/json loaders.
- `src/core/hanja-repository.ts`: in-memory hanja dictionary loader and indexes.
- `src/core/stats-repository.ts`: in-memory statistics loader with lazy caches.
- `src/core/query.ts`: Main.kt-style bracket query parsing.
- `src/core/evaluator.ts`: category scoring / pass-fail aggregation.
- `src/core/search.ts`: wildcard expansion + candidate search pipeline.
- `src/seed.ts`: public API orchestration.

## Data strategy (sqlite-ready)
- Storage access is abstracted behind:
  - `HanjaRepository`
  - `StatsRepository`
- Current implementation uses gzip resources in memory.
- SQLite migration path:
  - Implement `SqliteHanjaRepository` and `SqliteStatsRepository`.
  - Keep evaluator/search untouched by preserving repository contracts.

## Known deliberate limitations
- SAJU internals are not yet ported.
- Search is bounded to avoid combinational explosion on multi-wildcard queries.
- This phase prioritizes stable core behavior and API compatibility over byte-perfect Kotlin parity.

