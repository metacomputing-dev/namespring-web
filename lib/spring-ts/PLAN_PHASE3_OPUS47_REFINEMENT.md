# Phase 3 — Opus 4.7 Max Effort 20-Agent Refinement Plan

> 작성일: 2026-05-05
> 작성자: Opus 4.7 (1M context, max effort) — 사용자(blue2dea@gmail.com / 한국어) 의뢰
> 목적: Codex GPT-5.5 xhigh가 진행해 둔 Phase 2 fan-out 산출물을 Opus 4.7 max effort 20-agent 팀이 이어받아 정교화·발전시키기 위한 작업 설계.
> 준수: 본 plan은 dispatch 전 사용자 명시 승인이 필요하다 (Phase 2 dispatch와 동일 절차 — `docs/PHASE2_AGENT_PARTITION.md` §3 참조).

---

## 0. Executive Summary

**한 줄 요약**: Phase 2가 만든 4,055개 narrative fragment / 165셀의 **structural 완성도**를 유지한 채, **품질·일관성·증거깊이·전문성**을 한 단계 끌어올린다. NameSpring의 legacy field (현재 사용자가 보는 텍스트) + tieredMatrix (FE 통합 후 보일 텍스트) **둘 다** 다룬다. **../namespring (FE) 무수정** 보장.

**핵심 변동점**:
- 모든 작업은 `data/narrative/**` + `docs/**` + `tools/**` + (선택적으로) `src/report/tiered/**` 안에서만 발생.
- ../namespring/src 절대 변경 금지 (사용자 명시 제약).
- API IMMUTABLE 유지 (PRINCIPLES_v2 §1).
- `namespring-compat.test` 202/202 PASS는 모든 wave 종료 시 invariant.
- Phase 2 frozen contract (`data/narrative/_contract/v1.json`, `frozenAt: 2026-05-02`) 무변경.
- 새 default flip 0건. 모든 새 surface는 opt-in only.

**예상 산출**:
- 21 agent × 평균 1-3 PR = 30~60 PR. 각 PR ≤ 300 LOC, 1 commit = 1 intent.
- service:readiness 결과 무회귀 (ready_for_frontend_integration 유지).
- `namespring-compat` 202/202 → 202/202 (또는 신규 보강 시 ↑).
- 구체적 품질 metric 개선 (§9 참조).
- **Phase 3 dispatch는 advisor 검토 후 사용자 승인 → Wave 0 시작**.

**최초 측정 결과 (직접 실행, 2026-05-05)**:
- brief headline ≤28자 위반: **805 / 1,342 (60%)** ← Phase 3 우선 해결 대상
- narrative fragment count: 4,055 (3,890 authored)
- service:readiness frontendHandoff: ready_for_frontend_integration ✅
- service:readiness commercialReadiness: blocked_for_authority_claims (책 자료 미입수, expected)
- namespring-compat: 202 PASS / 0 FAIL ✅
- voice violations: 0
- axis-pair density gaps: 0

---

## 1. 현재 상태 (2026-05-05 시점, 직접 측정)

### 1.1 Phase G~M (saju-ts/spring-ts 코어) — 완료

`README.md` §"현재 상태" 표:

| Phase | 상태 | 누적 PR |
|---|---|---|
| G — Tooling foundations | ✅ 완료 | 3/3 |
| H — Adapter + saju-ts | ✅ 완료 | 10/16 |
| I — Hanja extensions (9,495 인명용) | ✅ 완료 | 7+/7 |
| J — Encyclopedia + narrative | ✅ 완료 | 13/8 |
| K — Algorithm modes opt-in | ✅ 완료 | 10/12 |
| L — Fixture + reference | ✅ 완료 | 11/11 |
| M — Default tuning | ✅ 완료 | 7/7 |
| N — Frontend (NameSpring 측) | 미진행 | 0/10 |

### 1.2 Phase 2 narrative fan-out — 완료

`docs/PHASE2_AGENT_PARTITION.md` 의 20-agent dispatch 산출물 + 이후 polish wave:

```
narrative:coverage 결과 (직접 실행 2026-05-05)
- 번들: 345
- 단편: 4055 total / 3890 authored / 165 placeholder
- 165/165 cells populated, 165/165 authored
- 0 missing / 0 placeholder-only / 0 underfilled
- expert numericalEvidence: 55/55 cells (gap 0)

narrative:voice-audit 결과
- 0 plain term violations
- 0 plain tag violations
- 0 untagged expert fragments

narrative:axis-pairs 결과
- 8 tracked pairs, 0 missing combinations, 0 thin
```

### 1.3 service:readiness (현재) — 직접 실행

```
Frontend handoff: ready_for_frontend_integration  ✅
Commercial readiness: blocked_for_authority_claims ⚠️
Fragments: 4055 total, 3890 authored
Authority-truth eligible fragments: 0           ← 모든 fragment가 T1_HYPOTHESIS
Authority-truth eligible numericalEvidence: 0   ← 모두 T3_INTERNAL_ENGINE
Zero-authority cells: 165/165                    ← 165셀 모두 authority backing 0
```

**함의**: 외부 자료 입수 없이는 paid 권위 주장이 불가하지만, FE 통합·렌더링은 즉시 가능한 상태.

### 1.4 NameSpring 호환성 — 직접 실행

```
namespring-compat: 202 PASS / 0 FAIL
- precisionConfig 미설정: tieredMatrix === undefined ✅
- precisionConfig.surfaceTieredMatrix=true: 5 periods × 10 categories ✅
- 22/22 used glossary entries 매칭 ✅
- legacy 의존 fields 모두 보존 ✅
```

### 1.5 Codex GPT-5.5 xhigh가 진행한 최근 ~3주 작업

`git log --since="3 weeks ago"` 100+ commit 분석:

| 작업 패턴 | commit 수 | 의미 |
|---|---|---|
| `Polish service visible narrative phrasing` | ~12 | 어색한 문장 결합 다듬기 |
| `Refresh service output audit samples` | ~12 | sample-outputs-2026-05-04 재생성 |
| `Polish high-repetition tiered narratives` | 2 | 반복 어구 감소 |
| `Reduce overused position phrasing` | 2 | 위치 표현 다양화 |
| `Polish remaining adult tiered phrasing` | 2 | 성인 톤 조정 |
| `data(narrative): densify expert age phase` | ~10 | expert 연령 단계 fragment 추가 |
| `feat(authority): add reference intake guard` | 1 | reference-authority validator 추가 |
| `feat(readiness): surface authority backlog` | 1 | service readiness 가시화 |
| `Add reviewed sample output fixtures` | 2 | artifacts/sample-outputs-* 추가 |
| `Fill tiered depth fallbacks for minors` | 1 | 미성년자 depth fallback 보강 |

