# spring-ts API Contract

name-ts (이름 분석) + saju-ts (사주 분석) 통합 작명 엔진.

생년월일시 + 성씨(한자) → 사주 분석 → 이름 평가/추천.

---

## Entry Point

```typescript
class SpringEngine {
  async init(): Promise<void>;

  // ── 3-메서드 API (신규) ──
  async getNamingReport(request: SpringRequest): Promise<NamingReport>;      // 이름만 분석 (사주 무관)
  async getSajuReport(request: SpringRequest): Promise<SajuReport>;          // 사주만 분석
  async getNameCandidates(request: SpringRequest): Promise<SpringReport[]>;  // 이름 추천 (통합)

  // ── 레거시 API (하위호환) ──
  async analyze(request: SpringRequest): Promise<SpringResponse>;

  getHanjaRepository(): HanjaRepository;  // 한자 검색용
  close(): void;
}
```

비동기 API. DB 로딩, 사주 분석, 후보 생성을 모두 처리한다.

saju-ts 모듈 로드 실패 시 콘솔에 warning이 출력되고, `SajuReport.sajuEnabled = false`로 이름 분석만 수행된다.

---

## Input

### SpringRequest (메인 API 입력)

```typescript
interface SpringRequest {
  readonly birth: BirthInfo;
  readonly surname: NameCharInput[];        // 1-2자, hanja 필수
  readonly givenName?: NameCharInput[];     // 0~N자, hanja 선택
  readonly givenNameLength?: number;        // 생성 시 원하는 글자수 (default: 2)
  readonly mode?: 'auto' | 'evaluate' | 'recommend' | 'all';
  readonly options?: SpringOptions;
}
```

### BirthInfo

```typescript
interface BirthInfo {
  readonly year: number;
  readonly month: number;       // 1-12
  readonly day: number;         // 1-31
  readonly hour: number;        // 0-23
  readonly minute: number;      // 0-59
  readonly gender: 'male' | 'female';
  readonly timezone?: string;   // default: 'Asia/Seoul'
  readonly latitude?: number;   // default: 37.5665
  readonly longitude?: number;  // default: 126.978
  readonly name?: string;       // saju-ts 전달용
}
```

### NameCharInput

```typescript
interface NameCharInput {
  readonly hangul: string;      // 한글 (필수)
  readonly hanja?: string;      // 한자 (없으면 엔진이 최적 탐색)
}
```

### SpringOptions

```typescript
interface SpringOptions {
  readonly limit?: number;                   // default: 20
  readonly offset?: number;                  // default: 0
  readonly schoolPreset?: 'korean' | 'chinese' | 'modern';
  readonly sajuConfig?: Record<string, unknown>;
  readonly sajuOptions?: SajuRequestOptions;
}

interface SajuRequestOptions {
  readonly daeunCount?: number;              // 대운 수 (default: 8)
  readonly saeunStartYear?: number | null;   // 세운 시작년
  readonly saeunYearCount?: number;          // 세운 연수 (default: 10)
}
```

### Mode 결정 규칙

| mode | 동작 |
|------|------|
| `'auto'` | givenName에 모든 hanja가 있으면 `evaluate`, 아니면 `recommend` |
| `'evaluate'` | 주어진 이름 하나만 평가 |
| `'recommend'` | 사주+사격수리 최적 후보 생성 (최대 500개) |
| `'all'` | recommend + 주어진 이름도 포함 |

---

## Output

### SpringResponse (최상위 결과)

```typescript
interface SpringResponse {
  readonly request: SpringRequest;
  readonly mode: 'evaluate' | 'recommend' | 'all';
  readonly saju: SajuSummary;
  readonly candidates: SpringCandidate[];
  readonly totalCount: number;
  readonly meta: {
    readonly version: string;       // '2.0.0'
    readonly timestamp: string;     // ISO 8601
  };
}
```

---

### SpringCandidate (이름 후보)

