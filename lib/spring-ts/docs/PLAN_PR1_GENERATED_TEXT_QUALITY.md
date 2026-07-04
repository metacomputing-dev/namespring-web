# PR1 — 생성 corpus 텍스트 품질: 진단 · 게이트 · 번들 재생성 마스터플랜

> **이 문서가 이 작업의 단일 진실 소스다.** 세션/모델이 바뀌어도 이 문서의 "진행 상태"
> 섹션(§9)부터 읽고 이어가면 된다. 배경: [GENERATION_PIPELINE.md](./GENERATION_PIPELINE.md),
> [REDUCTION_FORMULA.md](./REDUCTION_FORMULA.md), `tools/generation/pairing-contract.md`.
>
> 작성: 2026-07-04, Claude (Fable 5). 작업 워크트리: `C:\tmp\namespring-pr1-text-quality`
> (branch `codex/pr1-text-quality`, base `7d4ee70a0` = origin/main).

## 0. 목표 (완료 기준)

유료 리포트 = 한 사람에게 **여러 generated JSON 셀이 동시에 노출되는 조합**이다. 목표:

1. **반복 제로에 수렴**: 한 사람이 보는 리포트 안에서 같은 문장·같은 골격이 반복되지 않는다.
   (요약 exact 중복 0, 골격 중복 ≤2, 도배 상투구 0)
2. **어색한 문장 0**: 조사 오류, 마침표 누락, 코드 식별자 노출, 격식체 파편이 없다.
3. **평문↔전문가 페어링 유지**: 괴리 0 (기존 `validate-generated.ts` 방향 정합 규칙 유지).
4. **재발 방지**: 낮은 품질/스탬핑 산출물이 ingest 게이트를 **물리적으로 통과할 수 없다**.
5. 돈 내고 봐도 아깝지 않은 리포트. 테스트 통과 ≠ 승인 — **사람(모델)이 직접 정독**해야 승인.

## 1. 실측 진단 (2026-07-04, corpus = origin/main 7d4ee70a0)

`data/generated/` 21,060개 파일 전수 측정 (재측정 명령: §5 audit 도구):

| 항목 | 전체 | 고유값 | 중복률 |
|---|---|---|---|
| summary | 21,060 | **133** | 99.4% |
| body 문단 | 84,239 | **573** | 99.3% |
| expert 문단 | 42,120 | **576** | 98.6% |
| livingTips | 63,179 | **194** | 99.7% |

- `"차분히 다질"` 19,778개 파일 / `"작은 기준"` 20,484개 / `"오늘의 첫걸음"` 19,224개.
- 최다 summary: `"타고난 힘이 단단한 편이라, 가족 관계는 차분히 다질 때 좋아요."` ×810.
- **원인: 이 corpus는 LLM 저작물이 아니라 프로그램 템플릿 스탬핑이다.** 증거:
  - expert 문단에 `generate-manifest.ts`의 상수 문자열이 **그대로** 박힘:
    `"자립·경쟁·동료로 나를 세우는 구조. 주체적으로 밀고 나가는 전략이 맞음."`
    (해요체 본문 한가운데 명사종결 격식체 파편)
  - expert 문단에 **코드 식별자** `combinedDistribution` 노출 (NAME_EFFECT_EXPERT 상수가 verbatim 붙여넣어짐).
  - 조사 오류 `"비겁 계열(비견·겁재격)는"`, 마침표 누락 `"힘이 붙는 편이에요 그래서"`가
    전 카테고리 파일에 동일하게 복제.
  - 같은 골격에서 도메인 단어(가족 관계/공부 흐름/…)와 팁 몇 개만 치환됨 (romance↔academic
    파일을 나란히 보면 문단 구조·문장이 동일).