**주요 deliverable**:
- `tools/service_readiness_report.mjs` — frontend vs commercial readiness 분리 보고
- `tools/check_release_checklist.mjs` — release 검증
- `tools/narrative_authority_gap_report.mjs` — authority backlog 우선순위
- `tools/validate_reference_authority_cases.mjs` — reference A 입력 가드
- `artifacts/sample-outputs-2026-05-04/` — 7개 대표 fixture 출력 (NameSpring/Tiered 비교)
- `data/narrative/_coverage/` — `age-phase-expert-mature.fragments.json` 등 coverage gap fill

**평가**: 광역 fan-out 후 micro-polish 단계에 진입. 단어 반복 감소·표현 다양화·sample 재생성 사이클이 잘 돌아가고 있음. 다만 다음 이슈가 잔존 (§2):

1. `brief.headline` 길이 contract 위반 흔적 (sample 일부에서 28자 초과)
2. `결` `흐름` `결이` 등 anchor 어휘의 재발성 — 카테고리 간 voice consistency 더 필요
3. depth 차별화가 일부 cell에서 약함 (brief = standard 첫 문장 그대로)
4. expert tag-glossary 활용 경계 (사용 22/130 — glossary deep entry 활용도 낮음)
5. 사주 feature가 narrative에 더 깊게 반영 가능 (현재 ageBand·yongshinAlignment·dayMasterStrength 위주, 격국·신살·합화 등 풍부한 axis 활용 여지)

### 1.6 NameSpring (FE) 통합 상태

`/c/Projects/metaintelligence/namespring-web/namespring-tiered-frontend-handoff/` 5개 문서 = FE에 인계 준비 완료:

- `01-current-state-and-contract.md` — 현재 호출 + tieredMatrix opt-in 계약
- `02-frontend-ux-plan.md` — UX 설계 (brief→standard→expert 점진 공개)
- `03-implementation-checklist.md` — 8단계 FE-1 ~ FE-8
- `04-expansion-and-content-ops.md` — 운영 원칙
- `05-sample-output-choi-seongsoo.md` — 샘플 출력

**FE 측 미진행**:
- `namespring/src/App.jsx`의 request에 `precisionConfig.surfaceTieredMatrix: true` 미추가
- `namespring/src/TieredFortuneMatrixReport.jsx` 미작성

**Phase 3 책임 범위에서 제외**: 본 plan은 ../namespring 무수정. FE 작업은 별도 NameSpring repo 측 PR.

---

## 2. 측정된 갭 (Phase 3가 다룰 영역)

### 2.1 품질 갭 (high priority) — 직접 측정한 결과

| 갭 | 측정 근거 (직접 실행) | 다룰 agent |
|---|---|---|
| **brief.headline ≤28자 contract 위반 805/1,342 (60%)** | Python 스캔 (`data/narrative/**/*brief*.fragments.json` 1,342 fragment) — 위반 fragment 예: `health.life.brief.child.001` (32자), `health_stress.life.brief.fire_strong.001` (33자) 등 | **A1-A10 (per-category)** — 직접 fragment 수정 |
| 단어 반복 (`결`, `흐름`, `한 박자`) | recent polish commit 12+회 진행 흔적 + `wealth/thisYear/brief` grep 시 5 fragment 중 4 fragment에 `결` 포함 | A1-A10 + A20 (cross-cat) |
| brief↔standard depth 차별화 | recent commits에서 polish 시도 진행 중 | A19, A20 (depth reviewer) |
| 사주 feature 활용 깊이 | 현재 fragment의 gating은 ageBand/yongshinAlignment/strength 위주, 격국·신살·합화 약함 | A11-A15 + A1-A10 |
| 카테고리 간 voice consistency | recent polish commits 진행형 | A20 (voice reviewer) |
| `livingTips` `cautions` 어구의 격언 일관성 (≤24자, 동사 끝) | random 샘플링 시 일부 위반 가능 | A20 (final QA) |
| numericalEvidence label 풍부도 | 현재 "현재 나이" "셀 별점" "연령 단계 순번" 위주, 더 깊은 사주 feature 수치 활용 가능 | A16 (engine refinement) |
| **renderer normalize regex 길이 inflate 의심** | `src/report/tiered/template-engine.ts:45-47` `normalizeRenderedText()` — `(나무|불|흙|쇠|물) 타고난 중심 기운에` → `$1 기운을 타고난 사람에게` (string 확장). brief 단계 normalize 적용 여부 + 적용 시 ≤28자 위반 발생 가능성 | A16 — fragment 수정과 별도 path 검증 |

### 2.2 권위 갭 (medium priority — 책 입수 의존)

| 갭 | 측정 | Phase 3 처리 |
|---|---|---|
| 0 / 4055 fragment authority-truth eligible | service:readiness | A18: 저작권 안전 paraphrase ingestion (50자 이내, metadata만, T2_AUTHORITY_TEXTUAL 마킹) |
| 165 / 165 cell authority backing 0 | service:readiness | A18: P0_EXPERT_INTERNAL_EVIDENCE_REVIEW backlog 우선 5개 셀에 paraphrase 첨부 |
| numericalEvidence T2 입력 0건 | narrative:numeric-evidence | A18 (보조) — 책 입수 후로 deferred |

> **저작권 정책**: `SPRING_VAL_VALIDATION_HANDOFF.md` "저작권 자료 원문은 fixture에 저장하지 말고 50자 이내 paraphrase와 metadata만 저장하세요." 준수.

### 2.3 알고리즘 / 도크트린 갭 (low-medium priority)