```typescript
interface SpringCandidate {
  readonly name: {
    readonly surname: CharDetail[];
    readonly givenName: CharDetail[];
    readonly fullHangul: string;     // "최성수"
    readonly fullHanja: string;      // "崔成秀"
  };
  readonly scores: {
    readonly total: number;          // 가중 평균 (0-100)
    readonly hangul: number;         // 발음 오행 (0-100)
    readonly hanja: number;          // 획수 오행 (0-100)
    readonly fourFrame: number;      // 사격 수리 (0-100)
    readonly saju: number;           // 사주 궁합 (0-100)
  };
  readonly analysis: {
    readonly hangul: HangulAnalysis;
    readonly hanja: HanjaAnalysis;
    readonly fourFrame: FourFrameAnalysis;
    readonly saju: SajuCompatibility;
  };
  readonly interpretation: string;
  readonly rank: number;             // 1-based
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

---

### NamingReport (이름 분석 결과 — getNamingReport)

사주와 무관한 순수 이름 분석. name-ts 계산기 3개만 사용.

```typescript
interface NamingReport {
  readonly name: CandidateName;
  readonly totalScore: number;          // 이름 종합 점수 (0-100, 사주 제외)
  readonly scores: {
    hangul: number;                     // 발음 오행 (0-100)
    hanja: number;                      // 획수 오행 (0-100)
    fourFrame: number;                  // 사격 수리 (0-100)
  };
  readonly analysis: {
    readonly hangul: HangulAnalysis;
    readonly hanja: HanjaAnalysis;
    readonly fourFrame: NamingReportFourFrame;  // 의미 데이터 포함
  };
  readonly interpretation: string;
}
```

#### NamingReportFourFrame (사격 분석 + 의미)

```typescript
interface NamingReportFourFrame {
  readonly frames: NamingReportFrame[];
  readonly elementScore: number;
  readonly luckScore: number;
}

interface NamingReportFrame {
  readonly type: 'won' | 'hyung' | 'lee' | 'jung';
  readonly strokeSum: number;
  readonly element: string;
  readonly polarity: string;
  readonly luckyLevel: number;
  readonly meaning: Record<string, unknown> | null;  // FourframeMeaningEntry
}
```

`meaning`에는 `title`, `summary`, `detailed_explanation`, `positive_aspects`, `caution_points`, `personality_traits`, `suitable_career`, `lucky_level` 등이 포함된다.

---

### SajuReport (사주 분석 결과 — getSajuReport)

SajuSummary에 모듈 활성화 상태 플래그를 추가한 타입.

```typescript
type SajuReport = SajuSummary & {
  readonly sajuEnabled: boolean;  // saju-ts 모듈 로드 성공 여부
};
```

`sajuEnabled: false`이면 사주 데이터는 모두 빈 값(empty fallback)이다.

---

### SpringReport (통합 결과 — getNameCandidates)

```typescript
interface SpringReport {
  readonly finalScore: number;                  // 사주+이름 통합 점수 (0-100)
  readonly namingReport: NamingReport;          // 이름 분석
  readonly sajuReport: SajuReport;              // 사주 분석
  readonly sajuCompatibility: SajuCompatibility; // 사주-이름 궁합
  rank: number;                                 // 1-based 순위
}
```

---

### Analysis Types

`HangulAnalysis`, `HanjaAnalysis`, `FourFrameAnalysis`는 name-ts와 동일. [API_NAME.md](./API_NAME.md) 참조.

#### SajuCompatibility (사주 호환성)

```typescript
interface SajuCompatibility {
  readonly yongshinElement: string;          // 용신 오행
  readonly heeshinElement: string | null;    // 희신 오행
  readonly gishinElement: string | null;     // 기신 오행
  readonly nameElements: string[];           // 이름의 오행 배열
  readonly yongshinMatchCount: number;       // 용신과 일치하는 글자 수
  readonly gishinMatchCount: number;         // 기신과 일치하는 글자 수
  readonly dayMasterSupportScore: number;    // 일간 보조 점수
  readonly affinityScore: number;            // 종합 친화도 점수
}
```

---

### SajuSummary (사주 전체 분석)

saju-ts의 분석 결과를 직렬화 가능한 형태로 정규화한 것.
`[key: string]: unknown` 인덱스 시그니처로 saju-ts 확장에 자동 대응.

```typescript
interface SajuSummary {
  readonly pillars: Record<'year' | 'month' | 'day' | 'hour', PillarSummary>;
  readonly timeCorrection: TimeCorrectionSummary;
  readonly dayMaster: DayMasterSummary;
  readonly strength: StrengthSummary;
  readonly yongshin: YongshinSummary;
  readonly gyeokguk: GyeokgukSummary;
  readonly elementDistribution: Record<string, number>;
  readonly deficientElements: string[];
  readonly excessiveElements: string[];
  readonly cheonganRelations: CheonganRelationSummary[];
  readonly jijiRelations: JijiRelationSummary[];
  readonly tenGodAnalysis: TenGodSummary | null;
  readonly shinsalHits: ShinsalHitSummary[];
  readonly gongmang: [string, string] | null;
  readonly [key: string]: unknown;
}
```

#### PillarSummary (사주 기둥)

```typescript
interface PillarSummary {
  readonly stem:   { code: string; hangul: string; hanja: string };
  readonly branch: { code: string; hangul: string; hanja: string };
}
```

천간/지지 매핑: code(`GAP`) → hangul(`갑`) → hanja(`甲`) 자동 변환.

#### DayMasterSummary (일간)

```typescript
interface DayMasterSummary {
  readonly stem: string;         // 천간 코드 (e.g. 'BYEONG')
  readonly element: string;      // 오행 (e.g. 'FIRE')
  readonly polarity: string;     // 음양 (e.g. 'YANG')
}
```

#### TimeCorrectionSummary (시간 보정)

```typescript
interface TimeCorrectionSummary {
  readonly standardYear: number;
  readonly standardMonth: number;
  readonly standardDay: number;
  readonly standardHour: number;
  readonly standardMinute: number;
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
  readonly element: string;                    // 용신 오행
  readonly heeshin: string | null;             // 희신
  readonly gishin: string | null;              // 기신
  readonly gushin: string | null;              // 구신
  readonly confidence: number;                 // 0.0 ~ 1.0
  readonly agreement: string;                  // 학파 간 일치도
  readonly recommendations: YongshinRecommendation[];
}

