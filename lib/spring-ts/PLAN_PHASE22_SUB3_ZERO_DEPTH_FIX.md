# Phase 22 — sub-3 standard cells → 0 + depth_inversion 18 cells fix

> 작성: 2026-05-07
> 목적: P21-A4 권고 (Path A + B-extended) 실행 + P21-A2 depth_inversion 18 hits cleanup.

## 0. Context

Phase 21 완료 (PR #537-#541):
- A1: verb-form 연결 vocabulary consistency (29 → 0)
- A2: depth_inversion detector refresh → 18 real hits 발견
- A3: ci:hook-concentration gate (max=20)
- A4: 107 sub-3 cells investigation → Path A + B-extended 권고
- A5: 14/14 CI gates PASS first all-PASS pre-fix snapshot

Phase 22 핵심 작업:
- **107 sub-3 standard cells → 0** (Path A + B-extended)
- **18 depth_inversion cells rephrase** (P21-A2 발견)

## 1. Safety invariants

- ../namespring/ 무수정
- API IMMUTABLE
- test:namespring-compat 202/202
- 새 default flip 0건
- Phase 2 frozen contract 무수정
- Phase 3-21 hard contracts 유지 (모두 0 violations)
- brief tier 무regression — wealth.{today,thisMonth,thisYear}.brief 의 minor-gated fragment 부족 보완 필수

## 2. Agent 분배 (5)

### P22-A1 — src lift `MINOR_LIMITED_CATEGORIES` + brief tier delta 측정/회피

**Owned**: 
- `lib/spring-ts/src/report/tiered/build-tiered-matrix.ts:47-51, 332-335` (early-return + const 제거 ~9 LOC)
- 추가 wealth brief fragments (필요시) — `data/narrative/wealth/<period>/brief.fragments.json`
- `artifacts/phase22-agent-a1/audit-2026-05-07.md`

**Target**: src early-return 제거 후 brief tier 0 regression. Path A simulation: 75 → 23 wealth gap (P22-A3 가 처리).
**Approach**:
1. 사전 측정: lift 후 sample-outputs 의 wealth.{today,thisMonth,thisYear}.brief 가 PLACEHOLDER_BRIEF 로 regress 하는 cell 수 추정
2. wealth brief minor-gated fragment 부족 정확히 측정 (현재 0 인지, 다른 ageBand 가 매칭되는지)
3. 부족분 (예상 ~5-8 fragments) data-side authoring 으로 보완 (lift 와 같은 commit)
4. lift + brief 보완 후 sample regen → ci:samples-stale 0
5. Validation: brief tier 어떤 cell 도 PLACEHOLDER 안 가는지

### P22-A2 — 14 fallback fragments authoring (career/health_stress/health/overall)

**Owned**: 
- `data/narrative/career/<period>/standard.fragments.json` (4 periods × 0-9)
- `data/narrative/health_stress/<period>/standard.fragments.json` (2 periods × 0-9)
- `data/narrative/health/<period>/standard.fragments.json` (4 periods × 10-19)
- `data/narrative/overall/<period>/standard.fragments.json` (4 periods × 10-19)
- `artifacts/phase22-agent-a2/audit-2026-05-07.md`

**Target**: 32 fallback cells → 0
**Approach**:
1. P21-A4 audit 의 mapping 표 따라 14 fragment authoring (4 + 2 + 4 + 4 = 14)
2. 각 fragment ≥ 3 paragraphs, voice/age-appropriate (existing minor-gated standard fragments 의 톤 참고: `wealth.life.standard.10_19.010` 의 용돈/recording habits 식)
3. 평균 30-40 LOC/fragment, 약 420 LOC 총
4. gating.ageBand=['0-9'] 또는 ['10-19'] 명시 (passesMinorGuard 통과)
5. ci:narrative-voice / truncated-endings / glossary 등 무위반

### P22-A3 — 5 wealth-gap fragments authoring

**Owned**: 
- `data/narrative/wealth/<period>/standard.fragments.json` (5 cells × 0-9 ∪ 10-19)
- `artifacts/phase22-agent-a3/audit-2026-05-07.md`

**Target**: 23 wealth gap cells → 0 (Path A 잔여)
**Approach**: 
1. P21-A4 의 wealth gap 표 따라:
   - today × 0-9 ∪ 10-19 → 1 fragment (combined gating)
   - thisWeek × 0-9 → 1 (10-19 covered)
   - thisMonth × 0-9 ∪ 10-19 → 1
   - thisYear × 0-9 ∪ 10-19 → 1
   - life × 0-9 → 1 (10-19 covered)
2. 5 fragments ≈ 150 LOC
3. 청소년 친화 톤 (용돈, 저금, 기록 같은 어휘)

### P22-A4 — 18 depth_inversion cells rephrase

**Owned**: 
- `data/narrative/<cat>/<period>/standard.fragments.json` 의 18 cells 의 source fragments
- `artifacts/phase22-agent-a4/audit-2026-05-07.md`

**Target**: depth_inversion detector 18 → 0 (또는 ≤2)
**Approach**:
1. P21-A2 audit 의 18 hits 중 14 가 single shared `thisMonth/movement` template — 1 fragment fix 로 14 cells 처리
2. 나머지 4 single-fixture overlaps (`thisYear/career`, `thisMonth/expression_children`, `today/overall`, `today/academic`) 각 fragment 의 standard 첫 문장이 brief 와 너무 유사 → standard 첫 문장 paraphrase
3. brief 의 메시지 보존, standard 가 brief 를 단순 반복하지 않게 — 예: "[brief: 풍요로운 흐름 → standard: 그 풍요는 여러 형태로 다가옵니다 (확장된 시각)]"

### P22-A5 — Phase 22 종합 audit

**Owned**: `artifacts/phase22-agent-a5/`
**Target**: P22-A1~A4 후 metric snapshot.

## 3. 검증 (각 PR)

```
npm run typecheck
npm run ci:no-ai-policy
npm run test:tiered-isolation
npm run test:tiered-shape
npm run test:tiered-determinism
npm run test:narrative-schema:summary
npm run ci:narrative-voice
npm run ci:post-processor-grammar
npm run ci:hook-coverage
npm run ci:hook-concentration
npm run ci:acceptance-completeness
npm run ci:samples-stale
npm run test:namespring-compat   # 202/202
```

## 4. Workflow

worktree branch → commit → push → PR → admin merge.

## 5. 의존성

- P22-A1 depends on P22-A3 (wealth brief fragments authoring 일부 P22-A3 와 겹칠 수 있음 — 사전 분담)
  - 명시: P22-A1 은 brief tier 만 책임, P22-A3 는 standard tier 만
- P22-A2/A3/A4 는 독립
- P22-A5 는 모두 후 dispatch

## 6. Out of scope (Phase 23+)

- workflow YAML ship (OAuth)
- 책 자료 ingestion
- worktree contention root-cause
