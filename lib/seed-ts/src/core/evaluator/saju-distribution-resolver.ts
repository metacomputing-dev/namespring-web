import {
  CHEONGAN_INFO,
  JIJI_INFO,
  Gender as SajuGender,
  Ohaeng,
  analyzeSaju,
  createBirthInput,
  type AnalysisTraceStep,
  type SajuAnalysis,
} from "@metaintelligence/saju";

import type { BirthInfo, Element, Gender } from "../types.js";

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

export interface SajuCalculationOutputSummary {
  pillars: Record<SajuPillarPosition, SajuPillarSummary>;
  ohaengDistribution: Record<Element, number>;
  yongshin: {
    finalYongshin: string;
    finalHeesin: string | null;
    gisin: string | null;
    gusin: string | null;
    finalConfidence: number;
  } | null;
  strength: {
    level: string;
    isStrong: boolean;
    totalSupport: number;
    totalOppose: number;
  } | null;
  trace: SajuTraceStepSummary[];
}

export interface SajuDistributionResolution {
  distribution: Record<Element, number>;
  source: SajuDistributionSource;
  input: SajuCalculationInputSummary | null;
  output: SajuCalculationOutputSummary | null;
  error: string | null;
}

const EMPTY_DISTRIBUTION: Record<Element, number> = {
  "\u6728": 0,
  "\u706B": 0,
  "\u571F": 0,
  "\u91D1": 0,
  "\u6C34": 0,
};

const OHAENG_TO_ELEMENT: Record<Ohaeng, Element> = {
  [Ohaeng.WOOD]: "\u6728",
  [Ohaeng.FIRE]: "\u706B",
  [Ohaeng.EARTH]: "\u571F",
  [Ohaeng.METAL]: "\u91D1",
  [Ohaeng.WATER]: "\u6C34",
};

function cloneDistribution(distribution: Record<Element, number>): Record<Element, number> {
  return {
    "\u6728": distribution["\u6728"] ?? 0,
    "\u706B": distribution["\u706B"] ?? 0,
    "\u571F": distribution["\u571F"] ?? 0,
    "\u91D1": distribution["\u91D1"] ?? 0,
    "\u6C34": distribution["\u6C34"] ?? 0,
  };
}

function toSajuGender(gender?: Gender): SajuGender {
  if (gender === "FEMALE" || gender === "female") {
    return SajuGender.FEMALE;
  }
  return SajuGender.MALE;
}

function toCoreGender(gender: SajuGender): "MALE" | "FEMALE" {
  return gender === SajuGender.FEMALE ? "FEMALE" : "MALE";
}

function toInputSummary(
  birth: BirthInfo,
  gender: SajuGender,
  timezone = "Asia/Seoul",
  latitude = 37.5665,
  longitude = 126.978,
): SajuCalculationInputSummary {
  return {
    birthYear: birth.year,
    birthMonth: birth.month,
    birthDay: birth.day,
    birthHour: birth.hour,
    birthMinute: birth.minute,
    gender: toCoreGender(gender),
    timezone,
    latitude,
    longitude,
  };
}

function fromOhaengDistribution(ohaengDistribution: Map<Ohaeng, number> | null): Record<Element, number> | null {
  if (!ohaengDistribution) {
    return null;
  }

  const distribution = cloneDistribution(EMPTY_DISTRIBUTION);
  for (const [ohaeng, count] of ohaengDistribution.entries()) {
    const element = OHAENG_TO_ELEMENT[ohaeng];
    distribution[element] = count;
  }
  return distribution;
}

function toPillarSummary(analysis: SajuAnalysis, position: SajuPillarPosition): SajuPillarSummary {
  const pillar = analysis.pillars[position];
  const stemInfo = CHEONGAN_INFO[pillar.cheongan];
  const branchInfo = JIJI_INFO[pillar.jiji];

  return {
    stemCode: pillar.cheongan,
    stemHangul: stemInfo.hangul,
    stemHanja: stemInfo.hanja,
    branchCode: pillar.jiji,
    branchHangul: branchInfo.hangul,
    branchHanja: branchInfo.hanja,
    hangul: `${stemInfo.hangul}${branchInfo.hangul}`,
    hanja: `${stemInfo.hanja}${branchInfo.hanja}`,
  };
}

function toTraceSummary(trace: readonly AnalysisTraceStep[]): SajuTraceStepSummary[] {
  return trace.map((step) => ({
    key: step.key,
    summary: step.summary,
    evidence: [...step.evidence],
    citations: [...step.citations],
    reasoning: [...step.reasoning],
    confidence: step.confidence,
  }));
}

function toOutputSummary(
  analysis: SajuAnalysis,
  distribution: Record<Element, number>,
): SajuCalculationOutputSummary {
  return {
    pillars: {
      year: toPillarSummary(analysis, "year"),
      month: toPillarSummary(analysis, "month"),
      day: toPillarSummary(analysis, "day"),
      hour: toPillarSummary(analysis, "hour"),
    },
    ohaengDistribution: cloneDistribution(distribution),
    yongshin: analysis.yongshinResult
      ? {
          finalYongshin: analysis.yongshinResult.finalYongshin,
          finalHeesin: analysis.yongshinResult.finalHeesin ?? null,
          gisin: analysis.yongshinResult.gisin ?? null,
          gusin: analysis.yongshinResult.gusin ?? null,
          finalConfidence: analysis.yongshinResult.finalConfidence,
        }
      : null,
    strength: analysis.strengthResult
      ? {
          level: analysis.strengthResult.level,
          isStrong: analysis.strengthResult.isStrong,
          totalSupport: analysis.strengthResult.score.totalSupport,
          totalOppose: analysis.strengthResult.score.totalOppose,
        }
      : null,
    trace: toTraceSummary(analysis.trace),
  };
}

function messageFromUnknown(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "Failed to analyze saju distribution.";
}

export function resolveSajuDistribution(
  birth: BirthInfo | undefined,
  gender: Gender | undefined,
  fallbackDistribution: Record<Element, number>,
): SajuDistributionResolution {
  const fallback = cloneDistribution(fallbackDistribution);
  if (!birth) {
    return {
      distribution: fallback,
      source: "fallback",
      input: null,
      output: null,
      error: null,
    };
  }

  const sajuGender = toSajuGender(gender);
  const requestedInput = toInputSummary(birth, sajuGender);
  try {
    const birthInput = createBirthInput({
      birthYear: birth.year,
      birthMonth: birth.month,
      birthDay: birth.day,
      birthHour: birth.hour,
      birthMinute: birth.minute,
      gender: sajuGender,
      timezone: requestedInput.timezone,
      latitude: requestedInput.latitude,
      longitude: requestedInput.longitude,
    });

    const analysis = analyzeSaju(birthInput);
    const distribution = fromOhaengDistribution(analysis.ohaengDistribution);
    if (!distribution) {
      return {
        distribution: fallback,
        source: "fallback",
        input: requestedInput,
        output: null,
        error: "Saju analysis did not provide ohaeng distribution.",
      };
    }
    return {
      distribution,
      source: "birth",
      input: requestedInput,
      output: toOutputSummary(analysis, distribution),
      error: null,
    };
  } catch (error) {
    return {
      distribution: fallback,
      source: "fallback",
      input: requestedInput,
      output: null,
      error: messageFromUnknown(error),
    };
  }
}
