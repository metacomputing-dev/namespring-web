import type { HanjaEntry } from '../database/hanja-repository.js';

export interface BirthInfo {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly gender: 'male' | 'female';
  readonly isLunar?: boolean;
  readonly timezone?: string;
  readonly latitude?: number;
  readonly longitude?: number;
}

export interface NameCharInput {
  readonly hangul: string;
  readonly hanja?: string;
}

export interface SeedRequest {
  readonly birth: BirthInfo;
  readonly surname: NameCharInput[];
  readonly givenName?: NameCharInput[];
  readonly givenNameLength?: number;
  readonly mode?: 'auto' | 'evaluate' | 'recommend' | 'all';
  readonly options?: SeedOptions;
}

export interface SeedOptions {
  readonly limit?: number;
  readonly offset?: number;
  readonly schoolPreset?: 'korean' | 'chinese' | 'modern';
  readonly weights?: ScoreWeights;
}

export interface ScoreWeights {
  readonly hangul?: number;
  readonly hanja?: number;
  readonly fourFrame?: number;
  readonly saju?: number;
}

export interface SeedResponse {
  readonly request: SeedRequest;
  readonly mode: 'evaluate' | 'recommend' | 'all';
  readonly saju: SajuSummary;
  readonly candidates: SeedCandidate[];
  readonly totalCount: number;
  readonly meta: {
    readonly version: string;
    readonly timestamp: string;
  };
}

export interface SeedCandidate {
  readonly name: {
    readonly surname: CharDetail[];
    readonly givenName: CharDetail[];
    readonly fullHangul: string;
    readonly fullHanja: string;
  };
  readonly scores: {
    readonly total: number;
    readonly hangul: number;
    readonly hanja: number;
    readonly fourFrame: number;
    readonly saju: number;
  };
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

export interface HangulAnalysis {
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

export interface HanjaAnalysis {
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

export interface FourFrameAnalysis {
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

export interface SajuCompatibility {
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

export interface SajuSummary {
  readonly pillars: {
    readonly year: PillarSummary;
    readonly month: PillarSummary;
    readonly day: PillarSummary;
    readonly hour: PillarSummary;
  };
  readonly dayMaster: { stem: string; element: string; polarity: string };
  readonly strength: { level: string; isStrong: boolean; score: number };
  readonly yongshin: {
    element: string;
    heeshin: string | null;
    gishin: string | null;
    gushin: string | null;
    confidence: number;
    reasoning: string;
  };
  readonly gyeokguk: { type: string; category: string; confidence: number };
  readonly ohaengDistribution: Record<string, number>;
  readonly deficientElements: string[];
  readonly excessiveElements: string[];
}

export interface PillarSummary {
  readonly stem: { code: string; hangul: string; hanja: string };
  readonly branch: { code: string; hangul: string; hanja: string };
}

export type Gender = 'male' | 'female';

export interface BirthDateTime {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}
export interface UserInfo {
  readonly lastName: HanjaEntry[];
  readonly firstName: HanjaEntry[];
  readonly birthDateTime: BirthDateTime;
  readonly gender: Gender;
}
export interface NamingResult {
  readonly lastName: HanjaEntry[];
  readonly firstName: HanjaEntry[];
  readonly totalScore: number;
  readonly hanja: unknown;
  readonly hangul: unknown;
  readonly fourFrames: unknown;
  readonly interpretation: string;
}
export interface SeedResult {
  readonly candidates: NamingResult[];
  readonly totalCount: number;
}
