/**
 * test/integration/tengod-report-surface.test.ts
 *
 * Verifies PR-5.3 report-layer ten-god position evidence. This uses the
 * SpringEngine report route so evidence is captured from the same SajuCalculator
 * scoring path that produces the final saju compatibility score.
 *
 * Run: npx tsx test/integration/tengod-report-surface.test.ts
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
import { buildNameCompatibilityCard } from '../../src/report/cards/name-compatibility-card.js';

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

const engine = new SpringEngine();
const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
for (const repo of repos) {
  if (!repo) continue;
  (repo as any).wasmUrl = WASM_PATH;
}
await engine.init();

const request = {
  birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' as const },
  surname: [{ hangul: '최', hanja: '崔' }],
  givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '燁' }],
  mode: 'evaluate' as const,
};

const defaultReport = await engine.getSpringReport(request);
const v2Report = await engine.getSpringReport({
  ...request,
  options: { precisionConfig: { tenGodMode: 'positional_weighted_v2' } },
});
const card = buildNameCompatibilityCard(v2Report);

const evidence = v2Report.sajuCompatibility.tenGodPositionEvidence;
const cardEvidence = card?.tenGodPositionEvidence;
const tenGodRow = card?.evidence?.find((row) => row.axis === 'tenGodPosition');

console.log('PR-5.3 ten-god report surface\n');
console.log('mode:', evidence?.effectiveMode);
console.log('top contributions:', evidence?.topContributions.map((row) => ({
  position: row.position,
  source: row.source,
  group: row.group,
  weight: row.weight,
  visibility: row.visibility,
})));
console.log('');

check('default final score is unchanged by adding evidence surface',
  defaultReport.finalScore === v2Report.finalScore,
  `${defaultReport.finalScore}=${v2Report.finalScore}`);
check('SpringReport exposes tenGodPositionEvidence',
  evidence != null && evidence.effectiveMode === 'positional_weighted_v2',
  evidence?.effectiveMode);
check('report evidence exposes v2 normalization anchor',
  evidence?.normalization === 'presence_visibility_expected_by_chart_shape',
  evidence?.normalization);
check('top contributions are present and sorted by impact descending',
  Array.isArray(evidence?.topContributions) &&
    evidence!.topContributions.length > 0 &&
    evidence!.topContributions.every((row, index, rows) => {
      if (index === 0) return true;
      const prev = rows[index - 1].visibility ?? rows[index - 1].weight;
      const current = row.visibility ?? row.weight;
      return prev >= current;
    }));
check('top contributions preserve position/source/group fields',
  evidence?.topContributions.every((row) =>
    typeof row.position === 'string' &&
    typeof row.source === 'string' &&
    typeof row.group === 'string' &&
    Number.isFinite(row.weight)) === true);
check('top contributions include non-hidden evidence, not hidden-only summary',
  evidence?.topContributions.some((row) => row.source !== 'hiddenStem') === true,
  evidence?.topContributions.map((row) => row.source).join(','));
check('NameCompatibilityCard forwards tenGodPositionEvidence',
  cardEvidence != null && cardEvidence.effectiveMode === evidence?.effectiveMode);
check('NameCompatibilityCard evidence row includes concrete position features',
  tenGodRow != null &&
    tenGodRow.supportingFeatures.some((feature) => feature.includes('/')) &&
    tenGodRow.supportingFeatures.some((feature) => feature.startsWith('normalization:')),
  JSON.stringify(tenGodRow?.supportingFeatures));

engine.close();

console.log(`\nTen-god report surface: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
