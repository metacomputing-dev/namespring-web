import assert from 'node:assert/strict';
import test from 'node:test';

import { buildFortuneReport } from '../../src/report/buildFortuneReport.js';
import { analyzeSaju } from '../../src/saju-adapter.js';
import {
  registerTargetCalendarDate,
  snapshotTargetCalendarDate,
  targetCalendarParts,
} from '../../src/target-date.js';

const BIRTH = {
  year: 1986,
  month: 4,
  day: 19,
  hour: 5,
  minute: 45,
  gender: 'male' as const,
};

test('target date snapshots preserve the intrinsic instant and calendar parts', () => {
  const original = registerTargetCalendarDate(
    new Date('2026-05-03T15:00:00.000Z'),
    { year: 2026, month: 5, day: 4 },
  );
  const snapshot = snapshotTargetCalendarDate(original);
  original.setTime(original.getTime() + 86_400_000);
  assert.equal(snapshot.toISOString(), '2026-05-03T15:00:00.000Z');
  assert.deepEqual(targetCalendarParts(snapshot), {
    year: 2026,
    month: 5,
    day: 4,
  });

  class MisleadingDate extends Date {
    override getTime(): number {
      return 0;
    }

    override getFullYear(): number {
      return 1;
    }
  }
  const misleading = new MisleadingDate('2026-05-03T15:00:00.000Z');
  const intrinsicSnapshot = snapshotTargetCalendarDate(misleading);
  assert.equal(
    intrinsicSnapshot.toISOString(),
    '2026-05-03T15:00:00.000Z',
    'overridden Date methods must not control the captured instant',
  );
  assert.notEqual(
    targetCalendarParts(intrinsicSnapshot).year,
    1,
    'overridden Date methods must not control the captured calendar date',
  );

  assert.throws(
    () => snapshotTargetCalendarDate(new Date(Number.NaN)),
    TypeError,
  );
  assert.throws(
    () => snapshotTargetCalendarDate({} as Date),
    TypeError,
  );
});

test('public async saju and fortune builders isolate caller-owned inputs', async () => {
  const stableOptions = {
    schoolPreset: 'korean' as const,
    precisionConfig: {
      solarPrecision: 'iau1980_top10',
    },
  };
  const stableMale = await analyzeSaju(BIRTH, stableOptions);
  const stableFemale = await analyzeSaju({
    ...BIRTH,
    gender: 'female',
  }, stableOptions);
  assert.notEqual(
    stableMale.daeunInfo?.isForward,
    stableFemale.daeunInfo?.isForward,
    'fixture must distinguish the gender-dependent daeun direction',
  );

  const mutableBirth: any = { ...BIRTH };
  const mutableOptions: any = {
    schoolPreset: 'korean',
    precisionConfig: {
      solarPrecision: 'iau1980_top10',
    },
  };
  const analysisPromise = analyzeSaju(mutableBirth, mutableOptions);
  mutableBirth.gender = 'female';
  mutableOptions.schoolPreset = 'chinese';
  mutableOptions.precisionConfig.solarPrecision = 'classical';
  const racedAnalysis = await analysisPromise;
  assert.deepEqual(
    racedAnalysis,
    stableMale,
    'analyzeSaju must use the birth and options present at invocation time',
  );

  const reportBirth: any = { ...BIRTH };
  const reportOptions: any = { surfaceTieredMatrix: true };
  const reportSaju: any = structuredClone(stableMale);
  const targetDate = registerTargetCalendarDate(
    new Date('2026-05-03T15:00:00.000Z'),
    { year: 2026, month: 5, day: 4 },
  );
  const reportPromise = buildFortuneReport(
    reportSaju,
    targetDate,
    null,
    reportOptions,
    reportBirth,
  );

  targetDate.setTime(targetDate.getTime() + 86_400_000);
  reportBirth.gender = 'female';
  reportOptions.surfaceTieredMatrix = false;
  reportSaju.dayMaster = new Proxy({}, {
    get() {
      throw new Error('caller mutation reached the async report continuation');
    },
  });

  const report = await reportPromise;
  assert.equal(
    report.tieredMatrix?.meta.selectionSeed,
    '1986|4|19|5|45|male|2026-05-03T15:00:00.000Z',
    'buildFortuneReport must preserve the original Date instant, birth, and options',
  );
});
