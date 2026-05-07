# P17-A4 — categoryFortunes advice.text voice polish — before/after

> 작성: 2026-05-07
> Owned scope (text-only):
> - `src/report/cards/category-fortune-card.ts` -- categoryFortunes `advice[].text` 영역만
> - `src/report/cards/category-fortune-subdomain-data.ts` -- `SUB_DOMAIN_NARRATIVES` (subDomains[].narrative — 사용자 가시 영역)
>
> Forbidden scope: `advice[].reason` (P10-A3), `summary` (P7-A3), `caution` (P10-A3, Phase 8), scoring/gating 로직, API 시그니처, `data/narrative/`, `../../namespring/` -- 무수정.

## 1. Audit 절차

`artifacts/phase17-agent-a4/audit.py` 가 22 fixture (`artifacts/phase10-agent-a3/after-samples/` = P10-A3 후 직전 baseline) × 5 base categories 의 `categoryFortunes/<cat>/advice/<i>/text` + `categoryFortunes/<cat>/subDomains/<j>/narrative` (subdomain-data 가 surface 하는 narrative) 를 수집해 P17-A4 task-flagged 패턴 카운트.

Total advice.text + subDomain narrative captured: 353 (22 fixture × 평균 16 strings).

## 2. 발견 issue + 적용 fix

| # | 영역 | 위반/문제 | task 근거 | 적용 fix |
|---|---|---|---|---|
| 1 | category-fortune-card `makeWealthAdvice` stars≥4 non-minor (line 347) | `'새로운 투자나 사업 기회를 검토해 보기 좋은 흐름이에요.'` (`흐름이에요` 단조 종결) | task §1 단조 (`흐름이에요`) | `'새로운 투자나 사업 기회를 차분히 검토해 두기 좋아요.'` (verb-final `~기 좋아요`) |
| 2 | category-fortune-card `makeRomanceAdvice` stars≥4 non-minor (line 473) | `'새로운 만남이나 인연이 자연스럽게 들어오기 좋은 흐름이에요. 모임에 적극 참여해 보세요.'` (`흐름이에요` 종결 + `만남이나 인연` 중복 어휘) | task §1 단조 + 카테고리 voice | `'새로운 인연이 자연스럽게 닿아 오기 쉬워요. 모임에 가볍게 발을 들여 보세요.'` (verb-final `~기 쉬워요`, `만남` 중복 회피, 명령형 부드럽게) |
| 3 | category-fortune-card `makeRomanceAdvice` stars≥4 non-minor color (line 477) | `'${color} 계열의 옷이나 액세서리가 만남 운을 도와줄 수 있어요.'` (`만남 운` 마케팅성 복합어 — romance category-voice 위반) | task §1 카테고리 voice (style guide §6 romance: 결혼 단정 X, 마케팅성 어휘 회피) | `'${color} 계열의 옷이나 액세서리가 인연의 호흡을 한층 가다듬어 줘요.'` (`만남 운` → `인연의 호흡`, P10-A3 와 동일한 humble framing) |
| 4 | category-fortune-subdomain-data `SUB_DOMAIN_NARRATIVES.academic.mid` | `'학업은 평이한 흐름이에요. 정기 점검과 복습 위주의 운영이 좋아요.'` (`흐름이에요` 종결) | task §1 단조 (`흐름이에요`) | `'학업은 평이한 페이스로 이어져요. 정기 점검과 복습 위주의 운영이 좋아요.'` (academic voice = 페이스, P7-A3 카테고리 voice 일관) |
| 5 | category-fortune-subdomain-data `SUB_DOMAIN_NARRATIVES.romance.high` | `'인연의 호흡이 부드러워지고 감정 표현이 자연스럽게 나오는 흐름이에요.'` (`흐름이에요` 종결) | task §1 단조 (`흐름이에요`) | `'인연의 호흡이 부드러워지고 감정 표현이 자연스럽게 풀려 나와요.'` (verb-final `~나와요`) |

추가: `category-fortune-subdomain-data.ts` 도입 코멘트 (line 50) `시기예요 종결 반복 회피` → `시기예요·흐름이에요 종결 반복 회피 (P17-A4)` 한 줄 보강 (코드 변화 없음, 의도 기록).

5 issues 식별, 5 string fix 적용 (≤300 LOC budget 내 — 약 6 LOC 변화).

### 종결어 분포 (`흐름이에요` 4 fix 의 verb-final 다양화)

advisor §"Don't replace all 4 흐름이에요 with the same new ending" 권고 반영.

| 위치 | 전 | 후 verb-final |
|---|---|---|
| wealth stars≥4 non-minor | `~좋은 흐름이에요` | `~두기 좋아요` |
| romance stars≥4 non-minor | `~좋은 흐름이에요` | `~닿아 오기 쉬워요` |
| academic.mid (subdomain) | `~평이한 흐름이에요` | `~페이스로 이어져요` |
| romance.high (subdomain) | `~나오는 흐름이에요` | `~풀려 나와요` |

4 종결 모두 unique — `흐름이에요` 단조를 다른 동일 종결로 옮기지 않음.

## 3. 회귀 비교 (forbidden 어구 카운트)

`artifacts/phase10-agent-a3/after-samples/` (= P17-A4 직전 baseline) ↔ `artifacts/phase17-agent-a4/after-samples/` (P17-A4 적용 후 22 fixture).

