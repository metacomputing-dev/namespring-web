# 27. 종격(從格) 조건 팩과 승격 게이트

> **문서 지위**: 학파 프리셋 출처 정본(in-repo compilation).
> **검토 상태**: 편찬 초안 — 독립 전문가 검토 대기 (검토 완료 전 이 문서는 교리 '해설'이며 외부 권위 인증이 아님).
> **편찬일**: 2026-07-10 (사주 엔진 무결성 감사 PR #653, P0-4)
> **관련 프리셋**: `follow`, `ditiansui`, `jonggyeok.calibrated` (src/schools/packs/builtin.pack.json)

## 1. 교리 요약

종격(從格)은 일간(日干)이 자립할 근거를 완전히 잃었을 때, 억부(扶抑)의 원칙을 버리고
명국(命局)을 지배하는 일방(一方)의 세력을 "따르는(從)" 특수 격국 체계다. 일반격이
"약하면 돕고 강하면 눌러라"를 전제한다면, 종격은 "도울 수 없을 만큼 약하면(또는 누를 수
없을 만큼 강하면) 그 흐름 자체를 용신으로 삼아라"라는 예외 규칙이다.

전통적 분류는 따르는 대상에 따라 나뉜다.

- **종재(從財)**: 재성(財星) 일색을 따름.
- **종관살(從官殺)**: 관성(官星)·칠살(七殺) 일색을 따름 — 기명종살(棄命從殺) 계보.
- **종아(從兒)**: 식상(食傷) 일색을 따름.
- **종세(從勢)**: 재·관·식상이 함께 왕하고 일간이 무근일 때 가장 왕한 세(勢)를 따름.
- **종왕(從旺)**: 비겁(比劫) 극왕 — 일간 자체 오행의 세력을 따름.
- **종강(從強)**: 인성(印星)·비겁이 함께 극왕한 국을 따름.

성립의 핵심 조건은 세 가지로 요약된다: ① 일간 무근(통근 부재 — 지지에 뿌리가 없음),
② 인성·비겁의 생조(生助)가 무력하거나 부재, ③ 따를 대상 세력의 일방적 극왕과 국(局)의
순수성(혼잡·파극 없음). 이 조건이 온전하면 진종(眞從), 미세한 뿌리나 생조가 남아
불완전하면 가종(假從)으로 구분한다.

## 2. 고전 근거

*(아래 고전 원전은 모두 저작권 소멸(공용 도메인)이다. 단, 서락오·원수산 등 현대
평주(評註)·역주본의 주석 텍스트는 별도 저작권이 살아 있을 수 있으므로 인용 시 주의한다.)*

- **『적천수(滴天髓)』** (원문 전승 이설 — 京圖 찬 전승·劉伯溫 주 전승; 임철초(任鐵樵)
  增註 『적천수천미(滴天髓闡微)』가 통용): 종격 교리의 정면 전거. 종상(從象) 편의
  「從得眞者只論從，從神又有吉和凶」 — "종이 참되면 오직 종으로만 논하되, 종신에도
  길흉이 있다" — 이 본 체계의 총강이다. 순국(順局) 편은 종아(從兒)를 다루며, 기세가
  한쪽으로 순류(順流)할 때는 거스르지 말고 따라야 한다는 취지의 논술을 편다.
- **『적천수천미(滴天髓闡微)』** (任鐵樵 增註, 淸): 가종(假從) 개념의 확장 전거.
  진종은 드물고 가종이라도 운이 도우면 발신(發身)할 수 있다는 취지의 논술(假從 편)로,
  종격을 이분법이 아닌 "순도(純度)의 연속선"으로 본다. 또한 종왕·종강·종기(從氣)·
  종세(從勢)의 세분이 이 계열에서 정리된다.
