# 11. 신살 조건 감쇠와 천덕·월덕 일상견(日上見) 정책

> **문서 지위**: 학파 프리셋 출처 정본(in-repo compilation).
> **검토 상태**: 편찬 초안 — 독립 전문가 검토 대기 (검토 완료 전 이 문서는 교리 '해설'이며 외부 권위 인증이 아님).
> **편찬일**: 2026-07-10 (사주 엔진 무결성 감사 PR #653, P0-4)
> **관련 프리셋**: `sanmingtonghui`, `shinsal.virtueStrict` (src/schools/packs/builtin.pack.json)

## 1. 교리 요약

신살(神煞)은 간지 조합에서 도출되는 길신(吉神)·흉살(凶殺)의 총칭이다. 명리 문헌 전통에서 신살의 위상은 크게 두 갈래다.

1. **고법·삼명(三命) 계열 — 신살을 폭넓게 채용**: 『삼명통회(三命通會)』(萬民英, 明)는 록명신살(祿命神煞) 전통을 집대성하여 천을귀인·천덕·월덕·공망·12신살 등을 방대하게 수록하고, 격국·십성과 병행하여 논한다.
2. **자평(子平) 주류 — 격국 보조로 축소**: 『자평진전(子平真詮)』(沈孝瞻, 淸) 계보는 용신·격국을 본령으로 삼고, 성신(星辰: 신살류)은 격국의 성패를 좌우하지 못한다는 취지로 그 비중을 크게 축소한다(「論星辰無關格局」 편의 논지).

이 두 관점의 차이가 본 엔진에서는 **신살 조건 감쇠(condition attenuation)의 강도 차이**로 구현된다. 기본 프리셋군은 감쇠를 켜서(충·형·해·파·원진·공망을 맞은 신살을 약화) 신살을 '조건부 신호'로 다루고, `sanmingtonghui` 프리셋은 감쇠를 꺼서 신살을 원형 그대로 노출한다.

또한 천덕귀인(天德貴人)·월덕귀인(月德貴人)은 월지(月支) 기준으로 정해지는 대표적 길신인데, "어느 기둥에서 보아야 유효한가"에 대해 엄격설(일간·일지에서 볼 것 — 일상견)과 관대설(사주 어느 기둥이든 가함)이 갈린다. `shinsal.virtueStrict` 프리셋은 엄격설을 채택한다.

## 2. 고전 근거

모든 원전 고전은 저작권이 소멸한 공용 도메인(public domain)이다. 단, 서락오(徐樂吾)·임철초(任鐵樵) 등 현대·근세 평주본(評註本)의 편집·주석 저작권은 별개이므로, 본 문서와 엔진은 평주본의 문장을 전재하지 않고 통설의 취지만 요약한다.

- **신살의 폭넓은 채용**: 『삼명통회(三命通會)』(萬民英, 明)는 천월이덕(天月二德)·귀인·공망 등 신살 각론을 권별로 상세히 수록하며, 신살이 격국·십성 판단과 병행하여 명을 보좌하거나 훼손한다는 취지로 논술한다(신살 각론 諸편). 『연해자평(淵海子平)』(徐大升 편, 南宋 계열)도 신살 가결(歌訣)류를 다수 전한다.
- **신살 축소론**: 『자평진전(子平真詮)』(沈孝瞻, 淸)은 「用神專求月令」의 원칙 아래, 성신(신살)은 격국의 성패에 관여하지 못한다는 취지의 논술을 둔다(「論星辰無關格局」). 『신봉통고(神峰通考)』(張楠, 明) 역시 잡다한 신살론에 비판적 입장을 취한 논술로 알려져 있다.
- **조건 감쇠(충·형·공망)**: 귀인·길신이 형충(刑沖)을 맞으면 그 복력(福力)이 감해지고, 흉살이 합(合)으로 묶이면 흉의가 완화된다는 취지는 『삼명통회』·『연해자평』 계열 신살 각론에 반복적으로 나타나는 통설이다(개별 문구 인용은 판본 차가 커서 패러프레이즈로 한정).
- **공망(空亡)과 해공(解空)**: 공망은 육십갑자 순(旬) 배열에서 일주(日柱)가 속한 순에 들지 못한 두 지지(旬空)로 정의된다. 공망 지지가 합(육합·삼합·방합)을 만나면 공이 풀린다(해공)는 취지의 논술이 고법 계열 문헌에 전승된다. 충을 만나면 오히려 채워진다(逢沖則實)는 이설도 전승되나 판본·유파 간 표현 차가 있어 원문 인용은 유보한다.
- **천덕·월덕과 일상견**: 월덕은 월지 삼합국(三合局)의 왕간(旺干) — 寅午戌월 丙, 申子辰월 壬, 亥卯未월 甲, 巳酉丑월 庚 — 으로 정의되고, 천덕은 월별로 천간 또는 지지가 지정되는 표로 전승된다(청대 관찬 택일서 『협기변방서(協紀辨方書)』에도 동일 계열의 표가 수록). 이덕(二德)의 유효 조건에 대해 「須要日上見」 — 일주(日上)에서 보아야 한다 — 는 구결이 전승되며(『삼명통회』 천월이덕 논술 계열), 이것이 엄격설의 전거다. 반면 실무 통용 관대설은 사주 네 기둥 어디서든 이덕이 나타나면 유효로 본다.

## 3. 엔진 구현 대응

### 3.1 조건 감쇠 모델 (src/rules/shinsal.ts + src/rules/packs/shinsalConditionsBasePack.ts)

- 감쇠 축은 `ShinsalDamageKey` 7종: `CHUNG`(沖)·`HAE`(害)·`PA`(破)·`WONJIN`(怨嗔)·`HYEONG`(刑)·`HAP`(合)·`GONGMANG`(空亡).
- 조건 판정 룰셋은 `src/rules/defaultShinsalConditions.ts`의 `DEFAULT_SHINSAL_CONDITIONS_RULESET`(id: `shinsal.conditions.base`). detection 단위로 평가되어 `cond.penalty.<KEY>` 점수를 방출한다(룰 id: `COND_CHUNG`/`COND_HAE`/`COND_PA`/`COND_WONJIN`/`COND_HYEONG`/`COND_GONGMANG`).
- `src/rules/shinsal.ts`의 `applyQualityModel()`이 penalty 파트를 `combinePenalty()`(`max`/`sum`/`prob`)로 결합해 `conditionPenalty`를 만들고, `qualityWeight = 1 - penalty`로 환산한다. 감쇠 사유는 `qualityReasons`에, 무력화 여부는 `invalidated`(기본 `invalidateThreshold: 0`)에 기록되며, `scoresAdjusted`는 기둥 수 기반 기본 가중 × `qualityWeight`로 집계된다.
- 기본 모델은 `src/rules/packs/shinsalConditionsBasePack.ts`의 `DEFAULT_SHINSAL_QUALITY_MODEL`: 전 축 가중치 0.5, `combine: 'max'`, `weakThreshold: 1`(감쇠가 조금이라도 있으면 `quality: 'WEAK'` 라벨). 관계살(`CHUNG_SAL` 등)·공망 자체는 '조건'으로 쓰이는 살이므로 `excludeNames`와 `categories.RELATION_SAL/VOID.enabled=false`로 감쇠 대상에서 제외된다.
- 설정 키: `strategies.shinsal.conditions.{enabled, combine, weights, weakThreshold, invalidateThreshold, applyToNames, excludeNames}` (`readQualityModelFromConfig()`), 카테고리/이름별 오버라이드는 `categories`/`names`(`resolveQualityModelForDetection()`).

### 3.2 해공(解空) (src/rules/defaultShinsalConditions.ts)

- 룰 `COND_GONGMANG_HAP`: `GONGMANG` detection의 공망 지지가 `chart.relations.hapBranches`(육합·삼합·방합)에 걸리면 `cond.penalty.HAP`을 부여 — 즉 "합을 만난 공망은 공망 효력이 감쇠된다"로 해공 통설을 연속량으로 모델링한다.
- 공망 산출 자체는 일주 기준 순공(`shinsal.gongmang.day`)이며, 룰 `GONGMANG_YEAR/MONTH/HOUR`만 존재한다(일지는 자기 순 안에 있어 일주 기준 공망이 될 수 없음 — src/rules/defaultRuleSets.ts).

### 3.3 천덕·월덕 카탈로그와 일상견 스코프 (src/rules/packs/shinsalBaseCatalog.ts + src/rules/facts.ts)

- 카탈로그 `DEFAULT_SHINSAL_CATALOG`: `monthBranchStem.WOL_DEOK_GUI_IN`(월지 삼합국 → 왕간), `WOL_DEOK_HAP`(월덕의 오합 파트너), `CHEON_DEOK_GUI_IN_STEM`(천간으로 판정되는 8개월), `CHEON_DEOK_HAP`, 그리고 `monthBranchBranch.CHEON_DEOK_GUI_IN_BRANCH`(卯→申, 午→亥, 酉→寅, 子→巳 — 지지로 판정되는 4개월).
- 스코프 정책: `src/rules/facts.ts`의 `parsePillarScope()`/`scopeForMonthBranchStemKey()`/`scopeForMonthBranchBranchKey()`. 설정 키 `strategies.shinsal.monthDeokScope`(별칭 `deokScope`)가 덕 계열 키 집합(`DEOK_MONTH_STEM_KEYS` = WOL_DEOK_GUI_IN·WOL_DEOK_HAP·CHEON_DEOK_GUI_IN_STEM·CHEON_DEOK_HAP, `DEOK_MONTH_BRANCH_KEYS` = CHEON_DEOK_GUI_IN_BRANCH)에 일괄 적용된다. `"dayOnly"`는 `['day']`로 파싱되어 천간부는 일간, 지지부는 일지만 검사한다. 키별 세분 오버라이드는 `strategies.shinsal.catalogScopes.monthBranchStem/<KEY>` 등으로 가능하다. 기본값은 4주 전체 스캔(관대설).
- 감사 A8: 과거 이 스코프 헬퍼가 정의만 되고 미호출이라 `shinsal.virtueStrict`가 완전 no-op이었음이 확인·수정되었다(facts.ts 내 주석으로 기록).

카탈로그에 수록된 월별 표(검토자 전수 대조용 — src/rules/packs/shinsalBaseCatalog.ts 원본과 동일):

| 월지 | 월덕(旺干) | 월덕합 | 천덕 | 천덕합 |
|---|---|---|---|---|
| 寅 | 丙 | 辛 | 丁 | 壬 |
| 卯 | 甲 | 己 | 申(지지) | — |
| 辰 | 壬 | 丁 | 壬 | 丁 |
| 巳 | 庚 | 乙 | 辛 | 丙 |
| 午 | 丙 | 辛 | 亥(지지) | — |
| 未 | 甲 | 己 | 甲 | 己 |
| 申 | 壬 | 丁 | 癸 | 戊 |
| 酉 | 庚 | 乙 | 寅(지지) | — |
| 戌 | 丙 | 辛 | 丙 | 辛 |
| 亥 | 甲 | 己 | 乙 | 庚 |
| 子 | 壬 | 丁 | 巳(지지) | — |
| 丑 | 庚 | 乙 | 庚 | 乙 |

천덕이 지지로 판정되는 4개월(卯·午·酉·子 — 사왕지월)은 카탈로그상 천덕합 항목이 없다(합은 천간오합 개념이므로 지지 천덕에는 정의되지 않음). 이 비대칭 자체가 검토 대상이다(5절 체크리스트).

### 3.4 12신살 기준지 병용 (src/rules/defaultRuleSets.ts + src/rules/facts.ts)

- 12신살은 `shinsal.twelveSal.year.<KEY>`(년지 앵커)와 `shinsal.twelveSal.day.<KEY>`(일지 앵커)로 이중 산출되고, 룰 `<KEY>_FROM_YEAR`/`<KEY>_FROM_DAY`가 각각 detection을 방출한다(`basedOn: 'YEAR_BRANCH' | 'DAY_BRANCH'`).
- 병용의 의미는 "어느 기준으로든 성립"이지 "두 배 강함"이 아니므로, `applyQualityModel()`은 동일 (name, target) 조합의 점수를 1회만 계상한다(감사 A10 — `scoreSeen` 중복 제거). detection 자체는 양 앵커 표시를 위해 모두 남는다.

### 3.5 진단 추적(감쇠 근거의 감사 가능성) (src/rules/shinsal.ts)

- `computeShinsal()` 결과의 `rules.conditions[]`에 detection별 감쇠 추적이 남는다: `penaltyParts`(축별 페널티), `combinedPenalty`, `qualityWeight`, `qualityReasons`, `invalidated`, 조건 룰 `matches`. 상용 리포트에서 "이 신살이 왜 약화되었는가"는 이 추적으로 소명한다.
- 룰셋 자체를 유파별로 교체하려면 `config.extensions.rulesets.shinsalConditions`(완성 룰셋) 또는 `config.extensions.ruleSpecs.shinsalConditions`(스펙 → `compileShinsalConditionsRuleSpec()` 컴파일)를 사용한다(`buildPolicy()`).

### 3.6 프리셋 오버레이 (src/schools/packs/builtin.pack.json)

- `sanmingtonghui`: `strategies.shinsal.conditions.enabled = false` — 조건 감쇠 전체 비활성(신살 원형 노출, 삼명통회식 폭넓은 채용) + 격국·십성 병행(`yongshin.ziping.roleBoost`, `gyeokguk.ziping.monthGyeokTenGod` 포함). 감사 A7: 과거 이 플래그가 detection 단위 해석기 미호출로 무효였던 결함이 수정되었다(shinsal.ts 내 주석으로 기록).
- `shinsal.virtueStrict`: `strategies.shinsal.monthDeokScope = "dayOnly"` — 이덕(및 합) 계열의 일상견 엄격설 채택.

## 4. 학파 이설과 프리셋 선택지

| 쟁점 | 이설 A | 이설 B | 엔진 선택지 |
|---|---|---|---|
| 신살의 위상 | 삼명 고법: 폭넓게 채용(『삼명통회』) | 자평 주류: 격국 보조로 축소(『자평진전』) | 기본: 감쇠 on / `sanmingtonghui`: 감쇠 off |
| 이덕 유효 범위 | 엄격: 일간·일지에서 볼 것(須要日上見) | 관대: 4주 어디든 | 기본: 전주 스캔 / `shinsal.virtueStrict`: `dayOnly` |
| 12신살 기준지 | 년지 기준(고법 주류) | 일지 기준(현대 실무 병용) | 양 앵커 병용 방출 + 점수 1회 계상 |
| 해공 | 합이면 공이 풀림 | 충이면 채워짐(逢沖則實) 등 이설 | 합 기반 감쇠만 구현(`COND_GONGMANG_HAP`), 충 해공은 미구현 |
| 감쇠 결합 | (고전에 수량 규칙 없음) | — | `combine: max/sum/prob` 3종 노출, 가중치 per-key 조절 |

프리셋은 이설 중 하나를 '채택'하는 선언이지, 이설 간 우열의 판정이 아니다. 상용 리포트에서 프리셋 간 결과 차이는 이 표의 쟁점 차이로 설명되어야 한다.

## 5. 한계와 검토 항목

이 문서는 엔진 저장소 내부에서 편찬되었으며 외부 학회·독립 전문가의 승인을 받지 않았다. 독립 검토자는 최소 다음을 확인해야 한다.

- [ ] 「須要日上見」 구결의 정확한 서지(『삼명통회』 천월이덕 논술의 권·편, 판본별 자구) 확정. 본 문서는 편 단위 특정을 유보했다.
- [ ] `CHEON_DEOK_GUI_IN_STEM/BRANCH`의 월별 천간/지지 혼합표가 통용 구결(正丁二申 계열)과 일치하는지 12개월 전수 대조.
- [ ] `WOL_DEOK_HAP`·`CHEON_DEOK_HAP`(오합 파트너)까지 `monthDeokScope`를 일괄 적용하는 것이 엄격설의 원의에 부합하는지 — 고전 구결은 이덕 본체 중심이며, 합신(合神)의 유효 범위는 별도 논의가 필요하다.
- [ ] 감쇠 가중치 전 축 0.5, `combine: 'max'` 기본값의 자의성 — 고전은 감쇠를 정성적으로만 서술하므로 수치는 엔진의 모델링 선택이다. 실측 코퍼스 기반 보정 필요.
- [ ] 해공을 'GONGMANG detection의 HAP 페널티'로 표현한 방향성 검토 — 통설의 "공이 풀리면 해당 지지가 정상 기능"까지는 모델링되지 않는다(공망 감쇠 축 `GONGMANG`과의 상호작용 포함).
- [ ] 충 해공(逢沖則實)·년주 기준 공망(감사 B13) 등 미구현 이설의 채택 여부 결정.
- [ ] `excludeNames`·`categories.RELATION_SAL/VOID` 제외 목록이 관계살을 이중 계상(살이자 감쇠 조건)하지 않는다는 설계 의도대로 작동하는지 회귀 테스트로 확인.
- [ ] 12신살 년·일 병용 시 detection 이중 표시가 사용자 화면에서 "두 개의 살"로 오독되지 않는지 표시 계층 점검.
- [ ] 인용·전거의 공용 도메인 표기와 현대 평주본(서락오 評註 등) 저작권 분리 원칙이 파생 문서에서도 유지되는지.
