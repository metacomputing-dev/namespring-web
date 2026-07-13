import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const NAMESPRING_DATA = path.resolve(SPRING_TS_ROOT, '../../namespring/public/data');
const WASM_PATH = path.resolve(SPRING_TS_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url: string | URL | Request, options?: RequestInit) => {
  const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : '';
  if (urlString.startsWith('/data/')) {
    const filePath = path.join(NAMESPRING_DATA, urlString.slice('/data/'.length));
    if (!fs.existsSync(filePath)) return new Response(null, { status: 404 });
    return new Response(fs.readFileSync(filePath), { status: 200 });
  }
  if (urlString.includes('sql-wasm.wasm') || urlString === WASM_PATH) {
    return new Response(fs.readFileSync(WASM_PATH), { status: 200 });
  }
  return originalFetch(url as any, options);
};

import { analyzeSaju, buildSajuContext } from '../../src/saju-adapter.js';

const BIRTH = {
  year: 1986,
  month: 4,
  day: 19,
  hour: 5,
  minute: 45,
  gender: 'male',
} as const;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`adapter-richness-optins: ${message}`);
}

const base = await analyzeSaju(BIRTH);
assert(base.analysisStatus !== 'failed', 'default analysis must not use the empty fallback');
assert(base.palace === undefined, 'palace must be absent by default');
assert(base.naeum === undefined, 'naeum must be absent by default');

const optedIn = await analyzeSaju(BIRTH, {
  precisionConfig: { surfacePalace: true, surfaceNaeum: true },
});
assert(optedIn.analysisStatus !== 'failed', 'opt-in analysis must not use the empty fallback');
assert(optedIn.palace !== undefined, 'surfacePalace must expose palace output');
assert(optedIn.naeum !== undefined, 'surfaceNaeum must expose naeum output');

const positions = ['year', 'month', 'day', 'hour'] as const;
for (const position of positions) {
  const palace = optedIn.palace.positions[position];
  assert(palace !== undefined, `${position} palace must be present`);
  assert(palace.name.length > 0, `${position} palace name must be non-empty`);
  assert(
    palace.status === 'good' || palace.status === 'caution' || palace.status === 'normal',
    `${position} palace status must use the public enum`,
  );

  const naeum = optedIn.naeum.positions[position];
  assert(naeum !== undefined, `${position} naeum must be present`);
  assert(naeum.pillar.length === 2, `${position} naeum pillar must be a ganzhi pair`);
  assert(naeum.nameHanja.length > 0, `${position} naeum name must be non-empty`);
  assert(naeum.elementHanja.length > 0, `${position} naeum element must be non-empty`);
}

const elementCountTotal = Object.values(optedIn.naeum.elementCounts)
  .reduce((sum, count) => sum + count, 0);
assert(elementCountTotal === 4, 'naeum elementCounts must account for all four pillars');

const context = buildSajuContext(optedIn);
assert(context.output !== null, 'opt-in summary must remain scorable in buildSajuContext');
assert(context.output.palace === optedIn.palace, 'buildSajuContext must pass palace through');
assert(context.output.naeum === optedIn.naeum, 'buildSajuContext must pass naeum through');
assert(
  Object.values(context.output.palace.positions).filter(Boolean).length === 4,
  'context palace output must retain all four positions',
);
assert(
  Object.values(context.output.naeum.positions).filter(Boolean).length === 4,
  'context naeum output must retain all four positions',
);
assert(
  Object.values(context.output.naeum.elementCounts).reduce((sum, count) => sum + count, 0) === 4,
  'context naeum elementCounts must retain all four pillars',
);

console.log('adapter richness opt-ins: PASS');