| 갭 | 출처 | Phase 3 처리 |
|---|---|---|
| 명리존험 prose 1/6 PASS | `tools/validate_jonheom_cases.ts` | A16 — case-by-case error mode 분석 (책 없이 가능한 부분만, deferred는 book 의존으로 표시) |
| 한국 modern figures 57% (9 명조) | `tools/validate_korean_modern_authority.ts` | A16 (보조) |
| inter-engine (saju-ts vs saju_master) 38.8% (49-case) | `tools/cross_validate_tyme4ts.ts` 외 | NEXT_STEPS_ROADMAP D-1/D-2 deferred |
| K-4 per-schema ONSET 표 declaration only | NEXT_STEPS_ROADMAP F-1 | Phase 3 out-of-scope |
| H-S1 yaza wiring gap | NEXT_STEPS_ROADMAP E-1 | Phase 3 out-of-scope (saju-ts 측 변경 필요) |

### 2.4 Glossary / 비유 / 모디파이어 갭

| 갭 | 측정 | Phase 3 처리 |
|---|---|---|
| _glossary/ 10 file × ~13 entry = 130 entry, 사용은 22 | choi-seongsoo sample | A11 — entry depth 보강 + entry 활용 빈도 분석 |
| metaphor library 5 element × 4 anchor = 20 anchor, fragment 다양성 부족 | _contract/v1.json `metaphorLibrary` | A12 — element 별 14+ anchor, 시기·시간대 conditional |
| _modifier_gender/ 디렉토리 size 작음 | ls | A13 |
| _modifier_age/ 디렉토리 size 작음 | ls | A14 |

### 2.5 FE handoff 보강 갭

| 갭 | Phase 3 처리 |
|---|---|
| `changelog.md` 미작성 (handoff doc 운영 변경 기록용) | A19 작성 |
| `coverage-matrix.md` 미작성 (period × category × depth × gating) | A19 작성 |
| `copy-style-guide.md` 미작성 (handoff에서 권장한 운영 doc) | A19 작성 |
| `glossary-review.md` 미작성 | A19 작성 |
| sample fixture 7개 → 10-15개 확장 (시간 미상, 야자시 boundary, 절기 boundary, 종격, 외격 등 edge case) | A19 |

---

## 3. 안전 조건 (Non-Negotiable Invariants)

다음 invariant를 깨는 PR은 **머지 금지**. agent dispatch 전 모든 agent에게 명시적으로 전달.

### 3.1 ../namespring 무손
- ../namespring/src/** 절대 수정 금지
- ../namespring/package.json·vite.config.js 등 build 파일 무수정
- ../namespring/public/data/** 무수정 (이는 NameSpring이 ship하는 데이터)
- 만약 NameSpring 측 변경이 필요한 발견이 생기면 → handoff doc에 기록만, FE PR은 별도 사용자 승인 후

### 3.2 API IMMUTABLE
- `src/index.ts` export 시그니처 무변경
- `src/types.ts` interface 시그니처 무변경 (새 옵셔널 필드 추가는 가능, 기존 필드 변경 금지)
- 새 method 추가 금지 (기존 method 시그니처 유지)

### 3.3 Backward Compat
- `npm run test:namespring-compat` 202/202 PASS 유지 (Phase 3 동안 invariant)
- 모든 default 동작 무변경 — 새 옵션은 opt-in only
- `precisionConfig` 새 옵션 추가 시 default false / 'auto' 유지
- DEFAULT_CHANGELOG entry 발생 시 = stop, 사용자 승인 필요

### 3.4 Phase 2 frozen contract 보존
- `data/narrative/_contract/v1.json` 무변경 (frozenAt 2026-05-02)
- `gatingFieldWhitelist` 무변경 (확장은 §6 추가 절차 8단계 준수, Phase 3 dispatch 후에는 frozen)
- `noAiPolicy.mandatoryFields` 무변경
- `selectionSeed.algorithm` 무변경 (FNV-1a 32-bit)

### 3.5 PR 위생
- 1 PR ≤ 300 LOC (코드 + data 합계, 단 글로사리/fragment bundle은 단일 의도이면 예외 가능 — agent 11/15 한정)
- 1 commit = 1 intent (Conventional Commits 형식 준수)
- `gh pr merge --rebase --delete-branch` 머지 (squash 금지)
- 커밋 메시지 한 줄 + 본문에 측정 결과 (before / after) 명기

### 3.6 검증 게이트
모든 PR 머지 전 다음 PASS 필수:
```
npm run typecheck
npm run ci:no-ai-policy
npm run test:namespring-compat
npm run test:tiered-shape
npm run test:tiered-determinism
npm run test:tiered-isolation
npm run test:narrative-schema
npm run ci:narrative-voice
npm run ci:narrative-density
npm run ci:narrative-tuple-density
npm run ci:narrative-cell-axis
npm run service:readiness  (status: ready_for_frontend_integration)
```

---

## 4. 20-Agent 분배 설계 (Phase 3)

### 4.1 Group A — Per-Category Quality Polish (agent A1-A10, 10명)

각 agent는 Phase 2 categoryToAgent 매핑을 그대로 계승 (`_contract/v1.json` `fragmentIdConvention.ownership`).

| Agent | 카테고리 | owned prefix | 핵심 task |
|---|---|---|---|
| A1 | wealth | `data/narrative/wealth/**` | brief headline 28자 audit + 단어 반복 정량 측정 (`결`, `흐름` 등) + 격국 7개 axis 활용 다양화 |
| A2 | health | `data/narrative/health/**` | 동일 + 의학 단정 회피 voice 검수 |
| A3 | academic | `data/narrative/academic/**` | 동일 + 시험·합격 단정 회피 + ageBand 변형 |
| A4 | romance | `data/narrative/romance/**` | 동일 + 결혼·이성 단정 회피 + 합화 axis 추가 |
| A5 | family | `data/narrative/family/**` | 동일 + 비교·차별 회피 + 12궁 axis 활용 |
| A6 | career | `data/narrative/career/**` | 동일 + 직업명 단정 회피 + 십성(관성) axis |
| A7 | study_document | `data/narrative/study_document/**` | 동일 + 인성 axis + 시험 시기 변형 |
| A8 | expression_children | `data/narrative/expression_children/**` | 동일 + 무자녀 단정 회피 + 식상 axis |
| A9 | health_stress | `data/narrative/health_stress/**` | 동일 + 진단·약 단정 회피 + 신강약 axis |
| A10 | movement | `data/narrative/movement/**` | 동일 + 거주지·국적 단정 회피 + 역마 axis |

#### 각 카테고리 agent의 표준 작업 (5단계)

1. **headline audit**: 자기 prefix 모든 brief.fragments.json의 `templateTokens` plain text rendering 후 `Array.from(text).filter(c => /[가-힣]/.test(c)).length` 로 한글 자모 수 측정. >28자 fragment → 분할 또는 hook으로 이동.

2. **단어 반복 측정**: `tools/narrative_voice_audit.mjs` 출력 + 자기 prefix만 grep `결|흐름|한 박자|페이스` 으로 사용 빈도 측정. 카테고리 내 동일 phrase 3+ 번 등장 시 1-2회로 줄이고 metaphor library 다른 anchor로 치환.

3. **gating 다양화**: 자기 prefix의 gating 분포 측정 (`narrative-axis-pair-report` per-category). 7+ axis 조합 cover하는 fragment 추가 (격국·dayMasterPolarity·birthSeason·yongshinElement 조합 우선). PR 당 +5~10 fragment, gating 다양화.

4. **expert tier tag 활용 다양화**: 자기 prefix expert 파일에서 사용하는 tagId set 추출. _glossary/ 130+ entry 중 카테고리에 자연스러운 anchor 5+개 추가 노출.

5. **회귀 비교**: PR 직전 sample-outputs 1개 fixture (자기 카테고리 강한 사주) 골라 before/after JSON diff. headline 길이 / 단어 빈도 / tag 다양성 metric 명기.

#### 충돌 방지
- A1-A10는 prefix 배타. 다른 category prefix touch 금지.
- _glossary/, _metaphor/, _modifier_*/, _contract/, _coverage/ touch 금지 (B/F group이 owner).
- 모두 같은 PR base는 main; rebase 충돌 시 owner end-to-end 책임.

