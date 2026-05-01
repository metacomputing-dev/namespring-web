# Frontend Extension Surface (spring-ts → NameSpring)

> 작성: 2026-05-01 (Q-batch closure)
> 목적: NameSpring 개발자와의 협업 시 spring-ts 가 노출하는 **opt-in 확장
> surface** 와 **default 동작 변경 history** 를 한 눈에 파악할 수 있게 한다.
>
> NameSpring 의 코드 변경 없이도 spring-ts 의 default flip 만으로 표면화되는
> 데이터가 늘어났으므로, FE 측에서 새 surface 를 활용할지/그대로 둘지를
> 결정할 수 있다.

---

## 1. 호환성 보증 (현재)

`test/integration/namespring-compat.test.ts` 가 NameSpring 의 실제 사용
패턴을 그대로 simulate 하여 backward-compat 을 검증한다 (123/123 PASS).

### 1.1 NameSpring 이 의존하는 fields (전부 보존됨)

| 영역 | field | 사용처 |
| --- | --- | --- |
| SpringReport | `namingReport.name.{fullHangul, fullHanja, rank}` | NamingCandidatesPage |
| FortuneReport | `overviewSummary, lifeFortuneOverview, personality, strengthsWeaknesses, cautions, dailyFortune, weeklyFortune, monthlyFortune, yearlyFortune, categoryFortunes, nameCompatibility, lifeStageFortune` | CombiedNamingReport |
| CategoryFortuneCard | `title, category, stars, summary, advice[{text, reason}], caution{signal, response, reason}` | CombiedNamingReport |
| SajuReport | `pillars{year, month, day, hour}, dayMaster.polarity` | naming-result-render-metrics |

### 1.2 호환 보증 메커니즘

- **API IMMUTABLE** — `PRINCIPLES_v2.md §1` 에 의해 method signature / type 시그니처는 절대 변경 금지.
- **Optional chaining** — NameSpring 이 모든 access 에 `?.` 를 사용 → unknown field 는 undefined 로 안전 처리.
- **`.filter(Boolean)` patterns** — `categoryCards.map((key) => cards[key]).filter(Boolean)` 류로 missing entry 도 안전.
- **PRINCIPLES_v2.md §2.2 "결과 품질 향상 방향만"** — default flip 은 점수 변화는 있어도 type 변경 없음.

### 1.3 Default 동작 변경 history (NameSpring 이 보는 값에 영향)

다음 default flip 은 NameSpring 이 표시하는 **숫자/텍스트 값** 에 영향을
주지만 type / shape 은 무변경. NameSpring 코드 변경 없이도 정상 동작:

| PR | default 변경 | NameSpring 영향 |
| --- | --- | --- |
| #131 | `unknownHourGuard` false → true | 시간미상 사주의 saju score 약화 (UI 변경 X) |
| #132 | `sajuPriorityCurve` linear → tanh | candidate 순위 약간 변동 (UI 변경 X) |
| #133 | `gyeokgukMode` jonggyeok_only → chengbai_strict | 격국 분류 일부 case 변경 (텍스트 표시 변동) |
| #134 | `yongshinMode` classical_blend → chengbai_strict | 용신 element 일부 case 변경 |
| #135 | `fortuneCascadeMode` simple → jie_based | 월운 정확도 ↑ (UI 변경 X) |
| #136 | `strengthMode` binary → continuous | 신강도 graded 평가 (UI 변경 X) |
| #137 | `tenGodMode` simple_count → positional_weighted | finalScore 변동 0% (declarative, 측정상 영향 X) |
| #139 | `surfaceSubDomains` false → true | **`categoryFortunes[c].subDomains` 가 추가로 노출** (FE 확장 가능 surface — §2 참조) |

---

## 2. Opt-in 확장 surface (FE 협업 후 활용 가능)

NameSpring 이 **현재는 사용하지 않지만** spring-ts 가 default 로 노출하는
field 들. FE 측 추후 확장 시 즉시 사용 가능 — 별도 backend 작업 불필요.

### 2.1 `CategoryFortuneCard.subDomains` (PR #138/#139)

5 base 카테고리 별 1-3 sub-domain row. 사주 feature 기반 conditional 게이트:

```typescript
interface CategoryFortuneSubDomain {
  readonly name: 'wealth' | 'health' | 'academic' | 'romance' | 'family'
              | 'career' | 'study_document' | 'expression_children'
              | 'health_stress' | 'movement';
  readonly title: string;
  readonly stars: 1 | 2 | 3 | 4 | 5;
  readonly narrative: string;
}
```

