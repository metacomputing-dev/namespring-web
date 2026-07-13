# 정책 계수(Magic Number) 감사 Dossier — Codex 인계본

> 작성: 2026-07-12, Claude 감사 세션. 기준: freeze `6fb2f68a4` (조사 시점 워크트리 lib/saju-ts src == freeze 확인).
> 방법: 읽기 전용 정적 분석 + 프리셋/테스트 실측 grep. 에이전트 미사용, 수치 변경 제안 없음.
> 기계 판독본: 이 폴더의 `inventory.json` (인벤토리 56건 전체).
> **주의: 이 문서의 어떤 서술도 "현재 수치가 명리적으로 승인되었다"는 뜻이 아니다.** 전 계수는 아래 분류 태그에 따라 [고전]=조견·정의 계열, [정책]=학파·제품 선택, [캘리브]=데이터 캘리브레이션 전까지 provisional, [표시]=표시·UI 전용으로 구분되며, [캘리브] 값의 수치 자체는 미승인 상태다.

## 범위와 제외

- 대상: lib/saju-ts 판정 경로 + lib/spring-ts 어댑터(springLegacy.ts). 프론트엔드 제외.
- **제외(이 문서는 해당 영역을 재분석하지 않는다)**: F1은 `0416c3daa`에서 코드 수정 완료 후 exact diff·명리 검토 대기(월지 격 후보 점수 GK-09는 인벤토리 수록만), F4(DSL veto fallback)와 F7(consensus conflictLevel/confidence — 인접 표시 상수 FX-06은 수록만, 티켓 제외)은 별도 대기.
- 조후 우선순위 정책은 별도 dossier가 정본: `../f2-johoo-2026-07-12/DOSSIER.md`.

## Codex 행동 지침

| 구분 | 내용 |
|---|---|
| ✅ 착수 가능 | 티켓 G1~G5 (§G — 상호 독립). G1~G3은 로직 무변경, G4는 기본 config 불변·비기본 `norm<=0` 변경, G5는 승인 전 현행동작 특성화만 허용 |
| ⛔ 금지 | [캘리브] 태그 계수의 **수치 변경**(authority holdout·measure_default_change 절차 없이 불가), [정책] 태그 기본값 변경(전문가/소유자 결정 대기) |
| ⚠️ 참고 | §E의 질문들은 명리 전문가 확인 사항 — 코드로 선결하지 말 것 |

---

## A. P0/P1/P2 발견 요약

**P0 — 없음.** (숫자 자체가 판정을 즉시 틀리게 만드는 결함은 이 렌즈에서 미발견. 정확도성 결함은 별도 감사 F1~F7에서 티켓화됨.)

**P1 (구조 위험 4건)**

1. **P1-A: 용신 가중치가 비정규화 신호에 곱해짐 — 명목 가중과 실효 영향의 괴리.** 방법축 신호의 자연 범위가 제각각: balance(def) 0~0.2, role(pref) −0.4~+1.0(폭 1.4), climate −0.54~+0.51(폭 1.05), medicine 0~0.8, tongguan/follow/oneElement 0~1, template 0~0.75. 명목 가중 1:1:0.25(yongshin.ts:317)의 실효 영향은 0.2 : 1.4 : 0.26 — **role이 사실상 지배**하고 '가중치'가 정책 의미를 담지 못함. F2(조후 열세)는 이 구조의 한 단면이며 medicine·tongguan을 켜는 프리셋에서도 재발. 축별 정규화 없이는 프리셋 가중이 학파 의도를 표현한다고 보장 불가.
2. **P1-B: 충·형·파·해·원진 감쇠 계수가 4벌 존재, 상대 서열 상호 모순.** ①신강약 뿌리감쇠: 충 0.5·형 0.7, **파/해/원진 0(불인정)** (strengthFacts.ts:207-213) ②격국 damage: 충 1.0>형 0.8>해=파 0.7>원진 0.5 (facts.ts:2064) ③신살 conditions: **전부 균일 0.5**, HAP/GONGMANG도 0.5 (shinsalConditionsBasePack.ts:75-83) ④합화 break: stemClash 0.12·branchDamage 0.08 (facts.ts:1621-1624). 도메인별 의도 차이일 수 있으나 **서열이 왜 다른지 교차 근거표가 없음** — 한쪽만 수정되는 드리프트 경로.
3. **P1-C: config 모양이지만 사실상 상수.** builtin.pack.json 18개 프리셋이 실제 변주하는 계수는 yongshin `weights`(14회)·quality(2)·conditions(1)뿐. **strength 내부 계수 14개(lingScale/diScale/shiScale/rootNorm/shiNorm/resAlpha/posW/branchWeights/interaction 전부), 격국 quality·seongpae 계수, transformations 계수는 프리셋 변주 0회 + 스키마 문서 부재.** '학파 정책 표면'과 '엔진 내부 계수'가 같은 config 네임스페이스에 섞여 소유권 불명. 사용자는 임의 키를 무검증 num() 폴백으로 덮어쓸 수 있어 지원 불가 조합이 열려 있음.
4. **P1-D: 정규화·임계 상수의 다중 정의(동기화 위험).** rootNorm 2.2·shiNorm 1.6·rootResAlpha 0.6·shiResAlpha 0.7이 **3곳**(strengthFacts.ts:615-619 / 전왕팩 facts.ts:819-822 / 종격팩 facts.ts:1180-1181), 종격 weakThreshold −0.78·minDom 2.2가 **2곳**(facts.ts:1066-1068 / yongshin.ts:586-588), branchWeights(0.7/1.1/0.9/0.7) 2곳(strengthFacts.ts:632-637 / facts.ts:825-830). 록 조견 2곳(facts.ts:3058)은 의도적 분리 주석 있음(예외). 기존 기록('램프 수식 이중 구현 — 동기화 필수')과 같은 유형의 확산.

