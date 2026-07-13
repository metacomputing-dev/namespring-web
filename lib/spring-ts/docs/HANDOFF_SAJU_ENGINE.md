# 인계 문서: 사주엔진(saju-ts) 무결성 개선 작업 — PR-1~4

> 2026-07-08 작성. **어떤 세션/계정이 이어받아도 이 문서 + 감사 보고서만으로 진행 가능**하게 쓴 인계 문서.
> 브랜치: `feature/saju-engine-integrity-audit` (main에서 분기). 감사 보고서 커밋 33c5d71fa 이후 PR-1 구현이 이어진다.
> 마스터 인계 문서 `HANDOFF_NEXT_PHASES.md`(콘텐츠 생성 축)와는 별개 축 — 이 문서는 엔진 로직 축.
>
> **2026-07-11 continuation override:** 이 문서의 PR-1~4 수치는 역사 기록이다.
> 현재 착수점은 `ROADMAP_SAJU_ENGINE.md`의 2026-07-11 merge-readiness 블록과
> `GUIDE_SAJU_ENGINE_IMPL.md` §0.5다. PR #653은 Draft, RPI는 20/100,
> D1~D4는 truth-insufficient N/A, D5 accuracy는 14 N/A + 3 NOT_APPLICABLE다.
> 권위 scope와 panel evidence 계약을 완화하거나 snapshot을 truth로 승격하지 말 것.
> D1은 doctrine 3필드+naming 4필드 전체가 있어야 하며, T4는 URL-only 승격을 금지하고
> Git 추적 page+quote transcript/SHA/realpath를 요구한다. Panel metadata는 self-attested로
> 외부 전문가 인증이 아니다. Exact-commit expert signoff는 전문가급 상용 릴리스와
> 기본값 승격의 필수 게이트다. Backend-only guardrail/refactor PR은 프론트와 기본값을
> 건드리지 않고 변경 범위 회귀·구조 검증을 통과하며 한계를 명시한 경우 점진적 리뷰·병합
> 후보가 될 수 있지만, WIP 해제 전에는 프로젝트 소유자에게 근거와 잔여 위험을 먼저 보고한다.

## A. 배경 (2분 캐치업)

- 2026-07-08 saju-ts 엔진 전체 무결성 감사 완료. **결과 정본: [`AUDIT_SAJU_ENGINE_INTEGRITY.md`](AUDIT_SAJU_ENGINE_INTEGRITY.md)** — 발견 103건(검증 33·미검증 70), 도메인별 상세는 그 부록 B, 미감사 영역은 부록 C.
- 핵심 진단 3겹: ① springLegacy 축약에서 정보 소실·왜곡(가짜 득령득지득세, 용신 'JOHU' 하드코딩, 12운성 폐기, matchedPillars 드랍) ② 기본 설정의 주류 이탈(월지 무가중 신강약, 조후 배제, 종격 도달불가, 건록/양인격 부재) ③ 죽은 코드·no-op 설정·테스트 공백(opt-in 납음/12궁은 켜면 전체 붕괴).
- 정책 결정 4건은 **확정됨** (감사 보고서 §3 '✅ 결정' 참조): 전부 옵션화하되 기본값은 최고 품질 쪽. 외부 API(KASI)는 지원해도 기본은 내장 값.
- 작업 순서: **PR-1(정직성 핫픽스) → PR-2(배관 복구) → PR-3(판정 재정렬, 스냅샷 파급) → PR-4(음력·테스트 인프라)**. 각 패키지의 항목·근거 file:line은 감사 보고서 §2 표(A/B/C 번호)와 부록 B에 있음.

## B. 불변 원칙 (엔진 축 공통)

