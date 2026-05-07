# Phase 27 — Hook richness + tail consolidation

> 작성: 2026-05-07
> 목적: distinct hook 48 → ~60 + dormant hook close + 추가 narrative depth.

## 0. Context

Phase 26 완료 (PR #563-#568, 6/6):
- A1: 6 sibling hook fragments (family/romance/study_document)
- A2: 16 fragments 3p→4p
- A3: 10 fragments 4p→5p
- A4: 8 hook fragments → 34→42 distinct
- A5: pre-merge audit
- A6: final regen → 18/18 PASS

P26-A6 권고 (Phase 27):
- **P27-A1**: distinct hook 48 → ~60 (12 추가 hook fragments)
- **P27-A2**: dormant hook close (`career.thisWeek.brief.age40plus.009` 1 dormant)
- **P27-A3**: 5p band +10 (247 → ~257) — 의미있는 4p fragment 에 5번째 추가
- **P27-A4**: standard 첫 문장 다양화 (depth_inversion detector 18 hits 막음 ~보다 보수적으로 다양화)
- **P27-A5**: Phase 27 종합 audit + 통합

## 1. Safety invariants

- ../namespring/ 무수정
- API IMMUTABLE
- test:namespring-compat 202/202
- Phase 2 frozen contract 무수정
- Phase 3-26 hard contracts 유지 (18 CI gates 0 violations, 100% standard ≥3p, 0 PLACEHOLDER, 0 sub-3)

## 2. Agent 분배 (5)

### P27-A1 — Hook richness 48 → ~60

**Owned**:
- `lib/spring-ts/data/narrative/<cat>/<period>/brief.fragments.json` (12 추가 hook fragments)
- `lib/spring-ts/artifacts/phase27-agent-a1/audit-2026-05-07.md`

**Target**: distinct hooks 48 → ~60 (+12).

**Approach**:
1. P26-A6 snapshot read → 부족 axis 식별 (예: youth × thisMonth, elder × today, midlife × thisWeek)
2. 12 fragments authoring with distinct hooks
3. gating: gender × ageBand or ageBand × birthSeason 등 (P26 패턴)
4. ci:hook-concentration max ≤19 보장 (margin 1)

### P27-A2 — Dormant hook close (1 → 0)

**Owned**:
- `lib/spring-ts/data/narrative/career/thisWeek/brief.fragments.json` (`age40plus.009` 영역)
- `lib/spring-ts/artifacts/phase27-agent-a2/audit-2026-05-07.md`

**Target**: dormantHookStringsByText 1 → 0.

**Approach**:
1. `career.thisWeek.brief.age40plus.009` fragment read
2. 왜 dormant 인지 진단 (gating mismatch / fixture coverage gap)
3. fix:
   - 다른 fragment 와 hook 중복 → 새 unique hook 으로 변경
   - 또는 gating 완화 (broader)

### P27-A3 — Standard 5p band +10 (247 → 257)

**Owned**:
- `lib/spring-ts/data/narrative/<cat>/<period>/standard.fragments.json` (4p 중 ~10 fragments lift)
- `lib/spring-ts/artifacts/phase27-agent-a3/audit-2026-05-07.md`

**Target**: 5p band +10.

**Approach**: P26-A3 패턴 동일. 4p fragments 중 의미있는 일부 5p 로 확장.

### P27-A4 — Standard 첫 문장 다양화 (depth defense)

**Owned**:
- `lib/spring-ts/data/narrative/<cat>/<period>/standard.fragments.json` (첫 문장 brief 와 너무 유사한 일부 ~10 fragments)
- `lib/spring-ts/artifacts/phase27-agent-a4/audit-2026-05-07.md`

**Target**: depth_inversion future regression 예방. 현재 0 hits, 보수적 다양화로 안전 마진 확대.

**Approach**:
1. P21-A2 detector (Levenshtein ≥ 0.75) 의 marginal cells (0.6-0.75 시뮬레이션) 식별
2. 그 fragments 의 standard 첫 문장 다양화 (brief 와 다른 angle)
3. depth_inversion 0 유지 + marginal 0.7+ count 감소

### P27-A5 — Phase 27 종합 audit

**Owned**: `artifacts/phase27-agent-a5/`
**Target**: 통합 후 metric snapshot. 18 CI gates 모두 0 violations 유지.

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
npm run ci:acceptance-completeness
npm run ci:samples-stale
npm run test:namespring-compat
```

## 4. Workflow

isolated worktree (`<phase>-<agent>-iso/` 권장) → commit → push → PR → admin merge.

## 5. Out of scope (Phase 28+)

- 책 자료 ingestion (추명가 60 cases 등)
- 전문가 narrative depth full upgrade
- workflow YAML ship (OAuth 10th carry-over)