**P2 (6건)**

- **P2-a**: 경계값 fail 방향 불일치 — strength diNormed는 rootNorm→0에서 `clamp01(x/1e-9)`=**1 (fail-open, 최대치)** (strengthFacts.ts:678, shiNorm 동일 :700), 격국 quality rootFactor는 rootNorm≤0→**0 (fail-closed)** (facts.ts:2194). 같은 이름의 0-처리 방향이 반대.
- **P2-b**: springLegacy 신살 폴백 매직 — `qualityWeight ?? 0.6`(springLegacy.ts:1817, 누락 시 무근거 0.6) + 엔진 scoresAdjusted(글자수×quality)와 어댑터 weightedScore(quality×100×궁위배율)의 **이중 점수 체계**.
- **P2-c**: 통근 강도 등급 2벌 — 어댑터 득지 DEUK_ROOT_GRADE 본기1/중기0.6/여기0.3(springLegacy.ts:1398) vs 엔진 지장간 가중 0.6/0.3/0.1(hiddenStems.ts:88-91). 표시축이라 판정 무영향이나 상이한 수치 서사 노출.
- **P2-d**: 위치(궁위) 가중 4벌 — 강약 천간 posW(0.6/1.0/0.8)+지지 branchWeights(0.7/1.1/0.9/0.7), 합화 positionWeights(.15/.35/.35/.15), 분포 positionWeights(균일 1), 신살 seat(일1/월0.85/년0.7/시0.6). 공유 근거 없음.
- **P2-e**: 테스트가 계수 정확값에 결박 — toBeCloseTo(0.5)×7, (0.3)×4, (0.25)×4, (1.28/1.22)=12운성 배율, (0.95)=seongpae UNDETERMINED 등. strengthInteraction 5곳·johooTemplate 13곳. 회귀 감지기 역할은 하나 **순서·부호·단조성 불변식 테스트가 없어** 재캘리브레이션 시 전량 수동 갱신 대상.
- **P2-f**: 표시층 신뢰도 상수 — scoreDiffConfidence floor 0.35(springLegacy.ts:679-686), 종격 HIGH cap 35(:1946-1947), grade A/B/C 경계 0.85/0.5(:790-796). **F7 인접 계열 — 기록만, 분석·티켓 제외.**

---

## B. 계수 인벤토리 (56건 — 기계 판독본 inventory.json)

단위 표기: `×`=0~1 배율, `raw`=글자수·가중합 점수, `+`=additive 보너스/페널티, `pt`=0~100 표시 점수, `th`=임계.
분류: **[고전]** / **[정책]** / **[캘리브]** / **[표시]** — [캘리브]는 "데이터 캘리브레이션 전까지 provisional·수치 미승인"을 뜻한다.

### B-1. 신강약 (deLingDiShi + 상호작용)

