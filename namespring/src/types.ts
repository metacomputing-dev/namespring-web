export type GenderOption = "female" | "male" | "none";
export type NameTargetType = "last" | "first";
export type KoreanConstraintKind = "empty" | "syllable" | "chosung" | "jungsung" | "invalid";

export interface BirthDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export interface HanjaOption {
  id?: number;
  hangul: string;
  hanja: string;
  meaning: string;
  strokes: number;
  strokeCount?: number;
  resourceElement?: string;
  resource_element?: string;
  isSurname?: boolean;
}

export interface ModalTarget {
  type: NameTargetType;
  index: number;
  char: string;
}

export interface AnalysisCategory {
  frame: string;
  score: number;
  status: string;
  arrangement: string;
  details?: Record<string, unknown>;
}

export interface SajuPillarSummary {
  stemCode: string;
  stemHangul: string;
  stemHanja: string;
  branchCode: string;
  branchHangul: string;
  branchHanja: string;
  hangul: string;
  hanja: string;
}

export interface SajuTraceStepSummary {
  key: string;
  summary: string;
  evidence: string[];
  citations: string[];
  reasoning: string[];
  confidence: number | null;
}

export interface SajuCalculationInputSummary {
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  birthHour: number;
  birthMinute: number;
  gender: "MALE" | "FEMALE";
  timezone: string;
  latitude: number;
  longitude: number;
}

export interface SajuYongshinRecommendationSummary {
  type: string;
  primaryElement: string;
  secondaryElement: string | null;
  confidence: number;
  reasoning: string;
}

export interface SajuYongshinSummary {
  finalYongshin: string;
  finalHeesin: string | null;
  gisin: string | null;
  gusin: string | null;
  finalConfidence: number;
  agreement: string;
  recommendations: SajuYongshinRecommendationSummary[];
}

export interface SajuStrengthSummary {
  level: string;
  isStrong: boolean;
  totalSupport: number;
  totalOppose: number;
}

export interface SajuDayMasterSummary {
  stemCode: string;
  stemHangul: string;
  stemHanja: string;
  elementCode: string;
  element: string;
  eumyangCode: string;
}

export interface SajuGyeokgukSummary {
  type: string;
  category: string;
  confidence: number;
  reasoning: string;
  formation: {
    quality: string;
    breakingFactors: string[];
    rescueFactors: string[];
    reasoning: string;
  } | null;
}

export interface SajuTenGodGroupCountsSummary {
  friend: number;
  output: number;
  wealth: number;
  authority: number;
  resource: number;
}

export interface SajuTenGodSummary {
  dayMasterStemCode: string;
  groupCounts: SajuTenGodGroupCountsSummary;
  dominantGroups: Array<keyof SajuTenGodGroupCountsSummary>;
  weakGroups: Array<keyof SajuTenGodGroupCountsSummary>;
}

export interface SajuCalculationOutputSummary {
  pillars: {
    year: SajuPillarSummary;
    month: SajuPillarSummary;
    day: SajuPillarSummary;
    hour: SajuPillarSummary;
  };
  ohaengDistribution: Record<string, number>;
  dayMaster: SajuDayMasterSummary;
  yongshin: SajuYongshinSummary | null;
  strength: SajuStrengthSummary | null;
  gyeokguk: SajuGyeokgukSummary | null;
  tenGod: SajuTenGodSummary | null;
  trace: SajuTraceStepSummary[];
}

export interface SajuScoringBreakdown {
  balance: number;
  yongshin: number;
  strength: number;
  tenGod: number;
  weights: {
    balance: number;
    yongshin: number;
    strength: number;
    tenGod: number;
  };
  weightedBeforePenalty: number;
  penalties: {
    gisin: number;
    gusin: number;
    total: number;
  };
  elementMatches: {
    yongshin: number;
    heesin: number;
    gisin: number;
    gusin: number;
  };
}

export interface SajuCategoryDetails {
  sajuDistribution: Record<string, number>;
  sajuDistributionSource: "birth" | "fallback";
  jawonDistribution: Record<string, number>;
  sajuJawonDistribution: Record<string, number>;
  sajuScoring?: SajuScoringBreakdown;
  requestedBirth?: BirthDateTime;
  requestedGender?: string;
  sajuInput?: SajuCalculationInputSummary | null;
  sajuOutput?: SajuCalculationOutputSummary | null;
  sajuCalculationError?: string | null;
}

export interface AnalysisCandidate {
  lastNameHangul: string;
  firstNameHangul: string;
  lastNameHanja: string;
  firstNameHanja: string;
  totalScore: number;
  interpretation: string;
  categories: AnalysisCategory[];
  provider: string;
}

export interface AnalysisResult {
  candidates: AnalysisCandidate[];
  totalCount: number;
  provider: string;
}

export interface CandidateSearchResult extends AnalysisResult {
  query: string;
  truncated: boolean;
  offset: number;
  limit: number | null;
}

export interface AnalyzeRequest {
  lastNameHangul: string;
  firstNameHangul: string;
  lastNameHanja: string;
  firstNameHanja: string;
  birthDateTime: BirthDateTime;
  gender: GenderOption;
}

export interface GivenNameConstraint {
  korean: string;
  hanja: string;
}

export interface CandidateSearchRequest {
  surnameHangul: string;
  surnameHanja: string;
  constraints: readonly GivenNameConstraint[];
  birthDateTime?: BirthDateTime;
  gender: GenderOption;
  limit?: number;
  offset: number;
}
