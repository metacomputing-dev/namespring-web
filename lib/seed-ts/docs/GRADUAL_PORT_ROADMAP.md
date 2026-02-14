# Seed TS Refactor Roadmap (Greenfield-in-place)

## Intent
- Introduce a new architecture as new code, not by stretching old file layouts.
- Keep runtime stable while progressively replacing internals.
- Preserve the current project structure direction while absorbing validated legacy logic.

## Current Direction
- Facade: `src/seed.ts`
- Runtime architecture: `src/engine/{domain,application,ports,infrastructure}`
- Calculation internals (reused): `src/core/*`
- Adapter zone: `src/{model,calculator,database,types.ts}`

## Naming Canon
- `Element` = five elements (오행)
- `Polarity` = yin/yang polarity (음양)
- `Energy` = `{ element, polarity }`
- `FourFrame` = four-frame numerology (사격)
- `Hangul`, `Hanja`, `Sound`, `Char` = canonical terms

## Principles
- db-only runtime
- new modules first, canonical terms first
- thin compatibility boundaries
- deterministic behavior (query/order/ranking)

## Phases
1. Architecture carve-out
- complete: `engine` layer introduced and `seed.ts` routed through it
- complete: runtime assembly split (`evaluate-input`, `seedts-query`, `runtime-factory`, sqlite path/four-frame modules`)

2. Adapter modularization
- complete: `database` split (`types/sql/mapper/repository`)
- complete: `model` split and relation helpers
- complete: `calculator` split + shared support
- complete: per-layer barrel exports for stable imports

3. Contract cleanup
- complete: legacy naming aliases removed from runtime code
- in progress: external call-site migration to canonical types

4. Core extraction
- pending: move selected logic from `core` to `engine` services in small slices

5. Final cleanup
- pending: remove dead adapter paths once compatibility and integration are stable

## Acceptance Gate
- build passes
- compatibility tests pass
- no runtime file-loading fallback
