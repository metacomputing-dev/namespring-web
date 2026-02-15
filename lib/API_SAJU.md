# saju-ts API Contract

사주(四柱) 분석 엔진. 생년월일시 + 성별 + 위치 → 사주팔자 전체 분석.

---

## Entry Points

```typescript
// 전체 분석 (권장)
function analyzeSaju(
  input: BirthInput,
  config?: CalculationConfig,   // default: DEFAULT_CONFIG
  options?: Partial<SajuAnalysisOptions>,
): SajuAnalysis

// 사주 기둥만 계산
function calculatePillars(
  input: BirthInput,
  config?: CalculationConfig,
): SajuPillarResult

// 입력 생성 헬퍼
function createBirthInput(params: {
  birthYear: number;
  birthMonth: number;    // 1-12
  birthDay: number;      // 1-31
  birthHour: number;     // 0-23
  birthMinute: number;   // 0-59
  gender: Gender;        // 'MALE' | 'FEMALE'
  timezone?: string;     // default: 'Asia/Seoul'
  latitude?: number;     // default: 37.5665
  longitude?: number;    // default: 126.978
  name?: string;
}): BirthInput

// 설정 프리셋
function configFromPreset(preset: SchoolPreset): CalculationConfig
```

---

## Input

### BirthInput

```typescript
interface BirthInput {
  readonly birthYear: number;
  readonly birthMonth: number;
  readonly birthDay: number;
  readonly birthHour: number;
  readonly birthMinute: number;
  readonly gender: Gender;           // 'MALE' | 'FEMALE'
  readonly timezone: string;         // IANA timezone
  readonly latitude: number;
  readonly longitude: number;
  readonly name?: string;
}
```

### SajuAnalysisOptions

```typescript
interface SajuAnalysisOptions {
  readonly daeunCount: number;              // 대운 수 (default: 8)
  readonly saeunStartYear: number | null;   // 세운 시작년 (default: 출생년)
  readonly saeunYearCount: number;          // 세운 연수 (default: 10)
}
```

### CalculationConfig (주요 항목)

```typescript
interface CalculationConfig {
  // 시간/역법
  readonly dayCutMode: DayCutMode;
  readonly applyDstHistory: boolean;
  readonly includeEquationOfTime: boolean;
  readonly lmtBaselineLongitude: number;
  readonly jeolgiPrecision: JeolgiPrecision;

  // 지장간
  readonly hiddenStemVariant: HiddenStemVariant;
  readonly hiddenStemDayAllocation: HiddenStemDayAllocation;
  readonly saryeongMode: SaryeongMode;

  // 십이운성
  readonly earthLifeStageRule: EarthLifeStageRule;
  readonly yinReversalEnabled: boolean;

  // 신강/신약
  readonly deukryeongWeight: number;
  readonly proportionalDeukryeong: boolean;
  readonly strengthThreshold: number;

  // 용신
  readonly yongshinPriority: YongshinPriority;
  readonly jonggyeokYongshinMode: JonggyeokYongshinMode;

  // 합화
  readonly hapHwaStrictness: HapHwaStrictness;
  readonly allowBanhap: boolean;

  // 신살
  readonly gwiiinTable: GwiiinTableVariant;
  readonly shinsalReferenceBranch: ShinsalReferenceBranch;
}

enum SchoolPreset {
  KOREAN_MAINSTREAM = 'KOREAN_MAINSTREAM',
  TRADITIONAL_CHINESE = 'TRADITIONAL_CHINESE',
  MODERN_INTEGRATED = 'MODERN_INTEGRATED',
}

enum DayCutMode {
  MIDNIGHT_00 = 'MIDNIGHT_00',
  YAZA_23_TO_01_NEXTDAY = 'YAZA_23_TO_01_NEXTDAY',
  YAZA_23_30_TO_01_30_NEXTDAY = 'YAZA_23_30_TO_01_30_NEXTDAY',
  JOJA_SPLIT = 'JOJA_SPLIT',
}
```

---

## Output

### SajuAnalysis (최상위 결과)