interface YongshinRecommendation {
  readonly type: string;                       // EOKBU, JOHU, TONGGWAN, ...
  readonly primaryElement: string;
  readonly secondaryElement: string | null;
  readonly confidence: number;
  readonly reasoning: string;
}
```

#### GyeokgukSummary (격국)

```typescript
interface GyeokgukSummary {
  readonly type: string;                // GyeokgukType
  readonly category: string;            // GyeokgukCategory
  readonly baseTenGod: string | null;   // 기반 십성
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
  readonly score: {
    readonly baseScore: number;
    readonly adjacencyBonus: number;
    readonly outcomeMultiplier: number;
    readonly finalScore: number;
    readonly rationale: string;
  } | null;
}
```

#### JijiRelationSummary (지지 관계)

```typescript
interface JijiRelationSummary {
  readonly type: string;
  readonly branches: string[];
  readonly note: string;
  readonly outcome: string | null;
  readonly reasoning: string | null;
}
```

#### TenGodSummary (십성)

```typescript
interface TenGodSummary {
  readonly dayMaster: string;
  readonly byPosition: Record<string, TenGodPosition>;
}

interface TenGodPosition {
  readonly cheonganTenGod: string;            // 천간 십성
  readonly jijiPrincipalTenGod: string;       // 지지 본기 십성
  readonly hiddenStems: HiddenStem[];
  readonly hiddenStemTenGod: HiddenStemTenGod[];
}

interface HiddenStem {
  readonly stem: string;
  readonly element: string;
  readonly ratio: number;
}