- 경위(메모리 기록): OPUS per-item 하네스로 진행하던 생성 작업이 Claude 사용량 한도로
  Codex에 이관됐고(`CLAUDE_TO_CODEX_HANDOFF.md`), 이관 후 실제 LLM 저작 대신 템플릿 확장으로
  채워진 것으로 보인다. `validate-generated.ts`는 단일 글의 구조/분량/페어링만 검사하므로
  스탬핑을 걸러낼 수 없었다.
- **주의**: base 완결글 330편(`data/articles/**`)은 사람 검수 품질이며 이번 작업 대상이 아니다
  (폴백으로 유지). `"40~49세 책임의 정점…"` 반복은 `stages.articles.json` base 문구 → §8 후속.

## 2. 전략 (결정 사항과 근거)

**(A) 게이트 먼저, 재생성은 그 다음.** 게이트 없이 재생성하면 어떤 생성자든(사람/Claude/Codex)
다시 스탬핑·상투구로 수렴해도 막을 수 없다. 게이트가 서면 재생성 주체가 누구든 품질이 강제된다.

**(B) 재생성 단위 = 클래스 1개가 아니라 "번들"(한 사람의 챕터).**
클래스 축(강약·격국·nameEffect·성별·audience)은 **한 사람 안에서 고정**이고, 한 사람은 같은
카테고리에서 (기간 5 × 등급) 셀들을 함께 본다. 매니페스트를 person-key로 묶으면:

- 성인 번들 = **15편** (5 periods × 3 bands) — 한 에이전트가 "이 사람의 이 분야 챕터 15편"을
  한 번에 저작 → **번들 내 다양성·페어링·일관성을 생성 시점에 보장**.
- 미성년 번들 = 5편 (5 periods × band any), 생애단계 번들 = 5편 (stage-teen/early/mid/senior/elder).
- 전량 = **~2,470 번들 호출** (per-item 21,060회 대비 ~1/8 비용, 품질은 구조적으로 우수).
- 공유 스펙(강약·격국·nameEffect)은 프롬프트에 1회만 → 토큰 절약 + 방향 정합 자동 유지.

**(C) 도배 상투구는 신규 생성에서 전면 금지(소각).** `"차분히 다질"`, `"작은 기준"`,
`"오늘의 첫걸음"` 등은 문구 자체가 나빠서가 아니라 **1.5만~2만 파일에 도배되어 소각(burned)**
되었기 때문에 신규 생성물에서 하드 금지한다. 목록은 §4 `BURNED_PHRASES`.

**(D) 전량 재생성이 필요하다** (99%+ 스탬핑이라 부분 수선 불가). 단, 카테고리 웨이브로 나눠
진행하고 각 웨이브마다 게이트+감사+표본 정독을 통과해야 다음 웨이브로 간다. 우선순위:
`overall`(히어로) → `wealth`·`health`·`career` → 나머지. 성별민감(romance/family/career)은
번들 수가 2배(성별 축).

**(E) 화면 조립 반복(히어로/이름적합도 summary 재사용, stages base 문구)은 별도 후속**(§8).
이번 PR 범위가 아님 — 섞으면 리뷰 불가 diff가 재발한다.

## 3. 산출물 파일 맵 (이 PR에서 추가/수정)

```
tools/generation/text-quality-rules.ts      # [재작성] 원리 기반 텍스트 결함 + 다양성 규칙 (§4)
tools/generation/audit-corpus-diversity.ts  # [신규] corpus 전수 다양성/결함 감사 → MD+JSON 리포트 (§5)
tools/generation/prepare-bundles.ts         # [신규] 매니페스트 → person-key 번들 배치 (§6)
tools/generation/bundle-prompt.ts           # [신규] 번들(챕터) 프롬프트 + 출력 스키마 (§6)
tools/generation/run-bundles.wf.js          # [신규] Workflow: 번들당 1 에이전트 fan-out (§6)
tools/generation/ingest-bundles.ts          # [신규] 번들 결과 검증(개별+번들 다양성) → 저장 (§6)
tools/generation/validate-generated.ts      # [수정] validatePlainTextQuality 연결(개별 글 규칙)
test/integration/generated-text-quality.test.ts  # [신규] 게이트 fixture 테스트 (§7)
package.json                                # [수정] test:generated-quality, audit:generated 스크립트
docs/PLAN_PR1_GENERATED_TEXT_QUALITY.md     # 이 문서
```

