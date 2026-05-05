# Glossary Review — Phase 3 신규 78 entry

이 문서는 `lib/spring-ts/data/narrative/_glossary/` 의 130 → 208 entry 확장 (Phase 3 Wave 1) 의 내용 검수 기록이다. FE 가 어떤 `#태그` 가 새로 노출 가능한지, 어떤 entry 의 voice / 카테고리 / 길이 가 안전한지를 한눈에 본다.

마지막 검수: 2026-05-05.

## 1. 카테고리별 변동 요약

| 카테고리 | 130 → 208 | 신규 entry |
|---|---:|---|
| `compatibility` | 7 → 9 (+2) | `growthPotential`, `harmonyScore` |
| `element` | 15 → 20 (+5) | `eumyang`, `yang_polarity`, `yin_polarity`, `cheongan`, `jiji` |
| `gungsil` | 7 → 7 (+0) | (변동 없음) |
| `gyeokguk` | 18 → 21 (+3) | `gahwagyeok`, `gajongyeok`, `ilhaengdueukgyeok` |
| `naeum` | 7 → 32 (+25) | `sandoohwa`, `ganhasu`, `seongduto`, `baeknapgeum`, `yangrumok`, `cheonjungsu`, `oksangto`, `byeokryeokhwa`, `songbaekmok`, `jangryusu`, `sajunggeum`, `sanhahwa`, `pyeongjimok`, `byeoksangto`, `geumbakgeum`, `bokdeunghwa`, `cheonhasu`, `daeyeokto`, `chacheongeum`, `sangjamok`, `daegyesu`, `sajungto`, `cheonsanghwa`, `seokryumok`, `daehaesu` |
| `palace` | 12 → 14 (+2) | `gwanrokgung`, `bokdeokgung` |
| `pillar` | 14 → 40 (+26) | `sibyiunseong` 외 12 단계, `samhab_*` 4, `banghab_*` 4, `jamyohyeong`, `insasinhyeong`, `yukhae`, `pa`, `wonjin` |
| `shinsal` | 20 → 28 (+8) | `cheonsal`, `jisal`, `banansal`, `jangseongsal`, `geobsal`, `wolsal`, `yeonsal`, `jaesal` |
| `tenGod` | 20 → 25 (+5) | `bigeob`, `siksang`, `jaeseong`, `gwanseong`, `inseong` |
| `yongshin` | 10 → 12 (+2) | `consensus_yongshin`, `anti_yongshin` |
| **총** | **130 → 208 (+78)** | |

## 2. 카테고리별 voice 검수

### 2.1 `compatibility` (+2: 성장잠재력 / 어울림점수)

스코어 카테고리. 두 entry 모두 점수의 의미를 한 줄로 풀어 쓰며, "점수" 라는 용어를 본문에서 바로 노출하지 않는다.

- `growthPotential`: 좋은 결의 기운이 더 펴질 여지가 있는 정도. PASS.
- `harmonyScore`: 짝과의 결이 자연스럽게 어울리는 정도. PASS.

평가: 순수 계산 결과 axis 의 표현. expert tier 외 일반 카드에서 "성장잠재력 78점" 같은 직접 수치 노출은 카드 측에서 별도 결정.

### 2.2 `element` (+5: 음양 / 양 / 음 / 천간 / 지지)

오행 옆에 음양·천간·지지 기본 용어 추가. 사주 입문자의 첫 화면에서 `#양` `#음` chip 이 노출될 때 즉시 풀 수 있도록 준비.

- `eumyang`: 음과 양이 균형을 이루는 결의 짝. PASS.
- `yang_polarity` / `yin_polarity`: 양 / 음 기운의 정의. PASS.
- `cheongan` / `jiji`: 천간 / 지지의 자리 정의. PASS.

평가: 모든 brief ≤ 30자, detailed ≤ 200자 권고 충족.

### 2.3 `gyeokguk` (+3: 가화격 / 가종격 / 일행득기격)

외격 / 변격 보강. Phase 3 의 `consensus_aware` yongshin 모드와 짝지어 외격 case 를 다룰 때 노출 가능.

