# GUIDE — 사주 엔진 구현 레시피 (하위모델/새 세션용)

> `ROADMAP_SAJU_ENGINE.md`(우선순위 정본)의 **실행 상세 레시피**. 로드맵이 "무엇을·왜"라면
> 이 문서는 "정확히 어떻게"다. 새 세션은 로드맵 §0 착수 절차를 먼저 따르고, 착수 항목이
> 이 문서에 있으면 해당 절의 레시피를 그대로 실행하라.
> 갱신 규약: 항목을 끝내면 이 문서의 해당 절에 ✅와 커밋 해시를 적고, 로드맵 §9도 갱신.

## 0. 세션 기록 (2026-07-09 — 최상위 모델 세션)

| 커밋 | 내용 |
|---|---|
| 39ed2a89e | 로드맵 정본(ROADMAP_SAJU_ENGINE.md) 신설 |
| 3bf08cf5c | **A12 수정**(비-liChun 세운 정합, 기본 바이트 동일) + **P0-2 부분**(vitest include 6디렉토리) |
| f792c7765 | **PR-10-1**: 왕상휴수사 조견(core/seasonalStates.ts) + summary.seasonalStates(additive) + seasonal 비대칭 감쇠 knob(기본 off) |
| 07aeaaf33 | **PR-10-2**: 궁위 pairs 인접/원격 차등 손상 knob(root.positional, 기본 off) — 동일 지지 과감쇠 해소 |

검증 기대치 변경: **saju-ts vitest 198/198** (기존 178 → A12 +5, 왕상휴수 +7, positional +7, include 확장 +1).

### 0.2 후속 세션 실행분 (2026-07-09 — 같은 날 2차)

| 커밋 | 내용 |
|---|---|
| 8401cfbab | 두 knob 기본 on 시도. 당시 top-5 스냅샷에서는 fix-14 +0.1×2만 관찰했으나, 후속 self-review에서 권위 진리값 분모 0과 고정 이름 메트릭의 더 넓은 이동을 확인해 기본 off로 복구했다. 구현은 opt-in으로 유지한다. |
| 75c3cdef5 | **P0-3 완료**: baseline 17픽스처(fix-16 야자시 창 23:40, fix-17 음력 윤달 2004-윤2-15). 픽스처 수 하드코딩 2곳 동적화(baseline-metrics:121·156, quality-gate:78) |

갱신된 검증 기대치: baseline verify **17/17**, test:baseline-metrics **37/0**, test:quality-gate **20/0**.
§1·§2·§3의 "기본화 계측" 항목은 완료됨 — knob 관련 잔여 작업 없음.

⚠ 운영 함정 (이 세션에서 실제 밟음): **리포 루트에서 `npx vitest run`을 실행하지 마라** —
양쪽 lib의 테스트가 뒤섞여 실패하고, saju-ts `tests/precision/**/__snapshots__/*.snap`이
EOL/내용 오염될 수 있다. 반드시 `lib/saju-ts`에서 실행. 오염 시 `git restore`로 복원하고
`npx vitest run tests/precision`(50/50)으로 확인.

### 0.3 CT-4 1차 수집 결과 (2026-07-09 완료 — 초안: `lib/spring-ts/tmp/ct4-jonggyeok-birth-candidates.md`)

