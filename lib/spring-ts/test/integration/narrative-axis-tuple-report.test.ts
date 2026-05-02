/**
 * test/integration/narrative-axis-tuple-report.test.ts
 *
 * Verifies that the narrative axis-tuple planning report remains machine-readable.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const SCRIPT_PATH = path.resolve(SPRING_TS_ROOT, 'tools/narrative_axis_tuple_report.mjs');

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

console.log('Narrative axis tuple report\n');

const stdout = execFileSync('node', [SCRIPT_PATH, '--json', '--max-missing=4', '--max-thin=4', '--max-top=5', '--min-authored=2'], {
  cwd: SPRING_TS_ROOT,
  encoding: 'utf-8',
});
const report = JSON.parse(stdout);
const tuplesByKey = Object.fromEntries((report?.tuples ?? []).map((tuple: any) => [tuple.key, tuple]));
const defaultTupleKeys = [
  'dayMasterElement:yongshinElement:dayMasterStrength',
  'gyeokguk:dayMasterStrength:dayMasterElement',
  'birthSeason:currentSeason:yongshinAlignment',
];

check('report schema version is stable',
  report?.schemaVersion === 'spring-ts.narrative-axis-tuple-report.v1',
  report?.schemaVersion);
check('default tuple count is stable',
  report?.totals?.tupleCount === defaultTupleKeys.length,
  String(report?.totals?.tupleCount ?? 0));
check('default tuples are present',
  defaultTupleKeys.every((key) => tuplesByKey[key]),
  Object.keys(tuplesByKey).join(','));
check('tuple records are machine readable',
  Array.isArray(report?.tuples) &&
    report.tuples.every((tuple: any) =>
      typeof tuple.key === 'string' &&
      Array.isArray(tuple.fields) &&
      tuple.fields.length >= 3 &&
      typeof tuple.expectedCombinationCount === 'number' &&
      typeof tuple.coveredCombinationCount === 'number' &&
      typeof tuple.missingCombinationCount === 'number' &&
      typeof tuple.thinCombinationCount === 'number' &&
      typeof tuple.coverageRatio === 'number' &&
      typeof tuple.authoredDeficitToThreshold === 'number' &&
      Array.isArray(tuple.missingCombinations) &&
      Array.isArray(tuple.thinCombinations)));
check('dayMaster triple expected matrix is 125 cells',
  tuplesByKey['dayMasterElement:yongshinElement:dayMasterStrength']?.expectedCombinationCount === 125,
  String(tuplesByKey['dayMasterElement:yongshinElement:dayMasterStrength']?.expectedCombinationCount ?? 0));
check('season alignment triple expected matrix is 48 cells',
  tuplesByKey['birthSeason:currentSeason:yongshinAlignment']?.expectedCombinationCount === 48,
  String(tuplesByKey['birthSeason:currentSeason:yongshinAlignment']?.expectedCombinationCount ?? 0));
check('gyeokguk observed values backfill tuple matrix',
  tuplesByKey['gyeokguk:dayMasterStrength:dayMasterElement']?.expectedCombinationCount > 0 &&
    tuplesByKey['gyeokguk:dayMasterStrength:dayMasterElement']?.expectedValues?.gyeokguk?.length > 0,
  String(tuplesByKey['gyeokguk:dayMasterStrength:dayMasterElement']?.expectedCombinationCount ?? 0));
check('missing combination list obeys --max-missing',
  report.tuples.every((tuple: any) => tuple.missingCombinations.length <= 4));
check('thin combination list obeys --max-thin',
  report.tuples.every((tuple: any) => tuple.thinCombinations.length <= 4));
check('global tuple target lists obey --max-top',
  Array.isArray(report?.topMissingCombinations) &&
    Array.isArray(report?.topThinCombinations) &&
    report.topMissingCombinations.length <= 5 &&
    report.topThinCombinations.length <= 5,
  `${report?.topMissingCombinations?.length ?? 0}/${report?.topThinCombinations?.length ?? 0}`);
check('missing and thin totals are aggregated',
  report?.totals?.missingCombinationCount === report.tuples.reduce((sum: number, tuple: any) => sum + tuple.missingCombinationCount, 0) &&
    report?.totals?.thinCombinationCount === report.tuples.reduce((sum: number, tuple: any) => sum + tuple.thinCombinationCount, 0) &&
    report?.totals?.thinCombinationDeficit === report.tuples.reduce((sum: number, tuple: any) => sum + tuple.authoredDeficitToThreshold, 0),
  `${report?.totals?.missingCombinationCount ?? 0}/${report?.totals?.thinCombinationCount ?? 0}/${report?.totals?.thinCombinationDeficit ?? 0}`);
check('tuple density thresholds default to observation mode',
  report?.maxMissingCombinationThreshold === null &&
    report?.maxThinCombinationThreshold === null &&
    report?.totals?.missingCombinationExcessToThreshold === 0 &&
    report?.totals?.thinCombinationExcessToThreshold === 0,
  JSON.stringify({
    maxMissing: report?.maxMissingCombinationThreshold,
    maxThin: report?.maxThinCombinationThreshold,
  }));

const customTuple = spawnSync('node', [
  SCRIPT_PATH,
  '--json',
  '--tuples=dayMasterElement:yongshinElement:dayMasterStrength',
  '--max-missing=2',
], {
  cwd: SPRING_TS_ROOT,
  encoding: 'utf-8',
});
const customTupleReport = JSON.parse(customTuple.stdout);
check('custom tuple selection narrows the report',
  customTuple.status === 0 &&
    customTupleReport?.totals?.tupleCount === 1 &&
    customTupleReport?.tuples?.[0]?.key === 'dayMasterElement:yongshinElement:dayMasterStrength',
  `status=${customTuple.status}; stderr=${customTuple.stderr.trim()}`);

const strictThinGate = spawnSync('node', [
  SCRIPT_PATH,
  '--json',
  '--min-authored=999',
  '--max-thin-combinations=0',
], {
  cwd: SPRING_TS_ROOT,
  encoding: 'utf-8',
});
const strictThinGateReport = JSON.parse(strictThinGate.stdout);
check('thin-combination threshold can fail CI intentionally',
  strictThinGate.status === 1 &&
    strictThinGate.stderr.includes('thin tuple combinations') &&
    strictThinGateReport?.maxThinCombinationThreshold === 0,
  `status=${strictThinGate.status}; stderr=${strictThinGate.stderr.trim()}`);
check('thin-combination threshold excess is machine readable',
  strictThinGateReport?.totals?.thinCombinationExcessToThreshold === strictThinGateReport?.totals?.thinCombinationCount,
  `${strictThinGateReport?.totals?.thinCombinationExcessToThreshold ?? 0}/${strictThinGateReport?.totals?.thinCombinationCount ?? 0}`);

console.log(`\nNarrative axis tuple report: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