기존 per-item 하네스(`prepare-batch.ts`/`run-fileread.wf.js`/`ingest-batch.ts`)는 **동결 유지**
(리젝 소수 재생성용 `--ids` 경로로 여전히 유용). 번들 하네스는 별도 파일로 추가한다.

## 4. 게이트 명세 — `text-quality-rules.ts` (재작성)

개별 글 규칙 (`validatePlainTextQuality`, `validateGenerated`에 연결 → ingest에서 하드 리젝):

| 규칙 id | 내용 | 예(현 corpus 실제 결함) |
|---|---|---|
| `josa-after-paren` | `)` 직후 단독 조사의 받침 정합 (받침○→은/이/을/과, 받침×→는/가/를/와) | `…겁재격)는` |
| `missing-period-runon` | 해요체 종결어미 뒤 공백+접속사 (마침표 누락) | `편이에요 그래서` |
| `code-identifier` | 슬롯/태그 밖의 라틴 식별자 노출 | `combinedDistribution` |
| `spec-constant-verbatim` | 매니페스트 스펙 상수의 verbatim 붙여넣기 | `전략이 맞음` |
| `formal-fragment` | 해요체 본문 속 명사종결·격식체 파편 (expert 포함) | `…구조. 주체적으로` |
| `burned-phrase` | 소각 상투구(BURNED_PHRASES) 사용 | `차분히 다질`, `작은 기준`, `오늘의 첫걸음`, `손에 잡히는 장면` 등 |
| `generic-summary-frame` | 소각 summary 골격(현 corpus top 골격) | `타고난 힘이 X 편이라, Y는 …` |

번들/화면 다양성 규칙 (`bundleDiversityViolations`, `ingest-bundles.ts`에서 하드 리젝):

| 규칙 id | 내용 | 기준 |
|---|---|---|
| `bundle-duplicate-summary` | 번들 내 summary exact 중복 | 0 허용 |
| `bundle-summary-skeleton` | 번들 내 summary 골격(도메인어·강약어·슬롯 정규화 후) 중복 | 동일 골격 ≤2 |
| `bundle-duplicate-paragraph` | 번들 내 body/expert 문단 exact 중복 | 0 허용 |
| `bundle-ngram-stamp` | 정규화 문자 12-gram이 번들 내 4개 이상 셀에 등장 (스탬핑 신호) | <4셀 |
| `bundle-duplicate-tip` | 번들 내 동일 livingTip | ≤2셀 |
| `cross-bundle-duplicate-paragraph` | **번들 간** body/expert 문단 exact 재사용 (같은 카테고리의 regen 전체와 대조 — 이름 후보 비교 시 인접 nameEffect 번들이 나란히 노출되므로) | 0 허용 |

> 웨이브1 실측 교훈: 인접 번들(격국·nameEffect만 다름)에 거의 동일한 스펙이 가니 서로 다른
> 에이전트가 **같은 문장으로 수렴**한다. 방어 2중: ① 게이트(위 cross-bundle 규칙, ingest layer 3)
> ② 프롬프트에 번들별 결정적 **소재 팔레트**(fnv1a(bundleKey)로 8종 중 2개 + 문체 결) 주입.

skeleton 정규화: 공백 정규화 → `{{슬롯}}`→`<slot>` → 강약 형용사(여린/고른/단단한)→`<s>` →
카테고리 도메인어(가족 관계/공부 흐름/…)→`<d>`. (구현이 진실이다 — 함수 `summarySkeleton` 참조.)

## 5. 감사 도구 — `audit-corpus-diversity.ts`

```bash
npm run audit:generated            # 전체 corpus (또는: npx tsx tools/generation/audit-corpus-diversity.ts [category])
```

