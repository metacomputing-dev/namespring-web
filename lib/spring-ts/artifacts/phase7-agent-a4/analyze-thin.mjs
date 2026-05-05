#!/usr/bin/env node
/**
 * Per-fragment sentence-split analyzer for thin (1-paragraph) fragments.
 *
 * Output: phase7-agent-a4/thin-fragments-analysis.json
 *  - For each thin expert fragment, count natural Korean sentence
 *    endings (요./다./까./.) and report the bucket each would land in
 *    if we inserted `\n\n` between every sentence.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const NARRATIVE_DIR = path.join(ROOT, 'data', 'narrative');
const COVERAGE_DIR = path.join(NARRATIVE_DIR, '_coverage');

const CATEGORIES = [
  'academic', 'career', 'expression_children', 'family', 'health',
  'health_stress', 'movement', 'overall', 'romance', 'study_document', 'wealth',
];
const PERIODS = ['life', 'today', 'thisWeek', 'thisMonth', 'thisYear'];

function fragmentPlainText(fragment) {
  return fragment.templateTokens
    .map((t) => {
      if (t.kind === 'text') return t.value || '';
      if (t.kind === 'tag') return `#${t.label || t.tagId}`;
      if (t.kind === 'slot') return ' ';
      return '';
    })
    .join('');
}

function sourceParagraphCount(text) {
  if (!text.trim()) return 0;
  return text.split(/\n\n+/).map((s) => s.trim()).filter((s) => s.length > 0).length;
}

function splitSentences(text) {
  // Split on "요. ", "다. ", "까. ", "예요. ", "이에요. " — Korean polite/declarative endings
  // followed by space. Keep the sentence.
  const re = /([가-힣][요다까])\.(\s+)/g;
  const out = [];
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    const end = m.index + m[1].length + 1;
    out.push(text.slice(last, end).trim());
    last = end + m[2].length;
  }
  if (last < text.length) {
    const tail = text.slice(last).trim();
    if (tail) out.push(tail);
  }
  return out;
}

const result = { thinFragments: [], byBucket: { '1': 0, '2': 0, '3': 0, '4-8': 0, '9+': 0 } };

function processBundle(bundlePath, source) {
  const json = JSON.parse(fs.readFileSync(bundlePath, 'utf-8'));
  const fragments = json.fragments ?? [];
  for (const frag of fragments) {
    const axis = frag.axis ?? {};
    const isExpert = source.startsWith('_coverage/')
      ? axis.depth === 'expert'
      : true; // top-level expert.fragments.json files are all expert
    if (!isExpert) continue;
    const text = fragmentPlainText(frag);
    const cur = sourceParagraphCount(text);
    if (cur > 1) continue;
    const sents = splitSentences(text);
    let bucket = '1';
    if (sents.length === 2) bucket = '2';
    else if (sents.length === 3) bucket = '3';
    else if (sents.length >= 4 && sents.length <= 8) bucket = '4-8';
    else if (sents.length >= 9) bucket = '9+';
    result.byBucket[bucket] += 1;
    result.thinFragments.push({
      source,
      fragmentId: frag.fragmentId,
      currentParagraphs: cur,
      sentenceCount: sents.length,
      bucketIfSplit: bucket,
      textLen: text.length,
      shortestSentenceLen: Math.min(...sents.map((s) => s.length)),
    });
  }
}

for (const category of CATEGORIES) {
  for (const period of PERIODS) {
    const file = path.join(NARRATIVE_DIR, category, period, 'expert.fragments.json');
    if (fs.existsSync(file)) processBundle(file, `${category}/${period}/expert.fragments.json`);
  }
}
if (fs.existsSync(COVERAGE_DIR)) {
  for (const f of fs.readdirSync(COVERAGE_DIR)) {
    if (f.endsWith('.fragments.json')) processBundle(path.join(COVERAGE_DIR, f), `_coverage/${f}`);
  }
}

const out = path.join(__dirname, 'thin-fragments-analysis.json');
fs.writeFileSync(out, JSON.stringify(result, null, 2), 'utf-8');
console.log(`Wrote ${out}: thin total=${result.thinFragments.length}; bucketsIfSplit=${JSON.stringify(result.byBucket)}`);
