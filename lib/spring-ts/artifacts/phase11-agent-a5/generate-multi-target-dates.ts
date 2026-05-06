// Generate three tieredMatrix outputs for the same Choi Seongsoo input but
// across three different targetDates, to verify the fragment selector produces
// meaningfully different prose driven by different selectionSeeds.
//
// Run: npx tsx artifacts/phase11-agent-a5/generate-multi-target-dates.ts
// Outputs: artifacts/phase11-agent-a5/multi-target-{2026-05-05,2026-08-15,2027-02-04}.json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SpringEngine } from '../../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const NAMESPRING_DATA = path.resolve(SPRING_TS_ROOT, '../../namespring/public/data');
const WASM_PATH = path.resolve(SPRING_TS_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');
const OUT_DIR = __dirname;

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

const choiSeongsooBirth = {
  year: 1986,
  month: 4,
  day: 19,
  hour: 5,
  minute: 45,
  gender: 'male' as const,
  calendarType: 'solar' as const,
  region: '서울',
  birthPlace: '서울',
};

const choiSeongsooName = {
  surname: [{ hangul: '최', hanja: '崔' }],
  givenName: [
    { hangul: '성', hanja: '成' },
    { hangul: '수', hanja: '秀' },
  ],
};

const targetDates = [
  '2026-05-05T00:00:00+09:00',
  '2026-08-15T00:00:00+09:00',
  '2027-02-04T00:00:00+09:00',
];

const engine = new SpringEngine();
const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
for (const repo of repos) { if (repo) (repo as any).wasmUrl = WASM_PATH; }
await engine.init();

const summaries: any[] = [];
for (const td of targetDates) {
  const tag = td.slice(0, 10);
  const out: any = await engine.getFortuneReport({
    targetDate: td,
    birth: choiSeongsooBirth,
    ...choiSeongsooName,
    options: {
      sajuTimePolicy: { yaza: 'on', yazaMode: '23:00', trueSolarTime: 'on', longitudeCorrection: 'on' },
      precisionConfig: { surfaceTieredMatrix: true },
    },
  });
  const seed = out?.tieredMatrix?.meta?.selectionSeed ?? null;
  const fileName = `multi-target-${tag}.json`;
  fs.writeFileSync(
    path.join(OUT_DIR, fileName),
    JSON.stringify({ targetDate: td, seed, tieredMatrix: out.tieredMatrix }, null, 2),
  );
  summaries.push({ targetDate: td, seed, fileName });
  console.log(`Wrote ${fileName} seed=${seed}`);
}

engine.close();

fs.writeFileSync(
  path.join(OUT_DIR, 'multi-target-index.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), summaries }, null, 2),
);
console.log('Done.');
