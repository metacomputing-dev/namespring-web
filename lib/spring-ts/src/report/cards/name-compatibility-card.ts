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

import type { SpringReport, EvidenceRow } from '../../types.js';
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
  5: '최고 수준의 조화를 이루고 있어요',
  4: '아주 좋은 조화를 보여줘요',
  3: '무난한 수준의 궁합이에요',
  2: '약간의 보완이 필요해요',
  1: '보완할 부분이 있어요',
};

// ---------------------------------------------------------------------------
//  Score-range descriptions for detail lines
// ---------------------------------------------------------------------------

function overallScoreDetail(score: number): string {
  if (score >= 85) return `종합 점수는 ${Math.round(score)}점으로, 이름과 사주가 아주 훌륭하게 어울려요.`;
  if (score >= 70) return `종합 점수는 ${Math.round(score)}점으로, 이름과 사주의 조화가 좋은 편이에요.`;
  if (score >= 55) return `종합 점수는 ${Math.round(score)}점으로, 이름과 사주가 무난하게 맞아요.`;
  if (score >= 40) return `종합 점수는 ${Math.round(score)}점으로, 조화를 높이기 위한 작은 보완이 도움이 돼요.`;
  return `종합 점수는 ${Math.round(score)}점이에요. 이름의 에너지를 보완하면 더 좋은 흐름을 만들 수 있어요.`;
}

function sajuCompatibilityDetail(score: number): string {
  if (score >= 80) return `사주 궁합 점수는 ${Math.round(score)}점이에요. 이름의 오행이 사주와 매우 잘 어울려요.`;
  if (score >= 60) return `사주 궁합 점수는 ${Math.round(score)}점이에요. 이름이 사주의 흐름을 안정적으로 받쳐주고 있어요.`;
  if (score >= 40) return `사주 궁합 점수는 ${Math.round(score)}점이에요. 이름과 사주의 연결은 보통 수준이에요.`;
  return `사주 궁합 점수는 ${Math.round(score)}점이에요. 이름의 오행이 사주와 약간 맞지 않는 부분이 있어요.`;
}

function nameAnalysisDetail(score: number): string {
  if (score >= 80) return `이름 분석 점수는 ${Math.round(score)}점이에요. 한글과 한자의 구성이 우수해요.`;
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

function scoreVectorFeatureLabels(vector: NonNullable<SpringReport['scoreVector']>): string[] {
  const labels: string[] = [];
  labels.push(`legal ${vector.legal ?? 'n/a'}`);
  labels.push(`sajuFit ${vector.sajuFit ?? 'n/a'}`);
  labels.push(`yongshinFit ${vector.yongshinFit ?? 'n/a'}`);
  labels.push(`elementBalance ${vector.elementBalance ?? 'n/a'}`);
  labels.push(`hanjaMeaning ${vector.hanjaMeaning ?? 'n/a'}`);
  labels.push(`phonetic ${vector.phonetic ?? 'n/a'}`);
  labels.push(`eraFit ${vector.eraFit ?? 'n/a'}`);
  labels.push(`familyFit ${vector.familyFit ?? 'n/a'}`);
  labels.push(`risk ${vector.risk}`);
  return labels;
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
        ? `Name trend: ${nameTrend.status}. ${nameTrend.evidence[0] ?? 'No trend evidence available.'}`
        : `Name trend: fit ${Math.round(nameTrend.trendFit)}/100, risk ${Math.round(nameTrend.trendRisk ?? 0)}/100 (${nameTrend.status}).`,
    );
  }
  if (phonetic) {
    details.push(
      phonetic.phoneticScore == null
        ? `Phonetic flow: ${phonetic.status}. ${phonetic.evidence[0] ?? 'No phonetic evidence available.'}`
        : `Phonetic flow: ${Math.round(phonetic.phoneticScore)}/100 (${phonetic.status}), family boundary ${Math.round(phonetic.familyNameFitScore ?? 0)}/100.`,
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
        ? `이름이 용신(${yongshinElement}) 오행을 ${matchCount}개 보강하고 있어요.`
        : '이름의 용신 직접 보강은 없지만, 전체 균형이 일정 부분 보완해요.',
      supportingFeatures: [
        `용신: ${yongshinElement}`,
        `용신 일치 글자 수: ${matchCount}`,
        `기신 겹침 글자 수: ${gishinCount}`,
      ],
      weakness: gishinCount > matchCount
        ? '기신 겹침이 용신 일치보다 많은 구성이라 한자 후보 추가 검토가 도움이 돼요.'
        : undefined,
    });
  }
  if (nameTrend) {
    evidence.push({
      axis: 'nameTrend',
      claim: nameTrend.trendFit == null
        ? 'Hangul name trend evidence is unavailable for this name and birth year.'
        : `Hangul name trend fit is ${Math.round(nameTrend.trendFit)} / 100 with risk ${Math.round(nameTrend.trendRisk ?? 0)} / 100.`,
      supportingFeatures: [...nameTrend.evidence],
      weakness: 'Trend evidence is display-only and is not part of the headline star calculation.',
    });
  }
  if (phonetic) {
    evidence.push({
      axis: 'phonetic',
      claim: phonetic.phoneticScore == null
        ? 'Phonetic flow evidence is unavailable for this name.'
        : `Phonetic flow score is ${Math.round(phonetic.phoneticScore)} / 100 with status ${phonetic.status}.`,
      supportingFeatures: [...phonetic.evidence],
      weakness: 'Phonetic evidence is display-only and is not part of the headline star calculation.',
    });
  }
  if (tenGodPositionEvidence && tenGodPositionEvidence.topContributions.length > 0) {
    evidence.push({
      axis: 'tenGodPosition',
      claim: `Ten-god score ${Math.round(tenGodPositionEvidence.score)} uses ${tenGodPositionEvidence.effectiveMode} position evidence.`,
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
      claim: 'Pre-final naming score vector separates legal, saju, element, meaning, phonetic, era, family, and risk axes.',
      supportingFeatures: scoreVectorFeatureLabels(scoreVector),
      weakness: scoreVector.risk >= 60
        ? 'Risk axis is high enough to compare this candidate against alternatives instead of relying on the final score alone.'
        : undefined,
    });
  }
  if (strengthProfile) {
    evidence.push({
      axis: 'candidateStrengthProfile',
      claim: `Candidate profile: ${strengthProfile.label}${strengthProfile.paretoFrontier ? ' (Pareto frontier)' : ''}.`,
      supportingFeatures: [...strengthProfile.reasons],
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
    ...(tenGodPositionEvidence ? { tenGodPositionEvidence } : {}),
    summary,
    details,
    evidence,
  };
}