도메인 매핑 (`saju_master/event_domain_map.py` 표준):
| Base 카테고리 | always sub-row | conditional 추가 |
| --- | --- | --- |
| `wealth` | `career` | `movement` (편재·역마 강할 때) |
| `health` | `health_stress` | `movement` (충해 강할 때) |
| `academic` | `study_document` | `expression_children` (식상 강), `career` (관성 강) |
| `romance` | `expression_children` | — |
| `family` | `expression_children` | — |

**NameSpring 활용 예시** (FE 코드 추가 시):
```jsx
{card?.subDomains?.map((sub) => (
  <SubDomainRow key={sub.name} title={sub.title} stars={sub.stars} text={sub.narrative} />
))}
```

### 2.2 `CategoryFortuneCard.axisStrength` (PR-J-8a)

7-axis judgment-strength tier:

```typescript
interface SajuAxisStrengthMap {
  readonly yongshin?:         'definite' | 'practical' | 'candidate' | 'deferred';
  readonly gyeokguk?:         'definite' | 'practical' | 'candidate' | 'deferred';
  readonly chengbai?:         'definite' | 'practical' | 'candidate' | 'deferred';
  readonly fortuneHierarchy?: 'definite' | 'practical' | 'candidate' | 'deferred';
  readonly strength?:         'definite' | 'practical' | 'candidate' | 'deferred';
  readonly johu?:             'definite' | 'practical' | 'candidate' | 'deferred';
  readonly rectification?:    'definite' | 'practical' | 'candidate' | 'deferred';
}
```

UI 활용: 각 카드의 신뢰도 hedge 표시 ("이 평가는 후보 단계예요" 등).

### 2.3 `CategoryFortuneCard.evidence` (PR-J-8a)

```typescript
interface EvidenceRow {
  readonly axis: string;
  readonly claim: string;
  readonly supportingFeatures: readonly string[];
  readonly weakness?: string;
  readonly strength?: 'definite' | 'practical' | 'candidate' | 'deferred';
}
```

UI 활용: 카드 하단 "이 별점의 근거는?" 펼침 영역.

### 2.4 `SajuReport.palaceAnalysis` (PR-Q-4)

12궁 (조상궁/부모궁/배우자궁/자식궁 등) 분석. opt-in via
`precisionConfig.surfacePalace=true` (default off — 현재 NameSpring 영향 X).

### 2.5 `SajuReport.naeumAnalysis` (PR-Q-6)

60갑자 納音 (sound-of-pillar) 분석. opt-in via
`precisionConfig.surfaceNaeum=true` (default off).

---

## 3. Opt-in precisionConfig 옵션 (NameSpring 이 명시적으로 활성화 가능)

NameSpring 이 `request.options.precisionConfig` 를 통해 활성화 가능한
모든 옵션. **default 가 없거나 backward-compat 인 옵션만 listed**.

