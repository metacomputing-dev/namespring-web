/**
 * test/integration/narrative-axis-pair-report.test.ts
 *
 * Verifies that the narrative axis-pair planning report remains machine-readable.
 */
import { execFileSync, spawnSync } from 'node:child_process';
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

const stdout = execFileSync('node', [SCRIPT_PATH, '--json', '--max-missing=3', '--max-thin=3', '--min-authored=2'], {
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
      typeof pair.thinCombinationCount === 'number' &&
      typeof pair.coverageRatio === 'number' &&
      typeof pair.authoredDeficitToThreshold === 'number' &&
      Array.isArray(pair.missingCombinations) &&
      Array.isArray(pair.thinCombinations)));
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
check('thin combination list obeys --max-thin',
  report.pairs.every((pair: any) => pair.thinCombinations.length <= 3));
check('missing combination total is aggregated',
  report?.totals?.missingCombinationCount === report.pairs.reduce((sum: number, pair: any) => sum + pair.missingCombinationCount, 0),
  String(report?.totals?.missingCombinationCount ?? 0));
check('thin combination total is aggregated',
  report?.totals?.thinCombinationCount === report.pairs.reduce((sum: number, pair: any) => sum + pair.thinCombinationCount, 0) &&
    report?.totals?.thinCombinationDeficit === report.pairs.reduce((sum: number, pair: any) => sum + pair.authoredDeficitToThreshold, 0),
  `${report?.totals?.thinCombinationCount ?? 0}/${report?.totals?.thinCombinationDeficit ?? 0}`);
check('pair density thresholds default to observation mode',
  report?.maxMissingCombinationThreshold === null &&
    report?.maxThinCombinationThreshold === null &&
    report?.totals?.missingCombinationExcessToThreshold === 0 &&
    report?.totals?.thinCombinationExcessToThreshold === 0,
  JSON.stringify({
    maxMissing: report?.maxMissingCombinationThreshold,
    maxThin: report?.maxThinCombinationThreshold,
    missingExcess: report?.totals?.missingCombinationExcessToThreshold,
    thinExcess: report?.totals?.thinCombinationExcessToThreshold,
  }));
check('pair density report exposes next expansion targets',
  report?.minAuthoredThreshold === 2 &&
    report?.totals?.thinCombinationCount > 0 &&
    report.pairs.some((pair: any) =>
      pair.thinCombinationCount > 0 &&
      pair.thinCombinations.every((combo: any) =>
        typeof combo.authoredFragments === 'number' &&
        typeof combo.requiredAuthoredFragments === 'number' &&
        typeof combo.deficit === 'number')),
  String(report?.totals?.thinCombinationCount ?? 0));
check('tracked pair matrices have no missing combinations',
  report?.totals?.missingCombinationCount === 0,
  report.pairs
    .filter((pair: any) => pair.missingCombinationCount > 0)
    .map((pair: any) => `${pair.key}=${pair.missingCombinationCount}`)
    .join(',') || '0');

const missingGate = spawnSync('node', [
  SCRIPT_PATH,
  '--json',
  '--min-authored=2',
  '--max-missing-combinations=0',
], {
  cwd: SPRING_TS_ROOT,
  encoding: 'utf-8',
});
const missingGateReport = JSON.parse(missingGate.stdout);
check('missing-combination threshold can pass when target is met',
  missingGate.status === 0 &&
    missingGateReport?.maxMissingCombinationThreshold === 0 &&
    missingGateReport?.totals?.missingCombinationExcessToThreshold === 0,
  `status=${missingGate.status}; stderr=${missingGate.stderr.trim()}`);

const thinGate = spawnSync('node', [
  SCRIPT_PATH,
  '--json',
  '--min-authored=2',
  '--max-thin-combinations=0',
], {
  cwd: SPRING_TS_ROOT,
  encoding: 'utf-8',
});
const thinGateReport = JSON.parse(thinGate.stdout);
check('thin-combination threshold can fail CI intentionally',
  thinGate.status === 1 &&
    thinGate.stderr.includes('thin pair combinations') &&
    thinGateReport?.maxThinCombinationThreshold === 0,
  `status=${thinGate.status}; stderr=${thinGate.stderr.trim()}`);
check('thin-combination threshold excess is machine readable',
  thinGateReport?.totals?.thinCombinationExcessToThreshold === thinGateReport?.totals?.thinCombinationCount,
  `${thinGateReport?.totals?.thinCombinationExcessToThreshold ?? 0}/${thinGateReport?.totals?.thinCombinationCount ?? 0}`);

console.log(`\nNarrative axis pair report: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