### 4.2 Group B — Cross-Cutting Refinement (agent A11-A15, 5명)

| Agent | 역할 | owned 디렉토리 | 핵심 deliverable |
|---|---|---|---|
| A11 | glossary deep enrichment | `data/narrative/_glossary/**` | 10 file × ~13 entry → 10 file × ~20 entry. detailed 정의 길이 +30%. brief 정의 ≤24자 일관 |
| A12 | metaphor library 확장 | `_contract/v1.json` 무변경 → **`data/narrative/_metaphor/` 디렉토리 신규 생성** (현재 미존재) | 5 element × 4 anchor (현재 `_contract/v1.json` `voiceRubric.metaphorLibrary`에 inline) → `_metaphor/<element>.json` 분리 + 5 element × 14+ anchor. 시기·시간대 conditional anchor (예: 봄火 vs 여름火). 사용 가이드 doc 추가 |
| A13 | gender modifier doctrine | `data/narrative/_modifier_gender/**` | 가족·연애·커리어 카테고리 별 남/여/중립 변형 phrase pool 확장. NARRATIVE_STYLE_GUIDE §4 강제 |
| A14 | age modifier life-stage | `data/narrative/_modifier_age/**` | 0-9 / 10-19 / 20-29 / 30-39 / 40-54 / 55-69 / 70+ 별 톤 어휘 set 확장. agePhase 16 단계도 추가 |
| A15 | overall pool 정교화 | `data/narrative/overall/**` | 가장 자주 노출되는 cell. 7-axis 가중 활용 + 사주 master narrative 전형성 강화. ←이 agent는 owned prefix 가장 큼 |

#### Group B 의존성 (선후 관계 중요)
- A11 (glossary) → 다른 모든 agent의 expert tier tag 작성 입력
- A12 (metaphor) → A1-A10가 단어 반복 감소 시 다른 anchor로 치환할 때 입력
- A13/A14 (modifier) → A1-A10가 gating 변형 추가 시 입력

따라서 Group B는 Group A보다 먼저 완료 (Wave 2 우선).

### 4.3 Group C — Algorithm / Engine Refinement (agent A16-A17, 2명)

| Agent | 역할 | 영향 모듈 | 핵심 task |
|---|---|---|---|
| A16 | numericalEvidence + 격국 도크트린 | `src/report/tiered/template-engine.ts`, `src/report/tiered/feature-selector.ts` | (a) numericalEvidence label 풍부도 +50%, (b) 격국 candidate scoring score/confidence 분포 sanity, (c) deferred axisStrength 빈도 측정·문서화 |
| A17 | yongshin consensus_aware 정교화 | `src/saju-calculator.ts` (consensus 부분만), `config/saju-scoring.json` | (a) consensus_aware mode의 conflict resolution 다중-rule 활용 빈도 측정, (b) safetyProfile 노출 시 reasons 중복 제거 (현재 reasons 배열에 duplicate 발견), (c) opt-in only — default 'chengbai_strict' 유지 |

#### Group C 안전 조건
- A16/A17은 `src/saju-*.ts`, `src/calculator/**`, `src/spring-engine.ts` 변경 가능하지만:
  - default 동작 변경 금지 (모두 opt-in path 한정)
  - `npm run test:snapshot` 15/15 PASS 유지
  - `npm run validate:default-change` no significant delta
  - saju-ts 측 변경 필요 발견 시 → 별도 PR (saju-ts repo) + Phase 3 plan 갱신
- `data/narrative/**` touch 금지 (Group A/B owner)

### 4.4 Group D — Authority Ingestion (agent A18, 1명)

| Agent | 역할 | owned 디렉토리 |
|---|---|---|
| A18 | 권위 자료 paraphrase ingestion + reference-authority 검증 강화 | `test/baseline/authority/**` (training_derived 외), `tools/validate_reference_authority_cases.mjs` (강화) |

**조건부 dispatch**: 사용자가 본 Phase 3 dispatch 시점에 책 자료 (사주첩경 / 적천수 / 박재완) 일부라도 입수했는지 확인 후 결정.

#### A18 작업 (책 자료 입수 시)
1. P0_EXPERT_INTERNAL_EVIDENCE_REVIEW backlog 상위 5개 셀:
   - `overall.life.expert.agephase.early_40s.301`
   - `health.today.expert.categorical_wave3.neutral_fire_yongshin_metal_sikshingyeok.403`
   - `wealth.thisMonth.expert.categorical_wave2.neutral_earth_yongshin_wood_sikshingyeok.402`
   - `academic.today.expert.ageband.child_teen.301`
   - `family.thisWeek.expert.age.70s.501`
