# Metaphor Library — Phase 3 A12 사용 가이드

> 작성일: 2026-05-05
> 작성자: Phase 3 A12 (metaphor library)
> 대상 독자: A1-A10 (per-category fragment author), A15 (overall pool), A21 (legacy card polish)
> 비고: 본 가이드는 `data/narrative/_metaphor/<element>.json` (wood / fire / earth / metal / water) 5 개 element-bundle 파일의 사용 규약을 기술한다. Phase 2 산출물인 `data/narrative/_metaphor/library.json` (phrase-keyed; English tone enum) 와 별개로 공존하며, 두 schema 를 한 fragment 안에서 섞어 쓰지 말 것.

---

## 1. 두 라이브러리의 관계

| 파일 | 작성 시기 | schemaVersion | tone enum | anchor 키 | 권장 용도 |
|---|---|---|---|---|---|
| `_metaphor/library.json` | Phase 2 | `spring-ts.metaphor-library.v1` | 영문 (`hopeful`, `warm`, `firm`, `reflective`, `cautious`, `celebratory`) | `phrase` | tenGod / gyeokguk / period 비유까지 폭넓게 섞을 때 |
| `_metaphor/<element>.json` (이 가이드) | Phase 3 A12 | `spring-ts.metaphor-element-bundle.v1` | 한글 (`출발·시작`, `성장·회복`, `안정·뿌리내림`, `단단함·중심`, `청결·결단`, `흐름·지혜`, `고요·축적`, `빛·표현`, `열정·활력`) | `id` + `label` | element 별 anchor 다양화·반복 회피·시기별 conditional anchor 활용 |

두 파일은 모두 `aiGenerated: true`, `sourceTier.tier: T1_HYPOTHESIS`, `authorityTruthEligible: false` 로 marking. service-visible 표현 보강용이며 권위 주장에는 사용하지 않는다.

---

## 2. anchor schema (element 파일 한정)

```json
{
  "id": "wood_seedling",        // [a-z][a-z0-9_]+ 패턴, element prefix 권장
  "label": "새싹",                // ≤20 한글자 권장. 그대로 fragment 안에 노출
  "tone": "출발·시작",            // 9 한글 enum 중 하나 (§4)
  "context": "all",              // gating 조건 (§3)
  "exampleUsage": "처음 돋는 새싹처럼 한 걸음씩 내디뎌요."  // 작성 모범 (≤40자)
}
```

---

## 3. context 필드 — gating 규칙

복수 조건은 `|` 로 OR 결합 (한 anchor 가 여러 조건 중 하나라도 만족하면 사용 가능).

| context 값 | 의미 | 매핑되는 fragment gating |
|---|---|---|
| `all` | 어떤 시기·문맥에도 사용 가능 | (조건 없음) |
| `spring` / `summer` / `autumn` / `winter` | 특정 계절에 어울림 | fragment.gating.birthSeason 또는 currentSeason |
| `brief` / `standard` / `expert` | 특정 depth 에 어울림 | fragment.axis.depth |
| `young` / `adult` / `senior` | 특정 age band 에 어울림 | fragment.gating.ageBand 매핑: young→0-9·10-19·20-29 / adult→30-39·40-54·55-69 / senior→70+ |

**예시 — water.json**
- `water_first_raindrop`: `context: "spring|young|brief"` → 봄 출생 / 0-29세 / brief depth 중 하나라도 만족 시 자연스러움
- `water_deep_ocean`: `context: "senior|expert"` → 70+ 세대 또는 expert depth 일 때 사용

**가이드라인**: gating 이 narrow 한 anchor 일수록 깊이가 살아난다. 반복 회피용 1차 후보는 `all`, 시기·연령 차별화용 2차 후보는 conditional 사용.

---

## 4. tone enum — 9 한글 카테고리

