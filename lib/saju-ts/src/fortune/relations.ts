import type { BranchIdx, Element, PillarIdx, StemIdx } from '../core/cycle.js';
import { detectBranchRelations, type DetectedRelation, type RelationType } from '../core/branchRelations.js';
import { detectStemRelations, type StemRelation, type StemRelationType } from '../core/stemRelations.js';
import type { DayLuck, DecadeLuck, FortuneTimeline, MonthLuck, YearLuck } from './types.js';

export type NatalPosition = 'year' | 'month' | 'day' | 'hour';
export type LuckRelationKind = 'DECADE' | 'YEAR' | 'MONTH' | 'DAY';

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

export interface FortuneRelationsTimeline {
  decades: FortuneRelationEntry[];
  years: FortuneRelationEntry[];
  months?: FortuneRelationEntry[];
  days?: FortuneRelationEntry[];
}

const NATAL_POSITIONS: readonly NatalPosition[] = ['year', 'month', 'day', 'hour'];
const LUCK_INDEX = 4;

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

export function buildFortuneRelations(
  natalPillars: readonly [PillarIdx, PillarIdx, PillarIdx, PillarIdx],
  timeline: FortuneTimeline,
): FortuneRelationsTimeline {
  return {
    decades: timeline.decades.map((entry) => buildEntry('DECADE', entry, natalPillars)),
    years: timeline.years.map((entry) => buildEntry('YEAR', entry, natalPillars)),
    months: timeline.months?.map((entry) => buildEntry('MONTH', entry, natalPillars)),
    days: timeline.days?.map((entry) => buildEntry('DAY', entry, natalPillars)),
  };
}
