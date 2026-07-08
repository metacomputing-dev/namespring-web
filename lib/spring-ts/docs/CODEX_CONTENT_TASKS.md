# Codex 작업 지시서: 사주엔진 코퍼스·콘텐츠 생성 축 (2026-07-08)

> 이 문서만으로 착수 가능하게 쓴 지시서. 엔진 로직 축(PR-1~7, `HANDOFF_SAJU_ENGINE.md`)과 별개로,
> **데이터 수집·텍스트 저작만** 다룬다. 아래 공통 규칙을 어기는 작업은 하지 말 것.

## 공통 규칙 (전 과제)

1. **판정 무파급**: 엔진 로직(src의 판정 코드)은 수정 금지. 전 과제가 데이터 파일 추가/텍스트 저작 + 그 소비 테스트뿐이다. 완료 후 반드시 실행:
   ```bash
   cd lib/spring-ts && npx tsx tools/baseline_snapshot.ts verify   # 15/15 필수
   npm run test:namespring-compat                                   # 202 필수
   ```
2. **프론트(namespring/) 무접촉.** 작업 범위는 lib/saju-ts + lib/spring-ts.
3. **sourceTier 정직성**: 모든 신규 데이터·텍스트에 sourceTier 블록 필수.
   - 웹/서적 인용 정박 데이터 = `T3_AUTHORED_INTERPRETATION`+(sourceUrl 또는 서지, quoteShort ≤50자, authorityTruthEligible true)
   - AI 저작 서사 텍스트 = `T1_HYPOTHESIS`, `aiGenerated: true`, authorityTruthEligible false
   - 원문 산문 통짜 복사 금지(날짜·수치·짧은 인용만).
4. **커밋**: `git add <경로 명시>`, 과제 단위로 잘게. 메시지에 검증 결과 수치 포함.
5. **saju-ts src를 만졌다면**(원칙상 없어야 함) Node 검증 전 `cd lib/saju-ts && npm run build` 필수.
6. 막히면 중단하고 막힌 지점을 커밋 메시지 대신 이 문서 하단에 `## 진행 로그`로 기록.

---

## 과제 1: 종격 권위 코퍼스 수집 (최우선 — PR-7/9 승격의 전제)

**목표**: `lib/spring-ts/test/fixtures/jonggyeok_authority_cases.json`의 `cases: []`를 **20건 이상** 채운다.

- **수집 대상**: 고전·현대 문헌에서 **종격(從格)으로 판정된 실제 명식**과 그 근거.
  - 고전: 적천수천미(임철초 평주)의 종격 명례, 자평진전 평주 명례, 궁통보감 명례 — 위키문헌/중문 원전 사이트에 원문 공개된 것 우선.
  - 현대: 한국 명리 강의·서적의 종격 감명례 중 출처(저자·서명·페이지/URL)를 인용 정박할 수 있는 것.
- **케이스 스키마** (파일의 `_meta.intakeRequirements` 참조):
  ```jsonc
  {
    "id": "auth-jong-01",
    "label": "적천수천미 종재격 예 — 〈원문 4주〉",
    "birth": { "year": 1900, "month": 1, "day": 1, "hour": 12, "minute": 0, "gender": "male" },
    // ⚠ 고전 명례는 생년월일이 아니라 4주 간지만 있는 경우가 대부분 —
    //   그 경우 birth 대신 "pillars": "甲子 丙寅 戊辰 壬戌" 문자열 필드로 기록하고
    //   birth는 null (스캐폴드 테스트가 pillars 직접 비교 모드를 후속 지원).
    "pillars": "…",
    "expectedJonggyeokType": "CONG_CAI",   // CONG_CAI|CONG_GUAN|CONG_SHA|CONG_ER|CONG_YIN|CONG_BI|ZHUAN_WANG|HUA_QI
    "expectedYongshinElement": "EARTH",     // 문헌이 명시한 용신 오행 (있을 때만)
    "doctrineNote": "문헌의 판정 근거 요약 (2~3문장, 자기 말로)",
    "sourceTier": { "tier": "T3_AUTHORED_INTERPRETATION", "sourceType": "classical_text_annotated",
      "sourceUrl": "…", "accessedAt": "YYYY-MM-DD", "quoteShort": "원문 ≤50자",
      "humanInterpretation": "…", "copyrightNote": "짧은 인용만", "authorityTruthEligible": true }
  }
  ```
- **품질 기준**: 판본이 갈리는 명례는 `disagreementNotes`에 기록. 확신 없는 케이스는 넣지 말 것(정확성 > 개수). 서브타입(종재/종살/종아/종왕/종강) 분포가 고르게.
- **검증**: `cd lib/spring-ts && npm run test:jonggyeok-authority` — 케이스가 생기면 스키마 게이트가 자동으로 검사한다. 판정 일치율은 정보로만 출력됨(불일치가 실패가 아님 — 그것이 캘리브레이션 재료다).

