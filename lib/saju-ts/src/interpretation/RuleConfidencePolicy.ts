import { RuleCitationRegistry } from './RuleCitationRegistry.js';

export const DETERMINISTIC_TARGET = 95;
export const PREDICTIVE_TARGET = 70;

export const DETERMINISTIC_RULE_IDS: ReadonlySet<string> = new Set([
  'gongmang.detection',
  'relation.cheongan.hap',
  'relation.cheongan.chung',
  'relation.jiji.samhap',
  'relation.jiji.chung',
  'shinsal.detection',
  'daeun.direction',
  'ohaeng.distribution',
  'strength.deukryeong',
]);

export const PREDICTIVE_RULE_IDS: ReadonlySet<string> = new Set([
  'daeun.interpretation',
  'saeun.interpretation',
]);

export const CORE_CALCULATION_RULE_IDS: ReadonlySet<string> = new Set([
  'strength.deukryeong',
  'strength.deukji',
  'strength.level',
  'relation.cheongan.hap',
  'relation.cheongan.chung',
  'relation.jiji.samhap',
  'relation.jiji.chung',
  'relation.jiji.hyeong',
  'relation.hapwha',
  'gongmang.detection',
  'shinsal.detection',
  'daeun.direction',
  'yongshin.johu',
  'ohaeng.distribution',
]);

const EXPECTED_RULE_IDS: ReadonlySet<string> = new Set([
  ...DETERMINISTIC_RULE_IDS,
  ...PREDICTIVE_RULE_IDS,
  ...CORE_CALCULATION_RULE_IDS,
]);

const SORTED_EXPECTED_RULE_IDS: readonly string[] = [...EXPECTED_RULE_IDS].sort();

const UNREGISTERED_RULE_REASON = 'Rule not registered in sentence citation registry';
const FALLBACK_THRESHOLD_REASON = 'Confidence below policy threshold';

interface RuleRequirement {
  readonly required: number;
  readonly reason: string;
}

type SentenceCitations = ReadonlyMap<string, { readonly confidence: number }>;

export interface ConfidenceViolation {
  readonly ruleId: string;
  readonly actual: number;
  readonly required: number;
  readonly reason: string;
}

export interface ConfidenceAuditResult {
  readonly strictCalculation95: boolean;
  readonly expectedRuleCount: number;
  readonly violationCount: number;
  readonly violations: readonly ConfidenceViolation[];
  readonly isPass: boolean;
}

export interface ConfidencePolicySummary {
  readonly totalRules: number;
  readonly minConfidence: number;
  readonly avgConfidence: number;
  readonly deterministicRuleCount: number;
  readonly deterministicAt95Count: number;
  readonly baselinePass: boolean;
  readonly strictCalculation95Pass: boolean;
  readonly strictViolationCount: number;
  readonly strictViolations: readonly string[];
}

function requirementFor(ruleId: string, strictCalculation95: boolean): RuleRequirement {
  if (PREDICTIVE_RULE_IDS.has(ruleId)) {
    return {
      required: PREDICTIVE_TARGET,
      reason: `Predictive rule must be >= ${PREDICTIVE_TARGET}`,
    };
  }
  if (DETERMINISTIC_RULE_IDS.has(ruleId)) {
    return {
      required: DETERMINISTIC_TARGET,
      reason: `Deterministic rule must be >= ${DETERMINISTIC_TARGET}`,
    };
  }
  if (strictCalculation95 && CORE_CALCULATION_RULE_IDS.has(ruleId)) {
    return {
      required: DETERMINISTIC_TARGET,
      reason: `Strict mode requires all core calculation rules >= ${DETERMINISTIC_TARGET}`,
    };
  }
  return {
    required: 1,
    reason: FALLBACK_THRESHOLD_REASON,
  };
}

function auditCitations(all: SentenceCitations, strictCalculation95: boolean): ConfidenceAuditResult {
  const violations: ConfidenceViolation[] = [];
  for (const ruleId of SORTED_EXPECTED_RULE_IDS) {
    const requirement = requirementFor(ruleId, strictCalculation95);
    const citation = all.get(ruleId);
    if (citation == null) {
      violations.push({
        ruleId,
        actual: -1,
        required: requirement.required,
        reason: UNREGISTERED_RULE_REASON,
      });
      continue;
    }
    if (citation.confidence < requirement.required) {
      violations.push({
        ruleId,
        actual: citation.confidence,
        required: requirement.required,
        reason: requirement.reason,
      });
    }
  }

  return {
    strictCalculation95,
    expectedRuleCount: EXPECTED_RULE_IDS.size,
    violationCount: violations.length,
    violations,
    isPass: violations.length === 0,
  };
}

function auditFromRegistry(strictCalculation95: boolean): ConfidenceAuditResult {
  return auditCitations(RuleCitationRegistry.allSentence(), strictCalculation95);
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function countDeterministicAtTarget(all: SentenceCitations): number {
  let count = 0;
  for (const ruleId of DETERMINISTIC_RULE_IDS) {
    const citation = all.get(ruleId);
    if (citation != null && citation.confidence >= DETERMINISTIC_TARGET) count++;
  }
  return count;
}

export const RuleConfidencePolicy = {
  baselineAudit(): ConfidenceAuditResult {
    return auditFromRegistry(false);
  },

  strictCalculationAudit(): ConfidenceAuditResult {
    return auditFromRegistry(true);
  },

  summary(): ConfidencePolicySummary {
    const all = RuleCitationRegistry.allSentence();
    const baseline = auditCitations(all, false);
    const strict = auditCitations(all, true);
    const confidences = [...all.values()].map((citation) => citation.confidence);
    return {
      totalRules: all.size,
      minConfidence: confidences.length > 0 ? Math.min(...confidences) : 0,
      avgConfidence: roundToOneDecimal(average(confidences)),
      deterministicRuleCount: DETERMINISTIC_RULE_IDS.size,
      deterministicAt95Count: countDeterministicAtTarget(all),
      baselinePass: baseline.isPass,
      strictCalculation95Pass: strict.isPass,
      strictViolationCount: strict.violations.length,
      strictViolations: strict.violations.map((violation) => violation.ruleId),
    };
  },
} as const;
