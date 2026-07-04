# 유료 품질 현황 & 개인화 강화 로드맵

> 2026-07-04 정리. 질문: **지금이 유료 수준인가? 외계어 없는가? 사람마다(사주·이름) 더
> "핀셋으로 콕 찝는" 문장을 줄 수 있는가, 아니면 경우의 수가 많아 불가능한가? 개선 여지는?**
> 관련: [PLAN_ARTICLE_REWRITE.md](../PLAN_ARTICLE_REWRITE.md), [CONTENT_ENGINE_CONSISTENCY.md](./CONTENT_ENGINE_CONSISTENCY.md), [ARTICLE_STYLE_CONTRACT.md](./ARTICLE_STYLE_CONTRACT.md)

## 1. 현재 판정 — 유료 수준 O, 외계어 X (실측 검증)

- **외계어(워드샐러드) 없음**: 조각 조립+정규식 4겹 땜질 아키텍처를 폐기하고 **완결 아티클**로 교체.
  게이트(분량·해요체·상한어휘·조사·중복) 위반 0 (330편). 사람이 3개 워크플로로 330편 전수 정독:
  품질 리뷰 = 전 카테고리 minor-polish 이상, pairing 감사 = 10/11 strong(불일치 1건 수정).
- **성능**: 유료 리포트 cold 1.6s / warm 24ms (구 fragment 29~35초 대비).
- 결론: **지금 상태로 유료 출시가 가능한 품질**이다. 아래는 "충분히 좋다"를 "확 와닿는다"로
  끌어올리기 위한 강화 여지다.

## 2. 지금 "개인화"가 되는 정도 (정확히)

한 사람의 리포트에서 **실제로 그 사람 사주에서 계산되는 것**:

| 개인화 요소 | 근거 | 사람마다 다른가 |
|---|---|---|
| 165개 셀의 **별점 패턴** | `gradeCell`이 기간 오행 × 그 사람의 용신·희신·기신 + 카테고리 오행으로 계산 | ✅ 사실상 지문 |
| 슬롯: 일간명·용신명·계절명 | FeatureVector(실측) | ✅ |
| 수치근거: 오행 개수·조화 등급·나이 | FeatureVector(실측) | ✅ |
| 오디언스(성인/청소년/아동/생애밴드) | 나이 | ✅ |
| 이름 사격(namingEvidence 블록) | 작명 four-frame | ✅ (단, 아래 한계 참조) |

**두 사람은 이미 서로 다른 리포트를 받는다** — 별점 패턴·오행명·숫자·연령 프레임이 다르다.
별점 패턴 하나만으로도 조합 공간이 천문학적이라, "구조" 수준의 개인화는 이미 강하다.

### 한계 (여기가 강화 지점)
1. 같은 `(카테고리·기간·오디언스·밴드)` 셀이면 **슬롯을 뺀 prose가 동일**하다. 서사 문장이
   그 사람의 정확한 격국/신살/강약에서 나온 게 아니라 **밴드-전형**이다.
2. **이름이 tiered 아티클에 전혀 반영되지 않는다.** `buildSelectionSeed`(article-selector.ts)는
   생년월일시+성별+기준일만 쓴다. 생일이 같고 이름만 다른 두 사람 → tiered 아티클 **완전 동일**.
3. 셀당 authored variant가 **현재 1개('a')**뿐이라, 이미 구현된 variant 선택
   메커니즘(`fnv1a(seed) % n`)이 **놀고 있다**.

## 3. 왜 "완전 핀셋"은 불가능한가 (정직하게)

- 완전 개인화 = (격국 19 × 강약 5 × 용신 5 × 계절 4 × 신살 조합 × …) 모든 조합을 **완결 아티클**로
  저작 = 수십만~수백만 편. 저작·검수 불가능.
- 게다가 그 핀셋을 **조각 조립으로 흉내 낸 것이 바로 이번에 폐기한 외계어 시스템**이다.
  개인화를 극단으로 밀면 문장이 조각나며 외계어로 회귀한다. → **핀셋과 가독성은 상충한다.**
