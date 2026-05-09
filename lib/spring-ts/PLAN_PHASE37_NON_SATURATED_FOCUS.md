# Phase 37 — Non-saturated tier focus (5p continuation + hook + expert defer)

> 작성: 2026-05-09
> 목적: P36-A6 saturation pivot 권고 따름. expert tier defer, 5p/4p/hook 비-saturated tier 에 집중.

## 0. Context

Phase 36 완료 (PR #622-#627):
- A1: 4p 130→140
- A2: 5p 290→300 milestone
- A3: expert source 6p +10 (rendered saturation pivot)
- A4: hook 100→110 milestone

**현재**: 21 CI gates. standard `{3:1275, 4:130, 5:300}`, expert `{4:1547, 5:118, 6:40}` (saturation), hooks=110.

## 1. Safety invariants

- ../namespring/ 무수정
- API IMMUTABLE
- test:namespring-compat 202/202
- Phase 3-36 hard contracts 유지 (21 CI gates)

## 2. Agent 분배 (5)

### P37-A1 — Standard 4p band 130→140 recovery (+10)

P36-A2 가 4p→5p 10 promote 했으므로 4p 130 hold. 추가 +10 lift.

### P37-A2 — Standard 5p band 300→310 (+10)

4p fragments lift ~10. P36-A6 권고 (a).

### P37-A3 — Expert 6p **rendered** lift (firing-eligible 발굴)

**Owned**: expert 5p firing pool 분석 후 lift. P36-A3 saturation 후 firing-eligible 5p 가 0 이지만 P36-A2 의 4p→5p promotion 이 새 firing 5p 생성 가능. 측정 후 가능하면 lift.
**Constraint**: rendered 6p 가 변화 안 하면 명시적 보고.

### P37-A4 — Hook 110→120 (+10)

brief.fragments.json 추가 ~10.

### P37-A5 — Phase 37 종합 audit

## 3. 검증

21 CI gates + test:namespring-compat 202/202.

## 4. Workflow

isolated worktree → commit → push → PR → admin merge.

## 5. Out of scope (Phase 38+)

- 책 자료 ingestion
- workflow YAML ship (OAuth)
- fixture/gating surface 확장 (P36-A3 saturation 의 체계적 해법 — 별도 phase 결정)