1. **프론트(namespring/) 무접촉.** 작업 범위는 lib/saju-ts + lib/spring-ts.
2. **additive 우선.** 기존 필드의 의미 변경 대신 새 필드 추가(예: seatPillars). position(=basedOn)·dedup 키 `type|position`은 소비자 파급 때문에 불변.
3. **판정 결과가 바뀌는 변경(PR-3)은 반드시** `npx tsx tools/dev/dump-report-trace.ts` before/after + baseline snapshot 차이 기록과 함께.
4. **런타임 이중성 주의**: 브라우저=Vite alias로 saju-ts **src 직접 컴파일**, Node/tsx=**빌드된 saju-ts/dist**(gitignore). saju-ts src 수정 후 Node 검증 전 `cd lib/saju-ts && npm run build` 필수.
5. 커밋은 `git add <경로 명시>`, 항목 단위로 잘게.

## C. 검증 도구

```bash
cd lib/saju-ts && npm run build            # dist 재빌드 (Node 검증 전 필수)
cd lib/saju-ts && npx vitest run           # saju-ts 단위 테스트
cd lib/spring-ts && npx tsc --noEmit       # 타입
cd lib/spring-ts && npm run test:namespring-compat   # 호환 202 (핵심 회귀 벽)
cd lib/spring-ts && npx tsx tools/dev/dump-report-trace.ts  # 셀 출처·정합 실측
# 런타임 프로브(감사 때 작성, tmp라 gitignore — 없으면 감사 보고서 부록 A 참조해 재작성):
cd lib/spring-ts && npx tsx tmp/probe-saju-summary-surface.ts
cd lib/spring-ts && npx tsx tmp/probe-optin-naeum-palace.ts
```

## D. PR-1 상세: 아웃풋 정직성 핫픽스 ✅ 완료 (2026-07-08)

원칙: 결과 판정(신강약 레벨·용신 오행·격국)은 불변, **표기가 거짓인 것만** 고친다. 판정 필드 불변은 baseline 대조로 확인됨(아래 검증 기록).

| 항목 | 내용 | 상태 |
|---|---|---|
| A1 | 득령/득지/득세 가짜 매핑 → 실제 판정(월지 본기 십성 0\|1 / 일지 통근 본기1>중기0.6>여기0.3 / 7글자 비겁·인성 개수 0~7). springLegacy `computeDeukScores` 신설, details에 득령·득지·득세 라인 추가, spring-ts 타입 문서 갱신 | ✅ 79042afdc |
| A2 | 용신 추천 1위 type 'JOHU' → 'EOKBU' (기본 정책이 climate 0 순수 억부. 설정 다양화 시 실제 지배 방법 유도로 확장) | ✅ 79042afdc |
| A3 | 육합/자형/삼형 라벨 키 추가(springLegacy + 어댑터 3테이블) + RELATION_ORDER export + 전수 일치 테스트(springLegacy.test.ts, vitest include에 compat 추가) | ✅ 79042afdc |
| A5 | require() ESM 붕괴 → 캐시된 sajuModule 재사용. opt-in 납음/12궁 정상 동작 런타임 확증 | ✅ 79042afdc |
| A6 | palace.ts 본기 선택(role==='MAIN') + 12지지 본기 조견표 테스트(palace.test.ts) | ✅ ed78a0638 |
| A9 | dstCorrectionMinutes 실측(ICU long name + 전후 ±270일 표본 max(전측min,후측min) 초과분 — 1954 자오선 하향 전환 오판 방지). 1988=60/1957=60/1954.1=0 테스트 | ✅ 79042afdc |
| A15a | 초 단위 오프셋(GMT+8:27:52) 파싱 + 540 폴백 시 console.warn 1회 | ✅ 79042afdc |
| A15b | jie 폴백 boundary null화 (FortuneStart/View 타입 nullable) | ✅ 053b1f9ec |
| A15c | GONGMANG_DAY 죽은 룰 제거 (년주 기준 공망은 PR-2/B13 별도 축) | ✅ 053b1f9ec |
| A15d | boundaryMode=기산 절기 id + boundaryUtcMs/deltaDays/formula additive (어댑터·DaeunInfoSummary 포함) | ✅ 79042afdc |
| A15e | 午 월률 주석 정정 (10-10-11 합31 특수 배분 명시, 주류 이설 병기) | ✅ 053b1f9ec |
| A15f | EoT 'precise'에 calendar.solarPrecision/aberrationModel 상속 배선 | ✅ 6539bed60 |
| A15g | stale 주석 4곳 현행화 + calTimeAdapter 사문화 명시 | ✅ 6539bed60 |

