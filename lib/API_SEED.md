# seed-ts API Contract

한국 이름 평가/추천 엔진. 생년월일시 + 성씨(한자) + 이름 → 다차원 점수 분석.

saju-ts 분석 결과를 기반으로 음양오행, 자원오행, 사격수리, 사주 균형을 종합 평가한다.

---

## Entry Points

```typescript
// 비동기 전체 분석 (권장)
class SeedEngine {
  async init(): Promise<void>;
  async analyze(request: SeedRequest): Promise<SeedResponse>;
  close(): void;
}

// 동기 분석 (UI 호환 래퍼)
class SeedTs {
  analyze(userInfo: UserInfo): SeedResult;
  async analyzeAsync(request: SeedRequest): Promise<SeedResponse>;
}
```

---

## Input

### SeedRequest (메인 API 입력)

```typescript
interface SeedRequest {
  readonly birth: BirthInfo;
  readonly surname: NameCharInput[];        // 1-2자, hanja 필수
  readonly givenName?: NameCharInput[];     // 0~N자, hanja 선택
  readonly givenNameLength?: number;        // 생성 시 원하는 글자수 (default: 2)
  readonly mode?: 'auto' | 'evaluate' | 'recommend' | 'all';
  readonly options?: SeedOptions;
}
```

### BirthInfo

saju-ts의 BirthInput을 완전히 포괄한다.

```typescript
interface BirthInfo {
  readonly year: number;
  readonly month: number;       // 1-12
  readonly day: number;         // 1-31
  readonly hour: number;        // 0-23
  readonly minute: number;      // 0-59
  readonly gender: 'male' | 'female';
  readonly isLunar?: boolean;   // true면 음력→양력 변환
  readonly timezone?: string;   // default: 'Asia/Seoul'
  readonly latitude?: number;   // default: 37.5665
  readonly longitude?: number;  // default: 126.978
  readonly name?: string;       // 이름 (saju-ts 전달용)
}
```

### NameCharInput

```typescript
interface NameCharInput {
  readonly hangul: string;      // 한글 (필수)
  readonly hanja?: string;      // 한자 (없으면 엔진이 최적 탐색)
}
```

### SeedOptions

```typescript
interface SeedOptions {
  readonly limit?: number;                   // default: 20
  readonly offset?: number;                  // default: 0
  readonly schoolPreset?: 'korean' | 'chinese' | 'modern';
  readonly weights?: ScoreWeights;
  readonly sajuConfig?: Record<string, unknown>;   // saju-ts CalculationConfig 직접 전달
  readonly sajuOptions?: {
    readonly daeunCount?: number;             // 대운 수 (default: 8)
    readonly saeunStartYear?: number | null;  // 세운 시작년
    readonly saeunYearCount?: number;         // 세운 연수 (default: 10)
  };
}

interface ScoreWeights {
  readonly hangul?: number;     // default: 25
  readonly hanja?: number;      // default: 25
  readonly fourFrame?: number;  // default: 25
  readonly saju?: number;       // default: 25
}
```

#### saju-ts 설정 전달 경로

| seed-ts 필드 | saju-ts 대응 | 동작 |
|---|---|---|
| `schoolPreset` | `configFromPreset(SchoolPreset)` | 프리셋 기반 CalculationConfig 생성 |
| `sajuConfig` | `CalculationConfig` (부분) | 프리셋 위에 병합. 개별 필드 오버라이드 가능 |
| `sajuOptions.daeunCount` | `SajuAnalysisOptions.daeunCount` | 대운 수 |
| `sajuOptions.saeunStartYear` | `SajuAnalysisOptions.saeunStartYear` | 세운 시작년 |
| `sajuOptions.saeunYearCount` | `SajuAnalysisOptions.saeunYearCount` | 세운 연수 |

### Mode 결정 규칙

| mode | 동작 |
|------|------|
| `'auto'` | givenName에 모든 hanja가 있으면 `evaluate`, 아니면 `recommend` |
| `'evaluate'` | 주어진 이름 하나만 평가 |
| `'recommend'` | 사주+사격수리 최적 후보 생성 (최대 500개) |
| `'all'` | recommend + 주어진 이름도 포함 |

