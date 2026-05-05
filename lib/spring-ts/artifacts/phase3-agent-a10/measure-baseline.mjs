import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const MOVE_ROOT = path.join(ROOT, 'data', 'narrative', 'movement');

function listFragmentFiles(root) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop();
    if (!fs.existsSync(cur)) continue;
    for (const item of fs.readdirSync(cur, { withFileTypes: true })) {
      const p = path.join(cur, item.name);
      if (item.isDirectory()) stack.push(p);
      else if (item.name.endsWith('.fragments.json')) out.push(p);
    }
  }
  return out;
}

function tokensToText(tokens) {
  if (!Array.isArray(tokens)) return '';
  return tokens.map(t => {
    if (typeof t === 'string') return t;
    if (t.kind === 'text') return t.value || '';
    if (t.kind === 'slot') return `{${t.name || ''}}`;
    if (t.kind === 'tag') return `${t.text || t.tagId || ''}`;
    return '';
  }).join('');
}

function countHangulChars(text) {
  return Array.from(text).filter(c => /[가-힣]/.test(c)).length;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const files = listFragmentFiles(MOVE_ROOT);
const issues = [];
let total = 0;
let totalBriefFragments = 0;
let totalExpertFragments = 0;
const expertTagSet = new Set();
const expertTagCounter = {};
for (const f of files) {
  const json = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const frag of json.fragments || []) {
    total++;
    if (frag.axis?.depth === 'brief') totalBriefFragments++;
    if (frag.axis?.depth === 'expert') {
      totalExpertFragments++;
      for (const tag of frag.tags || []) {
        const tid = typeof tag === 'string' ? tag : tag?.id;
        if (tid) {
          expertTagSet.add(tid);
          expertTagCounter[tid] = (expertTagCounter[tid] || 0) + 1;
        }
      }
    }
    const tokens = frag.templateTokens || [];
    const text = tokensToText(tokens);
    if (frag.axis?.depth === 'brief') {
      const firstSentenceMatch = text.match(/^([^.!?]*[.!?])/);
      const headline = firstSentenceMatch ? firstSentenceMatch[1] : text;
      const len = countHangulChars(headline);
      if (len > 28) {
        issues.push({
          fragmentId: frag.fragmentId,
          file: path.relative(ROOT, f).replace(/\\/g, '/'),
          headlineLen: len,
          headline,
          fullText: text,
        });
      }
    }
  }
}

const counters = {};
const repWords = ['결이', '흐름이', '편이', '또렷', '단단', '한 박자', '페이스', '결을', '결로', '한결', '그림이', '모양이'];
for (const f of files) {
  const data = fs.readFileSync(f, 'utf8');
  for (const w of repWords) {
    const re = new RegExp(escapeRe(w), 'g');
    const m = data.match(re);
    counters[w] = (counters[w] || 0) + (m ? m.length : 0);
  }
}

console.log('Total fragments in movement:', total);
console.log('Total brief fragments:', totalBriefFragments);
console.log('Total expert fragments:', totalExpertFragments);
console.log('Brief headline >28자 violations:', issues.length);
issues.slice(0, 30).forEach(i => console.log(`  ${i.fragmentId} [${i.headlineLen}자] ${i.headline}`));
console.log('\n--- repetition counts (overlapping; 결이 also matches in 결이에요) ---');
for (const [w, c] of Object.entries(counters)) console.log(`  ${w}: ${c}`);
console.log('\n--- expert tier tagId distribution ---');
console.log('  unique tagIds:', expertTagSet.size);
const sorted = Object.entries(expertTagCounter).sort((a, b) => b[1] - a[1]);
sorted.forEach(([t, c]) => console.log(`  ${c.toString().padStart(3, ' ')}  ${t}`));

const outDir = path.join(ROOT, 'artifacts', 'phase3-agent-a10');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'baseline-summary.json'), JSON.stringify({
  totalFragments: total,
  totalBriefFragments,
  totalExpertFragments,
  briefHeadlineViolations: issues.length,
  violationDetails: issues,
  repetitionCounts: counters,
  expertTagUnique: expertTagSet.size,
  expertTagDistribution: Object.fromEntries(sorted),
}, null, 2), 'utf8');
console.log('\nSaved artifacts/phase3-agent-a10/baseline-summary.json');
