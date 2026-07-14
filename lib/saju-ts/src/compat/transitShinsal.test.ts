import { describe, expect, it } from 'vitest';

import { buildTransitShinsalForBranch } from './springLegacy.js';

const BRANCH_CODES = ['JA', 'CHUK', 'IN', 'MYO', 'JIN', 'SA', 'O', 'MI', 'SIN', 'YU', 'SUL', 'HAE'] as const;
const SAMJAE_PHASES = ['DEUL', 'NUL', 'NAL'] as const;
const SAMJAE_BY_ANCHOR: Record<number, readonly number[]> = {
  0: [2, 3, 4],
  4: [2, 3, 4],
  8: [2, 3, 4],
  2: [8, 9, 10],
  6: [8, 9, 10],
  10: [8, 9, 10],
  1: [11, 0, 1],
  5: [11, 0, 1],
  9: [11, 0, 1],
  3: [5, 6, 7],
  7: [5, 6, 7],
  11: [5, 6, 7],
};

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

describe('compat transit shinsal tables', () => {
  it('covers samjae, sangmun, and jogaek for all 12 year branches', () => {
    for (let anchor = 0; anchor < 12; anchor += 1) {
      const samjaeGroup = SAMJAE_BY_ANCHOR[anchor]!;
      for (let target = 0; target < 12; target += 1) {
        const got = buildTransitShinsalForBranch(anchor, target);
        const phaseIndex = samjaeGroup.indexOf(target);

        expect(got.anchorBranch, `${BRANCH_CODES[anchor]} anchor`).toBe(BRANCH_CODES[anchor]);
        expect(got.targetBranch, `${BRANCH_CODES[anchor]} -> ${BRANCH_CODES[target]}`).toBe(BRANCH_CODES[target]);
        expect(got.samjae.group, `${BRANCH_CODES[anchor]} samjae group`).toEqual(
          samjaeGroup.map((idx) => BRANCH_CODES[idx]),
        );
        expect(got.samjae.active, `${BRANCH_CODES[anchor]} -> ${BRANCH_CODES[target]} samjae`).toBe(phaseIndex >= 0);
        expect(got.samjae.phase, `${BRANCH_CODES[anchor]} -> ${BRANCH_CODES[target]} phase`).toBe(
          phaseIndex >= 0 ? SAMJAE_PHASES[phaseIndex] : null,
        );
        expect(got.sangmun, `${BRANCH_CODES[anchor]} -> ${BRANCH_CODES[target]} sangmun`).toBe(
          target === mod(anchor + 2, 12),
        );
        expect(got.jogaek, `${BRANCH_CODES[anchor]} -> ${BRANCH_CODES[target]} jogaek`).toBe(
          target === mod(anchor - 2, 12),
        );
      }
    }
  });
});
