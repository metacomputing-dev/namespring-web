// Phase 3 agent A3 — academic category baseline measurement
// Run from lib/spring-ts: node artifacts/phase3-agent-a3/measure_baseline.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('data/narrative/academic');

function walkFiles(dir) {
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

function countKoreanChars(s) {
  return Array.from(s).filter(c => /[가-힣]/.test(c)).length;
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

function measure() {
  const files = walkFiles(ROOT);
  const trackedWords = ['결이', '결을', '결로', '결은', '결의', '결이에요', '한 결이',
                        '흐름이', '흐름은', '흐름을', '편이', '또렷', '단단', '한 박자', '페이스'];
  const wordCounts = Object.fromEntries(trackedWords.map(w => [w, 0]));
  const gatingAxisCounts = {};
  const tagCounts = {};
  const periodDepth = {};
  let totalFragments = 0;
  let briefFragments = 0;
  const briefViolations = [];

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    for (const frag of data.fragments || []) {
      totalFragments++;
      const text = fullText(frag.templateTokens);
      const period = frag.axis?.period || '?';
      const depth = frag.axis?.depth || '?';
      const key = `${period}.${depth}`;
      periodDepth[key] = (periodDepth[key] || 0) + 1;

      for (const w of trackedWords) {
        wordCounts[w] += countOccurrences(text, w);
      }

      if (frag.gating) {
        const axes = Object.keys(frag.gating).sort();
        const k = axes.join('+') || '(none)';
        gatingAxisCounts[k] = (gatingAxisCounts[k] || 0) + 1;
      }

      if (frag.tags) {
        for (const tag of frag.tags) {
          const tagId = typeof tag === 'string' ? tag : (tag && tag.tagId);
          if (tagId) tagCounts[tagId] = (tagCounts[tagId] || 0) + 1;
        }
      }

      if (depth === 'brief') {
        briefFragments++;
        const t = text;
        const len = countKoreanChars(t);
        if (len > 28) {
          briefViolations.push({
            fragmentId: frag.fragmentId,
            length: len,
            text: t.substring(0, 80),
          });
        }
      }
    }
  }

  return {
    totalFragments,
    briefFragments,
    briefViolations,
    wordCounts,
    gatingAxisCounts,
    tagCounts,
    periodDepth,
  };
}

const result = measure();
const out = {
  scope: 'data/narrative/academic',
  totalFragments: result.totalFragments,
  briefFragments: result.briefFragments,
  briefHeadlineViolations: result.briefViolations.length,
  violationDetails: result.briefViolations,
  repetitionCounts: result.wordCounts,
  gatingAxes: result.gatingAxisCounts,
  tagsUsed: result.tagCounts,
  periodDepth: result.periodDepth,
};

console.log(JSON.stringify(out, null, 2));
