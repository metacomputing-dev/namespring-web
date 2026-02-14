import {
  CHEONGAN_INFO,
  JIJI_INFO,
  Gender as SajuGender,
  Ohaeng,
  type AnalysisTraceStep,
  type SajuAnalysis,
} from "@metaintelligence/saju";

import { ELEMENT_ORDER, EMPTY_ELEMENT_DISTRIBUTION } from "../constants.js";
import type { Element, Gender } from "../types.js";
import type {
  SajuCalculationInputSummary,
  SajuCalculationOutputSummary,
  SajuDayMasterSummary,
  SajuGyeokgukSummary,
  SajuPillarSummary,
  SajuStrengthSummary,
  SajuTenGodGroupCountsSummary,
  SajuTenGodSummary,
  SajuTraceStepSummary,
  SajuYongshinSummary,
} from "./saju-distribution-types.js";
import type { BirthInfo } from "../types.js";

const OHAENG_TO_ELEMENT: Record<Ohaeng, Element> = {
  [Ohaeng.WOOD]: ELEMENT_ORDER[0],
  [Ohaeng.FIRE]: ELEMENT_ORDER[1],
  [Ohaeng.EARTH]: ELEMENT_ORDER[2],
  [Ohaeng.METAL]: ELEMENT_ORDER[3],
  [Ohaeng.WATER]: ELEMENT_ORDER[4],
};

type TenGodGroup = keyof SajuTenGodGroupCountsSummary;
type SajuPillarPosition = "year" | "month" | "day" | "hour";

const EMPTY_TEN_GOD_GROUP_COUNTS: SajuTenGodGroupCountsSummary = {
  friend: 0,
  output: 0,
  wealth: 0,
  authority: 0,
  resource: 0,
};

const TEN_GOD_GROUP_KEYS: TenGodGroup[] = ["friend", "output", "wealth", "authority", "resource"];

export function cloneDistribution(distribution: Record<Element, number>): Record<Element, number> {
  return Object.fromEntries(
    ELEMENT_ORDER.map((element) => [element, distribution[element] ?? 0]),
  ) as Record<Element, number>;
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

const TEN_GOD_GROUP_MAP: Record<string, TenGodGroup> = {
  BI_GYEON: "friend",
  GYEOB_JAE: "friend",
  SIK_SIN: "output",
  SANG_GWAN: "output",
  PYEON_JAE: "wealth",
  JEONG_JAE: "wealth",
  PYEON_GWAN: "authority",
  JEONG_GWAN: "authority",
  PYEON_IN: "resource",
  JEONG_IN: "resource",
};

function toTenGodGroup(value: string): TenGodGroup | null {
  return TEN_GOD_GROUP_MAP[value] ?? null;
}

export function toDayMasterSummary(analysis: SajuAnalysis): SajuDayMasterSummary {
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

export function toSajuGender(gender?: Gender): SajuGender {
  if (gender === "FEMALE" || gender === "female") {
    return SajuGender.FEMALE;
  }
  return SajuGender.MALE;
}

function toCoreGender(gender: SajuGender): "MALE" | "FEMALE" {
  return gender === SajuGender.FEMALE ? "FEMALE" : "MALE";
}

export function toInputSummary(
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

export function fromOhaengDistribution(ohaengDistribution: Map<Ohaeng, number> | null): Record<Element, number> | null {
  if (!ohaengDistribution) {
    return null;
  }

  const distribution = cloneDistribution(EMPTY_ELEMENT_DISTRIBUTION as Record<Element, number>);
  for (const [ohaeng, count] of ohaengDistribution.entries()) {
    const element = OHAENG_TO_ELEMENT[ohaeng];
    distribution[element] = count;
  }
  return distribution;
}

export function toPillarSummary(analysis: SajuAnalysis, position: SajuPillarPosition): SajuPillarSummary {
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

export function toYongshinSummary(analysis: SajuAnalysis): SajuYongshinSummary | null {
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

export function toStrengthSummary(analysis: SajuAnalysis): SajuStrengthSummary | null {
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

export function toGyeokgukSummary(analysis: SajuAnalysis): SajuGyeokgukSummary | null {
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

export function toTenGodSummary(analysis: SajuAnalysis): SajuTenGodSummary | null {
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

export function toOutputSummary(
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
