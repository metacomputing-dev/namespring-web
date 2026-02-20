import { describe, it, expect } from 'vitest';
import { TraceAwarePillarCalculator } from '../../../src/engine/trace/TraceAwarePillarCalculator.js';
import { CalculationTracer, TraceCategory } from '../../../src/engine/trace/CalculationTrace.js';
import { GanjiCycle } from '../../../src/engine/GanjiCycle.js';
import { Cheongan, CHEONGAN_VALUES } from '../../../src/domain/Cheongan.js';
import { DEFAULT_CONFIG } from '../../../src/config/CalculationConfig.js';

/**
 * CC-N3: TraceAwarePillarCalculator unit tests.
 *
 * Verifies that each of the 5 public methods:
 * 1. Returns the correct pillar result
 * 2. Appends the correct TraceEntry to CalculationTracer
 * 3. Records school alternatives only under appropriate conditions
 */

// ── traceYearPillar ──

describe('traceYearPillar', () => {
  it('returns correct pillar for a normal date', () => {
    const tracer = new CalculationTracer();
    // 2024-06-15 12:00 = well after ipchun 2024
    const expected = GanjiCycle.yearPillarByIpchunApprox(2024, 6, 15);

    const actual = TraceAwarePillarCalculator.traceYearPillar(
      2024, 6, 15, 12, 0, tracer,
    );

    expect(actual.equals(expected)).toBe(true);
  });

  it('adds exactly one trace entry with YEAR_PILLAR category', () => {
    const tracer = new CalculationTracer();
    TraceAwarePillarCalculator.traceYearPillar(2024, 6, 15, 12, 0, tracer);

    expect(tracer.size).toBe(1);
    const entry = tracer.entries[0]!;
    expect(entry.step).toBe('year_pillar');
    expect(entry.category).toBe(TraceCategory.YEAR_PILLAR);
    expect(entry.decision).toContain('년주');
    expect(entry.rule).toContain('입춘');
  });

  it('records no alternatives when far from ipchun', () => {
    const tracer = new CalculationTracer();
    // June is far from ipchun (Feb 4), so calendar-year pillar matches
    TraceAwarePillarCalculator.traceYearPillar(2024, 6, 15, 12, 0, tracer);

    expect(tracer.entries[0]!.alternatives).toHaveLength(0);
  });

  it('records alternative when birth is between Jan 1 and ipchun', () => {
    const tracer = new CalculationTracer();
    // Jan 20, 2024 = before ipchun (Feb 4), so calendar-year differs from ipchun-year
    TraceAwarePillarCalculator.traceYearPillar(2024, 1, 20, 12, 0, tracer);

    const entry = tracer.entries[0]!;
    expect(entry.alternatives.length).toBeGreaterThan(0);
    expect(entry.alternatives.some(a => a.schoolName.includes('1/1'))).toBe(true);
  });
});

// ── traceMonthPillar ──

describe('traceMonthPillar', () => {
  it('returns correct pillar', () => {
    const tracer = new CalculationTracer();
    const yearStem = Cheongan.GAP;
    // Approximate month pillar for June
    const expected = GanjiCycle.monthPillarByJeolApprox(yearStem, 2024, 6, 15);

    const actual = TraceAwarePillarCalculator.traceMonthPillar(
      yearStem, 2024, 6, 15, 12, 0, tracer,
    );

    expect(actual.equals(expected)).toBe(true);
  });

  it('adds trace with MONTH_PILLAR category and jeol rule', () => {
    const tracer = new CalculationTracer();
    TraceAwarePillarCalculator.traceMonthPillar(
      Cheongan.GAP, 2024, 6, 15, 12, 0, tracer,
    );

    expect(tracer.size).toBe(1);
    const entry = tracer.entries[0]!;
    expect(entry.step).toBe('month_pillar');
    expect(entry.category).toBe(TraceCategory.MONTH_PILLAR);
    expect(entry.decision).toContain('월주');
    expect(entry.rule).toContain('절기');
    expect(entry.rule).toContain('오호둔월법');
  });

  it('has confidence 1 for year within exact table range', () => {
    const tracer = new CalculationTracer();
    // 2024 is within exact table range (1900-2050)
    TraceAwarePillarCalculator.traceMonthPillar(
      Cheongan.GAP, 2024, 6, 15, 12, 0, tracer,
    );

    expect(tracer.entries[0]!.confidence).toBe(1.0);
  });

  it('has reduced confidence for year outside exact table range', () => {
    const tracer = new CalculationTracer();
    // 1850 is outside exact table range -> fallback, reduced confidence
    TraceAwarePillarCalculator.traceMonthPillar(
      Cheongan.GAP, 1850, 6, 15, 12, 0, tracer,
    );

    expect(tracer.entries[0]!.confidence).toBeLessThan(1.0);
  });
});

// ── traceDayPillar ──

