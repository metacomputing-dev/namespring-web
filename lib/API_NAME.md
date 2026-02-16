# name-ts API Contract

한국 이름의 성명학적 분석을 수행하는 순수 계산 엔진.

사주(四柱)와 무관하게, 이름 자체의 발음 오행·획수 오행·사격 수리를 평가한다.

> **역할 독립성**: name-ts는 사주(saju-ts)나 통합 엔진(spring-ts)에 대해 전혀 모른다.
> 오직 이름 자체의 성명학적 분석만 수행하며, 외부 모듈에 의존하지 않는다.
> 사주와 이름을 결합한 분석이 필요하면 spring-ts를 사용한다.

---

## Entry Point

```typescript
class NameTs {
  analyze(userInfo: UserInfo): NameResult;
}
```

동기 함수. DB나 사주 분석 없이 순수 계산만 수행한다.

---

## Input

### UserInfo

```typescript
type Gender = 'male' | 'female';

interface UserInfo {
  readonly lastName: HanjaEntry[];     // 성씨 (1-2자)
  readonly firstName: HanjaEntry[];    // 이름 (1-4자)
  readonly birthDateTime: {
    year: number;
    month: number;       // 1-12
    day: number;         // 1-31
    hour: number;        // 0-23
    minute: number;      // 0-59
  };
  readonly gender: Gender;
}
```

### HanjaEntry (DB 레코드)

`HanjaRepository`에서 조회한 한자 정보. `makeFallbackEntry(hangul)`로 한글만으로도 생성 가능.

```typescript
interface HanjaEntry {
  readonly hangul: string;           // 한글 (e.g. "김")
  readonly hanja: string;            // 한자 (e.g. "金")
  readonly meaning: string;          // 뜻풀이 (e.g. "쇠 금, 성씨 김")
  readonly strokes: number;          // 총 획수
  readonly resource_element: string; // 자원오행 ('Wood' | 'Fire' | 'Earth' | 'Metal' | 'Water')
  readonly onset: string;            // 초성 (e.g. "ㄱ")
  readonly nucleus: string;          // 중성 (e.g. "ㅣ")
}
```

---

## Output

### NameResult

```typescript
interface NameResult {
  readonly candidates: NamingResult[];   // 항상 1개 (평가 모드)
  readonly totalCount: number;           // 항상 1
}
```

### NamingResult

```typescript
interface NamingResult {
  readonly lastName: HanjaEntry[];
  readonly firstName: HanjaEntry[];
  readonly totalScore: number;           // 종합 점수 (0-100)
  readonly hangul: unknown;              // HangulCalculator 인스턴스
  readonly hanja: unknown;               // HanjaCalculator 인스턴스
  readonly fourFrames: unknown;          // FrameCalculator 인스턴스
  readonly interpretation: string;       // 해석 텍스트
}
```

`hangul`, `hanja`, `fourFrames`는 `unknown`으로 선언되어 있으며, 각각 `getAnalysis()`와 `getNameBlocks()`를 호출하여 상세 분석 결과에 접근할 수 있다.

---

## Analysis Types

### HangulAnalysis (발음 오행 분석)

```typescript
interface HangulAnalysis {
  readonly blocks: Array<{
    hangul: string;       // 한글 음절 (e.g. "김")
    onset: string;        // 초성 (e.g. "ㄱ")
    nucleus: string;      // 중성 (e.g. "ㅣ")
    element: string;      // 발음 오행 ('Wood' | 'Fire' | 'Earth' | 'Metal' | 'Water')
    polarity: string;     // 음양 ('Positive' | 'Negative')
  }>;
  readonly polarityScore: number;    // 음양 균형 점수 (0-100)
  readonly elementScore: number;     // 오행 조화 점수 (0-100)
}
```

### HanjaAnalysis (획수 오행 분석)

```typescript
interface HanjaAnalysis {
  readonly blocks: Array<{
    hanja: string;            // 한자 (e.g. "金")
    hangul: string;           // 한글 독음 (e.g. "김")
    strokes: number;          // 총 획수
    resourceElement: string;  // 자원오행 (부수 기반)
    strokeElement: string;    // 획수오행 (끝자리 기반)
    polarity: string;         // 음양 (홀수=양, 짝수=음)
  }>;
  readonly polarityScore: number;    // 음양 균형 점수 (0-100)
  readonly elementScore: number;     // 오행 조화 점수 (0-100)
}
```

