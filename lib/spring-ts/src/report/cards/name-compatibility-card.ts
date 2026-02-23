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

import type { SpringReport } from '../../types.js';
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

  return {
    title: '이름 적합도 평가',
    overallStars,
    overallScore,
    sajuCompatibilityScore,
    nameAnalysisScore,
    summary,
    details,
  };
}
