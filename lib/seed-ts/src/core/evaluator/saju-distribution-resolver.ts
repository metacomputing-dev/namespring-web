import {
  analyzeSaju,
  createBirthInput,
} from "@metaintelligence/saju";

import type { BirthInfo, Element, Gender } from "../types.js";
import {
  cloneDistribution,
  fromOhaengDistribution,
  toInputSummary,
  toOutputSummary,
  toSajuGender,
} from "./saju-distribution-mappers.js";

// Re-export all types for backward compatibility
export type {
  SajuDistributionSource,
  SajuCalculationInputSummary,
  SajuPillarSummary,
  SajuTraceStepSummary,
  SajuYongshinRecommendationSummary,
  SajuYongshinSummary,
  SajuStrengthSummary,
  SajuDayMasterSummary,
  SajuGyeokgukSummary,
  SajuTenGodGroupCountsSummary,
  SajuTenGodSummary,
  SajuCalculationOutputSummary,
  SajuDistributionResolution,
} from "./saju-distribution-types.js";
import type { SajuDistributionResolution } from "./saju-distribution-types.js";

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
