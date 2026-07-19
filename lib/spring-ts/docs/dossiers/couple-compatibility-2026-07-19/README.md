# 두 사람 궁합(Couple Compatibility) 정본 문서

- 작성일: 2026-07-19 (브랜치 `feature/fe-v3`)
- 스키마: `spring-ts.couple-compatibility.v1`
- 엔진 정본 코드: `lib/spring-ts/src/report/compatibility/`
  (`types.ts` · `relation-tables.ts` · `context.ts` · `copy-bundles.ts` · `build-couple-compatibility.ts` · `index.ts`)
- FE 정본 코드: `namespring/src/v3/` — `engine/compatibility.ts`, `model/{compat,people,saved-compat,relationship-catalog}.ts`, `screens/Compatibility{,Name,Saju}Screen.tsx`, `screens/compat/{shared.tsx,PersonSceneryPair.tsx}`
- 테스트: `lib/spring-ts/test/integration/couple-compatibility.test.ts` (합성 fixture 단위·통합), `namespring-compat.test.ts` (delivery 하위호환 계약)

이 문서는 궁합 기능의 아키텍처·계산 방법론·관계 맥락 시스템·카피 번들·FE 구조·알려진 한계를 한 곳에 기록하는 정본이다. 코드와 어긋나면 코드를 고치기 전에 이 문서의 해당 절을 함께 갱신한다.

---

## 1. 아키텍처

### 1.1 사람별 ReportDeliveryV1 재사용 → 순수 빌더

궁합은 **새로운 사주·성명 판단을 하나도 돌리지 않는다.** 입력은 두 사람 각각에 대해 이미 계산된 `ReportDeliveryV1` 두 벌이고, 빌더는 그 안의 결정론적 fact(`pillars`, `strength`, `yongshin`, `element_balance`, `element_distribution`, `yin_yang_balance`, `name_character`, `naming_frame`, `name_saju_interaction`)만 꺼내 짝짓는다.

```
V3Profile(a), V3Profile(b)
   │  fetchDelivery(profile, COMPAT_SURFACES)      ← 사람별 통합 계산 (캐시 재사용)
   ▼
ReportDeliveryV1 × 2
   │  buildCoupleCompatibilityV1(request)          ← 순수 함수, 부작용 없음
   ▼
CoupleCompatibilityV1
   ├─ persons.{a,b}   : 표시용 echo (일간·일지·용신·오행 분포)
   ├─ context         : 짝의 맥락 fact + 읽기 문장 (모든 카피의 프레임 결정)
   ├─ facts[]         : 결정론적 쌍 검출 (stem_pair, branch_pair, …)
   ├─ axes[13]        : 축별 점수·등급·실효 가중치·해석 문장
   ├─ sections        : integrated / saju / name (요약 + 축 id 목록)
   └─ provenance      : 축별 기본 가중치·도메인 가중치 공개
```

이 구조가 주는 것:

- **관심사 분리** — 개인 해석의 진리값은 delivery 파이프라인 한 곳에서만 만들어진다. 궁합은 그 위의 순수 조합 계층이라, 개인 계산이 고쳐지면 궁합도 자동으로 따라온다.
- **facts / axes 이원화** — delivery 계약과 동일한 원칙. `facts`는 결정론적 검출(합·충·형·해·파·원진·귀문, 오행 상보, 용신 교차 …)이고, `axes`는 그 위의 점수+해석(interpretive)이다. 모든 축은 `factRefs`로 근거 fact를 가리킨다.
- **fail-honest** — 값이 없으면 축을 `limited`/`unavailable`로 표시하고 중립값을 지어내지 않는다 (`CompatibilityReasonCodeV1`: `DAY_PILLAR_MISSING`, `YONGSHIN_MISSING`, `NAME_FRAMES_MISSING` 등, 사람 단위 귀속 `person: 'a'|'b'` 포함).

### 1.2 캐시 전략 (FE 글루: `engine/compatibility.ts`)

두 겹의 Promise 캐시가 있고, 모두 메모리(모듈 스코프 `Map`)다.

