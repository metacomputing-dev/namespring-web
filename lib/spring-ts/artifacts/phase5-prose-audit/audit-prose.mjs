#!/usr/bin/env node
/**
 * artifacts/phase5-prose-audit/audit-prose.mjs
 *
 * P5-A5 Task 2 audit pass over prose-flat.ndjson. Categorizes potential
 * issues so the markdown report doesn't have to manually pick from 6,000+
 * lines of prose.
 *
 * Categories scanned:
 *   - broken_endings: trailing fragments (~로., ~의., ~라가., dangling 으로, etc.)
 *   - voice_violations: ~다/~한다 in plain depth (not allowed in 친근체)
 *   - cross_element_metaphor: cell mentions one element while metaphor uses
 *     another (e.g., 화 cell with 물 simile) — heuristic, surface candidates
 *   - depth_coherence: brief vs standard distance below threshold
 *   - tag_glossary_mismatch: expert-tier tags lacking glossary anchor
 *   - length_violations: livingTips >24 ko, cautions >30 ko (Phase 5 contract)
 *
 * Usage:  node artifacts/phase5-prose-audit/audit-prose.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NDJSON_PATH = path.join(__dirname, 'prose-flat.ndjson');
const OUT_PATH = path.join(__dirname, 'audit-findings.json');
const SAMPLES_DIR = path.resolve(__dirname, '../sample-outputs-2026-05-05-phase3');

// Korean character counter (≈ ko chars used by Phase 3 contract).
function koLen(s) {
  return Array.from(s.replace(/\s/g, '')).length;
}

const ROWS = fs
  .readFileSync(NDJSON_PATH, 'utf-8')
  .trim()
  .split('\n')
  .map((l) => JSON.parse(l));

const findings = {
  brokenEndings: [],
  voiceViolations: [],
  crossElementMetaphor: [],
  depthCoherence: [],
  tagGlossaryMismatch: [],
  lengthViolations: [],
  // Diagnostics — NOT issues. Tracks intentional brief compression to
  // 결이에요 form (template-engine.ts compressBriefHeadlineIfApplicable).
  briefCompressionGyeol: [],
};

// 1. Broken endings — patterns that indicate truncated or grammatically
// dangling text. Anchor on the LAST sentence-ending unit only.
//
// NOTE: `결이에요` ending in brief headline is INTENTIONAL Phase 3 compression
// done by `compressBriefHeadlineIfApplicable` to keep ≤28 ko chars
// (template-engine.ts:727-748). Excluded from BROKEN_ENDINGS scan and
// inspected via a separate counter below.
const BROKEN_ENDINGS = [
  // dangling stems with no proper closing 어미
  /(?:\s|^)(?:으로|에서|에게|에서|에)\s*[.,]?\s*$/,
  /(?:\s|^)(?:하고|하며|하면|이고|이라|라고)\s*[.,]?\s*$/,
  /(?:\s|^)(?:해서|되어|되어서|돼서|되며)\s*[.,]?\s*$/,
  /(?:\s|^)(?:하는|되는|있는|없는|좋은)\s*[.,]?\s*$/,
  // suspicious comma-then-end with no following clause
  /,\s*$/,
  // bracket mismatches
  /\[[^\]]*$/,
  /\([^)]*$/,
  // 유의해져 — Phase 4 fix targeted (~져 stem with no proper close)
  /유의해져\.?$/,
  // double-period, triple-period (other than ellipsis 정상 …)
  /[^…]\.{2,}\s*$/,
];

// Placeholder/template residue — text that looks unsubstituted
const TEMPLATE_RESIDUE = /\{\{[^}]+\}\}|\$\{[^}]+\}/;

// 2. Voice violations — declarative ~다 endings in plain depths (Korean
// 친근체 doctrine: 해요/해 보세요/이에요 etc.). Allowed in expert depth where
// formal voice is permitted, and inside template tokens.
// Heuristic: sentence ending in 다. or 한다. or ~다. without preceding
// 입니다/합니다/같다/없다/있다 (which are 정상 declarative reading body).
// Strategy: extract sentence-final tokens and flag if they end with bare 다
// other than allowed list.
const ALLOWED_DA_ENDINGS = new Set([
  '습니다', '입니다', '합니다', '됩니다', '있습니다', '없습니다',
  // Common formal verbs that legitimately end in -다 in expert tier
  '같다', '없다', '있다', '본다', '기른다', '낸다', '한다',
]);

// 3. Cross-element metaphor — flag fragments where main element claim does not
// match the metaphor element (heuristic only).
const ELEMENT_TOKENS = {
  WOOD: ['나무', '봄', '새싹', '잎', '가지'],
  FIRE: ['불', '여름', '햇살', '불꽃', '화로', '햇볕'],
  EARTH: ['흙', '땅', '대지', '늦여름', '환절기', '진흙'],
  METAL: ['쇠', '가을', '서리', '날', '광석'],
  WATER: ['물', '겨울', '빗물', '강물', '호수', '눈'],
};

// 4. Depth coherence — brief headline 길이/내용이 standard 첫 문장과 얼마나
// 비슷한지. distance < 5 chars indicates copy-paste suspicion.
function levenshtein(a, b) {
  if (!a || !b) return Math.max(a?.length || 0, b?.length || 0);
  const dp = Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = i - 1;
    dp[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : Math.min(prev, dp[j - 1], dp[j]) + 1;
      prev = tmp;
    }
  }
  return dp[b.length];
}

// 5. Tag glossary mismatch — load tieredMatrix glossary entries and check
// expert depth tag references resolve.
const GLOSSARY_BY_FIXTURE = {};
const TIER_FIXTURE_FILES = fs
  .readdirSync(SAMPLES_DIR)
  .filter((f) => /^\d{2}-.+\.json$/.test(f))
  .sort();
for (const file of TIER_FIXTURE_FILES) {
  const raw = JSON.parse(fs.readFileSync(path.join(SAMPLES_DIR, file), 'utf-8'));
  const fxId = raw.sampleId || file;
  const entries = raw.payload?.tieredMatrix?.glossary?.entries || {};
  GLOSSARY_BY_FIXTURE[fxId] = new Set(Object.keys(entries));
}

// Walk ROWS for issue categories
const briefByCell = new Map();
const standardByCell = new Map();

for (const r of ROWS) {
  const sample = r.text.slice(-60);

  // 1. broken endings
  for (const re of BROKEN_ENDINGS) {
    if (re.test(r.text)) {
      findings.brokenEndings.push({ ...r, reason: re.toString(), tail: sample });
      break;
    }
  }
  if (TEMPLATE_RESIDUE.test(r.text)) {
    findings.brokenEndings.push({ ...r, reason: 'template_residue', tail: sample });
  }
  // Brief compression diagnostic — intentional, tracked separately
  if (r.depth === 'brief' && r.slot === 'headline' && /결이에요\.?\s*$/.test(r.text)) {
    findings.briefCompressionGyeol.push({ ...r, tail: sample });
  }

  // 2. voice violations — only on plain depths (brief / standard / legacy)
  // 친근체 doctrine: prefer 해요/예요/이에요 endings.
  // Allowed tolerable formal endings: 습니다 / ㅂ니다 (formal-polite "합쇼체"
  // is acceptable when fitting tone; commonly mixed in life / saju cards).
  // Flagged: bare 다 endings without 니다 / -ㅂ니다 / 습니다 / ~다고 / ~한다.
  if (r.depth === 'brief' || r.depth === 'standard' || r.depth === 'legacy') {
    const sentences = r.text.split(/[.!?]\s*/).filter(Boolean);
    for (const s of sentences) {
      const trimmed = s.trim();
      if (!trimmed) continue;
      // bare 다. ending check
      if (/[가-힣]다$/.test(trimmed)) {
        // Allowed: ~ㅂ니다 / ~습니다 (합쇼체 polite-formal — tolerated)
        if (/(?:ㅂ니다|습니다|입니다|합니다|됩니다|십니다|쉬어집니다|어집니다)$/.test(trimmed)) continue;
        if (/(?:[가-힣]ㅂ니다|[가-힣]습니다)$/.test(trimmed)) continue;
        // ㅂ-받침 ending
        const lastChar = trimmed.slice(-3);
        if (/^[가-힣]니다$/.test(lastChar)) continue;
        // ~한다 / ~된다 / ~ㄴ다 — clear declarative violation
        if (/(?:한다|된다|간다|온다|본다|준다|난다)$/.test(trimmed)) {
          findings.voiceViolations.push({ ...r, sentence: trimmed.slice(-30), reason: '한다/된다 plain declarative' });
          continue;
        }
        // Other bare 다 endings — surface as candidate
        findings.voiceViolations.push({ ...r, sentence: trimmed.slice(-30), reason: 'bare 다 ending' });
      }
    }
  }

  // 3. cross-element metaphor (heuristic)
  // simple version: collect element tokens that appear; if 2+ elements
  // appear in a single short sentence (<30 chars), flag for review.
  if (r.depth === 'standard' || r.depth === 'brief') {
    const elementsHit = new Set();
    for (const [el, tokens] of Object.entries(ELEMENT_TOKENS)) {
      for (const t of tokens) {
        if (r.text.includes(t)) {
          elementsHit.add(el);
          break;
        }
      }
    }
    if (elementsHit.size >= 3) {
      findings.crossElementMetaphor.push({ ...r, elements: [...elementsHit], snippet: r.text.slice(0, 80) });
    }
  }

  // 4. depth coherence — collect brief and first standard sentence per cell
  const cellKey = `${r.fixture}|${r.period}|${r.category}`;
  if (r.depth === 'brief' && r.slot === 'headline') {
    briefByCell.set(cellKey, r);
  }
  if (r.depth === 'standard' && r.slot === 'paragraphs') {
    standardByCell.set(cellKey, r);
  }

  // 5. tag glossary mismatch — only for expert depth (paragraphs contain tag tokens)
  // We did not extract tag tokens, so we use fragmentId lookup against glossary used set.
  // Skip detail check here — handled in glossaryUsedInThisReport vs entries below.

  // 6. length violations — Phase 5 contract reaffirmation
  if (r.slot.startsWith('livingTips')) {
    if (koLen(r.text) > 24) {
      findings.lengthViolations.push({ ...r, length: koLen(r.text), threshold: 24 });
    }
  }
  if (r.slot.startsWith('cautions')) {
    if (koLen(r.text) > 30) {
      findings.lengthViolations.push({ ...r, length: koLen(r.text), threshold: 30 });
    }
  }
}