**positionMultiplier 정리는 PR-2로 이월**(신살 표면 변경과 결합).

### PR-1 검증 기록 (2026-07-08)

- saju-ts: tsc 0err, vitest 19파일 80테스트(신규 palace 3 + springLegacy 10 포함) 전부 통과, dist 재빌드 완료.
- spring-ts: tsc 0err, namespring-compat 202, boundary-goldens 723, jonggyeok 93, yongshin-consensus 241, tiered-shape 1378, service-visible-output 13, presets/time-policy/calendar-policy/adapter-* 전부 통과.
- **baseline snapshot**: 5/5(cb3b85138) 이후 미갱신 + buildFortuneReport async 전환(7/4)으로 도구가 Promise를 캡처(fortuneReport 커버리지 사망) → **PR-1 이전부터 15/15 실패 상태였음**. 도구에 await 배선 후 재캡처(3d65a56cf). 판정 필드(신강약/용신/격국)와 별점·성격 특성 수는 구 baseline과 완전 일치 = PR-1 판정 무영향 확증. 이름 점수 +0.1~0.3은 5/5 이후 main 드리프트.
- 런타임 프로브(tmp/probe-pr1-surface.ts): dst 60/0, rec[0].type=EOKBU, 득령득지득세 실값(신강 케이스 령1·세6 / 신약 케이스 령0·세1로 정합), boundaryMode=XIAOSHU/LIXIA, 관계 note 전부 채워짐.
- ⚠ 기존 결함 발견(무관, 별도 작업 제안됨): `test:hanja-pool` 1건("curated generator keeps DB pool output" count=0)이 **main에서도 실패** — test:integration 체인이 이를 통과시키는 것도 점검 필요.

## E. PR-2~4 요약 (착수 시 감사 보고서 §2·부록 B에서 상세 확인)

- **PR-2 배관 복구 ✅ 완료 (2026-07-08, 커밋 4dc8fb20d + 3dead84ae)**:
  - 천간 극(GEUK) 6쌍 탐지 + 죽은 라벨 배관 소생 · 반합(BANHAP, 왕지 필수·완전체 억제·운 경로 규칙 통일) · 귀문관살(GWIMUN 관계 + GWIMUN_SAL) · 고신/과숙(년지 기준 룰, 일지 앵커는 facts만) · 12운성 노출(springLegacy sibiUnseong 배선 + insight-facts-card kind 신설 + 타입 레벨 해석 12건 저작 — 실측: 4기둥 팩트 전부 해석 부착) · seatPillars/count(궁위 합집합·발동 횟수, position/dedupe 불변) · basedOn 보존(DAY_STEM/YEAR_STEM).
  - 검증: saju-ts 78 테스트, 호환 202, tiered-shape 1378, 경계골든 723, **baseline snapshot 15/15(판정·별점 불변)**, 런타임 프로브(극·반합·고신/과숙 발동, 천을귀인[day,hour]x2 병합 확인).
  - **잔여(콘텐츠 저작 축, 별도 세션 권장)**: ① 귀인 궁위 세분 factId(`shinsal.<이름>@<기둥>`) + preferredIds — seatPillars 배관은 완료됐으므로 인사이트 카드 factId 확장 + 궁위별 해석 저작만 남음(HANDOFF_NEXT_PHASES 작업 5-후속 ③④⑤단계) ② 신규 표면(반합·귀문·고신/과숙·귀문살) 타입 레벨 해석 충전(branchRelation.반합/귀문, shinsal.귀문관살/고신살/과숙살 — 現在는 신살 백과 폴백에 걸리는 것만 노출).
