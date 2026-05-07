# Phase 23 — sub-3 21 → 0 + brief PLACEHOLDER 8 → 0

> 작성: 2026-05-07
> 목적: P22-A6 audit 의 2 unmet acceptance criteria 종결.

## 0. Context

Phase 22 결과 (PR #542-#547):
- A1: src lift `MINOR_LIMITED_CATEGORIES` + 5 wealth.brief minor fragments
- A2: 14 minor-ageband fallback fragments (career/health_stress/health/overall)
- A3: 5 wealth-gap fragments
- A4: 18 depth_inversion → 0
- A5: pre-fix audit
- A6: post-fix audit + final regen → 16/16 gates PASS

**P22-A6 미달성**:
1. **sub-3 = 21** (target 0) — 13 romance × 5 minor fixtures + 8 study_document × 5 minor fixtures. 모두 paragraphCount=2 (3번째 문단 missing).
2. **brief PLACEHOLDER = 8** (regression from 0) — P22-A2 의 새 standard fragments (overall/health_stress) 이 P22-A1 lift 와 결합하여 brief tier 가 minor-band 후보 없어 PLACEHOLDER 로 fall through.

## 1. Safety invariants

- ../namespring/ 무수정
- API IMMUTABLE
- test:namespring-compat 202/202
- 새 default flip 0건
- Phase 2 frozen contract 무수정
- Phase 3-22 hard contracts 유지
- 16/16 CI gates 유지

## 2. Agent 분배 (5)

### P23-A1 — 8 brief PLACEHOLDER 닫기 (overall/health_stress brief minor)

**Owned**: 
- `data/narrative/overall/<period>/brief.fragments.json` (4 cells: today/thisWeek/thisMonth/thisYear × 0-9 minor)
- `data/narrative/health_stress/today/brief.fragments.json` (4 cells: 04/18/27/30/31 minor 매칭)
- `artifacts/phase23-agent-a1/audit-2026-05-07.md`

**Target**: brief PLACEHOLDER 8 → 0

**P22-A6 R2 enumeration**:
- 04 (10-19 teen) × overall × {today, thisWeek, thisMonth, thisYear}
- 18/27/30/31 (0-9 child) × health_stress × today

**Approach**:
1. 기존 brief minor-band fragment 톤 참고 (`wealth.life.brief` P22-A1 작성)
2. brief headline ≤28 자모, hook ≤24 자모
3. gating.ageBand=['0-9'] 또는 ['10-19'] 명시 (passesMinorGuard 통과)
4. 의미: overall = 하루의 흐름 / 일주일 / 한 달 / 한 해 의 큰 그림 (어린이/청소년 친화), health_stress = 잠/마음/긴장 (오늘 단위)

### P23-A2 — 13 romance × minor sub-3 닫기 (3rd paragraph)

**Owned**:
- `data/narrative/romance/<period>/standard.fragments.json` (romance × minor sub-3 cells)
- `artifacts/phase23-agent-a2/audit-2026-05-07.md`

**Target**: sub-3 of romance × minor 13 → 0

**P22-A6 R1 enumeration**:
- 04 × {life, today, thisWeek, thisMonth} (4 cells)
- 18 × {life, thisWeek, thisMonth} (3 cells)
- 27 × {life, thisWeek, thisMonth} (3 cells)
- 30 × {today, thisYear} (2 cells)
- 31 × {today, thisYear} (2 cells)

**Approach**:
1. 측정: 현재 emit 되는 fragment ID 확인 (어떤 fragment 가 minor 에 매칭되어 paragraphCount=2 인지)
2. 그 fragment 에 3번째 paragraph 추가 (또는 새 minor-band fragment 작성)
3. 어린이/청소년 친화 어휘 (친구/가족/기다림/마음 표현)

### P23-A3 — 8 study_document × minor sub-3 닫기 (3rd paragraph)

**Owned**:
- `data/narrative/study_document/<period>/standard.fragments.json` (study_document × minor sub-3 cells)
- `artifacts/phase23-agent-a3/audit-2026-05-07.md`

**Target**: sub-3 of study_document × minor 8 → 0

**P22-A6 R1 enumeration**:
- 04 × life (1 cell)
- 18 × {life, thisWeek} (2 cells)
- 27 × {life, thisWeek} (2 cells)
- 30 × today (1 cell)
- 31 × today (1 cell)
- 30 × thisYear / 31 × thisYear 등 (확인 필요)

**Approach**: P23-A2 와 동일 패턴.

### P23-A4 — measure_p22.mjs prose-corpus refresh fix

**Owned**:
- `lib/spring-ts/artifacts/phase21-agent-a5/measure_p21.mjs` 또는 `phase22-agent-a5/measure_p22.mjs` (corpus refresh logic)
- `lib/spring-ts/artifacts/phase23-agent-a4/audit-2026-05-07.md`

**Target**: measure script 가 stale corpus 못 읽도록 force-refresh 또는 mtime check.

**Approach**:
1. measure_p22.mjs read → corpus refresh logic 위치
2. P22-A6 가 발견한 issue: corpus 가 pre-regen 일 때 18 false report
3. 수정: 항상 `extract-prose.mjs` 재실행 또는 sample mtime > corpus mtime 체크

### P23-A5 — Phase 23 종합 audit + final regen

**Owned**: `artifacts/phase23-agent-a5/`, sample regen 영역.
**Target**: post-fix snapshot + 17-row acceptance gate. sub-3 0, PLACEHOLDER 0, 16/16 gates PASS.

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
npm run test:namespring-compat
```

## 4. Workflow

worktree branch → commit → push → PR → admin merge.

## 5. Out of scope (Phase 24+)

- workflow YAML ship (OAuth)
- 책 자료 ingestion
- worktree contention root-cause
