/**
 * test/integration/tiered-progressive-disclosure.test.ts
 *
 * Verifies the runtime UI contract: brief/standard stay plain, while expert
 * detail carries glossary tags and source-tiered numeric evidence.
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

function paragraphTokens(paragraphs: any[]): any[] {
  return paragraphs.flatMap((paragraph) => Array.isArray(paragraph?.tokens) ? paragraph.tokens : []);
}

function tagTokens(paragraphs: any[]): any[] {
  return paragraphTokens(paragraphs).filter((token) => token?.kind === 'tag');
}

const engine = new SpringEngine();
const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
for (const repo of repos) { if (repo) (repo as any).wasmUrl = WASM_PATH; }
await engine.init();

console.log('Tiered progressive disclosure contract\n');

const request = {
  birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' as const },
  surname: [{ hangul: '최', hanja: '崔' }],
  givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }],
  options: { precisionConfig: { surfaceTieredMatrix: true } },
};

const report: any = await engine.getFortuneReport(request);
const tm: any = report?.tieredMatrix;
const rows = cellRows(tm);
const usedTags = new Set<string>(tm?.glossary?.usedInThisReport ?? []);
const glossaryEntries = tm?.glossary?.entries ?? {};

check('tiered matrix is surfaced', tm?.schemaVersion === 'spring-ts.tiered-matrix.v1');
check('all 55 UI cells are present', rows.length === 55 && rows.every((row) => row.cell != null), String(rows.length));

check('brief tier is concise plain text with no mirrored tags',
  rows.every(({ cell }) =>
    typeof cell?.brief?.headline === 'string' &&
      cell.brief.headline.length > 0 &&
      !cell.brief.headline.includes('#') &&
      Array.isArray(cell?.selectedFragments?.brief?.tags) &&
      cell.selectedFragments.brief.tags.length === 0),
  rows.filter(({ cell }) => cell?.selectedFragments?.brief?.tags?.length > 0).map((row) => row.key).join(','));

check('standard tier is plain detail with no inline tag tokens',
  rows.every(({ cell }) =>
    Array.isArray(cell?.standard?.paragraphs) &&
      cell.standard.paragraphs.length > 0 &&
      tagTokens(cell.standard.paragraphs).length === 0 &&
      Array.isArray(cell?.selectedFragments?.standard?.tags) &&
      cell.selectedFragments.standard.tags.length === 0),
  rows.filter(({ cell }) => tagTokens(cell?.standard?.paragraphs ?? []).length > 0).map((row) => row.key).join(','));

check('expert tier carries explicit glossary tags',
  rows.every(({ cell }) =>
    Array.isArray(cell?.expert?.paragraphs) &&
      cell.expert.paragraphs.length > 0 &&
      tagTokens(cell.expert.paragraphs).length > 0 &&
      Array.isArray(cell?.selectedFragments?.expert?.tags) &&
      cell.selectedFragments.expert.tags.length > 0),
  rows.filter(({ cell }) => tagTokens(cell?.expert?.paragraphs ?? []).length === 0).map((row) => row.key).join(','));

const allExpertTags = rows.flatMap(({ cell }) => tagTokens(cell?.expert?.paragraphs ?? []));
check('every expert tag resolves through used glossary entries',
  allExpertTags.length > 0 &&
    allExpertTags.every((token) =>
      typeof token.tagId === 'string' &&
      usedTags.has(token.tagId) &&
      glossaryEntries[token.tagId] != null),
  String(allExpertTags.length));

const leakedGlossaryEntries = Object.values(glossaryEntries as Record<string, any>)
  .filter((entry: any) =>
    Object.prototype.hasOwnProperty.call(entry, 'sourceTier') ||
      JSON.stringify(entry).includes('AI-derived plain-language definition') ||
      JSON.stringify(entry).includes('Display-only'));
check('glossary output omits internal source-tier audit prose',
  leakedGlossaryEntries.length === 0, String(leakedGlossaryEntries.length));

const numericalEvidenceRows = rows.flatMap(({ cell }) => cell?.expert?.numericalEvidence ?? []);
check('expert numeric evidence is source-tiered when present',
  numericalEvidenceRows.length > 0 &&
    numericalEvidenceRows.every((row: any) =>
      typeof row.label === 'string' &&
      typeof row.value === 'number' &&
      row.sourceTier != null &&
      typeof row.sourceTier.tier === 'string' &&
      typeof row.sourceTier.authorityTruthEligible === 'boolean'),
  String(numericalEvidenceRows.length));

check('selected fragment trace stays hidden-capable but complete',
  rows.every(({ cell }) =>
    typeof cell?.selectedFragments?.brief?.fragmentId === 'string' &&
      typeof cell?.selectedFragments?.standard?.fragmentId === 'string' &&
      typeof cell?.selectedFragments?.expert?.fragmentId === 'string'),
  rows.filter(({ cell }) => !cell?.selectedFragments?.expert?.fragmentId).map((row) => row.key).join(','));

engine.close();
console.log(`\nTiered progressive disclosure: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