출력: 카테고리별 고유율(summary/body/expert/tips), top-N 반복 summary·문구(자동 n-gram 채굴),
번들 시뮬레이션(person-key별 within-report 중복 최악 사례), 개별 결함 규칙 히트 수.
`data/generation/audit/` 에 JSON 저장(집계만, 작음) — 웨이브 전/후 비교의 기준선.
**§1의 수치가 이 도구의 재실행으로 재현되어야 한다.**

## 6. 번들 재생성 하네스

```bash
# 1) 번들 배치 준비 (기본: 이미 regen 완료된 번들 skip; --all로 강제 포함)
npx tsx tools/generation/prepare-bundles.ts <category> --offset 0 --count 30
#    → data/generation/batches/bundles-<category>-<offset>-<count>.batch.json
#      { schema, bundles:[{bundleKey, caseIds:[...], prompt}] }

# 2) 생성 — ★정식 경로: Message Batches API (2026-07-05 전환. 세션 사용량과 분리,
#    50% 할인, 전량을 배치 몇 번으로 처리. API 키는 레포 루트 .env — 절대 커밋 금지)
npx tsx tools/generation/submit-batch.ts <batchFile...> --model=sonnet|opus --tag=<wave-tag>
#    → apibatch-<id>.json 매니페스트 + 비용 추정 출력. custom_id=bundleKey(점→하이픈)
npx tsx tools/generation/fetch-batch.ts <batchId> --wait
#    → results-<batchId>.json (ingest 입력 형태) + 실패 번들 재실행 명령 출력
#    보통 1시간 내 완료(최대 24h). 실패(리젝/절단/거부)는 --keys 재준비 → 다음 배치.
#
#    (레거시 대안: run-bundles.wf.js Workflow 하네스 — 세션 토큰 소모가 커서 배치 전환.
#     extract-workflow-result.mjs로 결과 추출. 소량 긴급 재생성에만.)

# 3) 검증·저장 (개별 게이트 + 번들 다양성 게이트 통과분만)
npx tsx tools/generation/ingest-bundles.ts <results.json> --source=regen-2026-07-w1
#    리젝 케이스는 로그에 남음 → 남은 것만 담은 번들을 재생성 (부분 재생성 시 이미 저장된
#    같은 번들 형제들과의 중복도 검사함)

# 4) 웨이브 완료 후: 감사 재실행 + 표본 정독 + 커밋
npm run audit:generated
git add lib/spring-ts/data/generated/<category>/   # ⚠ 절대 git add -A 금지
```

- **덮어쓰기 정책**: regen은 기존 스탬핑 파일을 그대로 덮어쓴다(`sourceNote: regen-2026-07-w<N>`).
  prepare-bundles의 "완료" 판정 = 번들 내 모든 파일의 sourceNote가 `regen-` 접두 → 재개 가능(resumable).
- **프롬프트 원칙**(`bundle-prompt.ts`): 공유 스펙(강약·격국·nameEffect·성별 — 페어링 계약 §3) 1회
  + 셀 좌표 목록(기간×등급) + **다양성 계약**: ① 15편 summary 전부 다른 문형(골격 중복 금지),
  ② BURNED_PHRASES 금지, ③ 기간별 관점 분리(today=오늘 실행 1가지 / thisWeek=한 주 리듬 /
  thisMonth=한 달 프로젝트 / thisYear=연간 방향 / life=기질·긴 호흡), ④ 등급별 톤(high=기회 활용,
  mid=유지·정돈, low=방어·회복 — 단 공포 조장 금지), ⑤ 구체 장면·소재는 셀마다 다르게,
  ⑥ 기존 게이트 전 규칙(해요체·분량·평문 용어금지·태그 2~6·nameEffect 정직성).
- **모델**: Sonnet 5 vs Opus 4.8 파일럿 A/B로 결정(2026-07-05, 동일 12번들 양쪽 제출 —
  게이트 통과율 + 정독 비교. Sonnet 인트로 배치 $1/$5 vs Opus $2.5/$12.5 → 전량 ~$190 vs ~$500).
