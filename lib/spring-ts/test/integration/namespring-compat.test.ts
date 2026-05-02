/**
 * test/integration/namespring-compat.test.ts
 *
 * PR-Q-27: NameSpring (consumer app) backward-compatibility contract.
 *
 * NameSpring (irumbom-poc) imports `SpringEngine` from `@spring/spring-engine`
 * (vite alias → `lib/spring-ts/src`). It calls these methods:
 *   - `springEngine.getSpringReport(request)` → SpringReport
 *   - `springEngine.getFortuneReport(request)` → FortuneReport
 *   - (other methods exist but NameSpring only uses these two paths)
 *
 * NameSpring's request **never includes `precisionConfig`** — it passes only
 * `birth`, `surname`, `givenName`, optional `sajuTimePolicy`. So this test
 * simulates that exact shape and asserts the response has all fields
 * NameSpring's UI components access (with the types they expect).
 *
 * Field inventory (manually surveyed 2026-05-01):
 *   FortuneReport: overviewSummary, lifeFortuneOverview, personality,
 *     strengthsWeaknesses, cautions, daily/weekly/monthly/yearlyFortune,
 *     categoryFortunes{wealth,health,academic,romance,family}{title,category,
 *     stars,summary,advice[{text,reason}],caution{signal,response,reason}},
 *     nameCompatibility, lifeStageFortune
 *   SpringReport: namingReport.name.{fullHangul,fullHanja}, rank
 *   SajuReport: pillars (with year/month/day/hour), dayMaster.polarity
 *
 * What this test asserts:
 *   1. Existing field shape preserved when NameSpring's "no-precisionConfig"
 *      request is run.
 *   2. Field types match what UI assumes (string title, number stars, array
 *      advice, etc.) — type guarantees so React doesn't crash on a field.
 *   3. New opt-in additions (subDomains, axisStrength, evidence, palace,
 *      naeum) that surface by default DO NOT break NameSpring's optional
 *      chaining + .filter(Boolean) patterns — i.e., either undefined or a
 *      non-throwing value.
 *
 * If this test ever fails, NameSpring's runtime UI is at risk. New default
 * flips that surface in NameSpring's view should land with NameSpring dev
 * coordination per `lib/spring-ts/FRONTEND_EXTENSIONS.md`.
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

const engine = new SpringEngine();
const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
for (const repo of repos) { if (repo) (repo as any).wasmUrl = WASM_PATH; }
await engine.init();

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

console.log('PR-Q-27 NameSpring backward-compat contract\n');

// NameSpring's exact call shape (no precisionConfig).
const namespringRequest = {
  birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' as const },
  surname: [{ hangul: '최', hanja: '崔' }],
  givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }],
  // No options — NameSpring may pass `{ sajuTimePolicy }` but never `precisionConfig`.
};

// ── (1) getSpringReport — namingReport surface ──────────────────────────
const springReport: any = await engine.getSpringReport(namespringRequest);
check(`SpringReport.namingReport defined`, springReport?.namingReport != null);
check(`SpringReport.namingReport.name.fullHangul is string`,
  typeof springReport?.namingReport?.name?.fullHangul === 'string');
check(`SpringReport.namingReport.name.fullHanja is string`,
  typeof springReport?.namingReport?.name?.fullHanja === 'string');
check(`SpringReport.schoolPreset is additive default metadata`,
  springReport?.schoolPreset?.selected === 'korean' &&
    springReport.schoolPreset.source === 'default' &&
    springReport.schoolPreset.scoringEffect === 'inactive');

// ── (2) getFortuneReport — full surface ─────────────────────────────────
const fortuneReport: any = await engine.getFortuneReport(namespringRequest);
const FORTUNE_SECTIONS = [
  'overviewSummary', 'lifeFortuneOverview', 'personality',
  'strengthsWeaknesses', 'cautions',
  'dailyFortune', 'weeklyFortune', 'monthlyFortune', 'yearlyFortune',
  'categoryFortunes', 'nameCompatibility', 'lifeStageFortune',
];
for (const section of FORTUNE_SECTIONS) {
  check(`FortuneReport.${section} present`, fortuneReport?.[section] != null);
}
const mixedBranchPattern = /[가-힣](JA|CHUK|IN|MYO|JIN|SA|O|MI|SIN|YU|SUL|HAE)\b/;
check(`FortuneReport.lifeStageFortune has no mixed Korean/romanized branch display`,
  !mixedBranchPattern.test(JSON.stringify(fortuneReport?.lifeStageFortune ?? {})));
check(`FortuneReport.meta.schoolPreset is additive default metadata`,
  fortuneReport?.meta?.schoolPreset?.selected === 'korean' &&
    fortuneReport.meta.schoolPreset.source === 'default' &&
    fortuneReport.meta.schoolPreset.scoringEffect === 'inactive');

// categoryFortunes 5 default categories (NameSpring's CATEGORY_ORDER)
const CATEGORIES = ['wealth', 'health', 'academic', 'romance', 'family'] as const;
for (const cat of CATEGORIES) {
  const card = fortuneReport.categoryFortunes?.[cat];
  check(`categoryFortunes.${cat}.title is string`,
    typeof card?.title === 'string' && card.title.length > 0);
  check(`categoryFortunes.${cat}.category === '${cat}'`, card?.category === cat);
  check(`categoryFortunes.${cat}.stars is number 1-5`,
    typeof card?.stars === 'number' && card.stars >= 1 && card.stars <= 5);
  check(`categoryFortunes.${cat}.summary is string`,
    typeof card?.summary === 'string');
  check(`categoryFortunes.${cat}.advice is array`,
    Array.isArray(card?.advice));
  // advice[i].text + advice[i].reason are accessed in JSX — must be string-shaped or undefined
  for (const advice of (card?.advice ?? []) as any[]) {
    check(`categoryFortunes.${cat}.advice[].text is string`,
      typeof advice?.text === 'string');
    check(`categoryFortunes.${cat}.advice[].reason is string`,
      typeof advice?.reason === 'string');
  }
  // caution is null OR object with {signal, response, reason}
  if (card?.caution) {
    check(`categoryFortunes.${cat}.caution.signal is string`,
      typeof card.caution.signal === 'string');
    check(`categoryFortunes.${cat}.caution.response is string`,
      typeof card.caution.response === 'string');
    check(`categoryFortunes.${cat}.caution.reason is string`,
      typeof card.caution.reason === 'string');
  }
}

// ── (3) New opt-in fields (PR-Q-15..#16) — additive, must not break ─────
//     NameSpring uses `{...item}` spread + JSX `item?.field`, so new fields
//     either undefined or non-throwing values are both safe.
for (const cat of CATEGORIES) {
  const card = fortuneReport.categoryFortunes?.[cat];
  // subDomains is now populated by default (PR-Q-16). Verify shape.
  if (card?.subDomains !== undefined) {
    check(`categoryFortunes.${cat}.subDomains (PR-K-1) is array`,
      Array.isArray(card.subDomains));
    if (Array.isArray(card.subDomains)) {
      for (const sub of card.subDomains as any[]) {
        check(`subDomains[].name is string`, typeof sub?.name === 'string');
        check(`subDomains[].title is string`, typeof sub?.title === 'string');
        check(`subDomains[].stars is number`, typeof sub?.stars === 'number');
        check(`subDomains[].narrative is string`, typeof sub?.narrative === 'string');
      }
    }
  }
  // axisStrength is optional; if present, must be record (not array, not number)
  if (card?.axisStrength !== undefined) {
    check(`categoryFortunes.${cat}.axisStrength is non-array record`,
      typeof card.axisStrength === 'object' && !Array.isArray(card.axisStrength));
  }
  // evidence is optional; if present, must be array of {axis, claim, ...}
  if (card?.evidence !== undefined) {
    check(`categoryFortunes.${cat}.evidence is array`,
      Array.isArray(card.evidence));
  }
}

// ── (4) SajuReport — pillars + dayMaster ────────────────────────────────
const sajuReport: any = await engine.getSajuReport(namespringRequest);
check(`SajuReport.pillars defined`, sajuReport?.pillars != null);
check(`SajuReport.pillars.year exists`, sajuReport?.pillars?.year != null);
check(`SajuReport.dayMaster defined`, sajuReport?.dayMaster != null);
check(`SajuReport.dayMaster.polarity is string`,
  typeof sajuReport?.dayMaster?.polarity === 'string');

// ── (5) Optional sajuTimePolicy passes through cleanly ──────────────────
const withTimePolicy = await engine.getSajuReport({
  ...namespringRequest,
  options: { sajuTimePolicy: { trueSolarTime: 'on' } },
});
check(`sajuTimePolicy.trueSolarTime='on' produces a saju report`,
  (withTimePolicy as any)?.pillars != null);

// ── (6) tieredMatrix is OPT-IN (negative assert) ────────────────────────
// NameSpring's request never sets `precisionConfig.surfaceTieredMatrix`.
// Without it, FortuneReport.tieredMatrix MUST be undefined so the
// existing card surface stays the only payload NameSpring sees.
check(`FortuneReport.tieredMatrix is undefined when surface flag absent`,
  fortuneReport?.tieredMatrix === undefined,
  typeof fortuneReport?.tieredMatrix);

// ── (7) tieredMatrix surfaces correctly when opt-in ────────────────────
// Sanity check that the new structure is well-formed when explicitly
// enabled — protects against future regressions where the flag fails to
// activate the matrix.
const tieredOn: any = await engine.getFortuneReport({
  ...namespringRequest,
  options: { precisionConfig: { surfaceTieredMatrix: true } },
});
check(`opt-in tieredMatrix is present`, tieredOn?.tieredMatrix != null);
if (tieredOn?.tieredMatrix) {
  const tm = tieredOn.tieredMatrix;
  check(`tieredMatrix.schemaVersion === 'spring-ts.tiered-matrix.v1'`,
    tm.schemaVersion === 'spring-ts.tiered-matrix.v1');
  check(`tieredMatrix.periods has 5 keys`,
    tm.periods && Object.keys(tm.periods).length === 5,
    `${Object.keys(tm.periods ?? {}).length}`);
  for (const period of ['life', 'today', 'thisWeek', 'thisMonth', 'thisYear']) {
    const p = tm.periods?.[period];
    check(`tieredMatrix.periods.${period} present`, p != null);
    check(`tieredMatrix.periods.${period}.byCategory has 10 keys`,
      p?.byCategory && Object.keys(p.byCategory).length === 10,
      `${Object.keys(p?.byCategory ?? {}).length}`);
  }
  check(`tieredMatrix.glossary.entries has anchor entries`,
    tm.glossary?.entries && Object.keys(tm.glossary.entries).length >= 50,
    `${Object.keys(tm.glossary?.entries ?? {}).length}`);
}

engine.close();

console.log(`\nNameSpring compat: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
