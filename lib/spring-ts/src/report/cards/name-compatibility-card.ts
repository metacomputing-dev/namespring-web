/**
 * name-compatibility-card.ts -- Build a NameCompatibilityCard
 *
 * Evaluates how well a name fits the person's saju by combining:
 *   - springReport.finalScore (overall score)
 *   - springReport.sajuCompatibility.affinityScore (saju compatibility)
 *   - springReport.namingReport.totalScore (pure name analysis)
 *
 * Converts the overallScore to a 1-5 star rating and generates
 * a summary with detail lines in friendly Korean (~해요 tone).
 *
 * Returns null when springReport is null (no name data available).
 */

import type { SpringReport, EvidenceRow, SajuNameSafetyProfile } from '../../types.js';
import type { NameCompatibilityCard, StarRating } from '../types.js';

// ---------------------------------------------------------------------------
//  Score-to-stars conversion
// ---------------------------------------------------------------------------

function scoreToStars(score: number): StarRating {
  if (score >= 85) return 5;
  if (score >= 70) return 4;
  if (score >= 55) return 3;
  if (score >= 40) return 2;
  return 1;
}

// ---------------------------------------------------------------------------
//  Star-label descriptions
// ---------------------------------------------------------------------------

const STAR_DESCRIPTIONS: Record<StarRating, string> = {
  5: '조화가 단단하게 잡혀 있어요',
  4: '대체로 부드럽게 어울리는 편이에요',
  3: '무난한 수준의 궁합이에요',
  2: '약간의 보완을 더하면 좋아요',
  1: '보완해 두면 좋은 부분이 있어요',
};

// ---------------------------------------------------------------------------
//  Score-range descriptions for detail lines
// ---------------------------------------------------------------------------

function overallScoreDetail(score: number): string {
  if (score >= 85) return `종합 점수는 ${Math.round(score)}점으로, 이름과 사주의 합이 단단하게 받쳐 줘요.`;
  if (score >= 70) return `종합 점수는 ${Math.round(score)}점으로, 이름과 사주의 조화가 좋은 편이에요.`;
  if (score >= 55) return `종합 점수는 ${Math.round(score)}점으로, 이름과 사주가 무난한 호흡을 이루고 있어요.`;
  if (score >= 40) return `종합 점수는 ${Math.round(score)}점으로, 조화를 높이기 위한 작은 보완이 도움이 돼요.`;
  return `종합 점수는 ${Math.round(score)}점이에요. 이름의 에너지를 보완해 두면 흐름을 더 부드럽게 만들 수 있어요.`;
}

function sajuCompatibilityDetail(score: number): string {
  if (score >= 80) return `사주 궁합 점수는 ${Math.round(score)}점이에요. 이름의 오행이 사주의 흐름과 든든히 맞물려요.`;
  if (score >= 60) return `사주 궁합 점수는 ${Math.round(score)}점이에요. 이름이 사주의 흐름을 안정적으로 받쳐 주고 있어요.`;
  if (score >= 40) return `사주 궁합 점수는 ${Math.round(score)}점이에요. 이름과 사주의 연결은 보통 수준이에요.`;
  return `사주 궁합 점수는 ${Math.round(score)}점이에요. 이름의 오행이 사주와 살짝 어긋나는 부분이 있어요.`;
}

function nameAnalysisDetail(score: number): string {
  if (score >= 80) return `이름 분석 점수는 ${Math.round(score)}점이에요. 한글과 한자의 구성이 단정하게 어울려요.`;
  if (score >= 60) return `이름 분석 점수는 ${Math.round(score)}점이에요. 이름 자체의 균형이 좋은 편이에요.`;
  if (score >= 40) return `이름 분석 점수는 ${Math.round(score)}점이에요. 이름 구성이 무난한 수준이에요.`;
  return `이름 분석 점수는 ${Math.round(score)}점이에요. 이름의 획수나 오행 구성에 보완 여지가 있어요.`;
}

