# Phase M — Validation Results

This file records the validation outcomes from Phase M of the spring-ts precision project. Phase M was unblocked by the maintainer extracting `saju_master_project_v9_2.zip` to `C:\Projects\metaintelligence\saju_master_project_v9_2\` and is the first phase where spring-ts can be cross-checked against an external reference implementation.

## Inputs

- **Reference B (saju_master oracle)** — `saju_master_project_v9_2` Python CLI, all 12 fixtures captured to [`oracles/`](./oracles/) via `npm run capture:oracles` (PR-M-1).
- **Reference A (lecture casebook)** — 11 cases from 명리심리상담사 교안 (14차시 + 15차시), distilled into [`authority/lecture/`](./authority/lecture/) (PR-M-4).
- **Reference A (full authority cases)** — none yet. Pending maintainer extraction of pillars + ≤50자 paraphrase from a published Reference A text (사주첩경, 박재완 명리요강, 박재완 명리실관). `quality_gate.mjs` D2/D4 dimensions remain N/A until these arrive.

## Quality gate output (PR-M-2 onward)

```
npm run quality:gate

Overall: FAIL
Fixtures: 5 PASS / 7 FAIL / 0 N/A (total 12)
Dimensions:
  D1: FAIL  (5 PASS / 7 FAIL / 0 N/A)
  D2: N/A  (12 N/A — Reference A authority cases unavailable)
  D3: PASS  (12 PASS / 0 FAIL / 0 N/A)
  D4: N/A  (12 N/A — Reference A hedge labels unavailable)
  D5: FAIL  (2 PASS / 3 FAIL / 7 N/A)
```

D5 fail count is downstream of D1 — when an edge fixture's D1 fails, D5 also fails because the F-A18 §2.5 categorical PASS rate threshold is not reached.

## D1 disagreement classification

All 7 original D1-FAIL fixtures were investigated in Phase M. Stack02 later proved that the
fix-06/fix-07 companion-frame diagnosis was an engine bug, so the earlier “none are bugs” conclusion
is superseded for those two fixtures. Current reasoning lives in each fixture's `disagreementNotes`.

| fix | spring-ts                          | saju_master              | nature                                       | source PR |
|-----|------------------------------------|--------------------------|----------------------------------------------|-----------|
| 02  | 정관격                              | 편관격                    | saju_master 미정/혼잡 score 0.25 (low conf)   | PR-M-3 |
| 03  | 편관격 / WOOD                       | 편재격 / FIRE             | 자시 boundary, saju_master 미정/혼잡         | PR-M-3 |
| 04  | 중화(신강 경향)                     | 신약                      | engine-level strength weighting diff         | PR-M-3 + PR-M-7 |
| 06  | 정인격                              | 비견격                    | residual companion structural-frame bug fixed | Stack02 |
| 07  | 정인격                              | 비견격                    | residual companion structural-frame bug fixed | Stack02 |
| 10  | 편재격 / METAL / 신강               | 비견격 / null             | engine-level gyeokguk rule diff              | PR-M-3 + PR-M-8 |
| 12  | 중화(신강 경향)                     | 신약                      | engine-level strength weighting diff         | PR-M-3 + PR-M-7 |

## Internal consistency checks

These are not Reference A validation — they verify saju-ts's internal logic matches its own data tables. Useful for catching regression but not for proving "능가 expert".

- `npm run validate:lecture` (PR-M-5 + PR-M-6):
  - 11 / 11 month-branch ten-god (saju-ts `tenGodOf` ↔ casebook `expected.month_ten_god`)
  - 11 / 11 day-branch ten-god (saju-ts `tenGodOf` ↔ casebook `expected.decision_ten_god`)
  - 27 / 27 activity_keyword ten-god presence (filtered to pure ten-god names; composite idioms excluded)

## Diagnostic tools added

- `tools/capture_saju_master_runs.mjs` — saju_master CLI wrapper, populates `oracles/` (PR-M-1).
- `tools/validate_lecture_cases.ts` — saju-ts ten-god verification against 11 lecture cases (PR-M-5/PR-M-6).
- `tools/diagnose_strength_direction.ts` — fix-04 / fix-12 strength-direction discriminator (PR-M-7).
- `tools/diagnose_fix10_pillars.ts` — fix-10 pillar + gyeokguk rule comparison (PR-M-8).

## Honest framing

What Phase M proves:
- spring-ts and saju_master agree on **3 / 12** fixtures fully (fix-01, 08, 09).
- They agree on **5 / 12** when the D1 strength-label normalizer (PR-M-2) is applied for compatible band labels.
- The remaining **7 / 12** disagreements are classified as engine-level rule or weighting differences;
  Stack02 subsequently corrected the internal consistency of fix-06/fix-07 without claiming external authority.

What Phase M does NOT prove:
- spring-ts surpasses Korean naming experts. saju_master itself is a research implementation, not an authority. Several spring-ts PRs (chengbai.py, judgment_expression_engine.py reference) cite saju_master as their source. Where they agree, that's shared lineage, not independent verification.
- spring-ts is externally correct on the 7 disagreements. Authority case adjudication is still required.
  The fix-06/fix-07 implementation defect was corrected, but the adopted structural policy remains provisional.

Phase M's contribution: **infrastructure + documented honesty**. Future authority case extractions will plug into the existing `quality_gate.mjs` D1/D2/D4 dimensions without further wiring.

## What unblocks the next round

1. Extract pillars + ≤50자 paraphrase from a published Reference A authority text (사주첩경 / 박재완 명리요강 / 박재완 명리실관) and land them as `<fixture-id>.json` files matching the schema in [`authority/README.md`](./authority/README.md).
2. For each authority case, the gate's D1/D2/D4 dimensions activate. fixtures whose disagreement happens to match the authority's call get adjudicated.
3. If spring-ts's choice contradicts authority, that becomes a real `needsCodeReview: true` and gets a remediation PR.
4. If saju_master's choice contradicts authority, the documented disagreement loses defensibility for that fixture — also informative.

PR-M cycle is complete. Continued work waits on user-provided Reference A.
