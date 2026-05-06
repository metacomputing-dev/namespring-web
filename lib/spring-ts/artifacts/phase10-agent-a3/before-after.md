# P10-A3 — nameCompatibility + dailyFortune voice polish — before/after

> 작성: 2026-05-06
> Owned scope (text-only):
> - `src/report/cards/name-compatibility-card.ts` (full)
> - `src/report/cards/period-fortune-card.ts` (P9-A2 외 영역)
> - `src/report/cards/category-fortune-card.ts` -- `advice[].reason` 영역만
>
> Forbidden scope: `data/narrative/`, scoring 로직, P7-A3 categoryFortunes summary 영역, `cautions-card.ts`, P9-A2 가 손본 영역, `../../namespring/` -- 무수정.

## 1. Audit 절차

`artifacts/phase10-agent-a3/audit.py` 가 22 fixture (`artifacts/phase9-agent-a2/after-samples/` = P9-A2 후 baseline) × 6 owned section (`nameCompatibility`, `dailyFortune`, `weeklyFortune`, `monthlyFortune`, `yearlyFortune`, `categoryFortunes/*/advice/*/reason`) prose 를 수집해 P10-A3 task-flagged 패턴 (단정 어구 / 결혼·의학 단정 / 단조 반복) 카운트.

## 2. 발견 issue + 적용 fix

