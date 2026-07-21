# spring-ts

**한국 명리학 + 작명 통합 라이브러리**. seed-ts (이름 분석)와 saju-ts (사주 분석)를 통합하여 사주에 부합하는 이름 점수와 11-card 운세 보고서를 산출합니다.

> NameSpring (irumbom-poc) 의 backend 엔진으로 사용되며, API 는 IMMUTABLE — opt-in `precisionConfig.*` 로만 동작 확장.

> **Packaging boundary:** `spring-ts` is a private internal source module.
> NameSpring consumes `src/**` through a Vite alias; this directory is not an
> npm registry package. The current `tsc` output is verification-only and is
> not advertised as a Node-importable package. Registry publication requires a
> separate packaging contract for seed-ts, saju-ts, DB/WASM assets, ESM imports,
> and curated report data.

---

## 한 줄 요약

> **"사주에 부족한 오행을 이름으로 보충해주는 최적의 조합 + 11 카드 운세 보고서를 산출한다."**

---

## 현재 상태 (2026-05-01)

| Phase | 상태 | 머지 PR |
| --- | --- | --- |
| **G — Tooling foundations** | ✅ 완료 | 3 / 3 |
| **H — Adapter + saju-ts** | ✅ 완료 (S7 dropped, S9 docs) | 10 / 16 |
| **I — Hanja extensions** | ✅ 완료 (9,495 인명용) | 7+ / 7 |
| **J — Encyclopedia + narrative** | ✅ 완료 | 13 / 8 |
| **K — Algorithm modes opt-in** | ✅ 완료 (모든 핵심 wire) | 10 / 12 |
| **L — Fixture + reference** | ✅ 완료 (L-1/L-6 training-derived) | 11 / 11 |
| **M — Default tuning** | ✅ 완료 (1 declarative caveat) | 7 / 7 |
| **N — Frontend** | 미진행 (NameSpring 측 별도) | 0 / 10 |