function tenGodContributionLabel(row: NonNullable<SpringReport['sajuCompatibility']['tenGodPositionEvidence']>['topContributions'][number]): string {
  const impact = row.visibility ?? row.weight;
  const details = [
    `${row.position}/${row.source}/${row.group}`,
    `impact ${impact.toFixed(2)}`,
  ];
  if (row.stem) details.push(`stem ${row.stem}`);
  if (row.ratio != null) details.push(`ratio ${Math.round(row.ratio)}`);
  if (row.rank != null) details.push(`rank ${row.rank}`);
  if (row.presence != null) details.push(`presence ${row.presence.toFixed(2)}`);
  return details.join(' ');
}

const ELEMENT_LABELS: Record<string, string> = {
  WOOD: '나무',
  Wood: '나무',
  wood: '나무',
  FIRE: '불',
  Fire: '불',
  fire: '불',
  EARTH: '흙',
  Earth: '흙',
  earth: '흙',
  METAL: '쇠',
  Metal: '쇠',
  metal: '쇠',
  WATER: '물',
  Water: '물',
  water: '물',
};

const SAFETY_POSTURE_LABELS: Record<string, string> = {
  safe: '안정형',
  balanced: '균형형',
  aggressive: '강한 보강형',
};

const ELEMENT_STRATEGY_LABELS: Record<string, string> = {
  legacy_direct_reinforcement: '기존 직접 보강 방식',
  safe_balance: '안정 균형 방식',
  aggressive_reinforcement: '강한 직접 보강 방식',
};

const CONFLICT_LEVEL_LABELS: Record<string, string> = {
  none: '낮음',
  low: '낮음',
  medium: '중간',
  high: '높음',
};

function elementLabel(value: unknown): string {
  const raw = String(value ?? '').trim();
  return ELEMENT_LABELS[raw] ?? raw;
}

function elementListLabel(values: readonly string[] | undefined): string {
  const labels = (values ?? []).map(elementLabel).filter(Boolean);
  return labels.length ? labels.join(', ') : '없음';
}

function safetyPostureLabel(value: string): string {
  return SAFETY_POSTURE_LABELS[value] ?? value;
}

function strategyLabel(value: string): string {
  return ELEMENT_STRATEGY_LABELS[value] ?? value;
}

function conflictLabel(value: string | undefined): string {
  return CONFLICT_LEVEL_LABELS[value ?? 'none'] ?? String(value ?? 'none');
}

