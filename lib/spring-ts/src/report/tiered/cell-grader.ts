/**
 * cell-grader.ts -- Tiered matrix cell grading
 *
 * Thin wrap around the existing fortune-grade infrastructure
 * (`getFortuneGrade` in `../common/fortuneCalculator.js`) used by the
 * legacy period / category card builders. We do NOT reimplement the
 * grading logic — we just convert the 1..5 grade into a cell stars + a
 * meaningfulness indicator the tiered matrix consumes.
 */

import type { ElementCode } from '../types.js';
import type { StarRating, TieredFortune } from '../types.js';
import { getFortuneGrade } from '../common/fortuneCalculator.js';

/** Grade → stars mapping (mirrors `category-fortune-card.ts:91`). */
export function gradeToStars(grade: number): StarRating {
  if (grade >= 5) return 5;
  if (grade >= 4) return 4;
  if (grade >= 3) return 3;
  if (grade >= 2) return 2;
  return 1;
}

/** Returns grade + meaningfulness for a tiered cell.
 *
 * A valid grade of 3 is a neutral result, not an evidence limitation. Missing
 * inputs remain `na` with no stars so downstream delivery can distinguish
 * "ordinary/neutral" from "not established".
 */
export function gradeCell(
  fortuneElement: ElementCode | null,
  yongshin: ElementCode | null,
  heeshin: ElementCode | null,
  gishin: ElementCode | null,
): { grade: number; stars: TieredFortune['stars']; meaningfulness: TieredFortune['meaningfulness'] } {
  if (!fortuneElement || !yongshin) {
    return { grade: 3, stars: null, meaningfulness: 'na' };
  }
  const grade = getFortuneGrade(fortuneElement, yongshin, heeshin, gishin);
  if (grade < 1 || grade > 5) {
    return { grade: 3, stars: null, meaningfulness: 'na' };
  }
  return { grade, stars: gradeToStars(grade), meaningfulness: 'meaningful' };
}
