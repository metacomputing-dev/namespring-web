# Naming Report Evidence Text Generation Draft

## Purpose

이 문서는 이름봄 통합 보고서의 새 방향에 맞춰, "왜 이 이름이 적절한지"를 설명하는 근거 해설 텍스트 생성 계획을 정리한다.

서비스의 중심은 사주 해설이 아니라 작명이다. 사주 분석 결과는 UI에서 직접 노출하지 않고, 이름 추천의 내부 판단 근거로 사용한다. 사용자에게는 사주 전문 결과표가 아니라 이름이 잘 맞는 이유를 자연어로 전달한다.

## Report Position

통합 보고서의 2번 섹션은 "이 이름이 잘 맞는 핵심 이유"를 설명한다.

```text
2. 이 이름이 잘 맞는 핵심 이유
  2.1. 사주에 필요한 방향과 맞는가
  2.2. 이름의 성명학 구조가 안정적인가
  2.3. 부르기 좋은 이름인가
```

각 항목은 기본 UI에서 자연어 근거를 보여주고, 작은 상세 보기 버튼을 통해 전문 근거와 수치 근거를 제공한다.

```ts
interface EvidenceTextBlock {
  readonly title: string;
  readonly plain: string;
  readonly detail: string;
}
```

## Section 2.1 Scope

2.1은 사주 4축과 이름 3축을 결합해 설명한다. 단, 이름 3축을 서로 독립된 평가로 취급하지 않는다.

사주 4축:

```text
일간 × 신강약 × 용신 × 격국 = 5 × 3 × 5 × 6 = 450
```

이름 3축:

```text
sajuFit
yongshinFit
elementBalance
```

세 이름 축은 현재 코드에서 `NamingScoreVector`의 연속 점수로 제공된다. 문장 생성에는 연속값을 그대로 사용하지 않고, 설정 가능한 band로 이산화한다.

세 축의 관계는 다음과 같다.

```text
sajuFit: 이름이 사주와 조화로운지를 나타내는 종합 평가
├─ yongshinFit: 필요한 보완 방향과 이름 성분의 일치도를 설명하는 세부 근거
└─ elementBalance: 이름과 사주의 오행 균형을 설명하는 세부 근거
```

`sajuFit`, `yongshinFit`, `elementBalance`를 동등한 세 평가처럼 나열하지 않는다. `sajuFit`이 결론의 중심이고, 나머지 두 축은 그 결론을 설명하거나 보완하는 근거다.

## Score Band Plan

band는 현재 엔진이 사용해 온 경계를 유지해 4단계로 둔다.

```json
{
  "higherIsBetter": {
    "excellent": { "min": 80 },
    "good": { "min": 65 },
    "mixed": { "min": 46 },
    "caution": { "min": 0 }
  }
}
```

기존 설명 엔진의 강점 기준 `80점 이상`, 주의 기준 `45점 이하`를 그대로 유지한다. `65점`은 기존 이름 종합 해석의 good 경계다. 축의 표시명, 값의 방향, 보고서상 역할과 threshold는 `src/naming-score-axis-policy.ts` 한 파일에서 관리한다. 다른 설명 코드에서 숫자를 다시 하드코딩하지 않는다.

값이 `null`이거나 사용할 수 없는 경우 해당 축의 문장은 생성에서 제외한다. 제외된 축을 "자료 없음"으로 길게 설명하지 않는다. 사용 가능한 근거만으로 자연스럽게 문장을 구성한다.

## Why Not Full Cartesian Generation

완전 조합형으로 만들면 다음 규모가 된다.

```text
450 × 4 × 4 × 4 = 28,800
```

이는 생성, 검수, 유지보수 비용이 지나치게 크다.

따라서 2.1은 곱연산 DB가 아니라 조립형 DB로 설계한다.

```text
사주 4축 기반 해설 450개
+ sajuFit band fragment 4개
+ yongshinFit band fragment 4개
+ elementBalance band fragment 4개
+ 연결/결론 fragment 약간
```

기본 생성량은 약 486개 내외로 잡는다.

```text
450 + 4 + 4 + 4 + 약 24 = 약 486
```

## Text Fragment Responsibilities

각 fragment는 서로 다른 책임을 가져야 한다. 같은 내용을 여러 fragment가 반복하면 조립 결과가 기계적으로 보인다.

### `sajuAxisFragment`

사주 4축의 현재 상태와 이름이 받쳐 주어야 할 방향을 설명한다.

입력:

```text
dayMasterElement
strengthBand
yongshinElement
gyeokgukFamily
```

출력:

```ts
interface SajuAxisFragment {
  readonly key: string;
  readonly plain: string;
  readonly detail: string;
}
```

plain 작성 원칙:

- `일간`, `신강약`, `용신`, `격국` 같은 전문어를 직접 노출하지 않는다.
- 사용자가 이해할 수 있는 방향성으로 쓴다.
- 현재 상태를 먼저 설명하고, 그 상태에서 이름에 어떤 성분이나 방향이 필요해지는지 연결한다.
- 특정 이름이 좋다고 단정하지 않는다.

detail 작성 원칙:

- 사주 4축 전문어를 포함해도 된다.
- 일간, 신강약, 용신, 격국이 어떤 이유로 이름 판단에 쓰였는지 설명한다.
- 사주 자체를 운세처럼 길게 풀이하지 않는다.

### `sajuFitBandFragment`

이름 전체가 사주와 얼마나 잘 맞는지 종합 평가한다.

입력:

```text
sajuFitBand = excellent | good | mixed | caution
```

책임:

- 2.1의 중심 판정으로 전체 조화 수준을 설명한다.
- 용신 일치나 성분 균형을 세부적으로 반복하지 않는다.
- `yongshinFit`과 `elementBalance`보다 먼저 제시한다.

### `yongshinFitBandFragment`

필요한 보완 방향과 이름 성분의 맞물림을 설명한다.

입력:

```text
yongshinFitBand = excellent | good | mixed | caution
```

책임:

- 필요한 방향을 이름이 얼마나 직접적으로 받쳐주는지 설명한다.
- `용신`이라는 단어는 detail에서만 사용한다.
- `sajuFit`의 종합 판정을 뒷받침하거나 제한하는 세부 근거로만 사용한다.

### `elementBalanceBandFragment`

이름과 사주를 함께 보았을 때 오행/성분 배열이 얼마나 안정적인지 설명한다.

입력:

```text
elementBalanceBand = excellent | good | mixed | caution
```

책임:

- 이름과 사주 성분의 조화, 치우침, 안정감을 설명한다.
- 사주 4축 설명을 반복하지 않는다.
- 이름 내부만을 평가하는 점수인 것처럼 쓰지 않는다.

### `conclusionFragment`

사용 가능한 세 이름 축의 band 조합을 보고 최종 톤을 정리한다.

완전 조합 문장을 만들 필요는 없지만, 최소한 다음 케이스는 구분한다.

```text
allPositive
mostlyPositive
mixedButUsable
needsCaution
insufficientEvidence
```

## Composition Strategy

2.1 자연어 기본 문장은 다음 논리 순서로 조립한다.

```text
1. 사주 4축의 현재 상태와 이름에 필요한 방향
2. sajuFit을 이용한 이름과 사주의 종합 평가
3. yongshinFit 세부 근거
4. elementBalance 세부 근거
5. 최종 결론
```

3번과 4번은 종합 평가와 동등한 별도 판정이 아니다. 두 근거 모두 사용할 수 있으면 둘을 사용하고, 하나가 없으면 사용할 수 있는 근거만 쓴다.

기계적 조립의 어색함을 줄이기 위해 텍스트 생성과 조립의 책임을 분리한다.

- 원천 fragment는 앞 문장을 알 수 없는 상태에서도 의미가 완결되는 한 문장으로 작성한다.
- fragment 자체를 `그래서`, `또한`, `하지만` 같은 접속어로 시작하지 않는다.
- 접속어는 조립기가 앞뒤 band의 관계를 보고 넣는다.
- 종합 평가 문장은 결론을 말하고, 세부 근거 문장은 그 이유만 설명한다.
- 최종 결론은 새로운 근거를 추가하지 않고 앞선 내용을 압축한다.
- 같은 명사와 서술어가 인접 문장에서 반복되지 않도록 fragment 검증 단계에서 확인한다.

조립기는 앞뒤 평가 관계에 따라 연결 방식을 선택한다.

```text
종합과 세부가 같은 방향: 구체적으로 / 특히
종합은 좋지만 일부 세부가 낮음: 다만 / 한편
종합이 낮지만 일부 세부가 좋음: 그럼에도 / 다만 긍정적인 부분은
```

접속 표현은 화면에 그대로 저장된 문장을 임의로 치환하는 용도가 아니다. slot 사이의 관계를 표현하는 제한된 연결 규칙으로만 사용한다.

상세 근거는 다음 순서로 조립한다.

```text
1. sajuAxisFragment.detail
2. sajuFit 점수, band와 종합 평가
3. yongshinFit 점수, band와 세부 근거
4. elementBalance 점수, band와 세부 근거
5. conclusion detail
```

## Plain Text Style

plain은 사용자가 바로 이해할 수 있는 언어로 쓴다.

좋은 방향:

```text
이 이름은 필요한 방향을 무리하게 밀어붙이기보다, 부족한 부분을 차분히 받쳐 주는 쪽에 가까워요.
```

피해야 할 방향:

```text
이 사주는 목 일간이고 신약이며 용신은 수이고 격국은 인성이라 이 이름이 적절합니다.
```

plain에서는 전문어 대신 다음 표현을 쓴다.

```text
필요한 방향
받쳐 주는 성분
이름 안의 균형
부족한 부분을 보완하는 흐름
무리하지 않고 맞물리는 구조
```

## Detail Text Style

detail은 작은 상세 보기 버튼 뒤에 들어간다. 전문어를 사용할 수 있지만, 데이터 덤프처럼 보이면 안 된다.

좋은 방향:

```text
내부 판단에는 일간, 신강약, 용신, 격국을 함께 사용했어요. 이 케이스에서는 용신 방향과 이름 성분의 맞물림이 비교적 안정적으로 나타나며, elementBalance도 보완 근거를 약하게나마 받쳐 줘요.
```

