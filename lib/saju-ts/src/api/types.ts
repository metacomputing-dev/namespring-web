import type { BranchIdx, PillarIdx, StemIdx } from '../core/cycle.js';
import type { ElementVector } from '../core/elementVector.js';
import type { HiddenStemRole, HiddenStemWeightPolicy } from '../core/hiddenStems.js';
import type { LifeStage } from '../core/lifeStage.js';
import type { RelationType } from '../core/branchRelations.js';
import type { StemRelationType } from '../core/stemRelations.js';
import type { TenGod } from '../core/tenGod.js';

export type { HiddenStemRole, HiddenStemWeightPolicy } from '../core/hiddenStems.js';
export type { LifeStage } from '../core/lifeStage.js';
export type { RelationType } from '../core/branchRelations.js';
export type { StemRelationType } from '../core/stemRelations.js';
export type { TenGod } from '../core/tenGod.js';

export interface SajuRequest {
  birth: {
    /** ISO-8601 with offset (e.g. 1990-01-01T12:34:00+09:00) or Z */
    instant: string;
    calendar?: 'gregorian';
  };

  sex: 'M' | 'F' | 'U';

  location?: {
    lat: number;
    lon: number;
    name?: string;
    altitudeM?: number;
  };

  meta?: Record<string, unknown>;
  overrides?: Record<string, unknown>;
}

export interface EngineWeights {
  hiddenStems?: HiddenStemWeightPolicy;
  elementDistribution?: {
    heavenStemWeight?: number;
    branchTotalWeight?: number;
  };
  [k: string]: unknown;
}

export interface SchoolConfig {
  /** Built-in school/profile id (e.g., ziping.balance). */
  id: string;
  /** Optional variant string for the profile (implementation-defined). */
  variant?: string;
}

export interface EngineConfig {
  schemaVersion: string;

  /**
   * Optional school/profile selector (유파).
   *
   * When provided, the engine applies a built-in school pack (config patch)
   * before normalizing defaults.
   */
  school?: SchoolConfig;

  calendar: {
    yearBoundary: 'liChun' | 'lunarNewYear' | 'jan1';
    monthBoundary: 'jieqi' | 'gregorianMonth';
    dayBoundary: 'midnight' | 'ziSplit23';
    hourBoundary: 'doubleHour';

    /**
     * Solar-term computation policy.
     *
     * - 'meeus': numeric root-finding on apparent solar longitude (recommended)
     * - 'approx': fixed day-of-month anchors (fast, coarse)
     */
    solarTerms?: {
      method: 'meeus' | 'approx';
      /** If true, compute 24 terms even if current policies don't strictly need them. */
      alwaysCompute?: boolean;
    };

    trueSolarTime: {
      enabled: boolean;
      equationOfTime: 'off' | 'approx';

      /**
       * Scope of application:
       * - 'hourOnly': apply correction only when determining hour pillar (default)
       * - 'dayAndHour': apply correction for day boundary and hour pillar
       */
      applyTo?: 'hourOnly' | 'dayAndHour';
    };
  };

  toggles: {
    pillars: boolean;
    relations: boolean;
    tenGods: boolean;
    hiddenStems: boolean;
    elementDistribution: boolean;

    /** Luck cycles (대운/세운) timeline. */
    fortune?: boolean;

    /** DSL-based rule engine (신강/용신/격국/신살). */
    rules?: boolean;

    /** Twelve life stages (십이운성). */
    lifeStages?: boolean;

    /** Heavenly-stem relations (예: 天干合/冲). */
    stemRelations?: boolean;
  };

  weights?: EngineWeights;
  strategies?: Record<string, unknown>;
  extensions?: Record<string, unknown>;
}

export interface Artifact {
  mime: string;
  encoding: 'json' | 'utf8' | 'base64' | 'binary';
  data: unknown;
}

export interface TraceNode {
  id: string;
  deps: string[];
  formula?: string;
  explain?: string;
  input?: unknown;
  output?: unknown;
}

export interface FullReport {
  facts: Record<string, unknown>;
  trace: {
    nodes: TraceNode[];
    edges: Array<{ from: string; to: string }>;
  };
  diagnostics: {
    warnings: string[];
    notes: string[];
  };
}

export interface SummaryReport {
  pillars?: {
    year: PillarView;
    month: PillarView;
    day: PillarView;
    hour: PillarView;
  };

  tenGods?: {
    yearStem: TenGod;
    monthStem: TenGod;
    hourStem: TenGod;
  };

  hiddenStems?: FourPillars<HiddenStemView[]>;

  tenGodsHiddenStems?: FourPillars<HiddenStemTenGodView[]>;

  elementDistribution?: ElementDistributionView;

  /** Optional (future): 十二運星 */
  lifeStages?: FourPillars<LifeStage>;

  /** Optional (future): 천간 관계(합/충 등) */
  stemRelations?: StemRelationView[];

  relations?: DetectedRelationView[];

  /** Optional: 대운/세운 타임라인 요약 */
  fortune?: FortuneSummaryView;

  /** Optional: 신강/신약(연속 스코어) */
  strength?: StrengthView;

  /** Optional: 용신/희신 스코어링 결과 */
  yongshin?: YongshinView;

  /** Optional: 격국 스코어링 결과 */
  gyeokguk?: GyeokgukView;

  /** Optional: 신살 판정 결과 (지지 타깃만; 레거시/간단 뷰) */
  shinsal?: ShinsalView[];