| 캐시 | 키 | 재사용 조건 |
|---|---|---|
| `deliveryCache` (`engine/client.ts`) | profile 내용 + surfaces 직렬화 | 같은 사람을 다른 궁합·다른 화면에서 다시 쓰면 통합 계산을 반복하지 않는다 |
| `compatCache` (`engine/compatibility.ts`) | slot a 직렬화 + slot b 직렬화 + 관계 선택(category·label·tone) | 통합/이름간/사주간 세 화면이 같은 결과 객체를 공유한다 |

- 궁합은 세 표면을 함께 요청한다: `COMPAT_SURFACES = [integrated, saju, naming]` (모두 `standard` 깊이) — 13개 축이 필요로 하는 fact를 한 번에 확보하기 위해서다.
- 캐시 값은 Promise 자체다. 실패하면 `catch`에서 키를 지워 fail-closed 캐시 오염을 막는다(다음 시도에서 재계산).
- 관계 선택이 캐시 키에 들어가는 이유: 같은 두 사람이라도 관계에 따라 카피 프레임과 점수(배우자성 보너스)가 달라지기 때문이다.

### 1.3 결정론 원칙

- 빌더와 컨텍스트 파생은 **실행 시각·난수를 절대 쓰지 않는다.** 나이는 각 delivery의 `anchorDate`(기준일) 기준 만 나이만 계산한다 (`Date.now()` 금지). 같은 입력이면 언제 실행해도 같은 출력이다.
- `anchorDate` 파싱은 문자열 연산만으로 한다(타임존 무관).
- 저장소 계층(`saved-compat.ts`)의 `Date.now()`는 엔트리 id·정렬용일 뿐 계산에 관여하지 않는다.
- 통합 테스트가 동일 입력 2회 호출의 `JSON.stringify` 일치를 검증한다.

### 1.4 개인정보 원칙

모든 계산은 기기 안에서 끝난다. 출생 정보가 담기는 슬롯·보관함·저장된 궁합은 sessionStorage/localStorage에만 두고 **공유 URL·서버 어디에도 싣지 않는다** (5절 참조).

---

## 2. 계산 축 13개와 가중치

### 2.1 도메인 가중치: 사주 55 / 이름 30 / 교차 15

통합 점수 = 사주 0.55 + 이름 0.30 + (이름↔사주 교차) 0.15의 가중 평균. 계산 불능 도메인은 빼고 나머지를 재정규화한다. 이 비율과 축별 가중치는 `provenance.domainWeights` / `provenance.axisBaseWeights`로 응답에 그대로 공개되고, 각 요약의 `weightsNote` 문장으로도 사용자에게 설명된다 (점수 투명성 원칙).

### 2.2 축별 기본 가중치 표 (`AXIS_BASE_WEIGHTS`)

| 도메인 | 축 id | 라벨 | 가중치 |
|---|---|---|---|
| saju | `saju_day_branch` | 배우자궁/일지의 만남 | **0.26** |
| saju | `saju_day_stem` | 일간의 만남 | 0.20 |
| saju | `saju_yongshin_cross` | 서로의 용신을 채워 주는가 | 0.15 |
| saju | `saju_element_complement` | 오행 상호 보완 | 0.12 |
| saju | `saju_ten_god` | 서로에게 어떤 존재인가(십성) | 0.10 |
| saju | `saju_strength` | 기운 세기의 짝 | 0.07 |
| saju | `saju_yin_yang` | 음양의 조화 | 0.05 |
| saju | `saju_year_branch` | 띠(년지)의 어울림 | 0.05 |
| name | `name_flow` | 이름 소리(발음오행)의 흐름 | **0.50** |
| name | `name_element_complement` | 두 이름의 오행 상보 | 0.20 |
| name | `name_frames` | 수리 기운 나란히 보기 | 0.15 |
| name | `name_polarity` | 이름 음양의 배열 | 0.15 |
| cross | `cross_name_saju` | 이름이 상대 사주에 주는 기운 | 1.00 |

`unavailable` 축은 가중치 0으로 빠지고, 남은 축의 기본 가중치를 도메인 안에서 재정규화한다. 축 객체의 `weight`는 이 **재정규화 후 실효 가중치**다.

