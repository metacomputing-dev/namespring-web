/**
 * artifacts/phase16-agent-a3/find-winners.mjs
 *
 * For a given (category,period), inspect each tiered sample fixture
 * and identify the brief fragment whose template-token text matches
 * the brief.headline that surfaced for that fixture. Aggregate by
 * fragmentId so we can confirm 'most-often winner' before adding a
 * hook to it.
 *
 * Usage: node artifacts/phase16-agent-a3/find-winners.mjs <category> <period>
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const SAMPLES_DIR = path.resolve(SPRING_TS_ROOT, 'artifacts/sample-outputs-2026-05-05-phase3');
const NARR_DIR = path.resolve(SPRING_TS_ROOT, 'data/narrative');

const [, , category, period] = process.argv;
if (!category || !period) {
  console.error('Usage: node find-winners.mjs <category> <period>');
  process.exit(1);
}

// Load fragments for that bundle
const bundlePath = path.join(NARR_DIR, category, period, 'brief.fragments.json');
const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf-8'));
const fragsByText = new Map();
for (const frag of bundle.fragments) {
  // Concat templateTokens text (most are single text token)
  const txt = frag.templateTokens.filter((t) => t.kind === 'text').map((t) => t.value).join('');
  fragsByText.set(txt, frag);
}

// Walk samples
const sampleFiles = fs.readdirSync(SAMPLES_DIR).filter((f) => /-tiered\.json$/.test(f)).sort();
const fragWinCount = new Map();
const headlineCount = new Map();
for (const file of sampleFiles) {
  const json = JSON.parse(fs.readFileSync(path.join(SAMPLES_DIR, file), 'utf-8'));
  const tm = json.payload?.tieredMatrix;
  if (!tm?.periods?.[period]) continue;
  const p = tm.periods[period];
  let cell;
  if (category === 'overall') cell = p.overall;
  else cell = p.byCategory?.[category];
  if (!cell?.brief?.headline) continue;
  const headline = cell.brief.headline;
  headlineCount.set(headline, (headlineCount.get(headline) ?? 0) + 1);

  // Try exact match first; if not, look for prefix match (post-process may shorten)
  let frag = fragsByText.get(headline);
  if (!frag) {
    // Some headlines have trailing . trimmed by truncation. Try fuzzy match.
    for (const [txt, f] of fragsByText.entries()) {
      const a = txt.replace(/[.\s]+$/u, '');
      const b = headline.replace(/[.\s]+$/u, '');
      if (a === b) { frag = f; break; }
    }
  }
  // If still no match, check if any fragment text begins with the headline (truncation)
  if (!frag) {
    for (const [txt, f] of fragsByText.entries()) {
      // Trim trailing period before comparing
      const t = txt.replace(/\.+$/u, '');
      const h = headline.replace(/\.+$/u, '').replace(/요\.\.+$/u, '요');
      if (t.startsWith(h.slice(0, Math.min(h.length, 20)))) { frag = f; break; }
    }
  }
  if (!frag) {
    fragWinCount.set('UNKNOWN: ' + headline, (fragWinCount.get('UNKNOWN: ' + headline) ?? 0) + 1);
  } else {
    const k = `${frag.fragmentId}\t${headline}`;
    fragWinCount.set(k, (fragWinCount.get(k) ?? 0) + 1);
  }
}

console.log(`=== ${category}.${period}.brief winners ===`);
const sorted = [...fragWinCount.entries()].sort((a, b) => b[1] - a[1]);
for (const [k, n] of sorted) {
  console.log(`  ${n}x ${k}`);
}