2. 각 셀에 책 quote ≤50자 paraphrase + sourceTier `T2_AUTHORITY_TEXTUAL` + bibliographic metadata.
3. `validate:reference-authority` PASS.

#### A18 작업 (책 자료 미입수 시 — Phase 3 시점 default)
1. `tools/narrative_authority_gap_report.mjs` 출력 강화 (저자별 / chapter별 priority 표).
2. `data/narrative/_authority_intake_template/` 디렉토리 생성 — 책 입수 후 ingestion 시 사용할 schema-conformant template + 운영 절차 doc.
3. `validate_reference_authority_cases.mjs` 의 schema validation 확장 (현재 보장: 빈 flat case OK, unresolved page block, low-tier authority truth block, 50자+ summary block, original prose store block).
4. paid_gate readiness 진단 강화 — sample paraphrase 1개 (사용자가 직접 입력한 안전한 출처)로 end-to-end 흐름 검증.

### 4.5 Group G — Legacy Service-Visible Card Polish (agent A21, 1명)

> **추가 배경**: advisor 검토 결과 — Codex의 최근 commit 분석 시 `src/report/cards/category-fortune-card.ts`, `src/report/cards/overview-summary-card.ts`, `src/report/cards/period-fortune-card.ts` 등 NameSpring이 **현재 보고 있는** legacy 카드 함수도 함께 수정해 왔음 (e.g., commit `0959f71`은 `data/narrative/**` + `src/report/cards/**` 동시 수정). Phase 3가 tiered 만 다루면 사용자에게 즉시 보이는 텍스트 개선이 누락됨.

| Agent | 역할 | owned 디렉토리 |
|---|---|---|
| A21 | NameSpring legacy fields (overviewSummary, dailyFortune, categoryFortunes 등) 텍스트 정교화 | `src/report/cards/**` (text-only changes), `src/report/buildFortuneReport.ts` (text 영역만) |

#### A21 작업
1. NameSpring이 현재 소비하는 legacy fields의 narrative 어구 audit:
   - `overviewSummary.dayMasterDescription` / `yongshinDescription` / `overallSummary`
   - `lifeFortuneOverview.summary` / `highlights[]`
   - `dailyFortune.summary` / `goodActions[].text` / `badActions[].text`
   - `weekly/monthly/yearlyFortune.summary`
   - `categoryFortunes[*].summary` / `advice[].text` / `caution.signal`
   - `lifeStageFortune.stages[].summary` / `highlights[]`
2. 다음 6 카테고리 강한 사주 fixture에 대한 sample regeneration before/after:
   - 1986-04-19 최성수 (신약, 용신 METAL)
   - 2013-07-21 김서윤 (어린 여성)
   - 1992-11-03 박민지 (성인 여성, 야자시)
   - 2001-01-15 이하준 (시간 미상, 중립)
   - + 강한 격국 case 1, 외격 case 1
3. 같은 어구 (`결이`, `흐름이`, `한 박자`)의 사용 빈도 측정 + 카테고리 균등 분포 (단어 빈도 dispersion 확인)
4. 회귀 비교 — `npm run test:service-visible-output` PASS 유지

#### A21 안전 조건
- `data/narrative/**` touch 금지 (Group A/B owner)
- 점수 함수, scoring 로직 변경 금지 (text 영역만)
- 새 default flip 금지
- API 시그니처 변경 금지
- `npm run test:namespring-compat` 202/202 PASS 유지

### 4.6 Group E — FE Handoff & Sample Polish (agent A19, 1명)

| Agent | 역할 | owned 디렉토리 |
|---|---|---|
| A19 | FE handoff doc 정교화 + sample regeneration + 회귀 비교 | `../namespring-tiered-frontend-handoff/**` (read-write), `lib/spring-ts/artifacts/sample-outputs-*/` |

#### A19 작업
1. `../namespring-tiered-frontend-handoff/` 의 운영 doc 4개 작성:
   - `changelog.md` — Phase 3 동안 narrative/glossary/contract 변경 history
   - `coverage-matrix.md` — period × category × depth × gating coverage 요약 (자동 생성 or 수동)
   - `copy-style-guide.md` — `lib/spring-ts/docs/NARRATIVE_STYLE_GUIDE.md` 의 FE-friendly 요약 + 사례
   - `glossary-review.md` — A11 산출 130+ → 200+ entry로 확장된 glossary review 기록
2. `artifacts/sample-outputs-2026-05-MM-N/` (Phase 3 종료 시점 폴더) 생성. 10-15개 fixture:
   - 기존 7개 + 다음 추가:
     - 시간 미상 + 종격
     - 야자시 boundary (23:30 출생)
     - 절기 boundary (입절 ±1일)
     - 외격 (從旺/從財/從官 등 1개씩)
     - 신강극강 (M-D7 continuous strength tier 4)
     - 신약극약 (반대)
     - 12궁/60갑자 surface ON
3. NameSpring legacy fields vs tieredMatrix opt-in JSON diff 자동화 → spectro 회귀 비교 결과를 handoff doc 에 첨부.

#### A19 안전 조건
- `../namespring/src/**` 절대 무수정 (※ FE 코드)
- handoff doc은 별도 디렉토리 (`namespring-tiered-frontend-handoff/`)로 ../namespring 본체와 분리됨 → 안전

### 4.7 Group F — Coordination & QA (agent A20, 1명)

| Agent | 역할 | 권한 |
|---|---|---|
| A20 | cross-agent 통합 검수 + voice/depth 메타-감사 + 충돌 해결 + 최종 검증 | 어느 prefix든 patch 가능 (어휘만, 의미·gating 변경 금지) — Phase 2 reviewer rule 계승 |

#### A20 책임 (5가지)

1. **Cross-category voice consistency**:
   - A1-A10 산출 후 random fixture 30개로 카테고리별 voice rendering 비교
   - `~해요`/`~에요`/`~이에요` 종결어 일관 audit (현재 `narrative-voice-audit` 통과 = sane base)
   - 비유 (오행 → 식물·날씨·요리·건축·악기 등) cross-category 균등 사용 확인

