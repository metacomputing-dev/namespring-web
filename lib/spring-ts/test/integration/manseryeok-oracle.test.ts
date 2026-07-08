/**
 * test/integration/manseryeok-oracle.test.ts
 *
 * Compares spring-ts day pillars against a KASI-derived day-pillar oracle.
 * Every case is evaluated at 12:00 KST to avoid midnight / yaza boundary
 * ambiguity; this test checks the calendar day-pillar axis only.
 *
 * Run: npx tsx test/integration/manseryeok-oracle.test.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { analyzeSaju } from '../../src/saju-adapter.js';
import type { BirthInfo, SajuSummary } from '../../src/types.js';

interface SourceTierBlock {
  readonly tier: string;
  readonly sourceUrl: string | null;
  readonly authorityTruthEligible: boolean;
}

interface OracleCase {
  readonly id: string;
  readonly solar: string;
  readonly expectedDayPillar: string;
  readonly source: string;
  readonly sourceTier: SourceTierBlock;
}

interface OracleFixture {
  readonly _meta: {
    readonly schemaVersion: string;
    readonly sourceUrl: string;
    readonly totalCases: number;
    readonly sourceTier: SourceTierBlock;
  };
  readonly cases: readonly OracleCase[];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const FIXTURE_PATH = path.resolve(SPRING_TS_ROOT, 'test/fixtures/manseryeok_oracle_cases.json');
const SOLAR_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const GANJI_RE = /^[\u7532\u4E59\u4E19\u4E01\u620A\u5DF1\u5E9A\u8F9B\u58EC\u7678][\u5B50\u4E11\u5BC5\u536F\u8FB0\u5DF3\u5348\u672A\u7533\u9149\u620C\u4EA5]$/u;

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

function dayPillar(summary: SajuSummary): string {
  return `${summary.pillars?.day?.stem?.hanja ?? ''}${summary.pillars?.day?.branch?.hanja ?? ''}`;
}

function birthFromSolar(solar: string): BirthInfo {
  const match = solar.match(SOLAR_RE);
  if (!match) throw new Error(`Invalid solar date: ${solar}`);
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: 12,
    minute: 0,
    gender: 'male',
    calendarType: 'solar',
    timezone: 'Asia/Seoul',
  };
}

console.log('manseryeok oracle day-pillar regression\n');

const fixture = readJson<OracleFixture>(FIXTURE_PATH);
check('fixture schema version is current',
  fixture._meta?.schemaVersion === 'spring-ts.manseryeok-oracle-fixture.v1');
check('fixture has 300-600 cases',
  Array.isArray(fixture.cases) && fixture.cases.length >= 300 && fixture.cases.length <= 600,
  `cases=${fixture.cases?.length ?? 'n/a'}`);
check('meta totalCases matches cases length',
  fixture._meta?.totalCases === fixture.cases.length,
  `meta=${fixture._meta?.totalCases}, cases=${fixture.cases.length}`);
check('meta sourceTier is official KASI authority',
  fixture._meta?.sourceTier?.tier === 'T5_OFFICIAL' && fixture._meta.sourceTier.authorityTruthEligible === true,
  String(fixture._meta?.sourceTier?.sourceUrl ?? ''));

const ids = new Set(fixture.cases.map((row) => row.id));
const solars = new Set(fixture.cases.map((row) => row.solar));
check('case ids are unique', ids.size === fixture.cases.length);
check('case solar dates are unique', solars.size === fixture.cases.length);
check('every case has sourceTier block and day-pillar ganji',
  fixture.cases.every((row) =>
    row.source === 'KASI' &&
    row.sourceTier?.tier === 'T5_OFFICIAL' &&
    row.sourceTier.authorityTruthEligible === true &&
    typeof row.sourceTier.sourceUrl === 'string' &&
    row.sourceTier.sourceUrl.startsWith('https://astro.kasi.re.kr/') &&
    SOLAR_RE.test(row.solar) &&
    GANJI_RE.test(row.expectedDayPillar)),
  `cases=${fixture.cases.length}`);

const mismatches: Array<{ id: string; solar: string; expected: string; actual: string }> = [];
for (const row of fixture.cases) {
  const summary = await analyzeSaju(birthFromSolar(row.solar));
  const actual = dayPillar(summary);
  if (actual !== row.expectedDayPillar) {
    mismatches.push({ id: row.id, solar: row.solar, expected: row.expectedDayPillar, actual });
  }
}

check('all KASI oracle day pillars match analyzeSaju at 12:00 KST',
  mismatches.length === 0,
  mismatches.slice(0, 10).map((m) => `${m.id}: expected=${m.expected}, actual=${m.actual}`).join('; '));
console.log(`  INFO oracle matched ${fixture.cases.length - mismatches.length}/${fixture.cases.length}`);

console.log(`\nmanseryeok oracle: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