---

## Output

### SeedResponse (최상위 결과)

```typescript
interface SeedResponse {
  readonly request: SeedRequest;
  readonly mode: 'evaluate' | 'recommend' | 'all';
  readonly saju: SajuSummary;           // saju-ts 전체 분석 결과
  readonly candidates: SeedCandidate[];
  readonly totalCount: number;
  readonly meta: {
    readonly version: string;       // '2.0.0'
    readonly timestamp: string;     // ISO 8601
  };
}
```

---

### SeedCandidate (이름 후보)

```typescript
interface SeedCandidate {
  readonly name: {
    readonly surname: CharDetail[];
    readonly givenName: CharDetail[];
    readonly fullHangul: string;
    readonly fullHanja: string;
  };
  readonly scores: {
    readonly total: number;       // 가중 평균 (0-100)
    readonly hangul: number;      // 음양오행 (0-100)
    readonly hanja: number;       // 자원오행 (0-100)
    readonly fourFrame: number;   // 사격수리 (0-100)
    readonly saju: number;        // 사주 균형 (0-100)
  };
  readonly analysis: {
    readonly hangul: HangulAnalysis;
    readonly hanja: HanjaAnalysis;
    readonly fourFrame: FourFrameAnalysis;
    readonly saju: SajuCompatibility;
  };
  readonly interpretation: string;
  readonly rank: number;          // 1-based
}
```

#### CharDetail

```typescript
interface CharDetail {
  readonly hangul: string;
  readonly hanja: string;
  readonly meaning: string;
  readonly strokes: number;
  readonly element: string;       // 자원오행 ('Wood' | 'Fire' | ...)
  readonly polarity: string;      // 음양 ('Positive' | 'Negative')
}
```

#### HangulAnalysis (음양오행 분석)

```typescript
interface HangulAnalysis {
  readonly blocks: Array<{
    hangul: string;
    onset: string;
    nucleus: string;
    element: string;
    polarity: string;
  }>;
  readonly polarityScore: number;
  readonly elementScore: number;
}
```

#### HanjaAnalysis (자원오행 분석)

```typescript
interface HanjaAnalysis {
  readonly blocks: Array<{
    hanja: string;
    hangul: string;
    strokes: number;
    resourceElement: string;
    strokeElement: string;
    polarity: string;
  }>;
  readonly polarityScore: number;
  readonly elementScore: number;
}
```

#### FourFrameAnalysis (사격수리 분석)

```typescript
interface FourFrameAnalysis {
  readonly frames: Array<{
    type: 'won' | 'hyung' | 'lee' | 'jung';
    strokeSum: number;
    element: string;
    polarity: string;
    luckyLevel: number;
  }>;
  readonly elementScore: number;
  readonly luckScore: number;
}
```

#### SajuCompatibility (사주 호환성 분석)

```typescript
interface SajuCompatibility {
  readonly yongshinElement: string;
  readonly heeshinElement: string | null;
  readonly gishinElement: string | null;
  readonly nameElements: string[];
  readonly yongshinMatchCount: number;
  readonly yongshinGeneratingCount: number;
  readonly gishinMatchCount: number;
  readonly gishinOvercomingCount: number;
  readonly deficiencyFillCount: number;
  readonly excessiveAvoidCount: number;
  readonly dayMasterSupportScore: number;
  readonly affinityScore: number;
}
```

---

### SajuSummary (saju-ts 전체 분석 결과)

saju-ts의 `SajuAnalysis` 전체를 직렬화 가능한 형태로 포함한다.
`raw` 필드에 원본 전체가 보존되므로 향후 saju-ts가 확장되어도 API 변경 불필요.

