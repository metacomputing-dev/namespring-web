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

type TenGodGroup = keyof SajuTenGodGroupCountsSummary;

const EMPTY_TEN_GOD_GROUP_COUNTS: SajuTenGodGroupCountsSummary = {
  friend: 0,
  output: 0,
  wealth: 0,
  authority: 0,
  resource: 0,
};

const TEN_GOD_GROUP_KEYS: TenGodGroup[] = ["friend", "output", "wealth", "authority", "resource"];

function cloneDistribution(distribution: Record<Element, number>): Record<Element, number> {
  return {
    "\u6728": distribution["\u6728"] ?? 0,
    "\u706B": distribution["\u706B"] ?? 0,
    "\u571F": distribution["\u571F"] ?? 0,
    "\u91D1": distribution["\u91D1"] ?? 0,
    "\u6C34": distribution["\u6C34"] ?? 0,
  };
}

function cloneTenGodGroupCounts(
  counts: SajuTenGodGroupCountsSummary = EMPTY_TEN_GOD_GROUP_COUNTS,
): SajuTenGodGroupCountsSummary {
  return {
    friend: counts.friend ?? 0,
    output: counts.output ?? 0,
    wealth: counts.wealth ?? 0,
    authority: counts.authority ?? 0,
    resource: counts.resource ?? 0,
  };
}

function toTenGodGroup(value: string): TenGodGroup | null {
  switch (value) {
    case "BI_GYEON":
    case "GYEOB_JAE":
      return "friend";
    case "SIK_SIN":
    case "SANG_GWAN":
      return "output";
    case "PYEON_JAE":
    case "JEONG_JAE":
      return "wealth";
    case "PYEON_GWAN":
    case "JEONG_GWAN":
      return "authority";
    case "PYEON_IN":
    case "JEONG_IN":
      return "resource";
    default:
      return null;
  }
}

function toDayMasterSummary(analysis: SajuAnalysis): SajuDayMasterSummary {
  const dayMaster = analysis.pillars.day.cheongan;
  const dayMasterInfo = CHEONGAN_INFO[dayMaster];
  const element = OHAENG_TO_ELEMENT[dayMasterInfo.ohaeng];
  return {
    stemCode: dayMaster,
    stemHangul: dayMasterInfo.hangul,
    stemHanja: dayMasterInfo.hanja,
    elementCode: dayMasterInfo.ohaeng,
    element,
    eumyangCode: dayMasterInfo.eumyang,
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

function toYongshinSummary(analysis: SajuAnalysis): SajuYongshinSummary | null {
  if (!analysis.yongshinResult) {
    return null;
  }

  return {
    finalYongshin: analysis.yongshinResult.finalYongshin,
    finalHeesin: analysis.yongshinResult.finalHeesin ?? null,
    gisin: analysis.yongshinResult.gisin ?? null,
    gusin: analysis.yongshinResult.gusin ?? null,
    finalConfidence: analysis.yongshinResult.finalConfidence,
    agreement: analysis.yongshinResult.agreement,
    recommendations: analysis.yongshinResult.recommendations.map((recommendation) => ({
      type: recommendation.type,
      primaryElement: recommendation.primaryElement,
      secondaryElement: recommendation.secondaryElement ?? null,
      confidence: recommendation.confidence,
      reasoning: recommendation.reasoning,
    })),
  };
}

function toStrengthSummary(analysis: SajuAnalysis): SajuStrengthSummary | null {
  if (!analysis.strengthResult) {
    return null;
  }

  return {
    level: analysis.strengthResult.level,
    isStrong: analysis.strengthResult.isStrong,
    totalSupport: analysis.strengthResult.score.totalSupport,
    totalOppose: analysis.strengthResult.score.totalOppose,
  };
}

function toGyeokgukSummary(analysis: SajuAnalysis): SajuGyeokgukSummary | null {
  if (!analysis.gyeokgukResult) {
    return null;
  }

  return {
    type: analysis.gyeokgukResult.type,
    category: analysis.gyeokgukResult.category,
    confidence: analysis.gyeokgukResult.confidence,
    reasoning: analysis.gyeokgukResult.reasoning,
    formation: analysis.gyeokgukResult.formation
      ? {
          quality: analysis.gyeokgukResult.formation.quality,
          breakingFactors: [...analysis.gyeokgukResult.formation.breakingFactors],
          rescueFactors: [...analysis.gyeokgukResult.formation.rescueFactors],
          reasoning: analysis.gyeokgukResult.formation.reasoning,
        }
      : null,
  };
}

function toTenGodSummary(analysis: SajuAnalysis): SajuTenGodSummary | null {
  const tenGodAnalysis = analysis.tenGodAnalysis;
  if (!tenGodAnalysis) {
    return null;
  }

  const groupCounts = cloneTenGodGroupCounts();
  for (const pillarAnalysis of Object.values(tenGodAnalysis.byPosition)) {
    if (!pillarAnalysis) {
      continue;
    }
    const cheonganGroup = toTenGodGroup(pillarAnalysis.cheonganSipseong);
    if (cheonganGroup) {
      groupCounts[cheonganGroup] += 1;
    }
    const principalGroup = toTenGodGroup(pillarAnalysis.jijiPrincipalSipseong);
    if (principalGroup) {
      groupCounts[principalGroup] += 1;
    }
  }

  const values = TEN_GOD_GROUP_KEYS.map((key) => groupCounts[key]);
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);

  return {
    dayMasterStemCode: tenGodAnalysis.dayMaster,
    groupCounts,
    dominantGroups: TEN_GOD_GROUP_KEYS.filter((key) => groupCounts[key] === maxValue && maxValue > 0),
    weakGroups: TEN_GOD_GROUP_KEYS.filter((key) => groupCounts[key] === minValue),
  };
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
    dayMaster: toDayMasterSummary(analysis),
    yongshin: toYongshinSummary(analysis),
    strength: toStrengthSummary(analysis),
    gyeokguk: toGyeokgukSummary(analysis),
    tenGod: toTenGodSummary(analysis),
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
