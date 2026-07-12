# ROADMAP — 사주 엔진 품질 로드맵 (우선순위 정본)

> 작성: 2026-07-09. 무결성 감사(103건)와 PR-1~8 완료 이후 남은 전 작업을 2026-07-09 HEAD 기준으로
> 실측 재검증(file:line 재확인)하고 우선순위로 재편성한 마스터 플랜.
>
> **이 문서가 우선순위의 정본이다.** `HANDOFF_SAJU_ENGINE.md`(E·E-2절 잔여 표)와
> `HANDOFF_SAJU_ENGINE_PR8_20260709.md`(§6 다음 작업 후보)의 잔여 목록은 이 문서로 대체된다.
> 개별 항목의 완료 이력·검증 수치는 여전히 두 핸드오프가 정본이다.
>
> 브랜치: `feature/saju-engine-integrity-audit` (P0-1 머지 전까지). 진행 상태는 §9 표에 커밋 해시와 함께 갱신한다.
>
> **2026-07-11 merge-readiness 정정:** PR #653은 현재 Draft로 유지한다. 현재
> source-tier/no-AI/quality 정책 테스트와 구조 게이트는 통과하지만, 17개 release fixture의
> `D1~D4=N/A`, `D5=0 PASS / 0 FAIL / 14 N/A / 3 NOT_APPLICABLE`, raw RPI
> `20/100`이다. 이는 실패 17건이 아니라 진리값 부족 17건이다. D1 필수 7필드의
> scope-eligible 진리값, 제품 표면·안전 카피 계약, 종격 birth-time 권위 사례,
> exact diff 승인, 그리고 exact commit에 결속된 외부 명리 전문가 signoff가 완결되기
> 전에는 **전문가급 상용 릴리스·명리 판정 모델의 추가 기본값 승격을 금지한다.**
> 이번 backend-only 체크포인트는 격국·용신·강약 판정 모델을 승격하지 않지만, 시간
> 보정 정합성 수정으로 제품 기본 경도 기준을 legacy preset 고정 자오선에서 출생
> 민간시의 civil-offset 자오선으로 변경한다. Korean/modern의 현대 UTC+9 입력은
> 보정량이 같지만 traditional-Chinese preset, 역사 표준시·DST, 해외 입력, 부분 위치
> 입력에는 의도적인 default/API 변화가 있다. 따라서 전용 시간정책 행렬과 exact-diff
> 검토 없이 무파급 리팩터링으로 분류하지 않는다. 현재 diff의 고위험 스파게티와 논리
> 결함을 정리하고 변경 범위 회귀가 통과하며 위 한계를 PR에 명시한 뒤 점진적 병합
> 대상으로 검토할 수 있다. WIP 해제 전에는 근거와 잔여 위험을 프로젝트 소유자에게
> 먼저 보고한다.

---

## 0. 새 세션 착수 절차 (모든 세션 공통 — 하위모델 포함)

1. 읽기 순서: **이 문서 §0~§4** → 착수할 패키지의 상세(§6~§8) → **구현 레시피 `GUIDE_SAJU_ENGINE_IMPL.md`**(항목별 정확한 절차) → 해당 항목이 가리키는 pr8-verify JSON·핸드오프 절.
2. 상태 확인:
   ```bash
   git status --short --branch          # feature/saju-engine-integrity-audit 확인 (머지 후에는 main 기준 새 브랜치)
   git --no-pager log --oneline -8
   cd lib/saju-ts && npm run build      # spring-ts 테스트는 dist를 읽는다 — 항상 선행
   cd ../spring-ts && npx tsx tools/baseline_snapshot.ts verify   # 15/15 (P0-3 이후 17/17)
   ```
3. 착수 규칙: **한 번에 한 항목**, 항목 단위 커밋, 커밋 메시지에 테스트 수치 병기(관례: `engine: ... (21/0, 15/0, 208/0)`).
4. 완료 시: §9 진행 표에 커밋 해시 기록 + 판정 파급 실측 한 줄.
5. 난이도 표기를 존중하라: **난이도 [상] 항목은 판정 파급 계측이 필수인 작업**이다. 하위모델 세션이라면 [하]·[중] 항목을 먼저 소화하고, [상]은 계측 절차(§2)를 그대로 따를 자신이 있을 때만 착수한다.

## 1. 불변 원칙 (위반 = 롤백 사유)

1. **원국 불변**: 운(transit) 관계·신살을 원국 스트림에 섞지 않는다.
   - `facts.ts:3392`(branches 4주 고정)·`facts.ts:3735`(byType)에 운 지지·천간 유입 금지.
   - `computeBranchInteractionFactors`(facts.ts:2522)는 members **값** 매칭 감쇠라, 운 관계가 byType에 섞이면 원국 신강약이 변한다 — 원국 불변 원칙의 최단 파손 경로.
   - 원국 `shinsalHits`에 transit 신살(삼재·상문·조객) 혼입 금지 — 운 신살은 transit annotation 전용.
2. **additive 우선**: 판정(신강약 레벨·용신·격국·별점)을 바꾸는 변경은 반드시 §2 계측 절차를 통과해야 하며, 표면화(노출) 작업과 같은 커밋에 섞지 않는다.
3. **프론트 무접촉**: `namespring/`(프론트)는 사용자가 명시적으로 열어주기 전까지 수정 금지.
4. **`git add -A` 금지**: 반드시 경로를 명시해 stage. `.claude/`, `lib/spring-ts/tmp/`는 untracked 그대로 보존(다른 도구·세션의 산출물).
5. **콘텐츠 provenance**: AI 저작 서사는 `sourceTier: T1_HYPOTHESIS` + `aiGenerated:true` 필수. 권위 인용(T3)으로 둔갑 금지. `insight-registry-content.test.ts`의 hasT1Provenance 검사가 이를 잡는다. (정본: `SOURCE_TIER_POLICY.md`)
6. **미성년 안전**: 사용자 가시 문구를 바꾸는 작업은 `npm run test:service-visible-output`(금칙어·안전 문구 게이트)을 반드시 동반. 공포 조장·단정 표현 금지(특히 삼재·상문·조객).

## 2. 판정 변경 계측 절차 (PR-3에서 확립한 관례)

판정 파급이 있는 항목([파급] 표기)은 아래를 전부 수행하고 결과를 커밋 메시지·§9에 기록한다.

1. 변경 전 기준 확보: `npx tsx tools/baseline_snapshot.ts verify` (통과 상태에서 시작).
2. 구현은 **설정 knob으로 감싸고** 기본값 결정은 별도 커밋으로 분리(무파급 틀 → 기본화 순).
3. `npm run validate:default-change` (main↔HEAD): 수치·구조 회귀를 탐지하되, 격국·용신·강약 같은
   방향 불명 categorical 변화는 **REVIEW_REQUIRED**로 차단한다. 내부 점수 상승을 품질 향상으로 간주하지 않는다.
4. `dump-report-trace` before/after: κ 코퍼스 커버리지 후퇴 0 확인(전 셀 ✅재생성·정합✓).
5. 15픽스처 판정 필드(강약 레벨·용신·격국·별점) diff를 항목별로 실측해 기록.
6. 기본화는 독립 전문가/권위 holdout의 방향 라벨과 `quality:gate:release` 전 차원 PASS가 있을 때만 허용한다.
7. 파급이 의도와 다르거나 권위 정답이 없으면 기본 off로 두고 §9에 사유 기록.

## 3. 공통 함정 (하위모델 필독 — 전부 실제로 밟았던 것)

