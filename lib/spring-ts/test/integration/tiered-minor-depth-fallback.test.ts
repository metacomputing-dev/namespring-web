/**
 * tiered-minor-depth-fallback.test.ts
 *
 * Minors must not receive adult fallback prose, but meaningful cells still
 * need usable standard/expert depth payloads so progressive-disclosure UI
 * panels never open into blank content.
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

const PERIODS = ['life', 'today', 'thisWeek', 'thisMonth', 'thisYear'] as const;
const CATEGORIES = [
  'wealth', 'health', 'academic', 'romance', 'family',
  'career', 'study_document', 'expression_children', 'health_stress', 'movement',
] as const;

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

function cellRows(tm: any): Array<{ key: string; cell: any }> {
  const rows: Array<{ key: string; cell: any }> = [];
  for (const period of PERIODS) {
    const p = tm?.periods?.[period];
    rows.push({ key: `${period}.overall`, cell: p?.overall });
    for (const category of CATEGORIES) {
      rows.push({ key: `${period}.${category}`, cell: p?.byCategory?.[category] });
    }
  }
  return rows;
}

function tagTokens(paragraphs: any[]): any[] {
  return paragraphs.flatMap((paragraph) => Array.isArray(paragraph?.tokens)
    ? paragraph.tokens.filter((token: any) => token?.kind === 'tag')
    : []);
}

const engine = new SpringEngine();
const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
for (const repo of repos) { if (repo) (repo as any).wasmUrl = WASM_PATH; }
await engine.init();

console.log('Tiered minor depth fallback\n');

const report: any = await engine.getFortuneReport({
  targetDate: new Date('2026-05-04T12:00:00+09:00'),
  birth: {
    year: 2013,
    month: 7,
    day: 21,
    hour: 14,
    minute: 20,
    gender: 'female',
    calendarType: 'solar',
    region: '부산',
    birthPlace: '부산',
  },
  surname: [{ hangul: '김', hanja: '金' }],
  givenName: [
    { hangul: '서', hanja: '瑞' },
    { hangul: '윤', hanja: '潤' },
  ],
  options: { precisionConfig: { surfaceTieredMatrix: true } },
});

const tm = report?.tieredMatrix;
const rows = cellRows(tm);
const supportedRows = rows.filter(({ cell }) =>
  cell?.meaningfulness === 'meaningful' || cell?.meaningfulness === 'limited');
const rowsMissingStandard = supportedRows
  .filter(({ cell }) => !Array.isArray(cell?.standard?.paragraphs) || cell.standard.paragraphs.length === 0)
  .map((row) => row.key);
const rowsMissingExpert = supportedRows
  .filter(({ cell }) => !Array.isArray(cell?.expert?.paragraphs) || cell.expert.paragraphs.length === 0)
  .map((row) => row.key);
const rowsMissingExpertTags = supportedRows
  .filter(({ cell }) => tagTokens(cell?.expert?.paragraphs ?? []).length === 0)
  .map((row) => row.key);

check('tiered matrix is surfaced for minor sample', tm?.schemaVersion === 'spring-ts.tiered-matrix.v1');
check('meaningful or limited minor cells exist', supportedRows.length > 0, String(supportedRows.length));
check('meaningful or limited minor cells keep standard detail',
  rowsMissingStandard.length === 0, rowsMissingStandard.join(','));
check('meaningful or limited minor cells keep expert detail',
  rowsMissingExpert.length === 0, rowsMissingExpert.join(','));
check('minor expert detail is tagged for expert UI',
  rowsMissingExpertTags.length === 0, rowsMissingExpertTags.join(','));

engine.close();
console.log(`\nTiered minor depth fallback: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
