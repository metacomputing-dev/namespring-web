# Phase 2 Agent Partition (20-agent fan-out)

> 상태: **dispatch 보류**. 시작 전제 = Phase 1 acceptance 모두 PASS + 사용자 명시 승인 + `data/narrative/_contract/v1.json` git committed.

## 0. 컨텍스트

Phase 1 (현 PR) — 구조·인프라·placeholder 완성. 모든 셀에 1개 placeholder fragment.
Phase 2 (이번 spec) — 20명의 Opus agent가 placeholder를 본격 콘텐츠로 채운다.

## 1. Frozen contract

작업 시작 전 모든 agent가 다음을 공통 입력으로 받는다:
- `data/narrative/_contract/v1.json` — slot DSL, gating whitelist, fallback chain priority, NO_AI 마킹 규칙
- `docs/NARRATIVE_TEMPLATE_DSL.md` — 토큰 문법 + 검증 절차
- `docs/NARRATIVE_STYLE_GUIDE.md` — 톤 / 비유 / depth 계약
- `data/narrative/_glossary/*.json` — 50개 anchor (Phase 2-A에서 ~150으로 확장)

frozen contract 변경은 **모든 agent의 산출물 invalidation**을 뜻한다 → Phase 2 dispatch 후 contract 수정 금지.

## 2. Agent 역할 (20)

### 카테고리 작성자 (10)
| Agent | 카테고리 | owned 디렉토리 | 산출 fragment 수 (가이드) |
|---|---|---|---|
| 1 | wealth | `data/narrative/wealth/` | ~250 (5 period × 3 depth × 다양 gating ~17) |
| 2 | health | `data/narrative/health/` | ~250 |
| 3 | academic | `data/narrative/academic/` | ~250 |
| 4 | romance | `data/narrative/romance/` | ~250 |
| 5 | family | `data/narrative/family/` | ~250 |
| 6 | career | `data/narrative/career/` | ~200 |
| 7 | study_document | `data/narrative/study_document/` | ~200 |
| 8 | expression_children | `data/narrative/expression_children/` | ~200 |
| 9 | health_stress | `data/narrative/health_stress/` | ~200 |
| 10 | movement | `data/narrative/movement/` | ~200 |

각 agent의 **입력**: contract + 자기 카테고리 owned prefix + glossary anchor + style guide.
각 agent의 **출력**: `data/narrative/<category>/<period>/<depth>.fragments.json`.
각 agent의 **금기**: 다른 카테고리 prefix에 fragment 작성, glossary 추가/변경, contract 수정.

### Specialized (6)
| Agent | 역할 | 산출 |
|---|---|---|
| 11 | glossary fill | `data/narrative/_glossary/*.json` 확장 (50 → ~150 entries) |
| 12 | metaphor library | 비유 사전 — agent 1-10이 참조 (style guide 안에 mount) |
| 13 | gender modifier | 성별 변형 phrase pool (`data/narrative/_modifier_gender/`) |
| 14 | age modifier | 연령대 변형 phrase pool (`data/narrative/_modifier_age/`) |
| 15 | overall pool | `overall.*` 카테고리 fragment 풀 (`data/narrative/overall/`) |
| 16 | QA | fragment ID collision detector, coverage matrix gap analysis, schema 위반 검출 |

### Reviewers (4)
| Agent | 역할 |
|---|---|
| 17, 18 | 카테고리 간 voice consistency (10 카테고리 voice 일관) |
| 19, 20 | depth/tone consistency (brief↔standard↔expert가 같은 의미를 다른 깊이로) |

reviewer는 patch만 한다. 새 fragment ID 추가 금지 (1-10·15가 owner). 기존 fragment의 `templateTokens` / `slots` / `livingTips` / `cautions` 어휘 정정 가능.

## 3. Dispatch 절차

1. Phase 1 acceptance criteria 모두 PASS 확인:
   ```
   npm run typecheck
   npm run ci:no-ai-policy
   npx tsx test/integration/namespring-compat.test.ts
   npx tsx test/integration/tiered-matrix-shape.test.ts
   npx tsx test/integration/tiered-matrix-determinism.test.ts
   npx tsx test/integration/narrative-schema.test.ts
   npx tsx test/integration/tiered-isolation-guard.test.ts
   ```
2. `data/narrative/_contract/v1.json`을 main에 git commit (frozen).
3. 사용자 명시 승인 (`Phase 2 dispatch 시작`).
4. Agent 0 산출물(contract) 검토 후 dispatch:
   - 1차 wave: agent 11 (glossary fill) — anchor 50 → 150 확장. 다른 agent들이 인용할 tagId가 더 많아야 함.
   - 2차 wave: agent 12-15 (specialized 보조). agent 1-10이 작업 중 참조할 modifier/metaphor pool 준비.
   - 3차 wave: agent 1-10 (병렬, 카테고리 owned).
   - 4차 wave: agent 16 (QA) — 1-15 산출 검수.
   - 5차 wave: agent 17-20 (reviewer) — voice / depth 정합성 patch.
5. 각 wave 완료 시 `narrative-schema.test.ts` + `tiered-matrix-shape.test.ts` 실행. FAIL 시 해당 wave 산출물 보류.

## 4. 충돌 해결

- **fragment ID 충돌**: prefix 배타이므로 발생 시 ID 위반 → 해당 agent 책임. agent 16 QA가 1차 검출.
- **glossary 충돌**: agent 11만 glossary 작성 권한. 다른 agent는 PR 형태로 추가 요청 (agent 11이 머지).
- **voice 불일치**: agent 17-18이 patch. fragment 의미 변경 금지, 어조만 조정.
- **depth 불일치**: agent 19-20이 patch. brief↔standard↔expert가 같은 셀의 다른 깊이여야.

## 5. 최종 검증

Phase 2 완료 = 다음 acceptance 모두 PASS:
- 기존 Phase 1 모든 test
- `tieredMatrix.meta.contentSource === 'authored'` (placeholder → authored)
- `tieredMatrix.meta.fragmentCount` ≥ 2000 (목표치)
- 카테고리 간 voice consistency reviewer sign-off
- depth consistency reviewer sign-off
- 사용자 spot-check (random fixture chart로 실제 응답 확인)

이후 사용자 결정에 따라:
- Phase 3 (선택) — 기존 카드 (overviewSummary 등)를 tieredMatrix derived view로 마이그레이션 (별도 plan)
- 또는 long-term content care (분기별 reviewer pass)
