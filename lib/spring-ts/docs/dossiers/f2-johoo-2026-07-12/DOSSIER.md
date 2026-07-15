# F2 조후위급(調候為急) 의사결정 Dossier — Codex 인계본

> 작성: 2026-07-12, Claude 감사 세션 (freeze `6fb2f68a4` 기준 조사; 2026-07-15 현재 checkout 재검증).
> 재현: spring-ts에서 `npx tsx docs/dossiers/f2-johoo-2026-07-12/verify-f2.mjs`. 현재 checkout의 saju-ts `src/`를 직접 import하므로 stale `dist/`를 읽지 않으며, 5표본 기대값은 이 스택의 정확한 source 상태에 결속된다.
> 배경: 2026-07-12 명리 판정 논리 적대 감사의 F2 후속 조사. 감사 전체 티켓은 부록 A.

## Codex 행동 지침 (이것부터)

| 구분 | 내용 |
|---|---|
| ✅ **지금 해도 되는 것** | ① `yongshin.ts` 주석의 "조후위급 시 우선" → "조후위급 시 개입" 정정(판정 무변경) ② baseline 픽스처 갭 보강: **丑월 명식·신약×위급월(S4형)** 추가 ③ 부록 A의 열린 T2·T4 처리 |
| ⛔ **전문가 답변 전 금지** | 조후 기본 동작 변경(대안 A/B/C 구현·기본값 변경·urgency 파라미터 조정). §7 예/아니오 질문 7개에 대한 명리 전문가 답변이 선행 조건. default-change fingerprint 절차 대상 |
| ⚠️ 주의 | 이 dossier는 **어느 대안도 정답으로 선언하지 않음**. 저장소 편찬 정본(16번 문서)이 조후 우선순위를 '학파 선택지'로 유보하고 있고, '우선' 주장의 최고 전거가 블로그 계층(§8)이기 때문 |

---

## 1. 호출 경로와 각 항의 상한·하한 (기본 config)

### 경로
```
graphFactory.ts:628~ (rules.facts)
 └ buildRuleFacts → computeClimateFacts        facts.ts:3117 → facts.ts:643-655
    └ computeClimateScores(need=−env, dot)     climate.ts:90-104 (모델표 :36-56)
 └ computeJohooTemplate (기본 null — opt-in)   facts.ts:3118 → johooTemplate.ts:163 (enabled===true만)
graphFactory.ts:660~ (rules.yongshin)
 └ computeYongshin                             yongshin.ts:677
    ├ DEFAULT_POLICY: climate 0.25, urgency{0.6/1.0/0.25}   yongshin.ts:312-333
    ├ climateMagnitude = ‖need‖                yongshin.ts:723
    ├ 레거시 urgency 승압(methodSelector 기본 off)  yongshin.ts:1184-1208
    ├ 항 합산 baseScores = bal+role+cli(+0항 6개)  yongshin.ts:1219-1243 (climateTerm :1226)
    ├ DSL evalRuleSet — 기본 룰셋 빈 배열       yongshin.ts:1249 / defaultRuleSets.ts:12-20
    └ ranking·tieBreak → best                  yongshin.ts:1256-1264
출력: engine.ts:341-362 (summary.yongshin) → springLegacy.ts:1938-1975 (finalYongshin·recommendations)
```
기본 config에서 medicine/tongguan/follow/johooTemplate/transformations/oneElement 가중 전부 0, methodSelector off(yongshin.ts:592 `enabled===true`), DSL 빈 룰셋 → **최종 점수는 정확히 3항**: `score(e) = w_bal·def(e) + w_role·pref(e) + w_cli·cs(e)` (5개 표본에서 소수 3자리까지 엔진 랭킹과 일치 실측).

