# 프론트엔드 UX 설계

## 목표

사용자는 어려운 용어 없이 먼저 결과를 이해해야 한다.

기본 화면:

- 짧은 결론
- 별점 또는 흐름 강도
- 기간과 분야
- 쉬운 말의 한두 문장

펼친 화면:

- 일반 사용자용 상세가 먼저 보인다.
- 생활 팁과 주의점은 바로 이해되는 문장으로 보인다.
- 전문가 용어는 아직 숨긴다.

추가 버튼:

- `일반 상세`: 더 긴 일반 설명, 생활 팁, 주의점
- `전문가 근거`: 전문 용어, 태그, glossary, 수치 근거

## 화면 정보 계층

### 1단계: 통합 보고서 상단

기존 `이름 적합도 평가` 카드는 유지한다.

그 아래에 새 `운세 매트릭스` 섹션을 추가한다. 섹션은 기본으로 열어도 되지만, 내부 카드는 과밀하지 않게 한다.

권장 구성:

```txt
이름 적합도 평가
운세 매트릭스
  기간 선택: 인생 / 오늘 / 이번 주 / 이번 달 / 올해
  분야 선택: 총운 / 재물 / 건강 / 학업 / 연애 / 가족 / 커리어 / 문서학업 / 표현자녀 / 건강스트레스 / 이동변화
  선택된 카드
기존 상세 보고서
  필요 시 legacy 요약 또는 fallback으로 유지
```

### 2단계: 기간 선택

기간은 segmented control 또는 horizontal tabs로 둔다.

권장 label:

```js
const PERIOD_LABELS = {
  life: '인생',
  today: '오늘',
  thisWeek: '이번 주',
  thisMonth: '이번 달',
  thisYear: '올해',
};
```

`periodLabel`은 카드 subtitle로 사용한다. 예: `오늘 (5월 2일)`, `올해 (2026년)`.

### 3단계: 분야 선택

분야는 chip grid로 둔다. 모바일에서는 2열 또는 가로 스크롤이 안전하다.

권장 label:

```js
const CATEGORY_LABELS = {
  overall: '총운',
  wealth: '재물',
  health: '건강',
  academic: '학업',
  romance: '연애',
  family: '가족',
  career: '커리어',
  study_document: '문서/시험',
  expression_children: '표현/자녀',
  health_stress: '컨디션',
  movement: '이동/변화',
};
```

기존 UI는 5대 분야만 보여준다. 새 matrix는 10개 분야까지 있으므로 처음에는 5대 분야를 우선 노출하고, `더 보기` 또는 2번째 줄에 확장 분야를 배치하는 것이 좋다.

권장 첫 노출:

```txt
총운, 재물, 건강, 학업, 연애, 가족
```

확장 노출:

```txt
커리어, 문서/시험, 표현/자녀, 컨디션, 이동/변화
```

## 카드 동작

예: 사용자가 `올해` + `연애`를 선택한 경우

### 접힌 카드

보여줄 것:

- `CATEGORY_LABELS.romance`
- `periodLabel`
- `StarRating`
- `brief.headline`
- `brief.hook`이 있으면 작은 보조 문장

보여주지 않을 것:

- `expert.paragraphs`
- tag chip
- glossary
- `sourceTier`
- `T1_HYPOTHESIS`
- `배우자궁`, `식신`, `도화` 같은 전문 용어

### 펼친 카드 기본 상태

보여줄 것:

- `standard.paragraphs[].plainText`
- `standard.livingTips`
- `standard.cautions`
- 버튼 2개: `일반 상세`, `전문가 근거`

`standard`에는 tag가 없어야 한다. 혹시 token에 tag가 들어와도 이 화면에서는 tag chip으로 만들지 말고 plain text 또는 숨김 처리한다.

### 일반 상세 버튼

현재 `standard`가 이미 일반 상세 역할을 한다. 첫 구현에서는 `일반 상세` 버튼을 누르면 다음 정도만 확장해도 된다.

