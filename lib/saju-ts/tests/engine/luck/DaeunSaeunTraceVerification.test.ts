import { describe, it, expect } from 'vitest';
import { analyzeSaju } from '../../../src/engine/SajuAnalysisPipeline.js';
import { createBirthInput, type AnalysisTraceStep, type BirthInput } from '../../../src/domain/types.js';
import { ANALYSIS_KEYS, type SajuAnalysis } from '../../../src/domain/SajuAnalysis.js';
import { Gender } from '../../../src/domain/Gender.js';
import { Ohaeng } from '../../../src/domain/Ohaeng.js';

/**
 * Comprehensive trace quality verification for Daeun and Saeun trace steps.
 *
 * Ported from DaeunSaeunTraceVerificationTest.kt (T-05/T-06)
 *
 * Verifies:
 * - T-05: Daeun individual pillar reasoning (direction, startAge, quality ratings)
 * - T-06: Saeun-natal interactions (yearly quality, chung detection)
 */

// =========================================================================
// Helper utilities
// =========================================================================

function birth(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  gender: Gender,
): BirthInput {
  return createBirthInput({
    birthYear: year,
    birthMonth: month,
    birthDay: day,
    birthHour: hour,
    birthMinute: minute,
    gender,
  });
}

function analyze(input: BirthInput): SajuAnalysis {
  return analyzeSaju(input);
}

function daeunTrace(analysis: SajuAnalysis): AnalysisTraceStep | undefined {
  return analysis.trace.find(t => t.key === ANALYSIS_KEYS.DAEUN);
}

function saeunTrace(analysis: SajuAnalysis): AnalysisTraceStep | undefined {
  return analysis.trace.find(t => t.key === ANALYSIS_KEYS.SAEUN);
}

function joinedReasoning(step: AnalysisTraceStep): string {
  return step.reasoning.join('\n');
}

function ohaengKr(oh: Ohaeng): string {
  switch (oh) {
    case Ohaeng.WOOD: return '\uBAA9(\u6728)';
    case Ohaeng.FIRE: return '\uD654(\u706B)';
    case Ohaeng.EARTH: return '\uD1A0(\u571F)';
    case Ohaeng.METAL: return '\uAE08(\u91D1)';
    case Ohaeng.WATER: return '\uC218(\u6C34)';
  }
}

// =========================================================================
// Section 1: Daeun trace content verification (T-05)
// =========================================================================