### 각 항의 상하한
| 항 | 수식 | 하한 | 상한 | 근거 |
|---|---|---|---|---|
| def(e) | max(0, 0.2−share) | 0 | **0.2** | 균일 타깃 0.2, yongshin.ts:683-686 |
| pref(e) | lerp(weak,strong,t), t=(s+1)/2 | **−0.4** | **+1.0** | yongshin.ts:693-707 |
| cs(e) | dot(effect[e], −env) | **−0.54** (WATER@子) | **+0.51** (FIRE@子) | climate.ts 모델표 |
| ‖env‖ | 월별 고정 | 0.20 (辰) | **0.7616 (子)** | 아래 표 |
| urgency factor | clamp01((‖env‖−0.6)/0.4) | 0 | **0.4039** | yongshin.ts:1188-1190 |
| w_cli | 0.25×(1+1.0·factor) | 0.25 | **0.3510** | yongshin.ts:1196 |
| w_bal=w_role (=k) | 1×(1−0.25·factor) | **0.8990** | 1.0 | yongshin.ts:1198-1204 |

월별 ‖env‖ (urgency 발동 여부): 子 **0.762**(f=0.404) · 丑 **0.632**(f=0.081) · 午 **0.728**(f=0.320) / 寅 0.412 · 卯 0.283 · 辰 0.200 · 巳 0.412 · 未 0.510 · 申 0.361 · 酉 0.500 · 戌 0.412 · **亥 0.539(발동 안 함)**.
→ 게이트는 **子·丑·午 3개월에만** 열리고, 丑월은 factor 0.081로 사실상 무의미. maxBoost=1.0의 주석("at |need|≈1")은 모델상 도달 불가 스케일.

## 2. 수학적 증명 — "게이트가 열려도 조후 오행이 1위가 될 수 없는 조건"

조후 오행 C가 임의의 오행 B를 이기려면:
```
w_role·(pref_B − pref_C) < w_cli·(cs_C − cs_B) + w_bal·(def_C − def_B)
```
우변 상계: cs차 ≤ 월별 최대폭 Δcs, def차 ≤ 0.2. 양변을 k(=w_role=w_bal)로 나누면 **역전 필요조건**:
```
prefGap := pref_B − pref_C  <  G(월) := Δcs·w_cli/k + 0.2
```
| 위급월 | Δcs | w_cli | k | **G** |
|---|---|---|---|---|
| 子 | 1.05 (FIRE−WATER) | 0.3510 | 0.8990 | **0.610** |
| 午 | 0.98 (WATER−FIRE) | 0.3300 | 0.9200 | **0.552** |
| 丑 | 0.86 | 0.2703 | 0.9797 | **0.437** |

pref는 t의 1차식(RESOURCE 1.0−1.2t, COMPANION 0.6−0.7t, OUTPUT −0.2+t, WEALTH/OFFICER −0.4+t; yongshin.ts:693-707). 따라서 **prefGap ≥ G인 강약 구간에서는 어떤 오행 분포(def 최대 유리, cs 최대 유리 가정)에서도 조후 오행 1위가 불가능**:

| 충돌 유형 (C=조후 오행 역할, B=억부 최선) | prefGap(t) | 子월 불가능 영역 | 午월 | 丑월 |
|---|---|---|---|---|
| 신약: C=식상, B=인성 (예: 겨울 신약 木일간의 火) | 1.2−2.2t | **s < −0.464** | s < −0.410 | s < −0.307 |
| 신약: C=재·관, B=인성 (예: 겨울 신약 金水일간의 火) | 1.4−2.2t | **s < −0.282** | s < −0.229 | s < −0.125 |
| 신강: C=인성, B=식상 (예: 여름 극신강 木일간의 水) | 2.2t−1.2 | s > 0.645 | **s > 0.592** | s > 0.489 |

**정리**: 이 상계는 위 표에 열거한 조후 오행 C와 비교 오행 B의 **역할 충돌이 실제로 존재하고 `prefGap >= G`인 경우에만** C의 1위 역전이 불가능하다는 조건부 명제다. 조후와 억부가 일치하거나 다른 역할 조합에는 일반화하지 않는다. 아래 5표본은 그 조건 사례이지, 극단 강약 전체에 대한 전칭 증명이 아니다.
(상계 증명이므로 해당 역할 충돌 안에서는 실제 불가능 영역이 표보다 넓을 수 있다. 압박측 내부에서도 식상−재·관 pref차가 상수 0.2라 w_cli·Δcs_동측 ≈ 0.14 < 0.2×k이며, 신강 겨울 표본 S5는 이 제한의 한 사례다.)

