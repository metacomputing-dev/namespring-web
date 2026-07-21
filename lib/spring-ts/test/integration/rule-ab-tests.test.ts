/**
 * test/integration/rule-ab-tests.test.ts
 *
 * Verifies Phase 8.3 deterministic rule A/B assignments, feedback comparisons,
 * and default-promotion guardrails.
 *
 * Run: npm run test:rule-ab-tests
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  RULE_AB_TEST_SCHEMA_VERSION,
  RULE_EXPERIMENT_BUCKET_COUNT,
  RULE_EXPERIMENT_DEFINITIONS,
  assignRuleExperiment,
  compareRuleExperimentVariants,
  hashRuleExperimentKey,
  type RuleExperimentVariantFeedbackSnapshot,
} from '../../src/index.js';
import { sha256FileDigest } from '../../tools/metrics/artifact-digest.mjs';
import {
  completeD1GateFromCalibration,
} from '../../tools/metrics/complete-d1-rule-ab-gate.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const METRICS_DIR = path.resolve(SPRING_TS_ROOT, 'metrics');
const ARTIFACT_PATH = path.resolve(METRICS_DIR, 'rule-ab-tests.json');

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

function runRuleAbTests(outDir: string): any {
  const args = ['tsx', 'scripts/compute-rule-ab-tests.ts', '--out-dir', outDir];
  execFileSync('npx', args, {
    cwd: SPRING_TS_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });
  return readJson(path.join(outDir, 'rule-ab-tests.json'));
}

function collectForbiddenKeyPaths(value: unknown, currentPath = '$'): string[] {
  const forbidden = new Set([
    'assignmentKey',
    'birth',
    'birthDate',
    'birthTime',
    'calendarType',
    'city',
    'email',
    'freeText',
    'fullHangul',
    'fullHanja',
    'gender',
    'hanja',
    'hangul',
    'ip',
    'name',
    'phone',
    'quote',
    'rawEvent',
    'rawText',
    'sessionId',
    'sourceId',
    'sourceText',
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

console.log('Phase 8.3 deterministic rule A/B tests\n');

const artifact = readJson(ARTIFACT_PATH);
const tmpA = fs.mkdtempSync(path.join(os.tmpdir(), 'spring-ts-rule-ab-a-'));
const generatedA = runRuleAbTests(tmpA);
const insufficientCompleteD1 = completeD1GateFromCalibration({
  schemaVersion: 'spring-ts.deterministic-calibration.v2',
  sourceTierObjective: {
    completeD1ObjectiveStatus: 'INSUFFICIENT_COMPLETE_D1_TRUTH',
    completeD1ObjectiveFixtureCount: 0,
  },
  selected: {
    candidateId: 'current_default',
    decision: 'keep_current_default',
  },
});
const readyCompleteD1 = completeD1GateFromCalibration({
  schemaVersion: 'spring-ts.deterministic-calibration.v2',
  sourceTierObjective: {
    completeD1ObjectiveStatus: 'READY',
    completeD1ObjectiveFixtureCount: 3,
  },
  selected: {
    candidateId: 'candidate_complete_d1',
    decision: 'candidate_selected_for_human_review',
  },
});
const legacyV1 = completeD1GateFromCalibration({
  schemaVersion: 'spring-ts.deterministic-calibration.v1',
  sourceTierObjective: {
    completeD1ObjectiveStatus: 'READY',
    completeD1ObjectiveFixtureCount: 999,
  },
  selected: {
    candidateId: 'candidate_legacy',
    decision: 'candidate_selected_for_human_review',
  },
});
const legacyStatus = completeD1GateFromCalibration({
  schemaVersion: 'spring-ts.deterministic-calibration.v2',
  sourceTierObjective: {
    completeD1ObjectiveStatus: 'INSUFFICIENT_AUTHORITY_TRUTH',
    completeD1ObjectiveFixtureCount: 999,
  },
  selected: {
    candidateId: 'candidate_legacy_status',
    decision: 'candidate_selected_for_human_review',
  },
});
const legacyCountField = completeD1GateFromCalibration({
  schemaVersion: 'spring-ts.deterministic-calibration.v2',
  sourceTierObjective: {
    completeD1ObjectiveStatus: 'READY',
    eligibleObjectiveFixtureCount: 999,
  },
  selected: {
    candidateId: 'candidate_legacy_count',
    decision: 'candidate_selected_for_human_review',
  },
});
const inconsistentStatusCount = completeD1GateFromCalibration({
  schemaVersion: 'spring-ts.deterministic-calibration.v2',
  sourceTierObjective: {
    completeD1ObjectiveStatus: 'READY',
    completeD1ObjectiveFixtureCount: 2,
  },
  selected: {
    candidateId: 'candidate_inconsistent',
    decision: 'candidate_selected_for_human_review',
  },
});

check('artifact schema version is current',
  RULE_AB_TEST_SCHEMA_VERSION === 'spring-ts.rule-ab-tests.v2' &&
    artifact.schemaVersion === RULE_AB_TEST_SCHEMA_VERSION);
check('artifact kind is deterministic rule A/B plan',
  artifact.artifactKind === 'deterministic_rule_ab_test_plan');
check('committed artifact deterministically matches generated output',
  JSON.stringify(artifact) === JSON.stringify(generatedA));
check('rule A/B artifact is byte-bound to deterministic calibration input',
  artifact.inputs?.calibrationMetricDigest === sha256FileDigest(
    path.join(METRICS_DIR, 'deterministic-calibration.json'),
  ));
check('v2 insufficient complete-D1 status is preserved and blocks promotion',
  insufficientCompleteD1.calibrationContractValid === true &&
    insufficientCompleteD1.completeD1ObjectiveStatus ===
      'INSUFFICIENT_COMPLETE_D1_TRUTH' &&
    insufficientCompleteD1.completeD1ObjectiveFixtureCount === 0 &&
    insufficientCompleteD1.deterministicCalibrationPassed === false &&
    insufficientCompleteD1.status === 'BLOCKED');
check('complete-D1-ready deterministic calibration v2 can open the source-tier gate',
  readyCompleteD1.calibrationContractValid === true &&
    readyCompleteD1.completeD1ObjectiveStatus === 'READY' &&
    readyCompleteD1.completeD1ObjectiveFixtureCount === 3 &&
    readyCompleteD1.deterministicCalibrationPassed === true &&
    readyCompleteD1.status === 'PASS');
check('deterministic calibration v1 is rejected even with v2-shaped passing fields',
  legacyV1.calibrationContractValid === false &&
    legacyV1.status === 'BLOCKED');
check('legacy authority objective status is rejected by the v2 contract',
  legacyStatus.completeD1ObjectiveStatus ===
      'INSUFFICIENT_AUTHORITY_TRUTH' &&
    legacyStatus.calibrationContractValid === false &&
    legacyStatus.status === 'BLOCKED');
check('legacy eligible-objective count cannot satisfy the complete-D1 gate',
  legacyCountField.completeD1ObjectiveFixtureCount === 0 &&
    legacyCountField.calibrationContractValid === false &&
    legacyCountField.status === 'BLOCKED');
check('complete-D1 status and count must agree with the promotion threshold',
  inconsistentStatusCount.completeD1ObjectiveStatus === 'READY' &&
    inconsistentStatusCount.completeD1ObjectiveFixtureCount === 2 &&
    inconsistentStatusCount.calibrationContractValid === false &&
    inconsistentStatusCount.status === 'BLOCKED');

check('assignment definitions allocate every bucket exactly once',
  RULE_EXPERIMENT_DEFINITIONS.every((definition) =>
    definition.variants.reduce((sum, variant) => sum + variant.allocationBps, 0) ===
      RULE_EXPERIMENT_BUCKET_COUNT &&
    definition.variants.filter((variant) => variant.role === 'control').length === 1));

const assignmentA = assignRuleExperiment({
  experimentId: 'default_vs_expert_preset_feedback',
  assignmentKey: 'subject-a',
});
const assignmentARepeat = assignRuleExperiment({
  experimentId: 'default_vs_expert_preset_feedback',
  assignmentKey: 'subject-a',
});
const assignmentB = assignRuleExperiment({
  experimentId: 'candidate_ranking_strategy_feedback',
  assignmentKey: 'subject-a',
});

check('same assignment key gives same variant and bucket',
  JSON.stringify(assignmentA) === JSON.stringify(assignmentARepeat),
  JSON.stringify(assignmentA));
check('assignment returns only metadata, never raw subject keys',
  collectForbiddenKeyPaths(assignmentA).length === 0,
  collectForbiddenKeyPaths(assignmentA).join(', '));
check('assignment is experiment-specific and bounded',
  assignmentA.experimentId === 'default_vs_expert_preset_feedback' &&
    assignmentB.experimentId === 'candidate_ranking_strategy_feedback' &&
    assignmentA.bucket >= 0 &&
    assignmentA.bucket < RULE_EXPERIMENT_BUCKET_COUNT &&
    assignmentB.bucket >= 0 &&
    assignmentB.bucket < RULE_EXPERIMENT_BUCKET_COUNT,
  `a=${assignmentA.bucket}, b=${assignmentB.bucket}`);
check('hash function is stable for a known input',
  hashRuleExperimentKey('rule-ab-2026-05-02-v1:default_vs_expert_preset_feedback:subject-a') ===
    2884500411);

const presetExperiment = RULE_EXPERIMENT_DEFINITIONS
  .find((definition) => definition.experimentId === 'default_vs_expert_preset_feedback');
const rankingExperiment = RULE_EXPERIMENT_DEFINITIONS
  .find((definition) => definition.experimentId === 'candidate_ranking_strategy_feedback');
const expertSafe = presetExperiment?.variants.find((variant) => variant.variantId === 'expert_naming_safe');
const pareto = rankingExperiment?.variants.find((variant) => variant.variantId === 'pareto_frontier');
const conflictAware = rankingExperiment?.variants.find((variant) => variant.variantId === 'pareto_conflict_aware_safe');

check('expert preset arms use existing schoolPreset option names',
  expertSafe?.options?.schoolPreset === 'naming_safe' &&
    expertSafe.options.precisionConfig?.useSchoolPreset === true &&
    expertSafe.options.precisionConfig?.surfaceNamingScoreVector === true,
  JSON.stringify(expertSafe?.options));
check('ranking arms use existing Pareto and conflict-aware option names',
  pareto?.options?.precisionConfig?.paretoFrontierCandidates === true &&
    conflictAware?.options?.precisionConfig?.paretoFrontierCandidates === true &&
    conflictAware.options.precisionConfig?.yongshinMode === 'consensus_aware' &&
    conflictAware.options.precisionConfig?.nameElementStrategy === 'safeFallback',
  JSON.stringify(conflictAware?.options));

const winningSnapshots: readonly RuleExperimentVariantFeedbackSnapshot[] = [
  {
    variantId: 'score_desc_current',
    exposures: 100,
    cardFeedback: { accurate: 55, unclear: 20, tooStrong: 10, notRelevant: 10, wrongReason: 5 },
    candidateNameRejections: { sajuConcern: 10 },
  },
  {
    variantId: 'pareto_frontier',
    exposures: 100,
    cardFeedback: { accurate: 75, unclear: 8, tooStrong: 6, notRelevant: 6, wrongReason: 5 },
    candidateNameRejections: { sajuConcern: 6 },
  },
  {
    variantId: 'pareto_conflict_aware_safe',
    exposures: 100,
    cardFeedback: { accurate: 80, unclear: 8, tooStrong: 4, notRelevant: 4, wrongReason: 4 },
    candidateNameRejections: { sajuConcern: 4 },
  },
];
const blockedComparison = compareRuleExperimentVariants(
  'candidate_ranking_strategy_feedback',
  winningSnapshots,
  { sourceTierGatePassed: false, deterministicCalibrationPassed: false },
);

check('synthetic feedback can identify a winning treatment',
  blockedComparison.winningVariantId === 'pareto_conflict_aware_safe' &&
    blockedComparison.rows.some((row) =>
      row.variantId === 'pareto_conflict_aware_safe' &&
      row.deltaVsControl !== null &&
      row.deltaVsControl > 0));
check('experiment win cannot change default without source-tier gate',
  blockedComparison.decision === 'blocked_source_tier_gate' &&
    blockedComparison.blockedBy.includes('source_tier_default_promotion_gate'));

check('artifact privacy is source-free aggregate only',
  artifact.privacy?.sourceFree === true &&
    artifact.privacy?.aggregateOnly === true &&
    artifact.privacy?.rawFeedbackStoredInRepo === false &&
    artifact.privacy?.assignmentKeyStoredInRepo === false);
check('artifact stores no personal, raw source, or assignment keys',
  collectForbiddenKeyPaths(artifact).length === 0,
  collectForbiddenKeyPaths(artifact).slice(0, 5).join(', '));
check('source-tier gate is explicit and blocks default promotion',
  artifact.sourceTierGate?.requiredBeforeDefaultChange === true &&
    artifact.sourceTierGate?.completeD1ObjectiveStatus ===
      'INSUFFICIENT_COMPLETE_D1_TRUTH' &&
    artifact.sourceTierGate?.completeD1ObjectiveFixtureCount === 0 &&
    !Object.hasOwn(artifact.sourceTierGate, 'authorityObjectiveStatus') &&
    !Object.hasOwn(artifact.sourceTierGate, 'eligibleObjectiveFixtureCount') &&
    artifact.sourceTierGate?.status === 'BLOCKED' &&
    artifact.defaultPromotionDecision?.decision === 'keep_current_default',
  JSON.stringify(artifact.defaultPromotionDecision));
check('artifact records winning experiments as blocked by complete-D1 truth gate',
  artifact.comparisons.every((comparison: any) =>
    comparison.winningVariantId &&
    comparison.decision === 'blocked_source_tier_gate' &&
    comparison.promotionCriteria?.sourceTierGateRequired === true &&
    comparison.promotionCriteria?.defaultMutationAllowedWithoutGate === false));

console.log(`\nRule A/B tests: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
