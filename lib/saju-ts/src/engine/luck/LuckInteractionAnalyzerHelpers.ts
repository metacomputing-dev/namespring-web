import { Cheongan, CHEONGAN_INFO } from '../../domain/Cheongan.js';
import { JIJI_INFO, Jiji } from '../../domain/Jiji.js';
import type { LuckPillarAnalysis } from '../../domain/LuckInteraction.js';
import { LuckQuality, LUCK_QUALITY_INFO } from '../../domain/LuckInteraction.js';
import { Ohaeng } from '../../domain/Ohaeng.js';
import { Pillar } from '../../domain/Pillar.js';
import { PillarSet } from '../../domain/PillarSet.js';
import { SibiUnseong, SIBI_UNSEONG_INFO } from '../../domain/SibiUnseong.js';
import { Sipseong, SIPSEONG_INFO } from '../../domain/Sipseong.js';
import {
  CHUNG_PAIRS,
  HAE_PAIRS,
  HYEONG_PAIRS,
  PA_PAIRS,
  type PairDef,
  YUKHAP_PAIRS,
} from '../analysis/RelationCatalog.js';
import { distinct, matchesJijiPair } from './LuckInteractionRelationUtils.js';

const CHEONGAN_HAP_NOTES: ReadonlyMap<string, string> = new Map([
  [pairKey(Cheongan.GAP, Cheongan.GI), '갑기합'],
  [pairKey(Cheongan.EUL, Cheongan.GYEONG), '을경합'],
  [pairKey(Cheongan.BYEONG, Cheongan.SIN), '병신합'],
  [pairKey(Cheongan.JEONG, Cheongan.IM), '정임합'],
  [pairKey(Cheongan.MU, Cheongan.GYE), '무계합'],
]);

const CHEONGAN_CHUNG_NOTES: ReadonlyMap<string, string> = new Map([
  [pairKey(Cheongan.GAP, Cheongan.GYEONG), '갑경충'],
  [pairKey(Cheongan.EUL, Cheongan.SIN), '을신충'],
  [pairKey(Cheongan.BYEONG, Cheongan.IM), '병임충'],
  [pairKey(Cheongan.JEONG, Cheongan.GYE), '정계충'],
]);

const JIJI_RELATION_PAIR_TABLES: readonly (readonly PairDef[])[] = [
  YUKHAP_PAIRS,
  CHUNG_PAIRS,
  HYEONG_PAIRS,
  PA_PAIRS,
  HAE_PAIRS,
];

function pairKey(a: Cheongan, b: Cheongan): string {
  return [a, b].sort().join('-');
}

function normalizeJijiNote(note: string): string {
  return note.replace(/\([^)]*\)/g, '');
}

function matchingJijiPairNotes(luckBranch: Jiji, otherBranch: Jiji): string[] {
  const notes: string[] = [];
  for (const table of JIJI_RELATION_PAIR_TABLES) {
    for (const pair of table) {
      if (matchesJijiPair(pair, luckBranch, otherBranch)) {
        notes.push(normalizeJijiNote(pair.note));
      }
    }
  }
  return notes;
}

function natalStems(pillars: PillarSet): readonly Cheongan[] {
  return [
    pillars.year.cheongan,
    pillars.month.cheongan,
    pillars.day.cheongan,
    pillars.hour.cheongan,
  ];
}

function natalBranches(pillars: PillarSet): readonly Jiji[] {
  return [
    pillars.year.jiji,
    pillars.month.jiji,
    pillars.day.jiji,
    pillars.hour.jiji,
  ];
}

function appendUniqueNote(notes: string[], seen: Set<string>, note: string): void {
  if (!seen.has(note)) {
    seen.add(note);
    notes.push(note);
  }
}

function cheonganPairNotes(a: Cheongan, b: Cheongan): string[] {
  if (a === b) return [];

  const key = pairKey(a, b);
  const notes: string[] = [];
  const hapNote = CHEONGAN_HAP_NOTES.get(key);
  if (hapNote) notes.push(hapNote);
  const chungNote = CHEONGAN_CHUNG_NOTES.get(key);
  if (chungNote) notes.push(chungNote);
  return notes;
}

export interface RelationFlags {
  readonly hasGoodRelations: boolean;
  readonly hasBadRelations: boolean;
}

export function computeRelationFlags(
  stemRelations: readonly string[],
  branchRelations: readonly string[],
): RelationFlags {
  return {
    hasGoodRelations:
      stemRelations.some(relation => relation.includes('합')) ||
      branchRelations.some(relation => relation.includes('합')),
    hasBadRelations:
      stemRelations.some(relation => relation.includes('충')) ||
      branchRelations.some(relation =>
        relation.includes('충') ||
        relation.includes('형') ||
        relation.includes('파') ||
        relation.includes('해'),
      ),
  };
}

