export interface TraceEntry {
    readonly step: string;
    readonly category: TraceCategory;
    readonly decision: string;
    readonly reasoning: string;
    readonly rule: string;
    readonly alternatives: readonly AlternativeDecision[];
    readonly configKey: string | null;
    readonly confidence: number;
}

export interface AlternativeDecision {
    readonly schoolName: string;
    readonly decision: string;
    readonly reasoning: string;
}

export enum TraceCategory {
  TIME_ADJUSTMENT = 'TIME_ADJUSTMENT',
  YEAR_PILLAR = 'YEAR_PILLAR',
  MONTH_PILLAR = 'MONTH_PILLAR',
  DAY_PILLAR = 'DAY_PILLAR',
  HOUR_PILLAR = 'HOUR_PILLAR',

  HIDDEN_STEMS = 'HIDDEN_STEMS',
  TEN_GODS = 'TEN_GODS',
  TWELVE_STAGES = 'TWELVE_STAGES',
  RELATIONS = 'RELATIONS',
  STRENGTH = 'STRENGTH',
  YONGSHIN = 'YONGSHIN',
  GYEOKGUK = 'GYEOKGUK',
  GONGMANG = 'GONGMANG',
  SHINSAL = 'SHINSAL',
  LUCK_CYCLE = 'LUCK_CYCLE',
}

export const TRACE_CATEGORY_INFO: Record<TraceCategory, { koreanName: string }> = {
  [TraceCategory.TIME_ADJUSTMENT]: { koreanName: '시간 보정' },
  [TraceCategory.YEAR_PILLAR]:     { koreanName: '년주 계산' },
  [TraceCategory.MONTH_PILLAR]:    { koreanName: '월주 계산' },
  [TraceCategory.DAY_PILLAR]:      { koreanName: '일주 계산' },
  [TraceCategory.HOUR_PILLAR]:     { koreanName: '시주 계산' },
  [TraceCategory.HIDDEN_STEMS]:    { koreanName: '지장간 분석' },
  [TraceCategory.TEN_GODS]:        { koreanName: '십성 분석' },
  [TraceCategory.TWELVE_STAGES]:   { koreanName: '십이운성' },
  [TraceCategory.RELATIONS]:       { koreanName: '합충형파해' },
  [TraceCategory.STRENGTH]:        { koreanName: '신강신약 분석' },
  [TraceCategory.YONGSHIN]:        { koreanName: '용신 결정' },
  [TraceCategory.GYEOKGUK]:        { koreanName: '격국 판단' },
  [TraceCategory.GONGMANG]:        { koreanName: '공망 분석' },
  [TraceCategory.SHINSAL]:         { koreanName: '신살 탐지' },
  [TraceCategory.LUCK_CYCLE]:      { koreanName: '운세 계산' },
};

export function createTraceEntry(params: {
  step: string;
  category: TraceCategory;
  decision: string;
  reasoning: string;
  rule: string;
  alternatives?: readonly AlternativeDecision[];
  configKey?: string | null;
  confidence?: number;
}): TraceEntry {
  const confidence = params.confidence ?? 1.0;
  if (confidence < 0.0 || confidence > 1.0) {
    throw new Error(`confidence must be in [0.0, 1.0], was ${confidence}`);
  }
  return {
    step: params.step,
    category: params.category,
    decision: params.decision,
    reasoning: params.reasoning,
    rule: params.rule,
    alternatives: params.alternatives ?? [],
    configKey: params.configKey ?? null,
    confidence,
  };
}

export class CalculationTracer {
  private readonly _entries: TraceEntry[] = [];

    get entries(): readonly TraceEntry[] {
    return [...this._entries];
  }

    get size(): number {
    return this._entries.length;
  }

    add(entry: TraceEntry): void {
    this._entries.push(entry);
  }

    addEntry(params: {
    step: string;
    category: TraceCategory;
    decision: string;
    reasoning: string;
    rule: string;
    alternatives?: readonly AlternativeDecision[];
    configKey?: string | null;
    confidence?: number;
  }): void {
    this.add(createTraceEntry(params));
  }

    byCategory(category: TraceCategory): readonly TraceEntry[] {
    return this._entries.filter(e => e.category === category);
  }

    disagreements(): readonly TraceEntry[] {
    return this._entries.filter(e => e.alternatives.length > 0);
  }

    uncertain(threshold: number = 0.9): readonly TraceEntry[] {
    return this._entries.filter(e => e.confidence < threshold);
  }

    toKoreanSummary(): string {
    const lines: string[] = [];
    let currentCategory: TraceCategory | null = null;
    for (const entry of this._entries) {
      if (entry.category !== currentCategory) {
        currentCategory = entry.category;
        lines.push('');
        lines.push(`=== ${TRACE_CATEGORY_INFO[currentCategory].koreanName} ===`);
      }
      lines.push(`  [${entry.step}] ${entry.decision}`);
      lines.push(`    근거: ${entry.reasoning}`);
      if (entry.rule) {
        lines.push(`    규칙: ${entry.rule}`);
      }
      if (entry.alternatives.length > 0) {
        lines.push('    ※ 유파별 차이:');
        for (const alt of entry.alternatives) {
          lines.push(`      - ${alt.schoolName}: ${alt.decision} (${alt.reasoning})`);
        }
      }
      if (entry.confidence < 1.0) {
        lines.push(`    확신도: ${Math.round(entry.confidence * 100)}%`);
      }
    }
    return lines.join('\n');
  }

    merge(other: CalculationTracer): void {
    for (const entry of other.entries) {
      this._entries.push(entry);
    }
  }

    clear(): void {
    this._entries.length = 0;
  }
}