### 2.3 등급 구간 (`gradeOf`)

| 점수 | 등급 | FE 라벨 |
|---|---|---|
| 80~ | `excellent` | 아주 잘 맞아요 |
| 65~79 | `good` | 잘 맞는 편이에요 |
| 50~64 | `balanced` | 무난해요 |
| 38~49 | `watch` | 완급이 필요해요 |
| ~37 | `challenging` | 노력이 필요해요 |

실무 상담 관행의 "80점 이상 천생연분 / 65 좋음 / 50 무난 / 38 노력 / 그 밑 신중" 구간을 그대로 옮겼다. 60이 무난한 중립선이라는 전제 아래 각 축의 기준점(anchor)을 정했다.

### 2.4 축별 점수 앵커 (요지)

- **일간**: 천간합 88 · 상생 76 · 비화 66 · 상극 46 · 천간충 36. 합화 오행이 어느 쪽 용신이면 +4, 기신이면 −4.
- **일지·년지 (지지 쌍 공통 `branchPairScore`)**: 기준 60에서 시작. 합 보너스는 겹쳐도 **가장 강한 하나만** (육합 +28 · 삼합 반합 +21 · 방합 +10). 흉은 충 30 · 원진 18 · 형 15 · 귀문 14 · 자형 10 · 해 9 · 파 7의 크기로, **가장 강한 하나만 온전히 감점하고 나머지는 40%로 부기** (축오처럼 원진+귀문+해가 겹치는 쌍의 이중 과금 방지), 총 감점 상한 38. 최종 6~96 클램프.
- **십성**: 일간↔일간 쌍의 양방향 십성을 점수표(정관·정재 78 … 상관 50 · 겁재 46)로 평균. **couple 프레임에서만** 남성에게 재성·여성에게 관성이면 방향별 +8 (배우자성 보너스).
- **용신 교차**: 상대 일간 오행이 내 용신과 direct 90 · 상생 78 · neutral 58 · 상극 40. 돕는 쪽 원국에서 용신 오행 비율 ≥30%면 +6, 내 기신 오행 비율 ≥35%면 −8. 두 사람 용신이 같으면 +4 ("같은 결핍 공유"형 궁합으로 별도 서사).
- **오행 보완**: 받는 쪽 부족 오행 중 주는 쪽의 왕성 오행(과다 판정 또는 분포 ≥25%)이 채우는 비율로 50+45·ratio. 부족이 없으면 68(자립형). 둘 다 과다인 오행이 겹치면 −6.
- **음양**: 일간 음양 상보 74 / 동극 58, 원국 우세 상보 +8, 둘 다 EVEN +6.
- **신강약**: complementary 78 · balanced_pair 72 · balanced_mix 68 · both_weak 56 · both_strong 52.
- **발음오행 흐름**: 두 이름 전 글자 초성 오행의 데카르트 쌍에서 58 + 38·(상생비) − 30·(상극비) + 8·(비화비), 20~95 클램프. 주는 인연/받는 인연 방향(`aGeneratesB`/`bGeneratesA`)을 fact에 기록.
- **이름 오행 상보**: 40 + 11·(합산 커버 오행 수 0~5) + 2·min(상호 채움, 3).
- **수리**: 각자 원형이정 길수 평균 비율의 평균으로 30+60·ratio — **둘을 합산하지 않는다** (아래 2.5).
- **이름 음양**: 둘 다 혼합 76 · 한쪽 혼합 62 · 서로 다른 단극 66 · 같은 단극 48.
- **교차(이름→상대 사주)**: 이름 글자(자원오행 계열)가 상대 용신에 닿으면 80+α(−10 기신 동반 감점), 기신만 닿으면 44, 무접촉 58. 양방향 평균.

### 2.5 방법론 채택 결정 기록 (도메인 관행의 근거)

코드 리뷰에서 "왜 이렇게 정했는가"가 반복 질문되는 항목들의 판결 기록이다.

