# Tiered Fortune Matrix Spec

> 작성: 2026-05-02
> 상태: Phase 2 fan-out 반영. authored fragment 풀 + placeholder fallback 동시 탑재.

`FortuneReport`의 새 옵셔널 필드 `tieredMatrix`가 도입되었다. **5 기간 × (1 총운 + 10 분야) × 3 depth** 의 입체적 운세 큐브를 노출하며, 기존 카드(`overviewSummary, dailyFortune, ..., categoryFortunes`)는 무수정으로 유지된다.

## 1. 활성화

```ts
const report = await engine.getFortuneReport({
  birth, surname, givenName,
  options: { precisionConfig: { surfaceTieredMatrix: true } },
});
report.tieredMatrix; // ← FortuneTieredMatrix
```

플래그가 미설정/`false`이면 `tieredMatrix === undefined`. NameSpring backward-compat 100%.

## 2. 매트릭스 구조

```
FortuneTieredMatrix
├─ schemaVersion: 'spring-ts.tiered-matrix.v1'
├─ periods (5)
│  ├─ life          → 인생 전체
│  ├─ today         → 오늘 (달력 기준)
│  ├─ thisWeek      → 이번 주
│  ├─ thisMonth     → 이번 달
│  └─ thisYear      → 올해
│     each:
│     ├─ periodLabel: "올해 (2026년)"
│     ├─ periodMeta:  { stems[], branches[], relativeNote }
│     ├─ overall:     TieredFortune          (총운)
│     └─ byCategory:  Record<10 categories, TieredFortune>
├─ glossary
│  ├─ entries: Record<TagId, GlossaryEntry>     // 전체 사전 (lookup)
│  └─ usedInThisReport: TagId[]                  // 이 보고서가 실제로 인용한 태그
└─ meta
   ├─ schemaVersion, generatedAt
   ├─ selectionSeed       // 결정성 입력 hash
   ├─ templateContractVersion
   ├─ contentSource: 'placeholder' | 'authored'
   └─ fragmentCount, aiGeneratedFragmentCount
```

### 2-1. namingEvidence

`namingEvidence`는 `precisionConfig.surfaceTieredMatrix === true`이고 실제 이름 평가가 함께 실행된 경우에만 붙는다. NameSpring의 기존 기본 경로에서는 `tieredMatrix` 자체가 `undefined`이므로 backward-compat 영향이 없다.

사격수리 프레임은 seed-ts의 `fourFrame` 분석을 그대로 근거로 삼는다.

| frameType | stage | label | 권장 활용 |
|---|---|---|---|
| `won` | `earlyLife` | 초년운 | 초년/초기 성장 흐름 |
| `hyung` | `youthLife` | 청년운 | 청소년-청년기 흐름 |
| `lee` | `middleLife` | 중년운 | 사회 활동기/중년 흐름 |
| `jung` | `lateAndTotal` | 말년/총운 | 말년 및 큰 총운 흐름 |

각 frame은 `strokeSum`, `element`, `polarity`, `luckyLevel`, `title`, `summary`, `lifePeriodInfluence`를 포함할 수 있다. UI는 이 값을 바로 점수처럼 크게 보여주기보다, life-stage 카드의 전문가 근거 또는 펼침 상세 근거로 쓰는 것이 안전하다.

## 3. Cell — `TieredFortune`

```
TieredFortune
├─ meaningfulness: 'meaningful' | 'limited' | 'na'
├─ stars:          1..5 OR null (when 'na')
├─ brief:    { headline, hook? }                              // 초중학생 1-2문장
├─ standard: { paragraphs[], livingTips?, cautions? }         // 풀어쓴 일반 5문단 내외
├─ expert:   { paragraphs[], numericalEvidence? }             // 학문적 + 인라인 #태그 + 결정적 숫자 근거
├─ axisStrength?:  SajuAxisStrengthMap                        // 4-tier hedge
└─ evidence?:      EvidenceRow[]                              // 카드와 동일 타입 재사용
```

UI는 셀 클릭 시 `brief → standard → expert` 순으로 펼치는 것을 권장한다. `expert`의 `paragraphs[].tokens[]`에 `kind: 'tag'` 토큰이 박혀 있고, 클릭 시 `glossary.entries[tagId]`를 표시한다.

`expert.numericalEvidence`는 fragment의 `numericalEvidence[].valueExpression`을 `feature.*` 또는 `cell.*` 숫자 경로로 해석한 결과다. 임의 실행식은 허용하지 않으며, 숫자로 해석되지 않는 값은 출력에서 제외된다.

### 3-1. depth contract

| depth | 대상 | 길이 | 톤 | 인라인 태그 |
|---|---|---|---|---|
| `brief` | 초·중학생 | 1-2문장 + headline ≤28자 | 간결, 구어체 | 없음 |
| `standard` | 일반 사용자 | ~3-7 문단 | 풀어쓴 일상 비유 + 팁/주의점 | 없음 |
| `expert` | 관심 사용자·전문가 | 4-8 문단 | 학문적, 격국·용신 어휘 | 2-6개/문단 |

### 3-2. meaningfulness 의미

