# Phase 38 — Ratchet review + non-saturated continuation

> 작성: 2026-05-09
> 목적: P37-A6 권고. 17-tier hook concentration ratchet 재검토 + 4p/5p/hook continuation.

## 0. Context

Phase 37 완료 (PR #628-#633):
- A1: 4p 130→140 recovery
- A2: 5p 300→310 milestone
- A3: expert 6p saturation 2nd confirmation (0 mutation)
- A4: hook 110→120 milestone

**현재**: 21 CI gates. standard `{3:1265, 4:130, 5:310}`, expert saturation, hooks=120, 17-tier membership=5.

P37-A6 signature findings:
- 17-tier membership 4→5 (`12-jeong-extreme-strong-continuous` 추가)
- 2-checkpoint saturation persistence — fixture-expansion 고우선 (Phase 38+ 결정)
- New 3-1 hybrid phase shape

## 1. Safety invariants

- ../namespring/ 무수정
- API IMMUTABLE
- test:namespring-compat 202/202
- Phase 3-37 hard contracts 유지 (21 CI gates)

## 2. Agent 분배 (5)

### P38-A1 — Standard 4p band 130→140 recovery (+10)

ct=2 fragments lift (ct=1 pool exhausted).

### P38-A2 — Standard 5p band 310→320 (+10)

4p fragments lift ~10.

### P38-A3 — Hook 120→130 (+10)

brief.fragments.json 추가 ~10. **gating dim 신중**: 17-tier 5명 가까워지므로 새 fragment 가 17-tier 안 늘리도록 비-17-tier fixtures (e.g. #4, #18, #27 등) 만 가게.

### P38-A4 — Hook concentration ratchet 재검토

**Owned**: `package.json` (ci:hook-concentration max), `tools/acceptance-manifest.json` 무수정 (이미 등록), `artifacts/phase38-agent-a4/audit-2026-05-09.md`
**Target**: 현재 max-hooks=20 ratchet 재검토. 17-tier 5명 = 6번째 진입 시 17→18 가능 → margin 2. ratchet 18 으로 tighten 가능 여부 분석 + 필요시 reset.
**Approach**: read-mostly. data 무수정, 결정 후 ratchet flag 변경 1줄.

### P38-A5 — Phase 38 종합 audit

## 3. 검증 (각 PR)

21 CI gates + test:namespring-compat 202/202.

## 4. Workflow

isolated worktree → commit → push → PR → admin merge.

## 5. Out of scope (Phase 39+)

- 책 자료 ingestion
- workflow YAML ship (OAuth)
- fixture-surface expansion (saturation 해소)
