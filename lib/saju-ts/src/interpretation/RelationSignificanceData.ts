import { JijiRelationType } from '../domain/Relations.js';
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

export interface MeaningEntry {
  readonly domains: readonly string[];
  readonly meaning: string;
  readonly isPositive: boolean;
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
const POSITION_PAIR_SET: ReadonlySet<PositionPair> = new Set(Object.values(PositionPair));
const JIJI_RELATION_TYPE_SET: ReadonlySet<JijiRelationType> = new Set(Object.values(JijiRelationType));

function toPositionPair(raw: string): PositionPair {
  if (POSITION_PAIR_SET.has(raw as PositionPair)) return raw as PositionPair;
  throw new Error(`Invalid PositionPair in relationSignificanceCatalog.json: ${raw}`);
}

function toJijiRelationType(raw: string): JijiRelationType {
  if (JIJI_RELATION_TYPE_SET.has(raw as JijiRelationType)) return raw as JijiRelationType;
  throw new Error(`Invalid JijiRelationType in relationSignificanceCatalog.json: ${raw}`);
}

export function tableKey(type: JijiRelationType, pair: PositionPair): string {
  return `${type}:${pair}`;
}

function normalizeTableKey(rawKey: string): string {
  const [rawType, rawPair, ...rest] = rawKey.split(':');
  if (!rawType || !rawPair || rest.length > 0) {
    throw new Error(`Invalid relation significance key: ${rawKey}`);
  }
  return tableKey(toJijiRelationType(rawType), toPositionPair(rawPair));
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

export const TABLE: ReadonlyMap<string, MeaningEntry> = new Map(
  RELATION_SIGNIFICANCE_CATALOG.entries.map(([rawKey, entry]) => [
    normalizeTableKey(rawKey),
    {
      domains: entry.affectedDomains,
      meaning: entry.meaning,
      isPositive: entry.isPositive,
    },
  ] as const),
);
