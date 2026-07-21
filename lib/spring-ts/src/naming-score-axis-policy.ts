import type { NamingScoreVector } from './types.js';

export type NamingScoreAxis = keyof NamingScoreVector;
export type NamingScoreBand = 'excellent' | 'good' | 'mixed' | 'caution';
export type NamingScoreDirection = 'higher_is_better' | 'higher_is_risk';
export type NamingEvidenceRole = 'summary' | 'detail' | 'standalone';

interface NamingScoreSignalThresholds {
  readonly strengthAtOrAbove?: number;
  readonly strengthAtOrBelow?: number;
  readonly cautionAtOrAbove?: number;
  readonly cautionAtOrBelow?: number;
}

export interface NamingScoreAxisPolicy {
  readonly label: string;
  readonly profileLabel: string;
  readonly direction: NamingScoreDirection;
  readonly evidenceRole: NamingEvidenceRole;
  readonly signal: NamingScoreSignalThresholds;
}

/**
 * Shared report bands. These preserve the existing 80-point strength signal,
 * 65-point good-name tier, and 45-point caution boundary.
 */
export const NAMING_SCORE_BANDS = Object.freeze({
  excellentMin: 80,
  goodMin: 65,
  mixedMin: 46,
  cautionMin: 0,
});

const STANDARD_STRENGTH_MIN = 80;
const STANDARD_CAUTION_MAX = 45;
const RISK_STRENGTH_MAX = 30;
const RISK_CAUTION_MIN = 60;

const STANDARD_SIGNAL: NamingScoreSignalThresholds = Object.freeze({
  strengthAtOrAbove: STANDARD_STRENGTH_MIN,
  cautionAtOrBelow: STANDARD_CAUTION_MAX,
});

export const NAMING_SCORE_AXIS_POLICIES: Readonly<Record<NamingScoreAxis, NamingScoreAxisPolicy>> =
  Object.freeze({
    legal: {
      label: '인명용 한자 적합도',
      profileLabel: '법적 사용 가능성',
      direction: 'higher_is_better',
      evidenceRole: 'standalone',
      signal: STANDARD_SIGNAL,
    },
    sajuFit: {
      label: '사주와 이름의 조화',
      profileLabel: '사주 보완',
      direction: 'higher_is_better',
      evidenceRole: 'summary',
      signal: STANDARD_SIGNAL,
    },
    yongshinFit: {
      label: '보완 기운 일치도',
      profileLabel: '용신 보강',
      direction: 'higher_is_better',
      evidenceRole: 'detail',
      signal: STANDARD_SIGNAL,
    },
    elementBalance: {
      label: '오행 균형',
      profileLabel: '오행 균형',
      direction: 'higher_is_better',
      evidenceRole: 'detail',
      signal: STANDARD_SIGNAL,
    },
    hanjaMeaning: {
      label: '한자 뜻풀이 확인도(뜻의 우열 아님)',
      profileLabel: '한자 뜻풀이 확인도(뜻의 우열 아님)',
      direction: 'higher_is_better',
      evidenceRole: 'standalone',
      signal: Object.freeze({
        strengthAtOrAbove: STANDARD_STRENGTH_MIN,
        cautionAtOrBelow: STANDARD_STRENGTH_MIN - 1,
      }),
    },
    phonetic: {
      label: '발음 흐름',
      profileLabel: '발음 흐름',
      direction: 'higher_is_better',
      evidenceRole: 'standalone',
      signal: STANDARD_SIGNAL,
    },
    eraFit: {
      label: '출생 시대 이름 흐름',
      profileLabel: '시대감',
      direction: 'higher_is_better',
      evidenceRole: 'standalone',
      signal: STANDARD_SIGNAL,
    },
    familyFit: {
      label: '성과 이름의 발음 연결',
      profileLabel: '성과 이름 연결',
      direction: 'higher_is_better',
      evidenceRole: 'standalone',
      signal: STANDARD_SIGNAL,
    },
    risk: {
      label: '위험 신호 점검',
      profileLabel: '주의 신호',
      direction: 'higher_is_risk',
      evidenceRole: 'standalone',
      signal: Object.freeze({
        strengthAtOrBelow: RISK_STRENGTH_MAX,
        cautionAtOrAbove: RISK_CAUTION_MIN,
      }),
    },
  });

export const NAMING_SCORE_AXIS_ORDER: readonly NamingScoreAxis[] = Object.freeze([
  'legal',
  'sajuFit',
  'yongshinFit',
  'elementBalance',
  'hanjaMeaning',
  'phonetic',
  'eraFit',
  'familyFit',
  'risk',
]);

export function classifyNamingScoreBand(
  axis: NamingScoreAxis,
  value: number | null | undefined,
): NamingScoreBand | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;

  if (NAMING_SCORE_AXIS_POLICIES[axis].direction === 'higher_is_risk') {
    if (value >= RISK_CAUTION_MIN) return 'caution';
    if (value >= NAMING_SCORE_BANDS.mixedMin) return 'mixed';
    if (value > RISK_STRENGTH_MAX) return 'good';
    return 'excellent';
  }

  if (value >= NAMING_SCORE_BANDS.excellentMin) return 'excellent';
  if (value >= NAMING_SCORE_BANDS.goodMin) return 'good';
  if (value >= NAMING_SCORE_BANDS.mixedMin) return 'mixed';
  return 'caution';
}

export function isNamingScoreStrength(axis: NamingScoreAxis, value: number): boolean {
  const signal = NAMING_SCORE_AXIS_POLICIES[axis].signal;
  return (signal.strengthAtOrAbove !== undefined && value >= signal.strengthAtOrAbove)
    || (signal.strengthAtOrBelow !== undefined && value <= signal.strengthAtOrBelow);
}

export function isNamingScoreCaution(axis: NamingScoreAxis, value: number): boolean {
  const signal = NAMING_SCORE_AXIS_POLICIES[axis].signal;
  return (signal.cautionAtOrAbove !== undefined && value >= signal.cautionAtOrAbove)
    || (signal.cautionAtOrBelow !== undefined && value <= signal.cautionAtOrBelow);
}