## 3–4. 고정 표본 5개 — 현재 점수와 최종 순위 (기본 config 실측)

| 표본 | 명식 | s(강약) | factor | 억부 1위 (bal+role) | 조후 오행 | 조후 순위 | 격차 λmin | 판정 |
|---|---|---|---|---|---|---|---|---|
| **fix-03**† | 己卯 丙子 戊午 壬子 (戊土 子月) | +0.023 (중화) | 0.404 | FIRE=조후와 동일 | FIRE | **1위** | 0 | 조후·억부 일치 사례; 중화 전체로 일반화 금지 |
| **fix-05**† | 乙酉 戊子 癸未 乙卯 (癸水 子月 '겨울 조후 케이스') | −0.146 | 0.404 | METAL 인성 | FIRE | **2위** | 0.139 | 역할 충돌 조건에서 패배 |
| **fix-06**† | 戊午 戊午 戊申 己未 (戊土 午月) | +0.806 (극신강) | 0.320 | METAL 식상(Σ0.788) | WATER | **2위** (Σ0.777) | 0.011 | 초근소 패배(재성이라 억부와 부분 호환) |
| **S4** | 丁巳 丙午 庚寅 丁丑 (庚金 午月 신약) | −0.418 | 0.320 | EARTH 인성 | WATER | **3위** | 0.222 | §2 역할 충돌 조건의 사례 |
| **S5** | 壬子 壬子 壬申 庚子 (壬水 子月 극신강) | +0.983 | 0.404 | WOOD 식상(Σ0.930) | FIRE | **2위** (Σ0.891) | 0.039 | 동측(압박) 내 식상>재성 상수 격차 실증 |

† = baseline 17픽스처 소속. 오행별 bal/role/cli 항 분해는 `verify-f2.mjs` 실행 출력에 전부 나옴.
참고 대조: `johoo`/`johoo.strict` 프리셋(opt-in, builtin.pack.json)은 5표본 전부 조후 오행을 1위로 산출(w_cli 1.7~2.5).

## 5. 정책 대안 3개 비교 (선언 아님 — 전문가 결정 자료)

**A. 위급 시 조후 hard override** (factor>0이면 climate argmax 강제 1위)
- 표본 예측: fix-03 불변 / fix-05 METAL→FIRE / fix-06 METAL→WATER / S4 EARTH→**WATER** / S5 WOOD→FIRE.
- 부작용: ① 월지 결정론(같은 위급월이면 명식 무관 동일 용신) ② ‖env‖=0.6 문턱 불연속(亥월 계속 배제) ③ **신약 명식에 극제 오행(관살·식상) 1위 가능** — 억부 교리와 정면 충돌(Q2·Q4) ④ 丑월 factor 0.081에도 무조건 발동 ⑤ consensus/confidence 의미 재정의 필요(감사 F7과 얽힘).
- default 변경 범위: 위급월 출생(3/12개월) 중 조후≠억부 명식.

**B. 위급도 비례 bonus/floor** (`score_C += factor×λ`)
- λ 실측 요구값(표본 역전 기준 λ ≥ λmin/factor): fix-05 **0.344** / fix-06 **0.034** / S4 **0.694** / S5 **0.097**. → 작은 bonus는 fix-06 같은 초근소 사례만 뒤집고, fix-05·S4까지 포함하려면 더 큰 미승인 계수가 필요하다.
- 부작용: 새 magic 계수 1개(권위 코퍼스 캘리브레이션 필요 — provisional 라벨 대상). 연속·kill switch(λ=0=현행 바이트 동일) 장점.

