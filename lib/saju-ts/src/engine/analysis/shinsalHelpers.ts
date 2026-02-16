import { Cheongan, CHEONGAN_INFO } from '../../domain/Cheongan.js';
import { Jiji, JIJI_INFO, JIJI_VALUES, jijiOrdinal } from '../../domain/Jiji.js';
import { Pillar } from '../../domain/Pillar.js';
import { PillarPosition } from '../../domain/PillarPosition.js';
import { PillarSet } from '../../domain/PillarSet.js';
import { ShinsalHit, ShinsalType, SHINSAL_TYPE_INFO } from '../../domain/Shinsal.js';
import { ShinsalReferenceBranch } from '../../config/CalculationConfig.js';
import { type SamhapGroup, type StemOrBranch, samhapGroupOf } from './ShinsalCatalog.js';
export type IndexedPillar = [PillarPosition, Pillar];

export function indexedPillars(ps: PillarSet): IndexedPillar[] {
  return [
    [PillarPosition.YEAR, ps.year],
    [PillarPosition.MONTH, ps.month],
    [PillarPosition.DAY, ps.day],
    [PillarPosition.HOUR, ps.hour],
  ];
}

export function hangul(c: Cheongan): string {
  return CHEONGAN_INFO[c].hangul;
}

export function branchHangul(j: Jiji): string {
  return JIJI_INFO[j].hangul;
}

export function koreanName(type: ShinsalType): string {
  return SHINSAL_TYPE_INFO[type].koreanName;
}

export function detectByStemTable(
  pillars: PillarSet,
  hits: ShinsalHit[],
  type: ShinsalType,
  table: ReadonlyMap<Cheongan, Jiji>,
): void {
  const dayMaster = pillars.day.cheongan;
  const target = table.get(dayMaster)!;

  for (const [position, pillar] of indexedPillars(pillars)) {
    if (pillar.jiji === target) {
      hits.push({
        type,
        position,
        referenceBranch: target,
        note: `${hangul(dayMaster)}일간 → ${branchHangul(target)}`,
      });
    }
  }
}

export function detectSamhapShinsal(
  pillars: PillarSet,
  hits: ShinsalHit[],
  type: ShinsalType,
  targetExtractor: (g: SamhapGroup) => Jiji,
  refBranch: ShinsalReferenceBranch = ShinsalReferenceBranch.DAY_AND_YEAR,
): void {
  const dayBranch = pillars.day.jiji;
  const yearBranch = pillars.year.jiji;

  const targets = new Set<Jiji>();
  if (refBranch === ShinsalReferenceBranch.DAY_ONLY || refBranch === ShinsalReferenceBranch.DAY_AND_YEAR) {
    const group = samhapGroupOf(dayBranch);
    if (group) targets.add(targetExtractor(group));
  }
  if (refBranch === ShinsalReferenceBranch.YEAR_ONLY || refBranch === ShinsalReferenceBranch.DAY_AND_YEAR) {
    const group = samhapGroupOf(yearBranch);
    if (group) targets.add(targetExtractor(group));
  }

  for (const target of targets) {
    for (const [position, pillar] of indexedPillars(pillars)) {
      if (pillar.jiji === target) {
        hits.push({
          type,
          position,
          referenceBranch: target,
          note: `${koreanName(type)} ${branchHangul(target)}`,
        });
      }
    }
  }
}

export function detectByMonthMixed(
  pillars: PillarSet,
  hits: ShinsalHit[],
  type: ShinsalType,
  table: ReadonlyMap<Jiji, StemOrBranch>,
): void {
  const monthBranch = pillars.month.jiji;
  const target = table.get(monthBranch);
  if (!target) return;

  for (const [position, pillar] of indexedPillars(pillars)) {
    const matched = target.kind === 'stem'
      ? pillar.cheongan === target.stem
      : pillar.jiji === target.branch;

    if (matched) {
      const matchLabel = target.kind === 'stem'
        ? hangul(target.stem)
        : branchHangul(target.branch);
      hits.push({
        type,
        position,
        referenceBranch: pillar.jiji,
        note: `월지 ${branchHangul(monthBranch)} → ${koreanName(type)} ${matchLabel}`,
      });
    }
  }
}

export function detectByYearBranchOffset(
  pillars: PillarSet,
  hits: ShinsalHit[],
  type: ShinsalType,
  offset: number,
): void {
  const yearBranch = pillars.year.jiji;
  const targetOrdinal = (jijiOrdinal(yearBranch) + offset) % 12;
  const target = JIJI_VALUES[targetOrdinal]!;

  for (const [position, pillar] of indexedPillars(pillars)) {
    if (pillar.jiji === target) {
      hits.push({
        type,
        position,
        referenceBranch: target,
        note: `년지 ${branchHangul(yearBranch)} → ${koreanName(type)} ${branchHangul(target)}`,
      });
    }
  }
}

export function detectBidirectionalPairs(
  pillars: PillarSet,
  hits: ShinsalHit[],
  type: ShinsalType,
  pairs: readonly [Jiji, Jiji][],
  notePrefix: string,
): void {
  const dayBranch = pillars.day.jiji;
  const yearBranch = pillars.year.jiji;
  const refBranches = new Set([dayBranch, yearBranch]);
  const targets = new Set<Jiji>();

  for (const ref of refBranches) {
    for (const [a, b] of pairs) {
      if (ref === a) targets.add(b);
      else if (ref === b) targets.add(a);
    }
  }

  for (const target of targets) {
    for (const [position, pillar] of indexedPillars(pillars)) {
      if (pillar.jiji === target) {
        hits.push({
          type,
          position,
          referenceBranch: target,
          note: `${notePrefix} ${branchHangul(target)}`,
        });
      }
    }
  }
}