| ID | 파일:라인 | 값 | 의미 | 층·단위 | 현재 근거 | 위험 | 권장 소유 |
|---|---|---|---|---|---|---|---|
| ST-01 | strengthFacts.ts:611-613 | lingScale .18 / diScale .14 / shiScale .10 | 득령/득지/득세 배율 진폭 | (1+f) 배율층 · × | 없음(진리값 세션: 월령 과소가중 판정) | 강약 전체 좌우 | **캘리브** |
| ST-02 | strengthFacts.ts:615-616 | rootNorm 2.2 / shiNorm 1.6 | 통근·투간 포화 정규화 | 배율층 · raw→× | 없음 | 포화점이 판정 민감 | **캘리브** |
| ST-03 | strengthFacts.ts:618-619 | rootResAlpha .6 / shiResAlpha .7 | 인성 뿌리/투간 할인 | 배율층 · × | 없음 | 인성 비중 | **캘리브** |
| ST-04 | strengthFacts.ts:621-625 | posW 년.6/월1.0/시.8 | 득세 천간 위치가중 | 배율층 · × | 통설 방향만 | P2-d 계열 | **캘리브** |
| ST-05 | strengthFacts.ts:632-637 | branchWeights 년.7/**월1.1**/일.9/시.7 | 득지 지지 위치가중 | 배율층 · × | 통설 방향만 | P2-d + facts.ts:825 중복(P1-D) | **캘리브**(단일화) |
| ST-06 | strengthFacts.ts:112-120 | seasonSupport +1/+.6/−.6/−.8/−.3 | 득령 부호표(생극 5분기) | 배율층 · 부호 | 방향=생극 정의 | 크기 provisional | 방향 **[고전]**, 크기 **캘리브** |
| ST-07 | strengthFacts.ts:207-213 | 충 .5 / 형·자형·삼형 .7 (파해원진 없음) | 뿌리 손상 잔존율 | 통근 감쇠 · × | 주석: 30~70% 서술대 중앙값 | P1-B | **정책+캘리브** |
| ST-08 | strengthFacts.ts:214 | floor .3 | 감쇠 하한 | 통근 감쇠 · × | 없음 | 다중충 하한 | **캘리브** |
| ST-09 | strengthFacts.ts:226-230 | positional d1 1.0/d2 .5/d3 .25 | 인접/원격 손상 차등 | 통근 감쇠 · × | 주석: 인접성 통설의 보수 개시값 | authority holdout 대기 명시 | **캘리브** |
| ST-10 | strengthFacts.ts:236-243 | hui 삼합 .10/방합 .08/반합 .05, resAlpha .6, max .15 | 회국 보정 | 배율층 가산 · + | 주석: lingScale 대비 보수 | 캡 존재 | **캘리브** |
| ST-11 | strengthFacts.ts:249-250 | stemBind .5 / 쟁합 .75 | 천간합 기반(羈絆) 잔존율 | 득세 배율·관살 raw 차감 · **혼용** | 주석: 역할 절반 상실 | **C-3 단위 혼용** | **정책+캘리브** |
| ST-12 | strengthFacts.ts:259-265 | 왕.7/상.85/휴1.0/수1.15/사1.3 | 왕상휴수 비대칭 감쇠 | 감쇠 배율의 배율 · × | 주석: 통설의 보수 개시값 | authority 대기 명시 | **캘리브** |
| ST-13 | strengthFacts.ts:541-554 | 12운성 root 배율 12종(제왕1.28~절.6) | 통근×운성 (opt-in, 기본 off) | 배율층 · × | 없음 | 테스트 정확값 결박(P2-e) · ST-12와 동시 활성 시 상호작용 미문서(C-7) | **캘리브** |
| ST-14 | strengthFacts.ts:783-784 | seasonScale .14 / rootScale .1 | seasonalRoots 레거시 모델 | 배율층 · × | 없음 | opt-in 잔존 | 코드(레거시 동결) |
| ST-15 | api/config.ts:41 + strengthFacts.ts:594 | excludeDayMasterSelf 기본 off | 일간 자기셈입 | base 원장 · raw | 판결 세션: 강측 편향 원인 | default-change 승인 대기 | **정책**(결정 대기) |
| ST-16 | springLegacy.ts:1484 | 강약 레벨 경계 ±0.15 | 신강/중화/신약 3분류 | 표시 임계 · th | 없음 | 오라클 재캘리브 대상(로드맵 기존재) | **캘리브** |

