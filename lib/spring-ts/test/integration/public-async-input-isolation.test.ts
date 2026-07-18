import assert from 'node:assert/strict';
import test from 'node:test';

import { buildFortuneReport } from '../../src/report/buildFortuneReport.js';
import { REPORT_DELIVERY_REQUEST_SCHEMA_V1 } from '../../src/report/delivery/types.js';
import { analyzeSaju } from '../../src/saju-adapter.js';
import { SpringEngine } from '../../src/spring-engine.js';
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
    'selection_v1_b98db59b795f69ac4202ec12590dd092',
    'buildFortuneReport must snapshot inputs before producing the privacy-safe digest',
  );
  assert.equal(
    JSON.stringify(report).includes('1986|4|19|5|45|male'),
    false,
    'serialized report metadata must not expose the raw selection key',
  );
});

test('local report and candidate endpoints isolate mutable caller-owned requests', async () => {
  const candidateEngine = new SpringEngine() as any;
  let releaseCandidate = (): void => {};
  const candidateGate = new Promise<void>((resolve) => {
    releaseCandidate = resolve;
  });
  let observedCandidateRequest: any;
  candidateEngine.getNameCandidateSummariesInternal = async (request: any) => {
    await candidateGate;
    observedCandidateRequest = request;
    return [{
      finalScore: 90,
      fullHangul: '\uAE40\uAC00',
      fullHanja: '',
      givenHangul: '\uAC00',
      givenName: [{ hangul: '\uAC00' }],
      popularityRank: null,
      maleRatio: null,
      nameGender: 'unknown',
      rank: 1,
    }];
  };
  const mutableCandidateRequest: any = {
    birth: { year: 1990, month: 1, day: 1, gender: 'neutral' },
    surname: [{ hangul: '\uAE40' }],
    mode: 'recommend',
    options: { limit: 1 },
  };
  const candidatePromise = candidateEngine.getCandidateSearch(mutableCandidateRequest);
  mutableCandidateRequest.birth.day = 2;
  mutableCandidateRequest.surname[0].hangul = '\uC774';
  mutableCandidateRequest.options.limit = 2;
  releaseCandidate();
  const candidatePage = await candidatePromise;
  assert.equal(observedCandidateRequest.birth.day, 1);
  assert.equal(observedCandidateRequest.surname[0].hangul, '\uAE40');
  assert.equal(candidatePage.pagination.requestedLimit, 1);
  assert.equal(candidatePage.items[0]?.name.fullHangul, '\uAE40\uAC00');
  candidateEngine.close();

  const reportEngine = new SpringEngine() as any;
  let releaseReport = (): void => {};
  const reportGate = new Promise<void>((resolve) => {
    releaseReport = resolve;
  });
  let observedNamingRequest: any;
  const sentinel = new Error('stop after observing the snapshotted naming request');
  reportEngine.getNamingReport = async (request: any) => {
    await reportGate;
    observedNamingRequest = request;
    throw sentinel;
  };
  const mutableReportRequest: any = {
    birth: { year: 1990, month: 1, day: 1, gender: 'neutral' },
    surname: [{ hangul: '\uAE40' }],
    givenName: [{ hangul: '\uAC00' }],
    targetDate: '2026-07-18',
    delivery: {
      schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
      surfaces: [{ id: 'naming', depth: 'brief' }],
    },
  };
  const reportPromise = reportEngine.getReportDelivery(mutableReportRequest);
  mutableReportRequest.birth.day = 2;
  mutableReportRequest.surname[0].hangul = '\uC774';
  mutableReportRequest.givenName[0].hangul = '\uB098';
  mutableReportRequest.delivery.surfaces[0].id = 'saju';
  releaseReport();
  await assert.rejects(reportPromise, (error: unknown) => error === sentinel);
  assert.equal(observedNamingRequest.birth.day, 1);
  assert.equal(observedNamingRequest.surname[0].hangul, '\uAE40');
  assert.equal(observedNamingRequest.givenName[0].hangul, '\uAC00');
  assert.equal(observedNamingRequest.mode, 'evaluate');
  reportEngine.close();
});