- **PR-3 판정 재정렬 ✅ 완료 (2026-07-08)**:
  - 무파급 절반 (커밋 6af40c64b·7a7d1af5d·b222e802f): 신살 품질모델 오버라이드 실배선(A7), 월덕/천덕 scope 배선(A8), 12신살 이중 계상 dedupe(A10), INDEPENDENT 명시 throw(A14), 대운수 이원 표기(B11 배관).
  - **판정 변경 세트 (커밋 6건, 항목당 1커밋 + snapshot 재캡처 동봉)**:

    | # | 항목 | 커밋 | 판정 파급 실측 (직전 항목 대비) |
    |---|---|---|---|
    | ① | deLingDiShi 신강약 기본화 (B7 — defaultConfig+facts.ts 폴백, base는 명시 opt-out) | 1f6090919 | fix-05 신약→중화(신약 경향), fix-07 희신 WOOD→METAL·dailyStars 4→2, 이름 후보 ±0.1 재배열 4건. borderline tier 불변 |
    | ② | 조후 기본화 (B6 — climate 0.25 + urgency on + 1위 type 실유도 primaryMethod, 스쿨팩 2종 핀) | 32a740129 | 용신 1위 15/15 불변, 희신만 4건 이동(fix-05 겨울 WATER→FIRE 등 조후 표준 방향), 별점 5건 이동 |
    | ③ | 종격 게이트 (B5 — jonggyeokRisk+warnings additive, HIGH 시 confidence cap 35. 완전 승격(a)은 weakThreshold 도달불가로 반려·프리셋 옵션 유지) | 416c0d845 | fix-13(극신약 편중)만 이름 -0.4. 교리 9픽스처: HIGH=04·06·07, INFO=01·03·08·09 테스트 고정(93→111) |
    | ④ | 건록/양인/월겁격 (B4 — bigyeopSubtype 팩트+DSL v0.5+라벨/κ/백과/글로서리 9파일 배선, 'legacy' opt-out) | ea2f8366a | 라벨 전환만 4건(fix-05·11 비견격→건록격, fix-06 겁재격→양인격, fix-07 겁재격→월겁격). 점수·별점 불변 |
    | ⑤ | 일주 경계 정자시설 전환 + A11 (결정① — yaza 기본 on/23:00, -30분 시프트를 인스턴트→경계 분류(calendar.dayCutShiftMinutes)로) | b7ff328f8 | fix-03(00:30)만 일주 丁巳→戊午 연쇄(신강약·용신 WOOD→FIRE·격국·별점). 경계골든 723 무파급(정책 핀). yaza-opt-in.test 재작성 4/4 |
    | ⑥ | 대운수 표기 소비자 전환 (B11 잔여 — daeun-display.ts 오프셋, 4개 카드 표면 동시 전환, 시간 로직·rep 채점은 연속값 유지) | 4f3609f21 | 표기만 이동(오프셋 +1 케이스에서 4표면 일관). snapshot 15/15 = 판정 무파급 확증 |

  - **역사적 non-authority 내부 분류(validate:default-change, main↔HEAD)**: 당시 overall **IMPROVEMENT** — 현재 release truth 또는 전문가 승인으로 사용 금지.
  - **κ 코퍼스 정합**: dump-report-trace before/after — 데모(1986-04-19) 판정 불변·전 셀 ✅재생성·정합✓ 유지. fix-03(판정 변경자)도 새 클래스(strong.jaeseong.boost_mild)에서 전 기간 ✅재생성 + byDaeun 전 구간 정합✓ = **커버리지 후퇴 0**.
  - 역사적 검증 기록: 당시 quality_gate D3/D5 PASS 표기는 현재 권위 계약 이전의 내부 classifier 결과이며 release truth가 아니다.
  - ⚠ 역사적 composite diff 실패는 merge로 자동 해소할 사유가 아니다. 현재는 exact diff 승인, 7-field truth, 외부 전문가 signoff가 모두 완료되기 전까지 Draft를 유지한다.
  - 잔여 후속(판정 축 아님): quality_gate에 격명 동등 매핑(비견격≡건록격 등)을 넣었으므로 오라클 재감정은 불필요. fix-03 disagreementNotes 현행화 완료(용신은 saju_master와 수렴). BYEONGYAK 추천 type의 spring-ts 라벨 테이블 추가(스쿨팩 경유 시에만 노출)는 후속 정리 항목.