1. **일지 > 일간 > 용신·오행 > 보조 > 띠 서열.** 명리 궁합의 실무 통설은 배우자궁(일지)의 합충을 으뜸으로, 일간 관계를 버금으로 본다. 띠(년지)는 대중적으로 가장 유명하지만 실무에서는 가벼운 참고 신호다 — 그래서 5%만 주고, 년지 축 카피에 그 사실을 명시하는 문장을 항상 붙인다.
2. **삼합·방합은 왕지(旺支)를 낀 반합만 인정.** 두 사람 궁합에서는 각자 한 글자씩만 짝지으므로 삼합 전체(세 글자)는 성립할 수 없고 반합만 가능하다. 반합은 **왕지(자·오·묘·유)가 끼어야 성립**한다는 통설을 따른다 (`SAMHAP_GROUPS.pivot`). 생지+고지 조합(예: 신+진)은 반합으로 치지 않는다. 같은 쌍이 삼합·방합에 모두 걸리면 삼합을 우선한다.
3. **오미합(午未合)은 합화 유보.** 육합 여섯 쌍 중 오미합의 합화 오행은 유파에 따라 화(火) 또는 "합이불화(合而不化)"로 갈린다. 우리는 **합 성립만 인정하고 `yukhapElement: null`**로 보수적으로 둔다. 점수는 육합 보너스를 그대로 받되, "무엇으로 화한다"는 단정 문장은 쓰지 않는다.
4. **발음오행은 주류 작명 배속(ㅇ·ㅎ=토) 채택.** 훈민정음 해례본의 오음 배속은 후음(ㅇㅎ)=수, 순음(ㅁㅂㅍ)=토로, 이를 따르는 소수파 논쟁이 실무에 존재한다. 현행 작명 시장의 절대 다수는 아음=목·설음=화·후음=토·치음=금·순음=수 배속을 쓰므로 이를 기본값으로 채택했고, fact에 `basis: 'phonetic_initial_mainstream'`으로 배속 기준을 명시해 향후 해례 배속 옵션 추가 여지를 남겼다.
5. **이름 대 이름 궁합의 정통 축은 발음오행.** 자원오행끼리의 상생상극 궁합은 무리라는 것이 전문가 통설이라, 자원오행(한자 부수 계열, `name_character.element`)은 **교차 축(내 이름 오행 ↔ 상대 사주의 용신·기신)에서만** 쓴다. 이름 도메인에서 발음오행 흐름이 50%를 받는 이유다.
6. **수리(원형이정)는 합산하지 않는다.** 두 이름의 획수를 더해 "궁합 수리"를 내는 방식은 민속 놀이에 가깝다고 판단, 각자의 길수 흐름을 **나란히 읽는** 방식만 쓴다 (`weightsNote`에도 그대로 고지). 한자 없는 순우리말 이름은 수리를 셈하지 않고 축을 `unavailable`로 둔다.
7. **배우자성(재성·관성) 보너스는 couple 프레임 한정.** 우정·가족·아이의 짝에 배우자의 별을 세는 것은 명리적으로도 무리다. 점수 보너스와 해당 카피 문장이 같은 조건(`voice.framing === 'couple'`)으로 함께 갈린다. 성별 미제공이면 보너스 없이 성별 중립으로 해석한다.
8. **흉 관계 중복 감점 금지.** 축오(丑午)처럼 원진+귀문+해가 한 쌍에 겹치는 조합은 고전 표의 중복 수록이지 세 배 나쁜 관계가 아니다. 가장 강한 하나만 온전히 반영하고 나머지는 40% 부기, 상한 38.
9. **자형(自刑)은 두 사람이 같은 글자(진진·오오·유유·해해)를 가질 때 성립.** 한 원국 안의 자형 로직과 달리, 쌍 조회에서는 `a === b && BRANCH_JAHYEONG.has(a)`로 판정한다.
10. **일간↔일간·일지↔일지·년지↔년지만 축 점수의 근거.** 나머지 기둥 조합(일↔월 등)은 합·충 등 유의미한 관계가 있을 때만 facts에 실리고, FE의 "여덟 기둥 교차 신호" 브라우저에서 **점수에 넣지 않는 참고 신호**로만 보여준다.

---

