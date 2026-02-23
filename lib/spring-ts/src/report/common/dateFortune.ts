/**
 * dateFortune.ts -- Date-based fortune (운세) computation
 *
 * Computes the Chinese calendar pillars (천간 + 지지) for any Gregorian date
 * using pure arithmetic (no external saju-ts dependencies), then grades each
 * pillar's element against the user's yongshin (용신) configuration.
 *
 * The four-pillar derivation follows standard sexagenary-cycle rules:
 *   - Year pillar:  (year - 4) mod 60
 *   - Month pillar:  stem derived from year stem, branch from month order
 *   - Day pillar:   Julian Day Number offset mod 60
 *   - Hour pillar:  stem derived from day stem, branch from hour
 *
 * References:
 *   Julian Day Number algorithm -- Meeus, "Astronomical Algorithms", Ch. 7
 *   Sexagenary cycle mapping  -- standard East-Asian calendar convention
 */

// ─────────────────────────────────────────────────────────────────────────────
//  1. Stem / Branch lookup tables
// ─────────────────────────────────────────────────────────────────────────────

/** Heavenly stems (천간), indexed 0-9: 갑을병정무기경신임계 */
export const STEM_TABLE = [
  { hangul: '갑', hanja: '甲', element: 'WOOD' },
  { hangul: '을', hanja: '乙', element: 'WOOD' },
  { hangul: '병', hanja: '丙', element: 'FIRE' },
  { hangul: '정', hanja: '丁', element: 'FIRE' },
  { hangul: '무', hanja: '戊', element: 'EARTH' },
  { hangul: '기', hanja: '己', element: 'EARTH' },
  { hangul: '경', hanja: '庚', element: 'METAL' },
  { hangul: '신', hanja: '辛', element: 'METAL' },
  { hangul: '임', hanja: '壬', element: 'WATER' },
  { hangul: '계', hanja: '癸', element: 'WATER' },
] as const;

/** Earthly branches (지지), indexed 0-11: 자축인묘진사오미신유술해 */
export const BRANCH_TABLE = [
  { hangul: '자', hanja: '子', element: 'WATER', animal: '쥐' },
  { hangul: '축', hanja: '丑', element: 'EARTH', animal: '소' },
  { hangul: '인', hanja: '寅', element: 'WOOD', animal: '호랑이' },
  { hangul: '묘', hanja: '卯', element: 'WOOD', animal: '토끼' },
  { hangul: '진', hanja: '辰', element: 'EARTH', animal: '용' },
  { hangul: '사', hanja: '巳', element: 'FIRE', animal: '뱀' },
  { hangul: '오', hanja: '午', element: 'FIRE', animal: '말' },
  { hangul: '미', hanja: '未', element: 'EARTH', animal: '양' },
  { hangul: '신', hanja: '申', element: 'METAL', animal: '원숭이' },
  { hangul: '유', hanja: '酉', element: 'METAL', animal: '닭' },
  { hangul: '술', hanja: '戌', element: 'EARTH', animal: '개' },
  { hangul: '해', hanja: '亥', element: 'WATER', animal: '돼지' },
] as const;

/** Five-element Korean labels */
export const ELEMENT_KOREAN: Record<string, string> = {
  WOOD: '목(木)',
  FIRE: '화(火)',
  EARTH: '토(土)',
  METAL: '금(金)',
  WATER: '수(水)',
};

// ─────────────────────────────────────────────────────────────────────────────
//  2. Pure-math pillar calculations
// ─────────────────────────────────────────────────────────────────────────────

/** A pillar represented as numeric indices into the stem and branch tables. */
export interface Pillar {
  stem: number;   // 0-9
  branch: number; // 0-11
}

/**
 * Convert a Gregorian date to Julian Day Number.
 *
 * Uses the standard proleptic-Gregorian algorithm (valid for all dates after
 * the adoption of the Gregorian calendar, and for proleptic dates as well).
 *
 * Formula: Meeus, "Astronomical Algorithms", 2nd ed., Ch. 7, Eq. 7.1
 */
function gregorianToJdn(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12);
  const y2 = y + 4800 - a;
  const m2 = m + 12 * a - 3;
  return (
    d
    + Math.floor((153 * m2 + 2) / 5)
    + 365 * y2
    + Math.floor(y2 / 4)
    - Math.floor(y2 / 100)
    + Math.floor(y2 / 400)
    - 32045
  );
}

