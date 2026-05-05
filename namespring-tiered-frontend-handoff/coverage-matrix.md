# Coverage Matrix — period × category × depth

이 문서는 `lib/spring-ts/data/narrative/**` 의 fragment / glossary / gating axis 분포를 요약한다. 측정은 `npm run narrative:coverage` 와 `npm run narrative:axis-pairs` 결과와 `data/narrative/` 트리 스캔 으로 한다.

마지막 측정: 2026-05-05 (Phase 3 Wave 4 완료).

## 1. 한눈에 (전체)

| 항목 | 값 | 설명 |
|---|---:|---|
| Bundles | 345 | `*.fragments.json` 파일 수 (cell × bundle). |
| Fragments | 4,066 | 전체 narrative fragment. AI-derived (T1_HYPOTHESIS) 4,066 + placeholder 0. |
| Authored | 3,901 | placeholder 가 아닌 실제 텍스트가 들어 있는 fragment 수. |
| Cells | 165/165 | 5 period × (1 overall + 10 category) × 3 depth = 165. 모두 ≥1 authored. |
| Underfilled cells | 0 | 5개 미만 authored cell. (cell 당 평균 ~24 fragment.) |
| Axis value gaps | 0 | 한 gating axis 의 한 값에서 0 fragment 인 cell. |
| Expert numeric evidence | 523 | expert depth 의 `numericalEvidence` 항목 수. T3_INTERNAL_ENGINE. |
| Glossary entries | 208 | 10 카테고리 (compatibility / element / gungsil / gyeokguk / naeum / palace / pillar / shinsal / tenGod / yongshin). |
| Metaphor anchors | 90 + 잡 | 5 element bundle 각 18 anchor + Phase 2 `library.json`. |

## 2. cell 분포 — period × category × depth (fragment 수)

각 cell 의 brief / standard / expert depth 별 fragment 수.

| period | category | brief | standard | expert | total |
|---|---|---:|---:|---:|---:|
| life | overall | 820 | 251 | 68 | 1,139 |
| life | wealth | 16 | 16 | 18 | 50 |
| life | health | 16 | 18 | 16 | 50 |
| life | academic | 16 | 17 | 19 | 52 |
| life | romance | 16 | 18 | 20 | 54 |
| life | family | 16 | 16 | 17 | 49 |
| life | career | 16 | 20 | 18 | 54 |
| life | study_document | 16 | 16 | 16 | 48 |
| life | expression_children | 16 | 16 | 18 | 50 |
| life | health_stress | 16 | 16 | 30 | 62 |
| life | movement | 16 | 16 | 18 | 50 |
| today | overall | 25 | 25 | 23 | 73 |
| today | wealth | 16 | 16 | 17 | 49 |
| today | health | 16 | 16 | 33 | 65 |
| today | academic | 16 | 16 | 31 | 63 |
| today | romance | 16 | 16 | 18 | 50 |
| today | family | 16 | 16 | 20 | 52 |
| today | career | 16 | 16 | 20 | 52 |
| today | study_document | 16 | 16 | 16 | 48 |
| today | expression_children | 16 | 16 | 16 | 48 |
| today | health_stress | 16 | 16 | 18 | 50 |
| today | movement | 16 | 16 | 18 | 50 |
| thisWeek | overall | 19 | 21 | 17 | 57 |
| thisWeek | wealth | 16 | 16 | 17 | 49 |
| thisWeek | health | 16 | 16 | 19 | 51 |
| thisWeek | academic | 16 | 16 | 21 | 53 |
| thisWeek | romance | 16 | 16 | 17 | 49 |
| thisWeek | family | 16 | 16 | 31 | 63 |
| thisWeek | career | 16 | 16 | 20 | 52 |
| thisWeek | study_document | 16 | 16 | 19 | 51 |
| thisWeek | expression_children | 16 | 16 | 17 | 49 |
| thisWeek | health_stress | 16 | 17 | 21 | 54 |
| thisWeek | movement | 16 | 16 | 31 | 63 |
| thisMonth | overall | 19 | 54 | 16 | 89 |
| thisMonth | wealth | 16 | 16 | 33 | 65 |
| thisMonth | health | 16 | 16 | 17 | 49 |
| thisMonth | academic | 16 | 16 | 17 | 49 |
| thisMonth | romance | 16 | 16 | 20 | 52 |
| thisMonth | family | 16 | 31 | 20 | 67 |
| thisMonth | career | 16 | 16 | 23 | 55 |
| thisMonth | study_document | 16 | 16 | 17 | 49 |
| thisMonth | expression_children | 16 | 16 | 16 | 48 |
| thisMonth | health_stress | 16 | 16 | 17 | 49 |
| thisMonth | movement | 16 | 16 | 28 | 60 |
| thisYear | overall | 19 | 32 | 17 | 68 |
| thisYear | wealth | 16 | 16 | 20 | 52 |
| thisYear | health | 16 | 16 | 20 | 52 |
| thisYear | academic | 16 | 16 | 16 | 48 |
| thisYear | romance | 16 | 16 | 31 | 63 |
| thisYear | family | 16 | 16 | 19 | 51 |
| thisYear | career | 16 | 20 | 20 | 56 |
| thisYear | study_document | 16 | 16 | 17 | 49 |
| thisYear | expression_children | 16 | 16 | 17 | 49 |
| thisYear | health_stress | 16 | 16 | 17 | 49 |
| thisYear | movement | 16 | 16 | 16 | 48 |