2. **Depth coherence**:
   - 같은 셀 brief↔standard↔expert 가 같은 의미를 다른 깊이로 전달하는지 sample audit
   - brief = standard 첫 문장 그대로인 cell 발견 → A1-A10에 patch request

3. **Numeric evidence sanity**:
   - expert depth numericalEvidence label 다양성 측정 (현재 ~3 label 위주)
   - A16 출력 후 label 다양성 metric +50% 확인

4. **Conflict 해결**:
   - 서로 다른 agent가 같은 _glossary entry 또는 _modifier_* phrase 추가 요청 → A11/A13/A14가 머지하되 A20이 voice 일관 수렴

5. **Final 검증**:
   - 모든 wave 종료 시 full `npm run test:integration` (75+ test) PASS
   - `service:readiness` ready_for_frontend_integration 유지
   - sample regeneration before / after diff 사용자 보고용 한 페이지 요약 작성

---

## 5. Wave 순서 (dispatch sequencing)

작업 순서 — 충돌 최소화 + 의존성 준수.

### Wave 0 (사용자 승인) — 즉시
- 사용자가 본 plan 검토 후 승인 신호
- 명시 비승인 시 plan 갱신·재논의

### Wave 1 (foundation) — A18 + A20 setup
- A18: book 입수 여부 확인 후 권위 ingestion 또는 schema 강화 결정
- A20: random 30 fixture seed 결정, before-state snapshot capture (`narrative_coverage_report` + `service_readiness` + sample regeneration)

### Wave 2 (cross-cutting building blocks) — A11-A15 병렬 (5 agents)
- A11 (glossary), A12 (metaphor), A13 (gender), A14 (age), A15 (overall)
- 모두 독립적, prefix 배타 → 병렬 안전
- Wave 2 완료 = `narrative-schema.test` PASS + glossary count 200+

### Wave 3 (per-category) — A1-A10 병렬 (10 agents)
- prefix 배타. Wave 2 출력 활용.
- 각 agent 평균 2-3 PR 예상 (총 20-30 PR)
- Wave 3 완료 = `ci:narrative-density` PASS + `ci:narrative-cell-axis` PASS + sample regeneration after-state

### Wave 4 (algorithm / engine + legacy cards) — A16, A17, A21 병렬 (3 agents)
- A16, A17, A21은 모두 `src/**` 영역이지만 owned scope가 분리됨:
  - A16: `src/report/tiered/template-engine.ts` + `src/report/tiered/feature-selector.ts`
  - A17: `src/saju-calculator.ts` (consensus 부분만), `config/saju-scoring.json`
  - A21: `src/report/cards/**` (text 영역만), `src/report/buildFortuneReport.ts` (text 영역만)
- 충돌 없음 — 병렬 안전
- Wave 4 완료 = `npm run test:snapshot` 15/15 PASS + `validate:default-change` no significant delta + `service-visible-output.test` PASS

### Wave 5 (FE polish + final QA) — A19 + A20 (sequential)
- A19: handoff doc + sample regeneration (Wave 4 산출 후)
- A20: full integration test + voice/depth meta-audit + 사용자 보고용 요약 (마지막)

---

## 5.5 Dispatch Mechanism (실제 도구 사용 명세)

> **추가 배경**: advisor 검토 — `subagent_type` + `model` override + branch 전략이 명시되어야 dispatch 가능.

### 5.5.1 Agent 도구 매핑

| Group | Agent | subagent_type | model | isolation |
|---|---|---|---|---|
| A | A1-A10 | `general-purpose` | `opus` | `worktree` (각 agent 독립 worktree) |
| B | A11-A15 | `general-purpose` | `opus` | `worktree` |
| C | A16-A17 | `code-logic-optimizer` | `opus` | `worktree` |
| D | A18 | `general-purpose` | `opus` | `worktree` |
| E | A19 | `general-purpose` | `opus` | `worktree` |
| F | A20 | `general-purpose` | `opus` | (main worktree, 다른 agent PR review만) |
| G | A21 | `code-logic-optimizer` | `opus` | `worktree` |

#### model 선택 근거
- `opus` (Claude 4.7 Opus): 사용자 명시 요청 ("Opus with max effort teammate들 20명")
- `sonnet`은 fallback으로 절대 사용 금지 (사용자 요청과 어긋남)
- 단, agent 호출 시 `Agent` 도구의 `model` 파라미터에 `'opus'` 명시 (default가 sonnet/haiku로 떨어질 수 있으므로)

#### subagent_type 선택 근거
- `code-logic-optimizer` (A16, A17, A21): 알고리즘 / 코드 영역 — extended thinking으로 정교한 검증
- `general-purpose` (그 외): 데이터/문서 영역 — 다양한 도구 풀 필요

### 5.5.2 Branch / PR 전략

각 agent는 자기 worktree에서 별도 branch:
- Branch 명명: `phase3/<agent-id>-<short-scope>` (예: `phase3/a1-wealth`, `phase3/a16-template-engine`)
- Base: `main`
- Push: agent 작업 완료 후 push
- PR: agent가 직접 `gh pr create` 발행 (`--base main`)
- Conflict: rebase. 충돌 시 owner 책임. A20이 wave 종료 시 PR list 정리.
- Merge: 사용자가 직접 `gh pr merge --rebase --delete-branch` (squash 금지)

### 5.5.3 Wave 동시 실행 호출 패턴 (Opus 본체가 하는 것)

Wave 2 시작 시 — 1개 메시지에 5 Agent 도구 호출 병렬:
```
Agent(A11 brief, subagent_type='general-purpose', model='opus', isolation='worktree')
Agent(A12 brief, subagent_type='general-purpose', model='opus', isolation='worktree')
Agent(A13 brief, subagent_type='general-purpose', model='opus', isolation='worktree')
Agent(A14 brief, subagent_type='general-purpose', model='opus', isolation='worktree')
Agent(A15 brief, subagent_type='general-purpose', model='opus', isolation='worktree')
```

5 agent가 동시 실행 → Opus 본체는 5 결과 수신 후 검증 → 다음 wave로.

Wave 3 (10 agent), Wave 4 (3 agent) 도 동일 병렬 패턴.

### 5.5.4 사용자 가시성

