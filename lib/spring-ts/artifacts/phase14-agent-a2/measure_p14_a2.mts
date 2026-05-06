/**
 * tools/measure_p13_a4.mts
 *
 * Phase 13 Agent A4 diagnostic. Identify all standard cells with
 * `paragraphs.length < 3`, listing fragmentId / category / period
 * so we can see which fragments still need enrichment.
 *
 * Usage: npx tsx tools/measure_p13_a4.mts [output.json]
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

const { SpringEngine, buildFortuneReport } = await import('../../src/index.js');

interface Fixture {
  id: string;
  label: string;
  birth: { year: number; month: number; day: number; hour: number | null; minute: number; gender: 'male' | 'female' | 'neutral' };
  surname: Array<{ hangul: string; hanja?: string }>;
  givenName: Array<{ hangul: string; hanja?: string }>;
}

const FIXTURES_PATH = path.resolve(SPRING_TS_ROOT, 'test/fixtures/spring_ts_baseline_cases.json');
const fixtures: Fixture[] = JSON.parse(fs.readFileSync(FIXTURES_PATH, 'utf-8')).fixtures;

const engine = new SpringEngine();
const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
for (const repo of repos) {
  if (!repo) continue;
  (repo as any).wasmUrl = WASM_PATH;
}
await engine.init();

const targetDate = new Date('2026-05-05T00:00:00.000Z');
const standardHist: Record<string, number> = {};
let cellCount = 0;
const offendingCells: Array<{
  fixture: string;
  period: string;
  category: string;
  paragraphCount: number;
  fragmentId: string | undefined;
  plainTextSample: string;
}> = [];
const fragmentLowParagraphCounts: Record<string, number> = {};

for (const fix of fixtures) {
  const sajuReport = await engine.getSajuReport({ birth: fix.birth, surname: fix.surname });
  const candidates = await engine.getNameCandidates({
    birth: fix.birth,
    surname: fix.surname,
    givenNameLength: fix.givenName.length,
    mode: 'recommend',
    options: { limit: 1 },
  });
  const fortune = buildFortuneReport(
    sajuReport,
    targetDate,
    candidates[0] ?? null,
    { surfaceTieredMatrix: true } as any,
    fix.birth as any,
  );
  const tm: any = (fortune as any)?.tieredMatrix;
  if (!tm?.periods) continue;
  for (const periodKey of Object.keys(tm.periods)) {
    const period = tm.periods[periodKey];
    const cells: Array<[string, any]> = [
      ['overall', period.overall],
      ...Object.entries(period.byCategory ?? {}),
    ];
    for (const [catKey, cell] of cells) {
      if (!cell) continue;
      const sLen = Array.isArray(cell.standard?.paragraphs) ? cell.standard.paragraphs.length : 0;
      standardHist[String(sLen)] = (standardHist[String(sLen)] ?? 0) + 1;
      cellCount += 1;
      if (sLen < 3) {
        const plainSample = (cell.standard?.paragraphs?.[0]?.plainText as string | undefined) ?? '';
        const fragmentId = cell.selectedFragments?.standard?.fragmentId;
        offendingCells.push({
          fixture: fix.id,
          period: periodKey,
          category: catKey,
          paragraphCount: sLen,
          fragmentId,
          plainTextSample: plainSample.slice(0, 80),
        });
        if (fragmentId) {
          fragmentLowParagraphCounts[fragmentId] = (fragmentLowParagraphCounts[fragmentId] ?? 0) + 1;
        }
      }
    }
  }
}
engine.close();

const out = {
  fixtureCount: fixtures.length,
  cellCount,
  standard: { distribution: standardHist },
  cellsBelow3: offendingCells.length,
  cellsAtOrAbove3: cellCount - offendingCells.length,
  percentAtOrAbove3: cellCount > 0 ? +((cellCount - offendingCells.length) / cellCount * 100).toFixed(2) : 0,
  fragmentLowParagraphCounts,
  offendingCells,
};

const target = process.argv[2];
const json = JSON.stringify(out, null, 2);
if (target) {
  fs.writeFileSync(target, json + '\n');
  console.log(`Wrote ${target}`);
} else {
  console.log(json);
}
