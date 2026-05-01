import {
  CARD_FEEDBACK_RESPONSES,
  CANDIDATE_NAME_REJECTION_REASONS,
  type CardFeedbackResponse,
  type CandidateNameRejectionReason,
} from './feedback.js';
import type { SpringOptions } from './types.js';

export const RULE_AB_TEST_SCHEMA_VERSION = 'spring-ts.rule-ab-tests.v1';
export const RULE_EXPERIMENT_ASSIGNMENT_SCHEMA_VERSION = 'spring-ts.rule-experiment-assignment.v1';
export const RULE_EXPERIMENT_BUCKET_COUNT = 10_000;
export const RULE_EXPERIMENT_MIN_VARIANT_EXPOSURES = 50;
export const RULE_EXPERIMENT_MIN_POSITIVE_DELTA = 0.03;

export type RuleExperimentId =
  | 'default_vs_expert_preset_feedback'
  | 'candidate_ranking_strategy_feedback';

export type RuleExperimentVariantRole = 'control' | 'treatment';
export type RuleExperimentDecision =
  | 'keep_current_default'
  | 'blocked_source_tier_gate'
  | 'blocked_deterministic_calibration'
  | 'candidate_selected_for_human_review';

export interface RuleExperimentVariant {
  readonly variantId: string;
  readonly role: RuleExperimentVariantRole;
  readonly label: string;
  readonly allocationBps: number;
  readonly options?: SpringOptions;
  readonly comparisonTarget: string;
}

export interface RuleExperimentPromotionCriteria {
  readonly preRegistered: true;
  readonly sourceTierGateRequired: true;
  readonly deterministicCalibrationRequired: true;
  readonly minVariantExposures: number;
  readonly minPositiveDelta: number;
  readonly defaultMutationAllowedWithoutGate: false;
  readonly lowTierFeedbackCanPromoteDefault: false;
}

export interface RuleExperimentDefinition {
  readonly experimentId: RuleExperimentId;
  readonly label: string;
  readonly status: 'planned' | 'running' | 'complete';
  readonly assignmentUnit: 'pseudonymous_visitor_or_request_key';
  readonly saltVersion: string;
  readonly hypothesis: string;
  readonly primaryMetric: 'accurate_feedback_rate';
  readonly guardrailMetrics: readonly [
    'candidate_name_rejection_rate',
    'sample_ratio_mismatch',
    'source_tier_default_promotion_gate',
  ];
  readonly promotionCriteria: RuleExperimentPromotionCriteria;
  readonly variants: readonly RuleExperimentVariant[];
}

export interface RuleExperimentAssignmentInput {
  readonly experimentId: RuleExperimentId;
  readonly assignmentKey: string;
  readonly definitions?: readonly RuleExperimentDefinition[];
}

export interface RuleExperimentAssignment {
  readonly schemaVersion: typeof RULE_EXPERIMENT_ASSIGNMENT_SCHEMA_VERSION;
  readonly experimentId: RuleExperimentId;
  readonly variantId: string;
  readonly bucket: number;
  readonly allocationBps: number;
  readonly assignmentUnit: RuleExperimentDefinition['assignmentUnit'];
  readonly saltVersion: string;
}

export interface RuleExperimentVariantFeedbackSnapshot {
  readonly variantId: string;
  readonly exposures: number;
  readonly cardFeedback: Partial<Record<CardFeedbackResponse, number>>;
  readonly candidateNameRejections?: Partial<Record<CandidateNameRejectionReason, number>>;
}

export interface RuleExperimentComparisonContext {
  readonly sourceTierGatePassed: boolean;
  readonly deterministicCalibrationPassed: boolean;
  readonly minimumVariantExposures?: number;
  readonly minimumPositiveDelta?: number;
}

export interface RuleExperimentComparisonRow {
  readonly variantId: string;
  readonly role: RuleExperimentVariantRole;
  readonly exposures: number;
  readonly cardFeedbackTotal: number;
  readonly accurateFeedback: number;
  readonly negativeFeedback: number;
  readonly candidateNameRejections: number;
  readonly accurateFeedbackRate: number | null;
  readonly negativeFeedbackRate: number | null;
  readonly candidateNameRejectionRate: number | null;
  readonly compositeFeedbackScore: number | null;
  readonly deltaVsControl: number | null;
  readonly meetsSampleGate: boolean;
}