### B-2. 용신 (F2·F7 제외 부분)

| ID | 파일:라인 | 값 | 의미 | 층·단위 | 현재 근거 | 위험 | 권장 소유 |
|---|---|---|---|---|---|---|---|
| YS-01 | yongshin.ts:317 | balance 1 / role 1 / climate .25 (나머지 0) | 방법축 명목 가중 | 합산층 · **혼합단위** | AUDIT B6(블로그 계층 출처) | **P1-A** | **정책**(프리셋 실변주 ✓) |
| YS-02 | yongshin.ts:693-707 | weakPref/strongPref 10값(인성1.0 ↔ 식상.8 등) | 강약별 십성군 선호 | 합산층 · raw(−.4~1) | 방향=억부 통설, 값 근거 없음 | 실효 지배축(P1-A) · flat strongPref는 판결 세션 지적 | 방향 **[고전]**, 값 **캘리브** |
| YS-03 | yongshin.ts:586-588,613 | follow weak −.78 / minDom 2.2 / thr .55 | 종격 게이트 | 게이트 · th | PR-7: 램프 수식이 실차단 원인 | facts.ts:1066과 **중복(P1-D)** | **캘리브**(단일화) |
| YS-04 | yongshin.ts:601-609 | medicine thr .18/boost .9/reduce .15 · tongguan thr .25 | 선택기 게이트 | 게이트 · th | 없음 | 기본 off | **캘리브** |
| YS-05 | yongshin.ts:625-638 | transformations thr .55 · oneElement thr .62 · competition power 2.0/minKeep .2 | 특수격 게이트·경쟁 | 게이트 · th | 없음 | 기본 off | **캘리브** |
| YS-06 | yongshin.ts:803 | oneElementBoost .35 | 전왕→종격 부스트 | 게이트 승수 · × | 없음 | 기본 경로 도달 안 함 | **캘리브** |

### B-3. 조후 (정본은 f2-johoo dossier — 여기서는 단위 관점만)

| ID | 파일:라인 | 값 | 의미 | 층·단위 | 현재 근거 | 위험 | 권장 소유 |
|---|---|---|---|---|---|---|---|
| CL-01 | climate.ts:36-49 | 월별 env 12×2(한난·조습) | 계절 환경 벡터 | 신호 · −0.7~0.7 | **문서 20 L150: 고전 전거 없음 명시** | F2 §2 상수의 원천 | **캘리브**(또는 궁통보감표 대체) |
| CL-02 | climate.ts:50-56 | elementEffect 5×2 | 오행의 한난조습 효과 | 신호 · −0.6~0.6 | 〃 | 〃 | **캘리브** |
| CL-03 | yongshin.ts:327-332 | urgency thr .6 / maxBoost 1.0 / reduce .25 | 조후위급 게이트 | 가중 재조정 · th/× | F2: maxBoost 명목상 도달 불가 | F2 dossier §7 결정 대기 | **정책**(전문가) |
| CL-04 | johooTemplate.ts:163-171 | 계절필수 .35 / 천간선호 .25 / 표주용신 .5 / 보좌 .25 | 템플릿 보너스 | 합산층 · + | 궁통보감 표 자체는 [고전], 보너스 크기는 근거 없음 | 기본 off | 표 **[고전 table]**, 크기 **캘리브** |

### B-4. 격국 (F1 선정 로직 제외 — 계수 수록만)

