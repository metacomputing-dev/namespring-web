import { Cheongan, CHEONGAN_VALUES } from '../../domain/Cheongan.js';
import { Jiji, JIJI_VALUES } from '../../domain/Jiji.js';
import { createValueParser } from '../../domain/EnumValueParser.js';
import rawShinsalCoreCatalog from './data/shinsalCoreCatalog.json';

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

const SAMHAP_FIELD_KEYS = ['yeokma', 'dohwa', 'hwagae', 'jangseong', 'geopsal', 'jaesal', 'cheonsal', 'jisal', 'mangsin', 'banan'] as const;

type SamhapFieldKey = (typeof SAMHAP_FIELD_KEYS)[number];
type RawSamhapGroup = { readonly members: readonly string[] } & Readonly<Record<SamhapFieldKey, string>>;

interface MemberIndexedEntry<T> {
  readonly members: ReadonlySet<Jiji>;
  readonly value: T;
}

const SHINSAL_CORE_CATALOG = rawShinsalCoreCatalog as unknown as {
  readonly samhapGroups: readonly RawSamhapGroup[];
  readonly banghapEntries: readonly {
    readonly members: readonly string[];
    readonly gosin: string;
    readonly gwasuk: string;
  }[];
  readonly goegangPillars: readonly (readonly [string, string])[];
  readonly goransalPillars: readonly (readonly [string, string])[];
};
const toCheongan = createValueParser('Cheongan', 'shinsalCoreCatalog.json', CHEONGAN_VALUES);
const toJiji = createValueParser('Jiji', 'shinsalCoreCatalog.json', JIJI_VALUES);

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

function toJijiSet(values: readonly string[]): ReadonlySet<Jiji> {
  return new Set(values.map(toJiji));
}

function toSamhapGroup(raw: RawSamhapGroup): SamhapGroup {
  const parsedFields = Object.fromEntries(
    SAMHAP_FIELD_KEYS.map((key) => [key, toJiji(raw[key])] as const),
  ) as Readonly<Record<SamhapFieldKey, Jiji>>;
  return {
    members: toJijiSet(raw.members),
    ...parsedFields,
  };
}

const SAMHAP_GROUPS: readonly SamhapGroup[] = SHINSAL_CORE_CATALOG.samhapGroups.map(toSamhapGroup);

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

const BANGHAP_GOSIN_GWASUK: readonly MemberIndexedEntry<GosinGwasukEntry>[] = SHINSAL_CORE_CATALOG.banghapEntries
  .map((entry) => ({
    members: toJijiSet(entry.members),
    value: { gosin: toJiji(entry.gosin), gwasuk: toJiji(entry.gwasuk) },
  }));

const BANGHAP_ENTRY_BY_MEMBER: ReadonlyMap<Jiji, GosinGwasukEntry> = indexByMember(
  BANGHAP_GOSIN_GWASUK,
);

export function banghapGroupOf(branch: Jiji): GosinGwasukEntry | undefined {
  return BANGHAP_ENTRY_BY_MEMBER.get(branch);
}

export function pillarKey(stem: Cheongan, branch: Jiji): string {
  return `${stem}:${branch}`;
}

function buildPillarSet(pairs: readonly (readonly [string, string])[]): ReadonlySet<string> {
  return new Set(
    pairs.map(([rawStem, rawBranch]) => pillarKey(toCheongan(rawStem), toJiji(rawBranch))),
  );
}

export const GOEGANG_PILLARS: ReadonlySet<string> = buildPillarSet(SHINSAL_CORE_CATALOG.goegangPillars);
export const GORANSAL_PILLARS: ReadonlySet<string> = buildPillarSet(SHINSAL_CORE_CATALOG.goransalPillars);