- **출생일시 완비 후보 9건**(즉시 8 + 보류 1). 최우선: C-06 坤造 1978-07-20 未時(戊午 己未 癸未 己未, 眞從 종살격 명시 판정). 서브타입: 진종살 1·가종관 1·가종재 1·가종아 1·화기 1·종왕계 1·종세 2·종약(보류) 1.
- **구조 리스크 2건**: ① 단일 저자 편중(魏多亮 7/9 — 저자당 상한 정책 필요) ② 假從 편중(6/9).
- **선행 정책 결정(D6에 병합)**: 엔진 calibrated가 假從을 CONG_*로 판정하는지 — 이 결정 없이는 게이트 분모 산입 불가.
- 배제 15건+ 사유 기록(Bill Gates 시진 분쟁, 이병철 편관격 판정, 木村拓哉 무시각 등). 한국어 채널 이번 패스 성과 0(네이버 크롤러 차단) — 후속: KCI 이재승(2018) 원문, 낭월 아카이브, 서적 스캔.
- **증분 광맥**: 魏多亮 실전명례 12페이지 중 1페이지만 소화 — 추가 수집으로 20건 도달 가능성 있음. sourceTier: 魏多亮 → T3 정박 가능하나 Sina 소멸 리스크 → 아카이브(웹아카이브 스냅샷) 필수.
- **intake 규칙**: tmp 초안을 fixture에 직접 반입 금지. 초안의 8단계 절차(원문 재검증→만세력 재검증→타임존/조자시 정책(C-08 00:10 경계)→假從 정책→매핑 리뷰→저자 상한) 통과분만 반입.

### 0.4 세션 기록 (2026-07-10 저녁 — 진리값·판결·채굴 완결, 어느 모델이든 여기서 이어라)

**완료된 것** (증거 전부 `docs/dossiers/truth-panel-2026-07-10/` — 먼저 그 README를 읽어라):
- 17픽스처 진리값 패널 105/105 + Codex gpt-5.5 교차검증(51판정: CONFIRM 46/WEAKEN 2/REJECT 1/SKIP 2)
- 엔진 불일치 판결 10/10 + 종합: ENGINE_BUG 3 / CALIBRATION 6 / DOCTRINE_AMBIGUITY 2 / PANEL_ERROR 0
- 종격 채굴 2차: ACCEPT 46/HOLD 5/REJECT 0, 달력 정합 14/15. 假從 정책 3표 만장일치 INCLUDE_WITH_FRAMEQUALITY(소유자 승인 대기)
- 커밋: fd3857903(차트 정합 테스트)·9c8da13b7(NO_AI_POLICY v2 2층 리뷰)·cf8b08006(D2/D4 평가자+정직 D5)
- cf8b08006 검증 재현 완료: gate-status 27/27, narrative 17/0×2, snapshot 17/0, service-visible 13/0,
  게이트 D5 PASS(14/0/na0/notApp3)·D2/D4 N/A(17)·overall PARTIAL. **부수 수정**: baseline-metrics의
  axis-A 단언이 옛 의미론(PARTIAL 강제)이라 1건 FAIL → 정직성 불변식으로 갱신(38/0). cf8b08006이
  baseline-metrics를 검증 목록에서 누락했던 것 — 게이트/집계 의미론 변경 시 이 테스트도 반드시 함께 확인.

**다음 작업 착수 순서** (순서 근거: 진리값이 확정되어야 수정 계측의 방향 판정이 가능):
1. **엔진 수정 — 판결 기반** (도시에 README §2·§6): 1층(일간 자기 셈입, `saju-ts/src/core/scoring.ts:106-113`
   → `rules/facts.ts:2384` 소비처) 제거부터. 이어 2층(deLingDiShi 월령 가중·囚/休 서열·조후 maxBoost·
   flat strongPref — 판결별 file:line은 mismatch-verdicts-final.json의 recommendation 필드).
   **전 항목 §1 계측 절차 필수**(스냅샷·이름점수 파급 큼). DOCTRINE_AMBIGUITY 2건(fix-02 격국,
   fix-05 강약 hedge)은 **수정 금지** — 이설 보존.
2. **authority truth 파일 저작** (`test/baseline/authority/<fixture-id>.json`, 스키마는 그 디렉터리
   README): expected/narrativeClaims는 truth-panel-output-final.json에서. fix-02 격국 드랍(또는
   양쪽 허용), fix-05 강약은 band만. NO_AI_POLICY v2 필수 메타(sourceType
   ai_panel_adjudicated_interpretation·aiGenerated true·panelModels 2+·adversarialVerification true·
   dossier 경로·authorityReview)는 도시에 README §6 — **소유자 승인 없이는 check_no_ai_policy가
   차단하며 이는 의도된 것**(우회 금지). 랜딩하면 D2/D4가 N/A(17)에서 실측으로 전환된다.
