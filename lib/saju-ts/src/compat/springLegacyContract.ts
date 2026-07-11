/** Stable V1 pillar shape consumed by the spring-ts compatibility adapter. */
export interface LegacyPillarV1 {
  readonly cheongan: string;
  readonly jiji: string;
}

export interface LegacyCoreResultV1 {
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

export interface LegacyJieProximityV1 {
  readonly birthUtcMs: number;
  readonly solarTermMethod: string;
  readonly previousTermId: string;
  readonly previousUtcMs: number;
  readonly nextTermId: string;
  readonly nextUtcMs: number;
  readonly hoursSincePrevious: number;
  readonly hoursUntilNext: number;
  readonly daysSincePrevious: number;
  readonly daysUntilNext: number;
  readonly monthLengthDays: number;
  readonly nearestTermId: string;
  readonly nearestDirection: 'previous' | 'next';
  readonly nearestHours: number;
  readonly isNearBoundary: boolean;
}

export interface LegacyStrengthResultV1 {
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

export interface LegacyYongshinRecommendationV1 {
  readonly type: string;
  readonly primaryElement: string;
  readonly secondaryElement: string | null;
  /** Spring compatibility boundary: 0..100 confidence points. */
  readonly confidence: number;
  readonly reasoning: string;
}

export interface LegacyYongshinResultV1 {
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
  readonly recommendations: readonly LegacyYongshinRecommendationV1[];
}

export interface LegacyGyeokgukResultV1 {
  readonly type: string;
  readonly category: 'NORMAL' | 'JONGGYEOK';
  readonly baseSipseong: string | null;
  readonly confidence: number;
  readonly basis: unknown;
  readonly scores: unknown;
  readonly reasoning: string;
  readonly candidates: readonly unknown[];
  readonly jonggyeokCandidates: readonly unknown[];
  readonly seongpae: unknown;
}

export interface LegacyLuckAnnotationsV1 {
  readonly tenGod?: string;
  readonly lifeStage?: string;
  readonly lifeStageKo?: string;
  readonly transitShinsal?: unknown;
  readonly relationsWithNatal?: unknown;
  readonly relationsWithDecade?: unknown;
  readonly stemBranchInteraction?: unknown;
}

export interface LegacyDaeunPillarV1 extends LegacyLuckAnnotationsV1 {
  readonly pillar: LegacyPillarV1;
  readonly startAge: number;
  readonly endAge: number;
  readonly order: number;
  readonly displayStartAge: number;
  readonly displayEndAge: number;
  readonly approxStartUtcMs?: number;
  readonly approxEndUtcMs?: number;
}

export interface LegacyDaeunInfoV1 {
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
  readonly daeunPillars: readonly LegacyDaeunPillarV1[];
}

export interface LegacySaeunPillarV1 extends LegacyLuckAnnotationsV1 {
  readonly year: number;
  readonly pillar: LegacyPillarV1;
  readonly startUtcMs: number | null;
  readonly endUtcMs: number | null;
  readonly approxStartAgeYears: number | null;
  readonly approxEndAgeYears: number | null;
}

export interface LegacyWolunPillarV1 extends LegacySaeunPillarV1 {
  readonly monthOrder: number;
  readonly startJie: string;
}

export interface LegacyTraceEntryV1 {
  readonly key: string;
  readonly summary: string;
  readonly evidence: readonly string[];
  readonly citations: readonly string[];
  readonly reasoning: readonly string[];
  readonly confidence: number | null;
}

/**
 * Public compatibility contract between saju-ts and spring-ts.
 *
 * Core calculation and fortune-timeline fields are explicit so an upstream
 * rename or shape change fails compilation. Rich secondary rule evidence is
 * intentionally opaque here and remains normalized by the spring adapter.
 */
export interface LegacySajuOutputV1 {
  readonly bridgeSchemaVersion: 'saju-legacy.v1';
  readonly pillars: Readonly<Record<'year' | 'month' | 'day' | 'hour', LegacyPillarV1>>;
  readonly coreResult: LegacyCoreResultV1;
  readonly jieProximity: LegacyJieProximityV1 | null;
  readonly strengthResult: LegacyStrengthResultV1;
  readonly yongshinResult: LegacyYongshinResultV1;
  readonly gyeokgukResult: LegacyGyeokgukResultV1;
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
  readonly daeunInfo: LegacyDaeunInfoV1;
  readonly saeunPillars: readonly LegacySaeunPillarV1[];
  readonly wolunPillars: readonly LegacyWolunPillarV1[];
  readonly trace: readonly LegacyTraceEntryV1[];
  readonly palaceAnalysis?: Readonly<Record<string, unknown>> | null;
}
