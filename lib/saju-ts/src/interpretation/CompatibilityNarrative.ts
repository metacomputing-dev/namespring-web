import {
  CompatibilityGrade,
  COMPATIBILITY_GRADE_INFO,
  type CompatibilityResult,
} from '../domain/Compatibility.js';


function overallAdvice(result: CompatibilityResult): string {
  switch (result.grade) {
    case CompatibilityGrade.EXCELLENT:
      return '서로의 사주가 매우 잘 어울리는 최상의 궁합입니다. 자연스러운 화합이 기대되며, 함께할수록 서로를 성장시키는 관계입니다.';
    case CompatibilityGrade.GOOD:
      return '전반적으로 좋은 궁합입니다. 부분적 차이가 있으나 서로를 보완하는 힘이 강합니다. 소통에 노력하면 매우 좋은 관계가 됩니다.';
    case CompatibilityGrade.AVERAGE:
      return '무난한 궁합입니다. 특별히 좋거나 나쁜 요소가 없으며, 노력에 따라 좋은 관계가 될 수 있습니다. 서로의 차이를 이해하려는 노력이 중요합니다.';
    case CompatibilityGrade.BELOW_AVERAGE:
      return '다소 어려운 궁합입니다. 서로의 기질과 가치관에 차이가 있어 갈등이 생길 수 있습니다. 상호 존중과 양보가 관계 유지의 핵심입니다.';
    case CompatibilityGrade.POOR:
      return '도전적인 궁합입니다. 근본적인 차이가 있어 갈등이 잦을 수 있습니다. 하지만 사주는 정해진 운명이 아니라 경향성이므로, 서로를 깊이 이해하고 노력하면 극복할 수 있습니다.';
  }
}


export const CompatibilityNarrative = {
  generate(
    result: CompatibilityResult,
    name1: string = '본인',
    name2: string = '상대',
  ): string {
    const lines: string[] = [];

    lines.push('■ 궁합(宮合) 분석 보고서');
    lines.push('');
    lines.push(`종합 점수: ${result.totalScore}점 / 100점  ${COMPATIBILITY_GRADE_INFO[result.grade].stars}`);
    lines.push(`등급: ${COMPATIBILITY_GRADE_INFO[result.grade].koreanName}`);
    lines.push('');

    lines.push(`【일간(日干) 궁합 — ${result.dayMaster.score}점】`);
    lines.push(`  관계: ${result.dayMaster.relationType}`);
    lines.push(`  ${result.dayMaster.interpretation}`);
    lines.push('');

    lines.push(`【일지(日支) 궁합 — ${result.dayBranch.score}점】`);
    lines.push(`  관계: ${result.dayBranch.relationType}`);
    lines.push(`  ${result.dayBranch.interpretation}`);
    lines.push('');

    lines.push(`【오행(五行) 보완 — ${result.ohaengComplement.score}점】`);
    lines.push(`  오행 완성도: ${result.ohaengComplement.combinedCompleteness}/5`);
    for (const detail of result.ohaengComplement.details) {
      lines.push(`  · ${detail}`);
    }
    lines.push('');

    lines.push(`【십성(十星) 교차 — ${result.sipseongCross.score}점】`);
    lines.push(`  ${name2} → ${name1}: ${result.sipseongCross.interpretation2to1}`);
    lines.push(`  ${name1} → ${name2}: ${result.sipseongCross.interpretation1to2}`);
    lines.push('');

    if (result.shinsalMatch.details.length > 0) {
      lines.push(`【신살(神煞) 궁합 — ${result.shinsalMatch.score}점】`);
      for (const detail of result.shinsalMatch.details) {
        lines.push(`  · ${detail}`);
      }
      lines.push('');
    }

    lines.push('【종합 조언】');
    lines.push(`  ${overallAdvice(result)}`);

    return lines.join('\n');
  },
} as const;