피해야 할 방향:

```text
dayMaster=Wood, strength=weak, yongshin=Water, gyeokguk=inseong, sajuFit=72, yongshinFit=80, elementBalance=65
```

수치는 필요할 때만 보조로 제공한다.

## Null Handling

값이 없는 축은 문장 생성에서 제외한다.

예:

```ts
{
  sajuFitBand: 'good',
  yongshinFitBand: null,
  elementBalanceBand: 'mixed'
}
```

위 경우에는 `yongshinFit` 문장을 만들지 않는다. 대신 결론은 사용 가능한 두 축만 기준으로 정한다.

사주 4축의 `UNKNOWN`은 정상 서비스 입력에서는 발생하지 않는다고 가정한다. 이 계약이 깨지면 `balanced`나 임의의 요소로 대체하지 않고 2.1 생성을 실패 처리한다. 이름 점수 축의 `null`만 선택적 제외 대상으로 다룬다.

금지:

```text
용신 보강 점수는 자료가 없어 판단하기 어렵지만...
```

허용:

```text
전체 조화는 안정적인 편이고, 성분 균형은 조금 더 살펴볼 여지가 있어요.
```

## Remaining Sections

남은 항목도 데이터 뷰어가 아니라 자연어 해설을 기본으로 제공한다.

### 2.2 이름의 성명학 구조가 안정적인가

근거:

```text
종합 대표값: NamingReport.totalScore

세부 근거:
- NamingReport.scores.hangul
- NamingReport.scores.hanja
- NamingReport.scores.fourFrame
- NamingReport.analysis.hangul.elementScore / polarityScore
- NamingReport.analysis.hanja.elementScore / polarityScore
- NamingReport.analysis.fourFrame.elementScore / luckScore
```

`NamingReport.totalScore`는 사주 계산을 제외하고 한글 오행·음양, 한자 획수 음양, 사격수리와 사격오행을 가중 평균한 이름 자체의 종합 점수다. 따라서 "성명학 관점에서 이름 구조가 안정적인가"의 대표값으로 사용할 수 있다.

주의할 점:

- `NamingReport.scores.fourFrame`은 현재 사격수리 운 점수만 나타낸다.
- 사격오행 안정성은 `NamingReport.analysis.fourFrame.elementScore`에서 별도로 가져온다.
- `totalScore`를 종합 평가로 먼저 설명하고, 세부 점수는 대표적인 강점과 점검 지점만 선택한다.
- 모든 세부 점수를 한 문단에 나열하지 않는다.

초기 작성 전략:

- `totalScore` band별 종합 문장 4개를 작성한다.
- 하위 구조별 설명은 역할 단위 fragment로 작성한다.
- 종합 문장 1개와 세부 근거 1~2개를 선택해 조립한다.
- 하위 점수의 완전 곱연산 DB는 만들지 않는다.

### 2.3 부르기 좋은 이름인가

근거:

```text
phonetic
familyFit
```

예상 조합:

```text
4 × 4 = 16
```

완전 조합 DB 가능성이 높다.

## Proposed Files

초기 구현 시 다음 파일 구성을 검토한다.

```text
lib/spring-ts/src/naming-score-axis-policy.ts
lib/spring-ts/data/naming-report/evidence/saju-axis-fragments.json
lib/spring-ts/data/naming-report/evidence/score-band-fragments.json
lib/spring-ts/data/naming-report/evidence/conclusion-fragments.json
lib/spring-ts/data/naming-report/evidence/naming-structure-fragments.json
lib/spring-ts/src/report/naming-evidence-text.ts
lib/spring-ts/test/integration/naming-evidence-text.test.ts
```

## Generation Prompt Requirements

486개 텍스트 생성용 프롬프트는 다음을 반드시 포함한다.

- 이름봄은 작명 서비스이며 사주 해설 서비스가 아니다.
- 사주는 내부 근거이고 UI 기본 문장에서는 전문어를 숨긴다.
- plain과 detail을 반드시 분리한다.
- plain은 자연어 설명, detail은 전문 근거 설명이다.
- 사주 4축 fragment는 현재 상태와 이름 추천에 필요한 방향까지만 설명한다.
- `sajuFit`은 종합 평가로, `yongshinFit`과 `elementBalance`는 세부 근거로 작성한다.
- 세부 근거 fragment는 종합 결론을 다시 선언하지 않는다.
- `excellent`, `good`, `mixed`, `caution`은 모두 추천 서비스의 톤으로 작성한다.
- `caution`도 공포, 단정, 탈락처럼 쓰지 않는다.
- null 축은 문장 생성에서 제외한다.
- 같은 문장 골격을 여러 fragment에서 반복하지 않는다.
- fragment를 접속어로 시작하지 않는다.

## Open Decisions

- detail에서 점수 숫자를 항상 노출할지, 상세 보기 안에서도 선택 노출할지.
- 450개 사주 4축 fragment를 사람이 직접 검수할지, 샘플링 검수할지.
- 연결 표현을 몇 가지 변형으로 둘지, 동일 입력에서 항상 같은 표현을 선택할지.
