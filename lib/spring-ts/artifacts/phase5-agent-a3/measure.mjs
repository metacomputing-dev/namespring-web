// Phase 5 agent A3 — measure 결이 counts in family/wealth/overall.
// Run from lib/spring-ts: node artifacts/phase5-agent-a3/measure.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOTS = ['data/narrative/family', 'data/narrative/wealth', 'data/narrative/overall'];

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...walkFiles(full));
    } else if (entry.name.endsWith('.fragments.json')) {
      result.push(full);
    }
  }
  return result;
}

function fullText(tokens) {
  if (!tokens) return '';
  return tokens.map(t => (t.kind === 'text' ? (t.value || '') : '')).join('');
}

function countOccurrences(haystack, needle) {
  let cnt = 0;
  let idx = 0;
  while (true) {
    const i = haystack.indexOf(needle, idx);
    if (i === -1) break;
    cnt++;
    idx = i + needle.length;
  }
  return cnt;
}

const trackedWords = ['결이', '결을', '결로', '결의', '결이에요'];

function measureRoot(root) {
  const files = walkFiles(root);
  const wordCounts = Object.fromEntries(trackedWords.map(w => [w, 0]));
  let totalFragments = 0;
  const perFile = {};
  const samples = [];
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    let fileCount = 0;
    for (const frag of data.fragments || []) {
      totalFragments++;
      const text = fullText(frag.templateTokens);
      for (const w of trackedWords) {
        const c = countOccurrences(text, w);
        wordCounts[w] += c;
        fileCount += c;
      }
      // Capture some samples
      if (samples.length < 30 && trackedWords.some(w => text.includes(w))) {
        samples.push({
          file: path.relative(process.cwd(), file).replace(/\\/g, '/'),
          fragmentId: frag.fragmentId,
          text: text.substring(0, 120),
        });
      }
    }
    if (fileCount > 0) {
      perFile[path.relative(process.cwd(), file).replace(/\\/g, '/')] = fileCount;
    }
  }
  const total = Object.values(wordCounts).reduce((a, b) => a + b, 0);
  return { root, total, totalFragments, wordCounts, perFile, samples };
}

const measurements = ROOTS.map(measureRoot);
console.log(JSON.stringify(measurements, null, 2));
