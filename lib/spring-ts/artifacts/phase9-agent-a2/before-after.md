# P9-A2 — legacy NameSpring cards prose audit + polish — before/after

> 작성: 2026-05-05
> Owned scope: `src/report/cards/{overview-summary,life-fortune-overview,period-fortune,life-stage-fortune,personality,strengths-weaknesses,name-compatibility}-card.ts` + `src/report/buildFortuneReport.ts` (텍스트 영역만, P7-A3 / Phase 8 cautions 와 비-overlap).
> Forbidden scope: `category-fortune-card.ts` / `category-fortune-subdomain-data.ts` (P7-A3) / `cautions-card.ts` (Phase 8) / scoring 로직 / API 시그니처 / `data/narrative/**` / `src/report/knowledge/**` / `../../namespring/` — 무수정 확인.

## 1. Audit 절차

`artifacts/phase9-agent-a2/audit_baseline.py` 가 22 fixture (`artifacts/sample-outputs-2026-05-05-phase3/`) × 10 legacy section (`overviewSummary`, `lifeFortuneOverview`, `personality`, `strengthsWeaknesses`, `dailyFortune`, `weeklyFortune`, `monthlyFortune`, `yearlyFortune`, `lifeStageFortune`, `nameCompatibility`) prose 전 leaf string 을 추출 (총 8189 문자열) 후 task-flagged 어구를 갯수 카운트.

## 2. 발견 issue + 적용 fix

