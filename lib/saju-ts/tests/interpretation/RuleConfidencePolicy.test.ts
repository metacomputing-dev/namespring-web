import { describe, it, expect } from 'vitest';
import {
  RuleConfidencePolicy,
  DETERMINISTIC_TARGET,
  PREDICTIVE_TARGET,
  DETERMINISTIC_RULE_IDS,
  PREDICTIVE_RULE_IDS,
  CORE_CALCULATION_RULE_IDS,
  type ConfidenceAuditResult,
  type ConfidencePolicySummary,
} from '../../src/interpretation/RuleConfidencePolicy.js';
import { RuleCitationRegistry } from '../../src/interpretation/RuleCitationRegistry.js';

describe('RuleConfidencePolicy', () => {
  // ── Constants ────────────────────────────────────────────────
  describe('constants', () => {
    it('DETERMINISTIC_TARGET is 95', () => {
      expect(DETERMINISTIC_TARGET).toBe(95);
    });

    it('PREDICTIVE_TARGET is 70', () => {
      expect(PREDICTIVE_TARGET).toBe(70);
    });

    it('DETERMINISTIC_RULE_IDS is non-empty', () => {
      expect(DETERMINISTIC_RULE_IDS.size).toBeGreaterThan(0);
    });

    it('PREDICTIVE_RULE_IDS is non-empty', () => {
      expect(PREDICTIVE_RULE_IDS.size).toBeGreaterThan(0);
    });

    it('CORE_CALCULATION_RULE_IDS is non-empty', () => {
      expect(CORE_CALCULATION_RULE_IDS.size).toBeGreaterThan(0);
    });

    it('DETERMINISTIC_RULE_IDS are a subset of CORE_CALCULATION_RULE_IDS', () => {
      for (const id of DETERMINISTIC_RULE_IDS) {
        expect(CORE_CALCULATION_RULE_IDS.has(id), `${id} missing from CORE`).toBe(true);
      }
    });

    it('PREDICTIVE and DETERMINISTIC sets are disjoint', () => {
      for (const id of PREDICTIVE_RULE_IDS) {
        expect(DETERMINISTIC_RULE_IDS.has(id), `${id} in both`).toBe(false);
      }
    });
  });

  // ── baselineAudit ────────────────────────────────────────────
  describe('baselineAudit', () => {
    it('returns a valid ConfidenceAuditResult', () => {
      const result: ConfidenceAuditResult = RuleConfidencePolicy.baselineAudit();
      expect(result).toBeDefined();
      expect(typeof result.strictCalculation95).toBe('boolean');
      expect(result.strictCalculation95).toBe(false);
      expect(typeof result.expectedRuleCount).toBe('number');
      expect(result.expectedRuleCount).toBeGreaterThan(0);
      expect(typeof result.violationCount).toBe('number');
      expect(Array.isArray(result.violations)).toBe(true);
      expect(typeof result.isPass).toBe('boolean');
    });

    it('expectedRuleCount covers all deterministic + predictive + core rules', () => {
      const result = RuleConfidencePolicy.baselineAudit();
      const expected = new Set<string>([
        ...DETERMINISTIC_RULE_IDS,
        ...PREDICTIVE_RULE_IDS,
        ...CORE_CALCULATION_RULE_IDS,
      ]);
      expect(result.expectedRuleCount).toBe(expected.size);
    });

    it('violationCount matches violations array length', () => {
      const result = RuleConfidencePolicy.baselineAudit();
      expect(result.violationCount).toBe(result.violations.length);
    });

    it('isPass is true iff no violations', () => {
      const result = RuleConfidencePolicy.baselineAudit();
      expect(result.isPass).toBe(result.violations.length === 0);
    });
  });

  // ── strictCalculationAudit ──────────────────────────────────
  describe('strictCalculationAudit', () => {
    it('returns strictCalculation95 as true', () => {
      const result = RuleConfidencePolicy.strictCalculationAudit();
      expect(result.strictCalculation95).toBe(true);
    });

    it('strict audit has same expectedRuleCount as baseline', () => {
      const baseline = RuleConfidencePolicy.baselineAudit();
      const strict = RuleConfidencePolicy.strictCalculationAudit();
      expect(strict.expectedRuleCount).toBe(baseline.expectedRuleCount);
    });

    it('strict audit violations >= baseline violations (stricter requirements)', () => {
      const baseline = RuleConfidencePolicy.baselineAudit();
      const strict = RuleConfidencePolicy.strictCalculationAudit();
      expect(strict.violationCount).toBeGreaterThanOrEqual(baseline.violationCount);
    });
  });

  // ── summary ──────────────────────────────────────────────────
  describe('summary', () => {
    it('returns a valid ConfidencePolicySummary', () => {
      const s: ConfidencePolicySummary = RuleConfidencePolicy.summary();
      expect(s).toBeDefined();
      expect(typeof s.totalRules).toBe('number');
      expect(s.totalRules).toBeGreaterThan(0);
      expect(typeof s.minConfidence).toBe('number');
      expect(typeof s.avgConfidence).toBe('number');
      expect(typeof s.deterministicRuleCount).toBe('number');
      expect(typeof s.deterministicAt95Count).toBe('number');
      expect(typeof s.baselinePass).toBe('boolean');
      expect(typeof s.strictCalculation95Pass).toBe('boolean');
      expect(typeof s.strictViolationCount).toBe('number');
      expect(Array.isArray(s.strictViolations)).toBe(true);
    });

    it('deterministicRuleCount matches DETERMINISTIC_RULE_IDS size', () => {
      const s = RuleConfidencePolicy.summary();
      expect(s.deterministicRuleCount).toBe(DETERMINISTIC_RULE_IDS.size);
    });

    it('deterministicAt95Count <= deterministicRuleCount', () => {
      const s = RuleConfidencePolicy.summary();
      expect(s.deterministicAt95Count).toBeLessThanOrEqual(s.deterministicRuleCount);
    });

    it('minConfidence <= avgConfidence', () => {
      const s = RuleConfidencePolicy.summary();
      expect(s.minConfidence).toBeLessThanOrEqual(s.avgConfidence);
    });

    it('avgConfidence is reasonable (0-100 range)', () => {
      const s = RuleConfidencePolicy.summary();
      expect(s.avgConfidence).toBeGreaterThanOrEqual(0);
      expect(s.avgConfidence).toBeLessThanOrEqual(100);
    });

    it('strictViolationCount matches strictViolations array length', () => {
      const s = RuleConfidencePolicy.summary();
      expect(s.strictViolationCount).toBe(s.strictViolations.length);
    });

    it('totalRules matches allSentence() size', () => {
      const s = RuleConfidencePolicy.summary();
      const allSentence = RuleCitationRegistry.allSentence();
      expect(s.totalRules).toBe(allSentence.size);
    });
  });

  // ── All expected rules exist in registry ────────────────────
  describe('rule registration coverage', () => {
    it('all deterministic rules exist in sentence registry', () => {
      const all = RuleCitationRegistry.allSentence();
      for (const id of DETERMINISTIC_RULE_IDS) {
        expect(all.has(id), `deterministic rule "${id}" missing from registry`).toBe(true);
      }
    });

    it('all predictive rules exist in sentence registry', () => {
      const all = RuleCitationRegistry.allSentence();
      for (const id of PREDICTIVE_RULE_IDS) {
        expect(all.has(id), `predictive rule "${id}" missing from registry`).toBe(true);
      }
    });

    it('all core calculation rules exist in sentence registry', () => {
      const all = RuleCitationRegistry.allSentence();
      for (const id of CORE_CALCULATION_RULE_IDS) {
        expect(all.has(id), `core rule "${id}" missing from registry`).toBe(true);
      }
    });
  });
});
