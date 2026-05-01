/**
 * test/integration/kasi-solar-terms.test.ts
 *
 * Verifies the KASI 24-solar-term fixture and compares the local solar-term
 * solver plus spring-ts's day-level jie approximation against that fixture.
 *
 * Run: npm run test:kasi-solar
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { JIE_MONTH_BOUNDARY_DAY } from '../../src/report/common/fortuneCalculator.js';

interface KasiSolarTermFixture {
  readonly _meta: {
    readonly schemaVersion: string;
    readonly year: number;
    readonly timezone: string;
    readonly totalTerms: number;
    readonly jieTerms: number;
    readonly zhongTerms: number;
    readonly allowedEngineErrorMinutes: number;
    readonly aspirationalErrorMinutes: number;
    readonly allowedSpringApproxDayErrorDays: number;
    readonly dataGoKrCrossCheck?: { readonly status?: string };
    readonly sourceTier?: {
      readonly tier?: string;
      readonly authorityTruthEligible?: boolean;
    };
  };
  readonly terms: readonly KasiSolarTerm[];
}

interface KasiSolarTerm {
  readonly id: string;
  readonly name: string;
  readonly hanja: string;
  readonly kind: 'jie' | 'zhong';
  readonly branch: string | null;
  readonly degree: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly kstIso: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const FIXTURE_PATH = path.resolve(SPRING_TS_ROOT, 'data/kasi-solar-terms/kasi_2026_24terms.json');
const SAJU_TS_SOLAR_TERMS = path.resolve(SPRING_TS_ROOT, '../saju-ts/src/calendar/solarTerms.ts');
const MS_PER_MINUTE = 60_000;

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

function readFixture(): KasiSolarTermFixture {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8')) as KasiSolarTermFixture;
}

function maxAbs(values: readonly number[]): number {
  return values.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
}

console.log('KASI 24 solar-term fixture regression\n');

const fixture = readFixture();
const terms = fixture.terms;

check('fixture schema version is current',
  fixture._meta.schemaVersion === 'spring-ts.kasi-solar-terms-fixture.v1');
check('fixture is for target year 2026', fixture._meta.year === 2026);
check('fixture has 24 terms split into 12 jie and 12 zhong',
  terms.length === 24 &&
    fixture._meta.totalTerms === 24 &&
    fixture._meta.jieTerms === 12 &&
    fixture._meta.zhongTerms === 12);
check('fixture uses explicit KST ISO instants',
  terms.every((term) => term.kstIso.endsWith('+09:00')) &&
    fixture._meta.timezone.includes('KST'));
check('calendarData fixture is not authority-truth eligible',
  fixture._meta.sourceTier?.tier === 'T5_OFFICIAL' &&
    fixture._meta.sourceTier?.authorityTruthEligible === false);
check('data.go.kr cross-check status is explicit',
  typeof fixture._meta.dataGoKrCrossCheck?.status === 'string',
  `status=${fixture._meta.dataGoKrCrossCheck?.status ?? 'missing'}`);
check('allowed error policy is explicit',
  fixture._meta.allowedEngineErrorMinutes === 10 &&
    fixture._meta.aspirationalErrorMinutes === 2 &&
    fixture._meta.allowedSpringApproxDayErrorDays === 1);

const sajuSolarTerms = await import(pathToFileURL(SAJU_TS_SOLAR_TERMS).href) as {
  solarTermUtcMsForLongitude: (
    year: number,
    longitude: number,
    method: 'meeus',
    algorithm?: 'bisection' | 'newton',
    aberrationModel?: 'constant',
    solarPrecision?: 'classical',
  ) => number;
};

const deltas = terms.map((term) => {
  const expectedMs = new Date(term.kstIso).getTime();
  const computedMs = sajuSolarTerms.solarTermUtcMsForLongitude(
    fixture._meta.year,
    term.degree,
    'meeus',
    'bisection',
    'constant',
    'classical',
  );
  return {
    id: term.id,
    name: term.name,
    deltaMinutes: (computedMs - expectedMs) / MS_PER_MINUTE,
  };
});

const engineOffenders = deltas.filter(
  (delta) => Math.abs(delta.deltaMinutes) > fixture._meta.allowedEngineErrorMinutes,
);
const aspirationalCount = deltas.filter(
  (delta) => Math.abs(delta.deltaMinutes) <= fixture._meta.aspirationalErrorMinutes,
).length;

check('saju-ts solar-term solver stays within KASI baseline envelope',
  engineOffenders.length === 0,
  `maxAbsDeltaMinutes=${maxAbs(deltas.map((delta) => delta.deltaMinutes)).toFixed(3)}, aspirational=${aspirationalCount}/24`);

const jieDayOffenders = terms
  .filter((term) => term.kind === 'jie')
  .map((term) => {
    const springApproxDay = JIE_MONTH_BOUNDARY_DAY[term.month];
    return {
      id: term.id,
      name: term.name,
      month: term.month,
      kasiDay: term.day,
      springApproxDay,
      deltaDays: springApproxDay === undefined ? Number.POSITIVE_INFINITY : Math.abs(springApproxDay - term.day),
    };
  })
  .filter((delta) => delta.deltaDays > fixture._meta.allowedSpringApproxDayErrorDays);

check('spring-ts jie day approximation stays within KASI day envelope',
  jieDayOffenders.length === 0,
  jieDayOffenders.length === 0 ? 'maxAllowedDeltaDays=1' : JSON.stringify(jieDayOffenders));

console.log(`\nKASI solar-term check: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
