# 구현 체크리스트

## FE-1. 요청 opt-in 추가

수정 파일:

```txt
namespring/src/App.jsx
```

현재:

```jsx
return {
  birth: base.birth,
  surname: base.surname,
  givenName: normalizedGivenName,
  options: base.options,
};
```

권장:

```jsx
function withTieredMatrixOption(options = {}) {
  return {
    ...options,
    precisionConfig: {
      ...(options.precisionConfig || {}),
      surfaceTieredMatrix: true,
    },
  };
}
```

그리고:

```jsx
return {
  birth: base.birth,
  surname: base.surname,
  givenName: normalizedGivenName,
  options: withTieredMatrixOption(base.options),
};
```

주의:

- `sajuTimePolicy`를 절대 덮어쓰면 안 된다.
- `precisionConfig`만 병합한다.
- 추천 이름 생성 요청에는 처음부터 켜지 않아도 된다. 통합 보고서 요청부터 켠다.

선택적으로 runtime flag를 둔다.

```js
const ENABLE_TIERED_MATRIX =
  import.meta.env.VITE_ENABLE_TIERED_MATRIX !== 'false';
```

초기 배포에서 문제가 생기면 Vercel env로 빠르게 끌 수 있다.

## FE-2. 데이터 접근 유틸 작성

새 파일:

```txt
namespring/src/tiered-report-utils.js
```

필요 함수:

```js
export function hasUsableTieredMatrix(report) {
  const matrix = report?.tieredMatrix;
  return Boolean(
    matrix
    && matrix.schemaVersion === 'spring-ts.tiered-matrix.v1'
    && matrix.meta?.schemaVersion === 'spring-ts.tiered-matrix.v1'
  );
}

export function getTieredCell(matrix, period, category) {
  const scoped = matrix?.periods?.[period];
  if (!scoped) return null;
  if (category === 'overall') return scoped.overall || null;
  return scoped.byCategory?.[category] || null;
}

export function getTieredStars(cell) {
  return typeof cell?.stars === 'number' ? cell.stars : null;
}
```

label map도 같은 파일에 둔다.

```js
export const PERIOD_ORDER = ['life', 'today', 'thisWeek', 'thisMonth', 'thisYear'];
export const CATEGORY_ORDER_PRIMARY = ['overall', 'wealth', 'health', 'academic', 'romance', 'family'];
export const CATEGORY_ORDER_EXTENDED = ['career', 'study_document', 'expression_children', 'health_stress', 'movement'];
```

## FE-3. TaggedParagraph 렌더링

전문가 근거에서만 tag chip을 활성화한다.

```jsx
function TaggedParagraph({ paragraph, glossary, onTagClick, enableTags = false }) {
  const tokens = Array.isArray(paragraph?.tokens) ? paragraph.tokens : [];

  if (!enableTags) {
    return <p>{paragraph?.plainText || tokens.map((token) => token.value || token.label || '').join('')}</p>;
  }

  return (
    <p>
      {tokens.map((token, index) => {
        if (token.kind !== 'tag') return <span key={index}>{token.value}</span>;
        const entry = glossary?.entries?.[token.tagId];
        return (
          <button
            key={index}
            type="button"
            onClick={() => onTagClick(token.tagId)}
          >
            #{entry?.label || token.label}
          </button>
        );
      })}
    </p>
  );
}
```

기본 화면과 일반 상세에서는 `enableTags=false`를 유지한다.

## FE-4. 새 matrix 컴포넌트 작성

새 파일:

```txt
namespring/src/TieredFortuneMatrixReport.jsx
```

props:

```ts
{
  matrix,
  legacyCategoryFortunes,
  legacyPeriodFortunes,
  defaultPeriod,
  defaultCategory
}
```

권장 default:

```js
defaultPeriod = 'today';
defaultCategory = 'overall';
```

렌더링 흐름:

```txt
1. Period tabs
2. Category chips
3. Selected cell card
4. Standard user detail
5. Expert evidence panel, only after button click
6. Glossary panel
```

## FE-5. CombiedNamingReport에 연결

수정 파일:

```txt
namespring/src/CombiedNamingReport.jsx
```

상단 import:

```jsx
import TieredFortuneMatrixReport from './TieredFortuneMatrixReport';
import { hasUsableTieredMatrix } from './tiered-report-utils';
```

렌더링 위치:

- `이름 적합도 평가` 바로 아래
- 기존 `총평 요약`, `기간 별 전체 운세`, `5대 분야별 운세`보다 위

권장:

```jsx
const hasTiered = hasUsableTieredMatrix(fortuneReport);
```

```jsx
{hasTiered ? (
  <TieredFortuneMatrixReport
    matrix={fortuneReport.tieredMatrix}
    legacyCategoryFortunes={fortuneReport.categoryFortunes}
    legacyPeriodFortunes={{
      daily: fortuneReport.dailyFortune,
      weekly: fortuneReport.weeklyFortune,
      monthly: fortuneReport.monthlyFortune,
      yearly: fortuneReport.yearlyFortune,
    }}
  />
) : null}
```

초기 PR에서는 기존 legacy 섹션을 그대로 둔다. 새 UI가 검증되면 다음 PR에서 중복되는 기간/분야 섹션을 줄인다.

## FE-6. fallback 규칙

fallback 우선순위:

```txt
1. tieredMatrix cell
2. legacy categoryFortunes 또는 daily/weekly/monthly/yearlyFortune
3. "아직 해석이 준비되지 않았어요" empty state
```

예:

```js
const romanceCell = getTieredCell(matrix, 'thisYear', 'romance');
const legacyRomance = legacyCategoryFortunes?.romance;
```

`romanceCell`이 `na`이면 legacy romance를 보조로 보여줄 수 있다.

## FE-7. QA 체크

브라우저에서 확인할 것:

- 통합 보고서 요청 payload에 `precisionConfig.surfaceTieredMatrix: true`가 들어가는지
- `fortuneReport.tieredMatrix.meta.contentSource === 'authored'`인지
- 기본 화면에 `#배우자궁`, `#식신`, `격국`, `용신` 같은 전문가 용어가 바로 보이지 않는지
- 연애운 chip을 눌렀을 때 brief가 먼저 보이는지
- 연애운 카드를 펼쳤을 때 standard가 먼저 보이는지
- `전문가 근거` 버튼 전에는 tag chip이 보이지 않는지
- `전문가 근거` 클릭 후 tag chip과 glossary가 작동하는지
- 모바일 폭에서 category chip text가 줄바꿈 또는 스크롤로 깨지지 않는지
- PDF 저장 시 현재 선택 cell이 누락되지 않는지

## FE-8. 추천 테스트

`lib/spring-ts`:

```bash
npm run typecheck
npm run test:tiered-shape
npm run test:tiered-determinism
npm run test:namespring-compat
```

`namespring`:

```bash
npm --prefix namespring run build
```

브라우저 확인:

```bash
npm --prefix namespring run dev
```

기본 URL:

```txt
http://localhost:5173/
```