**누적 머지**: ~93 PR (PR #62 ~ #151).

**검증 자동화**:
- `npm run test:snapshot` — 15-fixture default regression (15/15 PASS)
- `npm run test:integration` — 다중 통합 테스트 묶음
- 8 integration test files (yaza-opt-in, multi-axis-fixture, jonggyeok-fixture, training-derived-authority, namespring-compat, etc.)

**상세 문서**:
- [`FRONTEND_EXTENSIONS.md`](FRONTEND_EXTENSIONS.md) — NameSpring 호환성 contract + 23 opt-in 옵션 인벤토리
- [`NEXT_STEPS_ROADMAP.md`](NEXT_STEPS_ROADMAP.md) — Tier 별 actionable 작업 (Phase N FE / 책 입수 / 알고리즘 강화)
- `spring-info/09_finalization/PROGRESS.md` — 전체 phase 진행 표
- `spring-info/09_finalization/DEFAULT_CHANGELOG.md` — controlled default change 8 entries

---

## 한눈에 보는 구조

```
NameSpring (irumbom-poc)
     │
     │  SpringRequest { birth, surname, givenName?, options? }
     ▼
┌─────────────────────────────────────────────────────────────┐
│                      SpringEngine                            │
│                      (spring-engine.ts)                       │
│                                                              │
│  1. init()                ── DB + 사격 행운수 테이블 초기화   │
│                                                              │
│  공개 API (NameSpring 사용 중):                                │
│  ─ getSpringReport()      통합 리포트 (이름+사주+궁합)         │
│  ─ getFortuneReport()     11-card 운세 보고서                  │
│  ─ getNameCandidates()    추천 후보 정렬                       │
│  ─ getNamingReport()      이름만 분석                          │
│  ─ getSajuReport()        사주만 분석                          │
│  ─ analyze()              레거시 통합 (하위호환)                │
│                                                              │
│  내부 파이프라인:                                              │
│  ① saju-adapter           사주 분석 + 정규화 (saju-ts 동적)    │
│  ② seed-ts 계산기          발음/획수/사격 (HanjaCalculator 등)  │
│  ③ saju-calculator        사주↔이름 궁합 점수 (4-factor)       │
│  ④ spring-evaluator       가중 합산 + multi_axis (opt-in)      │
│  ⑤ buildFortuneReport     11 카드 narrative + axisStrength     │
│                                                              │
│  2. close()               ── DB 자원 해제                     │
└──────────────────────────────────────────────────────────────┘
            │              │
            ▼              ▼
    ┌────────────┐  ┌────────────┐
    │  seed-ts   │  │  saju-ts   │  (+ saju_master Python ref)
    │ (이름 핵심) │  │ (사주 핵심) │
    └────────────┘  └────────────┘
```

> **이름**: `name-ts → seed-ts` 로 rename 완료. 이전 README 의 `name-ts` 표현은 모두 `seed-ts` 와 동일 의미.

---

## 주요 기능

### 1. 사주 분석 (saju-ts integration)

- **4-pillar 계산**: tyme4ts cross-validation 85.4% per-pillar (mainstream open-source 정합성)
- **격국 분류**: 10 정격 (chengbai_strict default) + 9 별격 (HUA_QI/ZHUAN_WANG/CONG_*) declared
- **용신 selection**: 억부/조후/통관/병약/식상 후보 ranking
- **십성 분석**: 5-group (friend/output/wealth/authority/resource) + 위치별 가중 (천간 4.0 / 지지정기 1.8 / 지장간 1.2-0.45)
- **신강도**: continuous graded (M-D7), totalSupport/totalOppose 비율
- **신살**: shinsal hits + 가중 + 합성 (composites)
- **대운/세운**: forward/backward direction + start age 정밀
- **12궁 palace** (opt-in): 조상궁/부모궁/배우자궁/자식궁 등
- **60갑자 納音** (opt-in): 4-pillar 별 sound element + caution
- **상수 정확도**: IAU 1980 top-10 nutation, Newton root-finder, 정확 EoT

### 2. 이름 분석 (seed-ts wrapped)

- **HangulCalculator**: 발음 오행 + 음양 (binary 또는 ternary 모드)
- **HanjaCalculator**: 획수 오행 + 음양
- **FrameCalculator**: 사격 (元亨利貞) 수리 길흉
- **인명용 한자**: 9,495 entries (isin=1 from delvier/KoreaSCourtCode)
- **입력 별칭**: 112 search/deduplication aliases (legal-authority evidence 아님)
- **Hanja 격식 annotation**: 사주적합성 + 의미

### 3. 사주↔이름 궁합 (saju-calculator.ts)

```
┌─────────────────────────────────────┐
│  computeSajuCompatibilityScore()    │
│                                     │
│  4-factor 가중합산 (adaptive):       │
│                                     │
│  1. 오행 균형 (balance)    ~30-40%  │  부족 오행 보충
│  2. 용신 친화 (yongshin)   ~25-35%  │  yongshinMode chengbai_strict default
│  3. 일간 강약 (strength)   ~10-15%  │  strengthMode continuous default
│  4. 십성 배치 (tenGod)     ~5-10%   │  tenGodMode positional_weighted default
│                                     │
│  + 격국/조후/부족원소 보정           │
│                                     │
│  → 0~100 점                         │
└─────────────────────────────────────┘
```

### 4. 최종 합산 (spring-evaluator.ts)

```
이름 점수 + 사주 점수
       │
       ▼
  springEvaluateName()
       │
       ▼
  ┌──────────────────────────────────────────────────┐
  │  Single mode (default):                           │
  │    적응형 — 사주 신뢰도 따라 가중치 조절           │
  │      - 사주 confidence high → 사주 비중 ↑          │
  │      - 사주 confidence low  → 이름 비중 ↑          │
  │                                                  │
  │  Multi-axis mode (opt-in, evaluatorMode='multi_axis'): │
  │    7-axis weighted blend                          │
  │    (yongshin 1.20 / gyeokguk 1.15 / chengbai 1.10 │
  │     fortuneHierarchy 1.05 / strength 1.00         │
  │     johu 1.00 / rectification 0.90)               │
  │    axisStrength ≥ 2 axes valid 시 활성, 아니면     │
  │    single mode 로 fall-through (no degradation)    │
  └──────────────────────────────────────────────────┘
```

### 5. 운세 보고서 (FortuneReport, 11 카드)

| 카드 | 내용 | 새 surface (PR-K-1 default) |
| --- | --- | --- |
| OverviewSummary | 사주 + 격국 + 용신 총평 | axisStrength, evidence |
| LifeFortuneOverview | 일생 운 흐름 | axisStrength, evidence |
| Personality | 성격 분석 | tenGod expertKeywords (encyclopedia) |
| StrengthsWeaknesses | 장단점 | axisStrength, evidence |
| Cautions | 주의 신호 | counterexamples |
| DailyFortune | 일운 | axisStrength |
| WeeklyFortune | 주운 | — |
| MonthlyFortune | 월운 | jie_based boundary (M-D6) |
| YearlyFortune | 연운 | axisStrength |
| LifeStageFortune | 인생 단계 | — |
| **CategoryFortunes** (5개 × 1-3 sub) | 5대 분야 + sub-domain | **subDomains (default true)**, axisStrength, evidence |

5대 분야: wealth / health / academic / romance / family.
Sub-domain (default 노출): career / study_document / expression_children / health_stress / movement.

---

## 파일별 역할

### `src/` — 소스 코드

```
src/
├── spring-engine.ts            메인 엔진 + 6 공개 메서드
├── spring-evaluator.ts         최종 점수 합산 (single + multi_axis)
├── saju-adapter.ts             saju-ts 호출 + SajuSummary 정규화
├── saju-calculator.ts          사주↔이름 궁합 4-factor 점수
├── types.ts                    23 precisionConfig 옵션 + 모든 인터페이스
├── index.ts                    공개 export (seed-ts re-export 포함)
│
├── calculator/                 spring-ts 측 calculator wrapper
│   ├── hangul-calculator.ts    signalCap (K-5) + polarityModel (K-6) wire
│   ├── hanja-calculator.ts
│   ├── frame-calculator.ts
│   └── search.ts
│
├── core/                       공통 유틸 (evaluator, scoring, model-types)
│
└── report/                     11 카드 운세 보고서 빌더
    ├── buildFortuneReport.ts   orchestrator
    ├── types.ts                FortuneReportOptions (surfaceSubDomains 등)
    ├── cards/                  11 카드 builder
    │   ├── overview-summary-card.ts
    │   ├── category-fortune-card.ts          5 base 카테고리
    │   ├── category-fortune-subdomain-data.ts (PR-K-1 데이터)
    │   ├── personality-card.ts
    │   └── ... (10 more)
    ├── common/                 elementMaps, fortuneCalculator
    └── knowledge/              encyclopedia
        ├── tenGodEncyclopedia.ts    10 십성 expertKeywords + bright/shadow
        └── gyeokgukEncyclopedia.ts  19 격국 principle/helpful/disease/remedy
```

### `config/` — 정책 JSON

```
config/
├── engine.json                 후보 수, 획수 범위, 페이지네이션
├── evaluator-policy.json       가중치 + adaptive/strict 모드
├── saju-scoring.json           용신 가중치, 균형 페널티, tenGodGroups
├── cheongan-jiji.json          10 천간 + 12 지지 reference
├── presets/
│   ├── korean.json             한국 default 학파
│   ├── chinese.json            자평진전 학파
│   └── modern.json             한국 현대 작명원 표준
└── scoring-rules.json          calculator 점수 규칙
```

### `data/` — 정적 데이터

```
data/
├── inmyeongyong_9389_full.json     인명용 9,495 한자 (isin=1)
├── byeolpyo2_variants.json          검색/중복제거 전용 112 입력 별칭
├── official-hanja-lookup-authority.generated.json  공식 조회 parity receipt
└── HANJA_INGESTION_STATUS.md
```

### `test/` — 테스트

```
test/
├── compare-output.ts                   레거시 통합 테스트
├── fixtures/
│   ├── spring_ts_baseline_cases.json   15 baseline fixture
│   └── jonggyeok_cases.json             9 jonggyeok fixture (training-derived)
├── baseline/
│   ├── spring_ts_snapshot.json         15-fixture snapshot
│   └── authority/
│       ├── chumyeongga/                추명가 2 cases
│       ├── classical/                  명리존험 38 cases
│       ├── figures/                    한국 modern figures
│       ├── jonheom/                    명리존험 prose
│       ├── lecture/                    전정훈 11 cases (PR-N-1 11/11 PASS)
│       └── training_derived/           AI-derived 6 cases (verification pending)
├── integration/                        8+ integration test
│   ├── adapter-daewoon.test.ts
│   ├── adapter-relations.test.ts
│   ├── adapter-shinsal-gongmang.test.ts
│   ├── adaptive-evaluator.test.ts
│   ├── borderline-strength-tier.test.ts
│   ├── category-extension.test.ts
│   ├── category-subdomains.test.ts
│   ├── hanja-annotations.test.ts
│   ├── jie-boundary.test.ts
│   ├── jonggyeok-fixture.test.ts        9 cases
│   ├── md8-tengod-divergence.test.ts    M-D8 caveat empirical
│   ├── measure-default-change.test.ts
│   ├── multi-axis-fixture.test.ts       12-fixture sensitivity
│   ├── namespring-compat.test.ts        123/123 NameSpring contract
│   ├── narrative-expansion.test.ts
│   ├── narrative-foundations.test.ts
│   ├── pure-hangul-schema.test.ts       4 schema + cap + ternary
│   ├── quality-gate.test.ts
│   ├── saju-calculator-disabled.test.ts
│   ├── saju-ts-load.test.ts
│   ├── school-presets.test.ts
│   ├── scoring-opt-in.test.ts
│   ├── training-derived-authority.test.ts  6 cases
│   └── yaza-opt-in.test.ts
└── verify-region-coordinate-resolution.ts
```

### `tools/` — 검증/측정 도구

```
tools/
├── baseline_snapshot.ts                 capture / verify
├── quality_gate.mjs                     5-dimension gate (D1/D2/D3/D4/D5)
├── measure_default_change.mjs           A/B delta classifier
├── measure_regression.mjs               per-field diff
├── compare_engines_classical.mjs
├── cross_validate_tyme4ts.ts            85.4% per-pillar verified
├── validate_lecture_cases.ts            11/11 PASS
├── validate_jonheom_cases.ts             1/6 PASS
├── validate_korean_modern_authority.ts   57% match
├── capture_saju_master_runs.mjs          12 oracles
├── inspect_delvier_db.mjs
├── generate_inmyeongyong_full.mjs        9,495 ingestion
└── (others)
```

---

## 핵심 개념

### 용신 (Yongshin, 用神)

사주에서 **가장 필요한 오행**. spring-ts default `yongshinMode='chengbai_strict'` (M-D5) — 엄격한 confidence 페널티.

```
예: 火土 넘치고 Water 부족 → 용신 = Water
    이름에 水 계열 한자 → 궁합 점수 ↑
```

- **희신** (Heesin): 용신 보조 — 차선책
- **기신** (Gisin): 사주에 해로운 오행 — 피함
- **구신** (Gusin): 가장 해로운 오행 — 강하게 피함

### 적응형 가중치 (single mode)

사주 신뢰도(confidence)에 따라 자동 조절:

```
신뢰도 0.9 → 사주 비중 ~48% / 이름 ~35%
신뢰도 0.3 → 사주 비중 ~23% / 이름 ~60%
```

판단 불확실 시 이름 자체 점수에 더 의존하는 안전장치.

### Multi-axis 모드 (opt-in)

`precisionConfig.evaluatorMode = 'multi_axis'` → 7-axis weighted blend:
- yongshin (1.20), gyeokguk (1.15), chengbai (1.10),
- fortuneHierarchy (1.05), strength (1.00), johu (1.00), rectification (0.90)
- TIER_VALUE: definite (0.92) / practical (0.75) / candidate (0.55) / deferred (0.30)
- axisStrength ≥ 2 valid axes 시 활성, 아니면 single 로 fall-through

12 baseline fixture 중 10/12 가 single 과 divergent finalScore (sensitivity verified).

### 4-tier judgment-strength

모든 11 카드의 axisStrength 가 4-tier 중 하나:
- **definite**: 명확한 판단
- **practical**: 실용적 판단 (~75 confidence)
- **candidate**: 후보 단계 (~55)
- **deferred**: 보류 (~30)

NameSpring UI 가 색상/badge 로 hedge 표시 가능 (현재 미활용 — A-2 작업).

---

## 빠른 시작

```bash
# 1. saju-ts + seed-ts 빌드
cd lib/saju-ts && npm install && npm run build
cd ../seed-ts && npm install && npm run build

# 2. spring-ts
cd ../spring-ts
npm install
npm run typecheck
npm run test:snapshot     # 15/15 PASS 확인
```

### NameSpring 환경에서

NameSpring 의 `vite.config.js` 에 alias 정의 — saju-ts 직접 import:
```javascript
'@spring': path.resolve(__dirname, '../lib/spring-ts/src'),
'@seed': path.resolve(__dirname, '../lib/seed-ts/src'),
'@saju': path.resolve(__dirname, '../lib/saju-ts/src'),
```

빌드 불필요. Vite 가 source 직접 import.

### Node ESM (CLI / tsx / vitest)

`lib/saju-ts/dist/index.js` 가 있어야 saju-ts 동적 로드 성공. 없으면 `sajuEnabled: false`.

---

## 사용 예시

### 1. 이름만 분석 (사주 무관)

```typescript
import { SpringEngine } from '@spring/spring-engine';

const engine = new SpringEngine();
await engine.init();

const namingReport = await engine.getNamingReport({
  birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' },
  surname: [{ hangul: '최', hanja: '崔' }],
  givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }],
});
namingReport.totalScore;                    // 62.6
namingReport.scores;                        // { hangul, hanja, fourFrame }
namingReport.analysis.fourFrame.frames;     // NamingReportFrame[] with meaning
```

### 2. 사주만 분석

```typescript
const sajuReport = await engine.getSajuReport({
  birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' },
  surname: [{ hangul: '최', hanja: '崔' }],
});
sajuReport.sajuEnabled;        // true
sajuReport.dayMaster;          // { stem, element, polarity }
sajuReport.yongshin;           // { element, heeshin, confidence, ... }
sajuReport.gyeokguk;           // { type, category, confidence }
sajuReport.tenGodAnalysis;     // { dayMaster, byPosition }
sajuReport.axisStrength;       // 7-axis tier map
```

### 3. 운세 보고서 (11 카드)

```typescript
const fortuneReport = await engine.getFortuneReport({
  birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' },
  surname: [{ hangul: '최', hanja: '崔' }],
  givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }],
});

// 11 카드 모두 접근 가능
fortuneReport.overviewSummary;
fortuneReport.categoryFortunes.wealth;
//   .stars, .summary, .advice, .caution, .axisStrength, .evidence,
//   .subDomains   ← PR-K-1 default true (1-3 sub-rows: career, movement, ...)
fortuneReport.dailyFortune; weeklyFortune; monthlyFortune; yearlyFortune;
fortuneReport.lifeStageFortune;
```

### 4. 이름 추천 (사주+이름 통합)

```typescript
const candidates = await engine.getNameCandidates({
  birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' },
  surname: [{ hangul: '최', hanja: '崔' }],
  givenNameLength: 2,
  mode: 'recommend',
  options: { limit: 5 },
});
candidates[0].finalScore;        // 통합 점수
candidates[0].fullHangul;        // '최성수'
candidates[0].fullHanja;         // '崔成秀'
candidates[0].rank;              // 1
```

### 5. precisionConfig 옵션

```typescript
// 학파 + auto schema (chinese 학파 → hangul cap 0.7 자동)
await engine.getNamingReport({
  ...request,
  options: {
    schoolPreset: 'chinese',
    precisionConfig: { pureHangulSchema: 'auto' },
  },
});

// 12궁 palace + 60갑자 naeum surface
await engine.getSajuReport({
  ...request,
  options: {
    precisionConfig: {
      surfacePalace: true,
      surfaceNaeum: true,
      surfaceJohu: true,
    },
  },
});

// Multi-axis evaluator
await engine.getNameCandidates({
  ...request,
  options: {
    precisionConfig: { evaluatorMode: 'multi_axis' },
  },
});

// Internal/expert gyeokguk selector comparison. Default behavior is unchanged.
await engine.getSajuReport({
  ...request,
  options: {
    precisionConfig: { gyeokgukSelectionRule: 'jungki_transparent' },
  },
});

// Full legal-Hanja candidate pool.
await engine.getNameCandidates({
  ...request,
  options: {
    precisionConfig: { hanjaPool: 'inmyeongyong_full' },
  },
});
```

전체 23 옵션은 [`FRONTEND_EXTENSIONS.md`](FRONTEND_EXTENSIONS.md) §3 참조.

---

## 정확도 평가 (2026-05-01 시점)

| 측정 | 결과 | 출처 |
| --- | --- | --- |
| 4-pillar per-pillar 정확도 | 85.4% | tyme4ts cross-validation |
| 한국 modern lecture 격국/용신 | **11/11 PASS** | 전정훈 강의 11 cases |
| 명리존험 prose 격국 | 1/6 PASS | classical 종합 분석 (saju_master 0/6) |
| 한국 현대 figures (추명가) | 57% | 9 명조 |
| Inter-engine (saju-ts vs saju_master) | 38.8% | 49-case |
| snapshot regression | 15/15 PASS | default mode |
| NameSpring backward-compat | 123/123 PASS | namespring-compat.test.ts |

**저자 추정 종합**: top Korean expert 기준 **~60-65/100** 수준. 자세한 평가는 internal note 또는 advisor 문의.

---

## 호환성 보증 (NameSpring)

- **API IMMUTABLE**: PRINCIPLES_v2.md §1 — method signature / type 시그니처 불변
- **모든 새 fields 는 optional readonly**: NameSpring 의 optional chaining 패턴 안전
- **default flips 는 type 보존**: 값 변동만, shape 무변경
- **자동 검증**: `npm run test:integration` → namespring-compat.test.ts 가 NameSpring 의존 fields 모두 검증

자세한 호환성 contract 와 23 opt-in 옵션 인벤토리: [`FRONTEND_EXTENSIONS.md`](FRONTEND_EXTENSIONS.md).

---

## 다음 단계

[`NEXT_STEPS_ROADMAP.md`](NEXT_STEPS_ROADMAP.md) 의 Tier 별 actionable 작업 참조:

- 🟢 **Tier 1** (즉시): spring-info docs 정리, quality_gate CI, edge fixture 확장
- 🟡 **Tier 2** (NameSpring 협업): subDomain UI, axisStrength tier badge, 격국 success rules surface, evidence expandable, schoolPreset 선택 UI
- 🔴 **Tier 3** (책 입수): 사주첩경/적천수/박재완 cross-reference, L-1/L-6 verification
- ⚫ **Tier 4** (구조 재설계): M-D8 retroactive review, H-S1 yaza wiring gap, K-4 per-schema ONSET 표

**현실적 ceiling 도달 path**: 6-12 month sustained development → ~85-88 수준.

---

## 의존성

- **seed-ts** — 이름 분석 핵심 (HanjaRepository, FrameCalculator, Energy 등)
- **saju-ts** — 사주 분석 엔진 (동적 import, optional)
- **sql.js** — SQLite WASM (seed-ts 통해 간접)

## 외부 자료 (training data + reference)

- `saju_master_project_v9_2/` — Python 사주 reference 엔진 (cross-validation)
- `spring-val/claude/` — codex-curated validation corpus (109 files / ~31 MB)
- `lib/spring-ts/test/baseline/authority/` — Reference A authority cases

---

## 변경 정책

- **API**: IMMUTABLE — 새 method / 시그니처 변경 금지 (PRINCIPLES_v2 §1)
- **Default**: controlled change — 매 default 변경마다 `spring-info/09_finalization/DEFAULT_CHANGELOG.md` entry 필수 (PRINCIPLES_v2 §2)
- **PR 크기**: ≤300 LOC per commit, 1 commit = 1 intent
- **검증**: `npm run test:snapshot` 15/15 PASS + intentional baseline 변경 시 `validate:default-change` classification 필수
- **Merge style**: `gh pr merge --rebase --delete-branch` (squash 금지)
