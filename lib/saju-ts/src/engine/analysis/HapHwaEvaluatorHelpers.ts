import { Cheongan, CHEONGAN_INFO } from '../../domain/Cheongan.js';
import { Jiji, JIJI_INFO } from '../../domain/Jiji.js';
import { Ohaeng, OhaengRelations } from '../../domain/Ohaeng.js';
import { PillarPosition, PILLAR_POSITION_VALUES } from '../../domain/PillarPosition.js';
import { PillarSet } from '../../domain/PillarSet.js';
import { HapState } from '../../domain/Relations.js';
import { HapHwaStrictness } from '../../config/CalculationConfig.js';
import { ohaengKoreanName, pillarKoreanLabel } from './HapHwaCatalog.js';
export function positionOrdinal(pos: PillarPosition): number {
  return PILLAR_POSITION_VALUES.indexOf(pos);
}


export function checkOpposition(
  resultOhaeng: Ohaeng,
  pillars: PillarSet,
  pos1: PillarPosition,
  pos2: PillarPosition,
): boolean {
  const controllingElement = OhaengRelations.controlledBy(resultOhaeng);
  const allStems = [
    pillars.year.cheongan,
    pillars.month.cheongan,
    pillars.day.cheongan,
    pillars.hour.cheongan,
  ];

  const otherStems = allStems.filter((_, idx) =>
    PILLAR_POSITION_VALUES[idx] !== pos1 && PILLAR_POSITION_VALUES[idx] !== pos2,
  );

  return otherStems.some(stem => CHEONGAN_INFO[stem].ohaeng === controllingElement);
}

export function computePresenceBonus(
  resultOhaeng: Ohaeng,
  pillars: PillarSet,
  pos1: PillarPosition,
  pos2: PillarPosition,
): number {
  let bonus = 0.0;

  const allStems = [
    pillars.year.cheongan,
    pillars.month.cheongan,
    pillars.day.cheongan,
    pillars.hour.cheongan,
  ];

  const otherStems = allStems.filter((_, idx) =>
    PILLAR_POSITION_VALUES[idx] !== pos1 && PILLAR_POSITION_VALUES[idx] !== pos2,
  );

  const stemMatch = otherStems.filter(stem => CHEONGAN_INFO[stem].ohaeng === resultOhaeng).length;
  bonus += stemMatch * 0.05; // [출처: 적천수 투출론 -- 천간에 기(氣)가 드러남]

  const branches = [
    pillars.year.jiji,
    pillars.month.jiji,
    pillars.day.jiji,
    pillars.hour.jiji,
  ];
  const branchMatch = branches.filter(branch => JIJI_INFO[branch].ohaeng === resultOhaeng).length;
  bonus += branchMatch * 0.025; // [출처: 적천수 세력론 -- 지지에 질(質)의 뿌리]

  return Math.min(bonus, 0.15); // 보조 조건 상한: 전체 신뢰도의 ~15% 이내
}

export function determineStateAndConfidence(
  adjacent: boolean,
  seasonSupport: boolean,
  presenceBonus: number,
  hasOpposition: boolean,
  strictness: HapHwaStrictness = HapHwaStrictness.STRICT_FIVE_CONDITIONS,
): { state: HapState; confidence: number } {
  if (!adjacent) return { state: HapState.NOT_ESTABLISHED, confidence: 1.0 };

  switch (strictness) {
    case HapHwaStrictness.STRICT_FIVE_CONDITIONS:
      if (seasonSupport && !hasOpposition) {
        return { state: HapState.HAPWHA, confidence: Math.min(0.70 + presenceBonus, 0.95) };
      }
      if (seasonSupport && hasOpposition) {
        return { state: HapState.HAPGEO, confidence: 0.60 };
      }
      return { state: HapState.HAPGEO, confidence: 0.50 };

    case HapHwaStrictness.MODERATE:
      if (seasonSupport) {
        return { state: HapState.HAPWHA, confidence: Math.min(0.65 + presenceBonus, 0.90) };
      }
      return { state: HapState.HAPGEO, confidence: 0.50 };

    case HapHwaStrictness.LENIENT:
      return { state: HapState.HAPWHA, confidence: Math.min(0.55 + presenceBonus, 0.85) };
  }
}

export function buildReasoning(
  hapName: string,
  stem1: Cheongan,
  pos1: PillarPosition,
  stem2: Cheongan,
  pos2: PillarPosition,
  resultOhaeng: Ohaeng,
  monthBranch: Jiji,
  state: HapState,
  adjacent: boolean,
  seasonSupport: boolean,
  presenceBonus: number,
  hasOpposition: boolean,
): string {
  const parts: string[] = [];

  const stem1Hangul = CHEONGAN_INFO[stem1].hangul;
  const stem2Hangul = CHEONGAN_INFO[stem2].hangul;
  const monthBranchHangul = JIJI_INFO[monthBranch].hangul;
  const monthBranchHanja = JIJI_INFO[monthBranch].hanja;
  const resultName = ohaengKoreanName(resultOhaeng);

  parts.push(`${hapName}: `);
  parts.push(`${stem1Hangul}(${pillarKoreanLabel(pos1)})과 ${stem2Hangul}(${pillarKoreanLabel(pos2)}) `);
  parts.push('사이의 천간합을 평가합니다. ');

  if (adjacent) {
    parts.push('두 천간은 인접한 주에 위치하여 인접 조건을 충족합니다. ');
  } else {
    parts.push(`두 천간은 인접하지 않아(${pillarKoreanLabel(pos1)}-${pillarKoreanLabel(pos2)}) 합이 성립하지 않습니다. `);
  }

  if (adjacent) {
    if (seasonSupport) {
      parts.push(`월지 ${monthBranchHangul}(${monthBranchHanja})은 ${resultName}이(가) 왕한 월로 월령 조건을 충족합니다. `);
    } else {
      parts.push(`월지 ${monthBranchHangul}(${monthBranchHanja})은 ${resultName}이(가) 왕한 월이 아니므로 월령 조건을 충족하지 못합니다. `);
    }
  }

  if (adjacent && seasonSupport && hasOpposition) {
    const controllerName = ohaengKoreanName(OhaengRelations.controlledBy(resultOhaeng));
    parts.push(`그러나 사주 내 ${controllerName} 천간이 ${resultName}을(를) 극하므로 무극 조건을 충족하지 못합니다. `);
    parts.push('합화가 성립하려면 결과 오행을 극하는 세력이 없어야 합니다. ');
  }

  if (adjacent && seasonSupport && !hasOpposition && presenceBonus > 0.0) {
    parts.push(`사주 내 ${resultName} 세력이 추가로 확인되어 합화 가능성이 높아집니다. `);
  }

  switch (state) {
    case HapState.HAPWHA:
      parts.push(`결론: 합화(合化)가 성립하여 ${resultName}(으)로 변화합니다.`);
      break;
    case HapState.HAPGEO:
      parts.push('결론: 합거(合去)로 두 천간이 묶여 본래 기능을 잃습니다.');
      break;
    case HapState.NOT_ESTABLISHED:
      parts.push('결론: 합이 불성립(不成立)하여 각 천간이 본래 기능을 유지합니다.');
      break;
  }

  return parts.join('');
}

