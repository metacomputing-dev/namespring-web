import { describe, it, expect } from 'vitest';
import {
  type TraceEntry,
  type AlternativeDecision,
  TraceCategory,
  TRACE_CATEGORY_INFO,
  createTraceEntry,
  CalculationTracer,
} from '../../../src/engine/trace/CalculationTrace.js';

/**
 * Tests for CalculationTrace: TraceEntry construction, CalculationTracer operations,
 * filtering, Korean summary, merge, and clear.
 */

// =========================================================================
// TraceEntry -- construction and field access
// =========================================================================

describe('TraceEntry Construction', () => {

  it('all fields accessible', () => {
    const alt: AlternativeDecision = {
      schoolName: '중국 전통',
      decision: '년주 = 을축',
      reasoning: '음력 기준',
    };
    const entry = createTraceEntry({
      step: 'year_pillar',
      category: TraceCategory.YEAR_PILLAR,
      decision: '년주 = 병인(丙寅)',
      reasoning: '입춘 이후이므로 1986년 적용',
      rule: '입춘 기준 년주 결정',
      alternatives: [alt],
      configKey: 'yearBoundary',
      confidence: 0.95,
    });

    expect(entry.step).toBe('year_pillar');
    expect(entry.category).toBe(TraceCategory.YEAR_PILLAR);
    expect(entry.decision).toBe('년주 = 병인(丙寅)');
    expect(entry.reasoning).toBe('입춘 이후이므로 1986년 적용');
    expect(entry.rule).toBe('입춘 기준 년주 결정');
    expect(entry.alternatives.length).toBe(1);
    expect(entry.alternatives[0]!.schoolName).toBe('중국 전통');
    expect(entry.configKey).toBe('yearBoundary');
    expect(entry.confidence).toBe(0.95);
  });

  it('defaults are applied', () => {
    const entry = createTraceEntry({
      step: 'day_pillar',
      category: TraceCategory.DAY_PILLAR,
      decision: '일주 = 갑자(甲子)',
      reasoning: 'JDN 기반',
      rule: 'JDN 공식',
    });

    expect(entry.alternatives.length).toBe(0);
    expect(entry.configKey).toBeNull();
    expect(entry.confidence).toBe(1.0);
  });

  it('confidence must be in unit interval', () => {
    expect(() => createTraceEntry({
      step: 'test',
      category: TraceCategory.DAY_PILLAR,
      decision: 'd',
      reasoning: 'r',
      rule: 'rule',
      confidence: 1.5,
    })).toThrow();

    expect(() => createTraceEntry({
      step: 'test',
      category: TraceCategory.DAY_PILLAR,
      decision: 'd',
      reasoning: 'r',
      rule: 'rule',
      confidence: -0.1,
    })).toThrow();
  });

  it('boundary confidence values are accepted', () => {
    const zero = createTraceEntry({
      step: 's', category: TraceCategory.DAY_PILLAR,
      decision: 'd', reasoning: 'r', rule: 'rule', confidence: 0.0,
    });
    const one = createTraceEntry({
      step: 's', category: TraceCategory.DAY_PILLAR,
      decision: 'd', reasoning: 'r', rule: 'rule', confidence: 1.0,
    });
    expect(zero.confidence).toBe(0.0);
    expect(one.confidence).toBe(1.0);
  });
});

// =========================================================================
// AlternativeDecision
// =========================================================================

describe('AlternativeDecision', () => {
  it('fields are accessible', () => {
    const alt: AlternativeDecision = {
      schoolName: '현대 통합',
      decision: '월주 = 경인',
      reasoning: '동지 기준 월주 결정',
    };
    expect(alt.schoolName).toBe('현대 통합');
    expect(alt.decision).toBe('월주 = 경인');
    expect(alt.reasoning).toBe('동지 기준 월주 결정');
  });
});

// =========================================================================
// TraceCategory enum
// =========================================================================

describe('TraceCategory', () => {
  it('all categories have Korean names', () => {
    for (const cat of Object.values(TraceCategory)) {
      const info = TRACE_CATEGORY_INFO[cat];
      expect(info.koreanName.length).toBeGreaterThan(0);
    }
  });

  it('expected categories exist', () => {
    const names = Object.values(TraceCategory);
    expect(names).toContain('TIME_ADJUSTMENT');
    expect(names).toContain('YEAR_PILLAR');
    expect(names).toContain('MONTH_PILLAR');
    expect(names).toContain('DAY_PILLAR');
    expect(names).toContain('HOUR_PILLAR');
    expect(names).toContain('HIDDEN_STEMS');
    expect(names).toContain('TEN_GODS');
    expect(names).toContain('YONGSHIN');
    expect(names).toContain('GONGMANG');
  });
});

// =========================================================================
// CalculationTracer -- core operations
// =========================================================================