- 따라서 현실적 전략은 둘이다: **(a)** "내 얘기다" 체감을 가장 크게 주는 **2~3개 축만** 골라
  통제된 추가 저작, **(b)** 엔진이 **이미 계산했지만 안 쓰는** 신호를 더 노출.

## 4. 핵심 통찰 — 개인화 "연료"가 엔진에 이미 있고 안 쓰인다

`feature-selector.ts`의 FeatureVector는 이미 다음을 계산한다(대부분 아티클이 안 씀):
`dayMasterStrength`(신강/신약), `gyeokguk`(격국), `deficientElements`/`excessiveElements`(부족/과다 오행),
`shinsalCount`, `dayMasterPolarity`, `yongshinConfidence`, 강약 점수(득령·득지·득세), 천간/지지 관계 수.

**즉 엔진은 깊이 분석하는데 아티클 층이 일간/용신/계절/오행개수만 소비한다.** 새로 계산할 것 없이
**노출만 늘려도** 개인화가 올라간다. variant 메커니즘도 이미 있으니 "연료 주입"만 하면 된다.

## 5. 개선 레버 (우선순위 · 비용 · 외계어 위험)

### Tier A — 결정적·안전·저렴 (먼저 할 것, 외계어 위험 ~0)

- **A1. 별점 패턴 종합 리딩 (교차-셀 개요)** ⭐ 최고 레버리지
  현재 각 셀은 고립돼 읽힌다. 이미 계산된 165개 별점을 종합해 **"당신은 재물·건강은 낮게, 학업·표현은
  높게 짜인 배치"** 같은 한 사람 전체 프로필 문장을 만든다. 100% 실측 grade 기반, 결정적, 외계어 위험 0.
  → "이거 완전 내 얘기네" 순간을 가장 싸게 만든다. (구현: grade 분포 → 규칙 기반 문장 조립, 슬롯 수준.)
- **A2. FeatureVector 슬롯 확장**
  `{{gyeokgukName}}`(예: 정인격), `{{deficientElementName}}`(부족 오행), `{{dayMasterStrengthLabel}}`,
  `{{yongshinCount}}` 슬롯 추가 → 저자가 조건절로 녹임("당신 사주는 {{gyeokgukName}}이라…").
  그 사람의 **실제 격국·부족오행을 이름으로 호명** = 핀셋 체감↑. 결정적·안전.
  ⚠ 가드: 절대 상태 단정 금지 규칙([CONTENT_ENGINE_CONSISTENCY.md](./CONTENT_ENGINE_CONSISTENCY.md) §3.2)을
  깨지 않도록 슬롯은 조건절/서술로만. 강약 라벨은 특히 조심(모순 위험).
- **A3. 실제 숫자를 prose에 녹이기**
  용신 개수·조화 등급을 별도 블록뿐 아니라 본문 문장에 슬롯으로 ("용신 {{yongshinName}}이 {{yongshinCount}}개라…").
  구체성↑, 결정적·안전.

### Tier B — 통제된 코퍼스 확장 (A로 부족하면, 외계어 위험 낮음)

- **B1. 서사적으로 결정적인 축 1개 추가 선택: 신강/신약**
  variant 선택에 `dayMasterStrength`를 추가하고, 셀당 2~3 변형 저작. expert 메커니즘이
  **밴드-전형 → 개인-참**으로 바뀐다(신강이면 재성 활용, 신약이면 비겁·인성 보강 먼저).
  비용: 해당 셀 2~3× 저작(전 코퍼스 아님, 강약이 서사를 실제로 가르는 셀만). 이미 있는
  워크플로 저작 방식 재사용. **가장 큰 "개인-참" 이득/저작비.**
