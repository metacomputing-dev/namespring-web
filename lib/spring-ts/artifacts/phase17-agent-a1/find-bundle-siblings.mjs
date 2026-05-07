/**
 * artifacts/phase17-agent-a1/find-bundle-siblings.mjs
 *
 * For (category,period,depth=brief), enumerate every fragment in the
 * narrative tree (categorical bundle + every _coverage bundle) along
 * with its specificity score. Used to determine the spec needed for
 * a hook fragment to win for any given fixture.
 *
 * Usage: node artifacts/phase17-agent-a1/find-bundle-siblings.mjs <category> <period>
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const NARR_DIR = path.resolve(SPRING_TS_ROOT, 'data/narrative');

const [, , category, period] = process.argv;
if (!category || !period) {
  console.error('Usage: node find-bundle-siblings.mjs <category> <period>');
  process.exit(1);
}

const collected = [];

function specOf(gating) {
  if (!gating) return 0;
  let s = 0;
  for (const k of Object.keys(gating)) {
    const v = gating[k];
    if (Array.isArray(v) && v.length > 0) s += 1;
  }
  return s;
}

function loadAndCollect(filePath, file) {
  let j;
  try {
    j = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    return;
  }
  for (const f of (j.fragments || [])) {
    if (f.axis?.category === category && f.axis?.period === period && f.axis?.depth === 'brief') {
      collected.push({
        bundle: file,
        fragmentId: f.fragmentId,
        spec: specOf(f.gating),
        gating: f.gating,
        hook: !!f.hook,
        firstText: (f.templateTokens?.[0]?.value || '').slice(0, 60),
      });
    }
  }
}

// Categorical bundle
const catFile = path.join(NARR_DIR, category, period, 'brief.fragments.json');
if (fs.existsSync(catFile)) loadAndCollect(catFile, `${category}/${period}/brief`);

// Coverage bundles
const coverageDir = path.join(NARR_DIR, '_coverage');
for (const file of fs.readdirSync(coverageDir)) {
  if (!file.endsWith('.fragments.json')) continue;
  loadAndCollect(path.join(coverageDir, file), `_coverage/${file}`);
}

collected.sort((a, b) => b.spec - a.spec);
console.log(`=== ${category}.${period}.brief siblings ===`);
for (const c of collected) {
  console.log(`  spec=${c.spec} ${c.hook ? '[HOOK]' : '      '} ${c.fragmentId} ${JSON.stringify(c.gating)} (${c.bundle})`);
}
console.log('\nMax spec:', Math.max(...collected.map((c) => c.spec)));
