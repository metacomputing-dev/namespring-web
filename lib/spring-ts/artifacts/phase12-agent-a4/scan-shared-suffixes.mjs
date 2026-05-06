#!/usr/bin/env node
/**
 * Scan narrative fragment files for shared suffixes.
 *
 * Inputs: list of "needle" prose strings.
 * Output: for each needle, the (file, fragmentId, gating, axis) tuples
 * containing it, separately for whole-fragment match vs suffix-fragment.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const NARRATIVE = path.join(ROOT, 'data', 'narrative');

const NEEDLES = [
  // Tier 1: fixtureCount=32, multi-cell
  '신호가 보이는 시기엔 가족 안의 작은 부딪힘을 짧게 끊고',
  '자리가 함께 보이는 사주는 가족 안에서 부드럽게',
  '자리가 함께 살아나는 시기엔 평소 미뤄 둔 학습',
  '받쳐 주느냐를 함께 살펴 두면 흐름의 결정이 더 단단해지고',
  // Tier 2: fixtureCount=31, high cellCount
  '균형이 컨디션을 만드는 가장 큰 축이라',
  '깊은 색이 더 또렷해지고',
  '흐름의 막힌 자리를 풀어 주는 자리가 보이고',
  '이동의 결이 어디로 이어질지 한층 또렷해져요',
  '잠깐의 환경 변화가 컨디션을 환기시키고',
];

function listFragmentBundles(rootDir) {
  const out = [];
  if (!fs.existsSync(rootDir)) return out;
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '_glossary' || entry.name === '_contract') continue;
        walk(p);
      } else if (entry.isFile() && entry.name.endsWith('.fragments.json')) {
        out.push(p);
      }
    }
  }
  walk(rootDir);
  return out;
}

function tokensToText(tokens) {
  if (!Array.isArray(tokens)) return '';
  return tokens.map((t) => {
    if (t.kind === 'text') return t.value || '';
    if (t.kind === 'tag') return `#${t.label || ''}`;
    if (t.kind === 'slot') return `{${t.slotKey || ''}}`;
    return '';
  }).join('');
}

const files = listFragmentBundles(NARRATIVE);
const results = NEEDLES.map((n) => ({ needle: n, hits: [] }));

for (const file of files) {
  let bundle;
  try { bundle = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { continue; }
  const fragments = Array.isArray(bundle?.fragments) ? bundle.fragments : [];
  for (const frag of fragments) {
    if (frag?.axis?.depth !== 'expert') continue;
    const fullText = tokensToText(frag.templateTokens || []);
    for (const r of results) {
      if (fullText.includes(r.needle)) {
        r.hits.push({
          file: path.relative(ROOT, file),
          fragmentId: frag.fragmentId,
          axis: frag.axis,
          gating: frag.gating,
        });
      }
    }
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  needles: results.map((r) => ({
    needle: r.needle,
    hitCount: r.hits.length,
    hits: r.hits,
  })),
};

const outPath = path.join(__dirname, 'shared-suffix-scan.json');
fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
console.log(`Scanned ${files.length} bundles`);
for (const r of results) {
  console.log(`  needle "${r.needle.slice(0, 30)}..." -> ${r.hits.length} hits`);
}
console.log(`output: ${outPath}`);