- **B2. 이름 연동**
  `buildSelectionSeed`에 이름 추가 + 이름의 dominant 오행 vs 기간/용신 오행 관계를 슬롯/문장으로.
  → 생일 같고 이름 다른 두 사람이 **다른 리포트**를 받는다(사용자가 명시한 니즈).
  가드: 이름-사주 연결은 근거 있는 한 문장으로 절제(작명 파트와 중복·과장 금지).

### Tier C — 야심 (프리미엄 상위 티어 도입 시에만, 외계어 위험 관리 필요)

- **C1. 다축 버킷(강약 × 주도 십성)**: 핀셋 이상에 근접하나 대량 통제 저작 필요.
  반드시 게이트 + pairing 감사 + 사람 리뷰로 외계어 회귀 방어(이번에 만든 도구 재사용).
- **C2. 개인 focus 하이라이트**: 가장 두드러진 신살/부족오행 하나를 콜아웃으로. (`shinsalHits`,
  `deficientElements` 실측 활용.)

## 6. 권장 순서 (ROI)

1. **A1 별점 종합 리딩** — 싸고 안전하고 체감 큼. 지금 바로.
2. **A2 격국/부족오행 슬롯** — 그 사람 사주를 이름으로 호명.
3. **B1 신강/신약 축 변형** — 서사를 개인-참으로. (가장 큰 질적 도약.)
4. **B2 이름 연동** — 이름별 차별화.
5. C는 상위 유료 티어 전략이 설 때.

> 지금 출시 → A1·A2로 빠르게 강화 → 반응 보고 B1(핵심 도약) → 필요 시 B2/C. 단계마다
> **게이트 + pairing 감사 + 벤치**로 외계어·모순·성능 회귀를 막는다.

## 7. 불변 가드레일 (어떤 강화도 이걸 깨면 안 됨)

- 아티클 게이트 통과(분량·해요체·상한어휘·조사·중복·미성년 안전·의료어).
- **절대 사주상태 단정 금지** — 개인 feature와 모순 방지([CONTENT_ENGINE_CONSISTENCY.md](./CONTENT_ENGINE_CONSISTENCY.md) §3.2). 슬롯도 조건절/서술로만.
- 요약↔본문↔전문가 **pairing 유지**.
- **런타임 LLM 금지** — 오프라인 AI-보조 저작 + 사람 리뷰 + `aiGenerated:true` 마킹.
- WYSIWYG — 런타임 텍스트 재작성 없이 소스에서 수정.

## 8. 이름 기반 개인화 (음양오행·사격·수리) — 큰 미사용 연료

사용자 지적대로 **이름 자체가 음양·오행·사격·수리 분석을 담고 있고, 그 대부분이 이미 계산돼 있으나
tiered 콘텐츠에는 거의 안 쓰인다.** (매핑: 2026-07-04, 작명 엔진 5개 facet 전수 탐색.)

### 8.1 엔진이 이미 계산하는 이름 파생 신호

| 신호 | 무엇 | 어디서 | tiered에 흐르나 |
|---|---|---|---|
| **음령오행(발음오행)** | 초성→5행(ㄱㄲㅋ=목…ㅁㅂㅍ=수), 음절별 `element` | `HangulAnalysis.blocks[].element` | ❌ |
| **음양(한글)** | 모음→양/음, `polarityScore` | `HangulAnalysis.blocks[].polarity` | ❌ |
| **자원오행** | 한자 부수 유래 오행 | `HanjaAnalysis.blocks[].resourceElement` | ❌ |
| **획수오행·수리** | 획수 끝자리→오행, `strokes` | `HanjaAnalysis.blocks[].strokeElement/strokes` | ❌ |
| **사격(원형이정)** | 원/형/이/정 4격의 수리(strokeSum)·오행·음양·길흉(luckyLevel, 81수리) | `NamingReportFourFrame.frames[]` | ✅ `namingEvidence` 블록(생애단계 매핑: 원=초년…정=총운) |
| **이름↔사주 보강도** ⭐ | `nameElements`(이름 오행), `yongshinMatchCount`(이름이 용신 몇 자 담나), `gishinMatchCount`, `affinityScore`, `combinedDistribution`(사주+이름 오행 합산), `breakdown.balance`(부족오행 채움 정도) | `SajuCompatibility`(types.ts:1086) | ❌ **buildTieredMatrix에 전달조차 안 됨** |