function percentLabel(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function scoreVectorFeatureLabels(vector: NonNullable<SpringReport['scoreVector']>): string[] {
  const labels: string[] = [];
  labels.push(`법적 사용 가능성: ${vector.legal ?? '자료 없음'} / 100`);
  labels.push(`사주 조화: ${vector.sajuFit ?? '자료 없음'} / 100`);
  labels.push(`용신 보강: ${vector.yongshinFit ?? '자료 없음'} / 100`);
  labels.push(`오행 균형: ${vector.elementBalance ?? '자료 없음'} / 100`);
  labels.push(`한자 뜻풀이 확인도(뜻의 우열 아님): ${vector.hanjaMeaning ?? '자료 없음'} / 100`);
  labels.push(`발음 흐름: ${vector.phonetic ?? '자료 없음'} / 100`);
  labels.push(`시대감: ${vector.eraFit ?? '자료 없음'} / 100`);
  labels.push(`성과 이름 연결: ${vector.familyFit ?? '자료 없음'} / 100`);
  labels.push(`주의 신호: ${vector.risk} / 100`);
  return labels;
}

function trendStatusLabel(status: string): string {
  return {
    current: '현재에도 자연스러운 이름',
    era_fit: '출생 시기와 어울리는 이름',
    dated: '유행이 지난 이름',
    overused: '최근 사용이 많은 이름',
    unknown: '확인 어려움',
  }[status] ?? status;
}

function phoneticStatusLabel(status: string): string {
  return {
    smooth: '부드러움',
    watch: '주의',
    awkward: '어색함',
    unknown: '확인 어려움',
  }[status] ?? status;
}

function classifySafetyProfile(
  springReport: SpringReport,
): SajuNameSafetyProfile | undefined {
  const scoredProfile = springReport.sajuCompatibility.safetyProfile;
  if (scoredProfile) return scoredProfile;

  const scoreVector = springReport.scoreVector ?? springReport.namingReport.scoreVector;
  const conflictLevel = springReport.sajuCompatibility.yongshinConsensusConflictLevel;
  const competingElements = springReport.sajuCompatibility.yongshinConsensusCompetingElements ?? [];
  const yongshinMatchCount = springReport.sajuCompatibility.yongshinMatchCount;
  const gishinMatchCount = springReport.sajuCompatibility.gishinMatchCount;
  if (
    !scoreVector &&
    !conflictLevel &&
    !springReport.sajuCompatibility.yongshinElement &&
    yongshinMatchCount === 0 &&
    gishinMatchCount === 0
  ) {
    return undefined;
  }
  const vectorRisk = scoreVector?.risk ?? 35;
  const conflictRisk = conflictLevel === 'high'
    ? 45
    : conflictLevel === 'medium'
      ? 30
      : conflictLevel === 'low'
        ? 12
        : 0;
  const harmfulRisk = gishinMatchCount > yongshinMatchCount ? 30 : 0;
  const riskScore = Math.min(100, Math.round(vectorRisk * 0.55 + conflictRisk + harmfulRisk));
  const aggressive = riskScore >= 60 || conflictLevel === 'high' || gishinMatchCount > yongshinMatchCount;
  const safe = riskScore <= 30
    && (conflictLevel == null || conflictLevel === 'none' || conflictLevel === 'low')
    && gishinMatchCount <= yongshinMatchCount;
  const posture = aggressive ? 'aggressive' : safe ? 'safe' : 'balanced';
  const strategy = aggressive ? 'aggressive_reinforcement' : 'safe_balance';
  const reasons = [
    `주의 신호 ${riskScore}/100`,
    `점수 벡터 주의 신호 ${scoreVector?.risk ?? '자료 없음'}/100`,
    `적용 방식: ${strategyLabel(strategy)}`,
    `용신 판단 충돌: ${conflictLabel(conflictLevel)}`,
    `용신 일치 글자 수: ${yongshinMatchCount}`,
    `기신 겹침 글자 수: ${gishinMatchCount}`,
    ...(competingElements.length ? [`충돌 후보 오행: ${elementListLabel(competingElements)}`] : []),
  ];

  return {
    posture,
    strategy,
    riskScore,
    ...(conflictLevel ? { conflictLevel } : {}),
    competingElements,
    yongshinRatio: yongshinMatchCount > 0 ? 1 : 0,
    heesinRatio: 0,
    gishinRatio: gishinMatchCount > 0 ? 1 : 0,
    gusinRatio: 0,
    reasons,
  };
}

function localizeSafetyReason(reason: string): string {
  const trimmed = reason.trim();
  let match = /^risk\s+([0-9.]+)/.exec(trimmed);
  if (match) return `주의 신호 ${match[1]}/100`;
  match = /^vector risk\s+([0-9.]+|n\/a)/.exec(trimmed);
  if (match) return `점수 벡터 주의 신호 ${match[1] === 'n/a' ? '자료 없음' : `${match[1]}/100`}`;
  match = /^strategy\s+(.+)/.exec(trimmed);
  if (match) return `적용 방식: ${strategyLabel(match[1])}`;
  match = /^consensus conflict:\s+(.+)/.exec(trimmed);
  if (match) return `용신 판단 충돌: ${conflictLabel(match[1])}`;
  match = /^competing elements:\s+(.+)/.exec(trimmed);
  if (match) return `충돌 후보 오행: ${elementListLabel(match[1].split(',').map((v) => v.trim()))}`;
  match = /^yongshinRatio\s+([0-9.]+)/.exec(trimmed);
  if (match) return `용신 보강 비율: ${percentLabel(Number(match[1]))}`;
  match = /^heesinRatio\s+([0-9.]+)/.exec(trimmed);
  if (match) return `희신 보조 비율: ${percentLabel(Number(match[1]))}`;
  match = /^gishinRatio\s+([0-9.]+)/.exec(trimmed);
  if (match) return `기신 겹침 비율: ${percentLabel(Number(match[1]))}`;
  match = /^gusinRatio\s+([0-9.]+)/.exec(trimmed);
  if (match) return `구신 겹침 비율: ${percentLabel(Number(match[1]))}`;
  if (trimmed === 'safe balance keeps uncertain yongshin signals from dominating the name.') {
    return '용신 판단이 갈릴 때는 한쪽 기운만 과하게 키우지 않도록 균형을 우선했어요.';
  }
  if (trimmed === 'aggressive reinforcement concentrates on one yongshin element while consensus is uncertain.') {
    return '용신 판단이 갈리는 상태에서 한 오행 보강이 강하게 몰려 있어요.';
  }
  return trimmed;
}

function safetyProfileFeatureLabels(profile: SajuNameSafetyProfile): string[] {
  const labels = [
    `보강 성향: ${safetyPostureLabel(profile.posture)}`,
    `적용 방식: ${strategyLabel(profile.strategy)}`,
    `주의 신호: ${profile.riskScore}/100`,
    `용신 판단 충돌: ${conflictLabel(profile.conflictLevel)}`,
    `충돌 후보 오행: ${elementListLabel(profile.competingElements)}`,
    `용신 보강 비율: ${percentLabel(profile.yongshinRatio)}`,
    `희신 보조 비율: ${percentLabel(profile.heesinRatio)}`,
    `기신 겹침 비율: ${percentLabel(profile.gishinRatio)}`,
    `구신 겹침 비율: ${percentLabel(profile.gusinRatio)}`,
    ...profile.reasons.map(localizeSafetyReason),
  ];
  return [...new Set(labels)];
}

// ---------------------------------------------------------------------------
//  Builder
// ---------------------------------------------------------------------------

export function buildNameCompatibilityCard(
  springReport: SpringReport | null,
): NameCompatibilityCard | null {
  if (!springReport) return null;

  const overallScore = springReport.finalScore;
  const sajuCompatibilityScore = springReport.sajuCompatibility.affinityScore;
  const nameAnalysisScore = springReport.namingReport.totalScore;
  const nameTrend = springReport.nameTrend ?? springReport.namingReport.nameTrend;
  const phonetic = springReport.phonetic ?? springReport.namingReport.phonetic;
  const tenGodPositionEvidence = springReport.sajuCompatibility.tenGodPositionEvidence;
  const scoreVector = springReport.scoreVector ?? springReport.namingReport.scoreVector;
  const strengthProfile = springReport.strengthProfile ?? springReport.namingReport.strengthProfile;
  const safetyProfile = classifySafetyProfile(springReport);
  const elementStrategyEvidence = springReport.sajuCompatibility.elementStrategyEvidence;
  const overallStars = scoreToStars(overallScore);

  // ── Summary ──
  const starDesc = STAR_DESCRIPTIONS[overallStars];
  const summary = `이름 적합도는 별 ${overallStars}개 수준이에요. ${starDesc}. 종합 ${Math.round(overallScore)}점, 사주 궁합 ${Math.round(sajuCompatibilityScore)}점, 이름 분석 ${Math.round(nameAnalysisScore)}점을 기록했어요.`;

  // ── Details ──
  const details: string[] = [
    overallScoreDetail(overallScore),
    sajuCompatibilityDetail(sajuCompatibilityScore),
    nameAnalysisDetail(nameAnalysisScore),
  ];
  if (nameTrend) {
    details.push(
      nameTrend.trendFit == null
        ? `이름 유행: ${trendStatusLabel(nameTrend.status)}. ${nameTrend.evidence[0] ?? '활용할 수 있는 유행 근거가 아직 없어요.'}`
        : `이름 유행 적합도 ${Math.round(nameTrend.trendFit)}/100, 유행 리스크 ${Math.round(nameTrend.trendRisk ?? 0)}/100 (${trendStatusLabel(nameTrend.status)}).`,
    );
  }
  if (phonetic) {
    details.push(
      phonetic.phoneticScore == null
        ? `발음 흐름: ${phoneticStatusLabel(phonetic.status)}. ${phonetic.evidence[0] ?? '활용할 수 있는 발음 근거가 아직 없어요.'}`
        : `발음 흐름 ${Math.round(phonetic.phoneticScore)}/100 (${phoneticStatusLabel(phonetic.status)}), 성-이름 연결 ${Math.round(phonetic.familyNameFitScore ?? 0)}/100.`,
    );
  }

  // Add a yongshin alignment detail if available
  const yongshinElement = springReport.sajuCompatibility.yongshinElement;
  if (yongshinElement) {
    const matchCount = springReport.sajuCompatibility.yongshinMatchCount;
    if (matchCount > 0) {
      details.push(
        `이름에 용신 오행과 일치하는 글자가 ${matchCount}개 있어서 사주 보완에 도움이 돼요.`,
      );
    } else {
      details.push(
        '이름에 용신 오행과 직접 일치하는 글자는 없지만, 전체 균형으로 보완하고 있어요.',
      );
    }
  }
  if (safetyProfile) {
    details.push(
      `사주와 이름의 보강 성향은 ${safetyPostureLabel(safetyProfile.posture)}이에요. 적용 방식은 ${strategyLabel(safetyProfile.strategy)}이고, 주의 신호는 ${safetyProfile.riskScore}/100이에요.`,
    );
  }

  // Gishin caution if present
  const gishinCount = springReport.sajuCompatibility.gishinMatchCount;
  if (gishinCount > 0) {
    details.push(
      `이름에 기신 오행과 겹치는 글자가 ${gishinCount}개 있어요. 크게 걱정할 수준은 아니지만 참고해 주세요.`,
    );
  }

  // ── PR-J-8b — narrative foundations (evidence) ──
  // Note: NameCompatibilityCard is anchored on SpringReport, not on the
  // saju engine's axisStrength. The evidence rows therefore explain how
  // the headline star count was computed from the three sub-scores.
  const evidence: EvidenceRow[] = [
    {
      axis: 'overallScore',
      claim: `종합 ${Math.round(overallScore)}점 — 별 ${overallStars}개 평가의 직접적 근거예요.`,
      supportingFeatures: [
        `종합 점수: ${Math.round(overallScore)} / 100`,
        `사주 궁합 점수: ${Math.round(sajuCompatibilityScore)} / 100`,
        `이름 분석 점수: ${Math.round(nameAnalysisScore)} / 100`,
      ],
      weakness: overallScore < 60
        ? '종합 점수가 60점 미만이면 이름 보완 또는 다른 후보를 함께 검토하세요.'
        : undefined,
    },
  ];

  if (yongshinElement) {
    const matchCount = springReport.sajuCompatibility.yongshinMatchCount;
    const gishinCount = springReport.sajuCompatibility.gishinMatchCount;
    evidence.push({
      axis: 'yongshinAlignment',
      claim: matchCount > 0
        ? `이름이 용신(${elementLabel(yongshinElement)}) 오행을 ${matchCount}개 보강하고 있어요.`
        : '이름의 용신 직접 보강은 없지만, 전체 균형이 일정 부분 보완해요.',
      supportingFeatures: [
        `용신: ${elementLabel(yongshinElement)}`,
        `용신 일치 글자 수: ${matchCount}`,
        `기신 겹침 글자 수: ${gishinCount}`,
      ],
      weakness: gishinCount > matchCount
        ? '기신 겹침이 용신 일치보다 많은 구성이라 한자 후보 추가 검토가 도움이 돼요.'
        : undefined,
    });
  }
  if (safetyProfile) {
    evidence.push({
      axis: 'candidateSafetyProfile',
      claim: `사주와 이름의 보강 성향은 ${safetyPostureLabel(safetyProfile.posture)}이며, ${strategyLabel(safetyProfile.strategy)}을 적용했어요.`,
      supportingFeatures: safetyProfileFeatureLabels(safetyProfile),
      weakness: safetyProfile.posture === 'aggressive'
        ? '용신 판단이 갈리거나 특정 기운 보강이 강해 더 안정적인 후보와 함께 비교하는 것이 좋아요.'
        : undefined,
    });
  }
  if (elementStrategyEvidence) {
    evidence.push({
      axis: 'nameElementStrategy',
      claim: `이름 오행 판단은 ${strategyLabel(elementStrategyEvidence.effectiveStrategy)}을 적용했고, 보수적 대체 판단 ${elementStrategyEvidence.fallbackCount}건을 사용했어요.`,
      supportingFeatures: [
        `요청 방식: ${strategyLabel(elementStrategyEvidence.requestedStrategy)}`,
        `적용 방식: ${strategyLabel(elementStrategyEvidence.effectiveStrategy)}`,
        `안전 판단 통과: ${elementStrategyEvidence.safe ? '예' : '아니오'}`,
        `보수적 대체 판단: ${elementStrategyEvidence.fallbackCount}건`,
        `강한 보강 판단: ${elementStrategyEvidence.aggressiveCount}건`,
        ...elementStrategyEvidence.decisions.map((decision) =>
          `${decision.scope}[${decision.index}] ${decision.hangul}/${decision.hanja || '-'} → ${elementLabel(decision.selectedElement)} (${decision.source}, ${decision.safety})`),
      ],
      weakness: elementStrategyEvidence.aggressiveCount > 0
        ? '일부 글자에서 강한 보강 판단이 사용되어 최종 순위 전에 한 번 더 검토하는 것이 좋아요.'
        : undefined,
    });
  }
  if (nameTrend) {
    evidence.push({
      axis: 'nameTrend',
      claim: nameTrend.trendFit == null
        ? '이 이름과 출생연도에 맞는 한글 이름 유행 근거가 아직 부족해요.'
        : `한글 이름 유행 적합도는 ${Math.round(nameTrend.trendFit)} / 100, 유행 리스크는 ${Math.round(nameTrend.trendRisk ?? 0)} / 100이에요.`,
      supportingFeatures: [...nameTrend.evidence],
      weakness: '이름 유행 근거는 표시용이며 대표 별점 계산에는 반영되지 않아요.',
    });
  }
  if (phonetic) {
    evidence.push({
      axis: 'phonetic',
      claim: phonetic.phoneticScore == null
        ? '이 이름의 발음 흐름 근거가 아직 부족해요.'
        : `발음 흐름 점수는 ${Math.round(phonetic.phoneticScore)} / 100이며 상태는 ${phoneticStatusLabel(phonetic.status)}이에요.`,
      supportingFeatures: [...phonetic.evidence],
      weakness: '발음 근거는 표시용이며 대표 별점 계산에는 반영되지 않아요.',
    });
  }
  if (tenGodPositionEvidence && tenGodPositionEvidence.topContributions.length > 0) {
    evidence.push({
      axis: 'tenGodPosition',
      claim: `십성 위치 점수는 ${Math.round(tenGodPositionEvidence.score)}점이며, ${tenGodPositionEvidence.effectiveMode} 방식의 위치 근거를 사용했어요.`,
      supportingFeatures: [
        `normalization: ${tenGodPositionEvidence.normalization}`,
        ...tenGodPositionEvidence.topContributions.map(tenGodContributionLabel),
      ],
      weakness: tenGodPositionEvidence.fallbackReason,
    });
  }
  if (scoreVector) {
    evidence.push({
      axis: 'namingScoreVector',
      claim: '최종 점수 전 단계에서 법적 사용 가능성, 사주 조화, 오행, 한자 뜻풀이 데이터 확인도(뜻의 우열 아님), 발음, 시대감, 성과 이름 연결, 주의 신호를 나누어 보았어요.',
      supportingFeatures: scoreVectorFeatureLabels(scoreVector),
      weakness: scoreVector.risk >= 60
        ? '주의 신호가 높은 편이라 최종 점수만 보지 말고 다른 후보와 함께 비교하세요.'
        : undefined,
    });
  }
  if (strengthProfile) {
    evidence.push({
      axis: 'candidateStrengthProfile',
      claim: `후보 성향: ${strengthProfile.label}${strengthProfile.paretoFrontier ? ' (파레토 후보)' : ''}.`,
      supportingFeatures: [...(strengthProfile.displayReasons ?? strengthProfile.reasons)],
    });
  }

  return {
    title: '이름 적합도 평가',
    overallStars,
    overallScore,
    sajuCompatibilityScore,
    nameAnalysisScore,
    ...(scoreVector ? { scoreVector } : {}),
    ...(strengthProfile ? { strengthProfile } : {}),
    ...(nameTrend ? { nameTrend } : {}),
    ...(phonetic ? { phonetic } : {}),
    ...(safetyProfile ? { safetyProfile } : {}),
    ...(elementStrategyEvidence ? { elementStrategyEvidence } : {}),
    ...(tenGodPositionEvidence ? { tenGodPositionEvidence } : {}),
    summary,
    details,
    evidence,
  };
}
