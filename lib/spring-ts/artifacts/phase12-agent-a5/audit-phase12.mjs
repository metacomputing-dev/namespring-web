#!/usr/bin/env node
// Phase 12 Agent A5 - Comprehensive narrative audit
//
// Runs detectors targeting 7 audit categories:
//   1. word repetition (within-paragraph 3+ char immediate repeat)
//   2. awkward phrasing (curated patterns; partner with P12-A1)
//   3. audience leak (adult vocab in child/teen fixture cells)
//   4. depth coherence (length inversion)
//   5. Korean grammar (curated regexes)
//   6. tag-glossary mismatch (residual after P11-A1 / A5 / P12-A3)
//   7. brief.hook usage (read-only; never populated -> recommendation)
//
// Reads:
//   - prose-corpus.json (11,099 prose units across 32 fixtures)
//
// Outputs: phase12-audit-issues.json with per-detector hits.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const corpusPath = path.join(__dirname, 'prose-corpus.json');
const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));

// Build fixture audience map
const audienceTier = (age) => {
  if (age == null) return 'unknown';
  if (age <= 4) return 'infant';
  if (age <= 9) return 'child';
  if (age <= 13) return 'preteen';
  if (age <= 19) return 'teen';
  if (age <= 70) return 'adult';
  return 'senior';
};

const fixtureAudience = new Map();
for (const fx of corpus.fixtures) {
  const birth = fx.birth;
  const age = birth ? 2026 - birth.year : null;
  fixtureAudience.set(fx.fixture, audienceTier(age));
}

// ---------- (1) Word repetition (curated false-positive filter) ----------
//
// Detect adjacent identical 3-5 char Korean substrings within 0-3 chars.
// False-positive filter: skip "흐름이 ... 흐름이" within parallel construction
// (separated by topic-switching punct or coordinating conjunctions).
function detectWordRepeat(text) {
  const hits = [];
  // 3-4 char repeats with 0-2 chars between (immediate, not distant)
  const re = /([가-힣]{3,4})[^가-힣]{0,2}\1/g;
  let m;
  const STOP = new Set([
    '있어요', '없어요', '있는', '없는', '같이', '같은',
    '오늘은', '오늘의', '이번', '한해', '한번',
  ]);
  while ((m = re.exec(text))) {
    const word = m[1];
    if (STOP.has(word)) continue;
    // skip if both occurrences are part of a hashtag (rare but possible)
    const before = m.index > 0 ? text[m.index - 1] : '';
    if (before === '#') continue;
    hits.push({
      word,
      excerpt: text.substring(Math.max(0, m.index - 15), Math.min(text.length, m.index + word.length * 2 + 15)),
    });
  }
  return hits;
}

// ---------- (2) Awkward phrasing (curated patterns) ----------
const AWKWARD_PATTERNS = [
  // unnatural compound
  { id: 'redundant_kwa', pattern: /(과|와) 함께 함께/g, label: '과/와 함께 함께' },
  { id: 'doubled_geu', pattern: /그 그 /g, label: '그 그' },
  // double connective
  { id: 'doubled_conjunction', pattern: /그리고 그리고/g, label: '그리고 그리고' },
  // awkward `이 자리, 이 시기` repeated
  { id: 'i_jari_repeat', pattern: /이 자리, 이 자리/g, label: '이 자리, 이 자리' },
  // `를 를` / `을 을` particle repeat
  { id: 'particle_repeat_eul', pattern: /([가-힣])을 \1을 /g, label: 'X을 X을' },
];

function detectAwkward(text) {
  const hits = [];
  for (const { id, pattern, label } of AWKWARD_PATTERNS) {
    const cloned = new RegExp(pattern.source, pattern.flags);
    let m;
    while ((m = cloned.exec(text))) {
      hits.push({
        type: id,
        label,
        excerpt: text.substring(Math.max(0, m.index - 15), Math.min(text.length, m.index + (m[0]?.length ?? 6) + 15)),
      });
    }
  }
  return hits;
}

