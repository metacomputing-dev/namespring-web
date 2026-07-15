/**
 * test/integration/gyeokguk-rule-mode-matrix.test.ts
 *
 * Guards the historical Phase-P label matrix used to keep monthly_main as the
 * production default while exposing jungki_transparent as an opt-in selector
 * and composite_classical as evidence-only candidates.
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

console.log('Phase 4.3 gyeokguk rule-mode matrix\n');

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

check('historical label matrix has three source groups', sourceRows.length === 3, `rows=${sourceRows.length}`);
check('monthly_main total remains 17/27', total[0]?.pass === 17 && total[0]?.comparable === 27, totalRow.trim());
check('jungki_transparent total remains 14/27', total[1]?.pass === 14 && total[1]?.comparable === 27, totalRow.trim());
check('full_transparent comparison remains 13/27', total[2]?.pass === 13 && total[2]?.comparable === 27, totalRow.trim());
check('priority_transparent comparison remains 13/27', total[3]?.pass === 13 && total[3]?.comparable === 27, totalRow.trim());
check('composite_classical selected agreement remains monthly_main 17/27',
  total[4]?.pass === 17 && total[4]?.comparable === 27,
  totalRow.trim());

check('lecture monthly_main remains 14/14', lecture[0]?.pass === 14 && lecture[0]?.comparable === 14);
check('lecture jungki_transparent remains 10/14', lecture[1]?.pass === 10 && lecture[1]?.comparable === 14);
check('lecture composite_classical selected agreement remains 14/14', lecture[4]?.pass === 14 && lecture[4]?.comparable === 14);
check('jonheom monthly_main remains 1/6', jonheom[0]?.pass === 1 && jonheom[0]?.comparable === 6);
check('jonheom jungki_transparent remains 1/6', jonheom[1]?.pass === 1 && jonheom[1]?.comparable === 6);
check('jonheom full/priority remain 1/6',
  jonheom[2]?.pass === 1 && jonheom[2]?.comparable === 6 &&
  jonheom[3]?.pass === 1 && jonheom[3]?.comparable === 6);
check('jonheom composite_classical selected agreement remains 1/6', jonheom[4]?.pass === 1 && jonheom[4]?.comparable === 6);
check('korean-modern monthly_main remains 2/7', koreanModern[0]?.pass === 2 && koreanModern[0]?.comparable === 7);
check('korean-modern jungki_transparent remains 3/7', koreanModern[1]?.pass === 3 && koreanModern[1]?.comparable === 7);
check('korean-modern full/priority remain 3/7',
  koreanModern[2]?.pass === 3 && koreanModern[2]?.comparable === 7 &&
  koreanModern[3]?.pass === 3 && koreanModern[3]?.comparable === 7);
check('korean-modern composite_classical selected agreement remains 2/7', koreanModern[4]?.pass === 2 && koreanModern[4]?.comparable === 7);

const jsonOutput = execSync('npm run measure:alternative-rules --silent -- --json', {
  cwd: SPRING_TS_ROOT,
  encoding: 'utf-8',
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true,
});
const matrix = JSON.parse(jsonOutput);
const jonheomCoverage = matrix.sources.find((row: any) => row.source === '명리존험')?.compositeCandidateCoverage;
const totalCoverage = matrix.compositeCandidateCoverage;
check('composite_classical candidate coverage improves jonheom selected agreement',
  jonheomCoverage?.covered > jonheom[4]?.pass && jonheomCoverage?.comparable === 6,
  JSON.stringify(jonheomCoverage));
check('composite_classical total candidate coverage is above selected agreement',
  totalCoverage?.covered > total[4]?.pass && totalCoverage?.comparable === 27,
  JSON.stringify(totalCoverage));

console.log(`\nGyeokguk rule-mode matrix: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
