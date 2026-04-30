# Contributing to saju-ts (saju-math-engine)

This file complements `README.md` for contributors who work on the engine
inside the `namespring-web` monorepo.

## Local environment

Requirements:

- Node.js >= 20 (ESM only)

First-time setup or after a long break:

```bash
cd lib/saju-ts
rm -rf node_modules package-lock.json
npm install
ls node_modules/.bin/vitest*   # binary should exist
npm run typecheck              # PASS
npm test                       # PASS (no tests is also fine)
```

If `node_modules/.bin/` is empty after `npm install`, the npm bin-link
step did not run. On Windows this can happen with mixed shells/AVs.
A clean `rm -rf node_modules package-lock.json && npm install` usually
restores the symlinks.

## Test layout

- `src/{api,calendar,core}/**/*.test.ts` — colocated unit tests, run by `npm test`.
- `tests/precision/**/*.test.ts` — precision/regression suites added in
  the precision-improvement work (Phase 0+).
- `tests/{calendar,config,domain,engine,interpretation,verification}/`
  — **legacy**, not run. Kept in the tree for now; will be reworked in
  a separate change. Do not extend these files.
- `src/golden.test.ts` — depends on `docs/_golden/golden_cases.json`
  which is not shipped in this library copy, so it is excluded from
  `npm test`. The maintained golden equivalents live in
  `tests/precision/`.

## Commit conventions

- Conventional Commits style: `scope: subject`.
- Scopes used in the precision plan: `calendar`, `solar`, `nutation`,
  `wollyul`, `tools`, `tests`, `types`, `config`, `docs`, `chore`.
- Each commit must pass `npm run typecheck` and `npm test`.
- See `<workspace>/saju-info/06_precision_improvements/WORKFLOW.md`
  for the per-PR / per-commit checklist used in the precision work.

## Public API

The public surface (`src/index.ts`) is the contract. The
`SajuRequest` / `AnalysisBundle` / `SummaryReport` shapes in
`src/api/types.ts` and the `engine.analyze(request)` signature must
not change in routine work. Numerical defaults must also stay
backward-compatible: new precision options enter via opt-in
`EngineConfig` flags.