| # | 영역 | 위반/문제 | task 근거 | 적용 fix |
|---|---|---|---|---|
| 1 | name-compatibility-card `STAR_DESCRIPTIONS` (5개 분기) | 단정형 어구 (`최고 수준의 조화를 이루고 있어요`, `아주 좋은 조화를 보여줘요`) | task 명시 단정 어구 | 강한 단정을 부드럽게 (`조화가 단단하게 잡혀 있어요`, `대체로 부드럽게 어울리는 편이에요` 등) |
| 2 | name-compatibility-card `overallScoreDetail` 80+ | `이름과 사주가 아주 훌륭하게 어울려요` (강한 단정) | task 명시 | `이름과 사주의 합이 단단하게 받쳐 줘요` |
| 3 | name-compatibility-card `overallScoreDetail` 55+ | `이름과 사주가 무난하게 맞아요` (`맞아요` 16x repeat) | task 명시 단조 | `이름과 사주가 무난한 호흡을 이루고 있어요` |
| 4 | name-compatibility-card `sajuCompatibilityDetail` 80+ | `이름의 오행이 사주와 매우 잘 어울려요` (강한 단정) | task 명시 단정 | `이름의 오행이 사주의 흐름과 든든히 맞물려요` |
| 5 | name-compatibility-card `sajuCompatibilityDetail` <40 | `이름의 오행이 사주와 약간 맞지 않는 부분이 있어요` (`맞지 않는 부분`) | §1 어조 부드럽게 | `이름의 오행이 사주와 살짝 어긋나는 부분이 있어요` |
| 6 | name-compatibility-card `nameAnalysisDetail` 80+ | `한글과 한자의 구성이 우수해요` (강한 단정 + `우수해요` 단어) | task 명시 단정 | `한글과 한자의 구성이 단정하게 어울려요` |
| 7 | period-fortune-card `makeWarning` negativeRelations | `response: 중요한 대화나 결정은 한 박자 쉬고 진행하고...` 5 관계 (충/형/해/파/원진) 가 모두 동일 -> 19/20 monotone | task 명시 단조 + `1 unique` (signal·response·reason 모두) | `RELATION_VOICE` 테이블로 5 관계별 signal/response/reason 분리. 결과 daily/weekly response unique 2 -> 6, signal unique 4 -> 6. |
| 8 | period-fortune-card `makeBadActions` Action 3 (deficient) reason | 17/22 fixtures 에서 동일 `평소 약한 오행은 생활 리듬이 흔들릴 때 더 민감하게 드러날 수 있어요.` (period 4종 × 17 = 68 hits 단조) | task 명시 단조 | period × element 별 분기 (`하루 사이에도 컨디션이 흔들리기 쉬워요` / `한 주 동안 쌓인 피로가 더 도드라질 수 있어요` / `한 달 단위 리듬이 무너지면 회복이 더뎌져요` / `한 해 동안의 누적 피로가 더 크게 다가올 수 있어요`) |
| 9 | period-fortune-card `makeGoodActions` daily isYongshinActive reason | `용신 기운이 활성화된 날이라 하는 일마다 순조로울 확률이 높아요.` (`확률이 높아요` 단정) | task 명시 단정 (`확률이 높아요`) | `용신 기운이 활성화된 날이라 평소보다 일이 술술 풀리기 쉬워요.` |
| 10 | period-fortune-card `makeGoodActions` weekly grade≥4 secondary reason | `생활 공간에 용신의 색을 두면 지속적으로 좋은 기운을 받을 수 있어요.` (20x identical) | task 명시 단조 | element 변수화 (`눈이 자주 닿는 공간에 ${yongshinKo} 색을 두면 한 주 내내 기운이 잔잔히 따라와요.`) |
| 11 | period-fortune-card `makeGoodActions` monthly grade<4 secondary reason | `한 달간 꾸준히 용신 기운에 노출되면 자연스럽게 좋은 흐름이 만들어져요.` (20x identical) | task 명시 단조 | element 변수화 (`한 달 내내 ${yongshinKo} 색과 방위를 가까이 두면 그 기운이 차곡차곡 쌓여요.`) |
| 12 | period-fortune-card `makeGoodActions` yearly secondary reason | `연간 전략으로 용신의 색과 방위를 활용하면 장기적인 좋은 기운을 끌어올 수 있어요.` (20x identical) | task 명시 단조 | element 변수화 (`한 해를 ${yongshinKo} 색과 방위로 일관되게 두면 그 기운이 자연스럽게 일상에 스며들어요.`) |
| 13 | period-fortune-card daily `makeGoodActions` secondary reasons | `오늘 하루의 결이` 와 `자연스럽게 좋은 기운을 끌어올 수 있어요`, `생활 리듬을 차분히 챙기는 데 도움이 돼요` 가 단조로움 | §1 단조 회피 | `결` 회피 + verb-final 분산 (`그날의 흐름이 부드럽게 풀려요`, `그날의 컨디션을 차분히 받쳐 줘요`) |
| 14 | category-fortune-card `makeWealthAdvice` stars≥4 non-minor reason | `재성 기운이 잘 흐르고 있어서 재물 관련 행동이 좋은 결과로 이어지기 쉬워요.` (단정) | task 명시 단정 (재물 단정) | 어조 humble (`재성 기운이 받쳐 주는 시기에는 재무 판단을 차분히 굴려 보기도 자연스럽게 풀려요.`) |
| 15 | category-fortune-card `makeWealthAdvice` stars≥4 color reason | `재성 오행(X)의 색을 활용하면 기운이 자연스럽게 강화돼요.` (단정) | §1 단정 | humble framing (`눈에 자주 닿는 곳에 재성 오행(X)의 색을 두면 그 기운을 일상에 가까이 두게 돼요.`) |
| 16 | category-fortune-card `makeWealthAdvice` stars<4 reasons | `재물 기운이 약할 때 아끼는 습관이 나중에 큰 도움이 돼요.` (14x repeat) | §1 단조 | (`재물 기운이 약한 시기에는 절제 습관 하나가 다음 해의 여유로 이어지기 쉬워요.`) |
| 17 | category-fortune-card `makeHealthAdvice` stars≥4 reason | `인성 기운이 잘 흐르면 생활 리듬을 지키는 힘이 자연스럽게 좋아져요.` (의학 단정 + 11x repeat) | task 명시 의학 단정 + 단조 | humble framing (`인성 기운이 잘 흐르는 시기에는 평소의 생활 루틴을 유지하기가 한결 수월하게 느껴져요.`) |
| 18 | category-fortune-card `makeHealthAdvice` deficient reason | `부족한 X 기운을 일상에서 보완하면 컨디션 관리가 더 쉬워져요.` (의학 단정) | task 명시 의학 단정 | humble (`평소 약한 X 기운을 일상에서 챙기면 컨디션 관리가 한결 수월해져요.`) |
| 19 | category-fortune-card `makeRomanceAdvice` stars≥4 non-minor reason | `재성/관성 기운이 잘 흘러 대인 매력과 인연운이 높아져 있어요.` (12x repeat + 결혼 단정 `대인 매력`, `인연운이 높아져`) | task 명시 결혼 단정 + 단조 | humble (`재성·관성 기운이 받쳐 주는 시기에는 사람과 닿는 자리가 부드럽게 풀려 가기 쉬워요.`) |
| 20 | category-fortune-card `makeRomanceAdvice` stars≥4 non-minor color reason | `인연과 관련된 오행(X)의 색을 활용하면 매력이 자연스럽게 올라가요.` (11x repeat + 결혼 단정 `매력이 자연스럽게 올라가요`) | task 명시 결혼 단정 + 단조 | humble (`인연과 닿아 있는 오행(X)의 색을 곁들이면 자연스러운 인상을 더하기 쉬워요.`) |
| 21 | category-fortune-card `makeRomanceAdvice` stars<4 non-minor reason | `연애 기운이 약한 시기에 무리하면 오히려 관계가 꼬이기 쉬워요.` (`연애` 단어) | §1 + minor invariant 보호 (`연애` 어조 회피) | (`관계 기운이 약한 시기에는 호흡을 서두르면 자잘한 어긋남이 쌓이기 쉬워요.`) |
| 22 | category-fortune-card `makeAcademicAdvice` stars<4 reason 1 | `학업 기운이 약할 때는 욕심보다 기초 다지기가 더 효율적이에요.` (19x repeat) | §1 단조 | (`학업 기운이 약한 시기에는 무리한 진도보다 기초를 다지는 쪽이 더 단단히 남아요.`) |
| 23 | category-fortune-card `makeFamilyAdvice` reasons | family reasons 4 종이 16/16/4/4 분포 (단정 어조 `가까운 사이에서 마찰이 생기기 쉬워요`) | §1 단정 회피 | (`가까운 사이일수록 사소한 일에도 신경이 곤두서기 쉬워요.`) |