## 3. 관계·나이 맥락 시스템

### 3.1 좌표계: 카테고리 5 × 프레이밍 4 × 톤 3

세 층은 역할이 다르다.

| 층 | 값 | 정하는 주체 | 역할 |
|---|---|---|---|
| 카테고리 `CompatRelationshipV1` | `romance` · `friendship` · `family` · `partnership` · `unspecified` | 사용자 선택(또는 프리셋 매핑) | 엔진에 전달되는 관계 의도 |
| 프레이밍 `CompatFramingV1` | `couple` · `companion` · `guardian` · `kids` | **엔진이 결정론적으로 파생** (`derivePairContext`) | 모든 카피의 언어 프레임 + 점수 분기(배우자성 보너스, 일지 자리 호칭) |
| 톤 `CompatRelationshipToneV1` | `peer` · `hierarchy` · `care` | 프리셋 카탈로그가 지정 | 카테고리보다 한 겹 섬세한 카피 분기 (현재는 context note 한 줄) |

프레이밍 파생 규칙 (우선순위 순, `context.ts`):

1. 둘 다 아이(14세 미만) → `kids`
2. 한쪽만 아이 → `guardian`
3. 청소년(14~18) 포함 → `couple` 금지. family 요청 + 나이차 ≥18년이면 `guardian`, 그 외 `companion`
4. 성인끼리 romance 요청 → `couple`
5. family 요청 + 나이차 ≥18년 → `guardian`, 작은 차이 → `companion`
6. 그 밖 전부 → `companion`

**미성년 포함 시 couple 금지 규칙**: 아이·청소년이 포함되면 **요청과 무관하게** 연애 프레임을 쓰지 않는다. romance를 요청했는데 프레임이 바뀌면 그 사실을 정직하게 알리는 노트를 반드시 싣는다 ("요청해 주신 관계는 연인이었지만 …"). 나이대 경계: child <14, teen 14~18, adult 19~64, senior 65+.

생년월일이 없으면 나이 값은 전부 null로 두고 프레임은 요청된 관계를 존중한다 — **미성년 판정은 근거가 있을 때만** 한다(지어내지 않기 원칙의 적용).

### 3.2 나이 맥락의 정직한 읽기

- 나이차는 **태어난 해의 차이**로 센다 (만 나이 차가 아님). 동갑·띠동갑·"네 살 차" 속설이 전부 "해"의 언어이기 때문이며, 만 나이로 세면 생일에 따라 11·13이 되어 띠동갑 판정이 흔들린다.
- 속설은 실제 년지 관계와 **대조해서만** 읽는다: 4살 차 + 년지가 실제 삼합 반합일 때만 "네 살 차이는 궁합도 안 본다" 노트, 6살 차 + 실제 충일 때만 "여섯 살 차이" 노트. 띠동갑(12·24·36…년 차)은 "띠가 N 바퀴 돌아 만난 인연"으로. 성인끼리 15년 이상이면 세대 프레임 노트.
- 만 나이(`ageA/ageB`)는 anchorDate 기준으로만 계산 — 실행 시각 불사용(1.3절).

### 3.3 상세 라벨 엮기

- 라벨(예: '엄마와 딸')은 **표시·서사용일 뿐 계산에 쓰지 않는다.** context fact에 그대로 되울려지고(`relationshipLabel`), 첫 노트 문장에 `두 분의 자리를 '엄마와 딸'로 읽었어요.`처럼 엮인다. 조사는 `euRo()`가 마지막 한글 음절의 받침(ㄹ 받침 특례 포함)으로 고른다 — 따옴표가 붙어 있어도 판정된다.
- kids/guardian 프레임 안내 노트가 있으면 라벨 문장을 그 안내의 첫 문장으로 자연스럽게 합치고, 없으면(couple·companion) 라벨 문장을 독립 첫 노트로 세운다.
- 호칭(슬롯 label, 예: '손녀')과 상세 관계 라벨은 다른 것이다. **표시 이름은 항상 본명**이고 호칭은 배지로만 곁들인다 — "손녀님의 일간이…"처럼 호칭이 이름 행세를 하지 않게 한다 (`engine/compatibility.ts`의 `personInput` 주석이 정본).

