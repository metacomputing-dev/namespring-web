# Seed TS Gradual Port Roadmap

## Goal
- Keep main branch structure stable while gradually converging to the `feature/seed-ts-port` runtime behavior.
- Pass parity tests continuously during each phase.
- Prepare clean boundaries for future sqlite integration.

## Current Baseline (Checkpoint)
- Branch: `feature/seed-ts-gradual-main`
- Core runtime is active from `src/core/*` via `src/seed.ts`.
- Data is available at `src/main/resources/seed/data/*`.
- Parity tests are added and passing.

## Working Principles
- Small, reversible commits.
- Do not change public API shape abruptly.
- Keep legacy paths as adapters until final cleanup.
- Use parity tests as release gate for every phase.

## Phase Plan

## Phase 1: Stabilize runtime entrypoints + preserve team structure
- Keep `src/seed.ts` as facade.
- Keep `src/core/*` as single source of truth.
- Ensure `npm test` remains green.
- Status:
- team-facing top-level structure is preserved (`calculator/`, `model/`, `database/`, `utils/`, `types.ts`, `data/`)
- active runtime remains stable through (`seed.ts`, `index.ts`, `core/`, `main/resources/seed/data/`)
- `src/legacy/` is reference-only sandbox (not primary code location)

## Phase 2: Type and naming consistency
- Standardize canonical names in core:
- `Element`, `Polarity`, `Energy`, `Frame`, `FourFrame`.
- Keep legacy aliases for compatibility.
- Avoid external API breakage.

## Phase 3: Repository boundary hardening
- Keep `HanjaRepository` and `StatsRepository` as abstraction boundary.
- Validate in-memory path as default runtime.
- Keep sqlite implementation isolated and optional.

## Phase 4: Legacy adapter narrowing
- Restrict legacy `src/calculator/*`, `src/model/*`, and old `src/types.ts` to adapter role only.
- Remove duplicate logic from legacy path.
- Keep compile surface focused on `src/core/*`.

## Phase 5: Final cleanup
- Remove dead legacy code after parity and integration checks are stable.
- Keep docs and migration notes updated.

## Acceptance Criteria (per phase)
- `npm run build` passes in `lib/seed-ts`.
- `npm test` passes in `lib/seed-ts`.
- No unintended public API regression.
- Changes are scoped and reviewable.

## Change Log
- 2026-02-13: Initial roadmap recorded on `feature/seed-ts-gradual-main`.
