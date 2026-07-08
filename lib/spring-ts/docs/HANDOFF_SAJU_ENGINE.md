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

- **PR-2 배관 복구**: 12운성 노출(springLegacy에 summary.lifeStages 매핑 + spring-ts 소비 카드 신설 — 렌더러도 없음에 주의), seatPillars(matchedPillars additive 통과, HANDOFF_NEXT_PHASES 작업 5-후속 스펙 승계), 천간 극(GEUK) 탐지 추가(stemRelations.ts, 같은 음양 상극 6쌍 — 충 4쌍 제외), 반합(왕지 필수 조건, fortuneCalculator와 규칙 통일), 귀문관살(6조합), 고신/과숙(방합군 조견표), 일간 기준 basedOn='DAY_STem' 추가.
- **PR-3 판정 재정렬** (결정 4건의 ①②④ 실행): deLingDiShi 기본화+climateUrgency 활성, 정자시설 기본, 대운수 이원 표기, 건록/월겁/양인격, 종격 게이트(jonggyeokCandidates 연동), 신살 품질모델 배선(resolveQualityModelForDetection 미호출), 월덕/천덕 scope 배선, 12신살 이중 계상 dedupe, INDEPENDENT 12운성 명시 에러. **baseline snapshot·생성 코퍼스(κ) 파급 명시적 관리.**
- **PR-4 신뢰 인프라** (결정 ③ 실행): 내장 음양력 테이블(1900~2050, KASI 픽스처 `data/kasi-lunar-solar/`를 오라클로) + KASI API 옵션, 표준시 변천·서머타임 14구간 픽스처 테스트, 조견표 단정 테스트(12운성 120칸·지장간 12지지·신살 배속), 궁통보감 120셀 JSON.
- **후속 감사 후보**: graph/·schools 팩 전수·DSL 컴파일러·migrations·음양 균형(YinYangScore 소비자 0곳)·육친/묘고/개두절각 축 (감사 보고서 부록 C).

## F. 새 세션 착수 프롬프트

```
lib/spring-ts/docs/HANDOFF_SAJU_ENGINE.md를 읽고, 참조된 감사 보고서(AUDIT_SAJU_ENGINE_INTEGRITY.md)의 §1~§4를 읽어라.
브랜치 feature/saju-engine-integrity-audit에서 D절 PR-1 체크리스트의 미완(☐) 항목을 이어서 구현하라.
각 항목은 감사 보고서 부록 B에서 해당 발견의 상세(현재/표준/권고/근거)를 확인한 후 착수하고,
완료마다 D절 표의 상태를 갱신하고 항목 단위로 커밋하라. saju-ts src 수정 후 Node 검증 전 dist 재빌드 필수.
전체 완료 시 C절 검증 도구 일괄 실행 + 프로브 재실행으로 before/after를 기록하라.
```
