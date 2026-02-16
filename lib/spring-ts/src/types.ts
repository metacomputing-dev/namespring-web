/**
 * types.ts -- All type definitions for the spring-ts engine.
 *
 * Based on the feature branch types.ts, adapted to use seed-ts imports
 * and local scoring types instead of name-ts.
 */

import type { FourframeMeaningEntry } from '../../seed-ts/src/database/fourframe-repository.js';
import type { ElementKey } from './scoring.js';

// ─────────────────────────────────────────────────────────────────────────────
//  1. INPUT TYPES
// ─────────────────────────────────────────────────────────────────────────────

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
  readonly sajuOptions?: SajuRequestOptions;
}

export interface SajuRequestOptions {
  readonly daeunCount?: number;
  readonly saeunStartYear?: number | null;
  readonly saeunYearCount?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
//  2. OUTPUT TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface SpringResponse {
  readonly request: SpringRequest;
  readonly mode: 'evaluate' | 'recommend' | 'all';
  readonly saju: SajuSummary;
  readonly candidates: SpringCandidate[];
  readonly totalCount: number;
  readonly meta: ResponseMeta;
}

export interface ResponseMeta {
  readonly version: string;
  readonly timestamp: string;
}

export interface SpringCandidate {
  readonly name: CandidateName;
  readonly scores: Record<'total' | 'hangul' | 'hanja' | 'fourFrame' | 'saju', number>;
  readonly analysis: CandidateAnalysis;
  readonly interpretation: string;
  readonly rank: number;
}

export interface CandidateName {
  readonly surname: CharDetail[];
  readonly givenName: CharDetail[];
  readonly fullHangul: string;
  readonly fullHanja: string;
}

export interface CandidateAnalysis {
  readonly hangul: HangulAnalysisResult;
  readonly hanja: HanjaAnalysisResult;
  readonly fourFrame: FourFrameAnalysisResult;
  readonly saju: SajuCompatibility;
}

export interface CharDetail {
  readonly hangul: string;
  readonly hanja: string;
  readonly meaning: string;
  readonly strokes: number;
  readonly element: string;
  readonly polarity: string;
}

// ─────────────────────────────────────────────────────────────────────────────
//  3. ANALYSIS RESULT TYPES (replacing name-ts model types)
// ─────────────────────────────────────────────────────────────────────────────

export interface HangulAnalysisResult {
  readonly blocks: Array<{
    readonly hangul: string;
    readonly element: string;
    readonly polarity: string;
  }>;
  readonly polarityScore: number;
  readonly elementScore: number;
  readonly totalScore: number;
}

export interface HanjaAnalysisResult {
  readonly blocks: Array<{
    readonly hangul: string;
    readonly hanja: string;
    readonly element: string;
    readonly polarity: string;
    readonly strokes: number;
  }>;
  readonly polarityScore: number;
  readonly elementScore: number;
  readonly totalScore: number;
}

export interface FourFrameAnalysisResult {
  readonly frames: NamingReportFrame[];
  readonly elementScore: number;
  readonly luckScore: number;
}

// ─────────────────────────────────────────────────────────────────────────────
//  4. SAJU ANALYSIS TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface SajuSummary {
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

export interface PillarSummary {
  readonly stem: PillarCode;
  readonly branch: PillarCode;
}

export interface PillarCode {
  readonly code: string;
  readonly hangul: string;
  readonly hanja: string;
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

export interface DayMasterSummary {
  readonly stem: string;
  readonly element: string;
  readonly polarity: string;
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
  readonly recommendations: YongshinRecommendation[];
}

export interface YongshinRecommendation {
  readonly type: string;
  readonly primaryElement: string;
  readonly secondaryElement: string | null;
  readonly confidence: number;
  readonly reasoning: string;
}

export interface GyeokgukSummary {
  readonly type: string;
  readonly category: string;
  readonly baseTenGod: string | null;
  readonly confidence: number;
  readonly reasoning: string;
}

export interface CheonganRelationSummary {
  readonly type: string;
  readonly stems: string[];
  readonly resultElement: string | null;
  readonly note: string;
  readonly score: CheonganRelationScore | null;
}

export interface CheonganRelationScore {
  readonly baseScore: number;
  readonly adjacencyBonus: number;
  readonly outcomeMultiplier: number;
  readonly finalScore: number;
  readonly rationale: string;
}

export interface JijiRelationSummary {
  readonly type: string;
  readonly branches: string[];
  readonly note: string;
  readonly outcome: string | null;
  readonly reasoning: string | null;
}

export interface TenGodSummary {
  readonly dayMaster: string;
  readonly byPosition: Record<string, TenGodPosition>;
}

export interface TenGodPosition {
  readonly cheonganTenGod: string;
  readonly jijiPrincipalTenGod: string;
  readonly hiddenStems: HiddenStem[];
  readonly hiddenStemTenGod: HiddenStemTenGod[];
}

export interface HiddenStem {
  readonly stem: string;
  readonly element: string;
  readonly ratio: number;
}

export interface HiddenStemTenGod {
  readonly stem: string;
  readonly tenGod: string;
}

export interface ShinsalHitSummary {
  readonly type: string;
  readonly position: string;
  readonly grade: string;
  readonly baseWeight: number;
  readonly positionMultiplier: number;
  readonly weightedScore: number;
}

// ─────────────────────────────────────────────────────────────────────────────
//  5. NEW PUBLIC API TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface NamingReportFrame {
  readonly type: 'won' | 'hyung' | 'lee' | 'jung';
  readonly strokeSum: number;
  readonly element: string;
  readonly polarity: string;
  readonly luckyLevel: number;
  readonly meaning: FourframeMeaningEntry | null;
}

export interface NamingReportFourFrame {
  readonly frames: NamingReportFrame[];
  readonly elementScore: number;
  readonly luckScore: number;
}

export interface NamingReport {
  readonly name: CandidateName;
  readonly totalScore: number;
  readonly scores: { hangul: number; hanja: number; fourFrame: number };
  readonly analysis: {
    readonly hangul: HangulAnalysisResult;
    readonly hanja: HanjaAnalysisResult;
    readonly fourFrame: NamingReportFourFrame;
  };
  readonly interpretation: string;
}

export type SajuReport = SajuSummary & {
  readonly sajuEnabled: boolean;
};

export interface SpringReport {
  readonly finalScore: number;
  readonly namingReport: NamingReport;
  readonly sajuReport: SajuReport;
  readonly sajuCompatibility: SajuCompatibility;
  rank: number;
}

// ─────────────────────────────────────────────────────────────────────────────
//  6. COMPATIBILITY & ADAPTER TYPES
// ─────────────────────────────────────────────────────────────────────────────

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
  recommendations: YongshinRecommendation[];
}
