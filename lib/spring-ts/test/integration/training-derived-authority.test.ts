/**
 * test/integration/training-derived-authority.test.ts
 *
 * PR-Q-21 (Phase L-6) — verify training-derived authority cases are
 * schema-conformant and pillar-consistent with the engine.
 *
 * 6 cases under test/baseline/authority/training_derived/ are AI-derived
 * from classical 명리학 training knowledge (NOT citation-anchored). Each
 * case declares a birth date that should produce the documented pillar
 * configuration when run through saju-ts default chengbai_strict mode.
 *
 * What is asserted:
 *   1. All 6 case files exist and parse as valid JSON.
 *   2. Each case has source.kind === 'training_derived' (provenance flag).
 *   3. Each case's birth.birth_date_iso, when run through saju-ts, produces
 *      the documented year_pillar/month_pillar/day_pillar/hour_pillar.
 *   4. Each case has non-empty doctrineNotes / gyeokguk_basis fields.
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const NAMESPRING_DATA = path.resolve(SPRING_TS_ROOT, '../../namespring/public/data');
const WASM_PATH = path.resolve(SPRING_TS_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');
const TD_DIR = path.resolve(SPRING_TS_ROOT, 'test/baseline/authority/training_derived');

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

const engine = new SpringEngine();
const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
for (const repo of repos) { if (repo) (repo as any).wasmUrl = WASM_PATH; }
await engine.init();

const files = fs.readdirSync(TD_DIR).filter((f) => f.endsWith('.json'));

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

console.log('PR-Q-21 (Phase L-6) training-derived authority cases\n');

check(`6 case files exist`, files.length === 6, `found=${files.length}`);

for (const f of files) {
  const data = JSON.parse(fs.readFileSync(path.join(TD_DIR, f), 'utf-8'));

  check(`${f}: source.kind === 'training_derived'`,
    data.source?.kind === 'training_derived');
  check(`${f}: verificationStatus === 'pending_book_check'`,
    data.verificationStatus === 'pending_book_check');
  check(`${f}: doctrine_basis non-empty`,
    typeof data.source?.doctrine_basis === 'string' && data.source.doctrine_basis.length >= 20);
  check(`${f}: expected.gyeokguk_basis non-empty`,
    typeof data.expected?.gyeokguk_basis === 'string' && data.expected.gyeokguk_basis.length >= 20);

  const bd = data.birth?.birth_date_iso;
  if (typeof bd !== 'string') {
    check(`${f}: birth_date_iso present`, false);
    continue;
  }
  const m = bd.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):/);
  if (!m) {
    check(`${f}: birth_date_iso parsable`, false, bd);
    continue;
  }
  const [, year, month, day, hour, minute] = m.map(Number);
  const sj: any = await engine.getSajuReport({
    birth: {
      year, month, day, hour, minute,
      gender: data.birth?.gender === 'female' ? 'female' : 'male',
    },
    surname: [{ hangul: '김', hanja: '金' }],
  });
  const p = sj.pillars ?? {};
  const enginePillars: Record<string, string> = {
    year_pillar: `${p.year?.stem?.hanja}${p.year?.branch?.hanja}`,
    month_pillar: `${p.month?.stem?.hanja}${p.month?.branch?.hanja}`,
    day_pillar: `${p.day?.stem?.hanja}${p.day?.branch?.hanja}`,
    hour_pillar: `${p.hour?.stem?.hanja}${p.hour?.branch?.hanja}`,
  };

  for (const k of ['year_pillar', 'month_pillar', 'day_pillar', 'hour_pillar']) {
    check(`${f}: ${k} matches engine`,
      data.birth[k] === enginePillars[k],
      `expected=${data.birth[k]} / actual=${enginePillars[k]}`);
  }
}

engine.close();

console.log(`\nTraining-derived authority: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
