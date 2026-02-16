import { Cheongan } from '../../domain/Cheongan.js';
import { Jiji } from '../../domain/Jiji.js';

export type StemOrBranch =
  | { kind: 'stem'; stem: Cheongan }
  | { kind: 'branch'; branch: Jiji };

export interface SamhapGroup {
  readonly members: ReadonlySet<Jiji>;
  readonly yeokma: Jiji;
  readonly dohwa: Jiji;
  readonly hwagae: Jiji;
  readonly jangseong: Jiji;
  readonly geopsal: Jiji;
  readonly jaesal: Jiji;
  readonly cheonsal: Jiji;
  readonly jisal: Jiji;
  readonly mangsin: Jiji;
  readonly banan: Jiji;
}

interface MemberIndexedEntry<T> {
  readonly members: ReadonlySet<Jiji>;
  readonly value: T;
}

function indexByMember<T>(
  entries: readonly MemberIndexedEntry<T>[],
): ReadonlyMap<Jiji, T> {
  const map = new Map<Jiji, T>();
  for (const entry of entries) {
    for (const member of entry.members) {
      map.set(member, entry.value);
    }
  }
  return map;
}

const SAMHAP_GROUPS: readonly SamhapGroup[] = [
  {
    members: new Set([Jiji.IN, Jiji.O, Jiji.SUL]),
    yeokma: Jiji.SIN, dohwa: Jiji.MYO, hwagae: Jiji.SUL,
    jangseong: Jiji.O, geopsal: Jiji.SA, jaesal: Jiji.JA,
    cheonsal: Jiji.CHUK, jisal: Jiji.IN, mangsin: Jiji.SA, banan: Jiji.MI,
  },
  {
    members: new Set([Jiji.SA, Jiji.YU, Jiji.CHUK]),
    yeokma: Jiji.HAE, dohwa: Jiji.O, hwagae: Jiji.CHUK,
    jangseong: Jiji.YU, geopsal: Jiji.IN, jaesal: Jiji.MYO,
    cheonsal: Jiji.JIN, jisal: Jiji.SA, mangsin: Jiji.SIN, banan: Jiji.SUL,
  },
  {
    members: new Set([Jiji.SIN, Jiji.JA, Jiji.JIN]),
    yeokma: Jiji.IN, dohwa: Jiji.YU, hwagae: Jiji.JIN,
    jangseong: Jiji.JA, geopsal: Jiji.HAE, jaesal: Jiji.O,
    cheonsal: Jiji.MI, jisal: Jiji.SIN, mangsin: Jiji.HAE, banan: Jiji.CHUK,
  },
  {
    members: new Set([Jiji.HAE, Jiji.MYO, Jiji.MI]),
    yeokma: Jiji.SA, dohwa: Jiji.JA, hwagae: Jiji.MI,
    jangseong: Jiji.MYO, geopsal: Jiji.SIN, jaesal: Jiji.YU,
    cheonsal: Jiji.SUL, jisal: Jiji.HAE, mangsin: Jiji.IN, banan: Jiji.JIN,
  },
];

const SAMHAP_GROUP_BY_MEMBER: ReadonlyMap<Jiji, SamhapGroup> = indexByMember(
  SAMHAP_GROUPS.map(group => ({ members: group.members, value: group })),
);

export function samhapGroupOf(branch: Jiji): SamhapGroup | undefined {
  return SAMHAP_GROUP_BY_MEMBER.get(branch);
}

export interface GosinGwasukEntry {
  readonly gosin: Jiji;
  readonly gwasuk: Jiji;
}

const BANGHAP_GOSIN_GWASUK: readonly MemberIndexedEntry<GosinGwasukEntry>[] = [
  { members: new Set([Jiji.IN, Jiji.MYO, Jiji.JIN]), value: { gosin: Jiji.SA, gwasuk: Jiji.CHUK } },
  { members: new Set([Jiji.SA, Jiji.O, Jiji.MI]), value: { gosin: Jiji.SIN, gwasuk: Jiji.JIN } },
  { members: new Set([Jiji.SIN, Jiji.YU, Jiji.SUL]), value: { gosin: Jiji.HAE, gwasuk: Jiji.MI } },
  { members: new Set([Jiji.HAE, Jiji.JA, Jiji.CHUK]), value: { gosin: Jiji.IN, gwasuk: Jiji.SUL } },
];

const BANGHAP_ENTRY_BY_MEMBER: ReadonlyMap<Jiji, GosinGwasukEntry> = indexByMember(
  BANGHAP_GOSIN_GWASUK,
);

export function banghapGroupOf(branch: Jiji): GosinGwasukEntry | undefined {
  return BANGHAP_ENTRY_BY_MEMBER.get(branch);
}

export function pillarKey(stem: Cheongan, branch: Jiji): string {
  return `${stem}:${branch}`;
}

export const GOEGANG_PILLARS: ReadonlySet<string> = new Set([
  pillarKey(Cheongan.GYEONG, Jiji.JIN),
  pillarKey(Cheongan.IM, Jiji.JIN),
  pillarKey(Cheongan.GYEONG, Jiji.SUL),
  pillarKey(Cheongan.IM, Jiji.SUL),
]);

export const GORANSAL_PILLARS: ReadonlySet<string> = new Set([
  pillarKey(Cheongan.EUL, Jiji.SA),
  pillarKey(Cheongan.JEONG, Jiji.SA),
  pillarKey(Cheongan.SIN, Jiji.HAE),
  pillarKey(Cheongan.MU, Jiji.SIN),
  pillarKey(Cheongan.IM, Jiji.IN),
]);
