import type { BranchIdx } from '../core/cycle.js';
import { mod } from '../core/mod.js';

/**
 * Coarse season grouping by month-branch.
 *
 * Standard mapping:
 * - 寅卯辰: SPRING
 * - 巳午未: SUMMER
 * - 申酉戌: AUTUMN
 * - 亥子丑: WINTER
 */
export type SeasonGroup = 'SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER';

/**
 * Coarse month-based climate indices in [-1, +1].
 *
 * Motivation:
 * - 궁통보감(窮通寶鑑) 계열의 조후(調候) 판단은 “월령(계절)”을 핵심 축으로 둔다.
 * - 세부 절기/기후는 지역/연도에 따라 달라지므로, 엔진 내부에서는 우선 **수학적 연속값**으로
 *   계절성을 노출하고(temperature/dryness), 유파별 룰팩이 이를 가중합 형태로 사용하도록 한다.
 *
 * Indices:
 * - temperatureIndex: 子(月)≈-1(한랭) … 午(月)≈+1(더움)
 * - drynessIndex: 卯(月)≈-1(습) … 酉(月)≈+1(조)
 */
export interface MonthClimateIndices {
  temperatureIndex: number;
  drynessIndex: number;
}

export function seasonGroupOfMonthBranch(monthBranch: BranchIdx): SeasonGroup {
  const b = mod(monthBranch, 12) as BranchIdx;
  if (b === 2 || b === 3 || b === 4) return 'SPRING';
  if (b === 5 || b === 6 || b === 7) return 'SUMMER';
  if (b === 8 || b === 9 || b === 10) return 'AUTUMN';
  return 'WINTER';
}

export function monthClimateIndices(monthBranch: BranchIdx): MonthClimateIndices {
  const b = mod(monthBranch, 12) as BranchIdx;

  // angle = b*(π/6). Shift temperature so that max at 午(6), min at 子(0).
  const angle = (b * Math.PI) / 6;
  const temperatureIndex = Math.sin(angle - Math.PI / 2);

  // Shift dryness so that max at 酉(9), min at 卯(3).
  const drynessIndex = Math.sin(angle - Math.PI);

  return { temperatureIndex, drynessIndex };
}