| 함정 | 내용 |
|---|---|
| dist stale | spring-ts 테스트는 saju-ts **dist**를 읽는다. saju-ts src 수정 후 `npm run build` 없이 테스트하면 구버전을 보게 됨 |
| 이중 화이트리스트 | 레거시 표면은 `springLegacy.ts`(방출)와 `saju-adapter.ts`(typed extractor) **양쪽**을 고쳐야 리포트에 도달. 한쪽만 고치면 조용히 누락 |
| deepSerialize 스프레드 | springLegacy 반환 객체에 새 최상위 키를 추가하는 순간 스냅샷/JSON 아티팩트 표면에 즉시 등장(`saju-adapter.ts:1533`) — 스냅샷 diff·페이로드 크기 파급 주의 |
| engine.ts 명시 pick | `engine.ts`의 summary 매핑은 명시 pick — types→compute→api/types→engine→springLegacy→adapter 5층 중 한 층만 빠져도 컴파일 에러 없이 undefined로 흐름 |
| vitest include | saju-ts `vitest.config.ts` include에 `src/fortune/**`가 없어 fortune 테스트를 신설해도 **조용히 스킵**됨 (P0-2에서 수정) |
| 빈 배열 관례 | 어댑터 계약상 빈 배열은 undefined로 강제(`adapter-daewoon.test.ts`) — 배선만 하고 opt-in이 없으면 조용히 빈 값 |
| Windows EPERM | 샌드박스에서 `tsx`/`vitest`가 `spawn EPERM` 가능 — 권한 승인 후 같은 명령 재실행 |
| compat 기대치 | `test:namespring-compat`는 **208**이 정본(문서 곳곳의 202는 구값) |
| quality-gate 1건 | `test:composite-quality-gate`의 main..HEAD diff는 **실제 review gate**다. 머지로 baseline을 덮어 자동 해소하지 말고, 17개 diff를 권위 근거로 승인하거나 회귀를 수정해야 한다 |
| hanja-pool 1건 | `test:hanja-pool` 1건은 main에서도 실패 — 이 로드맵과 무관(별도 작업 칩 존재) |
| 값-dedupe | 관계 탐지는 값 기준 dedupe — 운 지지가 원국과 동일 값이면 새 관계가 안 생기고 기존 항목 pairs에 [i,4]만 추가됨. 운 개입 판별은 **pairs의 i>=4 필터**로만 가능(`branchRelations.ts:174-187`) |

## 4. 검증 명령 카탈로그 (기대치는 2026-07-09 실측)

| 위치 | 명령 | 기대치 |
|---|---|---|
| lib/saju-ts | `npm run typecheck` / `npm run build` | PASS |
| lib/saju-ts | `npm test` (vitest) | 178+ (전부 PASS) |
| lib/spring-ts | `npm run typecheck` / `npm run build` | PASS |
| lib/spring-ts | `npx tsx tools/baseline_snapshot.ts verify` | **17/17** (P0-3, 75c3cdef5부터) |
| lib/spring-ts | `npm run test:namespring-compat` | 208/0 |
| lib/spring-ts | `npm run test:tiered-shape` | 1378/0 |
| lib/spring-ts | `npm run test:service-visible-output` | 13/0 |
| lib/spring-ts | `npm run test:adapter-daewoon` | 31/0 |
| lib/spring-ts | `npm run test:time-policy` | 위치 튜플·글로벌 경도·역사 KST/DST·gap/fold·분 미상 전환·시간 불확실성 전부 PASS |
| lib/spring-ts | `npm run test:transit-luck-report` | 13/0 |
| lib/spring-ts | `npm run test:boundary-goldens` | 867/0 |
| lib/spring-ts | `npm run test:jonggyeok` | 111/0 |
| lib/spring-ts | `npm run test:yongshin-consensus` | 241/0 |
| lib/spring-ts | `npm run test:jonggyeok-authority` | 168/0 + `INFO … 0 eligible birth rows, 20 pillar-only rows`(정확도 미측정) |
| lib/spring-ts | `npx tsx test/integration/insight-registry-content.test.ts` | 54/0 (콘텐츠 추가 시 증가) |
| 판정 변경 시 | `npm run validate:default-change` | 정답 없는 categorical 변화는 REVIEW_REQUIRED(비정상 종료) |
| release 판정 | `npm run quality:gate:release` | D1~D5 전 차원 PASS; N/A/PARTIAL은 실패 |
| 외부 전문가 signoff | `npm run quality:gate:expert-signoff` | exact 17 fixtures/D1~D5, reviewed commit ancestry, attestation-only diff, tracked evidence SHA; 신원 진위는 protected PR에서 별도 확인 |
| release 회귀 | `npm run test:saju-engine-release` | 연결된 엔진·어댑터·오라클 회귀 전부 PASS |
| release 종격 | `npm run test:jonggyeok-authority:release` | 20+ independently reviewed birth rows, 80%+ match; 미달 시 실패 |
| default diff 승인 | `node tools/measure_default_change.mjs --baseline origin/main --branch HEAD` | exact fingerprint의 reviewer/date/evidence 승인 필요 |

`test:jonggyeok-authority`, 만세력 오라클, adapter-yinyang, transit report 등 핵심 신규 검증은
`test:saju-engine-release` 단일 체인에 포함한다. 다만 종격 테스트의 168 PASS는 intake·스키마 검증이며
`0 eligible birth rows`인 동안 정확도 게이트가 아님을 결과에 함께 기록한다.

## 5. 우선순위 총괄

엔진을 "가장 훌륭한 수준"으로 끌어올리는 축은 ① 판정 정확도 ② 운(運) 통변 완결 ③ 설명가능성 ④ 외부 검증 인프라 ⑤ 해석 축 확장 순으로 굵다. 병렬 가능한 콘텐츠 트랙(CT)은 Codex/하위모델 위임에 적합하다.

| 순위 | 패키지 | 한 줄 요약 | 판정 파급 | 난이도 |
|---|---|---|---|---|
| **P0** | 운영 안정화 | 브랜치 PR 오픈·테스트 체인 무결성·baseline 픽스처 보강 | 없음 | 하 |
| **PR-9** | 운(運) 축 완결 | 운-원국/대운-세운 합충, 교운·나이 표기, 일운 정합, A12 | A12만(옵션 한정) | 중 |
| **PR-10** | 판정 깊이 완결 | 왕상휴수 표, 감쇠 세분, pressure 합거, 성패 점수 통합, 위치 가중 | **전부** | 상 |
| **PR-11** | 종격 완전 승격 | potential 램프 재설계 + birth-time 코퍼스 게이트 통과 | **있음** | 상 |
| **PR-12** | 설명가능성·표면 정직성 | 용신 methodBreakdown, 격국 basis, 시간 카드, 음양, 죽은 배관 정리 | 없음(additive) | 하~중 |
| **PR-13** | 외부 오라클·재캘리브레이션 | 대량 판정 대조 파이프라인 + 강약 임계 ±0.15 재검 | 있음(캘리브레이션 시) | 상 |
| **PR-14** | 신규 해석 축 | 육친, 묘고/개고, 신살 카탈로그 확장, 명궁·태원 등 | 없음(additive 시작) | 중 |
| **PR-15** | 후속 감사 | graph DAG·schools 팩·용신 수식·DSL·config 전수 감사 | 발견 시 | 상 |
| **CT** | 콘텐츠 트랙(병렬) | 궁위 해석, 상신 슬롯, 종격 birth 코퍼스, 삼재 문안 | 없음 | 하 |
| **HOLD** | 사용자 결정 대기 | 프론트 윤달 UI, 전문 모드 표 확장 등 | — | — |

**의존 관계**: CT-4(종격 birth-time 코퍼스)는 PR-11의 선행 재료 — CT를 먼저/병렬로 돌려라. PR-13의 데이터 소스 결정(§8 D5)은 사용자와 합의 필요. PR-10은 PR-9와 독립이므로 순서 교체 가능하나, 계측 부담 때문에 상위 모델 세션에 배정하는 것을 권장.

### SOTA 목표 개발 축 요약 (2026-07-09 기록)