// ---------- (3) Audience leak ----------
// Adult-only vocabulary (career/finance/marriage) in child/preteen fixtures.
const ADULT_VOCAB = [
  // marriage / romance
  '결혼', '혼인', '배우자', '소개팅', '맞선',
  // career / finance
  '연봉', '재테크', '대출', '주식', '투자', '계약서',
  '취업', '이직', '승진', '인사 평가', '입찰', '매출',
  '영업', '직장', '상사', '회식', '계약',
  '구직', '실적', '매장', '인센티브', '보너스', '성과급',
];
function detectAudienceLeak(text, audience) {
  if (audience !== 'infant' && audience !== 'child' && audience !== 'preteen') return [];
  const hits = [];
  for (const word of ADULT_VOCAB) {
    let idx = text.indexOf(word);
    while (idx >= 0) {
      const before = idx > 0 ? text[idx - 1] : '';
      const after = idx + word.length < text.length ? text[idx + word.length] : '';
      // word boundary: before is not a Korean syllable (compound prefix)
      const beforeSyl = /[가-힣]/.test(before);
      const afterSyl = /[가-힣]/.test(after);
      // accept only when no compound-formation around
      const isStandalone = !beforeSyl && (!afterSyl || /^[은는이가을를의에도만으로에서과와도]/.test(after));
      if (isStandalone) {
        hits.push({
          word,
          audience,
          excerpt: text.substring(Math.max(0, idx - 20), Math.min(text.length, idx + 30)),
        });
      }
      idx = text.indexOf(word, idx + 1);
    }
  }
  return hits;
}

// ---------- (4) Depth length inversion ----------
function detectDepthInversion(records, fixtureName) {
  const hits = [];
  const groups = new Map();
  for (const r of records) {
    if (r.fixture !== fixtureName) continue;
    const key = r.period + '/' + r.category;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  for (const [key, items] of groups) {
    const briefH = items.find((x) => x.depth === 'brief' && x.slot === 'headline');
    const standardP0 = items.find((x) => x.depth === 'standard' && (x.slot === 'plain' || x.slot === 'para0'));
    if (!briefH || !standardP0) continue;
    if (briefH.plainText.length > standardP0.plainText.length) {
      hits.push({
        cellKey: key,
        briefLen: briefH.plainText.length,
        standardLen: standardP0.plainText.length,
        brief: briefH.plainText.substring(0, 80),
        standard: standardP0.plainText.substring(0, 80),
      });
    }
  }
  return hits;
}

// ---------- (5) Korean grammar (curated, conservative) ----------
const GRAMMAR_PATTERNS = [
  // a. comma followed by hanging particle
  // false positive: 시기에는, 가족 등 — these are mid-sentence connectives
  // disabled for now; re-enable with stronger context check
  // b. mid-sentence "다." then hangul lowercase (broken sentence)
  { id: 'mid_period_then_hangul', pattern: /다\. (?=[가-힣])/g, label: '다. 한글' },
  // c. duplicated terminal punctuation
  { id: 'doubled_terminal_punct', pattern: /\.\.|\?\?|!!/g, label: '중복 종결' },
  // d. comma immediately before terminal punctuation
  { id: 'comma_before_terminal', pattern: /,[\s]*\./g, label: ', .' },
  // e. trailing space inside text rendered to user (rendering quirk)
  // skip — happens at fragment edges
];

function detectGrammarIssues(text) {
  const hits = [];
  for (const { id, pattern, label } of GRAMMAR_PATTERNS) {
    const cloned = new RegExp(pattern.source, pattern.flags);
    let m;
    while ((m = cloned.exec(text))) {
      // Filter mid_period_then_hangul: many fragments concatenate sentences
      // "X예요. 한 번..." which is ALWAYS valid Korean (period + space + new
      // sentence). Only flag when no space follows the period.
      if (id === 'mid_period_then_hangul') {
        // The pattern already requires no space (no `\s` in the regex), so
        // this fires only on no-space-after-period — which is a real issue.
        // But check: the pattern is `다\. (?=[가-힣])` -- includes a literal
        // space, so this is NORMAL prose. Skip.
        continue;
      }
      hits.push({
        type: id,
        label,
        excerpt: text.substring(Math.max(0, m.index - 20), Math.min(text.length, m.index + 25)),
      });
    }
  }
  // Re-add: period-then-no-space (no whitespace between sentences)
  const reBadPeriod = /[가-힣]\.[가-힣]/g;
  let m;
  while ((m = reBadPeriod.exec(text))) {
    hits.push({
      type: 'period_then_no_space',
      label: '다.한글',
      excerpt: text.substring(Math.max(0, m.index - 15), Math.min(text.length, m.index + 20)),
    });
  }
  return hits;
}

// ---------- (6) Tag-glossary mismatch (residual after P11-A1/A5, P12-A3) ----------
// Bare label appearing in text where the same fragment uses the tag form
// elsewhere. Restrict to multi-syllable labels that are unlikely substrings
// of other glossary terms (to avoid 용신/식신 false positives where the
// labels are suffixes of compound terms 통관용신/조후용신/장생식신 etc.).

function loadGlossary() {
  const dir = path.resolve(__dirname, '..', '..', 'data', 'narrative', '_glossary');
  const labels = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    let j;
    try {
      j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    } catch {
      continue;
    }
    const entries = j.entries || j.items || [];
    for (const e of entries) {
      if (e.label && /^[가-힣]+$/.test(e.label) && e.label.length >= 3) {
        labels.push(e.label);
      }
    }
  }
  return labels;
}