해석:

- **overall.life** 는 fragment 수가 가장 많다 (1,139). 통합 보고서 첫 화면 "큰 그림" 카드의 어휘 다양성을 위해 가장 두텁게 채웠다.
- 모든 non-overall cell 은 **brief / standard depth 모두 ≥ 16** (기본 풀 두께). 카테고리별 시기별 depth 별로 selector 가 다양한 후보를 가질 수 있도록 보장.
- expert depth 는 16 ~ 33 사이 분포. 강도가 높은 cell (예: `today.health: 33`, `thisMonth.wealth: 33`) 은 expert tier tag 다양성 확보를 위해 추가 anchor 를 작성한 cell.
- 165/165 cell 모두 placeholder 가 아닌 authored fragment 로 채워져 있다 (`Underfilled cells: 0`).

## 3. gating axis 분포 (전체 기간 × 카테고리)

`narrative:coverage` 의 "Gating usage" 섹션. 각 axis 의 값별 fragment 수.

### 3.1 전체 fragment

| axis | fragment 수 | values |
|---|---:|---|
| `gender` | 275 | female, male, neutral |
| `agePhase` | 423 | child_0_9, early_teen, late_teen, early_20s, late_20s, early_30s, late_30s, early_40s, early_50s, late_40s, late_50s, early_60s, late_60s, 70s, 80s, 90_plus |
| `ageBand` | 1,085 | 0-9, 10-19, 20-29, 30-39, 40-54, 55-69, 70+ |
| `birthSeason` | 206 | spring, summer, autumn, winter |
| `currentSeason` | 497 | spring, summer, autumn, winter |
| `dayMasterPolarity` | 82 | YANG, YIN, neutral |
| `dayMasterStrength` | 1,273 | EXTREME_WEAK, WEAK, BALANCED, STRONG, EXTREME_STRONG |
| `yongshinAlignment` | 963 | aligned, conflicting, neutral |
| `dayMasterElement` | 699 | WOOD, FIRE, EARTH, METAL, WATER |
| `yongshinElement` | 408 | WOOD, FIRE, EARTH, METAL, WATER |
| `gyeokguk` | 436 | jeonggwangyeok, jeongingyeok, pyeongwangyeok, pyeoningyeok, sanggwangyeok, sikshingyeok |

### 3.2 expert tier 만