  /** Optional: 신살 판정 결과 (확장 뷰: 천간/복합 포함) */
  shinsalHits?: ShinsalHitView[];

  /** Optional: 신살 스코어(룰셋 누적 점수) */
  shinsalScores?: Array<{ key: string; score: number }>;

  /** Optional: 신살 스코어(관계/품질 기반 보정; forward-compatible) */
  shinsalScoresAdjusted?: Array<{ key: string; score: number }>;
}

export interface StemView {
  idx: StemIdx;
  text: string;
  element: string;
  yinYang: string;
}

export interface BranchView {
  idx: BranchIdx;
  text: string;
  element: string;
  yinYang: string;
}

export interface PillarView {
  stem: StemView;
  branch: BranchView;
}

export interface HiddenStemView {
  stem: StemView;
  role: HiddenStemRole;
  weight: number;
}

export interface HiddenStemTenGodView extends HiddenStemView {
  tenGod: TenGod;
}

export interface ElementDistributionView {
  heaven: ElementVector;
  hidden: ElementVector;
  total: ElementVector;
}

export interface StemRelationView {
  type: StemRelationType;
  members: StemView[];
  /** For HAP, the classical “resulting element” label (化) without extra conditions. */
  resultElement?: string;
}

export interface FortuneStartView {
  direction: 'FORWARD' | 'BACKWARD';
  boundary: { id: string; utcMs: number };
  deltaMs: number;
  startAgeYears: number;
  startAgeParts?: { years: number; months: number; days: number };
  startUtcMsApprox?: number;
  formula: string;
}

export interface DecadeLuckView {
  index: number;
  startAgeYears: number;
  endAgeYears: number;
  pillar: PillarView;
  startUtcMs?: number;
  endUtcMs?: number;
}

export interface YearLuckView {
  solarYear: number;
  pillar: PillarView;
  startUtcMs: number;
  endUtcMs: number;
  approxStartAgeYears: number;
  approxEndAgeYears: number;
}

export interface MonthLuckView {
  solarYear: number;
  monthOrder: number;
  startJie: string;
  pillar: PillarView;
  startUtcMs: number;
  endUtcMs: number;
  approxStartAgeYears: number;
  approxEndAgeYears: number;
}

export interface DayLuckView {
  localDate: { y: number; m: number; d: number };
  pillar: PillarView;
  startUtcMs: number;
  endUtcMs: number;
  approxStartAgeYears: number;
  approxEndAgeYears: number;
}

export interface FortuneSummaryView {
  start: FortuneStartView;
  decades: DecadeLuckView[];
  /** Potentially large; engine may include only a prefix in summary. Full list is in report.facts. */
  years?: YearLuckView[];

  /** Optional: 월운(12절 경계 기반). Potentially large; summary includes a prefix. */
  months?: MonthLuckView[];

  /** Optional: 일운(정책 dayBoundary 기반). Potentially large; summary includes a prefix. */
  days?: DayLuckView[];
}

export interface StrengthView {
  index: number;
  support: number;
  pressure: number;
  total: number;
  components: {
    companions: number;
    resources: number;
    outputs: number;
    wealth: number;
    officers: number;
  };
}

export interface YongshinView {
  best: string;
  ranking: Array<{ element: string; score: number }>;
  strengthIndex: number;
}

export interface GyeokgukView {
  best: string | null;
  ranking: Array<{ key: string; score: number }>;
}

export interface ShinsalView {
  name: string;
  basedOn: 'YEAR_BRANCH' | 'DAY_BRANCH' | 'MONTH_BRANCH' | 'OTHER';
  targetBranch: BranchView;
}

export interface ShinsalHitView {
  name: string;
  basedOn: 'YEAR_BRANCH' | 'DAY_BRANCH' | 'MONTH_BRANCH' | 'OTHER';
  targetKind: 'BRANCH' | 'STEM' | 'NONE';
  targetBranch?: BranchView;
  targetStem?: StemView;
  /** Composite / multi-target provenance. */
  targetBranches?: BranchView[];
  targetStems?: StemView[];
  /** Extra structured provenance payload from rulesets (kept as-is). */
  details?: any;
  matchedPillars?: Array<'year' | 'month' | 'day' | 'hour'>;
  quality?: 'FULL' | 'WEAK';
  /** [0,1] attenuation weight after applying conditions (1 = full). */
  qualityWeight?: number;
  /** If true, treated as invalidated (qualityWeight will be 0 in scoring). */
  invalidated?: boolean;
  /** Penalty in [0,1] used to compute qualityWeight = 1 - penalty. */
  conditionPenalty?: number;
  /** Condition keys that contributed to the penalty. */
  qualityReasons?: string[];
}



export interface FourPillars<T> {
  year: T;
  month: T;
  day: T;
  hour: T;
}

export interface DetectedRelationView {
  type: RelationType;
  members: BranchView[];
}

export interface AnalysisBundle {
  apiVersion: '1';

  engine: {
    name: string;
    version: string;
    build?: string;
  };

  config: {
    schemaVersion: string;
    digest: string;
  };

  input: {
    normalizedRequest: SajuRequest;
  };

  summary: SummaryReport;
  report: FullReport;

  artifacts: Record<string, Artifact>;
}

export interface PillarsResult {
  year: PillarIdx;
  month: PillarIdx;
  day: PillarIdx;
  hour: PillarIdx;
}