export function findStemRelations(luckStem: Cheongan, natalPillars: PillarSet): string[] {
  const relations: string[] = [];
  const seen = new Set<string>();

  for (const natalStem of natalStems(natalPillars)) {
    for (const note of cheonganPairNotes(luckStem, natalStem)) {
      appendUniqueNote(relations, seen, note);
    }
  }

  return relations;
}

export function findBranchRelations(luckBranch: Jiji, natalPillars: PillarSet): string[] {
  const relations: string[] = [];
  const seen = new Set<string>();

  for (const natalBranch of natalBranches(natalPillars)) {
    for (const note of matchingJijiPairNotes(luckBranch, natalBranch)) {
      appendUniqueNote(relations, seen, note);
    }
  }

  return relations;
}

export function mergeDaeunRelations(
  baseAnalysis: LuckPillarAnalysis,
  saeunPillar: Pillar,
  daeunPillar: Pillar,
  yongshinElement: Ohaeng | null,
  gisinElement: Ohaeng | null,
): LuckPillarAnalysis {
  const extraStemRelations = cheonganPairNotes(saeunPillar.cheongan, daeunPillar.cheongan);
  const extraBranchRelations = matchingJijiPairNotes(saeunPillar.jiji, daeunPillar.jiji);

  if (extraStemRelations.length === 0 && extraBranchRelations.length === 0) {
    return baseAnalysis;
  }

  const mergedStemRelations = distinct([...baseAnalysis.stemRelations, ...extraStemRelations]);
  const mergedBranchRelations = distinct([...baseAnalysis.branchRelations, ...extraBranchRelations]);
  const { hasGoodRelations, hasBadRelations } = computeRelationFlags(
    mergedStemRelations,
    mergedBranchRelations,
  );

  const saeunStemOhaeng = CHEONGAN_INFO[saeunPillar.cheongan].ohaeng;
  const saeunBranchOhaeng = JIJI_INFO[saeunPillar.jiji].ohaeng;

  const quality = determineLuckQualityInternal(
    saeunStemOhaeng, yongshinElement, gisinElement, hasGoodRelations, hasBadRelations,
    saeunBranchOhaeng,
  );
  const summary = buildSummary(
    baseAnalysis.pillar, baseAnalysis.sipseong, baseAnalysis.sibiUnseong,
    baseAnalysis.isYongshinElement, baseAnalysis.isGisinElement, quality,
  );

  return {
    ...baseAnalysis,
    stemRelations: mergedStemRelations,
    branchRelations: mergedBranchRelations,
    quality,
    summary,
  };
}

export function determineLuckQualityInternal(
  luckStemOhaeng: Ohaeng,
  yongshinElement: Ohaeng | null,
  gisinElement: Ohaeng | null,
  hasGoodRelations: boolean,
  hasBadRelations: boolean,
  luckBranchOhaeng: Ohaeng | null = null,
): LuckQuality {
  const luckOhaengSet = new Set<Ohaeng>([luckStemOhaeng]);
  if (luckBranchOhaeng !== null) {
    luckOhaengSet.add(luckBranchOhaeng);
  }

  const isYongshin = yongshinElement !== null && luckOhaengSet.has(yongshinElement);
  const isGisin = gisinElement !== null && luckOhaengSet.has(gisinElement);

  if (isYongshin && hasGoodRelations) return LuckQuality.VERY_FAVORABLE;
  if (isGisin && hasBadRelations) return LuckQuality.VERY_UNFAVORABLE;
  if (isYongshin) return LuckQuality.FAVORABLE;
  if (!isGisin && hasGoodRelations) return LuckQuality.FAVORABLE;
  if (isGisin) return LuckQuality.UNFAVORABLE;
  if (hasBadRelations) return LuckQuality.UNFAVORABLE;
  return LuckQuality.NEUTRAL;
}

export function buildSummary(
  pillar: Pillar,
  sipseong: Sipseong,
  sibiUnseong: SibiUnseong,
  isYongshin: boolean,
  isGisin: boolean,
  quality: LuckQuality,
): string {
  const ci = CHEONGAN_INFO[pillar.cheongan];
  const ji = JIJI_INFO[pillar.jiji];
  const pillarLabel = `${ci.hangul}${ji.hangul}`;
  const qualityDesc = LUCK_QUALITY_INFO[quality].koreanName;
  const sipseongInfo = SIPSEONG_INFO[sipseong];
  const sibiInfo = SIBI_UNSEONG_INFO[sibiUnseong];

  let yongshinDesc = '';
  if (isYongshin) {
    yongshinDesc = ', 용신운';
  } else if (isGisin) {
    yongshinDesc = ', 기신운';
  }

  return `${pillarLabel}운: ${sipseongInfo.koreanName}(${sipseongInfo.hanja}) / ${sibiInfo.koreanName}(${sibiInfo.hanja})${yongshinDesc} -- ${qualityDesc}`;
}