전문가를 넘어서는 수준의 사주명리학 엔진으로 가기 위한 다음 굵직한 축은 아래 순서로 본다.

1. **외부 오라클·재캘리브레이션(PR-13)**: 강약·용신·격국·종격 판정을 내부 논리만이 아니라 권위 사례와 대량 대조한다. 상용/권위 만세력, 전문가 판정 코퍼스, 강약 임계값 재보정, 용신 후보 순위 검증이 핵심이다.
2. **종격 완전 승격(PR-11 + CT-4)**: birth-time 권위 코퍼스 20건+를 확보하고, 假從 산입 정책과 potential 램프 재설계를 확정해 종재·종관·종살·종아·종인·종비·전왕·화기 판정을 실제 게이트로 승격한다.
3. **운(運) 통변 완결(PR-9 잔여)**: 대운↔세운, 운↔원국, 월운·일운, 교운 시점, 삼재·상문·조객 같은 운 신살을 원국 불변 원칙 아래 별도 운 주석으로 완성한다.
4. **판정 깊이 모델 고도화(PR-10 후속)**: 위치 가중, 12운성 통근 강도, 왕상휴수·사령·월률, 성패·상신·파격요인을 격국/용신 점수와 안전하게 결합하고, 모든 기본값 전환은 대조 계측 후 결정한다.
5. **신규 고급 해석 축(PR-14)**: 육친론을 1순위로 추가하고, 묘고·입묘·개고, 현침·탕화·천라지망·암록 등 신살 확장, 귀문관살, 명궁·태원·년주 공망·납음 표면화를 additive로 연다.
6. **후속 감사·검증 인프라(PR-15)**: graph/DAG 배선, school pack 오버라이드, 용신 방법 5종 수식, competition softmax, DSL 컴파일러, config migration/deepMerge/analysisZip을 전수 감사해 조용한 no-op과 배선 오류를 제거한다.

판단 기준: 앞으로의 핵심은 기능 수가 아니라 **권위 사례로 검증되는 판정**, **운까지 연결되는 사건성 모델**, **전문가가 납득할 근거 노출**, **학파 차이를 옵션으로 관리하는 구조**다.

---

## 6. 패키지 상세

### P0 — 운영 안정화 (즉시, 반나절)

| # | 항목 | 내용 | 완료 기준 |
|---|---|---|---|
| P0-1 | Draft PR 유지 + review 준비 | PR #653은 열려 있으나 release gate가 전부 PASS할 때까지 Draft 유지. composite 실패를 baseline 갱신으로 숨기지 않는다 | PR URL·gate 상태 §9 기록 |
| P0-2 | 테스트 체인 무결성 | saju-ts 전체 테스트와 spring-ts 핵심 엔진/오라클 테스트를 `test:saju-engine-release` 및 pull_request workflow에 연결하고, `typecheck:saju-bridge`로 패키지 사이 계약을 컴파일 타임에 확인하며, incomplete evidence와 미승인 exact diff를 fail-closed로 처리 | 체인 1회 완주 + CI required check 설정 |
| P0-3 | baseline 픽스처 보강(구 과제 4) | `test/fixtures/spring_ts_baseline_cases.json`에 ① 시계 23:35~23:59 출생(정자시설 창 안) ② 음력 입력 각 1건 추가 → `npx tsx tools/baseline_snapshot.ts capture` 재캡처. **capture는 다른 엔진 세션이 없는 창에서만**(baseline 파일을 다시 씀). borderline 계열(fix-13~15)과 겹치지 않는 명식 선정 | verify 17/17, compat 208, 경계골든 723 무파급 |
| P0-4 | 학파 프리셋 출처 무결성 | 존재하지 않는 `docs/schools/*.md`를 출처로 선언한 프리셋을 release에서 fail-closed로 차단 | `validate:school-sources` 0 missing + 독립 검토 메타데이터 |
| P0-5 | 호환 계층 분해 | 중복 수식·운 관계 테이블·동적 브리지 계약을 공용 모듈로 분리했다. 다만 `saju-adapter.ts`(약 2,900행)와 `springLegacy.ts`(약 2,200행)는 여전히 큰 결합 지점이므로 mapper/domain 단위 분해를 후속한다 | 새 계약 복사본 0 + mapper별 회귀 테스트 + 공개 payload 무파급 |

### PR-9 — 운(運) 축 완결 [난이도 중, PR-8의 연장]

PR-8이 표면화한 운 메타데이터 위에 운 통변의 나머지 반쪽을 완성한다. **전 항목 additive 원칙**(9-5만 예외). 배선 선례가 전부 존재하므로 하위모델도 진행 가능 — 단 9-1의 원국 불변 가드는 자구까지 지켜라.

| # | 항목 | 핵심 배선 (2026-07-09 실측) | 함정/완료 기준 |
|---|---|---|---|
| 9-1 | **운-원국 합충 canonical 관계** | `detectBranchRelations`(core/branchRelations.ts:163)·`detectStemRelations`(core/stemRelations.ts:86)는 임의 길이 수용 — [년,월,일,시,대운(,세운)] **새 호출부 신설**(기존 원국 호출부 graphFactory.ts:515·facts.ts:3392는 불변). graphFactory에 신규 노드(예: relations.fortune, deps: pillars.*+fortune.timeline) → engine.ts summary.fortune 명시 매핑(기존 summary.relations 매핑 182-185는 type·members만 남겨 재사용 불가) → springLegacy additive 키 → adapter | ① 값-dedupe: 운 개입 판별은 pairs i>=4 필터 필수 ② BANHAP→SAMHAP 플립(branchRelations.ts:208-213): 운이 제3자를 채우면 원국-only BANHAP이 SAMHAP으로 **대체**됨 — 원국-only 결과와 set-diff 필수 ③ triple(SAMHAP/BANGHAP/SAMHYEONG)은 pairs 없음 ④ springLegacy 천간합 재탐지 경로에 운 천간 append 금지(별도 평가) ⑤ 합동해충(운 합이 원국 충 해소)은 서사·경고 표면에만 — 원국 강약 반영은 원국 불변 위반 ⑥ 소비처: period-fortune-card makeWarning — 기존 중복 구현 `checkFortuneRelations`(fortuneCalculator.ts:716, 지지만·자체 테이블 573-696, 소비 period-fortune-card.ts:575) 대체 로드맵 명시 |
| 9-2 | **대운↔세운 상호 합충** | 9-1과 같은 인프라로 [대운, 세운] 쌍 관계 산출(감사 부록 C 930행 — 코드 0건) | 9-1 완료 후 착수(같은 호출부 확장) |
| 9-3 | **교운(交運) 일시 + 대운 절대시각 (B259)** | 권장: **무파급 산술 파생 경로** — `daeunInfo.boundaryUtcMs`(springLegacy.ts:1708) + i×10년을 springLegacy에서만 계산해 daeunPillars(1532-1542)에 saeunPillars interval 선례(1550-1553) 그대로 병기. 정밀 경로(compute.ts 대운 루프에서 각 경계 절기 재계산, 5층 배선)는 상품 요구 확정 시 | 교리 결정 선행: 교운일 기점 vs 해당 나이 입춘 통일(§8 D2). 기존 startUtcMsApprox(compute.ts:229)는 'for UI only' 근사 — 테스트에서 정밀값으로 단정 금지 |
| 9-4 | **나이 표기 옵션 (B266)** | `FortunePolicy`(fortune/types.ts:43-83)에 `ageDisplay: 'continuousFromBirth'\|'koreanCountingAge'` knob + 출력 표기 라벨. 기본값은 **현행 유지(opt-in)** — baseline 15/15 안전. 세는나이는 연 경계(yearBoundary 정책과 정합) 기반 별도 계산 축 | 시간 로직은 연속값 유지·표기만 변경(daeunDisplayOffset 선례 — report/common/daeun-display.ts:13-21, 소비 4카드). B11(정수 대운수 표기)은 PR-3 완료 — 혼동 금지 |
| 9-5 | **A12: yearBoundary 모순 해소** [파급-옵션 한정] | compute.ts **3곳 동시 수정**: :274(baseSolarYear 보정이 liChun 한정), :278-280(세운 구간 경계), :178-182(라벨 공식). 단일 진실은 calendar/pillars.ts:66-93(yearBoundary 3종 존중). 부분 수정 시 라벨·구간이 다시 어긋남 | 기본 설정(liChun) 무변화 = snapshot 15/15 안전. **비-liChun 픽스처 테스트 신설 필수**. 별도 상존 리스크: period-fortune-card yearly는 달력 연도로 매칭하는데 YearLuck.solarYear는 입춘 라벨 |
| 9-6 | **일운(日運) 정합·노출** | **선행: 이원 경로 간지 일치 검증** — spring-ts는 이미 자체 줄리안 계산기로 일운을 서비스 중(fortuneCalculator.ts:432 getDailyFortune, 기준 2000-01-07=甲子, 소비 period-fortune-card 별점). saju-ts 쪽은 maxDays=0(fortune/policy.ts:15)이라 미생성(compute.ts:336-344). 배선은 월운 선례 복제: adapter maxMonths 동적 패치(saju-adapter.ts:1386-1405) → springLegacy ilunPillars 신설(wolunPillars 1557-1570 패턴, days 소비는 현재 **0건 — 신설**) → extractIlunPillars(extractWolunPillars 2274 선례) | ① 두 경로 간지 불일치 시 이관 정책부터(§8 D3) ② DayLuck은 dayBoundary(야자시) 정합 확인 ③ engine.ts days?.slice(0,60) 하드 캡 ④ 일운 60건은 페이로드 파급이 월운보다 큼 |
| 9-7 | **명식판 상문·조객 (REFUTED 후속)** | transit판은 완료(buildTransitShinsalForBranch, springLegacy.ts:521). 명식판(년지 vs 명식 내 지지)은 **교리 결정 사항**(§8 D4) — 채택 시 defaultRuleSets.ts:315-322 buildBranchPresenceRules 패턴(±2 산술은 shinsalHongluanOf facts.ts:2919 선례)으로 저비용 | SHINSAL_TYPE_KO_LABEL(saju-adapter.ts:259 부근)에 SANGMUN/JOGAEK 라벨 존재 확인(없으면 코드 문자열 노출) |
| 9-8 | **thisYear 메타 소비 + 개두/절각 플래그** | 완료(0bfb061d2): tiered/category의 thisYear 메타가 saeun PR-8 annotation evidence를 소비. 개두/절각은 same-pillar 천간/지지 상극 stemBranchInteraction으로 대운/세운/월운 annotation에 병기 | Verified: saju-ts 206/0, baseline 17/0, compat 208/0, tiered-shape 1379/0, service-visible 13/0, adapter-daewoon 31/0, transit-luck-report 13/0 |