- **PR-4 신뢰 인프라 ✅ 완료 (2026-07-08, 결정③ 실행 — 전 항목 판정 무파급: snapshot 15/15·trace 불변)**:

  | # | 항목 | 커밋 | 내용/검증 |
  |---|---|---|---|
  | ① | 음력 입력 (B1) | 7600346f6 | usingsky(MIT, KASI/KARI 표준) 클린 포팅(`spring-ts/src/calendar/korean-lunar-calendar.ts`, 제품 보장 1900~2050) + 어댑터 변환 배선(브리지 항상 SOLAR) + `SajuSummary.lunarConversion` additive + KASI API 옵트인(`precisionConfig.lunarConversionSource='kasi'`, getSpcifyLunCalInfo, 실패 시 내장 폴백). 검증: KASI 13케이스 오라클 양방향 + 설날 151/151·윤달 전 연도·추석 22/22 앵커(`data/kasi-lunar-solar/korean_lunar_anchor_cases.json`) + 55,122일 왕복 항등 + 목서버 5 + calendar-policy 14 재작성(음 2025 윤6/1 = 양 2025-07-25 4주 동일). ⚠ 프론트가 isLeapMonth 미전송(윤달 UI 공백) — lib 밖 제품 결정 후속 |
  | ② | 표준시/서머타임 픽스처 (B10) | 2ea5ef5a0 | tzdb Rule ROK+Zone Asia/Seoul 정본 33픽스처(자오선 4전환 ±1일 + DST 12구간 중앙 + 무DST 대조 + 1987/88 정밀) + small-icu 카나리아 하드 실패. springLegacy 헬퍼 3건 테스트용 export. **감사의 '14구간'은 tzdata 기준 12구간이 정본(정정)** |
  | ③ | 조견표 단정 테스트 | 92425647c | 12운성 120칸(+수토동궁 24칸+INDEPENDENT throw) · 지장간 12지지(이설 채택 주석 명시 회귀 핀) · 신살 배속(천을 구결 전량·록신·월덕/천덕·괴강/백호 60갑자 Set) · 12신살 144칸 · 양인 luNext/diWang 이설 · 공망 6순 12케이스 |
  | ④ | 궁통보감 120셀 (B12) | 1db7a4b14 | 서락오 평주 계열 통용표 120셀(이중 저작 대조 확정, 이설 note) + johooTemplate monthTable 조회(셀 적중 시 간이 힌트 대체 — 이중 가산 금지) + qiongTongBaoJian 프리셋 실배선/표기 정정. **부수 수정: packLoader 잠복 버그** — 부모 alias 상속 + later-wins 인덱스로 `school.id='johoo.strict'` 조회가 자식(qiongTongBaoJian)에 가로채이던 것(신규 테스트가 검출) → alias 상속 제거 + id 우선 2-pass 인덱스 |

  - 검증(일괄): saju-ts 27파일 151테스트, tsc 0err 양쪽, compat 202, 경계골든 723, jonggyeok 111, consensus 241, tiered-shape 1378, class-axes 12, scoring 34, borderline 7/7, time-policy 11, presets 13, snapshot 15/15, lunar-calendar 36, kasi-lunar-api 5, calendar-policy 14. dump-report-trace·probe-summary-surface 불변.