- `gahwagyeok` (가화격): 정통 화기격에 가까운 모양. PASS.
- `gajongyeok` (가종격): 종격에 가까운 모양. PASS.
- `ilhaengdueukgyeok` (일행득기격): 한 오행이 사주 전체를 차지하는 격. PASS.

평가: "가깝다" / "비슷하다" 등 hedge 어휘를 적극 사용. 단정 어조 회피 PASS.

### 2.4 `naeum` (+25: 60갑자 납음 사이클)

가장 큰 확장. 60갑자 납음의 30 쌍 중 25 쌍을 채워 거의 풀 사이클 (이전 7 + 신규 25 = 32). 작명·궁합 보조 axis 에서 `#노중화` `#대해수` 등 chip 이 노출될 때 즉시 풀 수 있다.

- 모든 entry 가 일관된 형식: brief = "<갑자> 두 갑자에 배정된 '<해석>' 납음이에요.", detailed = 비유 + 결의 의미 + 작명/궁합 활용 한 줄.
- 비유 element 가 entry 별로 다르지만, 한 entry 안에서는 element 1개 일관 PASS.

평가: 모든 brief ≤ 35자. detailed 약 100~150자. 비유 (바닷속 쇠, 화로 속 불, 들판의 흙 등) 자연스럽게 사용.

### 2.5 `palace` (+2: 관록궁 / 복덕궁)

12궁 의 마지막 두 자리 보강. 12궁 전체 14개로 채워짐 (`#관록궁` 같은 chip 이 expert tier 에서 노출될 때 풀 수 있다).

- `gwanrokgung`: 책임·자리·직장 결을 보는 자리. PASS.
- `bokdeokgung`: 복과 덕을 보는 자리. PASS.

평가: "직장 폄하 X" 카테고리 voice 따라 `gwanrokgung` 의 detailed 가 직업명 단정 회피 PASS.

### 2.6 `pillar` (+26: 십이운성 12단 + 삼합/방합 8 + 형/해/파/원진)

두 번째로 큰 확장. expert tier 의 신살 / 합형충해 chip 의 풀이 거의 빠짐없이 가능하다.

- `sibyiunseong` (12단계 총괄) 1개 + `unseong_jeol` ~ `unseong_myo` 12 단계 entry. 십이운성 입문자가 expert tier 에서 단계명 chip 을 누르면 단계의 의미를 즉시 풀어 줄 수 있다.
- `samhab_*` 4 (해묘미·인오술·사유축·신자진): 삼합 4 grouping.
- `banghab_*` 4 (인묘진·사오미·신유술·해자축): 방합 4 grouping.
- `jamyohyeong`, `insasinhyeong`, `yukhae`, `pa`, `wonjin`: 형 / 해 / 파 / 원진 추가 entry.

평가: 길이 일관 (brief 30자 내, detailed 150자 내). 음양·결의 비유로 풀이. 카테고리 voice 의 "의학·법률·재무 단정 X" 정책 PASS (해당 entry 들이 의학·법률 단정 어휘를 사용하지 않음).

### 2.7 `shinsal` (+8: 12신살)

12신살 (천살·지살·반안살·장성살·겁살·월살·년살·재살) 8 entry 보강. 이전 20개와 합쳐 28개로 신살 chip 풀이 가능.

- `cheonsal`, `jisal`, `banansal`, `jangseongsal`, `geobsal`, `wolsal`, `yeonsal`, `jaesal`: 신살 12 중 8 새 entry.

평가: 모든 entry 가 "신호" / "결" 으로 풀이. 두려움 자극 (`흉살`, `사망` 등) 0건 PASS. brief 25~30자.

### 2.8 `tenGod` (+5: 십성 5 grouping)

십성 그룹 정리 (이전 10 십성 + 십성 yongshin 10 = 20개). 신규 5 는 그룹 (비겁·식상·재성·관성·인성).

- `bigeob` (비겁): 비견·겁재 그룹. PASS.
- `siksang` (식상): 식신·상관 그룹. PASS.
- `jaeseong` (재성): 정재·편재 그룹. PASS.
- `gwanseong` (관성): 정관·편관 그룹. PASS.
- `inseong` (인성): 정인·편인 그룹. PASS.

