import type {
  JieProximitySummary,
  SajuSummary,
} from './types.js';

export interface LegacyBirthInputContract {
  readonly birthYear: number;
  readonly birthMonth: number;
  readonly birthDay: number;
  readonly birthHour?: number;
  readonly birthMinute?: number;
  readonly gender?: 'MALE' | 'FEMALE';
  readonly calendarType?: 'SOLAR' | 'LUNAR';
  readonly isLeapMonth?: boolean;
  readonly timezone?: string;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly name?: string;
}

export interface LegacySajuOptionsContract {
  readonly daeunCount?: number;
  readonly saeunStartYear?: number | null;
  readonly saeunYearCount?: number;
  readonly wolunStartYear?: number | null;
  readonly wolunMonthCount?: number;
}

export interface LegacyCivilDateTimeContract {
  readonly y: number;
  readonly m: number;
  readonly d: number;
  readonly h: number;
  readonly min: number;
}

export interface RuntimeLegacySajuConfig extends Record<string, unknown> {
  longitudeCorrectionPolicy?:
    | { readonly mode: 'off' }
    | { readonly mode: 'civilOffsetMeridian' }
    | { readonly mode: 'fixedMeridian'; readonly meridianDeg: number };
  calendar?: {
    solarTerms?: {
      method?: 'meeus' | 'approx';
      alwaysCompute?: boolean;
      algorithm?: 'bisection' | 'newton';
      readonly [key: string]: unknown;
    };
    solarPrecision?: 'classical' | 'iau1980_top10' | 'iau1980_full';
    aberrationModel?: 'constant' | 'rCorrected';
    trueSolarTime?: Record<string, unknown>;
    readonly [key: string]: unknown;
  };
  strategies?: {
    fortune?: Record<string, unknown>;
    gyeokguk?: Record<string, unknown>;
    readonly [key: string]: unknown;
  };
  weights?: {
    hiddenStems?: Record<string, unknown>;
    readonly [key: string]: unknown;
  };
  school?: Record<string, unknown>;
}

interface LegacyPillarContract {
  readonly cheongan: string;
  readonly jiji: string;
}

export interface LegacyStrengthResultContract {
  readonly dayMasterElement: string;
  readonly level: string;
  readonly isStrong: boolean;
  readonly score: {
    readonly totalSupport: number;
    readonly totalOppose: number;
    readonly deukryeong: number;
    readonly deukji: number;
    readonly deukse: number;
  };
  readonly details: readonly string[];
}

interface LegacyYongshinRecommendationContract {
  readonly type: string;
  readonly primaryElement: string;
  readonly secondaryElement: string | null;
  /** Spring compatibility boundary: 0..100 confidence points. */
  readonly confidence: number;
  readonly reasoning: string;
}

interface LegacyYongshinResultContract {
  readonly finalYongshin: string;
  readonly finalHeesin: string | null;
  readonly gisin: string | null;
  readonly gusin: string | null;
  /** Spring compatibility boundary: 0..100 confidence points. */
  readonly finalConfidence: number;
  readonly agreement: string;
  readonly consensus: unknown;
  readonly methodBreakdown: unknown;
  readonly warnings: readonly string[];
  readonly jonggyeokRisk: unknown;
  readonly recommendations: readonly LegacyYongshinRecommendationContract[];
}

interface LegacyLuckAnnotationsContract {
  readonly tenGod?: string;
  readonly lifeStage?: string;
  readonly lifeStageKo?: string;
  readonly transitShinsal?: unknown;
  readonly relationsWithNatal?: unknown;
  readonly relationsWithDecade?: unknown;
  readonly stemBranchInteraction?: unknown;
}

interface LegacyDaeunPillarContract extends LegacyLuckAnnotationsContract {
  readonly pillar: LegacyPillarContract;
  readonly startAge: number;
  readonly endAge: number;
  readonly order: number;
  readonly displayStartAge: number;
  readonly displayEndAge: number;
  readonly approxStartUtcMs?: number;
  readonly approxEndUtcMs?: number;
}

interface LegacyDaeunInfoContract {
  readonly isForward: boolean;
  readonly firstDaeunStartAge: number;
  readonly firstDaeunStartAgeDisplay: number;
  readonly ageDisplayMode: string;
  readonly ageDisplayLabel: string;
  readonly firstDaeunStartMonths: number;
  readonly boundaryMode: string;
  readonly boundaryUtcMs: number | null;
  readonly deltaDays: number | null;
  readonly formula: string;
  readonly warnings: readonly string[];
  readonly daeunPillars: readonly LegacyDaeunPillarContract[];
}

interface LegacySaeunPillarContract extends LegacyLuckAnnotationsContract {
  readonly year: number;
  readonly pillar: LegacyPillarContract;
  readonly startUtcMs: number | null;
  readonly endUtcMs: number | null;
  readonly approxStartAgeYears: number | null;
  readonly approxEndAgeYears: number | null;
}

interface LegacyWolunPillarContract extends LegacySaeunPillarContract {
  readonly monthOrder: number;
  readonly startJie: string;
}

/**
 * Local consumer contract for the dynamically loaded saju-ts V1 bridge.
 *
 * Runtime code imports only this local type so spring-ts build output remains
 * self-contained. A dedicated noEmit typecheck proves that the upstream
 * LegacySajuOutputV1 remains assignable to this consumer view.
 */
export interface LegacySajuOutputV1Contract {
  readonly pillars: Readonly<Record<'year' | 'month' | 'day' | 'hour', LegacyPillarContract>>;
  readonly coreResult: SajuSummary['timeCorrection'];
  readonly jieProximity: JieProximitySummary | null;
  readonly strengthResult: LegacyStrengthResultContract;
  readonly yongshinResult: LegacyYongshinResultContract;
  readonly gyeokgukResult: unknown;
  readonly ohaengDistribution: Readonly<Record<string, number>>;
  readonly deficientElements: readonly string[];
  readonly excessiveElements: readonly string[];
  readonly cheonganRelations: readonly unknown[];
  readonly scoredCheonganRelations: readonly unknown[];
  readonly hapHwaEvaluations: readonly unknown[];
  readonly jijiRelations: readonly unknown[];
  readonly resolvedJijiRelations: readonly unknown[];
  readonly tenGodAnalysis: unknown;
  readonly shinsalHits: readonly unknown[];
  readonly weightedShinsalHits: readonly unknown[];
  readonly sibiUnseong: Readonly<Record<string, string>> | null;
  readonly yinYangBalance: unknown;
  readonly gongmangVoidBranches: readonly string[];
  readonly daeunInfo: LegacyDaeunInfoContract;
  readonly saeunPillars: readonly LegacySaeunPillarContract[];
  readonly wolunPillars: readonly LegacyWolunPillarContract[];
  readonly trace: readonly {
    readonly key: string;
    readonly summary: string;
    readonly evidence: readonly string[];
    readonly citations: readonly string[];
    readonly reasoning: readonly string[];
    readonly confidence: number | null;
  }[];
  readonly palaceAnalysis?: Readonly<Record<string, unknown>> | null;
}

export type SajuModule = {
  analyzeSaju: (
    input: LegacyBirthInputContract,
    config?: unknown,
    options?: LegacySajuOptionsContract,
  ) => LegacySajuOutputV1Contract;
  createBirthInput: (params: LegacyBirthInputContract) => LegacyBirthInputContract;
  configFromPreset?: (preset: string) => RuntimeLegacySajuConfig;
  resolveOffsetMinutes: (
    timeZone: string,
    civil: LegacyCivilDateTimeContract,
  ) => number;
};