/**
 * Year pillar.
 *
 * The sexagenary cycle epoch is 4 CE (甲子年).  For any Gregorian year:
 *   stem   = (year - 4) mod 10
 *   branch = (year - 4) mod 12
 *
 * The double-mod pattern `((x % n) + n) % n` guarantees a non-negative result
 * even for years before the epoch (negative operand).
 */
export function yearPillar(year: number): Pillar {
  return {
    stem: ((year - 4) % 10 + 10) % 10,
    branch: ((year - 4) % 12 + 12) % 12,
  };
}

/**
 * Month pillar (Gregorian approximation).
 *
 * In the sexagenary calendar, month stems cycle in groups of five tied to the
 * year stem.  The branch always starts at 寅 (index 2) for the first month
 * (February in Gregorian approximation).
 *
 * Month ordering: February = 0, March = 1, ..., January = 11.
 * Base stem = ((yearStem mod 5) * 2 + 2) mod 10.
 */
export function monthPillar(yearStem: number, month: number): Pillar {
  const monthOrder = ((month - 2) % 12 + 12) % 12;
  const base = ((yearStem % 5) * 2 + 2) % 10;
  return {
    stem: (base + monthOrder) % 10,
    branch: (2 + monthOrder) % 12,
  };
}

/**
 * Day pillar.
 *
 * The sexagenary day cycle has been continuous and unbroken since antiquity.
 * Using the Julian Day Number, the cycle index is:
 *   idx = (JDN + 49) mod 60
 *
 * The offset 49 aligns JDN 0 (1 Jan 4713 BCE Julian) with the correct
 * sexagenary day.
 */
function dayPillar(y: number, m: number, d: number): Pillar {
  const jdn = gregorianToJdn(y, m, d);
  const idx = ((jdn + 49) % 60 + 60) % 60;
  return {
    stem: idx % 10,
    branch: idx % 12,
  };
}

/**
 * Hour pillar (provided for completeness; not used by computeDateFortune).
 *
 * Each two-hour block maps to one of the twelve earthly branches, starting
 * with 子 (23:00-00:59).  The hour stem is derived from the day stem in the
 * same pattern as month stems from year stems.
 */
