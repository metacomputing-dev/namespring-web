# saju-ts 엔진 무결성 감사 보고서

> 2026-07-08, 브랜치 `feature/saju-engine-integrity-audit`.
> 방법: 8개 도메인 × (코드 정밀 리딩 + 명리 전문 표준 웹 리서치) → 갭 분석 → bug/high 전건 적대적 검증(70 에이전트), 병행 런타임 프로브(saju-ts 재빌드 후 10개 명식 실측).
> 결과: 발견 103건 — 검증 통과(CONFIRMED/PARTIAL) 33건, 미검증(low/enrichment 위주) 70건. 반박(REFUTED)된 발견 0건.
> 상세는 부록 A(프로브)·B(전체 발견)·C(미감사 영역) 참조.
>
> **상태 주의(2026-07-12):** 본문의 “현재”와 103건 집계는 2026-07-08 감사
> 스냅샷을 뜻한다. 이후 해결·부분해결 상태와 새 시간정책 결함은 부록 D를 함께
> 읽어야 하며, 본문만으로 현재 HEAD 상태를 판정해서는 안 된다.

## 1. 총평

**엔진의 기초 체력은 좋다.** 절기 계산은 VSOP87+ΔT 다항식으로 전문급이고, 진태양시 경도 보정(기본 on, 서울 -32분), 지장간(비율 포함), 공망, 대운 소수점 정밀 산출, 격국 후보 체계, 신살 카탈로그+DSL 룰 컴파일러, 스쿨팩 구조까지 골격은 상용 만세력 이상으로 설계돼 있다.

**문제는 세 겹이다:**

1. **springLegacy 병목에서 정보가 대량 소실·왜곡된다.** 엔진이 정확히 계산한 것(12운성, 신살 앉은 기둥, 득령득지득세 분해, 용신 방법별 근거, 월운)이 `compat/springLegacy.ts`의 손실 축약에서 버려지고, 일부 필드는 **다른 값이 라벨만 달고 나간다**(득령=비겁합, 용신 1위=무조건 '조후', dst보정=0 하드코딩).
2. **기본(프로덕션) 설정이 주류 표준에서 벗어나 있다.** 신강약이 월지 무가중 base 모델, 조후 완전 배제, 종격 도달 불가, 건록격/양인격 부재 — 명리 지식이 있는 사용자가 보면 즉시 지적할 지점들.
3. **죽은 코드·no-op 설정·테스트 공백.** 스쿨팩 2종이 완전 no-op, 신살 품질모델 미배선, opt-in(납음/12궁)을 켜면 require() ESM 비호환으로 **사주 분석 전체가 빈 값으로 붕괴**, 조견표(12운성 120칸·지장간·신살 배속) 단정 테스트 0건.

성명학(seed-ts)은 이번 범위에서 이슈가 나오지 않았고, 작업 대상은 saju-ts + spring-ts 어댑터 층에 집중된다 — 사용자 방침과 일치.

## 2. 핵심 발견 요약 (중복 통합·등급 단일화 후)

교차 도메인 중복(극·seatPillars·귀문·dst·명궁/태원·년주공망·삼재)은 1건으로 통합했다.

### A. 틀린 값이 사용자에게 나가는 것 (CONFIRMED bugs)

| # | 발견 | 위치 | 심각도 |
|---|---|---|---|
| A1 | 득령/득지/득세가 실제 판정이 아니라 십성 점수 재라벨(득세=앞 둘의 단순합) | springLegacy.ts:1132-1134 | high |
| A2 | 용신 추천 1위가 무조건 'JOHU'(조후)로 표기 — 실제 산출은 순수 억부 | springLegacy.ts:1152 | high |
| A3 | 육합·자형·삼형 라벨 키 불일치 — note 빈 채 'YUKHAP' 원시 코드 노출 | springLegacy.ts:77-96, saju-adapter.ts:202-237 | high |
| A4 | 신살 position이 궁위가 아닌 산출기준(basedOn), 시주는 구조적으로 0건 (기지) | springLegacy.ts:438-444 | high |
| A5 | surfaceNaeum/surfacePalace 켜면 require() ESM 비호환으로 전체 emptySaju 붕괴 (프로브 발견) | saju-adapter.ts:1449, 1506 | high |
| A6 | palace.ts 본기 선택 오류 — 여기(RESIDUAL)를 본기로 집음 (寅→戊, 정답 甲) | palace.ts:132 | high(opt-in) |
| A7 | 신살 품질모델 미배선 — sanmingtonghui 팩 감쇠 비활성이 무효 | shinsal.ts:352(미호출) | high |
| A8 | 월덕/천덕 scope 설정 파싱만 되고 미적용 — virtueStrict 팩 완전 no-op | facts.ts:2829,2847(미호출) | high |
| A9 | dstCorrectionMinutes=0 하드코딩 — 실제 보정은 되는데 미보정처럼 표기 | springLegacy.ts:1121 | medium |
| A10 | 12신살 년지·일지 이중 방출로 동일 삼합군이면 점수 2배 계상 | defaultRuleSets.ts:299-307 | medium |
| A11 | YAZA_23_30 모드 -30분이 인스턴트 전체에 적용 — 입춘·절입 판정까지 이동 | springLegacy.ts:833,848 | medium |
| A12 | yearBoundary 비-liChun 설정 시 연주와 세운의 내부 모순 | fortune/compute.ts:224-230 | medium |
| A13 | saryeongScheme 켜면 지장간 순서 반전으로 대표 십신이 여기 기준 + 노드별 가중 불일치 | wollyul.ts:174-178, facts.ts:2371 | medium |
| A14 | 12운성 'INDEPENDENT' 미구현인데 조용히 화토동궁 폴백 | lifeStage.ts:70-72 | medium |
| A15 | 저심각 5건: 1908년 이전 오프셋 파싱 실패(+9 무경고 폴백), jie 폴백이 조작된 입춘값 반환, GONGMANG_DAY 영구 불발화 룰, boundaryMode에 일경계 정책 오주입, positionMultiplier=1 형식 필드, 午 월률 31일 자기모순, EoT 정밀도 미상속, stale 주석 다수 | 각 위치 부록 참조 | low |

### B. 전문가는 계산하는데 없는 것 (missing, 주류 표준)

| # | 발견 | 심각도 |
|---|---|---|
| B1 | **음력 입력 미지원** — 음력 선택 시 사주 분석 전체 비활성 (프론트는 선택지 노출 중) | high |
| B2 | **천간 극(剋) 6종 계산 자체가 없음** — 소비층 라벨은 깔려 있는 죽은 배관 (기지) | high |
| B3 | **반합(半合) 미지원** — 운(運) 경로는 부분 삼합 인정, 원국은 3자 완전체만: 내부 모순 | high |
| B4 | **건록격·월겁격·양인격 부재** — 월지 비겁을 '비견격/겁재격'으로 출력(주류에 없는 격명) | high |
| B5 | **종격이 기본 설정에서 도달 불가** — 극신약 종격 명식에 정반대(억부) 용신 출력 | high |
| B6 | **프로덕션 조후 완전 배제** — climate weight 0, 조후위급 게이트도 꺼짐 | high |
| B7 | **신강약 기본 모델이 월지 무가중** — deLingDiShi 모델은 구현돼 있으나 opt-in | high |
| B8 | **고신살·과숙살 부재** — 한국 실무 최다 빈도급 | high |
| B9 | **귀문관살 부재** — 원진만 지원, 子酉·寅未 조합은 어떤 이름으로도 안 잡힘 | high |
| B10 | **한국 표준시 변천·서머타임 자체 테이블/픽스처 테스트 없음** — Intl tzdata에 무검증 의존 | high |
| B11 | 대운수 정수 표기(반올림 유파) 옵션 부재 — 약 1/3 사주에서 상용 만세력과 1세 차이 (PARTIAL 정정 반영) | medium |
| B12 | 궁통보감 조후용신표 120셀 미수록 — 일간당 고정 1천간 근사 (PARTIAL: 오행 레벨은 climate가 커버) | medium |
| B13 | 합충 해소(탐합망충)·왕상휴수사·상신(성격/파격)·교운 일시·암록/협록·해공·현침 등 흉살군·운 신살(삼재·상문조객)·명궁/태원·년주 기준 공망 — 미검증 medium/low 다수 | medium↓ |

### C. 계산됐는데 버려지는 것 (enrichment — 배관 복구만으로 아웃풋이 풍성해짐)

| # | 발견 | 비고 |
|---|---|---|
| C1 | **12운성**: 엔진이 항상 계산(주류 방식: 화토동궁+음간역행), springLegacy가 안 읽어 sibiUnseong 영구 null. 매핑 + 소비 카드 신설 필요 (PARTIAL 정정: 렌더러도 없음) | 전 만세력 공통 표기 항목 |
| C2 | **신살 앉은 기둥(matchedPillars)**: engine.ts:270까지 나오는데 legacy 축약에서 드랍 — handoff 작업 5-후속(seatPillars) 스펙과 합치 (기지) | 궁위 통변의 전제 |
| C3 | 일간 기준 귀인 15종 basedOn='OTHER' 하드코딩 — '일간 기준' 서사 불가 | A4와 연동 |
| C4 | 용신 방법별 근거(base.*)·격국 basis(선정방법·청탁)·득령득지득세 분해(details.delingdiShi)·감쇠 트레이스가 전량 미노출 — 전문성 서사 재료 사장 | 유료 리포트 차별화 재료 |
| C5 | 월운 24개월 계산 후 폐기(일운은 기본 maxDays=0으로 미계산 — critic이 도메인 간 모순 판정), 세운 120년 중 30년만 노출 | |
| C6 | 음양 균형(YinYangScore/Tally) 구현돼 있으나 소비자 0곳 — 완전 미노출 축 (critic 발견) | |
| C7 | 시간 보정 내역(적용 표준시·보정 후 시각) 미노출, 납음 opt-in(A5 수정 전제) | 신뢰 신호 |

## 3. 정책 결정이 필요한 지점 (사용자 판단 요망)

1. **일주 경계 기본값**: 현재 자정(midnight)설. 주류는 정자시설(자시 개시 시 일주 교체, 실무 약 80%) — 기본값을 바꾸면 23:30~00:32 출생자의 일주·시주가 바뀐다. 기존 사용자 결과 변동 + 스냅샷 회귀 벽(spring-ts baseline 15픽스처) 깨짐을 감수할지, 이설 유지 + 리포트에 판정 기준 명시로 갈지. (감사 내부에서도 23:00 vs 23:30 경계 표기가 갈렸음 — 부록 C 모순 항목 참조)
2. **신강약 기본 모델 전환**(base→deLingDiShi)과 **조후 개입 기본화**(climateUrgency): 판정 결과가 실제로 바뀌는 사주가 생긴다. 등급-텍스트 정합 불변식과 생성 코퍼스(κ 클래스) 파급 검토 필요.
3. **음력 입력**: KASI API 연동(네트워크 의존) vs 변환 테이블 내장(1900~2050). 현재 프론트가 음력 선택지를 노출하고 있어 실사용자가 빈 결과를 받는 중.
4. **대운수 표기**: 정수 반올림 유파 기본 + 연속값 병기(이원 표기)로 갈지.

### ✅ 결정 (2026-07-08, 사용자 확정)

공통 원칙: **네 건 모두 설정으로 선택 가능하게 하되, 기본값은 '가장 고품질·전문가 수준' 쪽.** 외부 호출(KASI API 등)은 지원하더라도 기본은 내장 값 사용.

1. 일주 경계: **기본 = 정자시설**(엔진 `ziSplit23` + 경도 보정, 시계 기준 약 23:32 일주 교체). 자정설·야자시설은 옵션으로 유지. 기본 전환은 PR-3에서 스냅샷 파급과 함께 수행.
2. 신강약·조후: **기본 = deLingDiShi 모델(월지 가중) + climateUrgency 기본 활성 + climate weight 소폭(0.2~0.3)**. base 모델은 옵션 강등. PR-3.
3. 음력 입력: **기본 = 내장 음양력 변환 테이블(1900~2050)**, KASI API는 옵션(교차 검증·범위 밖 연도용). PR-4.
4. 대운수: **기본 = 이원 표기** — 표기용 정수(반올림 유파: 나머지 1일 버림·2일 올림) + 연속 정밀값 병기, minStartAge=1. rounding 유파는 옵션. PR-3.

## 4. 권장 작업 패키지 (PR 단위)

파급 작은 순 → 큰 순. PR-1·2는 결과 불변(정직화·배관)에 가깝고, PR-3부터 판정 결과가 바뀐다.

- **PR-1 아웃풋 정직성 핫픽스** (A1~A3, A5, A6, A9, A15 일부): 가짜 라벨 제거·실값 배선, opt-in 붕괴 수정, 라벨 키 보강. 위험 낮음, 즉시 착수 가능.
- **PR-2 배관 복구 + 관계·신살 보강** (C1~C3, B2, B3, B8, B9, A4): 12운성 노출, seatPillars 통과(handoff 스펙), 극 탐지 추가, 반합(왕지 필수), 고신/과숙, 귀문. 인사이트 콘텐츠 확장의 전제.
- **PR-3 판정 품질 재정렬** (B4~B7, A7, A8, A10, A14, B11): 건록/양인격, 종격 게이트, 조후 개입, deLingDiShi 기본화, 스쿨팩 no-op 배선, 12신살 dedupe, 대운수 정수 옵션. **§3 정책 결정 후 착수. 스냅샷·코퍼스 파급 있음.**
- **PR-4 신뢰 인프라** (B1, B10, B12, 테스트): 음력 입력, 표준시/서머타임 픽스처 테스트, 조견표 단정 테스트(12운성 120칸·지장간·신살 배속), 궁통보감 120셀.
- **후속 감사**: graph/·schools 팩 전수·DSL 컴파일러·migrations, 그리고 미검증 70건의 착수 전 개별 확인 (부록 C 미감사 영역 목록).

## 5. 불변 원칙과의 정합

- 프론트 무접촉: PR-1~4 전부 lib 이하로 수행 가능 (12운성 카드 등 신규 소비처는 spring-ts report/cards 층 — lib 안).
- 등급-텍스트 정합: PR-3의 판정 변경은 `dump-report-trace` + baseline snapshot으로 before/after 필수.
- 기지 스펙 승계: seatPillars 설계(HANDOFF 작업 5-후속)는 C2와 동일 — position(=basedOn) 불변 + 새 필드 additive 원칙 유지.

---
## 부록 A. 런타임 프로브 실측 (10개 명식)

saju-ts v0.34.3 재빌드(tsc 성공) 후 spring-ts saju-adapter.analyzeSaju()를 tsx로 직접 실행, 10개 명식(구조 덤프는 4개)을 실측. SajuSummary는 정제 필드 외에 원시 saju-ts 출력(coreResult/strengthResult/yongshinResult/gyeokgukResult/weightedShinsalHits/trace 등)이 spread로 통째로 함께 노출됨. 천간관계는 합/충만 방출(극은 타입 레벨에서 불가능: StemRelationType='HAP'|'CHUNG'), 신살 hit에 matchedPillars 없음·position은 산출기준(basedOn) 매핑이라 시주(HOUR)는 구조적으로 안 나옴, 대운수는 소수(예: 5.649453236882716), 지장간·공망은 있고 12운성(sibiUnseong)은 항상 null, 납음(naeum)·12궁(palace)은 opt-in인데 켜면 require() ESM 비호환으로 전체가 emptySaju로 붕괴함.

### [a] SajuSummary 최상위 필드 구조 (4개 명식 공통, 32키)

정제 필드: pillars(년/월/일/시 stem+branch code/hangul/hanja), timeCorrection(13필드, 경도보정 -32.088분 등), dayMaster, strength(level/isStrong/totalSupport/totalOppose/득령·득지·득세/details), yongshin(element/heeshin/gishin/gushin/confidence/agreement/recommendations), yongshinConsensus(억부·조후·격국·통관·병약·식상류+final), gyeokguk(type/category/baseTenGod/confidence/reasoning/candidates 3개/jonggyeokCandidates 8개), elementDistribution, deficient/excessiveElements, cheonganRelations, jijiRelations, sibiUnseong, gongmang, tenGodAnalysis, shinsalHits, shinsalComposites, palaceAnalysis, daeunInfo, saeunPillars(30년), trace(34항목), axisStrength. 추가로 원시 saju-ts 출력이 spread로 그대로 남음: coreResult, strengthResult, yongshinResult, gyeokgukResult, ohaengDistribution, scoredCheonganRelations, resolvedJijiRelations, weightedShinsalHits, gongmangVoidBranches, hapHwaEvaluations, trace — 즉 동일 데이터가 원시+정제 이중으로 노출(차트당 JSON 약 70-74KB). 전체 덤프: 스크래치패드 saju-summary-{A..D}*.json / shape 613줄 텍스트.

### [b] 천간 극(剋) 방출 여부

10개 명식에서 cheonganRelations 타입 분포: 충 6회, 합 5회, 극 0회. 극이 뜰 만한 명식(J: 무·기·정·갑 → 갑극무 조합 존재)에서도 갑기합만 방출. 소스 레벨 확증: lib/saju-ts/src/core/stemRelations.ts:4 `export type StemRelationType = 'HAP' | 'CHUNG'` — 엔진이 극을 아예 계산하지 않음. 어댑터(saju-adapter.ts:225)와 springLegacy.ts:100에 '천간 극(剋) 관계' 라벨 매핑은 있으나 죽은 코드(도달 불가). 참고: scoredCheonganRelations는 10개 명식 모두 빈 배열.

### [c] 신살 hit의 matchedPillars / position 분포

matchedPillars 없음. shinsalHits 항목 키셋은 단일: {type, position, grade, baseWeight, positionMultiplier, weightedScore}. 원시 weightedShinsalHits[].hit도 {type, position, grade}뿐. matchedPillars는 saju-ts 모던 API(api/types.ts:430 ShinsalHitView, engine.ts:270)에만 있고 어댑터가 소비하는 legacy 브리지(springLegacy)에는 전달 안 됨. position 분포(10개 명식, 180 hit): 기타 73 / 년주 37 / 일주 35 / 월주 35 / 시주 0. 시주가 0인 이유는 구조적: springLegacy.ts:438 relationPositionFromBasedOn()이 산출기준(basedOn)을 YEAR_BRANCH→년주, MONTH_BRANCH→월주, DAY_BRANCH→일주, 그 외 전부→OTHER(기타)로 매핑 — position은 앉은 기둥(궁위)이 아니라 산출 기준이며 HOUR는 매핑 자체에 없음. positionMultiplier는 전부 1 고정.

### [d] 대운수 정밀도

소수(부동소수점 전체 자릿수)로 노출. 실측 firstDaeunStartAge: A=5.649453236882716, B=8.557002141203704, C=7.297909239969136, D=10.151051647376542, E=2.5120557291666668, F=2.1812773804012346, G=1.9511944328703705, H=4.822090162037037, I=0.18380962191358027, J=10.43157773919753. daeunInfo.pillars[].startAge/endAge도 동일한 소수 정밀도(10년 간격 누적). 정수 필드는 firstDaeunStartMonths(예: 7, 6, 3, 1)뿐. boundaryMode='midnight', isForward 불리언, 대운 기둥 10개 기본 제공.

### [e] 지장간·12운성·공망·납음 존재 여부

지장간: 있음 — tenGodAnalysis.byPosition.{year,month,day,hour}.hiddenStems[]에 {stem(한글), element, ratio(0.6/0.3/0.1)}와 hiddenStemTenGod[]{stem, tenGod} 노출. 12운성: 없음 — sibiUnseong 키는 존재하나 10개 명식 전부 null(saju-ts src 전체에 sibiUnseong 생성 코드 없음, 어댑터 extractSibiUnseong은 항상 null 반환). 공망: 있음 — gongmang=['오','미'] 형태 한글 지지 2개 + 원시 gongmangVoidBranches도 병존. 납음: 기본 없음 — precisionConfig.surfaceNaeum opt-in 필드이나 실측 결과 켜면 전체 실패(아래 참조). palaceAnalysis(12궁)도 기본 null, surfacePalace opt-in 동일하게 실패.

### [추가] surfaceNaeum/surfacePalace opt-in이 전체 결과를 붕괴시킴

격리 실험(probe-optin-naeum-palace.ts): baseline emptyFallback=false, surfaceNaeum만 켜도 emptyFallback=true, surfacePalace만 켜도 emptyFallback=true. 원인: saju-adapter.ts:1449/1506의 computePalaceSummary/computeNaeumSummary가 ESM 컨텍스트에서 정의되지 않은 require('../../saju-ts/src/index.js')를 호출(경로도 dist가 아닌 src를 가리킴) → throw → analyzeSaju의 외곽 try/catch(1388행)가 emptySaju() 반환. 즉 opt-in을 켜면 납음/12궁을 얻기는커녕 사주 분석 전체가 빈 값으로 대체됨(Node/tsx 실측; Vite 브라우저 빌드도 require 부재로 동일할 가능성 높음).

### [프로브 산출물 경로]

빌드: lib/saju-ts에서 npm run build 성공(tsc, 오류 없음). 프로브 스크립트(신규 2개, tmp 전용): F:/Projects/metaintelligence/namespring-web/lib/spring-ts/tmp/probe-saju-summary-surface.ts, F:/Projects/metaintelligence/namespring-web/lib/spring-ts/tmp/probe-optin-naeum-palace.ts. 전체 JSON/shape 덤프: C:/Users/sschoi/AppData/Local/Temp/claude/F--Projects-metaintelligence-namespring-web/1739c3eb-188b-4d56-943a-d5eed3dae13e/scratchpad/saju-summary-{A_1986-04-19_0545_M, B_1990-11-03_1420_F, C_1978-01-27_2310_M, D_2001-07-08_0900_F}.json 및 saju-summary-shape-*.txt (프로젝트 파일 수정 없음).

## 부록 B. 도메인별 전체 발견 (103건)

### 역법·시간 보정

**검증 완료 (적대적 검증 통과):**

#### [missing / high / CONFIRMED] 음력 생년월일 입력 미지원 — 음력 입력 시 사주 분석 전체 비활성화

- **현재**: birth.calendarType='lunar'이면 saju-adapter가 buildUnsupportedLunarSajuSummary로 빈 요약을 반환하고 사주 분석을 통째로 끈다(disabledReason='lunar-input-requires-kasi-conversion'). saju-ts 코어도 birth.calendar 타입이 'gregorian'뿐이고 springLegacy는 calendarType='LUNAR'면 throw한다. 음양력 변환 로직은 리포 어디에도 없다(설날 경계 계산용 진신월 코드만 존재).
- **표준**: 모든 상용 만세력(포스텔러, 원광만세력 등)은 음력(평달/윤달) 입력을 받아 양력으로 변환 후 명식을 세운다. 한국 사주 서비스에서 음력 생일 입력은 기본 기능이며, 특히 중장년층 사용자는 음력 생일만 아는 경우가 많다.
- **근거**: lib/spring-ts/src/saju-adapter.ts:1178-1180, 1088-1113; lib/saju-ts/src/compat/springLegacy.ts:1226-1228; lib/saju-ts/src/api/types.ts:19
- **권고**: KASI LrsrCldInfoService API 연동(코드 주석에 이미 명시된 경로) 또는 음양력 변환 테이블(1900~2050) 내장으로 lunar→solar 변환을 구현. 윤달(isLeapMonth) 처리 포함. 변환 결과(양력 환산일)를 summary에 노출해 사용자가 검증할 수 있게 할 것.

#### [missing / high / CONFIRMED] 한국 표준시 변천·서머타임 테이블이 코어에 없음 — Intl 런타임 tzdata에 무검증 의존

- **현재**: 1908(+8:30)/1912(+9)/1954.3.21(+8:30)/1961.8.10(+9) 자오선 전환과 서머타임(1948-51, 1955-60, 1987-88) 테이블이 코어 엔진에 전혀 없다(리포 grep에서 127.5/1912/1954/summer 관련 코드 무). 코어는 명시적 오프셋이 붙은 ISO만 그대로 신뢰하고, springLegacy만 Intl.DateTimeFormat(shortOffset)으로 출생 시각별 오프셋을 해석해 런타임 tzdata가 결과적으로 처리한다. 이 역사적 해석을 검증하는 테스트는 0건이다.
- **표준**: 표준시 변천(특히 1954-61 UTC+8:30)과 서머타임 자동 반영은 전 상용 만세력의 '공통 최소선'이자 만장일치 표준이다(해당 기간 출생자 -1시간 보정, 1954-61 구간은 30분 경도 보정 불요). 전문 서비스라면 자체 테이블 또는 최소한 tzdata 해석에 대한 고정 픽스처 회귀 테스트를 갖춘다.
- **근거**: lib/saju-ts/src/calendar/iso.ts:29-60; lib/saju-ts/src/compat/springLegacy.ts:301-327(Intl 위임), 39; lib/saju-ts/src/calendar/normalizeRequest.ts:14-16; 역사 타임존 테스트 부재는 리포 grep 무매치로 확인
- **권고**: (1) 1908/1912/1954/1961 전환점과 서머타임 14개 구간(1948-51, 1955-60, 1987-88)의 경계 전후 출생 픽스처 테스트를 추가해 Intl 해석을 고정할 것 — 경량 ICU(small-icu) Node 빌드나 오래된 tzdata에서는 Asia/Seoul 역사 오프셋이 빠져 조용히 +09:00으로 계산될 수 있음. (2) 장기적으로는 한국 표준시 변천 테이블을 코어에 내장해 springLegacy 미경유 호출(프론트가 +09:00 하드코딩 시 1954-61 출생 30분, 서머타임 기간 1시간 무경고 오차)에도 안전망을 제공할 것.

#### [bug / medium / CONFIRMED] 기본 일주 경계가 자정(midnight) — 주류 정자시설(자시 개시 시 일주 교체, 약 80%)과 다른 이설을 기본값으로 채택