각 agent는 `Agent` 도구의 `description` 파라미터에 짧은 설명 명시 (예: "wealth 카테고리 brief headline 28자 audit"). 사용자 화면에서 어떤 agent가 무엇을 하고 있는지 한 눈에 파악 가능.

---

## 6. Per-Agent Contract (dispatch 시 표준 brief)

각 agent는 dispatch 시 다음 brief를 받는다 (예시는 A1-wealth):

```markdown
# Agent A1 — wealth category quality polish

## Frozen inputs (수정 금지)
- data/narrative/_contract/v1.json
- docs/NARRATIVE_TEMPLATE_DSL.md
- docs/NARRATIVE_STYLE_GUIDE.md
- data/narrative/_glossary/**.json (Wave 2 출력 — 본 dispatch 시점에 frozen)
- data/narrative/_metaphor/**.json
- data/narrative/_modifier_gender/**.json
- data/narrative/_modifier_age/**.json

## Owned scope (수정 가능)
- data/narrative/wealth/**/*.fragments.json

## Forbidden scope (touch 금지)
- 다른 카테고리 prefix (overall, health, academic, romance, family, career,
  study_document, expression_children, health_stress, movement)
- _glossary/, _metaphor/, _modifier_*/, _contract/, _coverage/, _seed/
- src/, test/, tools/, docs/ (단 측정 결과 신규 doc은 PR 본문에 인용)
- ../namespring/**

## Tasks (5 standard)
1. brief.headline ≤28자 audit + 위반 fragment 분할
2. 단어 반복 감소 (`결` 사용 빈도 -50% 목표)
3. gating 다양화 (격국·birthSeason·dayMasterPolarity 조합 +5 fragment)
4. expert tier tag 다양화 (사용 tagId set 5+ 새 anchor)
5. 회귀 비교: 1986-04-19 최성수 fixture wealth cell before/after diff

## Acceptance
- npm run typecheck PASS
- npm run ci:no-ai-policy PASS
- npm run test:namespring-compat PASS (202/202)
- npm run test:tiered-shape PASS
- npm run test:narrative-schema PASS
- npm run ci:narrative-voice PASS (0 violations)
- PR ≤300 LOC, 1 commit = 1 intent
- PR 본문에 before/after metric 표

## Output
- 1-3 PR. 각각 1 단일 의도 commit.
- A1는 main에서 직접 분기, rebase 충돌 시 self-resolve.
```

다른 agent의 brief는 위와 같은 구조로 owned scope / forbidden scope / tasks / acceptance 만 변경.

---

## 7. 검증 파이프라인

### 7.1 매 PR 검증 — light gate (agent self, ~30s)

> **개정 (advisor 권고)**: 매 commit마다 12개 명령 = 10분 burn. light vs heavy 분리.

```bash
cd lib/spring-ts
npm run typecheck                           # ~5s
npm run ci:no-ai-policy                     # ~3s
npm run test:tiered-isolation               # ~5s (격리 invariant)
npm run test:narrative-schema               # ~10s
npm run ci:narrative-voice                  # ~3s
```

**Light gate criteria**: 위 5개 모두 PASS. 위반 시 commit 차단.

### 7.1b 매 PR 머지 직전 — heavy gate (agent self, ~3-5min)

```bash
npm run test:namespring-compat              # 202/202 PASS 필수
npm run test:tiered-shape
npm run test:tiered-determinism
npm run ci:narrative-density
npm run ci:narrative-tuple-density
npm run ci:narrative-cell-axis
npm run service:readiness                    # frontendHandoff.status === 'ready_for_frontend_integration' AND zeroAuthorityCells === Wave-0 baseline
```

**Heavy gate criteria**:
- `test:namespring-compat` 202/202 (regression 0)
- `service:readiness` JSON 비교 시 `frontendHandoff.status === 'ready_for_frontend_integration'`
- `service:readiness` 의 `zeroAuthorityCells` 가 Wave-0 baseline (165) 와 동일 또는 ↓ (책 입수 시)
- service:readiness exit code: ⚠ commercial readiness blocker는 expected, 따라서 stdout 의 `Frontend handoff:` 라인 기준 PASS

### 7.2 매 Wave 종료 검증 (A20 또는 Opus 본체)

위 + 추가:
```bash
npm run test:integration       # 75+ test 풀스위트
npm run test:snapshot          # 15/15 baseline regression
npm run validate:default-change
npm run service:readiness:paid-gate  # 책 입수 전까지 expected fail OK
```

### 7.3 Phase 3 전체 종료 검증 (사용자 보고 직전)

위 + 추가:
- ../namespring/dist 가 새 spring-ts/dist를 정상 import 하는지 (NameSpring `npm --prefix namespring run build` PASS — 단 본 plan은 ../namespring 무수정이므로 build는 사용자가 직접 실행)
- sample-outputs-2026-05-MM-N/ 와 이전 2026-05-04/ JSON diff 한 페이지 요약 (사용자 spot-check용)
- service:readiness 결과 before/after 비교 (regression 0건 + 가능하면 metric 향상)

---

## 8. 위험 요소 및 완화

| 위험 | 가능성 | 완화 |
|---|---|---|
| Agent 간 prefix 충돌 | 낮음 | _contract/v1.json categoryToAgent 배타. Wave 2/3 prefix 분리. |
| ../namespring 런타임 회귀 | 매우 낮음 | namespring-compat.test 202/202 invariant. type 시그니처 무변경. 새 surface 모두 opt-in. |
| frozen contract 위반 | 낮음 | Phase 3 동안 _contract/v1.json 무수정 명시. agent brief에 강조. |
| 서브제ctive 품질 drift | 중간 | A20 cross-category voice review + random fixture sample 비교. |
| numericalEvidence 임의 수치 | 낮음 | feature/cell 경로 외 path는 schema 단계에서 차단 (`narrative-fragment-bundle` schema). |
| 책 자료 paraphrase 저작권 위반 | 중간 | 50자 이내 paraphrase + metadata만, original prose store 차단 (validate_reference_authority_cases.mjs). |
| Group C (engine) default 변경 사고 | 중간 | A16/A17 default path 무수정 invariant. snapshot 15/15 invariant. PR 본문에 default delta 측정 명시. |
| PR 크기 폭주 | 중간 | 300 LOC cap, 1 commit = 1 intent. data 단편 양은 단일 의도면 예외 가능 (A11/A15 한정). |