interface HiddenStemTenGod {
  readonly stem: string;
  readonly tenGod: string;
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
```

---

## Scoring Pipeline

```
SpringRequest
  → init()              DB/WASM 로드 (idempotent)
  → mode 결정            auto/evaluate/recommend/all
  → analyzeSaju(birth, options)
      ├── schoolPreset → configFromPreset()
      ├── sajuConfig → CalculationConfig 병합
      ├── sajuOptions → SajuAnalysisOptions 전달
      └── extractSaju() → SajuSummary (serialize-first 패턴)
  → generateCandidates()    recommend/all 모드: FourFrameOptimizer로 후보 생성
  → scoreCandidate() × N:
      │
      ├─ HangulCalculator.visit()
      │    ├─ HANGUL_ELEMENT:   발음오행 배치 + 균형
      │    └─ HANGUL_POLARITY:  모음 음양 조화
      │
      ├─ HanjaCalculator.visit()
      │    ├─ STROKE_ELEMENT:   획수오행 배치 + 균형
      │    └─ STROKE_POLARITY:  획수 음양 조화
      │
      ├─ FrameCalculator.visit()
      │    ├─ FOURFRAME_LUCK:    사격수리 운수 등급
      │    └─ FOURFRAME_ELEMENT: 사격 오행 배치
      │
      └─ SajuCalculator.visit()
           └─ SAJU:             사주+이름 오행 궁합
                ├─ balance:     사주-이름 오행 분포 최적화   (~40%)
                ├─ yongshin:    용신/희신/기신/구신 매칭     (~30%)
                ├─ strength:    일간 강약 보조               (~12%)
                └─ tenGod:      십성 균형 보조               (~5%)
  │
  → springEvaluateName()   이름점수 + 사주점수 적응형 가중합산
  → 정렬 + 페이징
  → SpringResponse 조립
```

---

## saju-ts 설정 전달 경로

| spring-ts 필드 | saju-ts 대응 | 동작 |
|---|---|---|
| `schoolPreset` | `configFromPreset(SchoolPreset)` | 프리셋 기반 CalculationConfig 생성 |
| `sajuConfig` | `CalculationConfig` (부분) | 프리셋 위에 병합. 개별 필드 오버라이드 가능 |
| `sajuOptions.daeunCount` | `SajuAnalysisOptions.daeunCount` | 대운 수 |
| `sajuOptions.saeunStartYear` | `SajuAnalysisOptions.saeunStartYear` | 세운 시작년 |
| `sajuOptions.saeunYearCount` | `SajuAnalysisOptions.saeunYearCount` | 세운 연수 |

saju-ts 로드 실패 시 fallback SajuSummary를 사용하여 사주 없이도 동작.

---

## Internal Adapter Types

spring-ts 내부에서 name-ts 계산기와 saju-ts 결과를 연결하는 데 사용하는 타입.

### SajuOutputSummary (내부용)

```typescript
interface SajuOutputSummary {
  dayMaster?: { element: ElementKey };
  strength?: { isStrong: boolean; totalSupport: number; totalOppose: number };
  yongshin?: SajuYongshinSummary;
  tenGod?: { groupCounts: Record<string, number> };
  gyeokguk?: { category: string; type: string; confidence: number };
  deficientElements?: string[];
  excessiveElements?: string[];
}

interface SajuYongshinSummary {
  finalYongshin: string;
  finalHeesin: string | null;
  gisin: string | null;
  gusin: string | null;
  finalConfidence: number;
  recommendations: YongshinRecommendation[];
}
```

---

## Usage Example

```typescript
import { SpringEngine } from 'spring-ts';

const engine = new SpringEngine();
await engine.init();

// 이름 평가
const evalResult = await engine.analyze({
  birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' },
  surname: [{ hangul: '최', hanja: '崔' }],
  givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }],
  mode: 'evaluate',
});

evalResult.candidates[0].scores.total     // 55.9
evalResult.candidates[0].scores.saju      // 38.7
evalResult.candidates[0].analysis.saju    // SajuCompatibility 상세

// 사주 분석 전체
evalResult.saju.pillars.day.stem          // { code: 'BYEONG', hangul: '병', hanja: '丙' }
evalResult.saju.dayMaster                 // { stem: 'BYEONG', element: 'FIRE', polarity: 'YANG' }
evalResult.saju.yongshin                  // { element, heeshin, recommendations[], ... }
evalResult.saju.elementDistribution       // { WOOD: 2, FIRE: 3, ... }
evalResult.saju.deficientElements         // ['METAL']

// 이름 추천
const recResult = await engine.analyze({
  birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' },
  surname: [{ hangul: '최', hanja: '崔' }],
  mode: 'recommend',
  options: { limit: 20, schoolPreset: 'korean' },
});

recResult.candidates.length               // 20
recResult.totalCount                      // 500 (전체 후보 수)

engine.close();
```

---

## Legacy API (NameTs)

name-ts의 동기 래퍼. DB/사주 분석 미사용, 순수 이름 분석만 수행. [API_NAME.md](./API_NAME.md) 참조.

spring-ts의 `index.ts`는 name-ts의 모든 public API를 re-export하므로, `spring-ts` 하나만 import하면 된다.

```typescript
import { NameTs, SpringEngine, type SpringRequest } from 'spring-ts';
```