- **현재**: 제품 기본값이 yaza off → dayCutMode MIDNIGHT_00 → dayBoundary='midnight'로, 일주가 (보정 후) 자정에 바뀐다. 경도 보정 기본 on(applyTo='dayAndHour')이므로 시계 기준 약 23:30~00:32 출생자의 일주가 당일로 남는다. 추가로 이 구간의 시주 천간은 당일 일간 기준 자시로 산출되어(calcHourPillar가 effective day의 일간 사용), 주류 정자시설(일주·시주 모두 익일)과도, 야자시설(일주 당일+시주 익일 일간 기준)과도 다른 조합이 나온다.
- **표준**: 실무 역술인의 약 80%가 정자시설(자시 시작 = 30분 보정 시 시계 23:30에 일주 교체)을 쓰고, 포스텔러 등 상용 만세력 기본값도 정자시 쪽이다. 즉 주류 기대값은 시계 23:30 이후 출생 시 일주·시주 모두 익일 기준.
- **근거**: lib/spring-ts/src/saju-adapter.ts:934-937(yaza 기본 off); lib/saju-ts/src/compat/springLegacy.ts:256-257, 273-284; lib/saju-ts/src/api/config.ts:11; lib/saju-ts/src/calendar/pillars.ts:27-35, 43-50; 전문 표준: 정자시설 주류 약 80%(chocosd.com/3441, pro.forceteller.com)
- **권고**: 제품 기본 dayCutMode를 YAZA_23_TO_01_NEXTDAY(엔진 ziSplit23; 경도 보정과 결합하면 시계 23:32 경계)로 바꾸는 것을 검토. 자정설(현 기본)은 존재하는 이설이므로 유지하려면 명시적 설계 선택으로 문서화하고, 자시 구간 출생자 리포트에 '일주 판정 기준' 안내를 노출할 것. 이설임을 명시: 이것은 학파 선택이지 계산 오류는 아니나, 기본값이 주류에서 벗어나 있어 타 만세력과 일주가 달라지는 대표 케이스가 된다.

#### [bug / medium / CONFIRMED] YAZA_23_30 모드의 -30분 시프트가 인스턴트 전체에 적용돼 년주(입춘)·월주(절입) 판정까지 이동

- **현재**: YAZA_23_30_TO_01_30_NEXTDAY 선택 시 dayCutShiftMinutes=-30이 입력 민간시 자체에 addMinutes로 적용되고 그 시각으로 UTC 인스턴트를 생성한다. 결과적으로 일 경계뿐 아니라 입춘·절입 경계 비교(utcMs 기준)까지 30분 당겨져, 절입 경계 ±30분 이내 출생자의 년주/월주가 바뀔 수 있다. 또한 경도 보정(기본 on, -32분)과 독립적으로 중첩되므로 두 옵션을 함께 켜면 자시 경계가 사실상 이중 보정된다.
- **표준**: 주류 표준은 '절입 비교는 KASI가 KST로 준 시각과 출생 KST 시각을 그대로 비교'하며 진태양시류 보정은 시주(및 자시 경계) 산정에만 쓴다. 엔진 자체의 trueSolarTime 경로는 applyTo 분기로 이를 올바르게 분리하고 있어(UTC 인스턴트 불변, 경계 판정용 로컬 시각만 이동) 레거시 시프트 방식과 내부 모순이다.
- **근거**: lib/saju-ts/src/compat/springLegacy.ts:262-263, 833(analysisLocal=addMinutes), 848(시프트된 시각으로 instant 생성); 대비: lib/saju-ts/src/calendar/trueSolarTime.ts:147-168 + graphFactory.ts:141-172(인스턴트 불변 원칙); 전문 표준: 절입은 KST끼리 비교가 주류(astro.kasi.re.kr FAQ)
- **권고**: -30 시프트를 인스턴트 생성이 아니라 day/hour 경계 분류용 로컬 시각 이동(trueSolarTime과 동일한 메커니즘)으로 옮길 것. 경도 보정과의 중첩은 '23:30 모드는 경도 보정 off 사용자용'임을 검증 로직 또는 문서로 강제할 것.

#### [bug / low / CONFIRMED] 1908년 4월 이전 출생(서울 LMT +08:27:52) 오프셋 파싱 실패 — 무경고 +09:00 폴백으로 약 32분 오차

