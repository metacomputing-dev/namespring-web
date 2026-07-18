/**
 * test/integration/tiered-name-saju-reading.test.ts
 *
 * Contract for N1 name↔saju reinforcement (name-saju-reading.ts):
 *   - grounded in both yongshin/gishin match counts
 *   - never upgrades element matches into timing benefit or causal promise
 *   - jargon-free plain language
 *   - undefined when yongshin unresolved or the count is missing/invalid
 *   - deterministic
 *
 * Run: npm run test:tiered-name-saju-reading
 */
import { buildNameSajuReading } from '../../src/report/tiered/name-saju-reading.js';

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean, evidence?: string): void {
  if (cond) { pass += 1; console.log(`  PASS ${label}`); }
  else { fail += 1; console.log(`  FAIL ${label}${evidence ? ` (${evidence})` : ''}`); }
}

const JARGON: readonly string[] = [
  '오행', '용신', '희신', '기신', '격국', '십성', '재성', '신살',
  '상생', '상극', '조후', '대운', '득령', '득지', '득세', '원형이정',
];
function assertPlain(label: string, sentence: string): void {
  const hit = JARGON.find((t) => sentence.includes(t));
  check(`${label}: 용어 누출 없음`, !hit, hit ? `'${hit}'` : undefined);
}

console.log('N1 name↔saju reading\n');

// --- name carries the needed element -----------------------------------------
const reinforce = buildNameSajuReading({ yongshinMatchCount: 2, gishinMatchCount: 0, yongshinName: '물', yongshinResolved: true })!;
check('보강: 결과 존재', Boolean(reinforce));
check('보강: reinforces=true', reinforce.reinforces === true);
check('보강: 개수 반영', reinforce.yongshinMatchCount === 2);
check('보강: bounded classification',
  reinforce.classification === 'supportive' && reinforce.gishinMatchCount === 0);
check('보강: 글자수는 말하되 시기 효능을 보장하지 않음',
  reinforce.sentence.includes('물') && reinforce.sentence.includes('2글자')
    && reinforce.sentence.includes('보장하진 않아요') && !reinforce.sentence.includes('남들보다'));
assertPlain('보강', reinforce.sentence);

// --- name carries none — must be honest, not overclaim -----------------------
const none = buildNameSajuReading({ yongshinMatchCount: 0, gishinMatchCount: 0, yongshinName: '불', yongshinResolved: true })!;
check('없음: reinforces=false', none.reinforces === false);
check('없음: 과장 없이 정직', none.classification === 'neutral'
  && none.sentence.includes('직접 맞는 글자는 없어요') && !none.sentence.includes('채우'),
  none.sentence);
assertPlain('없음', none.sentence);

// --- mixed and caution signals are not collapsed into a positive boolean -----
const mixed = buildNameSajuReading({ yongshinMatchCount: 1, gishinMatchCount: 1, yongshinName: '나무', yongshinResolved: true })!;
check('혼합: 두 신호 보존', mixed.classification === 'mixed' && mixed.reinforces === true);
const caution = buildNameSajuReading({ yongshinMatchCount: 1, gishinMatchCount: 2, yongshinName: '나무', yongshinResolved: true })!;
check('주의: 기신 우세를 보강으로 오인하지 않음', caution.classification === 'caution' && caution.reinforces === false);

// --- guards ------------------------------------------------------------------
check('용신 미해석 → undefined',
  buildNameSajuReading({ yongshinMatchCount: 3, gishinMatchCount: 0, yongshinName: '보완 기운', yongshinResolved: false }) === undefined);
check('개수 없음(null) → undefined',
  buildNameSajuReading({ yongshinMatchCount: null, gishinMatchCount: 0, yongshinName: '물', yongshinResolved: true }) === undefined);
check('개수 없음(undefined) → undefined',
  buildNameSajuReading({ yongshinMatchCount: undefined, gishinMatchCount: 0, yongshinName: '물', yongshinResolved: true }) === undefined);
check('음수 개수 → undefined',
  buildNameSajuReading({ yongshinMatchCount: -1, gishinMatchCount: 0, yongshinName: '물', yongshinResolved: true }) === undefined);
check('기신 개수 없음 → undefined',
  buildNameSajuReading({ yongshinMatchCount: 1, gishinMatchCount: undefined, yongshinName: '물', yongshinResolved: true }) === undefined);

// --- determinism -------------------------------------------------------------
check('결정적',
  JSON.stringify(buildNameSajuReading({ yongshinMatchCount: 1, gishinMatchCount: 0, yongshinName: '나무', yongshinResolved: true }))
  === JSON.stringify(buildNameSajuReading({ yongshinMatchCount: 1, gishinMatchCount: 0, yongshinName: '나무', yongshinResolved: true })));

console.log(`\nN1 name↔saju reading: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