| tone | 사용 신호 | 예시 element / anchor |
|---|---|---|
| `출발·시작` | 새 국면, 시도, 첫 발 | wood_seedling, fire_dawn_light, water_first_raindrop |
| `성장·회복` | 자라남, 회복, 점진적 발전 | wood_growing_tree, wood_young_bamboo |
| `안정·뿌리내림` | 자리 잡음, 든든함, 익숙함 | earth_open_field, earth_warm_soil, metal_full_storehouse |
| `단단함·중심` | 흔들리지 않음, 원칙, 중심 | wood_unbending_branch, earth_solid_rock, metal_honed_blade |
| `청결·결단` | 정리, 결단, 선택 | metal_decision_blade, metal_first_frost, metal_neat_scissors |
| `흐름·지혜` | 흘러감, 통찰, 깊이 | water_flowing_river, water_deepening_well |
| `고요·축적` | 가라앉음, 쌓임, 기다림 | wood_growth_ring, earth_old_clay_wall, water_quiet_lake |
| `빛·표현` | 드러남, 발산, 또렷함 | fire_shining_sun, fire_lit_lamp, metal_clear_bell |
| `열정·활력` | 의욕, 활동, 뜨거움 | fire_blooming_flame, fire_burning_log, fire_midday_sunlight |

---

## 5. 사용 규칙 — 작성자 준수 사항

### 5.1 한 fragment 안에서 비유 1개를 일관되게

한 fragment 안에서는 anchor 1개를 골라 그대로 (또는 약간의 변형) 사용한다. 이미지를 섞지 않는다.

- **PASS**: "푸른 잎사귀가 햇살을 받는 시기예요. 잎 끝에 닿는 빛이 점점 또렷해질 거예요." (wood + 그 element 안의 두 anchor 변형)
- **FAIL**: "푸른 잎사귀가 햇살을 받는 시기예요. 잘 채운 곳간처럼 결실이 모일 거예요." (wood → metal 점프, 이미지가 깨짐)

### 5.2 같은 element 안에서는 자유 치환

word repetition 감소 시, 같은 element 의 다른 anchor 로 자유롭게 바꿀 수 있다. tone 이 비슷하면 의미 변동 최소.

- 예: 카테고리 wealth.thisYear.brief.001 = "새싹처럼 한 걸음씩 모아요."
- 변형: wealth.thisYear.brief.002 = "어린 죽순처럼 한 마디씩 키가 쌓여요." (둘 다 wood + 출발·시작/성장·회복)

### 5.3 다른 element 와 섞지 말 것

오행 element 가 다른 anchor 를 한 fragment 안에 동시에 끌어오면 음양오행 doctrine 신뢰도가 흐트러진다. element 는 고정, anchor 만 다양화.

### 5.4 기존 contract `voiceRubric.metaphorLibrary` 의 4 anchor 는 보존

`_contract/v1.json` 에 inline 된 element 별 4 anchor (예: wood = 새싹·자라는 나무·봄의 기운·뿌리내리기) 는 frozen. 본 element-bundle 의 anchor 들은 이를 superset 으로 포함한다. 기존 fragment 가 contract 의 anchor 를 사용하고 있다면 그대로 두고, 신규 fragment 에서만 추가 anchor 를 도입한다.

---

## 6. 사용 예시 — 카테고리 × depth 별 6 케이스

### 6.1 wealth / brief / WOOD-strong day master

```
gating: dayMasterElement=WOOD, depth=brief
anchor 선택: wood_growing_tree (tone=성장·회복, context=all)

headline: "한 마디씩 키가 오르는 시기예요."   (≤28자, anchor label 변형)
hook: "자라는 나무처럼 꾸준한 결실이 쌓여요."  (≤28자)
```

### 6.2 wealth / standard / WATER day master, 봄 출생

```
gating: dayMasterElement=WATER, birthSeason=spring, depth=standard
anchor 선택: water_first_raindrop (tone=출발·시작, context="spring|young|brief")
            + water_flowing_river (tone=흐름·지혜, context=all)

paragraph 1: "첫 빗방울이 마른 들판에 닿는 듯 새 자원이 들어오는 시기예요. 작아 보여도 곳곳에 스며들죠."
paragraph 2: "한 달 정도 지나면 흐르는 강처럼 자원이 일정한 호흡으로 이어집니다."
livingTip: "주간 가계부에 작은 수입도 빠짐없이 적어 두세요."
```
(같은 element WATER, 두 anchor 자유 치환)