```typescript
interface SajuSummary {
  readonly pillars: {
    readonly year: PillarSummary;
    readonly month: PillarSummary;
    readonly day: PillarSummary;
    readonly hour: PillarSummary;
  };
  readonly timeCorrection: TimeCorrectionSummary;
  readonly dayMaster: { stem: string; element: string; polarity: string };
  readonly strength: StrengthSummary;
  readonly yongshin: YongshinSummary;
  readonly gyeokguk: GyeokgukSummary;
  readonly ohaengDistribution: Record<string, number>;
  readonly deficientElements: string[];
  readonly excessiveElements: string[];
  readonly cheonganRelations: CheonganRelationSummary[];
  readonly hapHwaEvaluations: HapHwaEvaluationSummary[];
  readonly jijiRelations: JijiRelationSummary[];
  readonly sibiUnseong: Record<string, string> | null;
  readonly gongmang: [string, string] | null;
  readonly tenGodAnalysis: TenGodSummary | null;
  readonly shinsalHits: ShinsalHitSummary[];
  readonly shinsalComposites: ShinsalCompositeSummary[];
  readonly palaceAnalysis: Record<string, PalaceSummary> | null;
  readonly daeunInfo: DaeunSummary | null;
  readonly saeunPillars: SaeunPillarSummary[];
  readonly trace: TraceSummary[];
  readonly raw: Record<string, unknown>;    // saju-ts 원본 전체 (future-proof)
}
```

#### PillarSummary

```typescript
interface PillarSummary {
  readonly stem: { code: string; hangul: string; hanja: string };
  readonly branch: { code: string; hangul: string; hanja: string };
}
```

천간/지지 매핑: code(`GAP`) → hangul(`갑`) → hanja(`甲`) 자동 변환.

#### TimeCorrectionSummary

```typescript
interface TimeCorrectionSummary {
  readonly adjustedYear: number;
  readonly adjustedMonth: number;
  readonly adjustedDay: number;
  readonly adjustedHour: number;
  readonly adjustedMinute: number;
  readonly dstCorrectionMinutes: number;
  readonly longitudeCorrectionMinutes: number;
  readonly equationOfTimeMinutes: number;
}
```

#### StrengthSummary (신강/신약)

```typescript
interface StrengthSummary {
  readonly level: string;           // StrengthLevel enum
  readonly isStrong: boolean;
  readonly totalSupport: number;
  readonly totalOppose: number;
  readonly deukryeong: number;      // 득령
  readonly deukji: number;          // 득지
  readonly deukse: number;          // 득세
  readonly details: string[];
}
```

#### YongshinSummary (용신)

```typescript
interface YongshinSummary {
  readonly element: string;
  readonly heeshin: string | null;
  readonly gishin: string | null;
  readonly gushin: string | null;
  readonly confidence: number;           // 0.0 ~ 1.0
  readonly agreement: string;            // YongshinAgreement
  readonly recommendations: YongshinRecommendationSummary[];
}

interface YongshinRecommendationSummary {
  readonly type: string;                 // YongshinType (EOKBU, JOHU, ...)
  readonly primaryElement: string;
  readonly secondaryElement: string | null;
  readonly confidence: number;
  readonly reasoning: string;
}
```

#### GyeokgukSummary (격국)

```typescript
interface GyeokgukSummary {
  readonly type: string;                 // GyeokgukType
  readonly category: string;             // GyeokgukCategory
  readonly baseSipseong: string | null;
  readonly confidence: number;
  readonly reasoning: string;
}
```

#### CheonganRelationSummary (천간 관계)

```typescript
interface CheonganRelationSummary {
  readonly type: string;                 // 'HAP' | 'CHUNG'
  readonly stems: string[];
  readonly resultElement: string | null;
  readonly note: string;
}

interface HapHwaEvaluationSummary {
  readonly stem1: string;
  readonly stem2: string;
  readonly position1: string;
  readonly position2: string;
  readonly resultElement: string;
  readonly state: string;                // 'HAPWHA' | 'HAPGEO' | 'NOT_ESTABLISHED'
  readonly confidence: number;
  readonly reasoning: string;
  readonly dayMasterInvolved: boolean;
}
```

#### JijiRelationSummary (지지 관계)

```typescript
interface JijiRelationSummary {
  readonly type: string;                 // JijiRelationType
  readonly branches: string[];
  readonly note: string;
  readonly outcome: string | null;       // InteractionOutcome (resolved 시)
  readonly reasoning: string | null;
}
```

