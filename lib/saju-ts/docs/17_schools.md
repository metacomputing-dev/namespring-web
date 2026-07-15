# 17. 학파 3축 통합 모델(구조·균형·조후)

> **문서 지위**: 학파 프리셋 출처 정본(in-repo compilation).
> **검토 상태**: 편찬 초안 — 독립 전문가 검토 대기 (검토 완료 전 이 문서는 교리 '해설'이며 외부 권위 인증이 아님).
> **편찬일**: 2026-07-10 (사주 엔진 무결성 감사 PR #653, P0-4)
> **관련 프리셋**: `integrated.3d` (src/schools/packs/builtin.pack.json). 파생: `yuhaiziping`, `shenfengTongkao`가 `extends: "integrated.3d"`로 이 프리셋을 상속한다.

## 1. 교리 요약

`integrated.3d` 프리셋은 용신(用神) 판단을 단일 학파의 단일 기준으로 환원하지 않고, 전통 명리학이 별개의 문헌 계보에서 발전시킨 세 판단 축을 **독립 신호로 각각 산출한 뒤 가중 합성**한다.

| 축 | 한자 | 문헌 계보 | 판단 질문 |
|---|---|---|---|
| 구조 | 格局 | 『子平真詮』·『淵海子平』 계보 | 월령(月令)에서 성립한 격(格)이 어떤 십성 구조를 요구하는가 |
| 균형 | 扶抑 | 자평(子平) 공통 전승·『滴天髓』 왕쇠론 | 일간(日干)이 강한가 약한가, 부(扶)할 것인가 억(抑)할 것인가 |
| 조후 | 調候 | 『窮通寶鑑』(欄江網 계열) 계보 | 명식의 한난조습(寒暖燥濕)이 치우쳤는가, 무엇으로 조율하는가 |

세 축은 역사적으로 상이한 질문에 답하기 위해 발전했으므로 서로를 대체하지 못한다. 격국이 아무리 아름다워도 엄동(嚴冬)의 한기(寒氣)를 풀지 못하면 발용(發用)이 어렵고, 조후가 충족돼도 일간이 재관(財官)을 감당할 힘이 없으면 성격(成格)이 무의미하다는 것이 통합론의 출발점이다. 이 프리셋은 세 축을 배타적 선택지가 아니라 **동시 성립하는 제약 조건**으로 취급하며, 축 간 상충은 은폐하지 않고 합의(consensus) 지표로 노출한다(§3.4).

## 2. 고전 근거

### 2.1 구조(格局) 축 — 자평진전 계보

『子平真詮』(자평진전, 沈孝瞻 저, 淸)은 「用神專求月令」(「論用神」 첫머리 「八字用神，專求月令」의 축약 통용형)이라 하여 용신 탐색의 출발점을 월령에 고정한다(論用神 편). 월지 장간(藏干)이 천간에 투출(透出)하거나 지지에서 회국(會局)하는 십성으로 격을 세우고, 격이 선(善)한가(재·관·인·식) 불선(不善)한가(살·상·겁·인의 일부)에 따라 순용(順用)·역용(逆用)을 나눈다는 논술 체계가 이 책의 골격이다. 더 이른 시기의 『淵海子平』(연해자평, 徐大升 편, 南宋 계열)은 격국·신살·시결(詩訣)을 병렬 수록한 자평법 최초기의 종합서로, 월지 중심 격국 판단의 원류에 해당한다.

### 2.2 균형(扶抑) 축

일간의 왕쇠(旺衰)를 재고 강하면 설(洩)·극(剋)하고 약하면 생(生)·조(助)한다는 부억(扶抑)의 원칙은 특정 서적의 전유물이 아니라 자평법 공통 전승이다. 『滴天髓』(적천수, 원문 전승 이설 있음 — 京圖 찬 전승과 劉伯溫 주 전승이 병존하며, 청대 任鐵樵 증주본 『滴天髓闡微』가 통용된다)는 쇠왕(衰旺)의 참된 기틀을 알면 명리의 태반을 안 것이라는 취지의 논술(「衰旺」 장)과, 지나침도 모자람도 경계하는 중화(中和) 지향의 논술(「中和」 장)로 이 축의 이론적 근거를 제공한다.

### 2.3 조후(調候) 축 — 궁통보감 계보

『窮通寶鑑』(궁통보감, 欄江網 계열 필사본이 원류이며 민국기 徐樂吾 評註本이 통용된다)은 일간 10간 × 월지 12지의 조합별로 기후 조율에 필요한 천간을 표 형식으로 제시한다. 겨울 나무는 먼저 태양(丙火)을 보고, 여름 흙은 먼저 물(癸水)을 구한다는 식의 월별 처방이 골자로, 오행의 수량적 균형과 별개로 **계절 기후라는 환경 변수**를 독립 판단 축으로 세운 것이 이 계보의 공헌이다.

### 2.4 축 충돌과 우선순위 논쟁 — 「調候為急」 담론

세 축이 서로 다른 오행을 지목할 때 무엇을 앞세우는가는 학파 분기의 실질이다. 대표 사례가 "신강(身强)한데 조후가 위급한" 명식이다. 부억 단독론은 억(抑)하는 오행을 취하지만, 서락오(徐樂吾) 평주 계열은 「調候為急」 — 한난조습의 치우침이 극심하면 조후를 급무(急務)로 앞세운다 — 를 내세워 기후 조율 오행을 우선한다. 반면 자평진전 계보는 월령 격국을 항상 출발점으로 삼으므로 조후를 격국 성패의 보조 조건으로 낮춰 본다. 『滴天髓』도 천도(天道)의 한난과 지도(地道)의 조습이 과불급 없이 만물을 발육시킨다는 취지의 논술(「寒暖」·「燥濕」 장)로 기후 축의 독립성을 인정하되, 그것을 유일 기준으로 격상시키지는 않았다. 즉 고전 전통 안에서도 우선순위는 **고정 서열이 아니라 명식 상태에 따른 조건부 서열**이었다는 것이 통합 모델의 독해다. §3.3은 이 관점을 동적 재가중(urgency reweighting)으로 근사하지만, 현재 신호 척도와 계수만으로 조후 후보의 최종 1위 전환을 보장하지는 않는다.

### 2.5 다축 병용의 전거 — 三命通會·神峰通考

『三命通會』(삼명통회, 萬民英 편, 明)는 격국·신살·납음 등 상이한 판단 체계를 하나의 총서에 병렬 수록해, 복수 방법의 병용이 명대 실무에서 이미 표준이었음을 보여준다. 『神峰通考』(신봉통고, 張楠 저, 明)는 병약설(病藥說) — 명식의 병(病)을 찾아 약(藥)이 되는 오행을 쓰며, 병이 있어야 오히려 귀해질 수 있다는 취지의 논술 — 로 결핍·과잉의 교정이라는 제4의 보조 관점을 추가했다. `integrated.3d`가 3축 외에 `medicine`(病藥) 항을 소폭(0.25) 유지하는 근거가 이것이다.

> **저작권 주기**: 위 고전 원문은 모두 저작권이 소멸한 공용 도메인(public domain) 문헌이다. 단, 徐樂吾 평주본·任鐵樵 증주본 등 근현대 평주(評註)·번역·교점본의 부가 텍스트는 별도의 저작권이 살아 있을 수 있으므로, 본 저장소는 평주본의 문장을 전재하지 않고 취지 요약으로만 참조한다.

## 3. 엔진 구현 대응

### 3.1 프리셋 정의 (src/schools/packs/builtin.pack.json → `presets[].id == "integrated.3d"`)

- 신강약 모델: `overlay.strategies.strength.model = "deLingDiShi"` — 월지 가중 득령(得令)/득지(得地)/득세(得勢) 모델(엔진 기본값, src/api/config.ts).
- 3축 가중치: `overlay.strategies.yongshin.weights = { balance: 0.7, role: 0.65, climate: 0.95, medicine: 0.25, johooTemplate: 0.35, tongguan: 0, follow: 0, transformations: 0, oneElement: 0 }`.
  - 균형 축 = `balance`(오행 결핍) + `role`(신강약 역할 선호), 조후 축 = `climate`(한난조습 need) + `johooTemplate`(궁통보감식 월별 힌트), 병약 보조 = `medicine`.
- 구조(격국) 축은 가중치 항이 아니라 include 블록으로 주입된다: `include.ruleSpecBlocks = ["yongshin.ziping.roleBoost", "gyeokguk.ziping.monthGyeokTenGod"]`.
  - `yongshin.ziping.roleBoost`: `monthTenGodRoleBias` 매크로(basis `main`) — 월지 본기 십성을 역할군으로 사상해 OFFICER +0.35, WEALTH +0.28, OUTPUT +0.15, RESOURCE −0.08, COMPANION −0.18의 용신 가산 규칙을 전개한다(컴파일: src/rules/spec/compileYongshinSpec.ts `case 'monthTenGodRoleBias'`, `month.mainTenGod`과 `dayMasterRoleByElement.*` 조건으로 룰 생성).
  - `gyeokguk.ziping.monthGyeokTenGod`: 월지 투간/회지 십성 기반 격국 기본 점수(컴파일: src/rules/spec/compileGyeokgukSpec.ts `case 'monthGyeokTenGod'`).
- 특수격 경합: `overlay.strategies.gyeokguk.competition = { enabled: true, methods: ["tenGod","follow","transformations","oneElement"], power: 2.0, minKeep: 0.2, renormalize: true, signals: { tenGod: "monthQuality", ... } }` — 월령 정격과 종격·화격·전왕 후보를 softmax류 경합(src/rules/gyeokguk.ts, src/core/competition.ts의 `compete`/`renormalizeScale`)으로 조정한다.

### 3.2 가중 선형 합성 (src/rules/yongshin.ts)

용신 점수는 오행별로 `baseScores[e] = balanceTerm + roleTerm + climateTerm + medicineTerm + tongguanTerm + followTerm + templateTerm + transformationTerm + oneElementTerm`의 선형 합으로 계산된다(`YongshinPolicy.weights` 인터페이스와 합성 루프). 즉 "축의 독립 산출 → 가중 합성"이라는 §1의 교리 구조가 코드 구조와 1:1로 대응한다.

### 3.3 「調候為急」의 동적 재가중

기후 need 벡터의 크기 `climateMagnitude = √(need.temp² + need.moist²)`가 임계를 넘으면 climate 계열 가중치를 증폭하고 나머지를 감쇠한다. `integrated.3d`에서는 `methodSelector.enabled = true`이므로 메타 셀렉터 경로(`methodSelector.climate: { threshold: 0.55, maxBoost: 1.15, reduceOthers: 0.2 }`)가 적용되며, 셀렉터 비활성 시의 레거시 경로(`climateUrgency`, yongshin.ts 내 "调候为急" 주석 블록)도 동일 파라미터로 설정돼 있다. `urgencyFactor = clamp01((climateMagnitude − threshold)/(1 − threshold))`에 비례해 `effectiveWeights.climate ×= (1 + maxBoost·factor)`, 타 가중치 `×= (1 − reduceOthers·factor)`. 이는 조후 영향력을 **상대적으로 높이는 provisional 정책**이지, 방법축 원점수의 자연 범위가 서로 다른 현재 합성식에서 조후 후보를 반드시 최종 1위로 만드는 강제 규칙은 아니다. `johooTemplate: { seasonMandatoryBoost: 0.3, stemPreferenceBoost: 0.22, enforceSummerWinter: true }`도 하동(夏冬) 필수 오행에 가산하는 정책 항이며 최종 순위 강제를 뜻하지 않는다.

### 3.4 다축 합의 스코어보드 (src/rules/yongshin.ts `buildYongshinConsensus`)

결과의 `consensus: YongshinConsensusScoreboard`는 억부(`eokbu`)·조후(`johu`)·격국(`gyeokguk`)·통관(`tonggwan`)·병약(`byeongyak`)·식상류(`siksangFlow`) 6축의 축별 최우선 오행과 정규화 점수를 독립 보고하고, `final`에 최종 오행·`confidence`·`topMargin`·`conflictLevel`(none/low/medium/high)·`competingElements`를 담는다. 축 원점수는 `eokbuRaw = 0.55·deficiency + 0.45·rolePreference`, `johuRaw = climateScores + 0.35·templateBonus` 등으로 합성 가중치와 분리 계산된다. 또한 `primaryMethod`(EOKBU/JOHU/BYEONGYAK/TONGGWAN/JONGHWA)는 최종 오행에 실제로 가장 크게 기여한 방법군을 결정적으로 보고한다(감사 A2·B6). 상충을 점수 합산 뒤에 숨기지 않고 축별로 노출하는 이 설계가 §1 말미의 교리적 요구의 구현이다.

## 4. 학파 이설과 프리셋 선택지

통합 모델은 이설(異說)을 소거하지 않는다. 동일 팩 안에서 단일 축 강조 프리셋이 병존하며, 사용자는 학파적 입장을 프리셋 선택으로 표명할 수 있다.

| 입장 | 프리셋 | 통합 프리셋과의 차이 |
|---|---|---|
| 부억 단독론 | `balance` | climate 가중 0, 격국 include 없음 |
| 월령 격국 우선론(자평진전) | `gyeokguk`, `ziping.strict`, `zipingzhenquan` | climate 0, role 가중 강화(엄격형 1.05), 특수격 경합 power 2.3 |
| 조후 우선론(궁통보감·서락오 계열) | `johoo`, `johoo.strict`, `qiongTongBaoJian` | climate 1.2~1.45, 조후표 조회(`monthTable: "qiongTongBaoJian"`) |
| 3축 통합(본 문서) | `integrated.3d` | climate 0.95 / balance 0.7 / role 0.65 + 격국 include + 합의 지표 |

`integrated.3d`의 가중치 서열(climate 0.95 > balance 0.7 > role 0.65)은 "조후는 결핍 시 가장 급하지만 평시에는 need 크기가 작아 자연 감쇠한다"는 신호 특성을 반영한 편찬자 설정값이지 고전이 명시한 수치가 아니다. 종격(`follow`)·화격(`transformations`)·전왕(`oneElement`) 항은 이 프리셋에서 용신 가중 0으로 두되 격국 경합(§3.1)에서만 다루는데, 이는 특수격 승격의 증거 기준을 보수적으로 유지한 감사 결정(PR-3·B5)을 따른 것이다. 한편 `yuhaiziping`·`shenfengTongkao` 프리셋이 `integrated.3d`를 상속하는 것은 해당 고전의 충실한 재현이 아니라 "종합적 관점"이라는 성격상의 실용적 근사 매핑이며, 팩 설명문에도 "확장 여지"로 명기돼 있다.

다축 병용 자체는 현대 실무 관행과도 부합한다. 현대 한국·중화권 실무 통변은 격국으로 구조를 세우고 억부로 강약을 재며 조후로 위급을 점검하는 절차적 병용이 일반적이며, 단일 축 강요는 오히려 특정 평주 계열의 입장에 가깝다. 다만 "부합한다"는 서술은 편찬자의 문헌·관행 독해이지 조사 통계에 근거한 주장이 아님을 밝힌다(§5 체크리스트 참조).

## 5. 한계와 검토 항목

이 문서는 엔진 저장소 내부에서 편찬한 출처 해설로, 외부 학회·독립 전문가의 인증을 받은 바 없다. 독립 검토자는 최소한 다음을 확인해야 한다.

- [ ] **원문 인용 대조**: 「用神專求月令」(『子平真詮』 論用神), 「調候為急」(서락오 평주 계열 관용구)의 표기·출전 편명이 통용 판본과 일치하는지 대조. 그 외 본문은 전부 패러프레이즈이므로 원문으로 오인될 표현이 없는지 점검.
- [ ] **판본 서지**: 『滴天髓』 전승 이설(京圖 찬/劉伯溫 주/任鐵樵 증주) 및 『窮通寶鑑』 欄江網 계보 서술의 정확성 검증.
- [ ] **가중치의 교리 정합성**: climate 0.95 / balance 0.7 / role 0.65 / medicine 0.25 / johooTemplate 0.35 서열이 §2.4 담론의 합리적 수치화인지, 임의 설정인지 평가. 대안 가중치와의 실측 비교(회귀 케이스) 권장.
- [ ] **urgency 임계 0.55의 타당성**: 「調候為急」 발동 임계와 현재 가중 폭이 고전 사례(엄동·성하 명식)에서 조후 후보의 실효 영향력을 충분히 높이는지 표본 검증. 현 계수는 재가중만 보장하며 최종 1위 전환은 보장하지 않는다.
- [ ] **합의 지표 임계**: `conflictLevel` 구간(0.18/0.38/0.6)이 실무자의 상충 체감과 부합하는지 캘리브레이션.
- [ ] **상속 매핑의 표시 적절성**: `yuhaiziping`·`shenfengTongkao` → `integrated.3d` 근사 매핑이 상용 UI에서 고전 재현으로 오인되지 않도록 문구 점검.
- [ ] **"현대 실무 관행 부합" 주장**: 현재 근거는 문헌 독해뿐이므로, 실무자 설문 또는 간행 통변서 표본 조사로 보강 필요.