describe('Tracer Add and Query', () => {

  it('starts empty', () => {
    const tracer = new CalculationTracer();
    expect(tracer.entries.length).toBe(0);
    expect(tracer.size).toBe(0);
  });

  it('add entry via object', () => {
    const tracer = new CalculationTracer();
    const entry = createTraceEntry({
      step: 'year_pillar',
      category: TraceCategory.YEAR_PILLAR,
      decision: '년주 = 갑자',
      reasoning: 'test',
      rule: 'test rule',
    });
    tracer.add(entry);
    expect(tracer.size).toBe(1);
    expect(tracer.entries[0]).toEqual(entry);
  });

  it('add entry via convenience builder', () => {
    const tracer = new CalculationTracer();
    tracer.addEntry({
      step: 'month_pillar',
      category: TraceCategory.MONTH_PILLAR,
      decision: '월주 = 경인(庚寅)',
      reasoning: '절기 기준',
      rule: '오호둔월법',
    });
    expect(tracer.size).toBe(1);
    expect(tracer.entries[0]!.step).toBe('month_pillar');
    expect(tracer.entries[0]!.category).toBe(TraceCategory.MONTH_PILLAR);
  });

  it('multiple entries preserve insertion order', () => {
    const tracer = new CalculationTracer();
    tracer.addEntry({ step: 'step_a', category: TraceCategory.YEAR_PILLAR, decision: 'a', reasoning: 'a', rule: 'a' });
    tracer.addEntry({ step: 'step_b', category: TraceCategory.MONTH_PILLAR, decision: 'b', reasoning: 'b', rule: 'b' });
    tracer.addEntry({ step: 'step_c', category: TraceCategory.DAY_PILLAR, decision: 'c', reasoning: 'c', rule: 'c' });

    expect(tracer.size).toBe(3);
    expect(tracer.entries[0]!.step).toBe('step_a');
    expect(tracer.entries[1]!.step).toBe('step_b');
    expect(tracer.entries[2]!.step).toBe('step_c');
  });

  it('entries returns defensive copy', () => {
    const tracer = new CalculationTracer();
    tracer.addEntry({ step: 'step_a', category: TraceCategory.YEAR_PILLAR, decision: 'a', reasoning: 'a', rule: 'a' });

    const snapshot = tracer.entries;
    tracer.addEntry({ step: 'step_b', category: TraceCategory.MONTH_PILLAR, decision: 'b', reasoning: 'b', rule: 'b' });

    expect(snapshot.length).toBe(1);
    expect(tracer.size).toBe(2);
  });
});

// =========================================================================
// CalculationTracer -- filtering
// =========================================================================

describe('Tracer Filtering', () => {

  function populatedTracer(): CalculationTracer {
    const tracer = new CalculationTracer();
    tracer.addEntry({ step: 'year', category: TraceCategory.YEAR_PILLAR, decision: 'y', reasoning: 'y', rule: 'y' });
    tracer.addEntry({ step: 'month', category: TraceCategory.MONTH_PILLAR, decision: 'm', reasoning: 'm', rule: 'm' });
    tracer.addEntry({ step: 'day', category: TraceCategory.DAY_PILLAR, decision: 'd', reasoning: 'd', rule: 'd' });
    tracer.addEntry({ step: 'hour', category: TraceCategory.HOUR_PILLAR, decision: 'h', reasoning: 'h', rule: 'h' });
    tracer.addEntry({
      step: 'year_alt', category: TraceCategory.YEAR_PILLAR,
      decision: 'y2', reasoning: 'y2', rule: 'y2',
      alternatives: [{ schoolName: '학파A', decision: 'alt', reasoning: '이유' }],
    });
    tracer.addEntry({
      step: 'uncertain_step', category: TraceCategory.STRENGTH,
      decision: 's', reasoning: 's', rule: 's', confidence: 0.7,
    });
    return tracer;
  }

  it('byCategory returns matching entries', () => {
    const tracer = populatedTracer();
    const yearEntries = tracer.byCategory(TraceCategory.YEAR_PILLAR);
    expect(yearEntries.length).toBe(2);
    expect(yearEntries.every(e => e.category === TraceCategory.YEAR_PILLAR)).toBe(true);

    const dayEntries = tracer.byCategory(TraceCategory.DAY_PILLAR);
    expect(dayEntries.length).toBe(1);
    expect(dayEntries[0]!.step).toBe('day');
  });

  it('byCategory returns empty for missing category', () => {
    const tracer = populatedTracer();
    expect(tracer.byCategory(TraceCategory.GONGMANG).length).toBe(0);
  });

  it('disagreements finds entries with alternatives', () => {
    const tracer = populatedTracer();
    const disagreements = tracer.disagreements();
    expect(disagreements.length).toBe(1);
    expect(disagreements[0]!.step).toBe('year_alt');
  });

  it('uncertain finds low-confidence entries', () => {
    const tracer = populatedTracer();
    const uncertain90 = tracer.uncertain(0.9);
    expect(uncertain90.length).toBe(1);
    expect(uncertain90[0]!.step).toBe('uncertain_step');
  });

  it('uncertain with custom threshold', () => {
    const tracer = populatedTracer();
    expect(tracer.uncertain(0.5).length).toBe(0);
    expect(tracer.uncertain(0.8).length).toBe(1);
  });

  it('uncertain default threshold is ninety percent', () => {
    const tracer = new CalculationTracer();
    tracer.addEntry({ step: 'ok', category: TraceCategory.DAY_PILLAR, decision: 'd', reasoning: 'r', rule: 'rule', confidence: 0.91 });
    tracer.addEntry({ step: 'borderline', category: TraceCategory.DAY_PILLAR, decision: 'd', reasoning: 'r', rule: 'rule', confidence: 0.89 });

    const result = tracer.uncertain();
    expect(result.length).toBe(1);
    expect(result[0]!.step).toBe('borderline');
  });
});

