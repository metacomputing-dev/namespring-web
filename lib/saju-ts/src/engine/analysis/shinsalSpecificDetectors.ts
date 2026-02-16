import { Jiji, JIJI_VALUES, jijiOrdinal } from '../../domain/Jiji.js';
import { PillarPosition } from '../../domain/PillarPosition.js';
import { PillarSet } from '../../domain/PillarSet.js';
import { ShinsalHit, ShinsalType } from '../../domain/Shinsal.js';
import { GwiiinTableVariant } from '../../config/CalculationConfig.js';
import {
  banghapGroupOf,
  CHEONUL_GWIIN_TABLE_KOREAN,
  CHEONUL_GWIIN_TABLE_CHINESE,
  TAEGUK_GWIIN_TABLE,
  WONJIN_PAIRS,
  BOKSEONG_TABLE,
  pillarKey,
  GOEGANG_PILLARS,
  GORANSAL_PILLARS,
  YUKHAE_PAIRS,
} from './ShinsalCatalog.js';
import {
  type IndexedPillar,
  indexedPillars,
  hangul,
  branchHangul,
  detectBidirectionalPairs,
} from './shinsalHelpers.js';

function pushBranchMatches(
  pillars: PillarSet,
  hits: ShinsalHit[],
  type: ShinsalType,
  targets: ReadonlySet<Jiji>,
  buildNote: (branch: Jiji) => string,
): void {
  for (const [position, pillar] of indexedPillars(pillars)) {
    const branch = pillar.jiji;
    if (!targets.has(branch)) continue;
    hits.push({
      type,
      position,
      referenceBranch: branch,
      note: buildNote(branch),
    });
  }
}

function pushCheollaPairHits(
  indexed: readonly IndexedPillar[],
  hits: ShinsalHit[],
  left: Jiji,
  right: Jiji,
  note: string,
): void {
  const leftEntries = indexed.filter(([, pillar]) => pillar.jiji === left);
  const rightEntries = indexed.filter(([, pillar]) => pillar.jiji === right);
  if (leftEntries.length === 0 || rightEntries.length === 0) return;

  for (const [position] of leftEntries) {
    hits.push({
      type: ShinsalType.CHEOLLA_JIMANG,
      position,
      referenceBranch: left,
      note,
    });
  }
  for (const [position] of rightEntries) {
    hits.push({
      type: ShinsalType.CHEOLLA_JIMANG,
      position,
      referenceBranch: right,
      note,
    });
  }
}

export function detectCheonulGwiin(
  pillars: PillarSet,
  hits: ShinsalHit[],
  variant: GwiiinTableVariant = GwiiinTableVariant.KOREAN_MAINSTREAM,
): void {
  const table = variant === GwiiinTableVariant.KOREAN_MAINSTREAM
    ? CHEONUL_GWIIN_TABLE_KOREAN
    : CHEONUL_GWIIN_TABLE_CHINESE;
  const dayMaster = pillars.day.cheongan;
  const [noble1, noble2] = table.get(dayMaster)!;
  const targets = new Set([noble1, noble2]);

  pushBranchMatches(
    pillars,
    hits,
    ShinsalType.CHEONUL_GWIIN,
    targets,
    (branch) => `${hangul(dayMaster)}일간 → ${branchHangul(noble1)},${branchHangul(noble2)} 중 ${branchHangul(branch)}`,
  );
}

export function detectTaegukGwiin(pillars: PillarSet, hits: ShinsalHit[]): void {
  const dayMaster = pillars.day.cheongan;
  const [branch1, branch2] = TAEGUK_GWIIN_TABLE.get(dayMaster)!;
  const targets = new Set([branch1, branch2]);

  pushBranchMatches(
    pillars,
    hits,
    ShinsalType.TAEGUK_GWIIN,
    targets,
    (branch) => `${hangul(dayMaster)}일간 → ${branchHangul(branch1)},${branchHangul(branch2)} 중 ${branchHangul(branch)}`,
  );
}

export function detectWonjin(pillars: PillarSet, hits: ShinsalHit[]): void {
  detectBidirectionalPairs(pillars, hits, ShinsalType.WONJIN, WONJIN_PAIRS, '원진살');
}

export function detectGoegang(pillars: PillarSet, hits: ShinsalHit[]): void {
  const dayKey = pillarKey(pillars.day.cheongan, pillars.day.jiji);
  if (!GOEGANG_PILLARS.has(dayKey)) return;
  hits.push({
    type: ShinsalType.GOEGANG,
    position: PillarPosition.DAY,
    referenceBranch: pillars.day.jiji,
    note: `${hangul(pillars.day.cheongan)}${branchHangul(pillars.day.jiji)} 괴강`,
  });
}

