/**
 * test/integration/tiered-name-saju-reading.test.ts
 *
 * Contract for N1 name↔saju reinforcement (name-saju-reading.ts):
 *   - grounded in the real yongshinMatchCount (honest, never overclaims at 0)
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
const reinforce = buildNameSajuReading({ yongshinMatchCount: 2, yongshinName: '물', yongshinResolved: true })!;
check('보강: 결과 존재', Boolean(reinforce));
check('보강: reinforces=true', reinforce.reinforces === true);
check('보강: 개수 반영', reinforce.yongshinMatchCount === 2);
check('보강: 문장이 오행 이름·글자수·타이밍 언급',
  reinforce.sentence.includes('물') && reinforce.sentence.includes('2글자') && reinforce.sentence.includes('크게 봐요'));
assertPlain('보강', reinforce.sentence);

// --- name carries none — must be honest, not overclaim -----------------------
const none = buildNameSajuReading({ yongshinMatchCount: 0, yongshinName: '불', yongshinResolved: true })!;
check('없음: reinforces=false', none.reinforces === false);
check('없음: 과장 없이 정직', none.sentence.includes('직접 담고 있진 않아서') && !none.sentence.includes('채우'),
  none.sentence);
assertPlain('없음', none.sentence);

// --- guards ------------------------------------------------------------------
check('용신 미해석 → undefined',
  buildNameSajuReading({ yongshinMatchCount: 3, yongshinName: '보완 기운', yongshinResolved: false }) === undefined);
check('개수 없음(null) → undefined',
  buildNameSajuReading({ yongshinMatchCount: null, yongshinName: '물', yongshinResolved: true }) === undefined);
check('개수 없음(undefined) → undefined',
  buildNameSajuReading({ yongshinMatchCount: undefined, yongshinName: '물', yongshinResolved: true }) === undefined);
check('음수 개수 → undefined',
  buildNameSajuReading({ yongshinMatchCount: -1, yongshinName: '물', yongshinResolved: true }) === undefined);

// --- determinism -------------------------------------------------------------
check('결정적',
  JSON.stringify(buildNameSajuReading({ yongshinMatchCount: 1, yongshinName: '나무', yongshinResolved: true }))
  === JSON.stringify(buildNameSajuReading({ yongshinMatchCount: 1, yongshinName: '나무', yongshinResolved: true })));

console.log(`\nN1 name↔saju reading: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
