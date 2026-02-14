# `src` Structure

## Primary project structure (team-facing)
- `index.ts`: public exports
- `seed.ts`: facade entrypoint (`Seed`, `SeedTs`)
- `calculator/`: naming calculators (legacy-origin structure)
- `model/`: domain models (legacy-origin structure)
- `database/`: repository contracts/helpers (legacy-origin structure)
- `utils/`: tooling/helpers (legacy-origin structure)
- `types.ts`: shared surface types (legacy-origin structure)
- `data/`: legacy data assets used by tools
- `core/`: production runtime logic used by current parity path
- `main/resources/seed/data/`: runtime data files

## Legacy area (kept for gradual migration)
- `legacy/`: reference-only sandbox for snapshots/experiments
- Policy: keep runtime behavior stable; migrate by adapters, not big-bang rewrites