#### TenGodSummary (십신)

```typescript
interface TenGodSummary {
  readonly dayMaster: string;
  readonly byPosition: Record<string, TenGodPositionSummary>;
}

interface TenGodPositionSummary {
  readonly cheonganSipseong: string;
  readonly jijiPrincipalSipseong: string;
  readonly hiddenStems: Array<{ stem: string; element: string; ratio: number }>;
  readonly hiddenStemSipseong: Array<{ stem: string; sipseong: string }>;
}
```

#### ShinsalHitSummary (신살)

```typescript
interface ShinsalHitSummary {
  readonly type: string;
  readonly position: string;
  readonly grade: string;                // 'A' | 'B' | 'C'
  readonly baseWeight: number;
  readonly positionMultiplier: number;
  readonly weightedScore: number;
}

interface ShinsalCompositeSummary {
  readonly patternName: string;
  readonly interactionType: string;
  readonly interpretation: string;
  readonly bonusScore: number;
}
```

#### PalaceSummary (궁 분석)

```typescript
interface PalaceSummary {
  readonly position: string;
  readonly koreanName: string;
  readonly domain: string;
  readonly agePeriod: string;
  readonly bodyPart: string;
  readonly sipseong: string | null;
  readonly familyRelation: string | null;
}
```

#### DaeunSummary (대운)

```typescript
interface DaeunSummary {
  readonly isForward: boolean;
  readonly firstDaeunStartAge: number;
  readonly firstDaeunStartMonths: number;
  readonly boundaryMode: string;
  readonly warnings: string[];
  readonly pillars: DaeunPillarSummary[];
}

interface DaeunPillarSummary {
  readonly stem: string;
  readonly branch: string;
  readonly startAge: number;
  readonly endAge: number;
  readonly order: number;
}
```

#### SaeunPillarSummary (세운)

```typescript
interface SaeunPillarSummary {
  readonly year: number;
  readonly stem: string;
  readonly branch: string;
}
```

#### TraceSummary (분석 추적)

```typescript
interface TraceSummary {
  readonly key: string;
  readonly summary: string;
  readonly evidence: string[];
  readonly citations: string[];
  readonly reasoning: string[];
  readonly confidence: number | null;
}
```

---

## Scoring Pipeline

```
SeedRequest
  → init()              DB/WASM 로드 (idempotent)
  → resolveMode()       auto/evaluate/recommend/all 결정
  → analyzeSaju(birth, options)
      ├── schoolPreset → configFromPreset()
      ├── sajuConfig → CalculationConfig 병합
      ├── sajuOptions → SajuAnalysisOptions 전달
      └── extractSaju() → SajuSummary (전체 + raw)
  → generateCandidates() recommend/all 모드: FourFrameOptimizer로 후보 생성
  → scoreCandidate() × N:
      │
      ├─ HangulCalculator.visit()
      │    ├─ BALEUM_OHAENG:  발음오행 배치 + 균형
      │    └─ BALEUM_EUMYANG: 모음 음양 조화
      │
      ├─ HanjaCalculator.visit()
      │    ├─ HOEKSU_OHAENG:  획수오행 배치 + 균형
      │    └─ HOEKSU_EUMYANG: 획수 음양 조화
      │
      ├─ FrameCalculator.visit()
      │    ├─ SAGYEOK_SURI:   사격수리 운수 등급
      │    └─ SAGYEOK_OHAENG: 사격 오행 배치
      │
      └─ SajuCalculator.visit()
           └─ SAJU_JAWON_BALANCE: 사주+자원 오행 균형
                ├─ balance:   사주-이름 오행 분포 최적화
                ├─ yongshin:  용신/희신/기신/구신 매칭
                ├─ strength:  일간 강약 보조
                └─ tenGod:    십신 균형 보조
  │
  → evaluateName()      DAG 실행 + 가중 평균 + 적응형 통과 판정
  → 정렬 + 페이징
  → SeedResponse 조립
```

