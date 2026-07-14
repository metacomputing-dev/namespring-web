# 인계 문서: 사주엔진(saju-ts) 무결성 개선 작업 — PR-1~4

> 2026-07-08 작성. **어떤 세션/계정이 이어받아도 이 문서 + 감사 보고서만으로 진행 가능**하게 쓴 인계 문서.
> 브랜치: `feature/saju-engine-integrity-audit` (main에서 분기). 감사 보고서 커밋 33c5d71fa 이후 PR-1 구현이 이어진다.
> 마스터 인계 문서 `HANDOFF_NEXT_PHASES.md`(콘텐츠 생성 축)와는 별개 축 — 이 문서는 엔진 로직 축.

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

  - **Stack02 구조격 정오표 (2026-07-14, 외부 전문가 승인 전 provisional)**:
    - 일반 취격의 투간에서 일간 자신을 제외하고, 월령 본기가 비견/겁재가 아닌 경우 잔여기 비겁 후보가
      건록·양인·월겁 구조격으로 승격되지 않도록 분리했다. 甲亥·丙寅 오분류도 같은 원인으로 차단했다.
    - 탈락한 비겁 후보는 내부 증거로 보존하되 공개 후보와 품질 gap에서는 제외한다.
    - 기본 스냅샷은 fix-01/06/07/08/11의 격국 5건·8개 판정 필드가 이동했다.
      특히 fix-06/07은 양인격·월겁격에서 정인격으로 정정되어 위 표 ④의 당시 기록을 대체한다.
    - 테스트 통과는 회귀 부재의 증거이며, 토 잡기월 호환 정책과 구조격 분류 자체의 명리 승인은 아니다.

  - **공식 판정 분류(validate:default-change, main↔HEAD)**: overall **IMPROVEMENT** — 개선 5(fix-03·05·06·07·11, D1 오라클 밴드 기준), 회귀 0, 불변 10.
  - **κ 코퍼스 정합**: dump-report-trace before/after — 데모(1986-04-19) 판정 불변·전 셀 ✅재생성·정합✓ 유지. fix-03(판정 변경자)도 새 클래스(strong.jaeseong.boost_mild)에서 전 기간 ✅재생성 + byDaeun 전 구간 정합✓ = **커버리지 후퇴 0**.
  - 검증(최종 일괄): saju-ts 21파일 84테스트, tsc 0err(양쪽), compat 202, boundary-goldens 723, jonggyeok 111, yongshin-consensus 241, tiered-shape 1378, class-axes 12, candidates 182, scoring 34, conflict-aware 10, borderline 7/7, time-policy 11, calendar-policy 9, presets 13, service-visible 13, life-stage-display 4, tiered-determinism 4, adapter-daewoon 15, quality_gate D3/D5 PASS(D1/D2/D4 N/A).
  - ⚠ 알려진 상태: `test:composite-quality-gate`의 "monthly_main default snapshot has no regression (main..HEAD)" 1건은 **의도적 기본값 변경 브랜치에서 설계상 FAIL**(measure_regression은 무파급 PR용 diff=0 검사 — PR-1 스냅샷 재캡처 시점부터 main과 다름). 머지 후 자동 해소. 공식 게이트는 위 validate:default-change(IMPROVEMENT)로 대체 기록.
  - 잔여 후속(판정 축 아님): quality_gate에 격명 동등 매핑(비견격≡건록격 등)을 넣었으므로 오라클 재감정은 불필요. fix-03 disagreementNotes 현행화 완료(용신은 saju_master와 수렴). BYEONGYAK 추천 type의 spring-ts 라벨 테이블 추가(스쿨팩 경유 시에만 노출)는 후속 정리 항목.
- **PR-4 신뢰 인프라** (결정 ③ 실행): 내장 음양력 테이블(1900~2050, KASI 픽스처 `data/kasi-lunar-solar/`를 오라클로) + KASI API 옵션, 표준시 변천·서머타임 14구간 픽스처 테스트, 조견표 단정 테스트(12운성 120칸·지장간 12지지·신살 배속), 궁통보감 120셀 JSON.
- **후속 감사 후보**: graph/·schools 팩 전수·DSL 컴파일러·migrations·음양 균형(YinYangScore 소비자 0곳)·육친/묘고/개두절각 축 (감사 보고서 부록 C).

## F. 새 세션 착수 프롬프트

> PR-1·2·3은 완료됐다(위 D·E절). 다음 작업 = **PR-4 신뢰 인프라** (E절 요약 + 감사 §4·결정③).

```
lib/spring-ts/docs/HANDOFF_SAJU_ENGINE.md를 읽고, 참조된 감사 보고서(AUDIT_SAJU_ENGINE_INTEGRITY.md)의 §1~§4를 읽어라.
브랜치 feature/saju-engine-integrity-audit에서 E절의 PR-4 신뢰 인프라를 구현하라:
내장 음양력 테이블(1900~2050, data/kasi-lunar-solar/ 픽스처를 오라클로) + KASI API 옵션(기본 내장),
표준시 변천·서머타임 14구간 픽스처 테스트, 조견표 단정 테스트(12운성 120칸·지장간 12지지·신살 배속), 궁통보감 120셀 JSON.
각 항목은 감사 보고서 부록 B에서 상세(현재/표준/권고/근거)를 확인한 후 착수하고, 항목 단위로 커밋하라.
saju-ts src 수정 후 Node 검증 전 dist 재빌드 필수. 완료 시 C절 검증 도구 일괄 실행으로 회귀를 확인하라.
```
