# Phase 35 — gyeolCluster 21st gate + depth pivot

> 작성: 2026-05-08
> 목적: Phase 34 lock 위에 gyeolCluster ci gate (21st) + 추가 4p/5p/6p depth + hook continuation.

## 0. Context

Phase 34 완료 (PR #610-#615):
- A1: 4p 130→140
- A2: 5p 267→280
- A3: expert 6p 31→40
- A4: hook 80→90

**현재**: 20 CI gates. standard `{3:1298, 4:127, 5:280}`, expert `{4:1547, 5:118, 6:40}`, hooks=90.

P34-A6 권고:
1. gyeolCluster 10 → ci:gyeol-cluster gate 추가 (21st)
2. expert 6p saturation pivot
3. lift-mechanic divergence audit

## 1. Safety invariants

- ../namespring/ 무수정
- API IMMUTABLE
- test:namespring-compat 202/202
- Phase 3-34 hard contracts 유지 (20 CI gates)

## 2. Agent 분배 (5)

### P35-A1 — `ci:gyeol-cluster` gate (21st)

**Owned**:
- `tools/check_gyeol_cluster.mjs` (신규)
- `package.json` (script)
- `tools/acceptance-manifest.json` (entry)
- `artifacts/phase35-agent-a1/audit-2026-05-08.md`

**Target**: gyeol×3 in single paragraph 의 ci gate. Initial threshold = current 10 (`--max-violations=10`). Phase 36+ ratchet 가능.

### P35-A2 — Standard 4p band 127→140 recovery (+13)

**Owned**: `data/narrative/<cat>/<period>/standard.fragments.json` (~13)

### P35-A3 — Standard 5p band 280→290 (+10)

**Owned**: 4p fragments lift (~10)

### P35-A4 — Hook 90→100 (+10)

**Owned**: brief.fragments.json (~10)

### P35-A5 — Phase 35 종합 audit

**Owned**: `artifacts/phase35-agent-a5/`

## 3. 검증

20 CI gates + new ci:gyeol-cluster + test:namespring-compat 202/202.

## 4. Workflow

isolated worktree → commit → push → PR → admin merge.

## 5. Out of scope (Phase 36+)

- 책 자료 ingestion
- workflow YAML ship (OAuth)
