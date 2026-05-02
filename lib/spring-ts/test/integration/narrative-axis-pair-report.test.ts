/**
 * test/integration/narrative-axis-pair-report.test.ts
 *
 * Verifies that the narrative axis-pair planning report remains machine-readable.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const SCRIPT_PATH = path.resolve(SPRING_TS_ROOT, 'tools/narrative_axis_pair_report.mjs');

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

console.log('Narrative axis pair report\n');

const stdout = execFileSync('node', [SCRIPT_PATH, '--json', '--max-missing=3'], {
  cwd: SPRING_TS_ROOT,
  encoding: 'utf-8',
});
const report = JSON.parse(stdout);
const pairsByKey = Object.fromEntries((report?.pairs ?? []).map((pair: any) => [pair.key, pair]));
const defaultPairKeys = [
  'agePhase:gender',
  'ageBand:gender',
  'birthSeason:currentSeason',
  'dayMasterElement:dayMasterStrength',
  'dayMasterElement:yongshinElement',
  'dayMasterStrength:yongshinAlignment',
  'gyeokguk:dayMasterStrength',
  'yongshinElement:yongshinAlignment',
];

check('report schema version is stable',
  report?.schemaVersion === 'spring-ts.narrative-axis-pair-report.v1',
  report?.schemaVersion);
check('default pair count is stable',
  report?.totals?.pairCount === defaultPairKeys.length,
  String(report?.totals?.pairCount ?? 0));
check('default pairs are present',
  defaultPairKeys.every((key) => pairsByKey[key]),
  Object.keys(pairsByKey).join(','));
check('pair records are machine readable',
  Array.isArray(report?.pairs) &&
    report.pairs.every((pair: any) =>
      typeof pair.key === 'string' &&
      Array.isArray(pair.fields) &&
      pair.fields.length === 2 &&
      typeof pair.expectedCombinationCount === 'number' &&
      typeof pair.coveredCombinationCount === 'number' &&
      typeof pair.missingCombinationCount === 'number' &&
      typeof pair.coverageRatio === 'number' &&
      Array.isArray(pair.missingCombinations)));
check('dayMasterElement:yongshinElement expected matrix is 25 cells',
  pairsByKey['dayMasterElement:yongshinElement']?.expectedCombinationCount === 25,
  String(pairsByKey['dayMasterElement:yongshinElement']?.expectedCombinationCount ?? 0));
check('agePhase:gender expected matrix is 48 cells',
  pairsByKey['agePhase:gender']?.expectedCombinationCount === 48,
  String(pairsByKey['agePhase:gender']?.expectedCombinationCount ?? 0));
check('gyeokguk observed values backfill pair matrix',
  pairsByKey['gyeokguk:dayMasterStrength']?.expectedCombinationCount > 0 &&
    pairsByKey['gyeokguk:dayMasterStrength']?.expectedValues?.gyeokguk?.length > 0,
  String(pairsByKey['gyeokguk:dayMasterStrength']?.expectedCombinationCount ?? 0));
check('missing combination list obeys --max-missing',
  report.pairs.every((pair: any) => pair.missingCombinations.length <= 3));
check('missing combination total is aggregated',
  report?.totals?.missingCombinationCount === report.pairs.reduce((sum: number, pair: any) => sum + pair.missingCombinationCount, 0),
  String(report?.totals?.missingCombinationCount ?? 0));
check('tracked pair matrices have no missing combinations',
  report?.totals?.missingCombinationCount === 0,
  report.pairs
    .filter((pair: any) => pair.missingCombinationCount > 0)
    .map((pair: any) => `${pair.key}=${pair.missingCombinationCount}`)
    .join(',') || '0');

console.log(`\nNarrative axis pair report: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
