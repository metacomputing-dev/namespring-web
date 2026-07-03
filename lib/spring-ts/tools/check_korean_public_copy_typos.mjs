#!/usr/bin/env node
/**
 * tools/check_korean_public_copy_typos.mjs
 *
 * Catches small but highly visible Korean copy breakages in narrative data.
 * These are not truncations; they are malformed polite endings that can pass
 * structural gates and then surface directly in mobile report cards.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(__dirname, '..');

const BROKEN_PATTERNS = [
  { id: 'malformed_euyo', pattern: /[가-힣]+으요(?=[.!?。！？]|$)/u },
  { id: 'malformed_hayo', pattern: /[가-힣]+하요(?=[.!?。！？]|$)/u },
  { id: 'bad_batcheojuyo', pattern: /받쳐주요/u },
];

function parseArgs(argv) {
  const args = {
    json: false,
    maxViolations: 0,
    maxSamples: 50,
    root: DEFAULT_ROOT,
  };
  for (const arg of argv) {
    if (arg === '--json') args.json = true;
    else if (arg.startsWith('--max-violations=')) {
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

function* walkStrings(node, trail = []) {
  if (typeof node === 'string') {
    yield { trail, text: node };
    return;
  }
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i += 1) {
      yield* walkStrings(node[i], [...trail, String(i)]);
    }
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    yield* walkStrings(value, [...trail, key]);
  }
}

function buildReport({ root, maxSamples }) {
  const narrativeRoot = path.join(root, 'data', 'narrative');
  const violations = [];
  const ruleCounts = Object.fromEntries(BROKEN_PATTERNS.map((rule) => [rule.id, 0]));
  let filesScanned = 0;

  for (const file of walkJsonFiles(narrativeRoot)) {
    filesScanned += 1;
    let data;
    try {
      data = JSON.parse(fs.readFileSync(file.full, 'utf-8'));
    } catch {
      continue;
    }
    for (const item of walkStrings(data)) {
      for (const rule of BROKEN_PATTERNS) {
        const match = item.text.match(rule.pattern);
        if (!match) continue;
        ruleCounts[rule.id] += 1;
        violations.push({
          ruleId: rule.id,
          file: file.rel,
          trail: item.trail.join('.'),
          match: match[0],
          text: item.text,
        });
      }
    }
  }

  return {
    policy: 'spring-ts.korean-public-copy-typos.v1',
    filesScanned,
    totalViolations: violations.length,
    ruleCounts,
    samples: violations.slice(0, maxSamples),
  };
}

function renderHuman(report) {
  const lines = [];
  lines.push(`Korean public copy typo scan: filesScanned=${report.filesScanned}, violations=${report.totalViolations}`);
  for (const [ruleId, count] of Object.entries(report.ruleCounts)) {
    lines.push(`  ${ruleId}: ${count}`);
  }
  if (report.samples.length > 0) {
    lines.push('Samples:');
    for (const sample of report.samples) {
      lines.push(`- [${sample.ruleId}] ${sample.file} :: ${sample.trail}`);
      lines.push(`  match=${sample.match}`);
      lines.push(`  text=${sample.text.replace(/\s+/g, ' ').slice(0, 240)}`);
    }
  }
  return lines.join('\n');
}

const args = parseArgs(process.argv.slice(2));
const report = buildReport(args);
if (args.json) console.log(JSON.stringify(report, null, 2));
else console.log(renderHuman(report));

if (report.totalViolations > args.maxViolations) process.exit(1);