- **현재**: springLegacy의 parseOffsetToken 정규식(GMT([+-])(\d{1,2})(?::?(\d{2}))?$)이 Intl이 반환하는 초 단위 오프셋 'GMT+8:27:52'에 매치 실패($ 앵커) → offsetAtUtcMs가 ?? 540으로 조용히 +09:00 폴백. 1908-04-01 이전 출생 입력 시 약 32분 오차가 경고 없이 발생한다.
- **표준**: 표준시 도입 전(~1908.3.31) 출생은 지방 진태양시(서울 LMT +8:27:52)로 처리하는 것이 역사적 사실 기준이다. 실사용자는 사실상 없으나(117세 이상) 조상 명식 조회 등 엣지 입력에서 무경고 오답은 신뢰 문제다.
- **근거**: lib/saju-ts/src/compat/springLegacy.ts:290(정규식), 312-315(?? 540 및 catch 540 폴백)
- **권고**: 정규식을 초 성분까지 확장(GMT([+-])(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?)하거나, 파싱 실패 시 540 폴백 대신 명시적 경고/에러를 반환할 것.

#### [bug / low / CONFIRMED] equationOfTime 'precise'가 엔진의 solarPrecision/aberrationModel 설정을 상속하지 않음 — 문서와 코드 불일치

- **현재**: types.ts 주석은 'precise'가 엔진의 다른 곳과 동일한 정밀도 설정을 쓴다고 주장하나, computeTrueSolarTimeCorrection이 equationOfTimeMinutesPrecise(jd)를 추가 인자 없이 호출해 항상 기본값(classical/constant)으로 계산된다. 제품이 solarPrecision='iau1980_top10'을 설정해도 EoT에는 반영되지 않는다. policy 인자가 trueSolarTime 서브트리만 받아 구조적으로 접근 불가.
- **표준**: 문서화된 계약대로 calendar.solarPrecision/aberrationModel이 EoT precise 경로에도 전파되어야 일관적이다. 실질 오차는 초 단위(시주 판정에 영향 없음)라 정합성 문제에 가깝다.
- **근거**: lib/saju-ts/src/calendar/trueSolarTime.ts:120-122 vs lib/saju-ts/src/api/types.ts:120-125(주석); lib/saju-ts/src/calendar/solar.ts:630-634(파라미터는 존재하나 사표)
- **권고**: computeTrueSolarTimeCorrection 시그니처에 calendar 정밀도 설정을 전달하도록 배선하거나, types.ts 주석을 실제 동작(classical 고정)으로 수정할 것.

#### [bug / low / CONFIRMED] 사문화 코드와 stale 주석 — calTimeAdapter 항상 throw, 배선 완료 기능을 '미배선'으로 서술

- **현재**: calTimeAdapter는 벤더링 /cal 패키지가 리포에 없어 adjustInstantWithCal이 항상 throw하는 도달 불가 코드(NONE/LMT/APPARENT 모드 전체 사문화). solar.ts는 'iau1980_full은 top10으로 폴스루'라 주장하나 실제 nutationLongitudeDegFull 호출, solarTerms.ts는 뉴턴 근찾기 'not yet wired'라 하나 graphFactory에서 배선 완료(제품이 실제 newton 사용), nutationIau1980.ts의 'no production code path' 주석도 부정확.
- **표준**: 코드와 주석의 일치. 후속 작업자가 실제 프로덕션 기본 경로(newton + iau1980_top10)를 죽은 코드로 오판하거나, 사문화된 calTimeAdapter를 살아있는 보정 경로로 오인할 위험이 있다.
- **근거**: lib/saju-ts/src/calendar/calTimeAdapter.ts:19-25, 87-96(항상 throw); lib/saju-ts/src/calendar/solar.ts:468-469(주석) vs 498-499(실호출); lib/saju-ts/src/calendar/solarTerms.ts:270-271 vs graphFactory.ts:205; lib/spring-ts/src/saju-adapter.ts:1231(제품이 newton 사용)
- **권고**: calTimeAdapter를 제거하거나 /cal 패키지를 실제 벤더링할 것. solar.ts:468-469, solarTerms.ts:270-271, nutationIau1980.ts:19-21의 stale 주석을 현행화할 것.

**미검증 (low/enrichment 위주 — 착수 전 개별 확인 필요):**

#### [missing / medium / 미검증] 야자시·조자시설(자시 분할) 미구현 — JOJA_SPLIT 옵션이 midnight으로 조용히 매핑되어 학설 의미와 다른 결과 산출

- **현재**: 야자시설의 핵심(야자시 출생: 일주는 당일 유지 + 시주 천간만 익일 일간 기준 자시)이 엔진 레벨에서 표현 불가 — 시주 천간이 항상 effective day의 일간에서 유도되므로 '일주 당일, 시간 익일 기준' 혼합 명식을 만들 수 없다. 레거시 JOJA_SPLIT 모드는 dayBoundary='midnight'로 매핑돼 MIDNIGHT_00과 완전히 동일하게 동작하며, 옵션 이름이 약속하는 자시 분할 시두법이 적용되지 않는다(무경고).
- **표준**: 야자시·조자시설은 『삼명통회』에 연원을 둔 유력 소수설로 대만 명리와 한국 현대 실용파가 채택하며, 포스텔러 등 상용 만세력이 설정 옵션으로 제공한다. JOJA_SPLIT이라는 옵션을 받는다면 야자시 출생자의 시주 천간은 익일 일간 기준이어야 한다.
- **근거**: lib/saju-ts/src/compat/springLegacy.ts:258-259(JOJA_SPLIT→midnight); lib/saju-ts/src/calendar/pillars.ts:43-50(시간 천간이 항상 effective day 일간에서 유도); 전문 표준: 야자시설 정의(postype.com/@consultsaju/post/19115380)
- **권고**: calcHourPillar에 hourStemBasis(당일/익일 일간) 개념을 도입해 dayBoundary='midnight' + 야자시 구간 시 익일 일간으로 시두하는 'jojaSplit' 모드를 엔진에 추가. 구현 전까지는 JOJA_SPLIT 입력 시 미지원 경고를 반환하거나 옵션을 제거해 조용한 오해를 막을 것.

#### [enrichment / medium / 미검증] 시간 보정 내역의 사용자 노출 부재 — dstCorrectionMinutes 항상 0 하드코딩, 적용 표준시·보정 후 시각 미표시

- **현재**: springLegacy 출력의 dstCorrectionMinutes는 항상 0으로 하드코딩된다(Intl이 서머타임을 오프셋에 녹여 계산 자체는 맞지만 '서머타임 -1시간 적용됨'이라는 정보가 산출·노출되지 않음). 1954-61 출생자의 'UTC+8:30 적용' 사실도 미노출. TrueSolarTimeCorrection의 메타데이터(standardMeridianDeg, formula, method)는 report.facts/trace에만 있고 summary에는 시간 보정 뷰 자체가 없다. 24절기 시각 72개도 계산·캐시되지만 미노출.
- **표준**: 상용 만세력은 '서머타임 자동 보정', '보정 후 시각(예: 입력 13:00 → 보정 12:28)'을 명시해 신뢰를 확보한다. 1987-88년생(현재 30대 후반, 핵심 고객층)은 서머타임 보정 여부를 직접 확인하고 싶어하는 대표 집단이다.
- **근거**: lib/saju-ts/src/compat/springLegacy.ts:1121(dst=0 하드코딩), 1122-1123; lib/saju-ts/src/graph 경유 report.facts['time.trueSolarCorrection']만 존재, summary 시간 항목 부재(engine.ts:115-289); lib/saju-ts/src/calendar/solarTerms.ts:370-390(계산되나 미노출)
- **권고**: summary에 시간 보정 카드를 추가: 적용 표준시(자오선/오프셋), 서머타임 반영 여부와 량, 경도 보정 분, 균시차 분, 최종 보정 시각. dstCorrectionMinutes는 출생 시각의 tzdata 오프셋과 표준 오프셋 차이로 실제 계산해 채울 것. 절입일 출생자에게는 '입춘 N시간 후 출생' 같은 절기 근접 안내도 가능(이미 계산된 solarTermsAround 활용).

#### [missing / medium / 미검증] 진태양시·일/시주 경계의 end-to-end 검증 테스트 전무

- **현재**: 경도 보정이 켜졌을 때 시주/일주가 실제로 바뀌는지 확인하는 엔진 경유 테스트가 0건이다. applyMinuteOffsetToLocalDateTime 단위 테스트 0건, effectiveDayDate/ziSplit23/calcHourPillar 직접 테스트 0건(pillars.test.ts는 throw 검증 1건뿐), 역사적 타임존/서머타임 해석 테스트 0건. 절기 정밀도(KASI 대비 1.2분)는 잘 검증된 것과 대조적으로, 정작 사용자 명식을 30분~1시간 단위로 바꾸는 시간 보정 계층이 무검증이다.
- **표준**: 시간 보정은 자시 경계 부근 출생자의 시주·일주를 통째로 바꾸는 최고 감도 경로이므로, 만세력 구현체는 경계 전후 1분 픽스처(예: 서울 23:29/23:31, 23:59/00:01)로 회귀를 고정하는 것이 표준적 품질 관행이다.
- **근거**: grep: applyMinuteOffsetToLocalDateTime 참조 테스트 0건; lib/saju-ts/src/calendar/pillars.test.ts:4-5(단일 테스트); lib/saju-ts/tests/precision/eot/EotPrecise.test.ts(보정량 단위 테스트만); Kasi2026Pillars.test.ts:30-45(정오 고정, 시주 미검증)
- **권고**: 경계 픽스처 테스트 추가: (1) 경도 보정 on/off × 자시 경계 전후 출생의 시주/일주, (2) ziSplit23 vs midnight 일주 차이, (3) 1954/1961/1987 전환점 전후 출생의 오프셋 해석, (4) YAZA_23_30 모드의 절입 경계 영향(위 bug 수정 후 회귀 방지).

#### [missing / low / 미검증] saju-ts 코어 기본값이 전면 무보정 — 제품 경로만 경도 보정 on으로 주류 정렬

- **현재**: saju-ts defaultConfig는 trueSolarTime={enabled:false, equationOfTime:'off', applyTo:'hourOnly'}로 전부 꺼져 있고 school preset들도 시간 설정을 건드리지 않는다. spring-ts 어댑터가 제품 기본으로 경도 보정 on(EoT off, applyTo='dayAndHour')을 주입해 주류 표준(경도 -30분대 보정, 균시차 생략)과 정렬시키므로 프로덕션 경로는 문제없으나, saju-ts를 직접 호출하는 경로(도구, 테스트, 미래 호출자)는 무보정 명식이 기본이 된다.
- **표준**: 한국 실무 주류는 경도 보정(서울 -32분) 적용이 표준이고 상용 만세력 다수가 지역시 보정을 기본 또는 기본 옵션으로 제공한다. 균시차 생략은 주류와 일치하므로 현 제품 기본(경도 on + EoT off)이 정확히 최빈 관행이다.
- **근거**: lib/saju-ts/src/api/config.ts:17-21; src/schools에 trueSolarTime 매치 없음(grep); lib/spring-ts/src/saju-adapter.ts:931-949(제품 기본 경도 on); lib/saju-ts/src/compat/springLegacy.ts:804(applyTo='dayAndHour')
- **권고**: korean 계열 school preset에 trueSolarTime 기본값(enabled+applyTo)을 포함시켜 코어 직접 호출도 주류 기본을 갖게 하거나, 최소한 defaultConfig 문서에 '제품 기본과 다름'을 명시할 것.

#### [enrichment / low / 미검증] location.lat/altitudeM 입력을 받지만 어떤 계산에도 미사용

- **현재**: SajuRequest.location이 lat, altitudeM을 받지만 진태양시 계산은 lon만 사용하고 lat/altitudeM은 리포 전체에서 소비처가 없다. API 표면이 실제보다 정밀한 인상을 준다.
- **표준**: 명리 시간 보정에서 위도·고도는 실제로 불필요하다(경도만 유효)는 것이 주류이므로 계산상 문제는 없다. 다만 받는 입력은 문서화하거나(향후 일출·일몰 기반 기능 예약 등) 제거하는 것이 정직한 API다.
- **근거**: lib/saju-ts/src/api/types.ts:24-29; lib/saju-ts/src/calendar/trueSolarTime.ts:103-104(lon만 사용); altitudeM 소비처 grep 무매치
- **권고**: types.ts에 'lat/altitudeM은 현재 미사용(예약 필드)'을 명시하거나 필드를 제거할 것.

### 기둥 산출·대운/세운

**검증 완료 (적대적 검증 통과):**

#### [missing / high / PARTIAL] 정수 대운수(전통 반올림 유파) 표기 옵션 부재 — 상용 만세력과 ±1세 상시 불일치

- **현재**: 대운수가 항상 연속 부동소수점 년(Δdays/3)으로만 산출된다. StartAgeMethodSpec은 threeDaysOneYear/oneDayFourMonths/커스텀 비율뿐이며 반올림·절사·올림 규칙을 표현할 필드가 전혀 없다 (lib/saju-ts/src/fortune/compute.ts:61-105, lib/saju-ts/src/fortune/types.ts:14-26). 대운수 최소 1 관행(몫 0이면 1)도 없음.
- **표준**: 한국 실무 다수 관행은 표기용 대운수를 정수로 반올림한다: 나머지 1일 버림·2일 올림(사실상 반올림), 또는 삼명통회 계열 '8개월 초과 올림'(사주매니아 FAQ 명시 채택). 정밀파는 연속 환산을 병행하되 '정수 대운수 + 교운일'을 이원 표기하는 것이 사실상 표준이다 (출처: kns.tv/news/articleView.html?idxno=69242, sajumania.com/info/faq.php).
- **근거**: lib/saju-ts/src/fortune/compute.ts:74 (years = deltaDays/daysPerYear, 이후 반올림 없음), lib/saju-ts/src/fortune/types.ts:14-26 (rounding 표현 불가), grep round|ceil → compute.ts:69(표기 분해용)·:180(ms 반올림)·:246(스팬 계산)뿐
- **권고**: startAgeMethod에 rounding 필드(예: 'round1down2up' | 'threshold8months' | 'floor' | 'ceil' | 'none')와 minStartAge(기본 1) 옵션을 추가하고, FortuneStart에 정수 대운수(startAgeDisplay)를 연속값과 병기하라. 기본 표기값은 다수 관행(반올림)으로 두고 연속값은 정밀 필드로 유지하면 이원 체제 표준과 합치한다. 연속 모델 자체는 정밀파와 동치이므로 계산 오류(bug)는 아니지만, 사용자가 어떤 상용 만세력과 비교해도 대운 나이가 어긋나는 현재 상태는 신뢰 손상이 크다.
- **검증 정정**: 정정: (a) 불일치는 '상시 ±1세'가 아니라 절입 델타 일수 mod 3 == 2인 사주(약 1/3)에서만 반올림 유파 만세력 대비 -1세(엔진 floor가 1 작음)이며, 절사 유파 도구와는 항상 일치한다. (b) FortuneStart.startAgeParts(AgePartsApprox)가 floor 정수 연수+개월+일 분해를 이미 제공하고 compat이 firstDaeunStartAge/firstDaeunStartMonths로 노출하므로 '이원 표기 부재'가 아니라 '반올림 유파 선택 불가 + 정수화 규칙의 비정책화(소비자별 Math.floor 산재)'가 정확한 결함 기술이다. (c) minStartAge 부재는 사실이나 출생이 절입 3일 이내인 드문 케이스에서만 0세 표기가 발생한다. 심각도는 high보다 medium이 적정: 표기는 이미 정수이고, 다수 유파 대비 어긋나는 것은 사주의 약 1/3에서 1세 차이다. 권고안(startAgeMethod에 rounding 필드 + minStartAge + startAgeDisplay 병기)은 타당하다.

#### [bug / medium / CONFIRMED] yearBoundary가 'jan1'/'lunarNewYear'일 때 연주와 세운의 내부 모순

- **현재**: 세운 첫 해(baseSolarYear) 보정은 calendar.yearBoundary==='liChun'일 때만 수행되는데 (compute.ts:224), 각 세운 구간의 start/end는 무조건 입춘 시각이다 (compute.ts:229-230). 비-입춘 년경계 설정에서는 연주(자연년/음력설 기준)와 세운 라벨·구간(입춘 기준)이 같은 리포트 안에서 어긋날 수 있다.
- **표준**: 세운 경계 자체는 입춘 절입시각설이 압도적 주류이므로 입춘 고정은 타당하다 (출처: chocosd.com/3399). 그러나 한 엔진 안에서 연주 산출 기준과 세운 연도 라벨 기준이 조용히 갈리는 것은 내부 모순이며, 전문가가 보면 '출생 연주는 계해년인데 세운 첫 해가 갑자년'식 불일치를 오류로 지적할 것이다.
- **근거**: lib/saju-ts/src/fortune/compute.ts:224 (calendar.yearBoundary==='liChun' 조건부 보정), :229-230 (경계는 항상 getLiChunUtcMs)
- **권고**: 비-liChun yearBoundary에서도 세운 base year 판정을 동일 기준으로 정합화하거나, 최소한 '세운은 항상 입춘 기준'임을 문서화하고 비-liChun 설정과 조합 시 경고/트레이스를 남겨라. 기본 설정(liChun)에서는 발현되지 않으므로 severity는 medium.

#### [bug / low / CONFIRMED] jie 경계 부재 폴백이 조작된 LICHUN 경계값을 반환

- **현재**: jieBoundariesAround가 null이면 FortuneStart.boundary에 id='LICHUN', utcMs=출생시각을 채워 반환한다 (compute.ts:156-168). 실제 입춘 시각이 아닌 조작(fabricated) 값이며, deltaMs=0·startAgeYears=0으로 decades/years는 빈 배열이다. formula 문자열 외에는 이 값이 가짜임을 알 방법이 없다.
- **표준**: 폴백이라도 존재하지 않는 절기 시각을 실측처럼 채우면 안 된다. 다운스트림이 boundary.utcMs를 실제 입춘으로 오독하면 잘못된 표기·통변으로 이어진다.
- **근거**: lib/saju-ts/src/fortune/compute.ts:156-168 (boundary: { id: 'LICHUN', utcMs: parsedUtcMs })
- **권고**: boundary를 optional/null로 두거나 명시적 sentinel(예: boundary: null + reason 필드)로 바꿔라. 년주/월주는 경계 부재 시 throw하는 것과 대비되는 비일관 처리이기도 하다 (pillars.ts:77-79, :160).

**미검증 (low/enrichment 위주 — 착수 전 개별 확인 필요):**

#### [missing / medium / 미검증] 교운(交運) 시작 일시의 정밀 산출·표기 부재

- **현재**: 기운 시점은 startUtcMsApprox = 출생 + 소수년 × 평균태양년(365.2425일)로만 계산되며 코드 주석에 'for UI only'로 명시된 근사값이다 (compute.ts:179-180). axis 기본값 'ageOnly'에서는 대운별 절대시각(startUtcMs/endUtcMs)이 아예 계산되지 않고 (policy.ts:14, compute.ts:213-217), startAgeParts의 Y/M/D 분해도 월×30일 근사 반올림 리포팅 전용이다 (compute.ts:64-71).
- **표준**: 정밀 지향 상용 만세력(사주매니아 등, NASA JPL DE431급 절입시각)은 '출생일시 + 환산기간(1일=4개월·1시간=5일)' = 교운 시작 일시를 대운수와 별도 병기한다. 전통 환산은 360일/년 기준이므로 평균태양년(365.2425일) 곱과는 일자가 어긋난다 (출처: sajumania.com/info/faq.php, m.cafe.daum.net/52074184/Sra7/7).
- **근거**: lib/saju-ts/src/fortune/compute.ts:179-180 ('// for UI only', AVG_DAYS_PER_YEAR 곱), :213-217 (axis='utcByGregorianYear'일 때만 절대시각), lib/saju-ts/src/fortune/policy.ts:14 (기본 ageOnly)
- **권고**: FortuneStart에 명리식 교운 일시(출생 UTC + deltaMs×120 등 1일=4개월 직접 환산, 360일 관례 기준)를 1급 필드로 추가하고 요약에 노출하라. 이후 대운 교체 시점도 '교운일 기점' vs '해당 나이 입춘 통일' 관행 중 하나를 정책으로 명시하면 좋다.

#### [missing / medium / 미검증] 대운 나이 표기 체계(만나이 vs 세는나이/허세수) 선택 불가

- **현재**: 대운·세운 나이가 출생 시점 기점의 연속 경과년(만나이 계열)으로만 노출된다 (compute.ts:202-203 startAge+10i, :138-140 approxAgeYears). 세는나이(허세수) 표기 옵션이나 표기 기준 메타데이터가 없다.
- **표준**: 이론파(위키백과·brunch saju6969)는 만나이, 전통 만세력·삼명통회 계열(사주매니아 FAQ '허세수 기준 출력', 포스텔러)은 세는나이를 쓰는 이설 병존 상태이며, 앱 간 1~2세 차이가 상존한다. 어느 쪽도 bug는 아니지만 표기 기준을 선택·명시할 수 있어야 타 만세력과의 비교 혼선을 흡수한다.
- **근거**: lib/saju-ts/src/fortune/compute.ts:202-203, :138-140; 출처: sajumania.com/info/faq.php, ko.wikipedia.org/wiki/대운_(사주팔자), dmitory.com/occult/316292734 (앱 간 혼선 사례)
- **권고**: ageDisplay: 'continuousFromBirth'(현행) | 'koreanCountingAge' 옵션을 추가하고, 출력에 어떤 기준인지 라벨을 남겨라. 학파 이설이므로 설계 선택이지만, 현재는 선택지 자체가 없고 기준이 미문서화라는 점이 갭이다.

#### [missing / medium / 미검증] 야자시(夜子時) 시간(時干)을 익일 일간으로 세우는 학파 분기 표현 불가

- **현재**: pillars.hour가 pillars.day의 stem에 직접 의존하므로 (graphFactory.ts:321-334), dayBoundary='midnight'에서 23:00~24:00 출생은 일주 당일 유지 + 시간(時干)도 '당일 일간' 기준 子시로만 세워진다. 야자시에서 時干만 익일 일간 기준으로 세우는 유파(일진은 당일 유지)는 어떤 설정 조합으로도 재현 불가.
- **표준**: 야자시/조자시 구분파는 23시대 출생 시 일진은 당일로 두되 시주는 다음 날 자시(익일 일간의 甲子 등)로 처리한다. 상용 만세력 다수가 야자시 옵션을 제공하는 것이 관행이다 (출처: namu.wiki/w/사주팔자 자시 처리 이설). 학파 이설이므로 bug는 아니나, 옵션 제공이 관행인 분기를 아예 표현할 수 없는 것이 갭이다.
- **근거**: lib/saju-ts/src/graph/graphFactory.ts:321-334 (pillars.hour ← pillars.day.stem), lib/saju-ts/src/calendar/pillars.ts:27-35 (midnight 시 h=23이어도 당일), :43-50 (시두법이 전달받은 일간만 사용)
- **권고**: hourStemDayBasis: 'sameDay'(현행) | 'nextDayInLateZi' 정도의 설정을 추가해 야자시파를 재현 가능하게 하라. 시주 계산 시 23시대 여부와 익일 일간을 함께 전달하면 그래프 구조 변경은 국소적이다.

#### [missing / low / 미검증] 일진·자시 경계의 한국 통설(23:30 KST) 재현이 기본 설정으로 불가

- **현재**: 일 경계는 midnight(00:00, 기본) 또는 ziSplit23(23:00 표준시)뿐이고 trueSolarTime은 기본 꺼짐이다 (config.ts:11,17-21; pillars.ts:27-35; compute.ts:111-124의 일운 경계도 동일). ziSplit23+trueSolarTime(dayAndHour)을 켜면 한국에서 약 23:30 경계에 근사하지만 기본값이 아니고 문서화도 없다.
- **표준**: 한국 표준시(동경 135도) 기준 일진 경계는 태양시 보정 약 30분을 적용한 23:30으로 보는 것이 통설이며 상용 만세력 대부분이 23:30 경계 또는 야자시 옵션을 제공한다. 다만 00:00파·23:00파도 존재하는 이설 영역이므로 현행이 오류는 아니다 (출처: namu.wiki/w/사주팔자).
- **근거**: lib/saju-ts/src/api/config.ts:11,17-21, lib/saju-ts/src/calendar/pillars.ts:27-35, lib/saju-ts/src/fortune/compute.ts:111-124
- **권고**: 한국 사용자 대상 프리셋(ziSplit23 + trueSolarTime dayAndHour)을 school pack이나 문서로 제공하고, 기본값과 통설의 차이를 명시하라. 이설임을 감안해 severity는 low.

#### [missing / low / 미검증] 소운(小運) 미지원 — 단, 주류 실무도 미채택

- **현재**: 소운(대운 접속 전 유년운, 시주 기준 순역 1년 1간지)이 코드베이스 어디에도 없다. FortuneTimeline 구조는 start/decades/years/months?/days?뿐 (fortune/types.ts:146-153, grep '소운|xiaoyun|smallLuck|minorLuck' 0건).
- **표준**: 고전(삼명통회 계열)에 소운법이 있으나 현대 한국 실무는 거의 채택하지 않고 대운 전 구간을 세운으로 대체한다(낭월: '심심풀이용'). 상용 만세력도 대부분 미표기 (출처: nangwol.com uid=440, ko.wikipedia.org/wiki/대운_(사주팔자)).
- **근거**: lib/saju-ts/src/fortune/types.ts:146-153, lib/saju-ts 전체 grep 0건
- **권고**: 주류 정합 관점에서 현행 미지원은 타당하다. 다만 '대운 시작 전 구간은 세운으로 본다'는 정책을 문서/트레이스에 명시하면 첫 대운 이전 나이 질의에 대한 답변 품질이 좋아진다. 구현 우선순위는 낮음.

#### [enrichment / low / 미검증] 일운 인프라 완비 상태에서 기본 비활성(maxDays=0)

- **현재**: 일운 계산(dayBoundary 반영 경계, 연속 일주)이 완전히 구현되어 있으나 maxDays 기본 0이라 기본 설정에서는 계산 자체가 스킵된다 (policy.ts:13, compute.ts:285-305, engine.ts:219 slice(0,60) 배관까지 존재).
- **표준**: 상용 서비스에서 일운은 '오늘의 운세'류 콘텐츠의 근거로 쓰인다. 실무 통설상 일운 통변의 신뢰도는 낮게 보지만, 데이터 자체는 확정적 산술이므로 제공에 리스크가 없다.
- **근거**: lib/saju-ts/src/fortune/policy.ts:13, lib/saju-ts/src/fortune/compute.ts:285-305, lib/saju-ts/src/api/engine.ts:219
- **권고**: 일 단위 콘텐츠(오늘/이번 주 운세) 기획이 있다면 maxDays를 켜기만 하면 된다. 미사용이라면 현행 유지도 무방 — 순수 활용 기회.

#### [enrichment / low / 미검증] 세운 120년 계산 완료분이 summary에서 30년으로 절단, 대운 절대시각은 기본 미노출

- **현재**: 세운은 120년 전량 계산되지만 summary에는 slice(0,30)만 노출되고 전체는 report.facts['fortune.timeline']에만 남는다 (engine.ts:201, :305-306 부근). 대운의 startUtcMs/endUtcMs는 axis 기본 'ageOnly'라 계산조차 되지 않아 나이만 노출된다 (compute.ts:213-217, policy.ts:14).
- **표준**: 중장년 사용자의 '내 60대 대운/세운' 질의나 평생 타임라인 UI에는 30년 절단이 부족하며, 대운을 달력 시점으로 매핑해 보여주는 것이 상용 만세력 표준 표현이다.
- **근거**: lib/saju-ts/src/api/engine.ts:201 (years.slice(0,30)), lib/saju-ts/src/fortune/compute.ts:213-217 (axis 조건부), lib/saju-ts/src/fortune/policy.ts:14
- **권고**: summary 노출 폭을 소비자(리포트 생성기)가 정책으로 정하게 하거나, 최소한 facts 경로를 통해 전량 접근 가능함을 다운스트림 계약으로 문서화하라. 대운 절대시각은 finding 2(교운일 정밀화)와 함께 해결하면 axis 근사(addYearsUtc)도 개선된다.

#### [enrichment / low / 미검증] 성별 미상(U) 시 대운 방향 무조건 FORWARD 폴백이 미문서·미트레이스

- **현재**: directionRule 기본값에서 sex가 'M'/'F'가 아니면 조건 없이 FORWARD를 반환하며 (compute.ts:39-42), 이 선택이 문서에도 formula 트레이스에도 남지 않는다.
- **표준**: 양남음녀 규칙은 성별이 필수 입력이다. 성별 미상 시의 처리는 어느 학파에도 표준이 없으므로 폴백 자체는 설계 선택이지만, 감명 결과의 절반(대운 전체 방향)을 좌우하는 무언 폴백은 트레이스에 남아야 한다.
- **근거**: lib/saju-ts/src/fortune/compute.ts:39-42 (sign 계산 전 M/F 외 입력의 암묵 처리 — sex==='M'?1:-1 로 U가 여성 취급되는 경로 없이 directionRule별 상위에서 FORWARD 폴백; 코드 실태 조사 compute.ts:39 참조)
- **권고**: FortuneStart.formula 또는 별도 필드에 'direction=FORWARD (sex unknown fallback)' 류의 근거를 기록하고, 리포트 레벨에서 성별 미입력 시 대운 신뢰도 경고를 노출하는 것을 검토하라.

### 명식 핵심 요소(지장간·십신·12운성·궁위)

**검증 완료 (적대적 검증 통과):**

#### [bug / high / CONFIRMED] palace.ts 본기(정기) 지장간 선택 오류 — 여기(RESIDUAL)를 본기로 집음

- **현재**: lib/saju-ts/src/core/palace.ts:132 `const main = hidden[hidden.length - 1]?.stem ?? hidden[0]!.stem;` — 배열의 마지막 원소를 정기로 가정한다. 그러나 rawHiddenStemsTable(lib/saju-ts/src/core/hiddenStems.ts:59-77)은 순서가 [MAIN, MIDDLE, RESIDUAL]로 본기가 index 0이다. 따라서 2~3장간 지지 9개(丑寅辰巳午未申戌亥)에서 여기를 본기로 잘못 선택한다. 예: 寅궁 본기=戊(정답 甲), 午궁=己(정답 丁), 亥궁=甲(정답 壬). mainTenGod→isGilshin→status(good/caution)가 연쇄 오판되어 surfacePalace 옵트인 경로 전체가 오염된다.
- **표준**: 만세력·실무 표준은 지지 대표 십신을 정기(본기) 지장간 기준으로 표기한다(예: 일간 甲 + 寅 → 정기 甲 기준 비견). 같은 리포지토리의 rules/facts.ts:2483-2485는 `hs.find(h => h.role === 'MAIN')`으로 올바르게 처리하고 있어 내부 모순이기도 하다.
- **근거**: lib/saju-ts/src/core/palace.ts:132 (직접 재확인); lib/saju-ts/src/core/hiddenStems.ts:59-77 (직접 재확인); lib/saju-ts/src/rules/facts.ts:2483-2485 (올바른 대비 사례); 표준: 만세력 지지 십신 표기는 정기 기준 (sajustudy.com/31, chocosd.com 지장간 강의)
- **권고**: palace.ts:132를 `hidden.find(h => h.role === 'MAIN')` 방식으로 수정하고, 12지지 전체의 mainHiddenStem 기대값(子癸 丑己 寅甲 卯乙 辰戊 巳丙 午丁 未己 申庚 酉辛 戌戊 亥壬)을 고정하는 단위 테스트를 추가. 현재 palace 전용 테스트 0건이라 이 버그가 잡히지 않았다.

#### [enrichment / high / PARTIAL] 12운성이 기본 계산되지만 legacy 변환에서 통째로 버려져 SajuSummary.sibiUnseong 항상 null

- **현재**: lifeStages 토글 기본 true로 엔진이 4지지 12운성을 항상 계산해 bundle.summary.lifeStages에 싣는다(lib/saju-ts/src/api/engine.ts:159-161). 그러나 compat/springLegacy.ts에는 lifeStage/unseong/sibiUnseong 참조가 0건(grep 재확인)이라 legacy 출력으로 매핑되지 않고, spring-ts saju-adapter.ts:2003의 extractSibiUnseong은 rawSajuOutput.sibiUnseong 키를 기대하지만 그 키는 절대 방출되지 않아 SajuSummary.sibiUnseong이 무조건 null이다.
- **표준**: 12운성(화토동궁+음간역행 조견표)은 한국 만세력 앱의 표준 표기 요소다. 엔진이 이미 주류 방식(FOLLOW_FIRE + 양생음사)으로 정확히 계산하고 있으므로 리포트까지 흘러야 한다.
- **근거**: grep 'sibiUnseong|lifeStage|unseong' in lib/saju-ts/src/compat/springLegacy.ts → 0건 (직접 재확인); lib/spring-ts/src/saju-adapter.ts:1425,2003-2007 (직접 재확인); lib/saju-ts/src/api/engine.ts:159-161; 표준: 12운성 조견표는 만세력 표준 표기 (ko.wikipedia.org/wiki/십이운성)
- **권고**: springLegacy.ts에 summary.lifeStages.pillars → sibiUnseong 매핑을 추가(4기둥 지지별 운성). extractSibiUnseong(saju-adapter.ts:2002-2010)이 기대하는 형태(Map 또는 객체)에 맞추면 어댑터 수정 없이 연결된다. 계산 완료·주류 방식 준수·소비처까지 이미 존재하는데 배관 한 구간만 끊긴 대표 사례.
- **검증 정정**: 기계적 결함(springLegacy가 lifeStages→sibiUnseong를 매핑하지 않아 SajuSummary.sibiUnseong이 무조건 null)은 실제 산출물로 확정된 사실이다. 다만 두 가지를 정정한다: (a) 하류 소비처가 '이미 존재'하지 않는다 — 코드베이스에 SajuSummary.sibiUnseong을 읽어 리포트/카드로 렌더링하는 소비자가 0건이다(유일 참조는 값을 세팅하는 saju-adapter.ts뿐). life-stage-fortune-card.ts는 십이운성이 아닌 대운 시기별 운세 카드로 무관하다. (b) 따라서 권고대로 springLegacy에 pillars→sibiUnseong 매핑 한 줄만 추가하면 SajuSummary.sibiUnseong은 채워지지만 그것만으로 십이운성이 어떤 리포트에도 노출되지 않는다. 십이운성을 실제로 표기하려면 매핑 배관 + 이를 소비해 카드/글로 렌더링하는 소비처 신설이 함께 필요하다. 결과적으로 severity는 high가 아니라 렌더러 부재를 감안한 medium 수준(현재 유저 노출 영향 없음)이 적절하다.

#### [bug / medium / CONFIRMED] saryeongScheme 활성화 시 지장간 배열 순서 반전으로 지지 대표 십신이 여기(餘氣) 기준으로 바뀜

- **현재**: wollyul.ts:174-178의 hiddenStemsForChart는 saryeongScheme 설정 시 WOLLYUL_SEGMENTS 순서(CHO→JUNG→JEONG, 정기가 마지막)를 그대로 반환하는데, 정적 표는 MAIN이 첫 번째다. springLegacy.ts:1010,1022의 jijiPrincipalSipseong은 첫 원소를 지지 대표 십신으로 쓰므로, 옵트인 시 대표 십신이 정기가 아닌 여기 기준이 된다(예: 子의 대표 간이 癸→壬). 같은 데이터의 '첫 원소' 의미가 설정에 따라 정반대가 되는 내부 모순.
- **표준**: 만세력·실무 표준은 지지 십신 표기를 정기(본기) 기준으로 한다. 사령 스킴은 가중치 배분 문제이지 정기 정의를 바꾸는 것이 아니다.
- **근거**: lib/saju-ts/src/core/wollyul.ts:174-178; lib/saju-ts/src/core/wollyulData.ts:34-92 (CHO가 첫 번째, 직접 재확인); lib/saju-ts/src/compat/springLegacy.ts:1010,1022; 표준: 지지 십신 표기는 정기 기준 (sajustudy.com/31)
- **권고**: hiddenStemsForChart 반환 시 role 필드를 부여하거나 정기-우선 순서로 정렬해 하류의 '첫 원소=본기' 가정과 일치시키고, 하류 소비처는 위치가 아닌 role로 정기를 찾도록 통일. 두 표(rawHiddenStemsTable vs WOLLYUL)의 순서 계약을 문서화+테스트로 고정.

#### [bug / medium / CONFIRMED] 12운성 EarthLifeStageRule 'INDEPENDENT'가 선언만 되고 미구현 — 조용히 화토동궁으로 동작

- **현재**: lifeStage.ts:19에 타입으로 선언되고 설정 검증(graphFactory.ts:62, facts.ts:2582)도 유효값으로 통과시키지만, lifeStage.ts:70-72에서 'INDEPENDENT defaults to FOLLOW_FIRE for now'로 FOLLOW_FIRE 표를 그대로 반환한다. 사용자가 명시 지정해도 경고·에러 없이 화토동궁 결과가 나온다.
- **표준**: 지원하지 않는 설정값은 타입에서 제거하거나 명시적 에러/경고를 내야 한다. 참고로 주류는 화토동궁(연해자평 계열)이고 수토동궁(명리정종)은 소수설이므로 기본값 자체는 주류에 부합한다 — 문제는 침묵 폴백뿐.
- **근거**: lib/saju-ts/src/core/lifeStage.ts:19,70-72; lib/saju-ts/src/graph/graphFactory.ts:62; lib/saju-ts/src/rules/facts.ts:2582; 표준: 화토동궁이 주류, 수토동궁 소수설 (ko.wikipedia.org/wiki/십이운성, gobooki.net)
- **권고**: INDEPENDENT를 타입에서 제거하거나, 설정 검증 단계에서 '미구현' 경고를 방출. 구현할 계획이면 戊·己 독립 장생지 표를 추가하고 10천간×12지지 120칸 조견표 단위 테스트로 고정(현재 lifeStage 전용 테스트 0건).

#### [bug / low / CONFIRMED] wollyulData.ts 午 중기 일수가 주류 두 변형(10-9-11, 10-10-10) 어느 쪽도 아닌 10-10-11(합 31)이고 해설 주석이 자기모순

- **현재**: wollyulData.ts:63-67의 午 = 丙10·己10·丁11로 합이 31일이며(직접 재확인), 주석은 '午의 특수: 31일이 아니라 31일'로 오타로 무의미하다. findSaryeong의 classical 스킴에서 午만 nominal 합이 31이 된다. 출전 주석은 삼명통회/연해자평 계열이라 주장한다.
- **표준**: 주류 표는 丙10·己9·丁11(합 30, 위키백과 계열) 또는 丙10·己10·丁10(합 30, 1:1:1 배분파)이다. 고서별 일수 편차가 존재하는 영역이라 31일 배분 자체가 고전에 없다고 단정할 수는 없으나, 합 30 규약을 깨는 유일한 지지인데 근거 설명이 오타로 사라져 검증 불가 상태다.
- **근거**: lib/saju-ts/src/core/wollyulData.ts:63-67 (직접 재확인, '31일이 아니라 31일' 주석); 표준: 午 배분은 10-9-11 (ko.wikipedia.org/wiki/지장간) 또는 10-10-10 (chocosd.com) — 어느 쪽도 합 30
- **권고**: 출전(saju_master v9.2 → 三命通會 원문)을 재확인해 의도된 배분인지 검증하고, 주석을 '丙10+己10+丁11=31일로 유일하게 30일을 초과하는 특수 케이스'로 정정. scaled 스킴이 이미 실제 월 길이 비례라 영향은 classical 스킴의 午월 경계일에 국한된다.

**미검증 (low/enrichment 위주 — 착수 전 개별 확인 필요):**

#### [missing / medium / 미검증] core 명식 요소 정답표 단위 테스트 전무 — 12운성 120칸, 십신 100쌍, 공망 6순, palace/naeum 0건

- **현재**: 전용 테스트는 wollyul 2개 파일(HiddenStemSchemeCompat, SaryeongClassical)뿐. golden.test.ts는 엔진 출력 스냅샷 동결이라 '처음부터 틀린 값'(palace 본기 버그 같은)은 검출 불가. analyzePalaces/analyzeNaeum은 saju-ts·spring-ts 어느 테스트에서도 호출되지 않는다.
- **표준**: 12운성 조견표(위키백과 등에 정답표 공개), 십신 10×10 매트릭스, 공망 6순×2지, 지장간 12지지 표는 모두 외부 정답표가 존재하는 결정적 계산이라 전수 테이블 테스트가 가능하고 관례적이다.
- **근거**: lib/saju-ts/tests/precision/wollyul/ (유일한 전용 테스트); lib/saju-ts/src/golden.test.ts:41-53; grep 'analyzePalaces|analyzeNaeum' in tests → 0건; 정답표 출처: ko.wikipedia.org/wiki/십이운성 조견표 전문
- **권고**: 외부 표준표(화토동궁 12운성 조견표, 월률분야표, 순중공망표)를 픽스처로 옮겨 전수 비교 테스트 추가. palace 버그가 이미 증명했듯 스냅샷만으로는 최초 오답을 못 잡는다.

#### [enrichment / medium / 미검증] surfacePalace/surfaceNaeum 옵트인해도 최종 리포트 카드가 소비하지 않음 — 죽은 기능

- **현재**: precisionConfig.surfacePalace/surfaceNaeum을 켜면 saju-adapter가 analyzePalaces/analyzeNaeum을 lazy import로 호출해 SajuSummary.palace/naeum을 채우지만(saju-adapter.ts:1372-1385,1445-1530), lib/spring-ts/src/report/** 전체에서 .palace/.naeum 참조가 0건이라 최종 리포트 어디에도 노출되지 않는다. 게다가 naeum.ts:10-11 주석은 'SummaryReport.naeum is optional'이라 하나 실제 SummaryReport(api/types.ts:189-239)에 해당 필드가 없고, 엔진 그래프·토글 체계를 우회한 상대경로 require 구조다.
- **표준**: 옵트인 플래그를 켜면 결과물이 사용자에게 도달해야 한다. 납음은 '자평학 보조 참고' 수준이지만 60갑자 표가 완비돼 있고, 근묘화실 4궁 해석은 초년~말년 스토리텔링 소재로 리포트 풍성화 가치가 있다.
- **근거**: lib/spring-ts/src/saju-adapter.ts:1372-1385,1445-1530; grep '.palace|.naeum' in lib/spring-ts/src/report/** → 0건; lib/saju-ts/src/core/naeum.ts:10-12 vs lib/saju-ts/src/api/types.ts:189-239
- **권고**: palace 버그(finding 1) 수정을 전제로, 4궁 해석을 소비하는 리포트 카드를 추가하거나 옵트인 플래그·데드코드를 정리. naeum.ts 주석과 실제 타입의 불일치도 함께 정정.

#### [missing / low / 미검증] 명궁(命宮)·태원(胎元) 계산 전무

- **현재**: saju-ts 전체에 명궁/태원 계산 코드가 없다. 유일한 언급은 palace.ts:121-124의 '완전 12궁(명궁/재백궁/...)은 이번 포트에 미포함' 주석뿐(grep 재확인). 현 palace 모듈은 명궁이 아니라 근묘화실 4궁 해석이다.
- **표준**: 명궁은 중기(中氣) 기준 14/26 공식(명궁지지 = 14-(월+시) 또는 26-(월+시), 천간은 연두법), 태원은 월간+1·월지+3으로 계산법이 학파 불문 통일돼 있다. 다만 실무 위상은 '아는 사람만 참고하는 보조 지표'로, 주류 만세력 기본 화면에도 표시되지 않는 경우가 대부분이다. 신궁은 사실상 자미두수 개념, 태식은 유통이 끊긴 개념이라 구현 가치가 없다.
- **근거**: grep '명궁|신궁|태원|태식|myeonggung|taewon' in lib/saju-ts/src → palace.ts 주석 1건만; 표준: 명궁 14/26 공식·중기 기준 (cafe.daum.net/phungyour/Itgw/7), 태원 월간+1·월지+3 (nangwol.com), 낭월 등 실전가 다수 미사용
- **권고**: 우선순위 낮음. 구현한다면 명궁·태원만 옵트인 참고 항목으로 추가하되 중기 기준 월 판정(절기 아님)을 정확히 구현해야 하고, 신궁·태식은 스킵 권장. 지금의 상위 버그·배관 단절 수리가 먼저다.

#### [missing / low / 미검증] 亥의 여기 戊가 기본 지장간 표에서 배제됨 — 이설 채택이나 주류 만세력 표기와 다름

- **현재**: rawHiddenStemsTable의 亥 = 壬(MAIN)·甲(RESIDUAL) 2간으로 戊 여기가 없다(hiddenStems.ts:76 직접 재확인). 왕지 子卯酉의 정기 단독 처리는 인원용사 표준에 부합하지만, 亥의 戊 배제는 '바다의 모래' 논리를 취하는 인원용사 일부 학파의 이설이다. 월률분야 데이터(wollyulData.ts:87-91)에는 戊7일이 있어 두 표가 불일치하며, 이 불일치 자체는 wollyul.ts:144-148에 문서화돼 있다.
- **표준**: 주류 만세력 앱의 亥 지장간 표기는 戊·甲·壬 3간이다(월률분야표 기준). 이는 버그가 아닌 학파 선택이지만, 주류 표기에서 벗어난 이설임에도 채택 근거가 hiddenStems.ts에 문서화돼 있지 않다.
- **근거**: lib/saju-ts/src/core/hiddenStems.ts:76 (직접 재확인); lib/saju-ts/src/core/wollyulData.ts:87-91 (戊 7일 존재, 직접 재확인); lib/saju-ts/src/core/wollyul.ts:144-148; 표준: 만세력 앱은 대개 戊甲壬 3간 표기, 戊 배제는 인원용사파 이설 (ko.wikipedia.org/wiki/지장간, gall.dcinside.com/divination/12979563)
- **권고**: 이설 채택임을 코드 주석에 명시하고(현재 wollyul.ts에만 언급), 통근 판정·오행 분포에서 亥월 戊 처리 차이가 감명 결과에 미치는 영향을 인지한 설계 결정인지 확인. 필요 시 schools 프리셋으로 3간 표를 선택 가능하게.

#### [enrichment / low / 미검증] 공망쌍이 항상 계산되지만 준-내부 데이터로만 존재 — 만세력 표준 표기(일주 공망 상시 표시)와 노출 격차

- **현재**: shinsalGongmangOfDayPillar(facts.ts:2557-2564)가 순중공망을 항상 정확히 계산해 RuleFacts.shinsal.gongmang.day로 노출하지만, SummaryReport에는 공망 필드가 없어 차트 지지에 공망지가 실제로 있을 때만 GONGMANG_SAL 신살 히트로 등장한다. 공망쌍 자체는 springLegacy.ts:755-764가 report.facts를 뒤져 복원하는 준-내부 데이터다.
- **표준**: 만세력 표준 표기는 일주 기준 공망 2지를 (차트 내 존재 여부와 무관하게) 항상 표시한다. 산식 자체(순=floor(idx/10), voidStart=(10-2*xun) mod 12)는 표준과 일치한다.
- **근거**: lib/saju-ts/src/rules/facts.ts:2557-2564,3104-3108,3338; lib/saju-ts/src/compat/springLegacy.ts:755-764; lib/spring-ts/src/report/cards/cautions-card.ts:220-224
- **권고**: SummaryReport에 gongmang 필드를 승격해 공망쌍을 1급 출력으로 노출. facts를 뒤지는 compat 복원 로직도 단순화된다.

#### [enrichment / low / 미검증] 월률분야 일수 비율이 연속 가중치로 활용되는 경로 부재 + 12운성 상세(startBranch) 내부 소멸

- **현재**: saryeongScheme을 켜도 hiddenStemsForChart는 사령간 1.0/나머지 0.0의 극단 가중치만 부여하고(wollyul.ts:174-178), 고전 일수 비율(寅 7/7/16 등)을 연속 가중치로 쓰는 경로가 없다. 별개로 lifeStages.detail의 startBranch·index는 graphFactory.ts:640-660에서 계산되나 pillars 추출(662-672)에서 stage 문자열만 남고 소멸한다(facts.ts:2708 학당귀인 계산만 내부 재사용).
- **표준**: 현대 전문가 주류가 사령 일수의 기계적 적용에 회의적이므로(투간·통근 우선) 이 격차의 감명 품질 영향은 작다. 다만 일수 비례 가중은 오행 분포 정밀화 옵션으로 자연스러운 확장이다.
- **근거**: lib/saju-ts/src/core/wollyul.ts:174-178; lib/saju-ts/src/graph/graphFactory.ts:640-672; 표준: 현대 실무는 사령 일수 기계 적용에 회의적, 투간·통근 우선 (chocosd.com 지장간 강의, leedongheon.com/542)
- **권고**: 우선순위 낮음. 오행 분포 정밀화가 필요해지면 WOLLYUL 일수 비례 가중 스킴('proportional')을 추가하는 정도로 충분. 주류 실무 관행(정적 표 + 투간·통근 중심)에는 현 기본값이 오히려 부합한다.

### 오행 역량·신강약 평가

**검증 완료 (적대적 검증 통과):**

#### [bug / high / CONFIRMED] springLegacy의 득령/득지/득세가 실제 판정이 아니라 십성 점수의 가짜 매핑

- **현재**: springLegacy.ts:1132-1134에서 deukryeong=비겁 합(components.companions), deukji=인성 합(components.resources), deukse=비겁+인성 합으로 채워 내보낸다. saju-adapter.ts가 이를 SajuSummary.strength로 그대로 전달하므로 리포트에 '득령/득지/득세'로 표기되는 숫자는 실제 판정과 무관하다.
- **표준**: 주류 표준: 득령=월지가 일간 기준 비겁/인성인지(월령 대비), 득지=일지 지장간 통근(본기>중기>여기), 득세=일간 제외 나머지 글자의 인성·비겁 세력. 세 값은 서로 다른 산출 기준을 가진 별개 판정이다(durumisaju.com/dict/gangyak/*, 다수 강의 표준).
- **근거**: lib/saju-ts/src/compat/springLegacy.ts:1132-1134 (deukryeong: components.companions, deukji: components.resources, deukse: 합계 — 직접 재확인), lib/spring-ts/src/saju-adapter.ts:1587-1589
- **권고**: deLingDiShi 모델의 details.delingdiShi(deLing/deDi/deShi 분해, facts.ts:2411-2418)를 legacy 출력에 배선하거나, base 모델 경로에서는 이 세 필드를 노출하지 말 것. 현재는 '비겁 합=득령' 같은 사실과 다른 수치가 사용자에게 나간다 — 명리 지식이 있는 사용자가 보면 즉시 오류로 판별 가능.

#### [bug / high / CONFIRMED] 기본(프로덕션) 경로의 신강약이 월지 가중·통근·계절을 전혀 반영하지 않는 base 모델

- **현재**: defaultConfig에 school/strategies가 없어(config.ts:6-34) computeStrengthFacts는 model='base'(facts.ts:2328)로 동작 — 십성 스코어를 support(비겁+인성) vs pressure(식상+재+관)로 단순 합산하며 월지가 다른 지지와 완전히 동일한 가중 1을 갖는다. 웹앱 경로도 school을 넘기지 않고(springLegacy PRESET_CONFIGS:196-212는 시간 정책만, saju-adapter.ts:1257-1260의 school.id 라우팅은 opt-in) 득령/득지/득세를 계산하는 deLingDiShi 모델은 school preset 지정 시에만 켜진다.
- **표준**: 모든 학파 공통으로 월지(월령)는 단일 요소 최대 비중(실무 통용 40~50%, 점수법도 월지 30/100)이며, 전문가들이 꼽는 프로그램의 대표 오류 ②가 바로 '월지를 나머지 글자와 같은 1개로 취급'이다. 신강약은 득령>득지>득세 순의 가중 종합 판정이 표준.
- **근거**: lib/saju-ts/src/api/config.ts:6-34 (strategies 부재 재확인), lib/saju-ts/src/rules/facts.ts:2328 (model ?? 'base' 재확인), lib/spring-ts/src/saju-adapter.ts:1254-1260 (school opt-in 재확인) vs 표준: 월지 30점/100·오류 지적 ② (m.cafe.daum.net/1poetry/7NdS/493, threads.com/@songchangmin78)
- **권고**: deLingDiShi 모델(이미 구현됨, facts.ts:2330-2419)을 기본 활성화하거나 웹 기본 경로에 school preset을 명시. 월지 특별 가중이 0인 현재 기본값은 학파 이설 범위 밖이다 — 어느 학파도 월지 무가중을 인정하지 않는다.

#### [bug / medium / CONFIRMED] saryeongScheme 활성 시 지장간 가중이 노드별로 불일치 — hiddenStems만 사령 반영, 분포·신강약은 정적 표

- **현재**: weights.hiddenStems.saryeongScheme을 켜면 hiddenStems.branches 노드만 hiddenStemsForChart(사령자 weight 1.0)를 쓰고, elements.distribution·scores.pillars·computeStrengthFacts의 통근 계산은 모두 hiddenStemsOfBranch를 직접 호출해 정적 표(0.6/0.3/0.1)를 쓴다(facts.ts:2371에서 재확인). 같은 실행 내에서 summary.hiddenStems와 summary.elementDistribution이 서로 다른 지장간 가중을 보고하는 내부 모순.
- **표준**: 월률분야 사령을 적용하는 학파라면 사령 가중이 통근·오행 분포·신강약까지 일관되게 흘러야 한다. 정밀파의 존재 이유 자체가 '지장간을 사령 일수 비례로 배점'하는 것인데 현재는 표시용 노드에만 반영된다.
- **근거**: lib/saju-ts/src/rules/facts.ts:2371 (hiddenStemsOfBranch 직접 호출 재확인), lib/saju-ts/src/core/hiddenStems.ts:101-107, lib/saju-ts/src/graph/graphFactory.ts:410-416 vs 459, 555
- **권고**: hiddenStemsOfBranch가 policy.saryeongScheme을 인식하도록 하거나, 그래프에서 사령 반영 지장간을 단일 소스로 만들어 distribution/scoring/strength가 공유하게 배선 통일. opt-in 기능이라 기본 경로 영향은 없지만 켜는 순간 자기모순 출력이 나간다.

#### [bug / low / PARTIAL] 신강약 3개 모델·등급 임계에 유닛테스트 0건 + golden 케이스 파일 부재로 golden 스위트 로드 실패

- **현재**: base/deLingDiShi/seasonalRoots 모델과 ±0.15 등급 임계(springLegacy.ts:939)에 직접 테스트가 전무하고, golden.test.ts:10이 참조하는 docs/_golden/golden_cases.json이 체크아웃에 없어 golden 스위트가 로드 단계에서 실패한다. GOLDEN_TOGGLES.rules=false라 파일이 있어도 strength는 기본 스냅샷 대상이 아니다.
- **표준**: 신강약은 용신 선정의 전제이자 사용자 신뢰의 핵심 수치이므로, 교과서 검증 케이스(3득 완비 신강, 실령·무근 신약, 종격 후보 극단 케이스 등)에 대한 회귀 벽이 있어야 향후 모델 전환(base→deLingDiShi) 시 안전하다.
- **근거**: lib/saju-ts/src/golden.test.ts:10,81-93, lib/saju-ts에 docs/ 디렉토리 부재 (코드 실태 조사에서 ls 확인), 테스트 전수 조사 결과 strength 직접 테스트 0건
- **권고**: 명리 강의 표준 예제(예: 득령·득지·득세 조합별 8케이스)로 strength 유닛테스트를 만들고, golden 케이스 파일을 복구하거나 경로를 수정하고 rules 토글을 켠 strength 스냅샷을 추가.
- **검증 정정**: 정정: (1) golden 스위트는 로드 실패하지 않는다 — vitest.config.ts가 의도적으로 제외하고 있으며 그 이유가 주석으로 문서화되어 있다(docs/_golden은 이 라이브러리 사본에 미포함). "로드 단계에서 실패"를 "의도적으로 실행 제외되어 있어 golden 커버리지가 saju-ts 사본에서 0"으로 고쳐야 한다. (2) "회귀 벽 부재" 주장은 saju-ts 유닛 레벨에 한정해야 한다. spring-ts 레벨에는 strengthLevel을 고정하는 다층 회귀 벽(baseline_snapshot verify 15픽스처 엄격 스냅샷, quality_gate D1 밴드 비교, measure_default_change 범주 드리프트 감지, borderline-strength-tier 테스트)이 이미 존재하며, 교과서형 기대값(종격 후보 포함)도 oracles/authority 픽스처에 축적되어 있다. (3) 유효하게 남는 갭은: deLingDiShi/seasonalRoots 모델을 활성화해 검증하는 테스트가 리포 전체에 0건, 그리고 ±0.15 임계·computeStrengthFacts에 대한 saju-ts 단위 테스트 부재. 권고안 중 "golden 파일 복구" 부분은 이미 vitest 제외로 무해화되어 있어 우선순위가 낮고, deLingDiShi/seasonalRoots 모델 유닛테스트 추가가 실질적 가치가 있는 부분이다.

**미검증 (low/enrichment 위주 — 착수 전 개별 확인 필요):**

#### [missing / medium / 미검증] 왕상휴수사(旺相休囚死) 시스템 미구현 — 오행별 계절 상태 판정 부재

- **현재**: 旺相休囚死 5단계 판정표가 코드베이스에 없다. seasonSupportScore(facts.ts:2306-2314)는 일간↔월지 한 쌍의 생극 관계만 5단계 점수화하고(deLingDiShi/seasonalRoots 모델 한정), 나머지 4개 오행의 계절 상태는 어디서도 계산되지 않는다. 12운성(lifeStage.ts)은 별도 존재하나 미연결.
- **표준**: 자평학 표준은 월지 계절 기준으로 5행 각각에 旺/相/休/囚/死 상태를 부여하고(예: 봄=木旺·火相·水休·金囚·土死), '개수가 많아도 휴수 상태면 약하다'를 오행 강약 판정의 1단계로 삼는다. 충 발생 시 손상 정도(왕상한 쪽 덜 상함)를 가르는 기준으로도 쓰인다.
- **근거**: lib/saju-ts/src/rules/facts.ts:2306-2314 (일간↔월지 쌍만 점수화), 코드 실태 조사에서 '旺相|休囚|왕상휴수' 검색 0건 vs 표준 판정표 (keyzard.cc/songje2025/nb/223825936114, lei.or.kr 교안)
- **권고**: 월지→오행별 5단계 상태 테이블(12행×5열)을 추가하고 elementDistribution 보정 계수 및 향후 충 손상 판정의 입력으로 배선. 辰戌丑未월 처리(본기 土 기준 vs 사령 세분)는 학파 이설이므로 본기 기준을 기본으로 하고 wollyul 사령과의 연동은 옵션으로.

#### [missing / medium / 미검증] 오행 분포(부족/과다 판정 포함)에 위치 가중이 전혀 없음 — 네 기둥 완전 동일 가중

- **현재**: elementDistributionFromPillars(elementDistribution.ts:20-48)는 네 기둥 천간 각 1.0, 지지 각 1.0(지장간 내부 0.6/0.3/0.1 분배)으로 합산 — 월지와 년지가 동일 가중이다. 이 total이 springLegacy ohaengDistribution이 되고 평균 대비 0.5/1.7 비율로 deficient/excessive 오행이 산출된다(springLegacy.ts:972-980).
- **표준**: 주류 정량법은 위치별 배점(월지 30, 일지·시지 15, 천간·년지 각 10 / 총 100)으로 오행 과다·발달·고립을 판정한다. 배점표 자체는 학파별로 다르나(월지 30%계 vs 50%계) 월지에 추가 가중을 주는 것 자체는 공통 관행이다.
- **근거**: lib/saju-ts/src/core/elementDistribution.ts:20-48 (기둥별 동일 가중), lib/saju-ts/src/compat/springLegacy.ts:972-980 (재확인) vs 표준 100점 배점표 (m.cafe.daum.net/1poetry/7NdS/493)
- **권고**: 작명 서비스에서 deficient/excessive 오행은 이름 보완 오행 선정의 근거가 되므로, 분포 벡터에 위치 가중(최소한 월지 상향) 옵션을 추가하고 부족/과다 판정에는 가중 벡터를 쓸 것. 지장간 가중(0.6/0.3/0.1)은 이미 표준(본기>중기>여기)과 일치하므로 유지.

#### [missing / medium / 미검증] 합충이 오행 역량·신강약에 전혀 반영되지 않음 — 충 손상·삼합/방합 회국·천간 합거 보정 부재

- **현재**: 지지 합/충/형 등은 relations.branches에서 탐지만 되고, 오행 벡터나 strength support/pressure를 수정하는 경로가 없다. 유일한 정량 반영은 격국 quality 감점(월지 연루 관계 damage, facts.ts:2217-2233)과 합화격 후보 신호뿐. 통근 뿌리가 충을 맞아도 해당 천간의 역량은 그대로다.
- **표준**: 실무 표준은 '1차 강약 산정 → 합충 보정' 2단계: 충은 지장간 상호 손상(휴수한 쪽이 크게 상함)으로 통근 천간 역량을 감쇄, 삼합·방합 회국 성립 시 왕지 오행 세력 대폭 가산, 천간합은 합거·기반으로 해당 천간 감쇄. '점수법 프로그램들이 합충 보정을 생략하는 것' 자체가 실무자들의 단골 비판 지점이다.
- **근거**: lib/saju-ts/src/graph/graphFactory.ts:468-498 (탐지만), lib/saju-ts/src/rules/facts.ts:2217-2233 (격국 quality에만 반영) vs 표준 2단계 관행 (sajustudy.com/60, sajustudy.com/58)
- **권고**: strength 계산에 합충 보정 단계를 추가: (1) 통근 계산 시 충 맞은 지지의 지장간 weight 감쇄(왕상휴수 연동), (2) 삼합·방합 성립 시 해당 오행 가산, (3) 천간합 성립 천간의 기여 감쇄. 개고론 vs 토동, 반합 인정 폭 등은 학파 이설이므로 정책 파라미터로. relations 탐지 인프라가 이미 있어 배선 작업이 주다.

#### [enrichment / medium / 미검증] deLingDiShi 모델의 실제 득령/득지/득세 분해(details.delingdiShi)가 legacy 출력에서 버려짐

- **현재**: school preset 활성 시 facts.ts:2411-2418이 deLing(월령 점수)/deDi(통근 점수·정규화)/deShi(투간 세력) 전체 분해를 details.delingdiShi로 기록하고 summary.strength에 실리지만, springLegacy.normalizeLegacyOutput은 index/support/pressure/components만 읽고 details를 버린다(springLegacy.ts:934-940). 웹앱에는 실제 3득 수치가 도달하지 않는다.
- **표준**: 득령·득지·득세 각각의 성립 여부와 강도는 신강약 설명의 핵심 서사다('3득 완비=확실한 신강'). 이미 계산된 값이므로 노출만 하면 finding 1의 가짜 매핑을 진짜 수치로 대체할 수 있다.
- **근거**: lib/saju-ts/src/rules/facts.ts:2404-2419 (details 생성 재확인), lib/saju-ts/src/compat/springLegacy.ts:934-940 (details 미참조 재확인)
- **권고**: school preset을 기본 경로에 켜는 것과 묶어, details.delingdiShi를 strengthResult.score의 deukryeong/deukji/deukse로 배선. 리포트 본문에서 '월령을 얻어(득령)…' 류의 근거 문장 생성 재료로도 활용 가능.

#### [enrichment / low / 미검증] 12운성이 계산·노출되지만 통근 강도/신강약 판정에 연결되지 않음

- **현재**: core/lifeStage.ts가 12운성(장생~양)을 계산해 summary.lifeStages로 노출하지만, deLingDiShi의 통근(deDi) 계산은 지장간 weight만 쓰고 12운성 서열을 참조하지 않는다. strength와 완전히 분리된 장식 데이터다.
- **표준**: 실무 통근 강도 서열은 지장간 위계와 함께 12운성을 쓴다: 건록·제왕지 통근 최강 > 장생 통근 > 묘고 통근 최약. 전문가 오류 지적 ⑨가 '12운성을 무시하고 뿌리 유무만 보는 것'이다.
- **근거**: lib/saju-ts/src/core/lifeStage.ts:5-66, lib/saju-ts/src/rules/facts.ts:2366-2379 (deDi가 weight만 사용) vs 통근 강도 표준 (durumisaju.com/dict/gangyak/deukji, chocosd.com 통근 항목)
- **권고**: deDi 계산에 12운성 기반 통근 강도 계수(록왕>장생>묘고)를 옵션으로 추가하거나, 최소한 리포트 서사에서 '일지가 제왕지라 뿌리가 튼튼하다' 류의 설명 재료로 lifeStages를 strength 설명과 연결.

#### [enrichment / low / 미검증] 천간/지장간 분리 벡터(heaven/hidden)가 버려져 통근·무근 구분 설명 재료가 사장됨

- **현재**: elementDistribution은 heaven/hidden/total 3벡터를 만들지만 springLegacy는 total만 반올림해 ohaengDistribution으로 내보내고 heaven/hidden은 버린다(springLegacy.ts:972-979).
- **표준**: 전문가 오류 지적 ④: '천간에 떠 있기만 한 오행(무근지목)과 지지에 뿌리박은 오행을 같은 힘으로 계산'하는 것이 대표 오판. heaven만 있고 hidden이 0인 오행은 '표면상 있으나 뿌리 없음'으로 구분 설명이 가능한 재료가 이미 있다.
- **근거**: lib/saju-ts/src/core/elementDistribution.ts:41-47, lib/saju-ts/src/compat/springLegacy.ts:972-979 (total만 사용 재확인)
- **권고**: heaven/hidden 벡터를 legacy 출력에 통과시켜, 오행별 '뿌리 있음/천간만 노출' 구분을 리포트 서사(예: 무근 오행은 이름으로 보완할 실익이 큼)에 활용.

#### [enrichment / low / 미검증] month.saryeong(사령자) fact의 summary 노출 경로 부재

- **현재**: saryeongScheme 활성 시 month.saryeong 노드가 사령 천간을 계산해 rules.facts/report.facts에 남지만 summary에 대응 필드가 없어(engine.ts:115-289) UI/리포트로 나갈 경로가 없다.
- **표준**: 사령은 격국 판단과 환절기월(辰戌丑未) 왕상휴수 세분의 근거로, 정밀 감명 서사('辰월 초기라 木 기운이 남아…')에 쓰이는 정보다.
- **근거**: lib/saju-ts/src/graph/graphFactory.ts:219-233, lib/saju-ts/src/api/engine.ts:115-289 (saryeong 필드 부재)
- **권고**: summary에 saryeong 필드를 추가해 사령 천간·경과일·세그먼트를 노출. 왕상휴수 구현(별도 finding) 시 환절기월 세분 입력으로도 재사용.

### 천간·지지 관계(합충형파해·극)

**검증 완료 (적대적 검증 통과):**

#### [bug / high / CONFIRMED] 육합·자형·삼형 라벨 키 불일치로 note/outcome이 빈 채 원시 코드가 노출됨

- **현재**: 엔진은 지지 관계 타입을 'YUKHAP'/'JA_HYEONG'/'SAMHYEONG' 코드로 방출하는데, springLegacy의 JIJI_RELATION_NOTES/OUTCOMES와 spring-ts 어댑터의 JIJI_RELATION_NOTE_KO_LABEL/OUTCOME_KO_LABEL에는 'HAP'/'HYEONG' 키만 있다. 결과적으로 가장 기본 관계인 육합이 note=''·outcome=null·표시타입 'YUKHAP'(영문 원시 코드)로 최종 출력되고, 자형·삼형도 동일하게 라벨 없이 나간다.
- **표준**: 육합(六合)·자형(自刑)·삼형(三刑)은 모든 만세력·감명 서비스가 한글 라벨과 함께 표시하는 기초 관계다. 엔진이 방출하는 모든 관계 코드가 소비층 라벨 테이블과 1:1로 매칭되어야 한다.
- **근거**: lib/saju-ts/src/core/branchRelations.ts:5-15 (타입 유니온에 YUKHAP/JA_HYEONG/SAMHYEONG), lib/saju-ts/src/compat/springLegacy.ts:77-96 (HAP/HYEONG 키만 존재), lib/spring-ts/src/saju-adapter.ts:202-237 (동일 누락, RELATION_TYPE_KO_LABEL에도 세 코드 부재)
- **권고**: springLegacy와 spring-ts 어댑터 양쪽 라벨 테이블에 YUKHAP('지지 육합(六合) 관계'/'육합')·JA_HYEONG('자형(自刑)')·SAMHYEONG('삼형(三刑)') 키를 추가하고, 방출 타입 유니온과 라벨 테이블 키의 일치를 검증하는 단위 테스트를 추가한다.

#### [missing / high / CONFIRMED / 기지] 천간 극(剋) 6종이 계산 자체가 없음 — 라벨만 있고 생산자가 영원히 빈 죽은 매핑

- **현재**: StemRelationType이 'HAP'|'CHUNG'뿐이고 detectStemRelations에 극 분기가 없어 갑무·을기·병경·정신·무임·기계 극 6종이 0건 방출된다. 반면 springLegacy(CHEONGAN_RELATION_NOTES.GEUK)와 spring-ts 어댑터(CHEONGAN_RELATION_NOTE_KO_LABEL.GEUK, RELATION_TYPE_KO_LABEL.GEUK) 두 곳에 극 라벨이 미리 깔려 있어 소비층 스키마는 극 데이터를 기대하는 상태다.
- **표준**: 실무 표준은 천간충 4종(갑경·을신·병임·정계)과 천간극 6종을 구분해 둘 다 계산하며, 천간 충극을 정신·심리 작용과 칠살(편관) 제화 판단에 활용한다(같은 음양 상극=칠살 방향 구조).
- **근거**: lib/saju-ts/src/core/stemRelations.ts:4 (타입에 GEUK 부재), :72-96 (HAP/CHUNG만 탐지); 라벨: lib/saju-ts/src/compat/springLegacy.ts:97-101, lib/spring-ts/src/saju-adapter.ts:222-237; 표준: https://www.sajustudy.com/56, https://doc.8-codes.com/docs/lecture/12/
- **권고**: stemRelations.ts에 GEUK 탐지를 추가한다(같은 음양 상극 쌍 중 충 4쌍을 제외한 6쌍). 이미 준비된 양쪽 라벨 배관이 즉시 살아나므로 변경 표면적이 작다. 단, 천간충을 인정하지 않고 전부 극으로 보는 학파도 있으므로 충/극 구분은 현행 4충 유지가 주류에 부합한다.

#### [missing / high / CONFIRMED] 반합(半合) 미지원 — 원국은 삼합 3자 완전체만 인정하는데 운(運) 관계는 부분 성립을 인정하는 내부 모순

- **현재**: detectBranchRelations는 삼합·방합 모두 '3지지 전부 존재'할 때만 성립시켜 반합이 아예 없다. 반면 같은 서비스의 fortuneCalculator.checkFortuneRelations는 운의 지지+원국 1개만 겹쳐도 '삼합 부분'으로 인정한다(왕지 포함 여부조차 안 봄). 즉 사용자는 대운에서는 반합을 보는데 원국에서는 같은 조합이 아무것도 아닌 것으로 나온다.
- **표준**: 주류 표준은 왕지(자오묘유) 포함 2자 반합(생지반합·묘지반합)을 원국에서도 인정하며, 반합은 실무 통변 빈도가 매우 높다. 생지+고지 조합(가합)은 불인정이 주류. 운에서 나머지 1자가 와 삼합이 완성되는 해에 발동한다는 통변도 원국 반합 탐지가 전제다.
- **근거**: lib/saju-ts/src/core/branchRelations.ts:159-168 ('only if all 3 are present'), lib/spring-ts/src/report/common/fortuneCalculator.ts:755-786 (matchingNatal.length >= 1이면 '삼합 부분' 방출, 왕지 조건 없음); 표준: https://www.sajustudy.com/58, https://guide.8-codes.com/lecture/elementary/13.html
- **권고**: core에 BANHAP(또는 SAMHAP partial 플래그) 타입을 추가하되 왕지 포함을 필수 조건으로 한다. fortuneCalculator의 부분 삼합도 왕지 필수 조건을 넣어 두 경로의 규칙을 일치시킨다. 방합 반합은 3자 완전체 요구가 다수설이므로 현행 유지가 무난하다(이설 존재).

**미검증 (low/enrichment 위주 — 착수 전 개별 확인 필요):**

#### [missing / medium / 미검증] 합충 해소(탐합망충) 로직이 전 파이프라인에 부재 — 합이 있어도 충이 격국 damage에 무조건 가산됨

- **현재**: 육합·삼합이 충을 푸는 로직이 어디에도 없다. 월지 격국 품질 damage는 육합·삼합 존재와 무관하게 충·형·파·해·원진을 전부 가산하고, 존재하는 것은 반대 방향(破合: 충이 합화 factor를 감쇠)뿐이다. springLegacy의 resolvedJijiRelations는 하드코딩 []라 어댑터의 '해소된 관계' 경로가 절대 실행되지 않는다. 부수적으로 기본 damage 가중이 파·해 0.7로 형 0.8과 거의 동급인데, 주류 실무는 파·해를 충·형보다 훨씬 약한 참고 사항으로만 취급한다(이설: 절충파는 일부 해를 실질 작용으로 봄 — 설계 선택 영역이며 damageWeights로 조정 가능).
- **표준**: '합은 충을 해소하고 충은 합을 푼다'(탐합망충)는 학파 공통 대원칙이다. 충하는 글자 중 하나가 제3의 글자와 육합·반합을 이루면 충이 해소/잠복되고, 온전한 삼합국은 충으로 깨지지 않는다. 우선순위 세부는 학파차가 크지만 해소 개념 자체의 부재는 예컨대 자오충+자축합 사주에서 표준과 정반대의 파격 판정을 낳는다.
- **근거**: lib/saju-ts/src/rules/facts.ts:2218-2233 (무조건 damage 가산), :2110 (damageWeights PA/HAE 0.7), :1853-1884 (破合 방향만 존재), lib/saju-ts/src/compat/springLegacy.ts:1176 (resolvedJijiRelations: []); 표준: https://m.cafe.daum.net/sajuplace/L3wG/766, https://guide.8-codes.com/lecture/elementary/13.html
- **권고**: 최소 구현으로 '충 당사자가 육합·삼합(반합) 참여 시 damage 가중 감쇠(예: 0.3~0.5배)'를 넣고, 해소 판정 결과를 resolvedJijiRelations로 방출해 이미 존재하는 어댑터 경로를 살린다. 완전 해소 vs 감쇠, 방합의 해충 불인정 등 세부는 학파차가 크므로 config 가중치로 노출한다.

#### [missing / medium / 미검증] 귀문(鬼門) 미지원 — 원진은 있는데 실무 채택률이 대등하게 높은 귀문이 없음

- **현재**: 관계 타입, 신살 카탈로그, 기본 규칙 어디에도 귀문이 없다(원진 6쌍만 지원). 암합(暗合)도 미지원. 원진과 겹치는 해(자미·축오)는 HAE와 WONJIN 두 타입으로 중복 방출된다.
- **표준**: 신살 축소 흐름 속에서도 원진·귀문은 예외적으로 채택률이 높은 쌍이다 — 원진은 궁합·인간관계, 귀문(자유·축오·인미·묘신·진해·사술)은 정신·심리·직업 적성 통변의 단골 도구로 파·해보다 실무 비중이 크다. 원진만 있고 귀문이 없으면 심리 통변 콘텐츠의 재료 절반이 빈다.
- **근거**: lib/saju-ts/src/core/branchRelations.ts:5-15 (타입 전체에 귀문 부재), lib/saju-ts/src/rules/packs/shinsalBaseCatalog.ts (GWIMUN 부재, grep 전수 확인); 표준: https://sajuabc.com/%EA%B7%80%EB%AC%B8%EA%B4%80%EC%82%B4/, https://namu.wiki/w/%EC%82%AC%EC%A3%BC%ED%8C%94%EC%9E%90/%EC%8B%A0%EC%82%B4
- **권고**: 귀문 6쌍(자유·축오·인미·묘신·진해·사술)을 관계 또는 신살(GWIMUN_SAL)로 추가한다. 원진과 겹치는 4쌍은 용도 구분(원진=관계 원망, 귀문=개인 심리)으로 통변 텍스트를 분리한다. 인접(일지-월지)에서만 볼지 전체에서 볼지는 학파가 갈리므로 config로 둔다. 암합은 실무 비중이 낮아 후순위. 해·원진 중복 방출은 표준 조견표상 실제 겹침이므로 유지하되 소비층 중복 경고만 점검.

#### [missing / medium / 미검증] 인접/원격 기둥 무차별 — 년간-시간 요합(遙合)도 완전한 합으로, 원격 지지 관계도 감쇠 없이 동등 처리

- **현재**: 천간·지지 모두 4기둥의 모든 쌍(i<j)을 인접 여부와 무관하게 동일하게 검사·방출한다. 년간-시간처럼 두 칸 떨어진 천간합도 화기 오행이 첨부된 완전한 HAP으로 나가고, 지지의 원격 충·자형도 인접과 동일 취급이며 방합도 인접·월지 점유 조건 없이 3자 존재만 본다. 어떤 감쇠·주석도 없다.
- **표준**: 천간합은 인접(년-월, 월-일, 일-시)이어야 성립한다는 것이 확고한 주류이며 원격 요합은 불인정 또는 극히 약하게 본다. 지지는 '붙어 있으면 세고 떨어져 있으면 약하다'는 절충이 사실상의 실무 표준이고, 파·해·자형 같은 약한 관계는 인접일 때만 인정하는 것이 표준. 방합은 3자 인접+월지 점유를 요구하는 견해가 유력하다. (원격 전면 부정 vs 약화 인정은 학파차 있음 — 감쇠 없는 전면 동등 인정은 어느 학파 기준으로도 주류 밖.)
- **근거**: lib/saju-ts/src/core/stemRelations.ts:77-94 (전쌍 루프, 위치 정보 자체가 입력에 없음), lib/saju-ts/src/core/branchRelations.ts:137-151 (동일), lib/saju-ts/src/graph/graphFactory.ts:469-498 (4주 배열만 전달); 표준: https://www.sajustudy.com/55, https://chocosd.com/3243/
- **권고**: 탐지 입력에 기둥 위치를 포함시키고(아래 궁위 finding과 동일 선행 작업), 관계별 adjacency 등급(인접/1칸/2칸)을 방출한다. 천간합은 인접만 완전 성립·원격은 약화 표기, 파·해·자형은 인접 한정을 기본값으로 하되 config로 완화 가능하게 한다.

#### [missing / medium / 미검증] 천간합 화기 오행이 조건 없이 항상 첨부되고 합거·기반·쟁합·투합 판정이 없음 — 합이불화 주류와 어긋난 표시 위험

- **현재**: core는 오합 탐지 시 resultElement(화기 오행)를 무조건 첨부하고('고전 매핑만 보고' 주석 명시) springLegacy가 resultOhaeng으로 그대로 내보낸다. 합화 성립 조건은 rules/facts.ts computeTransformations에 factor로 계산되지만 격국 HUA_QI 후보에만 쓰이고 관계 출력과 연결되지 않는다. 합거/기반(묶임), 쟁합·투합(1:2합) 약화, 일간 참여 합 특례(일간은 합거되지 않음)는 어디에도 없다 — 갑 2개+기 1개의 쟁합도 dedupe로 HAP 1건으로 축약돼 정보가 소실된다.
- **표준**: 현대 한국 실무 주류는 합화를 거의 인정하지 않고(인접+월지 당령+통근 부재의 까다로운 조건) '합이불화=묶임(기반)'으로 해석한다. 용신이 합으로 기반되면 사주가 탁해진다는 것이 표준 통변이고, 쟁합·투합은 합화 불성립·합력 약화, 일간합은 합거 불가가 표준이다. 화기 오행을 조건 없이 노출하면 소비층 문구가 '합하여 토가 된다'는 비주류 판정으로 흐를 위험이 있다. (고전 계열은 화격을 적극 인정 — 이설 존재.)
- **근거**: lib/saju-ts/src/core/stemRelations.ts:9-12,82-88 (무조건 첨부), lib/saju-ts/src/compat/springLegacy.ts:986 (resultOhaeng 그대로 방출), lib/saju-ts/src/rules/facts.ts:1626-1684 (factor 계산은 존재하나 관계 출력 미연결), stemRelations.ts:96 (uniqByKey로 쟁합 중복 소실); 표준: https://www.sajustudy.com/55, https://bnk.kpipa.or.kr/home/v3/addition/adiPromoMetaDataView/seq_20240417123656781774
- **권고**: 이미 계산 중인 computeTransformations factor를 관계에 hapHwaEvaluations로 연결해(threshold 미달=합이불화·기반, 초과=합화) 방출한다 — 어댑터의 extractHapHwaEvaluations 배관이 이미 기다리고 있다. resultOhaeng은 '고전 화기 참고'로 라벨링하거나 factor 통과 시에만 확정 표기. 쟁합·투합은 dedupe 전 다중도 카운트로 탐지해 약화 플래그를 붙인다.

#### [missing / medium / 미검증] 관계 members가 지지 '값'이라 궁위(어느 기둥끼리)와 중복도가 소실됨

- **현재**: DetectedRelation.members가 기둥 위치가 아닌 지지 인덱스 값이고 pairKey dedupe로 동일 값 쌍이 1건으로 축약된다. 午 2개+子 1개면 충 2건이 1건이 되고, 최종 출력(jijiRelations)에서도 지지 코드 배열만 전달돼 년지-일지 충인지 월지-시지 충인지 알 수 없다. 자형도 members가 [4,4] 같은 값 쌍이다.
- **표준**: 실무 통변은 궁위가 핵심이다 — 일지 충(배우자궁)과 년지 충(조상궁)은 완전히 다른 해석이고, 인접/원격 판정과 격국 월지 damage도 궁위가 전제다. 어느 기둥의 관계인지 없는 충·합 목록은 전문가 기준 통변 재료로 불완전하다.
- **근거**: lib/saju-ts/src/core/branchRelations.ts:17-20 (members: BranchIdx[]), :121-129,154-157 (pairKey dedupe), lib/saju-ts/src/compat/springLegacy.ts:996 (branchCodeFromIdx만 전달); 표준(궁위 통변·인접 원칙): https://www.sajustudy.com/62, https://chocosd.com/3243/
- **권고**: 탐지 입력을 (pillar, branch) 쌍으로 바꿔 members에 기둥 위치를 포함하고 dedupe 키를 위치 기반으로 전환한다. 인접 감쇠(위 finding)와 궁위별 통변 텍스트, 귀인 seatPillars 설계(기존 핸드오프의 귀인 궁위 작업)와 동일한 방향의 선행 인프라다.

#### [enrichment / medium / 미검증] 죽은 배관 4종 — 계산되거나 스키마가 준비된 관계 상세가 하드코딩 빈 배열로 차단됨

- **현재**: springLegacy가 scoredCheonganRelations(:1174), resolvedJijiRelations(:1176), shinsalComposites(:1183)를 하드코딩 []로 방출하고 hapHwaEvaluations 필드는 아예 생성하지 않아, spring-ts 어댑터의 대응 경로(천간 관계 score, 해소된 관계 우선 경로, extractHapHwaEvaluations)가 절대 실행되지 않는다. 또한 ruleFacts에 이미 계산되는 transformations factor(facts.ts:3242), 월지 격국 damageRelations 상세(:2255-2259), 관계 편의 인덱스(:145-170)가 legacy 출력으로 방출되지 않는다.
- **표준**: 이미 엔진 내부에 존재하는 '어떤 관계가 격을 깼는지', '합화 factor가 얼마인지' 같은 상세는 감명 리포트의 근거 설명(왜 이 격국인지, 왜 이 합이 약한지)으로 바로 쓸 수 있는 재료다. 스키마·소비 코드가 양쪽에 준비돼 있으므로 연결만 하면 된다.
- **근거**: lib/saju-ts/src/compat/springLegacy.ts:1174,1176,1183 (하드코딩 []), :510-516 (damage 상세를 MONTH_BRANCH_DAMAGED 문자열 하나로 축약), lib/spring-ts/src/saju-adapter.ts:1918-1921,1951-1958,1984-1996 (대기 중인 소비 경로)
- **권고**: 우선순위: ① damageRelations 상세를 격국 품질 근거로 방출(감명 설득력 직결) ② transformations factor를 hapHwaEvaluations로 연결 ③ 합충 해소 구현 후 resolvedJijiRelations 연결. scoredCheonganRelations는 인접 감쇠 구현과 함께 채우면 자연스럽다.

#### [enrichment / low / 미검증] 육합·삼합에 결과 오행 미첨부 — 천간합·운 관계 경로와 비대칭

- **현재**: 천간 오합은 resultElement가 항상 첨부되지만 지지 육합·삼합·방합의 DetectedRelation은 type+members뿐이라 화기 오행 정보가 없다. 반면 fortuneCalculator의 운↔원국 육합·삼합은 resultElement와 '→ 수(水)' 식 설명을 첨부해 같은 서비스 안에서 표현 수준이 갈린다.
- **표준**: 육합 화기(자축토·인해목·묘술화·진유금·사신수·오미화)와 삼합국 오행(해묘미목국 등)은 모든 표준 조견표의 기본 정보다. 합화 인정 여부와 별개로 '어느 오행의 합인지'는 표시하는 것이 관행이다(오미합 화기, 자축합 토/수는 이설 유명 — 표기 시 학파 주석 여지).
- **근거**: lib/saju-ts/src/core/branchRelations.ts:17-20 (resultElement 필드 없음), lib/saju-ts/src/core/stemRelations.ts:82-88 (천간은 첨부), lib/spring-ts/src/report/common/fortuneCalculator.ts:740-786 (운 경로는 resultElement 첨부)
- **권고**: DetectedRelation에 optional resultElement를 추가하고 육합·삼합·방합 테이블에 화기 오행을 채워 천간합·운 관계와 표현을 통일한다. 오미합·자축합 화기는 다수설(화·토)을 기본값으로 하되 주석을 남긴다.

### 격국·용신·조후

**검증 완료 (적대적 검증 통과):**

#### [bug / high / CONFIRMED] 레거시 용신 추천 1위가 무조건 'JOHU'(조후) 타입으로 라벨링됨 — 실제 산출은 억부 단독

- **현재**: springLegacy.ts:1152에서 recommendations 매핑 시 `type: i === 0 ? 'JOHU' : 'RANKING'`으로 하드코딩. 그러나 기본 정책은 weights.climate=0, climate.enabled=false(yongshin.ts:303-311)라 조후는 랭킹에 0 기여. 즉 순수 억부(balance+role)로 뽑힌 오행이 '조후 용신'으로 표기되어 하위 리포트 문구가 방법론을 오인하게 됨.
- **표준**: 추천 타입은 실제 기여 방법(억부/조후/통관 등)을 반영해야 함. 전문 표준에서 억부용신과 조후용신은 전거(적천수 계열 vs 궁통보감)와 적용 논리가 다른 별개 방법이므로, 방법 라벨 오기는 전문가가 즉시 오류로 지적할 사항.
- **근거**: F:/Projects/metaintelligence/namespring-web/lib/saju-ts/src/compat/springLegacy.ts:1151-1152 (재확인), lib/saju-ts/src/rules/yongshin.ts:303-311 (기본 가중치 재확인)
- **권고**: base.effectiveWeights 또는 methodSelector 게이팅 결과를 읽어 실제 지배 방법으로 type을 산출('EOKBU'/'JOHU'/'TONGGWAN' 등). 최소한 기본 경로에서는 'EOKBU'로 수정.

#### [missing / high / CONFIRMED] 건록격·월겁격·양인격 부재 — 월지 비견·겁재를 '비견격/겁재격'으로 출력

- **현재**: DEFAULT_GYEOKGUK_RULESET에 GYEOK_BI_GYEON/GYEOK_GEOB_JAE 룰이 있어 월지 격 십성이 비견/겁재면 그대로 '비견격/겁재격'이 됨(defaultRuleSets.ts:36-37). saju-ts 전체에 건록/양인/월겁 격 키가 전무(grep 결과 shinsal yanginMode 2건뿐 — facts.ts:2723,2741은 신살용).
- **표준**: 주류 표준(자평진전 계열, 사실상 이설 없음): 월지가 비견·겁재면 십신 격으로 삼지 않는다 — 8정격에 비견격·겁재격이 없는 이유. 건록(비견)이면 건록격, 양간 제왕지면 양인격(갑묘월·병무오월·경유월·임자월), 음간 겁재는 월겁격. 이들은 월지를 용하지 못하므로 상신을 다른 곳에서 구하는 별도 운용 논리가 붙음.
- **근거**: lib/saju-ts/src/rules/defaultRuleSets.ts:36-37 (재확인), grep 'geonrok|yangin|建祿|陽刃' → facts.ts:2723,2741(신살)만 히트. 표준 출처: kakaochips.com/46, cafe.daum.net/damwonjy/Ud5R/49
- **권고**: 월지 십성이 BI_GYEON/GEOB_JAE일 때 GEONROK(건록격)/YANGIN(양인격, 양간+제왕지)/WOLGEOB(월겁격) 키로 분기하는 룰 추가. 음인 인정 여부는 이설이므로 config 옵션으로. 최소한 레거시 출력 라벨만이라도 '건록격/양인격'으로 매핑하면 사용자 신뢰 손상을 줄일 수 있음.

#### [missing / high / PARTIAL] 궁통보감 조후용신표(10일간×12월=120셀) 미수록 — 프리셋 이름은 완전 구현을 암시

- **현재**: johooTemplate은 일간당 고정 선호천간 1개(甲→庚, 乙→癸 … 10엔트리, 월지 무관, johooTemplate.ts:53-66 재확인) + 겨울→火/여름→水(96-101) + 冬丙/夏癸 힌트(139-153)뿐. 예: 갑목은 어느 달이든 庚 하나. 그런데 builtin.pack.json에 'qiongTongBaoJian(窮通寶鑑)' 프리셋이 존재하며 johoo.strict 재사용.
- **표준**: 궁통보감 표준은 희용제요 120조합별 주용신+보좌용신. 예: 갑목 인월=丙(癸), 갑목 자월=丁(庚丙), 병화 오월=壬(庚), 신금 자월=丙(戊壬甲), 경금 인월=戊(甲壬丙丁). 갑목의 표준 조후용신은 월에 따라 丙/庚/癸/丁으로 갈리는데 현재는 항상 庚 계열 보너스.
- **근거**: lib/saju-ts/src/rules/johooTemplate.ts:53-66,96-101,139-153 (재확인), builtin.pack.json qiongTongBaoJian. 표준 출처: KCI ART002857929, cafe.daum.net/scholarlyname/8Duz/19
- **권고**: 120셀 데이터 테이블(주용신/보좌용신, 서락오 평주본 계열 기준)을 config 오버라이드 가능한 JSON으로 수록하고 johooTemplate이 dayStem×monthBranch 조회로 전환. 완성 전까지 프리셋 이름·설명에서 '궁통보감' 표기를 '조후 간이 모드' 수준으로 낮춰 오인 방지.
- **검증 정정**: 정정: (a) '미수록' 자체는 사실이나, 결손의 범위는 '조후가 월지를 전혀 반영 안 함'이 아니라 '천간 레벨 주용신/보좌용신 120셀 표가 없어 온도·습도 근사로 환원 불가능한 셀들(劈甲용 庚 우선, 경금 인월 戊 우선 등)이 재현되지 않음'으로 좁혀 서술해야 한다. 오행 레벨 월별 변화는 climate.ts(envByMonthBranch 12개월)+climateUrgency가 이미 처리하며 johoo.strict에서 가중치도 더 높다(1.45 vs 0.85). (b) qiongTongBaoJian 프리셋은 description에 '현재 엔진에서는 johoo.strict와 동일하게 동작(확장 여지)'라고 명시하므로 '완전 구현을 암시'는 부정확 — 다만 id/name/aliases(궁통보감·窮通寶鑑)로 검색·선택되는 경로에서는 description이 노출되지 않을 수 있어 표기 개선 권고 자체는 유효하다. (c) severity는 high보다 medium이 적절: 120셀 표 수록 권고(재차 확인한 recommendation)는 타당한 개선이지만, 현 엔진이 조후를 무시하는 것이 아니라 stem-level 정밀도가 부족한 것이다. 참고로 evidence의 세부 셀 값(경금 인월 보좌 구성 등)은 판본(서락오 평주 계열)별 소차가 있으니 수록 시 기준 판본 명시 권고는 그대로 유효.

#### [bug / high / CONFIRMED] 종격이 기본·프로덕션 설정에서 구조적으로 도달 불가 — 교리적 종격 명식에 정반대 용신 출력

- **현재**: CONG_* 격 발화는 patterns.follow.jonggyeokFactor≥0.6에 의존(defaultRuleSets.ts:104-114 재확인)하는데 applyFollowPattern은 enabled===true 옵트인(facts.ts:1086-1087)이고 기본·프로덕션(saju-adapter, school 미지정) 모두 꺼짐. jonggyeok-fixture.test.ts 헤더가 '교리적 종격 9명식 전부 정격 분류'를 명시적으로 문서화(재확인). 용신도 w.follow=0이라 극신약 종격 사주에 기계적 억부(인성·비겁)를 적용 — 전왕용신과 정반대.
- **표준**: 종격 인정 범위(가종 등)는 학파 이설이지만, '종격 미검출로 극신약 사주에 억부를 적용해 정반대 용신을 내는 것'은 학파 불문 자동화의 대표적 치명 오류로 공인됨. 주류 판정 순서는 전왕(종격) 게이트가 논리적 최우선.
- **근거**: lib/saju-ts/src/rules/defaultRuleSets.ts:104-114, lib/saju-ts/src/rules/facts.ts:1086-1087, lib/spring-ts/test/integration/jonggyeok-fixture.test.ts:1-20 (재확인), lib/spring-ts/src/saju-adapter.ts:1254-1260. 표준 출처: guide.8-codes.com/guide/origin/yongsin.html
- **권고**: 기본 경로에서 최소한 jonggyeokCandidates가 candidate/selected 수준일 때 (a) 용신 methodSelector의 follow 게이트를 자동 활성하거나 (b) 레거시 출력에 '종격 가능성 — 억부 용신 신뢰도 낮음' 경고를 붙여 confidence를 감쇠. 완전 승격은 보수적 이설 존중 차원에서 config 옵션으로 유지 가능.

#### [bug / high / CONFIRMED] 프로덕션 기본이 조후 완전 배제(순수 억부) — 주류 관행(억부 기본+조후 보정, 조후 위급 시 우선)에서 이탈

- **현재**: 기본 가중치 balance:1, role:1, climate:0 + climate.enabled:false + climateUrgency.enabled:false(yongshin.ts:303-317 재확인). methodSelector도 기본 꺼짐. 프로덕션 saju-adapter는 school 미지정이라 실서비스 용신이 계절·한난조습을 전혀 반영하지 않음. facts.climate는 계산되지만(파이프라인 존재) 랭킹에 0 기여.
- **표준**: 현대 한국 주류 관행: 억부 기본(~70%) + 조후 보정(~20%), 그리고 '사주가 극단적으로 한랭·조열하면 조후를 억부보다 우선(조후위급)'은 넓게 공유되는 예외 규칙. 조후 무시는 상용 서비스의 공인된 오류 유형(한여름 조열 사주에 火 계열 추천 등). 순수 억부 단독은 주류가 아님 — 억부 일원론이 존재하긴 하나 소수설이며, 그 경우에도 조후 극단 케이스는 예외 처리하는 것이 일반적.
- **근거**: lib/saju-ts/src/rules/yongshin.ts:303-317 (재확인), lib/spring-ts/src/saju-adapter.ts:1195-1260. 표준 출처: sazasaju.com/blog/yongsin-guide (억부70/조후20 계층), guide.8-codes.com
- **권고**: 기본값에서 climate weight를 소폭(예: 0.2~0.3) 활성하거나, 최소한 climateUrgency(조후위급 게이트, 이미 구현됨 yongshin.ts:1222-1246)를 기본 활성해 극단 명식에서만 조후가 개입하게 조정. 이설 존중이 필요하면 프로덕션 어댑터에서 명시적으로 school을 지정해 '설계 선택'임을 코드에 드러낼 것.

#### [bug / medium / PARTIAL] consensus의 johu 축이 조후 비활성 상태에서도 climate 점수로 계산되어 내부 모순 신호 노출

- **현재**: buildYongshinConsensus에 climateFacts.scores를 climateEnabled 여부와 무관하게 전달(yongshin.ts:1291 재확인). 용신 랭킹에는 조후가 0 기여인데 summary.yongshin.consensus의 johu 축·conflictLevel·competingElements는 조후를 반영 — '조후 축과 충돌' 신호가 실제 산출 근거와 어긋난 채 최종 아웃풋에 나감.
- **표준**: 합의 스코어보드는 실제 선택에 기여한 방법과 정합적이어야 하거나, 최소한 각 축의 활성/비활성 상태를 함께 표기해야 소비자가 오독하지 않음.
- **근거**: lib/saju-ts/src/rules/yongshin.ts:1286-1296 (재확인), lib/saju-ts/src/rules/facts.ts:673-685
- **권고**: consensus 축별로 enabled/weight 메타를 포함하거나, 비활성 방법의 축은 'informational' 플래그를 달아 conflictLevel 계산에서 가중을 낮출 것.
- **검증 정정**: 버그(medium)가 아니라 문서화/메타데이터 개선 과제(low, enhancement)로 정정. consensus는 랭킹 점수의 분해가 아니라 의도된 정책 독립 교차 방법론 스코어보드이며(gyeokguk·siksangFlow 축은 어떤 설정에서도 랭킹에 미기여, medicine/tongguan/follow도 가중치와 무관하게 전달됨), '조후 축과 충돌' 신호는 활성 정책과 어긋난 것이 아니라 고전 방법론 간 이견이라는 의도된 의미다. 유효한 개선점은 두 가지로 축소된다: (1) YongshinConsensusAxisScore에 축별 활성/기여 여부 메타(예: activeInSelection 또는 weight)를 추가해 소비자 오독 방지, (2) base.climate 생략 vs consensus.johu 채움의 출력 비대칭 해소 또는 문서화. 'conflictLevel에서 비활성 축 가중 축소' 권고는 consensus_aware 안전 메커니즘(교차 방법론 이견 기반 hedging)을 훼손하므로 채택 불가.

#### [bug / low / PARTIAL] climate 모델 병합 경로 이원화 — facts.climate가 enabled 플래그 무시

- **현재**: computeClimateFacts는 strategies.yongshin.climate의 model만 병합하고 enabled를 확인하지 않아 facts.climate가 항상 산출·DSL 참조 가능(facts.ts:673-685), yongshin 정책은 별도로 enabled를 판정(yongshin.ts 내 climateEnabled). 유파 DSL 룰이 climate.*를 참조하면 '꺼진' 조후 데이터로 발화할 수 있는 내부 비정합.
- **표준**: 룰 작성자 관점에서 facts의 활성 상태와 정책의 활성 상태가 일치하거나, facts에 enabled 메타가 함께 실려야 혼동이 없음.
- **근거**: lib/saju-ts/src/rules/facts.ts:673-685, lib/saju-ts/src/rules/yongshin.ts:614-616
- **권고**: facts.climate에 enabled 플래그를 포함시켜 DSL에서 `climate.enabled` 조건을 걸 수 있게 하거나, 문서에 '항상 산출되는 정보성 팩트'임을 명시.
- **검증 정정**: 정정: 이것은 결함(bug)이 아니라 의도된 계층 설계(기술적 facts는 항상 산출, 정책 enabled는 용신 산출에만 적용)에 남은 문서화·메타데이터 공백이다. 실재하는 유효한 지적은 두 가지로 축소된다: (a) facts.climate에 유파의 조후 채택 여부(enabled)가 노출되지 않아 커스텀 DSL 룰 작성자가 `climate.enabled` 조건을 걸 수 없고, (b) 같은 결과 객체 안에서 yongshin.base.climate는 enabled로 게이트되는데 facts.climate는 항상 존재하는 비대칭이 룰 작성자에게 혼동을 줄 수 있다(현재 독스트링은 미러링 목적만 밝히고 enabled와 무관함은 명시하지 않음). 출하된 팩에는 climate.*를 참조하는 DSL 룰이 없어 현재 동작 결함은 없다. kind는 bug가 아니라 design/docs, 권고안 중 'enabled 메타 포함 또는 문서 명시'는 여전히 타당하다.

**미검증 (low/enrichment 위주 — 착수 전 개별 확인 필요):**

#### [missing / medium / 미검증] 상신(相神)·순용/역용·성격/파격 판정 체계 부재 — 격국 운용의 핵심 논리 미구현

- **현재**: 격국 품질은 clarity(투간 격차·정합)·integrity(월지 충형해파 damage) 연속 지표뿐(facts.ts:2130-2288). 사길신(재·관·인·식) 순용/사흉신(살·상·효·인) 역용 구분, 격을 성격시키는 상신 식별, 십신 구조 기반 성격/파격 판정(예: 칠살격+식신제살=성격, 정관격+상관견관=파격)이 없음. typeAware 상관견관 감쇠는 종격 팩 한정(facts.ts:1176-1590). '일간-격-상신' 3자 구도 출력 불가.
- **표준**: 자평진전 표준: 격 확정 후 순용·역용과 상신 유무로 성격/파격을 가리고, 유정·유력으로 고저를 매김. 현대 실무도 격을 '그릇·직업 적성' 틀로 쓸 때 성격/파격 여부는 서사의 핵심.
- **근거**: lib/saju-ts/src/rules/facts.ts:2130-2288, defaultRuleSets.ts:28-37. 표준 출처: kakaochips.com/46, KCI ART002857934 (격국용신=상신 체계)
- **권고**: 월지 격 십성 × 천간 투출 십성 조합의 성격/파격 룰 테이블(순용·역용 기반)을 DSL 룰셋으로 추가하고, 상신 후보를 basis에 노출. 기존 quality.multiplier와 병행 가능(연속 지표 + 이산 판정).

#### [missing / low / 미검증] 종세격(從勢格) 서브타입 부재

- **현재**: JonggyeokSubtype은 cong_cai/guan/sha/er/yin/bi + zhuan_wang/hua_qi 8종(gyeokguk.ts:135-143 재확인). 재·관·식 혼합 세력에 종하는 종세격이 없어 해당 명식은 단일 종격 후보들로 분산 평가됨.
- **표준**: 표준 종격 분류는 종왕·종강·종아·종재·종살·종세 6종(임철초 적천수천미 계열). 종세격은 특정 십성 하나가 아닌 혼합 세력 전체에 종하는 별도 유형.
- **근거**: lib/saju-ts/src/rules/gyeokguk.ts:133-158 (재확인). 표준 출처: unsename.com/pds4.php?prc=read&idx=90
- **권고**: followTenGodSplit이 이미 산출되므로 재+관+식 합산 세력 기준 cong_shi 서브타입을 추가하는 것은 저비용. 종격 자체가 기본 비활성이므로 우선순위는 낮음.

#### [enrichment / medium / 미검증] 용신 방법별 근거(base.*)가 최종 출력·레거시 브릿지에서 전량 탈락 — 설명가능성 미활용

- **현재**: climate env/need, medicine excess, tongguan pairs·dominance, follow potential, johooTemplate primary/reasons, effectiveWeights 등 방법별 디버그가 항상 산출되지만(yongshin.ts:1298-1377) summary.yongshin은 best/ranking/strengthIndex/consensus만 노출(engine.ts:234-241), springLegacy yongshinResult는 이를 전혀 읽지 않음. '겨울생이라 火가 필요' 같은 표준 감명 서사의 근거 데이터가 report.facts에 묻힘.
- **표준**: 전문 감명은 용신 결론과 함께 방법별 근거(신강신약 판정 → 억부 방향, 계절 → 조후 필요)를 제시하는 것이 표준. 데이터는 이미 존재.
- **근거**: lib/saju-ts/src/rules/yongshin.ts:1298-1377, lib/saju-ts/src/api/engine.ts:234-241, springLegacy.ts:1143-1157
- **권고**: summary.yongshin에 methodBreakdown(방법별 최선 오행+한줄 근거) 필드를 추가하고 springLegacy recommendations[].reasoning을 base.*에서 생성하도록 연결.

#### [enrichment / medium / 미검증] 격국 basis(월지격 십성·선정방법·청탁/파격 품질 상세)가 summary 미노출 — 격국 서사 재료 사장

- **현재**: GyeokgukResult.basis(monthGyeokTenGod/Method/SelectionRule/Quality)와 quality.details(gap/damageByType/damageRelations), scores 19키 전체가 산출되지만 summary.gyeokguk은 best/ranking/jonggyeokCandidates만 노출(engine.ts:242-247, gyeokguk.ts:168-182 재확인). '월지 본기 투간으로 정관격, 다만 월지 충으로 격이 손상' 같은 표준 설명이 다운스트림에서 불가(springLegacy가 report.facts를 파서 일부만 복원).
- **표준**: 격국 감명의 표준 서사는 취격 근거(투간/회지)와 파격 요인(형충파해)을 함께 제시하는 것. 엔진이 이미 정확히 이 구조로 계산함.
- **근거**: lib/saju-ts/src/rules/gyeokguk.ts:160-187 (재확인), lib/saju-ts/src/api/engine.ts:242-247, facts.ts:2130-2288
- **권고**: summary.gyeokguk에 basis 요약(선정 방법, 품질 등급, 손상 관계 목록)을 포함시키고 레거시 gyeokgukResult.reasoning을 damage/method 기반 문장으로 강화.

#### [enrichment / low / 미검증] 전왕·화기격의 고전 명칭 세분 미노출 (곡직·염상·가색·종혁·윤하 / 갑기합토격 등)

- **현재**: 전왕은 단일 ZHUAN_WANG 키, 화기는 단일 HUA_QI 키로만 출력(defaultRuleSets.ts:40-102 재확인). 지배 오행(oneElement)·합화 조합(transformations.best) 데이터는 facts에 있으므로 곡직격(목)/염상격(화)… 및 갑기합토격 등 사용자 친화적 고전 명칭 도출이 가능하지만 미수행.
- **표준**: 표준 분류는 일행득기격 5종(곡직·염상·가색·종혁·윤하)과 화격 5종(갑기합토~무계합화)의 고유 명칭 — 사용자 대면 리포트에서 신뢰·전문성 신호.
- **근거**: lib/saju-ts/src/rules/defaultRuleSets.ts:40-102 (재확인), facts.ts:822-1076 (zhuanwang 팩), facts.ts:1681-2082 (huaqi 팩)
- **권고**: 레거시 브릿지 또는 summary에서 oneElement 지배 오행 → 5격 명칭, transformations.best 합화쌍 → 5화격 명칭 매핑 테이블 추가(계산 변경 불필요).

### 신살

**검증 완료 (적대적 검증 통과):**

#### [bug / high / CONFIRMED] 신살 품질모델(enabled/applyToNames/카테고리·이름별 오버라이드)이 전부 죽은 코드 — sanmingtonghui 스쿨팩의 감쇠 비활성이 무효

- **현재**: resolveQualityModelForDetection(shinsal.ts:352)이 정의만 되고 어디서도 호출되지 않음(grep 결과 정의 1건뿐, 직접 재확인). 실제 감쇠 경로 applyQualityModel(shinsal.ts:467-604)은 excludeNames와 명시적 qualityWeight만 본다. 따라서 builtin 'sanmingtonghui' 팩의 strategies.shinsal.conditions.enabled=false(builtin.pack.json:439)가 무효이고, 카테고리 기본값 RELATION_SAL/VOID enabled:false(shinsalConditionsBasePack.ts:70-73)도 미적용. GEOKGAK_SAL은 excludeNames에 없어 관계살인데도 감쇠 대상이 된다.
- **표준**: 스쿨팩이 신살 감쇠를 끄면 실제로 꺼져야 하고, 카테고리·이름별 오버라이드가 detection별 감쇠 적용 여부를 결정해야 한다. 학파 선택이 결과에 반영되는 것이 스쿨팩 시스템의 존재 이유.
- **근거**: lib/saju-ts/src/rules/shinsal.ts:352(정의), 467-604(미호출·L475 excludeNames만 사용); lib/saju-ts/src/schools/packs/builtin.pack.json:439; lib/saju-ts/src/rules/packs/shinsalConditionsBasePack.ts:70-73,85
- **권고**: applyQualityModel 루프에서 detection마다 resolveQualityModelForDetection을 호출해 applyConditions=false면 감쇠를 건너뛰도록 배선. GEOKGAK_SAL을 excludeNames 기본값에 추가하거나 RELATION_SAL 카테고리 판정으로 흡수. 배선 후 sanmingtonghui 팩 golden 케이스가 실제로 달라지는지 확인 필요(현재 골든은 죽은 코드 상태를 정답으로 고정하고 있음).

#### [bug / high / CONFIRMED] 월덕/천덕 scope 설정(monthDeokScope·catalogScopes)이 파싱만 되고 미적용 — shinsal.virtueStrict 팩이 완전 no-op

- **현재**: scopeForMonthBranchStemKey(facts.ts:2829)·intersectScope(facts.ts:2847) 등 scope 헬퍼가 정의만 되고 호출부 0건(직접 grep 재확인). 카탈로그 매칭 루프는 무조건 4주 전체를 스캔하고 scopePillars 필드(facts.ts:601,614)는 타입 선언만 있고 영원히 undefined. builtin 'shinsal.virtueStrict' 팩(월덕류를 일간만 인정, builtin.pack.json:638-643)이 아무 효과 없음.
- **표준**: 천덕·월덕은 '일간이나 일지에 임할 때 가장 귀하다'는 관행이 있고 일간 한정파가 실존하는 이설 지점 — scope 설정이 실제 매칭 범위를 좁혀야 한다. 설정이 조용히 무시되는 것은 어느 학파 기준으로도 오류.
- **근거**: lib/saju-ts/src/rules/facts.ts:2829,2847(정의만, 호출 0건), 2857-2861·2902-2913(scope 무시 루프), 601·614(scopePillars 미채움); lib/saju-ts/src/schools/packs/builtin.pack.json:638-643
- **권고**: monthBranchStem/monthBranchBranch 카탈로그 매칭 루프에서 scope 헬퍼를 호출해 스캔 대상 기둥을 제한하고 scopePillars를 채우기. virtueStrict 팩 활성 시 결과가 달라지는 단정 테스트 추가.

#### [missing / high / CONFIRMED] 고신살(孤辰)·과숙살(寡宿) 부재 — 한국 실무 최다 빈도급 신살

- **현재**: saju-ts·spring-ts 엔진 소스 전체에 고신/과숙 계산 코드 0건(grep 재확인: 매칭은 생성 데이터 JSON과 문서뿐). 년지(또는 일지) 방합군 기준 인접 생지/고지 대조라는 단순 수식인데 카탈로그·룰 어디에도 없음.
- **표준**: 고신·과숙은 한국 상담 실무에서 배우자·고독 인연 통변의 최상위 빈도 신살로, 전문 만세력 앱이 기본 표기하는 항목. 방합군(亥子丑→寅/戌 식) 기준 조견표로 기계적 산출 가능.
- **근거**: grep '고신|과숙|孤辰|寡宿' → lib/saju-ts/src, lib/spring-ts/src 0건; 표준 근거: 한국 실무 만세력 공통 표기 항목(전문 표준 조사 결과 '카탈로그에 없는 주요 신살' 필두)
- **권고**: 년지(주류) 기준 방합군 조견표를 shinsalBaseCatalog 또는 twelveSal류 계산 신살로 추가. 일지 기준 병용은 12신살 앵커 패턴을 재사용하면 됨.

#### [missing / high / CONFIRMED] 귀문관살(鬼門關殺) 부재 — 원진과 별개 개념인데 원진만 지원

- **현재**: WONJIN_SAL(6조합)만 관계살로 지원. 귀문관살(子酉·丑午·寅未·卯申·辰亥·巳戌)은 코드베이스 전체 0건. 귀문 전용 조합인 子酉·寅未는 현재 엔진이 어떤 이름으로도 잡지 못함.
- **표준**: 귀문은 심리·직관·예민함 통변의 핵심으로 현대 한국 상담에서 원진보다 오히려 사용 빈도가 높은 축. 원진(대인관계 애증)과 귀문(본인 심리)을 구분해 통변하는 것이 표준 관행이며, 4개 조합이 겹치지만 별개 신살로 병기하는 것이 다수설.
- **근거**: grep '귀문|鬼門' → lib/saju-ts/src 0건; lib/saju-ts/src/rules/defaultRuleSets.ts:265-272(관계살 목록에 원진까지만); 표준: 귀문 6종 다수설(子酉·丑午·寅未·卯申·辰亥·巳戌)
- **권고**: buildRelationSalRules 패턴으로 GWIMUN_SAL 추가(6조합 다수설 기본, 8종 확장은 전략 옵션). 인접(일지 중심 월지·시지) 가중은 matchedPillars 인프라로 표현 가능.

#### [enrichment / high / CONFIRMED / 기지] 신살의 앉은 기둥(matchedPillars)이 springLegacy에서 버려지고 position은 궁위가 아닌 산출기준(basedOn)

- **현재**: 엔진은 matchedPillarsForBranchTarget/StemTarget(shinsal.ts:430-448)으로 앉은 기둥을 정확히 계산해 summary.shinsalHits[].matchedPillars(engine.ts:270)까지 내보내지만, springLegacy가 hit을 {type, position, grade}로 축약하며 matchedPillars를 완전히 드랍(springLegacy.ts:1041-1062). position은 relationPositionFromBasedOn(basedOn)의 산출기준(springLegacy.ts:438-444)이라 궁위 통변에 못 쓴다.
- **표준**: 근묘화실 궁위 통변(년=조상/초년, 월=부모/청년, 일=배우자/중년, 시=자녀/말년)이 신살 해석의 표준 2단계 — 같은 도화라도 년지(장내도화)와 시지(장외도화)는 완전히 다른 글이 된다. 데이터는 이미 있는데 소비 레이어 직전에서 소실.
- **근거**: lib/saju-ts/src/rules/shinsal.ts:430-448; lib/saju-ts/src/api/engine.ts:270; lib/saju-ts/src/compat/springLegacy.ts:438-444, 1041-1062
- **권고**: springLegacy hit 축약에 matchedPillars(seatPillars)를 통과시키고, 콘텐츠 레이어에서 궁위×신살 통변 축을 활성화. 기존 HANDOFF의 '귀인 궁위 seatPillars 설계' 스펙과 합치.

#### [bug / medium / CONFIRMED] 12신살이 년지·일지 두 앵커에서 같은 이름으로 이중 방출 — 동일 삼합군이면 scoresAdjusted 2배 집계

- **현재**: 12신살 룰이 YEAR_BRANCH/DAY_BRANCH 각각 생성되어(defaultRuleSets.ts:299-307, 직접 재확인) 년지와 일지가 같은 삼합군이면 동일 타깃 detection이 2건 생기고, shinsalScoresAdjusted가 name 키로 합산(shinsal.ts:571-575)되어 중복 없이 2배가 된다. springLegacy dedupe 키가 (type,position)이라 YEAR/DAY 둘 다 생존.
- **표준**: 년지·일지 병용은 실무 표준이지만, 병용의 의미는 '어느 기준으로든 걸리면 성립'이지 '두 기준에서 걸리면 2배 강함'이 아니다. 동일 타깃 지지에 대한 이중 계상은 점수 기반 등급·선별을 왜곡한다.
- **근거**: lib/saju-ts/src/rules/defaultRuleSets.ts:299-307; lib/saju-ts/src/rules/shinsal.ts:571-575; lib/saju-ts/src/compat/springLegacy.ts:1055-1059
- **권고**: scoresAdjusted 집계 시 (name, targetBranch) 단위로 dedupe하거나, 양 앵커 성립을 별도 플래그(bothAnchors)로 승격해 서사 소재로 쓰되 점수는 1회만 계상.

#### [bug / medium / CONFIRMED] 일간 기준 귀인 15종의 basedOn이 'OTHER'로 하드코딩 — 산출기준 정보 소실

- **현재**: buildCatalogDayStemRules가 basedOn:'OTHER'를 하드코딩(shinsalRuleCompiler.ts:156)하고 ShinsalBasedOn 타입에 DAY_STEM 값 자체가 없음(shinsal.ts:18). 천을귀인·문창·양인 등 일간 기준 신살 전부가 다운스트림에서 관계살과 구분 불가, springLegacy position도 전부 'OTHER'.
- **표준**: 일간 기준은 귀인류의 정체성('당신의 일간 甲이 지지 丑을 만나…'라는 설명의 뼈대). 산출기준이 보존되어야 '일간 기준 귀인'과 '지지 관계살'을 다른 문법으로 서술할 수 있다.
- **근거**: lib/saju-ts/src/rules/shinsalRuleCompiler.ts:156; lib/saju-ts/src/rules/shinsal.ts:18; lib/saju-ts/src/compat/springLegacy.ts:438-444
- **권고**: ShinsalBasedOn에 DAY_STEM(및 MONTH_BRANCH 대칭으로 YEAR_STEM) 추가하고 컴파일러에서 배선. springLegacy position 매핑은 하위호환 위해 OTHER 유지하되 새 필드로 노출.

#### [bug / low / CONFIRMED] GONGMANG_DAY 룰은 논리상 절대 발화 불가한 죽은 룰

- **현재**: 일지는 자기 순(旬) 안에 있으므로 자기 순의 공망일 수 없는데, 일주 순공 기준 GONGMANG_DAY 룰이 존재(defaultRuleSets.ts:323 직접 확인). 무해하나 룰 표면의 내부 모순.
- **표준**: 발화 불가능한 룰은 없어야 하며, 일지 공망은 년주 기준으로만 판정 가능하다는 도메인 사실이 룰 구조에 반영되어야 한다.
- **근거**: lib/saju-ts/src/rules/defaultRuleSets.ts:323; lib/saju-ts/src/rules/facts.ts:2557-2564
- **권고**: 룰 삭제 또는 위 finding의 년주 기준 룰로 교체.

**미검증 (low/enrichment 위주 — 착수 전 개별 확인 필요):**

#### [missing / medium / 미검증] 흉살군 부재: 현침살·탕화살·급각살·천라지망·단교관살·음양차착·십악대패·고란살

- **현재**: 코드베이스 전체 0건(grep 재확인). 모두 단순 조견표/글자집합 판정이라 기존 카탈로그 4종 테이블(dayStem/dayPillar 등) 형식이나 소규모 확장으로 수용 가능한데 없음.
- **표준**: 현침(甲辛卯午申 글자집합)·탕화(일지 丑寅午)·급각(월지 계절→지지쌍)·천라지망(戌亥/辰巳 인접)은 한국 만세력 앱의 기본 표기군이고, 직업 적성(의료·소방 등) 업상대체 통변으로 현대 감명에서 활용도가 높다.
- **근거**: grep '현침|탕화|급각|천라|懸針|湯火' → lib/saju-ts/src, lib/spring-ts/src 0건; 표준 조견표: 급각(寅卯辰월→亥子 등 4계절표), 탕화(일지 丑寅午), 현침(甲辛卯午申 5자 표준)
- **권고**: 우선순위: 현침·탕화·천라지망(간략법) > 급각 > 나머지. 급각살은 월지 기준이라 monthBranchBranch 테이블 형식에 맞고, 현침은 글자집합 카운트형이라 새 매크로 1개 필요.

#### [missing / medium / 미검증] 암록(暗祿)·협록(夾祿) 부재 — 록 계열이 록신·금여만 있고 반쪽

- **현재**: 카탈로그에 LOK_SHIN(건록)·금여(록전이위)는 있으나 암록(건록의 육합지: 甲→亥…)·협록(건록 앞뒤 쌍)이 없음. 코드베이스 0건.
- **표준**: 암록은 '남모르는 조력·마르지 않는 재물'로 만세력 표준 표기 길신이며 록 기준 기계적 산출(이설 거의 없음)이라 구현 비용이 가장 낮은 축. 록신·금여·암록·협록이 한 계열로 묶여 통변된다.
- **근거**: grep '암록|夾祿|협록|暗祿' → lib/saju-ts/src 0건; lib/saju-ts/src/rules/packs/shinsalBaseCatalog.ts(록신·금여만 존재); 표준: 암록=건록과 육합하는 지지
- **권고**: dayStem 테이블에 AM_ROK(甲亥 乙戌 丙申 丁未 戊申 己未 庚巳 辛辰 壬寅 癸丑) 추가. 협록은 2글자 동시 존재 조건이라 dayPillar류와 다른 매크로가 필요하니 후순위.

#### [missing / medium / 미검증] 대운·세운 대비 신살(삼재·상문/조객 등) 전무 — 신살이 명식 4주에 갇힘

- **현재**: 엔진의 신살 산출은 명식 4주만 대상. 삼재(년지 삼합군 대 세운 지지), 상문/조객(년지 대 세운 ±2) 등 유년 대비 신살이 코드베이스 0건.
- **표준**: 삼재는 한국 대중 인지도 최상위 신살로 '올해 삼재인가'가 상담 단골 질문. 세운 지지 하나만 입력받으면 조견표로 즉시 판정 가능한데 입력 축 자체가 없다.
- **근거**: grep '삼재|喪門|상문|조객' → lib/saju-ts/src 0건; lib/saju-ts/src/rules/facts.ts(신살 facts가 pillars 4주만 참조)
- **권고**: 세운/대운 지지를 받는 신살 산출 진입점을 추가(명식 신살과 분리된 transit 카테고리). 리포트의 '올해 흐름' 섹션 소재로 직결되는 투자 대비 효과 큰 축.

#### [enrichment / medium / 미검증] 감쇠 트레이스(qualityReasons·conditionPenalty·penaltyParts)가 summary·legacy로 미노출

- **현재**: per-detection 조건 트레이스가 계산·저장되지만(shinsal.ts:578-598) report.facts['rules.conditions']에만 잔존하고 summary로 안 나감. springLegacy는 grade만 남기고 qualityReasons·conditionPenalty를 드랍(springLegacy.ts:1041-1062). invalidated detection도 양쪽 summary에서 필터링(engine.ts:253,261).
- **표준**: '도화가 있으나 충을 맞아 약하다'는 감쇠 사유야말로 전문가 감명의 질감 — 성립/불성립 이분법보다 '있는데 흔들린다'가 개인화 서사의 핵심 소재. 계산은 이미 다 되어 있음.
- **근거**: lib/saju-ts/src/rules/shinsal.ts:578-598; lib/saju-ts/src/api/engine.ts:253,261; lib/saju-ts/src/compat/springLegacy.ts:1041-1062
- **권고**: shinsalHits에 qualityWeight와 사유 코드(CHUNG/GONGMANG 등)를 실어 콘텐츠 레이어가 '약화된 신살' 변주를 쓸 수 있게 노출. invalidated도 별도 목록으로 내보내면 '거의 성립' 서사 가능.

#### [missing / medium / 미검증] 해공(解空) 미구현 — 공망이 형·충·합을 만나면 풀린다는 통설이 없음

- **현재**: 공망은 기둥별 성립 판정(defaultRuleSets.ts:317-326)과 다른 신살 감쇠 페널티(defaultShinsalConditions.ts:80-88)로만 쓰이고, 공망 지지가 형·충·합(삼합·방합·육합)을 만나 해공되는 로직이 없다. 공망 detection 자체는 조건 감쇠에서 excludeNames로 제외되어 항상 만점 성립.
- **표준**: 해공은 통설(고전·현대 공통)로, 공망 통변의 절반은 '풀렸는가'에 있다. 현재는 합으로 풀린 공망도 풀리지 않은 공망과 동일하게 방출되어 과잉 통변 위험.
- **근거**: lib/saju-ts/src/rules/defaultRuleSets.ts:317-326; lib/saju-ts/src/rules/defaultShinsalConditions.ts:80-88(공망이 감쇠 '원인'으로만 존재); 표준: 해공(형충합 시 공망 해소)은 통설
- **권고**: GONGMANG detection에 대해 chart.relations의 합/충/형 대상 여부를 조건 룰셋으로 평가해 qualityWeight를 낮추거나 'resolved' 플래그를 달기. 기존 조건 인프라 재사용 가능(excludeNames에서 GONGMANG을 빼고 전용 조건 추가).

#### [missing / medium / 미검증] 신살 배속표·수식에 대한 단정 유닛테스트 전무(골든 스냅샷만)

- **현재**: lib/saju-ts 테스트 6개 중 신살 접점은 golden.test.ts의 스냅샷 비교뿐(golden.test.ts:55-65). 천을귀인 조견표, 공망 수식, 12신살 오프셋, matchedPillars, 감쇠 로직에 대한 단정 테스트 0건. 위의 죽은 코드 2건(품질모델·scope)이 발견되지 않은 직접 원인.
- **표준**: 조견표는 이설이 문서화된 정답이 존재하는 영역 — 일간 10개×신살 15종 조합을 표 그대로 단정하는 테스트가 표준 관행이고, 스쿨팩 on/off 차이 테스트가 죽은 설정을 즉시 잡아낸다.
- **근거**: lib/saju-ts/src/golden.test.ts:55-65; Glob '**/*shinsal*.test.ts' → 0건
- **권고**: ①조견표 단정(주류 표 대비), ②공망 6순 전수, ③12신살 4삼합군 전수, ④스쿨팩 활성 시 출력 차이 존재 단정 — 4종 테스트를 죽은 코드 수리와 같은 PR로 추가.

#### [missing / low / 미검증] 음간 양인이 기본 설정에서 양인과 동일 이름으로 방출 — 주류(양간 한정)와 다른 이설이 무표기 기본값

- **현재**: yanginMode 기본 'luNext'가 음간에도 록+1을 적용(facts.ts:2731-2733 직접 확인: delta는 diWang+음간일 때만 -1)해 乙→辰, 丁→未 등 음인이 YANG_IN이라는 같은 이름으로 방출된다. 음인/양인 구분 라벨이 없다.
- **표준**: 한국 주류는 '양인은 양간에만 있다'(양간 5개만 인정)이며, 음인(록전일위설)은 인정하더라도 작용이 약한 참고용으로 별도 표기하는 것이 관행. 이설 채택 자체는 설계 선택이나, 주류 사용자가 보면 '乙일간에 양인?'이라는 신뢰 이슈가 된다.
- **근거**: lib/saju-ts/src/rules/facts.ts:2722-2738(luNext가 음간에도 +1); 표준: 양간 한정이 주류, 음인 관대지설(乙辰 丁未 己未 辛戌 癸丑)은 이설 — 코드의 음간 결과는 이설 표와 정확히 일치
- **권고**: 음간 방출 여부를 전략 옵션(yangOnly 기본)으로 분리하거나, 음간일 때 EUM_IN 등 별도 이름/플래그로 방출해 콘텐츠 레이어가 강도를 낮춰 서술하게 하기. 이는 이설 정리이지 계산 오류는 아님.

#### [missing / low / 미검증] 괴강 한국 통용 5주 세트(壬戌 포함, 사주첩경설)를 선택할 수 없음

- **현재**: 기본 4주(戊戌·庚辰·庚戌·壬辰)는 고전 표준과 일치하나, includeExtendedPillarSets 확장이 戊辰·壬戌을 한 덩어리로만 추가해 4주 아니면 6주만 가능. 한국에서 널리 통용되는 사주첩경 5개설(+壬戌만)을 구성할 수 없다.
- **표준**: 『사주첩경』 계열 5개설(壬戌 추가)이 한국 실무에서 광범위하게 쓰이고 6개설(戊辰까지)은 근거가 약하다고 평가됨 — 5주가 선택 가능해야 이설 대응이 완결된다. 기본 4주 자체는 주류와 일치하므로 문제없음(이설 대응 범위 이슈).
- **근거**: lib/saju-ts/src/rules/packs/shinsalBaseCatalog.ts:355-368(extended가 戊辰·壬戌 일괄); 표준: 연해자평·삼명통회 4주, 사주첩경 +壬戌 5주(한국 통용), 6주설은 근거 약함
- **권고**: includeExtendedPillarSets를 간지 단위 목록(예: ['壬戌'])으로 받거나 괴강 세트 프리셋(classic4/korean5/wide6)을 제공.

#### [missing / low / 미검증] 년주 기준 공망 병용 부재 — '일지가 공망인지'를 볼 수 없음

- **현재**: 공망은 일주 순공만 계산(facts.ts:2557-2564)하고 룰도 일주 기준뿐. 년주 기준 공망이 없어 일지(배우자궁) 공망 판정이 원천적으로 불가능하다(일주 기준으로는 GONGMANG_DAY가 논리상 영원히 미발화).
- **표준**: 현대 주류는 일주 기준이 맞으나, '년주 기준으로 일지가 공망인지 본다(배우자궁 인연 판단)'는 절충 관행이 널리 통용되고 양 기준 병기 만세력도 있음. 배우자궁 공망은 감명 수요가 큰 소재.
- **근거**: lib/saju-ts/src/rules/facts.ts:2557-2564(일주 순공만); lib/saju-ts/src/rules/defaultRuleSets.ts:317-326; 표준: 년주 기준은 일지 공망 확인용으로 병용
- **권고**: shinsal.gongmang.year facts를 추가하고 일지 대조 룰 1건(GONGMANG_DAY_FROM_YEAR)을 옵션으로 제공. 기존 GONGMANG_DAY 죽은 룰의 자연스러운 대체재.

#### [enrichment / low / 미검증] summary.shinsal 레거시 필드가 STEM/NONE 타깃 신살을 통째로 드랍하고, 천주귀인 시주 보너스는 점수에만 남고 흔적이 없음

- **현재**: summary.shinsal(레거시)은 active BRANCH 타깃만 통과시켜 월덕·월덕합·천덕(천간판)·덕수·괴강·백호·천사·천월덕·관계살 전부가 이 필드에서 누락(engine.ts:252-258, shinsalHits에는 존재). BONUS_CHEON_JU_HOUR는 score만 +0.5이고 detection이 없어(defaultRuleSets.ts:208-220) 점수 수치와 목록이 불일치. 카탈로그 targets 원시값(일간별 배속 지지)도 summary로 전달 안 됨(facts.ts:2680-2688).
- **표준**: 소비자가 어느 필드를 읽든 같은 신살 우주가 보여야 하고, 점수에 반영된 보너스는 목록에서 추적 가능해야 한다. 배속 원리(왜 이 지지인가)는 '일간 甲이 丑을 만나…' 식 설명 서사의 원료.
- **근거**: lib/saju-ts/src/api/engine.ts:252-258; lib/saju-ts/src/rules/defaultRuleSets.ts:208-220; lib/saju-ts/src/rules/facts.ts:2680-2688
- **권고**: summary.shinsal을 deprecated로 명시하고 shinsalHits로 일원화. 천주 시주 보너스는 detail 플래그가 달린 detection으로 승격. targets를 hits에 실으면 설명형 콘텐츠의 원료가 됨.

### 파이프라인·아웃풋 표면·소비

**검증 완료 (적대적 검증 통과):**

#### [bug / high / CONFIRMED / 기지] 신살 position이 발동 궁위가 아니라 산출 기준(basedOn)이며, 실제 앉은 기둥(matchedPillars)은 폐기됨

- **현재**: springLegacy.ts의 relationPositionFromBasedOn(438-444)이 YEAR_BRANCH/DAY_BRANCH/MONTH_BRANCH를 position으로 재라벨하고 나머지는 OTHER로 뭉갬. HOUR는 존재 불가. 엔진이 계산한 matchedPillars(api/types.ts:430)·targetBranch/targetStem은 1034-1062의 {type,position,grade} 축약에서 전부 버려짐. 인사이트 카드는 이 position을 궁위처럼 소비.
- **표준**: 대중 만세력 표준은 신살을 '어느 기둥(년/월/일/시)에서 발동했는지' 기둥별로 표시한다(원광·천을귀인·포스텔러 공통). 전문 감명도 신살의 궁위(배우자궁 발동 vs 부모궁 발동)로 해석이 갈린다.
- **근거**: lib/saju-ts/src/compat/springLegacy.ts:438-444, 1034-1062; lib/saju-ts/src/api/types.ts:430; 표준 출처: 만세력 천을귀인/원광만세력 앱 표면
- **권고**: springLegacy 신살 축약부에서 matchedPillars와 targetBranch/targetStem을 additive로 통과시키고, position 필드는 '산출기준'으로 의미를 명시하거나 발동 궁위 필드를 별도 추가. MEMORY의 '작업 5 위치 세분 철회'가 이 전제 오류로 한 번 철회된 이력이 있으므로 궁위=matchedPillars 기반으로만 재구현.

#### [bug / medium / CONFIRMED / 기지] 천간 극(GEUK) 관계가 영구 0건 — 노트 라벨만 있고 코어가 방출하지 않음

- **현재**: core/stemRelations.ts:4의 StemRelationType이 'HAP' | 'CHUNG' 두 종뿐이라 극 관계는 애초에 탐지되지 않는다. springLegacy.ts:100에 GEUK('천간 극(剋) 관계') 노트가 정의되어 있으나 도달 불가능한 죽은 코드. 인사이트 카드의 cheonganRelations 소비에서 극 관계는 항상 0건.
- **표준**: 천간 관계 표시 표준은 합·충이 최소선이고, 극 관계까지 표시하는 것이 상위 앱/전문 감명 관행. 이 코드베이스는 GEUK을 표시할 의도(노트 정의)가 있었으므로 내부 모순.
- **근거**: lib/saju-ts/src/core/stemRelations.ts:4,15 (HAP|CHUNG만); lib/saju-ts/src/compat/springLegacy.ts:100 (GEUK 노트 미도달)
- **권고**: core/stemRelations.ts에 GEUK 탐지를 추가하거나(오행 상극 + 음양 동성 기준), 표시 의도가 없다면 springLegacy의 GEUK 노트를 제거해 죽은 표면을 정리.

#### [bug / medium / CONFIRMED] 득령/득지/득세 필드에 고전 정의와 다른 값이 라벨만 달고 나감 — deukse는 앞 둘의 단순합

- **현재**: springLegacy.ts:1132-1134에서 deukryeong=components.companions(비겁), deukji=components.resources(인성), deukse=companions+resources. 고전 정의는 득령=월령을 얻음(월지 계절), 득지=일지·지지 통근, 득세=간지 세력 다수인데, 전혀 다른 축(십신 컴포넌트)이 재라벨되어 나가고 deukse는 독립 값도 아닌 중복 합계다. strength.components의 outputs/wealth/officers 3축은 폐기.
- **표준**: 신강약 판정 근거로 득령·득지·득세를 표기하는 것은 전문 감명 서술의 정석이며, 전문가가 월지와 대조하면 즉시 값이 틀렸음을 알아챈다(예: 실령 명조인데 deukryeong 값이 높게 나오는 모순 가능).
- **근거**: lib/saju-ts/src/compat/springLegacy.ts:1132-1134 (직접 확인: deukse: Number(components.companions ?? 0) + Number(components.resources ?? 0))
- **권고**: 엔진의 실제 득령(월령 대비 일간)·득지(통근)·득세(세력) 판정을 rules 층에서 계산해 매핑하거나, 불가하면 필드명을 companionsSupport/resourcesSupport로 정직하게 바꾸고 카드 문구도 수정.

#### [enrichment / high / CONFIRMED] 십이운성(12운성)이 계산되고도 최종 아웃풋에 전혀 노출되지 않음 — 전 만세력 앱의 베이스라인 항목 부재

- **현재**: 엔진은 summary.lifeStages와 report.facts의 lifeStages.detail(stage+index+startBranch)을 계산하지만 normalizeLegacyOutput(springLegacy.ts:903-1196)이 읽지 않는다. adapter의 extractSibiUnseong(saju-adapter.ts:2002-2010)은 rawSajuOutput.sibiUnseong을 기다리는 죽은 경로로 항상 null. 결과적으로 리포트·카드 어디에도 12운성이 없다.
- **표준**: 12운성은 원광만세력·만세력 천을귀인·하늘도마뱀·포스텔러 등 모든 대중 만세력의 공통 표시 항목(각 지지에 일간 기준 12운성, 대운·세운 간지에도 병기)이다. 없으면 사용자가 타 만세력과 비교하는 순간 '기본도 없는 서비스'로 인식된다.
- **근거**: lib/saju-ts/src/compat/springLegacy.ts:903-1196 (lifeStages 미참조); lib/spring-ts/src/saju-adapter.ts:2002-2010 (직접 확인: rawSajuOutput.sibiUnseong 부재 시 null)
- **권고**: normalizeLegacyOutput에서 summary.lifeStages를 sibiUnseong 키로 방출하면 죽어 있는 extractSibiUnseong이 그대로 살아나는 최소 변경 경로. 이후 대운·세운 간지에도 병기 확장.

#### [bug / medium / CONFIRMED] timeCorrection.dstCorrectionMinutes가 0으로 하드코딩 — 서머타임 보정이 안 된 것처럼 표기됨

- **현재**: 실제 시간 변환은 Intl + IANA Asia/Seoul(springLegacy.ts:301-325)을 경유해 1948-60/1987-88 서머타임과 UTC+8:30 시기가 정확히 반영되지만, 노출되는 timeCorrection.dstCorrectionMinutes는 1121행에서 무조건 0으로 하드코딩. 1988년생 명식에서 adjusted 시각은 맞는데 DST 보정량 표기는 0이라는 내부 모순.
- **표준**: 서머타임 보정은 전문가의 '엉터리 판별' 1순위 체크리스트이자 서비스들이 마케팅 포인트로 쓰는 항목(포스텔러 '서머타임은 물론 1~2분 미세 시차까지 보정'). 보정 내역 필드가 0이면 전문가 검수 시 미보정 서비스로 오인된다.
- **근거**: lib/saju-ts/src/compat/springLegacy.ts:1121 (직접 확인: dstCorrectionMinutes: 0), 301-325 (Intl 기반 실제 오프셋 계산)
- **권고**: resolveOffsetMinutes 결과에서 표준 오프셋(540) 대비 차이를 dstCorrectionMinutes로 산출해 채우기. 한 줄 수준의 수정으로 신뢰 신호가 복구됨.

#### [bug / low / CONFIRMED] 신살 positionMultiplier 하드코딩(1) + type|position 디듀프로 중복 발동 소거 — 가중치 모델 내부 모순

- **현재**: springLegacy.ts:1034-1062에서 shinsalHits의 positionMultiplier는 항상 1로 방출되고 weightedScore와의 관계가 형식적. type|position 키 디듀프로 같은 신살이 두 궁위에서 발동해도 1건으로 합쳐져 발동 횟수 정보가 소실됨.
- **표준**: SajuSummary 타입은 positionMultiplier·weightedScore를 의미 있는 필드로 선언하고 있어(types.ts:527-556) 소비자는 실제 가중치로 오인한다. 신살 중복 발동(예: 도화 2개)은 감명에서 강도 판단 요소다.
- **근거**: lib/saju-ts/src/compat/springLegacy.ts:1034-1062; lib/spring-ts/src/types.ts:527-556
- **권고**: 디듀프를 제거하거나 count 필드를 추가하고, positionMultiplier는 실제 값이 없으면 필드를 빼는 것이 정직하다. shinsalScores/shinsalScoresAdjusted(engine.ts:279-288) 통과와 함께 정리.

#### [bug / low / CONFIRMED] daeunInfo.boundaryMode에 대운 경계가 아닌 일경계 정책(dayBoundary)이 들어감

- **현재**: springLegacy.ts:1189(직접 확인)에서 boundaryMode: String((bundle.report?.facts as any)?.['policy.calendar']?.dayBoundary ?? '') — 대운 기산 경계(절기 boundary) 자리에 야자시/정자시 일경계 정책 문자열이 주입됨. 실제 대운 경계 상세(fortune.start의 boundary 절기 id+utcMs/deltaMs/formula)는 폐기.
- **표준**: 대운수 정밀 산출 근거(어느 절기까지 며칠, ÷3 공식)는 전문가 필수 체크리스트 항목이며 하늘도마뱀 등은 개월 단위 산출 근거를 노출한다. 잘못된 값이 들어간 필드는 향후 소비 시 오작동 원인.
- **근거**: lib/saju-ts/src/compat/springLegacy.ts:1186-1192
- **권고**: boundaryMode에 fortune.start.boundary 기반 값을 넣거나 필드 제거, 대운 기산 상세(deltaMs/formula)를 additive 통과.

**미검증 (low/enrichment 위주 — 착수 전 개별 확인 필요):**

#### [missing / medium / 미검증] 대운·세운 간지에 십신·12운성·12신살 병기 부재

- **현재**: legacy daeunPillars/saeunPillars는 stem/branch/startAge/endAge만 방출(springLegacy.ts:1074-1091, 1185-1193). 카드(life-stage-fortune, period-fortune)는 간지와 용신 대조로만 서술하고 대운 간지별 십신·12운성·12신살 표는 없음.
- **표준**: 표준 앱은 대운 8~10개 각각에 십신·12운성·12신살을 병기하고, 대운 선택 시 세운·월운이 연동 전환된다(원광 '대운에 따라 년운/월운 자동 변환', 천을귀인 '대운 나이·십신·12운성·12신살'). 유료 리포트 전문성 신호 3축 중 하나가 '대운·세운 결합 시기 판단'이다.
- **근거**: lib/saju-ts/src/compat/springLegacy.ts:1074-1091,1185-1193; 표준 출처: apps.apple.com 원광만세력/만세력 천을귀인 기능 명세
- **권고**: 일간과 대운 간지는 이미 표면에 있으므로 spring-ts 쪽에서 파생 계산(십신·12운성)으로 즉시 병기 가능. 12신살 병기는 엔진의 신살 로직 재사용 필요.

#### [enrichment / medium / 미검증] 월운(24개월)·일운(60일)이 계산되고도 폐기됨 — 대운→세운→월운 연동 표준 미충족

- **현재**: 엔진이 summary.fortune.months(24)/days(60)를 생성(engine.ts:209-226)하지만 normalizeLegacyOutput이 decades/years만 읽음(springLegacy.ts:1065-1091). 월운·일운은 아웃풋 표면에 부재.
- **표준**: 세운→월운 연동 표시가 대중 앱 표준이고, 일진 달력(일운)은 원광·천을귀인·하늘도마뱀이 제공하는 상위 표준. 전문가용은 100년 대·세·월운 연동 탐색까지 제공.
- **근거**: lib/saju-ts/src/api/engine.ts:209-226; lib/saju-ts/src/compat/springLegacy.ts:1065-1091
- **권고**: springLegacy에 months/days를 additive 통과시키면 adapter의 인덱스 시그니처 덕에 SajuSummary까지 자동 도달(gongmang 선례와 동일 패턴). 카드는 period-fortune 확장으로 소비.

#### [missing / medium / 미검증] 귀문관살·천라지망 부재 — 상위 만세력 표준 관계/신살 2종 미구현

- **현재**: saju-ts 전체 소스에서 귀문/GWIMUN, 천라지망 검색 0건(직접 grep 확인). 원진(WONJIN)은 branchRelations.ts에 구현되어 있으나 귀문관살과 천라지망은 관계 탐지·신살 어디에도 없음.
- **표준**: 상위 대중 앱(만세력 천을귀인)은 형충회합파해 + 원진·귀문·천라지망까지 표시하는 것이 표준. 귀문관살은 대중 인지도가 높아 부재가 눈에 띄는 항목이다.
- **근거**: grep 귀문|GWIMUN|천라지망 → lib/saju-ts/src 내 0건; lib/saju-ts/src/core/branchRelations.ts:8-30 (WONJIN까지만); 표준 출처: 만세력 천을귀인 앱 명세
- **권고**: branchRelations에 귀문 쌍(자유·축오·인미·묘신·진해·사술)을 WONJIN과 동일 패턴으로 추가하고, 천라지망(술해/진사)은 신살 조건 스펙(shinsalConditionsSpec)에 추가.

#### [missing / medium / 미검증] 형충회합의 발동 궁위(년-일 충 vs 월-시 충) 식별 불가 — 엔진 코어 수준 부재

- **현재**: DetectedRelationView/StemRelationView의 members가 지지/천간 idx만 담고(api/types.ts:277-282,451-454) 어느 기둥 간 관계인지 정보가 없다. 같은 지지가 두 기둥에 있으면 역산도 불가. legacy jijiRelations.reasoning은 항상 null(springLegacy.ts:999).
- **표준**: 전문 감명에서 충·형의 해석은 궁위가 결정한다(년-월 충=조상/부모 갈등, 일-시 충=배우자/자식 문제). 대중 앱도 명식표에서 어느 기둥 간 관계인지 시각적으로 연결해 보여준다.
- **근거**: lib/saju-ts/src/api/types.ts:277-282,451-454; lib/saju-ts/src/compat/springLegacy.ts:996 (branchCodeFromIdx만), 999 (reasoning: null 고정)
- **권고**: 코어 관계 탐지에 pillar 인덱스(YEAR/MONTH/DAY/HOUR) 소스를 members에 추가하는 엔진 레벨 작업. 신살 matchedPillars 표면화와 함께 묶으면 인사이트 카드의 궁위 서사가 한 번에 열림.

#### [enrichment / medium / 미검증] 격국·용신 판단 근거(rules.facts)가 미노출되고 유일한 산문화 모듈(narration)은 휴면 — 유료 리포트 전문성 신호 미활용

- **현재**: 조후 need(temp/moist), 월령 격 품질(clarity/integrity/qingZhuo/broken/mixed/reasons), 종격/합화/전왕 신호 수치, effectiveWeights, 변격 경쟁이 report.facts에 전부 실려 있으나 legacy 표면에는 gongmang·월지격 후보 채굴분 외 미노출. 이를 산문화하는 buildNarrationArtifact는 analysisZip.enabled(기본 off) 내부에서만 생성되고 spring-ts·프론트 소비처 0곳.
- **표준**: 유료 리포트의 전문성 신호는 '격국·용신이라는 판단 계층의 명시'(K사주 등: 격국, 용신, 대운 흐름 정밀 분석)와 판단 근거 서술이다. 전문 감명 정석 프로세스가 '월지 격 → 격의 우수함 → 용신·기신 → 신살·형충회합 종합'인데 격의 우수함(품질) 층이 통째로 숨어 있다.
- **근거**: lib/saju-ts/src/compat/springLegacy.ts:674-764 (gongmang·격 후보만 채굴); lib/saju-ts/src/narration/buildNarration.ts:113-568; lib/saju-ts/src/artifacts/analysisZip.ts:79 (기본 off)
- **권고**: gongmang 선례대로 report.facts에서 격국 품질(clarity/integrity)과 조후 need를 legacy 단계에서 채굴해 노출하고, narration은 analysisZip과 분리해 리포트 부록(전문가 모드)으로 재활용 검토.

#### [missing / low / 미검증] 공망이 일주 기준만 산출 — 년주 기준 공망 병기 표준 미충족

- **현재**: rules/facts.ts의 gongmang이 { day: shinsalGongmangOfDayPillar(pillars.day) }로 일주 기준만 계산(facts.ts:544, 3338, 직접 확인). 년주 기준 공망은 어디에도 없음.
- **표준**: 상위 만세력(만세력 천을귀인)은 년주 기준과 일주 기준 공망을 병기하는 것이 표준. 일주 기준 단독은 틀린 것은 아니나(자평 주류) 병기 대비 표면이 얇다.
- **근거**: lib/saju-ts/src/rules/facts.ts:544,3104-3108,3338; 표준 출처: 만세력 천을귀인 '년주/일주 기준 공망'
- **권고**: shinsalGongmangOfDayPillar를 년주에도 적용해 gongmang: { day, year }로 확장 — 기존 함수 재사용으로 저비용.

#### [missing / low / 미검증] 명궁(命宮)·태원(胎元) 미구현 — 전문가용/심화 신호 항목 부재

- **현재**: lib 전체 grep에서 명궁·태원 계산 코드 0건(spring-ts 글감 JSON의 서사 텍스트만 존재). core/palace.ts는 궁위(년주=조상궁류) 해석이지 명궁 산출이 아님.
- **표준**: 명궁·태원은 대중 앱 기본 화면에는 없지만 만세력닷컴·궁합 특화 서비스·전문가용 프로그램이 제공하며 '전문가용/심화' 신호로 작동. 태원=월주 천간+1위·지지+3위 전진, 명궁=중기 기준 월지+시지 공식.
- **근거**: grep 명궁|태원|mingGong|taiyuan → lib/saju-ts/src 내 0건; lib/saju-ts/src/core/palace.ts는 궁위 모듈
- **권고**: 우선순위 낮음 — 12운성·월운 등 베이스라인 갭을 먼저 메운 뒤, 전문가 모드 차별화 항목으로 검토.

#### [missing / low / 미검증] 삼재(三災) 미구현

- **현재**: lib 전체에서 삼재/samjae 검색 결과는 spring-ts/docs/HANDOFF.md 문서 1건뿐, 계산 코드 없음(직접 확인).
- **표준**: 삼재는 전문가용 프로그램(명리보감·사주대전류)의 상세 표시 표준 항목이자 대중 인지도가 매우 높은 항목(년지 삼합 기준 3년 주기). 세운 카드와 결합하면 소비 지점이 명확하다.
- **근거**: grep 삼재|samjae → lib 내 코드 0건 (docs/HANDOFF.md만); 표준 출처: 투투컴퓨터 명리대전 기능 명세
- **권고**: 년지 삼합 기준 삼재 년도 계산은 수십 행 수준 — 세운(saeunPillars) 표면에 삼재 플래그로 병기하는 것이 저비용 경로.

#### [enrichment / low / 미검증] 납음오행이 옵트인(surfaceNaeum)이라 기본 아웃풋에 부재

- **현재**: naeum은 SajuSummary에 surfaceNaeum 옵트인 필드로만 존재(types.ts:527-556) — 기본 리포트 경로에서는 미노출.
- **표준**: 납음오행은 원광·천을귀인·하늘도마뱀이 각 주에 기본 표시하는 대중 앱 표준 항목이다.
- **근거**: lib/spring-ts/src/types.ts:527-556 (naeum? 옵트인); 표준 출처: 원광만세력/만세력 천을귀인 앱 명세
- **권고**: 이미 계산·배관이 끝나 있으므로 기본 on으로 전환하거나 명식표 카드에 표시만 추가하면 됨.

#### [enrichment / low / 미검증] 오행 분포의 천간/지장간 분해와 지장간 본기·중기·여기 구분이 폐기됨

- **현재**: elementDistribution.heaven/hidden 분해(api/types.ts:271-275)가 total 반올림만 노출(springLegacy.ts:972-979)되고, HiddenStemView.role(PRINCIPAL/MIDDLE/RESIDUAL)은 stem+ratio로 축약(springLegacy.ts:1023-1031).
- **표준**: 대중 앱은 지장간을 본기·중기·여기 구조로 표시하고 오행 개수를 천간/지지로 나눠 보여준다. 특히 지장간 role은 격국 취용(월지 본기 우선)의 근거라 전문 서술에 필요하다.
- **근거**: lib/saju-ts/src/compat/springLegacy.ts:972-979,1023-1031; lib/saju-ts/src/api/types.ts:271-275
- **권고**: role 필드 1개 통과(springLegacy.ts:1023-1031)로 지장간 표시가 표준화되고, heaven/hidden 분해는 오행 카드 서사를 풍부하게 함 — 둘 다 additive 저비용.

#### [enrichment / low / 미검증] adapter의 죽은 소비 경로 6종이 살아있는 표면처럼 보임 — 확장 작업 오판 위험

- **현재**: scoredCheonganRelations/resolvedJijiRelations/shinsalComposites는 legacy가 빈 배열 고정 방출(springLegacy.ts:1174-1183, 직접 확인), hapHwaEvaluations/sibiUnseong/palaceAnalysis는 legacy가 아예 방출하지 않아 adapter 추출기(saju-adapter.ts:1905-2044)가 항상 null/빈 값. 타입과 추출기만 보면 연결된 것으로 오인된다.
- **표준**: 합화 평가·해소된 형충회합(resolvedJijiRelations)은 전문 감명의 '합충 상쇄' 서술에 필요한 표면이고, 엔진에는 관련 계산(patterns.transformations 등)이 존재한다.
- **근거**: lib/saju-ts/src/compat/springLegacy.ts:1174-1183 (빈 배열 고정); lib/spring-ts/src/saju-adapter.ts:1905-2044
- **권고**: 12운성(sibiUnseong)처럼 엔진 데이터가 이미 있는 것부터 legacy에서 채워 죽은 경로를 살리고, 채울 계획이 없는 필드는 제거해 표면을 정직하게 유지. springLegacy/narration 전용 테스트가 0개인 상태이므로 이 작업 전 회귀 테스트부터 추가 권장.

## 부록 C. 완결성 비평 (미감사 영역·모순)

### 미감사 영역 (후속 감사 후보)

- [미검토 영역] src/graph/ (evaluator.ts·graphFactory.ts·types.ts) — 전 계산이 흐르는 DAG 노드 배선·평가·trace 인프라가 8개 도메인 어디에도 매핑되지 않음. graphFactory의 배선 오류는 모든 도메인에 조용히 전파되는데 사이클 감지·노드 누락·trace 정합성 감사가 없음.
- [미검토 영역] src/schools/ (packLoader.ts·packTypes.ts·presets.ts·packs/builtin.pack.json) — 스쿨팩 로딩·alias 해석·가중치 오버라이드 메커니즘 자체가 미감사. 신살 도메인에서 팩 2개(sanmingtonghui 감쇠, virtueStrict)가 no-op으로 확인됐다는 건 '파싱은 되나 미적용' 계열 버그의 표본 2개일 뿐이며, builtin.pack.json의 프리셋별 용신 가중(tongguan·medicine·follow·johooTemplate·transformations·oneElement) 전체가 실제 엔진에 반영되는지 체계 감사가 빠짐.
- [미검토 영역] 용신 방법 자체의 반쪽 감사 — rules/yongshin.ts에는 통관(通關)·병약(medicine)·johooTemplate·transformations·oneElement 항이 구현돼 있으나(줄 56-60, 105-177) 격국·용신 도메인 findings는 억부·조후·종격만 다룸. 이들 방법의 수식 정확성과 기본 가중 0 여부가 미검토. 아울러 core/competition.ts의 softmax형 방법 경쟁(compete(): power·minKeep 플로어 승수)이 용신 합의 점수를 직접 좌우하는데 어떤 finding도 언급하지 않음.
- [미검토 영역] src/rules/dsl.ts + shinsalRuleCompiler.ts + spec/ 컴파일러 5종 — 룰 DSL의 평가 의미론(var 경로 오타 시 조용한 undefined→불발화, op 시맨틱)이 미감사. 이미 확인된 GONGMANG_DAY 영구 불발화·라벨 키 불일치가 정확히 이 클래스의 증상인데, 룰셋 var 경로 전수 대조 같은 체계 감사가 없음.
- [미검토 영역] src/api/migrations.ts(config 스키마 마이그레이션)·api/config.ts·utils/deepMerge.ts — 부분 설정 병합·버전 마이그레이션의 조용한 강제변환이 사용자 유파 설정을 기본값으로 되돌릴 수 있는 경로인데 미감사. src/artifacts/analysisZip.ts(analysis.zip 아웃풋 표면, narration 포함)도 아웃풋 도메인에서 누락.
- [미검토 계산축] 음양 균형(陰陽 비율) 분석 — core/scoring.ts에 YinYangScore, core/tally.ts에 YinYangTally가 구현돼 있으나 core 밖 소비자가 0곳(grep 확인)이고 springLegacy·SajuSummary에 yinYang 집계가 전무. 만세력 기본 표기 항목(음양 개수·한쪽 편중 체질)인데 8개 도메인 findings 어디에도 음양 축 언급이 없음 — 유일하게 완전히 빠진 베이스라인 축.
- [미검토 계산축] 육친론(六親) — 십신↔육친(부친=편재, 모친=정인, 남편=관성 등) 배속과 궁위 결합 해석 축이 어느 도메인에도 없음. palace.ts 버그 findings는 있으나 궁성론의 실제 소비 목적인 육친 배속 산출 자체가 미다룸.
- [미검토 계산축] 묘고(墓庫)·입묘(入墓)·개고(開庫) — 辰戌丑未 고지 입묘 판정과 충에 의한 개고는 현대 한국 실무 고빈도 축(재고·관고)인데 관계 도메인·신살 도메인 모두 미언급.
- [미검토 계산축] 개두(蓋頭)·절각(截脚) — 같은 기둥 내 천간-지지 상극 판정(특히 대운 간지 해석의 표준 재료). 천간 극 6종 부재 finding과 인접하지만 기둥 내부 수직 관계는 별개 축으로 어디에도 없음.
- [미검토 계산축] 암합(暗合)·공협(拱夾) — 지장간 개입 합. 관계 도메인이 요합(遙合)은 다뤘으나 암합은 미언급.
- [미검토 계산축] 대운↔세운 상호 관계 — 운-원국 관계는 존재가 확인됐고 '대운·세운 대비 신살 전무' finding도 있으나, 대운과 세운끼리의 합충(세운충대운 등) 축은 미다룸.
- [미검토 계산축] 절기 시각의 외부 기준 대조 — calendar/solar.ts는 VSOP87+ΔT(NASA 다항식)로 구현돼 있으나 KASI/한국 만세력 절기 시각과의 대조 검증이 없음. '진태양시 end-to-end 테스트 전무' finding이 부분적으로 걸치지만 월주 경계(절입 부근 출생)의 정답 검증 축으로 명시 감사가 필요.

### 발견 간 모순·중복 (본문 집계에 반영됨)

- [사실 모순 — 코드로 판정] 파이프라인 finding '월운(24개월)·일운(60일)이 계산되고도 폐기됨' vs 기둥 finding '일운 인프라 완비 상태에서 기본 비활성(maxDays=0)'. 코드 확인 결과 fortune/policy.ts DEFAULT_POLICY가 maxMonths=24, maxDays=0이고 리포 전체에서 maxDays를 0 초과로 설정하는 곳이 없음 — 일운은 기본·프로덕션 어느 경로에서도 계산되지 않음. 기둥 finding이 맞고 파이프라인 finding의 '일운 60일 계산' 부분은 오류(월운 24개월 부분만 사실).
- [프로브 서술 vs findings 다수] 런타임 프로브의 '원시 saju-ts 출력(coreResult/strengthResult/...)이 spread로 통째로 노출' 서술은 '버려짐/미노출' 계열 findings(base.* 근거, delingdiShi 분해, matchedPillars, sibiUnseong)와 충돌하는 인상을 줌. 코드 확인(springLegacy.ts 1103-1195행, saju-adapter.ts extractSaju의 ...serializedOutput): spread되는 것은 springLegacy가 손실적으로 재합성한 레거시 객체이지 saju-ts 원본 번들이 아님 — strengthResult.details는 한국어 문장 배열, yongshinResult.recommendations는 JOHU 라벨 재합성물. 따라서 '버려짐' findings가 맞고 프로브 문구('원시 출력')가 정정 대상.
- [주류 기준 불일치] 역법 finding은 주류를 '정자시설(자시 개시 23:00 일주 교체, 약 80%)'로, 기둥 finding은 한국 통설을 '23:30 KST'로 제시 — 서로 다른 기준을 각자 '주류'로 단정. 둘은 23:30 KST≈23:00 진태양시로 화해 가능하지만 감사 내 통일된 권장 경계 정책이 없고, 특히 YAZA_23_30의 -30분 시프트를 버그로 판정한 finding과 23:30 경계 재현을 요구하는 finding이 병존해 '경계만 이동 vs 인스턴트 전체 이동' 중 무엇이 정답인지 감사 자체가 답을 내리지 않음.
- [중복 판정 불일치 — 동일 결함, 다른 kind/severity/verdict] (a) 천간 극 부재: 관계 도메인 missing/high vs 파이프라인 bug/medium. (b) 신살 matchedPillars 폐기·position=basedOn: 신살 도메인 enrichment/high vs 파이프라인 bug/high. (c) dstCorrectionMinutes 0 하드코딩: 역법 enrichment/medium/unverified vs 파이프라인 bug/medium/CONFIRMED — 같은 사실인데 검증 상태가 엇갈림. (d) 귀문관살 부재: 관계 medium / 신살 high / 파이프라인 medium 3중 계상. (e) 삼재: 신살 도메인에서 운 신살 일괄 medium vs 파이프라인 단독 low. (f) 명궁·태원, 년주 기준 공망도 도메인 간 2중 계상 — 총계 집계 시 중복 제거 및 등급 단일화 필요.
- [해소 안 된 층위 긴장] 신살 '12신살 년지·일지 이중 방출로 scoresAdjusted 2배 집계' vs 파이프라인 'type|position 디듀프로 중복 발동 소거'. springLegacy의 디듀프 키는 type|position이고 position=basedOn 매핑이므로 YEAR_BRANCH/DAY_BRANCH 이중 방출은 디듀프를 통과해 레거시 hit에도 살아남음 — 즉 '디듀프가 소거한다'는 서술은 같은 basedOn 내 다중 발동에만 참이고 이중 앵커 중복에는 거짓. 두 finding을 층위 명시로 재서술해야 함.
- [사소] 역법 'JOJA_SPLIT 옵션이 midnight으로 조용히 매핑' finding은 saju-ts 코어가 이미 dayBoundary 'ziSplit23'을 지원한다는 사실(api/types.ts:65, calendar/pillars.ts:27-29)을 언급하지 않음 — 코어 기능 부재가 아니라 어댑터 매핑 한 줄 문제라는 점에서 심각도·수정비용 평가가 달라짐.

## 부록 D. 2026-07-12 후속 상태

이 부록은 2026-07-08 감사 스냅샷을 삭제하거나 소급 수정하지 않고, 커밋
`2e2252402`까지의 후속 해결 상태를 기록한다. 여기서 “해결”은 저장소 계약과
회귀 테스트 기준이며, 외부 명리·역법 권위 인증 또는 전 세계 역사 시간대의
완전성을 뜻하지 않는다.

| 기존/후속 발견 | 2026-07-12 상태 | 근거와 잔여 한계 |
|---|---|---|
| A9 `dstCorrectionMinutes=0` 고정 | 해결 | IANA 민간시 후보에서 실제 offset/DST metadata를 산출하고 legacy 결과에 전달한다. fixed offset은 DST 0으로 명시한다. |
| 1908년 이전 서울 LMT·역사 KST | 해결 | `Asia/Seoul`의 1907 LMT, 1954 UTC+8:30, 1988 DST를 대표 회귀와 런타임 canary로 검증한다. |
| B10 표준시·서머타임 무검증 의존 | 부분 해결 | 서울·뉴욕·키리티마티 대표 canary와 gap/fold 회귀를 추가했다. 자체 tzdb를 번들하지 않으며 모든 지역·시대 전수 인증은 아니다. |
| 야자시/일 경계와 시간 보정 결합 | 해결 | 시간 보정된 instant를 기준으로 일주·시주 경계를 계산하고 관련 회귀를 고정했다. |
| JOJA_SPLIT 무의미 매핑 | 해결 | 일주 경계와 시두 일간 경계를 분리해 `midnight + ziSplit23` 의미를 구현했다(`aac1b8309`). |
| “springLegacy/narration 전용 테스트 0개” | 과거 진술 | legacy 계약·실패·경도·timezone 특성화 테스트가 존재하며, 현재 전체 saju-ts 회귀에 포함된다. |
| preset 고정 자오선과 civil meridian 혼동 | 해결 | Spring 제품 기본은 출생 민간시 offset의 자오선, 135°/120° preset은 명시적 legacy 호환 정책으로 분리했다. |
| 물리 경도 덮어쓰기 | 해결 | 입력 경도를 보존하고 shortest signed longitude delta만 계산에 사용한다. |
| 부분·상충 위치 입력의 조용한 서울 fallback | 해결 | 위치 tuple을 원자적으로 검증하고, 공개 필드 간 지역 충돌·timezone 부재·해석 불가를 구조화 오류로 거부한다. |
| DST gap/fold의 임의 instant 선택 | 해결 | round-trip 후보가 0개면 gap, 복수면 fold로 구조화 거부한다. 시각 분 미상 범위에 offset 전환이 있으면 별도 거부한다. |
| raw `sajuConfig`가 제품 시간정책 우회 | 해결 | high-level 제품 정책을 최종 재적용하고 invalid runtime policy를 fail-closed 처리한다. |
| 연도 1~99가 `Date.UTC`에서 1900년대로 이동 | 해결 | literal-year UTC helper를 도입하고 요청·절기·대운·진태양시 경로와 회귀를 보강했다. |
| 진태양시 trace 수식이 실제 계산과 불일치 | 해결 | shortest longitude delta, 정책별 meridian, `off` 의미를 trace와 구현에서 일치시켰다. |
| Seed DB 자산의 런타임 무결성 미검증 | 해결 | 16개 canonical DB의 byte/schema/count manifest를 고정했다. Hanja/Fourframe와 NameStat의 선택 shard는 SHA 전검증과 opened-DB 후검증을 모두 통과한 동일 snapshot만 publish한다(`88144fb65..2e2252402`). NameStat은 완전한 14-shard pinned set만 허용하고 누락·중복·미지 shard·교차 family를 생성자에서 거부한다. loader/fetch/body/hash/open/close 경합과 cached-shard close도 cancellation 우선으로 고정했다. |
| sql.js JS/WASM 버전·배포 경계 불일치 | 해결 | Seed·Spring·브라우저 lock과 WASM을 1.14.1로 정확히 맞췄다. 검토된 WASM과 MIT notice를 Seed 패키지에 포함하고 byteLength·SHA를 fail-closed 검증하며, package-relative URL만 사용해 외부 CDN fallback을 제거했다. 실제 npm tarball을 해제한 위치에서 transport mock 없이 WASM 초기화와 SQLite 질의까지 확인했다(`352a1303c`). |
| 이름 입력의 동음 한자 대체·stale operation publish | 해결 | 명시 Hangul/Hanja가 DB identity와 다르면 구조화 거부하고, 7개 public async route는 generation lease로 close 이후 결과·cache publish를 차단한다(`1fde4adde`, `61b4206cd`). 이미 시작한 대규모 동기 scoring loop 자체를 중간 abort하지는 않는다. |
| Seed 점수·입력·조회 계약의 암묵성 | 구조 고정·교리 검토 일부 미완 | v1 점수표와 positional surname/Han 입력 검증, 결정적 SQL 순서를 고정했다. 기존 호환을 위해 보존한 same-element `-5`는 설명과의 긴장이 명시돼 있으며 전문가 검토 전 교리 정답으로 승격하지 않는다(`195bcbdde..00d3ee53d`). |

### 남은 한계와 릴리스 판정

- 글로벌 좌표→지역 geocoder나 timezone polygon 검증이 없다. 따라서 임의 해외
  좌표와 IANA timezone의 지리적 일치까지 인증하지 않는다.
- 런타임 tzdb canary는 대표 표본이다. OS/Node tzdb 전체와 모든 역사적 지역의
  정확성을 대신하지 않는다.
- fixed-meridian legacy preset은 현대 한국/중국 지역 호환용이며 글로벌 기본값이
  아니다.
- 일부 저수준 직접 API는 Spring 입력 계약과 같은 민간시 범위 검증을 자체 수행하지
  않는다. 상용 진입점은 Spring의 fail-closed 경계를 사용해야 한다.
- NameStat의 커밋된 14개 DB·manifest·50,194행 초성 귀속은 전수 검증하지만,
  원본 통계 JSON은 저장소에 없어 현재 DB를 원천 데이터에서 byte-for-byte
  재생성하는 provenance 사슬은 아직 닫히지 않았다.
- 기본 sql.js WASM의 package-relative Node 경로와 실제 npm tarball 실행에 더해,
  Vite production build가 검토된 1.14.1 WASM을 `dist/assets`에 방출하고 최종 JS가
  해당 파일을 참조하는 것까지 검증했다.
  실제 배포 뒤 브라우저 fetch와 모바일 peak memory·지연 상한은 아직 미검증이다.
- NameStat은 선택 shard만 lazy 검증하지만 최대 shard는 약 24.5MB다. 진행 중
  fetch/body 취소는 구현했으나 응답은 `arrayBuffer()`로 완전히 materialize한 뒤 크기를
  검사하므로 모바일 브라우저의 peak memory·지연 실측은 후속이다.
- 기본 sql.js 성공 cache는 URL·SHA별로 프로세스 수명 동안 유지된다. 제품 기본값은 한
  항목이지만 임의 custom URL·SHA를 반복 사용하는 장기 프로세스의 bounded cache 정책은 후속이다.
- 이 후속 체크포인트들은 시간·위치·저장소 무결성 개선이다. 격국·강약·용신의 외부 권위 진리값,
  exact default-diff 승인, exact commit 전문가 signoff를 충족하지 않으므로
  “전문가급 상용 사주엔진 인증”이나 merge 승인의 단독 근거가 아니다. 구조 회귀가 없고 한계가 공개되면 Ready 리뷰 근거로는 사용할 수 있다.
- PR #653의 freeze 누적 범위 `6fb2f68a4` 기준 134커밋·418파일과 후속 backend 체크포인트는
  #654~#676의 23개 base/head 스택으로 분할한다. Stack 23 정합 커밋까지
  main..Stack23은 157커밋이고 frontend source diff는 0이다.
- Stack23은 선택 후보와 전체 투간 품질 증거를 분리해 내부 모순을 해소하지만, 결정론적
  5,133건 표본 중 126건의 snapshot-invisible 품질 변화를 확인했다. 인구 가중 발생률은 아니며
  영향·권위 검토 P1을 global registry에 open으로 유지한다. exact diff 0에서도 gate는 non-zero다.
  작은 default-neutral guardrail, default-impact 판정, 외부 명리 인증은 서로 다른 리뷰 축으로 다룬다.

---

## 부록 E. 2026-07-13 입력·저장소 경계 재감사

이 부록은 커밋 `165d31ab1`과 `b09fb6311`의 구조적 개선만 기록한다. 테스트 통과와 P0/P1 부재는 회귀·보안 경계의 근거이지, 사주 판정 수치와 학파 선택의 외부 권위 인증이 아니다.

| 재감사 항목 | 판정 | 근거 |
|---|---|---|
| repository close 중 초기화가 계속 진행되어 stale 자원을 publish할 위험 | 해결 | 공통 lifecycle coordinator가 Hanja/Fourframe fetch·body와 NameStat WASM·shard·digest·open을 같은 generation/AbortSignal 계약으로 취소한다. 마지막 WASM 구독자 취소와 candidate DB close-on-abort도 고정했다(`165d31ab1`). |
| public async route가 caller mutable object를 await 뒤 다시 읽는 TOCTOU | 해결 | 모든 public request를 첫 await 전에 descriptor-safe clone/freeze한다. completed alias identity는 유지하고 cycle·accessor·symbol·sparse·비유한 scalar·과대 graph는 고정 TypeError로 거부한다(`b09fb6311`). |
| 잘못된 Hangul 음절 또는 Hangul/Hanja pair가 DB·사주·점수 계산 뒤에야 실패 | 해결 | syntax preflight와 repository-backed explicit identity 검증을 public 경계에 배치했다. pair 캐시는 입력 객체 identity, surname/given role, Hanja pool, lifecycle generation을 모두 키에 포함하고 close 시 무효화한다. |
| 엔진이 만든 SajuReport를 getSpringReport override로 재사용하면 own undefined 때문에 실패 | 해결 | report 및 request의 객체 own `undefined`는 JSON semantics로 생략한다. 실제 `getSajuReport → getSpringReport` 재사용 회귀와 기존 `options: undefined` scoring 경로를 고정했다. 배열 undefined는 계속 거부한다. |
| Proxy/reflect 오류가 원문 메시지와 PII를 노출 | 해결 | 공개 snapshot wrapper가 내부 reflection 오류와 cause를 버리고 고정된 PII-free TypeError만 노출한다. Proxy trap 실행 자체를 방지하는 보장은 아니다. |
| 기본 출력 판정 회귀 | 부분 검증 | 핵심 계약·타입·scoring·bridge·package boundary가 통과했고 fix-01/fix-16/fix-17 표본은 3/3 무변화다. exact HEAD 전체 baseline 17/17은 90초 초과로 중단되어 merge 전 필수 재실행 항목으로 남는다. |

### 잔존 P2와 상용화 차단선

1. 내부 trusted snapshot을 deep import로 반복 중첩하는 비정상 경로의 누적 depth/property budget 재산정은 하지 않는다. 현재 public export와 정상 endpoint에서는 접근할 수 없으므로 P2로 기록한다.
2. 전체 baseline suite의 직렬 후보 생성 비용을 프로파일링하지 않았다. smoke 3축과 full 17축을 분리하고 full은 CI 전용으로 병렬화할 여지가 있다.
3. Seed WASM의 package-relative Node 실행과 Vite production emitted asset·JS 참조는 확인했다. 실제 배포 뒤 브라우저 fetch와 모바일 메모리 상한은 미검증이다.
4. 이 두 커밋은 backend-only이고 frontend diff는 없다. 구조 회귀가 없으면 Ready 리뷰 근거가 될 수 있지만 외부 명리 전문가 signoff, default-change fingerprint 승인, authority D1-D5 gate를 대신하지 않는다.
5. 두 체크포인트는 승인된 원격 브랜치와 후속 스택에 포함됐다. Ready는 merge 승인이 아니며 스택 순서·외부 권위 gate를 계속 적용한다.

---

## 부록 F. 2026-07-13 Pages·CI 통합 체크포인트

이 부록은 로컬 통합 브랜치의 `4a7387d67`과 `8a63450a2`를 기록한다. 프론트엔드
소스는 수정하지 않았고, backend workspace source와 공개 자산이 실제 Pages 산출물로
재현되는지를 검증했다. 이 결과는 배포 무결성과 회귀 자동화의 근거이며 명리 판정의
외부 권위 인증은 아니다.

| 검증 항목 | 결과 | 잔여 한계 |
|---|---|---|
| 공개 자산 URL | Vite `BASE_URL`을 애플리케이션 base로 우선해 BrowserRouter 직접 진입에서도 DB·generated pack URL이 저장소 하위 경로를 유지한다(`4a7387d67`). | 실제 Pages 배포 후 네트워크 fetch 스모크는 원격 push 뒤 확인한다. |
| 재현 가능한 Pages 산출물 | 21,060 source article을 1,116 bundle로 pack하고 `/ci/`와 `/namespring-web/` base에서 Vite build 통과. 산출물은 1,142 files, 154.22 MiB다. | main JS 약 5.3 MiB 및 Node builtin externalization 경고는 P2 성능·브라우저 스모크 과제다. |
| 배포 자산 계약 | `index.html=404.html`, 16 DB의 source↔dist byte/SHA, pinned sql.js 1.14.1 WASM 1개(659,730 bytes, canonical SHA), JS의 WASM·base-aware generated pack 참조, legacy CDN·`dist/saju-ts` 부재를 verifier가 확인한다. | source filename/articleId/category와 21,060개 bundle key/articleId·8-token·category·route를 destructive exact-set으로 대조하고, public↔dist byte/SHA 동일성까지 fail-closed로 고정했다(`fe68bfd04`). 정상 산출물과 key/articleId fault injection이 모두 기대대로 통과했다. |
| CI 의미 분리 | `regression`은 구조·회귀·빌드, `expert-readiness`는 authority·provenance·exact-diff·signoff를 별도 fail-closed job으로 실행한다(`8a63450a2`). | Stack 22 run `29227222364`는 생성됐으나 account billing lock 때문에 regression job이 step 0개로 시작되지 않고 expert job도 skipped됐다. 원격 성공 이력은 아직 없으며, billing 해소 후 동일 head 재실행과 외부 signoff·default-change 승인이 필요하다. |

전체 17-fixture snapshot과 40개 이상 명령의 full release chain은 로컬 장시간 실행을
반복하지 않았다. fix-01·16·17 표본과 개별 계약·타입·빌드·산출물 검증을 사용했고,
full chain은 원격 CI에서 시간 제한과 로그를 가진 상태로 완주해야 한다.