23 issues 식별, 23 fix 적용.

## 3. 회귀 비교 (forbidden 어구 카운트)

`artifacts/phase9-agent-a2/after-samples/` (= P10-A3 직전 baseline, byte-equivalent 의 중복 복사 회피) ↔ `artifacts/phase10-agent-a3/after-samples/` (P10-A3 적용 후 22 fixture).

| 패턴 | Before (P9-A2) | After (P10-A3) | 비고 |
|---|---|---|---|
| `시기예요` | 0 | 0 | P9-A2 가 0 으로 만든 invariant 유지 |
| `흐름이에요` | 0 | 0 | P9-A2 invariant 유지 |
| `결이` | 0 | 0 | P9-A2 invariant 유지 (도입 직후 회피 처리) |
| `한 해예요` | 14 | 14 | minor 분기 단일 출처, life-stage P9-A2 영역, 본 task scope 외 |
| `합니다` / `습니다` / `됩니다` / `입니다` | 0 | 0 | task §1 단정 어구 -- 부재 유지 |
| `면역력` / `장기는` / `검진` | 0 | 0 | task §3 의학 단정 -- service-visible-output invariant 유지 |
| `대인 매력` | 12 | 0 | task §3 결혼 단정 -- fix 완료 |
| `인연운이 높아져` | 12 | 0 | task §3 결혼 단정 -- fix 완료 |
| `매력이 자연스럽게 올라` | 12 | 0 | task §3 결혼 단정 -- fix 완료 |
| `확률이 높아요` | 1 | 0 | task §1 단정 -- fix 완료 |
| `우수해요` | 1 | 0 | task §1 단정 -- fix 완료 |
| `잘 흐르고 있어서` | 5 | 0 | task §1 단정 -- fix 완료 |
| `지키는 힘` | 11 | 0 | task §3 의학 단정 + 단조 -- fix 완료 |
| `자연스럽게 좋아져요` | 11 | 0 | task §3 의학 단정 -- fix 완료 |

## 4. 분포 개선 — 단조 회피

| Section | 메트릭 | Before | After | 개선 |
|---|---|---|---|---|
| dailyFortune `makeWarning/response` | unique strings | 2 | 6 | 5 RELATION_VOICE 분기 도입 |
| dailyFortune `makeWarning/signal` | unique | 4 | 6 | 5 RELATION_VOICE 분기 |
| dailyFortune `makeWarning/reason` | unique | 4 | 6 | 5 RELATION_VOICE 분기 |
| dailyFortune `makeBadActions` reason | unique | 8 | 12 | period × element 분기 |
| weeklyFortune `makeBadActions` reason | unique | 6 | 10 | period × element 분기 |
| monthlyFortune `makeBadActions` reason | unique | 7 | 11 | period × element 분기 |
| yearlyFortune `makeBadActions` reason | unique | 8 | 12 | period × element 분기 |
| weeklyFortune `makeGoodActions` reason | unique | 11 | 15 | element 변수화 |

## 5. Service-visible-output invariant 보존

| invariant | 결과 |
|---|---|
| `minor relationship card avoids adult relationship wording` | PASS |
| `minor visible output avoids adult financial and peak-life wording` | PASS |
| `general visible report avoids organ-specific and medical-adjacent claims` | PASS |
| `unknown-hour report hedges yongshin as a candidate` | PASS |
| `category summary and evidence do not conflict on gishin alignment` | PASS |
| service-visible-output 전체 | 13 PASS / 0 FAIL |

## 6. Acceptance test 결과

| Test | After P10-A3 | 비고 |
|---|---|---|
| `npm run typecheck` | 0 error | OK |
| `npm run ci:no-ai-policy` | PASS | OK |
| `npm run test:service-visible-output` | 13 PASS / 0 FAIL | OK |
| `npm run test:namespring-compat` | 202 PASS / 0 FAIL | 202/202 invariant 보존 |

## 7. Forbidden scope 무수정 확인

- `data/narrative/**`: 미접근.
- `src/report/knowledge/**`: 미접근.
- `src/report/cards/cautions-card.ts` (Phase 8): 미수정.
- `src/report/cards/category-fortune-card.ts` summary / caution / evidence: 미수정 (P7-A3 영역, advice.reason 만 수정).
- `src/report/cards/category-fortune-subdomain-data.ts` (P7-A3): 미수정.
- `src/report/cards/life-stage-fortune-card.ts` / `life-fortune-overview-card.ts` / `overview-summary-card.ts` (P9-A2 영역): 미수정.
- `../../namespring/`: 미접근.
- API 시그니처 (buildNameCompatibilityCard, buildPeriodFortuneCard, buildCategoryFortuneCards): 무변경.
- Scoring 로직 (scoreToStars, gradeToStars, computeCategoryGrade, computePillarForPeriod, computeCategoryScores): 무수정.

## 8. Commit shape

Task 명시 단일 commit (`feat(card): P10-A3 nameCompat + dailyFortune voice`). 3 files 수정 (~137 LOC) 으로 ≤300 LOC budget 내.