| ID | 파일:라인 | 값 | 의미 | 층·단위 | 현재 근거 | 위험 | 권장 소유 |
|---|---|---|---|---|---|---|---|
| GK-01 | facts.ts:2064 | damageWeights 충1.0/형.8/해.7/파.7/원진.5 | 월지 손상 가중 | quality · raw합 | 서열 방향만 통설 | **P1-B 서열 모순** | **정책+캘리브** |
| GK-02 | facts.ts:2077 | tanhap 잔존 삼합0/육합.5/반합.5 | 탐합망충 해소율 | quality · × | 주석: 주류/인접성 미배선 보수값 | strength 해소(이진)와 **불일치(C-2)** | **정책** |
| GK-03 | facts.ts:2082-2087 | clarity 가중 gap.25/align.2/method.2/purity.2/root.15 · 청탁 th .66/.6 · broken th 1.0 · rootNorm 1.0 | 청탁 합성 | quality · × | 없음 | 사실상 상수(P1-C) | **캘리브** |
| GK-04 | facts.ts:2163-2184 | alignment 1−.25·rank / method 1.0/.9/.85/.7 / purity 1−.3·(k−1) | 청탁 부품 점수 | quality · × | 없음 | 〃 | **캘리브** |
| GK-05 | facts.ts:2262 | multiplier = integrity×(.5+.5·clarity) | 품질 종합 | quality · × | 없음 | clarity 바닥 0.5 — 의도 미문서 | **캘리브** |
| GK-06 | gyeokguk.ts:240-246 | seongpae 성격1.08/파중유구1.0/성중유패.9/파격.75/미확정.95 | 성패 verdict 배율 | 점수 배율 · × | 주석: provisional 명시 | 별도 감사 F3(이중감점)과 연동 | **캘리브** |
| GK-07 | gyeokgukSeongpae.ts:226,231 | hiddenSangshin minWeight .3 / decisiveMargin .4 | 성패 세부 게이트 | 게이트 · **th(raw)** | 없음 | **C-4 단위 불일치** | **캘리브** |
| GK-08 | defaultRuleSets.ts:59,74,86,99-104,113-116 | 특수격 gate .6/.62 · 점수 ×.85 | 화기/전왕/종격 후보 | DSL · ×(0.85 스케일) | 없음 | quality multiplier(≤1)와 순위 비교되는 암묵 등가 가정 | **캘리브** |
| GK-09 | facts.ts:3005-3021 | 격 후보 MAIN+.15/VISIBLE+.55/GROUP+.35/DAMAGED−.1 | 월지 격 후보 점수 | 선정 · + | 없음 | **F1 영역 — `0416c3daa` 코드 수정 완료·검토 대기, 본 감사 분석·티켓 제외** | (F1 후속) |
| GK-10 | gyeokguk.ts:574-616,646-717 | jonggyeok evidence: .46/1.35 · 가중 .28/.2/.18/.16/.12/.12 · blocker .2/.14/.1/.08 · status th .18/.28/.68 · 전왕 .58/.24/.18 · 화기 .62/.2/.18 · gate .2/.45 | 종격 후보 증거 점수 | evidence-only(승격 안 함 명시) · × | 없음 | 어댑터 jonggyeokRisk가 판정 신호로 소비 — 순수 표시 아님 | **캘리브** |
| GK-11 | springLegacy.ts:1029-1080 | composite classical: .75/.72/.45/.65·.35/.6/.3/.55/damage÷3×.12/.12/.07/.05/.05/.08/.03/.06 | 레거시 격국 후보 표시 점수 | 표시 합성 · × | 없음 | candidates 순위로 노출 | **표시**(동결) 또는 **캘리브** |

### B-5. 합화·특수격 조건팩

| ID | 파일:라인 | 값 | 의미 | 층·단위 | 현재 근거 | 위험 | 권장 소유 |
|---|---|---|---|---|---|---|---|
| TF-01 | facts.ts:1584-1614 | thr .55 · share .6/season .4/root .1/pos .1 · posW .15/.35/.35/.15 · rootW .65/.35 | 합화 blended 신호 | 신호 · ×(정규화 ✓) | 없음 | 기본 on — HUA_QI 후보의 원천 | **캘리브** |
| TF-02 | facts.ts:1621-1624 | break stemClash .12/branchDamage .08/inter .08 → 1/(1+p) | 파합 감쇠 | 신호 · + → × | 없음 | P1-B 4번째 감쇠 체계 | **캘리브** |
| TF-03 | facts.ts:1629-1630 | competition startRatio .75/maxPenalty .4 | 복수 합화 경쟁 | 신호 · × | 없음 | 기본 off | **캘리브** |
| TF-04 | facts.ts:1640-1668 | huaqi팩 th share.45/quality.55/root.35/harm.18/origWeak.28/distExp 2.5 + 가중 8종 + 페널티 .25/.1/.08 | 화기격 조건팩(opt-in) | 게이트 · th | 없음 | 기본 off | **캘리브** |
| SP-01 | facts.ts:806-857 | zhuanwang팩 th ling.55/di.35/shi.25/quality.55/harm.18 + 가중 7종 + 페널티 3종 (+rootNorm 2.2 **중복**) | 전왕 조건팩(opt-in) | 게이트 · th | 없음 | P1-D 중복 | **캘리브**(단일화) |
| SP-02 | facts.ts:1066-1203 | follow팩 th 7종(share.28/season.45/root.35/purity.55/quality.55/counter.18/opp.4) + 가중 7종 + typeAware .25/.12 · 관살반제 1.0/0.6 | 종격 조건팩(opt-in) | 게이트 · th | 없음 | 〃 | **캘리브**(단일화) |

