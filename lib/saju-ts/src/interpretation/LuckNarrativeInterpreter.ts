import { Cheongan } from '../domain/Cheongan.js';
import { type DaeunInfo, type DaeunPillar } from '../domain/DaeunInfo.js';
import {
  type DaeunAnalysis,
  type LuckPillarAnalysis,
  LuckQuality,
} from '../domain/LuckInteraction.js';
import { Ohaeng } from '../domain/Ohaeng.js';
import { type Pillar } from '../domain/Pillar.js';
import { type SaeunPillar } from '../domain/SaeunInfo.js';
import {
  SIPSEONG_UN_THEMES,
  UNSEONG_ENERGY_THEMES,
  type SipseongUnTheme,
  type UnseongEnergyTheme,
} from './LuckNarrativeThemes.js';
import {
  buildCombinedInterpretation,
  buildPracticalGuidance,
  buildRelationImpacts,
  buildTransitionWarning,
  buildWhySummary,
  buildYongshinExplanation,
} from './LuckNarrativeBuilderHelpers.js';
export {
  SIPSEONG_UN_THEMES,
  UNSEONG_ENERGY_THEMES,
};
export type {
  SipseongUnTheme,
  UnseongEnergyTheme,
};
export {
  buildCombinedInterpretation,
  buildPracticalGuidance,
  buildRelationImpacts,
  buildTransitionWarning,
  buildWhySummary,
  buildYongshinExplanation,
} from './LuckNarrativeBuilderHelpers.js';


export interface DaeunNarrative {
  readonly daeunPillar: DaeunPillar;
  readonly quality: LuckQuality;
  readonly sipseongTheme: SipseongUnTheme;
  readonly energyTheme: UnseongEnergyTheme;
  readonly yongshinExplanation: string;
  readonly relationImpacts: readonly string[];
  readonly transitionWarning: string;
  readonly whySummary: string;
  readonly practicalGuidance: string;
}

export interface SaeunNarrative {
  readonly year: number;
  readonly pillar: Pillar;
  readonly quality: LuckQuality;
  readonly sipseongTheme: SipseongUnTheme;
  readonly energyTheme: UnseongEnergyTheme;
  readonly currentDaeunPillar: DaeunPillar | null;
  readonly combinedInterpretation: string;
  readonly whySummary: string;
  readonly practicalGuidance: string;
}

export interface LuckNarrative {
  readonly daeunNarratives: readonly DaeunNarrative[];
  readonly saeunNarratives: readonly SaeunNarrative[];
}



export function findCurrentDaeun(daeunInfo: DaeunInfo, year: number, birthYear: number): DaeunPillar | null {
  const koreanAge = year - birthYear + 1;
  return daeunInfo.daeunPillars.find(dp => koreanAge >= dp.startAge && koreanAge <= dp.endAge) ?? null;
}









export function interpretDaeun(
  daeunAnalysis: DaeunAnalysis,
  dayMaster: Cheongan,
  yongshinElement: Ohaeng | null | undefined,
  gisinElement: Ohaeng | null | undefined,
): DaeunNarrative {
  const lpa = daeunAnalysis.analysis;
  const sipseongTheme = SIPSEONG_UN_THEMES.get(lpa.sipseong)!;
  const energyTheme = UNSEONG_ENERGY_THEMES.get(lpa.sibiUnseong)!;
  const yongshinExplanation = buildYongshinExplanation(lpa, yongshinElement, gisinElement);
  const relationImpacts = buildRelationImpacts(lpa);
  const transitionWarning = buildTransitionWarning(daeunAnalysis);
  const whySummary = buildWhySummary(lpa, sipseongTheme, energyTheme, yongshinExplanation, daeunAnalysis.isTransitionPeriod);
  const practicalGuidance = buildPracticalGuidance(lpa, sipseongTheme, energyTheme);

  return {
    daeunPillar: daeunAnalysis.daeunPillar,
    quality: lpa.quality,
    sipseongTheme,
    energyTheme,
    yongshinExplanation,
    relationImpacts,
    transitionWarning,
    whySummary,
    practicalGuidance,
  };
}

export function interpretSaeun(
  saeun: SaeunPillar,
  lpa: LuckPillarAnalysis,
  currentDaeun: DaeunPillar | null,
  dayMaster: Cheongan,
  yongshinElement: Ohaeng | null | undefined,
  gisinElement: Ohaeng | null | undefined,
): SaeunNarrative {
  const sipseongTheme = SIPSEONG_UN_THEMES.get(lpa.sipseong)!;
  const energyTheme = UNSEONG_ENERGY_THEMES.get(lpa.sibiUnseong)!;
  const combinedInterpretation = buildCombinedInterpretation(lpa, currentDaeun, sipseongTheme, yongshinElement, gisinElement);
  const whySummary = buildWhySummary(lpa, sipseongTheme, energyTheme, buildYongshinExplanation(lpa, yongshinElement, gisinElement), false);
  const practicalGuidance = buildPracticalGuidance(lpa, sipseongTheme, energyTheme);

  return {
    year: saeun.year,
    pillar: saeun.pillar,
    quality: lpa.quality,
    sipseongTheme,
    energyTheme,
    currentDaeunPillar: currentDaeun,
    combinedInterpretation,
    whySummary,
    practicalGuidance,
  };
}

export const LuckNarrativeInterpreter = {
  SIPSEONG_UN_THEMES,
  UNSEONG_ENERGY_THEMES,

  interpretDaeun,
  interpretSaeun,
  findCurrentDaeun,

  buildYongshinExplanation,
  buildRelationImpacts,
  buildTransitionWarning,
  buildWhySummary,
  buildPracticalGuidance,
  buildCombinedInterpretation,
} as const;

