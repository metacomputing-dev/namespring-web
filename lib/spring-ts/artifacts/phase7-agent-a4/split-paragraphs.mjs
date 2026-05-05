#!/usr/bin/env node
/**
 * artifacts/phase7-agent-a4/split-paragraphs.mjs
 *
 * P7-A4 transformation helper: insert `\n\n` paragraph separators between
 * natural Korean sentence boundaries within expert fragments.
 *
 * Renderer collapses `\n\n` to a single space (template-engine.ts:713),
 * so inserting separators changes only source-level paragraph structure
 * — the rendered `paragraphs[0].plainText` is unaffected.
 *
 * Usage:
 *   node artifacts/phase7-agent-a4/split-paragraphs.mjs [--apply]
 *     [--bundle <relpath>] [--category <name>] [--all]
 *     [--min-paragraph-len 30] [--target-min 2]
 *
 * Default: dry-run; pass --apply to write changes. Default target-min=2.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const NARRATIVE_DIR = path.join(ROOT, 'data', 'narrative');
const COVERAGE_DIR = path.join(NARRATIVE_DIR, '_coverage');

const DEFAULT_MIN_PARAGRAPH_LEN = 30;
const DEFAULT_TARGET_MIN = 2;

const CATEGORIES = [
  'academic', 'career', 'expression_children', 'family', 'health',
  'health_stress', 'movement', 'overall', 'romance', 'study_document', 'wealth',
];
const PERIODS = ['life', 'today', 'thisWeek', 'thisMonth', 'thisYear'];

function parseArgs(argv) {
  const args = {
    apply: false,
    bundle: null,
    category: null,
    all: false,
    minParagraphLen: DEFAULT_MIN_PARAGRAPH_LEN,
    targetMin: DEFAULT_TARGET_MIN,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a === '--bundle') args.bundle = argv[++i];
    else if (a === '--category') args.category = argv[++i];
    else if (a === '--all') args.all = true;
    else if (a === '--min-paragraph-len') args.minParagraphLen = Number(argv[++i]);
    else if (a === '--target-min') args.targetMin = Number(argv[++i]);
  }
  return args;
}

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

function findSentenceBreaks(plainText) {
  const breaks = [];
  const re = /([가-힣][요다까])\.(\s+)(?=[^\n])/g;
  let m;
  while ((m = re.exec(plainText)) !== null) {
    const end = m.index + m[1].length + 1;
    if (plainText.slice(Math.max(0, end - 2), end + 2).includes('\n\n')) continue;
    breaks.push({ end, ws: m[2] });
  }
  return breaks;
}

/** Insert `\n\n` at the given plainText offsets (each break is { end, ws }).
 *  The breaks live in plain-text coordinates; we map them back to the text
 *  token that contains the `end` offset and split that token's value. */
function insertBreaksIntoTokens(templateTokens, breakRecords) {
  const out = [];
  let cursor = 0;
  let nextBreakIdx = 0;
  for (const tok of templateTokens) {
    if (tok.kind !== 'text') {
      let len = 0;
      if (tok.kind === 'tag') len = `#${tok.label || tok.tagId}`.length;
      else if (tok.kind === 'slot') len = 1;
      cursor += len;
      out.push(tok);
      continue;
    }
    const value = tok.value ?? '';
    let local = 0;
    let acc = '';
    while (nextBreakIdx < breakRecords.length) {
      const b = breakRecords[nextBreakIdx];
      const localPos = b.end - cursor;
      if (localPos < local) {
        nextBreakIdx += 1;
        continue;
      }
      if (localPos > value.length) break;
      const head = value.slice(local, localPos);
      acc += head;
      // Strip trailing whitespace from the accumulated paragraph and replace with \n\n.
      acc = acc.replace(/[\s]+$/u, '') + '\n\n';
      local = localPos + (b.ws?.length ?? 0);
      while (local < value.length && /\s/.test(value[local])) local += 1;
      nextBreakIdx += 1;
    }
    if (local < value.length) acc += value.slice(local);
    out.push({ ...tok, value: acc });
    cursor += value.length;
  }
  return out;
}

