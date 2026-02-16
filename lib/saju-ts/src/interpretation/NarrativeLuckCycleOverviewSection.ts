import { CHEONGAN_INFO } from '../domain/Cheongan.js';
import { JIJI_INFO } from '../domain/Jiji.js';
import { type DaeunAnalysis, LuckQuality, LUCK_QUALITY_INFO } from '../domain/LuckInteraction.js';
import type { SajuAnalysis } from '../domain/SajuAnalysis.js';
import { LuckInteractionAnalyzer } from '../engine/luck/LuckInteractionAnalyzer.js';
import { formatPillar, ohaengKorean } from './NarrativeFormatting.js';
import { LuckNarrativeInterpreter } from './LuckNarrativeInterpreter.js';
import { sentenceCite } from './NarrativeSentenceCite.js';
import { getKoreanDateParts } from './ServiceDateTime.js';

const FAVORABLE_QUALITIES = new Set<LuckQuality>([
  LuckQuality.VERY_FAVORABLE,
  LuckQuality.FAVORABLE,
]);

const CAUTION_QUALITIES = new Set<LuckQuality>([
  LuckQuality.UNFAVORABLE,
  LuckQuality.VERY_UNFAVORABLE,
]);

type LifetimeTone = 'upward' | 'mixed' | 'defensive';

export interface LifetimeLuckSnapshot {
  readonly referenceYear: number;
  readonly totalCycles: number;
  readonly favorableCycles: number;
  readonly neutralCycles: number;
  readonly cautionCycles: number;
  readonly dominantTone: LifetimeTone;
  readonly opportunityWindows: readonly string[];
  readonly cautionWindows: readonly string[];
  readonly currentCycle: string | null;
  readonly currentCycleQuality: string | null;
}

function qualityRank(quality: LuckQuality): number {
  if (quality === LuckQuality.VERY_FAVORABLE) return 5;
  if (quality === LuckQuality.FAVORABLE) return 4;
  if (quality === LuckQuality.NEUTRAL) return 3;
  if (quality === LuckQuality.UNFAVORABLE) return 2;
  return 1;
}

function cycleWindowLabel(item: DaeunAnalysis): string {
  const qualityLabel = LUCK_QUALITY_INFO[item.analysis.quality].koreanName;
  const dp = item.daeunPillar;
  return `${dp.startAge}~${dp.endAge}세(${qualityLabel})`;
}

function pickWindows(
  analyses: readonly DaeunAnalysis[],
  mode: 'opportunity' | 'caution',
  limit: number,
): string[] {
  const filtered = analyses.filter(item => (
    mode === 'opportunity'
      ? FAVORABLE_QUALITIES.has(item.analysis.quality)
      : CAUTION_QUALITIES.has(item.analysis.quality)
  ));

  const sorted = [...filtered].sort((a, b) => {
    const rankDelta = qualityRank(b.analysis.quality) - qualityRank(a.analysis.quality);
    if (rankDelta !== 0) return mode === 'opportunity' ? rankDelta : -rankDelta;
    return a.daeunPillar.startAge - b.daeunPillar.startAge;
  });

  return sorted.slice(0, limit).map(cycleWindowLabel);
}

function determineLifetimeTone(
  favorableCycles: number,
  cautionCycles: number,
): LifetimeTone {
  if (favorableCycles >= cautionCycles + 2) return 'upward';
  if (cautionCycles >= favorableCycles + 2) return 'defensive';
  return 'mixed';
}

function toneLine(tone: LifetimeTone): string {
  if (tone === 'upward') return '상승 기회를 잡을 구간이 상대적으로 더 많은 흐름입니다.';
  if (tone === 'defensive') return '방어와 리스크 관리 비중이 큰 구간이 상대적으로 더 많은 흐름입니다.';
  return '상승 구간과 관리 구간이 교차하므로, 시기별 운영 모드 전환이 중요합니다.';
}

