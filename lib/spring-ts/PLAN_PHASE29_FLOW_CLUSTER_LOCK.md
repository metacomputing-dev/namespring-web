# Phase 29 — flowCluster regression close + 19th CI gate

> 작성: 2026-05-07
> 목적: P28-A6 발견 flowCluster regression (0 → 15) close + 신규 ci:flow-cluster gate.

## 0. Context

Phase 28 완료 (PR #575-#580):
- A1: counterexample 다양화 20
- A2: expert 4p→5p 10 (BUT 흐름이 × 3 cluster 침범)
- A3: wealth livingTips 15
- A4: hook concentration max 18→17
- A5: pre-merge baseline
- A6: final integration → 18/18 PASS (BUT flowCluster 0→15 ungated discovery)

P28-A6 권고:
- **P29-A1**: reword 2 P28-A2 paragraphs (흐름이 × 3 cluster 제거)
- **P29-A2**: `ci:flow-cluster` gate 신설 (P15-A4 lock 데이터 측 enforcement)

## 1. Safety invariants

- ../namespring/ 무수정
- API IMMUTABLE
- test:namespring-compat 202/202
- Phase 2 frozen contract 무수정
- Phase 3-28 hard contracts 유지 (18 CI gates 0 violations)

## 2. Agent 분배 (5)

### P29-A1 — flowCluster reword (15 → 0)

**Owned**:
- `lib/spring-ts/data/narrative/family/life/expert.fragments.json` (`young_caregiver.008` 5p)
- `lib/spring-ts/data/narrative/overall/life/expert.fragments.json` (`strong.neutral.005` 5p)
- 추가로 흐름이 × 3 cells 발견시 그 cell
- `lib/spring-ts/artifacts/phase29-agent-a1/audit-2026-05-07.md`

**Target**: flowCluster.totalCells 15 → 0.

**Approach**:
1. 두 P28-A2 5p paragraphs read → `흐름이` 위치 식별
2. 3회 → 1-2회 reword (`흐름이`/`결이`/`리듬이` 어휘 다양화)
3. P15-A4 lock 의도 보존 (`흐름이` ≥ 3 in single paragraph 금지)
4. Sample regen → flowCluster 측정

### P29-A2 — `ci:flow-cluster` gate

**Owned**:
- `lib/spring-ts/tools/check_flow_cluster.mjs` (신규)
- `lib/spring-ts/package.json` (script)
- `lib/spring-ts/tools/acceptance-manifest.json` (entry)
- `lib/spring-ts/artifacts/phase29-agent-a2/audit-2026-05-07.md`

**Target**: `흐름이` ≥ 3 in single paragraph 0 violations enforce.

**Approach**:
1. P21-A2 의 `audit-phase12.mjs` flowCluster detector 알고리즘 read
2. 같은 detection logic 으로 standalone CI gate 작성
3. `--max-violations=0` ratchet
4. acceptance-manifest 추가
5. P29-A1 머지 후 0 violations 통과

### P29-A3 — gyeolCluster 9 final reduction (또는 hold confirm)

**Owned**:
- `lib/spring-ts/data/narrative/wealth/thisMonth/standard.fragments.json` (5 hold cells)
- `lib/spring-ts/data/narrative/career/today/standard.fragments.json` (4 hold cells)
- `lib/spring-ts/artifacts/phase29-agent-a3/audit-2026-05-07.md`

**Target**: gyeolCluster 9 → ≤6 또는 진정한 hold confirm (P25-A1 가 이미 hold confirmed 했지만 의미 다양화 한번 더 검토).

**Approach**:
1. 9 cells 의 결-bearing lexeme 분포 다시 read
2. 어휘 진정 다양 (`결산`/`결정`/`한결`) → hold 보존
3. paraphrase 가능 cell 식별 (예: 의미 보존 가능한 일부)
4. 6 cells 정도로 reduce (또는 hold confirm)

### P29-A4 — Standard 4p band recovery (95 → ~110)

**Owned**:
- `lib/spring-ts/data/narrative/<cat>/<period>/standard.fragments.json` (3p only 중 새로운 ~15)
- `lib/spring-ts/artifacts/phase29-agent-a4/audit-2026-05-07.md`

**Target**: P26-A2/P27-A3 후 4p band 95 (P26-A2 +20, P27-A3 −10). 다시 ~110 회복.

**Approach**: P25-A2/P26-A2 패턴.

### P29-A5 — Phase 29 종합 audit

**Owned**: `artifacts/phase29-agent-a5/`
**Target**: pre-merge baseline.

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
npm run ci:flow-cluster   # 신규 P29-A2
npm run ci:acceptance-completeness
npm run ci:samples-stale
npm run test:namespring-compat
```

## 4. Workflow

isolated worktree → commit → push → PR → admin merge.

## 5. Out of scope (Phase 30+)

- 책 자료 ingestion
- workflow YAML ship (OAuth 12th carry-over)
