import { GyeokgukCategory, GyeokgukType } from '../../domain/Gyeokguk.js';
import { ShinsalType } from '../../domain/Shinsal.js';
import rawShinsalSynergyData from './data.json';

interface ShinsalGyeokgukSynergyData {
  readonly rows: readonly (readonly [string, string, string, string])[];
}

const SYNERGY_DATA = rawShinsalSynergyData as unknown as ShinsalGyeokgukSynergyData;
const SHINSAL_TYPE_SET: ReadonlySet<ShinsalType> = new Set(Object.values(ShinsalType));
const GYEOKGUK_TYPE_SET: ReadonlySet<GyeokgukType> = new Set(Object.values(GyeokgukType));
const GYEOKGUK_CATEGORY_SET: ReadonlySet<GyeokgukCategory> = new Set(Object.values(GyeokgukCategory));

function parseShinsalType(raw: string): ShinsalType {
  if (SHINSAL_TYPE_SET.has(raw as ShinsalType)) return raw as ShinsalType;
  throw new Error(`Invalid shinsal type in shinsal synergy data: ${raw}`);
}

function parseGyeokgukType(raw: string): GyeokgukType {
  if (GYEOKGUK_TYPE_SET.has(raw as GyeokgukType)) return raw as GyeokgukType;
  throw new Error(`Invalid gyeokguk type in shinsal synergy data: ${raw}`);
}

function parseGyeokgukCategory(raw: string): GyeokgukCategory {
  if (GYEOKGUK_CATEGORY_SET.has(raw as GyeokgukCategory)) return raw as GyeokgukCategory;
  throw new Error(`Invalid gyeokguk category in shinsal synergy data: ${raw}`);
}

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
