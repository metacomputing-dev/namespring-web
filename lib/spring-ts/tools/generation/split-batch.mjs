/**
 * split-batch.mjs -- Split a bundles-*.batch.json into per-bundle prompt
 * files for the SESSION-AGENT path (run-bundles.wf.js with args.itemsDir).
 *
 * Why: a whole-category batch file is ~16k lines — past the agent Read
 * truncation limit. One small file per bundle lets each agent read only its
 * own prompt (same trick as the 2026-07-04 per-item harness).
 *
 * Usage: node tools/generation/split-batch.mjs <bundles-batch.json> [moreBatch.json...]
 *   → data/generation/batches/items-<firstBatchName>/<customId>.md
 *   → prints itemsDir + bundleKeys for the Workflow args.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const files = process.argv.slice(2);
if (files.length === 0) { console.error('usage: split-batch.mjs <batchFile...>'); process.exit(2); }

const toCustomId = (key) => key.replace(/\./g, '-');
const firstName = path.basename(files[0]).replace(/\.batch\.json$/u, '');
const outDir = path.join(path.dirname(path.resolve(files[0])), `items-${firstName}`);
fs.mkdirSync(outDir, { recursive: true });

const keys = [];
const seen = new Set();
for (const file of files) {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
  for (const b of parsed.bundles) {
    if (seen.has(b.bundleKey)) continue;
    seen.add(b.bundleKey);
    keys.push(b.bundleKey);
    const header = `<!-- bundleKey: ${b.bundleKey} · caseIds: ${b.caseIds.join(', ')} -->\n\n`;
    fs.writeFileSync(path.join(outDir, `${toCustomId(b.bundleKey)}.md`), header + b.prompt, 'utf-8');
  }
}
console.log(`itemsDir: ${outDir}`);
console.log(`bundles: ${keys.length}`);
console.log(`bundleKeys: ${keys.join(',')}`);
