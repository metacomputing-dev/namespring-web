# Phase 26 — Narrative breadth expansion

> 작성: 2026-05-07
> 목적: Phase 25 lock 위에 narrative breadth 확장. Hook safety margin, standard tier band diversification.

## 0. Context

Phase 25 완료 (PR #558-#562):
- A1: gyeolCluster 9 hold + samples reconcile (build-determinism issue 닫음)
- A2: standard 4p band +12 (83→95)
- A3: hook fragility tail audit (5 hold, audit-only)
- A4: workflow YAML 8th carry-over instructions
- A5: 종합 audit (1/18 FAIL → P25-A1 가 0 으로 닫음)

P25-A3 권고 (Phase 26):
- `family.today` / `romance.thisYear` / `study_document.today` 영역의 sibling brief.hook fragment 추가 — emit count tail 의 safety margin 확대

P25-A5 권고 (Phase 26+):
- Hook fragility tail expansion (5→9 fragments at emit ≤4 — Phase 25 후 늘어났으니 또 검토)
- brief tier hook expansion 34 → ~50

## 1. Safety invariants

- ../namespring/ 무수정
- API IMMUTABLE
- test:namespring-compat 202/202
- 새 default flip 0건
- Phase 2 frozen contract 무수정
- Phase 3-25 hard contracts 유지 (18 CI gates 0 violations)

## 2. Agent 분배 (5)

### P26-A1 — Hook fragility safety margin (sibling brief.hook authoring)

**Owned**:
- `lib/spring-ts/data/narrative/family/today/brief.fragments.json` (sibling young.* fragment 추가)
- `lib/spring-ts/data/narrative/romance/thisYear/brief.fragments.json` (sibling midlife.* 추가)
- `lib/spring-ts/data/narrative/study_document/today/brief.fragments.json` (sibling adult.* 추가)
- `lib/spring-ts/artifacts/phase26-agent-a1/audit-2026-05-07.md`

**Target**: 3 영역에 2-3 sibling brief.hook fragment 추가 (총 6-9 fragments). emit count tail 의 over-reliance 완화.

**Approach**:
1. 기존 fragility tail fragments read (P25-A3 hold list):
   - `family.today.brief.young.003`
   - `romance.thisYear.brief.midlife.001`
   - `study_document.today.brief.adult.005`
2. 동일 ageBand 의 sibling fragment 1-2개 추가 (variety 확보):
   - `family.today.brief.young.004` / `005`
   - `romance.thisYear.brief.midlife.002` / `003`
   - `study_document.today.brief.adult.006`
3. 의미 다양화 — 동일 톤 변형, 다른 시각
4. Sample regen → emit distribution 측정. tail fragments 의 emit count 분산
5. ci:hook-coverage / hook-concentration 무위반

### P26-A2 — Standard 4p band 추가 expansion

**Owned**:
- `lib/spring-ts/data/narrative/<cat>/<period>/standard.fragments.json` (3p only 중 새로운 ~15-20 fragments)
- `lib/spring-ts/artifacts/phase26-agent-a2/audit-2026-05-07.md`

**Target**: 4p band 95 → ~115 (+20).

**Constraint**: ≤300 LOC commit (P22-A1 fragment authoring + P25-A2 expansion 패턴 따름).

**Approach**:
1. P25-A2 가 `ct=1` band 만 lift — `ct=2-3` band 도 후보 (한 fragment 가 2-3 cells emit, 영향 더 큼)
2. 후보 fragments 선별 (현재 3p 중 ct≥2):
   - 의미적으로 4p 가 자연스러운 fragment (expert tier 와 차이가 큰 cell)
3. 4번째 paragraph 추가 (비유/실천/맥락)
4. Sample regen → histogram 측정
5. Validation 기존 동일

### P26-A3 — 5p band exploration

**Owned**:
- `lib/spring-ts/data/narrative/<cat>/<period>/standard.fragments.json` (4p 중 ~5-10 fragments)
- `lib/spring-ts/artifacts/phase26-agent-a3/audit-2026-05-07.md`

**Target**: 5p band 237 → ~250 (+10-13). 4p fragment 중 의미있는 일부에 5번째 paragraph 추가.

**Approach**:
1. 4p fragments 중 5번째 단락이 의미있을 fragment 선별 (~10):
   - paragraphs 가 짧은 cell (총 80자 미만 인 cell 도)
   - expert tier 가 길어서 standard 5p 가 자연스러운 cell
2. 5번째 paragraph 추가 (counterexample variant 또는 deeper insight)
3. Sample regen
4. histogram delta 측정
5. ci:samples-stale 0 유지

### P26-A4 — Brief tier hook expansion (34 → ~42)

**Owned**:
- `lib/spring-ts/data/narrative/<cat>/<period>/brief.fragments.json` (hook 추가 fragment ~8개)
- `lib/spring-ts/artifacts/phase26-agent-a4/audit-2026-05-07.md`

**Target**: distinct hook 34 → ~42 (+8).

**Approach**:
1. 현재 34 distinct hooks 분포 read
2. 부족한 axis (예: youth × thisWeek, elder × today 등) 식별
3. 8 fragment 추가 (각 fragment 가 distinct hook 가지면 +8)
4. ci:hook-coverage / concentration 무위반 (max ≤20, dormant=0)
5. ci:hook-concentration max 가 15 → ~17 까지 가능 (margin 5 안에)

### P26-A5 — Phase 26 종합 audit

**Owned**: `artifacts/phase26-agent-a5/`
**Target**: P26-A1~A4 후 metric snapshot. 18 CI gates 모두 0 violations 유지.

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
npm run ci:acceptance-completeness
npm run ci:samples-stale
npm run test:namespring-compat
```

## 4. Workflow

worktree branch (isolated `<phase>-<agent>-iso/` 권장) → commit → push → PR → admin merge.

## 5. Out of scope (Phase 27+)

- 책 자료 ingestion (추명가 60 cases 등)
- 전문가 narrative depth full upgrade
- workflow YAML ship (OAuth carry-over)
