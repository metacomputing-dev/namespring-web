// Phase 3 agent A3 — capture choi-seongsoo academic tieredMatrix snapshot.
// Run from lib/spring-ts: npx tsx artifacts/phase3-agent-a3/snapshot_choi_academic.ts <out_path>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SpringEngine } from '../../src/index.js';

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
  if (originalFetch) return originalFetch(url, options);
  throw new Error(`fetch unavailable for ${urlStr}`);
};

const TARGET_DATE = '2026-05-05T00:00:00+09:00';

const request: any = {
  targetDate: TARGET_DATE,
  birth: {
    year: 1986,
    month: 4,
    day: 19,
    hour: 5,
    minute: 45,
    gender: 'male' as const,
    calendarType: 'solar' as const,
    region: '서울',
    birthPlace: '서울',
  },
  surname: [{ hangul: '최', hanja: '崔' }],
  givenName: [
    { hangul: '성', hanja: '成' },
    { hangul: '수', hanja: '秀' },
  ],
  options: {
    sajuTimePolicy: {
      yaza: 'on',
      yazaMode: '23:00',
      trueSolarTime: 'on',
      longitudeCorrection: 'on',
    },
  },
  precisionConfig: {
    surfaceTieredMatrix: true,
  },
};

const engine = new SpringEngine();
const response = await engine.getFortuneReport(request);

const matrix = (response as any)?.tieredMatrix;
if (!matrix) {
  console.error('No tieredMatrix in response');
  process.exit(1);
}

const acAll: Record<string, any> = {};
for (const period of Object.keys(matrix.periods || {})) {
  const cat = matrix.periods[period]?.byCategory?.academic;
  if (cat) {
    acAll[period] = {
      meaningfulness: cat.meaningfulness,
      stars: cat.stars,
      brief: cat.brief,
      standard: cat.standard,
      expert: cat.expert,
      selectedFragments: cat.selectedFragments,
    };
  }
}

const outPath = process.argv[2] || path.join(__dirname, 'choi-academic-snapshot.json');
fs.writeFileSync(outPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  targetDate: TARGET_DATE,
  fixture: 'choi-seongsoo-1986-04-19',
  scope: 'tieredMatrix.periods.{life,today,thisWeek,thisMonth,thisYear}.byCategory.academic',
  academic: acAll,
}, null, 2), 'utf-8');

console.error(`Wrote ${outPath}`);
