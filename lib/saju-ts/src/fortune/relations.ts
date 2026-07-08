import type { BranchIdx, Element, PillarIdx, StemIdx } from '../core/cycle.js';
import { detectBranchRelations, type DetectedRelation, type RelationType } from '../core/branchRelations.js';
import { detectStemRelations, type StemRelation, type StemRelationType } from '../core/stemRelations.js';
import type { DayLuck, DecadeLuck, FortuneTimeline, MonthLuck, YearLuck } from './types.js';

export type NatalPosition = 'year' | 'month' | 'day' | 'hour';
export type LuckRelationKind = 'DECADE' | 'YEAR' | 'MONTH' | 'DAY';
export type LuckPairPosition = 'decade' | 'year';

export interface FortuneBranchRelationHit {
  axis: 'BRANCH';
  type: RelationType;
  members: BranchIdx[];
  natalPositions: NatalPosition[];
  luckPosition: 'luck';
  pairs?: Array<[number, number]>;
}

export interface FortuneStemRelationHit {
  axis: 'STEM';
  type: StemRelationType;
  members: [StemIdx, StemIdx];
  resultElement?: Element;
  natalPositions: NatalPosition[];
  luckPosition: 'luck';
  pairs?: Array<[number, number]>;
}

export interface FortuneLuckPairBranchRelationHit {
  axis: 'BRANCH';
  type: RelationType;
  members: BranchIdx[];
  luckPositions: LuckPairPosition[];
  pairs?: Array<[number, number]>;
}

export interface FortuneLuckPairStemRelationHit {
  axis: 'STEM';
  type: StemRelationType;
  members: [StemIdx, StemIdx];
  resultElement?: Element;
  luckPositions: LuckPairPosition[];
  pairs?: Array<[number, number]>;
}

export interface FortuneRelationEntry {
  luckKind: LuckRelationKind;
  index?: number;
  solarYear?: number;
  monthOrder?: number;
  localDate?: { y: number; m: number; d: number };
  pillar: PillarIdx;
  stemRelations: FortuneStemRelationHit[];
  branchRelations: FortuneBranchRelationHit[];
}

export interface DecadeYearRelationEntry {
  luckKind: 'DECADE_YEAR';
  solarYear: number;
  decadeIndex: number;
  decadePillar: PillarIdx;
  yearPillar: PillarIdx;
  stemRelations: FortuneLuckPairStemRelationHit[];
  branchRelations: FortuneLuckPairBranchRelationHit[];
}

export interface FortuneRelationsTimeline {
  decades: FortuneRelationEntry[];
  years: FortuneRelationEntry[];
  months?: FortuneRelationEntry[];
  days?: FortuneRelationEntry[];
  decadeYears: DecadeYearRelationEntry[];
}

const NATAL_POSITIONS: readonly NatalPosition[] = ['year', 'month', 'day', 'hour'];
const LUCK_INDEX = 4;
const DECADE_PAIR_INDEX = 0;
const YEAR_PAIR_INDEX = 1;
const DECADE_YEAR_POSITIONS: LuckPairPosition[] = ['decade', 'year'];

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function natalIndexesFromRelation(relation: { pillarIndexes?: number[]; pairs?: Array<[number, number]> }): number[] {
  const pairIndexes = relation.pairs
    ?.filter(([a, b]) => a === LUCK_INDEX || b === LUCK_INDEX)
    .flatMap(([a, b]) => [a === LUCK_INDEX ? b : a]);
  if (pairIndexes?.length) {
    return uniqueSorted(pairIndexes.filter((idx) => idx >= 0 && idx < LUCK_INDEX));
  }

  if (!relation.pillarIndexes?.includes(LUCK_INDEX)) return [];
  return uniqueSorted(relation.pillarIndexes.filter((idx) => idx >= 0 && idx < LUCK_INDEX));
}

function luckPairs(relation: { pairs?: Array<[number, number]> }): Array<[number, number]> | undefined {
  const pairs = relation.pairs?.filter(([a, b]) => a === LUCK_INDEX || b === LUCK_INDEX);
  return pairs && pairs.length > 0 ? pairs : undefined;
}

function decadeYearPairs(relation: { pairs?: Array<[number, number]> }): Array<[number, number]> | undefined {
  const pairs = relation.pairs?.filter(([a, b]) => (
    (a === DECADE_PAIR_INDEX && b === YEAR_PAIR_INDEX) ||
    (a === YEAR_PAIR_INDEX && b === DECADE_PAIR_INDEX)
  ));
  return pairs && pairs.length > 0 ? pairs : undefined;
}

function natalPositions(indexes: number[]): NatalPosition[] {
  return indexes
    .map((idx) => NATAL_POSITIONS[idx])
    .filter((pos): pos is NatalPosition => pos !== undefined);
}

function branchHit(relation: DetectedRelation): FortuneBranchRelationHit | null {
  const indexes = natalIndexesFromRelation(relation);
  if (indexes.length === 0) return null;
  return {
    axis: 'BRANCH',
    type: relation.type,
    members: relation.members as BranchIdx[],
    natalPositions: natalPositions(indexes),
    luckPosition: 'luck',
    ...(luckPairs(relation) ? { pairs: luckPairs(relation) } : {}),
  };
}

