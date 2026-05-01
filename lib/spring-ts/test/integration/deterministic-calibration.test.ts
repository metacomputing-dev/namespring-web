/**
 * test/integration/deterministic-calibration.test.ts
 *
 * Verifies Phase 8.2 deterministic calibration artifact and source-tier
 * promotion guardrails.
 *
 * Run: npm run test:deterministic-calibration
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const ARTIFACT_PATH = path.resolve(SPRING_TS_ROOT, 'metrics/deterministic-calibration.json');

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

function readJson<T = any>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function runCalibration(outDir: string): any {
  execFileSync('npx', ['tsx', 'scripts/compute-deterministic-calibration.ts', '--out-dir', outDir], {
    cwd: SPRING_TS_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });
  return readJson(path.join(outDir, 'deterministic-calibration.json'));
}

function collectForbiddenKeyPaths(value: unknown, currentPath = '$'): string[] {
  const forbidden = new Set([
    'birth',
    'birthDate',
    'birthTime',
    'calendarType',
    'city',
    'email',
    'freeText',
    'gender',
    'hanja',
    'hangul',
    'ip',
    'name',
    'phone',
    'rawEvent',
    'rawText',
    'sessionId',
    'sourceTier',
    'sourceUrl',
    'userId',
  ]);
  const paths: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      paths.push(...collectForbiddenKeyPaths(item, `${currentPath}[${index}]`));
    });
    return paths;
  }
  if (!value || typeof value !== 'object') return paths;
  for (const [key, item] of Object.entries(value)) {
    const nextPath = `${currentPath}.${key}`;
    if (forbidden.has(key)) paths.push(nextPath);
    paths.push(...collectForbiddenKeyPaths(item, nextPath));
  }
  return paths;
}

console.log('Phase 8.2 deterministic calibration\n');

const artifact = readJson(ARTIFACT_PATH);
const tmpA = fs.mkdtempSync(path.join(os.tmpdir(), 'spring-ts-calibration-a-'));
const tmpB = fs.mkdtempSync(path.join(os.tmpdir(), 'spring-ts-calibration-b-'));
const generatedA = runCalibration(tmpA);
const generatedB = runCalibration(tmpB);

check('artifact schema version is current',
  artifact.schemaVersion === 'spring-ts.deterministic-calibration.v1');
check('artifact kind is deterministic calibration',
  artifact.artifactKind === 'deterministic_rule_weight_calibration');
check('calibration script is deterministic across runs',
  JSON.stringify(generatedA) === JSON.stringify(generatedB));
check('committed artifact matches generated output',
  JSON.stringify(artifact) === JSON.stringify(generatedA));

check('grid search policy forbids ML/random/default mutation',
  artifact.gridSearchPolicy?.gridKind === 'fixed_parameter_grid' &&
    artifact.gridSearchPolicy?.executionSurface === 'SpringEngine.analyze(mode=evaluate)' &&
    artifact.gridSearchPolicy?.mlAllowed === false &&
    artifact.gridSearchPolicy?.randomSearchAllowed === false &&
    artifact.gridSearchPolicy?.runtimeDefaultMutationAllowed === false);
check('one-axis grid is present',
  artifact.grid.length === 31 &&
    artifact.grid.some((row: any) => row.candidateId === 'current_default') &&
    artifact.grid.some((row: any) => row.candidateId === 'schoolPreset:classical_text') &&
    artifact.grid.some((row: any) => row.candidateId === 'scorer:tenGodMode:positional_weighted_v2') &&
    artifact.grid.some((row: any) => row.candidateId === 'evaluator:unknownHourGuard:true:damp:0.5'),
  `grid=${artifact.grid.length}`);
check('source-tier objective excludes low-tier rows',
  artifact.sourceTierObjective?.tierWeights?.T2_REFERENCE_IMPLEMENTATION === 0 &&
    artifact.sourceTierObjective?.tierWeights?.T1_HYPOTHESIS === 0 &&
    artifact.sourceTierObjective?.tierWeights?.NO_REFERENCE === 0 &&
    artifact.grid.every((candidate: any) =>
      Object.entries(candidate.byReferenceTier ?? {}).every(([tier, bucket]: [string, any]) =>
        !['T2_REFERENCE_IMPLEMENTATION', 'T1_HYPOTHESIS', 'NO_REFERENCE'].includes(tier) ||
          bucket.objectiveFixtureCount === 0 && bucket.includedInObjective === false)));
check('insufficient authority truth blocks promotion',
  artifact.sourceTierObjective?.status === 'INSUFFICIENT_AUTHORITY_TRUTH' &&
    artifact.sourceTierObjective?.eligibleObjectiveFixtureCount === 0 &&
    artifact.selected?.candidateId === 'current_default' &&
    artifact.selected?.decision === 'keep_current_default' &&
    artifact.grid.every((candidate: any) => candidate.objective?.promotionEligible === false));
check('candidate rows do not store raw names or source records',
  collectForbiddenKeyPaths(artifact).length === 0,
  collectForbiddenKeyPaths(artifact).slice(0, 5).join(', '));
check('all candidate scores remain finite and bounded',
  artifact.grid.every((candidate: any) =>
    candidate.rows.every((row: any) =>
      Number.isFinite(row.score?.total) &&
        Number.isFinite(row.score?.saju) &&
        row.score.total >= 0 &&
        row.score.total <= 100 &&
        row.score.saju >= 0 &&
        row.score.saju <= 100)));

console.log(`\nDeterministic calibration: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