describe('Daeun trace content (T-05)', () => {
  it('daeun trace step exists with correct key', () => {
    const analysis = analyze(birth(1990, 5, 15, 10, 30, Gender.MALE));
    const step = daeunTrace(analysis);
    expect(step).toBeDefined();
    expect(step!.key).toBe(ANALYSIS_KEYS.DAEUN);
  });

  it('daeun trace summary contains direction and start age', () => {
    const analysis = analyze(birth(1990, 5, 15, 10, 30, Gender.MALE));
    const step = daeunTrace(analysis)!;
    const summary = step.summary;

    const hasDirection = summary.includes('\uC21C\uD589') || summary.includes('\uC5ED\uD589');
    expect(hasDirection).toBe(true);
    expect(summary).toContain('\uC138 \uC2DC\uC791');
  });

  it('daeun trace evidence contains required technical fields', () => {
    const analysis = analyze(birth(1985, 3, 20, 14, 0, Gender.FEMALE));
    const step = daeunTrace(analysis)!;
    const evidence = step.evidence;

    const requiredPrefixes = ['forward=', 'startAge=', 'count=', 'boundaryMode='];
    for (const prefix of requiredPrefixes) {
      expect(evidence.some(e => e.startsWith(prefix))).toBe(true);
    }
  });

  it('daeun trace reasoning contains individual pillar analysis header', () => {
    const analysis = analyze(birth(2000, 7, 10, 8, 0, Gender.MALE));
    const step = daeunTrace(analysis)!;
    const reasoning = joinedReasoning(step);
    expect(reasoning).toContain('\u3010\uB300\uC6B4 \uAC1C\uBCC4 \uAE30\uB465 \uBD84\uC11D\u3011');
  });

  it('daeun trace reasoning contains pillar quality ratings', () => {
    const analysis = analyze(birth(1988, 11, 22, 6, 30, Gender.MALE));
    const step = daeunTrace(analysis)!;
    const reasoning = joinedReasoning(step);

    const qualityLabels = ['\uAE38(\u5409)', '\uD761(\u51F6)', '\uAE38\uD761\uD63C\uC7AC', '\uD3C9(\u5E73)'];
    const hasQuality = qualityLabels.some(label => reasoning.includes(label));
    expect(hasQuality).toBe(true);
  });

  it('daeun trace reasoning contains yongshin or gisin matching labels', () => {
    const analysis = analyze(birth(1985, 8, 15, 12, 0, Gender.MALE));
    const step = daeunTrace(analysis)!;
    const reasoning = joinedReasoning(step);

    const hasMatchLabel =
      reasoning.includes('\uC6A9\uC2E0') ||
      reasoning.includes('\uAE30\uC2E0') ||
      reasoning.includes('\uD3C9(\u5E73)');
    expect(hasMatchLabel).toBe(true);
  });

  it('daeun trace contains age labels for individual pillars', () => {
    const analysis = analyze(birth(1992, 2, 10, 15, 0, Gender.FEMALE));
    const step = daeunTrace(analysis)!;

    const pillarAnalysisStarted = step.reasoning.findIndex(line =>
      line.includes('\u3010\uB300\uC6B4 \uAC1C\uBCC4 \uAE30\uB465 \uBD84\uC11D\u3011'),
    );
    expect(pillarAnalysisStarted).toBeGreaterThanOrEqual(0);

    const pillarLines = step.reasoning
      .slice(pillarAnalysisStarted + 1)
      .filter(line => line.trim().length > 0);
    expect(pillarLines.length).toBeGreaterThan(0);

    for (const line of pillarLines) {
      expect(line).toMatch(/\d+\uC138/);
    }
  });

  it('daeun trace YANG male produces forward direction label in summary', () => {
    // 2004 = GAP-SIN year (YANG year stem)
    const analysis = analyze(birth(2004, 9, 1, 10, 0, Gender.MALE));
    const step = daeunTrace(analysis)!;

    expect(step.summary).toContain('\uC21C\uD589');
    expect(step.evidence.some(e => e === 'forward=true')).toBe(true);
  });

  it('daeun trace YIN male produces reverse direction label in summary', () => {
    // 2005 = EUL-YU year (YIN year stem)
    const analysis = analyze(birth(2005, 6, 15, 14, 0, Gender.MALE));
    const step = daeunTrace(analysis)!;

    expect(step.summary).toContain('\uC5ED\uD589');
    expect(step.evidence.some(e => e === 'forward=false')).toBe(true);
  });
});

// =========================================================================
// Section 2: Saeun trace content verification (T-06)
// =========================================================================

describe('Saeun trace content (T-06)', () => {
  it('saeun trace step exists with correct key', () => {
    const analysis = analyze(birth(1990, 5, 15, 10, 30, Gender.MALE));
    const step = saeunTrace(analysis);
    expect(step).toBeDefined();
    expect(step!.key).toBe(ANALYSIS_KEYS.SAEUN);
  });

  it('saeun trace summary contains year range info', () => {
    const analysis = analyze(birth(1990, 5, 15, 10, 30, Gender.MALE));
    const step = saeunTrace(analysis)!;
    const summary = step.summary;

    expect(summary).toContain('\uB144\uBD80\uD130');
    expect(summary).toContain('\uB144\uAC04');
  });

  it('saeun trace evidence contains startYear and count', () => {
    const analysis = analyze(birth(1995, 12, 25, 3, 0, Gender.FEMALE));
    const step = saeunTrace(analysis)!;
    const evidence = step.evidence;

    expect(evidence.some(e => e.startsWith('startYear='))).toBe(true);
    expect(evidence.some(e => e.startsWith('count='))).toBe(true);
  });

  it('saeun trace reasoning contains interaction analysis header', () => {
    const analysis = analyze(birth(1990, 5, 15, 10, 30, Gender.MALE));
    const step = saeunTrace(analysis)!;
    const reasoning = joinedReasoning(step);

    expect(reasoning).toContain(
      '\u3010\uC138\uC6B4-\uC6D0\uAD6D \uC0C1\uD638\uC791\uC6A9 (\uCD5C\uADFC 5\uB144)\u3011',
    );
  });

  it('saeun trace reasoning contains yearly quality ratings', () => {
    const analysis = analyze(birth(1988, 3, 3, 9, 0, Gender.MALE));
    const step = saeunTrace(analysis)!;
    const reasoning = joinedReasoning(step);

    const qualityLabels = ['\uAE38', '\uD761', '\uD63C\uC7AC', '\uD3C9'];
    const hasQuality = qualityLabels.some(label => reasoning.includes(label));
    expect(hasQuality).toBe(true);
  });

  it('saeun trace reasoning contains yearly pillar entries', () => {
    const analysis = analyze(birth(1990, 5, 15, 10, 30, Gender.MALE));
    const step = saeunTrace(analysis)!;

    const headerIdx = step.reasoning.findIndex(line =>
      line.includes('\u3010\uC138\uC6B4-\uC6D0\uAD6D \uC0C1\uD638\uC791\uC6A9'),
    );
    expect(headerIdx).toBeGreaterThanOrEqual(0);

    const yearlyLines = step.reasoning
      .slice(headerIdx + 1)
      .filter(line => /\d{4}\uB144/.test(line));
    expect(yearlyLines.length).toBeGreaterThanOrEqual(1);
    expect(yearlyLines.length).toBeLessThanOrEqual(5);
  });

  it('saeun trace reasoning references 60 ganji cycle explanation', () => {
    const analysis = analyze(birth(1990, 5, 15, 10, 30, Gender.MALE));
    const step = saeunTrace(analysis)!;
    const reasoning = joinedReasoning(step);

    expect(
      reasoning.includes('60\uAC11\uC790') || reasoning.includes('1984'),
    ).toBe(true);
  });
});

