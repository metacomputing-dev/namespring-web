/**
 * test/integration/tiered-matrix-shape.test.ts
 *
 * Verifies the structural integrity of `FortuneReport.tieredMatrix` when
 * `precisionConfig.surfaceTieredMatrix === true`:
 *
 *   - 5 periods present (life / today / thisWeek / thisMonth / thisYear)
 *   - each period has 1 overall + 10 byCategory cells = 11 cells
 *   - every cell has brief + standard + expert depth tiers
 *   - meaningfulness: 'meaningful' | 'limited' | 'na'
 *   - stars: 1..5 OR null when meaningfulness === 'na'
 *   - every inline tag references a glossary entry (no dangling tagId)
 *   - glossary.usedInThisReport ⊆ Object.keys(glossary.entries)
 *   - schemaVersion stable
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

function isStarsValid(s: unknown): boolean {
  return s === null || (typeof s === 'number' && s >= 1 && s <= 5);
}

function isMeaningfulnessValid(m: unknown): boolean {
  return m === 'meaningful' || m === 'limited' || m === 'na';
}

const engine = new SpringEngine();
const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
for (const repo of repos) { if (repo) (repo as any).wasmUrl = WASM_PATH; }
await engine.init();

console.log('Tiered matrix shape — opt-in surface produces well-formed cube\n');

const request = {
  birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' as const },
  surname: [{ hangul: '최', hanja: '崔' }],
  givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }],
  options: { precisionConfig: { surfaceTieredMatrix: true } },
};

const fr: any = await engine.getFortuneReport(request);
const tm: any = fr?.tieredMatrix;

check('tieredMatrix surfaced', tm != null);
check('schemaVersion is v1', tm?.schemaVersion === 'spring-ts.tiered-matrix.v1');
check('meta.contentSource is authored',
  tm?.meta?.contentSource === 'authored', String(tm?.meta?.contentSource));
check('meta.selectionSeed is non-empty string',
  typeof tm?.meta?.selectionSeed === 'string' && tm.meta.selectionSeed.length > 0);
check('meta.fragmentCount includes Phase 2 authored corpus',
  typeof tm?.meta?.fragmentCount === 'number' && tm.meta.fragmentCount >= 1800,
  String(tm?.meta?.fragmentCount));
check('meta.aiGeneratedFragmentCount matches fragmentCount',
  tm?.meta?.aiGeneratedFragmentCount === tm?.meta?.fragmentCount,
  `${tm?.meta?.aiGeneratedFragmentCount}/${tm?.meta?.fragmentCount}`);

if (tm) {
  for (const period of PERIODS) {
    const p = tm.periods[period];
    check(`period ${period} present`, p != null);
    check(`period ${period}.periodKind === '${period}'`, p?.periodKind === period);
    check(`period ${period}.periodLabel non-empty`,
      typeof p?.periodLabel === 'string' && p.periodLabel.length > 0);

    // overall cell
    const overall = p?.overall;
    check(`period ${period}.overall present`, overall != null);
    check(`period ${period}.overall.meaningfulness valid`,
      isMeaningfulnessValid(overall?.meaningfulness), String(overall?.meaningfulness));
    check(`period ${period}.overall.stars valid`,
      isStarsValid(overall?.stars), String(overall?.stars));
    check(`period ${period}.overall.brief.headline non-empty`,
      typeof overall?.brief?.headline === 'string' && overall.brief.headline.length > 0);
    check(`period ${period}.overall.standard.paragraphs is array`,
      Array.isArray(overall?.standard?.paragraphs));
    check(`period ${period}.overall.expert.paragraphs is array`,
      Array.isArray(overall?.expert?.paragraphs));

    // 10 categories
    for (const cat of CATEGORIES) {
      const cell = p?.byCategory?.[cat];
      check(`period ${period}.${cat} present`, cell != null);
      check(`period ${period}.${cat}.meaningfulness valid`,
        isMeaningfulnessValid(cell?.meaningfulness));
      check(`period ${period}.${cat}.stars valid`, isStarsValid(cell?.stars));
    }
  }

  // Glossary integrity
  check('glossary.entries non-empty', Object.keys(tm.glossary?.entries ?? {}).length > 0);
  check('glossary.usedInThisReport is array',
    Array.isArray(tm.glossary?.usedInThisReport));

  // Every used tagId must resolve to an entry
  const allEntries = tm.glossary?.entries ?? {};
  for (const used of tm.glossary?.usedInThisReport ?? []) {
    check(`glossary entry exists for usedInThisReport: ${used}`,
      allEntries[used] != null);
  }

  // Every inline tag in expert text must be in usedInThisReport
  const usedSet = new Set<string>(tm.glossary?.usedInThisReport ?? []);
  for (const period of PERIODS) {
    const p = tm.periods[period];
    const cells: any[] = [p.overall, ...Object.values(p.byCategory ?? {})];
    for (const cell of cells) {
      for (const para of cell.expert?.paragraphs ?? []) {
        for (const tok of para.tokens ?? []) {
          if (tok.kind === 'tag') {
            check(`inline tag ${tok.tagId} in ${period} is registered in glossary.usedInThisReport`,
              usedSet.has(tok.tagId));
            check(`inline tag ${tok.tagId} in ${period} resolves in entries`,
              allEntries[tok.tagId] != null);
          }
        }
      }
    }
  }
}

engine.close();
console.log(`\nTiered matrix shape: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