| # | 영역 | 위반/문제 | 근거 | 적용 fix |
|---|---|---|---|---|
| 1 | period-fortune-card `makeSummary` stars=4 | `~ 도움을 주는 흐름이에요. 계획한 일을 실행에 옮기기 좋은 시기예요.` (`흐름이에요` + `시기예요` 동시 2-monotone) | task 명시 `시기예요`, `결이`, `~할 수 있어요` 단조 | `~ 든든하게 받쳐 줘요. ~ 옮기기에도 잘 어울려요.` (verb-final 분산) |
| 2 | period-fortune-card `makeSummary` stars=5 | `~ 최고로 좋은 흐름이에요. 적극적으로 움직여도 좋아요.` (`흐름이에요`) | task 명시 단조 | `~ 흐름이 가장 단단해요. 적극적으로 움직여도 잘 풀려요.` |
| 3 | period-fortune-card `makeSummary` stars=3 | `~ 보통 수준이에요. 무리하지 않고…` (`이에요` 정형 + 2-clause monotone) | §1 단조 회피 | `~ 보통 수준으로 흘러요. 무리하지 않고…` (verb-final) |
| 4 | period-fortune-card `makeSummary` stars=2 | `~ 다소 주의가 필요해요.` (`주의` 어조 강함) | §1 권장 어구 (`조심` 부드러움) | `~ 다소 조심이 필요해요.` |
| 5 | period-fortune-card `makeGoodActions` daily isYongshinActive=false `reason` | `용신인 X 기운을 채우면 오늘 하루의 결이 잡혀요.` (task 명시 `결이`) | task 명시 + §1 | `오늘 하루의 호흡이 잡혀요.` (P7-A3 패턴 일치) |
| 6 | period-fortune-card `makeGoodActions` monthly grade≥4 | `이번 달은 새로운 습관이나 루틴을 시작하기 좋은 시기예요.` + `꾸준히 이어갈 수 있는 동력이 있어요.` (`시기예요` + `~ㄹ 수 있는 동력`) | §1 단조 회피 | `시작하기에 잘 어울려요.` + `꾸준히 이어갈 동력이 받쳐 줘요.` |
| 7 | period-fortune-card `makeBadActions` adult-track grade≤2 | 4개 period 동일 `~ 큰 계약이나 중요한 결정을 한 번 더 검토하고 진행하는 것이 좋아요.` (19/22 fixtures 반복 + `큰 계약` 단어) | §1 단조 회피 + 어휘 reasonable | period 별 분기 (daily/weekly/monthly/yearly 각 변형); `큰 결정/약속/점검` 단어 다양화. `큰 계약` → 사용 0 (minor invariant 보호 강화) |
| 8 | period-fortune-card `makeBadActions` `reason` | `후회할 가능성을 줄일 수 있어요` (말 늘어짐) | §1 간결 | `후회를 줄일 수 있어요` |
| 9 | period-fortune-card evidence `claim` (3 분기) | `~ 받침이 좋은 시기예요.` / `~ 주의가 필요한 시기예요.` / `~ 흐름을 반영한 평가예요.` | §1 단조 회피 + 평가 어조 | `흐름이 든든하게 받쳐 줘요.` / `한 박자 조심이 필요해요.` / `흐름을 함께 살핀 결과예요.` |
| 10 | life-stage-fortune-card `makeStageSummary` 5 grade 분기 | 모두 `~ 시기는 X 기운이 ~. ~ 시기예요.` 정형 (104 hits 의 절반 이상) | task 명시 단조 + §1 | grade 5/4/3/2/1 각 다른 verb-final 종결 (`잘 어울려요`, `기대돼요`, `흘러요`, `필요해요`, `흘러요`) + `시기는` → `에는` |
| 11 | life-stage-fortune-card `makeStageSummary` grade=5 + startAge≥19 | `적극적으로 도전하고 확장하기 좋은 전성기예요.` (`전성기` minor invariant trigger) | service-visible-output minor 정규식 invariant `/큰 계약\|투자\|보증\|전성기/` | `가장 단단하게 받쳐 줘요. 적극적으로 도전하고 확장하기에도 잘 어울려요.` (defensive — Kim seoyun 의 daewoon 이 미래에 grade=5+startAge≥19 영역에 진입해도 안전) |
| 12 | life-stage-fortune-card `makeHighlights` (220 hits) | 모든 stage 의 첫 highlight `${nature} 기운이 이 시기의 핵심 흐름이에요.` (`흐름이에요` 220x — 22 fixture × 10 stage 평균) | §1 단조 회피 (P7-A3 도 `흐름이에요` 단조 잡았음) | `${nature} 기운이 이 시기를 받쳐 주는 중심축이에요.` (noun ending 변경) |
| 13 | life-stage-fortune-card `makeHighlights` grade≥4 / grade≤2 | `이 시기에는 새로운 시작이나 도전이 잘 풀릴 가능성이 높아요.` / `이 시기에는 안정과 내실 다지기에 집중하는 것이 좋아요.` (`이 시기에는` 중복 + `것이 좋아요` 단정) | §1 단조 + 약한 확신 | `새로운 시작이나 도전이 자연스럽게 풀려 나갈 가능성이 높아요.` / `안정과 내실 다지기에 집중하는 쪽이 잘 맞아요.` |
| 14 | life-stage-fortune-card `makeHighlights` grade≤2 yongshin hobby | `~ 가까이하면 이 시기를 잘 보낼 수 있어요.` | §1 단조 회피 | `~ 가까이하면 한 해를 한결 부드럽게 지나가요.` |
| 15 | life-stage-fortune-card `makeHighlights` low-grade hobby fallback | `~ 활동이 이 시기의 기운과 잘 맞아요.` | §1 단조 회피 | `~ 활동이 이 흐름과 잘 어울려요.` |
| 16 | life-stage-fortune-card `makeHighlights` 빈 fallback | `균형 잡힌 생활 리듬을 유지하는 것이 이 시기의 핵심이에요.` | §1 단조 + 단정 | `균형 잡힌 생활 리듬을 지키는 호흡이 가장 든든한 자산이 돼요.` |
| 17 | life-stage-fortune-card no-daeun fallback | `~ 분석이 어려워요. 기본 ~ 참고해 주세요.` + `~ 정확한 시기별 운세를 볼 수 있어요.` | §1 단조 | `~ 보여 드리기 어려워요.` + `~ 더 또렷하게 보여 드릴 수 있어요.` |
| 18 | life-stage-fortune-card evidence `claim` fallback | `~ 시기는 X 대운에 따라 결이 잡혀요.` (task 명시 `결이`) | task 명시 | `~ 에는 X 대운에 따라 흐름이 잡혀요.` |
| 19 | life-fortune-overview-card `buildSummary` non-hedge yongshin | `${X} 기운을 가까이하면 삶의 결이 한층 부드러워질 수 있어요.` (`결이` + `~수 있어요`) | task 명시 + §1 약한 확신 단조 | `삶의 호흡이 한층 부드러워져요.` |
| 20 | life-fortune-overview-card evidence `weakness` (hedge=true) | `용신 신뢰도가 낮은 편이라 차트에 따라 다른 보조 해석이 더 적합할 수 있어요.` (9 fixtures 반복 — `~할 수 있어요` 23 hits 의 주범) | task 명시 + §1 | `용신 신뢰도가 낮은 편이라 조후·통관 같은 보조 해석을 함께 살펴보면 더 안전해요.` (보조 해석의 구체적 명칭 명시 + 단조 해소) |

