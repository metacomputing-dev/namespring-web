# `src/legacy` (Reference Sandbox)

This directory is intentionally kept minimal.

Purpose:
- hold temporary snapshots or experiments during gradual migration
- avoid disruptive folder churn in team-facing primary structure

Rule:
- production/runtime paths should stay in `src/seed.ts` + `src/core/*`
- team-facing structure remains under top-level `src/{calculator,model,database,utils,types.ts,data}`
