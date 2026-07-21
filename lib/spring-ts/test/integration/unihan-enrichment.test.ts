/**
 * test/integration/unihan-enrichment.test.ts
 *
 * Verifies Phase 2 PR-2.3 Unihan metadata overlay.
 *
 * Run: npm run test:unihan
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SpringEngine,
  getEnrichedStrokeCount,
  getRadicalElementHint,
  getUnihanMetadata,
} from '../../src/index.js';

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
  if (originalFetch) return originalFetch(url as any, options);
  throw new Error(`fetch unavailable for ${urlStr}`);
};

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

function readJson<T = any>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(SPRING_TS_ROOT, relativePath), 'utf-8')) as T;
}

console.log('Phase 2 Unihan enrichment\n');

const metadata = readJson('data/unihan-hanja-metadata.json');
const sources = readJson('data/sources/unihan.sources.json');
const sourceIds = new Set((sources.sources ?? []).map((row: any) => row.id));

check('metadata schema is current',
  metadata.schemaVersion === 'spring-ts.unihan-hanja-metadata.v1');
check('metadata source tier is official Unicode',
  metadata.sourceTier?.tier === 'T5_OFFICIAL' &&
    metadata.sourceTier?.authorityTruthEligible === true);
check('metadata scopes official tier away from radical hints',
  metadata.sourceTierScope?.excludesFields?.includes('entries[].radicalElementHint') &&
    metadata.derivedFieldSourceTiers?.['entries[].radicalElementHint']?.tier === 'T3_AUTHORED_INTERPRETATION' &&
    metadata.derivedFieldSourceTiers?.['entries[].radicalElementHint']?.authorityTruthEligible === false);
check('source registry includes official UAX and UCD records',
  sourceIds.has('unicode_uax38_unihan_17_0_0') &&
    sourceIds.has('unicode_ucd_unihan_zip_17_0_0') &&
    sources.sources.filter((row: any) =>
      row.sourceTier?.tier === 'T5_OFFICIAL' &&
      row.sourceTier?.authorityTruthEligible === true).length >= 2);
check('radical hint policy is non-authority',
  sources.sources.some((row: any) =>
    row.id === 'radical_element_hint_policy' &&
    row.sourceTier?.tier === 'T3_AUTHORED_INTERPRETATION' &&
    row.sourceTier?.sourceUrl === null &&
    row.sourceTier?.authorityTruthEligible === false));
check('Unihan overlay covers current local legal pool rows',
  metadata.coverage.localLegalPoolRows === 9495 &&
    metadata.coverage.entriesWithUnihanMetadata === 9090);
check('Unihan total strokes resolve most local zero-stroke rows',
  metadata.coverage.localZeroStrokeCount === 198 &&
    metadata.coverage.zeroStrokeResolvedByUnihan === 197);

const ga = getUnihanMetadata('佳');
check('佳 has kRSUnicode radical/stroke metadata',
  ga?.radicalNumber === 9 &&
    ga?.residualStrokes === 6 &&
    ga?.totalStrokes === 8 &&
    ga.kRSUnicode.includes('9.6'),
  JSON.stringify(ga));

const water = getRadicalElementHint('水');
check('水 exposes radicalElementHint as a hint',
    water?.element === 'Water' &&
    water?.radicalNumber === 85 &&
    water?.confidence === 'hint' &&
    water?.sourceTier === 'T3_AUTHORED_INTERPRETATION' &&
    water?.sourceRegistryId === 'radical_element_hint_policy' &&
    water?.authorityTruthEligible === false,
  JSON.stringify(water));

const originalWaterElement = water?.element;
let hintMutationRejected = false;
try {
  (water as any).element = 'Fire';
} catch {
  hintMutationRejected = true;
}
check('radicalElementHint rejects mutation without polluting later lookups',
  hintMutationRejected &&
    !!water &&
    Object.isFrozen(water) &&
    getRadicalElementHint('\u6C34')?.element === originalWaterElement);

const metal = getRadicalElementHint('金');
check('金 exposes Metal radical hint',
  metal?.element === 'Metal' && metal?.radicalNumber === 167,
  JSON.stringify(metal));

const country = getUnihanMetadata('国');
check('Unihan variant links include 国 -> 國 traditional mapping',
  country?.variants?.traditional?.includes('U+570B') ?? false,
  JSON.stringify(country?.variants));

const countryOrthodox = getUnihanMetadata('\u570B');
check('Unihan variant links include U+570B -> U+56FD simplified mapping',
  countryOrthodox?.variants?.simplified?.includes('U+56FD') ?? false,
  JSON.stringify(countryOrthodox?.variants));

const gaCompact = getUnihanMetadata('\u4F73');
check('Unihan entries without variants stay compact',
  !!gaCompact && !('variants' in gaCompact),
  JSON.stringify(gaCompact));

check('Unihan metadata is deeply frozen before publication',
  !!gaCompact &&
    Object.isFrozen(gaCompact) &&
    Object.isFrozen(gaCompact.kRSUnicode) &&
    !!countryOrthodox?.variants &&
    Object.isFrozen(countryOrthodox.variants) &&
    !!countryOrthodox.variants.simplified &&
    Object.isFrozen(countryOrthodox.variants.simplified));

const originalGaStrokes = gaCompact?.totalStrokes;
let rootMutationRejected = false;
try {
  (gaCompact as any).totalStrokes = 999;
} catch {
  rootMutationRejected = true;
}
check('Unihan root mutation is rejected without polluting later lookups',
  rootMutationRejected &&
    getUnihanMetadata('\u4F73')?.totalStrokes === originalGaStrokes &&
    getEnrichedStrokeCount('\u4F73', 0) === originalGaStrokes);

const originalSimplifiedLinks = [...(countryOrthodox?.variants?.simplified ?? [])];
let nestedMutationRejected = false;
try {
  (countryOrthodox?.variants?.simplified as string[]).push('U+0000');
} catch {
  nestedMutationRejected = true;
}
check('Unihan nested mutation is rejected without polluting later lookups',
  nestedMutationRejected &&
    JSON.stringify(getUnihanMetadata('\u570B')?.variants?.simplified) ===
      JSON.stringify(originalSimplifiedLinks));

check('enriched stroke count fills local zero strokes',
  getEnrichedStrokeCount('一', 0) === 1);
check('enriched stroke count preserves positive local strokes',
  getEnrichedStrokeCount('㒃', 12) === 12);

const engine: any = new SpringEngine();
engine.hanjaRepo = {
  findByHanja: async () => null,
  findByHangul: async () => [],
};
const resolved = await engine.resolveFixedCharPool(
  { hangul: '일', hanja: '一' },
  'inmyeongyong_full',
);
check('full pool includes rows resolved from local zero stroke count',
  resolved[0]?.hanja === '一' && resolved[0]?.strokes === 1,
  JSON.stringify(resolved[0]));

const reportEngine = new SpringEngine();
const repos: any[] = [(reportEngine as any).hanjaRepo, (reportEngine as any).fourFrameRepo];
for (const repo of repos) {
  if (!repo) continue;
  repo.wasmUrl = WASM_PATH;
}
await reportEngine.init();
const report = await reportEngine.analyze({
  birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' },
  surname: [{ hangul: '최', hanja: '崔' }],
  givenName: [{ hangul: '수', hanja: '水' }],
  mode: 'evaluate',
});
const waterDetail = report.candidates[0]?.name.givenName[0] as any;
check('CharDetail surfaces radicalElementHint',
  waterDetail?.radicalElementHint?.element === 'Water' &&
    waterDetail?.unihan?.totalStrokes === 4,
  JSON.stringify(waterDetail?.radicalElementHint));
const reportStrokeCount = waterDetail?.unihan?.totalStrokes;
let reportMutationRejected = false;
try {
  waterDetail.unihan.totalStrokes = 999;
} catch {
  reportMutationRejected = true;
}
check('published CharDetail cannot mutate the shared Unihan registry',
  reportMutationRejected &&
    waterDetail?.unihan?.totalStrokes === reportStrokeCount &&
    getUnihanMetadata(waterDetail?.unihan?.hanja)?.totalStrokes === reportStrokeCount);
reportEngine.close();

console.log(`\nUnihan enrichment: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
