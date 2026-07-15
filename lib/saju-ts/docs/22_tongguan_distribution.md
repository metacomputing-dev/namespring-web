# 22. 통관(通關) 용신과 세력 분포 판정

> **문서 지위**: 학파 프리셋 출처 정본(in-repo compilation).
> **검토 상태**: 편찬 초안 — 독립 전문가 검토 대기 (검토 완료 전 이 문서는 교리 '해설'이며 외부 권위 인증이 아님).
> **편찬일**: 2026-07-10 (사주 엔진 무결성 감사 PR #653, P0-4)
> **관련 프리셋**: `tongguan`, `ditiansui` (src/schools/packs/builtin.pack.json)

## 1. 교리 요약

통관(通關)은 명식(命式) 안에서 상극(相剋) 관계의 두 오행 세력이 팽팽하게 대치(相戰)할 때,
두 세력을 상생(相生) 사슬로 이어 주는 중간 오행 — 통관신(通關神) — 을 용신으로 삼는 방법이다.
억부(抑扶)가 일간(日干) 강약의 보정이라면, 통관은 명식 전체의 세력 충돌을 소통시키는 구조적 처방이다.

오행 상극 5쌍과 그 교량(bridge) 오행은 상생 사슬(A→X→B)에서 기계적으로 결정된다.

| 대치 쌍(相戰) | 통관신(교량) | 상생 사슬 |
|---|---|---|
| 水火 상전 | 木 | 水生木, 木生火 |
| 火金 상전 | 土 | 火生土, 土生金 |
| 金木 상전 | 水 | 金生水, 水生木 |
| 木土 상전 | 火 | 木生火, 火生土 |
| 土水 상전 | 金 | 土生金, 金生水 |

전통적 성립 조건은 두 가지로 요약된다.

1. **대치 성립**: 양 세력이 *모두 유력*하고 세력이 *백중(伯仲)*해야 한다. 한쪽이 압도하면
   그것은 통관의 국면이 아니라 억부(抑扶)나 종세(從勢)의 문제가 된다. 한쪽이 미약하면
   싸움 자체가 성립하지 않으므로 통관신이 필요 없다.
2. **교량의 유근(有根)**: 통관신 자체가 명식 안에 뿌리가 있어야(지지 통근 또는 천간 투출)
   실제로 두 세력을 소통시킬 수 있다. 무근(無根)의 통관신은 오히려 싸움에 휩쓸린다는 것이
   통설이다. 원국에 통관신이 없으면 대운·세운에서 오기를 기다린다는 논의(행운 통관)도 있다.

## 2. 고전 근거

### 2.1 『적천수(滴天髓)』 계보 — 통관 논지의 원류

『적천수』는 원문 전승에 이설이 있다(宋 京圖 찬(撰) 전승, 明初 劉伯溫 주(注) 전승).
오늘날 통용되는 것은 청대 임철초(任鐵樵)의 증주본 『적천수천미(滴天髓闡微)』이다.
그 「통관(通關)」 장은 관(關) 안팎에 갈라진 직녀와 견우가 관문이 통하면 서로 만난다는
비유로, 가로막힌 두 세력 사이의 관문을 여는 오행이 명식을 살린다는 취지를 논술한다
(『滴天髓』 通關章 — 견우직녀 비유 구절의 자구는 판본 확정 전이라 원문 인용을 보류한다).
임철초의 증주는 이를 확장하여, 극전(剋戰)하는 두 신(神) 사이를 상생으로 이어 주는 것이
통관이며, 인수(印綬)가 관살(官殺)과 일주(日主)를 소통시키는 경우 등을 구체 사례로 든다는
취지로 해설한다(『滴天髓闡微』 通關).

`ditiansui` 프리셋이 억부·조후·통관·종세를 함께 켜는 것은, 『적천수』 계열이 이들 방법을
배타적 선택이 아니라 명식 국면에 따라 병용하는 관점을 취한다는 통용 해석을 반영한 것이다.

### 2.2 작동 기제 — 탐생망극(貪生忘剋)

통관이 작동하는 오행론적 기제는 「貪生忘剋」이라는 관용 문구로 전승된다: 극(剋)하려는
오행이 생(生)할 대상을 만나면 극을 잊는다. 예컨대 水火 상전에서 木이 유력하면 水는 火를
치는 대신 木을 생하고, 木은 다시 火를 생하여 싸움이 흐름으로 바뀐다. 오행 생극제화
(生剋制化)의 제화(制化) 논리는 『삼명통회(三命通會)』(萬民英, 明) 등 명대 종합 명서의
오행 총론에서도 같은 취지로 다뤄진다.

### 2.3 다른 고전에서의 위치

- 『자평진전(子平眞詮)』(沈孝瞻, 淸)은 「用神專求月令」의 월령 격국 체계를 취하여 통관을
  독립된 용신법으로 세우지 않는다. 다만 격(格)을 상하는 기신을 다른 십성이 조정·구응하는
  상신(相神) 논리에 통관적 발상이 스며 있다는 취지의 논술이 있다(『子平眞詮』 상신 관련 편).
- 『연해자평(淵海子平)』(徐大升 편, 南宋 계열)과 『신봉통고(神峰通考)』(張楠, 明)는 오행
  생극과 병약(病藥)·구응의 관점에서 세력 충돌의 해소를 다루며, 통관을 5대 용신법의 하나로
  병렬하는 분류는 근현대(민국기 徐樂吾 계열 이후) 정리 관행이다.
- 『궁통보감(窮通寶鑑)』(欄江網 계열, 徐樂吾 평주본 통용)은 조후 전문서로 통관과의 직접
  관련은 낮다.

**저작권 주의**: 위 고전 원전은 모두 저작권이 소멸한 공용 도메인(public domain)이다. 단,
임철초 증주의 현대 표점·교감본, 서락오 평주본 등 *현대 평주·번역본*의 편집 저작권은
별개이므로 본 저장소는 원전의 취지 요약과 관용 문구 수준의 인용만 수록한다.

## 3. 엔진 구현 대응

### 3.1 대치 쌍 탐지 — `src/rules/facts.ts` `computeTongguanFacts()`

`facts.tongguan`은 정규화 오행 분포 `facts.elements.normalized`(오행 세력 점유율, 합=1)만을
입력으로 5개 상극 쌍(`waterFire`/`fireMetal`/`metalWood`/`woodEarth`/`earthWater`)의
전투 강도를 계산한다. 핵심 수식은 `battleIntensity(x, y)` (facts.ts):

```
battleIntensity(x, y) = clamp01( 2 · min(x, y) · (1 − |x − y| / (x + y)) )
```

- `min(x, y)` 항 = **"양 세력 모두 유력"** 요건의 수학화(약한 쪽이 곧 싸움의 상한).
- `1 − |x−y|/(x+y)` 항 = **"세력 백중"** 요건의 수학화(비대칭이 커질수록 0으로 감쇠).
- x = y = 0.5(두 오행이 명식을 양분)에서 최대 1 — 교리상 가장 극렬한 상전 국면.

이어 다중 전투 국면의 보정 지표를 계산한다: `maxIntensity`(최대 강도),
`sumIntensity`(총합), `dominance = maxIntensity / sumIntensity`(단일 전투 지배도),
`dispersion`(강도 분포의 정규화 엔트로피), 그리고 쌍별
`weightedIntensity = intensity × dominance`, `effectiveMaxIntensity = maxIntensity × dominance`.
전투가 여러 쌍에 분산되면 단일 교량으로는 소통이 결정적이지 못하다는 교리적 직관을
dominance 감쇠로 수학화한 것이다.

### 3.2 교량 오행 점수화 — `src/rules/yongshin.ts` `computeYongshin()`

`tongguanScores`는 각 교량 오행에 담당 쌍의 `weightedIntensity`(부재 시 `intensity`)를
할당한다: WOOD←waterFire, EARTH←fireMetal, WATER←metalWood, FIRE←woodEarth,
METAL←earthWater — 1절의 교리 표와 1:1 대응이다. 최종 용신 점수에는
`tongguanTerm = effectiveWeights.tongguan × tongguanScores[e]`로 합산되며, 가중치는 설정 키
`strategies.yongshin.weights.tongguan`이다. 방법군 귀속(`primaryMethod`)에 'TONGGWAN'이
있고, 합의 스코어보드(`consensus.tonggwan`)가 이 축의 최적 오행과 증거를 별도 보고한다.

`methodSelector.tongguan`이 켜진 경우(= `ditiansui`) 게이팅이 추가된다
(`strategies.yongshin.methodSelector.tongguan.threshold`, 기본 0.25):

```
factor = clamp01( (effectiveMaxIntensity − threshold) / (1 − threshold) )
effectiveWeights.tongguan ×= factor
```

즉 지배적 전투 강도가 문턱 이하면 통관 항 전체가 0으로 닫힌다 — "대치가 성립해야
통관을 논한다"는 성립 조건의 게이트 구현이다.

### 3.3 DSL 가산 규칙 — `src/rules/spec/compileYongshinSpec.ts` `case 'tongguanBridge'`

`tongguan` 프리셋은 pack의 ruleSpecBlock `yongshin.tongguan.bridge`를 include하며, 이는
쌍마다 규칙 `TONGGUAN_{pair}_{bridge}`로 컴파일된다(기본 룰셋에 append; 기본 룰셋 자체에는
통관 규칙이 없다). 발동 조건은 `tongguan.pairs.{pair}.intensity ≥ minIntensity`, 효과는
`yongshin.{bridge} += intensity × bonus`. 문턱·보너스는 pack 선언대로 설정 변수
`config.strategies.yongshin.bridge.minIntensity` / `...bridge.bonus`에서 읽는다
(DSL 변수 해석은 `facts.config.strategies.*` 경유 — facts.ts의 config 미러 필드).
pack의 `intensityField`는 `"intensity"`(dominance 비가중 원시 강도)이다.

### 3.4 프리셋 파라미터 (builtin.pack.json 현행값)

| 키 | `tongguan` | `ditiansui` |
|---|---|---|
| `weights.tongguan` | 1.1 (weights.balance 0.75, role 0.3) | 0.75 (억부·조후·종세와 병용) |
| `methodSelector.tongguan` | 없음(게이팅 없이 상시 합산) | enabled, threshold 0.25 |
| `bridge.minIntensity` / `bonus` | 0.22 / 1.4 (DSL 블록이 소비) | 0.22 / 1.4 (§5 참조 — 소비처 없음) |
| ruleSpecBlock include | `yongshin.tongguan.bridge` | 없음 |

## 4. 학파 이설과 프리셋 선택지

- **적천수 계열(병용론)**: 통관을 억부·조후·종세와 병렬로 두고 국면에 따라 배합 —
  `ditiansui` 프리셋(통관 0.75 + methodSelector 게이팅)이 이 관점의 구현이다.
- **자평진전 계열(월령 격국 우선)**: 통관을 독립법으로 세우지 않음 — `gyeokguk`,
  `ziping.strict` 프리셋에서 `weights.tongguan = 0`으로 반영된다.
- **현대 5대 용신법 병렬(억부·조후·통관·병약·전왕)**: 통관을 대등한 방법으로 전면화 —
  `tongguan` 프리셋(실험)이 이 관행을 단독 축으로 시험한다.
- **행운 통관(운희용신)**: 원국에 통관신이 없으면 대운·세운에서 오는 것을 기다린다는
  이설 — 엔진은 원국 분포만 점수화하며 운 차원의 통관은 미구현이다.
- **위치·근접 기반 대치론**: 상전은 인접 간지(干支)에서 극렬하고 원격이면 완화된다는
  통설 — 엔진의 탐지는 위치를 버린 분포 기반이며, 이는 의도된 단순화다(§5).

## 5. 한계와 검토 항목

이 문서는 엔진 저장소 내부에서 편찬되었으며 외부 학회·독립 전문가의 승인을 받은 바 없다.
독립 검토자는 최소한 다음을 확인해야 한다.

- [ ] **교량 유근 요건 미구현**: 엔진은 교량 오행의 통근·투출 여부를 확인하지 않고 분포
      점수만 가산한다. "무근의 통관신은 소통하지 못한다"는 교리(§1 조건 2)와의 괴리를
      허용할지, 유근 게이트를 추가할지 판정 필요.
- [ ] **절대 세력 문턱 부재**: `battleIntensity`는 상대 분포만 보므로, 두 오행이 각각
      점유율 0.2 남짓인 미약한 국면에서도 백중이면 강도가 발생한다. "양 세력 모두 유력"
      요건에 총량 하한(예: x+y ≥ 문턱)을 둘지 검토.
- [ ] **`ditiansui`의 dead config**: overlay에 `bridge.minIntensity/bonus`가 선언되어 있으나
      DSL 블록(`yongshin.tongguan.bridge`)을 include하지 않아 소비처가 없다. include 추가
      또는 키 제거 중 의도 확정 필요.
- [ ] **`tongguan` 프리셋의 이중 계상**: base 항(weightedIntensity × 1.1)과 DSL 가산
      (raw intensity × 1.4, 문턱 0.22)이 같은 신호를 두 경로로 반영한다. 의도된 강조인지
      중복인지 확정하고 캘리브레이션 근거를 기록할 것.
- [ ] **견우직녀 비유 구절의 판본 확정**: 『적천수천미』 통관장의 자구를 신뢰 가능한
      판본으로 대조한 뒤 원문 인용으로 승격할지 결정(현재는 패러프레이즈만 수록).
- [ ] **위치·합충 상호작용 미반영**: 인접/원격, 합(合)·충(沖)에 의한 대치 완화·격화가
      강도 계산에 들어가지 않는다 — 분포 기반 단순화의 허용 범위 판정.
- [ ] **dominance 감쇠의 교리 적합성**: 다중 전투 국면에서 통관 결정력을 낮추는
      `weightedIntensity = intensity × dominance` 설계가 고전 논지의 정당한 확장인지,
      엔진 고유의 발명인지 명시적으로 구분해 표기할 것(현재는 엔진 고유 수학화로 분류).
