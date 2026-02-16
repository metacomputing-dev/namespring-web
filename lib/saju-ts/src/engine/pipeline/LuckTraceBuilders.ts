import { type DaeunInfo } from '../../domain/DaeunInfo.js';
import { type SaeunPillar } from '../../domain/SaeunInfo.js';
import { ANALYSIS_KEYS } from '../../domain/SajuAnalysis.js';
import { tracedStep } from './TraceHelpers.js';

function buildDaeunTraceEvidence(daeun: DaeunInfo): string[] {
  return [
    `forward=${daeun.isForward}`,
    `startAge=${daeun.firstDaeunStartAge}`,
    `count=${daeun.daeunPillars.length}`,
    `boundaryMode=${daeun.boundaryMode}`,
    ...daeun.warnings,
  ];
}

function buildSaeunTraceEvidence(saeunStartYear: number, saeunCount: number): string[] {
  return [`startYear=${saeunStartYear}`, `count=${saeunCount}`];
}

export function buildDaeunTraceStep(
  daeun: DaeunInfo,
  daeunReasoning: readonly string[],
) {
  return tracedStep(
    ANALYSIS_KEYS.DAEUN,
    `대운 산출 — ${daeun.isForward ? '순행(順行)' : '역행(逆行)'}, ` +
    `${daeun.firstDaeunStartAge}세 시작, ${daeun.daeunPillars.length}주기.`,
    buildDaeunTraceEvidence(daeun),
    daeunReasoning,
  );
}

export function buildSaeunTraceStep(
  saeunStartYear: number,
  saeun: readonly SaeunPillar[],
  saeunReasoning: readonly string[],
) {
  return tracedStep(
    ANALYSIS_KEYS.SAEUN,
    `세운(歲運) 산출 — ${saeunStartYear}년부터 ${saeun.length}년간.`,
    buildSaeunTraceEvidence(saeunStartYear, saeun.length),
    saeunReasoning,
  );
}