- 전체 standard paragraph
- 생활 팁 전체
- 주의점 전체
- legacy `categoryFortunes[category]`가 있으면 "기존 조언"으로 하단 보조 노출

### 전문가 근거 버튼

이 버튼을 눌렀을 때만 `expert`를 렌더링한다.

보여줄 것:

- `expert.paragraphs[].tokens`
- tag chip
- 클릭 가능한 glossary
- `expert.numericalEvidence`

tag chip 동작:

```txt
#배우자궁 클릭
  -> bottom sheet 또는 inline popover
  -> glossary.entries.baeujagung.brief 먼저 표시
  -> "자세히" 누르면 detailed 표시
```

## 기존 컴포넌트 재사용

현재 `CombiedNamingReport.jsx`에는 이미 사용할 수 있는 패턴이 있다.

- `CollapsibleCard`
- `CollapsibleMiniCard`
- `StarRating`
- `TimeSeriesChart`
- `DomainRadarChart`
- `openSections`, `openMini` state
- `useReportActions`
- `prepareBeforePrint`
- `restoreAfterPrint`

새 UI도 이 흐름에 맞춘다.

단, 현재 nested card가 이미 많으므로 새 구현에서는 카드 안에 또 무거운 카드 UI를 쌓기보다, 선택 panel + detail row 중심으로 밀도를 낮추는 것이 좋다.

## 추천 컴포넌트 분리

새 파일을 따로 만드는 것이 안전하다.

```txt
namespring/src/TieredFortuneMatrixReport.jsx
namespring/src/tiered-report-utils.js
```

컴포넌트 분리:

```txt
TieredFortuneMatrixReport
TieredPeriodTabs
TieredCategorySelector
TieredFortuneCellCard
TieredDepthControls
TaggedParagraph
GlossaryPanel
TieredMatrixDebugBadge
```

`CombiedNamingReport.jsx`는 너무 커져 있다. 새 matrix UI를 이 파일에 직접 계속 넣으면 유지보수가 어려워진다.

## 상태 설계

권장 state:

```js
const [selectedPeriod, setSelectedPeriod] = useState('today');
const [selectedCategory, setSelectedCategory] = useState('overall');
const [openCellKey, setOpenCellKey] = useState(null);
const [detailModeByCell, setDetailModeByCell] = useState({});
const [activeGlossaryTagId, setActiveGlossaryTagId] = useState(null);
```

cell key:

```js
const cellKey = `${selectedPeriod}:${selectedCategory}`;
```

detail mode:

```js
const DETAIL_MODE = {
  NONE: 'none',
  USER: 'user',
  EXPERT: 'expert',
};
```

기본값은 `none`이다. 카드를 펼치면 `standard` 일부 또는 전체를 먼저 보여주고, 버튼을 누르면 mode를 변경한다.

## meaningfulness 처리

```txt
meaningful
  정상 렌더링

limited
  별점과 문장은 보이되 "가볍게 참고하세요" 수준의 badge를 붙인다.

na
  분야 chip을 비활성화하거나, 카드 안에서 "이 조합은 별도 해석이 많지 않아요"로 처리한다.
```

`stars === null`이면 별점 컴포넌트에 0을 넘기지 말고 `해당 없음` badge를 보여준다.

## PDF/공유

기존 `useReportActions`는 PDF 저장 전 섹션을 강제로 펼치는 hook을 받는다.

새 matrix UI도 PDF 저장 시:

- 전체 기간/분야를 모두 펼치지는 않는다. 너무 길어진다.
- 현재 선택된 기간/분야의 `brief + standard`는 펼친다.
- `expert`는 사용자가 이미 열어 둔 경우만 포함한다.
- 또는 `PDF 상세 포함` 옵션을 나중에 추가한다.

첫 구현에서는 현재 선택 cell 기준으로 PDF를 만드는 것이 현실적이다.
