# Phase 39 — postProcessorLeak fix + non-saturated continuation

> 작성: 2026-05-09
> 목적: P38-A6 발견 postProcessorLeaks 0→1 fix + 4p/5p/hook continuation.

## 0. Context

Phase 38 완료 (PR #634-#639):
- A1: 4p 130→140 recovery
- A2: 5p 310→320 milestone
- A3: hook 120→130 milestone (17-tier strict hold)
- A4: ratchet review HOLD 20 (audit-only)

**현재**: 21 CI gates. standard `{3:1255, 4:130, 5:320}`, distinct hooks=130, 17-tier=5.

P38-A6 권고:
- postProcessorLeak 0→1 fix (`academic.today.standard.balanced.009` 의 "내일 첫 걸음을")
- non-saturated continuation

## 1. Safety invariants

- ../namespring/ 무수정
- API IMMUTABLE
- test:namespring-compat 202/202
- Phase 3-38 hard contracts 유지 (21 CI gates)
- 17-tier {#5,#12,#13,#32,#33} hold

## 2. Agent 분배 (5)

### P39-A1 — postProcessorLeak fix

**Owned**:
- `lib/spring-ts/data/narrative/academic/today/standard.fragments.json` (`balanced.009` 의 "내일 첫 걸음을" → "내일 첫 발걸음을" 또는 다른 wording)
- `lib/spring-ts/artifacts/phase39-agent-a1/audit-2026-05-09.md`

**Target**: postProcessorLeaks 1 → 0.

### P39-A2 — Standard 4p band 130→140 recovery (+10)

ct=2 또는 ct=3 fragments lift.

### P39-A3 — Standard 5p band 320→330 (+10)

4p fragments lift ~10.

### P39-A4 — Hook 130→140 (+10)

brief.fragments.json 추가 ~10. 17-tier strict hold.

### P39-A5 — Phase 39 종합 audit

## 3. 검증

21 CI gates + test:namespring-compat 202/202.

## 4. Workflow

isolated worktree → commit → push → PR → admin merge.

## 5. Out of scope (Phase 40+)

- 책 자료 ingestion
- workflow YAML ship
- fixture-surface expansion