- **PR 전략(2026-07-05 사용자 결정)**: diff 크기로 쪼개지 않는다. 품질을 끝까지 올려 한 PR로
  전달, 평가는 실사용으로. 웨이브별 커밋은 유지(진행 추적·롤백용).
- 생성 후 `pack-generated.ts` 재실행 필요(브라우저 번들은 파생 자산, prod 빌드 전 필수).
- **전량 규모 확정**: 2,196 번들(비민감 8카테고리×180 + 민감 3×252) = 21,060편.

## 7. 테스트 — `test/integration/generated-text-quality.test.ts`

fixture는 **테스트 파일에 동결된 문자열**(라이브 corpus를 읽지 않음 — 재생성 후에도 그린 유지):
1. 현 corpus에서 복사한 실제 스탬핑 글 → 개별 규칙 위반 다수 검출돼야 함 (결함별 최소 1건).
2. 손으로 쓴 좋은 글 fixture → 위반 0.
3. 스탬핑 번들(도메인어만 치환된 15편 축약본) → 번들 다양성 위반 검출.
4. 다양화된 번들 fixture → 위반 0.
실행: `npm run test:generated-quality` + `npm run typecheck`.

## 8. 후속 작업 (이 PR 범위 아님 — 잊지 말 것)

- **F1**: 화면 조립 반복 — `nameCompatibility.summary`가 히어로/요약/이름평가 3곳 재사용되는 문제
  (frontend `CombiedNamingReport.jsx` 계열). 별점 문구 다양화 포함.
- **F2**: `data/articles/*/stages.articles.json` base 생애단계 문구(“40~49세 책임의 정점…”)가
  성인 전 연령대에 동일 노출되는 문제 — stage generated 번들이 채워지면 자연 완화되나 base 개선 필요.
- **F3**: 전량 재생성 완료 후 `validate-generated.ts`의 corpus-wide 빈도 감사(카테고리당 동일
  12-gram 파일 점유율 상한)를 CI 게이트로 승격.
- **F4**: PR2 = 초기 로딩 성능(60MB packed 번들 축소) — 머지 코멘트에서 예고된 별도 트랙.

## 9. 진행 상태 (세션 로그 — 이어받는 모델은 여기부터)

> 규칙: 상태 변경 시 이 표를 갱신하고 커밋. 날짜·커밋 해시 명기.

| # | 단계 | 상태 | 기록 |
|---|---|---|---|
| 0 | 진단·측정 (§1) | ✅ 2026-07-04 | 수치 §1, Claude Fable 5 세션에서 실측 |
| 1 | 마스터플랜 문서 | ✅ 2026-07-04 | 이 문서 |
| 2 | text-quality-rules.ts 재작성 | ✅ 2026-07-04 | 규칙 7+5종, 테스트 20/20 |
| 3 | validate-generated 연결 + 테스트 | ✅ 2026-07-04 | `npm run test:generated-quality` |
| 4 | audit 도구 + 기준선 저장 | ✅ 2026-07-04 | 번들 1800/3780 위반, `npm run audit:generated` |
| 5 | 번들 하네스 4종 (§6) | ✅ 2026-07-04 | prepare/prompt/run.wf/ingest |
| 6 | 파일럿: overall 번들 일부 생성→정독→게이트 통과율 기록 | ✅ 2026-07-04 | 아래 파일럿 결과 참조 |
| 7 | 웨이브 w1: overall 전체 (180 번들) | 🔄 **33/180 완료** (2026-07-04 세션 종료 시점) | ~500편 재생성·커밋. summary 고유율 0.4%→31.2%. first-pass율: 파일럿 100% / 배치1 94.6% / 배치2 83.8% (리젝은 게이트가 전부 차단 — 문단 재사용·분량 미달). **다음 액션**: ① `npx tsx tools/generation/prepare-bundles.ts --keys=overall.adult.strong.bigeop.adverse.x` 재생성(잔여 리젝 11편) ② `prepare-bundles.ts overall --count 16` 반복 (남은 147번들 ≈ 9배치, 배치당 ~35분/2.9M tokens) |
| 7b | 배치 API 모델 A/B | ✅ 2026-07-05 **Fable 5 확정** (사용자 결정 + 실측 일치) | 아래 A/B 최종표. Opus 배치는 사용자 지시로 취소 |
| 8 | **단계별 전량 집행 (Fable 5, 점진)** | 🔄 S0 진행 중 | 아래 "단계별 집행 계획" 표 |
| 9 | 전량 완료 후: audit before/after, pack 재실행, F3 승격, 단일 PR | ⬜ | PR은 품질 완성 후 한 번에(사용자 결정), 평가는 실사용 |

