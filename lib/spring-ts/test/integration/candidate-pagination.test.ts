/**
 * test/integration/candidate-pagination.test.ts
 *
 * Public candidate APIs should honor explicit SpringOptions.limit/offset.
 * The full candidate pool can be large, but list consumers need bounded
 * payloads from getNameCandidates() and getNameCandidateSummaries().
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
  if (urlStr.includes('sql-wasm.wasm') || urlStr === WASM_PATH) {
    return new Response(fs.readFileSync(WASM_PATH), { status: 200 });
  }
  if (originalFetch) return originalFetch(url, options);
  throw new Error(`fetch unavailable for ${urlStr}`);
};

import { SpringEngine } from '../../src/index.js';

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

console.log('Candidate API pagination\n');

const engine = new SpringEngine();
const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
for (const repo of repos) { if (repo) repo.wasmUrl = WASM_PATH; }
await engine.init();

(engine as any).getNameStatInfo = async () => ({
  status: 'found',
  popularityRank: 1,
  maleRatio: 1,
  nameGender: 'male',
});

const baseRequest = {
  birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' as const },
  surname: [{ hangul: '\uCD5C', hanja: '\u5D14' }],
  givenNameLength: 1,
  mode: 'recommend' as const,
};

const reports = await engine.getNameCandidates({
  ...baseRequest,
  options: { limit: 3 },
});
check('getNameCandidates honors explicit limit',
  reports.length === 3,
  `length=${reports.length}`);
check('getNameCandidates keeps page ranks stable',
  reports.map((row) => row.rank).join(',') === '1,2,3',
  reports.map((row) => row.rank).join(','));

const summaries = await engine.getNameCandidateSummaries({
  ...baseRequest,
  options: { limit: 4, offset: 2 },
});
check('getNameCandidateSummaries honors explicit limit',
  summaries.length === 4,
  `length=${summaries.length}`);
check('getNameCandidateSummaries honors explicit offset',
  summaries[0]?.rank === 3 && summaries.map((row) => row.rank).join(',') === '3,4,5,6',
  summaries.map((row) => row.rank).join(','));
check('getNameCandidateSummaries avoids duplicate Hangul rows on a page',
  new Set(summaries.map((row) => row.fullHangul)).size === summaries.length,
  summaries.map((row) => row.fullHangul).join(','));
check('getNameCandidateSummaries includes display Hanja meanings',
  summaries.every((row) => row.givenName.every((char) =>
    typeof char.meaning === 'string' && char.meaning.length > 0)),
  summaries.map((row) => row.givenName.map((char) => char.meaning ?? '').join('/')).join(','));

const candidateRejections = new Map();
const generated = await (engine as any).generateCandidates({
  ...baseRequest,
  givenNameLength: 2,
}, {
  yongshin: { element: 'METAL', heeshin: null, gishin: null, gushin: null },
  deficientElements: [],
  excessiveElements: [],
}, undefined, candidateRejections);
const generatedHanja = generated.flat().map((char: any) => String(char.hanja ?? ''));
const rejectionSummary = (engine as any).candidateRejectionSummary(candidateRejections);
check('generated recommendations exclude unsafe Hanja meanings',
  !generatedHanja.includes('贓'),
  generatedHanja.slice(0, 20).join(','));
check('unsafe Hanja meaning rejection is recorded',
  rejectionSummary.some((row: any) => row.reason === 'unsafe_hanja_meaning'),
  JSON.stringify(rejectionSummary));
check('generated recommendations exclude opaque one-syllable Hanja meanings',
  !generatedHanja.some((hanja) => ['勺'].includes(hanja)),
  generatedHanja.slice(0, 20).join(','));
check('generated recommendations exclude weak public-name meanings',
  !generatedHanja.some((hanja) => ['了', '勺', '匕', '牙', '勾', '刈', '勻', '齡', '刀', '勿', '分', '戈'].includes(hanja)),
  generatedHanja.slice(0, 20).join(','));
check('weak public-name meaning rejection is recorded',
  rejectionSummary.some((row: any) => row.reason === 'weak_hanja_meaning'),
  JSON.stringify(rejectionSummary));

engine.close();

console.log(`\nCandidate API pagination: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
