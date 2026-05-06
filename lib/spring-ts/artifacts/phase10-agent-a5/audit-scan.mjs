#!/usr/bin/env node
// Phase 10 Agent A5 audit scan v2.
// Reads prose-corpus.json and emits per-issue-category sample lists.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CORPUS = path.join(__dirname, 'prose-corpus.json');
const corpus = JSON.parse(fs.readFileSync(CORPUS, 'utf8'));
const records = corpus.records;

// ----------------------------------------------------------------
// Issue patterns
// ----------------------------------------------------------------

const issues = {
  template_leak: [],          // {{x}}, [x], <x>, $x, %x
  double_space: [],           // multiple consecutive spaces
  trailing_space: [],         // space before period or at line end
  empty_text: [],
  english_bleed: [],
  no_terminal_punct: [],
  particle_at_end: [],
  triple_punct: [],
  markdown_remain: [],        // **bold**, _italic_, [link]
  missing_jonseong: [],       // particles after noun ending mismatch (KR)
  cross_period_leak: [],      // mentions "이번 주" in life cell, "오늘" in week, etc.
  bare_number: [],            // numeric digit not formatted
  expert_no_tag: [],          // expert depth with NO #tag (ci already covers but recheck)
  duplicate_sentence_local: [],   // identical sentences within same prose
  cross_element_metaphor: [],     // wood metaphor in metal cell etc
  awkward_phrase: [],         // common awkward Korean
  numerical_placeholder: [],  // "X자리", "N번" raw placeholders
  hangul_typo: [],            // common typos
  raw_jamo: [],               // standalone consonants like ㅎ, ㅋ, ㅋㅋ
};

// Patterns
const TEMPLATE_LEAK = /\{\{[^}]*\}\}|\[[A-Za-z_][\w]*\]|<[A-Za-z_/][^>]*>|\$\{[^}]*\}|%[A-Za-z]+%/u;
const DOUBLE_SPACE = / {2,}/u;
const TRAILING_SPACE_DOT = / \./u;
const ENGLISH_4PLUS = /[a-zA-Z]{4,}/u;
const TRIPLE_PUNCT = /\.{3,}|\?{3,}|!{3,}/u;
const MARKDOWN = /\*\*[^*]+\*\*|^_[^_]+_$/u;
const RAW_JAMO = /\b[ㄱ-ㅎㅏ-ㅣ]+\b/u;
const TEMPLATE_PLACEHOLDER = /\{[a-zA-Z_]+\}|@@[a-zA-Z_]+@@|::[a-zA-Z_]+::/u;

// Acceptable terminal patterns (Korean polite + classical endings)
const VALID_TERMINAL = /(요\.|예요\.|돼요\.|에요\.|네요\.|이에요\.|아요\.|어요\.|지요\.|죠\.|군요\.|이죠\.|니다\.|습니다\.|있죠\.|봐요\.|해요\.|와요\.|있어요\.|없어요\.|로요\.|좋아요\.|어가요\.|이라고요\.|돼요!|예요!|네요!|좋아요!|봐요!|있어요!|돼요\?|예요\?|네요\?|있어요\?)$/u;

// More tolerant: sentence ends with hangul-final + punct OR ends with quotation closing
const ENDS_WITH_TERMINAL_HANGUL = /[가-힣][\.!\?]$/u;
const PARTICLE_AT_END = /[을를이가에서에는도과와의로으로]\.?$/u;

// Cross-period detection - require these as standalone phrases (no preceding/following hangul in same word)
const PERIOD_PHRASES = {
  today: ['오늘', '하루'],
  thisWeek: ['이번 주', '한 주', '주중'],
  thisMonth: ['이번 달', '한 달', '월중'],
  thisYear: ['올해', '한 해', '연중'],
  life: ['평생', '인생 전체', '한 평생'],
};

// Build period regex - ensure "한 해" doesn't match "예민한 해석"
// Use lookbehind/lookahead with non-hangul or word boundary
function periodTermRegex(term) {
  // term like '한 해' must end at non-letter/digit
  // Allow following: end-of-string, period, comma, space-followed-by-noun-stop, etc.
  return new RegExp(`(?<![가-힣])${term.replace(/ /g, '\\s+')}(?![가-힣])`);
}

const ALL_PERIOD_TERMS = new Set(Object.values(PERIOD_PHRASES).flat());

