import type { RelationType } from '../../core/branchRelations.js';

/**
 * Baseline “conditions pack” used by rules.
 *
 * Goal:
 * - Centralize which branch relations are treated as “harmful” for the purpose of
 *   weakening/invalidating other judgements (e.g., 귀인류 신살).
 *
 * Notes:
 * - Schools differ. Override via `config.strategies.shinsal.damageRelations`.
 * - This pack is intentionally minimal; it is *not* a complete interpretation layer.
 */
export const DEFAULT_SHINSAL_DAMAGE_RELATIONS: RelationType[] = [
  'CHUNG',
  'HYEONG',
  'JA_HYEONG',
  'SAMHYEONG',
  'HAE',
  'PA',
  'WONJIN',
];
