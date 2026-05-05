// Phase 5 agent A3 — per-fragment 결이 count for the three categories.
// Outputs JSONL: {category, file, fragmentId, gyeoriCount, text}
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

function countOcc(s, n) {
  let c = 0, i = 0;
  while (true) {
    const j = s.indexOf(n, i);
    if (j < 0) break;
    c++;
    i = j + n.length;
  }
  return c;
}

const result = { byCategory: {} };
for (const root of ROOTS) {
  const cat = root.split('/').pop();
  result.byCategory[cat] = { totalGyeori: 0, fragments: [] };
  for (const file of walkFiles(root)) {
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    for (const frag of data.fragments || []) {
      const text = fullText(frag.templateTokens);
      const c = countOcc(text, '결이');
      if (c > 0) {
        result.byCategory[cat].totalGyeori += c;
        result.byCategory[cat].fragments.push({
          file: path.relative(process.cwd(), file).replace(/\\/g, '/'),
          fragmentId: frag.fragmentId,
          count: c,
          text,
        });
      }
    }
  }
  // Sort by count descending
  result.byCategory[cat].fragments.sort((a, b) => b.count - a.count);
}
console.log(JSON.stringify(result, null, 2));
