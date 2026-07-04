/**
 * extract-workflow-result.mjs -- Pull the .result payload out of a Claude
 * Code background-task output file and write it as results.json for ingest.
 *
 * Workflow scripts cannot write files; the harness records their return value
 * under the `result` key of <session-temp>/tasks/<taskId>.output (JSON).
 *
 * Usage: node tools/generation/extract-workflow-result.mjs <taskOutputFile> <resultsOut.json>
 */
import * as fs from 'node:fs';

const [src, out] = process.argv.slice(2);
if (!src || !out) {
  console.error('usage: extract-workflow-result.mjs <taskOutputFile> <resultsOut.json>');
  process.exit(2);
}
const parsed = JSON.parse(fs.readFileSync(src, 'utf-8'));
const result = parsed.result ?? parsed;
if (!result || typeof result !== 'object') {
  console.error('no .result object found');
  process.exit(1);
}
fs.writeFileSync(out, JSON.stringify(result, null, 1), 'utf-8');
const n = Array.isArray(result.results) ? result.results.reduce((s, b) => s + (b.articles?.length ?? 0), 0) : '?';
console.log(`wrote ${out} (${Array.isArray(result.results) ? result.results.length : '?'} bundles, ${n} articles)`);