## 3. 회귀 비교 (forbidden 어구 카운트)

`artifacts/phase9-agent-a2/before-samples/` (re-generate 직전 baseline) ↔ `after-samples/` (P9-A2 적용 후 22 fixture 새 샘플).

| 패턴 | Before | After | 비고 |
|---|---|---|---|
| `위험` | 0 | 0 | 유지 |
| `결이` | 20 | 0 | task 명시 — fix 완료 |
| `시기예요` | 104 | 0 | task 명시 — fix 완료 |
| `흐름이에요` | 220 | 0 | task 명시 (`결이` 와 같은 목록) — fix 완료 |
| `한 해예요` | 0 | 14 | 분산 결과로 등장. kid-mode (grade=5+startAge<19) 단일 분기에서만 사용 — section 4 분포 참고. P7-A3 가 만든 `흐름이에요` 80x 처럼 새 단조가 되지 않음을 확인. |
| `전성기` | 35 | 0 | task 외 minor-safe invariant 보호 — fix 완료 |
| `큰 계약` | 19 | 0 | task 외 minor-safe invariant 보호 — fix 완료 |
| `투자` | 3 | 3 | `tenGodEncyclopedia.ts` 편재 cautions[0] (out-of-scope `src/report/knowledge/**`) — minor-safe invariant 영향 없음 (`strengthsWeaknesses` 만 노출, 해당 invariant 의 `minorServiceText` 에 미포함) |
| `할 수 있어요` | 23 | 4 | 19 hits 감소. 잔존 4 hits 는 `tenGodEncyclopedia.ts` 의 `남을 챙기느라 내 에너지를 소모할 수 있어요` (out-of-scope) |

## 4. 변경 분포 (section × strings)

| Section | 비교한 leaf strings | 변경된 strings (P9-A2) |
|---|---|---|
| `overviewSummary` | 1210 | 0 |
| `lifeFortuneOverview` | 420 | 20 |
| `personality` | 749 | 0 |
| `strengthsWeaknesses` | 687 | 0 |
| `dailyFortune` | 695 | 69 |
| `weeklyFortune` | 693 | 40 |
| `monthlyFortune` | 648 | 71 |
| `yearlyFortune` | 818 | 51 |
| `lifeStageFortune` | 1316 | 737 |
| `nameCompatibility` | 953 | 0 |
| **전체** | **8189** | **988** |

`overviewSummary` / `personality` / `strengthsWeaknesses` / `nameCompatibility` 는 audit 결과 task-flagged 어구가 이미 부재 — 변경 0 (touch 없음).

## 5. `한 해예요` 14 hits 분포 — 새 단조 여부 검증

14 hits 모두 life-stage-fortune-card `makeStageSummary` grade≥5 + startAge<19 분기 단일 출처. Stage summary (10 hits) + evidence claim duplication (4 hits, current stage = 0 인 minor 사례에서 `focusStage.summary` 가 evidence.claim 으로 복사). Section 별 종결 분포:

