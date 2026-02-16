import type { SajuAnalysis } from '../domain/SajuAnalysis.js';
import { ANALYSIS_KEYS } from '../domain/SajuAnalysis.js';

const TRACE_SECTION_NAMES: Record<string, string> = {
  core: '사주 원국 계산',
  [ANALYSIS_KEYS.TEN_GODS]: '십성 분석',
  [ANALYSIS_KEYS.HIDDEN_STEMS]: '지장간 분석',
  [ANALYSIS_KEYS.CHEONGAN_RELATIONS]: '천간 관계 감지',
  [ANALYSIS_KEYS.HAPWHA]: '천간 합화 평가',
  [ANALYSIS_KEYS.RESOLVED_JIJI]: '지지 관계 분석',
  [ANALYSIS_KEYS.SCORED_CHEONGAN]: '천간 관계 점수',
  [ANALYSIS_KEYS.SIBI_UNSEONG]: '십이운성 산출',
  [ANALYSIS_KEYS.GONGMANG]: '공망 계산',
  [ANALYSIS_KEYS.STRENGTH]: '신강/신약 판정',
  [ANALYSIS_KEYS.GYEOKGUK]: '격국 판별',
  [ANALYSIS_KEYS.YONGSHIN]: '용신 결정',
  [ANALYSIS_KEYS.SHINSAL]: '신살 감지',
  [ANALYSIS_KEYS.WEIGHTED_SHINSAL]: '신살 가중치',
  [ANALYSIS_KEYS.SHINSAL_COMPOSITES]: '신살 조합',
  [ANALYSIS_KEYS.PALACE]: '궁성 분석',
  [ANALYSIS_KEYS.DAEUN]: '대운 산출',
  [ANALYSIS_KEYS.SAEUN]: '세운 산출',
};

function traceSectionName(key: string): string {
  return TRACE_SECTION_NAMES[key] ?? key;
}

export function buildCalculationReasoning(a: SajuAnalysis): string {
  const stepsWithReasoning = a.trace.filter(s => s.reasoning.length > 0);
  if (stepsWithReasoning.length === 0) return '';

  const lines: string[] = [];
  lines.push('■ 계산 근거 상세 — 왜 이렇게 계산되었나?');
  lines.push('');

  for (const step of stepsWithReasoning) {
    const sectionName = traceSectionName(step.key);
    lines.push(`【${sectionName}】`);
    for (const line of step.reasoning) {
      lines.push(`  · ${line}`);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

export function buildTraceOverview(a: SajuAnalysis): string {
  if (a.trace.length === 0) return '';

  const lines: string[] = [];
  lines.push(`■ 분석 단계별 요약 (${a.trace.length}단계)`);
  lines.push('');

  for (let idx = 0; idx < a.trace.length; idx++) {
    const step = a.trace[idx]!;
    const label = traceSectionName(step.key);
    const summaryLine = step.summary || '완료';
    lines.push(`  ${idx + 1}. ${label} \u2713`);
    lines.push(`     ${summaryLine}`);
  }
  lines.push('');
  const withReasoning = a.trace.filter(s => s.reasoning.length > 0).length;
  lines.push(`전체: ${a.trace.length}단계 완료, 설명 커버리지: ${withReasoning}/${a.trace.length}`);

  return lines.join('\n').trimEnd();
}