// =========================================================================
// CalculationTracer -- Korean summary
// =========================================================================

describe('Tracer Korean Summary', () => {
  it('produces readable sections grouped by category', () => {
    const tracer = new CalculationTracer();
    tracer.addEntry({ step: 'year', category: TraceCategory.YEAR_PILLAR, decision: '년주 = 갑자(甲子)', reasoning: '입춘 기준', rule: '입춘 규칙' });
    tracer.addEntry({ step: 'month', category: TraceCategory.MONTH_PILLAR, decision: '월주 = 병인(丙寅)', reasoning: '절기 기준', rule: '오호둔월법' });

    const summary = tracer.toKoreanSummary();
    expect(summary).toContain('=== 년주 계산 ===');
    expect(summary).toContain('=== 월주 계산 ===');
    expect(summary).toContain('[year] 년주 = 갑자(甲子)');
    expect(summary).toContain('근거: 입춘 기준');
    expect(summary).toContain('[month] 월주 = 병인(丙寅)');
  });

  it('includes alternatives when present', () => {
    const tracer = new CalculationTracer();
    tracer.addEntry({
      step: 'year', category: TraceCategory.YEAR_PILLAR,
      decision: '년주 = 갑자', reasoning: '입춘 기준', rule: '입춘 규칙',
      alternatives: [{ schoolName: '양력 기준', decision: '년주 = 계해', reasoning: '1/1 기준' }],
    });

    const summary = tracer.toKoreanSummary();
    expect(summary).toContain('유파별 차이');
    expect(summary).toContain('양력 기준');
    expect(summary).toContain('년주 = 계해');
  });

  it('shows confidence when below one', () => {
    const tracer = new CalculationTracer();
    tracer.addEntry({ step: 'approx', category: TraceCategory.MONTH_PILLAR, decision: 'm', reasoning: 'r', rule: 'rule', confidence: 0.85 });

    const summary = tracer.toKoreanSummary();
    expect(summary).toContain('확신도: 85%');
  });

  it('does not show confidence when exactly one', () => {
    const tracer = new CalculationTracer();
    tracer.addEntry({ step: 'exact', category: TraceCategory.DAY_PILLAR, decision: 'd', reasoning: 'r', rule: 'rule', confidence: 1.0 });

    const summary = tracer.toKoreanSummary();
    expect(summary).not.toContain('확신도');
  });

  it('empty tracer produces empty summary', () => {
    const tracer = new CalculationTracer();
    const summary = tracer.toKoreanSummary();
    expect(summary.trim().length).toBe(0);
  });
});

// =========================================================================
// CalculationTracer -- merge and clear
// =========================================================================

describe('Tracer Merge and Clear', () => {
  it('merge appends all entries from other', () => {
    const a = new CalculationTracer();
    a.addEntry({ step: 'step_a', category: TraceCategory.YEAR_PILLAR, decision: 'a', reasoning: 'a', rule: 'a' });

    const b = new CalculationTracer();
    b.addEntry({ step: 'step_b', category: TraceCategory.MONTH_PILLAR, decision: 'b', reasoning: 'b', rule: 'b' });
    b.addEntry({ step: 'step_c', category: TraceCategory.DAY_PILLAR, decision: 'c', reasoning: 'c', rule: 'c' });

    a.merge(b);

    expect(a.size).toBe(3);
    expect(a.entries[0]!.step).toBe('step_a');
    expect(a.entries[1]!.step).toBe('step_b');
    expect(a.entries[2]!.step).toBe('step_c');
  });

  it('merge does not affect source tracer', () => {
    const a = new CalculationTracer();
    const b = new CalculationTracer();
    b.addEntry({ step: 'step_b', category: TraceCategory.MONTH_PILLAR, decision: 'b', reasoning: 'b', rule: 'b' });

    a.merge(b);
    a.addEntry({ step: 'step_extra', category: TraceCategory.DAY_PILLAR, decision: 'x', reasoning: 'x', rule: 'x' });

    expect(b.size).toBe(1);
  });

  it('clear removes all entries', () => {
    const tracer = new CalculationTracer();
    tracer.addEntry({ step: 'step_a', category: TraceCategory.YEAR_PILLAR, decision: 'a', reasoning: 'a', rule: 'a' });
    tracer.addEntry({ step: 'step_b', category: TraceCategory.MONTH_PILLAR, decision: 'b', reasoning: 'b', rule: 'b' });

    tracer.clear();
    expect(tracer.size).toBe(0);
    expect(tracer.entries.length).toBe(0);
  });
});
