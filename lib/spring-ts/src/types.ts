import type { HangulAnalysis, HanjaAnalysis, FourFrameAnalysis } from '../../name-ts/src/model/types.js';
import type { ElementKey } from '../../name-ts/src/calculator/scoring.js';

export interface BirthInfo {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly gender: 'male' | 'female';
  readonly timezone?: string;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly name?: string;
}

export interface NameCharInput {
  readonly hangul: string;
  readonly hanja?: string;
}

export interface SpringRequest {
  readonly birth: BirthInfo;
  readonly surname: NameCharInput[];
  readonly givenName?: NameCharInput[];
  readonly givenNameLength?: number;
  readonly mode?: 'auto' | 'evaluate' | 'recommend' | 'all';
  readonly options?: SpringOptions;
}

export interface SpringOptions {
  readonly limit?: number;
  readonly offset?: number;
  readonly schoolPreset?: 'korean' | 'chinese' | 'modern';
  readonly sajuConfig?: Record<string, unknown>;
  readonly sajuOptions?: { readonly daeunCount?: number; readonly saeunStartYear?: number | null; readonly saeunYearCount?: number };
}

export interface SpringResponse {
  readonly request: SpringRequest;
  readonly mode: 'evaluate' | 'recommend' | 'all';
  readonly saju: SajuSummary;
  readonly candidates: SpringCandidate[];
  readonly totalCount: number;
  readonly meta: { readonly version: string; readonly timestamp: string };
}

export interface SpringCandidate {
  readonly name: {
    readonly surname: CharDetail[];
    readonly givenName: CharDetail[];
    readonly fullHangul: string;
    readonly fullHanja: string;
  };
  readonly scores: Record<'total' | 'hangul' | 'hanja' | 'fourFrame' | 'saju', number>;
  readonly analysis: {
    readonly hangul: HangulAnalysis;
    readonly hanja: HanjaAnalysis;
    readonly fourFrame: FourFrameAnalysis;
    readonly saju: SajuCompatibility;
  };
  readonly interpretation: string;
  readonly rank: number;
}

export interface CharDetail {
  readonly hangul: string;
  readonly hanja: string;
  readonly meaning: string;
  readonly strokes: number;
  readonly element: string;
  readonly polarity: string;
}

export interface SajuSummary {
  readonly pillars: Record<'year' | 'month' | 'day' | 'hour', PillarSummary>;
  readonly timeCorrection: TimeCorrectionSummary;
  readonly dayMaster: { readonly stem: string; readonly element: string; readonly polarity: string };
  readonly strength: StrengthSummary;
  readonly yongshin: YongshinSummary;
  readonly gyeokguk: { readonly type: string; readonly category: string; readonly baseSipseong: string | null; readonly confidence: number; readonly reasoning: string };
  readonly ohaengDistribution: Record<string, number>;
  readonly deficientElements: string[];
  readonly excessiveElements: string[];
  readonly cheonganRelations: CheonganRelationSummary[];
  readonly jijiRelations: Array<{ readonly type: string; readonly branches: string[]; readonly note: string; readonly outcome: string | null; readonly reasoning: string | null }>;
  readonly tenGodAnalysis: TenGodSummary | null;
  readonly shinsalHits: Array<{ readonly type: string; readonly position: string; readonly grade: string; readonly baseWeight: number; readonly positionMultiplier: number; readonly weightedScore: number }>;
  readonly gongmang: [string, string] | null;
  readonly [key: string]: unknown;
}

export interface PillarSummary {
  readonly stem: { readonly code: string; readonly hangul: string; readonly hanja: string };
  readonly branch: { readonly code: string; readonly hangul: string; readonly hanja: string };
}

export interface TimeCorrectionSummary {
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

export interface StrengthSummary {
  readonly level: string;
  readonly isStrong: boolean;
  readonly totalSupport: number;
  readonly totalOppose: number;
  readonly deukryeong: number;
  readonly deukji: number;
  readonly deukse: number;
  readonly details: string[];
}

export interface YongshinSummary {
  readonly element: string;
  readonly heeshin: string | null;
  readonly gishin: string | null;
  readonly gushin: string | null;
  readonly confidence: number;
  readonly agreement: string;
  readonly recommendations: Array<{
    readonly type: string;
    readonly primaryElement: string;
    readonly secondaryElement: string | null;
    readonly confidence: number;
    readonly reasoning: string;
  }>;
}

export interface CheonganRelationSummary {
  readonly type: string;
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

export interface TenGodSummary {
  readonly dayMaster: string;
  readonly byPosition: Record<string, {
    readonly cheonganSipseong: string;
    readonly jijiPrincipalSipseong: string;
    readonly hiddenStems: Array<{ readonly stem: string; readonly element: string; readonly ratio: number }>;
    readonly hiddenStemSipseong: Array<{ readonly stem: string; readonly sipseong: string }>;
  }>;
}

export interface SajuCompatibility {
  readonly yongshinElement: string;
  readonly heeshinElement: string | null;
  readonly gishinElement: string | null;
  readonly nameElements: string[];
  readonly yongshinMatchCount: number;
  readonly gishinMatchCount: number;
  readonly dayMasterSupportScore: number;
  readonly affinityScore: number;
}

export interface SajuOutputSummary {
  dayMaster?: { element: ElementKey };
  strength?: { isStrong: boolean; totalSupport: number; totalOppose: number };
  yongshin?: SajuYongshinSummary;
  tenGod?: { groupCounts: Record<string, number> };
  gyeokguk?: { category: string; type: string; confidence: number };
  deficientElements?: string[];
  excessiveElements?: string[];
}

export interface SajuYongshinSummary {
  finalYongshin: string;
  finalHeesin: string | null;
  gisin: string | null;
  gusin: string | null;
  finalConfidence: number;
  recommendations: Array<{ type: string; primaryElement: string; secondaryElement: string | null; confidence: number; reasoning: string }>;
}
