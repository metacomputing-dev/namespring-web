import { GyeokgukCategory, GyeokgukType } from '../domain/Gyeokguk.js';
import { ShinsalType } from '../domain/Shinsal.js';
import {
  SHINSAL_TYPES_WITH_GYEOKGUK_SYNERGY,
  shinsalGyeokgukSynergyLookup as lookupShinsalGyeokgukSynergyRules,
} from './shinsalGyeokgukSynergy/rules.js';

export function shinsalGyeokgukSynergyLookup(
  shinsal: ShinsalType,
  gyeokgukType: GyeokgukType,
  category: GyeokgukCategory,
): string | null {
  return lookupShinsalGyeokgukSynergyRules(shinsal, gyeokgukType, category);
}

const ALL_SHINSAL_TYPES: readonly ShinsalType[] = Object.values(ShinsalType);
export const SHINSAL_TYPES_WITH_SYNERGY: ReadonlySet<ShinsalType> = SHINSAL_TYPES_WITH_GYEOKGUK_SYNERGY;

export const SHINSAL_TYPES_WITHOUT_SYNERGY: ReadonlySet<ShinsalType> = new Set(
  ALL_SHINSAL_TYPES.filter((type) => !SHINSAL_TYPES_WITH_SYNERGY.has(type)),
);