// Period-element cross check (heuristic): map dayMaster element from fixture
// to expected metaphor families.
const ELEMENT_KEYWORDS = {
  WOOD: ['나무', '뿌리', '가지', '줄기', '새싹', '잎', '숲', '봄'],
  FIRE: ['불꽃', '불씨', '불기운', '햇살', '한낮', '여름', '뜨거', '활활'],
  EARTH: ['흙', '땅', '대지', '진흙', '뿌리내려', '터전', '바위', '산'],
  METAL: ['쇠', '금속', '날', '단단', '날카', '검', '도구', '광택', '서늘'],
  WATER: ['물', '강', '호수', '바다', '비', '강줄기', '흐름', '샘', '겨울'],
};

// Read fixture metadata
const SAMPLES_DIR = path.resolve(__dirname, '..', 'sample-outputs-2026-05-05-phase3');
const fixtureMeta = new Map();
for (const file of fs.readdirSync(SAMPLES_DIR)) {
  if (!file.endsWith('.json')) continue;
  if (!/^\d{2}-/.test(file)) continue;
  try {
    const d = JSON.parse(fs.readFileSync(path.join(SAMPLES_DIR, file), 'utf8'));
    const dm = d?.payload?.tieredMatrix?.profile?.dayMasterElement
            ?? d?.payload?.sajuReport?.dayMaster?.element
            ?? d?.payload?.tieredMatrix?.headerSummary?.dayMasterElement;
    fixtureMeta.set(file, { dayMaster: dm });
  } catch {}
}

// Common Korean typos / awkward
const AWKWARD_PATTERNS = [
  { name: 'double_eo', re: /어어{1,}/u },
  { name: 'double_a', re: /아아{2,}/u },
  { name: 'double_i', re: /이이{2,}/u },
  // Removed spaced_particle - too many false positives (이 시기, 가다 가 봐, 한 가지 etc)
  { name: 'space_before_punct', re: /[ ]+[\.,;!?]/u },
  { name: 'comma_period', re: /,\./u },
  { name: 'period_comma', re: /\.,/u },
];

// Tag patterns in plain depth
const TAG_HASH = /#[가-힣A-Za-z0-9_]+/gu;

