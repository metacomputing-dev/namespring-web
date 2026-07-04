/**
 * test/integration/tiered-personal-reading.test.ts
 *
 * Contract for A1 cross-cell synthesis (personal-reading.ts):
 *   - deterministic (same grades → same text)
 *   - jargon-free (general-tier plain language)
 *   - names the person's strong/weak life areas
 *   - covers all four branches (both / high-only / low-only / balanced)
 *   - returns undefined when too few categories are graded
 *
 * Run: npm run test:tiered-personal-reading
 */
import { buildPersonalReading } from '../../src/report/tiered/personal-reading.js';
import type { TieredCategoryId } from '../../src/report/types.js';

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean, evidence?: string): void {
  if (cond) { pass += 1; console.log(`  PASS ${label}`); }
  else { fail += 1; console.log(`  FAIL ${label}${evidence ? ` (${evidence})` : ''}`); }
}

// General-tier jargon that must NEVER appear in the reading (subset of the
// gate's SAJU_JARGON_GENERAL plus the strength terms it translates away).
const JARGON: readonly string[] = [
  '오행', '용신', '희신', '기신', '격국', '십성', '재성', '신살',
  '상생', '상극', '조후', '대운', '득령', '득지', '득세', '원형이정',
  '신강', '신약',
];
function assertPlain(label: string, r: { headline: string; paragraph: string } | undefined): void {
  const text = `${r?.headline ?? ''}\n${r?.paragraph ?? ''}`;
  const hit = JARGON.find((t) => text.includes(t));
  check(`${label}: 용어 누출 없음`, !hit, hit ? `'${hit}' 발견` : undefined);
}

console.log('A1 personal reading\n');

// --- both highs and lows -----------------------------------------------------
const both = {
  categoryStars: {
    wealth: 5, academic: 4, family: 3, health: 2, romance: 1,
    career: 3, study_document: 3, expression_children: 3, health_stress: 3, movement: 3,
  } as Partial<Record<TieredCategoryId, number>>,
  strengthPlain: '단단한',
};
const rBoth = buildPersonalReading(both)!;
check('both: 결과 존재', Boolean(rBoth));
check('both: 강점 순위 = 재물·학업', JSON.stringify(rBoth.highlights) === JSON.stringify(['wealth', 'academic']),
  JSON.stringify(rBoth.highlights));
check('both: 주의 순위(낮은 별점 먼저) = 애정·건강', JSON.stringify(rBoth.cautions) === JSON.stringify(['romance', 'health']),
  JSON.stringify(rBoth.cautions));
check('both: headline이 강/약을 호명', rBoth.headline.includes('재물') && rBoth.headline.includes('애정'));
check('both: 강약 평문(단단한) 녹아듦', rBoth.paragraph.includes('단단한'));
assertPlain('both', rBoth);
check('both: 결정적(동일 입력→동일 출력)',
  JSON.stringify(buildPersonalReading(both)) === JSON.stringify(rBoth));

// --- highs only --------------------------------------------------------------
const highOnly = {
  categoryStars: {
    wealth: 5, academic: 4, family: 3, health: 3, romance: 3,
    career: 3, study_document: 3, expression_children: 3, health_stress: 3, movement: 3,
  } as Partial<Record<TieredCategoryId, number>>,
  strengthPlain: '고른',
};
const rHigh = buildPersonalReading(highOnly)!;
check('high-only: cautions 비어 있음', rHigh.cautions.length === 0);
check('high-only: 도드라지는 배치 프레임', rHigh.headline.includes('도드라지는'));
assertPlain('high-only', rHigh);

// --- lows only ---------------------------------------------------------------
const lowOnly = {
  categoryStars: {
    wealth: 3, academic: 3, family: 3, health: 2, romance: 1,
    career: 3, study_document: 3, expression_children: 3, health_stress: 3, movement: 3,
  } as Partial<Record<TieredCategoryId, number>>,
  strengthPlain: '여린',
};
const rLow = buildPersonalReading(lowOnly)!;
check('low-only: highlights 비어 있음', rLow.highlights.length === 0);
check('low-only: 공들여야 하는 배치 프레임', rLow.headline.includes('공들여야'));
check('low-only: 여린 평문 녹아듦', rLow.paragraph.includes('여린'));
assertPlain('low-only', rLow);

// --- balanced (all mid) ------------------------------------------------------
const balanced = {
  categoryStars: Object.fromEntries(
    (['wealth', 'health', 'academic', 'romance', 'family', 'career',
      'study_document', 'expression_children', 'health_stress', 'movement'] as TieredCategoryId[])
      .map((c) => [c, 3]),
  ) as Partial<Record<TieredCategoryId, number>>,
  strengthPlain: '고른',
};
const rBal = buildPersonalReading(balanced)!;
check('balanced: 강/약 모두 비어 있음', rBal.highlights.length === 0 && rBal.cautions.length === 0);
check('balanced: 고르게 짜인 배치 프레임', rBal.headline.includes('고르게'));
assertPlain('balanced', rBal);

// --- too few graded ----------------------------------------------------------
check('graded < 3 → undefined',
  buildPersonalReading({ categoryStars: { wealth: 5, health: null }, strengthPlain: '단단한' }) === undefined);
check('빈 grade → undefined',
  buildPersonalReading({ categoryStars: {}, strengthPlain: '단단한' }) === undefined);

console.log(`\nA1 personal reading: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
