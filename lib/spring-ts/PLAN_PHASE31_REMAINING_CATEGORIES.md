# Phase 31 — 남은 카테고리 livingTips + counterexample + 추가 5p

> 작성: 2026-05-07
> 목적: P28-A1/A3 + P30-A2/A3 가 다룬 외 카테고리 (overall, study_document, expression_children, romance, health_stress) livingTips/counterexample polish + 추가 5p band.

## 0. Context

Phase 30 완료 (PR #586-#591):
- A1: 7 wealth 5p
- A2: 15 counterexample health/family/movement
- A3: 15 livingTips academic+career
- A4: 10 expert 5p (lift)
- A5: pre-merge baseline
- A6: final integration

**현재**: 19 CI gates 0 violations. 4p=100, 5p=267, expert 5p=147, distinct hooks=60.

남은 카테고리 (P28-A1/A3 + P30-A2/A3 외):
- counterexample 다양화: overall, study_document, expression_children, romance, health_stress
- livingTips 일관성: overall, family, expression_children, romance, study_document, health, health_stress, movement

## 1. Safety invariants

- ../namespring/ 무수정
- API IMMUTABLE
- test:namespring-compat 202/202
- Phase 2 frozen contract 무수정
- Phase 3-30 hard contracts 유지 (19 CI gates)

## 2. Agent 분배 (5)

### P31-A1 — counterexample 다양화 (남은 5 카테고리)

**Owned**: overall + study_document + expression_children + romance + health_stress 의 contrast clauses
**Target**: ~15 fragments paraphrase. P28-A1/P30-A2 패턴 따름.

### P31-A2 — livingTips 일관성 (overall + study_document)

**Owned**: overall/study_document 의 livingTips 5-period 일관성 polish (~12 cells)

### P31-A3 — livingTips 일관성 (expression_children + romance + health_stress + movement)

**Owned**: 4 카테고리 livingTips polish (~12 cells)

### P31-A4 — Standard 4p band 추가 +10 (100→110)

**Owned**: 3p only fragments 중 ~10 lift

### P31-A5 — Phase 31 종합 audit

**Owned**: `artifacts/phase31-agent-a5/`

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

## 5. Out of scope (Phase 32+)

- 책 자료 ingestion
- workflow YAML ship (OAuth)
