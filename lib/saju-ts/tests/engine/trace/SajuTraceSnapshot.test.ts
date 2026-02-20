import { describe, it, expect } from 'vitest';
import { analyzeSaju } from '../../../src/engine/SajuAnalysisPipeline.js';
import { createBirthInput, type AnalysisTraceStep } from '../../../src/domain/types.js';
import { Gender } from '../../../src/domain/Gender.js';
import { configFromPreset, SchoolPreset } from '../../../src/config/CalculationConfig.js';
import { ANALYSIS_KEYS, type SajuAnalysis } from '../../../src/domain/SajuAnalysis.js';

/**
 * Ported from SajuTraceSnapshotTest.kt (5 tests).
 *
 * Verifies the analysis-layer trace output for boundary cases:
 * - Trace key order matches the expected pipeline sequence
 * - Trace summaries are non-empty
 * - Core trace step always comes first with non-empty evidence
 * - Boundary-specific evidence is present (ipchun, yaza/DST corrections)
 * - All trace steps carry at least one citation
 * - Strength trace step cites JEOKCHEONSU (적천수)
 */

const config = configFromPreset(SchoolPreset.KOREAN_MAINSTREAM);

/**
 * Expected trace key order matching the pipeline's tracedStep() calls.
 * This is the TS-specific order (differs slightly from the Kotlin version).
 */
const EXPECTED_TRACE_ORDER: readonly string[] = [
  'core',
  ANALYSIS_KEYS.TEN_GODS,
  ANALYSIS_KEYS.HIDDEN_STEMS,
  ANALYSIS_KEYS.CHEONGAN_RELATIONS,
  ANALYSIS_KEYS.HAPWHA,
  ANALYSIS_KEYS.RESOLVED_JIJI,
  ANALYSIS_KEYS.SCORED_CHEONGAN,
  ANALYSIS_KEYS.SIBI_UNSEONG,
  ANALYSIS_KEYS.GONGMANG,
  ANALYSIS_KEYS.STRENGTH,
  ANALYSIS_KEYS.GYEOKGUK,
  ANALYSIS_KEYS.YONGSHIN,
  ANALYSIS_KEYS.SHINSAL,
  ANALYSIS_KEYS.WEIGHTED_SHINSAL,
  ANALYSIS_KEYS.SHINSAL_COMPOSITES,
  ANALYSIS_KEYS.PALACE,
  ANALYSIS_KEYS.DAEUN,
  ANALYSIS_KEYS.SAEUN,
];

// =========================================================================
// Helper
// =========================================================================

function analyze(
  year: number, month: number, day: number,
  hour: number, minute: number,
  gender: Gender,
): SajuAnalysis {
  const input = createBirthInput({
    birthYear: year, birthMonth: month, birthDay: day,
    birthHour: hour, birthMinute: minute,
    gender,
    longitude: 126.978,
  });
  return analyzeSaju(input, config);
}

function assertTraceSnapshot(caseId: string, analysis: SajuAnalysis): void {
  const trace = analysis.trace;

  const actualKeys = trace.map(s => s.key);
  expect(actualKeys).toEqual(EXPECTED_TRACE_ORDER);
  expect(trace.length).toBe(EXPECTED_TRACE_ORDER.length);

  for (const step of trace) {
    expect(step.summary.length).toBeGreaterThan(0);
  }

  expect(trace[0]!.key).toBe('core');
  expect(trace[0]!.evidence.length).toBeGreaterThan(0);
}

// =========================================================================
// Trace snapshot tests
// =========================================================================

describe('SajuTraceSnapshot', () => {

  describe('ipchun boundary', () => {
    it('trace snapshot matches expected order and structure', () => {
      // 2021-02-03 23:59 KST -- right before ipchun boundary
      const analysis = analyze(2021, 2, 3, 23, 59, Gender.MALE);
      assertTraceSnapshot('ipchun-boundary', analysis);

      // Core evidence should contain daysSinceJeol information
      const coreEvidence = analysis.trace[0]!.evidence;
      expect(
        coreEvidence.some(e => e.includes('daysSinceJeol')),
      ).toBe(true);
    });
  });

  describe('yaza boundary', () => {
    it('trace snapshot matches expected order and structure', () => {
      // 2001-08-01 00:02 KST -- just after midnight, yaza boundary case
      const analysis = analyze(2001, 8, 1, 0, 2, Gender.FEMALE);
      assertTraceSnapshot('yaza-boundary', analysis);

      // In yaza mode (23-01 next day), the adjusted solar time is used
      // for day/hour pillar. The coreResult carries LMT correction info.
      const lmtCorrection = analysis.coreResult.longitudeCorrectionMinutes;
      expect(typeof lmtCorrection).toBe('number');
    });
  });

  describe('DST boundary', () => {
    it('trace snapshot matches expected order and DST correction present', () => {
      // 1988-06-01 00:30 KST -- during Korean DST period (1987-1988)
      const analysis = analyze(1988, 6, 1, 0, 30, Gender.MALE);
      assertTraceSnapshot('dst-boundary', analysis);

      // DST correction should be 60 minutes during 1988 DST period
      expect(analysis.coreResult.dstCorrectionMinutes).toBe(60);
    });
  });

  describe('citations', () => {
    it('all trace steps carry at least one citation', () => {
      const analysis = analyze(2021, 2, 3, 23, 59, Gender.MALE);

      for (const step of analysis.trace) {
        expect(
          step.citations.length,
          `Trace step '${step.key}' should carry at least one citation`,
        ).toBeGreaterThan(0);
      }
    });

    it('strength trace step cites JEOKCHEONSU', () => {
      const analysis = analyze(2021, 2, 3, 23, 59, Gender.MALE);

      const strengthStep = analysis.trace.find(
        s => s.key === ANALYSIS_KEYS.STRENGTH,
      );
      expect(strengthStep).toBeDefined();
      expect(
        strengthStep!.citations.some(c => c.includes('JEOKCHEONSU')),
      ).toBe(true);
    });
  });
});