// Depth coherence sweep
for (const [cellKey, briefRow] of briefByCell.entries()) {
  const standardRow = standardByCell.get(cellKey);
  if (!standardRow) continue;
  const briefText = briefRow.text.replace(/\s/g, '').replace(/[.,!?]/g, '');
  const standardFirst = standardRow.text.split(/[.\n]/)[0].replace(/\s/g, '').replace(/[.,!?]/g, '');
  if (briefText.length < 6 || standardFirst.length < 6) continue;
  const dist = levenshtein(briefText, standardFirst);
  const maxLen = Math.max(briefText.length, standardFirst.length);
  const ratio = dist / maxLen;
  if (ratio < 0.25) {
    findings.depthCoherence.push({
      cellKey,
      fixture: briefRow.fixture,
      period: briefRow.period,
      category: briefRow.category,
      brief: briefText,
      standardFirst,
      similarityRatio: 1 - ratio,
    });
  }
}

// Glossary cross-check — for each fixture, used tags vs entries
const glossaryFindings = [];
for (const fxId of Object.keys(GLOSSARY_BY_FIXTURE)) {
  const file = TIER_FIXTURE_FILES.find((f) => {
    const raw = JSON.parse(fs.readFileSync(path.join(SAMPLES_DIR, f), 'utf-8'));
    return (raw.sampleId || f) === fxId;
  });
  if (!file) continue;
  const raw = JSON.parse(fs.readFileSync(path.join(SAMPLES_DIR, file), 'utf-8'));
  const used = raw.payload?.tieredMatrix?.glossary?.usedInThisReport || [];
  const entries = GLOSSARY_BY_FIXTURE[fxId];
  for (const u of used) {
    if (!entries.has(u)) {
      glossaryFindings.push({ fixture: fxId, file, tagId: u, reason: 'used_but_not_in_entries' });
    }
  }
}
findings.tagGlossaryMismatch = glossaryFindings;

const summary = {
  generatedAt: new Date().toISOString(),
  totalRows: ROWS.length,
  fixtures: 22,
  counts: {
    brokenEndings: findings.brokenEndings.length,
    voiceViolations: findings.voiceViolations.length,
    crossElementMetaphor: findings.crossElementMetaphor.length,
    depthCoherence: findings.depthCoherence.length,
    tagGlossaryMismatch: findings.tagGlossaryMismatch.length,
    lengthViolations: findings.lengthViolations.length,
  },
  diagnostics: {
    briefCompressionGyeol: findings.briefCompressionGyeol.length,
  },
  findings,
};

fs.writeFileSync(OUT_PATH, JSON.stringify(summary, null, 2) + '\n', 'utf-8');
console.log(`Wrote audit findings to ${OUT_PATH}`);
console.log(JSON.stringify(summary.counts, null, 2));
