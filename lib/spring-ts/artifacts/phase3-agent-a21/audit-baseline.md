# Phase 3 Agent A21 — Card Vocabulary Audit

> Worktree: `agent-a3e8e8439eb3e346b` (Wave 4 owned scope: `src/report/cards/**` text-only).
> Baseline: post-Wave 3 main (snapshot 2026-05-05).

## 1. Per-phrase frequency (legacy NameSpring-rendered cards only)

Count is occurrences in `src/report/cards/*.ts` and `src/report/buildFortuneReport.ts`.

| phrase | before (Wave 3 main) | after (this branch) | change |
|---|---:|---:|---:|
| `결이` | 0 | 5 | +5 |
| `결이에요` | 0 | 0 | unchanged |
| `흐름이` | 31 | 12 | -19 |
| `편이에요` | 8 | 8 | unchanged |
| `또렷` | 0 | 0 | unchanged |
| `단단` | 0 | 0 | unchanged |
| `한 박자` | 4 | 4 | unchanged |
| `페이스` | 1 | 2 | +1 |
| `차곡차곡` | 0 | 0 | unchanged |

Notes:
- `결이`, `결이에요`, `또렷`, `단단`, `차곡차곡` were already absent from card-layer code at the Wave 3 main baseline. The completion-line template (`결이 사용 N→M`) assumed nonzero usage; reporting the actual `흐름이` baseline (the only phrase with concentration concerns) is the load-bearing metric.
- `편이에요` (8) was kept unchanged. The phrase is already distributed across overview-summary, life-fortune-overview, name-compatibility, personality, category-fortune-card, and is the canonical hedge form per `docs/NARRATIVE_STYLE_GUIDE.md` §1.

## 2. Per-card distribution of `흐름이`

| file | before | after |
|---|---:|---:|
| `category-fortune-card.ts` | 10 | 1 |
| `category-fortune-subdomain-data.ts` | 8 | 4 |
| `period-fortune-card.ts` | 9 | 5 |
| `cautions-card.ts` | 1 | 1 |
| `life-fortune-overview-card.ts` | 1 | 0 |
| `life-stage-fortune-card.ts` | 2 | 1 |
| `name-compatibility-card.ts` | 0 | 0 |
| `overview-summary-card.ts` | 0 | 0 |
| `personality-card.ts` | 0 | 0 |
| `strengths-weaknesses-card.ts` | 0 | 0 |
| **total** | **31** | **12** |

## 2b. Per-card distribution of `결이` (introduced)

| file | after |
|---|---:|
| `category-fortune-card.ts` | 1 |
| `category-fortune-subdomain-data.ts` | 1 |
| `life-fortune-overview-card.ts` | 1 |
| `life-stage-fortune-card.ts` | 1 |
| `period-fortune-card.ts` | 1 |
| **total** | **5** |

`결` is an abstract Korean noun (texture / grain / weave) and is not part of the §3 metaphor library (the registered metaphors are 木 plant, 火 light/heat, 土 ground, 金 tool, 水 water). The 5 sentences carrying `결이` (`인연의 결이 부드러워져요`, `삶의 결이 한층 부드러워질 수 있어요`, etc.) do not import a competing 식물·날씨·요리·건축·악기 image — they pair `결` with `부드러워지다` / `잡히다` (untextured verbs), so the §3 "비유 1개를 한 fragment 안에서 일관되게 사용" rule is preserved.

Substitutions favor topic-anchored alternatives so the remaining 12 uses stay tied to natural ten-god / climate / period anchors (재물, 관성, 조후, 편재, 평이한, 보조 등):

- `category-fortune-card`: kept `재물 흐름이` as the wealth GOOD_SUFFIX anchor (one occurrence).
- `category-fortune-subdomain-data`: kept `관성 흐름이`, `재물 흐름이`, `인성 + 조후 흐름이`, `역마 + 편재 흐름이` (four ten-god / climate-anchored uses).
- `period-fortune-card`: kept `최고로 좋은 흐름이에요`, `도움을 주는 흐름이에요`, `한 주의 흐름이`, `좋은 흐름이 만들어져요`, `운세 흐름이 약한` (five contrast-anchored uses).
- `cautions-card`: kept the `신살입니다.` → `흐름이에요.` regex normalizer (changing this risks breaking external shinsal text passing through).
- `life-stage-fortune-card`: kept `핵심 흐름이에요` highlight (one occurrence) — the per-stage core-flow anchor.

