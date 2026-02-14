import type { Element } from "../types.js";

export type SajuDistributionSource = "birth" | "fallback";

type SajuPillarPosition = "year" | "month" | "day" | "hour";

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
  element: Element;
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
  pillars: Record<SajuPillarPosition, SajuPillarSummary>;
  ohaengDistribution: Record<Element, number>;
  dayMaster: SajuDayMasterSummary;
  yongshin: SajuYongshinSummary | null;
  strength: SajuStrengthSummary | null;
  gyeokguk: SajuGyeokgukSummary | null;
  tenGod: SajuTenGodSummary | null;
  trace: SajuTraceStepSummary[];
}

export interface SajuDistributionResolution {
  distribution: Record<Element, number>;
  source: SajuDistributionSource;
  input: SajuCalculationInputSummary | null;
  output: SajuCalculationOutputSummary | null;
  error: string | null;
}