```typescript
interface SajuAnalysis {
  readonly input: BirthInput;
  readonly coreResult: SajuPillarResult;

  // 사주 기둥
  readonly pillars: PillarSet;

  // 천간 관계
  readonly cheonganRelations: readonly CheonganRelationHit[];
  readonly hapHwaEvaluations: readonly HapHwaEvaluation[];
  readonly scoredCheonganRelations: readonly ScoredCheonganRelation[];

  // 지지 관계
  readonly resolvedJijiRelations: readonly ResolvedRelation[];
  readonly jijiRelations: readonly JijiRelationHit[];

  // 십이운성
  readonly sibiUnseong: Map<PillarPosition, SibiUnseong> | null;

  // 공망
  readonly gongmangVoidBranches: readonly [Jiji, Jiji] | null;

  // 신강/신약
  readonly strengthResult: StrengthResult | null;

  // 용신
  readonly yongshinResult: YongshinResult | null;

  // 격국
  readonly gyeokgukResult: GyeokgukResult | null;

  // 십신 (십성)
  readonly tenGodAnalysis: TenGodAnalysis | null;

  // 신살
  readonly shinsalHits: readonly ShinsalHit[];
  readonly weightedShinsalHits: readonly WeightedShinsalHit[];
  readonly shinsalComposites: readonly ShinsalComposite[];

  // 궁 분석
  readonly palaceAnalysis: Record<PillarPosition, PalaceAnalysis> | null;

  // 운세
  readonly daeunInfo: DaeunInfo | null;
  readonly saeunPillars: readonly SaeunPillar[];

  // 오행 분포
  readonly ohaengDistribution: Map<Ohaeng, number> | null;

  // 추적/설명
  readonly trace: readonly AnalysisTraceStep[];
  readonly analysisResults: ReadonlyMap<string, unknown>;
}
```

---

### 하위 결과 타입

#### PillarSet & Pillar

```typescript
class PillarSet {
  readonly year: Pillar;
  readonly month: Pillar;
  readonly day: Pillar;
  readonly hour: Pillar;
}

class Pillar {
  readonly cheongan: Cheongan;
  readonly jiji: Jiji;
  get label(): string;
}
```

#### SajuPillarResult (시간 보정 포함)

```typescript
interface SajuPillarResult {
  readonly input: BirthInput;
  readonly pillars: PillarSet;
  readonly standardYear: number;
  readonly standardMonth: number;
  readonly standardDay: number;
  readonly standardHour: number;
  readonly standardMinute: number;
  readonly adjustedYear: number;     // DST + LMT + EoT 보정 후
  readonly adjustedMonth: number;
  readonly adjustedDay: number;
  readonly adjustedHour: number;
  readonly adjustedMinute: number;
  readonly dstCorrectionMinutes: number;
  readonly longitudeCorrectionMinutes: number;
  readonly equationOfTimeMinutes: number;
}
```

#### StrengthResult (신강/신약)

```typescript
interface StrengthResult {
  readonly dayMaster: Cheongan;
  readonly level: StrengthLevel;
  readonly score: StrengthScore;
  readonly isStrong: boolean;
  readonly details: readonly string[];
}

interface StrengthScore {
  readonly deukryeong: number;
  readonly deukji: number;
  readonly deukse: number;
  readonly totalSupport: number;
  readonly totalOppose: number;
}

enum StrengthLevel {
  VERY_STRONG | STRONG | SLIGHTLY_STRONG |
  SLIGHTLY_WEAK | WEAK | VERY_WEAK
}
```

#### YongshinResult (용신)

```typescript
interface YongshinResult {
  readonly recommendations: readonly YongshinRecommendation[];
  readonly finalYongshin: Ohaeng;
  readonly finalHeesin: Ohaeng | null;
  readonly gisin: Ohaeng | null;
  readonly gusin: Ohaeng | null;
  readonly agreement: YongshinAgreement;
  readonly finalConfidence: number;         // 0.0 ~ 1.0
}

interface YongshinRecommendation {
  readonly type: YongshinType;
  readonly primaryElement: Ohaeng;
  readonly secondaryElement: Ohaeng | null;
  readonly confidence: number;
  readonly reasoning: string;
}

enum YongshinType {
  EOKBU | JOHU | TONGGWAN | GYEOKGUK |
  BYEONGYAK | JEONWANG | HAPWHA_YONGSHIN | ILHAENG_YONGSHIN
}
```

