# Narrative Template DSL

> 대상: Phase 2 fragment 작성자 (10 카테고리 agent + specialized).
> 계약본: `data/narrative/_contract/v1.json` (frozen).

`brief/standard/expert` 텍스트는 enumeration이 아니라 **slot-filled template** 으로 작성된다. fragment-registry는 같은 (category, period, depth) cell에 여러 fragment 후보를 두고, fragment-selector가 사주 feature + selectionSeed로 결정성 있게 한 개를 고른다.

## 1. Fragment 파일 구조

`data/narrative/<owned-prefix>/<period>/<depth>.fragments.json` (또는 카테고리 디렉토리). 각 파일은 `{ schemaVersion, fragments: NarrativeFragment[] }`. JSON Schema: `test/baseline/schema/narrativeFragment.schema.json`.

## 2. Fragment 필드

| 필드 | 의미 |
|---|---|
| `fragmentId` | `<category>.<period>.<depth>.<gating-keys>.<NNN>` 형식. agent owned prefix 안에서 unique. |
| `axis` | `{ category, period, depth, tone? }` |
| `gating` | 모든 키 옵셔널. 배열에 들어 있는 값일 때만 매치. 빈 배열/없음 = wildcard. |
| `templateTokens` | text/slot/tag 토큰 배열. 본문. |
| `slots` | variant pool: `{ slotName: ["변형1", "변형2", ...] }` |
| `tags` | templateTokens 안 모든 tagId의 mirror (인덱스용) |
| `livingTips` | (standard) 1-N개 짧은 팁 |
| `cautions` | (standard) 1-N개 주의점 |
| `numericalEvidence` | (expert) `{ label, valueExpression, unit?, sourceTier }` |
| `aiGenerated`, `sourceTier` | NO_AI 마킹 (필수) |

### 2-1. numericalEvidence valueExpression

`numericalEvidence[].valueExpression`은 JavaScript가 아니라 안전한 경로 표현식이다. 현재 허용되는 형식은 `feature.<numericField>` 또는 `cell.<numericField>`이며, 숫자(`number`)로 해석되는 값만 `ExpertFortuneText.numericalEvidence`로 내려간다.

예:

```json
{
  "label": "현재 나이",
  "valueExpression": "feature.ageYears",
  "unit": "세",
  "sourceTier": {
    "tier": "T3_INTERNAL_ENGINE",
    "sourceType": "internal_scoring_policy",
    "sourceUrl": null,
    "accessedAt": "2026-05-02",
    "quoteShort": null,
    "humanInterpretation": "Resolved from deterministic spring-ts runtime output.",
    "copyrightNote": "No third-party prose copied.",
    "authorityTruthEligible": false
  }
}
```

`feature.gender`처럼 문자열인 값, `Math.random()` 같은 실행식, `__proto__`/`constructor`/`prototype` 경로는 모두 버린다.

## 3. 토큰 종류

```jsonc
{ "kind": "text", "value": "올해는 " }                     // 평범한 prose
{ "kind": "slot", "name": "action", "type": "verb" }       // 변형 풀에서 결정성 픽
{ "kind": "tag",  "tagId": "yongshin", "label": "용신" }    // 인라인 #태그
```

### 3-1. slot 타입

| `type` | 출처 |
|---|---|
| `verb` / `noun` / `adjective` / `phrase` | 같은 fragment의 `slots`에서 픽 |
| `periodLabel` | feature vector 자동 (`PeriodScopedFortunes.periodLabel`) |
| `elementName` / `elementMetaphor` | feature vector 자동 (일간 오행) |
| `tenGodName` | feature vector 자동 (지배 십성) |
| `ageLabel` | feature vector 자동 (`'청년기' | '장년기' | ...`) |
| `tipPhrase` / `cautionPhrase` | 같은 fragment의 `slots`에서 픽 |

### 3-2. tag 토큰 규칙