3. **코퍼스 intake** (§0.3 8단계 절차 + 假從 정책 조건 6개): ACCEPT 46 중 출생시각 완비 행 선별,
   Sina 원문 web.archive.org 아카이브 선행, 저자 상한 50%, KCI 이재승 행 우선(한국어 T3).
   corpus-intake-draft.json(N-01~15)은 초안일 뿐 직접 반입 금지.

**검증 기대치 (2026-07-10 실측)**: saju-ts vitest **254/254(42파일)**, baseline 17/0,
test:baseline-metrics **38/0**, test:quality-gate 20/0, compat **208/0**, jonggyeok-authority
**168/0+INFO**(pillar-only 20행·게이트 유예 = 정상), narrative golden 17/0, service-visible 13/0.
⚠ composite-quality-gate의 main..HEAD diff=0 검사 FAIL은 기본값 변경 브랜치에서 설계상 정상(재조사 금지).
⚠ GitHub Actions는 org 결제 잠금으로 미기동 — CI 결과를 기다리지 마라(로컬 체인으로 검증).

### 0.5 후속 세션 기록 (2026-07-10 밤 — 일간 자기 셈입 수정 경로 구현, 기본화 보류)

- `strategies.strength.excludeDayMasterSelf=true` opt-in 경로를 구현했다. 범용 `scorePillars`
  원장은 보존하고, 모듈 내부 WeakMap provenance가 실제 `stemWeight`를 점수 객체와 결합한 뒤
  작은 순수 모듈 `rules/strengthBase.ts`에서만 일간 직접 비견 기여를 제외한다.
- split-brain 방지: `buildRuleFacts`는 공개 점수 형상을 바꾸지 않는 내부 provenance를 우선한다. provenance가 없는
  수기 점수나 모순 가중치는 타입/불변식에서 fail-closed 한다.
- 기본값은 **off 유지**다. 임시 default-on 계측에서 17픽스처 전부 158 leaf가 이동했고,
  강약 표면 7건, 희신 baseline 6건, 종격 위험 baseline 4건, 서사 golden 17건이 연쇄 변경됐다.
  이 결과를 엔진 출력으로 곧바로 재캡처하면 순환 승인이므로 하지 않았다.
- opt-in 증분 계측: `REVIEW_REQUIRED` 7 / regression 0 / unchanged 10,
  fingerprint `sha256:3772274798d96e9e9fe1b9a7ad5a2b72ef6b918b967242066b99f5169fb69143`.
  fix-04 실측은 index `+0.03478 → -0.097244`, support `4.16498 → 3.19638`,
  `중화(신강 경향) → 중화(신약 경향)`이다.
- 기본 모드 검증은 saju-ts 43파일/259테스트, snapshot 17/0, narrative 17/0,
  yongshin-consensus 307/0, jonggyeok 111/0, compat 208/0으로 유지된다.
- 다음 단계: fix-04 메타 정정분 확인 → opt-in 158 leaf 전수 독립 리뷰 → 승인된 fingerprint로만
  기본값 전환·스냅샷 재캡처. 그 전에는 “강약 버그 수정 경로 구현”만 주장하고 “전문가 검증 완료”는
  주장하지 않는다.

### 0.1 일운(9-6) 선행 검증 — 완료, 결과 기록

이원 경로(saju-ts calcDayPillar vs spring-ts getDailyFortune) **완전 일치 실측**:
1900~2030 전 날짜 47,847건 + 엔진 실경로 540건 + KASI 만세력 오라클 453건×2 = 총 49,319건, 불일치 0.
두 수식은 수학적으로 동치((JD+49) mod 60 ≡ (JD−2451551) mod 60).

