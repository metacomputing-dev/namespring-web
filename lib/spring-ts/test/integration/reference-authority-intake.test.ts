/**
 * test/integration/reference-authority-intake.test.ts
 *
 * Keeps flat Reference A case intake strict before records can be promoted
 * into quality_gate.mjs authority-truth checks.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const SCRIPT_PATH = path.resolve(SPRING_TS_ROOT, 'tools/validate_reference_authority_cases.mjs');

let pass = 0;
let fail = 0;

function check(label: string, cond: boolean, evidence?: string): void {
  if (cond) {
    pass += 1;
    console.log(`  PASS ${label}${evidence ? ` (${evidence})` : ''}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}${evidence ? ` (${evidence})` : ''}`);
  }
}

function writeJson(dir: string, name: string, value: unknown): void {
  fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2), 'utf-8');
}

const validCase = {
  case_id: 'A1-saju-001',
  source: {
    text: '사주첩경',
    author: '이석영',
    volume: 4,
    page: '123',
    category: '정관격 신왕',
  },
  expected: {
    gyeokguk: '정관격',
    yongshinElement: 'WATER',
    strengthLevel: '신강',
    tenGodEmphasis: ['정관', '정인'],
    evaluation: '길명',
    summary50char: '정관과 인성이 안정된 구조',
  },
  narrative: {
    charsPerClaim: 42,
    evidenceRowsPerClaim: 2,
    counterexampleCountPerCard: 1,
  },
  hedge: {
    shouldHedge: false,
    reason: null,
  },
  sourceTier: {
    tier: 'T2_REFERENCE_IMPLEMENTATION',
    sourceType: 'reference_implementation',
    sourceUrl: 'https://example.com/reference-a-observation',
    accessedAt: '2026-05-04',
    quoteShort: '정관격',
    humanInterpretation: 'published case paraphrase',
    copyrightNote: 'facts and short paraphrase only',
    authorityTruthEligible: false,
  },
  copyrightNote: [
    'birth pillars are factual',
    'summary is short paraphrase',
    'no original prose stored',
  ],
};

console.log('Reference authority intake\n');

const defaultStdout = execFileSync('node', [SCRIPT_PATH, '--json'], {
  cwd: SPRING_TS_ROOT,
  encoding: 'utf-8',
});
const defaultReport = JSON.parse(defaultStdout);
check('default authority directory passes in observation mode',
  defaultReport?.status === 'PASS' &&
    defaultReport?.schemaVersion === 'spring-ts.reference-authority-intake-report.v2',
  `${defaultReport?.flatCaseCount ?? 'n/a'} flat cases`);

const validDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spring-ts-authority-valid-'));
writeJson(validDir, 'fix-01.json', validCase);
const validStdout = execFileSync('node', [SCRIPT_PATH, '--json', `--dir=${validDir}`], {
  cwd: SPRING_TS_ROOT,
  encoding: 'utf-8',
});
const validReport = JSON.parse(validStdout);
check('valid non-authority observation case passes intake',
  validReport?.status === 'PASS' &&
    validReport?.flatCaseCount === 1 &&
    validReport?.authorityTruthEligibleCaseCount === 0 &&
    validReport?.cases?.[0]?.violationCount === 0,
  JSON.stringify({
    status: validReport?.status,
    cases: validReport?.flatCaseCount,
    eligible: validReport?.authorityTruthEligibleCaseCount,
  }));

const legacyClaimDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spring-ts-authority-legacy-claim-'));
writeJson(legacyClaimDir, 'fix-legacy.json', {
  ...validCase,
  sourceTier: {
    ...validCase.sourceTier,
    tier: 'T3_PUBLISHED_CASE',
    sourceType: 'published_authority',
    sourceUrl: 'book:사주첩경:4:123',
    authorityTruthEligible: true,
  },
});
const legacyClaimRun = spawnSync('node', [SCRIPT_PATH, '--json', `--dir=${legacyClaimDir}`], {
  cwd: SPRING_TS_ROOT,
  encoding: 'utf-8',
});
const legacyClaimReport = JSON.parse(legacyClaimRun.stdout);
const legacyClaimCodes = new Set(
  (legacyClaimReport?.violations ?? []).map((row: any) => row.code),
);
check('legacy self-declared T3 authority claim is rejected by the shared policy',
  legacyClaimRun.status === 1
    && legacyClaimReport?.authorityTruthEligibleCaseCount === 0
    && ['invalid_source_url', 'unreviewed_t3_authority_truth', 'unapproved_authority_source_type']
      .every((code) => legacyClaimCodes.has(code)),
  [...legacyClaimCodes].join(','));

const invalidDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spring-ts-authority-invalid-'));
writeJson(invalidDir, 'fix-02.json', {
  ...validCase,
  source: {
    ...validCase.source,
    page: 'TBD',
  },
  expected: {
    ...validCase.expected,
    summary50char: '가'.repeat(51),
  },
  sourceTier: {
    ...validCase.sourceTier,
    tier: 'T1_HYPOTHESIS',
    sourceType: 'training_derived',
    authorityTruthEligible: true,
  },
  originalText: '원문을 저장하면 안 됩니다.',
});
const invalidRun = spawnSync('node', [SCRIPT_PATH, '--json', `--dir=${invalidDir}`], {
  cwd: SPRING_TS_ROOT,
  encoding: 'utf-8',
});
const invalidReport = JSON.parse(invalidRun.stdout);
const invalidCodes = new Set((invalidReport?.violations ?? []).map((row: any) => row.code));
check('invalid intake exits non-zero',
  invalidRun.status === 1 && invalidReport?.status === 'FAIL',
  `status=${invalidRun.status}`);
check('invalid intake reports source, tier, and prose blockers',
  ['summary50char_too_long', 'authority_page_unresolved', 'low_tier_authority_truth', 'ai_authority_truth_eligible', 'original_prose_field_present']
    .every((code) => invalidCodes.has(code)),
  [...invalidCodes].join(','));

const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spring-ts-authority-empty-'));
const emptyGate = spawnSync('node', [SCRIPT_PATH, '--json', `--dir=${emptyDir}`, '--allow-empty=false'], {
  cwd: SPRING_TS_ROOT,
  encoding: 'utf-8',
});
const emptyReport = JSON.parse(emptyGate.stdout);
check('empty directory can be made blocking for release gates',
  emptyGate.status === 1 &&
    emptyReport?.violations?.some((row: any) => row.code === 'flat_case_files_missing'),
  `status=${emptyGate.status}`);

console.log(`\nReference authority intake: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