describe('traceDayPillar', () => {
  it('returns correct pillar for normal hour', () => {
    const tracer = new CalculationTracer();
    const expected = GanjiCycle.dayPillarByJdn(2024, 6, 15);

    const actual = TraceAwarePillarCalculator.traceDayPillar(
      2024, 6, 15, 14, DEFAULT_CONFIG, tracer,
    );

    expect(actual.equals(expected)).toBe(true);
  });

  it('adds trace with DAY_PILLAR category and JDN rule', () => {
    const tracer = new CalculationTracer();
    TraceAwarePillarCalculator.traceDayPillar(
      2024, 6, 15, 14, DEFAULT_CONFIG, tracer,
    );

    expect(tracer.size).toBe(1);
    const entry = tracer.entries[0]!;
    expect(entry.step).toBe('day_pillar');
    expect(entry.category).toBe(TraceCategory.DAY_PILLAR);
    expect(entry.decision).toContain('일주');
    expect(entry.rule).toContain('JDN');
  });

  it('records yaza alternative at hour 23', () => {
    const tracer = new CalculationTracer();
    TraceAwarePillarCalculator.traceDayPillar(
      2024, 6, 15, 23, DEFAULT_CONFIG, tracer,
    );

    const entry = tracer.entries[0]!;
    expect(entry.alternatives.length).toBeGreaterThan(0);
    expect(entry.alternatives.some(a => a.schoolName.includes('야자시'))).toBe(true);
    expect(entry.configKey).toBe('dayCutMode');
  });

  it('records no alternative before hour 23', () => {
    const tracer = new CalculationTracer();
    TraceAwarePillarCalculator.traceDayPillar(
      2024, 6, 15, 22, DEFAULT_CONFIG, tracer,
    );

    expect(tracer.entries[0]!.alternatives).toHaveLength(0);
  });
});

// ── traceHourPillar ──

describe('traceHourPillar', () => {
  it('returns correct pillar', () => {
    const tracer = new CalculationTracer();
    const dayStem = Cheongan.GAP;
    const hour = 14;
    const expected = GanjiCycle.hourPillar(dayStem, hour);

    const actual = TraceAwarePillarCalculator.traceHourPillar(dayStem, hour, tracer);

    expect(actual.equals(expected)).toBe(true);
  });

  it('adds trace with HOUR_PILLAR category and oseodunsi rule', () => {
    const tracer = new CalculationTracer();
    TraceAwarePillarCalculator.traceHourPillar(Cheongan.GAP, 14, tracer);

    expect(tracer.size).toBe(1);
    const entry = tracer.entries[0]!;
    expect(entry.step).toBe('hour_pillar');
    expect(entry.category).toBe(TraceCategory.HOUR_PILLAR);
    expect(entry.decision).toContain('시주');
    expect(entry.rule).toContain('오서둔시법');
  });

  it('mentions the hour value in reasoning', () => {
    const tracer = new CalculationTracer();
    TraceAwarePillarCalculator.traceHourPillar(Cheongan.BYEONG, 8, tracer);

    expect(tracer.entries[0]!.reasoning).toContain('8시');
  });
});

// ── traceTimeAdjustment ──

describe('traceTimeAdjustment', () => {
  it('adds trace with all correction details', () => {
    const tracer = new CalculationTracer();
    TraceAwarePillarCalculator.traceTimeAdjustment(14, 13, -60, 5, -3, tracer);

    expect(tracer.size).toBe(1);
    const entry = tracer.entries[0]!;
    expect(entry.step).toBe('time_adjustment');
    expect(entry.category).toBe(TraceCategory.TIME_ADJUSTMENT);
    expect(entry.decision).toContain('14시');
    expect(entry.decision).toContain('13시');
    expect(entry.reasoning).toContain('DST');
    expect(entry.reasoning).toContain('LMT');
    expect(entry.reasoning).toContain('균시차');
  });

  it('shows no correction when all zero', () => {
    const tracer = new CalculationTracer();
    TraceAwarePillarCalculator.traceTimeAdjustment(14, 14, 0, 0, 0, tracer);

    const entry = tracer.entries[0]!;
    expect(entry.reasoning).toContain('보정 없음');
  });

  it('always records standard-time alternative', () => {
    const tracer = new CalculationTracer();
    TraceAwarePillarCalculator.traceTimeAdjustment(14, 13, 0, -30, 0, tracer);

    const entry = tracer.entries[0]!;
    expect(entry.alternatives.length).toBeGreaterThan(0);
    expect(entry.configKey).toBe('includeEquationOfTime');
  });
});

// ── Cross-cutting concerns ──

describe('cross-cutting concerns', () => {
  it('multiple trace calls accumulate entries in order', () => {
    const tracer = new CalculationTracer();
    const yearPillar = TraceAwarePillarCalculator.traceYearPillar(
      2024, 6, 15, 14, 0, tracer,
    );
    TraceAwarePillarCalculator.traceMonthPillar(
      yearPillar.cheongan, 2024, 6, 15, 14, 0, tracer,
    );
    TraceAwarePillarCalculator.traceDayPillar(
      2024, 6, 15, 14, DEFAULT_CONFIG, tracer,
    );
    TraceAwarePillarCalculator.traceHourPillar(Cheongan.GAP, 14, tracer);

    expect(tracer.size).toBe(4);
    expect(tracer.entries[0]!.step).toBe('year_pillar');
    expect(tracer.entries[1]!.step).toBe('month_pillar');
    expect(tracer.entries[2]!.step).toBe('day_pillar');
    expect(tracer.entries[3]!.step).toBe('hour_pillar');
  });

  it('all pillar traces for all 10 day stems produce valid entries', () => {
    for (const stem of CHEONGAN_VALUES) {
      const tracer = new CalculationTracer();
      TraceAwarePillarCalculator.traceHourPillar(stem, 12, tracer);

      const entry = tracer.entries[0]!;
      expect(entry.decision).toBeTruthy();
      expect(entry.decision.length).toBeGreaterThan(0);
    }
  });
});