## 3. Voice violation audit (NARRATIVE_STYLE_GUIDE §6)

Direct grep over `src/report/cards/**`:

| dimension | violations | evidence |
|---|---:|---|
| career — 직업명 단정 (의사/변호사/판사/회계사/교수) | 0 | only `의사소통` (communication) appears |
| academic — 합격 단정 | 0 | no `합격` substring |
| romance — 결혼 단정 (`결혼.*합니|결혼.*해`) | 0 | only `결혼운` category title |
| expression_children — 자녀 강요 (`자녀.*낳|자녀.*가져`) | 0 | only `자녀 관련 흐름이` (descriptive) |
| health — 의학 단정 (`처방|진단|약을|치료|병명`) | 0 | no occurrence |

Status: 0 violations confirmed (no patches required for Task 2).

## 4. A11 glossary entry usage in cards

Direct grep `src/report/cards/**`:

```
imports from `_glossary/`     : 0
imports from `knowledge/...Encyclopedia` : 5 files
  - life-fortune-overview-card  → gyeokgukEncyclopedia
  - cautions-card               → shinsalEncyclopedia
  - overview-summary-card       → stem/strength/gyeokguk encyclopedias
  - personality-card            → stem/tenGod/gyeokguk encyclopedias
  - strengths-weaknesses-card   → stem/tenGod/strength/gyeokguk encyclopedias
```

`src/report/knowledge/encyclopedia.ts` (and the *.Encyclopedia.ts files) are forbidden scope for this agent (A11 ownership). No card builder imports the Wave 2 `_glossary/` JSON entries directly. Task 4 reduces to a documented no-op for the card layer; tiered output already references the new entries through its own selector path (A16 / A11 territory).

## 5. Test gates

| test | A21 baseline (cards rolled back) | A21 after | result |
|---|---:|---:|---|
| `npm run typecheck` | clean | clean | unchanged |
| `npm run ci:no-ai-policy` | PASS | PASS | unchanged |
| `npm run test:service-visible-output` | 13/13 | 13/13 | unchanged |
| `npm run test:namespring-compat` | 202/202 | 202/202 | unchanged |
| `npm run test:tengod-report-surface` | 8/8 | 8/8 | unchanged |
| `npm run test:overview-pillar-elements` | 2/2 | 2/2 | unchanged |
| `npm run test:life-stage-display` | 4/4 | 4/4 | unchanged |
| `npm run test:life-fortune-yongshin-confidence` | 8/9 | 8/9 | unchanged (pre-existing FAIL) |
| `npm run test:snapshot` | 0/15 | 0/15 | unchanged (pre-existing baseline drift) |

**Pre-existing failures (verified by rolling back A21's three commits via `git checkout HEAD~3 -- src/report/cards/ src/report/buildFortuneReport.ts` and re-running):**

- `test:life-fortune-yongshin-confidence` failing case `evidence still carries the selected yongshin candidate` checks that `supportingFeatures.some(f => f.includes('METAL'))`. Actual feature is the Korean form `용신 후보: 쇠`. The mismatch exists on Wave 3 main and is independent of A21 (likely a stale assertion left from an earlier element-code refactor). Out of A21 scope.
- `test:snapshot` reports 0/15 PASS on both A21-rolled-back and A21-applied states. The captured snapshot (`test/baseline/spring_ts_snapshot.json`) tracks `overviewSummary.title`, `personalityTraitCount`, totalScore, etc., none of which A21 touched. The drift comes from preceding default-flip / scoring / dedup commits (M-D2..M-D7, A17's safetyProfile dedup `397c7f9`). Re-capturing snapshot is forbidden by §4.5 (no scoring change, no default flip mid-A21); reviewer (A20) re-captures after the wave settles. `node tools/measure_regression.mjs --baseline main --branch HEAD` reports `0 diffs across 15 fixtures (≡ baseline)` — confirming A21's edits caused zero structural drift.

A21 commits caused zero new failures and zero structural regression. The two pre-existing failures are documented for downstream review.