대상: `categoryFortunes/<cat>/advice/<i>/text` + `categoryFortunes/<cat>/subDomains/<j>/narrative` 만.

| 패턴 | Before (P10-A3) | After (P17-A4) | 비고 |
|---|---|---|---|
| `흐름이에요` | 17 | 0 | 4 string fix 로 직접 제거 |
| `만남 운` | 12 | 0 | romance color text 1 source → 0 |
| `시기예요` | 0 | 0 | 부재 유지 (도입한 새 문구도 회피) |
| `결이` | 0 | 0 | 부재 유지 |
| `합니다` / `습니다` / `됩니다` / `입니다` / `한다` | 0 | 0 | task §1 단정 어구 -- 부재 유지 |
| `결혼` 단정 / `면역력` / `진단` / `검진` / `대인 매력` / `인연운이 높아` | 0 | 0 | 카테고리 voice 단정 -- 부재 유지 |

forbidden 어구 -- before total 29 → after total 0.

## 4. Repetition (top 25 monotone strings) 변동 — out-of-scope 보존 확인

advisor 권고 (§"high-count strings ... were left as-is by P10-A3 precedent. Don't touch them"):

| Before P10-A3 monotone string | After P17-A4 |
|---|---|
| 29x `표현·전달 영역은 단어 선택을 신중히 하고...` (subdomain expression_children low) | 29x 그대로 (out-of-scope subdomain narrative, 비-위반 패턴) |
| 19x `기본기 복습에 집중하고...` (academic stars<4) | 19x 그대로 (P10-A3 가 reason 만 손봄 — 본 task scope 외 단조) |
| 19x `혼자 끙끙대기보다...` (academic stars<4) | 19x 그대로 (동) |
| 16x `역마 + 편재 흐름이 활발해...` (subdomain movement high) | 16x 그대로 (동) |
| 16x `가족과 의견 차이가 생길 수 있어요...` (family stars<4) | 16x 그대로 (동) |
| 14x `불필요한 지출을 줄이고...` (wealth stars<4) | 14x 그대로 (동) |
| 13x `큰 지출이나 투자는 신중하게...` (wealth stars<4 non-minor) | 13x 그대로 (동) |

5 fix 사이트만 변경 (line-level 표 §2 참조), 그 외 string 들은 수정 가능했더라도 task scope 명시 (`흐름이에요`, `만남 운`, 단정 어구) 외라 보존 — gold-plating 회피.

새로 변경된 string 의 분포 (전 & 후 동일 카운트, 내용만 갱신):

| String | Count | 비고 |
|---|---|---|
| `새로운 인연이 자연스럽게 닿아 오기 쉬워요...` | 12 | 전 `새로운 만남이나 인연이...흐름이에요` 12x 와 동일 카운트 (구조적 출처 불변) |
| `빨간색 계열의 옷이나 액세서리가 인연의 호흡을 한층 가다듬어 줘요.` | 8 | 전 `...만남 운을 도와줄 수 있어요.` 8x 와 동일 카운트 |
| 기타 `${color} 계열의 옷이나 액세서리가 인연의 호흡을...` (기타 색상 변형) | 4 | wealthEl 변수에 따라 분산 |

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

| Test | After P17-A4 | 비고 |
|---|---|---|
| `npm run typecheck` | 0 error | OK |
| `npm run ci:no-ai-policy` | PASS | OK |
| `npm run test:service-visible-output` | 13 PASS / 0 FAIL | OK |
| `npm run test:tengod-report-surface` | 8 PASS / 0 FAIL | OK |
| `npm run test:namespring-compat` | 202 PASS / 0 FAIL | 202/202 invariant 보존 |
| `npm run test:snapshot` | 15 PASS / 0 FAIL | 15/15 baseline regression |

## 7. Forbidden scope 무수정 확인

- `data/narrative/**`: 미접근.
- `src/report/knowledge/**`: 미접근.
- `src/report/cards/cautions-card.ts` (Phase 8): 미수정.
- `src/report/cards/category-fortune-card.ts` `summary` / `caution` / `evidence` / `advice[].reason`: 미수정 (P7-A3 / P10-A3 / Phase 8 영역).
- `src/report/cards/category-fortune-subdomain-data.ts` 의 `SUB_DOMAIN_TITLE` / `SUB_DOMAIN_PLAN` / `getExtendedCategoryElements` / `shouldSurfaceConditional` / `computeSubDomainGrade`: 미수정 (gating + scoring 로직).
- `src/report/cards/life-stage-fortune-card.ts` / `life-fortune-overview-card.ts` / `overview-summary-card.ts` / `name-compatibility-card.ts` / `period-fortune-card.ts`: 미수정.
- `../../namespring/`: 미접근.
- API 시그니처 (`buildCategoryFortuneCards`, `getExtendedCategoryElements`, `computeSubDomainGrade`, `shouldSurfaceConditional`, `gradeBucket`): 무변경.
- Scoring/gating 로직 (`gradeToStars`, `computeCategoryGrade`, `CONDITIONAL_THRESHOLD`): 무수정.

## 8. Commit shape

Task 명시 단일 commit (`feat(card): P17-A4 advice.text voice polish`). 2 files 수정 (5 string fix + 1 코멘트 = ≈6 LOC 변화) — ≤300 LOC budget 의 약 2% 사용.
