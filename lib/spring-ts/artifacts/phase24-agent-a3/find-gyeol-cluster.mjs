/**
 * artifacts/phase24-agent-a3/find-gyeol-cluster.mjs
 *
 * Phase 24 Agent A3 inspection helper. Read-only.
 *
 * Re-runs the gyeolCluster scan from `measure_p23.mjs` but emits the
 * full cell list (fixture / period / category / tier / paragraph index
 * / paragraph text) so the audit can identify which 12 cells trip the
 * `결` ≥ 3 threshold and decide hold-vs-paraphrase per cell.
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const SAMPLES_DIR = path.resolve(
  SPRING_TS_ROOT,
  'artifacts/sample-outputs-2026-05-05-phase3',
);

const TIERED_FILE_RE = /-tiered\.json$/;
const sampleFiles = fs
  .readdirSync(SAMPLES_DIR)
  .filter((f) => TIERED_FILE_RE.test(f))
  .sort();

function paragraphText(p) {
  if (typeof p?.plainText === 'string') return p.plainText;
  if (Array.isArray(p?.tokens)) {
    return p.tokens
      .map((t) => (t && typeof t.value === 'string' ? t.value : ''))
      .join('');
  }
  return '';
}

function countMatches(text, re) {
  if (!text || typeof text !== 'string') return 0;
  return (text.match(re) ?? []).length;
}

const gyeolClusterCells = [];

for (const file of sampleFiles) {
  const fullPath = path.join(SAMPLES_DIR, file);
  const fixtureId = file.replace(/\.json$/, '');
  const json = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
  const tm = json?.payload?.tieredMatrix ?? json?.tieredMatrix;
  if (!tm?.periods) continue;
  for (const periodKey of Object.keys(tm.periods)) {
    const period = tm.periods[periodKey];
    if (!period) continue;
    const cells = [
      ['overall', period.overall],
      ...Object.entries(period.byCategory ?? {}),
    ];
    for (const [catKey, cell] of cells) {
      if (!cell) continue;
      function checkParagraphCluster(paragraphs, tier) {
        if (!Array.isArray(paragraphs)) return;
        for (let idx = 0; idx < paragraphs.length; idx += 1) {
          const p = paragraphs[idx];
          const ptext = paragraphText(p);
          const gyeolCnt = countMatches(ptext, /결/g);
          if (gyeolCnt >= 3) {
            // Extract distinct lexical items containing 결.
            const tokens = ptext.match(/[가-힣]*결[가-힣]*/g) ?? [];
            const distinct = Array.from(new Set(tokens));
            gyeolClusterCells.push({
              fixture: fixtureId,
              period: periodKey,
              category: catKey,
              tier,
              paragraphIdx: idx,
              gyeolCount: gyeolCnt,
              distinctTokens: distinct,
              text: ptext,
            });
          }
        }
      }
      checkParagraphCluster(cell.standard?.paragraphs, 'standard');
      checkParagraphCluster(cell.expert?.paragraphs, 'expert');
    }
  }
}

const target = process.argv[2];
const txt = JSON.stringify(
  { totalCells: gyeolClusterCells.length, cells: gyeolClusterCells },
  null,
  2,
);
if (target) {
  fs.writeFileSync(target, txt + '\n');
  console.log(`Wrote ${target}`);
} else {
  console.log(txt);
}