function hourPillar(dayStem: number, hour: number): Pillar {
  const hourBranch = hour === 23 ? 0 : Math.floor((hour + 1) / 2);
  const base = (dayStem % 5) * 2;
  return {
    stem: (base + hourBranch) % 10,
    branch: hourBranch,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  3. Yongshin match grade computation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Grade a target element against the user's four spirit (신) elements.
 *
 * Priority order (highest to lowest match):
 *   1. 용신 (yongshin) -- the primary needed element    -> grade 5
 *   2. 희신 (heeshin)  -- the supporting element        -> grade 4
 *   3. 기신 (gishin)   -- the harmful element           -> grade 1
 *   4. 구신 (gushin)   -- the obstructing element       -> grade 2
 *   5. (no match)      -- neutral                       -> grade 3
 */
function computeYongshinGrade(
  targetElement: string,
  yongshinEl: string | null,
  heeshinEl: string | null,
  gushinEl: string | null,
  gishinEl: string | null,
): { grade: 1 | 2 | 3 | 4 | 5; stars: string; desc: string } {
  if (targetElement === yongshinEl) return { grade: 5, stars: '★★★★★', desc: '최고의 기운' };
  if (targetElement === heeshinEl)  return { grade: 4, stars: '★★★★☆', desc: '좋은 기운' };
  if (targetElement === gishinEl)   return { grade: 1, stars: '★☆☆☆☆', desc: '조심해야 할 기운' };
  if (targetElement === gushinEl)   return { grade: 2, stars: '★★☆☆☆', desc: '주의가 필요한 기운' };
  return { grade: 3, stars: '★★★☆☆', desc: '보통의 기운' };
}

// ─────────────────────────────────────────────────────────────────────────────
//  4. Public types
// ─────────────────────────────────────────────────────────────────────────────

/** Fortune data for a single pillar (year, month, or day). */
export interface PillarFortune {
  /** Heavenly stem in hangul (e.g. '갑') */
  stemHangul: string;
  /** Heavenly stem in hanja (e.g. '甲') */
  stemHanja: string;
  /** Earthly branch in hangul (e.g. '자') */
  branchHangul: string;
  /** Earthly branch in hanja (e.g. '子') */
  branchHanja: string;
  /** Five-element code of the stem (e.g. 'WOOD') */
  element: string;
  /** Five-element Korean label (e.g. '목(木)') */
  elementKorean: string;
  /** Yongshin match grade: 5 = best, 1 = worst */
  grade: 1 | 2 | 3 | 4 | 5;
  /** Star representation of the grade */
  stars: string;
  /** Korean description of the grade */
  gradeDesc: string;
  /** Zodiac animal (only present for year pillar, from the branch) */
  animal?: string;
}

/** Result of date fortune computation for all requested pillars. */
export interface DateFortuneResult {
  /** Year pillar fortune (always computed) */
  year: PillarFortune;
  /** Month pillar fortune (null if month not provided) */
  month: PillarFortune | null;
  /** Day pillar fortune (null if day not provided) */
  day: PillarFortune | null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  5. Main exported function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a {@link PillarFortune} object from a computed pillar, graded against
 * the user's yongshin configuration.
 *
 * The element is always taken from the **stem** (not the branch), following
 * traditional saju convention where the stem carries the dominant element.
 */
function buildPillarFortune(
  pillar: Pillar,
  yongshinEl: string | null,
  heeshinEl: string | null,
  gushinEl: string | null,
  gishinEl: string | null,
  includeAnimal: boolean,
): PillarFortune {
  const stem = STEM_TABLE[pillar.stem];
  const branch = BRANCH_TABLE[pillar.branch];
  const element = stem.element;
  const { grade, stars, desc } = computeYongshinGrade(
    element,
    yongshinEl,
    heeshinEl,
    gushinEl,
    gishinEl,
  );

  const result: PillarFortune = {
    stemHangul: stem.hangul,
    stemHanja: stem.hanja,
    branchHangul: branch.hangul,
    branchHanja: branch.hanja,
    element,
    elementKorean: ELEMENT_KOREAN[element] ?? element,
    grade,
    stars,
    gradeDesc: desc,
  };

  if (includeAnimal) {
    result.animal = branch.animal;
  }

  return result;
}

/**
 * Compute date-based fortune (운세) by deriving the Chinese calendar pillars
 * for the given Gregorian date and grading each pillar's element against the
 * user's yongshin/heeshin/gushin/gishin configuration.
 *
 * @param yongshinElement - The user's yongshin (용신) element code (e.g. 'WOOD')
 * @param heeshinElement  - The user's heeshin (희신) element, or null
 * @param gushinElement   - The user's gushin (구신) element, or null
 * @param gishinElement   - The user's gishin (기신) element, or null
 * @param targetYear      - Gregorian year to evaluate
 * @param targetMonth     - Gregorian month (1-12), or null/undefined to skip
 * @param targetDay       - Gregorian day (1-31), or null/undefined to skip
 * @returns Fortune result containing year, month (if requested), and day (if requested)
 */
export function computeDateFortune(
  yongshinElement: string,
  heeshinElement: string | null,
  gushinElement: string | null,
  gishinElement: string | null,
  targetYear: number,
  targetMonth?: number | null,
  targetDay?: number | null,
): DateFortuneResult {
  // --- Year pillar (always computed) ---
  const yp = yearPillar(targetYear);
  const yearFortune = buildPillarFortune(
    yp,
    yongshinElement,
    heeshinElement,
    gushinElement,
    gishinElement,
    true, // include zodiac animal
  );

  // --- Month pillar (only if month is provided) ---
  let monthFortune: PillarFortune | null = null;
  if (targetMonth != null) {
    const mp = monthPillar(yp.stem, targetMonth);
    monthFortune = buildPillarFortune(
      mp,
      yongshinElement,
      heeshinElement,
      gushinElement,
      gishinElement,
      false,
    );
  }

  // --- Day pillar (only if both month and day are provided) ---
  let dayFortune: PillarFortune | null = null;
  if (targetMonth != null && targetDay != null) {
    const dp = dayPillar(targetYear, targetMonth, targetDay);
    dayFortune = buildPillarFortune(
      dp,
      yongshinElement,
      heeshinElement,
      gushinElement,
      gishinElement,
      false,
    );
  }

  return {
    year: yearFortune,
    month: monthFortune,
    day: dayFortune,
  };
}
