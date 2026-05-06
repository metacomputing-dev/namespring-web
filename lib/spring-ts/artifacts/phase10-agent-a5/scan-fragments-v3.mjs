#!/usr/bin/env node
// v3 — broader nuance scan: voice mismatch, awkward connectors, etc.
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

function getDepth(file) {
  if (file.includes('expert')) return 'expert';
  if (file.includes('plain')) return 'plain';
  if (file.includes('brief')) return 'brief';
  if (file.includes('standard')) return 'standard';
  return 'unknown';
}

function* walkFragments(node, depth = null) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const x of node) yield* walkFragments(x, depth);
    return;
  }
  if (node.axis?.depth) {
    yield { fragment: node, depth: node.axis.depth };
  }
  for (const v of Object.values(node)) {
    if (v && typeof v === 'object') yield* walkFragments(v, depth);
  }
}

const records = {
  unbalanced_paren: [],
  unbalanced_quote: [],
  hashtag_in_plain: [],
  english_in_plain: [],
  trailing_only_token: [],
  bare_terminal: [],
  weird_token_seq: [],
  english_unicode: [],
};

const SCOPE = ['_coverage', 'overall', 'career', 'wealth', 'health', 'health_stress', 'romance', 'family', 'academic', 'study_document', 'expression_children', 'movement'];

let bundleCount = 0;
let fragmentCount = 0;

for (const top of SCOPE) {
  const dir = path.join(NARRATIVE_ROOT, top);
  if (!fs.existsSync(dir)) continue;
  for (const file of walkJsonFiles(dir, top)) {
    bundleCount++;
    let data;
    try {
      data = JSON.parse(fs.readFileSync(file.full, 'utf8'));
    } catch (e) {
      continue;
    }
    const fragments = data.fragments ?? [];
    for (const fr of fragments) {
      fragmentCount++;
      const depth = fr.axis?.depth ?? 'unknown';
      // Reconstruct full prose
      const tokens = fr.templateTokens ?? [];
      let plainParts = [];
      for (const t of tokens) {
        if (t.kind === 'text') plainParts.push(t.value);
        else if (t.kind === 'tag') plainParts.push(`#${t.label ?? t.tagId}`);
      }
      const plain = plainParts.join('');

      // Headlines
      const allTexts = [];
      if (fr.headline) allTexts.push({ text: fr.headline, role: 'headline' });
      if (plain) allTexts.push({ text: plain, role: 'value' });

      for (const { text, role } of allTexts) {
        // Unbalanced paren
        const openP = (text.match(/\(/g) || []).length;
        const closeP = (text.match(/\)/g) || []).length;
        if (openP !== closeP) {
          records.unbalanced_paren.push({
            file: file.rel, fragmentId: fr.fragmentId, role,
            open: openP, close: closeP, text: text.slice(0, 200),
          });
        }
        // Unbalanced quote
        const dq = (text.match(/'/g) || []).length;
        if (dq % 2 !== 0) {
          records.unbalanced_quote.push({
            file: file.rel, fragmentId: fr.fragmentId, role,
            count: dq, text: text.slice(0, 200),
          });
        }
        // Hashtag in plain depth
        if ((depth === 'brief' || depth === 'standard') && /#[가-힣A-Za-z]/.test(text)) {
          records.hashtag_in_plain.push({
            file: file.rel, fragmentId: fr.fragmentId, role, depth, text,
          });
        }
        // English in plain depth (3+ letters)
        if ((depth === 'brief' || depth === 'standard') && /[a-zA-Z]{3,}/.test(text)) {
          const m = text.match(/[a-zA-Z]{3,}/);
          // skip schemaVersion-like things; only flag if it's prose value
          if (role === 'value' || role === 'headline') {
            records.english_in_plain.push({
              file: file.rel, fragmentId: fr.fragmentId, depth, role,
              match: m[0], text: text.slice(0, 200),
            });
          }
        }
        // Bare terminal (text just ends with hangul, no terminator)
        if (role === 'value' && text.trim().length > 30) {
          const trimmed = text.replace(/\s+$/u, '');
          if (/[가-힣]$/.test(trimmed) && !/[\.!\?][^가-힣]*$/.test(trimmed)) {
            // Maybe trailing token concat
            if (tokens.length === 1) {
              records.bare_terminal.push({
                file: file.rel, fragmentId: fr.fragmentId,
                last20: trimmed.slice(-20),
              });
            }
          }
        }
        // English unicode (full-width katakana etc unlikely but check)
        // Just check for unusual char ranges
      }

      // Token sequence sanity: tag immediately followed by tag with no glue
      for (let i = 1; i < tokens.length; i++) {
        if (tokens[i - 1].kind === 'tag' && tokens[i].kind === 'tag') {
          records.weird_token_seq.push({
            file: file.rel, fragmentId: fr.fragmentId,
            issue: 'tag_tag_no_glue',
            preview: tokens.slice(Math.max(0, i - 1), i + 1).map(t => t.kind === 'tag' ? `#${t.label}` : t.value).join('|'),
          });
        }
      }

      // trailing_only_token: last token is tag without text after
      if (tokens.length > 0 && tokens[tokens.length - 1].kind === 'tag') {
        records.trailing_only_token.push({
          file: file.rel, fragmentId: fr.fragmentId,
          lastTag: tokens[tokens.length - 1].label,
        });
      }
    }
  }
}

const summary = {};
for (const [k, v] of Object.entries(records)) summary[k] = v.length;

const out = path.join(__dirname, 'fragment-issues-v3.json');
fs.writeFileSync(out, JSON.stringify({ bundleCount, fragmentCount, summary, records }, null, 2));

console.log(`Bundles: ${bundleCount}, Fragments: ${fragmentCount}`);
console.log('v3 issues:');
for (const [k, n] of Object.entries(summary).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(28)} ${n}`);
}
console.log(`\noutput: ${out}`);
