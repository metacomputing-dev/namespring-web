import { JijiRelationType } from '../domain/Relations.js';
import { createEnumValueParser } from '../domain/EnumValueParser.js';
import rawRelationSignificanceCatalog from './data/relationSignificanceCatalog.json';

export enum PositionPair {
  YEAR_MONTH = 'YEAR_MONTH',
  YEAR_DAY = 'YEAR_DAY',
  YEAR_HOUR = 'YEAR_HOUR',
  MONTH_DAY = 'MONTH_DAY',
  MONTH_HOUR = 'MONTH_HOUR',
  DAY_HOUR = 'DAY_HOUR',
}

export interface PositionPairInfo {
  readonly label: string;
  readonly baseDomains: readonly string[];
  readonly ageWindow: string;
}

export interface SignificanceEntry {
  readonly positionPairLabel: string;
  readonly affectedDomains: readonly string[];
  readonly meaning: string;
  readonly ageWindow: string;
  readonly isPositive: boolean;
}

interface RelationSignificanceCatalogData {
  readonly pairInfoEntries: readonly (readonly [string, PositionPairInfo])[];
  readonly entries: readonly (readonly [string, SignificanceEntry])[];
}

const RELATION_SIGNIFICANCE_CATALOG = rawRelationSignificanceCatalog as unknown as RelationSignificanceCatalogData;
const toPositionPair = createEnumValueParser(
  'PositionPair',
  'relationSignificanceCatalog.json',
  PositionPair,
);
const toJijiRelationType = createEnumValueParser(
  'JijiRelationType',
  'relationSignificanceCatalog.json',
  JijiRelationType,
);

export function tableKey(type: JijiRelationType, pair: PositionPair): string {
  return `${type}:${pair}`;
}

export function normalizeCatalogPairKey<Left extends string, Right extends string>(
  rawKey: string,
  sourceName: string,
  toLeft: (raw: string) => Left,
  toRight: (raw: string) => Right,
  keyBuilder: (left: Left, right: Right) => string,
): string {
  const [rawLeft, rawRight, ...rest] = rawKey.split(':');
  if (!rawLeft || !rawRight || rest.length > 0) {
    throw new Error(`Invalid ${sourceName} key: ${rawKey}`);
  }
  return keyBuilder(toLeft(rawLeft), toRight(rawRight));
}

function normalizeTableKey(rawKey: string): string {
  return normalizeCatalogPairKey(
    rawKey,
    'relation significance',
    toJijiRelationType,
    toPositionPair,
    tableKey,
  );
}

export const POSITION_PAIR_INFO: Record<PositionPair, PositionPairInfo> = Object.fromEntries(
  RELATION_SIGNIFICANCE_CATALOG.pairInfoEntries.map(([rawPair, info]) => {
    const pair = toPositionPair(rawPair);
    return [pair, info] as const;
  }),
) as Record<PositionPair, PositionPairInfo>;

export const SIGNIFICANCE_TABLE: ReadonlyMap<string, SignificanceEntry> = new Map(
  RELATION_SIGNIFICANCE_CATALOG.entries.map(([rawKey, entry]) => [normalizeTableKey(rawKey), entry] as const),
);
