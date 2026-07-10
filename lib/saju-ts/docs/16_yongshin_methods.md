# 16. 용신 판정 방법론(扶抑·調候·通關·病藥·從格)

> **문서 지위**: 학파 프리셋 출처 정본(in-repo compilation).
> **검토 상태**: 편찬 초안 — 독립 전문가 검토 대기 (검토 완료 전 이 문서는 교리 '해설'이며 외부 권위 인증이 아님).
> **편찬일**: 2026-07-10 (사주 엔진 무결성 감사 PR #653, P0-4)
> **관련 프리셋**: `balance`, `ditiansui` (src/schools/packs/builtin.pack.json)

## 1. 교리 요약

용신(用神)은 명식(命式)의 불균형을 진단하고 그 조정 수단이 되는 오행(또는 십성)을 고르는 판단 절차다.
근현대 자평(子平) 계열 실무에서 통용되는 판정 방법은 크게 다섯 갈래로 정리된다.

1. **부억(扶抑)** — 일간(日干)의 강약을 재어, 신약(身弱)이면 인성(印星)·비겁(比劫)으로 부조(扶)하고,
   신강(身強)이면 식상(食傷)으로 설기(洩氣)하거나 재성(財星)·관살(官殺)로 극제(抑)한다. 근현대 통용 명리의 기초 방법.
2. **조후(調候)** — 월지(月支) 계절의 한난조습(寒暖燥濕)을 먼저 살펴, 기후 결핍을 채우는 오행을 우선한다.
   『궁통보감(窮通寶鑑)』 계보. 상세는 [20. 조후 템플릿](20_johoo_template.md)에 위임한다.
3. **통관(通關)** — 상극하는 두 세력이 대치(예: 水火 상전)할 때, 둘을 잇는 소통 오행(예: 木)을 용신으로 삼는다.
   상세는 [22. 통관 분포](22_tongguan_distribution.md)에 위임한다.
4. **병약(病藥)** — 명식의 성격(成格)을 해치는 요소를 병(病)으로 보고, 그 병을 제거하는 오행을 약(藥) = 용신으로 삼는다.
   『신봉통고(神峰通考)』 장남(張楠)의 병약설.
5. **종격(從格)** — 강약이 극단으로 치우쳐 부억이 불가능할 때, 저항하지 않고 지배 기세에 순종(從)하는 오행을 용신으로 삼는다.
   상세는 [27. 종격 조건 팩](27_jonggyeok_condition_pack.md)에 위임한다.

`balance` 프리셋은 이 중 **부억 + 오행 결핍 수학 모델**을 채택하고, `ditiansui` 프리셋은
『적천수(滴天髓)』의 종합적 관점을 반영해 **다섯 방법을 병렬 가중 합산**한다(§3, §4).

## 2. 고전 근거

**공용 도메인 고지**: 아래 고전 원문은 모두 저작권이 소멸한 공용 도메인이다. 단, 서락오(徐樂吾)·임철초(任鐵樵) 등
현대·근대 평주본(評註本)의 주석 텍스트는 별개의 저작권이 성립할 수 있으므로, 본 저장소는 원문 전승 취지의 요약만 수록한다.

### 2.1 부억(扶抑)

"강한 것은 눌러 주고 약한 것은 도와 준다"는 부억의 원리는 특정 고전 한 권의 발명이 아니라 자평 계열 공통의 기초 감각이며,
『적천수』가 쇠왕(衰旺)의 참된 기틀을 아는 것이 명리의 절반이라는 취지로 논술한 대목(『滴天髓』 衰旺, 임철초 增註 『滴天髓闡微』 통용본)이
그 고전적 표현이다. 오늘날 "억부용신"으로 정식화된 형태는 서락오(徐樂吾)·위천리(韋千里) 등 민국(民國)기 저술을 거친
**근현대 통용 부억법**의 계보로, 『자평진전(子平真詮)』(심효첨沈孝瞻, 淸)의 월령용신론과는 구분해야 한다.
『자평진전』의 「用神專求月令」(「論用神」 첫머리 「八字用神，專求月令」의 축약 통용형)은 용신을 '격국을 정하는 월령의 기준'으로 쓰는 용법이어서, 일간 강약의 조정 수단을 찾는
부억용신과는 '용신'이라는 낱말의 지시 대상 자체가 다르다(용어 충돌 — §4.1).

### 2.2 조후(調候)

한난조습의 조절이 급선무라는 「調候為急」의 관용구로 요약되는 계보. 월지×일간 조합별 조후용신표는
『궁통보감(窮通寶鑑)』(난강망欄江網 계열 전승, 서락오 評註本 통용)이 정본이다. 겨울 금수(金水)에 화(火)가 먼저 필요하고
여름 목화(木火)에 수(水)가 먼저 필요하다는 취지의 논술이 각 월별 편에 반복된다. 상세와 엔진의 120셀 표 대응은
[20번 문서](20_johoo_template.md) 및 [18번 문서](18_school_sources.md)를 본다.

### 2.3 통관(通關)

두 세력이 싸울 때 가운데서 통하게 하는 오행이 귀하다는 취지의 논술이 『적천수』 통관(通關) 편에 있다
(관문 안팎이 서로 통하면 만난다는 비유 — 원문 인용은 전승 이설이 있어 생략). 상세는 [22번 문서](22_tongguan_distribution.md).

### 2.4 병약(病藥)

『신봉통고(神峰通考)』(장남張楠, 明)의 병약설. 「有病方為貴,無傷不是奇」 — 병이 있어야 귀해질 수 있고,
격 중의 병을 제거하면(去病) 재록이 따른다는 취지의 시결이 병약설 편에 전한다. 병이 있는 곳에 약이 곧 용신이라는 판정 규칙.

### 2.5 종격(從格)

기세가 한쪽으로 완전히 쏠리면 그 기세를 거스르지 말고 따르라는 원리. "從이 참되면 오로지 從으로 논한다(從得真者只論從)"는
취지의 논술이 『적천수』 순국(順局)·종상(從象) 계열 편에 전한다(임철초 增註本 통용). 진종(眞從)/가종(假從) 구분 등
상세 조건은 [27번 문서](27_jonggyeok_condition_pack.md).

### 2.6 판본 정보

| 서명 | 편저자·시대 | 통용 판본 비고 |
|---|---|---|
| 淵海子平(연해자평) | 徐大升 편, 南宋 계열 | 자평법 최고(最古) 계열 집성 |
| 三命通會(삼명통회) | 萬民英, 明 | 종합 유서(類書) |
| 神峰通考(신봉통고) | 張楠, 明 | 병약설의 출전 |
| 滴天髓(적천수) | 원문 전승 이설 — 京圖 찬 전승·劉伯溫 주 전승 | 任鐵樵 增註 『滴天髓闡微』 통용 |
| 子平真詮(자평진전) | 沈孝瞻, 淸 | 월령용신·격국론의 정본 |
| 窮通寶鑑(궁통보감) | 欄江網 계열 전승 | 徐樂吾 評註本 통용 |

## 3. 엔진 구현 대응

용신 판정의 단일 진입점은 `src/rules/yongshin.ts`의 `computeYongshin(config, facts)`이며,
다섯 방법이 **방법별 스코어러 항의 가중 합**으로 구현된다. 오행별 최종 점수는
`balanceTerm + roleTerm + climateTerm + medicineTerm + tongguanTerm + followTerm + templateTerm + transformationTerm + oneElementTerm`
(yongshin.ts의 `baseScores` 합산 루프). 가중치 키는 `strategies.yongshin.weights.{balance, role, climate, medicine, tongguan, follow, johooTemplate, transformations, oneElement}`.

- **부억 — 결핍 항(`balance`)**: 오행 정규화 분포(`facts.elements.normalized`)를 균등 목표(각 0.2)와 비교해
  `deficiency[e] = max(0, 0.2 − share)`. 결핍만 가산한다(초과는 병약 항이 처리).
- **부억 — 역할 항(`role`)**: 신강약 지수 `facts.strength.index`(−1 신약 ~ +1 신강, `src/rules/facts.ts`의 `StrengthFacts`)를
  `t = (s+1)/2`로 사상해, 신약 선호 프로필 `weakPref`(RESOURCE 1.0 / COMPANION 0.6 / OUTPUT −0.2 / WEALTH −0.4 / OFFICER −0.4)와
  신강 선호 프로필 `strongPref`(RESOURCE −0.2 / COMPANION −0.1 / OUTPUT 0.8 / WEALTH 0.6 / OFFICER 0.6)를 선형 보간(lerp)한다.
  이는 §1의 부억 규칙("신약이면 인성·비겁, 신강이면 식상·재관")의 연속화 모델이다.
  강약 입력의 기본 모델은 `strategies.strength.model = "deLingDiShi"`(득령得令/득지得地/득세得势 분해,
  `facts.ts`의 `details.delingdiShi`)이며, 기저 지수는 `index = (support − pressure) / total`
  (support = 비겁+인성, pressure = 식상+재성+관살 — `strengthFromTenGodScoresBase`).
- **조후(`climate`, `johooTemplate`)**: 한난조습 need 벡터 → 오행 점수(`facts.climate.scores`) 및 궁통보감식 월별 템플릿 보너스.
  조후위급(調候為急)은 `climateUrgency`(need 크기가 threshold 초과 시 climate 가중을 곱 부스트하고 나머지 방법을 축소)로 구현. 상세 20번 문서.
- **통관(`tongguan`)**: `facts.ts`의 `computeTongguanFacts`가 상극 5쌍(水火→木, 火金→土, 金木→水, 木土→火, 土水→金)의
  대치 강도(`battleIntensity`)를 계산하고, yongshin.ts가 브리지 오행에 `weightedIntensity`를 가산. 상세 22번 문서.
- **병약(`medicine`)**: `excess[e] = max(0, share − 0.2)`로 초과(병)를 재고,
  `medicineScores[cand] = Σ excess[over] (cand가 over를 극할 때)` — 병을 극제하는 오행(약)에 가산.
- **종격(`follow`)**: `src/rules/followPotential.ts`의 `computeFollowPotential`이 강약 극단 램프
  (`strengthIndex`가 `weakThreshold`/`strongThreshold`를 넘는 정도) × 세력 우세 비(`minDominanceRatio` 초과분)로
  잠재도(potential)를 산출하고, PRESSURE(종세) / SUPPORT(종왕) 모드를 판별. 상세 27번 문서.

방법별 기여는 `methodTerms`(EOKBU=balance+role, JOHU=climate+johooTemplate, BYEONGYAK=medicine,
TONGGWAN=tongguan, JONGHWA=follow+transformations+oneElement)로 집계되어 `primaryMethod`(best 오행의 지배 방법)를 유도하고,
`src/api/engine.ts`가 `summary.yongshin.methodBreakdown`으로 방법별 원장(balance/climate/medicine/tongguan/follow/…/effectiveWeights)을 노출한다.
6축 합의 스코어보드(`YongshinConsensusScoreboard`: eokbu/johu/gyeokguk/tonggwan/byeongyak/siksangFlow)가 축간 충돌 수준을 별도 보고한다.

### 프리셋 실증 (builtin.pack.json overlay 키)

- **`balance`**: `overlay.strategies.yongshin.weights = { balance: 1.0, role: 0.75, climate: 0, medicine: 0.2, tongguan: 0, follow: 0, johooTemplate: 0, transformations: 0, oneElement: 0 }`,
  `climate.enabled: false`, `strength.model: "deLingDiShi"`.
  → **부억(결핍 1.0 + 역할 0.75)을 주축**으로 하고 병약을 보조(0.2)로만 남긴 순수 부억+결핍 수학 모델임이 가중치로 실증된다.
  조후·통관·종격 항은 전부 0.
- **`ditiansui`**: `weights = { balance: 0.55, role: 0.35, climate: 0.7, medicine: 0.6, tongguan: 0.75, follow: 1.0, johooTemplate: 0.35, … }`
  + `climateUrgency`(threshold 0.55) + `methodSelector`(climate/medicine/tongguan/follow/johooTemplate 게이팅,
  follow는 `weakThreshold: -0.78, minDominanceRatio: 2.2`) + `bridge: { minIntensity: 0.22, bonus: 1.4 }`
  + `patterns.follow.jonggyeok.typeAware` 활성.
  → 扶抑·調候·通關·病藥·從勢를 **모두 켠 종합 프리셋**으로, 『적천수』의 다면적 관점(§2)을 가중 병렬로 근사한다.

## 4. 학파 이설과 프리셋 선택지

1. **'용신' 용어 충돌**: 『자평진전』의 용신(월령 중심의 격국 기준)과 근현대 부억용신(강약 조정 수단)은 다른 개념이다.
   엔진은 전자를 `gyeokguk` 축(19번 문서, `ziping.strict` 프리셋)으로, 후자를 `yongshin`의 balance/role 항으로 분리 구현해 충돌을 회피한다.
2. **조후 우선 vs 부억 우선**: 궁통보감 계열은 극단 계절에서 조후를 최우선한다. `balance`는 조후를 완전히 끄고(climate 0),
   `johoo`/`johoo.strict`는 조후를 주축으로 올리며, `ditiansui`는 조후위급 게이팅으로 절충한다 — 이설이 프리셋 선택지로 병존한다.
3. **종격 인정 범위**: 종격을 넓게 인정하는 전통(적천수 계열)과 좁게 보는 전통이 갈린다. `balance`는 follow 0으로 종격을 배제하고,
   `ditiansui`는 follow 1.0 + 극단 임계(−0.78)로 보수적으로 인정한다. 승격 임계 재보정 실험은 `jonggyeok.calibrated` 프리셋 참고.
4. **병약의 지위**: 신봉통고는 병약을 독립 강령으로 두지만, 본 엔진 기본 모델은 병약을 '초과 오행 극제' 항으로 축약한다.
   격국 파괴 요소(파격 신살·합충)를 병으로 보는 본래 의미보다 좁다 — 알려진 축약이다(§5).

## 5. 한계와 검토 항목

이 문서는 엔진 저장소 내부에서 편찬됐으며, 외부 학회·전문가의 승인을 받은 바 없다. 독립 검토자는 다음을 확인해야 한다.

- [ ] §2 원문 인용 2건(「用神專求月令」, 「有病方為貴,無傷不是奇」)과 관용구(「調候為急」, 「從得真者只論從」)의
      전거를 통용 판본에서 대조 확인 (특히 신봉통고 시결의 정확한 자구·편차).
- [ ] 부억 role 프로필 상수(weakPref/strongPref 수치)가 통용 부억법 서술과 일치하는지 — 수치 자체는 엔진 고유 모델링이며
      고전에 직접 근거가 없음을 문서화 수준에서 재확인.
- [ ] 병약 항이 '오행 초과 극제'로 축약된 것이 신봉통고 병약설(격국 병약 포함)의 대표로 표기되어도 오독을 일으키지 않는지.
- [ ] `ditiansui` 프리셋 가중치(0.55/0.35/0.7/0.6/0.75/1.0/0.35)가 적천수의 강조점 배분을 합리적으로 근사하는지 —
      현재 수치는 실험적 캘리브레이션이며 문헌 계량 근거는 없음.
- [ ] deficiency/excess의 균등 목표(각 0.2)가 고전의 '중화(中和)' 개념의 타당한 수학적 근사인지.
- [ ] 균등 목표는 일간 대비 십성 균형이 아니라 오행 분포 균형이라는 점 — 부억 정의와의 간극 검토.

**교차 참조**: 조후 상세 → [20](20_johoo_template.md) · 통관 상세 → [22](22_tongguan_distribution.md) ·
종격 상세 → [27](27_jonggyeok_condition_pack.md) · 격국 → [19](19_gyeokguk_quality.md) · 학파 출처 총람 → [18](18_school_sources.md)
