/**
 * test/integration/boundary-chart-goldens.test.ts
 *
 * Guards chart pillars around solar-term, midnight, timezone, and longitude
 * normalization boundaries.
 *
 * Run: npm run test:boundary-goldens
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { analyzeSaju, buildSajuContext } from '../../src/saju-adapter.js';
import type { BirthInfo, SajuSummary, SpringRequest } from '../../src/types.js';

type PillarPosition = 'year' | 'month' | 'day' | 'hour';
type PillarExpectation = Record<PillarPosition, string>;

interface GoldenChartCase {
  readonly id: string;
  readonly birth: BirthInfo;
  readonly expected: PillarExpectation;
  readonly options?: SpringRequest['options'];
  readonly expectedTimeCorrection?: Record<string, number>;
}

interface TermBoundaryCase {
  readonly id: string;
  readonly termId: string;
  readonly termKstIso: string;
  readonly before: GoldenChartCase;
  readonly after: GoldenChartCase;
}

interface TimezoneCase {
  readonly id: string;
  readonly inputIso: string;
  readonly timezone: string;
  readonly expected: PillarExpectation;
}

interface Fixture {
  readonly schemaVersion: string;
  readonly sourceFixture: string;
  readonly zeroCorrectionPolicy: SpringRequest['options'];
  readonly solarTermBoundaryCases: readonly TermBoundaryCase[];
  readonly hourTransitionCases: readonly GoldenChartCase[];
  readonly timezoneNormalizationCases: readonly TimezoneCase[];
  readonly invalidIsoCases: readonly Array<{
    readonly id: string;
    readonly inputIso: string;
    readonly expectedMessageIncludes: string;
  }>;
  readonly longitudeNormalizationCases: readonly GoldenChartCase[];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const FIXTURE_PATH = path.resolve(SPRING_TS_ROOT, 'test/fixtures/boundary_chart_goldens.json');
const SOURCE_FIXTURE_PATH = path.resolve(SPRING_TS_ROOT, 'data/kasi-solar-terms/kasi_2026_24terms.json');
const POSITIONS: readonly PillarPosition[] = ['year', 'month', 'day', 'hour'];
const OFFSET_ISO_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?(Z|[+-]\d{2}:\d{2})$/;

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

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function pillarCode(summary: SajuSummary, position: PillarPosition): string {
  const pillar = summary.pillars?.[position];
  return `${pillar?.stem?.code ?? ''}-${pillar?.branch?.code ?? ''}`;
}

function pillarSnapshot(summary: SajuSummary): PillarExpectation {
  return {
    year: pillarCode(summary, 'year'),
    month: pillarCode(summary, 'month'),
    day: pillarCode(summary, 'day'),
    hour: pillarCode(summary, 'hour'),
  };
}

function parseOffsetIsoBirth(inputIso: string, timezone: string): BirthInfo {
  const match = inputIso.match(OFFSET_ISO_RE);
  if (!match) {
    throw new Error(`Boundary golden ISO must include a timezone offset: ${inputIso}`);
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    gender: 'male',
    timezone,
    calendarType: 'solar',
  };
}

function assertNear(label: string, actual: unknown, expected: number, tolerance: number): void {
  const numericActual = Number(actual);
  check(label,
    Number.isFinite(numericActual) && Math.abs(numericActual - expected) <= tolerance,
    `actual=${numericActual}, expected=${expected}, tolerance=${tolerance}`);
}

function assertExactTime(label: string, actual: unknown, expected: number): void {
  check(label, actual === expected, `actual=${String(actual)}, expected=${expected}`);
}

function assertTimeCorrection(
  label: string,
  summary: SajuSummary,
  expected: Record<string, number>,
): void {
  const timeCorrection = summary.timeCorrection as Record<string, unknown> | undefined;
  check(`${label}: timeCorrection exists`, !!timeCorrection);
  if (!timeCorrection) return;

  for (const [key, expectedValue] of Object.entries(expected)) {
    if (key.endsWith('Minutes')) {
      assertNear(`${label}: ${key}`, timeCorrection[key], expectedValue, 0.01);
    } else {
      assertExactTime(`${label}: ${key}`, timeCorrection[key], expectedValue);
    }
  }
}

function assertZeroCorrectionPreservesInput(label: string, summary: SajuSummary, birth: BirthInfo): void {
  assertTimeCorrection(label, summary, {
    standardYear: Number(birth.year),
    standardMonth: Number(birth.month),
    standardDay: Number(birth.day),
    standardHour: Number(birth.hour),
    standardMinute: Number(birth.minute),
    adjustedYear: Number(birth.year),
    adjustedMonth: Number(birth.month),
    adjustedDay: Number(birth.day),
    adjustedHour: Number(birth.hour),
    adjustedMinute: Number(birth.minute),
    longitudeCorrectionMinutes: 0,
    equationOfTimeMinutes: 0,
  });
}

async function runGoldenCase(
  golden: GoldenChartCase,
  options: SpringRequest['options'],
  expectZeroCorrection: boolean,
): Promise<SajuSummary> {
  const summary = await analyzeSaju(golden.birth, golden.options ?? options);
  const snapshot = pillarSnapshot(summary);

  check(`${golden.id}: chart has full pillars`,
    POSITIONS.every((position) => snapshot[position] !== '-'),
    JSON.stringify(snapshot));

  for (const position of POSITIONS) {
    check(`${golden.id}: ${position} pillar`,
      snapshot[position] === golden.expected[position],
      `actual=${snapshot[position]}, expected=${golden.expected[position]}`);
  }

  const context = buildSajuContext(summary);
  check(`${golden.id}: buildSajuContext surfaces day master`,
    typeof context.output?.dayMaster?.element === 'string' && context.output.dayMaster.element.length > 0);

  if (golden.expectedTimeCorrection) {
    assertTimeCorrection(golden.id, summary, golden.expectedTimeCorrection);
  } else if (expectZeroCorrection) {
    assertZeroCorrectionPreservesInput(golden.id, summary, golden.birth);
  }

  return summary;
}

console.log('Boundary chart golden regression\n');

const fixture = readJson<Fixture>(FIXTURE_PATH);
const sourceFixture = readJson<{ readonly terms: readonly Array<{ readonly id: string; readonly kind: string; readonly kstIso: string }> }>(SOURCE_FIXTURE_PATH);
const sourceTerms = new Map(sourceFixture.terms.map((term) => [term.id, term]));

check('fixture schema version is current',
  fixture.schemaVersion === 'spring-ts.boundary-chart-goldens.v1');
check('fixture references the KASI solar-term fixture',
  fixture.sourceFixture === 'data/kasi-solar-terms/kasi_2026_24terms.json');
check('source fixture still has 12 jie terms',
  sourceFixture.terms.filter((term) => term.kind === 'jie').length === 12);

const termResults = new Map<string, { before: SajuSummary; after: SajuSummary }>();
for (const termCase of fixture.solarTermBoundaryCases) {
  const sourceTerm = sourceTerms.get(termCase.termId);
  check(`${termCase.id}: source term exists`, !!sourceTerm);
  check(`${termCase.id}: source term KST instant is stable`,
    sourceTerm?.kstIso === termCase.termKstIso,
    `source=${sourceTerm?.kstIso ?? 'missing'}, fixture=${termCase.termKstIso}`);

  const before = await runGoldenCase(
    { ...termCase.before, id: `${termCase.id}-before` },
    fixture.zeroCorrectionPolicy,
    true,
  );
  const after = await runGoldenCase(
    { ...termCase.after, id: `${termCase.id}-after` },
    fixture.zeroCorrectionPolicy,
    true,
  );
  termResults.set(termCase.termId, { before, after });

  check(`${termCase.id}: month pillar changes across jie boundary`,
    pillarCode(before, 'month') !== pillarCode(after, 'month'),
    `${pillarCode(before, 'month')} -> ${pillarCode(after, 'month')}`);
}

const lichun = termResults.get('LICHUN');
check('LICHUN changes the saju year pillar as well as the month pillar',
  !!lichun &&
    pillarCode(lichun.before, 'year') === 'EUL-SA' &&
    pillarCode(lichun.after, 'year') === 'BYEONG-O',
  lichun ? `${pillarCode(lichun.before, 'year')} -> ${pillarCode(lichun.after, 'year')}` : 'missing');

const hourResults = new Map<string, SajuSummary>();
for (const hourCase of fixture.hourTransitionCases) {
  hourResults.set(hourCase.id, await runGoldenCase(hourCase, fixture.zeroCorrectionPolicy, true));
}
check('22:59 remains HAE and 23:00 enters JA',
  pillarCode(hourResults.get('late-night-2259-hae')!, 'hour').endsWith('-HAE') &&
    pillarCode(hourResults.get('late-night-2300-ja')!, 'hour').endsWith('-JA'));
check('00:00 advances the day pillar relative to 23:59',
  pillarCode(hourResults.get('late-night-2359-ja')!, 'day') !==
    pillarCode(hourResults.get('midnight-0000-next-day-ja')!, 'day'));
check('01:00 exits JA into CHUK',
  pillarCode(hourResults.get('midnight-0100-next-day-chuk')!, 'hour').endsWith('-CHUK'));

const timezoneResults = new Map<string, SajuSummary>();
for (const timezoneCase of fixture.timezoneNormalizationCases) {
  const birth = parseOffsetIsoBirth(timezoneCase.inputIso, timezoneCase.timezone);
  timezoneResults.set(timezoneCase.id, await runGoldenCase({
    id: timezoneCase.id,
    birth,
    expected: timezoneCase.expected,
  }, fixture.zeroCorrectionPolicy, true));
}
check('same instant after LICHUN has identical year/month in KST and UTC local inputs',
  pillarCode(timezoneResults.get('lichun-same-instant-kst')!, 'year') ===
    pillarCode(timezoneResults.get('lichun-same-instant-utc')!, 'year') &&
    pillarCode(timezoneResults.get('lichun-same-instant-kst')!, 'month') ===
      pillarCode(timezoneResults.get('lichun-same-instant-utc')!, 'month'));
check('same instant after LICHUN keeps local day/hour distinct by timezone',
  pillarCode(timezoneResults.get('lichun-same-instant-kst')!, 'day') !==
    pillarCode(timezoneResults.get('lichun-same-instant-utc')!, 'day') &&
    pillarCode(timezoneResults.get('lichun-same-instant-kst')!, 'hour') !==
      pillarCode(timezoneResults.get('lichun-same-instant-utc')!, 'hour'));
check('same instant before LICHUN has identical year/month in KST and UTC local inputs',
  pillarCode(timezoneResults.get('lichun-before-same-instant-kst')!, 'year') ===
    pillarCode(timezoneResults.get('lichun-before-same-instant-utc')!, 'year') &&
    pillarCode(timezoneResults.get('lichun-before-same-instant-kst')!, 'month') ===
      pillarCode(timezoneResults.get('lichun-before-same-instant-utc')!, 'month'));

for (const invalid of fixture.invalidIsoCases) {
  let message = '';
  try {
    parseOffsetIsoBirth(invalid.inputIso, 'Asia/Seoul');
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  check(`${invalid.id}: offset-less ISO input is rejected`,
    message.includes(invalid.expectedMessageIncludes),
    message);
}

for (const longitudeCase of fixture.longitudeNormalizationCases) {
  await runGoldenCase(longitudeCase, fixture.zeroCorrectionPolicy, false);
}

console.log(`\nBoundary chart goldens: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