| 옵션 | 값 | 효과 |
| --- | --- | --- |
| `surfaceSubDomains` | `boolean` | category subDomains 노출 (PR #139 default true) |
| `surfacePalace` | `boolean` | 12궁 분석 노출 (default false) |
| `surfaceNaeum` | `boolean` | 60갑자 納音 노출 (default false) |
| `surfaceJohu` | `boolean` | 조후 분석 노출 (default false) |
| `surfaceNamingScoreVector` | `boolean` | pre-final naming axes `scoreVector` surface (default false, display-only) |
| `paretoFrontierCandidates` | `boolean` | Pareto/diversity-aware candidate ordering + strength profile surface (default false) |
| `evaluatorMode` | `'single' \| 'multi_axis'` | 7-axis 가중 priority 계산 (default 'single') |
| `pureHangulSchema` | `'auto' \| 'classic_phonetic' \| 'modern_korean' \| 'expanded'` | 한글-only 이름의 element-mapping schema (default 'classic_phonetic') |
| `pureHangulSignalCap` | `number [0,1]` | hangul signal weight 곱셈 cap. `pureHangulSchema='auto' + schoolPreset='chinese'` 시 0.7 자동 |
| `pureHangulPolarityModel` | `'binary' \| 'ternary'` | ㅡ/ㅣ 중성모음 처리. `pureHangulSchema='auto' + schoolPreset='modern'` 시 'ternary' 자동 |
| `nameElementStrategy` | `'legacy' \| 'safeFallback'` | invalid/missing `resource_element` rows can fall back to conservative Hangul phonetic evidence and surface provenance via `elementStrategyEvidence` |
| `narrativeStyle` | `'expert' \| 'plain' \| 'counselor' \| 'sideBySide'` | 카드 narrative 톤 (PR10) |
| `readingFocus` | `'auto' \| 'full' \| 'career' \| ...` | 카드 focus tone (PR10) |
| `unknownHourGuard` | `boolean` | 시간미상 사주 saju score damp (default true) |
| `sajuPriorityCurve` | `'linear' \| 'tanh'` | sajuPriority blending 곡선 (default 'tanh') |
| `gyeokgukMode` | `'jonggyeok_only' \| 'chengbai_strict' \| 'multi_special'` | 격국 분류 doctrine (default 'chengbai_strict') |
| `yongshinMode` | `'classical_blend' \| 'chengbai_strict' \| 'consensus_aware'` | 용신 분류 doctrine (default 'chengbai_strict'); `consensus_aware` guards high-conflict reinforcement and surfaces `safetyProfile` |
| `strengthMode` | `'binary' \| 'continuous'` | 신강도 평가 모델 (default 'continuous') |
| `tenGodMode` | `'simple_count' \| 'positional_weighted' \| 'positional_weighted_v2'` | 십성 가중 (default 'positional_weighted', v2 opt-in) |
| `fortuneCascadeMode` | `'simple' \| 'jie_based' \| 'full_5layer'` | 월운 boundary 정확도 (default 'jie_based') |
| `hanjaPool` | `'curated' \| 'inmyeongyong_full'` | 추천 pool 크기 (default 'curated') |
| `sajuSchoolId` | `string` | saju-ts school preset (PR-H-S5 opt-in) |
| `saryeongScheme` | `string` | 사령 scheme (PR-H-S6 opt-in) |
| `aberrationModel` | `string` | 광행차 model (PR-H-S8 opt-in) |
| `solarPrecision` | `'classical' \| 'iau1980_top10' \| 'iau1980_full'` | 천체 정밀도 (PR-H-S8 opt-in) |

### 3.1 `schoolPreset` (top-level option, not in precisionConfig)

```typescript
{ schoolPreset: 'korean' | 'chinese' | 'modern' }
```

- `'korean'` (현재 default) — 이석영 사주첩경 / 미소작명원 표준
- `'chinese'` — 자평진전 / 적천수 격국 우선
- `'modern'` — 한국 현대 작명 서비스 절충

`pureHangulSchema='auto'` 와 결합 시 schoolPreset 별 자동 라우팅:
- chinese + auto → `pureHangulSignalCap=0.7` 자동 적용
- modern + auto → `pureHangulPolarityModel='ternary'` 자동 적용

### 3.2 `sajuTimePolicy` (top-level option)

NameSpring 이 이미 사용 중 (`{ trueSolarTime, longitudeCorrection, yaza, yazaMode }`).
yaza 옵션은 PR-H-S1 yaza fix 의 opt-in 진입점.

---

## 4. 향후 협업 시 권장 절차

1. **NameSpring 이 새 surface 활용을 원할 때**:
   - 본 문서의 §2 / §3 에서 해당 옵션 확인
   - spring-ts UI 측 컴포넌트 추가 (`item?.subDomains?.map(...)` 패턴)
   - **spring-ts 측 코드 변경 불필요** (이미 default 노출 또는 opt-in 가능)

2. **default 동작을 NameSpring 이 변경하고 싶을 때** (예: `surfaceSubDomains` 끄기):
   - NameSpring 의 request 에 `options.precisionConfig: { surfaceSubDomains: false }` 추가
   - spring-ts 코드 변경 불필요

3. **신규 default flip 발생 시 NameSpring 영향 측정**:
   - `lib/spring-ts/test/integration/namespring-compat.test.ts` 가 자동으로 검증
   - 새 default flip 의 PR 머지 전 본 test 실행 필수
   - 영향 있을 시 본 문서 §1.3 표에 PR # / 영향 추가

4. **NameSpring 의 의존 fields 확장 시**:
   - 본 문서 §1.1 표 갱신
   - `namespring-compat.test.ts` 의 assertion 추가
   - spring-ts 측에서 새 의존 fields 가 항상 노출되는지 보장 (default flip 시 영향 측정)

---

## 5. 빠른 sanity check

```bash
cd lib/spring-ts
npx tsx test/integration/namespring-compat.test.ts
```

123/123 PASS 가 backward-compat 보증선이다. 이 test 가 깨지면 NameSpring 영향
가능성 ↑ — 즉시 조사 필요.
