#!/usr/bin/env node
/**
 * tools/check_glossary_coverage.mjs
 *
 * Phase 11 narrative-prose CI gate.
 *
 * Audits tag-token coverage in narrative fragment data:
 *   - every `templateTokens[].tagId` referenced by a fragment must be
 *     registered in `_glossary/*.json`.
 *   - every `templateTokens[].label` (the inline override in a fragment)
 *     must match the glossary entry's canonical `label`.
 *
 * Promoted from `artifacts/phase10-agent-a5/scan-glossary-coverage.mjs`. The
 * phase 10 audit deferred bulk label normalization; the gate is wired so that
 * `--max-violations` may be tuned per phase while normalization rolls in.
 *
 * Output:
 *   - default: human-readable summary on stdout, exit 1 if violations exceed
 *     `--max-violations`.
 *   - `--json`: emit a structured JSON report on stdout.
 *
 * Flags:
 *   --json                       structured JSON report
 *   --max-violations=N           threshold above which the gate fails
 *                                (default: 0 -- any violation fails)
 *   --max-samples=N              cap printed/JSON samples (default: 50)
 *   --root=<path>                override spring-ts root (defaults to the
 *                                directory two levels above this script)
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

function parseArgs(argv) {
  const args = {
    json: false,
    maxViolations: 0,
    maxSamples: 50,
    root: DEFAULT_ROOT,
  };
  for (const arg of argv) {
    if (arg === '--json') {
      args.json = true;
    } else if (arg.startsWith('--max-violations=')) {
      const value = Number(arg.slice('--max-violations='.length));
      if (Number.isInteger(value) && value >= 0) args.maxViolations = value;
    } else if (arg.startsWith('--max-samples=')) {
      const value = Number(arg.slice('--max-samples='.length));
      if (Number.isInteger(value) && value >= 0) args.maxSamples = value;
    } else if (arg.startsWith('--root=')) {
      args.root = path.resolve(arg.slice('--root='.length));
    }
  }
  return args;
}

function* walkJsonFiles(dir, root = '') {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    const rel = path.join(root, entry.name);
    if (entry.isDirectory()) yield* walkJsonFiles(full, rel);
    else if (entry.isFile() && entry.name.endsWith('.json')) {
      yield { full, rel: rel.split(path.sep).join('/') };
    }
  }
}

function* walkFragments(node) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) yield* walkFragments(item);
    return;
  }
  if (Array.isArray(node.fragments)) {
    for (const fragment of node.fragments) yield fragment;
  }
  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') yield* walkFragments(value);
  }
}

function loadGlossary(narrativeRoot) {
  const glossaryDir = path.join(narrativeRoot, '_glossary');
  const tags = new Map();
  for (const file of walkJsonFiles(glossaryDir, '_glossary')) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(file.full, 'utf-8'));
    } catch {
      continue;
    }
    const buckets = [];
    if (Array.isArray(data?.entries)) buckets.push(data.entries);
    if (Array.isArray(data?.terms)) buckets.push(data.terms);
    for (const bucket of buckets) {
      for (const entry of bucket) {
        const id = entry?.tagId ?? entry?.id;
        if (!id) continue;
        const label = entry?.label ?? entry?.koLabel ?? id;
        tags.set(id, label);
      }
    }
  }
  return tags;
}

function collectUsage(narrativeRoot) {
  const usage = new Map();
  for (const top of SCOPE) {
    const dir = path.join(narrativeRoot, top);
    for (const file of walkJsonFiles(dir, top)) {
      let data;
      try {
        data = JSON.parse(fs.readFileSync(file.full, 'utf-8'));
      } catch {
        continue;
      }
      for (const fragment of walkFragments(data)) {
        const tokens = Array.isArray(fragment?.templateTokens) ? fragment.templateTokens : [];
        for (const token of tokens) {
          if (token?.kind !== 'tag') continue;
          const id = token.tagId;
          if (!id) continue;
          if (!usage.has(id)) {
            usage.set(id, { count: 0, labels: new Map(), files: new Set() });
          }
          const info = usage.get(id);
          info.count += 1;
          info.files.add(file.rel);
          if (typeof token.label === 'string') {
            info.labels.set(token.label, (info.labels.get(token.label) ?? 0) + 1);
          }
        }
      }
    }
  }
  return usage;
}

function buildReport({ root, maxSamples }) {
  const narrativeRoot = path.join(root, 'data', 'narrative');
  const glossary = loadGlossary(narrativeRoot);
  const usage = collectUsage(narrativeRoot);

  const missingFromGlossary = [];
  const labelMismatches = [];

  for (const [tagId, info] of usage.entries()) {
    if (!glossary.has(tagId)) {
      missingFromGlossary.push({
        tagId,
        count: info.count,
        labels: [...info.labels.keys()].slice(0, 3),
        files: [...info.files].slice(0, 5),
      });
      continue;
    }
    const canonical = glossary.get(tagId);
    for (const [usedLabel, count] of info.labels.entries()) {
      if (usedLabel !== canonical) {
        labelMismatches.push({
          tagId,
          glossaryLabel: canonical,
          usedLabel,
          count,
        });
      }
    }
  }

  const totalViolations = missingFromGlossary.length + labelMismatches.length;

  return {
    policy: 'spring-ts.narrative-glossary-coverage.v1',
    totalGlossaryTags: glossary.size,
    totalUsedTags: usage.size,
    totalViolations,
    missingCount: missingFromGlossary.length,
    labelMismatchCount: labelMismatches.length,
    samples: {
      missingFromGlossary: missingFromGlossary.slice(0, maxSamples),
      labelMismatches: labelMismatches.slice(0, maxSamples),
    },
  };
}

function renderHuman(report) {
  const lines = [];
  lines.push(
    `Narrative glossary coverage: glossaryTags=${report.totalGlossaryTags}, usedTags=${report.totalUsedTags}`,
  );
  lines.push(`  missingFromGlossary: ${report.missingCount}`);
  lines.push(`  labelMismatches: ${report.labelMismatchCount}`);
  lines.push(`  totalViolations: ${report.totalViolations}`);
  if (report.samples.missingFromGlossary.length > 0) {
    lines.push('');
    lines.push('Missing from glossary:');
    for (const item of report.samples.missingFromGlossary) {
      const labelStr = item.labels.length ? ` labels=[${item.labels.join(', ')}]` : '';
      lines.push(`- ${item.tagId} (${item.count}x)${labelStr}`);
    }
  }
  if (report.samples.labelMismatches.length > 0) {
    lines.push('');
    lines.push('Label mismatches:');
    for (const item of report.samples.labelMismatches) {
      lines.push(
        `- ${item.tagId}: glossary="${item.glossaryLabel}" used="${item.usedLabel}" (${item.count}x)`,
      );
    }
  }
  return lines.join('\n');
}

const args = parseArgs(process.argv.slice(2));
const report = buildReport({ root: args.root, maxSamples: args.maxSamples });

if (args.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(renderHuman(report));
}

const failed = report.totalViolations > args.maxViolations;
if (failed) {
  console.error(
    `Narrative glossary coverage: ${report.totalViolations} violation(s) exceed --max-violations=${args.maxViolations}`,
  );
  process.exit(1);
}

export { buildReport, renderHuman };
