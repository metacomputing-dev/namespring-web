# Phase 30 — breadth + depth + paragraph variety balance

> 작성: 2026-05-07
> 목적: Phase 29 19 gates lock 위에 추가 narrative breadth + 5p band 확장 + counterexample 어조 다양화 + livingTips 다른 카테고리 일관성.

## 0. Context

Phase 29 완료 (PR #581-#585):
- A1: flowCluster 15→0
- A2: ci:flow-cluster gate (19th)
- A3: gyeolCluster 9 hold confirmed (mathematical proof)
- A4: 4p band 95→110
- A5: pre-merge baseline

**현재**: 19 CI gates 0 violations, 100% standard ≥3p, 60 distinct hooks, max=17, 4p=110, 5p=257.

## 1. Safety invariants

- ../namespring/ 무수정
- API IMMUTABLE
- test:namespring-compat 202/202
- Phase 2 frozen contract 무수정
- Phase 3-29 hard contracts 유지 (19 CI gates)

## 2. Agent 분배 (5)

### P30-A1 — Standard 5p band 추가 +10 (257 → ~267)

**Owned**:
- `lib/spring-ts/data/narrative/<cat>/<period>/standard.fragments.json` (4p 중 ~10 lift)
- `lib/spring-ts/artifacts/phase30-agent-a1/audit-2026-05-07.md`

**Target**: 5p band 257 → ~267 (+10).

### P30-A2 — Counterexample 어조 다양화 (다른 카테고리)

**Owned**:
- `lib/spring-ts/data/narrative/health/<period>/standard.fragments.json` 의 contrast clauses
- `lib/spring-ts/data/narrative/family/<period>/standard.fragments.json` 의 contrast clauses
- `lib/spring-ts/data/narrative/movement/<period>/standard.fragments.json` 의 contrast clauses
- `lib/spring-ts/artifacts/phase30-agent-a2/audit-2026-05-07.md`

**Target**: ~15 fragments 의 contrast/negation clauses 다양화. P28-A1 의 academic/career/overall/study_document/wealth 영역 외 카테고리.

### P30-A3 — livingTips 일관성 (academic + career)

**Owned**:
- `lib/spring-ts/data/narrative/academic/<period>/standard.fragments.json` livingTips
- `lib/spring-ts/data/narrative/career/<period>/standard.fragments.json` livingTips
- `lib/spring-ts/artifacts/phase30-agent-a3/audit-2026-05-07.md`

**Target**: ~15 cells polish — P28-A3 의 wealth 외 다른 카테고리 5-period 일관성.

### P30-A4 — Expert tier 추가 5p (10 → 더 늘림 또는 다른 cells)

**Owned**:
- `lib/spring-ts/data/narrative/<cat>/<period>/expert.fragments.json` (4p cells 중 ~10 lift, P28-A2 와 다른 cells)
- `lib/spring-ts/artifacts/phase30-agent-a4/audit-2026-05-07.md`

**Target**: expert 5p band 92 → ~102 (+10). flowCluster=0 hold (P29-A2 gate 가 enforce).

### P30-A5 — Phase 30 종합 audit

**Owned**: `artifacts/phase30-agent-a5/`

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

## 5. Out of scope (Phase 31+)

- 책 자료 ingestion
- workflow YAML ship (OAuth 12th carry-over)
