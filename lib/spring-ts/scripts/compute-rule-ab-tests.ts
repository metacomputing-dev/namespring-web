/**
 * scripts/compute-rule-ab-tests.ts
 *
 * Phase 8.3 deterministic A/B plan and promotion gate artifact.
 *
 * This is not an online experiment runner. It records deterministic assignment
 * arms, compares source-free aggregate feedback snapshots, and keeps default
 * mutation blocked unless the authority/source-tier gates pass separately.
 *
 * Usage:
 *   npx tsx scripts/compute-rule-ab-tests.ts
 *   npx tsx scripts/compute-rule-ab-tests.ts --out-dir /tmp/rule-ab-tests
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  RULE_AB_TEST_SCHEMA_VERSION,
  RULE_EXPERIMENT_BUCKET_COUNT,
  RULE_EXPERIMENT_DEFINITIONS,
  compareRuleExperimentVariants,
  type RuleExperimentComparisonContext,
  type RuleExperimentVariantFeedbackSnapshot,
} from '../src/index.js';
import { sha256FileDigest } from '../tools/metrics/artifact-digest.mjs';
import {
  completeD1GateFromCalibration,
} from '../tools/metrics/complete-d1-rule-ab-gate.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
const GENERATED_AT = '2026-05-02T00:00:00.000Z';

interface Args {
  readonly outDir: string;
  readonly calibrationPath: string;
  readonly json: boolean;
}

function parseArgs(argv: string[]): Args {
  const mutable: { -readonly [K in keyof Args]: Args[K] } = {
    outDir: path.resolve(SPRING_TS_ROOT, 'metrics'),
    calibrationPath: path.resolve(SPRING_TS_ROOT, 'metrics/deterministic-calibration.json'),
    json: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--out-dir' && argv[i + 1]) {
      mutable.outDir = path.resolve(argv[i + 1]);
      i += 1;
    } else if (argv[i] === '--calibration' && argv[i + 1]) {
      mutable.calibrationPath = path.resolve(argv[i + 1]);
      i += 1;
    } else if (argv[i] === '--json') {
      mutable.json = true;
    }
  }
  return mutable;
}

function readJson<T = any>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function feedback(
  variantId: string,
  exposures: number,
  counts: RuleExperimentVariantFeedbackSnapshot['cardFeedback'],
  candidateNameRejections: RuleExperimentVariantFeedbackSnapshot['candidateNameRejections'] = {},
): RuleExperimentVariantFeedbackSnapshot {
  return {
    variantId,
    exposures,
    cardFeedback: counts,
    candidateNameRejections,
  };
}

function buildFeedbackSnapshots(): Record<string, readonly RuleExperimentVariantFeedbackSnapshot[]> {
  return {
    default_vs_expert_preset_feedback: [
      feedback('default_current', 160, {
        accurate: 96,
        unclear: 22,
        tooStrong: 18,
        notRelevant: 12,
        wrongReason: 12,
      }, {
        sajuConcern: 8,
        soundBad: 4,
        meaningBad: 4,
      }),
      feedback('expert_korean_modern', 160, {
        accurate: 104,
        unclear: 20,
        tooStrong: 14,
        notRelevant: 12,
        wrongReason: 10,
      }, {
        sajuConcern: 6,
        soundBad: 4,
        tooCommon: 3,
      }),
      feedback('expert_classical_text', 160, {
        accurate: 102,
        unclear: 18,
        tooStrong: 16,
        notRelevant: 14,
        wrongReason: 10,
      }, {
        sajuConcern: 10,
        meaningBad: 5,
        familyConflict: 3,
      }),
      feedback('expert_naming_safe', 160, {
        accurate: 110,
        unclear: 18,
        tooStrong: 10,
        notRelevant: 12,
        wrongReason: 10,
      }, {
        sajuConcern: 4,
        soundBad: 3,
        familyConflict: 3,
      }),
    ],
    candidate_ranking_strategy_feedback: [
      feedback('score_desc_current', 160, {
        accurate: 92,
        unclear: 26,
        tooStrong: 18,
        notRelevant: 12,
        wrongReason: 12,
      }, {
        sajuConcern: 10,
        soundBad: 6,
        meaningBad: 4,
        tooCommon: 2,
      }),
      feedback('pareto_frontier', 160, {
        accurate: 101,
        unclear: 22,
        tooStrong: 14,
        notRelevant: 12,
        wrongReason: 11,
      }, {
        sajuConcern: 7,
        soundBad: 4,
        meaningBad: 3,
        tooCommon: 2,
      }),
      feedback('pareto_conflict_aware_safe', 160, {
        accurate: 108,
        unclear: 20,
        tooStrong: 10,
        notRelevant: 12,
        wrongReason: 10,
      }, {
        sajuConcern: 4,
        soundBad: 3,
        meaningBad: 2,
        familyConflict: 2,
      }),
    ],
  };
}

function buildReport(calibration: any, calibrationMetricDigest: string): any {
  const sourceTierGate = completeD1GateFromCalibration(calibration);
  const comparisonContext: RuleExperimentComparisonContext = {
    sourceTierGatePassed: sourceTierGate.status === 'PASS',
    deterministicCalibrationPassed: sourceTierGate.deterministicCalibrationPassed,
  };
  const snapshots = buildFeedbackSnapshots();
  const comparisons = RULE_EXPERIMENT_DEFINITIONS.map((definition) =>
    compareRuleExperimentVariants(
      definition.experimentId,
      snapshots[definition.experimentId] ?? [],
      comparisonContext,
    ));
  const winningComparisons = comparisons.filter((comparison) => comparison.winningVariantId !== null);
  const blockedWins = winningComparisons.filter((comparison) =>
    comparison.decision === 'blocked_source_tier_gate' ||
    comparison.decision === 'blocked_deterministic_calibration');

  return {
    schemaVersion: RULE_AB_TEST_SCHEMA_VERSION,
    artifactKind: 'deterministic_rule_ab_test_plan',
    generatedAt: GENERATED_AT,
    inputs: {
      feedbackKind: 'source_free_aggregate_snapshots',
      calibrationMetric: 'metrics/deterministic-calibration.json',
      calibrationMetricDigest,
    },
    privacy: {
      sourceFree: true,
      aggregateOnly: true,
      rawFeedbackStoredInRepo: false,
      assignmentKeyStoredInRepo: false,
      personalFieldsStoredInRepo: false,
    },
    assignmentPolicy: {
      deterministicHash: 'fnv1a32',
      bucketCount: RULE_EXPERIMENT_BUCKET_COUNT,
      assignmentUnit: 'pseudonymous_visitor_or_request_key',
      rawAssignmentKeysStored: false,
      mlAllowed: false,
      randomAssignmentAtRuntime: false,
    },
    promotionPolicy: {
      preRegistered: true,
      sourceTierGateRequired: true,
      deterministicCalibrationRequired: true,
      defaultMutationAllowedWithoutGate: false,
      lowTierFeedbackCanPromoteDefault: false,
    },
    sourceTierGate,
    experiments: RULE_EXPERIMENT_DEFINITIONS,
    comparisons,
    defaultPromotionDecision: {
      decision: sourceTierGate.status === 'PASS' && blockedWins.length === 0 && winningComparisons.length > 0
        ? 'candidate_selected_for_human_review'
        : 'keep_current_default',
      reason: sourceTierGate.status === 'PASS'
        ? 'Experiment winners still require human review before any default mutation.'
        : 'Experiment winners are insufficient without the complete-D1 default promotion gate.',
      winningExperimentCount: winningComparisons.length,
      blockedWinningExperimentCount: blockedWins.length,
    },
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const calibration = readJson(args.calibrationPath);
  const report = buildReport(calibration, sha256FileDigest(args.calibrationPath));
  const outPath = path.join(args.outDir, 'rule-ab-tests.json');
  writeJson(outPath, report);
  const summary = {
    outPath,
    schemaVersion: report.schemaVersion,
    sourceTierGate: report.sourceTierGate.status,
    decision: report.defaultPromotionDecision.decision,
    experiments: report.experiments.length,
  };
  if (args.json) console.log(JSON.stringify(summary, null, 2));
  else {
    console.log(`Rule A/B test artifact written to ${outPath}`);
    console.log(`  sourceTierGate=${summary.sourceTierGate}`);
    console.log(`  decision=${summary.decision}`);
    console.log(`  experiments=${summary.experiments}`);
  }
}

await main();