### PR-10 — 판정 깊이 완결 [난이도 상, 전 항목 §2 계측 필수]

신강약·격국 판정의 남은 구조적 공백. **각 항목을 knob로 감싸 틀(무파급) 커밋 → 기본화(계측) 커밋으로 분리**하는 PR-3~5 관례를 그대로 따른다.

| # | 항목 | 핵심 배선 | 비고 |
|---|---|---|---|
| 10-1 | **왕상휴수사(旺相休囚死) 판정표** | 월지 계절 기준 오행별 5단계 상태 테이블(12행×5열) 신설 — 현재 seasonSupportScore(facts.ts:2306-2314)는 일간↔월지 한 쌍만 점수화, 타 4개 오행 계절 상태는 미계산. 출력: ① 충 손상 비대칭 감쇠 입력(왕상한 쪽 덜 상함) ② elementDistribution 보정 계수 | 辰戌丑未월은 본기 기준 기본 + wollyul 사령 연동 옵션. month.saryeong(사령 천간·경과일) summary 노출(감사 B476)을 부산물로 함께 |
| 10-2 | **감쇠 세분: 궁위 pairs 기반 + 인접/원격** | 현 v0는 값 매칭(facts.ts:2559 `branches[i]` 값 포함 검사 — 동일 지지 2개 함께 과감쇠, 주석 2558에 한계 명시). B538 pairs(PR-5 인프라)를 소비해 궁위 단위 감쇠로 전환 + 인접 요합 감쇠·원격 약화 | 정책 기본값은 facts.ts:2471-2518(CHUNG 0.5·HYEONG 0.7·floor 0.3·hui 0.10/0.08/0.05·stemBind 0.5/쟁합 0.75). 적용 지점 2692-2743 |
| 10-3 | **pressure 축 합거** | 관성이 합으로 묶이면(합거) pressure 감소 → 신강 방향 보정. stemBind는 자원 축만 반영 중 | PR-5 잔여 명시분 |
| 10-4 | **격국 성패의 점수 통합** | seongpae verdict(5단, gyeokgukSeongpae.ts:205-230)는 현재 표면 전용 — gyeokguk.ts 점수 경로에 seongpae 참조 0건, facts.ts:255-257 주석이 '점수 통합은 별도 계측 항목' 명시. verdict→격국 confidence/score 가감을 knob로 도입 | v0 성패는 투간 기준 — 지장간 회지 상신·세력 비교 확장(10-5)과 순서 조율 |
| 10-5 | **성패 v1: 회지 상신·세력 비교** | 월지 지장간 회지 상신 인정 + 상신/기신 세력 비교로 verdict 정밀화 | 10-4와 같은 계측 창에서 |
| 10-6 | **오행 분포 위치 가중 옵션** | elementDistributionFromPillars(core/elementDistribution.ts:20-48)가 네 기둥 동일 가중 — 주류 100점 배점(월지 30·일지/시지 15·천간/년지 10)류 위치 가중 knob | deficient/excessive가 작명 보완 오행 근거라 **이름 판정(κ) 파급 — κ 커버리지 계측 필수**. PR-5 ⑤ distributionAdjusted(합충 보정 틀, 기본 off)와는 별개 축 |
| 10-7 | **12운성 통근 강도 계수(옵션)** | 록왕>장생>묘고 계수를 deDi에 옵션 연결(감사 B462) | 판정 연결 시 계측, 서사 연결만이면 additive |

### PR-11 — 종격 완전 승격 [난이도 상, CT-4 선행]

PR-7의 핵심 발견: 승격 불가의 실체는 임계값이 아니라 **potential 램프 수식 구조**.

- **수식 현황(실측)**: `facts.ts:1149` weak 램프 `clamp01((weakThreshold − s) / max(eps, weakThreshold + 1))` — weakThreshold −0.78에서 분모 0.22, s=−1.0에서만 factor 1.0. 실제 극단 종격 명식은 s≈−0.82 부근이라 factor ≈0.19로 CONG 게이트 0.6(defaultRuleSets.ts:113-206, `gte(patterns.follow.jonggyeokFactor, 0.6)`) 미달. strong 쪽 동형(:1154), ×domFactor(:1152), potential 합성(:1212), jonggyeokFactor(:1601/1645).
- **단일 구현으로 정리(2026-07-10)**: follow potential 수식은 `rules/followPotential.ts`의 순수 함수 하나를
  `facts.ts`와 `yongshin.ts`가 함께 소비한다. 수식 변경 시 해당 함수와 한 묶음의 회귀 테스트만 검토한다.
- **게이트 구분**: 룰 게이트 0.6(defaultRuleSets)과 jonggyeokCandidates 상태 임계(gyeokguk.ts:492-497, 0.68/0.28/0.18)는 다른 표면 — 혼동 금지.
- **승격 게이트 조건(정정)**: 코퍼스 총 건수가 아니라 독립 검토를 통과한 **authority-eligible birth-time 행**이
  필요하다. 현 20건은 전부 web 기반 pillar-only intake이고 `authorityTruthEligible=false`이므로 정확도 비교 0건이다.

