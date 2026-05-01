/**
 * test/integration/gyeokguk-rule-mode-matrix.test.ts
 *
 * Guards the Phase P authority matrix used to keep monthly_main as the
 * production default while exposing jungki_transparent as an opt-in selector.
 *
 * Run: npm run test:gyeokguk-rule-mode
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');

let pass = 0;
let fail = 0;

function check(label: string, cond: boolean, evidence?: string): void {
  if (cond) {
    pass += 1;
    console.log(`  PASS ${label}${evidence ? ` (${evidence})` : ''}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}${evidence ? ` (${evidence})` : ''}`);
  }
}

function countCells(line: string): Array<{ pass: number; comparable: number }> {
  return [...line.matchAll(/(\d+)\/(\d+)\s+\d+(?:\.\d+)?%/g)].map((match) => ({
    pass: Number(match[1]),
    comparable: Number(match[2]),
  }));
}

console.log('Phase 4.2 gyeokguk rule-mode matrix\n');

const output = execSync('npm run measure:alternative-rules --silent', {
  cwd: SPRING_TS_ROOT,
  encoding: 'utf-8',
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true,
});

const dataLines = output
  .split(/\r?\n/)
  .filter((line) => /\d+\/\d+\s+\d/.test(line));

const sourceRows = dataLines.filter((line) => !line.trimStart().startsWith('TOTAL'));
const totalRow = dataLines.find((line) => line.trimStart().startsWith('TOTAL')) ?? '';

const lecture = countCells(sourceRows[0] ?? '');
const jonheom = countCells(sourceRows[1] ?? '');
const koreanModern = countCells(sourceRows[2] ?? '');
const total = countCells(totalRow);

check('authority matrix has three source groups', sourceRows.length === 3, `rows=${sourceRows.length}`);
check('monthly_main total remains 17/27', total[0]?.pass === 17 && total[0]?.comparable === 27, totalRow.trim());
check('jungki_transparent total remains 14/27', total[1]?.pass === 14 && total[1]?.comparable === 27, totalRow.trim());

check('lecture monthly_main remains 14/14', lecture[0]?.pass === 14 && lecture[0]?.comparable === 14);
check('lecture jungki_transparent remains 10/14', lecture[1]?.pass === 10 && lecture[1]?.comparable === 14);
check('jonheom monthly_main remains 1/6', jonheom[0]?.pass === 1 && jonheom[0]?.comparable === 6);
check('jonheom jungki_transparent remains 1/6', jonheom[1]?.pass === 1 && jonheom[1]?.comparable === 6);
check('korean-modern monthly_main remains 2/7', koreanModern[0]?.pass === 2 && koreanModern[0]?.comparable === 7);
check('korean-modern jungki_transparent remains 3/7', koreanModern[1]?.pass === 3 && koreanModern[1]?.comparable === 7);

console.log(`\nGyeokguk rule-mode matrix: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