function stemHit(relation: StemRelation): FortuneStemRelationHit | null {
  const indexes = natalIndexesFromRelation(relation);
  if (indexes.length === 0) return null;
  return {
    axis: 'STEM',
    type: relation.type,
    members: relation.members,
    ...(relation.resultElement ? { resultElement: relation.resultElement } : {}),
    natalPositions: natalPositions(indexes),
    luckPosition: 'luck',
    ...(luckPairs(relation) ? { pairs: luckPairs(relation) } : {}),
  };
}

function decadeYearBranchHit(relation: DetectedRelation): FortuneLuckPairBranchRelationHit | null {
  const pairs = decadeYearPairs(relation);
  if (!pairs) return null;
  return {
    axis: 'BRANCH',
    type: relation.type,
    members: relation.members as BranchIdx[],
    luckPositions: DECADE_YEAR_POSITIONS,
    pairs,
  };
}

function decadeYearStemHit(relation: StemRelation): FortuneLuckPairStemRelationHit | null {
  const pairs = decadeYearPairs(relation);
  if (!pairs) return null;
  return {
    axis: 'STEM',
    type: relation.type,
    members: relation.members,
    ...(relation.resultElement ? { resultElement: relation.resultElement } : {}),
    luckPositions: DECADE_YEAR_POSITIONS,
    pairs,
  };
}

function buildEntry(
  luckKind: LuckRelationKind,
  luck: DecadeLuck | YearLuck | MonthLuck | DayLuck,
  natalPillars: readonly PillarIdx[],
): FortuneRelationEntry {
  const combinedPillars = [...natalPillars, luck.pillar];
  const stemRelations = detectStemRelations(combinedPillars.map((pillar) => pillar.stem))
    .map(stemHit)
    .filter((hit): hit is FortuneStemRelationHit => hit !== null);
  const branchRelations = detectBranchRelations(combinedPillars.map((pillar) => pillar.branch))
    .map(branchHit)
    .filter((hit): hit is FortuneBranchRelationHit => hit !== null);

  return {
    luckKind,
    ...('index' in luck ? { index: luck.index } : {}),
    ...('solarYear' in luck ? { solarYear: luck.solarYear } : {}),
    ...('monthOrder' in luck ? { monthOrder: luck.monthOrder } : {}),
    ...('localDate' in luck ? { localDate: luck.localDate } : {}),
    pillar: luck.pillar,
    stemRelations,
    branchRelations,
  };
}

function overlapLength(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  if (![aStart, aEnd, bStart, bEnd].every(Number.isFinite)) return 0;
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

function bestDecadeForYear(decades: readonly DecadeLuck[], year: YearLuck): DecadeLuck | null {
  let best: DecadeLuck | null = null;
  let bestOverlap = 0;

  for (const decade of decades) {
    const overlap = overlapLength(
      decade.startAgeYears,
      decade.endAgeYears,
      year.approxStartAgeYears,
      year.approxEndAgeYears,
    );
    if (overlap > bestOverlap) {
      best = decade;
      bestOverlap = overlap;
    }
  }

  return bestOverlap > 0 ? best : null;
}

function buildDecadeYearEntry(decade: DecadeLuck, year: YearLuck): DecadeYearRelationEntry | null {
  const combinedPillars = [decade.pillar, year.pillar];
  const stemRelations = detectStemRelations(combinedPillars.map((pillar) => pillar.stem))
    .map(decadeYearStemHit)
    .filter((hit): hit is FortuneLuckPairStemRelationHit => hit !== null);
  const branchRelations = detectBranchRelations(combinedPillars.map((pillar) => pillar.branch))
    .map(decadeYearBranchHit)
    .filter((hit): hit is FortuneLuckPairBranchRelationHit => hit !== null);

  if (stemRelations.length === 0 && branchRelations.length === 0) return null;

  return {
    luckKind: 'DECADE_YEAR',
    solarYear: year.solarYear,
    decadeIndex: decade.index,
    decadePillar: decade.pillar,
    yearPillar: year.pillar,
    stemRelations,
    branchRelations,
  };
}

function buildDecadeYearRelations(timeline: FortuneTimeline): DecadeYearRelationEntry[] {
  const entries: DecadeYearRelationEntry[] = [];
  for (const year of timeline.years) {
    const decade = bestDecadeForYear(timeline.decades, year);
    if (!decade) continue;
    const entry = buildDecadeYearEntry(decade, year);
    if (entry) entries.push(entry);
  }
  return entries;
}

export function buildFortuneRelations(
  natalPillars: readonly [PillarIdx, PillarIdx, PillarIdx, PillarIdx],
  timeline: FortuneTimeline,
): FortuneRelationsTimeline {
  return {
    decades: timeline.decades.map((entry) => buildEntry('DECADE', entry, natalPillars)),
    years: timeline.years.map((entry) => buildEntry('YEAR', entry, natalPillars)),
    months: timeline.months?.map((entry) => buildEntry('MONTH', entry, natalPillars)),
    days: timeline.days?.map((entry) => buildEntry('DAY', entry, natalPillars)),
    decadeYears: buildDecadeYearRelations(timeline),
  };
}