export function detectGosin(pillars: PillarSet, hits: ShinsalHit[]): void {
  const entry = banghapGroupOf(pillars.year.jiji);
  if (!entry) return;
  const target = entry.gosin;
  pushBranchMatches(
    pillars,
    hits,
    ShinsalType.GOSIN,
    new Set([target]),
    () => `년지 ${branchHangul(pillars.year.jiji)} → 고신 ${branchHangul(target)}`,
  );
}

export function detectGwasuk(pillars: PillarSet, hits: ShinsalHit[]): void {
  const entry = banghapGroupOf(pillars.year.jiji);
  if (!entry) return;
  const target = entry.gwasuk;
  pushBranchMatches(
    pillars,
    hits,
    ShinsalType.GWASUK,
    new Set([target]),
    () => `년지 ${branchHangul(pillars.year.jiji)} → 과숙 ${branchHangul(target)}`,
  );
}

export function detectBokseong(pillars: PillarSet, hits: ShinsalHit[]): void {
  const dayMaster = pillars.day.cheongan;
  const targets = BOKSEONG_TABLE.get(dayMaster)!;
  pushBranchMatches(
    pillars,
    hits,
    ShinsalType.BOKSEONG_GWIIN,
    targets,
    (branch) => `${hangul(dayMaster)}일간 → ${branchHangul(branch)}`,
  );
}

export function detectCheonui(pillars: PillarSet, hits: ShinsalHit[]): void {
  const monthBranch = pillars.month.jiji;
  const targetOrdinal = (jijiOrdinal(monthBranch) - 1 + 12) % 12;
  const target = JIJI_VALUES[targetOrdinal]!;
  pushBranchMatches(
    pillars,
    hits,
    ShinsalType.CHEONUI,
    new Set([target]),
    () => `월지 ${branchHangul(monthBranch)} → 천의 ${branchHangul(target)}`,
  );
}

export function detectCheollaJimang(pillars: PillarSet, hits: ShinsalHit[]): void {
  const indexed = indexedPillars(pillars);
  pushCheollaPairHits(indexed, hits, Jiji.JIN, Jiji.SA, '천라(天羅) 진+사');
  pushCheollaPairHits(indexed, hits, Jiji.SUL, Jiji.HAE, '지망(地網) 술+해');
}

export function detectGyeokgak(pillars: PillarSet, hits: ShinsalHit[]): void {
  const indexed = indexedPillars(pillars);
  const adjacentPairs: readonly [IndexedPillar, IndexedPillar][] = [
    [indexed[0]!, indexed[1]!],
    [indexed[1]!, indexed[2]!],
    [indexed[2]!, indexed[3]!],
  ];

  for (const [first, second] of adjacentPairs) {
    const distance = (jijiOrdinal(first[1].jiji) - jijiOrdinal(second[1].jiji) + 12) % 12;
    if (distance !== 2 && distance !== 10) continue;

    const [firstPos, firstPillar] = first;
    const [secondPos, secondPillar] = second;
    const label = `${branchHangul(firstPillar.jiji)}-${branchHangul(secondPillar.jiji)}`;
    const note = `격각 ${label} (${firstPos}-${secondPos})`;

    hits.push({
      type: ShinsalType.GYEOKGAK,
      position: firstPos,
      referenceBranch: firstPillar.jiji,
      note,
    });
    hits.push({
      type: ShinsalType.GYEOKGAK,
      position: secondPos,
      referenceBranch: secondPillar.jiji,
      note,
    });
  }
}

export function detectYukhaesal(pillars: PillarSet, hits: ShinsalHit[]): void {
  detectBidirectionalPairs(pillars, hits, ShinsalType.YUKHAESAL, YUKHAE_PAIRS, '육해살');
}

export function detectGoransal(pillars: PillarSet, hits: ShinsalHit[]): void {
  const dayKey = pillarKey(pillars.day.cheongan, pillars.day.jiji);
  if (!GORANSAL_PILLARS.has(dayKey)) return;
  hits.push({
    type: ShinsalType.GORANSAL,
    position: PillarPosition.DAY,
    referenceBranch: pillars.day.jiji,
    note: `${hangul(pillars.day.cheongan)}${branchHangul(pillars.day.jiji)} 고란살`,
  });
}