export interface RuleExperimentComparison {
  readonly experimentId: RuleExperimentId;
  readonly controlVariantId: string;
  readonly rows: readonly RuleExperimentComparisonRow[];
  readonly winningVariantId: string | null;
  readonly decision: RuleExperimentDecision;
  readonly blockedBy: readonly string[];
  readonly promotionCriteria: RuleExperimentPromotionCriteria;
}

const DEFAULT_PROMOTION_CRITERIA: RuleExperimentPromotionCriteria = {
  preRegistered: true,
  sourceTierGateRequired: true,
  deterministicCalibrationRequired: true,
  minVariantExposures: RULE_EXPERIMENT_MIN_VARIANT_EXPOSURES,
  minPositiveDelta: RULE_EXPERIMENT_MIN_POSITIVE_DELTA,
  defaultMutationAllowedWithoutGate: false,
  lowTierFeedbackCanPromoteDefault: false,
};

export const RULE_EXPERIMENT_DEFINITIONS: readonly RuleExperimentDefinition[] = [
  {
    experimentId: 'default_vs_expert_preset_feedback',
    label: 'Default versus expert preset feedback',
    status: 'planned',
    assignmentUnit: 'pseudonymous_visitor_or_request_key',
    saltVersion: 'rule-ab-2026-05-02-v1',
    hypothesis: 'Expert preset lenses may improve structured feedback without overriding source-tier authority gates.',
    primaryMetric: 'accurate_feedback_rate',
    guardrailMetrics: [
      'candidate_name_rejection_rate',
      'sample_ratio_mismatch',
      'source_tier_default_promotion_gate',
    ],
    promotionCriteria: DEFAULT_PROMOTION_CRITERIA,
    variants: [
      {
        variantId: 'default_current',
        role: 'control',
        label: 'Current default',
        allocationBps: 5_000,
        comparisonTarget: 'current default SpringOptions',
      },
      {
        variantId: 'expert_korean_modern',
        role: 'treatment',
        label: 'Korean modern expert preset',
        allocationBps: 2_000,
        comparisonTarget: 'schoolPreset=korean_modern',
        options: {
          schoolPreset: 'korean_modern',
          precisionConfig: {
            useSchoolPreset: true,
            surfaceNamingScoreVector: true,
          },
        },
      },
      {
        variantId: 'expert_classical_text',
        role: 'treatment',
        label: 'Classical text expert preset',
        allocationBps: 1_500,
        comparisonTarget: 'schoolPreset=classical_text',
        options: {
          schoolPreset: 'classical_text',
          precisionConfig: {
            useSchoolPreset: true,
            surfaceNamingScoreVector: true,
          },
        },
      },
      {
        variantId: 'expert_naming_safe',
        role: 'treatment',
        label: 'Naming safe expert preset',
        allocationBps: 1_500,
        comparisonTarget: 'schoolPreset=naming_safe',
        options: {
          schoolPreset: 'naming_safe',
          precisionConfig: {
            useSchoolPreset: true,
            surfaceNamingScoreVector: true,
          },
        },
      },
    ],
  },
  {
    experimentId: 'candidate_ranking_strategy_feedback',
    label: 'Candidate ranking strategy feedback',
    status: 'planned',
    assignmentUnit: 'pseudonymous_visitor_or_request_key',
    saltVersion: 'rule-ab-2026-05-02-v1',
    hypothesis: 'Pareto and conflict-aware ranking can improve candidate feedback while keeping raw scores auditable.',
    primaryMetric: 'accurate_feedback_rate',
    guardrailMetrics: [
      'candidate_name_rejection_rate',
      'sample_ratio_mismatch',
      'source_tier_default_promotion_gate',
    ],
    promotionCriteria: DEFAULT_PROMOTION_CRITERIA,
    variants: [
      {
        variantId: 'score_desc_current',
        role: 'control',
        label: 'Current score-descending order',
        allocationBps: 5_000,
        comparisonTarget: 'current candidate ordering',
      },
      {
        variantId: 'pareto_frontier',
        role: 'treatment',
        label: 'Pareto frontier candidate ordering',
        allocationBps: 2_500,
        comparisonTarget: 'precisionConfig.paretoFrontierCandidates=true',
        options: {
          precisionConfig: {
            paretoFrontierCandidates: true,
            surfaceNamingScoreVector: true,
          },
        },
      },
      {
        variantId: 'pareto_conflict_aware_safe',
        role: 'treatment',
        label: 'Pareto plus conflict-aware safe fallback',
        allocationBps: 2_500,
        comparisonTarget: 'pareto + consensus_aware + safeFallback',
        options: {
          precisionConfig: {
            paretoFrontierCandidates: true,
            surfaceNamingScoreVector: true,
            yongshinMode: 'consensus_aware',
            nameElementStrategy: 'safeFallback',
          },
        },
      },
    ],
  },
] as const;

