import type { BranchIdx, StemIdx } from '../core/cycle.js';
import { mod } from '../core/mod.js';
import type { TenGod } from '../core/tenGod.js';

export type BigyeopSubtype = 'GEONROK' | 'YANGIN' | 'WOLGEOB';
export type StructuralMonthFrameBaseTenGod = 'BI_GYEON' | 'GEOB_JAE';

const STRUCTURAL_MONTH_FRAME_BASE_TEN_GOD: Record<BigyeopSubtype, StructuralMonthFrameBaseTenGod> = {
  GEONROK: 'BI_GYEON',
  YANGIN: 'GEOB_JAE',
  WOLGEOB: 'GEOB_JAE',
};

export function baseTenGodOfStructuralMonthFrame(subtype: BigyeopSubtype): StructuralMonthFrameBaseTenGod {
  return STRUCTURAL_MONTH_FRAME_BASE_TEN_GOD[subtype];
}


export type StructuralMonthFrameReason =
  | 'DAY_STEM_LOK_BRANCH'
  | 'MONTH_MAIN_GEOB_JAE'
  | 'MONTH_MAIN_BI_GYEON';

/**
 * A 建祿/陽刃/月劫 frame is derived from the day stem and month branch.
 * It is not evidence that the day stem itself was exposed(透干).
 */
export interface StructuralMonthFrame {
  subtype: BigyeopSubtype;
  anchorStem: StemIdx;
  reason: StructuralMonthFrameReason;
}

/**
 * 甲寅 乙卯 丙巳 丁午 戊巳 己午 庚申 辛酉 壬亥 癸子.
 *
 * This is deliberately fixed for the month-frame policy. User-overridable
 * shinsal and life-stage tables must not silently change a 格局 decision.
 */
const GYEOKGUK_LOK_BRANCH: readonly BranchIdx[] = [
  2, 3, 5, 6, 5, 6, 8, 9, 11, 0,
] as const;

export function isCompanionTenGod(tenGod: TenGod): boolean {
  return tenGod === 'BI_GYEON' || tenGod === 'GEOB_JAE';
}

/**
 * Classifies month-command companion frames independently from ordinary
 * hidden-stem exposure selection.
 *
 * Policy notes:
 * - the ten canonical lu branches include the fire/earth shared-palace cases;
 * - 戊午 is not promoted merely because 午 is the emperor branch: its month
 *   main stem 丁 is 正印 under the adopted policy;
 * - earth-day mixed months whose main qi is 比肩 retain the documented
 *   compatibility convention and are labelled 建祿.
 */
export function classifyStructuralMonthFrame(args: {
  dayStem: StemIdx;
  monthBranch: BranchIdx;
  monthMainStem: StemIdx;
  monthMainTenGod: TenGod;
}): StructuralMonthFrame | null {
  const dayStem = mod(args.dayStem, 10) as StemIdx;
  const lokBranch = GYEOKGUK_LOK_BRANCH[dayStem];

  if (args.monthBranch === lokBranch) {
    return {
      subtype: 'GEONROK',
      anchorStem: dayStem,
      reason: 'DAY_STEM_LOK_BRANCH',
    };
  }

  if (args.monthMainTenGod === 'GEOB_JAE') {
    const dayIsYang = mod(dayStem, 2) === 0;
    const jewangBranch = mod((lokBranch ?? 0) + 1, 12) as BranchIdx;
    return {
      subtype: dayIsYang && args.monthBranch === jewangBranch ? 'YANGIN' : 'WOLGEOB',
      anchorStem: args.monthMainStem,
      reason: 'MONTH_MAIN_GEOB_JAE',
    };
  }

  if (args.monthMainTenGod === 'BI_GYEON') {
    return {
      subtype: 'GEONROK',
      anchorStem: args.monthMainStem,
      reason: 'MONTH_MAIN_BI_GYEON',
    };
  }

  return null;
}