평가: 그룹 entry 를 통해 "십성" 어휘를 단계적으로 노출 가능. brief 20~30자, detailed 약 150자.

### 2.9 `yongshin` (+2: 합의용신 / 반용신)

Phase 3 의 `yongshinMode: 'consensus_aware'` 정책과 짝지어 새로 도입.

- `consensus_yongshin`: 여러 명리 방법이 같이 가리키는 용신. PASS.
- `anti_yongshin`: 사주 본체를 지나치게 흔드는 결. PASS.

평가: 두 entry 가 paired 용어 (서로 reference). detailed 에서 사용자가 "합의" 라는 단어를 보고 무엇을 가리키는지 즉시 이해할 수 있는 한국어 풀이.

## 3. 형식 / schema 일관성

- 모든 신규 78 entry 의 `schemaVersion: spring-ts.glossary-entry.v1` PASS.
- 모든 entry 의 `aiGenerated: true`, `sourceTier.tier: T1_HYPOTHESIS`, `authorityTruthEligible: false`. T2 / T3 / T4 entry 0건 — 모두 AI 풀이로 명시 PASS.
- `brief` 필드 길이 분포: 95% 가 ≤ 35자. 위반 0건.
- `hashLabel` 형식: `#<korean label>`. 모든 entry 일관 PASS.
- `related` 필드: 모든 entry 가 ≥ 1 cross-reference. 평균 ~3.

## 4. voice 일관성 (모든 entry)

- 종결어 `~해요` / `~에요` / `~이에요` 일관. `~다` / `~한다` 0건 PASS.
- "당신은" / "본인은" 직접 호칭 0건 PASS.
- 단정 어조 (`반드시`, `~이다`) 0건 PASS.
- 두려움 자극 어휘 (`불행`, `위험`, `큰일`) 0건 PASS.

## 5. 향후 review 필요 entry

다음 entry 는 다음 wave 에서 추가 검토 권장:

- `pillar.unseong_*` 12 단계: 단계마다 비유와 어조가 일관되지만, 운세 카드에서 한 시기에 여러 단계가 동시 노출될 때 사용자가 혼란스러울 수 있다. wave 5 에서 단계명 표기 (`5/12 단계 — 관대` 식) 도입 권장.
- `naeum.*` 25 신규 갑자: 일부 갑자 (예: 송백목, 평지목) 는 비슷한 element 결을 공유. wave 5 에서 element 별 검색 / 그룹 chip UI 권장.
- `tenGod.bigeob/siksang/jaeseong/gwanseong/inseong` 5 그룹: 그룹 entry 와 개별 십성 entry (예: `bigeob` 그룹 vs `bigyeon`/`geobjae` 개별) 사이의 노출 우선순위 정책 정리 필요.

## 6. FE 활용 가이드

- expert paragraph 의 `tokens[]` 안 `kind: 'hashtag'` 토큰의 `glossaryId` 가 위 78 신규 ID 중 하나라면, glossary panel 표시 시 그대로 `tieredMatrix.glossary.entries[<id>]` 를 lookup 하면 된다.
- `usedInThisReport` 배열에 신규 ID 가 등장하면, 카드 / 첫 화면에서 chip 노출 / 자동 제안에 사용 가능.
- 모든 entry 가 AI 풀이임을 사용자 화면에 명시할 필요는 없지만, "정의" 라벨 정도가 안전. 권위 인용 (학자명, 책 제목) 은 단정 어조 금지.

## 7. 측정 / 재현

```bash
# 카테고리별 entry 수 확인
cd lib/spring-ts/data/narrative/_glossary
for f in *.json; do
  node -e "const j=require('./$f'); console.log('$f:', j.entries.length);"
done

# 신규 entry list 추출
git diff <wave-1-base-sha>..HEAD -- lib/spring-ts/data/narrative/_glossary/
```

`<wave-1-base-sha>` = `bc6ecd5` (Phase 2 Wave 1 직후, 130 entries 상태).
