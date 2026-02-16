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

function qualityOverviewSuffix(quality: LuckQuality): string {
  if (quality === LuckQuality.VERY_FAVORABLE || quality === LuckQuality.FAVORABLE) {
    return '전반 운의 뒷받침이 있어 준비된 과제는 실행력을 높이기 좋습니다.';
  }
  if (quality === LuckQuality.UNFAVORABLE || quality === LuckQuality.VERY_UNFAVORABLE) {
    return '전반적으로 변동성이 큰 편이므로 확장보다 손실 관리와 점검을 우선하는 편이 안전합니다.';
  }
  return '전반 흐름은 중립권이므로 과속을 피하고 기본기를 유지하면 안정적으로 운영할 수 있습니다.';
}

function qualityDomainSuffix(quality: LuckQuality, domain: 'wealth' | 'career' | 'health' | 'love'): string {
  if (quality === LuckQuality.VERY_FAVORABLE || quality === LuckQuality.FAVORABLE) {
    if (domain === 'wealth') return '성과가 날수록 기준 없는 확장보다 수익 구조를 정리해 누적 이익을 남기세요.';
    if (domain === 'career') return '성과가 보일 때 역할 범위를 명확히 하면 성장 속도를 안정적으로 유지할 수 있습니다.';
    if (domain === 'health') return '무리가 누적되지 않게 회복 루틴을 함께 유지하면 컨디션 상승폭을 지킬 수 있습니다.';
    return '관계가 열릴수록 속도 조절과 경계 설정을 함께 하면 안정감이 오래갑니다.';
  }

  if (quality === LuckQuality.UNFAVORABLE || quality === LuckQuality.VERY_UNFAVORABLE) {
    if (domain === 'wealth') return '새 수익 확대보다 현금흐름 방어와 손실 제한 규칙을 먼저 세우세요.';
    if (domain === 'career') return '성과 경쟁보다 실수 예방과 일정 품질 관리가 우선입니다.';
    if (domain === 'health') return '과로 신호를 초기에 관리하고 정기 점검 주기를 짧게 가져가세요.';
    return '오해가 커지기 쉬운 시기라 감정 반응보다 사실 확인 대화를 먼저 두는 편이 좋습니다.';
  }

  if (domain === 'wealth') return '지출·저축 비율을 고정하면 변동을 작게 만들 수 있습니다.';
  if (domain === 'career') return '업무 우선순위를 명확히 하면 시행착오를 줄일 수 있습니다.';
  if (domain === 'health') return '수면·식사·활동 루틴을 일정하게 유지하면 기복을 줄일 수 있습니다.';
  return '관계에서 기대치와 역할을 먼저 맞추면 안정적인 흐름을 만들기 쉽습니다.';
}

function withQualityContext(
  base: string,
  quality: LuckQuality,
  domain: 'wealth' | 'career' | 'health' | 'love',
): string {
  return `${base} ${qualityDomainSuffix(quality, domain)}`.trim();
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
    overview: `${buildOverview(targetYear, lpa.sipseong, lpa.isYongshinElement, lpa.isGisinElement, currentDaeun)} ${qualityOverviewSuffix(lpa.quality)}`.trim(),
    wealthForecast: withQualityContext(buildWealthForecast(lpa.sipseong, isStrong), lpa.quality, 'wealth'),
    careerForecast: withQualityContext(buildCareerForecast(lpa.sipseong), lpa.quality, 'career'),
    healthForecast: withQualityContext(buildHealthForecast(saeunPillar, lpa.sibiUnseong), lpa.quality, 'health'),
    loveForecast: withQualityContext(buildLoveForecast(lpa.sipseong, analysis.input.gender), lpa.quality, 'love'),
    monthlyHighlights,
    bestMonths,
    cautionMonths,
  };
}
