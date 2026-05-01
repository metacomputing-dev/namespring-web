# Next Steps Roadmap — Post Phase H~L Closure

> 작성: 2026-05-01 (PR #150 직후, Phase H~L functionally complete 후 시점)
> 목적: 사용자 결정 단계의 "남은 작업" 을 actionable item 으로 정리.
> 각 항목에 **WHERE / HOW / DEV WORK** 구체화 + priority 분류.

---

## 우선순위 분류 기준

- 🟢 **Tier 1 (즉시 가능)** — spring-ts 측 작업 완결, 다른 의존성 없음. NameSpring 코드 변경 또는 spring-info docs 만 필요.
- 🟡 **Tier 2 (NameSpring dev 협업 필요)** — spring-ts 가 surface 는 노출하나 NameSpring UI 컴포넌트 추가 작업 필요.
- 🔴 **Tier 3 (외부 자료 의존)** — 책 입수 / 권위자 review / 사용자 sample 등 외부 인풋 후 진행 가능.
- ⚫ **Tier 4 (구조적 재설계)** — 엔진 알고리즘 또는 cross-library 변경 필요. 큰 LOC + risk 검토 필요.

---

## A. Phase N (Frontend) — NameSpring UI 확장

> **현재 상태**: spring-ts 가 모든 surface 를 default 또는 opt-in 으로 노출. NameSpring 은 legacy fields 만 소비. FE 측 추가 작업 필요.
>
> **참조**: `lib/spring-ts/FRONTEND_EXTENSIONS.md` §2 (extension surface inventory).

### 🟡 A-1: subDomain breakdown UI (Tier 2, 1-2 day)

**WHERE**: `namespring/src/CombiedNamingReport.jsx:636-668` (categoryCards.map 영역).

**HOW**:
```jsx
{card?.subDomains?.map((sub) => (
  <div key={sub.name} className="ml-4 border-l-2 pl-3 mt-2">
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold">{sub.title}</span>
      <StarRating score={toStars(sub.stars)} compact />
    </div>
    <p className="text-[11px] text-[var(--ns-muted)]">{sub.narrative}</p>
  </div>
))}
```

**DEV WORK**:
- [ ] CombiedNamingReport.jsx:636-668 에 sub-domain row 렌더링 추가
- [ ] CSS class 추가 (DOMAIN_SUBROW_*)
- [ ] PDF export 호환 확인 (`prepareBeforePrint` 에서 펼침 여부)
- [ ] 모바일 레이아웃 검증

**검증**: NameSpring 빌드 → 1986-04-19 fixture 로 5 카테고리 모두 sub-row 1-3 개 노출 확인.

---

### 🟡 A-2: axisStrength tier hedge indicator (Tier 2, 1 day)

**WHERE**: `CombiedNamingReport.jsx:636-668` (categoryCards) + 다른 카드들 (`CategoryFortuneCard.axisStrength` 가진 카드 전체).

**HOW**:
```jsx
const TIER_LABELS = { definite: '확정', practical: '실용', candidate: '후보', deferred: '보류' };
const TIER_COLORS = { definite: 'green', practical: 'blue', candidate: 'amber', deferred: 'gray' };

// 카드 헤더에 hedge badge 추가:
{card?.axisStrength?.yongshin && (
  <span className={`tier-badge tier-${card.axisStrength.yongshin}`}>
    용신: {TIER_LABELS[card.axisStrength.yongshin]}
  </span>
)}
```

**DEV WORK**:
- [ ] `tier-badge` CSS 토큰 추가 (4 tier × 색상)
- [ ] CategoryFortuneCard 헤더에 7-axis hedge 표시 (yongshin / gyeokguk / strength 우선)
- [ ] OverviewSummaryCard / PersonalityCard 등 다른 axisStrength-carrying 카드에도 적용

**검증**: borderline fixture (fix-12, fix-13/14/15) 에서 tier 별 색상 다르게 표시.

---

### 🟡 A-3: evidence "근거는?" expandable (Tier 2, 1 day)

**WHERE**: 각 카드 하단.

**HOW**:
```jsx
{card?.evidence?.length > 0 && (
  <details className="mt-2">
    <summary className="text-xs text-[var(--ns-accent-text)] cursor-pointer">
      이 별점의 근거는?
    </summary>
    {card.evidence.map((row) => (
      <div key={row.axis} className="mt-1 ml-4 text-[11px]">
        <p className="font-semibold">{row.claim}</p>
        <ul>
          {row.supportingFeatures.map((f, i) => <li key={i}>• {f}</li>)}
        </ul>
        {row.weakness && <p className="text-amber-600">⚠ {row.weakness}</p>}
      </div>
    ))}
  </details>
)}
```

**DEV WORK**:
- [ ] `<details>` 컴포넌트 디자인 (CollapsibleMiniCard 와 일관성)
- [ ] supportingFeatures 리스트 렌더 + weakness 경고 표시
- [ ] PDF export 시 펼침 상태 처리

---

### 🟡 A-4: 12궁 palace surface (Tier 2, 0.5 day, opt-in)

**WHERE**: 새 카드 또는 SajuReport 영역 추가.

**HOW**:
1. NameSpring 의 saju 관련 request 에 `options.precisionConfig: { surfacePalace: true }` 추가
2. spring-ts 가 `sajuReport.palace?` 채움 (PR-Q-4 wire 완료, opt-in only)
3. NameSpring UI 에서 12궁 (조상궁/부모궁/배우자궁/자식궁) 별 분석 surface

```typescript
// PalaceReport interface (lib/saju-ts/src/core/palace.ts:export)
interface PalaceReport {
  views: {
    [K in PalacePosition]: {
      meta: PalaceMeta;
      pillarStatus: PalaceRootStatus;
      gilshinScore: number;
      finalStatus: PalaceStatus;
    };
  };
}
```

**DEV WORK**:
- [ ] App.jsx 의 `toFortuneReportRequest` / `toCurrentNameSpringReportRequest` 에 옵션 추가
- [ ] 새 컴포넌트 `PalaceCard.jsx` 작성
- [ ] 기존 saju report 에 추가 가능

---

### 🟡 A-5: 60갑자 naeum surface (Tier 2, 0.5 day, opt-in)

**WHERE**: Saju 관련 카드.

**HOW**:
1. `precisionConfig: { surfaceNaeum: true }` 활성화
2. `sajuReport.naeum?` 노출 (PR-Q-6 완료)
3. UI: 4 pillar 별 納音 + element distribution + caution

**DEV WORK**:
- [ ] `NaeumDisplay.jsx` 컴포넌트 작성
- [ ] 4-pillar grid + 納音 element 표시 (예: 海中金, 爐中火 등)
- [ ] caution 메시지 (元辰 충돌 등) 표시

---

### 🟡 A-6: school doctrine indicator (Tier 2, 0.5 day, precision-mode 와 분리)

**WHERE**: 사용자 setting 또는 입력 페이지.

**HOW**:
NameSpring UI 에서 schoolPreset 선택 옵션 추가 (`'korean' | 'chinese' | 'modern'`). 선택에 따라 pureHangulSchema='auto' 자동 적용 + signal cap / polarity 조정.

```jsx
<select value={schoolPreset} onChange={(e) => setSchoolPreset(e.target.value)}>
  <option value="korean">한국 표준 (이석영)</option>
  <option value="chinese">중국 자평 (자평진전)</option>
  <option value="modern">한국 현대 (작명원)</option>
</select>
```

**DEV WORK**:
- [ ] 사용자 preference 저장 (localStorage)
- [ ] 모든 spring-ts call site 에 schoolPreset 전달
- [ ] UI 에 학파 doctrine 차이 설명

---

### 🟡 A-7: multi_axis evaluator UI mode (Tier 2, 0.5 day, opt-in)

**WHERE**: 고급 사용자 옵션.

**HOW**:
1. `precisionConfig: { evaluatorMode: 'multi_axis' }` 활성화
2. 7-axis weighted blend 로 priority 산출 (PR-Q-7 wire, 12/12 fixture 활성)
3. UI: "정밀 모드" 토글 + tier 정보 풍부하게 표시

**DEV WORK**:
- [ ] 사용자 preference: `useEnhancedEvaluator: boolean`
- [ ] axisStrength 7-axis 모두 표시 (현재는 yongshin/gyeokguk/strength 만)
- [ ] "정밀 모드 ON" 시 candidate ranking 변동 알림

---

### 🟡 A-8: ten god encyclopedia integration (Tier 2, 1 day)

**WHERE**: PersonalityCard, StrengthsWeaknessesCard.

**HOW**:
spring-ts 의 `tenGodEncyclopedia.ts` 가 10 십성 별 expertKeywords + bright/shadow 제공. NameSpring UI 에서 사용자의 dominant ten god 별 풀-detail 표시.

```jsx
import { tenGodEncyclopedia } from '@spring/spring-engine';

const dominantTenGod = sajuReport?.tenGodAnalysis?.dominant;
const entry = tenGodEncyclopedia[dominantTenGod];
return (
  <div>
    <h3>{entry.korean} ({entry.english})</h3>
    <ul>
      <li>강점: {entry.bright.join(', ')}</li>
      <li>주의: {entry.shadow.join(', ')}</li>
      <li>전문 키워드: {entry.expertKeywords.join(', ')}</li>
    </ul>
  </div>
);
```

**DEV WORK**:
- [ ] `tenGodEncyclopedia` import path 확인 (현재 spring-ts/src/report/knowledge/)
- [ ] PersonalityCard.body 에 expertKeywords 추가
- [ ] StrengthsWeaknessesCard 에 bright/shadow 추가

---

### 🟡 A-9: 격국 success rules surface (Tier 2, 1 day)

**WHERE**: OverviewSummaryCard 또는 SajuReport.

**HOW**:
spring-ts 의 `gyeokgukEncyclopedia.ts` 가 19 격국 별 principle/helpful/disease/remedy 제공.

```jsx
const gyeokguk = sajuReport?.gyeokguk?.type;
const entry = gyeokgukEncyclopedia[gyeokguk];
return (
  <div>
    <p><strong>원칙:</strong> {entry.principle}</p>
    <p><strong>유리한 운:</strong> {entry.helpful}</p>
    <p><strong>주의 신호:</strong> {entry.disease}</p>
    <p><strong>대응:</strong> {entry.remedy}</p>
  </div>
);
```

**DEV WORK**:
- [ ] gyeokgukEncyclopedia import + 격국 type 매핑
- [ ] OverviewSummaryCard 의 evidence 바로 아래 격국 detail 추가
- [ ] 별격 (HUA_QI/ZHUAN_WANG/CONG_*) 의 경우 별도 처리 (현재 entry 미커버)

---

### 🟡 A-10: counterexamples display (Tier 2, 0.5 day)

**WHERE**: CautionsCard.

**HOW**:
spring-ts 가 PR-J-6 에서 counterexamples 추가. UI: "이런 경우는 다를 수 있어요" 섹션.

**DEV WORK**:
- [ ] CautionsCard 에 counterexamples 렌더 추가
- [ ] 사용자 confusion 방지 위한 placeholder ("일반적인 경우" 강조)

---

## B. 책 입수 후 verification (Tier 3)

> **현재 상태**: L-1 jonggyeok 9 cases + L-6 authority 6 cases 모두 `training-derived`. spring-ts/test/baseline/authority/training_derived/README.md §verification path 4 단계 절차 명시.
>
> **블로커**: 책 입수 (사주첩경 6권 / 박재완 명리실관·요강 / 적천수 천미 / 命理存验 / 강헌 명리 심화편).

### 🔴 B-1: L-1 jonggyeok cases verification (책 입수 의존)

**WHERE**: `lib/spring-ts/test/fixtures/jonggyeok_cases.json` 9 cases.

**HOW (책 입수 후)**:
1. 각 case 의 pillar 와 책 example 비교
2. **Match 시**: `source.kind: 'training_derived'` → `'book_extracted'`. `source.book_citation` 추가.
3. **Pillar match + doctrine divergence 시**: `expected.*` 갱신 + `disagreementNotes` 기록 + `verifier` 명기.
4. **Pillar mismatch 시**: 새로운 chart 검색 또는 case 제거. 책의 정확한 사주를 substitute.

**DEV WORK**:
- [ ] 책 9 case 별 cross-reference (대략 8-16 hr)
- [ ] jonggyeok_cases.json 갱신
- [ ] spring-ts 의 `gyeokgukSelectionRule` opt-in 추가 (책 doctrine 활성화) — engine 측 작업

**우선순위 책**:
1. 적천수 천미 (임철초 註) — 종격 가장 풍부
2. 사주첩경 4-6권 (이석영) — 종격 사례
3. 박재완 명리실관 — 한국 modern 종격 해석

---

### 🔴 B-2: L-6 authority cases verification

**WHERE**: `lib/spring-ts/test/baseline/authority/training_derived/td_*.json` 6 cases.

**HOW**: 동일 4 단계 절차.

**DEV WORK**:
- [ ] 6 case × 평균 1 hr cross-reference = 6-12 hr
- [ ] td_*.json 갱신
- [ ] quality_gate.mjs D2/D4 dimensions 자동 활성화 (Reference A 채워지면)

---

### 🔴 B-3: L-5 추가 권위 cases (계획 6-10 cases)

**WHERE**: `test/baseline/authority/<source>/` 새 directory.

**HOW**:
- 박재완 명리요강 / 사주첩경 / 적천수 별 6-10 권위 case 추가
- spec `spring-info/09_finalization/16_korean_authority_cases.md` (F-A16 deliverable) 의 schema 따름

**DEV WORK**:
- [ ] 책 별 6-10 case fixture 작성 (~40-80 hr 책 분석 + 변환)
- [ ] quality_gate D2/D4 측정 활성화
- [ ] spring-ts 결과 vs 권위 결과 diff PR 발행

---

### 🔴 B-4: M-D8 caveat 책-기반 retroactive review

**WHERE**: `lib/spring-ts/src/saju-calculator.ts:454-470` (computeTenGodScore positional_weighted branch).

**현재 상태**: branch 활성, 21/21 fixture 0 divergence (구조적 null-effect 문서화).

**HOW (책 입수 후)**:
- 책의 십성 가중 doctrine 정확히 cross-reference
- (a) Roll back: simple_count default 복원 + flag 제거 — 만약 책에서도 위치별 가중이 무의미하다고 입증
- (b) Restructure: computeTenGodScore 의 deviation step 을 position-sensitive 하게 재설계 — 책의 doctrine 이 위치별 가중이 의미 있다고 입증
- (c) Keep: empirical 영향 없으나 doctrine 정렬은 유지 — 현재 결정

**DEV WORK**:
- [ ] 책 doctrine 분석 (~4-8 hr)
- [ ] 옵션 (a)/(b)/(c) 결정 후 PR 발행
- [ ] 옵션 (b) 시 ~200-500 LOC 알고리즘 변경

---

## C. spring-info docs (Tier 1, 즉시 가능)

> **현재 상태**: spring-info/ 는 git-tracked 아님 (사용자 local). PROGRESS.md 갱신 직접 가능.

### 🟢 C-1: K-11 DEFAULT_CHANGELOG entry (evaluatorMode 'single' 유지)

**WHERE**: `spring-info/09_finalization/DEFAULT_CHANGELOG.md`.

**HOW**: 새 entry 추가:
```markdown
## [PR #N] DEFAULT-CHANGE-9 — 2026-MM-DD

### `precisionConfig.evaluatorMode`: declared but default 'single' KEPT

| field | value |
| --- | --- |
| 1. Date | 2026-MM-DD |
| 2. PR# | (placeholder, no actual flip) |
| 3. Option | `precisionConfig.evaluatorMode` |
| 4. Old default | (none, declared in PR #89) |
| 5. New default | `'single'` (intentionally kept) |
| 6. Affected fixtures | 0 |
| 7. Intent | Document the deliberate decision to NOT flip multi_axis as default. multi_axis is opt-in for advanced consumers. |
| 8. Risk | None — declaration-only. |
| 9. Rollback | n/a |
```

**DEV WORK**:
- [ ] DEFAULT_CHANGELOG.md 에 entry 추가
- [ ] PROGRESS.md K-11 marked as completed

---

### 🟢 C-2: K-12 multi-axis design doc

**WHERE**: `spring-info/09_finalization/06_multi_axis_evaluator.md` (이미 존재) 갱신 + `FRONTEND_HANDOFF.md` 신규.

**HOW**:
- 06_multi_axis_evaluator.md 의 §4.2 implementation status 갱신 (PR-Q-7 / Q-17 결과 반영)
- 새 `FRONTEND_HANDOFF.md` 작성 — `lib/spring-ts/FRONTEND_EXTENSIONS.md` 의 spring-info 버전 (협업 용)

**DEV WORK**:
- [ ] 2 markdown 갱신 (~1-2 hr)

---

### 🟢 C-3: H-S9 docs saju-ts narration review

**WHERE**: spring-info/09_finalization/ 의 saju-ts narration 관련 doc.

**HOW**:
- saju-ts narration (`buildNarration.ts` 등) 의 phrase / 톤 / hedge 표현 review
- Korean naming-doctrine 정렬 확인
- 갱신 필요 시 saju-ts side PR 발행

**DEV WORK**:
- [ ] 1-2 hr review
- [ ] saju-ts narration 갱신 PR (필요 시)

---

## D. M-D8 caveat resolution options (Tier 4, 구조 재설계)

### ⚫ D-1: Option (a) Roll back tenGodMode default

**WHERE**: `lib/spring-ts/src/spring-engine.ts:266`.

**HOW**:
```typescript
tenGodMode: pc?.tenGodMode ?? 'simple_count',  // rollback from 'positional_weighted'
```

또는 옵션 자체 제거 (declaration 만 남김).

**DEV WORK**:
- [ ] DEFAULT_CHANGELOG entry (rollback 기록)
- [ ] PROGRESS.md M-D8 status 갱신
- [ ] snapshot 검증 (변경 없음 — 0/21 divergence 였음)

**Risk**: 매우 낮음 (실측 효과 0).

---

### ⚫ D-2: Option (b) Restructure computeTenGodScore

**WHERE**: `lib/spring-ts/src/saju-calculator.ts:437-510`.

**HOW**:
```typescript
function computeTenGodScore(...): number {
  // 현재: 'simple_count' / 'positional_weighted' 모두 normalize via deviation
  // 새 알고리즘: 'positional_weighted' 모드에서 weighted_groupCounts 를 직접
  //   사용 (deviation normalization 우회)
  // OR: 위치별 별도 score 계산 후 (월지/일간/시지) 가중 합산
}
```

**DEV WORK**:
- [ ] 책 doctrine 분석 (~8 hr)
- [ ] 알고리즘 재설계 (~4-8 hr)
- [ ] 21+ fixture 영향 측정 + DEFAULT_CHANGELOG entry
- [ ] snapshot 재캡처

**Risk**: high — 21 fixture 모두 변동 가능.

---

## E. H-S1 yaza wiring gap investigation (Tier 4)

> **현재 상태**: opt-in plumbing 활성 (`sajuTimePolicy.yaza='on'`). 그러나 23:30 boundary 에서 day pillar 변경 미발생 (test/integration/yaza-opt-in.test.ts 의 informational 기록).

### ⚫ E-1: saju-ts dayCutMode 추가 config 조사

**WHERE**: `lib/saju-ts/src/compat/springLegacy.ts:251-262` `resolveDayCutMode()`.

**HOW**:
1. 23:30 입력에 `yazaEnabled=true + yazaMode='YAZA_23_TO_01_NEXTDAY'` 가 도달하는지 확인 (instrumentation)
2. saju-ts 내부 day pillar 산출 path 에서 `dayCutMode` 가 실제 적용되는지 trace
3. 빠진 config 가 있다면 추가 (e.g., `dayCutMode` field 가 별도로 필요)

**DEV WORK**:
- [ ] saju-ts 내부 trace + 누락 config 파악 (~2-4 hr)
- [ ] 누락 config 추가 PR (saju-ts 측, ~50-100 LOC)
- [ ] yaza-opt-in.test.ts 의 informational note 를 assertion 으로 격상

**Risk**: medium — 정상 작동 후 23:00-00:30 birthtime 의 사주가 변동.

---

## F. K-4 full cross-library wire (Tier 4)

> **현재 상태**: 'auto' routing + signal cap (K-5) + polarity ternary (K-6) wire 완료. 그러나 per-schema element-mapping (`'classic_phonetic' / 'modern_korean' / 'expanded'` 의 실제 ONSET → element 표 차이) 은 **declaration only**.

### ⚫ F-1: per-schema ONSET 표 implementation

**WHERE**:
- `lib/seed-ts/src/calculator/hangul-calculator.ts` (ONSET_TO_ELEMENT 가 schema 별로 분기)
- `lib/spring-ts/src/calculator/hangul-calculator.ts` (HangulCalculator constructor 가 schema 인자 받음)

**HOW**:
1. seed-ts 에 4 ONSET 표 정의:
   - `ONSET_TO_ELEMENT_CLASSIC_PHONETIC` (현재 단일 표)
   - `ONSET_TO_ELEMENT_MODERN_KOREAN` (격음/경음 분리, 한국 작명원 표준)
   - `ONSET_TO_ELEMENT_EXPANDED` (종성 상생 검사 추가)
2. `calculateElementFromOnset(char, schema)` 가 schema 별 표 select
3. spring-ts HangulCalculator constructor 에 `schemaName` 인자 추가
4. spring-engine 에서 resolution → schemaName 결정 후 전달

**DEV WORK**:
- [ ] doctrine 비교 분석 (한국 작명원 vs 훈민정음 해례 표 차이 — ~4 hr)
- [ ] seed-ts 표 정의 (~150 LOC)
- [ ] spring-ts wire (~100 LOC)
- [ ] fixture 추가 (각 schema 별 hangul-only fixture, ~200 LOC)
- [ ] DEFAULT_CHANGELOG entries (per-schema 차이 측정 후)

**Risk**: high — 한글-only 이름의 element 분류가 schema 별 다름. 사용자 결과 변동 큼.

---

## G. quality_gate 통합 (Tier 1 → 3 순)

> **현재 상태**: G-1 quality_gate.mjs 5-dimension 활성 (D1/D3 만 active, D2/D4 = N/A). Reference A 입수 후 D2/D4 자동 활성.

### 🟢 G-1: 현재 quality_gate.mjs 결과 정기 monitor

**WHERE**: `lib/spring-ts/tools/quality_gate.mjs`.

**HOW**:
- CI integration: PR 머지 시 자동 실행
- Result publish (e.g., GitHub Actions summary)

**DEV WORK**:
- [ ] `.github/workflows/quality-gate.yml` 작성
- [ ] `npm run quality:gate` script 등록 (현재 manual)

---

### 🔴 G-2: Reference A authority cases 입수 후 D2/D4 활성화

**WHERE**: `test/baseline/authority/<book>/` directory.

**HOW**: 책 입수 후 case 추가 → quality_gate 가 자동 D2/D4 활성.

**DEV WORK**: B-3 와 동일.

---

## H. 추가 fixture coverage (Tier 1)

### 🟢 H-1: Edge fixture 확장 (현재 15 → 25-30)

**WHERE**: `lib/spring-ts/test/fixtures/spring_ts_baseline_cases.json`.

**HOW**: 현재 15 fixture 에 추가:
- 종격 변형 cases (각 type 2-3 개씩)
- Edge fixtures (시간 변경 boundary, 절기 boundary 변동)
- 권위 figure cases (역사 인물 12 명)

**DEV WORK**:
- [ ] 10-15 fixture 추가 + snapshot 재캡처
- [ ] 검증 test 작성

**Risk**: low — pure data PR.

---

## I. Tier 1 작업 권장 순서 (즉시 가능)

다음 순서로 진행 권장 (외부 의존 없음, 1-2 day 내 완결):

1. **C-1 / C-2 / C-3** spring-info docs 갱신 (~3-4 hr)
2. **G-1** quality_gate CI integration (~2 hr)
3. **H-1** edge fixture 확장 (~4-8 hr)

---

## J. Tier 2 작업 권장 순서 (NameSpring 협업)

NameSpring dev 와 1 회 회의 후 우선순위 결정:

**우선순위 후보 (가치 / 작업량 비율 높은 순)**:
1. **A-1 subDomain UI** (가장 큰 visible 가치, default 노출 활용)
2. **A-2 axisStrength tier badge** (UX 신뢰도 ↑)
3. **A-9 격국 success rules** (encyclopedia 자료 활용도 ↑)
4. **A-3 evidence expandable** (UX 깊이 ↑)
5. **A-6 schoolPreset 선택** (사용자 doctrine 선택권)

기타 (A-4/A-5/A-7/A-8/A-10) 는 사용자 요청 기반 우선순위 조정.

---

## K. Tier 3 작업 권장 순서 (책 입수 후)

책 입수 우선순위:
1. **이석영 사주첩경 6권** — L-1/L-6 verification + 추가 case
2. **적천수 천미 (임철초)** — 종격 doctrine cross-reference
3. **박재완 명리실관/요강** — 한국 modern 권위 case
4. **강헌 명리 심화편** — 추가 사례 (paid 자료)

각 책 입수 후:
- B-1 / B-2 verification (1-2 day per book)
- B-3 추가 권위 case (1 week per book)
- D-1 또는 D-2 (M-D8 retroactive review, optional)

---

## L. 가장 큰 ROI 작업 (단기 1 주 내)

1. 🟢 **C-1/C-2/C-3** docs 정리 (4 hr) — completion signal
2. 🟡 **A-1 subDomain UI** (1-2 day) — 가장 큰 visible UX 향상
3. 🟢 **G-1 quality_gate CI** (2 hr) — 회귀 자동 차단

**총 예상**: 2-3 day 작업으로 가장 큰 가치 surface.

---

## M. 단계 완결 verdict 측정 path

`PRINCIPLES_v2.md §5` 의 "능가 verdict" (top expert 능가) 측정 path:

1. Reference A authority cases 입수 (Tier 3)
2. quality_gate D2/D4 dimensions 활성화
3. spring-ts vs Reference A diff < tolerance threshold 검증
4. 각 fixture 별 strict binary AND 조건 PASS 확인

**현재 verdict 상태**:
- saju-ts ↔ 한국 modern lecture: 11/11 PASS (PR-N-1)
- saju-ts ↔ 명리존험 prose: 1/6 PASS (PR-O-1)
- 한국 figures: 57% (PR-P-1)
- inter-engine (saju-ts vs saju_master): 38.8% (49-case)

**verdict 결정 가능 시점**: Reference A 입수 후 quality_gate D2/D4 측정 결과 + Phase L-3 reference comparison tooling (L-7~L-11) 통합 후.
