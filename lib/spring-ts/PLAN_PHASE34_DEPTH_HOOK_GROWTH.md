# Phase 34 — Depth + hook growth + audit-tooling templating

> 작성: 2026-05-08
> 목적: Phase 33 lock 위에 4p/6p/hook 추가 expansion + P*-A6 audit-tooling templating.

## 0. Context

Phase 33 완료 (PR #604-#609, 6/6):
- A1: `ci:livingtips-period-consistency` 20th gate
- A2: 4p band 120→130
- A3: expert 6p tier 21→31
- A4: hook 70→80

**현재**: 20 CI gates 0 violations. standard `{3:1308, 4:130, 5:267}`, expert `{4:1547, 5:127, 6:31}`, distinct hooks=80.

P33-A6 권고: 추가 depth + 6p tier 추가 + hook 80→~90 + audit-tooling templating.

## 1. Safety invariants

- ../namespring/ 무수정
- API IMMUTABLE
- test:namespring-compat 202/202
- Phase 2 frozen contract 무수정
- Phase 3-33 hard contracts 유지 (20 CI gates)

## 2. Agent 분배 (5)

### P34-A1 — Standard 4p band 130→140 (+10)

**Owned**: `data/narrative/<cat>/<period>/standard.fragments.json` (~10 lift)

### P34-A2 — Standard 5p band 267→~280 (+13)

**Owned**: 4p fragments lift (~13)

### P34-A3 — Expert 6p tier 31→~40 (+9)

**Owned**: expert 5p fragments lift (~10)

### P34-A4 — Hook 80→~90 (+10)

**Owned**: brief.fragments.json 추가 ~10

### P34-A5 — Phase 34 종합 audit (P*-A6 templating)

**Owned**: `artifacts/phase34-agent-a5/` + audit-tooling templating

## 3. 검증 (각 PR)

20 CI gates 통과 + test:namespring-compat 202/202.

## 4. Workflow

isolated worktree → commit → push → PR → admin merge.

## 5. Out of scope (Phase 35+)

- 책 자료 ingestion
- workflow YAML ship (OAuth)
