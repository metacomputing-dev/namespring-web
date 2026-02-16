import { Cheongan, CHEONGAN_VALUES } from '../../domain/Cheongan.js';
import { Jiji, JIJI_VALUES } from '../../domain/Jiji.js';
import rawStemTables from './data/shinsalStemTables.json';

type PairRow = readonly [string, string];

interface StemTablesData {
  readonly cheonulGwiinKorean: readonly PairRow[];
  readonly cheonulGwiinChinese: readonly PairRow[];
  readonly taegukGwiin: readonly PairRow[];
  readonly wonjinPairs: readonly PairRow[];
  readonly singleStemTables: Readonly<Record<string, readonly string[]>>;
  readonly bokseong: readonly (readonly string[])[];
}

const STEM_TABLES_DATA = rawStemTables as unknown as StemTablesData;
const JIJI_SET: ReadonlySet<Jiji> = new Set(JIJI_VALUES);

function toJiji(value: string): Jiji {
  if (JIJI_SET.has(value as Jiji)) return value as Jiji;
  throw new Error(`Invalid Jiji value: ${value}`);
}

function toPairRows(rows: readonly PairRow[]): [Jiji, Jiji][] {
  return rows.map(([left, right]) => [toJiji(left), toJiji(right)]);
}

function mapByStems<T>(values: readonly T[]): ReadonlyMap<Cheongan, T> {
  if (values.length !== CHEONGAN_VALUES.length) {
    throw new Error(`Expected ${CHEONGAN_VALUES.length} entries, got ${values.length}`);
  }
  return new Map(CHEONGAN_VALUES.map((stem, index) => [stem, values[index]!] as const));
}

function mapPairsByStems(values: readonly (readonly [Jiji, Jiji])[]): ReadonlyMap<Cheongan, [Jiji, Jiji]> {
  return mapByStems(values.map(([left, right]) => [left, right] as [Jiji, Jiji]));
}

export const CHEONUL_GWIIN_TABLE_KOREAN: ReadonlyMap<Cheongan, [Jiji, Jiji]> = mapPairsByStems(
  toPairRows(STEM_TABLES_DATA.cheonulGwiinKorean),
);

export const CHEONUL_GWIIN_TABLE_CHINESE: ReadonlyMap<Cheongan, [Jiji, Jiji]> = mapPairsByStems(
  toPairRows(STEM_TABLES_DATA.cheonulGwiinChinese),
);

export const TAEGUK_GWIIN_TABLE: ReadonlyMap<Cheongan, [Jiji, Jiji]> = mapPairsByStems(
  toPairRows(STEM_TABLES_DATA.taegukGwiin),
);

export const WONJIN_PAIRS: readonly [Jiji, Jiji][] = toPairRows(STEM_TABLES_DATA.wonjinPairs);

const SINGLE_STEM_TABLE_KEYS = {
  MUNCHANG_TABLE: 'munchang',
  YANGIN_TABLE: 'yangin',
  HAKDANG_TABLE: 'hakdang',
  GEUMYEO_TABLE: 'geumyeo',
  BAEKHO_TABLE: 'baekho',
  HONGYEOM_TABLE: 'hongyeom',
  AMNOK_TABLE: 'amnok',
  CHEONGWAN_TABLE: 'cheongwan',
  MUNGOK_TABLE: 'mungok',
  GUGIN_TABLE: 'gugin',
  CHEONBOK_GWIIN_TABLE: 'cheonbokGwiin',
  HYEOLINSAL_TABLE: 'hyeolinsal',
  CHEONJU_GWIIN_TABLE: 'cheonjuGwiin',
} as const;

const SINGLE_STEM_TABLES = Object.fromEntries(
  Object.entries(SINGLE_STEM_TABLE_KEYS).map(([exportName, sourceKey]) => [
    exportName,
    mapByStems((STEM_TABLES_DATA.singleStemTables[sourceKey] ?? []).map(toJiji)),
  ]),
) as Record<keyof typeof SINGLE_STEM_TABLE_KEYS, ReadonlyMap<Cheongan, Jiji>>;

export const {
  MUNCHANG_TABLE,
  YANGIN_TABLE,
  HAKDANG_TABLE,
  GEUMYEO_TABLE,
  BAEKHO_TABLE,
  HONGYEOM_TABLE,
  AMNOK_TABLE,
  CHEONGWAN_TABLE,
  MUNGOK_TABLE,
  GUGIN_TABLE,
  CHEONBOK_GWIIN_TABLE,
  HYEOLINSAL_TABLE,
  CHEONJU_GWIIN_TABLE,
} = SINGLE_STEM_TABLES;

export const BOKSEONG_TABLE: ReadonlyMap<Cheongan, ReadonlySet<Jiji>> = mapByStems(
  STEM_TABLES_DATA.bokseong.map((branches) => new Set(branches.map(toJiji))),
);