### 3.4 프리셋 카탈로그 (`model/relationship-catalog.ts`)

- 각 프리셋 = `{ label, category, tone, keywords }`. 현재 29종: romance 6(부부·연인·썸·예비부부·오래된 연인·재혼), family 13(모녀·부자·형제·자매·남매·조손·고부·장서·사촌 등 — care/peer 톤 구분), friendship 6, partnership 5(상사부하·사제·선후배는 hierarchy).
- 검색은 라벨+키워드 부분 일치(공백 제거, 양방향 포함). 직접 입력한 관계는 `guessRelationshipCategory`로 첫 매치 프리셋의 카테고리를 추정하고, 못 찾으면 `unspecified`로 두고 사용자에게 갈래 선택 UI를 보여준다.
- 톤은 프리셋이 정한다 — 직접 입력에는 톤이 없다(정직하게 undefined).

---

## 4. 문장(카피) 번들 시스템

### 4.1 구조: 상황 id × 프레이밍 격자

같은 검출이라도 프레임에 따라 완전히 다른 글이 필요하다 — 단어 치환은 문장을 어색하게 만들 뿐 아니라 돌봄·우정의 자리에 연애의 논리가 새어 들어간다. 그래서:

- **빌더**(`build-couple-compatibility.ts`)는 검출과 점수만 맡는다.
- **카피 번들**(`copy-bundles.ts`)이 문장을 전부 맡는다: 검출 → 번들 선택 → 렌더.

번들 키는 상황 id(`CopySituationIdV1`) 21종:

```
day_stem.{hap|chung|saeng|geuk|bihwa}                          (5)
day_branch.{yukhap|samhap|banghap|mixed|none|chung|wonjin|hyeong|jahyeong|gwimun|hae_pa}  (11)
ten_god.pair                                                    (1)
yongshin.{direct|generates|controls|neutral}                    (4)
```

각 번들(`CopyBundleV1<P>`)은 `{ default, couple?, companion?, guardian?, kids? }`의 writer 묶음. writer는 타입 있는 params를 받아 `{ headline?, paragraphs, tips?, cautions? }`를 돌려주는 **순수 함수**다(실행 시각·난수 금지). params에는 `CopyVoiceV1`(framing + guardian 서사용 elder/younger 표시명)이 항상 실린다.

### 4.2 폴백 규칙

```ts
resolveBundle(situationId, framing) = bundle[framing] ?? bundle.default
```

- 프레임 전용 writer가 없으면 `default`로 내려앉는다. default는 성인 공통 어조로 쓴다.
- headline이 없으면 빌더가 상황별 기본 headline을 공급한다.
- 지지 쌍은 `renderBranchPairCopy`가 합성한다: 관계 0개 → `none` 번들 / 합만 → 최상위 합 하나의 번들 / 합+흉 → `mixed` 번들 / 흉만 → 관계별 writer의 문단을 `fact.relations` 순서대로 **이어 붙인다** (해·파는 `hae_pa` 번들 공유, writer가 `params.relation`으로 자기 담당 관계를 판별).
- 프레임 공통 소재는 표로 공유한다: 천간합 5종의 고전 명칭(중정지합 등), 지지충 6쌍의 결(왕지충·붕충·역마충), 십성 gloss 3벌(성인 관계어/양육어/아이 우정어), 오행 분위기(`describeElementMood`).

### 4.3 새 번들 추가 방법 (경우의 수 확장 가이드)

빌더를 건드리지 않고 `copy-bundles.ts`만 고치는 것이 원칙이다.