function roundRate(value: number): number {
  return Number(value.toFixed(6));
}

function readCount<T extends string>(record: Partial<Record<T, number>> | undefined, key: T): number {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

function definitionById(
  experimentId: RuleExperimentId,
  definitions: readonly RuleExperimentDefinition[] = RULE_EXPERIMENT_DEFINITIONS,
): RuleExperimentDefinition {
  const definition = definitions.find((row) => row.experimentId === experimentId);
  if (!definition) throw new Error(`Unknown rule experiment: ${experimentId}`);
  assertValidDefinition(definition);
  return definition;
}

function assertValidDefinition(definition: RuleExperimentDefinition): void {
  const totalAllocation = definition.variants.reduce((sum, variant) => sum + variant.allocationBps, 0);
  if (totalAllocation !== RULE_EXPERIMENT_BUCKET_COUNT) {
    throw new Error(`${definition.experimentId} allocations must sum to ${RULE_EXPERIMENT_BUCKET_COUNT}.`);
  }
  const ids = new Set<string>();
  for (const variant of definition.variants) {
    if (ids.has(variant.variantId)) {
      throw new Error(`${definition.experimentId} has duplicate variantId: ${variant.variantId}`);
    }
    ids.add(variant.variantId);
    if (variant.allocationBps <= 0) {
      throw new Error(`${definition.experimentId}.${variant.variantId} must have positive allocation.`);
    }
  }
  const controls = definition.variants.filter((variant) => variant.role === 'control');
  if (controls.length !== 1) {
    throw new Error(`${definition.experimentId} must define exactly one control variant.`);
  }
}

export function hashRuleExperimentKey(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function assignRuleExperiment(input: RuleExperimentAssignmentInput): RuleExperimentAssignment {
  if (!input.assignmentKey) {
    throw new Error('Rule experiment assignmentKey must be a stable pseudonymous non-empty key.');
  }
  const definition = definitionById(input.experimentId, input.definitions);
  const bucket = hashRuleExperimentKey(
    `${definition.saltVersion}:${definition.experimentId}:${input.assignmentKey}`,
  ) % RULE_EXPERIMENT_BUCKET_COUNT;

  let upperBound = 0;
  for (const variant of definition.variants) {
    upperBound += variant.allocationBps;
    if (bucket < upperBound) {
      return {
        schemaVersion: RULE_EXPERIMENT_ASSIGNMENT_SCHEMA_VERSION,
        experimentId: definition.experimentId,
        variantId: variant.variantId,
        bucket,
        allocationBps: variant.allocationBps,
        assignmentUnit: definition.assignmentUnit,
        saltVersion: definition.saltVersion,
      };
    }
  }

  throw new Error(`No rule experiment variant matched bucket ${bucket}.`);
}

function cardFeedbackTotal(snapshot: RuleExperimentVariantFeedbackSnapshot): number {
  return CARD_FEEDBACK_RESPONSES
    .reduce((sum, response) => sum + readCount(snapshot.cardFeedback, response), 0);
}

function candidateNameRejectionTotal(snapshot: RuleExperimentVariantFeedbackSnapshot): number {
  return CANDIDATE_NAME_REJECTION_REASONS
    .reduce((sum, reason) => sum + readCount(snapshot.candidateNameRejections, reason), 0);
}

function buildComparisonRow(
  definition: RuleExperimentDefinition,
  snapshot: RuleExperimentVariantFeedbackSnapshot,
  controlScore: number | null,
  minimumVariantExposures: number,
): RuleExperimentComparisonRow {
  const variant = definition.variants.find((row) => row.variantId === snapshot.variantId);
  if (!variant) throw new Error(`${definition.experimentId} snapshot has unknown variant: ${snapshot.variantId}`);

  const total = cardFeedbackTotal(snapshot);
  const accurateFeedback = readCount(snapshot.cardFeedback, 'accurate');
  const negativeFeedback = total - accurateFeedback;
  const candidateNameRejections = candidateNameRejectionTotal(snapshot);
  const accurateFeedbackRate = total > 0 ? roundRate(accurateFeedback / total) : null;
  const negativeFeedbackRate = total > 0 ? roundRate(negativeFeedback / total) : null;
  const candidateNameRejectionRate = snapshot.exposures > 0
    ? roundRate(candidateNameRejections / snapshot.exposures)
    : null;
  const compositeFeedbackScore = accurateFeedbackRate === null || negativeFeedbackRate === null
    ? null
    : roundRate(accurateFeedbackRate - negativeFeedbackRate * 0.5 - (candidateNameRejectionRate ?? 0) * 0.25);
  const deltaVsControl = compositeFeedbackScore === null || controlScore === null
    ? null
    : roundRate(compositeFeedbackScore - controlScore);

  return {
    variantId: snapshot.variantId,
    role: variant.role,
    exposures: snapshot.exposures,
    cardFeedbackTotal: total,
    accurateFeedback,
    negativeFeedback,
    candidateNameRejections,
    accurateFeedbackRate,
    negativeFeedbackRate,
    candidateNameRejectionRate,
    compositeFeedbackScore,
    deltaVsControl,
    meetsSampleGate: snapshot.exposures >= minimumVariantExposures && total >= minimumVariantExposures,
  };
}
export function compareRuleExperimentVariants(
  experimentId: RuleExperimentId,
  snapshots: readonly RuleExperimentVariantFeedbackSnapshot[],
  context: RuleExperimentComparisonContext,
): RuleExperimentComparison {
  const definition = definitionById(experimentId);
  const control = definition.variants.find((variant) => variant.role === 'control');
  if (!control) throw new Error(`${definition.experimentId} has no control variant.`);
  const snapshotsByVariant = new Map(snapshots.map((snapshot) => [snapshot.variantId, snapshot]));
  for (const variant of definition.variants) {
    if (!snapshotsByVariant.has(variant.variantId)) {
      throw new Error(`${definition.experimentId} missing feedback snapshot for ${variant.variantId}.`);
    }
  }

  const minimumVariantExposures =
    context.minimumVariantExposures ?? definition.promotionCriteria.minVariantExposures;
  const minimumPositiveDelta =
    context.minimumPositiveDelta ?? definition.promotionCriteria.minPositiveDelta;
  const controlSnapshot = snapshotsByVariant.get(control.variantId);
  if (!controlSnapshot) throw new Error(`${definition.experimentId} missing control snapshot.`);
  const controlRow = buildComparisonRow(definition, controlSnapshot, null, minimumVariantExposures);
  const controlScore = controlRow.compositeFeedbackScore;
  const rows = definition.variants.map((variant) =>
    variant.variantId === control.variantId
      ? { ...controlRow, deltaVsControl: 0 }
      : buildComparisonRow(
        definition,
        snapshotsByVariant.get(variant.variantId)!,
        controlScore,
        minimumVariantExposures,
      ));

  const eligibleWinners = rows
    .filter((row) =>
      row.role === 'treatment' &&
      row.meetsSampleGate &&
      row.deltaVsControl !== null &&
      row.deltaVsControl >= minimumPositiveDelta)
    .sort((a, b) => (b.deltaVsControl ?? Number.NEGATIVE_INFINITY) -
      (a.deltaVsControl ?? Number.NEGATIVE_INFINITY));
  const winningVariantId = eligibleWinners[0]?.variantId ?? null;

  const blockedBy: string[] = [];
  let decision: RuleExperimentDecision = 'keep_current_default';
  if (winningVariantId) {
    if (!context.sourceTierGatePassed) {
      decision = 'blocked_source_tier_gate';
      blockedBy.push('source_tier_default_promotion_gate');
    } else if (!context.deterministicCalibrationPassed) {
      decision = 'blocked_deterministic_calibration';
      blockedBy.push('deterministic_calibration_gate');
    } else {
      decision = 'candidate_selected_for_human_review';
    }
  }

  return {
    experimentId: definition.experimentId,
    controlVariantId: control.variantId,
    rows,
    winningVariantId,
    decision,
    blockedBy,
    promotionCriteria: definition.promotionCriteria,
  };
}