### 배치 파일럿 A/B (2026-07-05, 동일 12번들 = 180편; 결과는 29일 보존, ID로 언제든 회수)

| 모델 | 배치 ID | 상태 | 게이트 통과 |
|---|---|---|---|
| Sonnet 5 (thinking on) | `msgbatch_01P3eoA4PrVd7zgXLLuBrfe7` | 완료 | **0/45** (9번들 max_tokens 절단 — thinking이 예산 소진; 성공분도 body 80자 미달) |
| Sonnet 5 (thinking off) | `msgbatch_011eenEUqeqwUWPSaHDyK9Bf` | 완료 | **7/180 (3.9%)** — expert 분량 미달, 평문 '비겁' 누출, 태그 말미 나열(해요체 위반), 태그 날조(`#{silhaeng}` 등) |
| Opus 4.8 | `msgbatch_011RcKwo4LQ5N7AJJ35Dq38c` | 처리 중 | (워크플로 실적: first-pass 84~100%, 정독 합격) |
| Fable 5 | `msgbatch_01QoWreL3D5iMtdDXfEL6TnQ` | 처리 중 | max_tokens 64K(상시 thinking 예산) |

**최종 판정 (2026-07-05)**: Sonnet 5 0%/3.9% — 탈락. Opus 4.8 배치 일회성 **0.7%(1/150)** —
워크플로(84~100%)와 달리 배치에선 급락, 취소됨. **Fable 5 12.2% + 문체 최상** → 확정.
공통 실패는 기계적 3종(짧은 맺음말 문단·강약 형용사 의역·expert 끝 태그 나열)으로 프롬프트
강화 3건 반영 완료 → S0 재검증에서 통과율 회복 확인 예정. 교훈: **배치 일회성 호출은 에이전트
루프와 전혀 다른 환경 — 프롬프트에 검증기 기준을 리터럴하게 명시해야 한다.**

### 단계별 집행 계획 (Fable 5 배치, 2026-07-05 수립 — 사용자: 점진 진행)

> 비용 실측 기준: 성인 번들(15편) ~$0.85, 소번들(5편) ~$0.35 (thinking 포함, 배치 요금).
> 각 단계 공통 절차: prepare→submit→fetch→ingest→리젝 재배치 1회→**정독 표본 3번들**→커밋→이 표 갱신.
> ⚠ 충전 $100 기준 S1 중반에 소진 — 단계 진입 전 잔액 확인, 필요 시 사용자에게 충전 요청.