### B-6. 신살

| ID | 파일:라인 | 값 | 의미 | 층·단위 | 현재 근거 | 위험 | 권장 소유 |
|---|---|---|---|---|---|---|---|
| SS-01 | shinsalConditionsBasePack.ts:75-83 | 감쇠 가중 7키 **균일 .5**(충·해·파·원진·형·합·공망) | 신살 품질 감쇠 | quality · × | 없음(균일=미분화) | P1-B — 관계살·공망 동일 크기 | **정책+캘리브** |
| SS-02 | shinsalConditionsBasePack.ts:84-88 | combine 'max' · weak th 1 · invalidate th 0 · 관계살 카테고리 제외 | 합성 방식 | quality · 방식 | A7/B9 감사 반영 | max=최강 1개만 — 다중조건 미가산 미문서 | **정책** |
| SS-03 | shinsal.ts:231 | legacy weakQualityWeight .5 | v0.11 하위호환 | quality · × | 하위호환 | 문서화만 | 코드(동결) |
| SS-04 | shinsal.ts:399-404 | 점수 base = matchedPillars **개수**(1~4), NONE=1 | 신살 점수 기저 | 점수 · **count** | — | count×quality 혼합 — 문서화 대상 | 코드 |
| SS-05 | springLegacy.ts:800-806 | seat 배율 일1/월.85/년.7/시.6(max 채택) | 궁위 가중 | 표시 점수 · × | 없음 | P2-d — 4번째 위치가중 체계 | **정책**(표시) |
| SS-06 | springLegacy.ts:1817,1825-1826 | qualityWeight 폴백 .6 · baseWeight=quality×100 · weighted=×seat | 레거시 점수 | 표시 · pt | 없음 | **P2-b·C-6** | **표시**(폴백 상수 제거 후보) |
| SS-07 | springLegacy.ts:790-796 | grade A≥.85 / B≥.5 / C | 등급 표기 | 표시 · th | 없음 | — | **표시** |

### B-7. 기타 (고정 가능·표시)

| ID | 파일:라인 | 값 | 의미 | 분류 |
|---|---|---|---|---|
| FX-01 | hiddenStems.ts:88-91 | 지장간 가중 (1)/(.7·.3)/(.6·.3·.1) | 월률분야 근사 — 통용 조견 계열 | **[고전-근사]**(표 소유; saryeong 스킴이 정본 대체 경로) |
| FX-02 | fortune/policy.ts:11, compute.ts:32-33 | 대운 10년 · 평균년 365.2425 · 3일=1년(설정형) | 고전 정의+천문 상수 | **[고전/물리]** |
| FX-03 | branchRelations.ts 등 조견 전반 | 충·합·형·파·해·원진·귀문 파트너표 | 고전 정의 | **[고전]**(별도 감사에서 전수 대조 완료) |
| FX-04 | springLegacy.ts:97-99 | 반올림 1자리 · 부족 ≤평균×.5 · 과다 ≥평균×1.7 | 부족/과다 라벨 | **[표시]**+**캘리브**(라벨 경계) |
| FX-05 | springLegacy.ts:1398 | DEUK_ROOT_GRADE 1/.6/.3 | 득지 표시 등급 | **[표시]** — P2-c(FX-01과 값 상이) |
| FX-06 | springLegacy.ts:679-686,1946 | confidence floor .35 · 종격 HIGH cap 35 | 신뢰도 표기 | **[표시]** — F7 인접, 티켓 제외 |

---

## C. 중복 적용·단위 불일치 후보