- **후속 감사 후보**: graph/·schools 팩 전수·DSL 컴파일러·migrations·음양 균형(YinYangScore 소비자 0곳)·육친/묘고/개두절각 축 (감사 보고서 부록 C).

## E-2. PR-5~7 — 판정 깊이 축 ✅ 완료 (2026-07-08)

> 원칙 준수: 콘텐츠 저작·코퍼스가 무거운 부분은 틀까지만, 판정 변경은 PR-3 계측 절차 그대로. **validate:default-change(main↔HEAD) = IMPROVEMENT(개선 5·회귀 0·불변 10) 유지, trace 정합✓·재생성 무후퇴.**

| PR | 항목 | 커밋 | 결과 |
|---|---|---|---|
| **PR-5** | 합충의 판정 반영 | 6bf05e8e7 (궁위 인프라) · 28751758d (신강약 주입) · 2a98bab3d (격국 탐합망충) · abb80a4a2 (천간합 상태 표면) · fdcedcce3 (분포 옵션 틀) | ① DetectedRelation/StemRelation에 pillarIndexes·pairs additive(값-dedupe 불변) ② deLingDiShi (1+f) 층에 충손상(CHUNG 0.5·형 0.7, floor 0.3)+탐합망충 해소+회국 별도 항(삼합 0.10/방합 0.08/반합 0.05, 식·재·관 국은 pressure)+천간합 기반(0.5, 쟁합 0.75) — strategies.strength.interaction 전량 설정화(기본 on). **파급 실측: 강약 레벨·용신·격국·별점 15픽스처 전부 불변**(이름 후보 순위 재배열 4건 + fix-11 격국 confidence 0.242→0.282 회복만 — 보수 기본값+해소 규칙의 의도된 완충) ③ 격국 damage per-relation 해소(SAMHAP 완전·YUKHAP/BANHAP 절반·합신 피충 무효) + resolvedJijiRelations 배관 소생 ④ 합화/기반/쟁합/요합 hapState + hapHwaEvaluations 죽은 배관 소생 ⑤ 분포 보정은 elements.distributionAdjusted 옵션 틀(기본 off — κ 파급 사유 주석) |
| **PR-6** | 격국 성패(成敗) | 02a9fe7c4 | 자평진전 순용/역용 룰 테이블(11격 × 상신/파격요인/구응) → verdict 5단(성격·파격·패중유구·성중유패·미확정) + 월지 손상(탐합망충 해소 후 잔존) 연동 강등. facts→springLegacy→어댑터 전부 additive(GyeokgukSummary.seongpae) — **격국 점수 미개입**(점수 통합은 별도 계측 항목). v0는 투간 기준 — 지장간 회지 상신·세력 비교는 후속. 해석 텍스트 저작은 틀만 |
| **PR-7** | 종격 승격 틀 | 229c980b1 | jonggyeok.calibrated 프리셋(임계 ±0.55, 옵트인 전용) + 권위 코퍼스 스캐폴드(jonggyeok_authority_cases.json — intake 요건·승격 기준 20건+/80%+, 축적 시 검증 자동 활성, test:jonggyeok-authority). **실측 발견: 임계 재보정 단독으로는 potential 램프 수식((threshold-s)/(threshold+1))이 극단 명식 factor를 ~0.19로 눌러 CONG 게이트(0.6) 미달** — 반려 사유의 실체는 수식 구조. 완전 승격 = 램프 재설계 또는 게이트 인하 + 권위 코퍼스 (기본값 완전 불변) |

  - 신설 테스트: strengthInteraction 8 · gyeokQualityTanhap 4 · gyeokgukSeongpae 11 · elementInteractionAdjust 4 · jonggyeok-authority 6 (saju-ts 총 178).
  - PR-5/6 잔여 후속(기록): 궁위 pairs 기반 감쇠 세분(현 v0는 값 매칭 — 동일 지지 과감쇠 한계), 인접 요합 감쇠, 왕상휴수 연동 비대칭 감쇠, pressure 축 합거(관성 묶임→신강 방향), 성패의 격국 점수 통합(판정 변경 — 계측 필수), 성패 해석 텍스트 저작(콘텐츠 축).
