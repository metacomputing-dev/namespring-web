import { Cheongan, CHEONGAN_VALUES } from '../../domain/Cheongan.js';
import { Jiji, JIJI_VALUES } from '../../domain/Jiji.js';
import rawBranchTables from './data/shinsalBranchTables.json';
import { type StemOrBranch } from './ShinsalCatalogCore.js';

type RawStemOrBranch = { readonly kind: 'stem'; readonly stem: string } | {
  readonly kind: 'branch';
  readonly branch: string;
};

interface BranchTablesData {
  readonly cheondeok: readonly (readonly [string, RawStemOrBranch])[];
  readonly woldeok: readonly (readonly [string, RawStemOrBranch])[];
  readonly yukhaePairs: readonly (readonly [string, string])[];
}

const BRANCH_TABLE_DATA = rawBranchTables as unknown as BranchTablesData;
const CHEONGAN_SET: ReadonlySet<Cheongan> = new Set(CHEONGAN_VALUES);
const JIJI_SET: ReadonlySet<Jiji> = new Set(JIJI_VALUES);

function toCheongan(value: string): Cheongan {
  if (CHEONGAN_SET.has(value as Cheongan)) return value as Cheongan;
  throw new Error(`Invalid Cheongan value: ${value}`);
}

function toJiji(value: string): Jiji {
  if (JIJI_SET.has(value as Jiji)) return value as Jiji;
  throw new Error(`Invalid Jiji value: ${value}`);
}

function symmetricPairMap<T>(pairs: readonly (readonly [T, T])[]): ReadonlyMap<T, T> {
  const map = new Map<T, T>();
  for (const [left, right] of pairs) map.set(left, right).set(right, left);
  return map;
}

function toStemOrBranch(value: RawStemOrBranch): StemOrBranch {
  return value.kind === 'stem'
    ? { kind: 'stem', stem: toCheongan(value.stem) }
    : { kind: 'branch', branch: toJiji(value.branch) };
}

function toMonthMixedTable(rows: readonly (readonly [string, RawStemOrBranch])[]): ReadonlyMap<Jiji, StemOrBranch> {
  return new Map(rows.map(([branch, target]) => [toJiji(branch), toStemOrBranch(target)]));
}

export const CHEONDEOK_TABLE: ReadonlyMap<Jiji, StemOrBranch> = toMonthMixedTable(BRANCH_TABLE_DATA.cheondeok);
export const WOLDEOK_TABLE: ReadonlyMap<Jiji, StemOrBranch> = toMonthMixedTable(BRANCH_TABLE_DATA.woldeok);

const STEM_HAP_MAP = symmetricPairMap<Cheongan>([
  [Cheongan.GAP, Cheongan.GI],
  [Cheongan.EUL, Cheongan.GYEONG],
  [Cheongan.BYEONG, Cheongan.SIN],
  [Cheongan.JEONG, Cheongan.IM],
  [Cheongan.MU, Cheongan.GYE],
]);

const BRANCH_YUKHAP_MAP = symmetricPairMap<Jiji>([
  [Jiji.JA, Jiji.CHUK],
  [Jiji.IN, Jiji.HAE],
  [Jiji.MYO, Jiji.SUL],
  [Jiji.JIN, Jiji.YU],
  [Jiji.SA, Jiji.SIN],
  [Jiji.O, Jiji.MI],
]);

function buildHapTable(base: ReadonlyMap<Jiji, StemOrBranch>): ReadonlyMap<Jiji, StemOrBranch> {
  const result = new Map<Jiji, StemOrBranch>();
  for (const [key, target] of base) {
    result.set(
      key,
      target.kind === 'stem'
        ? { kind: 'stem', stem: STEM_HAP_MAP.get(target.stem)! }
        : { kind: 'branch', branch: BRANCH_YUKHAP_MAP.get(target.branch)! },
    );
  }
  return result;
}

export const CHEONDEOK_HAP_TABLE = buildHapTable(CHEONDEOK_TABLE);
export const WOLDEOK_HAP_TABLE = buildHapTable(WOLDEOK_TABLE);

export const YUKHAE_PAIRS: readonly [Jiji, Jiji][] = BRANCH_TABLE_DATA.yukhaePairs.map(
  ([left, right]) => [toJiji(left), toJiji(right)],
);
