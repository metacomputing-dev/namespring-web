# 26. 전왕격(專旺)·일행득기(一行得氣) 5격

> **문서 지위**: 학파 프리셋 출처 정본(in-repo compilation).
> **검토 상태**: 편찬 초안 — 독립 전문가 검토 대기 (검토 완료 전 이 문서는 교리 '해설'이며 외부 권위 인증이 아님).
> **편찬일**: 2026-07-10 (사주 엔진 무결성 감사 PR #653, P0-4)
> **관련 프리셋**: `zhuanwang` (src/schools/packs/builtin.pack.json)

## 1. 교리 요약

전왕격(專旺格)은 사주 전체의 기운이 일간(日干)과 같은 하나의 오행으로 극단적으로
편중되어, 그 왕성한 기세를 억누르지 않고 오히려 따르는 것을 정법으로 삼는 특수격이다.
편중 오행이 일간 오행과 일치하며 국(局)을 이룬 경우를 일행득기격(一行得氣格)이라
부르며, 오행별로 다음 5격으로 나뉜다.

| 격명 | 일간 오행 | 전형적 회국(會局) 조건 |
|---|---|---|
| 곡직격(曲直格) | 木 (甲·乙) | 지지 寅卯辰 방합 또는 亥卯未 삼합 목국 |
| 염상격(炎上格) | 火 (丙·丁) | 지지 巳午未 방합 또는 寅午戌 삼합 화국 |
| 가색격(稼穡格) | 土 (戊·己) | 지지가 辰戌丑未 등 토 일색 |
| 종혁격(從革格) | 金 (庚·辛) | 지지 申酉戌 방합 또는 巳酉丑 삼합 금국 |
| 윤하격(潤下格) | 水 (壬·癸) | 지지 亥子丑 방합 또는 申子辰 삼합 수국 |

전통적 성립 조건의 공통 골격은 다음과 같다.

1. 일간 오행 = 편중(왕신, 旺神) 오행 — 일간이 그 기세의 주체여야 한다.
2. 지지가 방합·삼합으로 회국하거나 그에 준하게 왕신 오행으로 채워져 극왕(極旺)하다.
3. 왕신을 극제(剋制)하는 오행(관살, 官殺)이 천간·지지에 사실상 부재하다.
4. 사주가 인성(印星)·비겁(比劫) 일색으로, 기세를 거스르는 잡기가 적다.

희기(喜忌)는 순세(順勢) 원칙을 따른다: 왕신을 설기(洩氣)하는 식상(食傷)운과 왕신
자체를 돕는 인성·비겁운이 길하고, 왕신을 충극(沖剋)하는 관살운은 왕신의 노기를
격발시켜 크게 흉하다고 본다(이른바 왕신충쇠 논리 — 아래 2절 『적천수』 항 참조).

## 2. 고전 근거

- **격명의 어원**: 다섯 격명은 오행의 본성을 서술한 『상서(尙書)』 홍범(洪範)편의
  「水曰潤下，火曰炎上，木曰曲直，金曰從革，土爰稼穡」에서 유래한다(원문 어순은
  水火木金土 순 — 본 문서 1절 표의 木火土金水 나열은 명리 관례이지 원문 순서가 아니다).
  명리 고전들은 이 오행 본성어를 그대로 격명으로 차용했다.
- **『연해자평(淵海子平)』** (徐大升 편, 南宋 계열; 통용본은 후대 증보): 격국을 열거하는
  편에서 곡직·염상·가색·종혁·윤하 각 격을 들고, 일간이 왕지(旺地)의 회국을 얻고
  극제하는 오행이 없어야 성립하며 왕신의 기세를 따르는 운이 길하다는 취지로
  논술한다(『淵海子平』 격국 관련 편 — 판본별 권차 상이, 5절 검토 항목).
- **『삼명통회(三命通會)』** (萬民英, 明): 일행득기 계열 제격의 성립 조건과 희기를
  격국 논설 부분에서 다루며, 곡직격을 인수(仁壽)와 연결하는 곡직인수격(曲直仁壽格)
  등의 명명이 이 계보에서 통용된다는 취지의 논술이 있다(『三命通會』 논격국 계열 편).
- **『적천수(滴天髓)』** (원문 전승 이설 — 京圖 찬 전승·劉伯溫 주 전승, 任鐵樵 增註
  『滴天髓闡微』가 통용): 순국(順局)·종상(從象) 등의 장에서, 기세가 한 방향으로 완전히
  쏠린 명조는 그 세력을 거스르지 말고 따라야 하며 왕성한 것은 극하기보다 설기함이
  마땅하고, 쇠한 오행이 왕신을 충하면 왕신이 격노하여 화가 된다는 취지로 논술한다.
  전왕 명조의 관살운 흉단(凶斷)은 이 계열 논리에 기댄다.
- **『자평진전(子平眞詮)』** (沈孝瞻, 淸): 「用神專求月令」의 월령 중심 정격(正格) 체계를
  기본으로 하므로 일행득기류 외격(外格)의 위상이 상대적으로 낮다. 본 엔진에서
  `ziping.strict` 계열 프리셋이 특수 프레임을 약화시키는 것은 이 관점의 반영이다.

**저작권 고지**: 위 고전 원문은 모두 저작권이 소멸한 공용 도메인(public domain)이다.
다만 서락오(徐樂吾)·임철초(任鐵樵) 등 현대·근대 평주본과 한국어 번역본의 저작권은
별개로 존속하므로, 본 저장소는 평주본 문장을 전재하지 않는다.

## 3. 엔진 구현 대응

프리셋 `zhuanwang`(별칭: 专旺·전왕·일행득기·oneElement 등)은 두 개의 ruleSpec 블록
`yongshin.zhuanwang.oneElement`·`gyeokguk.zhuanwang.oneElement`를 include하고,
`strategies.patterns.oneElement` 오버레이로 탐지 임계를 지정한다
(src/schools/packs/builtin.pack.json).

**(1) 분포 편중 신호 — `computeElementPatterns` (src/rules/facts.ts)**
정규화 오행 분포에서 최상위 오행의 점유율(top), 2위 대비 우세비(dominanceRatio),
정규화 엔트로피(entropy) 3개 지표를 산출한다. 프리셋 임계는
`thresholds: { topMin: 0.62, dominanceRatioMin: 2.6, entropyMax: 1.25 }`이며, 세 지표의
초과분을 곱한 연속값이 `patterns.elements.oneElement.factor`(0..1)가 된다. 방합·삼합
회국은 `banghapElementOf`·`samhapElementOf`(src/rules/facts.ts — 寅卯辰木·巳午未火·
申酉戌金·亥子丑水 / 亥卯未木·寅午戌火·巳酉丑金·申子辰水)를 통한 회국 보정으로 오행
분포 자체에 반영되어 이 편중 신호를 끌어올린다. 즉 고전의 "회국" 요건은 명시적
게이트가 아니라 분포 강화 경로로 간접 구현된다(한계는 5절).

**(2) 전왕 조건팩 — `applyZhuanwangConditionPack` (src/rules/facts.ts)**
분포 '모양'만 보는 base factor에 전통 논의의 성립 조건을 연속값으로 곱한다.
`strategies.patterns.oneElement.zhuanwang.*` 설정으로 7개 인자의 가중 기하평균을
취해 `zhuanwangConditionFactor`를 만들고, `zhuanwangFactor = factor × condition`을
`facts.patterns.elements.oneElement.*`에 기록한다. 프리셋 값 기준:

- `requireDayMasterMatch: true` — 일간 오행 ≠ 왕신 오행이면 조건 인자를 0으로
  만드는 하드 게이트(교리 조건 1).
- `ling`(得令, `lingThreshold: 0.55`) — 월지 오행과 왕신 오행의 생극 관계 점수
  (`seasonSupportScore`, src/rules/facts.ts).
- `di`(得地, `diThreshold: 0.35`)·`shi`(得勢, `shiThreshold: 0.25`) — 지장간 통근과
  타주 천간 세력의 근사치(교리 조건 2·4의 연속화).
- `strong`(`strongThreshold: 0.0`) — 신강 지수 `strength.index ≥ 0` 요구.
- `noHarm`(`harmThreshold: 0.18`) — 왕신을 극하는 오행의 분포 점유율이 임계 이하일
  것(교리 조건 3 '극제 오행 부재'의 연속화).
- `quality`(`qualityThreshold: 0.55`)와 `penalties: { broken: 0.25, mixed: 0.1, zhuo: 0.08 }`
  — 월지 격 품질·파격(破格) 신호에 의한 감점.
- 가중치 `weights: { match: 0.2, ling: 0.2, di: 0.2, shi: 0.1, quality: 0.2, strong: 0.1, noHarm: 0.1 }`.

**(3) 용신 반영 — 매크로 `oneElementDominance` (src/rules/spec/compileYongshinSpec.ts)**
ruleSpec 블록 `yongshin.zhuanwang.oneElement`이 이 매크로로 컴파일되어, 오행별 규칙
`ZHUANWANG_YONGSHIN_{ELEMENT}`을 생성한다. `factor: "zhuanwang"` 선택 시
`zhuanwangFactor`(양수일 때) 우선, 없으면 raw factor를 쓰며, `minFactor: 0.55` 게이트를
넘으면 `yongshin.{ELEMENT}` 점수에 factor × `bonus: 1.2`를 가산한다. 즉 엔진은 순세
원칙 중 "왕신 자체(비겁 방향)를 따른다"를 용신 가산으로 구현하며, 식상 설기 오행에
대한 별도 가산은 현재 없다(5절). 프리셋의 base `yongshin.weights.oneElement`는 0으로,
신호는 전량 include된 ruleSpec 블록(append 모드) 경로로만 들어간다.

**(4) 격국 반영 — 매크로 `oneElementDominance` (src/rules/spec/compileGyeokgukSpec.ts)**
`gyeokguk.zhuanwang.oneElement` 블록이 규칙 `ZHUANWANG_GYEOK_{ELEMENT}`으로
컴파일되어, 같은 factor 선택·게이트(`minFactor: 0.55`)로 특수 프레임 키
`gyeokguk.ZHUAN_WANG`에 factor × 1.2를 가산한다. 기본 규칙셋에도
`GYEOK_ZHUAN_WANG`(src/rules/defaultRuleSets.ts — factor ≥ 0.62 그리고
`strength.index ≥ 0`일 때 zhuanwangFactor 우선 × 0.85)이 존재한다.

**(5) 특수격 경쟁과 표시 계층**
`gyeokguk.competition`(src/rules/gyeokguk.ts)에서 method `oneElement`는 키
`gyeokguk.ZHUAN_WANG`으로 매핑되고, 신호 선택자 `readOneElementSignal`의 `auto`는
`zhuanwangFactor`를 raw factor보다 우선한다. 프리셋은 competition을
`methods: ["tenGod", "follow", "transformations", "oneElement"]`, `power: 2.0`으로 켜서
화격(HUA_QI)·종격(CONG_*)과 경합시킨다. 레거시 호환 계층(src/compat/springLegacy.ts)은
`ZHUAN_WANG`을 '전왕격'으로 라벨링하고 `CONG_*`와 함께 특수 프레임으로 취급하며,
서사 계층(src/narration/buildNarration.ts)은 `zhuanwangFactor`·`zhuanwangConditionFactor`를
진단 서사에 노출한다.

## 4. 학파 이설과 프리셋 선택지

- **가색격의 엄격 조건**: 지지 사고(四庫, 辰戌丑未)를 모두 갖춰야 한다는 엄격설과 토
  일색이면 족하다는 완화설이 병존한다. 엔진은 분포 기반이므로 사실상 완화설에
  가깝게 동작한다.
- **회국 요건의 강도**: 방합·삼합 회국을 필수로 보는 입장과, 회국 없이도 간지 일색이면
  성립을 인정하는 입장이 있다. 엔진의 분포·엔트로피 게이트는 후자에 가깝고, 회국은
  분포 보정을 통해 가점 요인으로 작동한다.
- **인성 혼재의 허용 범위**: 비겁 순일을 요구하는 설과 인성 동반(인수 상생)을 오히려
  선호하는 설이 있다. 조건팩의 `di`·`shi` 근사는 인성 기여를 감쇠 계수(`rootResAlpha`,
  `shiResAlpha`)로 부분 인정하는 절충이다.
- **운로 희기**: 식상 설기운을 최길로 보는 설(『적천수』 계열의 왕자의설 취지)과
  인성·비겁운도 무방하다는 설이 있다. 현재 엔진은 운로 희기 분화를 구현하지 않았다.
- **종왕(從旺)과의 경계**: 專旺과 從旺은 문헌에 따라 혼용된다. 엔진에서는 follow
  팩(jonggyeok, docs/27)과 별도 신호 축으로 두고 competition에서 경합시키는 설계다.
  `requireDayMasterMatch: false` + `dayNotMatchPenalty` 완화는 從旺적 해석으로의
  프리셋 변형 지점이다.
- **자평진전 계열의 억제**: `ziping.strict` 프리셋은 competition `power: 2.3`으로 특수
  프레임(전왕 포함)을 의도적으로 약화시킨다 — 월령 정격 우선 관점의 반영.

## 5. 한계와 검토 항목

본 문서는 엔진 저장소 내부에서 편찬한 해설이며 외부 학회·전문가의 인증을 받지
않았다. 독립 검토자는 최소 다음을 확인해야 한다.

- [ ] 『연해자평』·『삼명통회』의 일행득기 관련 편·권차를 통용 판본 기준으로 특정하고,
      본문 2절의 개략 표기("격국 관련 편")를 정확한 서지로 교체할 것.
- [ ] 임계값(topMin 0.62, dominanceRatioMin 2.6, entropyMax 1.25, minFactor 0.55,
      harmThreshold 0.18)이 고전 서술(회국+무극제+일색)과 실질 동치인지 권위 명조
      표본으로 교차 검증할 것 — 현재 값은 내부 캘리브레이션이며 문헌 도출값이 아님.
- [ ] 회국(방합·삼합)이 명시 게이트가 아니라 분포 보정 경로로만 반영되는 설계가
      곡직·염상 등 회국 필수설과 충돌하지 않는지 판단할 것.
- [ ] 가색격의 사고지(辰戌丑未) 조건이 미구현(분포 기반 근사)인 점의 승인 여부.
- [ ] 순세 원칙의 절반(식상 설기 오행 용신 가산)과 운로 희기(관살운 흉, 왕신충쇠)가
      미구현인 점 — 확장 시 규칙 명세와 근거 문헌을 함께 추가할 것.
- [ ] `requireDayMasterMatch` 하드 게이트가 從旺 계열 명조를 과도하게 배제하지
      않는지, follow 팩과의 역할 분담이 이설 지형과 일치하는지 확인할 것.
- [ ] 고전 인용 검수: 본 문서의 유일한 원문 인용(『尙書』 홍범 오행 본성어)의 자구와,
      패러프레이즈 처리한 논술들의 출처 타당성을 원전 대조로 확인할 것.