// Per-record scan
for (const r of records) {
  const text = r.plainText.trim();
  if (!text) {
    issues.empty_text.push(r);
    continue;
  }

  if (TEMPLATE_LEAK.test(text)) issues.template_leak.push({ ...r, match: text.match(TEMPLATE_LEAK)[0] });
  if (TEMPLATE_PLACEHOLDER.test(text)) issues.numerical_placeholder.push({ ...r, match: text.match(TEMPLATE_PLACEHOLDER)[0] });
  if (DOUBLE_SPACE.test(text)) issues.double_space.push(r);
  if (TRAILING_SPACE_DOT.test(text)) issues.trailing_space.push(r);
  if (TRIPLE_PUNCT.test(text)) issues.triple_punct.push(r);
  if (MARKDOWN.test(text)) issues.markdown_remain.push(r);
  if (RAW_JAMO.test(text)) issues.raw_jamo.push({ ...r, match: text.match(RAW_JAMO)[0] });

  const eng = text.match(ENGLISH_4PLUS);
  if (eng) issues.english_bleed.push({ ...r, match: eng[0] });

  // Terminal check: skip if multi-sentence (split by period, check last)
  const sentences = text.split(/(?<=[\.!\?])/u).map(s => s.trim()).filter(Boolean);
  const last = sentences[sentences.length - 1];
  if (last && !ENDS_WITH_TERMINAL_HANGUL.test(last)) {
    // not Korean sentence terminal
    if (!/[\)\]"'”’]+$/u.test(last)) {
      issues.no_terminal_punct.push({ ...r, last });
    }
  }
  for (const sent of sentences) {
    const trimmed = sent.replace(/[\.!\?]+$/u, '').trim();
    if (PARTICLE_AT_END.test(trimmed) && !VALID_TERMINAL.test(sent)) {
      // particle alone at sentence end is suspicious
      // but exclude cases where the particle is part of a longer ending
      const lastSyl = trimmed.slice(-1);
      // check if penultimate makes valid construct ('~로', '~의' often valid)
      if (/[을를]/u.test(lastSyl)) {
        issues.particle_at_end.push({ ...r, last: sent });
        break;
      }
    }
  }

  // Awkward
  for (const ap of AWKWARD_PATTERNS) {
    if (ap.re.test(text)) {
      issues.awkward_phrase.push({ ...r, kind: ap.name, match: text.match(ap.re)[0] });
      break;
    }
  }

  // Tags in plain depth (brief/standard should not have #tags)
  const tagMatches = text.match(TAG_HASH);
  if (r.depth !== 'expert') {
    if (tagMatches && tagMatches.length > 0) {
      issues.markdown_remain.push({ ...r, kind: 'plain_has_tag', tags: tagMatches });
    }
  }
  // expert_no_tag check moved to cell-level (see below)

  // Cross-period leak - use word-bounded regex to avoid false matches
  // Skip idiomatic uses: "하루 정도", "한 달 뒤", "한 주에 한", etc.
  const IDIOMATIC = /(하루\s*정도|한\s*달\s*뒤|한\s*주에\s*한|한\s*해\s*뒤|한\s*해의\s*큰|평생\s*가는|평생\s*시야|평생\s*자산|평생\s*기억|평생\s*무기)/u;
  const expectedTerms = PERIOD_PHRASES[r.period] ?? [];
  for (const [period, terms] of Object.entries(PERIOD_PHRASES)) {
    if (period === r.period) continue;
    for (const term of terms) {
      if (expectedTerms.includes(term)) continue;
      const re = periodTermRegex(term);
      if (re.test(text)) {
        // Allow life cells to mention any period (they're broadest)
        if (r.period === 'life') continue;
        // Allow figurative '평생' idioms in any cell
        if (term === '평생') continue;
        // Skip idiomatic uses
        if (IDIOMATIC.test(text)) continue;
        issues.cross_period_leak.push({ ...r, foundTerm: term, leakedFrom: period });
      }
    }
  }

  // Cross-element metaphor (heuristic)
  const fxMeta = fixtureMeta.get(r.fixture);
  if (fxMeta?.dayMaster) {
    for (const [el, kws] of Object.entries(ELEMENT_KEYWORDS)) {
      if (el === fxMeta.dayMaster) continue;
      for (const kw of kws) {
        if (text.includes(kw)) {
          issues.cross_element_metaphor.push({
            ...r,
            dayMaster: fxMeta.dayMaster,
            foundElement: el,
            keyword: kw,
          });
          break;
        }
      }
    }
  }

  // Bare numbers (digits not in 'N번', 'N자리' formal contexts)
  const bareNum = text.match(/(?<![\d])\d+(?!\d)/u);
  if (bareNum && !/[0-9]+개|[0-9]+번|[0-9]+자리|[0-9]+대|[0-9]+대[가-힣]|[0-9]+초/u.test(text)) {
    // not in common formal context
    // skip small (1-2 digit common)
    if (bareNum[0].length >= 3) {
      issues.bare_number.push({ ...r, match: bareNum[0] });
    }
  }
}

// Cell-level expert_no_tag check (aggregate paragraphs per cell)
const cellTexts = new Map();
for (const r of records) {
  if (r.depth !== 'expert') continue;
  const key = `${r.fixture}|${r.period}|${r.category}`;
  if (!cellTexts.has(key)) cellTexts.set(key, []);
  cellTexts.get(key).push(r);
}
for (const [key, paragraphs] of cellTexts.entries()) {
  const allText = paragraphs.map(p => p.plainText).join(' ');
  if (!TAG_HASH.test(allText)) {
    // Reset regex (global) and re-test
    TAG_HASH.lastIndex = 0;
    const tagMatches = allText.match(TAG_HASH);
    if (!tagMatches || tagMatches.length === 0) {
      issues.expert_no_tag.push({ key, paragraphCount: paragraphs.length, sample: paragraphs[0] });
    }
  }
}

// Local duplicate sentences (within same plainText)
for (const r of records) {
  const sents = r.plainText
    .split(/(?<=[\.!\?])/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);
  const seen = new Set();
  for (const s of sents) {
    if (seen.has(s)) {
      issues.duplicate_sentence_local.push({ ...r, sentence: s });
      break;
    }
    seen.add(s);
  }
}

// Summary
const summary = {};
for (const [cat, items] of Object.entries(issues)) {
  summary[cat] = items.length;
}

const out = path.join(__dirname, 'audit-issues.json');
fs.writeFileSync(out, JSON.stringify({ summary, issues }, null, 2));

console.log('Issue counts:');
for (const [cat, n] of Object.entries(summary).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${cat.padEnd(28)} ${n}`);
}
console.log(`\noutput: ${out}`);
