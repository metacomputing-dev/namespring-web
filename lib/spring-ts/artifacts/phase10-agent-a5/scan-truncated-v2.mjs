#!/usr/bin/env node
// Broader truncation scan: word stem + 요. with no preceding valid copula/verb form.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NARRATIVE_ROOT = path.resolve(__dirname, '..', '..', 'data', 'narrative');

function* walkJsonFiles(dir, root = '') {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const f = path.join(dir, e.name);
    const r = path.join(root, e.name);
    if (e.isDirectory()) yield* walkJsonFiles(f, r);
    else if (e.name.endsWith('.json')) yield { full: f, rel: r };
  }
}

function* walkText(node, trail) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) yield* walkText(node[i], [...trail, i]);
    return;
  }
  for (const [k, v] of Object.entries(node)) {
    if ((k === 'value' || k === 'headline') && typeof v === 'string') {
      yield { trail: [...trail, k], text: v };
    }
    yield* walkText(v, [...trail, k]);
  }
}

const SCOPE = ['_coverage', 'overall', 'career', 'wealth', 'health', 'health_stress', 'romance', 'family', 'academic', 'study_document', 'expression_children', 'movement'];

// Extract every '~요.' ending and check the preceding 1-3 chars
// Valid: 예요, 이에요, 돼요, 네요, 군요, 죠, 봐요, 해요, 와요, 가요, 아요, 어요, 지요, 좋아요, 싶어요...
// Invalid: anything ending in noun + 요 directly

const VALID_RYO_PRECEDERS = new Set([
  '예', '에', '돼', '네', '군', '와', '가', '봐', '해', '아', '어', '지', '죠',
  '좋아', '싫어', '있어', '없어', '왔어', '갔어', '됐어', '했어', '봤어',
  '싶어', '나아', '고와', '추워', '더워', '가져', '들어', '먹어', '쉬어',
  '내려', '올라', '돌아', '나와', '들여', '나누어', '받아', '맞아', '닦아',
  '단단해', '편안해', '확실해', '소중해', '필요해', '간단해', '깔끔해',
  '잘해', '못해', '괜찮아', '평안해',
]);

const records = [];
let filesScanned = 0;
let totalRyoEndings = 0;

for (const top of SCOPE) {
  const dir = path.join(NARRATIVE_ROOT, top);
  if (!fs.existsSync(dir)) continue;
  for (const file of walkJsonFiles(dir, top)) {
    filesScanned++;
    let data;
    try { data = JSON.parse(fs.readFileSync(file.full, 'utf8')); }
    catch { continue; }
    for (const item of walkText(data, [])) {
      const text = item.text;
      // Find all '~요.' or '~요!' or '~요?' positions
      let m;
      const re = /([가-힣]{1,4})요[.!?]/gu;
      while ((m = re.exec(text)) !== null) {
        totalRyoEndings++;
        const stem = m[1];
        // Check if any valid preceder ending matches stem suffix
        let valid = false;
        for (let n = 1; n <= 4; n++) {
          if (stem.length >= n && VALID_RYO_PRECEDERS.has(stem.slice(-n))) {
            valid = true;
            break;
          }
        }
        if (!valid) {
          records.push({
            file: file.rel,
            stem,
            match: m[0],
            text: text.slice(0, 200),
          });
        }
      }
    }
  }
}

const out = path.join(__dirname, 'truncated-endings-v2.json');
fs.writeFileSync(out, JSON.stringify({ filesScanned, totalRyoEndings, count: records.length, records }, null, 2));

console.log(`Files: ${filesScanned}, total ~요 endings: ${totalRyoEndings}`);
console.log(`Suspicious: ${records.length}`);
const stemCounts = {};
records.forEach(r => stemCounts[r.stem] = (stemCounts[r.stem] || 0) + 1);
const sorted = Object.entries(stemCounts).sort((a, b) => b[1] - a[1]);
console.log('Top suspicious stems:');
sorted.slice(0, 20).forEach(([stem, n]) => console.log(`  ${stem}: ${n}`));

console.log(`\noutput: ${out}`);
