import { analyzeSaju } from '../src/saju-adapter.ts';

type BirthOverride = Record<string, unknown>;

interface CaseResult {
  readonly label: string;
  readonly longitudeCorrectionMinutes: number;
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

const POLICY_ON = {
  sajuTimePolicy: {
    trueSolarTime: 'on',
    longitudeCorrection: 'on',
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

async function runCase(label: string, birthOverride: BirthOverride): Promise<CaseResult> {
  const summary = await analyzeSaju(
    { ...BASE_BIRTH, ...birthOverride } as any,
    POLICY_ON as any,
  );
  const lon = Number(summary.timeCorrection?.longitudeCorrectionMinutes ?? Number.NaN);
  const adjustedHour = Number(summary.timeCorrection?.adjustedHour ?? Number.NaN);
  const adjustedMinute = Number(summary.timeCorrection?.adjustedMinute ?? Number.NaN);
  const hourStem = String(summary.pillars?.hour?.stem?.code ?? '');
  const hourBranch = String(summary.pillars?.hour?.branch?.code ?? '');
  return {
    label,
    longitudeCorrectionMinutes: lon,
    adjustedHour,
    adjustedMinute,
    hourStem,
    hourBranch,
  };
}

async function main(): Promise<void> {
  const defaultSeoul = await runCase('default-seoul', {});
  const daeguRegion = await runCase('daegu-region', { region: '대구' });
  const daeguCity = await runCase('daegu-city-alias', { city: 'Daegu' });
  const daeguBirthPlace = await runCase('daegu-birthPlace-alias', { birthPlace: '대구광역시 수성구' });
  const explicitCoordinatePriority = await runCase('explicit-coordinate-priority', {
    region: '서울',
    latitude: 35.8714,
    longitude: 128.6014,
  });
  const boundarySeoul = await runCase('boundary-01:34-seoul', { hour: 1, minute: 34, region: '서울' });
  const boundaryDaegu = await runCase('boundary-01:34-daegu', { hour: 1, minute: 34, region: '대구' });

  assertNear('default Seoul longitude correction', defaultSeoul.longitudeCorrectionMinutes, -32.088, 0.01);
  assertNear('Daegu region longitude correction', daeguRegion.longitudeCorrectionMinutes, -25.5944, 0.01);
  assertNear('Daegu city alias longitude correction', daeguCity.longitudeCorrectionMinutes, -25.5944, 0.01);
  assertNear('Daegu birthPlace alias longitude correction', daeguBirthPlace.longitudeCorrectionMinutes, -25.5944, 0.01);
  assertNear(
    'Explicit coordinate priority over region',
    explicitCoordinatePriority.longitudeCorrectionMinutes,
    -25.5944,
    0.01,
  );
  assertEqual('1989-01-10 01:30 default hour branch', defaultSeoul.hourBranch, 'JA');
  assertEqual('1989-01-10 01:30 daegu hour branch', daeguRegion.hourBranch, 'JA');
  assertEqual('Boundary 01:34 Seoul hour branch', boundarySeoul.hourBranch, 'JA');
  assertEqual('Boundary 01:34 Daegu hour branch', boundaryDaegu.hourBranch, 'CHUK');
  assertEqual('Boundary 01:34 Seoul hour stem', boundarySeoul.hourStem, 'BYEONG');
  assertEqual('Boundary 01:34 Daegu hour stem', boundaryDaegu.hourStem, 'JEONG');

  const results = [
    defaultSeoul,
    daeguRegion,
    daeguCity,
    daeguBirthPlace,
    explicitCoordinatePriority,
    boundarySeoul,
    boundaryDaegu,
  ];
  console.table(results);
  console.log('PASS: region-coordinate resolution and boundary-hour verification');
}

main().catch((error) => {
  console.error('FAIL:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