**C. 억부·조후 분리 판정 후 2단계 합성**
- 축 분리는 이미 존재(consensus.eokbu/johu — yongshin.ts:444-453·477-485; 5표본 모두 johu축이 조후 오행을 정확히 지목). 1단계: 수치 불변 + `johooUrgent{factor, element}` 표면 노출 + springLegacy 병기(finalYongshin 유지 시 스냅샷 무파급). 2단계: 합성 규칙을 별도 파라미터로.
- 부작용: **작명 파이프라인은 결국 단일 오행이 필요** → 합성 규칙 결정이 다시 필요(A/B로 회귀). 결정을 미루는 안.

**공통 회귀 불변식**: ① 비위급월(9/12) 랭킹 바이트 불변 ② 위급월에서 조후=억부 일치 명식(fix-03형) 불변 ③ λ=0/off에서 현행 바이트 동일 ④ measure_default_change + fingerprint 절차 ⑤ consensus.johu축=조후 오행 지목 유지.

## 6. 기존 17 snapshot이 못 잡는 변화 (별도 표시)

| 커버 | 내용 |
|---|---|
| ✅ 잡힘 | fix-05(子월, METAL→FIRE), fix-06(午월, METAL→WATER — λ 0.011이라 미세 변화에도 뒤집혀 조기 검출기) |
| ✅ 불변 확인용 | fix-03(위급월+조후=억부 일치 — 대안 적용 후에도 불변이어야 함) |
| ❌ **못 잡음** | ① **丑월 명식 전무**(17픽스처 월지에 丑 없음) — factor 0.081 경로 무커버 ② **신약 극단×위급월**(S4 프로필, s≤−0.4) 전무 — hard override 최대 쟁점(신약에 극제 용신) 무커버 ③ threshold 인하 대안 시 亥월 경계는 fix-10 하나뿐 ④ consensus/confidence 필드의 스냅샷 포함 여부 별도 확인 필요 |

→ 어느 대안이든 채택 시 **S4형(신약×위급월)·丑월 픽스처를 baseline에 추가** 필요. 스냅샷 비포착 변화는 `default-change:snapshot-invisible` 라벨 대상.

## 7. 전문가 확인 질문 (예/아니오, 7개)

1. 위급월(현행 子·丑·午)에서 조후 오행이 억부 오행보다 **최종 1위**여야 합니까? *(아니오 → 코드 불변, yongshin.ts:313-316 주석 정정만으로 종결)*
2. **신약 명식에서도** 조후 우선을 적용합니까 — 겨울 신약 金水 일간에서 火(관살)를 1위로 둘 수 있습니까? *(예 → A / 아니오 → B(λ≈0.2, 신약 가드 내장) 방향)*
3. 위급월에 **亥월을 포함**해야 합니까? *(현 모델 ‖env‖=0.539 < 임계 0.6이라 배제)*
4. **丑월**을 子·午와 동급 위급으로 취급합니까? *(현행 factor 0.081로 사실상 무발동)*
5. 조후 위급도 판정은 **월지 단독**으로 충분합니까 — 전국 지지 구성(수국·화국 등) 반영은 불필요합니까?
6. 조후 우선을 켤 경우 **궁통보감 120셀 표**(천간 레벨, 채록·이중 대조 완료)를 수치 climate 모델보다 우선해야 합니까? *(예 → `qiongTongBaoJian` 프리셋 요소의 기본 승격 검토)*
7. 조후 오행이 1위가 될 때 기존 억부 오행을 **희신(2위)으로 표기**하는 것으로 충분합니까? *(레거시 finalHeesin 계약 — 감사 F8과 연동)*

## 8. Authority 문서 vs 코드 주석 구분

