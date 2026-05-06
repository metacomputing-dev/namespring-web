/**
 * tools/measure_p11_a4.mts
 *
 * Phase 11 Agent P11-A4 diagnostic. Identify all expert cells with
 * `paragraphs.length < 4`, listing fragmentId / category / period / age band
 * so we can see exactly which fragments to enrich and how many cells the
 * minor-fallback constant accounts for.
 *
 * Usage: npx tsx tools/measure_p11_a4.mts [output.json]
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
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

const { SpringEngine, buildFortuneReport } = await import('../src/index.js');

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
const expertHist: Record<string, number> = {};
const standardHist: Record<string, number> = {};
let cellCount = 0;
const offendingCells: Array<{
  fixture: string;
  ageBand: string | undefined;
  period: string;
  category: string;
  paragraphCount: number;
  meaningfulness: string;
  fragmentId: string | undefined;
  isMinorFallback: boolean;
  plainTextSample: string;
}> = [];
const fragmentSingleParagraphCounts: Record<string, number> = {};

const MINOR_FALLBACK_PLAIN = '이 항목은 나이가 어린 독자에게 단정적으로 풀이하지 않아요. #일주와 #용신 같은 전문 지표는 성장 과정, 보호자 관찰, 실제 생활 환경을 함께 보며 참고해야 해요.';

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
      const eLen = Array.isArray(cell.expert?.paragraphs) ? cell.expert.paragraphs.length : 0;
      const sLen = Array.isArray(cell.standard?.paragraphs) ? cell.standard.paragraphs.length : 0;
      expertHist[String(eLen)] = (expertHist[String(eLen)] ?? 0) + 1;
      standardHist[String(sLen)] = (standardHist[String(sLen)] ?? 0) + 1;
      cellCount += 1;
      if (eLen < 4) {
        const plainSample = (cell.expert?.paragraphs?.[0]?.plainText as string | undefined) ?? '';
        const fragmentId = cell.selectedFragments?.expert?.fragmentId;
        const isMinorFallback = plainSample.startsWith('이 항목은 나이가 어린 독자에게 단정적으로');
        offendingCells.push({
          fixture: fix.id,
          ageBand: undefined,
          period: periodKey,
          category: catKey,
          paragraphCount: eLen,
          meaningfulness: cell.meaningfulness,
          fragmentId,
          isMinorFallback,
          plainTextSample: plainSample.slice(0, 80),
        });
        if (fragmentId) {
          fragmentSingleParagraphCounts[fragmentId] = (fragmentSingleParagraphCounts[fragmentId] ?? 0) + 1;
        } else if (isMinorFallback) {
          fragmentSingleParagraphCounts['__MINOR_EXPERT_LIMITED_PARAGRAPH__'] =
            (fragmentSingleParagraphCounts['__MINOR_EXPERT_LIMITED_PARAGRAPH__'] ?? 0) + 1;
        }
      }
    }
  }
}
engine.close();

const out = {
  fixtureCount: fixtures.length,
  cellCount,
  expert: {
    distribution: expertHist,
  },
  standard: {
    distribution: standardHist,
  },
  cellsBelow4: offendingCells.length,
  fragmentSingleParagraphCounts,
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
