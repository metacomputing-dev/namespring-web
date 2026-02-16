import { GyeokgukCategory, GyeokgukType } from '../../domain/Gyeokguk.js';
import { ShinsalType } from '../../domain/Shinsal.js';
import { createEnumValueParser } from '../../domain/EnumValueParser.js';
import rawShinsalSynergyData from './data.json';

interface ShinsalGyeokgukSynergyData {
  readonly rows: readonly (readonly [string, string, string, string])[];
}

const SYNERGY_DATA = rawShinsalSynergyData as unknown as ShinsalGyeokgukSynergyData;
const parseShinsalType = createEnumValueParser(
  'ShinsalType',
  'shinsal synergy data',
  ShinsalType,
);
const parseGyeokgukType = createEnumValueParser(
  'GyeokgukType',
  'shinsal synergy data',
  GyeokgukType,
);
const parseGyeokgukCategory = createEnumValueParser(
  'GyeokgukCategory',
  'shinsal synergy data',
  GyeokgukCategory,
);

function synergyKey(
  shinsal: ShinsalType,
  gyeokgukType: GyeokgukType,
  category: GyeokgukCategory,
): string {
  return `${shinsal}::${gyeokgukType}::${category}`;
}

const SHINSAL_GYEOKGUK_SYNERGY_MAP: ReadonlyMap<string, string> = new Map(
  SYNERGY_DATA.rows.map(([rawShinsal, rawType, rawCategory, narrative]) => [
    synergyKey(
      parseShinsalType(rawShinsal),
      parseGyeokgukType(rawType),
      parseGyeokgukCategory(rawCategory),
    ),
    narrative,
  ]),
);

export const SHINSAL_TYPES_WITH_GYEOKGUK_SYNERGY: ReadonlySet<ShinsalType> = new Set(
  SYNERGY_DATA.rows.map(([rawShinsal]) => parseShinsalType(rawShinsal)),
);

export function shinsalGyeokgukSynergyLookup(
  shinsal: ShinsalType,
  gyeokgukType: GyeokgukType,
  category: GyeokgukCategory,
): string | null {
  return SHINSAL_GYEOKGUK_SYNERGY_MAP.get(
    synergyKey(shinsal, gyeokgukType, category),
  ) ?? null;
}
