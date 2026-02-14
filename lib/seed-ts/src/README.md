# `src` Structure

## Runtime (new architecture)
- `seed.ts`: public facade (`Seed`, `SeedTs`)
- `engine/`
- `domain/`: canonical runtime contracts
- `application/`: use-case orchestration (`SeedEngine`, `SeedTsAnalyzer`)
- `ports/`: runtime boundary interfaces
- `infrastructure/sqlite/`: db-only runtime context/bootstrap
- runtime assembly split: `input normalization`, `query translation`, `context factory`, `sqlite path/four-frame loaders`
- `index.ts` barrels exist per layer for predictable imports
- `core/`: mature calculation/search internals reused by the new architecture

## Team-facing adapter layer
- `model/`: `Element`, `Polarity`, `Energy`, `Char` vocabulary
- `calculator/`: modular calculators (`Hanja`, `Sound`, `FourFrame`)
- `database/`: repository adapter split (`types/sql/mapper/repository`)
- `types.ts`: app-level request/response contracts

## Policy
- Runtime is strictly db-only.
- New code is written in canonical English terms.
- Terminology aliases are removed from runtime code.