### 8.2 결정적 배관 사실

`buildFortuneReport.ts:258`이 `buildTieredMatrix`에 **`springReport.namingReport`만** 넘긴다.
이름↔사주 보강도(`sajuCompatibility.yongshinMatchCount`, `combinedDistribution`, `breakdown.balance`)는
`SpringReport` 레벨에서 **이미 계산돼 있으나** tiered 콘텐츠 층으로 **전달되지 않는다.**
즉 "이 이름이 이 사람의 부족한 용신 오행을 채워 주는가"라는, 유료 개인화의 금맥이
`name-compatibility-card`에서만 쓰이고 tiered 리포트에는 놀고 있다.

### 8.3 이름 기반 레버 (§5의 A/B 확장)

- **N1. 이름↔사주 보강 문장 (A1 개요와 결합)** ⭐ 최고 ROI
  `sajuCompatibility`를 buildTieredMatrix에 넘기고, 개요에 한 문장:
  *"당신 이름은 용신 {{yongshinName}}을 {{nameYongshinMatchCount}}자 담아 부족한 {{yongshinName}}을 채워 주는 배치라,
  {{yongshinName}}이 유리한 시기에는 이득이 배가돼요."* 100% 실측(yongshinMatchCount·balance) 기반, 외계어 위험 0.
  → **"내 이름이 내 사주에 이렇게 작용하는구나"** = 결제 욕구를 가장 직접 건드리는 지점.
- **N2. 사격(원형이정)으로 생애밴드 셀 강화**
  사격은 이미 생애단계 매핑됨(원=초년, 형=청년, 이=장년, 정=총운) + 각 격의 길흉(luckyLevel)이 계산됨.
  byAgeBand 생애밴드 셀에 "이 시기 이름 사격은 {{frameLuckLabel}}" 같은 이름-고유 근거를 더할 수 있다.
  이미 `namingEvidence`에 있으므로 셀과 연결만 하면 됨.
- **N3. 이름 오행 슬롯**: `{{nameDominantElement}}`, `{{nameYongshinMatchCount}}`, `{{nameReinforcesYongshin}}`(bool)
  → 저자가 조건절로 녹임. 결정적·안전.
- **N4. 이름을 variant 시드에 추가** (§5 B2 구체화)
  `buildSelectionSeed`에 이름 추가 → 셀당 variant가 2개 이상일 때 이름 다르면 다른 변형 선택.
  (단독으로는 효과 작음. N1~N3와 함께여야 의미.)

### 8.4 이름 개인화 가드레일 (추가)

- 이름↔사주 주장은 **실측 `sajuCompatibility` 값에 근거**해야 함(임의 단정 금지). 예: yongshinMatchCount=0이면
  "채워 준다"고 쓰면 안 됨 → 슬롯/조건 분기로 실제 값에 맞춰 서술.
- **작명 카드와 중복·과장 금지.** tiered는 "시기 운"이 주제이므로, 이름 언급은 시기 해석을 **거드는 한 문장**으로 절제.
- 학파 옵션(중국파는 발음오행 부차)과 무관하게, 콘텐츠는 **오행 사실**만 쓰고 점수 가중치는 안 씀.

### 8.5 권장 (§6에 이어)

이름 축을 넣는다면 **N1(이름↔사주 보강 문장)**이 A1·A2 다음으로 ROI가 크다 — 배관 한 번(+sajuCompatibility 전달)으로
"내 이름 얘기"가 열린다. N2는 생애밴드 리포트에 이름 근거를 싸게 더한다. 순서: A1 → A2 → **N1** → B1 → N2 → B2.
