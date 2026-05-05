#!/usr/bin/env node
/**
 * artifacts/phase3-agent-a8/measure-baseline.mjs
 *
 * Source-side metric capture for Phase 3 Agent A8 (expression_children polish).
 * Counts repetition phrases, brief headline >28자 violations, and other anchors
 * across all expression_children fragments. Output: stable JSON suitable for
 * before/after diff in artifacts/phase3-agent-a8/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const NARRATIVE_DIR = path.join(SPRING_TS_ROOT, 'data/narrative/expression_children');

const TRACKED_PHRASES = [
  '결이',
  '결을',
  '결이에요',
  '흐름',
  '한 박자',
  '페이스',
  '자기 색',
  '다음 세대',
  '단정',
  '단정 없이',
  '기록',
  '천천히',
  '풀려',
  '결실',
  '결로',
  '결과',
  '매듭',
  '편이',
  '또렷',
  '단단',
];

function walk(dir, files = []) {
  for (const f of fs.readdirSync(dir)) {
    const fp = path.join(dir, f);
    const st = fs.statSync(fp);
    if (st.isDirectory()) walk(fp, files);
    else if (f.endsWith('.fragments.json')) files.push(fp);
  }
  return files;
}

function tokensToText(tokens) {
  return (tokens || [])
    .map((t) => {
      if (t.kind === 'text') return t.value;
      if (t.kind === 'tag') return t.label || '';
      return '';
    })
    .join('');
}

function countKoreanChars(text) {
  return Array.from(text).filter((c) => /[가-힣]/.test(c)).length;
}

function main() {
  const files = walk(NARRATIVE_DIR);
  const summary = {
    totalFragments: 0,
    totalBriefFragments: 0,
    briefHeadlineViolations: 0,
    violationDetails: [],
    repetitionCounts: {},
    gatingCoverage: {},
    expertTagSet: new Set(),
  };
  for (const p of TRACKED_PHRASES) summary.repetitionCounts[p] = 0;

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    for (const frag of data.fragments) {
      summary.totalFragments += 1;
      const text = tokensToText(frag.templateTokens);
      for (const p of TRACKED_PHRASES) {
        const re = new RegExp(p, 'g');
        const matches = text.match(re);
        if (matches) summary.repetitionCounts[p] += matches.length;
      }
      if (frag.axis?.depth === 'brief') {
        summary.totalBriefFragments += 1;
        const len = countKoreanChars(text);
        if (len > 28) {
          summary.briefHeadlineViolations += 1;
          summary.violationDetails.push({ id: frag.fragmentId, len, text });
        }
      }
      if (frag.axis?.depth === 'expert') {
        for (const t of frag.tags || []) summary.expertTagSet.add(t);
      }
      const gKey = Object.keys(frag.gating || {}).sort().join('+') || 'wildcard';
      summary.gatingCoverage[gKey] = (summary.gatingCoverage[gKey] || 0) + 1;
    }
  }
  summary.expertTagSet = Array.from(summary.expertTagSet).sort();
  const out = {
    fragmentFiles: files.length,
    totalFragments: summary.totalFragments,
    totalBriefFragments: summary.totalBriefFragments,
    briefHeadlineViolations: summary.briefHeadlineViolations,
    violationDetails: summary.violationDetails,
    repetitionCounts: summary.repetitionCounts,
    gatingCoverage: summary.gatingCoverage,
    expertTagDiversity: summary.expertTagSet.length,
    expertTagSet: summary.expertTagSet,
  };
  const outputArg = process.argv[2];
  if (outputArg) {
    const outputPath = path.isAbsolute(outputArg) ? outputArg : path.join(__dirname, outputArg);
    fs.writeFileSync(outputPath, JSON.stringify(out, null, 2) + '\n');
    console.error(`Wrote summary to ${outputPath}`);
  }
  console.log(JSON.stringify(out, null, 2));
}

main();
