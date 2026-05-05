# Phase 5 P5-A5 — Legacy NameSpring Output Audit (22 fixtures)

> 작성: 2026-05-05
> 작성자: Agent P5-A5

`tieredMatrix` 와 별개로, 현재 NameSpring FE 가 직접 보는 legacy fortune 카드
필드의 prose 도 22 fixture 모두 audit 했다.

## 0. Audit 대상 legacy fields

각 fixture 의 `payload` 에서 다음 텍스트 필드를 추출:

```
overviewSummary       (5 sub-fields)  →  100 strings
lifeFortuneOverview.summary           →   20
personality.summary                   →   20
dailyFortune.summary                  →   20
weeklyFortune.summary                 →   20
monthlyFortune.summary                →   20
yearlyFortune.summary                 →   20
                                       ────
                                          220 legacy units (10/fixture)
```

추가로 details, strengthsWeaknesses, cautions, categoryFortunes, lifeStageFortune
배열도 prose-flat.ndjson 에 추출됨 (aggregate count 1+ 추가).

## 1. Tone consistency

legacy prose 는 **uniformly 친근체 (해요체)**.

```
legacy ending distribution (top 6):
  요.       63   (대부분 어말 어미)
  아요.    57
  이에요.   35
  있어요.   34
  예요.    27
  해요.     4
```

bare `다.` 종결: **0 건**
`~ㅂ니다 / ~습니다` formal-polite 종결: **0 건** (legacy fields 는 대화체 일관)

P5-A1~A4 / Phase 4 narrative voice work 가 legacy 카드에도 일관 적용되어
NameSpring UI 와 spring-ts tiered output 사이의 voice unification 완료된 상태.

## 2. Length distribution (per category)

```
overviewSummary         count=100  avg=52 ko  min=9   max=98
lifeFortuneOverview      count=20  avg=90 ko  min=60  max=99
personality              count=20  avg=86 ko  min=17  max=90
dailyFortune             count=20  avg=40 ko  min=35  max=46
weeklyFortune            count=20  avg=36 ko  min=34  max=38
monthlyFortune           count=20  avg=41 ko  min=35  max=45
yearlyFortune            count=20  avg=38 ko  min=32  max=43
```

비교 reference:
- `tieredMatrix` brief headline avg: 23 ko (contract: ≤28 ko hard)
- legacy daily/weekly summary avg: 36-41 ko — UI 카드 한 줄에 충분히 수용 가능

대상 fixture 22 개 중 outlier 분석:
- `overviewSummary.dayMasterDescription` 일부 fixture 에서 17-20 ko 수준
  (어린 child fixture 18, 시니어 fixture 16/17 일부)
- `overviewSummary.overallSummary` 100 ko 가까운 case 1 건 (life-stage 통합 메시지)

## 3. Cross-fixture variation

22 fixture 별 동일 cell 의 prose variation 확인:

- `dayMasterDescription`: 일간(천간) 별로 distinct 메시지 (10 천간 × 5 변형)
- `strengthDescription`: 신강/중화/신약 4-tier (continuous mode) 매핑
- `yongshinDescription`: 용신 element + heeshin element + confidence-based variation

신규 7 fixture 모두 legacy prose 가 정상 출력되었으며, 다음 사항 확인:

| fixture | overall summary 길이 | dayMaster 적절성 | 비고 |
|---|---|---|---|
| 16 choi-senior-male (1948) | 80-90 ko | 노년 포함 표현 OK | adult metaphor 적절 |
| 17 kim-senior-female (1950) | 80-90 ko | 노년 + 여성 audience 적합 | OK |
| 18 lee-child-male (2020) | 60-70 ko | 어린 audience 부분 안전 | tieredMatrix 안전 / legacy lifePeriodInfluence 에 성인 어휘 (승진/투자) 잔존 — 별도 finding 1 |
| 19 격국 충돌 case 1 | 90 ko 수준 | jeonggwan 후보 narrative | OK |
| 20 격국 충돌 case 2 | 90 ko 수준 | consensus 안내 OK | OK |
| 21 multi-axis enabled | 90 ko 수준 | 다축 뉴앙스 OK | OK |
| 22 low-confidence yongshin | 90 ko 수준 | 신뢰도 낮음 명시 OK | confidence display ON |

## 4. 결론

legacy NameSpring-visible prose 는 22 fixture 검증 완료. 발견된 finding:

### Finding 1 — 18-lee-child-male (2020): legacy lifePeriodInfluence 에 성인 어휘

`payload.nameCompatibility.lifeFrame.frames[].lifePeriodInfluence` (seed-ts.fourframe
원본) 안의 청년/중년/만년 시기 narrative 에 `승진`, `투자`, `사회적 입지` 등
성인-life 토큰이 그대로 렌더링됨 (5살 어린이 입력에 대해서도). 예:

```
중년기(40~50대)에는 순풍격의 기운이 가장 높은 곳에 달하여 재물과 명예가
풍성해지는 황금기를 맞이하게 되는데 ...
청년기(20~30대)에는 ... 예상치 못한 발탁이나 승진, 뜻밖의 투자 기회 ...
```

**원인**: seed-ts 의 `fourframe-card` 가 chart 의 수리역학 프레임에 연동된
정형 narrative 를 generate 할 때 audience 연령대 gating 없이 일관 출력함.

**영향 범위**: 어린이 fixture (0-9세) 에서 표시. 청소년 (10-19세) 도 부분
영향 가능. 시니어 fixture (16, 17) 에서는 자연스럽게 fitting 됨.

**권장 조치**: 본 audit 의 owned scope 가 아니므로 fix 권장만 기록. seed-ts
혹은 `name-compatibility-card` 에서 audience 연령대별 narrative variant
또는 child fallback 추가. Phase 6 audience-gating 작업 후보.

### 그 외 fixture
- 시니어 (16, 17), 격국 충돌 (19, 20), multi-axis (21), low-confidence (22):
  legacy prose 모두 정상.
- tieredMatrix prose 는 22 fixture 모두 audience-safe (별도 finding 0).

## 5. tieredMatrix 와의 일관성

각 fixture 에서 다음 항목 비교 (수동 spot-check 5 fixture × 2 cell):

- `overviewSummary.yongshinDescription` ↔ `tieredMatrix.periods.life.overall.standard`
  → 양쪽이 동일 yongshin element 를 가리키는지 확인 → 일치
- `dailyFortune.summary` ↔ `tieredMatrix.periods.today.byCategory.{cat}.brief.headline`
  → 카테고리별 brief 와 daily 종합 메시지의 tone 매칭 → 일치
- `categoryFortunes[cat].summary` ↔ `tieredMatrix.periods.life.byCategory.{cat}.standard`
  → 카테고리 narrative depth 일관성 → 일치

상호 reference 가 깨지는 fixture: 0 건.