의미 차이 2가지만 존재(버그 아님, 설계 차이):
- spring-ts에는 dayBoundary(ziSplit23) 개념이 없음 — 항상 자정 경계. 엔진 기본값도 midnight이라 기본 설정에선 동일. ziSplit23을 켜면 23:00~23:59 라벨이 하루 밀림(정책 차이).
- spring-ts `getDailyFortune(date)`는 호스트 타임존의 달력 성분을 사용(fortuneCalculator.ts:169-175) — 호출처가 UTC 자정 Date를 서쪽 타임존 서버에서 넘기면 하루 밀릴 수 있는 **호출처 책임** 위험. period-fortune-card.ts:272의 targetDate 구성에 좌우.

→ **D3 결정에 대한 입력**: 병존은 무해(동치 확인). saju-ts 일운 활성(maxDays)은 상품 요구 확정 시에만 배선하면 되고, 그때 로드맵 9-6 레시피(월운 선례 복제)를 따른다.

## 1. 공통: knob 기본화 계측 절차 (판정 변경 공통 — PR-3 확립 관례)

knob(기본 off)로 랜딩된 기능을 기본 on으로 바꾸는 커밋은 반드시:

```bash
# 1) knob 기본값을 코드에서 뒤집는다 (예: readStrengthInteractionPolicy의 enabled 기본)
cd lib/saju-ts && npm run build
# 2) 파급 실측 (main 대비 15픽스처 개선/회귀/불변)
cd ../spring-ts && npm run validate:default-change   # 기대: IMPROVEMENT(회귀 0)
# 3) 스냅샷·킬체인
npx tsx tools/baseline_snapshot.ts verify             # 판정 필드 diff 항목별 기록
npm run test:namespring-compat                        # 208
npm run test:tiered-shape                             # 1378
# 4) κ 커버리지 (HANDOFF_SAJU_ENGINE.md E절 PR-3 관례 — dump-report-trace before/after 정합✓)
```

회귀가 1건이라도 있으면 기본 off 유지 + 로드맵 §9에 사유 기록. 결과 수치는 커밋 메시지에 병기.

## 2. PR-10-1: seasonal 비대칭 감쇠 구현 완료 — 기본화 보류

- 코드는 전부 랜딩됨(f792c7765). `enabled === true`인 명시 opt-in으로 유지한다.
- 17픽스처의 authority truth denominator가 0이므로 수치 기본화 근거가 없다.
- multipliers(왕 0.7/상 0.85/휴 1.0/수 1.15/사 1.3)는 provisional이다. 독립 권위 holdout과
  재캘리브레이션 없이는 기본값을 뒤집지 않는다.
- 부속(선택): summary.seasonalStates의 springLegacy 재방출 + 해석 저작은 콘텐츠 축(CT-3와 함께).
  재방출 시 deepSerialize 스프레드로 스냅샷 표면에 즉시 등장함을 잊지 말 것(스냅샷 재캡처 동반).

## 3. PR-10-2: 궁위 pairs 기반 감쇠 세분 ✅ 구현 완료 (07aeaaf33) — 기본화 보류

> 아래 설계는 커밋 07aeaaf33으로 구현됐다. 차이점: 값-detection 특성상 위치별 '해소' 차이는
> 원리상 불발이라 해소는 값 수준 유지, 차등은 **인접/원격 거리(d1 1.0/d2 0.5/d3 0.25)**에만
> 적용했다(자평 인접성 통설 — 동일 지지 과감쇠는 원격 완화로 해소됨). knob는
> `strength.interaction.root.positional.enabled`(기본 off). 독립 권위 holdout 전까지 opt-in 유지.
> 계측 시 seasonal(§2)과 함께 켠 조합도 1회 측정할 것(곱 결합 — eff = 1-(1-f)·scale·mult).

### 원 설계 메모 (구현 전 기록 — 참조용)

**문제**: `computeBranchInteractionFactors`(facts.ts)의 1차 감쇠가 값 매칭이라 동일 지지가
2개 있으면(예: 午 2개, 그중 1개만 子午충 당사자) 둘 다 감쇠됨(과감쇠).

