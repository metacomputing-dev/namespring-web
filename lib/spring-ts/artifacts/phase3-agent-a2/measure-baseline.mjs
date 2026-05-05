import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const HEALTH_ROOT = path.join(ROOT, 'data', 'narrative', 'health');

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

const files = listFragmentFiles(HEALTH_ROOT);
const issues = [];
let total = 0;
let totalBriefFragments = 0;
for (const f of files) {
  const json = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const frag of json.fragments || []) {
    total++;
    if (frag.axis?.depth === 'brief') totalBriefFragments++;
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
const repWords = ['결이', '흐름이', '편이', '또렷', '단단', '한 박자', '페이스', '결을', '결로', '한결'];
for (const f of files) {
  const data = fs.readFileSync(f, 'utf8');
  for (const w of repWords) {
    const re = new RegExp(escapeRe(w), 'g');
    const m = data.match(re);
    counters[w] = (counters[w] || 0) + (m ? m.length : 0);
  }
}

console.log('Total fragments in health:', total);
console.log('Total brief fragments:', totalBriefFragments);
console.log('Brief headline >28자 violations:', issues.length);
console.log('Examples (first 30):');
issues.slice(0, 30).forEach(i => console.log(`  ${i.fragmentId} [${i.headlineLen}자] ${i.headline}`));
console.log('\n--- repetition counts ---');
for (const [w, c] of Object.entries(counters)) console.log(`  ${w}: ${c}`);

fs.writeFileSync('artifacts/phase3-agent-a2/baseline-summary.json', JSON.stringify({
  totalFragments: total,
  totalBriefFragments,
  briefHeadlineViolations: issues.length,
  violationDetails: issues,
  repetitionCounts: counters,
}, null, 2), 'utf8');
console.log('\nSaved artifacts/phase3-agent-a2/baseline-summary.json');