| 단계 | 내용 |
|---|---|
| 11-a | 승격 검증 경로 결정(§8 D6): ① birth-time 권위 케이스 20건+ 확보(CT-4) 또는 ② 게이트 재정의 — 엔진에 pillar 직접 입력 분석을 지원해 pillar-only 케이스로 비교(권위 고서 케이스는 구조적으로 pillar-only인 현실 반영) |
| 11-b | 램프 재설계(예: 실측 s 분포에 맞춘 앵커 정규화) 또는 게이트 인하 — knob로 감싸 `jonggyeok.calibrated` 프리셋(builtin.pack.json:640)에서 먼저 검증 |
| 11-c | 권위 코퍼스 매치율 80%+ 달성 확인 → 기본화 계측(§2) → 종격 서브타입 확장(종세격 — followTenGodSplit 기산출로 저비용)·전왕/화기격 고전 명칭 매핑(곡직·염상·가색·종혁·윤하/화격 5종 — 데이터 기존재, 계산 무변경)은 마무리 additive |

### PR-12 — 설명가능성·표면 정직성 [난이도 하~중, 전부 additive — 하위모델 적합]

유료 리포트 차별화의 본체. 계산은 이미 다 있고 노출만 안 된 것들.

| # | 항목 | 배선 |
|---|---|---|
| 12-1 | **용신 methodBreakdown (C4①)** | yongshin.ts:1298-1377이 방법별 근거(climate env/need, medicine excess, tongguan pairs, follow potential, johooTemplate primary/reasons, effectiveWeights)를 항상 산출하나 summary.yongshin(engine.ts:234-241)에서 전량 탈락. methodBreakdown 필드 추가 + springLegacy recommendations[].reasoning을 base.*에서 생성 — '겨울생이라 火 필요' 서사 재료 |
| 12-2 | **격국 basis (C4②)** | GyeokgukResult.basis(선정방법)·quality.details(gap/damageByType/damageRelations)·scores 19키 → summary.gyeokguk(engine.ts:242-247)에 요약 노출 — '월지 본기 투간으로 정관격, 다만 월지 충으로 손상' 서사 재료 |
| 12-3 | **시간 보정 카드 + 절기 근접 안내 (C7)** | timeCorrection 13필드는 어댑터까지 도달 완료 — 소비 카드 저작이 본체. 절기 시각은 solarTerms.ts:370-390에서 기산출·캐시(solarTermsAround) — '입춘 N시간 후 출생' 안내 |
| 12-4 | **음양 균형 노출** | YinYangScore(core/scoring.ts)·YinYangTally(core/tally.ts) 소비자 0곳 — 유일한 완전 누락 만세력 기본 축. springLegacy→어댑터 노출 + 소비 카드 |
| 12-5 | **죽은 배관 정리** | scoredCheonganRelations(springLegacy.ts:1667 빈 배열)·shinsalComposites(:1697) — 채우거나 제거로 정직화. positionMultiplier(:1477 하드코딩 1) 실값 배선 또는 제거 |
| 12-6 | **신살 감쇠 트레이스 + 해공(解空)** | per-detection 트레이스(shinsal.ts:578-598 qualityReasons·conditionPenalty)가 미노출, invalidated는 필터됨(engine.ts:253,261) — '도화가 있으나 충 맞아 약함' 서사 재료. 해공: 공망 지지가 형충합을 만나면 풀리는 통설 미구현(GONGMANG이 excludeNames로 항상 만점 → 과잉 통변) |
| 12-7 | **palace/naeum 소비 카드 + 납음 기본 표시** | report/** 전체에 .palace/.naeum 참조 0건(옵트인해도 리포트 미도달). 납음은 만세력 기본 표기 — 기본 on 전환 또는 명식표 카드 표시 |
| 12-8 | **JOJA_SPLIT 실구현 또는 경고** [파급-옵트인 한정] | 야자시 시두법(시주 천간만 익일 일간 기준) 엔진 표현 불가 — pillars.hour가 day.stem 직접 의존(graphFactory.ts:321-334), 현재 무경고 매핑(springLegacy.ts:258-259). calcHourPillar에 hourStemBasis 도입, 구현 전까진 미지원 경고 |
| 12-9 | **음간 양인 분리(EUM_IN/yangOnly)** | yanginMode 기본 luNext가 음간에도 적용(facts.ts:2722-2738) — 乙辰·丁未 등이 YANG_IN 동일 이름 방출. yangOnly 옵션 또는 EUM_IN 분리 방출(현재 EUM_IN 0건) |
| 12-10 | **저심각 번들** | 괴강 한국 5주 프리셋(shinsalBaseCatalog.ts:355-368) · 년주 기준 공망 병용 · STEM/NONE 타깃 드랍+천주귀인 보너스 정직화 · 명궁/태원(전문가 모드) · 공망쌍 1급 승격 · 소운 미지원 트레이스 · 성별 U 폴백 경고 · 십신 10×10/naeum 60갑자 정답표 · BYEONGYAK 라벨 테이블 — 상세는 감사 부록 B 해당 행 |

### PR-13 — 외부 오라클·재캘리브레이션 [난이도 상, 선행 결정 필요]

- **목표**: 강약 등급 임계 ±0.15(springLegacy.ts:939)가 base 모델 분포 기준 값이라, deLingDiShi 기본화+PR-5 합충 주입 후 등급 경계가 대규모 분포에서 표류하지 않는지 검증·재보정("B7 함정 3"의 실체 — 원문은 유실, 이 해석이 정본).
- **현황**: 만세력 오라클 453건(e8c2da315)은 **명식 4주 대조 전용** — 강약/용신 판정 분포 대조에 쓸 외부 데이터 소스가 미정(상용 만세력은 판정값을 잘 공개하지 않음). **§8 D5 결정 선행.**
- 부속: 절기 시각 KASI 대비 전용 대조 축(절입 부근 출생 월주 경계 정답 — 현재 간접 커버만), 미검증 잔여 35건 개별 적대 검증(REFUTED 전례 1건 있음 — 착수 전 개별 확인 관례 유지).

### PR-14 — 신규 해석 축 [난이도 중, additive 시작]

우선순위 순: ① **육친론**(십신↔육친 배속 테이블 + 궁위 결합 — seatPillars(PR-2)·pairs(PR-5) 인프라 기존재로 저비용 고가치) ② **묘고·입묘·개고**(辰戌丑未 — 학파 이설이라 정책 파라미터, 통근·격국 연결 시 계측) ③ **신살 카탈로그 확장**(현침·탕화·천라지망·암록(dayStem 테이블 1행) 우선 > 급각 > 협록 — 전부 코드 0건) ④ 암합·공협(후순위 — 감사 판단 유지).

### PR-15 — 후속 감사 [난이도 상, 방법 설계부터]

감사 방법·정답 기준 설계가 선행돼야 함(현재 규모 추정 0): ① graph/ DAG 배선 전수(배선 오류는 전 도메인 무증상 전파) ② schools 팩 오버라이드 실반영 전수('파싱되나 미적용' 클래스 전례 3건) ③ 용신 방법 5종 수식 + competition softmax(core/competition.ts — 합의 점수 직접 좌우인데 finding 0건) ④ 룰 DSL 컴파일러(var 경로 오타 = 조용한 불발화) ⑤ config 마이그레이션/deepMerge/analysisZip.

---

## 7. CT — 콘텐츠 트랙 (병렬, Codex/하위모델 위임 적합)

전부 데이터/문안 작업. **공통**: sourceTier(T1_HYPOTHESIS+aiGenerated:true) 필수, 검증은 insight-registry-content(54+) + tiered-shape(1378) + baseline verify + compat 208.

| # | 항목 | 내용 |
|---|---|---|
| CT-1 | 귀인 궁위 세분 해석 | 카드(insight-facts-card.ts L281-295)는 이미 `shinsal.<타입>@<seat>` factId를 방출하고 귀인 generic(@year/@month/@day/@hour 4건)으로 폴백 중 — seat가 의미 있는 별(천을귀인·문창귀인 등, 12신살 제외)에 전용 엔트리를 shinsal.insights.json에 추가하면 자동 반영. preferredIds 재도입 여부는 현 markHighlights 우선순위로 충분한지 보고 결정 |
| CT-2 | 성패 상신 십성 슬롯 | verdict 5×usage 2=10건 기본 문안은 완료(8a9f7499e — '틀만 있음'은 구정보). 고도화: {sangshin} 치환 슬롯 또는 `gyeokgukSeongpae.<verdict>.<usage>.<상신십성>` 세분 factId+폴백 체인. 격국 **점수** 통합(10-4)과 절대 혼합 금지 |
| CT-3 | 타입 레벨 해석 소탕 | ① 신살 백과 폴백에만 걸리는 신살 전용 엔트리(미커버 목록은 dump-report-trace로 실측 후 확정) ② 천간 극 pair 레벨(현재 stemRelation.극 1건뿐 — PR-2에서 극 6쌍 탐지 소생됨) ③ 관계·공망 문장 품질 상향 |
| CT-4 | **종격 birth-time 권위 코퍼스** (PR-11 선행 재료) | 승격 게이트는 birth-time 행 20건 필요 — 현 20건 전부 pillar-only. 출생시각이 확인되는 현대 검증 케이스 위주 수집(고서 케이스는 구조적으로 pillar-only). intake 요건은 jonggyeok-authority-scaffold.test.ts 주석·fixture promotionCriteria 참조 |
| CT-5 | 삼재·상문·조객 본문 문안 | evidence 라벨(완료)을 본문 문장으로 강화 — 카드 문장 조립 코드 수정 수반(순수 데이터 작업 아님). 공포 조장·단정·미성년 금칙어 금지, service-visible-output 13 필수 동반 |

## 8. 사용자/교리 결정 대기 항목 (착수 전 합의 필요)

| # | 결정 | 관련 |
|---|---|---|
| D1 | 브랜치 PR 오픈·머지 시점 | P0-1 |
| D2 | 교운 표기 정책: 교운일 기점 vs 해당 나이 입춘 통일 | 9-3 |
| D3 | 일운 이관 정책: saju-ts 일운 활성 시 spring-ts 줄리안 계산기와의 관계(대체/병존/검증만) | 9-6 |
| D4 | 명식판 상문·조객 채택 여부(유파 병존 — 명식판·유년판) | 9-7 |
| D5 | 판정 분포 대조용 외부 데이터 소스(어떤 오라클로 강약/용신을 대조할지) | PR-13 |
| D6 | 종격 승격 검증 경로: birth-time 코퍼스 수집 vs pillar 직접 입력 게이트 재정의. **假從 산입 하위 결정은 정책 패널 3표 만장일치 `INCLUDE_WITH_FRAMEQUALITY` 권고 완료**(2026-07-10, 조건 6개 — `docs/dossiers/truth-panel-2026-07-10/README.md` §4) — 소유자 승인만 대기 | PR-11, CT-4 |
| D7 | 프론트 개방: 윤달(isLeapMonth) 입력 UI, 운성/십신 전문 모드 표 | HOLD |

## 9. 진행 상태 표 (완료 시 갱신 — 커밋 해시 필수)

> 2026-07-10 정정: 아래 PR-10 행의 과거 `IMPROVEMENT` 표기는 당시 내부 classifier 출력의
> 역사 기록일 뿐 권위 정답 대비 품질 향상 증거가 아니다. 새 classifier에서는 같은 방향 불명
> 변경을 `REVIEW_REQUIRED`로 차단한다.

| 항목 | 상태 | 커밋 | 일자 | 파급 실측/비고 |
|---|---|---|---|---|
| P0-1 Draft PR | 🔶 WIP 유지 | PR #653 | 2026-07-11 | 권위 scope를 분리하고 D1 필수 7필드 미만 PASS, D5 안정성=정확도 과대계상, URL-only T4 승격, panel raw-array 세탁을 차단했다. T4는 Git 추적 page+quote transcript/SHA/realpath를 요구하고, 6개 Jonheom은 non-eligible이다. source-tier는 thin facade + 5개 모듈과 exact DAG/immutable guard로 분해했다. RPI 20/100이며 외부 전문가 signoff manifest도 없으므로 release-complete 실패와 Draft 유지가 정상이다. |
| P0-2 테스트 체인 무결성 | 🔶 로컬 회귀 통과·CI 보완 필요 | bc4134ecc | 2026-07-12 | Seed 전체 `npm test`와 Spring typecheck/build·bridge·lifecycle·snapshot 17/17·compat 208/0은 통과했다. 그러나 현재 workflow는 Seed install/typecheck/test/build를 실행하지 않고, 구조 회귀와 외부 인증 red gate를 한 job에 혼합한다. GitHub Actions billing 잠금으로 최신 HEAD 성공 이력도 없으므로 CI 완료로 표기하지 않는다. |
| P0-4 학파 출처 무결성 | 🔶 저작 완료·독립 검토 대기 | 49a785cfa | 2026-07-10 | 누락 10개 출처 문서(docs/11·16·17·18·19·20·22·25·26·27) 전부 저작 — 교리 요약·고전 서지·엔진 매핑(file:line 검증)·검토자 체크리스트 포함, 헤더에 독립 검토 대기 명시. `validate:school-sources` FAIL(23)→PASS(18 프리셋), test:release-tools PASS. 게이트 완결 조건인 독립 검토 메타데이터는 검토 후 기록 |
| P0-5 호환 계층 분해 | 🔶 부분 완료 | pending | 2026-07-10 | follow potential·strength component·bridge contract·운 관계 계산 중복을 분리/삭제. 대형 adapter와 legacy seam의 mapper 단위 분리는 후속 |
| backend 런타임·데이터 경계 | ✅ 코드 체크포인트 / 🔶 release 검토 대기 | 352a1303c | 2026-07-12 | `3f08b2754..352a1303c`: legacy fortune mapper 분리, 이름 identity fail-closed, Seed 점수정책·입력 계약, Hanja 질의 결정성, Spring operation lease와 16개 DB asset verifier를 추가했다. Hanja/Fourframe뿐 아니라 NameStat도 선택된 shard의 byteLength·SHA를 검증한 동일 snapshot을 열고 userVersion·전체 schema·row count 통과 후에만 publish한다. NameStat 원본 19초성과 14-shard routing을 분리하고 실제 50,194행을 전수 고정했으며, 진행 중 shard fetch/body는 repository close 시 abort하고 signal을 무시하는 custom transport도 호출자 관점에서 즉시 취소한다(`0af887ad3`). sql.js JS/WASM은 1.14.1로 정확히 맞추고 package-relative WASM·MIT notice·byteLength·SHA 계약을 함께 배포하며 CDN fallback을 제거했다(`352a1303c`). 최종 Seed/Spring typecheck, test typecheck, 자산 3/3, lifecycle 35/35, 실제 npm tarball 설치 스모크 5/5, package boundary 2/2가 통과했다. Vite production build의 최종 자산 방출·모바일 peak memory 실측, 원본 통계 JSON provenance, same-element `-5` 전문가 검토는 후속이다. 이 행은 구조·무결성 guardrail이며 격국·강약·용신 권위 인증이 아니다. |
| 글로벌·역사 시간정책 | ✅ backend 체크포인트 / 🔶 상용 claim 검토 대기 | 0e91b8ec9 | 2026-07-12 | Spring 기본을 civil-offset 자오선으로 정합화하고, legacy 135°/120°는 지역 호환 opt-in으로 분리했다. 물리 경도 비변조, 위치 tuple·충돌 fail-closed, IANA gap/fold·분 미상 전환 거부, 런타임 tzdb canary, 1~99년 literal-year UTC를 구현했다. modern Chinese preset·역사/DST·해외·부분입력은 의도적 default/API 변화다. 글로벌 geocoder·좌표/timezone 지리 검증·전 세계 역사 tzdb 인증·외부 권위 검토는 미완이다. |
| PR #653 리뷰 범위 | 🔶 분할 전 Draft 유지 | 6fb2f68a4 | 2026-07-12 | freeze `origin/main...6fb2f68a4`는 134커밋·418파일이며 frontend diff는 0이다. 읽기 전용 이력·merge-tree 감사는 커밋 재작성 없이 연속 prefix 스택 17개(운영 축소안 14개)를 권고했다. 이번 NameStat 체크포인트는 freeze 이후 별도 브랜치에 있으며, 분할 방식 확정 전 누적 PR에 섞지 않는다. 누적 PR 자체는 리뷰 가능 크기가 아니다. |
| P0-3 baseline 픽스처 보강 | ✅ | 75c3cdef5 | 2026-07-09 | 17/17(야자시 창 fix-16 + 음력 윤달 fix-17). 픽스처 수 하드코딩 2곳 동적화(baseline-metrics·quality-gate) |
| 9-1 운-원국 관계 | ✅ | 8c310a014 | 2026-07-09 | canonical fortune.relations node; springLegacy relationsWithNatal; adapter/report evidence. Natal-only relations and scoring unchanged. Verified: saju-ts 202/0, baseline 17/0, compat 208/0, tiered-shape 1378/0, service-visible 13/0, adapter-daewoon 24/0, transit-luck-report 12/0 |
| 9-2 대운↔세운 | ✅ | ade45f9c0 | 2026-07-09 | decade-year fortune relations in fortune.relations.decadeYears; saeun relationsWithDecade; yearly report evidence. Pre-start years omitted; natal scoring unchanged. Verified: saju-ts 204/0, baseline 17/0, compat 208/0, tiered-shape 1378/0, service-visible 13/0, adapter-daewoon 25/0, transit-luck-report 13/0 |
| 9-3 교운 일시 | ✅(approx) | 680494293 | 2026-07-09 | arithmetic approximate daeun boundaries only: daeunPillars approxStartUtcMs/approxEndUtcMs via startUtcMsApprox + decade length. D2 precision path still deferred. Verified: saju-ts 204/0, baseline 17/0, compat 208/0, tiered-shape 1378/0, service-visible 13/0, adapter-daewoon 26/0, transit-luck-report 13/0 |
| 9-4 나이 표기 옵션 | ✅ | 74a2a7742 | 2026-07-09 | FortunePolicy ageDisplay continuousFromBirth/koreanCountingAge. Default unchanged; koreanCountingAge opt-in and display-only. daeunInfo ageDisplayMode/Label + daeunPillars displayStartAge/displayEndAge; 4 report backends consume display ages while continuous-age matching remains unchanged. Verified: saju-ts 206/0, baseline 17/0, compat 208/0, tiered-shape 1378/0, service-visible 13/0, adapter-daewoon 28/0, transit-luck-report 13/0 |
| 9-5 A12 yearBoundary | ✅ | 3bf08cf5c | 2026-07-09 | 기본(liChun) 바이트 동일 확인(회귀 가드 테스트). 비-liChun만 세운 분절 변경. saju-ts 184/0·baseline 15/15·calendar-policy 14/0·compat 208/0 |
| 9-6 일운 정합 | 🔶 검증완료 | — | 2026-07-09 | 이원 경로 49,319건 대조 불일치 0(수식 동치·KASI 453건 양쪽 100%). 배선은 상품 요구(D3) 확정 시 — GUIDE §0.1 |
| 9-7 명식판 상문·조객 | ⬜ | | | D4 선행 |
| 9-8 thisYear·개두/절각 | ✅ | 0bfb061d2 | 2026-07-09 | thisYear tiered/category surfaces consume saeun PR-8 annotation evidence; stemBranchInteraction adds 개두/절각 when same-pillar stem/branch control. Verified: saju-ts 206/0, baseline 17/0, compat 208/0, tiered-shape 1379/0, service-visible 13/0, adapter-daewoon 31/0, transit-luck-report 13/0 |
| 10-1 왕상휴수 | ✅ 기본 on | f792c7765 → 8401cfbab | 2026-07-09 | 계측: 단독 완전 무파급(15픽스처·경계723·종격111·합의241 불변). measure_default_change HEAD~1↔HEAD=UNCHANGED, main↔HEAD=IMPROVEMENT(5/0/10) 유지 |
| 10-2 감쇠 세분 | ✅ 기본 on | 07aeaaf33 → 8401cfbab | 2026-07-09 | 계측: 유일 이동 = fix-14 이름 후보 finalScore +0.1×2(순위 불변, EPS 0.5 이내). 판정 필드 전 픽스처 불변 |
| 10-3 pressure 합거 | ✅ 기본 on | 0915087d8 → a9f27f52b | 2026-07-09 | 관성 천간합은 visible officer pressure만 감쇠. opt-in knob 커밋 후 기본화. 계측: 판정 필드 불변, snapshot 이동은 candidatesTop5만(fix-05 -0.4, fix-07 후보 재배열/1위 +0.6, fix-09 +0.1×2). validate:default-change main↔HEAD=IMPROVEMENT(5/0/10 + added 2, regression 0). Verified: saju-ts 207/0, baseline 17/0, compat 208/0, tiered-shape 1379/0, service-visible 13/0, adapter-daewoon 31/0, yongshin-consensus 273/0, jonggyeok 111/0, boundary-goldens 723/0 |
| 10-4 성패 점수 통합 | ✅ 기본 on | 893a3c0d4 → 13320a31c | 2026-07-09 | seongpae verdict(5단)을 월령 격국 score key에만 배율 반영. opt-in knob 커밋 후 기본화, opt-out 지원. 계측: baseline 17/0, compat 208/0, validate:default-change IMPROVEMENT(5/0/10 + added 2, regression 0), saju-ts 208/0, tiered-shape 1379/0, service-visible 13/0, adapter-daewoon 31/0, yongshin-consensus 273/0, jonggyeok 111/0, boundary-goldens 723/0 |
| 10-5 성패 v1 | ✅ 기본 on | 18323386e → c132da72a | 2026-07-09 | 월지 지장간 회지 상신(MAIN/MIDDLE, minWeight 0.3) + 상신/파격요인 세력 비교(opt-out 지원). 기본 영향: fix-09 편인격 confidence 0.5168→0.5875, fix-14 정관격 0.2784→0.3340; 타입/용신/후보 순위 무변. Verified: saju-ts typecheck, seongpae/selection 19/0, baseline 17/0, compat 208/0, validate:default-change IMPROVEMENT(5/0/10 + added 2, regression 0), tiered-shape 1379/0, service-visible 13/0, adapter-daewoon 31/0, yongshin-consensus 273/0, jonggyeok 111/0, boundary-goldens 723/0 |
| 10-6 위치 가중 | ✅ opt-in / 기본 보류 | cad382b0a | 2026-07-09 | `weights.elementDistribution.positionWeights/heavenPositionWeights/branchPositionWeights` 배선 완료. 기본값은 모두 1이라 baseline 17/0, compat 208/0 불변. 기본 on은 deficient/excessive·이름 판정 κ 파급 때문에 별도 계측 후 결정 |
| 10-7 통근 강도 계수 | ✅ opt-in / 기본 보류 | bec68276b | 2026-07-09 | `strategies.strength.lifeStageRoot.enabled=true`일 때 deDi 통근에 12운성 단계 배율(록/왕 > 장생 > 묘고 등)을 적용하고 evidence를 기록. 기본 off라 baseline 17/0, compat 208/0 불변. 기본 on은 강약·종격 판정 계측 후 결정 |
| 11 종격 승격 (a/b/c) | ⬜ | | | D6·CT-4 선행 |
| 12-1 yongshin methodBreakdown | ✅ | 5cebf5b88 | 2026-07-09 | 5-layer wiring complete: saju-ts API methodBreakdown, springLegacy reasoning evidence, spring-ts adapter/context passthrough. Verified: springLegacy 12/12, yongshin-consensus 307/0, baseline 17/0, compat 208/0, service-visible 13/0 |
| 12-2 gyeokguk basis | ✅ | 25da007e9 | 2026-07-09 | Exposes selected pattern basis, month-gyeok quality/details, and score map through saju-ts API, springLegacy, spring-ts adapter/context. Verified: springLegacy 13/13, gyeokguk candidates 257/0, baseline 17/0, compat 208/0, service-visible 13/0 |
| 12-3 jie proximity evidence | ✅ | dfac644a2 | 2026-07-09 | Exposes birth proximity to previous/next jie boundaries via springLegacy, SajuSummary, and SajuOutputSummary. Boundary goldens now assert before/after term direction and near-boundary guard. Verified: springLegacy 15/15, boundary-goldens 867/0, baseline 17/0, compat 208/0, service-visible 13/0 |
| 12-4 음양 균형 노출 | ✅ | e7e12fdd7 | 2026-07-09 | 5층 배선 완료(SajuSummary.yinYangBalance, test:adapter-yinyang 5/0) — 12계열 exemplar. 소비 카드 저작은 CT-3와 협업 |
| 12-5a scoredCheonganRelations | ✅ partial | 58b29a47f | 2026-07-09 | Revived cheongan relation score payloads in springLegacy and adapter-visible output. Verified: springLegacy 14/14, baseline 17/0, compat 208/0, service-visible 13/0. Remaining 12-5: shinsalComposites source decision and positionMultiplier policy |
| 12-5b shinsal positionMultiplier | ✅ partial | 21c95cb0c | 2026-07-09 | Replaced the hardcoded 1.0 with seat-based multipliers from matchedPillars: day 1, month 0.85, year 0.7, hour 0.6. Verified: springLegacy 15/15, adapter-shinsal 14/0, baseline 17/0, compat 208/0, service-visible 13/0. Remaining 12-5: shinsalComposites source decision |
| 12-5c shinsalComposites pipe | ✅ | bd1e4e6c0 | 2026-07-09 | Removed the unsupported empty shinsalComposites pipe instead of fabricating composite patterns without an engine source. Verified: springLegacy 16/16, adapter-shinsal 15/0, baseline 17/0, compat 208/0, service-visible 13/0. PR-12-5 dead-pipe cleanup complete |
| 12-6a shinsal attenuation trace | ✅ partial | b7552a6d3 | 2026-07-09 | Surfaces existing qualityReasons/conditionPenalty from shinsal condition scoring through springLegacy and spring-ts adapter/context. Duplicate-hit merge preserves trace union/max penalty. Gongmang 해공/excludeNames policy unchanged. Verified: saju-ts typecheck/build, spring-ts typecheck/build, springLegacy 17/17, adapter-shinsal 16/0, baseline 17/0, compat 208/0, service-visible 13/0 |
| 12-6b gongmang hegong | ✅ | e21987db2 | 2026-07-09 | Implements resolved-gongmang attenuation for void branches meeting 충/형 or 합(육합·삼합·방합). GONGMANG no longer self-penalizes on its own void pair; 해/파/원진 are intentionally excluded from gongmang 해공. Verified: saju-ts typecheck/build, spring-ts typecheck/build, springLegacy 19/19, adapter-shinsal 16/0, baseline 17/0, compat 208/0, service-visible 13/0 |
| 12-8 JOJA_SPLIT | ✅ | aac1b8309 | 2026-07-09 | Implements JOJA_SPLIT by separating day-pillar boundary from hour-stem day boundary: dayBoundary=midnight, hourStemDayBoundary=ziSplit23. Verified: saju-ts typecheck/build, spring-ts typecheck/build, springLegacy 20/20, yaza-opt-in 4/0, baseline 17/0, compat 208/0, service-visible 13/0 |
| 12-9 yin-stem Yangin split | done | e2ab5da58 | 2026-07-09 | Backend-only opt-in strategies.shinsal.yinYanginSplit: default keeps YANG_IN; true emits EUM_IN for yin stems and keeps BI_IN_SAL derived from YANG_IN/EUM_IN targets. Verified: saju-ts typecheck/build, shinsalDerivedTables+springLegacy 28/0, spring-ts typecheck/build, adapter-shinsal 16/0, baseline 17/0, compat 208/0, service-visible 13/0 |
| 12-1~12-10 잔여 설명가능성 | ⬜ | | | 항목별 커밋 — 12-4 커밋(e7e12fdd7)을 본보기로 |
| 13 오라클·재캘리브레이션 | ⬜ | | | D5 선행 |
| 14 신규 해석 축 | ⬜ | | | 육친 우선 |
| 15 후속 감사 | ⬜ | | | 방법 설계부터 |
| CT-4 종격 birth 후보 수집 | 🔶 2차 완료 | pending (도시에) | 2026-07-10 | 2차 채굴+적대검증 완결: **ACCEPT 46 / HOLD 5 / REJECT 0**(기존 9건 별도) — `docs/dossiers/truth-panel-2026-07-10/mining-output-final.json`. 이재승 KCI 2편(한국어 T3) 9건 확보로 저자 편중 완화. 신규 N-01~15 달력 정합 14/15(N-15는 야자시 시두법 — JOJA_SPLIT 경로). 假從 산입은 정책 패널 만장일치 권고 완료(§8 D6) — 소유자 승인 후 intake 8단계 진행 |
| 진리값 패널 (17픽스처) | ✅ repository evidence 완결 / 외부 인증 미완 | pending (도시에) | 2026-07-10 | 105/105 에이전트 + Codex 교차검증 dossier는 repository consistency와 정책 토론 기록이다. 실제 provider origin, reviewer identity, 외부 명리 전문가 자격을 인증하지 않으며 owner review 후에도 merge approval이 아니다. external expert signoff와 7-field truth intake가 별도 blocker다. |
| 엔진 불일치 판결 (10픽스처) | ✅ 도시에 완결 | pending (도시에) | 2026-07-10 | ENGINE_BUG 3(fix-04 강약 일간 자기셈입·fix-07/11 격국 오배속)/CALIBRATION 6/DOCTRINE_AMBIGUITY 2/PANEL_ERROR 0 + 종합. **핵심: scoring.ts:106-113 일간 자기 셈입 단방향 강측 편향(제거만으로 2건 반전 실측)**. 수정 착수 순서는 도시에 §6 — 전 항목 GUIDE §1 계측 필수 |
| 강약 일간 자기 셈입 제거 | 🔶 opt-in 구현·기본 보류 | 4eefcd154 | 2026-07-10 | `strength.excludeDayMasterSelf=true`에서 strength 전용 원장만 자기 비견을 제외. 범용 scorer 불변, provenance 단일 경계, 가중치 1/2 불변식 테스트. default-on 반사실: 17픽스처/158 leaf, strength 7·희신 6·종격위험 4·서사 17 이동, regression 0, fingerprint `377227…69143`. 순환 골든화 금지 — 독립 exact-diff 승인 전 기본 off |
| CT-1~CT-3·CT-5 | ⬜ | | | 병렬 가능 |
