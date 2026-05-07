# Phase 33 — Depth richness + livingTips period-consistency gate (20th)

> 작성: 2026-05-08
> 목적: Phase 32 lock 위에 추가 4p/5p/6p depth + brief hook richness + livingTips period-consistency CI gate (20th).

## 0. Context

Phase 32 완료 (PR #598-#603, 6/6):
- A1: livingTips family+health (11/11 close-out)
- A2: 4p band 110→120
- A3: expert 6p tier 11→21
- A4: hook 60→70

**현재**: 19 CI gates 0 violations. standard `{3:1318, 4:120, 5:267}`, expert `{4:1547, 5:137, 6:21}`. distinct hooks=70.

P32-A6 권고:
1. livingTips period-consistency 20th CI gate (Phase 11 cycles 의 work 잠금)
2. expert 6p tier 추가 (21→~30)
3. 4p band 추가 +10 (120→130)
4. hook 70→~80

## 1. Safety invariants

- ../namespring/ 무수정
- API IMMUTABLE
- test:namespring-compat 202/202
- Phase 2 frozen contract 무수정
- Phase 3-32 hard contracts 유지 (19 CI gates)

## 2. Agent 분배 (5)

### P33-A1 — `ci:livingtips-period-consistency` gate (20th)

**Owned**:
- `lib/spring-ts/tools/check_livingtips_period_consistency.mjs` (신규)
- `lib/spring-ts/package.json` (script)
- `lib/spring-ts/tools/acceptance-manifest.json` (entry)
- `lib/spring-ts/artifacts/phase33-agent-a1/audit-2026-05-07.md`

**Target**: 한 카테고리 내 5-period livingTips 의 verbatim duplicate detection. Phase 28-32 가 polished 한 11/11 lock.

**Approach**:
1. detection logic: 한 카테고리의 (period × cohort) 조합 livingTips 가 4+ verbatim duplicate → violation
2. Initial: violations=0 ratchet (Phase 28-32 polish 결과)
3. acceptance-manifest 추가

### P33-A2 — Standard 4p band +10 (120→130)

**Owned**: `data/narrative/<cat>/<period>/standard.fragments.json` (~10 lift)

### P33-A3 — Expert 6p tier 21→~30 (+9)

**Owned**: 5p fragments lift (P28-A2/P30-A4/P32-A3 외)

### P33-A4 — Hook 70→~80 (+10)

**Owned**: brief.fragments.json 추가 ~10 hook fragments

### P33-A5 — Phase 33 종합 audit

**Owned**: `artifacts/phase33-agent-a5/`

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
npm run ci:flow-cluster
npm run ci:livingtips-period-consistency  # 신규 P33-A1
npm run ci:acceptance-completeness
npm run ci:samples-stale
npm run test:namespring-compat
```

## 4. Workflow

isolated worktree → commit → push → PR → admin merge.

## 5. Out of scope (Phase 34+)

- 책 자료 ingestion
- workflow YAML ship (OAuth 14th carry-over)