1. **C-1 (=P1-B)** 감쇠 계수 4벌·서열 모순: ST-07/GK-01/SS-01/TF-02. 특히 파·해·원진: 강약 0 ↔ 격국 0.7/0.5 ↔ 신살 0.5.
2. **C-2** 탐합망충 해소율 이원: 강약=완전 해소(이진, strengthFacts.ts:216-218) ↔ 격국=삼합 0/육합·반합 0.5 잔존(facts.ts:2077). 같은 교리, 다른 수치.
3. **C-3** 기반(羈絆) 단위 혼용: 지지 측=득세 **배율층 ×**(strengthFacts.ts:694-698) ↔ 압박 측=base 원장 **raw 차감**(1−factor, stemWeight=1 가정 하드코딩 :529). 별도 감사 F6/T5와 동일 지점의 단위-렌즈 재확인.
4. **C-4** 게이트 임계 단위 불일치: 대부분 임계는 0~1 정규화 신호 대상인데 seongpae decisiveMargin 0.4(GK-07)는 **raw tenGod 점수차**(글자수 단위, 0~8 스케일) 대상 — 같은 'threshold' 이름, 다른 단위.
5. **C-5 (=P1-A)** 용신 축 신호 스케일 불일치: 가중 적용 전 정규화 부재.
6. **C-6** 신살 점수 이중 체계: 엔진 scoresAdjusted(count×quality) vs 어댑터 weightedScore(quality pt×seat) — 같은 개념, 두 산식(+폴백 0.6).
7. **C-7** 같은 증거 이중 반영 조합: 월지 손상→quality.multiplier와 seongpae 강등의 재곱(별도 감사 F3 — 티켓 T3 기존재, 여기선 기록만). ST-12(왕상휴수)와 ST-13(12운성 배율, opt-in) 동시 활성 시 계절-통근 축 이중 반영 가능 — 상호작용 미문서.
8. **rootNorm=0 가드 방향 불일치 (=P2-a)**: strengthFacts.ts:678·700은 fail-open(→1), facts.ts:2194는 fail-closed(→0).

## D. 즉시 구조 개선 가능 (기본 config 판정 무변경) — §G 티켓으로 구체화

상수 단일 소스화(P1-D) / config 스키마·소유권 표(P1-C) / 감쇠 근거표(P1-B) / 경계 가드 방향 통일(P2-a, 비기본 config 변경) / 현행동작 특성화 테스트(P2-e, 정책 승인 아님).

## E. 명리 전문가 판단 필요 (코드로 선결 금지)

- 파·해·원진의 뿌리 손상 인정 여부(강약 0 vs 격국 0.7/0.5) 및 충↔형 서열.
- 탐합망충 잔존율(완전 해소 vs 절반)과 반합의 해충력.
- 신살 감쇠에서 합(HAP)·공망을 손상과 동급(0.5)으로 볼지.
- 궁위 서열의 도메인별 상이(신살 일지>월지 vs 강약 월지 최대)가 교리적으로 타당한지.
- 왕상휴수 비대칭 폭(0.7~1.3)과 12운성 배율의 동시 사용 정합(C-7).
- 조후 관련 7문항은 `../f2-johoo-2026-07-12/DOSSIER.md` §7이 정본.

## F. 캘리브레이션 데이터 없이 수치 변경 금지

ST-01~13, ST-16, YS-02, GK-01~08, GK-10, TF-01~04, SP-01/02, SS-01, CL-01/02, FX-04 경계. **이 dossier는 어떤 수치 변경도 제안하지 않는다** — 방향성 근거(반례·실행 경로)는 별도 감사(F2·F5)와 진리값 패널 판결에 있고, 크기 결정은 authority holdout·measure_default_change 절차 대상이다.

## G. Codex 티켓 (5건, 상호 독립, F1·F4·F7 비접촉)

### G1. 정규화·임계 상수 단일 소스화
- **내용**: rootNorm(2.2)/shiNorm(1.6)/rootResAlpha(.6)/shiResAlpha(.7)/branchWeights(.7/1.1/.9/.7)/follow weakThreshold(−.78)/minDominanceRatio(2.2)를 신규 `lib/saju-ts/src/rules/strengthConstants.ts`(이름은 재량)로 추출하고 strengthFacts·zhuanwang팩(facts.ts:819-822)·follow팩(facts.ts:1180-1181)·yongshin followPol(yongshin.ts:586-588)이 공유. **값 자체는 1비트도 변경 금지.**
- **변경 허용 범위**: lib/saju-ts/src/rules/{strengthFacts.ts, facts.ts, yongshin.ts} + 신규 상수 모듈 1개.
- **판정 변화**: 없음(순수 리팩터).
- **필수 테스트**: 전체 vitest 스위트 무수정 통과 + 대표 픽스처 3개 이상의 AnalysisBundle stableStringify **바이트 동일** 확인.
- **전문가 판단**: 불필요.