## 과제 2: 대규모 만세력 오라클 수집 (PR-9 재료)

**목표**: 명식 4주 + 대운수를 외부 권위와 대조할 데이터셋 신설 — `lib/spring-ts/test/fixtures/manseryeok_oracle_cases.json`.

- **1차 소스(권장)**: KASI 음양력 페이지는 이미 픽스처가 있으니, **일진(日辰) 간지**를 KASI 공개 자료(astro.kasi.re.kr 월력요항/음양력 — `scripts/fetch-kasi-lunar-solar.ts`의 fetch 패턴 재사용)에서 수집해 **일주 오라클**을 만든다. 1900~2050에서 연도당 2~4일 표본(월 분산) = 300~600건. 일주가 맞으면 년·월주는 절기 경계(이미 KASI 1.2분 검증)로 파생되므로 일주 오라클이 핵심이다.
- **2차 소스(보조)**: 역사 인물·공개 감명례의 4주 기록(위키 등) 중 출생일시가 공개된 케이스 — 시주까지 대조 가능. 단 시간 불명이 많으니 `hour: null` 허용.
- **케이스 스키마**:
  ```jsonc
  { "id": "mo-1953-07-15", "solar": "1953-07-15", "expectedDayPillar": "癸酉",
    "source": "KASI", "sourceTier": { "tier": "T5_OFFICIAL", ... } }
  ```
- **하네스**: `test/integration/manseryeok-oracle.test.ts` 신설 — 각 케이스를 `analyzeSaju`(기본 정책, 정오 12:00 고정 — 일주 경계 회피)로 돌려 일주 일치율 산출. **주의**: 시계 23:32~00:32 표본은 정자시설로 일주가 하루 밀리는 게 정상이므로 정오 표본으로 통일할 것. 목표 일치율 100%(불일치는 케이스별 조사 후 `disagreementNotes`).
- **네트워크 예절**: fetch는 배치 간 지연(≥1초), 실패 재시도 2회 후 스킵. 수집 스크립트는 `scripts/fetch-manseryeok-oracle.ts`로 남겨 재현 가능하게.

## 과제 3: 신규 판정 표면 해석 텍스트 저작 (콘텐츠 축)

**목표**: PR-2/5/6에서 배관은 완료됐지만 해석 텍스트가 없는 표면을 채운다. 문체는 기존 저작물과 동일(**'~예요' 체, 단정 대신 경향 서술, 공포 조장 금지**). 전부 `aiGenerated: true` + T1_HYPOTHESIS.

3-a. **격국 성패(PR-6)**: `SajuSummary.gyeokguk.seongpae.verdict` 5종(SEONGGYEOK/PAGYEOK/PAJUNG_YUGU/SEONGJUNG_YUPA/UNDETERMINED) × usage 2종(SUNYONG/YEOKYONG)의 해석 문단.
   - 위치: `lib/spring-ts/src/report/knowledge/` 또는 insight registry 관례를 따라 신규 `data/narrative/` 항목 — **기존 12운성 해석(insight-registry, PR-2에서 저작)이 어느 파일·kind로 들어갔는지 먼저 grep해서 같은 관례를 따를 것** (`getInsightInterpretation`, `daeunLead.` factId 패턴 참조).
   - factId 제안: `gyeokgukSeongpae.<verdict>` + 상신 십성 치환 슬롯.
3-b. **천간합 상태(PR-5)**: hapState 4종(HUA/HAPGEO/JAENGHAP/YOHAP)의 한 줄 해석 — 이미 `hapStateKo` 라벨은 있으니 카드용 1~2문장 서사.
3-c. **탐합망충 해소(PR-5)**: `resolvedJijiRelations` outcome='해소' 케이스의 서사("충이 있으나 합으로 풀렸어요" 톤).
3-d. **PR-2 잔여(HANDOFF_NEXT_PHASES 작업 5-후속 ③④⑤)**: 귀인 궁위 세분 factId(`shinsal.<이름>@<기둥>`) 확장 + 궁위별 해석, 반합/귀문/고신/과숙 타입 레벨 해석(branchRelation.반합/귀문, shinsal.귀문관살/고신살/과숙살).
   - **검증**: `npm run test:tiered-shape`(1378 — 글로서리 dangling 태그 검사 포함), insight 관련 테스트, snapshot 15/15.

## 과제 4 (여유 시): 명식 다양화 baseline 픽스처 보강

`test/fixtures/spring_ts_baseline_cases.json`에 **시계 23:35~23:59 출생 픽스처 1건**(정자시설 창 안 — 현재 fix-03 00:30만 있음)과 **음력 입력 픽스처 1건** 추가 + `npx tsx tools/baseline_snapshot.ts capture` 재캡처. borderline 계열(fix-13~15)과 겹치지 않는 무난한 명식으로.

## 진행 로그

(Codex가 작업하며 여기에 기록)
