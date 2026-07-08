/**
 * test/integration/jonggyeok-authority-scaffold.test.ts
 *
 * PR-7/9 scaffold for jonggyeok authority intake.
 *
 * The authority corpus may contain either birth-time rows or pillar-only rows.
 * Public classical/chart sources usually publish four pillars without a
 * birth timestamp, so pillar-only rows are validated as sourced intake. Engine
 * match-rate promotion is enforced only after at least 20 birth-time rows are
 * available.
 *
 * Run: npm run test:jonggyeok-authority
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const NAMESPRING_DATA = path.resolve(SPRING_TS_ROOT, '../../namespring/public/data');
const WASM_PATH = path.resolve(SPRING_TS_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');

const originalFetch = globalThis.fetch;
(globalThis as any).fetch = async (url: any, options?: any) => {
  const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : '';
  if (urlStr.startsWith('/data/')) {
    const filePath = path.join(NAMESPRING_DATA, urlStr.replace('/data/', ''));
    if (!fs.existsSync(filePath)) return new Response(null, { status: 404 });
    return new Response(fs.readFileSync(filePath), { status: 200 });
  }
  if (urlStr.includes('sql-wasm.wasm') || urlStr.startsWith('https://sql.js.org/') || urlStr === WASM_PATH) {
    return new Response(fs.readFileSync(WASM_PATH), { status: 200 });
  }
  return originalFetch(url, options);
};

import { SpringEngine } from '../../src/index.js';

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

const AUTHORITY_TYPES = new Set([
  'CONG_CAI',
  'CONG_GUAN',
  'CONG_SHA',
  'CONG_ER',
  'CONG_YIN',
  'CONG_BI',
  'ZHUAN_WANG',
  'HUA_QI',
]);
const SOURCE_TIERS = new Set(['T3_AUTHORED_INTERPRETATION', 'T4_PRIMARY_TEXT', 'T5_OFFICIAL']);
const GANJI_RE = /^[\u7532\u4E59\u4E19\u4E01\u620A\u5DF1\u5E9A\u8F9B\u58EC\u7678][\u5B50\u4E11\u5BC5\u536F\u8FB0\u5DF3\u5348\u672A\u7533\u9149\u620C\u4EA5]$/u;

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function pillarTokens(value: unknown): string[] {
  if (typeof value === 'string') return value.trim().split(/\s+/).filter(Boolean);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return ['year', 'month', 'day', 'hour'].map((key) => String(obj[key] ?? '').trim());
  }
  return [];
}

function hasValidBirth(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const birth = value as Record<string, unknown>;
  return Number.isInteger(birth.year) &&
    Number.isInteger(birth.month) &&
    Number.isInteger(birth.day) &&
    Number.isInteger(birth.hour);
}

console.log('jonggyeok authority scaffold (PR-7/9)\n');

const engine = new SpringEngine();
for (const repo of [(engine as any).hanjaRepo, (engine as any).fourFrameRepo]) {
  if (repo) (repo as any).wasmUrl = WASM_PATH;
}
await engine.init();

const doctrinal = JSON.parse(fs.readFileSync(path.resolve(SPRING_TS_ROOT, 'test/fixtures/jonggyeok_cases.json'), 'utf-8'));
const jong04 = doctrinal.fixtures.find((f: any) => f.id === 'fix-jong-04');

const calibrated: any = await engine.getSajuReport({
  birth: jong04.birth,
  surname: jong04.surname,
  options: { precisionConfig: { sajuSchoolId: 'jonggyeok.calibrated' } } as any,
});
const calType = String(calibrated.gyeokgukResult?.type ?? calibrated.gyeokguk?.type ?? '');
check('calibrated threshold does not prematurely promote fix-jong-04 to CONG_*',
  !calType.startsWith('CONG_'),
  `type=${calType}`);
check('calibrated preset still produces a gyeokguk type',
  calType.length > 0);

const base: any = await engine.getSajuReport({ birth: jong04.birth, surname: jong04.surname });
const baseType = String(base.gyeokgukResult?.type ?? base.gyeokguk?.type ?? '');
check('default path keeps jonggyeok unselected for risk-only case',
  !baseType.startsWith('CONG_'),
  `type=${baseType}`);
check('default path still reports HIGH jonggyeok risk',
  (base.yongshin as any)?.jonggyeokRisk?.level === 'HIGH');

const authority = JSON.parse(fs.readFileSync(path.resolve(SPRING_TS_ROOT, 'test/fixtures/jonggyeok_authority_cases.json'), 'utf-8'));
check('authority corpus schema has _meta.intakeRequirements.sourceTier',
  !!authority._meta?.intakeRequirements?.sourceTier);
check('authority corpus schema has cases array',
  Array.isArray(authority.cases));
check('authority corpus has 20+ cases',
  Array.isArray(authority.cases) && authority.cases.length >= 20,
  `cases=${authority.cases?.length ?? 'n/a'}`);

let matched = 0;
let engineComparable = 0;
let pillarOnly = 0;

for (const c of authority.cases ?? []) {
  const tier = c?.sourceTier?.tier ?? '';
  const tokens = pillarTokens(c?.pillars);
  const validBirth = hasValidBirth(c?.birth);
  const validPillars = tokens.length === 4 && tokens.every((token) => GANJI_RE.test(token));

  check(`${c.id}: id and label are present`,
    isString(c?.id) && isString(c?.label));
  check(`${c.id}: expected jonggyeok type is supported`,
    AUTHORITY_TYPES.has(String(c?.expectedJonggyeokType ?? '')),
    String(c?.expectedJonggyeokType ?? ''));
  check(`${c.id}: expected yongshin element is present`,
    isString(c?.expectedYongshinElement),
    String(c?.expectedYongshinElement ?? ''));
  check(`${c.id}: sourceTier T3+ and authorityTruthEligible`,
    SOURCE_TIERS.has(tier) && c?.sourceTier?.authorityTruthEligible === true,
    tier);
  check(`${c.id}: sourceUrl is anchored`,
    typeof c?.sourceTier?.sourceUrl === 'string' && c.sourceTier.sourceUrl.startsWith('http'),
    String(c?.sourceTier?.sourceUrl ?? ''));
  check(`${c.id}: quoteShort is absent or short`,
    c?.sourceTier?.quoteShort == null || (typeof c.sourceTier.quoteShort === 'string' && c.sourceTier.quoteShort.length <= 80));
  check(`${c.id}: has birth or four pillar ganji`,
    validBirth || validPillars,
    validBirth ? 'birth' : tokens.join(' '));

  if (!validBirth) {
    if (validPillars) pillarOnly += 1;
    continue;
  }

  engineComparable += 1;
  const sj: any = await engine.getSajuReport({
    birth: c.birth,
    surname: c.surname ?? [{ hangul: '\uAE40', hanja: '\u91D1' }],
    options: { precisionConfig: { sajuSchoolId: 'jonggyeok.calibrated' } } as any,
  });
  const type = String(sj.gyeokgukResult?.type ?? sj.gyeokguk?.type ?? '');
  if (type.startsWith(String(c.expectedJonggyeokType))) matched += 1;
}

check('authority corpus currently includes pillar-only intake rows',
  pillarOnly > 0,
  `pillarOnly=${pillarOnly}`);

if (engineComparable >= 20) {
  const rate = matched / engineComparable;
  console.log(`  INFO calibrated engine match: ${matched}/${engineComparable} (${(rate * 100).toFixed(0)}%)`);
  check('promotion gate: 20+ engine-comparable rows have 80%+ calibrated match',
    rate >= 0.8);
} else {
  console.log(`  INFO calibrated engine match deferred: ${engineComparable} birth rows, ${pillarOnly} pillar-only rows`);
}

engine.close();

console.log(`\njonggyeok authority scaffold: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
