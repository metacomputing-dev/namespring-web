# Phase 21 — Vocabulary consistency + depth + hooks observability

> 작성: 2026-05-07
> 목적: P20-A5 권고사항 follow-through. 어휘 일관성 + depth detector refresh + hook concentration monitoring.

## 0. Context

Phase 20 완료 (PR #532-#536):
- A1: doubled 결이 cluster fix (1 fragment, 11 cells)
- A2: 연결입니다 → 연결고리입니다 (data cleanup)
- A3: sample regen + ci:post-processor-grammar max-violations 2→0 ratchet
- A4: ci:acceptance-completeness 0 (manifest)
- A5: 종합 audit + 6 Phase 21+ recommendations

P20-A5 권고 (high/medium priority data-only):
- **P21-A1**: Verb-form 연결 vocabulary consistency (29 occurrences → `이어지는/이어진다/이어져/이어짐`)
- **P21-A2**: Refresh `audit-phase12.mjs` `depth_inversion` detector
- **P21-A3**: Max-hooks-per-fixture concentration monitoring CI gate
- **P21-A4**: 107 sub-3-paragraph standard cells investigation (Phase 22+ 결정 input)
- **P21-A5**: Phase 21 종합 audit

OAuth-blocked 카테고리 (Phase 21 scope 외):
- workflow file ship (`.github/workflows/spring-ts-samples-stale.yml`)
- worktree contention root-cause

## 1. Safety invariants

- ../namespring/ 무수정
- API IMMUTABLE
- test:namespring-compat 202/202
- 새 default flip 0건
- Phase 2 frozen contract 무수정
- Phase 3-20 hard contracts 유지 (모두 0 violations)

## 2. Agent 분배 (5)

### P21-A1 — Verb-form 연결 vocabulary consistency

**Owned**: `data/narrative/_coverage/*.fragments.json` (21 hits across 15 files), 비-_coverage `<cat>/<period>/*.json` (4 hits), `_glossary/palace.json` (4 hits).
**Target**: 동사형 연결 (연결되어/연결한다/연결됨/연결돼/연결되/연결한/연결할/연결했/연결되어 등) → 이어지는/이어진다/이어져/이어짐 vocabulary-consistency rephrase.
**Approach**: 
1. P20-A5 measure 출력에서 29 occurrences 파일 별 집계
2. 각 occurrence 의 문맥 봐서 자연스러운 paraphrase 선택:
   - `연결되어` → `이어져`
   - `연결한다` / `연결한다.` → `이어준다`
   - `연결됨` / `연결됨.` → `이어짐`
   - `연결돼` → `이어져`
   - `연결될` → `이어질`
3. 의미 보존 (관계/소통 뉘앙스 유지). 일부 cell 은 자연스러움 우선 — `이어줍니다` / `잇닿습니다` 등 대안 OK.
4. brief headline 28 자모 한계 / livingTips 24 자 한계 / cautions 30 자 한계 유지

### P21-A2 — `audit-phase12.mjs` depth_inversion refresh

**Owned**: `tools/audit-phase12.mjs` (검증/개선만), `artifacts/phase21-agent-a2/audit-2026-05-07.md`.
**Target**: P14/15/16/17/18/19/20-A5 carry-over. Detector 가 의미있는 신호를 주도록 refresh, 또는 deprecate.
**Approach**: 
1. 현재 detector 코드 read
2. brief vs standard 의 첫 sentence overlap 측정 (P5/P6/P7-A1 의 depthCoherence 잔여 detect)
3. 의미있는 신호 안 나오면 deprecate (제거 권고 audit doc 에 명시)
4. 신호 나오면 어떤 cell 들이 brief=standard / brief~standard 인지 출력

### P21-A3 — Max-hooks-per-fixture concentration CI gate

**Owned**: `tools/check_hook_concentration.mjs` (신규), `package.json` (script 만), `tools/acceptance-manifest.json` (entry 추가), audit doc.
**Target**: hook 분포 상한 monitoring. 현재 max=15/fixture, median=13. CI gate `--max-hooks=20` ratchet.
**Approach**: 
1. sample-outputs 에서 fixture 별 distinct hook count
2. max-hooks=20 enforcement (현재 15 안전)
3. acceptance-manifest 에 추가
4. P19-A4 의 ci:hook-coverage 와 별도. coverage 는 dormant detection, concentration 은 over-merge detection.

### P21-A4 — 107 sub-3-paragraph standard cells investigation

**Owned**: `lib/spring-ts/artifacts/phase21-agent-a4/audit-2026-05-07.md` (audit only — 데이터/소스 무수정).
**Target**: 107 cells 가 src-locked 이라는 P18-A3 결론 재검증. Phase 22+ 결정 input 작성.
**Approach**: 
1. `MINOR_LIMITED_CATEGORIES` early-return 제거 시 어떤 fragment 가 부족한지 정확히 측정
2. 32 minor-ageband fragment authoring path 의 LOC 견적
3. ≤50 / ≤30 / 0 target 각각의 cost 분석
4. 권고 (Phase 22 의 P22-A1 으로 어떤 path 선택할지 input)

### P21-A5 — Phase 21 종합 audit

**Owned**: `artifacts/phase21-agent-a5/`.
**Target**: P21-A1~A4 후 metric snapshot.
**Approach**: P20 audit doc 형식 확장. 모든 17+ acceptance gate.

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
npm run ci:hook-concentration  # 신규 (P21-A3)
npm run ci:acceptance-completeness
npm run ci:samples-stale
npm run test:namespring-compat   # 202/202
```

## 4. Workflow

worktree branch → commit → push → PR → admin merge.

## 5. Out of scope (Phase 22+)

- 107 sub-3 standard cells 실 fix (P21-A4 권고 후 Phase 22 결정)
- workflow YAML ship (OAuth)
- 책 자료 ingestion
