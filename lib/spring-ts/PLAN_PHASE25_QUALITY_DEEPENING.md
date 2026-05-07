# Phase 25 — Quality deepening + carry-over closure

> 작성: 2026-05-07
> 목적: Phase 24 의 18 CI gates lock 위에 narrative quality deepening + 7 consecutive carry-over (workflow YAML) 시도.

## 0. Context

Phase 24 완료 (PR #553-#557):
- A1: ci:standard-paragraph-floor gate (sub-3=0 lock)
- A2: ci:brief-tier-placeholder gate (PLACEHOLDER=0 lock)
- A3: gyeolCluster 12→9 (4 hold + 2 fragment paraphrase)
- A4: audience_leak 1→0
- A5: 종합 audit + 7 권고

P24-A5 권고 (Phase 25):
- **P25-A1**: gyeolCluster 9 hold cells 재검토
- **P25-A2**: standard paragraph 4-band expansion (selective)
- **P25-A3**: hook fragility tail (5 fragments at emit ≤4) gating review
- **P25-A4**: workflow YAML ship attempt (OAuth — 8th carry-over)
- **P25-A5**: Phase 25 종합 audit

## 1. Safety invariants

- ../namespring/ 무수정
- API IMMUTABLE
- test:namespring-compat 202/202
- 새 default flip 0건
- Phase 2 frozen contract 무수정
- Phase 3-24 hard contracts 유지 (sub-3=0, PLACEHOLDER=0, depth_inversion=0, 18 CI gates 0)

## 2. Agent 분배 (5)

### P25-A1 — gyeolCluster 9 hold cells 재검토

**Owned**:
- `lib/spring-ts/data/narrative/wealth/thisMonth/standard.fragments.json` (5 hold cells)
- `lib/spring-ts/data/narrative/career/today/standard.fragments.json` (4 hold cells)
- `lib/spring-ts/artifacts/phase25-agent-a1/audit-2026-05-07.md`

**Target**: 9 → ≤4 (hold lexically diverse only).

**Approach**:
1. P24-A3 가 hold 한 9 cells (5× wealth.thisMonth + 4× career.today) read
2. 어휘 분포 점검:
   - 진정 다양 (`결산`+`결정`+`한결` / `한결`+`결재`+`결정`) → hold
   - 하나 cell 안에 같은 lexical (`결정` × 2) → paraphrase
3. Cell 별 검토 + 의미 보존 paraphrase
4. Sample regen 후 gyeolCluster.totalCells 측정
5. Validation:
   ```
   cd lib/spring-ts
   npm run typecheck
   npm run ci:narrative-voice
   npm run ci:narrative-truncated-endings
   npm run ci:samples-stale
   npm run ci:standard-paragraph-floor
   npm run ci:brief-tier-placeholder
   npm run test:namespring-compat
   ```
6. Commit + push + return branch

### P25-A2 — standard paragraph 4-band expansion (selective)

**Owned**:
- `lib/spring-ts/data/narrative/<cat>/<period>/standard.fragments.json` (3p 만 가진 fragments 중 핵심 영역 선별)
- `lib/spring-ts/artifacts/phase25-agent-a2/audit-2026-05-07.md`

**Target**: 1385 / 1705 (81.23%) 의 3p cells 중 의미있는 영역 ~50-100 cells 를 4p 로 확장.

**Constraint**: ≤300 LOC commit 정책 (feedback memory). 한 phase 에서 큰 변화 금지.

**Approach**:
1. 어떤 3p fragment 가 실제로 4번째 단락이 의미있을지 식별 (예: `expert.tier` 비유 파트가 짧은 cell)
2. 4p 추가가 voice 중복 없이 가능한 최소 8-15 fragments 선별
3. 4번째 paragraph 추가 (100-180자, 비유/실천 팁/맥락 추가)
4. histogram delta 측정: 3p 1385 → ~1370, 4p 83 → ~98
5. Validation: ci:narrative-voice / truncated-endings 무위반

### P25-A3 — hook fragility tail gating review

**Owned**:
- `lib/spring-ts/data/narrative/<cat>/<period>/brief.fragments.json` (5 emit ≤4 fragments 의 gating 영역)
- `lib/spring-ts/artifacts/phase25-agent-a3/audit-2026-05-07.md`

**Target**: 5 fragility tail fragments 의 gating 검토. emit count 가 ≤4 인 이유 확인 (의도된 narrow gating? 또는 over-restriction?).

**P21-A4 finding**: `wealth.thisYear.brief.balanced.neutral.004` (emit count 2, BALANCED-only gating). 이건 의도된 narrow.

**Approach**:
1. P24-A5 snapshot 의 emit count ≤4 fragments 5개 식별
2. 각 fragment 의 gating 분석:
   - 의도된 narrow (e.g. BALANCED only) → hold + audit doc 명시
   - Accidental restriction → broaden
3. fix 가능한 fragment 만 gating 완화
4. Sample regen 후 hook concentration / coverage 영향 확인
5. Validation: ci:hook-coverage / hook-concentration 유지

### P25-A4 — workflow YAML ship attempt (OAuth)

**Owned**:
- `.github/workflows/spring-ts-samples-stale.yml` (신규) — OAuth 통과시
- 실패시 `lib/spring-ts/artifacts/phase25-agent-a4/audit-2026-05-07.md` 에 manual instruction
- 또는 `lib/spring-ts/CI_WORKFLOW_INSTRUCTIONS.md` (사용자가 직접 ship 하도록 instruction doc)

**Target**: 8th consecutive carry-over 종결 (OAuth scope 통과 또는 manual ship instruction).

**Approach**:
1. `.github/workflows/` 의 existing workflow 형식 read
2. `spring-ts-samples-stale.yml` draft (PR trigger + samples-stale 호출)
3. Push 시 OAuth 통과 시도
4. 실패시 instruction doc + draft yml 만 (artifacts/)

### P25-A5 — Phase 25 종합 audit

**Owned**: `artifacts/phase25-agent-a5/`
**Target**: P25-A1~A4 후 metric snapshot. 18+ CI gates 모두 0 violations 유지 확인.

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
npm run test:namespring-compat   # 202/202
```

## 4. Workflow

worktree branch → commit → push → PR → admin merge.

## 5. Out of scope (Phase 26+)

- 책 자료 ingestion (추명가 60 cases, 박재완 prose 등)
- 전문가 narrative depth full upgrade
- worktree contention root-cause