const ALL_LABELS = loadGlossary();
// build label superset for substring check: a label is "ambiguous" if any
// other label ends with it (e.g., 용신 is a suffix of 통관용신).
const labelSet = new Set(ALL_LABELS);
const ambiguousLabels = new Set();
for (const a of ALL_LABELS) {
  for (const b of ALL_LABELS) {
    if (a !== b && b.endsWith(a)) ambiguousLabels.add(a);
  }
}
const SAFE_LABELS = ALL_LABELS.filter((l) => !ambiguousLabels.has(l));

function detectBareLabel(text) {
  const hits = [];
  for (const label of SAFE_LABELS) {
    // Find label not preceded by `#` and followed by 의 + a glossary stem
    const re = new RegExp(`(^|[^#가-힣])(${label})의\\s*(결과|결이|자리|흐름|신호|기운)`, 'g');
    let m;
    while ((m = re.exec(text))) {
      hits.push({
        label,
        stem: m[3],
        excerpt: text.substring(Math.max(0, m.index - 15), Math.min(text.length, m.index + 30)),
      });
    }
  }
  return hits;
}

// ---------- (7) Hook usage placeholder ----------
// Not detected from corpus; analyzed structurally in audit doc (brief.hook
// is declared on `BriefFortuneText` but no hookSlot data flows through src/).

// ---------- Run ----------

const detectorHits = {
  word_repeat: [],
  awkward_phrase: [],
  audience_leak: [],
  korean_grammar: [],
  depth_inversion: [],
  bare_glossary_label: [],
};

for (const r of corpus.records) {
  const audience = fixtureAudience.get(r.fixture);
  const text = r.plainText;
  const baseRecord = {
    fixture: r.fixture,
    period: r.period,
    category: r.category,
    depth: r.depth,
    slot: r.slot,
  };

  for (const h of detectWordRepeat(text)) {
    detectorHits.word_repeat.push({ ...baseRecord, ...h });
  }
  for (const h of detectAwkward(text)) {
    detectorHits.awkward_phrase.push({ ...baseRecord, ...h });
  }
  for (const h of detectAudienceLeak(text, audience)) {
    detectorHits.audience_leak.push({ ...baseRecord, ...h });
  }
  for (const h of detectGrammarIssues(text)) {
    detectorHits.korean_grammar.push({ ...baseRecord, ...h });
  }
  for (const h of detectBareLabel(text)) {
    detectorHits.bare_glossary_label.push({ ...baseRecord, ...h });
  }
}

const fixtureNames = Array.from(new Set(corpus.records.map((r) => r.fixture)));
for (const fx of fixtureNames) {
  for (const h of detectDepthInversion(corpus.records, fx)) {
    detectorHits.depth_inversion.push({ fixture: fx, ...h });
  }
}

const summary = {};
for (const [k, v] of Object.entries(detectorHits)) {
  summary[k] = v.length;
}
summary.totalRecords = corpus.records.length;
summary.fixtureCount = fixtureNames.length;
summary.glossaryLabelsLoaded = ALL_LABELS.length;
summary.glossaryLabelsSafe = SAFE_LABELS.length;
summary.glossaryLabelsAmbiguous = ambiguousLabels.size;

console.log('Phase 12 audit summary:');
console.log(JSON.stringify(summary, null, 2));

const outPath = path.join(__dirname, 'phase12-audit-issues.json');
fs.writeFileSync(outPath, JSON.stringify({ summary, detectorHits }, null, 2));
console.log('output:', outPath);