### FourFrameAnalysis (사격 수리 분석)

```typescript
interface FourFrameAnalysis {
  readonly frames: Array<{
    type: 'won' | 'hyung' | 'lee' | 'jung';   // 원격/형격/이격/정격
    strokeSum: number;       // 획수 합
    element: string;         // 오행 (끝자리 기반)
    polarity: string;        // 음양 (홀짝)
    luckyLevel: number;      // 길흉 등급 (0-25)
  }>;
  readonly elementScore: number;     // 사격 오행 조화 점수 (0-100)
  readonly luckScore: number;        // 수리 길흉 종합 점수 (0-100)
}
```

---

## Evaluation Pipeline

```
NameTs.analyze(userInfo)
  │
  ├─ HangulCalculator.visit()
  │    ├─ HANGUL_ELEMENT:   초성→오행 배치 + 상생/상극 + 균형
  │    └─ HANGUL_POLARITY:  모음→음양 배치 + 균형
  │
  ├─ HanjaCalculator.visit()
  │    ├─ STROKE_ELEMENT:   획수오행 배치 + 상생/상극 + 균형
  │    └─ STROKE_POLARITY:  획수 홀짝→음양 배치 + 균형
  │
  ├─ FrameCalculator.visit()
  │    ├─ FOURFRAME_LUCK:    원형이정 4격 수리 길흉
  │    └─ FOURFRAME_ELEMENT: 사격 오행 배치 + 상생/상극
  │
  └─ evaluateName()
       ├─ 모든 signal 수집
       ├─ 가중 평균 계산
       ├─ 통과 판정 (모든 signal 통과 AND 최소 점수 충족)
       └─ EvaluationResult 반환
```

### EvalFrame (평가 프레임)

| Frame | 설명 | 기본 가중치 |
|-------|------|------------|
| `HANGUL_ELEMENT` | 발음 오행 조화 | 0.6 |
| `HANGUL_POLARITY` | 발음 음양 균형 | 0.6 |
| `STROKE_ELEMENT` | 획수 오행 조화 | 0.6 |
| `STROKE_POLARITY` | 획수 음양 균형 | 0.6 |
| `FOURFRAME_LUCK` | 사격 수리 길흉 | 1.0 |
| `FOURFRAME_ELEMENT` | 사격 오행 조화 | 0.6 |

---

## Database Repositories

### HanjaRepository (한자 사전)

```typescript
class SqliteRepository {
  async init(dbPath: string, wasmBinaryUrl?: string): Promise<void>;
  close(): void;
}

class HanjaRepository {
  constructor(sqliteRepo: SqliteRepository);
  getEntry(hanja: string): HanjaEntry | null;
  searchByHangul(hangul: string): HanjaEntry[];
  searchByStrokeRange(min: number, max: number): HanjaEntry[];
  getByElement(element: string): HanjaEntry[];
}
```

### FourframeRepository (사격수 의미)

```typescript
class FourframeRepository {
  constructor(sqliteRepo: SqliteRepository);
  getMeaning(number: number): FourframeMeaningEntry | null;
  getAll(limit?: number): FourframeMeaningEntry[];
}

interface FourframeMeaningEntry {
  readonly number: number;        // 1-81
  readonly fortune: string;       // 길흉 설명 (e.g. "대길 최상")
  readonly description: string;   // 상세 해석
}
```

### NameStatRepository (이름 통계)

```typescript
class NameStatRepository {
  constructor(sqliteRepo: SqliteRepository);
  getPopularity(hangul: string): number;
}
```

---

## Models

### Element (오행)

```typescript
class Element {
  static readonly Wood:  Element;
  static readonly Fire:  Element;
  static readonly Earth: Element;
  static readonly Metal: Element;
  static readonly Water: Element;

  readonly english: string;       // 'Wood', 'Fire', ...
  readonly korean: string;        // '목', '화', ...

  static get(name: string): Element;
  isGenerating(other: Element): boolean;    // 상생 관계인가?
  isOvercoming(other: Element): boolean;    // 상극 관계인가?
  isSameAs(other: Element): boolean;
}
```

