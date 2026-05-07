#!/usr/bin/env node
/**
 * Lists individual cells where any expert paragraph contains '흐름이' >= 3
 * (P15-A4 informational lock breach, P28-A2 source).
 *
 * Usage:
 *   node artifacts/phase29-agent-a1/list_flow_cells.mjs
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');
const SAMPLE_DIR = join(REPO_ROOT, 'artifacts', 'sample-outputs-2026-05-05-phase3');

function paragraphText(p) {
  if (typeof p?.plainText === 'string') return p.plainText;
  if (Array.isArray(p?.tokens)) {
    return p.tokens.map(t => (t && typeof t.value === 'string') ? t.value : '').join('');
  }
  return '';
}
function countMatches(text, re) {
  if (typeof text !== 'string') return 0;
  const m = text.match(re);
  return m ? m.length : 0;
}

const sampleFiles = readdirSync(SAMPLE_DIR).filter(f => f.endsWith('-tiered.json'));
const flowCells = [];

for (const file of sampleFiles) {
  const fixtureId = file.replace(/-tiered\.json$/, '');
  const filePath = join(SAMPLE_DIR, file);
  const json = JSON.parse(readFileSync(filePath, 'utf8'));
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
        paragraphs.forEach((p, idx) => {
          const ptext = paragraphText(p);
          const flowCnt = countMatches(ptext, /흐름이/g);
          if (flowCnt >= 3) {
            flowCells.push({
              fixture: fixtureId,
              period: periodKey,
              category: catKey,
              tier,
              paragraphIdx: idx,
              flowCount: flowCnt,
              text: ptext.slice(0, 220),
            });
          }
        });
      }
      checkParagraphCluster(cell.standard?.paragraphs, 'standard');
      checkParagraphCluster(cell.expert?.paragraphs, 'expert');
    }
  }
}

console.log(`Total flowCluster cells: ${flowCells.length}`);
for (const c of flowCells) {
  console.log(`\n${c.fixture} | ${c.period} | ${c.category} | ${c.tier} | paragraph ${c.paragraphIdx} | flowCount=${c.flowCount}`);
  console.log(`  text: ${c.text}`);
}