### 6.3 health / brief / FIRE day master, 여름 출생

```
gating: dayMasterElement=FIRE, currentSeason=summer
anchor 선택: fire_midday_sunlight (tone=열정·활력, context=summer)

headline: "한낮 햇살처럼 활력이 가장 강해요."
hook: "잠깐의 그늘에서 호흡을 고르세요."
```

### 6.4 health / standard / METAL day master, 가을 currentSeason

```
gating: dayMasterElement=METAL, currentSeason=autumn, depth=standard
anchor 선택: metal_dawn_air (tone=고요·축적, context="autumn|brief")
            + metal_first_frost (tone=청결·결단, context=autumn)

paragraph: "서늘한 새벽 공기처럼 정신이 또렷해지는 시기예요. 가을 첫 서리가 닿듯 마무리할 일이 또렷이 보입니다."
caution: "찬 기운에 무리하게 노출되지 않도록 옷차림을 한 겹 더 두세요."
```

### 6.5 romance / standard / EARTH day master, adult

```
gating: dayMasterElement=EARTH, ageBand=30-39, depth=standard
anchor 선택: earth_leaning_hill (tone=안정·뿌리내림, context=all)
            + earth_warm_soil (tone=안정·뿌리내림, context=all)

paragraph: "어깨를 기댈 언덕처럼 든든한 사람이 곁을 지키는 시기예요. 포근한 흙처럼 일상의 작은 대화가 관계를 단단히 다져 줍니다."
```

### 6.6 family / expert / WOOD day master, senior

```
gating: dayMasterElement=WOOD, ageBand=70+, depth=expert
anchor 선택: wood_growth_ring (tone=고요·축적, context="adult|senior|standard|expert")

paragraph: "#nyantongsang 자리에 #nayinmokje 가 단단히 받쳐 주는 결입니다. 깊어지는 나이테처럼 한 해 한 해 결을 더해 가는 흐름이 가족에게 #jeongin 의 기운을 전합니다."
```

### 6.7 academic / brief / WATER, young

```
gating: dayMasterElement=WATER, ageBand=10-19
anchor 선택: water_spring_source (tone=출발·시작, context="spring|brief")

headline: "샘솟는 우물처럼 호기심이 깊어요."
hook: "오늘 읽은 한 줄을 노트에 옮겨 보세요."
```

### 6.8 study_document / standard / FIRE, currentSeason=spring

```
gating: dayMasterElement=FIRE, currentSeason=spring
anchor 선택: fire_dawn_light (tone=출발·시작, context="spring|brief")
            + fire_lit_lamp (tone=빛·표현, context=all)

paragraph: "새벽 동튼 빛처럼 하루의 시작이 또렷해지는 시기예요. 환하게 켜진 등처럼 표현이 분명해져 글이나 발표가 잘 통합니다."
livingTip: "하루 첫 30분에 가장 또렷한 글을 적어 두세요."
```

---

## 7. 위배 시 처리

- 다른 element 비유 혼용: PR 리뷰에서 reject. element 통일 후 재제출.
- tone enum 외 값 사용: schema 검증에서 향후 도입할 enum guard 가 reject.
- contract metaphorLibrary 의 anchor 4개를 변형하거나 제거: contract 가 frozen 이므로 상위 reject.

---

## 8. 향후 확장 여지

- element × tenGod cross 비유 (예: 木 + 정관 = 곧게 뻗은 줄기 + 단정한 책상) — Phase 4 후보
- 시간대 (새벽 / 아침 / 정오 / 저녁 / 한밤) 별 conditional anchor 추가 — 현재는 `dawn_*`, `midday_*`, `dusk_*` 형태로 제한적 도입
- 한자 신살별 비유 (망신·역마·도화) 별 anchor — `_metaphor/library.json` 에 일부 존재, element-bundle 측은 미도입