#### GyeokgukResult (격국)

```typescript
interface GyeokgukResult {
  readonly type: GyeokgukType;
  readonly category: GyeokgukCategory;
  readonly baseSipseong: Sipseong | null;
  readonly confidence: number;
  readonly reasoning: string;
  readonly formation: GyeokgukFormation | null;
}

enum GyeokgukCategory {
  NAEGYEOK | JONGGYEOK | HWAGYEOK | ILHAENG
}
```

#### TenGodAnalysis (십신)

```typescript
interface TenGodAnalysis {
  readonly dayMaster: Cheongan;
  readonly byPosition: Partial<Record<PillarPosition, PillarTenGodAnalysis>>;
}

interface PillarTenGodAnalysis {
  readonly cheonganSipseong: Sipseong;
  readonly jijiPrincipalSipseong: Sipseong;
  readonly hiddenStems: readonly HiddenStemEntry[];
  readonly hiddenStemSipseong: readonly HiddenStemSipseong[];
}

enum Sipseong {
  BI_GYEON | GYEOB_JAE | SIK_SIN | SANG_GWAN | PYEON_JAE |
  JEONG_JAE | PYEON_GWAN | JEONG_GWAN | PYEON_IN | JEONG_IN
}
```

#### DaeunInfo (대운)

```typescript
interface DaeunInfo {
  readonly isForward: boolean;
  readonly firstDaeunStartAge: number;
  readonly firstDaeunStartMonths: number;
  readonly daeunPillars: readonly DaeunPillar[];
  readonly boundaryMode: DaeunBoundaryMode;
  readonly warnings: readonly string[];
}

interface DaeunPillar {
  readonly pillar: Pillar;
  readonly startAge: number;
  readonly endAge: number;
  readonly order: number;
}
```

#### SaeunPillar (세운)

```typescript
interface SaeunPillar {
  readonly year: number;
  readonly pillar: Pillar;
}
```

#### 신살 (ShinsalHit)

```typescript
interface ShinsalHit {
  readonly type: ShinsalType;
  readonly position: PillarPosition;
  readonly grade: ShinsalGrade;    // A | B | C
}

interface WeightedShinsalHit {
  readonly hit: ShinsalHit;
  readonly baseWeight: number;
  readonly positionMultiplier: number;
  readonly weightedScore: number;
}

interface ShinsalComposite {
  readonly patternName: string;
  readonly interactionType: CompositeInteractionType;
  readonly involvedHits: readonly ShinsalHit[];
  readonly interpretation: string;
  readonly bonusScore: number;
}
```

#### 궁 분석 (PalaceAnalysis)

```typescript
interface PalaceAnalysis {
  readonly palaceInfo: PalaceInfo;
  readonly sipseong: Sipseong | null;
  readonly familyRelation: FamilyRelation | null;
  readonly interpretation: PalaceInterpretation | null;
}

interface PalaceInfo {
  readonly position: PillarPosition;
  readonly koreanName: string;
  readonly domain: string;
  readonly agePeriod: string;
  readonly bodyPart: string;
}
```

#### 관계 (Relations)

```typescript
// 천간 관계
interface CheonganRelationHit {
  readonly type: 'HAP' | 'CHUNG';
  readonly members: ReadonlySet<Cheongan>;
  readonly resultOhaeng: Ohaeng | null;
  readonly note: string;
}

interface HapHwaEvaluation {
  readonly stem1: Cheongan;
  readonly stem2: Cheongan;
  readonly position1: PillarPosition;
  readonly position2: PillarPosition;
  readonly resultOhaeng: Ohaeng;
  readonly state: HapState;            // HAPWHA | HAPGEO | NOT_ESTABLISHED
  readonly confidence: number;
  readonly reasoning: string;
  readonly dayMasterInvolved: boolean;
}

// 지지 관계
interface JijiRelationHit {
  readonly type: JijiRelationType;
  readonly members: ReadonlySet<Jiji>;
  readonly note: string;
}

enum JijiRelationType {
  YUKHAP | SAMHAP | BANGHAP | BANHAP |
  CHUNG | HYEONG | PA | HAE | WONJIN
}

interface ResolvedRelation {
  readonly hit: JijiRelationHit;
  readonly outcome: InteractionOutcome;   // ACTIVE | WEAKENED | BROKEN | STRENGTHENED
  readonly interactsWith: readonly JijiRelationHit[];
  readonly reasoning: string;
}
```

