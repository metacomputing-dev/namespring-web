# Phase 32 — Tier depth growth + brief tier richness + audit tooling

> 작성: 2026-05-07
> 목적: Phase 31 lock 위에 standard 4p band 추가 expansion + brief tier hook expansion + expert 6p tier 진입 + audit-tooling templating.

## 0. Context

Phase 31 완료 (PR #592-#597, 6/6):
- A1: 15 counterexample 남은 5 카테고리
- A2/A3: 24 livingTips 6 카테고리 일관성
- A4: 4p band 100→110
- A5: pre-merge baseline
- A6: final integration → 19/19 PASS

**현재**: 19 CI gates 0 violations. standard `{3:1328, 4:110, 5:267}`, expert `{4:1547, 5:147, 6:11}`. distinct hooks=60, max=17.

P31-A6 권고:
1. livingTips family/health 2-cat close-out
2. counterexample depth-vs-breadth pivot (한 카테고리 깊이)
3. audit-tooling templating (P*-A6 패턴)
4. 기타 25 carry-over (workflow YAML, 책 자료 등)

## 1. Safety invariants

- ../namespring/ 무수정
- API IMMUTABLE
- test:namespring-compat 202/202
- Phase 2 frozen contract 무수정
- Phase 3-31 hard contracts 유지 (19 CI gates)

## 2. Agent 분배 (5)

### P32-A1 — livingTips family + health (close-out)

**Owned**: family/health 의 livingTips polish (~10 cells)
**Target**: 9 카테고리 모두 livingTips polish 완료.

### P32-A2 — Standard 4p band +10 (110→120)

**Owned**: 3p only fragments 중 ~10 lift (P25/26/27/29/30/31 외)

### P32-A3 — Expert 6p tier 진입 (11→~20)

**Owned**: expert 5p fragments 중 ~10 lift to 6p (deeper insight, classical reference, cohort-specific)
**Target**: expert 6p band 11 → ~20.

### P32-A4 — Brief hook expansion 60 → ~70

**Owned**: brief.fragments.json 추가 hook fragments (~10)
**Target**: distinct hook 60 → ~70 (+10).

### P32-A5 — Phase 32 종합 audit

**Owned**: `artifacts/phase32-agent-a5/`

## 3. 검증 (각 PR)

```
npm run typecheck
npm run ci:no-ai-policy
npm run ci:narrative-voice
npm run ci:narrative-truncated-endings
npm run ci:narrative-tag-label-alignment
npm run ci:narrative-orphan-tags
npm run ci:narrative-cell-axis
npm run ci:narrative-density
npm run ci:narrative-tuple-density
npm run ci:narrative-daymaster-tuple-density
npm run ci:post-processor-grammar
npm run ci:hook-coverage
npm run ci:hook-concentration
npm run ci:standard-paragraph-floor
npm run ci:brief-tier-placeholder
npm run ci:flow-cluster
npm run ci:acceptance-completeness
npm run ci:samples-stale
npm run test:namespring-compat
```

## 4. Workflow

isolated worktree (`<phase>-<agent>-iso/`) → commit → push → PR → admin merge.

## 5. Out of scope (Phase 33+)

- 책 자료 ingestion
- workflow YAML ship (OAuth 13th carry-over)
