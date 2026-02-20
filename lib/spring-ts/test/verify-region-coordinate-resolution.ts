import { analyzeSaju } from '../src/saju-adapter.ts';

type BirthOverride = Record<string, unknown>;
type OptionsOverride = Record<string, unknown> | undefined;

interface CaseResult {
  readonly label: string;
  readonly longitudeCorrectionMinutes: number;
  readonly equationOfTimeMinutes: number;
  readonly adjustedHour: number;
  readonly adjustedMinute: number;
  readonly hourStem: string;
  readonly hourBranch: string;
}

const BASE_BIRTH = {
  year: 1989,
  month: 1,
  day: 10,
  hour: 1,
  minute: 30,
  gender: 'male',
  calendarType: 'solar',
} as const;

const POLICY_TST_ON_LON_ON = {
  sajuTimePolicy: {
    trueSolarTime: 'on',
    longitudeCorrection: 'on',
    yaza: 'off',
  },
} as const;

const POLICY_TST_OFF_LON_ON = {
  sajuTimePolicy: {
    trueSolarTime: 'off',
    longitudeCorrection: 'on',
    yaza: 'off',
  },
} as const;

const POLICY_TST_ON_LON_OFF = {
  sajuTimePolicy: {
    trueSolarTime: 'on',
    longitudeCorrection: 'off',
    yaza: 'off',
  },
} as const;

const POLICY_TST_OFF_LON_OFF = {
  sajuTimePolicy: {
    trueSolarTime: 'off',
    longitudeCorrection: 'off',
    yaza: 'off',
  },
} as const;

function fail(message: string): never {
  throw new Error(message);
}

function assertNear(label: string, actual: number, expected: number, tolerance: number): void {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) {
    fail(`${label}: expected ${expected} +/- ${tolerance}, got ${actual}`);
  }
}

