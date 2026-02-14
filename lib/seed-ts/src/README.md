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
- `core/`: runtime calculation/search internals
- `calculator/`: modular calculation units (`Hanja`, `Sound`, `FourFrame`) used by `core/evaluator`
- `calculator/calculator-graph.ts`: forward(`preVisit/visit/postVisit`) + backward propagation execution utility

## Compatibility Layer
- `model/`: shared vocabulary helpers (`Element`, `Polarity`, `Energy`, terms)
- `database/`: compatibility DAO/mapper split (`types/sql/mapper/repository`)
- `src/types.ts`: legacy app-level contracts kept for compatibility

## Policy
- Runtime is strictly db-only.
- New code is written in canonical English terms.
- Terminology aliases are removed from runtime code.
