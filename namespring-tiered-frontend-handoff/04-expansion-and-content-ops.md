# 확장성과 텍스트 운영

## 현재 확장 가능한 축

현재 `tieredMatrix`는 다음 축으로 구성된다.

```txt
period: life, today, thisWeek, thisMonth, thisYear
category: overall + 10 categories
depth: brief, standard, expert
```

텍스트 선택 조건은 `lib/spring-ts/src/report/tiered/feature-selector.ts`의 `FeatureVector`가 담당한다.

현재 feature:

```ts
interface FeatureVector {
  dayMasterElement;
  dayMasterStrength;
  yongshinElement;
  heeshinElement;
  gishinElement;
  yongshinAlignment;
  gyeokguk;
  ageBand;
  agePhase;
  gender;
  birthSeason;
  currentSeason;
  dayMasterPolarity;
}
```

즉, 기억하신 대로 연령대와 성별은 이미 고려 축에 들어가 있다. 그 외에도 일간 오행, 신강/신약, 용신/희신/기신, 격국이 들어간다.

추가로 `agePhase`, `birthSeason`, `currentSeason`, `dayMasterPolarity`는 더 세밀한 문장 선택을 위해 추가된 authoring 축이다. 기존 `ageBand`는 그대로 유지하므로 현재 텍스트 데이터와 호환된다.

## 사격수리 근거 확장

`spring-ts`는 `precisionConfig.surfaceTieredMatrix === true`이고 이름 평가가 같이 실행된 경우 `tieredMatrix.namingEvidence`를 함께 내려줄 수 있다. 이 값은 `springReport.namingReport.analysis.fourFrame`에서 온 seed-ts 사격수리 근거이며, 크게 보는 초년/청년/중년/말년·총운 카드의 상세 근거로 쓰기 좋다.

```ts
type TieredNameFrameStage =
  | 'earlyLife'      // 원격: 초년운
  | 'youthLife'      // 형격: 청년운
  | 'middleLife'     // 이격: 중년운
  | 'lateAndTotal';  // 정격: 말년/총운
```

프론트엔드에서는 기본 화면에 사격수리 용어를 바로 노출하지 않는 것을 권장한다. 먼저 "초년에는 관계와 적응의 리듬을 천천히 잡는 편이에요"처럼 쉬운 요약을 보여주고, 사용자가 상세 버튼을 누르면 `strokeSum`, `element`, `polarity`, `luckyLevel`, `title`, `summary`, `lifePeriodInfluence`를 근거 패널에 표시한다.

## 현재 계약의 fallback 구조

`data/narrative/_contract/v1.json`에는 gating field whitelist와 fallback priority가 있다.

현재 whitelist:

```txt
gender
agePhase
ageBand
birthSeason
currentSeason
dayMasterPolarity
dayMasterStrength
yongshinAlignment
dayMasterElement
yongshinElement
gyeokguk
```

fallback은 특정 조건에 맞는 문장이 없을 때 조건을 하나씩 완화해서 가장 가까운 문장을 찾는 방식이다. 그래서 모든 조합을 완벽히 직접 작성하지 않아도 서비스가 비지 않는다.

## 더 많은 경우의 수를 추가할 수 있는가

가능하다. 다만 아무 필드나 바로 fragment에 추가하면 selector와 schema가 모르는 축이 되므로, 아래 순서로 추가해야 한다.

1. `FeatureVector`에 새 필드 추가
2. `buildFeatureVector()`에서 새 필드 계산
3. `data/narrative/_contract/v1.json`의 `gatingFieldWhitelist`에 추가
4. fragment schema에서 해당 gating field 허용
5. `fragment-selector`의 match/fallback priority에 추가
6. `narrative-schema.test.ts`에 검증 추가
7. 새 field를 쓰는 fragment bundle 작성
8. coverage matrix를 갱신

## 후보 확장 축

서비스 UX에서 실제로 필요할 가능성이 높은 축:

```txt
relationshipStatus
  single, dating, married, divorced, unknown

lifeStage
  student, earlyCareer, midCareer, seniorCareer, retired, unknown

readingIntent
  quick, decision, relationship, career, health, family, exam, move

birthTimeConfidence
  exact, approximate, unknown

nameEvaluationMode
  currentName, candidateName, comparison

localeTone
  plain, warm, concise, expert
```

주의:

- 민감한 개인정보 축을 늘리면 입력 UX와 개인정보 정책도 같이 봐야 한다.
- 결혼/이혼/건강 같은 축은 사용자에게 강제로 묻기보다 선택 입력으로 두는 것이 안전하다.
- "전문가 근거"는 depth이지 user type이 아니다. 일반 사용자도 원하면 볼 수 있어야 한다.

## 텍스트 데이터 운영 원칙

텍스트는 코드에 넣지 않는다.

위치:

```txt
lib/spring-ts/data/narrative/**
```

운영 원칙:

- `brief`: 첫 화면 문장. 어렵지 않고 짧아야 한다.
- `standard`: 일반 사용자 상세. 비유, 생활 팁, 주의점 중심.
- `expert`: 전문가 근거. inline tag와 glossary 사용 가능.
- 전문가 용어는 `expert`에만 둔다.
- `standard`에는 `#태그`를 넣지 않는다.
- 새 전문 용어는 반드시 `_glossary`에 entry를 추가한다.
- 모든 AI-derived 텍스트는 `aiGenerated: true`, `sourceTier.tier: T1_HYPOTHESIS`를 유지한다.

## 문서 업데이트 방식

앞으로 확장이나 텍스트 데이터를 추가할 때 이 폴더를 같이 업데이트한다.

권장 변경 기록:

```txt
namespring-tiered-frontend-handoff/
  README.md
  01-current-state-and-contract.md
  02-frontend-ux-plan.md
  03-implementation-checklist.md
  04-expansion-and-content-ops.md
  05-sample-output-choi-seongsoo.md
  changelog.md
```

추가할 수 있는 운영 문서:

```txt
coverage-matrix.md
  period x category x depth x gating coverage 요약

copy-style-guide.md
  brief/standard/expert 문체 규칙

glossary-review.md
  전문가 용어 추가/수정 기록
```

## 확장 전 반드시 확인할 테스트

```bash
npm run ci:no-ai-policy
npm run test:narrative-schema
npm run test:tiered-shape
npm run test:tiered-determinism
npm run test:tiered-isolation
npm run test:namespring-compat
```

프론트가 추가된 뒤에는:

```bash
npm --prefix namespring run build
```

그리고 브라우저에서 최소 세 입력을 본다.

```txt
1. 남성, 30-39세
2. 여성, 30-39세
3. 생시 미상 또는 보정 옵션 변화 케이스
```
