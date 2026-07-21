import type {
  SajuAnalysisDiagnostic,
  SajuAnalysisStatus,
  SajuSummary,
} from './types.js';

export const SAJU_ANALYSIS_UNAVAILABLE = 'SAJU_ANALYSIS_UNAVAILABLE' as const;

export function isScorableSajuSummary(summary: SajuSummary): boolean {
  return !summary.analysisStatus
    && !!summary.dayMaster?.element
    && !!summary.yongshin?.element
    && !!summary.gyeokguk?.type;
}

export class SajuAnalysisUnavailableError extends Error {
  readonly code = SAJU_ANALYSIS_UNAVAILABLE;
  readonly analysisStatus: SajuAnalysisStatus;
  readonly diagnostics: readonly SajuAnalysisDiagnostic[];

  constructor(summary: SajuSummary) {
    const diagnostics = summary.diagnostics ?? [];
    super(diagnostics[0]?.message ?? '사주 분석을 완료하지 못해 계산형 결과를 만들 수 없습니다.');
    this.name = 'SajuAnalysisUnavailableError';
    this.analysisStatus = summary.analysisStatus ?? 'failed';
    this.diagnostics = diagnostics;
  }
}

export function assertScorableSajuSummary(summary: SajuSummary): void {
  if (!isScorableSajuSummary(summary)) {
    throw new SajuAnalysisUnavailableError(summary);
  }
}
