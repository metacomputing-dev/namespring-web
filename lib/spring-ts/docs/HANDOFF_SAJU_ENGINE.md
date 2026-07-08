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

## D. PR-1 상세: 아웃풋 정직성 핫픽스 (진행 중)

원칙: 결과 판정(신강약 레벨·용신 오행·격국)은 불변, **표기가 거짓인 것만** 고친다. 단 A1은 필드 값 자체가 실값으로 바뀌므로 스냅샷 갱신이 나올 수 있음 — 값 변경은 '가짜→실값'이라는 정당화와 함께 기록.

| 항목 | 내용 | 위치(감사 시점) | 상태 |
|---|---|---|---|
| A1 | 득령/득지/득세 가짜 매핑(비겁합/인성합/그 합) → 실제 판정 배선. 엔진 facts의 deLingDiShi 분해(facts.ts 2330~2419 참조)를 판정 모델과 무관하게 항상 산출해 매핑하는 방식 권장 | springLegacy.ts:1132-1134 | ☐ |
| A2 | 용신 추천 1위 type 무조건 'JOHU' → 실제 지배 방법('EOKBU' 등) 산출 | springLegacy.ts:1151-1152 | ☐ |
| A3 | 육합(YUKHAP)·자형(JA_HYEONG)·삼형(SAMHYEONG) 라벨 키 추가 + 방출 타입↔라벨 테이블 전수 일치 테스트 | springLegacy.ts:77-96, saju-adapter.ts:202-237 | ☐ |
| A5 | surfaceNaeum/surfacePalace의 require() ESM 붕괴 → 정적 import로 수정 (켜면 emptySaju 전체 붕괴하는 버그) | saju-adapter.ts:1449, 1506 | ☐ |
| A6 | palace.ts 본기 선택 오류(`hidden[hidden.length-1]` → role==='MAIN') + 12지지 본기 조견표 테스트 | palace.ts:132 | ☐ |
| A9 | dstCorrectionMinutes=0 하드코딩 → 실제 오프셋-540 산출 | springLegacy.ts:1121 | ☐ |
| A15a | 1908년 이전 오프셋 정규식(초 성분) 수정, 실패 시 무경고 540 폴백 제거 | springLegacy.ts:290, 312-315 | ☐ |
| A15b | jie 폴백이 조작된 LICHUN 경계 반환 → null/sentinel화 | fortune/compute.ts:156-168 | ☐ |
| A15c | GONGMANG_DAY 영구 불발화 죽은 룰 제거 | defaultRuleSets.ts:323 | ☐ |
| A15d | daeunInfo.boundaryMode에 일경계 정책 오주입 → 실제 대운 경계 정보로 | springLegacy.ts:1186-1192 | ☐ |
| A15e | 午 월률 주석 자기모순 정정(丙10己10丁11=31 특수 명시) | wollyulData.ts:63-67 | ☐ |
| A15f | EoT 'precise'가 calendar 정밀도 미상속 → 배선 (고품질 기본 원칙) | trueSolarTime.ts:120-122, solar.ts:630-634 | ☐ |
| A15g | stale 주석 현행화(calTimeAdapter 사문화, solar/solarTerms/nutation 주석) | calTimeAdapter.ts, solar.ts:468, solarTerms.ts:270 | ☐ |

완료 시 상태 칸을 ✅로 갱신하고 커밋 해시를 병기할 것. **positionMultiplier 정리는 PR-2로 이월**(신살 표면 변경과 결합).

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