// =========================================================================
// Section 3: Cross-verification
// =========================================================================

describe('Daeun/Saeun trace cross-verification', () => {
  it('different birth dates produce different daeun pillar sequences in trace', () => {
    const analysis1 = analyze(birth(1985, 3, 20, 14, 0, Gender.MALE));
    const analysis2 = analyze(birth(1992, 11, 5, 8, 0, Gender.MALE));

    const reasoning1 = joinedReasoning(daeunTrace(analysis1)!);
    const reasoning2 = joinedReasoning(daeunTrace(analysis2)!);

    expect(reasoning1).not.toBe(reasoning2);
  });

  it('male vs female produce opposite direction in daeun trace', () => {
    // Same YANG year stem (1990 = GYEONG-O = YANG), different genders
    const analysisMale = analyze(birth(1990, 5, 15, 10, 30, Gender.MALE));
    const analysisFemale = analyze(birth(1990, 5, 15, 10, 30, Gender.FEMALE));

    const daeunMale = daeunTrace(analysisMale)!;
    const daeunFemale = daeunTrace(analysisFemale)!;

    // YANG + MALE = forward, YANG + FEMALE = reverse
    expect(daeunMale.summary).toContain('\uC21C\uD589');
    expect(daeunFemale.summary).toContain('\uC5ED\uD589');

    expect(daeunMale.evidence).toContain('forward=true');
    expect(daeunFemale.evidence).toContain('forward=false');
  });

  it('trace step ordering -- daeun comes before saeun', () => {
    const analysis = analyze(birth(1990, 5, 15, 10, 30, Gender.MALE));
    const traceKeys = analysis.trace.map(t => t.key);

    const daeunIndex = traceKeys.indexOf(ANALYSIS_KEYS.DAEUN);
    const saeunIndex = traceKeys.indexOf(ANALYSIS_KEYS.SAEUN);

    expect(daeunIndex).toBeGreaterThanOrEqual(0);
    expect(saeunIndex).toBeGreaterThanOrEqual(0);
    expect(daeunIndex).toBeLessThan(saeunIndex);
  });

  it('daeun and saeun trace steps both have non-empty reasoning', () => {
    const analysis = analyze(birth(1990, 5, 15, 10, 30, Gender.MALE));

    const daeunStep = daeunTrace(analysis)!;
    const saeunStep = saeunTrace(analysis)!;

    expect(daeunStep.reasoning.length).toBeGreaterThan(0);
    expect(saeunStep.reasoning.length).toBeGreaterThan(0);

    const daeunNonBlank = daeunStep.reasoning.filter(l => l.trim().length > 0).length;
    const saeunNonBlank = saeunStep.reasoning.filter(l => l.trim().length > 0).length;
    expect(daeunNonBlank).toBeGreaterThanOrEqual(3);
    expect(saeunNonBlank).toBeGreaterThanOrEqual(3);
  });

  it('daeun trace summary count matches daeun pillar count', () => {
    const analysis = analyze(birth(1990, 5, 15, 10, 30, Gender.MALE));
    const step = daeunTrace(analysis)!;

    const countEvidence = step.evidence.find(e => e.startsWith('count='));
    expect(countEvidence).toBeDefined();
    const traceCount = parseInt(countEvidence!.replace('count=', ''), 10);

    const actualPillars = analysis.daeunInfo!.daeunPillars.length;
    expect(traceCount).toBe(actualPillars);
  });
});

// =========================================================================
// Section 4: Edge cases
// =========================================================================

