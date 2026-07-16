/**
 * Pure candidate-selection policy for SpringEngine.
 *
 * This module deliberately owns no repositories, candidate generation,
 * rejection accounting, or request defaults.  It receives fully evaluated
 * candidates and applies deterministic score formatting, Pareto selection,
 * diversity ordering, de-duplication, and page slicing.
 *
 * It is an internal module, not part of the package-root public API.
 */
import {
  isRecognizedHanjaGlyph,
  normalizeToOrthodoxHanja,
} from './hanja-annotations.js';
import type {
  CandidateStrengthProfile,
  NameCharInput,
  NamingScoreVector,
  SpringCandidate,
  SpringCandidateSummary,
  SpringOptions,
  SpringReport,
} from './types.js';

/** Round a score to one decimal place. */
export function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}

export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, roundScore(value)));
}

export function finiteScore(value: unknown): number | null {
  if (value == null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? clampScore(numeric) : null;
}

export function averageScores(values: Array<number | null | undefined>): number | null {
  const finite = values.filter((value): value is number =>
    typeof value === 'number' && Number.isFinite(value));
  if (!finite.length) return null;
  return clampScore(finite.reduce((sum, value) => sum + value, 0) / finite.length);
}

const NAMING_AXIS_DISPLAY_LABELS: Readonly<
  Record<keyof NamingScoreVector | 'riskQuality', string>
> = {
  legal: '법적 사용 가능성',
  sajuFit: '사주 보완',
  yongshinFit: '용신 보강',
  elementBalance: '오행 균형',
  hanjaMeaning: '한자 의미',
  phonetic: '발음 흐름',
  eraFit: '시대감',
  familyFit: '성과 이름 연결',
  risk: '주의 신호',
  riskQuality: '주의 신호 안정도',
};

function formatCandidateScore(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${roundScore(value)}점`
    : '자료 없음';
}

export function deriveCandidateStrengthProfile(
  vector: NamingScoreVector,
  paretoFrontier: boolean = false,
): CandidateStrengthProfile {
  const riskQuality = clampScore(100 - vector.risk);
  const profileRows: Array<{
    readonly id: CandidateStrengthProfile['id'];
    readonly label: string;
    readonly primaryAxis: CandidateStrengthProfile['primaryAxis'];
    readonly score: number | null;
    readonly axes: Array<keyof NamingScoreVector | 'riskQuality'>;
  }> = [
    {
      id: 'saju_reinforcement',
      label: '사주 보완형',
      primaryAxis: 'sajuFit',
      score: averageScores([vector.sajuFit, vector.yongshinFit, vector.elementBalance]),
      axes: ['sajuFit', 'yongshinFit', 'elementBalance'],
    },
    {
      id: 'phonetic_stability',
      label: '발음 안정형',
      primaryAxis: 'phonetic',
      score: averageScores([vector.phonetic, vector.familyFit, riskQuality]),
      axes: ['phonetic', 'familyFit', 'riskQuality'],
    },
    {
      id: 'era_balance',
      label: '시대 조화형',
      primaryAxis: 'eraFit',
      score: averageScores([vector.eraFit, riskQuality]),
      axes: ['eraFit', 'riskQuality'],
    },
    {
      id: 'legal_meaning',
      label: '한자 의미 안정형',
      primaryAxis: 'legal',
      score: averageScores([vector.legal, vector.hanjaMeaning, riskQuality]),
      axes: ['legal', 'hanjaMeaning', 'riskQuality'],
    },
    {
      id: 'risk_managed',
      label: '위험 관리형',
      primaryAxis: 'risk',
      score: riskQuality,
      axes: ['riskQuality'],
    },
    {
      id: 'balanced',
      label: '균형형',
      primaryAxis: 'balanced',
      score: averageScores([
        vector.legal,
        vector.sajuFit,
        vector.yongshinFit,
        vector.elementBalance,
        vector.hanjaMeaning,
        vector.phonetic,
        vector.eraFit,
        vector.familyFit,
        riskQuality,
      ]),
      axes: [
        'legal',
        'sajuFit',
        'yongshinFit',
        'elementBalance',
        'hanjaMeaning',
        'phonetic',
        'eraFit',
        'familyFit',
        'riskQuality',
      ],
    },
  ];
  const selected = profileRows
    .filter((row): row is typeof profileRows[number] & { readonly score: number } =>
      row.score !== null)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))[0];

  if (!selected) {
    return {
      id: 'balanced',
      label: '균형형',
      primaryAxis: 'balanced',
      reasons: ['비교할 수 있는 점수 벡터 축이 아직 없어요.'],
      displayReasons: ['비교할 수 있는 점수 정보가 아직 없어요.'],
      paretoFrontier,
    };
  }

  const displayReasons = selected.axes.map((axis) => {
    const value = axis === 'riskQuality' ? riskQuality : vector[axis];
    return `${NAMING_AXIS_DISPLAY_LABELS[axis]} ${formatCandidateScore(value)}`;
  });

  return {
    id: selected.id,
    label: selected.label,
    primaryAxis: selected.primaryAxis,
    reasons: displayReasons,
    displayReasons,
    paretoFrontier,
  };
}

interface CandidateSelectionInfo {
  readonly score: number;
  readonly vector?: NamingScoreVector;
  readonly profile?: CandidateStrengthProfile;
  readonly givenHangul: string;
  readonly givenHanja: string;
  readonly syllables: readonly string[];
  readonly orthodoxHanjas: readonly string[];
}

interface CandidateDiversityState {
  readonly profileCounts: Map<string, number>;
  readonly syllableCounts: Map<string, number>;
  readonly hanjaCounts: Map<string, number>;
  readonly hangulCounts: Map<string, number>;
  readonly hanjaNameCounts: Map<string, number>;
}

/**
 * Runtime limits for the opt-in candidate selection policy.
 *
 * Pareto dominance and diversity ordering are quadratic, so callers must
 * provide a finite, positive pool limit. Candidates outside that score-sorted
 * pool retain their stable score order and are not marked as frontier rows.
 */
export interface CandidateSelectionLimits {
  readonly paretoPoolLimit: number;
}

export interface CandidateNameDiversityInfo {
  readonly givenHangul: string;
  readonly givenHanja: string;
  readonly syllables: readonly string[];
  readonly orthodoxHanjas: readonly string[];
  readonly hasRepeatedSyllable: boolean;
  readonly hasRepeatedOrthodoxHanja: boolean;
}

function normalizedHanjaKey(hanja: string | undefined): string {
  const value = String(hanja ?? '').trim();
  return isRecognizedHanjaGlyph(value) ? normalizeToOrthodoxHanja(value) : '';
}

export function describeCandidateName(
  chars: readonly NameCharInput[],
): CandidateNameDiversityInfo {
  const syllables = chars.map((char) => String(char.hangul ?? '').trim()).filter(Boolean);
  const orthodoxHanjas = chars.map((char) => normalizedHanjaKey(char.hanja)).filter(Boolean);
  return {
    givenHangul: syllables.join(''),
    givenHanja: orthodoxHanjas.join(''),
    syllables,
    orthodoxHanjas,
    hasRepeatedSyllable: new Set(syllables).size < syllables.length,
    hasRepeatedOrthodoxHanja: new Set(orthodoxHanjas).size < orthodoxHanjas.length,
  };
}

function vectorDominates(a: NamingScoreVector, b: NamingScoreVector): boolean {
  const axisValues = (vector: NamingScoreVector): Array<number | null> => [
    vector.legal,
    vector.sajuFit,
    vector.yongshinFit,
    vector.elementBalance,
    vector.hanjaMeaning,
    vector.phonetic,
    vector.eraFit,
    vector.familyFit,
    100 - vector.risk,
  ];
  const aValues = axisValues(a);
  const bValues = axisValues(b);
  let comparable = 0;
  let strictlyBetter = false;
  for (let index = 0; index < aValues.length; index += 1) {
    const left = aValues[index];
    const right = bValues[index];
    if (left == null || right == null) continue;
    comparable += 1;
    if (left < right - 0.000001) return false;
    if (left > right + 0.000001) strictlyBetter = true;
  }
  return comparable >= 2 && strictlyBetter;
}

function emptyDiversityState(): CandidateDiversityState {
  return {
    profileCounts: new Map(),
    syllableCounts: new Map(),
    hanjaCounts: new Map(),
    hangulCounts: new Map(),
    hanjaNameCounts: new Map(),
  };
}

function diversityPenalty(info: CandidateSelectionInfo, state: CandidateDiversityState): number {
  let penalty = 0;
  penalty += (state.profileCounts.get(info.profile?.id ?? '') ?? 0) * 4;
  penalty += (state.hangulCounts.get(info.givenHangul) ?? 0) * 8;
  if (info.givenHanja) penalty += (state.hanjaNameCounts.get(info.givenHanja) ?? 0) * 8;
  for (const syllable of info.syllables) {
    penalty += Math.min(5, (state.syllableCounts.get(syllable) ?? 0) * 2.5);
  }
  for (const hanja of info.orthodoxHanjas) {
    penalty += Math.min(5, (state.hanjaCounts.get(hanja) ?? 0) * 2.5);
  }
  return penalty;
}

function recordDiversitySelection(
  info: CandidateSelectionInfo,
  state: CandidateDiversityState,
): void {
  const add = (map: Map<string, number>, key: string): void => {
    if (!key) return;
    map.set(key, (map.get(key) ?? 0) + 1);
  };
  add(state.profileCounts, info.profile?.id ?? '');
  add(state.hangulCounts, info.givenHangul);
  add(state.hanjaNameCounts, info.givenHanja);
  for (const syllable of info.syllables) add(state.syllableCounts, syllable);
  for (const hanja of info.orthodoxHanjas) add(state.hanjaCounts, hanja);
}

function orderParetoCandidates<T>(
  items: readonly T[],
  useParetoFrontier: boolean,
  getInfo: (item: T) => CandidateSelectionInfo,
  withParetoFrontier: (item: T, paretoFrontier: boolean) => T,
  limits?: CandidateSelectionLimits,
): T[] {
  const sorted = items
    .map((item, originalIndex) => ({ item, originalIndex, info: getInfo(item) }))
    .sort((a, b) => b.info.score - a.info.score || a.originalIndex - b.originalIndex);
  if (!useParetoFrontier) return sorted.map((row) => row.item);

  if (!limits) {
    throw new RangeError('candidate selection limits are required in Pareto mode');
  }
  if (!Number.isInteger(limits.paretoPoolLimit) || limits.paretoPoolLimit <= 0) {
    throw new RangeError('paretoPoolLimit must be a positive integer');
  }

  const paretoPoolSize = Math.min(sorted.length, limits.paretoPoolLimit);
  const rows = sorted
    .slice(0, paretoPoolSize)
    .map((row, index) => ({ item: row.item, index, info: row.info }));
  const overflow = sorted.slice(paretoPoolSize);

  const frontier = new Set<number>();
  for (const row of rows) {
    const rowVector = row.info.vector;
    if (!rowVector) continue;
    const dominated = rows.some((other) =>
      other.index !== row.index
      && other.info.vector
      && vectorDominates(other.info.vector, rowVector));
    if (!dominated) frontier.add(row.index);
  }

  const state = emptyDiversityState();
  const remaining = [...rows];
  const ordered: T[] = [];

  while (remaining.length > 0) {
    const bestScore = Math.max(...remaining.map((row) => row.info.score));
    const window = remaining.filter((row) => row.info.score >= bestScore - 8);
    const selected = window
      .map((row) => {
        const frontierBonus = frontier.has(row.index) ? 3 : 0;
        const diversity = diversityPenalty(row.info, state);
        const profileNovelty =
          (state.profileCounts.get(row.info.profile?.id ?? '') ?? 0) === 0 ? 2 : 0;
        return {
          row,
          selectorScore: row.info.score + frontierBonus + profileNovelty - diversity,
        };
      })
      .sort((a, b) =>
        b.selectorScore - a.selectorScore
        || b.row.info.score - a.row.info.score
        || a.row.index - b.row.index)[0];

    const selectedIndex = remaining.findIndex((row) => row.index === selected.row.index);
    remaining.splice(selectedIndex, 1);
    recordDiversitySelection(selected.row.info, state);
    ordered.push(withParetoFrontier(selected.row.item, frontier.has(selected.row.index)));
  }

  return [
    ...ordered,
    ...overflow.map((row) => withParetoFrontier(row.item, false)),
  ];
}

function withParetoFlag(
  profile: CandidateStrengthProfile | undefined,
  paretoFrontier: boolean,
): CandidateStrengthProfile | undefined {
  return profile ? { ...profile, paretoFrontier } : undefined;
}

function shouldUseParetoFrontier(options?: SpringOptions): boolean {
  return options?.precisionConfig?.paretoFrontierCandidates === true;
}

function selectionInfoForSpringReport(report: SpringReport): CandidateSelectionInfo {
  const diversity = describeCandidateName(
    report.namingReport.name.givenName.map((char) => ({
      hangul: char.hangul,
      hanja: char.hanja,
    })),
  );
  return {
    score: report.finalScore,
    vector: report.scoreVector,
    profile: report.strengthProfile,
    ...diversity,
  };
}

function selectionInfoForCandidateSummary(
  summary: SpringCandidateSummary,
): CandidateSelectionInfo {
  const diversity = describeCandidateName(summary.givenName);
  return {
    score: summary.finalScore,
    vector: summary.scoreVector,
    profile: summary.strengthProfile,
    ...diversity,
  };
}

function selectionInfoForSpringCandidate(candidate: SpringCandidate): CandidateSelectionInfo {
  const diversity = describeCandidateName(
    candidate.name.givenName.map((char) => ({
      hangul: char.hangul,
      hanja: char.hanja,
    })),
  );
  return {
    score: candidate.scores.total,
    vector: candidate.scoreVector,
    profile: candidate.strengthProfile,
    ...diversity,
  };
}

export function orderSpringReports(
  results: readonly SpringReport[],
  options?: SpringOptions,
  limits?: CandidateSelectionLimits,
): SpringReport[] {
  const useParetoFrontier = shouldUseParetoFrontier(options);
  return orderParetoCandidates(
    results,
    useParetoFrontier,
    selectionInfoForSpringReport,
    (report, paretoFrontier) => {
      const strengthProfile = withParetoFlag(report.strengthProfile, paretoFrontier);
      const namingStrengthProfile = withParetoFlag(
        report.namingReport.strengthProfile,
        paretoFrontier,
      );
      return {
        ...report,
        ...(strengthProfile ? { strengthProfile } : {}),
        namingReport: {
          ...report.namingReport,
          ...(namingStrengthProfile ? { strengthProfile: namingStrengthProfile } : {}),
        },
      };
    },
    limits,
  ).map((report, index) => ({ ...report, rank: index + 1 }));
}

export function orderCandidateSummaries(
  results: readonly SpringCandidateSummary[],
  options?: SpringOptions,
  limits?: CandidateSelectionLimits,
): SpringCandidateSummary[] {
  const useParetoFrontier = shouldUseParetoFrontier(options);
  return orderParetoCandidates(
    results,
    useParetoFrontier,
    selectionInfoForCandidateSummary,
    (summary, paretoFrontier) => ({
      ...summary,
      ...(summary.strengthProfile
        ? { strengthProfile: withParetoFlag(summary.strengthProfile, paretoFrontier) }
        : {}),
    }),
    limits,
  ).map((summary, index) => ({ ...summary, rank: index + 1 }));
}

export function dedupeCandidateSummariesByHangul(
  results: readonly SpringCandidateSummary[],
): SpringCandidateSummary[] {
  const seen = new Set<string>();
  const deduped: SpringCandidateSummary[] = [];
  for (const summary of results) {
    const key = summary.fullHangul || summary.givenHangul;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(summary);
  }
  return deduped.map((summary, index) => ({ ...summary, rank: index + 1 }));
}

export function sliceCandidatePage<T>(
  results: readonly T[],
  offset: number,
  limit: number,
): T[] {
  if (
    !Number.isSafeInteger(offset)
    || offset < 0
    || !Number.isSafeInteger(limit)
    || limit <= 0
    || !Number.isSafeInteger(offset + limit)
  ) {
    throw new RangeError('Candidate pagination requires bounded integer offset and limit values.');
  }
  return results.slice(offset, offset + limit);
}

export function sliceAndRankCandidatePage<T extends { readonly rank: number }>(
  results: readonly T[],
  offset: number,
  limit: number,
): T[] {
  return sliceCandidatePage(results, offset, limit)
    .map((candidate, index) => ({ ...candidate, rank: offset + index + 1 }));
}

export function orderSpringCandidates(
  results: readonly SpringCandidate[],
  options?: SpringOptions,
  limits?: CandidateSelectionLimits,
): SpringCandidate[] {
  const useParetoFrontier = shouldUseParetoFrontier(options);
  return orderParetoCandidates(
    results,
    useParetoFrontier,
    selectionInfoForSpringCandidate,
    (candidate, paretoFrontier) => ({
      ...candidate,
      ...(candidate.strengthProfile
        ? { strengthProfile: withParetoFlag(candidate.strengthProfile, paretoFrontier) }
        : {}),
    }),
    limits,
  );
}