1. **기존 상황에 프레임 결 추가**: 해당 번들에 `guardian:`/`kids:` writer만 추가한다. `resolveBundle`이 자동으로 집는다.
2. **새 검출 상황 추가** (예: 지장간 암합): ① `CopySituationParamsMapV1`에 `'situation.id': ParamsType` 추가 → ② params 인터페이스 정의 → ③ `COPY_BUNDLES`에 최소 `default` writer 등록 → ④ 빌더의 해당 축에서 검출 후 `resolveBundle('situation.id', voice.framing)` 호출. 타입 맵 덕에 params 불일치는 컴파일 에러로 잡힌다.
3. **라벨 차원 확장 여지**: 현재 격자는 상황 × 프레이밍(4)이다. 톤(peer/hierarchy/care)이나 상세 라벨(예: '고부' 전용 문장)까지 격자를 넓히려면 `CopyBundleV1`에 키를 더하는 방식보다, **voice에 tone/label을 실어 writer 내부 분기**로 시작하고 (이미 `CopyVoiceV1`가 그 통로다), 분기 수가 커지면 `resolveBundle`의 조회 차원을 늘리는 2단계 확장이 맞다. 톤은 카테고리와 직교하므로 격자를 통째로 곱하면 21 × 4 × 3 = 252칸이 된다 — 폴백(`?? bundle.default`)을 유지해 **채운 칸만 다른 글**이 되게 하는 것이 이 시스템의 핵심 설계다.
4. 한글 조사는 반드시 공용 도우미(`iGa`/`eunNeun`/`gwaWa`/`eulReul`/`euRo`)를 쓴다. 한자·괄호가 뒤에 붙은 표기("경금(庚)")도 마지막 한글 음절 기준으로 판정된다.

---

## 5. FE 구조 (`namespring/src/v3`)

### 5.1 3화면 + 공유 조각

| 경로 | 화면 | 내용 |
|---|---|---|
| `/compatibility` | `CompatibilityScreen` | 슬롯 2개 선택(내 정보/보관함/직접 입력) + 관계 콤보박스 + 통합 요약 + 하이라이트 축(`sections.integrated.axisIds`) + 오행 견주기 + 상세 링크 카드 2장 |
| `/compatibility/name` | `CompatibilityNameScreen` | 이름간 상세 — name 도메인 4축 전부 |
| `/compatibility/saju` | `CompatibilitySajuScreen` | 사주간 상세 — saju 8축 + 여덟 기둥 교차 신호 브라우저 |

상세 화면 2장은 슬롯을 sessionStorage에서 **그대로 이어받고**, 슬롯이 비었거나 같은 사람이면 `/compatibility`로 replace 리다이렉트한다. 같은 사람 검사는 `isSamePerson`(이름+출생 전체 필드 비교).

공유 조각은 `screens/compat/shared.tsx` 한 파일에 모은다: `useCompatibilityResult`(상태 머신 `missing|same|loading|ready|error`), `SummaryCard`, `AxisCard`(unavailable이면 점수 없는 틴트 카드), `ScoreBar`, `PersonEchoCard`, `ContextCard`, `ElementPairCompareSection`, `CrossSignalBrowser`, `SaveCompatStar`, `CompatPremiumSection`, `CompatReportTail`, `GRADE_KO`, `dayBranchSeatLabel`. `PersonSceneryPair.tsx`는 사람별 풍경 그림을 카드 안에 그린다.

### 5.2 저장소 키 전수

| 저장소 | 키 | 내용 | 비고 |
|---|---|---|---|
| sessionStorage | `namespring_v3_compat_a` | 슬롯 A (`CompatSlot` = profile + 호칭) | 출생 정보 포함 — URL 금지 |
| sessionStorage | `namespring_v3_compat_b` | 슬롯 B | 〃 |
| sessionStorage | `namespring_v3_compat_rel` | 관계 선택 (`CompatRelationshipSelection`) | 구버전 평문 카테고리 문자열도 `normalizeRelationshipSelection`으로 승격 |
| localStorage | `namespring_v3_people` | 사람 보관함 (`StoredPerson[]`, 최대 50) | 이름+출생 통째 보관 — 서버·URL 금지 |
| localStorage | `namespring_v3_saved_compat` | 저장된 궁합 (`SavedCompat[]`, 최대 50) | 점수·등급 스냅샷 + 관계 복원. 짝 키는 A↔B 순서 무관(`compatPairKey` 정렬) |
| (참고) sessionStorage | `namespring_v3_profile` | 내 프로필 — 슬롯 A "내 정보 불러오기"의 원천 | 궁합 소유 아님 |
| (참고) localStorage | `namespring_v3_favorites`, `namespring_v3_candidate_override` | 작명 쪽 키 | 궁합 무관, 전수 조사용 기재 |

