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

검증 기대치 변경: **saju-ts vitest 191/191** (기존 178 → A12 +5, 왕상휴수 +7, include 확장 +1).

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

## 2. PR-10-1 잔여: seasonal 비대칭 감쇠 기본화 [난이도 중 — 계측만]

- 코드는 전부 랜딩됨(f792c7765). 남은 것: §1 절차로 계측 → 기본화 여부 결정.
- 기본값 뒤집는 지점: `lib/saju-ts/src/rules/facts.ts` `readStrengthInteractionPolicy`의
  `seasonal.enabled: enabled && seasonalRaw.enabled === true` → `!== false`로 변경.
- multipliers(왕 0.7/상 0.85/휴 1.0/수 1.15/사 1.3)는 보수 개시값 — 계측에서 회귀가 나오면
  왕 0.8/사 1.2로 완화해 재계측.
- 부속(선택): summary.seasonalStates의 springLegacy 재방출 + 해석 저작은 콘텐츠 축(CT-3와 함께).
  재방출 시 deepSerialize 스프레드로 스냅샷 표면에 즉시 등장함을 잊지 말 것(스냅샷 재캡처 동반).

## 3. PR-10-2: 궁위 pairs 기반 감쇠 세분 [난이도 중상 — 설계 확정본]

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

## 4. PR-12-4: 음양 균형 노출 — 5층 배선 exemplar [난이도 하 — 이 레시피가 12-x 공통 본보기]

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