---

## Usage Example

```typescript
import { SeedEngine } from 'seed-ts';

const engine = new SeedEngine();
const response = await engine.analyze({
  birth: {
    year: 1986, month: 4, day: 19,
    hour: 5, minute: 45, gender: 'male',
  },
  surname: [{ hangul: '최', hanja: '崔' }],
  givenName: [
    { hangul: '성', hanja: '成' },
    { hangul: '수', hanja: '秀' },
  ],
  mode: 'evaluate',
  options: {
    schoolPreset: 'korean',
    sajuOptions: { daeunCount: 10 },
  },
});

// 이름 점수
response.candidates[0].scores.total    // 종합 점수
response.candidates[0].scores.saju     // 사주 균형 점수
response.candidates[0].analysis.saju   // SajuCompatibility 상세

// 사주 분석 전체
response.saju.pillars.day.stem         // { code: 'BYEONG', hangul: '병', hanja: '丙' }
response.saju.dayMaster                // { stem: 'BYEONG', element: 'FIRE', polarity: 'YANG' }
response.saju.strength                 // { level, isStrong, totalSupport, totalOppose, ... }
response.saju.yongshin                 // { element, heeshin, recommendations[], ... }
response.saju.gyeokguk                 // { type, category, baseSipseong, ... }
response.saju.ohaengDistribution       // { WOOD: 2, FIRE: 3, ... }
response.saju.deficientElements        // ['METAL']
response.saju.excessiveElements        // ['FIRE']

// 관계/운성
response.saju.cheonganRelations        // 천간 합충
response.saju.jijiRelations            // 지지 관계 (해석 포함)
response.saju.sibiUnseong              // 십이운성
response.saju.gongmang                 // 공망

// 십신/신살/궁
response.saju.tenGodAnalysis           // 십신 분석
response.saju.shinsalHits              // 신살
response.saju.palaceAnalysis           // 궁 분석

// 운세
response.saju.daeunInfo                // 대운
response.saju.saeunPillars             // 세운

// 시간 보정
response.saju.timeCorrection           // DST, 경도, 균시차 보정

// 원본 전체 (future-proof)
response.saju.raw                      // saju-ts SajuAnalysis 전체 직렬화

engine.close();
```

---

## saju-ts 연동

SeedEngine은 saju-ts를 동적 import하여 전체 분석 결과를 추출한다.

**입력 전달 경로:**
```
SeedRequest.birth           → createBirthInput()
SeedRequest.options.schoolPreset  → configFromPreset()
SeedRequest.options.sajuConfig    → CalculationConfig (병합)
SeedRequest.options.sajuOptions   → SajuAnalysisOptions
                                  → analyzeSaju(bi, config, options)
```

**출력 추출 경로:**
```
SajuAnalysis
  → extractSaju()
      ├─ pillars        → PillarSummary × 4 (hangul/hanja 자동 매핑)
      ├─ coreResult     → TimeCorrectionSummary
      ├─ strengthResult → StrengthSummary (전체 점수 + details)
      ├─ yongshinResult → YongshinSummary (전체 recommendations)
      ├─ gyeokgukResult → GyeokgukSummary (baseSipseong + reasoning)
      ├─ tenGodAnalysis → TenGodSummary (position별 십성)
      ├─ 관계           → cheonganRelations, hapHwaEvaluations, jijiRelations
      ├─ sibiUnseong    → Record<position, stage>
      ├─ gongmang       → [branch, branch]
      ├─ 신살           → shinsalHits, shinsalComposites
      ├─ palaceAnalysis → Record<position, PalaceSummary>
      ├─ daeunInfo      → DaeunSummary (pillars 포함)
      ├─ saeunPillars   → SaeunPillarSummary[]
      ├─ trace          → TraceSummary[]
      └─ serialize(a)   → raw (Map/Set/Class → 순수 JSON)
```

saju-ts 로드 실패 시 fallback SajuSummary를 사용하여 사주 없이도 동작.
`raw` 필드에 원본이 완전 보존되므로 saju-ts 확장 시 API 변경 불필요.