### Polarity (음양)

```typescript
class Polarity {
  static readonly Positive: Polarity;   // 양 (Yang)
  static readonly Negative: Polarity;   // 음 (Yin)

  readonly english: string;    // 'Positive' | 'Negative'
  readonly korean: string;     // '양' | '음'

  static get(strokeCount: number): Polarity;   // 홀수→양, 짝수→음
}
```

### Energy (에너지)

```typescript
class Energy {
  readonly polarity: Polarity;
  readonly element: Element;

  constructor(polarity: Polarity, element: Element);

  static getPolarityScore(energies: Energy[]): number;   // 음양 균형 점수
  static getElementScore(energies: Energy[]): number;    // 오행 조화 점수
}
```

---

## Utilities

```typescript
// 한글 분해
function decomposeHangul(char: string): { onset: string; nucleus: string; coda: string };
const CHOSEONG: readonly string[];     // 초성 19개
const JUNGSEONG: readonly string[];    // 중성 21개

// 한자 fallback (DB 없이 한글만으로 HanjaEntry 생성)
function makeFallbackEntry(hangul: string): HanjaEntry;

// 사격 라벨
const FRAME_LABELS: Record<string, string>;   // { won: '원격', hyung: '형격', ... }

// 해석문 생성
function buildInterpretation(result: EvaluationResult): string;

// 자모 필터 파싱 (이름 후보 필터링용)
function parseJamoFilter(filter: string): JamoFilter;
interface JamoFilter {
  readonly onset?: string;
  readonly nucleus?: string;
  readonly coda?: string;
}
```

---

## Scoring Helpers (scoring.ts)

이름 분석 전반에서 공유하는 수학 함수.

```typescript
type ElementKey = 'Wood' | 'Fire' | 'Earth' | 'Metal' | 'Water';
type PolarityValue = 'Positive' | 'Negative';

// 오행 관계 판정
isOvercoming(a: ElementKey, b: ElementKey): boolean;     // 상극인가?
generatedBy(element: ElementKey): ElementKey;            // 이 오행을 생하는 오행

// 배열 점수
calculateArrayScore(arrangement: ElementKey[], surnameLength?: number): number;
calculateBalanceScore(distribution: Record<ElementKey, number>): number;
checkElementGenerating(arrangement: ElementKey[], surnameLength: number): boolean;
checkFourFrameSuriElement(arrangement: ElementKey[], givenNameLength: number): boolean;

// 분포 유틸
distributionFromArrangement(arrangement: ElementKey[]): Record<ElementKey, number>;
emptyDistribution(): Record<ElementKey, number>;
countDominant(distribution: Record<ElementKey, number>): boolean;

// 음양 점수
computePolarityResult(arrangement: PolarityValue[], surnameLength: number): { score: number; isPassed: boolean };

// 수리
adjustTo81(value: number): number;
bucketFromFortune(fortune: string): number;

// 수학
clamp(value: number, min: number, max: number): number;
normalizeSignedScore(value: number): number;    // [-1,+1] → [0,100]
sum(values: number[]): number;
```

---

## Usage Example

```typescript
import { NameTs, HanjaRepository, SqliteRepository, makeFallbackEntry } from 'name-ts';

// DB 기반
const sqliteRepo = new SqliteRepository();
await sqliteRepo.init('path/to/hanja.db');
const hanjaRepo = new HanjaRepository(sqliteRepo);

const nameTs = new NameTs();
const result = nameTs.analyze({
  lastName:  [hanjaRepo.getEntry('崔')!],
  firstName: [hanjaRepo.getEntry('成')!, hanjaRepo.getEntry('秀')!],
  birthDateTime: { year: 1986, month: 4, day: 19, hour: 5, minute: 45 },
  gender: 'male',
});

result.candidates[0].totalScore;        // 55.9
result.candidates[0].interpretation;    // "이름의 발음 오행은..."

// DB 없이 한글만으로
const result2 = nameTs.analyze({
  lastName:  [makeFallbackEntry('최')],
  firstName: [makeFallbackEntry('성'), makeFallbackEntry('수')],
  birthDateTime: { year: 1986, month: 4, day: 19, hour: 5, minute: 45 },
  gender: 'male',
});
```