### G2. 감쇠 계수 근거표 문서
- **내용**: 신규 문서 `lib/saju-ts/docs/29_damage_coefficients.md`(번호는 기존 문서 뒤 재량): ST-07/GK-01/SS-01/TF-02 4벌의 값·서열·전거 유무·도메인 의도 차이를 한 표로 고정하고, §E의 서열 질문을 '전문가 확인 대기' 섹션으로 수록. 4곳 코드 주석에 문서 링크 1줄씩 추가.
- **변경 허용 범위**: docs 신규 1파일 + 해당 4파일의 주석 줄만(로직 무변경).
- **판정 변화**: 없음.
- **필수 테스트**: 기존 스위트 통과(주석만이므로) + `npm run validate:school-sources` 형식 준수(문서 지위 헤더: 편찬 초안·독립 검토 대기 — **승인 표현 금지**).
- **전문가 판단**: 문서의 '확인 대기' 섹션 답변은 필요하나, 티켓 자체는 불필요.

### G3. config 스키마·소유권 표
- **내용**: strategies.* 계수 키 전수 표(기본값·프리셋 실변주 여부(실측: yongshin weights 14회/quality 2/conditions 1, 그 외 0회)·[정책/캘리브/내부] 라벨)를 docs 신규 문서로 작성. P1-C의 '사실상 상수' 키 선언부에 `@engine-internal` 주석 라벨 추가.
- **변경 허용 범위**: docs 신규 1파일 + 코드 주석 줄만.
- **판정 변화**: 없음.
- **필수 테스트**: 기존 스위트 통과. 표의 기본값은 inventory.json과 대조.
- **전문가 판단**: 불필요(소유권 라벨은 구조 사실의 기록이며 교리 판단 아님).

### G4. 경계값 가드 방향 정합
- **내용**: strengthFacts.ts:678·700의 `clamp01(x / Math.max(1e-9, norm))`를 norm≤0이면 **기여 0**(fail-closed — facts.ts:2194 격국 quality와 동일 방향)으로 변경. 기본값(2.2/1.6)은 >0이므로 기본 경로 산출 불변.
- **변경 허용 범위**: strengthFacts.ts 해당 2개 식 + 신규 경계 테스트 파일 1개.
- **판정 변화**: **기본 config 없음**(norm>0 경로 바이트 동일). norm≤0을 명시 설정한 비기본 config에서만 산출 변화 — 회귀 노트에 명기.
- **필수 테스트**: 신규 경계 테스트(norm=0 → deDi/deShi 기여 0) + 기존 스위트 무수정 통과 + 대표 픽스처 바이트 동일.
- **전문가 판단**: 불필요(수치 아닌 가드 방향).

### G5. 계수 현행동작 특성화 테스트 (additive, 정책 불변식 아님)
- **내용**: 신규 vitest 파일로 현재 구현의 관계를 characterization 이름으로 기록 — ① 도메인별 감쇠 **서열** ② 12운성 root 배율 단조성 ③ seongpae 배율 순서 ④ quality multiplier·qualityWeight ∈[0,1] ⑤ 위급월 urgency 상한(w_cli ≤ 0.3510, factor ≤ 0.4039 — F2 dossier §1 수치). §E에서 전문가 판단 대기인 서열은 승인 전 release gate나 영구 불변식으로 사용하지 않는다.
- **변경 허용 범위**: 신규 테스트 파일만(기존 테스트·소스 무수정).
- **판정 변화**: 없음.
- **필수 테스트**: 신규 테스트 자체 + 기존 스위트 통과.
- **전문가 판단**: characterization 작성 자체는 불필요. 다만 감쇠·12운성·성패 서열을 정책 불변식이나 release gate로 승격하려면 §E 전문가 답변이 선행돼야 한다.

---
검증 노트(재현): 프리셋 분산 실측 `grep -o '"weights"...' src/schools/packs/builtin.pack.json`(yongshin weights 14·quality 2·conditions 1, strength 내부 키 0). 테스트 결박 표본 `grep -rn "toBeCloseTo(" src/rules/*.test.ts`. 인벤토리 라인 번호는 freeze `6fb2f68a4` 기준.