| 값 | UI 권장 |
|---|---|
| `meaningful` | 정상 표시 |
| `limited` | 별점 강조 약하게 (회색조), "가벼운 흐름" |
| `na` | 셀 숨기거나 dim. `stars: null` |

## 4. 인라인 태그 시스템

`TaggedParagraph.tokens[]`는 `text` 또는 `tag` 토큰. char-offset이 아니라 **토큰 표현**이라 React escape/normalization에도 깨지지 않는다.

```jsx
{paragraph.tokens.map((tok, i) =>
  tok.kind === 'text'
    ? <span key={i}>{tok.value}</span>
    : <TagChip key={i} tagId={tok.tagId} label={tok.label}
                 onClick={() => showGlossary(glossary.entries[tok.tagId])} />
)}
```

`glossary.entries[tagId]`는 `brief`(초중학생) + `detailed`(비유 포함) 두 단계 정의를 제공.

## 5. 결정성

같은 `(birth, targetDate)` 입력 → 같은 fragment 선택 (FNV-1a 32-bit, `selectionSeed`로 고정). A/B 테스트와 사용자 신뢰의 기반.

## 6. 백엔드 구현 모듈 (`src/report/tiered/`)

| 모듈 | 역할 |
|---|---|
| `build-tiered-matrix.ts` | top orchestrator. opt-in 미설정 시 즉시 `undefined` 반환 |
| `feature-selector.ts` | `(saju, birth, targetDate) → FeatureVector` |
| `period-meta-builder.ts` | 5 기간별 라벨/기둥/원소 (기존 `fortuneCalculator` 재사용) |
| `cell-grader.ts` | 기존 `getFortuneGrade` wrap → stars + meaningfulness |
| `fragment-registry.ts` | `data/narrative/**/*.fragments.json` 인덱싱 + 메모이즈 |
| `fragment-selector.ts` | selectionSeed + fallback chain |
| `template-engine.ts` | slot resolve + ParagraphToken 변환 |
| `tag-inliner.ts` | `usedInThisReport` 수집 |
| `glossary-loader.ts` | `data/narrative/_glossary/*.json` 로드 |

## 7. NO_AI_POLICY 격리

narrative content는 모두 `data/narrative/**`. 모든 fragment/glossary는 `aiGenerated: true`, `sourceTier.tier = "T1_HYPOTHESIS"` 마킹. **scoring/judgment 코드는 import 금지**:
- `src/calculator/**`, `src/saju-*.ts`, `src/spring-engine.ts`, `src/spring-evaluator.ts`, `src/core/**`
- 자동 검증: `npm run test:tiered-isolation` (=`tiered-isolation-guard.test.ts`)
- AI 마커 검증: `npm run ci:no-ai-policy`

## 8. 검증

```bash
npm run typecheck
npm run ci:no-ai-policy
npx tsx test/integration/namespring-compat.test.ts          # negative + positive
npx tsx test/integration/tiered-matrix-shape.test.ts
npx tsx test/integration/tiered-matrix-determinism.test.ts
npx tsx test/integration/narrative-schema.test.ts
npx tsx test/integration/tiered-isolation-guard.test.ts
```

> **Placeholder fallback note**: 11×5×3 = 165개 stub fragment는 단일 번들 `data/narrative/_seed/placeholder.fragments.json`에 남아 있다 (생성: `tools/seed_placeholder_fragments.mjs`). fragment-registry는 `data/narrative/**/*.fragments.json` glob을 인덱싱하므로, authored tree와 `_seed` fallback layout이 동시에 존재해도 무관하다.

## 9. Phase 2 반영 상태

현재 브랜치는 Phase 2 fan-out 산출물을 포함한다.

- fragment bundle: 251개
- narrative fragments: 2,552개 (`_seed` placeholder 165개 + authored 2,387개)
- glossary entries: 130개
- `tieredMatrix.meta.contentSource`: authored fragment가 하나 이상 로드되면 `'authored'`
- expert depth `numericalEvidence`: 55/55 cell populated, 0 gap
- source-tier baseline: fragments `T1_HYPOTHESIS` 2,552개, numericalEvidence `T3_INTERNAL_ENGINE` 110개, authority-truth eligible 0개
- axis-pair density baseline: tracked pair missing combination 0개, thin combination 0개 (`npm run ci:narrative-density`)
- axis-tuple density baseline: tracked tuple missing combination 250개, thin combination 0개 (`npm run ci:narrative-tuple-density`)

`_seed/placeholder.fragments.json`은 authored pool이 비는 cell을 위한 안전 fallback으로 남겨 둔다. 자세한 분업 기록은 [PHASE2_AGENT_PARTITION.md](./PHASE2_AGENT_PARTITION.md).

## 10. Selected Fragment Trace

Each `TieredFortune` may include additive `selectedFragments` evidence:

```ts
selectedFragments?: {
  brief?: { fragmentId: string; gating: Record<string, string[]>; tags: string[] };
  standard?: { fragmentId: string; gating: Record<string, string[]>; tags: string[] };
  expert?: { fragmentId: string; gating: Record<string, string[]>; tags: string[] };
}
```

This field is for QA, expert-detail, and debug panels. Default user-facing UI can hide it. It lets frontend and content reviewers verify which authored fragment won after specificity filtering and deterministic selection.