- `tagId`는 반드시 `data/narrative/_glossary/*.json` 에 등록된 ID여야 한다.
- 누락 시 `narrative-schema.test.ts` 가 FAIL.
- expert tier에서만 사용.
- 한 문단당 2-6개 권장, 30자당 최대 1개.

## 4. Gating 화이트리스트

| 키 | 허용값 |
|---|---|
| `gender` | `'male' | 'female' | 'neutral'` |
| `ageBand` | `'0-9' | '10-19' | '20-29' | '30-39' | '40-54' | '55-69' | '70+'` |
| `dayMasterStrength` | `'EXTREME_STRONG' | 'STRONG' | 'BALANCED' | 'WEAK' | 'EXTREME_WEAK'` |
| `yongshinAlignment` | `'aligned' | 'neutral' | 'conflicting'` |
| `dayMasterElement` / `yongshinElement` | `'WOOD' | 'FIRE' | 'EARTH' | 'METAL' | 'WATER'` |
| `gyeokguk` | 자유 문자열 (`saju.gyeokguk.type`) |

빈 배열 또는 키 부재 = wildcard (모든 값 매치).

## 5. Fallback chain

selector는 모든 gating 차원이 매치되는 fragment를 우선 찾는다. 매치 후보가 없으면 **leftmost 차원부터** 차례대로 wildcard로 완화한다. priority:

```
1. gender
2. ageBand
3. dayMasterStrength
4. yongshinAlignment
5. dayMasterElement
6. yongshinElement
7. gyeokguk
```

전체 wildcard에서도 후보가 없으면 cell `meaningfulness: 'na'`, `stars: null`. 즉 *어떤 셀이라도* 한 개의 wildcard fragment만 두면 'na'가 되지 않는다.

## 6. Selection seed

```
seedKey = fnv1a(`${birth.year}|${birth.month}|...|${birth.gender}|${targetDate.iso}|${category}|${period}|${depth}`)
selected = candidates[seedKey % candidates.length]
```

같은 입력 → 같은 fragment. A/B 실험 가능. seed key 자체는 `meta.selectionSeed`로 응답에 노출.

## 7. variant pool 활용 예시

```jsonc
{
  "fragmentId": "wealth.thisYear.brief.strong.aligned.30_39.male.001",
  "axis": { "category": "wealth", "period": "thisYear", "depth": "brief" },
  "gating": {
    "gender": ["male"], "ageBand": ["30-39"],
    "dayMasterStrength": ["STRONG"], "yongshinAlignment": ["aligned"]
  },
  "templateTokens": [
    { "kind": "text", "value": "올해는 " },
    { "kind": "slot", "name": "action", "type": "verb" },
    { "kind": "text", "value": " 흐름이에요." }
  ],
  "slots": {
    "action": ["뻗어가는", "다듬는", "차곡차곡 모이는", "단단해지는"]
  },
  "tags": [],
  "aiGenerated": true,
  "sourceTier": { "tier": "T1_HYPOTHESIS", "sourceType": "training_derived", ... }
}
```

같은 사주의 같은 cell이면 항상 `action` 슬롯이 같은 변형을 고른다 (결정성).

## 8. 검증

```bash
npx tsx test/integration/narrative-schema.test.ts
```

이 테스트가:
- 모든 fragmentId 패턴 검증
- 모든 tagId가 glossary에 존재
- aiGenerated/sourceTier 마킹
- coverage: 11 × 5 × 3 = 165 cell 모두에 ≥ 1 fragment

## 9. Phase 2 작업자 체크리스트

작성한 fragment마다:
- [ ] fragmentId가 owned prefix(`<카테고리>.*`) 안에 있는가
- [ ] axis가 카테고리 owner 매칭
- [ ] aiGenerated:true + sourceTier T1_HYPOTHESIS
- [ ] expert만 tag 토큰, brief/standard는 0 tag
- [ ] templateTokens 길이가 depth contract 부합 (brief 1-2문장, standard 3-7 문단, expert 4-8 문단)
- [ ] tagId가 glossary에 존재 (없으면 agent-11 glossary fill로 추가 의뢰)
