import { Cheongan, CHEONGAN_INFO } from '../../domain/Cheongan.js';
import { Jiji } from '../../domain/Jiji.js';
import { Ohaeng } from '../../domain/Ohaeng.js';
import { PillarPosition, PILLAR_POSITION_VALUES } from '../../domain/PillarPosition.js';
import { PillarSet } from '../../domain/PillarSet.js';
import { HapState, type HapHwaEvaluation } from '../../domain/Relations.js';
import { HapHwaStrictness } from '../../config/CalculationConfig.js';
import { HAP_TABLE, SEASON_SUPPORT, pillarKoreanLabel, stemPairKey } from './HapHwaCatalog.js';
import {
  buildReasoning,
  checkOpposition,
  computePresenceBonus,
  determineStateAndConfidence,
  positionOrdinal,
} from './HapHwaEvaluatorHelpers.js';

export const HapHwaEvaluator = {
    evaluate(
    pillars: PillarSet,
    strictness: HapHwaStrictness = HapHwaStrictness.STRICT_FIVE_CONDITIONS,
    dayMasterNeverHapGeo: boolean = true,
  ): HapHwaEvaluation[] {
    const positions = PILLAR_POSITION_VALUES;
    const stems: Record<PillarPosition, Cheongan> = {
      [PillarPosition.YEAR]: pillars.year.cheongan,
      [PillarPosition.MONTH]: pillars.month.cheongan,
      [PillarPosition.DAY]: pillars.day.cheongan,
      [PillarPosition.HOUR]: pillars.hour.cheongan,
    };

    const results: HapHwaEvaluation[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const pos1 = positions[i]!;
        const pos2 = positions[j]!;
        const stem1 = stems[pos1];
        const stem2 = stems[pos2];

        if (stem1 === stem2) continue;

        const key = stemPairKey(stem1, stem2);
        if (!HAP_TABLE.has(key)) continue;

        const posKey = [pos1, pos2].sort().join('-');
        if (seen.has(posKey)) continue;
        seen.add(posKey);

        const evaluation = evaluateHapHwaPair(
          stem1, pos1,
          stem2, pos2,
          pillars.month.jiji,
          pillars,
          strictness,
          dayMasterNeverHapGeo,
        );
        if (evaluation !== null) {
          results.push(evaluation);
        }
      }
    }

    return results;
  },

    evaluatePair(
    stem1: Cheongan,
    pos1: PillarPosition,
    stem2: Cheongan,
    pos2: PillarPosition,
    monthBranch: Jiji,
    pillars: PillarSet,
    strictness: HapHwaStrictness = HapHwaStrictness.STRICT_FIVE_CONDITIONS,
    dayMasterNeverHapGeo: boolean = true,
  ): HapHwaEvaluation | null {
    const entry = HAP_TABLE.get(stemPairKey(stem1, stem2));
    if (entry === undefined) return null;

    const { resultOhaeng, hapName } = entry;

    const dayMaster = pillars.day.cheongan;
    const dayMasterInvolved =
      (stem1 === dayMaster && pos1 === PillarPosition.DAY) ||
      (stem2 === dayMaster && pos2 === PillarPosition.DAY);

    const conditionsMet: string[] = [];
    const conditionsFailed: string[] = [];

    if (dayMasterInvolved && dayMasterNeverHapGeo) {
      conditionsFailed.push('일간보호 (일간은 합거/합화 불가)');
      const stem1Hangul = CHEONGAN_INFO[stem1].hangul;
      const stem2Hangul = CHEONGAN_INFO[stem2].hangul;
      const dayMasterHangul = CHEONGAN_INFO[dayMaster].hangul;
      const reasoning =
        `${hapName}: ` +
        `${stem1Hangul}(${pillarKoreanLabel(pos1)})과 ${stem2Hangul}(${pillarKoreanLabel(pos2)}) ` +
        '사이에 천간합이 존재하나, ' +
        `일간(${dayMasterHangul})이 포함되어 있으므로 합거/합화가 성립하지 않습니다. ` +
        '일간은 절대 합거/합화되지 않으며, 원래 성질을 유지합니다. ' +
        '[근거: 삼명통회 -- 일간보호 원칙, dayMasterNeverHapGeo=true]';

      return {
        stem1,
        stem2,
        position1: pos1,
        position2: pos2,
        resultOhaeng,
        state: HapState.NOT_ESTABLISHED,
        confidence: 1.0,
        conditionsMet,
        conditionsFailed,
        reasoning,
        dayMasterInvolved: true,
      };
    }

    const adjacent = arePillarPositionsAdjacentForHapHwa(pos1, pos2);
    if (adjacent) {
      conditionsMet.push('인접 조건');
    } else {
      conditionsFailed.push('인접 조건');
    }

    const seasonSupport = isSeasonSupportingHapHwa(monthBranch, resultOhaeng);
    if (seasonSupport) {
      conditionsMet.push('월령 조건');
    } else {
      conditionsFailed.push('월령 조건');
    }

    const hasOpposition = checkOpposition(resultOhaeng, pillars, pos1, pos2);
    if (!hasOpposition) {
      conditionsMet.push('무극 조건');
    } else {
      conditionsFailed.push('무극 조건 (결과 오행을 극하는 천간 존재)');
    }

    const presenceBonus = computePresenceBonus(resultOhaeng, pillars, pos1, pos2);
    if (presenceBonus > 0.0) {
      conditionsMet.push('세력/투출 조건 (부분)');
    } else {
      conditionsFailed.push('세력/투출 조건');
    }

    const { state, confidence } = determineStateAndConfidence(
      adjacent,
      seasonSupport,
      presenceBonus,
      hasOpposition,
      strictness,
    );

    const reasoning = buildReasoning(
      hapName,
      stem1, pos1,
      stem2, pos2,
      resultOhaeng,
      monthBranch,
      state,
      adjacent,
      seasonSupport,
      presenceBonus,
      hasOpposition,
    );

    return {
      stem1,
      stem2,
      position1: pos1,
      position2: pos2,
      resultOhaeng,
      state,
      confidence,
      conditionsMet,
      conditionsFailed,
      reasoning,
      dayMasterInvolved: false,
    };
  },

    isSeasonSupporting(monthBranch: Jiji, targetElement: Ohaeng): boolean {
    return SEASON_SUPPORT.get(targetElement)?.has(monthBranch) === true;
  },

    areAdjacent(pos1: PillarPosition, pos2: PillarPosition): boolean {
    const diff = positionOrdinal(pos1) - positionOrdinal(pos2);
    return diff === 1 || diff === -1;
  },
} as const;

export const evaluateHapHwa = HapHwaEvaluator.evaluate;
export const evaluateHapHwaPair = HapHwaEvaluator.evaluatePair;
export const isSeasonSupportingHapHwa = HapHwaEvaluator.isSeasonSupporting;
export const arePillarPositionsAdjacentForHapHwa = HapHwaEvaluator.areAdjacent;

