# Phase 36 — Depth + hook continuation post-100 milestone

> 작성: 2026-05-09
> 목적: Phase 35 21 gates lock + 100 hook milestone 위에 추가 4p/5p/expert/hook expansion.

## 0. Context

Phase 35 완료 (PR #616-#621):
- A1: ci:gyeol-cluster gate (21st)
- A2: 4p band 127→140
- A3: 5p band 280→290
- A4: hook 90→100 milestone
- A5: pre-merge baseline
- A6: final integration 21/21 PASS

**현재**: 21 CI gates. standard `{3:1285, 4:130, 5:290}`, expert `{4:1547, 5:118, 6:40}`, distinct hooks=100.

P35-A6 권고:
- expert 6p saturation pivot 1-2 phases away
- gyeolCluster hold (21st gate stable)

## 1. Safety invariants

- ../namespring/ 무수정
- API IMMUTABLE
- test:namespring-compat 202/202
- Phase 3-35 hard contracts 유지 (21 CI gates)

## 2. Agent 분배 (5)

### P36-A1 — Standard 4p band 130→140 (+10)

**Owned**: `data/narrative/<cat>/<period>/standard.fragments.json` (~10 lift)

### P36-A2 — Standard 5p band 290→300 (+10)

**Owned**: 4p fragments lift (~10)

### P36-A3 — Expert 6p tier 40→~50 (+10)

**Owned**: expert 5p fragments lift (~10)

### P36-A4 — Hook 100→~110 (+10)

**Owned**: brief.fragments.json (~10)

### P36-A5 — Phase 36 종합 audit

**Owned**: `artifacts/phase36-agent-a5/`

## 3. 검증

21 CI gates + test:namespring-compat 202/202.

## 4. Workflow

isolated worktree → commit → push → PR → admin merge.

## 5. Out of scope (Phase 37+)

- 책 자료 ingestion
- workflow YAML ship (OAuth)
