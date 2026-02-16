import { Cheongan } from '../domain/Cheongan.js';
import { PillarPosition } from '../domain/PillarPosition.js';
import { PillarSet } from '../domain/PillarSet.js';
import { CheonganRelationType } from '../domain/Relations.js';
import { createEnumValueParser } from '../domain/EnumValueParser.js';
import {
  normalizeCatalogPairKey,
  PositionPair,
  type SignificanceEntry as Significance,
} from './RelationSignificanceData.js';
import { inferPositionPairFromMembers } from './PositionPairResolver.js';
import rawCheonganSignificanceCatalog from './data/cheonganSignificanceCatalog.json';

export { PositionPair } from './RelationSignificanceData.js';

interface CheonganSignificanceCatalogData {
  readonly entries: readonly (readonly [string, Significance])[];
}

const CHEONGAN_SIGNIFICANCE_CATALOG = rawCheonganSignificanceCatalog as unknown as CheonganSignificanceCatalogData;
const toCheonganRelationType = createEnumValueParser(
  'CheonganRelationType',
  'cheonganSignificanceCatalog.json',
  CheonganRelationType,
);
const toPositionPair = createEnumValueParser(
  'PositionPair',
  'cheonganSignificanceCatalog.json',
  PositionPair,
);

function tkey(type: CheonganRelationType, pair: PositionPair): string {
  return `${type}:${pair}`;
}

function normalizeTableKey(rawKey: string): string {
  return normalizeCatalogPairKey(
    rawKey,
    'cheongan significance',
    toCheonganRelationType,
    toPositionPair,
    tkey,
  );
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
