# Phase 5 — Final Prose Audit Report (P5-A5)

> 작성: 2026-05-05
> 작성자: Agent P5-A5 (claude-opus-4-7[1m])
> Plan reference: `lib/spring-ts/PLAN_PHASE5_DEFERRED_RESOLUTION.md` §2 P5-A5

## 0. Summary

| 영역 | 결과 |
|---|---|
| sample fixtures | 15 → **22** (신규 7 추가) |
| prose units audited | **6,686** units / **453,986** ko |
| broken endings | **0** |
| voice violations (~다 declarative) | **0** |
| tag/glossary mismatches | **0** |
| depth coherence (high-priority) | **3** ratio=1.0 brief↔standard 일치 (fragmentId 명시) |
| length violations (P5-A1/A2 territory) | 565 (livingTips 492, cautions 73) |
| audience safety finding | **1** 어린이 fixture legacy lifePeriodInfluence 에 성인 어휘 잔존 |
| 신규 fixture 안전성 | **22/22 fixture, 모든 acceptance test PASS** |

## 1. Task 1: 7 신규 fixture 추가 (15→22)

```
16 choi-senior-male              1948-03-15  남성  70+ life-stage 후반
17 kim-senior-female             1950-08-20  여성  70+ 시니어 여성
18 lee-child-male                2020-06-10  남아  0-9 child fallback
19 gyeokguk-conflict-jeonggwan-vs-bigyeop  격국 후보 충돌 case 1
20 gyeokguk-conflict-consensus-aware       격국 충돌 + consensus_aware
21 multi-axis-evaluator-enabled  evaluatorMode=multi_axis 활성
22 low-confidence-yongshin       consensus_aware + chengbai_strict 결합
```

각 fixture description Korean 설명 + 의도 명시. 출력 정상 (각 ~412-426 KB).

## 2. Task 2: 22 fixture × prose audit

### 2.1 Audit infrastructure

`extract-prose.mjs` → fixture JSON walker, 6,686 units → `prose-flat.ndjson`
`audit-prose.mjs` → 6 카테고리 audit → `audit-findings.json`

각 unit 은 `{fixture, period, category, depth, slot, fragmentId, text}` 메타로
원본 fragment 위치 추적 가능.

### 2.2 Findings

#### a) Broken endings — **0** ✓

Phase 4 commit history (`b866349`, `2d8b068`, `ead2582` 등) 가 깨끗하게
정리. dangling stems, 미완성 quotation, 결이에요 leftover 의 broken-ending 은 0.

> 초기 audit 의 false-positive (`결이에요.` 종결 brief headline 43건) 는
> `template-engine.ts:727-748 compressBriefHeadlineIfApplicable` 의 의도된
> 28-ko 압축 reverse 임을 source 추적으로 확인. issue 가 아니다.

#### b) Voice 위반 — **0** ✓

bare `~다` declarative 종결 0. `~ㅂ니다 / 습니다` 합쇼체 (정중-격식체) 73건은
NARRATIVE_STYLE_GUIDE 의 격조 있는 audience tone 에 정상 부합. 친근체와 합쇼체
가 한 paragraph 내에서 mix 되는 case 0건.

#### c) Tag/glossary 매칭 — **0 mismatch** ✓

22 fixture 모두 `tieredMatrix.glossary.usedInThisReport` 의 모든 tagId 가
`glossary.entries` 에 등록되어 있음.

#### d) Depth coherence — **3 priority finding**

brief 와 standard 첫 문장 100% 일치 (ratio=1.0). 각 brief↔standard 짝의
fragmentId NNN suffix 가 같음:

1. `expression_children.thisMonth.brief.10_19.003` ↔ `expression_children.thisMonth.standard.10_19.003`
2. `health.thisYear.brief.child.001` ↔ `health.thisYear.standard.child.001`
3. `expression_children.life.brief.40_54.006` ↔ `expression_children.life.standard.40_54.006`

같은 author wave 가 짝을 이루어 작성하면서 첫 문장을 그대로 재사용한 구조이다.

**권장**: source narrative 3 파일에서 brief headline 을 더 압축된/다른 시점의
한 문장으로 reauthor (예: 결과를 강조 / 비유를 다르게 변주).

추가 22건 (ratio 0.75-0.95) 은 brief 가 standard 첫 문장의 prefix 형태로
되어 있는 design pattern. contract intent 와의 합의 후 일괄 처리 권장.

