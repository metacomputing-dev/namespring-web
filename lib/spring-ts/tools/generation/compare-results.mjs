/**
 * compare-results.mjs -- Side-by-side viewer for model A/B on batch results.
 *
 * Usage:
 *   node tools/generation/compare-results.mjs <resultsA.json> <resultsB.json>            # summary table
 *   node tools/generation/compare-results.mjs <resultsA.json> <resultsB.json> <bundleKey> [caseId]
 */
import * as fs from 'node:fs';

const [fileA, fileB, bundleKey, caseId] = process.argv.slice(2);
if (!fileA || !fileB) {
  console.error('usage: compare-results.mjs <resultsA.json> <resultsB.json> [bundleKey] [caseId]');
  process.exit(2);
}
const A = JSON.parse(fs.readFileSync(fileA, 'utf-8')).results;
const B = JSON.parse(fs.readFileSync(fileB, 'utf-8')).results;
const byKey = (list) => new Map(list.map((r) => [r.bundleKey, r]));
const mapA = byKey(A); const mapB = byKey(B);

if (!bundleKey) {
  console.log(`A=${fileA} (${A.length} bundles) · B=${fileB} (${B.length} bundles)\n`);
  for (const key of new Set([...mapA.keys(), ...mapB.keys()])) {
    const a = mapA.get(key); const b = mapB.get(key);
    const aLen = a ? a.articles.reduce((n, x) => n + (x.body || []).join('').length, 0) : 0;
    const bLen = b ? b.articles.reduce((n, x) => n + (x.body || []).join('').length, 0) : 0;
    console.log(`${key}\n  A: ${a?.articles.length ?? '-'}편 body ${aLen}자 · B: ${b?.articles.length ?? '-'}편 body ${bLen}자`);
  }
  process.exit(0);
}

const show = (label, bundle) => {
  console.log(`\n════════ ${label} ════════`);
  if (!bundle) { console.log('(없음)'); return; }
  for (const art of bundle.articles) {
    if (caseId && art.caseId !== caseId) continue;
    console.log(`\n--- ${art.caseId} ---`);
    console.log(`S: ${art.summary}`);
    if (caseId) {
      (art.body || []).forEach((p, i) => console.log(`B${i + 1}: ${p}`));
      (art.expert || []).forEach((p, i) => console.log(`E${i + 1}: ${p}`));
      console.log(`TIPS: ${(art.livingTips || []).join(' / ')}`);
      console.log(`CAUT: ${(art.cautions || []).join(' / ')}`);
    }
  }
};
show('A: ' + fileA, mapA.get(bundleKey));
show('B: ' + fileB, mapB.get(bundleKey));
