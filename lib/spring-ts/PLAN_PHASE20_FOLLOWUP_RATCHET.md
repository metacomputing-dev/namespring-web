# Phase 20 — Phase 19 follow-up + ratchet

> 작성: 2026-05-07
> 목적: P19-A5 audit 발견 항목 정리 + drift cycle 종료 + ratchet 잠금.

## 0. Context

Phase 19 완료 (PR #527-#531):
- A1: 연결X compound non-_coverage 클린업 (1 hit)
- A2: ci:post-processor-grammar 13 패턴 추가 (max-violations=2 ratchet 대기)
- A3: src-side `(?<![가-힣])` lookbehind for GYEOL_SUBS (39 unit tests)
- A4: ci:hook-coverage 0 dormant gate
- A5: 종합 audit + 2 key findings

P19-A5 발견:
1. 연결입니다 잔존 (`_coverage/yongshin-action-density.fragments.json:22`) — P19-A3 lookbehind 보호되나 데이터 cleanup 권장
2. Doubled 결이 cluster 11 brief.headline cells regression — P18-A4 fix 후 재출현
3. Sample drift 15건 (regen-drift cycle)
4. ci:post-processor-grammar max-violations=2 → 0 ratchet 대기
5. ci:acceptance-completeness 1 violation (P19-A4 의 ci:hook-coverage 가 manifest entry 없음)

## 1. Safety invariants

- ../namespring/ 무수정
- API IMMUTABLE
- test:namespring-compat 202/202
- 새 default flip 0건
- Phase 2 frozen contract 무수정
- Phase 3-19 hard contracts 유지

## 2. Agent 분배 (5)

### P20-A1 — Doubled 결이 cluster regression fix

**Owned**: `data/narrative/<cat>/<period>/brief.fragments.json` 의 11 brief.headline cells.
**Target**: P18-A5 audit 가 발견한 `사람과의 결이 차분히 정돈되는 결이에요` 또는 동등한 doubled 패턴 → 0.
**Approach**: 
1. P19-A5 snapshot 에서 11 cells 식별
2. 한 cell 의 두 번째 `결이` 를 다른 어휘 (`흐름이`, `리듬이`) 로 교체
3. brief headline 28 자모 한계 유지

### P20-A2 — `연결입니다` 클린업 + 동사형 보호 표

**Owned**: `data/narrative/_coverage/yongshin-action-density.fragments.json:22` + 가능한 다른 동사형 (연결돼/연결되/연결해/연결할 → 연결고리에 닿/연결고리를 잇/...).
**Target**: 연결+서술/동사 형 0 (data-side)
**Approach**: 의미 보존 paraphrase. 단순 치환 금지 (자연성 우선).

### P20-A3 — Sample regen + ratchet

**Owned**: `lib/spring-ts/artifacts/sample-outputs-2026-05-05-phase3/*.json` 만 + `package.json` (max-violations=2 → 0).
**Target**: ci:samples-stale 0, ci:post-processor-grammar max-violations=0 통과.
**Approach**: 
1. P20-A1, A2 머지 후 `npm run samples:regen`
2. ci:samples-stale 결과 0 확인
3. ci:post-processor-grammar 측정 → 0 이면 max-violations=0 으로 ratchet
4. (의존 유의) P20-A1, A2 가 머지된 후 dispatch 권장이지만, 동시 진행 가능

### P20-A4 — ci:acceptance-completeness 0 violations

**Owned**: `tools/release_checklist_manifest.json` 또는 acceptance manifest 데이터 + `tools/check_acceptance_completeness.mjs` (필요시).
**Target**: P19-A4 의 ci:hook-coverage script 가 acceptance manifest 에 entry 추가되어 ci:acceptance-completeness 0 violations.
**Approach**: 
1. `npm run ci:acceptance-completeness` 실행 → 1 violation 확인
2. 어떤 manifest 가 hook-coverage 누락인지 식별
3. hook-coverage entry 추가 (script reference + description)

### P20-A5 — Phase 20 종합 audit

**Owned**: `artifacts/phase20-agent-a5/` (audit doc + measure script). 데이터/소스 무수정.
**Target**: P20-A1~A4 후 metric snapshot.
**Approach**: P19-A5 의 measure_p19.mjs 확장. 모든 metric 0/PASS 확인.

## 3. 검증

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
npm run ci:acceptance-completeness
npm run ci:samples-stale
npm run test:namespring-compat   # 202/202
```

## 4. Workflow

worktree branch → commit → push → PR → admin merge.

## 5. Out of scope (Phase 21+)

- src-locked 107 single-paragraph cell
- workflow file CI ship (OAuth)
- 책 자료 ingestion