모든 read는 try/parse/검증 후 실패 시 조용히 null/[]로 — 저장소 손상이 화면을 깨지 않는다.

### 5.3 통합 메뉴와의 대칭 원칙

궁합 화면은 통합 보고서 화면의 패턴을 의도적으로 반복한다:

- `ElementPairCompareSection`은 통합 보고서의 `ElementCompareBars`와 대칭인 비교 막대 (두 사람 모두 원국 여덟 글자라 두 줄 다 전체 폭).
- 꼬리 구조(`CompatPremiumSection` → 저장/PDF/공유 `ReportActions` → 고지 문단)는 통합 보고서 꼬리와 같은 순서 — 세 궁합 화면 모두 동일하게 붙인다.
- `SaveCompatStar`(요약 카드 우상단 별표 토글)는 작명 후보 카드의 보관 패턴과 같다.
- 일지 자리 호칭은 FE에서도 프레임을 따른다: `dayBranchSeatLabel(framing)` — couple이면 '일지(배우자궁)', 그 외 '일지(속마음 자리)'. 엔진 축 라벨과 어긋나지 않게 한 함수로 고정.

---

## 6. 알려진 한계와 다음 일감

1. **지장간 암합(暗合) 미구현.** 현재 지지 쌍 관계는 표면 글자의 합충형해파원진귀문만 본다. 지장간끼리의 암합(예: 자중 계수 ↔ 사중 무토)은 실무에서 "겉으로 안 보이는 인연"으로 읽는 재료인데 검출·카피 모두 없다. 추가 시: `relation-tables.ts`에 지장간 표 + 암합 쌍 조회 → `BranchPairRelationV1`에 관계 추가(또는 별도 fact) → 4.3절 절차로 번들 추가.
2. **월지 보조 신호.** 월지(사회궁·기질의 자리)끼리의 관계는 현재 "여덟 기둥 교차 신호"의 참고 칩으로만 나온다. 실무에서는 동료·가족 궁합에서 월지 비중을 올려 읽기도 하므로, framing별 가중치 분화(예: partnership에서 월지 축 신설)가 다음 후보다. `AXIS_BASE_WEIGHTS`를 framing의 함수로 바꾸면 된다 — provenance 공개 형태도 함께 바꿔야 한다.
3. **라벨·톤 전용 번들 미구현.** tone(peer/hierarchy/care)은 현재 context note 한 줄로만 반영된다. 상세 라벨('고부', '사제') 전용 문장은 없다. 확장 경로는 4.3절 3항.
4. **유료 궁합 리포트 서버 연동.** `CompatPremiumSection`은 `/account?intent=premium`으로 보내는 자리표시자다. 결제·PDF 생성·소유권 바인딩(개인 리포트의 premium ownership 패턴 재사용)이 미연결.
5. **구 빌더 캐시 방어 코드.** `ContextCard`는 `context?.fact` 부재를 조용히 허용한다(병렬 엔진 작업 랜딩 전 과도기 방어). 계약이 안정되면 제거.
6. **성별 중립 궁합의 서사 얕음.** 성별 미제공이면 배우자성 보너스·문장이 빠질 뿐 대체 서사가 없다. `GENDER_NOT_PROVIDED` 사유 코드는 계약에 있으나 현재 축 가용성에 쓰이지 않는다 — limited 표기 또는 중립 서사 보강 여지.
7. **시주 결측 짝의 안내.** `HOUR_PILLAR_MISSING` 코드가 계약에 있으나 현재 시주는 축 점수에 직접 쓰이지 않아(교차 신호에만 등장) 사용자 안내가 없다.
8. **compatCache 메모리 전용.** 새로고침이면 재계산한다. 사람별 delivery 캐시가 무거운 쪽을 감당하므로 수용 가능하지만, 저장된 궁합을 다시 열 때의 체감을 위해 결과 스냅샷 캐시(스키마 버전 키 포함)를 검토할 수 있다.
