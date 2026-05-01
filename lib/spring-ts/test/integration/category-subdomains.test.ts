/**
 * test/integration/category-subdomains.test.ts
 *
 * Verifies PR-K-1 (PR-A) opt-in subDomains wire-up:
 *
 *   1. Default behavior (precisionConfig.surfaceSubDomains unset/false) →
 *      subDomains absent on every CategoryFortuneCard.
 *   2. surfaceSubDomains=true → each base card has 1-3 sub-domain rows
 *      drawn from saju_master/event_domain_map.py doctrine.
 *   3. Each sub-domain row carries name/title/stars/narrative.
 *   4. The "always" row per spec (§2 SUB_DOMAIN_PLAN) is always present.
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const NAMESPRING_DATA = path.resolve(SPRING_TS_ROOT, '../../namespring/public/data');
const WASM_PATH = path.resolve(SPRING_TS_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');

const originalFetch = globalThis.fetch;
(globalThis as any).fetch = async (url: string | URL | Request, options?: any) => {
  const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : '';
  if (urlStr.startsWith('/data/')) {
    const filePath = path.join(NAMESPRING_DATA, urlStr.replace('/data/', ''));
    if (!fs.existsSync(filePath)) return new Response(null, { status: 404 });
    return new Response(fs.readFileSync(filePath), { status: 200 });
  }
  if (urlStr.includes('sql-wasm.wasm') || urlStr === WASM_PATH) {
    return new Response(fs.readFileSync(WASM_PATH), { status: 200 });
  }
  return originalFetch(url as any, options);
};

import { SpringEngine } from '../../src/index.js';
import type { FortuneCategory } from '../../src/report/types.js';

const engine = new SpringEngine();
const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
for (const repo of repos) {
  if (!repo) continue;
  (repo as any).wasmUrl = WASM_PATH;
}
await engine.init();

const baseRequest = {
  birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' as const },
  surname: [{ hangul: '최', hanja: '崔' }],
  givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }],
};

const fortuneDefault = await engine.getFortuneReport(baseRequest);
const fortuneOptIn = await engine.getFortuneReport({
  ...baseRequest,
  options: { precisionConfig: { surfaceSubDomains: true } } as any,
});

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

console.log('PR-K-1 sub-domain wire-up\n');

const cats: FortuneCategory[] = ['wealth', 'health', 'academic', 'romance', 'family'];

// (1) default unchanged
for (const c of cats) {
  check(`default: ${c}.subDomains undefined`,
    fortuneDefault.categoryFortunes[c].subDomains === undefined);
}

// (2) opt-in surfaces 1-3 rows per card
const ALWAYS: Record<FortuneCategory, string> = {
  wealth: 'career',
  health: 'health_stress',
  academic: 'study_document',
  romance: 'expression_children',
  family: 'expression_children',
};

for (const c of cats) {
  const card = fortuneOptIn.categoryFortunes[c];
  const subs = card.subDomains;
  check(`opt-in: ${c}.subDomains populated`, Array.isArray(subs) && subs.length >= 1);
  check(`opt-in: ${c}.subDomains length 1-3`, !!subs && subs.length <= 3,
    subs ? `len=${subs.length}` : 'undefined');
  if (subs) {
    check(`opt-in: ${c}.subDomains[0].name === '${ALWAYS[c]}' (always row)`,
      subs[0]?.name === ALWAYS[c],
      subs.map((s) => s.name).join(','));
    for (const row of subs) {
      check(`opt-in: ${c}.${row.name} shape (title+stars+narrative)`,
        typeof row.title === 'string' && row.title.length > 0
          && typeof row.stars === 'number' && row.stars >= 1 && row.stars <= 5
          && typeof row.narrative === 'string' && row.narrative.length > 0);
    }
  }
}

engine.close();

console.log(`\nPR-K-1 sub-domains: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