- **『자평진전(子平真詮)』** (沈孝瞻, 淸): 월령 정격(正格)을 본령으로 삼는 학파의
  관점. 기명종재(棄命從財)·기명종살(棄命從殺)을 잡격(雜格)의 일부로 협소하게
  인정한다는 취지의 논술(論雜格 계열 편). 종격을 예외 중의 예외로 다루는 보수적 태도의
  전거다.
- **『연해자평(淵海子平)』** (徐大升 편, 南宋 계열): 기명종살·기명종재 격의 이른
  형태가 수록되어 있다는 취지의 격국 항목들. "명(命)을 버리고 따른다(棄命)"는 명명
  자체가 일간 자립 포기라는 교리의 오래된 뿌리임을 보여준다.
- **『삼명통회(三命通會)』** (萬民英, 明): 기명종재격·기명종살격 항목에서 성립 조건
  (일간 무근·세력 극왕)과 파격 조건을 정리한 취지의 논술. 명대 종합서로서 여러 이설을
  병렬 수록한다.
- **『신봉통고(神峰通考)』** (張楠, 明): 병약(病藥)론의 관점에서 뿌리 없는 일간과
  왕세(旺勢)의 관계를 다룬 취지의 논술이 참조점이 된다.

## 3. 엔진 구현 대응

*(아래 경로·키·수치는 모두 2026-07-10 시점 저장소 실물에서 확인한 것이다.)*

### 3.1 potential 램프 — `src/rules/followPotential.ts`

`computeFollowPotential()`은 종격 신호의 원천이 되는 순수 함수다. 신약(PRESSURE) 측은

```
weakFactor           = clamp01((weakThreshold − strengthIndex) / (weakThreshold + 1))
weakDominanceFactor  = clamp01((pressure/support − minDominanceRatio) / minDominanceRatio)
weakPotential        = clamp01(weakFactor × weakDominanceFactor)
```

신강(SUPPORT) 측은 `(strengthIndex − strongThreshold) / (1 − strongThreshold)`와
`support/pressure` 비율로 대칭 계산하며, 큰 쪽이 `potential`과 `mode`
(`'PRESSURE' | 'SUPPORT' | 'NONE'`)가 된다. 이 함수는 facts 경로
(`src/rules/facts.ts`의 `applyFollowPattern()`, 1158행 부근)와 yongshin 폴백 경로
(`src/rules/yongshin.ts` 778행 부근) **양쪽에서 공유**된다 — 두 판정 경로의 수식
표류를 막기 위한 단일화다(파일 상단 주석 참조).

### 3.2 조건 팩과 followType — `src/rules/facts.ts` `applyFollowPattern()`

- 활성 키: `strategies.patterns.follow.enabled = true` (기본 비활성).
  임계 기본값: `weakThreshold = −0.78`, `strongThreshold = |weakThreshold|`,
  `minDominanceRatio = 2.2`.
- 정밀 조건 팩(`patterns.follow.jonggyeok.enabled`): share/season/root/purity/quality/
  noCounter/lowOpp 7신호 가중합(가중치 정규화)에 파극 페널티(broken 0.25, mixed 0.1,
  zhuo 0.08)를 적용해 `jonggyeokConditionFactor`를 만들고, 최종
  `jonggyeokFactor = potential × jonggyeokConditionFactor`를 산출한다. 이는 고전의
  성립 조건(무근·순수성·반대 세력 부재)의 연속값 번역이다.
- `followType` 분류: 지배 role에 따라 `CONG_CAI`(재) / `CONG_ER`(식상) /
  `CONG_YIN`(인) / `CONG_BI`(비겁), OFFICER는 십성 우세에 따라 `CONG_SHA`(편관) /
  `CONG_GUAN`(정관)으로 세분(1478~1487행). **從勢에 해당하는 별도 서브타입은 아직
  없다**(§5 참조).