| 단계 | 범위 | 번들 | 예상 비용 | 상태 |
|---|---|---|---|---|
| **S0** | 강화 프롬프트 재검증 (동일 12번들) — 합격선: 게이트 ≥80% + 정독 합격 | 12 | ~$10 | ✅ **80.6% (145/180) + 정독 합격**, ingest·커밋 e5b744a96. 잔여 리젝은 경계선 유형 → 하한 여유 지시 추가 |
| **S1a** | S0 리젝 10번들 재생성 + overall 앞 45번들 | 55 | ~$38 | 🔄 `msgbatch_0134jC6v8aPwQgYUDbZCK4TY` 폴링 중 |
| **S1b** | overall 잔여 (S1a 이후 ~102번들, 소번들 위주) | ~102 | ~$40 | ⬜ ⚠ 진입 전 잔액 확인(누적 지출 ~$75 예상) — **충전 필요 시점** |
| **S2** | wealth + health (유료 관심 최상위) | 360 | ~$210 | ⬜ |
| **S3** | career + romance + family (성별 축 포함) | 756 | ~$430 | ⬜ |
| **S4** | academic + study_document + expression_children + health_stress + movement | 900 | ~$460 | ⬜ |
| **S5** | 마무리: 리젝 잔여 소탕, Opus산 overall 33번들 Fable 통일(옵션 ~$28), audit before/after, `pack-generated.ts`, 최종 정독, 단일 PR | — | ~$50 | ⬜ |

총 예상 ~$1,270 (재시도 20% 포함). S0 통과율이 80%를 크게 넘으면 하향.

### 파일럿 결과 (2026-07-04, overall 번들 2개 = 30편)

- **게이트 first-pass 30/30 (100%)** — 개별 규칙 + 번들 다양성 전부 통과, sourceNote `regen-2026-07-w1`.
- 정독 판정: 유료 기준 도달. summary 문형 전부 상이, adverse 정직성 정확("메워 주지는 않아요"
  + 생활 처방), 기간 렌즈 분리(오늘=하루 시야/주=요일 리듬/달=프로젝트/해=계절), expert는
  #{태그} 근거 역할 수행.
- 비용 실측: 번들 2개 병렬 = **에이전트 토큰 ~379k, 벽시계 ~34분** (OPUS, 에이전트당 67~118 tool
  calls — 배치 파일 read 오버헤드 큼). 전량 외삽: ~2,470 번들 ≈ 토큰 ~470M, 벽시계 16-병렬로
  ~40~80시간 → **멀티 세션 필수**, 카테고리 웨이브로 쪼개 진행.
- 정독에서 찾은 개선 2건 → 프롬프트 다양성 계약 7·8항으로 반영(2026-07-04):
  ① adverse 번들에서 body 마지막 문단이 전부 "이름은 ~아니니 생활에서" 구조로 수렴 → 이름
  이야기의 위치·비중을 편마다 달리하도록 지시.
  ② 일부 expert가 저자 판단 과정("~라고 짚었어요/새겼어요") 서술 → 사주 배치 자체 서술로 제한.

### 운영 규칙 (모든 세션 공통 — 위반 금지)

1. **작업장 = `F:\Projects\metaintelligence\namespring-web`, branch `codex/pr1-text-quality`**
   (2026-07-05 갱신). 임시 워크트리 `C:\tmp\namespring-pr1-text-quality`는 제거됨. Codex의
   `codex/nightly-copy-quality-loop`(구 fragments 대상 작업 + 미커밋 52파일)은 사용자 지시로
   폐기됨 — 마지막 커밋 b7ef9a39b, 필요 시 reflog로 복구 가능.
2. 커밋은 웨이브/단계 단위로 잘게. `git add`는 항상 경로 명시(`git add -A` 금지).
3. **테스트 통과만으로 문장 품질을 승인하지 않는다.** 웨이브마다 무작위 표본(번들 3개 이상)을
   반드시 정독하고 §9에 소감·문제를 기록.
4. Windows: 터미널에서 한글이 깨져 보여도 파일은 정상일 수 있음 — node로 UTF-8 read해 확인.
   PowerShell quoting 지옥 회피 — 편집은 파일 에디터 도구, 실행은 짧은 명령.
5. 토큰/사용량 한도로 중단될 때: §9 표 + 마지막 배치의 results.json 위치를 커밋 메시지에 남길 것.
   **절대 템플릿 스탬핑으로 "빨리 채우기" 금지** — 게이트가 막겠지만, 시도 자체가 금지다.
