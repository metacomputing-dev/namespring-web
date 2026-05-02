# 현재 상태와 출력 계약

## 현재 NameSpring 호출 흐름

`namespring/src/App.jsx`의 흐름은 다음과 같다.

```jsx
function toFortuneReportRequest(userInfo, givenName) {
  const base = toSpringRequest(userInfo);

  return {
    birth: base.birth,
    surname: base.surname,
    givenName: normalizedGivenName,
    options: base.options,
  };
}
```

`handleLoadCombinedReportAsync()`는 이 요청을 그대로 `springEngine.getFortuneReport(fortuneRequest)`에 넘긴다.

현재 `base.options`에는 `sajuTimePolicy`만 들어간다.

```js
{
  sajuTimePolicy: {
    trueSolarTime: 'on' | 'off',
    longitudeCorrection: 'on' | 'off',
    yaza: 'on' | 'off'
  }
}
```

따라서 현재 NameSpring 통합 보고서에는 `tieredMatrix`가 전달되지 않는다.

## spring-ts opt-in 계약

`spring-ts`는 다음 opt-in이 있을 때만 `FortuneReport.tieredMatrix`를 붙인다.

```js
{
  options: {
    precisionConfig: {
      surfaceTieredMatrix: true
    }
  }
}
```

기본값은 backward-compatible이다.

- `surfaceTieredMatrix !== true`: `report.tieredMatrix === undefined`
- `surfaceTieredMatrix === true`: `report.tieredMatrix` 생성

## 현재 기본 출력 키

현재 NameSpring이 받는 기본 `FortuneReport` top-level key는 다음이다.

```txt
nameCompatibility
overviewSummary
lifeFortuneOverview
personality
strengthsWeaknesses
cautions
dailyFortune
weeklyFortune
monthlyFortune
yearlyFortune
lifeStageFortune
categoryFortunes
meta
```

opt-in을 켜면 여기에 `tieredMatrix`가 추가된다.

## tieredMatrix 구조

`tieredMatrix`는 3축 구조다.

```txt
period: life, today, thisWeek, thisMonth, thisYear
category: overall + 10개 분야
depth: brief, standard, expert
```

category 목록:

```txt
overall
wealth
health
academic
romance
family
career
study_document
expression_children
health_stress
movement
```

한 cell의 구조:

```ts
interface TieredFortune {
  meaningfulness: 'meaningful' | 'limited' | 'na';
  stars: 1 | 2 | 3 | 4 | 5 | null;
  brief: {
    headline: string;
    hook?: string;
  };
  standard: {
    paragraphs: TaggedParagraph[];
    livingTips?: string[];
    cautions?: string[];
  };
  expert: {
    paragraphs: TaggedParagraph[];
    numericalEvidence?: NumericalEvidenceRow[];
  };
}
```

`brief`는 첫 화면용이다. 전문가 용어를 노출하지 않는다.

`standard`는 펼친 뒤 먼저 보여줄 일반 사용자용 상세다. 생활 조언, 주의점, 비유 중심이다.

`expert`는 사용자가 `전문가 근거` 버튼을 눌렀을 때만 보여준다. `#배우자궁`, `#식신` 같은 inline tag와 glossary가 여기에 들어간다.

## metadata 확인 기준

프론트는 아래 metadata를 QA와 fallback 판단에 사용한다.

```ts
interface TieredMatrixMeta {
  schemaVersion: 'spring-ts.tiered-matrix.v1';
  contentSource: 'placeholder' | 'authored';
  fragmentCount: number;
  aiGeneratedFragmentCount: number;
  templateContractVersion: string;
  selectionSeed: string;
  generatedAt: string;
}
```

권장 처리:

- `schemaVersion !== 'spring-ts.tiered-matrix.v1'`: 새 UI 렌더링 금지, legacy fallback
- `contentSource === 'placeholder'`: 내부 QA 또는 낮은 신뢰 badge
- `contentSource === 'authored'`: 서비스 렌더링 가능
- `tieredMatrix` 없음: 현재 legacy UI 그대로 렌더링