- typeAware 감쇠(`patterns.follow.jonggyeok.typeAware.enabled`): 관살혼잡 등 십성
  혼잡(subtypeConfidence, 기본 임계 0.25)과 직접 반대 십성 — 예: 종재에 비견·겁재,
  종관에 상관(가중 1.0)·식신(0.6) — 의 점유율(기본 임계 0.12)로 factor를 추가
  감쇠한다. 가종의 "불순물" 판정에 해당하는 기제다.

### 3.3 승격 게이트 — `src/rules/defaultRuleSets.ts` `CONG_*` 룰

`GYEOK_CONG_GE`와 세분 룰(`GYEOK_CONG_CAI`·`GYEOK_CONG_GUAN`·`GYEOK_CONG_SHA`·
`GYEOK_CONG_ER`·`GYEOK_CONG_YIN`·`GYEOK_CONG_BI`)은 모두
`patterns.follow.jonggyeokFactor >= 0.6`을 발화 조건으로 하고, 점수는
`jonggyeokFactor × 0.85`를 해당 `gyeokguk.CONG_*` 키에 가산한다. 즉 **0.6이 격국
후보 승격의 게이트**다.

### 3.4 증거 전용 후보 — `src/rules/gyeokguk.ts`

- `readFollowSignal()`: `jonggyeokFactor → potential → potentialRaw` 폴백 체인(445행
  부근)으로 특수격 경쟁(competition)의 follow 신호를 읽는다.
- `buildJonggyeokCandidates()`(559행~): 8서브타입(`cong_cai`…`cong_bi`,
  `zhuan_wang`, `hua_qi`)별 연속 점수를 계산해 `jonggyeokCandidates`로 노출한다.
  상태 임계는 `statusFromScore()`(551행): **candidate ≥ 0.68, possible ≥ 0.28,
  blocked = 차단 사유 존재 ∧ 점수 ≥ 0.18**, 그 외 none. 차단 사유 예:
  `day_master_support_too_visible`(supportShare ≥ 0.52),
  `opposing_pressure_too_visible`(pressureShare ≥ 0.58). 타입 주석이 명시하듯 이
  배열은 "Evidence-only … never promotes the selected gyeokguk" — **판정을 바꾸지
  않는 근거 표면**이다.

### 3.5 프리셋 배선 — `src/schools/packs/builtin.pack.json`

| 프리셋 | 핵심 overlay |
|---|---|
| `follow` | `patterns.follow.enabled` + `jonggyeok.typeAware` on, `yongshin.weights.follow = 1.2`, `yongshin.follow.weakThreshold = −0.78`, `minDominanceRatio = 2.2`; ruleSpecBlock `yongshin.follow.jonggyeok`(macro `followJonggyeok`, minFactor 0.55 · bonus 1.25 — `src/rules/spec/compileYongshinSpec.ts` 337행) include |
| `ditiansui` | 억부·조후·통관·종세 병용: `weights.follow = 1.0`, `methodSelector.follow.threshold = 0.55`, weak/strong 임계는 follow와 동일 |
| `jonggyeok.calibrated` | `extends: "follow"` + `yongshin.follow.weakThreshold = −0.55`, `strongThreshold = 0.55` — **임계 재보정 실험 프로필**(§5) |

## 4. 학파 이설과 프리셋 선택지

- **자평진전 계열(보수)**: 용신은 월령에서 구하는 것이 본령이고 종격은 잡격의 좁은
  예외다. 엔진의 `ziping.strict`/`zipingzhenquan` 프리셋은 종격을 켜되
  `gyeokguk.competition`(power 2.3)으로 특수 프레임을 구조적으로 약화시켜 이 태도를
  재현한다.
- **적천수 계열(적극)**: 기세의 순역(順逆)을 정면으로 논하며 종상·순국을 독립 교리로
  인정한다. `ditiansui` 프리셋이 이 태도이며, `follow` 프리셋은 그중 종격 축만 분리한
  실험 프로필이다.