#### AnalysisTraceStep (설명/추적)

```typescript
interface AnalysisTraceStep {
  readonly key: string;
  readonly summary: string;
  readonly evidence: readonly string[];
  readonly citations: readonly string[];
  readonly reasoning: readonly string[];
  readonly confidence: number | null;
}
```

---

## Domain Enums

```typescript
enum Gender        { MALE = 'MALE', FEMALE = 'FEMALE' }
enum PillarPosition { YEAR = 'YEAR', MONTH = 'MONTH', DAY = 'DAY', HOUR = 'HOUR' }

enum Ohaeng  { WOOD = 'WOOD', FIRE = 'FIRE', EARTH = 'EARTH', METAL = 'METAL', WATER = 'WATER' }
enum Eumyang { YANG = 'YANG', YIN = 'YIN' }

enum Cheongan {
  GAP, EUL, BYEONG, JEONG, MU, GI, GYEONG, SIN, IM, GYE
}

enum Jiji {
  JA, CHUK, IN, MYO, JIN, SA, O, MI, SIN, YU, SUL, HAE
}

enum SibiUnseong {
  JANG_SAENG, MOK_YOK, GWAN_DAE, GEON_ROK, JE_WANG, SWOE,
  BYEONG, SA, MYO, JEOL, TAE, YANG
}
```

---

## Usage Example

```typescript
import { analyzeSaju, createBirthInput, configFromPreset } from 'saju-ts';

const input = createBirthInput({
  birthYear: 1986, birthMonth: 4, birthDay: 19,
  birthHour: 5, birthMinute: 45,
  gender: 'MALE',
});

const result = analyzeSaju(input);

// 사주 기둥
result.pillars.year.cheongan  // Cheongan enum
result.pillars.day.jiji       // Jiji enum

// 신강/신약
result.strengthResult?.isStrong       // boolean
result.strengthResult?.level          // StrengthLevel

// 용신
result.yongshinResult?.finalYongshin  // Ohaeng ('WOOD' etc.)
result.yongshinResult?.finalHeesin    // Ohaeng | null
result.yongshinResult?.finalConfidence // 0.0 ~ 1.0

// 오행 분포
result.ohaengDistribution             // Map<Ohaeng, number>

// 대운
result.daeunInfo?.daeunPillars        // DaeunPillar[]

// 학파별 설정
const result2 = analyzeSaju(input, configFromPreset('TRADITIONAL_CHINESE'));
```

---

## seed-ts 연동

seed-ts의 `SeedEngine`은 내부적으로 saju-ts를 다음과 같이 호출한다:

```typescript
const bi = createBirthInput({
  birthYear: birth.year, birthMonth: birth.month,
  birthDay: birth.day, birthHour: birth.hour, birthMinute: birth.minute,
  gender: birth.gender === 'male' ? 'MALE' : 'FEMALE',
  timezone: birth.timezone ?? 'Asia/Seoul',
  latitude: birth.latitude ?? 37.5665,
  longitude: birth.longitude ?? 126.978,
});
const analysis = analyzeSaju(bi);
```

`SajuAnalysis` → `SajuSummary` 변환 시 추출하는 필드:
- `pillars` → 년/월/일/시 기둥 (천간/지지)
- `strengthResult` → 신강/신약, 점수
- `yongshinResult` → 용신/희신/기신/구신, 신뢰도
- `gyeokgukResult` → 격국 유형, 카테고리
- `ohaengDistribution` → 오행 분포 (부족/과잉 원소 계산)
