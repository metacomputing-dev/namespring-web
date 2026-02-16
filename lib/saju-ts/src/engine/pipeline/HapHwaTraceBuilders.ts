import { type CalculationConfig } from '../../config/CalculationConfig.js';
import { CHEONGAN_INFO } from '../../domain/Cheongan.js';
import { type HapHwaEvaluation } from '../../domain/Relations.js';
import { ANALYSIS_KEYS } from '../../domain/SajuAnalysis.js';
import { tracedStep } from './TraceHelpers.js';

export function buildHapHwaTraceStep(
  hapHwaEvaluations: readonly HapHwaEvaluation[],
  hapHwaStrictness: CalculationConfig['hapHwaStrictness'],
  dayMasterNeverHapGeo: CalculationConfig['dayMasterNeverHapGeo'],
) {
  const hapSummary = hapHwaEvaluations.length === 0
    ? '합화 대상 없음'
    : hapHwaEvaluations.map(e => {
      const s1 = CHEONGAN_INFO[e.stem1].hangul;
      const s2 = CHEONGAN_INFO[e.stem2].hangul;
      return `${s1}${s2}합→${e.state}`;
    }).join(', ');

  return tracedStep(
    ANALYSIS_KEYS.HAPWHA,
    `천간 합화 평가 — ${hapSummary}. 엄격도=${hapHwaStrictness}, ` +
    `일간보호=${dayMasterNeverHapGeo ? '적용' : '미적용'}.`,
    hapHwaEvaluations.length > 0
      ? hapHwaEvaluations.map(e => `${CHEONGAN_INFO[e.stem1].hangul}+${CHEONGAN_INFO[e.stem2].hangul}→${e.state}`)
      : ['합 대상 없음'],
    hapHwaEvaluations.length === 0
      ? ['천간합 관계가 없거나 합화 평가 대상이 없습니다.']
      : hapHwaEvaluations.map(eval_ =>
        `${CHEONGAN_INFO[eval_.stem1].hangul}(${eval_.position1})·${CHEONGAN_INFO[eval_.stem2].hangul}(${eval_.position2}) ` +
        `→ ${eval_.state}: ${eval_.reasoning}`
      ),
  );
}