#### e) Cross-element metaphor — **66 surface, ~5-10 의심**

heuristic 기반 surface 의 한계 — 일반 동사가 element token 으로 오인식.
실제 mix 의심 fragment **5-10 건** (FIRE+WATER+WOOD 3건 + 5원소 1건 우선).

#### f) Length violations — **565 (P5-A1/A2 territory)**

Phase 5 plan §0 의 829 livingTips / 137 cautions soft contract violations
가 fixture 측에서 어떻게 표면화되는지 cross-reference 데이터:

```
slot           depth     count   range
livingTips     standard    492   25-39 ko
cautions       standard     73   31-42 ko
```

P5-A1 (livingTips ≤24 ko) / P5-A2 (cautions ≤30 ko) owner 가 narrative
source 수정으로 처리. 본 audit 은 측정 데이터만 제공.

## 3. Task 3: legacy NameSpring 호환 audit

`legacy-comparison-2026-05-05.md` 참고. 결론:
- legacy prose 220 units **uniformly 친근체**
- bare 다 종결 0건, formal 합쇼체 종결 0건
- tieredMatrix 와의 cross-reference 일관성 OK

**1 finding** — fixture 18 (lee-child-male, 2020) 의 legacy
`nameCompatibility.lifeFrame.frames[].lifePeriodInfluence` 에 청년/중년기
narrative 가 audience-gating 없이 일관 출력되어 `승진 / 투자 / 사회적 입지` 등
성인-life 어휘가 어린이 fixture 에 leak. seed-ts/`fourframe-card` 영역의
audience-gating 작업 (Phase 6 audience-gating 후보) 으로 권장 기록만 한다 —
본 P5-A5 의 owned scope (`data/narrative/**`, src/, test/, tools/, ../namespring/,
../saju-ts/, ../seed-ts/ forbidden) 외부.

## 4. Acceptance criteria 검증

```
$ npm run typecheck                  PASS
$ npm run ci:no-ai-policy            PASS (fixtureFiles=429)
$ npm run test:namespring-compat     202/202 PASS
```

## 5. 다음 wave 권장 (Phase 6+)

### 5.1 즉시 실행 가능 (small batch)
- **3 brief↔standard duplication** 수정 (ratio=1.0)
- **5-10 cross-element metaphor 의심** 수동 review (FIRE+WATER+WOOD 3건 우선)

### 5.2 P5-A1/A2 직접 처리
- livingTips 492 violations (fixture-visible) → narrative source 측 829 violations 정리
- cautions 73 violations (fixture-visible) → narrative source 측 137 violations 정리

### 5.3 추가 fixture audit 영역 (Phase 6 후보)
- `getNameCandidateSummaries` 의 candidate brief prose (fixture 07)
- `getSpringReport.namingExplanation.summary/details/tradeoffs` prose (fixture 03)
- spring-evaluator 의 reasonings prose (현재 audit 미포함)
- seed-ts `fourframe-card.lifePeriodInfluence` audience-gating (어린이 fixture 18 leak 출처)

### 5.4 brief 압축 contract 명시
`compressBriefHeadlineIfApplicable` 의 `흐름이에요 → 결이에요` reverse 가
NARRATIVE_STYLE_GUIDE 에 explicit 기록되어 있는지 확인 권장. 그래야 외부 자
가 broken ending 으로 오인하지 않음.

## 6. Deliverables

```
artifacts/phase5-prose-audit/
  ├── extract-prose.mjs           ← prose 추출 helper
  ├── audit-prose.mjs             ← 카테고리 audit helper
  ├── prose-flat.ndjson           ← 6,686 units flat data
  ├── audit-findings.json         ← categorized findings
  ├── audit-2026-05-05.md         ← 22 fixture × prose audit doc
  ├── legacy-comparison-2026-05-05.md  ← legacy NameSpring 호환 fixture audit
  └── PHASE5_PROSE_FINAL.md       ← 본 final report
```

## 7. 안전 invariant (Phase 5 plan §1) 확인

- `../namespring/` 절대 무수정 ✓
- API IMMUTABLE ✓
- `test:namespring-compat 202/202` PASS 유지 ✓
- 새 default flip 0건 ✓
- Phase 2 frozen contract `_contract/v1.json` 무수정 ✓
- brief.headline ≤28 ko 0 violations 유지 ✓
- broken endings 0 유지 ✓