| Section | 수 있어요 | 이에요 | 좋아요 | 해요 | 돼요 | 예요 | 한 해예요 | 시기예요 | 흐름이에요 |
|---|---|---|---|---|---|---|---|---|---|
| period+lifeStage+lifeFortune | 312 | 260 | 206 | 174 | 98 | 72 | 14 | 0 | 0 |

`이에요` (260) / `좋아요` (206) / `해요` (174) / `돼요` (98) / `예요` (72) 5종 종결이 우세하고, `한 해예요` 는 14 hits 로 minor 분기에 한정. 이전 `시기예요` 104 + `흐름이에요` 220 = 324 hits 단조에 비해 분산 정도가 양호.

## 6. Service-visible-output invariant 보존 검증

| invariant | 결과 |
|---|---|
| `minor relationship card avoids adult relationship wording` | PASS |
| `minor visible output avoids adult financial and peak-life wording` (`/큰 계약\|투자\|보증\|전성기/`) | PASS — 본 P9-A2 이전엔 latent 위험이었던 `전성기` (life-stage-fortune-card grade=5+startAge≥19) 가 source-side 제거되어 defensive 보호 강화됨 |
| `general visible report avoids organ-specific and medical-adjacent claims` | PASS |
| `unknown-hour report hedges yongshin as a candidate` (must contain literal `'용신 후보'`) | PASS — `overview-summary-card.ts:243` hedge 분기 미수정 (task scope 외) |
| `unknown-hour report marks the hour pillar as provisional` | PASS |
| `category summary and evidence do not conflict on gishin alignment` | PASS |
| service-visible-output 전체 | 13 PASS / 0 FAIL |

## 7. Acceptance test 결과

| Test | After P9-A2 | 비고 |
|---|---|---|
| `npm run typecheck` | 0 error | OK |
| `npm run ci:no-ai-policy` | PASS | OK |
| `npm run test:service-visible-output` | 13 PASS / 0 FAIL | OK |
| `npm run test:overview-pillar-elements` | 2 PASS / 0 FAIL | OK |
| `npm run test:life-stage-display` | 4 PASS / 0 FAIL | OK |
| `npm run test:tengod-report-surface` | 8 PASS / 0 FAIL | OK |
| `npm run test:namespring-compat` | 202 PASS / 0 FAIL | 202/202 invariant 보존 |

## 8. Forbidden scope 무수정 확인

- `data/narrative/**`: 미접근.
- `src/report/knowledge/**` (stemEncyclopedia, tenGodEncyclopedia, gyeokgukEncyclopedia, strengthEncyclopedia): 미접근. 잔존 `투자` 3 hits / `할 수 있어요` 4 hits 는 본 폴더의 `tenGodEncyclopedia.ts` 출처로 task scope 외.
- `src/report/cards/category-fortune-card.ts` / `category-fortune-subdomain-data.ts`: 미수정 (P7-A3 영역).
- `src/report/cards/cautions-card.ts`: 미수정 (Phase 8 영역).
- `../../namespring/`: 미접근.
- API 시그니처 (buildOverviewSummaryCard, buildLifeFortuneOverviewCard, buildPeriodFortuneCard, buildLifeStageFortuneCard, buildPersonalityCard, buildStrengthsWeaknessesCard, buildNameCompatibilityCard): 무변경.
- Scoring/grading (gradeToStars, computeLifeFortuneScore, adjustGradeForBranch, computeCategoryScores, scoreToStars): 무수정.

## 9. Commit 목록

| SHA | 메시지 | LOC |
|---|---|---|
| 348a3ff | feat(card): P9-A2 lifeStageFortune prose polish | +15/-15 |
| 7860a0e | feat(card): P9-A2 periodFortune prose polish | +27/-13 |
| c7b8730 | feat(card): P9-A2 lifeFortuneOverview prose polish | +2/-2 |

총 3 commit, 모두 < 300 LOC, 1 commit = 1 영역 (life-stage / period / life-fortune-overview). 0 source 변경: `overview-summary-card.ts`, `personality-card.ts`, `strengths-weaknesses-card.ts`, `name-compatibility-card.ts`, `buildFortuneReport.ts` (audit 결과 task-flagged 어구 부재 — over-edit 회피).
