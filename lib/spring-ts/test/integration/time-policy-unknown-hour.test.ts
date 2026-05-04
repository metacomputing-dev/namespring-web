/**
 * test/integration/time-policy-unknown-hour.test.ts
 *
 * Guards unknown-hour handling and report surfacing. Unknown hour is a valid
 * but provisional saju path: the engine uses a noon fallback, labels the
 * uncertainty, and lowers hour-sensitive confidence tiers.
 *
 * Run: npm run test:time-policy
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { analyzeSajuSafe } from '../../src/saju-adapter.js';
import { buildFortuneReport } from '../../src/report/buildFortuneReport.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const FIXTURE_PATH = path.resolve(SPRING_TS_ROOT, 'test/fixtures/spring_ts_baseline_cases.json');

type Tier = 'definite' | 'practical' | 'candidate' | 'deferred';

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

function tierRank(value: unknown): number {
  if (value === 'definite') return 4;
  if (value === 'practical') return 3;
  if (value === 'candidate') return 2;
  if (value === 'deferred') return 1;
  return 0;
}

function isOneStepDowngraded(known: unknown, unknown: unknown): boolean {
  if (known === 'definite') return unknown === 'practical';
  if (known === 'practical') return unknown === 'candidate';
  return known === unknown;
}

console.log('Unknown-hour time policy regression\n');

const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8')) as {
  readonly fixtures: readonly Array<{ readonly id: string; readonly axis: readonly string[]; readonly birth: any }>;
};
const unknownHourCase = fixture.fixtures.find((row) => row.id === 'fix-11');

check('fix-11 remains the unknown-hour baseline fixture',
  !!unknownHourCase &&
    unknownHourCase.axis.includes('unknown-hour') &&
    unknownHourCase.birth.hour === null,
  `axis=${unknownHourCase?.axis.join(',') ?? 'missing'}`);

const unknownBirth = unknownHourCase?.birth ?? {
  year: 1995,
  month: 8,
  day: 15,
  hour: null,
  minute: 0,
  gender: 'female',
};
const knownNoonBirth = { ...unknownBirth, hour: 12, minute: 0 };

const unknownResult = await analyzeSajuSafe(unknownBirth, {
  sajuTimePolicy: { trueSolarTime: 'off', longitudeCorrection: 'off', yaza: 'off' },
});
const knownNoonResult = await analyzeSajuSafe(knownNoonBirth, {
  sajuTimePolicy: { trueSolarTime: 'off', longitudeCorrection: 'off', yaza: 'off' },
});

const unknownSummary = unknownResult.summary as Record<string, any>;
const knownSummary = knownNoonResult.summary as Record<string, any>;
const unknownNotes = Array.isArray(unknownSummary.partialInterpretation)
  ? unknownSummary.partialInterpretation.map(String)
  : [];
const knownNotes = Array.isArray(knownSummary.partialInterpretation)
  ? knownSummary.partialInterpretation.map(String)
  : [];
const uncertainty = unknownSummary.inputUncertainty?.unknownHour;
const knownUncertainty = knownSummary.inputUncertainty?.unknownHour;

check('unknown hour still runs full saju when year/month/day are present',
  unknownResult.sajuEnabled === true && !!unknownResult.summary.dayMaster.element,
  `sajuEnabled=${unknownResult.sajuEnabled}`);
check('unknown hour uses documented noon fallback',
  unknownResult.summary.timeCorrection.standardHour === 12 &&
    unknownResult.summary.timeCorrection.standardMinute === 0,
  `standard=${unknownResult.summary.timeCorrection.standardHour}:${unknownResult.summary.timeCorrection.standardMinute}`);
check('unknown hour surfaces partial-interpretation note',
  unknownNotes.some((line) => line.includes('12:00') && line.includes('미상')));
check('known noon twin does not surface unknown-time note',
  !knownNotes.some((line) => line.includes('12:00') && line.includes('미상')));
check('unknown hour surfaces typed input uncertainty',
  uncertainty?.fallbackHour === 12 &&
    uncertainty?.fallbackMinute === 0 &&
    uncertainty?.affectedAxes.includes('hourPillar') &&
    uncertainty?.affectedAxes.includes('fortuneTiming'));
check('known noon twin has no unknown-hour uncertainty',
  knownUncertainty == null);

const axisKeys = ['yongshin', 'gyeokguk', 'strength'] as const;
const knownAxis = knownSummary.axisStrength ?? {};
const unknownAxis = unknownSummary.axisStrength ?? {};
const nonIncreasing = axisKeys.every((axis) => tierRank(unknownAxis[axis]) <= tierRank(knownAxis[axis]));

check('unknown hour does not increase hour-sensitive confidence tiers',
  nonIncreasing,
  `known=${JSON.stringify(knownAxis)}, unknown=${JSON.stringify(unknownAxis)}`);

const downgradeProbeKnown = await analyzeSajuSafe({
  year: 1986,
  month: 4,
  day: 19,
  hour: 12,
  minute: 0,
  gender: 'male',
});
const downgradeProbeUnknown = await analyzeSajuSafe({
  year: 1986,
  month: 4,
  day: 19,
  hour: null,
  minute: null,
  gender: 'male',
});
const probeKnownAxis = (downgradeProbeKnown.summary as Record<string, any>).axisStrength ?? {};
const probeUnknownAxis = (downgradeProbeUnknown.summary as Record<string, any>).axisStrength ?? {};
const expectedDowngrade = axisKeys.every((axis) => isOneStepDowngraded(probeKnownAxis[axis] as Tier | undefined, probeUnknownAxis[axis] as Tier | undefined));
const anyChanged = axisKeys.some((axis) => probeUnknownAxis[axis] !== probeKnownAxis[axis]);

check('unknown hour applies one-step confidence downgrade where possible',
  expectedDowngrade && anyChanged,
  `known=${JSON.stringify(probeKnownAxis)}, unknown=${JSON.stringify(probeUnknownAxis)}`);

const report = buildFortuneReport(unknownResult.summary, new Date('2026-05-01T00:00:00+09:00'), null);
const reportUncertainty = report.meta.uncertainties?.find((row) => row.id === 'unknown-hour');
const overviewEvidence = report.overviewSummary.evidence?.find((row) => row.axis === 'inputTime');

check('fortune report meta carries unknown-hour uncertainty',
  reportUncertainty?.fallback?.hour === 12 &&
    reportUncertainty?.affectedAxes.includes('hourPillar'));
check('overview evidence names affected input-time axes',
  overviewEvidence?.strength === 'candidate' &&
    overviewEvidence.supportingFeatures.some((line) => line.includes('영향을 받을 수 있는 항목')));

console.log(`\nUnknown-hour policy check: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