---

## 9. 성공 metric (정량 + 정성)

### 9.1 정량 (직접 측정 가능)

| Metric | Phase 3 시작 (2026-05-05) | Phase 3 종료 목표 |
|---|---|---|
| narrative fragments authored | 3,890 | 4,300+ (+10% gating 다양화) |
| _glossary entries | ~130 | 200+ |
| metaphor library anchor | 5 element × 4 = 20 | 5 element × 14+ = 70+ |
| brief.headline >28자 위반 | 측정 필요 | 0 |
| 단어 `결` 사용 빈도 | high (recent commit polish 진행형) | -50% (혹은 카테고리 균등) |
| numericalEvidence label 종류 | ~10 | 25+ |
| expert tier tag 다양성 (per-cell) | 평균 ~3 | 평균 6+ |
| sample-outputs fixture 수 | 7 | 12-15 |
| service:readiness frontend handoff | ready | ready (회귀 0) |
| service:readiness commercial | blocked | blocked (책 미입수 시 유지, 입수 시 unblocked) |
| namespring-compat | 202/202 | 202/202 (또는 신규 보강 시 ↑) |
| `npm run test:integration` | 통과 | 통과 |
| `npm run test:snapshot` | 15/15 | 15/15 |
| `validate:default-change` | no significant delta | no significant delta |

### 9.2 정성 (사용자 spot-check)

- 1986-04-19 최성수 fixture로 brief→standard→expert 점진 공개 사용자 경험 가독성 향상 체감
- 30개 random fixture cross-category voice consistency (A20 평가)
- _glossary entry brief 정의 ≤24자 일관 + detailed 정의 깊이 향상

---

## 10. Out of Scope (Phase 3에서 다루지 않음)

다음은 NEXT_STEPS_ROADMAP.md 의 Tier 4 또는 별도 책 의존:

- **D-1/D-2 M-D8 retroactive review** — 책 입수 + 21+ fixture 영향 측정 필요. Phase 3 후 별도.
- **E-1 H-S1 yaza wiring deep change** — saju-ts 내부 trace 필요. saju-ts 측 PR.
- **F-1 K-4 per-schema ONSET 표** — 4 schema 별 ONSET-element 표 정의 필요. 한국 작명원 doctrine 비교 분석 + ~450 LOC. Phase 3 후 별도.
- **B-1 jonggyeok 9 cases verification** — 책 9 case cross-reference 필요.
- **B-2 L-6 authority cases verification** — 책 자료 의존.
- **B-3 사주첩경/적천수/박재완 cross-reference** — 책 자료 의존.
- **../namespring/src/** 변경** — FE 작업 (사용자 명시 제외 + 본 plan 외 별도 PR).
- **API 시그니처 변경** — IMMUTABLE, PRINCIPLES_v2 §1.
- **새 default flip** — Phase 3는 quality polish only, default 무변경.

---

## 11. Dispatch 절차 (사용자 승인 후)

### Wave 0 → Wave 1
1. 사용자가 본 plan 명시 승인 (예: "OK, dispatch")
2. Opus 4.7 본체가 Wave 1 (A18 + A20 setup) 시작
3. A18 결정 (book 입수 여부) 사용자 확인
4. A20 capture before-state snapshot

### Wave 1 → Wave 2
1. A18 + A20 deliverable 검증
2. Wave 2 (A11-A15) 5 agent 병렬 dispatch — 모두 동시 시작 가능

### Wave 2 → Wave 3
1. A11-A15 deliverable 검증 (`narrative-schema` PASS + glossary count target)
2. Wave 3 (A1-A10) 10 agent 병렬 dispatch

### Wave 3 → Wave 4
1. A1-A10 deliverable 검증
2. A20 mid-wave consistency review
3. Wave 4 (A16-A17) 2 agent 병렬 dispatch

### Wave 4 → Wave 5
1. A16-A17 deliverable 검증 (`test:snapshot` 15/15 + `validate:default-change` no delta)
2. A19 + A20 final wave (sequential — A19 먼저, A20 나중)

### Phase 3 종료
1. A20 final report 사용자에게 제출
2. PR 머지 순서 정리 (총 30-50 PR 예상)
3. NEXT_STEPS_ROADMAP.md 갱신 (M-? entry: "Phase 3 quality refinement 완료")
4. README.md 의 "Phase" 표 갱신

---

## 12. Frozen Contract Reference

본 plan은 다음 frozen contract를 참조하며, 이들은 Phase 3 동안 무변경:

- `data/narrative/_contract/v1.json` (frozenAt 2026-05-02, contractVersion 1.0.0)
- `docs/PHASE2_AGENT_PARTITION.md` (Phase 2 분업 계승)
- `docs/NARRATIVE_TEMPLATE_DSL.md` (DSL 문법)
- `docs/NARRATIVE_STYLE_GUIDE.md` (톤·depth contract)
- `docs/TIERED_MATRIX_SPEC.md` (matrix 구조)
- `docs/SOURCE_TIER_POLICY.md` (T1-T5 tier 의미)
- `docs/SERVICE_READINESS.md` (frontend vs commercial 분리)
- `docs/NO_AI_POLICY.md` (AI 마킹 + scoring 격리)

---

## 13. 변경 이력

| 일자 | 작성자 | 변경 |
|---|---|---|
| 2026-05-05 | Opus 4.7 (1M context) | 최초 작성, Phase 3 plan dispatch 준비 |

---

## 14. 다음 단계 (사용자 결정 사항)

본 plan을 사용자가 검토한 뒤 다음 중 선택:

1. **승인**: "OK dispatch Phase 3" → Opus 본체가 Wave 0→1 시작
2. **수정 요청**: 특정 group 추가/삭제, scope 조정, agent 재배치
3. **부분 승인**: 일부 wave만 우선 실행 (예: Wave 2 (Group B) 만 우선, Wave 3는 별도 검토)
4. **연기**: 책 자료 입수 후 재검토 (특히 A18 의 권위 ingestion 가치를 위해)

승인 후 dispatch 시 Opus 본체는:
- 각 agent에 §6 표준 brief 발급
- Wave 별 시퀀싱 모니터
- 매 Wave 종료 시 사용자 1줄 status update
- Phase 3 종료 시 A20 final report로 정리