**설계 (이대로 구현)**:
1. 호출부(`computeStrengthFacts` 내 rootDamage 계산)에 값 그룹(byType) 대신 **DetectedRelation
   객체(pillarIndexes/pairs 포함, PR-5 인프라)**를 전달하는 경로를 추가한다. 원천은
   `buildRuleFacts`에서 detectBranchRelations 결과 — `relationsByType`을 만드는 지점에서
   relation 원본도 함께 끌고 오면 된다(신규 파라미터 `relationsDetailed?: DetectedRelation[]`).
2. knob: `strength.interaction.root.positional`(기본 false). off면 현행 값 매칭 그대로(바이트 불변).
3. on일 때: 각 damage relation에 대해 `rel.pairs`(또는 pillarIndexes)가 있으면
   `factors[i]`를 **i가 해당 relation의 궁위 인덱스 집합에 포함될 때만** 감쇠.
   pairs 부재 시(구 데이터) 값 매칭 폴백.
4. 왕상휴수 비대칭(seasonal)과 곱 순서는 현행 유지(f → eff 변환 후 factors[i] 곱).
5. 테스트(신설 `src/rules/strengthPositionalDamping.test.ts`):
   - 午午 중복 + 子(년) 충: positional off → 午 둘 다 감쇠 / on → 충 pair에 포함된 午만 감쇠.
   - pairs 없는 합성 입력 → 값 매칭 폴백 동작.
   - 엔진 계약: 기본 설정 strength 불변(off 바이트 불변).
6. 기본화는 §1 절차 별도 커밋.

**함정**: triple 관계(SAMHYEONG 등)는 pairs가 없을 수 있음 — pillarIndexes(멤버별 궁위 배열)를
사용하고, 그것도 없으면 값 매칭 폴백. detectBranchRelations의 dedupe는 값 기준이라 동일 값
지지가 두 궁위에 있으면 pillarIndexes에 **양쪽 인덱스가 다 들어있는지** 먼저 실측하고 설계를
맞출 것(들어있다면 '당사자'의 정의를 "관계 성립에 필요한 최소 집합"으로 좁힐지 결정 필요 —
보수적으로는 pillarIndexes 전체를 당사자로 봐도 현행보다 정밀함).

## 4. PR-12-4: 음양 균형 노출 ✅ 완료 (e7e12fdd7) — 이 커밋이 12-x 공통 본보기

> 완료됨. 12계열 후속(12-1 용신 methodBreakdown, 12-2 격국 basis, 12-3 시간 카드 등)은
> **커밋 e7e12fdd7의 diff를 그대로 본보기**로 삼아라: api/types.ts(View)+engine.ts(산출)
> +springLegacy(additive 키)+saju-adapter(extractor)+spring-ts types(Summary 필드)
> +test:adapter-* 신설(package.json script 포함). saju-ts 기대치 200/200으로 갱신됨.

### 원 레시피 (참조용)

PR-12 계열(용신 methodBreakdown·격국 basis·시간 카드 등)은 전부 같은 5층 패턴이다.
음양이 가장 작으므로 이것을 먼저 그대로 따라 하면 패턴이 손에 익는다.

1. **산출 확인**: `core/scoring.ts` YinYangScore·`core/tally.ts` YinYangTally — 이미 계산 로직
   존재, 소비자 0곳. 간단하므로 그래프 노드 신설 대신 engine.ts에서 pillars로 직접 집계해도
   된다(왕상휴수 선례: f792c7765의 engine.ts 수정 참조 — 순수 조견은 노드 불필요).
2. **타입**: `api/types.ts` SummaryReport에 `yinYangBalance?: { yin: number; yang: number; ... }`
   additive 필드 + View 타입.
