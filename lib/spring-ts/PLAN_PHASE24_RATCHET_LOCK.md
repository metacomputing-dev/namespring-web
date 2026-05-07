# Phase 24 — Ratchet lock + low-priority polish

> 작성: 2026-05-07
> 목적: Phase 23 의 sub-3=0 / PLACEHOLDER=0 lock + low-priority polish (gyeolCluster, audience_leak, hook fragility tail).

## 0. Context

Phase 23 완료 (PR #548-#552):
- A1: brief PLACEHOLDER 8→0 (5 fragments)
- A2: romance × minor sub-3 13→0 (10 fragments)
- A3: study_document × minor sub-3 7→0 (3 fragments)
- A4: measure_p23.mjs mtime-aware corpus refresh
- A5: final regen + 8/8 acceptance criteria MET

**Phase 23 = first all-target-met phase. No residue.**

P23-A5 권고 (Phase 24+):
- **P24-A1**: `ci:standard-paragraph-floor --min-paragraphs=3` ratchet (gate-ify sub-3=0)
- **P24-A2**: `ci:brief-tier-placeholder --max-cells=0` ratchet
- **P24-A3**: gyeolCluster 12 cells investigation (`결` ≥3 in single paragraph)
- **P24-A4**: audience_leak=1 single-cell investigation
- **P24-A5**: Phase 24 종합 audit

OAuth-blocked carry-over (Phase 24 scope 외):
- workflow YAML ship (`.github/workflows/spring-ts-samples-stale.yml`) — 6 consecutive carry-over
- worktree contention root-cause

## 1. Safety invariants

- ../namespring/ 무수정
- API IMMUTABLE
- test:namespring-compat 202/202
- 새 default flip 0건
- Phase 2 frozen contract 무수정
- Phase 3-23 hard contracts 유지 (sub-3=0, PLACEHOLDER=0, depth_inversion=0, 16 CI gates)

## 2. Agent 분배 (5)

### P24-A1 — `ci:standard-paragraph-floor` ratchet

**Owned**:
- `lib/spring-ts/tools/check_standard_paragraph_floor.mjs` (신규)
- `lib/spring-ts/package.json` (script 만)
- `lib/spring-ts/tools/acceptance-manifest.json` (entry)
- `lib/spring-ts/artifacts/phase24-agent-a1/audit-2026-05-07.md`

**Target**: standard tier 의 모든 cell paragraphs ≥ 3 enforce. `--min-paragraphs=3 --max-violations=0`.

**Approach**:
1. sample-outputs 의 `<period>.<category>.standard.paragraphs` 검사
2. paragraphs.length < 3 → violation
3. 0 violations 통과 (P23-A5 가 100% 도달함)
4. acceptance-manifest 추가

### P24-A2 — `ci:brief-tier-placeholder` ratchet

**Owned**:
- `lib/spring-ts/tools/check_brief_tier_placeholder.mjs` (신규)
- `lib/spring-ts/package.json` (script)
- `lib/spring-ts/tools/acceptance-manifest.json` (entry)
- `lib/spring-ts/artifacts/phase24-agent-a2/audit-2026-05-07.md`

**Target**: brief tier 의 모든 cell PLACEHOLDER (`'준비 중인 흐름이에요.'`) 부재 enforce.

**Approach**:
1. sample-outputs 의 `<period>.<category>.brief.headline` 검사
2. headline === '준비 중인 흐름이에요.' (또는 PLACEHOLDER 다른 형태) → violation
3. 0 violations 통과 (P23-A1 후 PLACEHOLDER=0)
4. acceptance-manifest 추가

### P24-A3 — gyeolCluster 12 cells investigation

**Owned**:
- `lib/spring-ts/data/narrative/<cat>/<period>/*.fragments.json` (12 cells 의 source fragment)
- `lib/spring-ts/artifacts/phase24-agent-a3/audit-2026-05-07.md`

**Target**: `결` ≥3 in single paragraph 12 → 0 (또는 의도성 확인 후 hold).

**Approach**:
1. P23-A5 snapshot 의 `gyeolCluster.totalCells=12` cells 식별
2. 각 cell 의 paragraph 읽고 의도성 판단:
   - 어휘적 다양성 (`결정`, `결재`, `결실` 등 다른 lexical item) → hold
   - 동일 어휘 반복 → paraphrase
3. paraphrase 가능한 cell 들만 fix
4. ci:samples-stale, ci:narrative-voice 무위반

### P24-A4 — audience_leak=1 single-cell investigation

**Owned**:
- `lib/spring-ts/artifacts/phase24-agent-a4/audit-2026-05-07.md` (audit only — 데이터 수정 가능 여부 결정 후)
- 필요시 1 fragment fix

**Target**: audience_leak 1 → 0.

**Approach**:
1. `audit-phase12.mjs` 실행 → audience_leak hit 식별
2. 어떤 fragment 가 audience leak (e.g. expert tier 가 brief 어조 사용 등) 인지 root cause
3. Fix or document

### P24-A5 — Phase 24 종합 audit

**Owned**: `artifacts/phase24-agent-a5/`
**Target**: P24-A1~A4 후 metric snapshot. 18+ row Phase 24 acceptance gate.

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
npm run ci:standard-paragraph-floor  # 신규 P24-A1
npm run ci:brief-tier-placeholder    # 신규 P24-A2
npm run ci:acceptance-completeness
npm run ci:samples-stale
npm run test:namespring-compat       # 202/202
```

## 4. Workflow

worktree branch → commit → push → PR → admin merge.

## 5. Out of scope (Phase 25+)

- workflow YAML ship (OAuth)
- worktree contention root-cause
- 책 자료 ingestion
- hook fragility tail (P21-A5/P22-A6/P23-A5 carry-over — currently safe)
