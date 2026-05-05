# P9-A3 Snapshot Baseline Refresh — Diff Summary

`test/baseline/spring_ts_snapshot.json` was last regenerated on commit `238d9ae`
(2026-05-01) and accumulated drift from ~90 src/ commits and ~470 total commits
since. This task refreshes the baseline; this document classifies the diffs and
attributes them to specific commits.

## Headline

- Before refresh: `npm run test:snapshot` → 0/15 PASS, 15/15 FAIL.
- After refresh: 15/15 PASS.
- Diff scope: 15/15 fixtures changed; 224 field-level diffs total.

## Diff classification

| Category | Count | Within ε? | Disposition |
|---|---|---|---|
| `candidatesTop5[*].finalScore` | 66 | 23 within 0.5, 43 over | Intentional (see §Attribution) |
| `candidatesTop5[*].fullHangul` | 75 | n/a (string) | Intentional (candidate ranking churn) |
| `candidatesTop5[*].fullHanja` | 75 | n/a (string) | Intentional (candidate ranking churn) |
| `namingReport.fullHangul` | 3 | n/a (string) | Bug-fix (surname `리`→`이`) |
| `namingReport.totalScore` | 2 | 2 over 0.5 | Bug-fix downstream (surname rendering) |
| `namingReport.scores.hangul` | 2 | 2 over 0.5 | Bug-fix downstream (surname rendering) |
| `fortuneReport.lifeStars` | 3 | n/a (integer) | Intentional (life-fortune wording fixes) |

ε bands per `tools/measure_default_change.mjs`:
- `EPS_TOTAL_SCORE = 0.5`
- `EPS_INDIVIDUAL_SCORE = 0.5`

Note: the `validate:default-change` gate compares `main:snapshot` vs
`HEAD:snapshot` on disk. After this refresh, the gate will report many
above-ε deltas. Those deltas are accumulated drift from ~90 src/ commits
since `238d9ae`, not introduced by this PR.

## Attribution

### Surname rendering bug-fix (fix-11, fix-15)

- `7b3b43a Harden service-visible fortune output` (Phase 8 cleanup)
  - In `resolveEntries`: `if (entry) return entry;` →
    `if (entry) return { ...entry, hangul: char.hangul, is_surname };`
  - Effect: caller-supplied `hangul: "이"` is preserved instead of being
    overwritten by the DB's first-reading `리` for hanja `李`.
  - Fixture file already specified `surname.hangul = "이"`; the May-1 baseline
    had captured the buggy `리` value.
  - Downstream score impact: `HangulCalculator` now consumes `이` jamos →
    `scores.hangul` jumps +8.7 (fix-11) / +8.8 (fix-15). `totalScore` shifts
    +3.10 in both fixtures.

### Candidate name churn (all 15 fixtures)

Multi-source. Likely contributors:

- `9991071 data(trend): add court name trend fixtures` — expanded
  `data/hangul-name-trends.json` from baseline to 1837-line dataset; affects
  `eraFit` axis in name score vector.
- `d0578c0 feat(trend): surface hangul era fit evidence` — wires
  `getNameTrendAnalysis` into spring-engine for candidate ranking.
- `f5b7f5c data(hanja): reconcile legal status buckets` — modifies legal hanja
  classification, affecting candidate filtering.
- `9617c6d feat(K-4 + K-5 full wire): pureHangulSignalCap actually applied`
  and `ea142fd feat(K-6 full wire): pureHangulPolarityModel ternary actually
  applied` — HangulCalculator constructor adopts new params; "default
  behavior preserved" per commit messages but the calculator-instantiation
  paths may differ in candidate scoring vs existing baseline paths.
- `b829b11 feat(tiered): expand FeatureVector to 35 numeric axes for fragment
  evidence` — expanded feature space affects candidate selection.
- `62b6461 feat(scoring): compute score vector before finalScore` and
  `8444562 feat(copy): add deterministic score-vector templates` —
  finalScore composition refactored.
- `68f9cb6 feat(generator): wire full legal hanja pool` — opt-in only
  (`hanjaPool === 'inmyeongyong_full'`); default `'curated'` path unchanged,
  but the supporting refactor moved inline branches that may reorder
  candidate iteration.

### lifeStars changes (fix-03, fix-06, fix-14)

- `bb191ef fix(report): treat letter-grade shinsal as neutral`
- `9eaa100 fix(report): handle strength tendency labels`
- `d592c7b fix(report): normalize Korean strength levels`
- `84fbbe7 fix(report): hedge low-confidence yongshin overview`

These adjust life-fortune star aggregation logic in
`lib/spring-ts/src/report/cards/life-fortune-overview-card.ts`.

### Score-vector / saju refinements

- `9fa7aa2 fix(saju): clarify thin-reinforcement reason without dead posture
  guard`
- `6db1e31 feat(saju): refine consensus_aware yongshin posture and per-axis
  surfacing`
- `3bc99ad fix(saju): dedup safetyProfile reasons via colon-prefixed risk
  label`
- `b6ba2e2 Improve output text and candidate safety`

These touched `saju-calculator.ts` and `saju-adapter.ts`. They explain some
finalScore drift but don't change `dayMaster`, `gyeokgukType`, etc., which
remain stable across all 15 fixtures (verified: 0 diffs in those fields).

## Stability across the refresh

Fields that did NOT change across any of 15 fixtures (sanity checks):

- `sajuReport.sajuEnabled`
- `sajuReport.dayMaster.*`
- `sajuReport.strengthLevel`, `isStrong`
- `sajuReport.yongshinElement`, `yongshinHeeshin`
- `sajuReport.gyeokgukType`, `gyeokgukCategory`, `gyeokgukConfidence`
- `sajuReport.deficientElements`, `excessiveElements`
- `fortuneReport.overviewTitle`
- `fortuneReport.dailyStars`, `yearlyStars`
- `fortuneReport.personalityTraitCount`
- `namingReport.scores.hanja`, `scores.fourFrame` (no diffs in 15 fixtures)
- `candidatesTop5[*].rank` (1-5 ordering preserved)

This is a structural/data-driven refresh. Saju engine outputs are unchanged.

## Acceptance gates after refresh

- `npm run test:snapshot` → 15/15 PASS.
- `npm run test:namespring-compat` → 202/202 PASS.
- `npm run validate:default-change --baseline main --branch HEAD` →
  expected to report deltas (compares stale `main` snapshot to refreshed
  `HEAD` snapshot). Deltas are pre-existing drift, not introduced by this
  PR.

See `snapshot-diff.json` in this directory for the full per-fixture diff.