function selectBreaks(plainText, allBreaks, minParagraphLen) {
  if (allBreaks.length === 0) return [];

  // Existing \n\n boundaries — recorded so we don't replace them
  const existing = [];
  const reExisting = /\n\n+/g;
  let m;
  while ((m = reExisting.exec(plainText)) !== null) existing.push(m.index);

  const picked = [];
  let prev = 0; // start of current paragraph in plainText
  for (const cand of allBreaks) {
    // Skip if very close to existing boundary
    if (existing.some((eb) => Math.abs(eb - cand.end) < 4)) {
      prev = cand.end;
      continue;
    }
    const newParaLen = cand.end - prev;
    const tailLen = plainText.length - cand.end;
    if (newParaLen >= minParagraphLen && tailLen >= minParagraphLen) {
      picked.push(cand);
      prev = cand.end;
    }
  }
  return picked;
}

function processFragment(frag, options) {
  const plainText = fragmentPlainText(frag);
  const before = sourceParagraphCount(plainText);
  if (before >= options.targetMin) return null;

  const allBreaks = findSentenceBreaks(plainText);
  const picked = selectBreaks(plainText, allBreaks, options.minParagraphLen);
  if (picked.length === 0) return null;

  const target = before + picked.length;
  if (target < options.targetMin) return null;

  const newTokens = insertBreaksIntoTokens(frag.templateTokens, picked);
  return { newTokens, before, after: target };
}

function listBundles(args) {
  const out = [];
  if (args.bundle) {
    out.push(path.join(NARRATIVE_DIR, args.bundle));
    return out;
  }
  if (args.category) {
    for (const period of PERIODS) {
      const f = path.join(NARRATIVE_DIR, args.category, period, 'expert.fragments.json');
      if (fs.existsSync(f)) out.push(f);
    }
    return out;
  }
  if (args.all) {
    for (const cat of CATEGORIES) {
      for (const period of PERIODS) {
        const f = path.join(NARRATIVE_DIR, cat, period, 'expert.fragments.json');
        if (fs.existsSync(f)) out.push(f);
      }
    }
    if (fs.existsSync(COVERAGE_DIR)) {
      for (const f of fs.readdirSync(COVERAGE_DIR)) {
        if (f.endsWith('.fragments.json')) out.push(path.join(COVERAGE_DIR, f));
      }
    }
    return out;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const bundles = listBundles(args);
if (bundles.length === 0) {
  console.error('No bundles selected. Use --bundle <relpath>, --category <name>, or --all');
  process.exit(2);
}

let totalProcessed = 0;
let totalUpdated = 0;
const perBundle = [];

for (const bundlePath of bundles) {
  const json = JSON.parse(fs.readFileSync(bundlePath, 'utf-8'));
  const fragments = json.fragments ?? [];
  let updatedInBundle = 0;
  const bundleChanges = [];
  for (const frag of fragments) {
    const axis = frag.axis ?? {};
    const isExpert = bundlePath.includes(`${path.sep}_coverage${path.sep}`)
      ? axis.depth === 'expert'
      : true;
    if (!isExpert) continue;
    totalProcessed += 1;
    const r = processFragment(frag, args);
    if (!r) continue;
    if (args.apply) {
      frag.templateTokens = r.newTokens;
    }
    updatedInBundle += 1;
    totalUpdated += 1;
    bundleChanges.push({ fragmentId: frag.fragmentId, before: r.before, after: r.after });
  }
  perBundle.push({
    bundle: path.relative(NARRATIVE_DIR, bundlePath),
    updated: updatedInBundle,
    changes: bundleChanges,
  });
  if (args.apply && updatedInBundle > 0) {
    fs.writeFileSync(bundlePath, JSON.stringify(json, null, 2) + '\n', 'utf-8');
  }
}

const outName = args.apply ? 'split-applied.json' : 'split-dry-run.json';
const outPath = path.join(__dirname, outName);
fs.writeFileSync(outPath, JSON.stringify({ args, totalProcessed, totalUpdated, perBundle }, null, 2), 'utf-8');
console.log(
  `${args.apply ? 'APPLIED' : 'DRY-RUN'}: bundles=${bundles.length}, processed=${totalProcessed}, updated=${totalUpdated}. Report: ${outPath}`,
);