- **가종 인정 범위**: 진종만 인정하는 엄격론과, 임철초를 따라 가종까지 등급으로
  포섭하는 관용론이 갈린다. 엔진은 연속값(`jonggyeokFactor`)과 typeAware 감쇠로
  관용론의 구조를 갖추되, 게이트 0.6 미달분을 격국으로 승격하지 않음으로써 실질
  판정은 엄격론에 가깝게 묶여 있다.
- **從勢·從氣의 지위**: 세분 인정 여부 자체가 이설이 있다. 엔진은 종세 전용
  서브타입이 없어 현재는 지배 role 하나로 근사한다(로드맵 PR-11-c에서
  `followTenGodSplit` 기반 확장 예정).

## 5. 한계와 검토 항목

이 문서는 엔진 저장소 내부에서 편찬되었으며 외부 학회·독립 전문가의 승인을 받지 않았다.

**정직한 구현 현황 기록** — 이 절이 이 문서의 핵심이다.

1. **승격 게이트 실측 미달(PR-7, 2026-07-08)**: potential 램프가 threshold→−1 구간
   정규화 구조라, 극단 교리 명식(strengthIndex ≈ −0.63)도 calibrated 임계
   (−0.55)에서 `weakFactor ≈ 0.08/0.45 ≈ 0.18`, 최종 factor ~0.19에 머문다.
   factor 0.6에 도달하려면 s ≤ −0.82가 필요한데 실측 s 분포는 그 아래로 거의
   내려가지 않는다. 따라서 **현행 기본/calibrated 어느 쪽에서도 `CONG_*` 게이트
   (0.6)는 사실상 발화하지 않으며**, 종격은 리스크 신호+확신 감쇠(PR-3 ③, 커밋
   416c0d845)와 evidence-only 후보로만 표면화된다. `jonggyeok.calibrated`는 이
   재보정을 위한 **실험 프로필이지 승격 완료가 아니다**.
2. **승격 보류 조건**: 완전 승격(램프 재설계 또는 게이트 인하)은 birth-time 권위
   코퍼스 `engineComparable ≥ 20` 확보가 선행이다. 현재 코퍼스
   (`lib/spring-ts/test/fixtures/jonggyeok_authority_cases.json`)는 20건 전부
   pillar-only(`birth: null`, T3 tier)라 게이트 유예 중이다.
3. **미결 정책 D6**: 假從을 엔진이 `CONG_*`로 판정할 것인지 — 즉 가종 케이스를 승격
   게이트의 분모에 산입할지 — 가 미결이다(ROADMAP_SAJU_ENGINE.md §8 D6, GUIDE §0.3).
   이 결정 전에는 코퍼스 매치율의 분모 자체가 정의되지 않는다.
4. **수식 동기화 주의**: 램프는 `followPotential.ts`로 단일화됐으나 소비 지점이
   facts 경로와 yongshin 폴백 경로 두 곳이다. 램프 변경 시 두 경로의 파급을 함께
   계측해야 한다(감사 정정 ①).

**독립 검토자 체크리스트**:

- [ ] §2의 원문 인용 1건(從象)과 패러프레이즈 전거들을 통용 판본(『적천수천미』,
      『자평진전』 論雜格 계열, 『삼명통회』 기명종재/종살 항목)과 대조.
- [ ] 종세(從勢) 서브타입 부재가 프리셋 이름(`ditiansui`의 "從勢" 표기)과 오해를
      낳지 않는지 — 사용자 노출 문구 점검.
- [ ] 조건 팩 7신호·가중치·페널티가 고전 성립 조건(무근·순수·무반대)의 번역으로
      타당한지, 임계 기본값(share 0.28, counter 0.18 등)의 근거 유무.
- [ ] statusFromScore 임계(0.68/0.28/0.18)와 CONG 게이트(0.6)의 정합성 —
      candidate(0.68)가 게이트(0.6)보다 높은 비대칭의 의도 확인.
- [ ] D6 결정 및 birth-time 코퍼스 확보 후, 이 문서 §5의 "승격 보류" 서술 갱신.
