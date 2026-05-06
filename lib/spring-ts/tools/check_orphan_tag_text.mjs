#!/usr/bin/env node
/**
 * tools/check_orphan_tag_text.mjs
 *
 * Phase 12 narrative-prose CI gate.
 *
 * Detects "orphan-tag-text" defects: a glossary label rendered as bare prose
 * (e.g. `화개의 결과 #문창귀인`) inside a text token, when sibling fragments
 * at the same axis (category/period/depth) render the same `<label>의 <stem>`
 * lead-in as a tag (`#화개의 결과 #문창귀인`).
 *
 * Promoted from `artifacts/phase11-agent-a5/find-bare-leadin-v3.mjs` after
 * P11-A5 fixed all 21 historical occurrences across 13 fragment files.
 *
 * A bare `<label>의 <stem>` match is a violation iff (a) some sibling fragment
 * in the same axis cohort uses the tagged form `#<label>의 <stem>`, and (b)
 * the offending fragment itself does not already use `<label>` as a tag
 * elsewhere -- the latter is intentional Korean re-mention style.
 *
 * Flags:
 *   --json                       structured JSON report
 *   --max-violations=N           threshold above which the gate fails (default 0)
 *   --max-samples=N              cap printed/JSON samples (default 50)
 *   --root=<path>                override spring-ts root
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(__dirname, '..');

const SCOPE = [
  '_coverage',
  'overall',
  'career',
  'wealth',
  'health',
  'health_stress',
  'romance',
  'family',
  'academic',
  'study_document',
  'expression_children',
  'movement',
];

// Stems that, paired with `<label>의 `, form an authored lead-in phrase.
// Sourced from the v3 detector that resolved all 21 P11-A5 occurrences.
const STEMS = ['결이', '결과', '자리', '흐름', '신호', '기운', '균형', '평균'];
const STEM_PATTERN = STEMS.join('|');
const HANGUL_RE = /[가-힣]/u;

function parseArgs(argv) {
  const args = { json: false, maxViolations: 0, maxSamples: 50, root: DEFAULT_ROOT };
  for (const arg of argv) {
    if (arg === '--json') args.json = true;
    else if (arg.startsWith('--max-violations=')) {
      const v = Number(arg.slice('--max-violations='.length));
      if (Number.isInteger(v) && v >= 0) args.maxViolations = v;
    } else if (arg.startsWith('--max-samples=')) {
      const v = Number(arg.slice('--max-samples='.length));
      if (Number.isInteger(v) && v >= 0) args.maxSamples = v;
    } else if (arg.startsWith('--root=')) {
      args.root = path.resolve(arg.slice('--root='.length));
    }
  }
  return args;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function* walkFragmentBundles(dir, root = '') {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    const rel = path.join(root, entry.name);
    if (entry.isDirectory()) yield* walkFragmentBundles(full, rel);
    else if (entry.isFile() && entry.name.endsWith('.fragments.json')) {
      yield { full, rel: rel.split(path.sep).join('/') };
    }
  }
}

function loadGlossaryLabels(narrativeRoot) {
  // label -> tagId; first id wins on collision.
  const labels = new Map();
  const glossaryDir = path.join(narrativeRoot, '_glossary');
  if (!fs.existsSync(glossaryDir)) return labels;
  for (const entry of fs.readdirSync(glossaryDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    let data;
    try {
      data = JSON.parse(fs.readFileSync(path.join(glossaryDir, entry.name), 'utf-8'));
    } catch {
      continue;
    }
    const buckets = [];
    if (Array.isArray(data)) buckets.push(data);
    if (Array.isArray(data?.entries)) buckets.push(data.entries);
    if (Array.isArray(data?.terms)) buckets.push(data.terms);
    for (const bucket of buckets) {
      for (const item of bucket) {
        const label = item?.label;
        const id = item?.id ?? item?.tagId;
        if (typeof label !== 'string' || label.length < 2 || !id) continue;
        if (!labels.has(label)) labels.set(label, id);
      }
    }
  }
  return labels;
}

function summarizeFragment(fragment) {
  const tokens = Array.isArray(fragment?.templateTokens) ? fragment.templateTokens : [];
  let rendered = '';
  const fragTagLabels = new Set();
  for (const token of tokens) {
    if (token?.kind === 'text') rendered += token.value ?? '';
    else if (token?.kind === 'tag') {
      const lbl = token.label ?? '';
      rendered += '#' + lbl;
      if (typeof token.label === 'string') fragTagLabels.add(token.label);
    }
  }
  return { rendered, fragTagLabels };
}

function buildReport({ root, maxSamples }) {
  const narrativeRoot = path.join(root, 'data', 'narrative');
  const labels = loadGlossaryLabels(narrativeRoot);

  // Group fragments by axis key so the "sibling" comparison is well-defined.
  const byAxis = new Map();
  let filesScanned = 0;
  let fragmentsScanned = 0;
  for (const top of SCOPE) {
    for (const file of walkFragmentBundles(path.join(narrativeRoot, top), top)) {
      let bundle;
      try {
        bundle = JSON.parse(fs.readFileSync(file.full, 'utf-8'));
      } catch {
        continue;
      }
      filesScanned += 1;
      const fragments = Array.isArray(bundle?.fragments) ? bundle.fragments : [];
      for (const fragment of fragments) {
        fragmentsScanned += 1;
        const axis = fragment?.axis ?? {};
        const axisKey = `${axis.category ?? '_'}/${axis.period ?? '_'}/${axis.depth ?? '_'}`;
        const summary = summarizeFragment(fragment);
        if (!byAxis.has(axisKey)) byAxis.set(axisKey, []);
        byAxis.get(axisKey).push({
          file: file.rel,
          fragmentId: fragment?.fragmentId ?? null,
          rendered: summary.rendered,
          fragTagLabels: summary.fragTagLabels,
        });
      }
    }
  }

  const violations = [];
  const violationsByLabel = new Map();
  const violationsByFile = new Map();

  for (const [axisKey, items] of byAxis) {
    // Within an axis cohort: collect tagged `(label, stem)` pairs, then keep
    // bare candidates whose key was tagged in some sibling AND whose own
    // fragment doesn't already tag the label (intentional re-mention pattern).
    const tagged = new Set();
    const bare = [];
    for (const item of items) {
      for (const [label] of labels) {
        const re = new RegExp(`(#?)${escapeRegex(label)}의 (${STEM_PATTERN})`, 'g');
        let match;
        while ((match = re.exec(item.rendered)) !== null) {
          const stem = match[2];
          const key = `${label}|${stem}`;
          if (match[1] === '#') {
            tagged.add(key);
          } else {
            // Mid-word substring -- skip.
            if (match.index > 0 && HANGUL_RE.test(item.rendered.charAt(match.index - 1))) continue;
            bare.push({ item, label, stem, key, index: match.index });
          }
        }
      }
    }
    for (const b of bare) {
      if (!tagged.has(b.key)) continue;
      if (b.item.fragTagLabels.has(b.label)) continue;
      const start = Math.max(0, b.index - 12);
      const end = Math.min(b.item.rendered.length, b.index + b.label.length + b.stem.length + 4);
      violations.push({
        axis: axisKey,
        file: b.item.file,
        fragmentId: b.item.fragmentId,
        label: b.label,
        tagId: labels.get(b.label) ?? null,
        stem: b.stem,
        snippet: b.item.rendered.slice(start, end),
      });
      violationsByLabel.set(b.label, (violationsByLabel.get(b.label) ?? 0) + 1);
      violationsByFile.set(b.item.file, (violationsByFile.get(b.item.file) ?? 0) + 1);
    }
  }

  const sortDesc = (a, b) => b[1] - a[1];
  return {
    policy: 'spring-ts.narrative-orphan-tag-text.v1',
    glossaryLabels: labels.size,
    filesScanned,
    fragmentsScanned,
    axesScanned: byAxis.size,
    totalViolations: violations.length,
    violationsByLabel: Object.fromEntries([...violationsByLabel].sort(sortDesc)),
    violationsByFile: Object.fromEntries([...violationsByFile].sort(sortDesc)),
    samples: violations.slice(0, maxSamples),
  };
}

function renderHuman(report) {
  const lines = [];
  lines.push(
    `Narrative orphan-tag-text: glossaryLabels=${report.glossaryLabels}, filesScanned=${report.filesScanned}, fragmentsScanned=${report.fragmentsScanned}`,
  );
  lines.push(`  totalViolations: ${report.totalViolations}`);
  const labelEntries = Object.entries(report.violationsByLabel);
  if (labelEntries.length > 0) {
    lines.push('', 'By label:');
    for (const [label, count] of labelEntries) lines.push(`  ${label}: ${count}`);
  }
  const fileEntries = Object.entries(report.violationsByFile);
  if (fileEntries.length > 0) {
    lines.push('', 'By file:');
    for (const [file, count] of fileEntries) lines.push(`  ${count}  ${file}`);
  }
  if (report.samples.length > 0) {
    lines.push('', 'Samples:');
    for (const s of report.samples) {
      lines.push(`- ${s.file} :: ${s.fragmentId}`);
      lines.push(`    axis="${s.axis}" label="${s.label}" stem="${s.stem}" tagId=${s.tagId ?? 'null'}`);
      lines.push(`    snippet="${s.snippet}"`);
    }
  }
  return lines.join('\n');
}

const args = parseArgs(process.argv.slice(2));
const report = buildReport({ root: args.root, maxSamples: args.maxSamples });

if (args.json) console.log(JSON.stringify(report, null, 2));
else console.log(renderHuman(report));

if (report.totalViolations > args.maxViolations) {
  console.error(
    `Narrative orphan-tag-text: ${report.totalViolations} violation(s) exceed --max-violations=${args.maxViolations}`,
  );
  process.exit(1);
}

export { buildReport, renderHuman };