| 계층 | 자료 | 조후 우선순위에 대해 말하는 것 |
|---|---|---|
| **편찬 정본**(in-repo, 독립 검토 대기) | `lib/saju-ts/docs/16_yongshin_methods.md` :15·:43·:92·**:122-123** | 調候為急 계보 인정하되 **"조후 우선 vs 부억 우선은 이설이 프리셋 선택지로 병존"** — 우선 규칙 미확정 |
| 〃 | `lib/saju-ts/docs/20_johoo_template.md` §3.4-§5 (**:150**) | urgency 수식 문서화. **"climate.ts의 temp/moist 수치는 현대적 추정치로 고전 전거가 없다"** — §2 증명의 상수는 무전거 수치 위의 산술 |
| **데이터 정본** | `lib/saju-ts/src/rules/packs/johooQiongTongBaoJianTable.ts` (120셀) | 조후의 고전 전거 본체. **기본 config에서 휴면**(weights 0 + enabled=false 이중 가드) |
| 거버넌스 기록(교리 권위 아님) | `lib/spring-ts/docs/AUDIT_SAJU_ENGINE_INTEGRITY.md:597-601` (B6) | "조후위급 시 우선은 넓게 공유되는 예외 규칙" — **출처 sazasaju.com·8-codes.com 블로그 계층**. 권고문 자체는 '극단 명식에서만 조후 **개입**'(우선 아님)이었고 구현은 권고를 정확히 따름 |
| 단순 코드 주석(전거 없음) | `yongshin.ts:313-316`, `climate.ts:34-35` | "주류 관행(…조후위급 시 우선)에 정렬" — §2에 의해 '우선' 부분은 산술적으로 거짓 서술 |

**결론**: (i) 주석 정정('우선'→'개입')은 사실 교정으로 즉시 가능. (ii) 기본 동작 변경(A/B/C)은 §7 답변 없이 착수 불가 — 저장소 원칙(무전거 계수 금지, default-change 승인)과 정합.

---

## 부록 A. 2026-07-12 명리 판정 논리 적대 감사 — 티켓 목록 (F2 외)

상세 근거는 감사 세션 최종 보고(메모리 `saju-engine-integrity-audit` 참조). 모두 상호 독립.

| 티켓 | 발견 | 위치 | 내용 | 상태 |
|---|---|---|---|---|
| T1 | F1 (P0) | facts.ts 격 후보 선정 | 일간 자신을 투간 증거에서 제외하고 탈락 증거를 보존. 甲日亥月·丙日寅月 오분류와 토 잡기월 strict/compat 경계를 회귀 고정 | **코드 수정 완료(PR #671, `4426696af`); 독립 명리 authority 검토 대기** |
| T2 | F4 (P1) | defaultRuleSets.ts:46-108, gyeokguk.ts:364-418 | HUA_QI/ZHUAN_WANG 룰 `if factor>0 else fallback`이 조건팩 veto(0)를 우회 — exists 검사로 0/undefined 구분 | 대기 |
| T3 | F3 (P1) | gyeokgukSeongpae.ts·gyeokguk.ts | 월지 형충 동일 증거의 quality/seongpae 이중 감점을 제거하고 provenance를 분리 | **완료 (`68af0eb2f`, `632d64dd1`), 회귀 테스트 통과** |
| T4 | F7 (P1) | yongshin.ts:502-516 | consensus confidence=0.35 상수·conflictLevel 항상 'high'(6/6 실측) — margin 정규화+임계 재보정 | 대기 |
| T5 | F6 (P1) | strengthFacts.ts | 관성 기반 감쇠를 위치가중→정규화→배율층으로 통일 | **완료 (`68af0eb2f`, `9951181a8`), 회귀 테스트 통과** |
| T6 | F8 (P2) | springLegacy.ts:1494-1496·1940-1942 | finalHeesin=랭킹2위/gisin=최하위 기계 유도 — primaryMethod 인지형으로 (교리 검토 병행) | 대기 |
| T7 | F12 (P2) | 계수 dossier·inventory.json | 무전거 magic 계수 56건 인벤토리 문서화(코드 무변경) | **이 스택에서 완료** |

감사에서 확인한 불변식(재감사 불요): 시간 경계 이중 적용 없음(연월 UTC 절입, hourStemDayBoundary 분리), 관계 탐지 중복 방출 없음(삼형→형쌍·삼합→반합 억제), 오행 분포 이중 계상 없음, 신강약 상호작용 주입 (1+f) 층 한정 원칙 준수.