| 후속 | 운(運) 통합 판정 | 교운 일시 표기, 대운-원국 합충 재평가, 운 신살(삼재·상문·조객), 월운/일운 노출 | 부록 B 259·266·728, C5 |
| 후속 | 대규모 외부 오라클 | 상용 만세력 대비 명식 4주 대량 대조 파이프라인 + deLingDiShi ±0.15 임계 분포 재캘리브레이션 | §3-2 파급 검토, B7 함정 3 |
| 후속 | 설명가능성 노출 | 용신 methodBreakdown(C4)·격국 basis·시간 보정 카드(C7)·야자시 시두법(JOJA_SPLIT 실구현 또는 경고) | C4·C7, 부록 B 196 |

## F. 새 세션 착수 프롬프트

> **PR-1~4 전부 완료** (D·E절). 엔진 무결성 감사 축의 계획 작업은 종결 — 남은 것은 선택 후속뿐:
> ① 콘텐츠 저작 축(PR-2 잔여 — 귀인 궁위 세분 factId + 신규 표면 해석 충전, HANDOFF_NEXT_PHASES 작업 5-후속)
> ② 프론트 윤달(isLeapMonth) 입력 UI(lib 밖 제품 결정) ③ 후속 감사 후보(위) ④ 미검증 70건 개별 확인.
> 착수 시 감사 보고서 부록 B·C에서 상세 확인 후 항목 단위 커밋 + C절 검증 관례를 그대로 따르라.

## G. 2026-07-12 명리 판정 논리 감사 인계 (Codex 필독)

> **정본: `docs/dossiers/f2-johoo-2026-07-12/DOSSIER.md`** (현재 built `dist/`를 freeze 캡처 기대값과 대조하는 `verify-f2.mjs` 동봉). freeze `6fb2f68a4` 기준 읽기 전용 감사 산출물.

- **F2 조후위급**: urgency 게이트(子·丑·午만 발동)가 열려도 조후 오행이 극단 강약(신약 s≲−0.28~−0.46, 신강 s≳0.59)에서 1위 불가함을 수학적으로 증명 + 5표본 실측. **기본 동작 변경은 dossier §7 전문가 질문 7개 답변 전 금지**(default-change 대상). 지금 가능한 것: yongshin.ts:313-316 주석 '우선'→'개입' 정정, 丑월·신약×위급월 baseline 픽스처 추가(§6 갭).
- **감사 티켓 T1~T7**: dossier 부록 A 표 참조. T1(F1 일간 투간 격 오분류, P0)은 `0416c3daa`에서 코드 수정 완료했으며 exact default diff·명리 전문가 검토 대기다. T2(HUA_QI/ZHUAN_WANG veto 우회)·T3(월지 형충 이중 감점)·T4(consensus conflictLevel 상수 'high')·T5(기반 감쇠 층위 불일치)·T6(희신/기신 기계 유도)·T7(magic 계수 인벤토리)은 상호 독립·착수 가능.
- 확인된 불변식(재감사 불요): 시간 경계 이중 적용 없음, 관계 탐지 중복 방출 없음, 오행 분포 이중 계상 없음, 신강약 상호작용 (1+f) 층 한정 준수.

## H. 2026-07-12 정책 계수(magic number) 감사 인계 (Codex 필독)

> **정본: `docs/dossiers/coefficient-policy-2026-07-12/DOSSIER.md`** (+ 기계 판독본 `inventory.json` 56건). freeze `6fb2f68a4` 기준 읽기 전용 감사 산출물 — **수치 변경 제안 없음**(캘리브레이션 절차 대상).

