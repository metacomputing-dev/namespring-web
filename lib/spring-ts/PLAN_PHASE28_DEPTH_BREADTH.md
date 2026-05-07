# Phase 28 — Narrative depth + breadth + counterexample richness

> 작성: 2026-05-07
> 목적: Phase 27 lock 위에 narrative depth (counterexample), breadth (additional periods/cohorts), expert tier polish.

## 0. Context

Phase 27 완료 (PR #569-#574, 6/6):
- A1: hook richness 48→60
- A2: dormant hook 1→0
- A3: 5p band +10 (247→257)
- A4: standard 첫 문장 marginal 75 hits cleared
- A5: pre-merge baseline
- A6: final integration → 18/18 PASS

P27-A6 권고 (Phase 28+):
- 책 자료 ingestion (추명가 60 cases 등)
- 전문가 narrative depth full upgrade
- workflow YAML 11th carry-over (OAuth)

## 1. Safety invariants

- ../namespring/ 무수정
- API IMMUTABLE
- test:namespring-compat 202/202
- Phase 2 frozen contract 무수정
- Phase 3-27 hard contracts 유지 (18 CI gates 0 violations)
- gyeolCluster=9 hold

## 2. Agent 분배 (5)

### P28-A1 — Counterexamples 어조 + 다양화

**Owned**: `data/narrative/<cat>/<period>/standard.fragments.json` 의 counterexamples 영역만 (다른 paragraphs 무수정)
**Target**: 32 fixtures × 5 periods × 11 categories 의 counterexample (기존) 어조 일관 + 일부 cell 의 counterexample 다양화 (~20 fragments).
**Approach**: 
1. P5/P7-A5 era counterexample audit 결과 read (있으면)
2. counterexamples 의 "X 가 아니라 Y" 패턴 검토:
   - 동일 어조 반복 → 다양화
   - 어색한 negation → polish
3. 20 fragments 의 counterexample paraphrase

### P28-A2 — Expert tier paragraph diversity (4 → 5-6 fragments)

**Owned**: `data/narrative/<cat>/<period>/expert.fragments.json` (4-paragraph cells 중 ~10)
**Target**: expert tier 의 4-paragraph cells 일부에 5-6번째 paragraph 추가 (전문가 narrative depth)
**Approach**:
1. expert.fragments.json 의 paragraph 분포 측정
2. 4p cells 중 의미있는 5-6p 확장 후보 ~10 fragments 선별
3. 추가 paragraph: deeper insight (격국/십성 detail / classical reference / cohort-specific)

### P28-A3 — Multi-period continuity (livingTips 일관성)

**Owned**: `data/narrative/<cat>/<period>/standard.fragments.json` 의 livingTips 영역만
**Target**: 한 카테고리 내 다른 period (today→thisWeek→thisMonth→thisYear→life) livingTips 의 어조/스타일 일관성. 어색한 분기 polish.
**Approach**:
1. 카테고리 별 5 period livingTips 비교
2. 어색한 일관성 부족 cell ~15 polish
3. brief headline / standard paragraphs 무수정

### P28-A4 — Hook concentration redistribution (max 18 → ≤16)

**Owned**: `data/narrative/<cat>/<period>/brief.fragments.json` (hook gating 의 redistribution)
**Target**: max concentration 18 → ≤16 (margin 4 vs threshold 20). `28-jonggyeok-jonggang` fixture 의 hook 중 일부를 다른 fixture 쪽으로 redistribute. 

**Approach**:
1. P27-A6 snapshot 의 fixture-별 hook count 분포 read
2. 18 hook 가지는 fixture 의 가장 narrow gating fragment 의 gating 완화 (다른 fixture 도 매칭)
3. 또는 다른 fixture 에 sibling fragment 추가
4. ci:hook-concentration max 측정

### P28-A5 — Phase 28 종합 audit

**Owned**: `artifacts/phase28-agent-a5/`
**Target**: P28-A1~A4 후 metric snapshot. 18 CI gates 모두 0 violations 유지.

## 3. 검증

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
npm run ci:acceptance-completeness
npm run ci:samples-stale
npm run test:namespring-compat
```

## 4. Workflow

isolated worktree (`<phase>-<agent>-iso/`) → commit → push → PR → admin merge.

## 5. Out of scope (Phase 29+)

- 책 자료 ingestion (별도 phase 와 별도 결정)
- workflow YAML ship (OAuth 11th carry-over)