export function summarizeLifetimeLuck(
  a: SajuAnalysis,
  referenceYear: number,
): LifetimeLuckSnapshot | null {
  const daeun = a.daeunInfo;
  if (daeun == null || daeun.daeunPillars.length === 0) return null;

  const analyses = LuckInteractionAnalyzer.analyzeAllDaeun(
    daeun,
    a.pillars,
    a.pillars.day.cheongan,
    a.yongshinResult?.finalYongshin ?? null,
    a.yongshinResult?.gisin ?? null,
  );
  if (analyses.length === 0) return null;

  let favorableCycles = 0;
  let neutralCycles = 0;
  let cautionCycles = 0;
  for (const item of analyses) {
    if (FAVORABLE_QUALITIES.has(item.analysis.quality)) {
      favorableCycles += 1;
    } else if (CAUTION_QUALITIES.has(item.analysis.quality)) {
      cautionCycles += 1;
    } else {
      neutralCycles += 1;
    }
  }

  const currentDaeun = LuckNarrativeInterpreter.findCurrentDaeun(
    daeun,
    referenceYear,
    a.input.birthYear,
  );
  const currentCycle = currentDaeun != null
    ? `${currentDaeun.startAge}~${currentDaeun.endAge}세 ${formatPillar(currentDaeun.pillar)}`
    : null;
  const currentCycleQuality = currentDaeun != null
    ? (() => {
      const matched = analyses.find(item => item.daeunPillar.order === currentDaeun.order);
      return matched != null ? LUCK_QUALITY_INFO[matched.analysis.quality].koreanName : null;
    })()
    : null;

  return {
    referenceYear,
    totalCycles: analyses.length,
    favorableCycles,
    neutralCycles,
    cautionCycles,
    dominantTone: determineLifetimeTone(favorableCycles, cautionCycles),
    opportunityWindows: pickWindows(analyses, 'opportunity', 3),
    cautionWindows: pickWindows(analyses, 'caution', 3),
    currentCycle,
    currentCycleQuality,
  };
}

export function buildLuckCycleOverview(a: SajuAnalysis): string {
  const lines: string[] = [];
  lines.push('■ 대운(大運) 흐름');
  lines.push('');

  const daeun = a.daeunInfo;
  if (!daeun) {
    lines.push('대운 분석이 수행되지 않았습니다.');
    return lines.join('\n');
  }

  const direction = daeun.isForward ? '순행(順行)' : '역행(逆行)';
  const ageLabel = daeun.firstDaeunStartMonths > 0
    ? `${daeun.firstDaeunStartAge}세 ${daeun.firstDaeunStartMonths}개월`
    : `${daeun.firstDaeunStartAge}세`;
  lines.push(`대운 방향: ${direction}, 초년 대운 시작 나이: ${ageLabel} ${sentenceCite('daeun.direction')} ${sentenceCite('daeun.startAge')}`);
  lines.push('');

  const lifetime = summarizeLifetimeLuck(a, getKoreanDateParts().year);
  if (lifetime != null) {
    lines.push('[일생 흐름 요약]');
    lines.push(
      `대운 ${lifetime.totalCycles}개 중 상승 구간(대길·길) ${lifetime.favorableCycles}개, ` +
      `중립(평) ${lifetime.neutralCycles}개, 관리 구간(흉·대흉) ${lifetime.cautionCycles}개입니다.`,
    );
    lines.push(`전체 톤: ${toneLine(lifetime.dominantTone)}`);
    if (lifetime.opportunityWindows.length > 0) {
      lines.push(`상승 활용 구간: ${lifetime.opportunityWindows.join(', ')}`);
    }
    if (lifetime.cautionWindows.length > 0) {
      lines.push(`안정 관리 구간: ${lifetime.cautionWindows.join(', ')}`);
    }
    if (lifetime.currentCycle != null) {
      const currentQuality = lifetime.currentCycleQuality != null
        ? ` [${lifetime.currentCycleQuality}]`
        : '';
      lines.push(`현재 대운(${lifetime.referenceYear}년 기준): ${lifetime.currentCycle}${currentQuality}`);
    }
    lines.push('');
  }

  for (const dp of daeun.daeunPillars) {
    const startLabel = (dp.order === 1 && daeun.firstDaeunStartMonths > 0)
      ? `${dp.startAge}세 ${daeun.firstDaeunStartMonths}개월`
      : `${dp.startAge}세`;
    lines.push(`  ${startLabel}~${dp.startAge + 9}세: ` +
      `${formatPillar(dp.pillar)} (${ohaengKorean(CHEONGAN_INFO[dp.pillar.cheongan].ohaeng)}/${ohaengKorean(JIJI_INFO[dp.pillar.jiji].ohaeng)})`);
  }

  return lines.join('\n').trimEnd();
}
