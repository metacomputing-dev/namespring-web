# P7-A3 — categoryFortunes prose audit + polish — before/after

> 작성: 2026-05-05
> Owned scope: `src/report/cards/category-fortune-card.ts` + `src/report/cards/category-fortune-subdomain-data.ts` (텍스트 영역만).
> Forbidden scope: scoring 로직 / API 시그니처 / data/narrative/** / ../../namespring/ — 무수정 확인.

## 1. Audit 절차

22 fixture × 5 categories × {summary, advice[], caution} prose 단위 + sub-domain narrative + evidence claim 직접 read.

소스 템플릿 분기 단위 (stars 1~5, isMinor, isGishinAligned, sameElement) 의 unique 문자열 약 60건 추출 후 issue 분류.

## 2. 발견 issue + 적용 fix

| # | 영역 | 위반/문제 | NARRATIVE_STYLE_GUIDE 근거 | 적용 fix |
|---|---|---|---|---|
| 1 | wealth caution.reason | `재물 손실 위험이 있어요` (`위험` 금기어) | §1 불안 자극 어휘 (큰일/위험/불행) 금지 | `큰 지출이 부담으로 돌아오기 쉬워요` |
| 2 | wealth(minor) caution.reason | `흔들리기 쉬운 시기예요` (`시기예요` 5/5 반복) | §6 카테고리 voice + 단조 회피 | `평소보다 느슨해지기 쉬워요` |
| 3 | makeCategorySummary stars=2 5 카테고리 동일 | `무리한 확장보다 안정적인 관리에 집중하세요` (health/family 에 `확장` voice 부적합) | §6 카테고리 voice — health=컨디션 / romance=거리감 / family=일상 | 카테고리별 LOW_BODY 분기 (wealth=운영, health=컨디션, academic=페이스, romance=거리감, family=일상) |
| 4 | makeCategorySummary stars=3 5 카테고리 동일 | `큰 변화보다는 기본을 지키며 꾸준히 관리하면 좋아요` 정형 반복 | §1 단조 회피 + §6 voice | 카테고리별 MID_BODY 분기 |
| 5 | makeCategorySummary stars=1 | `쉽지 않은 시기예요. 무리하지 말고 기본을 잘 지키며 꾸준히 관리하는 것이 중요해요` (`중요해요` 단정조) | §1 약한 확신 / 종결어 부드러움 | `부담이 큰 흐름이에요` + 카테고리별 HARD_BODY |
| 6 | makeCategorySummary stars=5 | `최고예요!` 감탄형 단정 | §1 단정 회피 / 약한 확신 (`~인 편이에요` 권장) | `흐름이 아주 좋아요` |
| 7 | GOOD_SUFFIX.romance | `인연의 결이 부드러워져요` (task 명시 `결이` 반복) | task 명시 + §6 카테고리 voice | `인연의 호흡이 부드러워져요` |
| 8 | GOOD_SUFFIX.academic | `학습 효율이 올라가는 시기예요` (`시기예요` 종결 반복) | §1 단조 회피 | `학습 효율이 올라가는 한 해예요` |
| 9 | makeCaution.signal 5/5 | `~기 쉬운 시기예요` 5 카테고리 모두 동일 종결 | §1 단조 회피 + §6 voice | wealth=`살짝 어긋나 있어요`, health=`신경을 써야 하는 흐름이에요`, academic=`평소보다 흩어지기 쉬워요`, romance=`작은 오해와 감정 소모가 생기기 쉬워요`, family=`살짝 늘어나는 흐름이에요` |
| 10 | makeCaution.response (health) | `~챙겨주세요` 띄어쓰기 | §1 권장 어구 | `~챙겨 주세요` (정상 띄어쓰기) |
| 11 | makeCaution.reason (health) | `생활 리듬이 쉽게 흔들릴 수 있어요` (`흔들리다` 반복) | §1 단조 회피 | `회복하는 데 평소보다 시간이 걸려요` |
| 12 | makeCaution.reason (romance) | `인연의 타이밍이 맞지 않을 수 있어요` (`~수 있어요` 단정 약화 부족) | §1 약한 확신 | `타이밍이 어긋나기 쉬워요` |
| 13 | makeCaution.reason (family) | `갈등이 커질 수 있어요` (`커질` 의 부정 어조) | §1 불안 자극 어휘 회피 | `사소한 일에 부딪히기 쉬워요` |
| 14 | evidence.claim isYongshinAligned | `~ 영역의 핵심 오행 X가 용신과 일치하여 받침이 좋은 영역이에요` (`영역` 두 번 + 평가 어조) | §1 평가어 완화 + 중복 제거 | `~의 핵심 오행 X가 용신과 일치해 든든히 받쳐 주는 흐름이에요` |
| 15 | evidence.claim 기본분기 | `~ 영역은 X 기운을 중심으로 평가했어요` (`평가했어요` 평가 어조) | §1 호칭/평가어 완화 | `~은 X 기운을 중심에 두고 살펴봤어요` |
| 16 | SUB_DOMAIN_NARRATIVES `~ 시기예요` 종결 7/30 | wealth.high/romance.high/family.high/career.high/expression_children.high/health_stress.high/academic.mid 동일 종결 | §1 단조 회피 + §6 voice | `흐름이에요`/`한 해예요`/`풀려요`/`이어 가요`/`받쳐 줘요` 등 다양화 |
| 17 | SUB_DOMAIN_NARRATIVES romance.high | `인연의 결이 부드러워지고` (task 명시 `결이` 반복) | task 명시 | `인연의 호흡이 부드러워지고` |
| 18 | SUB_DOMAIN_NARRATIVES health.low | `혼자 버티지 말고 필요한 도움을 받으세요` (부담 어조) | §6 health voice = 따뜻함 | `일찍 도움을 청하세요` (간결 + 따뜻) |
| 19 | SUB_DOMAIN_NARRATIVES `~ 영역은 ~ 것이 좋아요` 단정형 (wealth/family/health) | `것이 좋아요` 단정 | §1 약한 확신 (`~ 편이에요`) | `~ 편이 좋아요` |
| 20 | makeCategorySummary stars=3 / stars=1 종결조 단조 | iter1 후 `흐름이에요` 80건 (5 카테고리 동시 등장) → 새 단조 | §1 단조 회피 | stars=3 `평이한 흐름이에요` → `큰 굴곡 없는 한 해예요`, stars=1 `부담이 큰 흐름이에요` → `부담이 큰 한 해예요`, stars=2 `다소 조심이 필요한 흐름이에요` → `살짝 조심이 필요해요` (분산) |
| 21 | makeCaution.signal (health) `~흐름이에요` | `흐름이에요` 다른 곳에 또 사용 | §1 단조 회피 | `평소보다 신경을 조금 더 써야 해요` |
| 22 | makeCaution.signal (family) `~흐름이에요` | 동일 | §1 단조 회피 | `살짝 늘어날 수 있어요` |
| 23 | SUB_DOMAIN_NARRATIVES.health_stress.high `~좋은 흐름이에요` | 동일 | §1 단조 회피 | `자연스럽게 회복돼요` |
| 24 | makeHealthAdvice (stars≥4) `~좋아지는 시기예요` (advice.reason) | 위 변경의 단조 다양화 후 다시 잡힌 `시기예요` | §1 단조 회피 | `자연스럽게 좋아져요` |
| 25 | makeFamilyAdvice (stars≥4) `~잘 되는 시기예요. 함께~` (advice.text) | 동일 | §1 단조 회피 | `~잘 풀리는 한 해예요. 함께~` |
| 26 | makeWealthAdvice (stars≥4 minor) `~만들기 좋은 시기예요` | 동일 | §1 단조 회피 | `~만들기 좋아요` |
| 27 | makeWealthAdvice (stars≥4 non-minor) `~검토해 보기 좋은 시기예요` | 동일 | §1 단조 회피 | `~검토해 보기 좋은 흐름이에요` |
| 28 | makeAcademicAdvice (stars≥4) `학습 효율이 높은 시기예요` | 동일 | §1 단조 회피 | `학습 효율이 잘 올라가는 한 해예요` |
| 29 | makeRomanceAdvice (stars≥4 minor) `~만들기 쉬운 시기예요` | 동일 | §1 단조 회피 | `~만들기 쉬워요` |
| 30 | makeRomanceAdvice (stars≥4 non-minor) `~들어오기 좋은 시기예요. 모임에~` | 동일 | §1 단조 회피 | `~들어오기 좋은 흐름이에요. 모임에~` |

## 3. Service-visible-output invariant 보존 검증

`test/integration/service-visible-output.test.ts` line 194:
```ts
check('category summary and evidence do not conflict on gishin alignment',
  !(romanceSummary.includes('좋은 편이에요') && romanceEvidence.includes('보수적 운영')),
  ...);
```

- `'좋은 편이에요'` 표현: `makeCategorySummary` stars≥4 분기 (gishin-aligned 분기는 별도 `'좋은 흐름도 있으나 속도 조절이 필요해요'`) 그대로 보존.
- `'보수적 운영'` 표현: evidence.claim isGishinAligned + stars<4 분기에만 사용 (보존). stars≥4 + isGishinAligned 분기는 `'속도 조절이 중요해요'` 그대로 (보수적 운영 미포함).
- 즉 **stars≥4 + isGishinAligned 분기에 `'보수적 운영'` introduce 없음** — invariant 안전.

`'재물 손실 위험'` 등 forbidden 어구는 더 이상 발생하지 않음.

## 4. Fixture 비교 (20 fixtures × categoryFortunes 구조)

Pre-edit baseline regen → 우리 변경 적용 후 regen 후 비교 (`before-categoryFortunes.json`/`after-categoryFortunes.json`).

| 측정 | 결과 |
|---|---|
| 비교한 text 필드 (summary/signal/response/reason/claim/narrative/text/weakness) | 920 |
| 변경 발생 필드 | 300+ (iter1) → 추가 polish iter2 후 더 다양화 |
| Unique change pattern | 15 (iter1) → diversification 추가 패턴 |
| 새로 도입된 violation/forbidden 어구 | 0 |

종결조 분포 (전체 categoryFortunes payload 의 `JSON.stringify` 위에서 단순 substring count):

| 어구 | before | after iter1 | after iter2 (final) |
|---|---|---|---|
| `위험` (forbidden) | 20 | 0 | 0 |
| `결이` (task 명시) | 0 | 0 | 0 |
| `최고예요` (단정) | 0 | 0 | 0 |
| `시기예요` (반복) | 100 | 40 | 0 |
| `흐름이에요` (iter1 새 단조) | 0 | 80 | 0 |
| `한 해예요` (분산용) | 0 | 0 | 40 |

iter1 의 `흐름이에요` 80건 새 단조를 iter2 에서 다시 분산하여 종결조가 카테고리당 다양해지도록 하였음. 최종적으로 forbidden 어구 / 명시 단조 어구 모두 0.

iter1 + iter2 unique change pattern 모두 위 issue 표 의 fix 결과 — 의도된 변경이며, 의미 보존 (격국·용신 정보 / 카테고리 voice / 강도 hedge 등 모두 일관).

(stars 4·5·1 분기는 22 fixture 의 distribution 상 노출되지 않아 이번 fixture diff 에는 잡히지 않음. source 차원에서 모두 변경됨.)

## 5. Acceptance test 결과 (worktree baseline 기준 fail 갯수 무증가)

워크트리 HEAD = 5ea230e (Phase 6 audit fixes). 메인 checkout 에 unstaged 된 P7-A1
의 `overview-summary-card.ts` (`roEuro` helper / counterexample 어조 변경) 가
워크트리에 미반영 — 그래서 워크트리 baseline 에서는 일부 test 가 baseline 으로 FAIL.
우리 영역 외 (텍스트만 변경하므로 영향 없음).

| Test | Baseline | After P7-A3 | 비고 |
|---|---|---|---|
| typecheck | 0 error | 0 error | OK |
| ci:no-ai-policy | PASS | PASS | OK |
| test:service-visible-output | 7 PASS / 6 FAIL | 7 PASS / 6 FAIL | 6 FAIL 은 워크트리 baseline (메인 checkout 의 P7-A1 unstaged 변경 미반영 — 우리 영역 외) |
| test:tengod-report-surface | 1 PASS / 7 FAIL | 1 PASS / 7 FAIL | 워크트리 baseline issue |
| test:overview-pillar-elements | 2 PASS / 0 FAIL | 2 PASS / 0 FAIL | OK |
| test:namespring-compat | 182 PASS / 1 FAIL | 182 PASS / 1 FAIL | 1 FAIL 은 baseline issue (overview pillar) |
| test:snapshot (stored snapshot 비교) | 0/15 PASS (stored snapshot stale, Phase 6 변경 미캡쳐) | 동일 | numeric 변경 0. acceptance "default 변경 없음" 은 stored snapshot 갱신 여부와 무관하게 우리 변경의 numeric 영향 0 임을 확인. |
| measure_regression (main vs HEAD) | 0 diffs PASS | 0 diffs PASS | 우리 텍스트 변경이 numeric/categorical 결과에 영향 없음 직접 확인 |

**우리 변경으로 새 fail 도입 0건 — 모든 fail 은 워크트리 baseline 기존 상태.**

## 6. Forbidden scope 무수정 확인

- `data/narrative/**`: 미접근.
- `_glossary/`, `_metaphor/`, `_modifier_*/`, `_seed/`, `_coverage/`: 미접근.
- `../../namespring/`: 미접근.
- API 시그니처: `buildCategoryFortuneCards`, `SUB_DOMAIN_NARRATIVES`, `getExtendedCategoryElements`, `computeCategoryGrade` 등 — 시그니처 무변경.
- Scoring/gate 로직 (`computeCategoryGrade`, `gradeToStars`, `computeSubDomainGrade`, `shouldSurfaceConditional`, `extractSubDomainGate`): 무수정.

## 7. Commit 목록

| SHA | 메시지 (요약) | 비고 |
|---|---|---|
| 70f377b | feat(card): P7-A3 categoryFortunes prose polish | iter1 — issue 1~19 (소스 변경 110 LOC) |
| 971b960 | artifacts(phase7-a3): regenerate samples + record categoryFortunes before/after | iter1 fixture regen + before/after.md + before/after JSON snapshot |
| (이후) | feat(card)+artifacts: P7-A3 prose iter2 — diversify ending after `흐름이에요` 80x audit | iter2 — issue 20~30 (`흐름이에요` 새 단조 발견 후 분산) |

총 2 file (텍스트만 변경): `category-fortune-card.ts` + `category-fortune-subdomain-data.ts`.
모든 commit < 300 LOC, 1 commit = 1 intent (소스 prose polish / fixture regen 으로 분리).
`data/narrative/**`, `_glossary/`, `_metaphor/`, `_modifier_*/`, `_seed/`, `../../namespring/` 무수정.
