import { Cheongan } from '../domain/Cheongan.js';
import { PillarPosition } from '../domain/PillarPosition.js';
import { PillarSet } from '../domain/PillarSet.js';
import { CheonganRelationType } from '../domain/Relations.js';
import { PositionPair } from './RelationSignificanceData.js';
import { inferPositionPairFromMembers } from './PositionPairResolver.js';
import rawCheonganSignificanceCatalog from './data/cheonganSignificanceCatalog.json';

export { PositionPair } from './RelationSignificanceData.js';

export interface Significance {
  readonly positionPairLabel: string;
  readonly affectedDomains: readonly string[];
  readonly meaning: string;
  readonly ageWindow: string;
  readonly isPositive: boolean;
}

interface CheonganSignificanceCatalogData {
  readonly entries: readonly (readonly [string, Significance])[];
}

const CHEONGAN_SIGNIFICANCE_CATALOG = rawCheonganSignificanceCatalog as unknown as CheonganSignificanceCatalogData;
const CHEONGAN_RELATION_TYPE_SET: ReadonlySet<CheonganRelationType> = new Set(Object.values(CheonganRelationType));
const POSITION_PAIR_SET: ReadonlySet<PositionPair> = new Set(Object.values(PositionPair));

function toCheonganRelationType(raw: string): CheonganRelationType {
  if (CHEONGAN_RELATION_TYPE_SET.has(raw as CheonganRelationType)) return raw as CheonganRelationType;
  throw new Error(`Invalid CheonganRelationType in cheonganSignificanceCatalog.json: ${raw}`);
}

function toPositionPair(raw: string): PositionPair {
  if (POSITION_PAIR_SET.has(raw as PositionPair)) return raw as PositionPair;
  throw new Error(`Invalid PositionPair in cheonganSignificanceCatalog.json: ${raw}`);
}

function tkey(type: CheonganRelationType, pair: PositionPair): string {
  return `${type}:${pair}`;
}

function normalizeTableKey(rawKey: string): string {
  const [rawType, rawPair, ...rest] = rawKey.split(':');
  if (!rawType || !rawPair || rest.length > 0) {
    throw new Error(`Invalid cheongan significance key: ${rawKey}`);
  }
  return tkey(toCheonganRelationType(rawType), toPositionPair(rawPair));
}

const TABLE: ReadonlyMap<string, Significance> = new Map(
  CHEONGAN_SIGNIFICANCE_CATALOG.entries.map(([rawKey, significance]) => [
    normalizeTableKey(rawKey),
    significance,
  ] as const),
);

function inferPositionPair(members: ReadonlySet<Cheongan>, pillars: PillarSet): PositionPair | null {
  return inferPositionPairFromMembers(members, [
    [PillarPosition.YEAR, pillars.year.cheongan],
    [PillarPosition.MONTH, pillars.month.cheongan],
    [PillarPosition.DAY, pillars.day.cheongan],
    [PillarPosition.HOUR, pillars.hour.cheongan],
  ] as const);
}

function lookupSignificance(type: CheonganRelationType, posPair: PositionPair): Significance {
  const significance = TABLE.get(tkey(type, posPair));
  if (!significance) {
    throw new Error(`Missing CheonganSignificance entry: ${type}+${posPair}`);
  }
  return significance;
}

export function interpretCheonganSignificance(
  relationType: CheonganRelationType,
  membersOrPosPair: ReadonlySet<Cheongan> | PositionPair,
  pillars?: PillarSet,
): Significance | null {
  if (typeof membersOrPosPair === 'string') {
    return lookupSignificance(relationType, membersOrPosPair as PositionPair);
  }

  const posPair = inferPositionPair(membersOrPosPair, pillars!);
  if (!posPair) return null;
  return lookupSignificance(relationType, posPair);
}

export const CheonganSignificanceInterpreter = {
  interpret: interpretCheonganSignificance,
  inferPositionPair,
} as const;
