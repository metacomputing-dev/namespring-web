import { cheonganOrdinal } from '../../domain/Cheongan.js';
import { Jiji, JIJI_VALUES, jijiOrdinal } from '../../domain/Jiji.js';
import { Pillar } from '../../domain/Pillar.js';
import { PillarPosition } from '../../domain/PillarPosition.js';
import { PillarSet } from '../../domain/PillarSet.js';


export interface GongmangHit {
  readonly position: PillarPosition;
  readonly branch: Jiji;
  readonly isRestored: boolean;
  readonly restorationNote: string;
}

export interface GongmangResult {
  readonly voidBranches: readonly [Jiji, Jiji];
  readonly affectedPositions: readonly GongmangHit[];
}


function buildBidirectionalMap(pairs: readonly [Jiji, Jiji][]): Map<Jiji, Jiji> {
  const map = new Map<Jiji, Jiji>();
  for (const [a, b] of pairs) {
    map.set(a, b);
    map.set(b, a);
  }
  return map;
}

const CHUNG_MAP: Map<Jiji, Jiji> = buildBidirectionalMap([
  [Jiji.JA,   Jiji.O],
  [Jiji.CHUK, Jiji.MI],
  [Jiji.IN,   Jiji.SIN],
  [Jiji.MYO,  Jiji.YU],
  [Jiji.JIN,  Jiji.SUL],
  [Jiji.SA,   Jiji.HAE],
]);

const YUKHAP_MAP: Map<Jiji, Jiji> = buildBidirectionalMap([
  [Jiji.JA,   Jiji.CHUK],
  [Jiji.IN,   Jiji.HAE],
  [Jiji.MYO,  Jiji.SUL],
  [Jiji.JIN,  Jiji.YU],
  [Jiji.SA,   Jiji.SIN],
  [Jiji.O,    Jiji.MI],
]);

const HYEONG_MAP: Map<Jiji, Set<Jiji>> = (() => {
  const map = new Map<Jiji, Set<Jiji>>();

  function link(a: Jiji, b: Jiji): void {
    if (!map.has(a)) map.set(a, new Set());
    if (!map.has(b)) map.set(b, new Set());
    map.get(a)!.add(b);
    map.get(b)!.add(a);
  }

  link(Jiji.IN, Jiji.SA);
  link(Jiji.IN, Jiji.SIN);
  link(Jiji.SA, Jiji.SIN);
  link(Jiji.CHUK, Jiji.SUL);
  link(Jiji.CHUK, Jiji.MI);
  link(Jiji.SUL, Jiji.MI);
  link(Jiji.JA, Jiji.MYO);

  return map;
})();


export function sexagenaryIndex(pillar: Pillar): number {
  const s = cheonganOrdinal(pillar.cheongan);
  const b = jijiOrdinal(pillar.jiji);
  if (s % 2 !== b % 2) {
    throw new Error(
      `Invalid pillar: ${pillar.cheongan} (index ${s}) and ${pillar.jiji} (index ${b}) ` +
      `have mismatched parity`,
    );
  }
  for (let k = 0; k <= 5; k++) {
    const i = 10 * k + s;
    if (i % 12 === b) return i;
  }
  throw new Error(`No sexagenary index found for ${pillar.cheongan}-${pillar.jiji}`);
}

export function voidBranchesOf(dayPillar: Pillar): readonly [Jiji, Jiji] {
  const idx = sexagenaryIndex(dayPillar);
  const xunStart = Math.floor(idx / 10) * 10;
  const startBranchIndex = xunStart % 12;
  const void1 = JIJI_VALUES[(startBranchIndex + 10) % 12]!;
  const void2 = JIJI_VALUES[(startBranchIndex + 11) % 12]!;
  return [void1, void2] as const;
}

function detectRestoration(voidBranch: Jiji, allBranches: readonly Jiji[]): string | null {
  const others = allBranches.filter(b => b !== voidBranch);

  const clashPartner = CHUNG_MAP.get(voidBranch);
  if (clashPartner !== undefined && others.includes(clashPartner)) {
    return '충으로 해공';
  }

  const punishPartners = HYEONG_MAP.get(voidBranch);
  if (punishPartners !== undefined && others.some(b => punishPartners.has(b))) {
    return '형으로 해공';
  }

  const harmonyPartner = YUKHAP_MAP.get(voidBranch);
  if (harmonyPartner !== undefined && others.includes(harmonyPartner)) {
    return '합으로 해공';
  }

  return null;
}

export function calculateGongmang(pillars: PillarSet): GongmangResult {
  const voidPair = voidBranchesOf(pillars.day);

  const positionsToCheck: readonly [PillarPosition, Pillar][] = [
    [PillarPosition.YEAR, pillars.year],
    [PillarPosition.MONTH, pillars.month],
    [PillarPosition.HOUR, pillars.hour],
  ];

  const allBranches: readonly Jiji[] = [
    pillars.year.jiji,
    pillars.month.jiji,
    pillars.day.jiji,
    pillars.hour.jiji,
  ];

  const hits: GongmangHit[] = [];

  for (const [position, pillar] of positionsToCheck) {
    const branch = pillar.jiji;
    if (branch === voidPair[0] || branch === voidPair[1]) {
      const restoration = detectRestoration(branch, allBranches);
      hits.push({
        position,
        branch,
        isRestored: restoration !== null,
        restorationNote: restoration ?? '',
      });
    }
  }

  return {
    voidBranches: voidPair,
    affectedPositions: hits,
  };
}