3. **engine.ts**: toggles.pillars 블록에서 산출·주입 (seasonalStates 코드 바로 아래).
4. **springLegacy 재방출(선택 — 리포트 도달에 필수)**: 반환 객체에 additive 키.
   ⚠ 이 순간 스냅샷 표면 등장(deepSerialize) — baseline 15픽스처 diff 확인 필요(판정 필드
   불변이면 스냅샷 재캡처 없이 additive 허용 여부를 tools/baseline_snapshot.ts 동작으로 확인).
5. **adapter**: `saju-adapter.ts`에 typed extractor(extractWolunPillars 선례) + spring-ts types.ts.
6. **소비 카드**: 명식표/전문 카드에서 소비(콘텐츠 축과 협업).
7. 검증: saju-ts vitest(191+) → build → spring-ts typecheck → baseline verify 15/15 →
   adapter 테스트 → tiered-shape 1378 → compat 208 → service-visible-output 13.

각 단계가 한 층이라도 빠지면 **컴파일 에러 없이 조용히 undefined** — 로드맵 §3 함정 표 참조.

## 5. PR-9-3: 교운 일시 무파급 산술 파생 [난이도 하]

D2(교리: 교운일 기점 vs 입춘 통일) 결정 전에는 **산술 파생 경로만** 랜딩한다:
1. `springLegacy.ts` daeunPillars 조립부(saeunPillars interval 병기 선례가 바로 아래에 있음)에서
   `daeunInfo.boundaryUtcMs`(첫 대운 기산 절기 시각) + `i × 10년`(addYearsUtc 방식)을
   `approxStartUtcMs`/`approxEndUtcMs`로 병기 — **'approx' 접두 필수**(정밀 절기 재계산이 아님을
   이름에 명시; 기존 startUtcMsApprox 'for UI only' 관례).
2. Number.isFinite 가드(saeun 선례 그대로), 빈 값이면 키 자체 생략.
3. adapter extractor(DaeunPillarSummary에 optional 필드) + adapter-daewoon 테스트 확장.
4. 스냅샷 파급: springLegacy 새 키 = 표면 등장. baseline verify가 판정 필드만 보는지 확인 후,
   전체 스냅샷 diff에 등장하면 그 사실을 커밋 메시지에 명기.
정밀 경로(각 대운 경계 절기 재계산, compute.ts 5층)는 D2 결정 + 상품 요구 확정 후 별도.

## 6. CT/P0 병렬 작업 지시 (Codex 위임용 프롬프트 씨앗)

- **P0-3 baseline 픽스처 보강**: 로드맵 P0-3 그대로. capture는 단독 창에서. 완료 기준 17/17.
- **CT-1 귀인 궁위 해석**: shinsal.insights.json에 `shinsal.천을귀인@day` 식 전용 엔트리 추가
  (카드 수정 불필요 — 폴백 체인이 이미 소비). sourceTier T1+aiGenerated 필수.
- **CT-4 종격 birth-time 코퍼스**: 출생시각 확인되는 현대 검증 케이스 위주 20건+.
  intake 요건은 test/integration/jonggyeok-authority-scaffold.test.ts 주석 + fixture
  promotionCriteria. **이것이 PR-11 완전 승격의 유일한 데이터 관문**(D6에서 게이트 재정의를
  택하지 않는 한).

## 7. 이 세션에서 하지 않기로 한 것 (근거 포함 — 재논의 시 참조)

- **종격 램프 재설계 즉시 착수 보류**: 램프를 앵커 정규화로 바꾸는 수식 자체는 간단하나,
  앵커/게이트 값을 정할 **캘리브레이션 데이터(birth-time 코퍼스)가 0건**이라 지금 값을 박으면
  추측 캘리브레이션이 됨. CT-4(코퍼스) 또는 D6(게이트 재정의) 선행. 수식 변경 시
  facts.ts(1149·1154 부근)와 yongshin.ts(571-582) **두 곳 동기화** + calibrated 프리셋에서
  선검증 원칙은 로드맵 PR-11 그대로.
- **프론트/namespring 무접촉** 유지.
