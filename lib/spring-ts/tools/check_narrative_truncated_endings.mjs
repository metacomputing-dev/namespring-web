#!/usr/bin/env node
/**
 * tools/check_narrative_truncated_endings.mjs
 *
 * Phase 11 narrative-prose CI gate.
 *
 * Detects truncated/broken Korean endings in narrative fragment data --
 * typically AI-generation artifacts where the verbal/copular suffix was cut
 * at the end of a sentence (e.g. "선택요." instead of "선택이 좋아요.",
 * "정요." instead of "정해요.").
 *
 * Promoted from `artifacts/phase10-agent-a5/scan-truncated.mjs` after that
 * phase resolved the 9 broken-ending instances it discovered.
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

// Curated noun/verb-stem allow-lists. Bare `요.` after these stems is almost
// always a truncated copula or conjugation artifact.
const NOUN_STEMS = [
  '컨디션', '상태', '관계', '약속', '회복', '친구', '가족', '책임', '감정',
  '일정', '결정', '운동', '식사', '동료', '이슈', '경험', '능력', '수입',
  '지출', '분야', '환경', '일과', '음식', '역할', '시간', '관점', '생각',
  '기준', '노력', '조심', '중심', '성장', '시점', '모습', '반복', '학교',
  '회사', '습관', '관리', '건강', '평소', '기억', '단계', '기회', '선택',
  '판단',
];

const VERB_STEMS = [
  '정', '쉬', '좋', '읽', '듣', '먹', '많', '적', '크', '작', '빠', '늦',
  '넓', '좁', '짧', '길', '밝', '어둡', '약', '강', '무겁', '가볍', '뜨겁',
  '차갑',
];

function makeNounPattern(stems) {
  return new RegExp(`(?:${stems.join('|')})요\\.`, 'u');
}

function makeVerbPattern(stems) {
  return new RegExp(`(?<![가-힣])(?:${stems.join('|')})요\\.`, 'u');
}

const BROKEN_PATTERNS = [
  { id: 'noun_bare_yo', pattern: makeNounPattern(NOUN_STEMS) },
  { id: 'verb_stem_bare_yo', pattern: makeVerbPattern(VERB_STEMS) },
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

function* walkText(node, trail = []) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i += 1) {
      yield* walkText(node[i], [...trail, String(i)]);
    }
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    if ((key === 'value' || key === 'headline') && typeof value === 'string') {
      yield { trail: [...trail, key], text: value };
    }
    yield* walkText(value, [...trail, key]);
  }
}

function buildReport({ root, maxSamples }) {
  const narrativeRoot = path.join(root, 'data', 'narrative');
  const violations = [];
  const ruleCounts = Object.fromEntries(BROKEN_PATTERNS.map((rule) => [rule.id, 0]));
  let filesScanned = 0;

  for (const top of SCOPE) {
    const dir = path.join(narrativeRoot, top);
    for (const file of walkJsonFiles(dir, top)) {
      filesScanned += 1;
      let data;
      try {
        data = JSON.parse(fs.readFileSync(file.full, 'utf-8'));
      } catch {
        continue;
      }
      for (const item of walkText(data)) {
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
  }

  return {
    policy: 'spring-ts.narrative-truncated-endings.v1',
    filesScanned,
    totalViolations: violations.length,
    ruleCounts,
    samples: violations.slice(0, maxSamples),
  };
}

function renderHuman(report) {
  const lines = [];
  lines.push(`Narrative truncated endings: filesScanned=${report.filesScanned}, violations=${report.totalViolations}`);
  for (const [ruleId, count] of Object.entries(report.ruleCounts)) {
    lines.push(`  ${ruleId}: ${count}`);
  }
  if (report.samples.length > 0) {
    lines.push('');
    lines.push('Samples:');
    for (const sample of report.samples) {
      lines.push(`- [${sample.ruleId}] ${sample.file} ${sample.trail}`);
      lines.push(`    match="${sample.match}"`);
      lines.push(`    text="${sample.text}"`);
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
    `Narrative truncated endings: ${report.totalViolations} violation(s) exceed --max-violations=${args.maxViolations}`,
  );
  process.exit(1);
}

export { buildReport, renderHuman };
