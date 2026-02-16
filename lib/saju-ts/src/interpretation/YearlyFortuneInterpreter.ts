import { Sipseong, SIPSEONG_INFO } from '../domain/Sipseong.js';
import { CHEONGAN_INFO } from '../domain/Cheongan.js';
import { JIJI_INFO } from '../domain/Jiji.js';
import { LuckQuality, LUCK_QUALITY_INFO } from '../domain/LuckInteraction.js';
import type { LuckPillarAnalysis } from '../domain/LuckInteraction.js';
import type { DaeunPillar } from '../domain/DaeunInfo.js';
import type { Pillar } from '../domain/Pillar.js';
import type { SajuAnalysis } from '../domain/SajuAnalysis.js';
import { buildCareerForecast, buildHealthForecast, buildLoveForecast, buildOverview, buildWealthForecast, monthLabel } from './YearlyFortuneNarrativeBuilders.js';
import {
  LUCK_QUALITY_ICON,
  LUCK_QUALITY_MONTH_HIGHLIGHT,
  isFavorableLuckQuality,
  isUnfavorableLuckQuality,
} from './LuckQualityNarrative.js';

export interface MonthlyHighlight {
  readonly monthLabel: string;
  readonly sajuMonthIndex: number;
  readonly pillar: Pillar;
  readonly quality: LuckQuality;
  readonly highlight: string;
}

export interface YearlyFortune {
  readonly targetYear: number;
  readonly saeunPillar: Pillar;
  readonly quality: LuckQuality;
  readonly sipseong: Sipseong;
  readonly overview: string;
  readonly wealthForecast: string;
  readonly careerForecast: string;
  readonly healthForecast: string;
  readonly loveForecast: string;
  readonly monthlyHighlights: readonly MonthlyHighlight[];
  readonly bestMonths: readonly string[];
  readonly cautionMonths: readonly string[];
}

function findCurrentDaeun(a: SajuAnalysis, targetYear: number): DaeunPillar | null {
  const daeunInfo = a.daeunInfo;
  if (!daeunInfo) return null;
  const birthYear = a.input.birthYear;
  const age = targetYear - birthYear;
  let result: DaeunPillar | null = null;
  for (const dp of daeunInfo.daeunPillars) {
    if (dp.startAge <= age) result = dp;
  }
  return result;
}

export function yearlyFortuneToNarrative(fortune: YearlyFortune): string {
  const lines: string[] = [];
  const ci = CHEONGAN_INFO[fortune.saeunPillar.cheongan];
  const ji = JIJI_INFO[fortune.saeunPillar.jiji];
  const ssi = SIPSEONG_INFO[fortune.sipseong];
  const qi = LUCK_QUALITY_INFO[fortune.quality];

  lines.push(`\u25A0 ${fortune.targetYear}년 연간 운세`);
  lines.push('');
  lines.push(`세운 기둥: ${ci.hangul}${ji.hangul}(${ci.hanja}${ji.hanja})`);
  lines.push(`운세 등급: ${qi.koreanName}`);
  lines.push(`운세 테마: ${ssi.koreanName}(${ssi.hanja})운`);
  lines.push('');
  lines.push(fortune.overview);
  lines.push('');

  lines.push('\u3010재물운\u3011');
  lines.push(`  ${fortune.wealthForecast}`);
  lines.push('');
  lines.push('\u3010직업운\u3011');
  lines.push(`  ${fortune.careerForecast}`);
  lines.push('');
  lines.push('\u3010건강운\u3011');
  lines.push(`  ${fortune.healthForecast}`);
  lines.push('');
  lines.push('\u3010연애운\u3011');
  lines.push(`  ${fortune.loveForecast}`);
  lines.push('');

  if (fortune.bestMonths.length > 0) {
    lines.push(`\u25B8 기회 시기: ${fortune.bestMonths.join(', ')}`);
  }
  if (fortune.cautionMonths.length > 0) {
    lines.push(`\u25B8 주의 시기: ${fortune.cautionMonths.join(', ')}`);
  }
  lines.push('');

  lines.push('\u3010월별 운세 하이라이트\u3011');
  for (const mh of fortune.monthlyHighlights) {
    const qi2 = LUCK_QUALITY_INFO[mh.quality];
    lines.push(`  ${mh.monthLabel} ${LUCK_QUALITY_ICON[mh.quality]} [${qi2.koreanName}] ${mh.highlight}`);
  }

  return lines.join('\n').trimEnd();
}

export function buildYearlyFortune(
  analysis: SajuAnalysis,
  targetYear: number,
  saeunPillar: Pillar,
  lpa: LuckPillarAnalysis,
  monthlyAnalyses: ReadonlyArray<{ sajuMonthIndex: number; pillar: Pillar; analysis: LuckPillarAnalysis }>,
): YearlyFortune {
  const currentDaeun = findCurrentDaeun(analysis, targetYear);
  const isStrong = analysis.strengthResult?.isStrong ?? true;

  const monthlyHighlights: MonthlyHighlight[] = monthlyAnalyses.map(ma => {
    return {
      monthLabel: monthLabel(ma.sajuMonthIndex),
      sajuMonthIndex: ma.sajuMonthIndex,
      pillar: ma.pillar,
      quality: ma.analysis.quality,
      highlight: LUCK_QUALITY_MONTH_HIGHLIGHT[ma.analysis.quality],
    };
  });

  const bestMonths = monthlyHighlights
    .filter(mh => isFavorableLuckQuality(mh.quality))
    .map(mh => mh.monthLabel);
  const cautionMonths = monthlyHighlights
    .filter(mh => isUnfavorableLuckQuality(mh.quality))
    .map(mh => mh.monthLabel);

  return {
    targetYear,
    saeunPillar,
    quality: lpa.quality,
    sipseong: lpa.sipseong,
    overview: buildOverview(targetYear, lpa.sipseong, lpa.isYongshinElement, lpa.isGisinElement, currentDaeun),
    wealthForecast: buildWealthForecast(lpa.sipseong, isStrong),
    careerForecast: buildCareerForecast(lpa.sipseong),
    healthForecast: buildHealthForecast(saeunPillar, lpa.sibiUnseong),
    loveForecast: buildLoveForecast(lpa.sipseong, analysis.input.gender),
    monthlyHighlights,
    bestMonths,
    cautionMonths,
  };
}