describe('Daeun/Saeun trace edge cases', () => {
  it('birth near jeol boundary produces valid daeun start age', () => {
    const analysis = analyze(birth(1990, 2, 4, 12, 0, Gender.MALE));
    const step = daeunTrace(analysis)!;

    const startAgeEvidence = step.evidence.find(e => e.startsWith('startAge='));
    expect(startAgeEvidence).toBeDefined();
    const startAge = parseInt(startAgeEvidence!.replace('startAge=', ''), 10);
    expect(startAge).toBeGreaterThanOrEqual(0);
  });

  it('very young person with recent birth year has saeun trace', () => {
    const analysis = analyze(birth(2024, 6, 15, 10, 0, Gender.FEMALE));
    const step = saeunTrace(analysis)!;

    const startYearEvidence = step.evidence.find(e => e.startsWith('startYear='));
    expect(startYearEvidence).toBeDefined();
    const startYear = parseInt(startYearEvidence!.replace('startYear=', ''), 10);
    expect(startYear).toBe(2024);

    const reasoning = joinedReasoning(step);
    expect(reasoning).toContain('2024');
  });

  it('daeun trace handles all quality types across multiple charts', () => {
    const charts = [
      birth(1970, 1, 1, 0, 0, Gender.MALE),
      birth(1980, 6, 15, 12, 0, Gender.FEMALE),
      birth(1990, 9, 20, 18, 0, Gender.MALE),
      birth(2000, 3, 5, 6, 0, Gender.FEMALE),
      birth(1975, 11, 30, 22, 0, Gender.MALE),
    ];

    const observedQualities = new Set<string>();
    const qualityLabels = ['\uAE38(\u5409)', '\uD761(\u51F6)', '\uAE38\uD761\uD63C\uC7AC', '\uD3C9(\u5E73)'];

    for (const input of charts) {
      const analysis = analyze(input);
      const step = daeunTrace(analysis)!;
      const reasoning = joinedReasoning(step);
      for (const label of qualityLabels) {
        if (reasoning.includes(label)) {
          observedQualities.add(label);
        }
      }
    }

    expect(observedQualities.size).toBeGreaterThanOrEqual(2);
  });

  it('yongshin element consistency between yongshin result and daeun trace quality', () => {
    const analysis = analyze(birth(1988, 11, 22, 6, 30, Gender.MALE));
    const yongshinResult = analysis.yongshinResult;
    expect(yongshinResult).not.toBeNull();

    const yongshinEl = yongshinResult!.finalYongshin;
    const step = daeunTrace(analysis)!;
    const reasoning = joinedReasoning(step);

    // If a pillar line contains "[yongshin X match]", X must match
    const yongshinKr = ohaengKr(yongshinEl);
    const yongshinMatchPattern = /\[\uC6A9\uC2E0 ([^\]]+) \uBD80\uD569\]/g;
    let match: RegExpExecArray | null;
    while ((match = yongshinMatchPattern.exec(reasoning)) !== null) {
      expect(match[1]).toBe(yongshinKr);
    }
  });

  it('saeun trace for birth year 1984 references ganji base year correctly', () => {
    const analysis = analyze(birth(1984, 7, 1, 12, 0, Gender.MALE));
    const step = saeunTrace(analysis)!;
    const reasoning = joinedReasoning(step);

    expect(reasoning).toContain('1984');
    expect(
      reasoning.includes('\uAC11\uC790') || reasoning.includes('\u7532\u5B50'),
    ).toBe(true);
  });

  it('daeun trace reasoning contains ohaeng relation labels for each pillar', () => {
    const analysis = analyze(birth(1988, 3, 3, 9, 0, Gender.MALE));
    const step = daeunTrace(analysis)!;

    const headerIdx = step.reasoning.findIndex(line =>
      line.includes('\u3010\uB300\uC6B4 \uAC1C\uBCC4 \uAE30\uB465 \uBD84\uC11D\u3011'),
    );
    expect(headerIdx).toBeGreaterThanOrEqual(0);

    const pillarLines = step.reasoning
      .slice(headerIdx + 1)
      .filter(line => line.trim().length > 0);
    expect(pillarLines.length).toBeGreaterThan(0);

    const relationNames = ['SANGSAENG', 'SANGGEUK', 'BIHWA', 'YEOKSAENG', 'YEOKGEUK'];
    for (const line of pillarLines) {
      const hasCheonganRelation =
        line.includes('\uCC9C\uAC04') && relationNames.some(r => line.includes(r));
      const hasJijiRelation =
        line.includes('\uC9C0\uC9C0') && relationNames.some(r => line.includes(r));
      expect(hasCheonganRelation && hasJijiRelation).toBe(true);
    }
  });
});
