# Service Readiness Report

`spring-ts` can now separate two different questions that are easy to conflate:

- Can a frontend engineer integrate the tiered narrative surface?
- Can the product safely market the output as paid, expert-verified interpretation?

Run:

```bash
npm run service:readiness
npm run service:readiness -- --json
```

## Current Reading

The report is intentionally observation-mode by default.

- `frontendHandoff.status = ready_with_known_content_gaps` means the API surface, tiered matrix cells, expert evidence anchors, and docs are sufficient for a frontend implementation branch.
- `commercialReadiness.status = blocked_for_authority_claims` means the product should not make expert-verified or authority-backed claims yet.

The current blocker is not the frontend contract. The blocker is evidence policy:

- narrative fragments are still `T1_HYPOTHESIS`;
- expert numerical evidence is deterministic internal evidence, not authority-truth evidence;
- zero tiered cells currently have authority-truth eligible backing;
- remaining expert density gaps are concentrated in `agePhase`.

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
node tools/service_readiness_report.mjs \
  --max-thin-expert-axis-values=0 \
  --min-authority-fragments=1 \
  --min-authority-numerical-evidence=1 \
  --max-zero-authority-cells=0
```

This strict command is expected to fail until Reference A or equivalent reviewed authority evidence is added and the remaining expert density gaps are closed or explicitly hedged.

## What To Improve Next

1. Continue reducing `agePhase` thin expert axis values.
2. Add authority-truth eligible Reference A fragments and numerical evidence only after source review.
3. Add frontend acceptance fixtures that verify brief/standard/expert progressive disclosure against a real NameSpring page.
4. Keep all narrative data display-only; scoring and judgment code must not import `data/narrative/**`.