function assertEqual(label: string, actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    fail(`${label}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

async function runCase(
  label: string,
  birthOverride: BirthOverride,
  optionsOverride: OptionsOverride,
): Promise<CaseResult> {
  const summary = await analyzeSaju(
    { ...BASE_BIRTH, ...birthOverride } as any,
    optionsOverride as any,
  );
  const lon = Number(summary.timeCorrection?.longitudeCorrectionMinutes ?? Number.NaN);
  const eot = Number(summary.timeCorrection?.equationOfTimeMinutes ?? Number.NaN);
  const adjustedHour = Number(summary.timeCorrection?.adjustedHour ?? Number.NaN);
  const adjustedMinute = Number(summary.timeCorrection?.adjustedMinute ?? Number.NaN);
  const hourStem = String(summary.pillars?.hour?.stem?.code ?? '');
  const hourBranch = String(summary.pillars?.hour?.branch?.code ?? '');
  return {
    label,
    longitudeCorrectionMinutes: lon,
    equationOfTimeMinutes: eot,
    adjustedHour,
    adjustedMinute,
    hourStem,
    hourBranch,
  };
}

async function main(): Promise<void> {
  // Region-resolution checks (TST on + longitude on)
  const defaultSeoul = await runCase('default-seoul', {}, POLICY_TST_ON_LON_ON as any);
  const daeguRegion = await runCase('daegu-region', { region: '대구' }, POLICY_TST_ON_LON_ON as any);
  const daeguCity = await runCase('daegu-city-alias', { city: '대구' }, POLICY_TST_ON_LON_ON as any);
  const daeguBirthPlace = await runCase(
    'daegu-birthPlace-alias',
    { birthPlace: '대구 수성구' },
    POLICY_TST_ON_LON_ON as any,
  );
  const explicitCoordinatePriority = await runCase(
    'explicit-coordinate-priority',
    { region: '서울', latitude: 35.8714, longitude: 128.6014 },
    POLICY_TST_ON_LON_ON as any,
  );
  const boundarySeoul = await runCase(
    'boundary-01:34-seoul',
    { hour: 1, minute: 34, region: '서울' },
    POLICY_TST_ON_LON_ON as any,
  );
  const boundaryDaegu = await runCase(
    'boundary-01:34-daegu',
    { hour: 1, minute: 34, region: '대구' },
    POLICY_TST_ON_LON_ON as any,
  );

  assertNear('default Seoul longitude correction', defaultSeoul.longitudeCorrectionMinutes, -32.088, 0.01);
  assertNear('Daegu region longitude correction', daeguRegion.longitudeCorrectionMinutes, -25.5944, 0.01);
  assertNear('Daegu city alias longitude correction', daeguCity.longitudeCorrectionMinutes, -25.5944, 0.01);
  assertNear('Daegu birthPlace alias longitude correction', daeguBirthPlace.longitudeCorrectionMinutes, -25.5944, 0.01);
  assertNear('Explicit coordinate priority over region', explicitCoordinatePriority.longitudeCorrectionMinutes, -25.5944, 0.01);
  assertEqual('1989-01-10 01:30 default hour branch', defaultSeoul.hourBranch, 'JA');
  assertEqual('1989-01-10 01:30 daegu hour branch', daeguRegion.hourBranch, 'JA');
  assertEqual('Boundary 01:34 Seoul hour branch', boundarySeoul.hourBranch, 'JA');
  assertEqual('Boundary 01:34 Daegu hour branch', boundaryDaegu.hourBranch, 'CHUK');
  assertEqual('Boundary 01:34 Seoul hour stem', boundarySeoul.hourStem, 'BYEONG');
  assertEqual('Boundary 01:34 Daegu hour stem', boundaryDaegu.hourStem, 'JEONG');

  // Time-policy matrix checks for real input case (1989-01-10 01:30 male, Daegu)
  const matrixDefault = await runCase('matrix-default', { region: '대구' }, undefined);
  const matrixOffOn = await runCase('matrix-tst-off-lon-on', { region: '대구' }, POLICY_TST_OFF_LON_ON as any);
  const matrixOnOn = await runCase('matrix-tst-on-lon-on', { region: '대구' }, POLICY_TST_ON_LON_ON as any);
  const matrixOnOff = await runCase('matrix-tst-on-lon-off', { region: '대구' }, POLICY_TST_ON_LON_OFF as any);
  const matrixOffOff = await runCase('matrix-tst-off-lon-off', { region: '대구' }, POLICY_TST_OFF_LON_OFF as any);

  // Defaults should match product policy: TST off + longitude on + yaza off.
  assertNear('Default lon correction (Daegu)', matrixDefault.longitudeCorrectionMinutes, -25.5944, 0.01);
  assertNear('Default EoT (Daegu)', matrixDefault.equationOfTimeMinutes, 0, 0.0001);
  assertEqual('Default adjusted hour (Daegu)', matrixDefault.adjustedHour, 1);
  assertEqual('Default adjusted minute (Daegu)', matrixDefault.adjustedMinute, 4);
  assertEqual('Default hour branch (Daegu)', matrixDefault.hourBranch, 'CHUK');

  // TST off + longitude on -> longitude-only correction.
  assertNear('TST off + lon on (Daegu)', matrixOffOn.longitudeCorrectionMinutes, -25.5944, 0.01);
  assertNear('TST off + lon on EoT', matrixOffOn.equationOfTimeMinutes, 0, 0.0001);
  assertEqual('TST off + lon on adjusted hour', matrixOffOn.adjustedHour, 1);
  assertEqual('TST off + lon on adjusted minute', matrixOffOn.adjustedMinute, 4);

  // TST on + longitude on -> longitude + EoT.
  assertNear('TST on + lon on lonCorr', matrixOnOn.longitudeCorrectionMinutes, -25.5944, 0.01);
  assertNear('TST on + lon on EoT', matrixOnOn.equationOfTimeMinutes, -6.413, 0.02);
  assertEqual('TST on + lon on adjusted hour', matrixOnOn.adjustedHour, 0);
  assertEqual('TST on + lon on adjusted minute', matrixOnOn.adjustedMinute, 57);
  assertEqual('TST on + lon on hour branch', matrixOnOn.hourBranch, 'JA');

  // TST on + longitude off -> EoT-only correction.
  assertNear('TST on + lon off lonCorr', matrixOnOff.longitudeCorrectionMinutes, 0, 0.0001);
  assertNear('TST on + lon off EoT', matrixOnOff.equationOfTimeMinutes, -6.413, 0.02);
  assertEqual('TST on + lon off adjusted hour', matrixOnOff.adjustedHour, 1);
  assertEqual('TST on + lon off adjusted minute', matrixOnOff.adjustedMinute, 23);
  assertEqual('TST on + lon off hour branch', matrixOnOff.hourBranch, 'CHUK');

  // TST off + longitude off -> no correction.
  assertNear('TST off + lon off lonCorr', matrixOffOff.longitudeCorrectionMinutes, 0, 0.0001);
  assertNear('TST off + lon off EoT', matrixOffOff.equationOfTimeMinutes, 0, 0.0001);
  assertEqual('TST off + lon off adjusted hour', matrixOffOff.adjustedHour, 1);
  assertEqual('TST off + lon off adjusted minute', matrixOffOff.adjustedMinute, 30);
  assertEqual('TST off + lon off hour branch', matrixOffOff.hourBranch, 'CHUK');

  const results = [
    defaultSeoul,
    daeguRegion,
    daeguCity,
    daeguBirthPlace,
    explicitCoordinatePriority,
    boundarySeoul,
    boundaryDaegu,
    matrixDefault,
    matrixOffOn,
    matrixOnOn,
    matrixOnOff,
    matrixOffOff,
  ];
  console.table(results);
  console.log('PASS: region-coordinate resolution, boundary-hour, and policy matrix verification');
}

main().catch((error) => {
  console.error('FAIL:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
