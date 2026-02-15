import type { HanjaEntry } from './database/hanja-repository.js';

// ============================================================
// Public API -- Input types (immutable contract)
// ============================================================

/** Birth date/time info -- encompasses saju-ts BirthInput. */
export interface BirthInfo {
  readonly year: number;
  readonly month: number;       // 1-12
  readonly day: number;         // 1-31
  readonly hour: number;        // 0-23
  readonly minute: number;      // 0-59
  readonly gender: 'male' | 'female';
  readonly isLunar?: boolean;   // true = lunar-to-solar conversion
  readonly timezone?: string;   // default: 'Asia/Seoul'
  readonly latitude?: number;   // default: 37.5665 (Seoul)
  readonly longitude?: number;  // default: 126.978 (Seoul)
}

/** Single character input. */
export interface NameCharInput {
  readonly hangul: string;
  readonly hanja?: string;
}

/** Main API input. */
export interface SeedRequest {
  readonly birth: BirthInfo;
  readonly surname: NameCharInput[];       // 1-2 chars, hanja required
  readonly givenName?: NameCharInput[];    // 0-N chars, hanja optional
  readonly givenNameLength?: number;       // desired length for generation (default: 2)
  readonly mode?: 'auto' | 'evaluate' | 'recommend' | 'all';
  readonly options?: SeedOptions;
}

export interface SeedOptions {
  readonly limit?: number;       // default: 20
  readonly offset?: number;      // default: 0
  readonly schoolPreset?: 'korean' | 'chinese' | 'modern';
  readonly weights?: ScoreWeights;
}

export interface ScoreWeights {
  readonly hangul?: number;      // default: 25
  readonly hanja?: number;       // default: 25
  readonly fourFrame?: number;   // default: 25
  readonly saju?: number;        // default: 25
}

// ============================================================
// Public API -- Output types (immutable contract)
// ============================================================

/** Main API output. */
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

/** Single name candidate. */
export interface SeedCandidate {
  readonly name: {
    readonly surname: CharDetail[];
    readonly givenName: CharDetail[];
    readonly fullHangul: string;
    readonly fullHanja: string;
  };
  readonly scores: {
    readonly total: number;     // weighted average (0-100)
    readonly hangul: number;    // 음령오행 (0-100)
    readonly hanja: number;     // 자원오행 (0-100)
    readonly fourFrame: number; // 사격수리 (0-100)
    readonly saju: number;      // 사주 균형 (0-100)
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

/** Character detail. */
export interface CharDetail {
  readonly hangul: string;
  readonly hanja: string;
  readonly meaning: string;
  readonly strokes: number;
  readonly element: string;    // resource element
  readonly polarity: string;   // yin/yang
}

// ============================================================
// Analysis detail types (used by calculators and candidates)
// ============================================================

/** Hangul (phonetic) analysis detail. */
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

/** Hanja (resource) analysis detail. */
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

/** Four-frame analysis detail. */
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

/** Saju compatibility analysis detail -- full factor breakdown. */
export interface SajuCompatibility {
  readonly yongshinElement: string;
  readonly heeshinElement: string | null;
  readonly gishinElement: string | null;
  readonly nameElements: string[];
  // Yongshin/Heeshin affinity
  readonly yongshinMatchCount: number;
  readonly yongshinGeneratingCount: number;
  // Gishin penalty
  readonly gishinMatchCount: number;
  readonly gishinOvercomingCount: number;
  // Ohaeng distribution
  readonly deficiencyFillCount: number;      // 부족 오행 보충 수
  readonly excessiveAvoidCount: number;      // 과다 오행 회피 수
  // Day master context
  readonly dayMasterSupportScore: number;    // 일간 보조 점수
  // Composite
  readonly affinityScore: number;
}

// ============================================================
// Saju summary types
// ============================================================

/** Saju summary extracted from saju-ts SajuAnalysis. */
export interface SajuSummary {
  readonly pillars: {
    readonly year: PillarSummary;
    readonly month: PillarSummary;
    readonly day: PillarSummary;
    readonly hour: PillarSummary;
  };
  readonly dayMaster: {
    stem: string;
    element: string;
    polarity: string;
  };
  readonly strength: {
    level: string;
    isStrong: boolean;
    score: number;
  };
  readonly yongshin: {
    element: string;         // 용신 오행
    heeshin: string | null;  // 희신 오행
    gishin: string | null;   // 기신 오행 (피해야 할 오행)
    gushin: string | null;   // 구신 오행 (기신을 돕는 오행)
    confidence: number;
    reasoning: string;
  };
  readonly gyeokguk: {
    type: string;
    category: string;
    confidence: number;
  };
  readonly ohaengDistribution: Record<string, number>;
  readonly deficientElements: string[];   // 부족한 오행 (보충 필요)
  readonly excessiveElements: string[];   // 과다한 오행 (피해야 할)
}

export interface PillarSummary {
  readonly stem: { code: string; hangul: string; hanja: string };
  readonly branch: { code: string; hangul: string; hanja: string };
}

// ============================================================
// Backward-compatible types (used by existing UI)
// ============================================================

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