- P0 없음. **P1 4건**: 용신 가중이 비정규화 신호에 곱해짐(P1-A) / 충형파해 감쇠 4벌 서열 모순(P1-B) / config 모양의 사실상 상수(P1-C — 프리셋 실변주는 yongshin weights뿐) / 정규화 상수 다중 정의(P1-D). 단위 불일치 C-3(기반 감쇠 ×/raw 혼용)·C-4(decisiveMargin raw 단위)·C-6(신살 점수 이중 체계), rootNorm=0 가드 방향 불일치(강약 fail-open ↔ 격국 fail-closed).
- **티켓 G1~G5는 상호 독립**이다. G1~G3은 로직 무변경, G4는 기본 config 불변이지만 비기본 `norm<=0` 산출 변경, G5는 승인 전 현행동작 characterization으로만 허용한다. 변경 허용 범위·필수 테스트·전문가 판단 여부는 DOSSIER §G에 명기했다.
- F1은 `0416c3daa`에서 코드 수정 완료 후 검토 대기이고 F4/F7은 별도 대기다. 이 dossier는 해당 영역을 재분석하지 않고 인벤토리에만 수록한다. [캘리브] 태그 수치는 명리적 승인 상태가 아니며 authority holdout 전 변경 금지.
## I. 2026-07-13 스택 검증 보완과 Stack 22

- PR #654의 63개 후보 점수 상승은 await 계측기 수정이 아니라 `79042afdc`의 추천 타입 `JOHU→EOKBU` 정정과 Spring 가중치 `0.95→1.0`의 파급이다. 14픽스처·63 leaf(+0.1 38, +0.2 20, +0.3 5), 후보 이름·순서 불변이며 독립 승인은 아직 pending이다. 정본은 `docs/dossiers/default-change-stack01-2026-07-13/`.
- Stack 18 0416c3daa의 F1 수정은 5픽스처·8 leaf(sha256:6018d66d…) 기본변화와 후보 snapshot 9건(sha256:b05f310…)을 낳았다. Stack 22가 exact snapshot diff와 pending dossier를 Git에 고정하지만 명리 승인은 아직 없다.
- Stack 22는 후속 검증에서 발견한 계약·정직성 부채를 닫는다: source-compatible optional boundaryTermId와 null 보존·잘못된 타입 fail-closed, 12운성 12개 T1/AI/non-authority provenance, 신살 category/name override parser의 잘못된 타입 fail-closed, 대운 정확 2일 반올림 안정화, 비기본 palace/naeum·강약·INDEPENDENT characterization.
- boundaryTermId와 12운성 provenance는 기존 구조 스냅샷이 포착하지 않는 additive output change다. 정확 2일 대운수 반올림은 경계 입력에만 보이는 default change이며 PR 본문에서 snapshot-invisible output change로 공개한다.
- Claude 병렬 사전검증: PR #668은 계산 base≡tip이나 당시 좌표 coercion P1 때문에 CONDITIONAL PASS. 해당 입력 검증은 Stack 16의 `0e91b8ec9`에서 이미 strict number/range로 보완됐고 Stack 22가 JS 비타입 회귀를 추가한다. PR #673과 #674는 각각 코드·문서 검증 PASS(P0/P1 0, 비차단 P2 각 6건)이나 선행 스택 순서 때문에 자동 Ready 전환하지 않는다.
- PR #673은 Seed `npm ci`를 CI에 추가해 PR #668 시점의 선재 `sql.js` 설치 위험을 해소한다. 실제 Actions 성공 이력은 결제 잠금·OAuth workflow scope가 풀리기 전까지 미확보다.
- 운영 원칙: 기존 #654~#674를 재작성하지 않고 Stack 22를 마지막 필수 보완 PR로 둔다. 모든 Draft는 선행 스택 검증과 사용자 사전 확인 없이 Ready/merge하지 않는다.
