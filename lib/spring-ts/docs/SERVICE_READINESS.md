# Service Readiness Report

`spring-ts` can now separate two different questions that are easy to conflate:

- Can a frontend engineer integrate the tiered narrative surface?
- Can the product safely market the output as paid, expert-verified interpretation?

Run:

```bash
npm run service:readiness
npm run service:readiness -- --json
npm run service:readiness:paid-gate
```

## Current Reading

The report is intentionally observation-mode by default.

- `frontendHandoff.status = ready_for_frontend_integration` means the API surface, tiered matrix cells, expert evidence anchors, density floor, and docs are sufficient for a frontend implementation branch.
- `commercialReadiness.status = blocked_for_authority_claims` means the product should not make expert-verified or authority-backed claims yet.

The current blocker is not the frontend contract. The blocker is evidence policy:

- narrative fragments are still `T1_HYPOTHESIS`;
- expert numerical evidence is deterministic internal evidence, not authority-truth evidence;
- zero tiered cells currently have authority-truth eligible backing;
- paid expert claims remain blocked until reviewed authority evidence is attached.

## Frontend Implementation Contract

The frontend should treat `precisionConfig.surfaceTieredMatrix=true` as an opt-in surface and render progressively:

1. Show `brief` first.
2. Expand to `standard` when the user asks for more.
3. Expand to `expert` only when the user explicitly opens expert details.
4. Render expert `tag` tokens as glossary chips.
5. Keep `selectedFragments` and raw gating metadata hidden except for QA/debug/expert-detail panels.

This matches:

- `FRONTEND_EXTENSIONS.md`
- `docs/TIERED_MATRIX_SPEC.md`
- `docs/NARRATIVE_STYLE_GUIDE.md`

## Paid Service Gate

Before making paid expert-verification claims, use stricter thresholds:

```bash
npm run service:readiness:paid-gate
```

This strict command is expected to fail until Reference A or equivalent reviewed authority evidence is added. It no longer fails for expert `agePhase` density, because that density floor is complete.

## What To Improve Next

1. Add authority-truth eligible Reference A fragments and numerical evidence only after source review.
2. Add frontend acceptance fixtures that verify brief/standard/expert progressive disclosure against a real NameSpring page.
3. Keep all narrative data display-only; scoring and judgment code must not import `data/narrative/**`.
4. Re-run `npm run service:readiness` and `npm run service:readiness:paid-gate` before changing product copy around expert verification.

For authority-source planning, run:

```bash
npm run narrative:authority-gaps
npm run narrative:authority-gaps -- --json
npm run validate:reference-authority
```

Use `authorityWorkBacklog` first. `P0_EXPERT_INTERNAL_EVIDENCE_REVIEW` rows are expert cells that already have deterministic internal numerical evidence, so they are the first places to attach reviewed Reference A or equivalent authority sources.
`service:readiness` also exposes the first five rows as `nextAuthorityWork`, so product and frontend planning can see the next paid-claim blocker without running a second command.
`validate:reference-authority` is the intake guard for top-level Reference A cases; it allows today's empty flat-case state, but blocks unresolved pages, low-tier authority truth, long summaries, and stored original prose when cases are added.
