#!/usr/bin/env node
// P5-A1 — livingTips ≤24 ko audit
// Counts violations of NARRATIVE_STYLE_GUIDE §2-2: livingTips each ≤24 한글 자모.
// Convention used here: Hangul syllable count only (AC00–D7A3); spaces /
// punctuation / digits / Latin / hanja excluded.
// Reproduces the 829 baseline figure stated in
// PLAN_PHASE5_DEFERRED_RESOLUTION.md §0.
//
// Usage:
//   node artifacts/phase5-agent-a1/audit_living_tips.mjs            # summary
//   node artifacts/phase5-agent-a1/audit_living_tips.mjs --json     # full violation list
//   node artifacts/phase5-agent-a1/audit_living_tips.mjs --out=PATH # write JSON file
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const NARRATIVE_ROOT = path.join(ROOT, 'data', 'narrative');

const SCOPE_DIRS = ['_coverage', 'overall'];
const LIMIT = 24;

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (entry.isFile() && p.endsWith('.fragments.json')) yield p;
  }
}

function koLength(s) {
  let n = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (cp >= 0xAC00 && cp <= 0xD7A3) n++;
  }
  return n;
}
function rawLength(s) { return Array.from(s).length; }

function audit() {
  const violations = [];
  const totalsByDir = Object.fromEntries(SCOPE_DIRS.map((d) => [d, 0]));
  const totalsByFile = {};
  let totalTips = 0;

  for (const top of SCOPE_DIRS) {
    const root = path.join(NARRATIVE_ROOT, top);
    if (!fs.existsSync(root)) continue;
    for (const file of walk(root)) {
      const rel = path.relative(NARRATIVE_ROOT, file).replace(/\\/g, '/');
      const json = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const fragment of json.fragments ?? []) {
        const tips = fragment.livingTips;
        if (!Array.isArray(tips)) continue;
        for (let i = 0; i < tips.length; i++) {
          totalTips++;
          const tip = tips[i];
          if (typeof tip !== 'string') continue;
          const len = koLength(tip);
          if (len > LIMIT) {
            violations.push({
              file: rel,
              fragmentId: fragment.fragmentId,
              tipIndex: i,
              length: len,
              raw: rawLength(tip),
              over: len - LIMIT,
              tip,
              category: fragment?.axis?.category ?? null,
              period: fragment?.axis?.period ?? null,
              depth: fragment?.axis?.depth ?? null,
            });
            totalsByDir[top] = (totalsByDir[top] ?? 0) + 1;
            totalsByFile[rel] = (totalsByFile[rel] ?? 0) + 1;
          }
        }
      }
    }
  }

  return { violations, totalsByDir, totalsByFile, totalTips };
}

function bucket(violations) {
  const b = { '25-27': 0, '28-32': 0, '33-40': 0, '41+': 0 };
  for (const v of violations) {
    if (v.length <= 27) b['25-27']++;
    else if (v.length <= 32) b['28-32']++;
    else if (v.length <= 40) b['33-40']++;
    else b['41+']++;
  }
  return b;
}

function byCategory(violations) {
  const m = {};
  for (const v of violations) {
    const k = v.category ?? '(none)';
    m[k] = (m[k] ?? 0) + 1;
  }
  return m;
}

const args = process.argv.slice(2);
const wantJson = args.includes('--json');
const outArg = args.find((a) => a.startsWith('--out='));
const outFile = outArg ? outArg.slice('--out='.length) : null;

const result = audit();
const summary = {
  limit: LIMIT,
  totalTips: result.totalTips,
  totalViolations: result.violations.length,
  byDir: result.totalsByDir,
  byBucket: bucket(result.violations),
  byCategory: byCategory(result.violations),
};

if (outFile) {
  const abs = path.isAbsolute(outFile) ? outFile : path.join(ROOT, outFile);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify({ summary, violations: result.violations, totalsByFile: result.totalsByFile }, null, 2) + '\n', 'utf8');
  console.log(`wrote ${abs}`);
}

if (wantJson) {
  process.stdout.write(JSON.stringify({ summary, violations: result.violations, totalsByFile: result.totalsByFile }, null, 2));
} else {
  console.log('=== livingTips >24 ko audit ===');
  console.log(`scope: data/narrative/{${SCOPE_DIRS.join(',')}}`);
  console.log(`total livingTips entries scanned: ${result.totalTips}`);
  console.log(`violations (>${LIMIT} chars): ${result.violations.length}`);
  console.log('by dir:', result.totalsByDir);
  console.log('by bucket:', summary.byBucket);
  console.log('by category:', summary.byCategory);
  console.log('top 15 files by violation count:');
  const top = Object.entries(result.totalsByFile).sort((a, b) => b[1] - a[1]).slice(0, 15);
  for (const [f, n] of top) console.log(`  ${n.toString().padStart(4)}  ${f}`);
}

process.exit(0);