| axis | fragment 수 | values |
|---|---:|---|
| `gender` | 62 | female, male, neutral |
| `agePhase` | 198 | (above 16 phases) |
| `ageBand` | 222 | 0-9, 10-19, 20-29, 30-39, 40-54, 55-69, 70+ |
| `birthSeason` | 49 | spring, summer, autumn, winter |
| `currentSeason` | 125 | spring, summer, autumn, winter |
| `dayMasterPolarity` | 38 | YANG, YIN, neutral |
| `dayMasterStrength` | 248 | (5 levels) |
| `yongshinAlignment` | 431 | aligned, conflicting, neutral |
| `dayMasterElement` | 64 | (5 elements) |
| `yongshinElement` | 60 | (5 elements) |
| `gyeokguk` | 79 | (6 격) |

해석:

- `dayMasterStrength`, `ageBand`, `yongshinAlignment` 가 가장 두꺼운 gating axis. 일간 강약 / 연령대 / 용신 정합성 의 3축이 fragment selector 의 1차 조건이 되도록 풀이 충분.
- `birthSeason` 은 비교적 얇음 (206 / 4 값 ≈ 50). 출생 계절 차별화 fragment 는 보충 여지가 있는 axis.
- expert tier 의 `dayMasterPolarity` (38) 와 `dayMasterElement` (64) 도 얇은 편 — Phase 4 보강 후보.

## 4. 페어/쌍 axis 분포 (`narrative:axis-pairs`)

8 개 페어 모두 thin / missing 0 (Phase 3 ci:narrative-density 통과).

| pair | covered | authored hits | thin |
|---|---|---:|---:|
| `ageBand:gender` | 21/21 | 208 | 0 |
| `agePhase:gender` | 48/48 | 101 | 0 |
| `birthSeason:currentSeason` | 16/16 | 128 | 0 |
| `dayMasterElement:dayMasterStrength` | 25/25 | 603 | 0 |
| `dayMasterElement:yongshinElement` | 25/25 | 316 | 0 |
| `dayMasterStrength:yongshinAlignment` | 15/15 | 579 | 0 |
| `gyeokguk:dayMasterStrength` | 30/30 | 353 | 0 |
| `yongshinElement:yongshinAlignment` | 15/15 | 30 | 0 |

`yongshinElement:yongshinAlignment` (30 hits) 가 가장 얇은 pair — 풀 보강 여지 가장 큼.

## 5. depth × tier 카운트

| depth | fragment 수 | 비중 |
|---|---:|---:|
| `brief` | 1,702 | 41.9% |
| `standard` | 1,212 | 29.8% |
| `expert` | 1,152 | 28.3% |

전체 4,066. depth 분포는 brief 가 가장 두텁고, standard 와 expert 는 비슷한 두께.

## 6. 카테고리별 fragment 카운트 (전체 기간 합)

| category | fragment 수 | 비중 |
|---|---:|---:|
| `overall` | 1,426 | 35.1% |
| `family` | 282 | 6.9% |
| `movement` | 271 | 6.7% |
| `career` | 269 | 6.6% |
| `romance` | 268 | 6.6% |
| `health` | 267 | 6.6% |
| `wealth` | 265 | 6.5% |
| `academic` | 265 | 6.5% |
| `health_stress` | 264 | 6.5% |
| `study_document` | 245 | 6.0% |
| `expression_children` | 244 | 6.0% |

`overall` 이 35% 비중. 통합 보고서 큰 그림 카드의 다양성 확보 의도.

## 7. 측정 재현 방법

```bash
cd lib/spring-ts
npm run narrative:coverage     # 본 문서의 §1, §3, §5 재현
npm run narrative:axis-pairs   # §4 재현
npm run narrative:axis-tuples  # 3축 tuple coverage (참고)
npm run narrative:cell-axis    # cell 별 axis 누락 검사
```

수치가 위 표와 다르면 wave 가 진행됐거나 새 fragment / glossary 가 추가된 것이다. wave 종료 시 본 문서를 일괄 갱신한다.
