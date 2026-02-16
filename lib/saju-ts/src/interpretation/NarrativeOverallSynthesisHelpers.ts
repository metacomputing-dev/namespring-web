import { CHEONGAN_INFO } from '../domain/Cheongan.js';
import {
  GyeokgukCategory,
  GyeokgukType,
  GYEOKGUK_TYPE_INFO,
} from '../domain/Gyeokguk.js';
import type { GyeokgukResult } from '../domain/Gyeokguk.js';
import { JIJI_INFO } from '../domain/Jiji.js';
import { Ohaeng } from '../domain/Ohaeng.js';
import { PillarPosition, PILLAR_POSITION_VALUES } from '../domain/PillarPosition.js';
import { SHINSAL_TYPE_INFO } from '../domain/Shinsal.js';
import { SibiUnseong, SIBI_UNSEONG_INFO } from '../domain/SibiUnseong.js';
import { Sipseong, SIPSEONG_INFO } from '../domain/Sipseong.js';
import { StrengthLevel, isStrongSide } from '../domain/StrengthResult.js';
import type { StrengthResult } from '../domain/StrengthResult.js';
import { YongshinType } from '../domain/YongshinResult.js';
import type { YongshinResult } from '../domain/YongshinResult.js';
import type { SajuAnalysis } from '../domain/SajuAnalysis.js';
import type { IljuInterpretation } from '../domain/IljuInterpretation.js';
import { TenGodCalculator } from '../engine/analysis/TenGodCalculator.js';
import { calculateSibiUnseong } from '../engine/analysis/SibiUnseongCalculator.js';
import { sentenceCite } from './NarrativeSentenceCite.js';
import {
  branchKorean,
  formatPillar,
  ohaengKorean,
  positionKorean,
  stemKorean,
  strengthLevelKorean,
} from './NarrativeFormatting.js';
import { shinsalGyeokgukSynergyLookup } from './ShinsalGyeokgukSynergyMatrix.js';
import { shinsalLifeInfluence } from './shinsalLifeInfluence.js';

export function buildCausalChain(a: SajuAnalysis): string {
  const steps: string[] = [];
  const dm = a.pillars.day.cheongan;
  const dmOhaeng = CHEONGAN_INFO[dm].ohaeng;
  const wolji = a.pillars.month.jiji;

  steps.push(`\u2460 일간(日干)은 ${stemKorean(dm)}입니다. ` +
    `${ohaengKorean(dmOhaeng)}의 기운을 타고났으며, ` +
    `${branchKorean(wolji)} 월에 태어났습니다.`);

  if (a.strengthResult) {
    const sr = a.strengthResult;
    const levelName = strengthLevelKorean(sr.level);
    const reasons: string[] = [];
    if (sr.score.deukryeong > 0) {
      reasons.push(`월지 ${branchKorean(wolji)}이 일간을 도움(득령 ${Math.floor(sr.score.deukryeong)}점)`);
    } else {
      reasons.push(`월지 ${branchKorean(wolji)}이 일간을 돕지 않음(득령 ${Math.floor(sr.score.deukryeong)}점)`);
    }
    reasons.push(`득지 ${Math.floor(sr.score.deukji)}점`);
    reasons.push(`득세 ${Math.floor(sr.score.deukse)}점`);
    const totalStr = `총 ${Math.round(sr.score.totalSupport)}점`;
    steps.push(`\u2461 따라서 일간의 강약은 ${levelName}으로 판정됩니다. ` +
      `근거: ${reasons.join(', ')}. ${totalStr}. ${sentenceCite('strength.level')}`);
  }

  if (a.sibiUnseong) {
    const energyNotes: string[] = [];
    for (const pos of PILLAR_POSITION_VALUES) {
      const unseong = a.sibiUnseong.get(pos);
      if (!unseong) continue;
      const posLabel = pos === PillarPosition.YEAR ? '년주' : pos === PillarPosition.MONTH ? '월주' : pos === PillarPosition.DAY ? '일주' : '시주';
      const ui = SIBI_UNSEONG_INFO[unseong];
      energyNotes.push(`${posLabel}=${ui.koreanName}`);
    }
    if (energyNotes.length > 0) {
      const peakPositions = PILLAR_POSITION_VALUES
        .filter(pos => {
          const u = a.sibiUnseong?.get(pos);
          return u === SibiUnseong.JE_WANG || u === SibiUnseong.GEON_ROK || u === SibiUnseong.GWAN_DAE;
        })
        .map(p => positionKorean(p));
      const peakNote = peakPositions.length > 0 ? ` — ${peakPositions.join('\u00B7')}에서 에너지 정점` : '';
      steps.push(`\u2461-b. 12운성 에너지: ${energyNotes.join(', ')}${peakNote}`);
    }
  }

  if (a.gyeokgukResult) {
    const gr = a.gyeokgukResult;
    const gti = GYEOKGUK_TYPE_INFO[gr.type];
    const transition = buildStrengthToGyeokgukTransition(a.strengthResult ?? null, gr);
    steps.push(`\u2462 ${transition} 격국은 ${gti.koreanName}(${gti.hanja})으로 판별됩니다. ` +
      `${gr.reasoning} ${sentenceCite('gyeokguk.type')}`);
  }

  if (a.yongshinResult) {
    const yr = a.yongshinResult;
    const yongName = ohaengKorean(yr.finalYongshin);
    const methodBases = buildMultiMethodYongshinBasis(yr, a.strengthResult ?? null);
    steps.push(`\u2463 ${methodBases} 최종 용신은 ${yongName}으로 결정됩니다. ` +
      `(신뢰도 ${Math.round(yr.finalConfidence * 100)}%) ${sentenceCite('yongshin.final')}`);
  }

  if (a.weightedShinsalHits.length > 0) {
    const top3 = [...a.weightedShinsalHits]
      .sort((a, b) => b.weightedScore - a.weightedScore)
      .slice(0, 3);
    const shinsalNotes = top3
      .map(w => {
        const influence = shinsalLifeInfluence(w.hit.type);
        return influence ? `${SHINSAL_TYPE_INFO[w.hit.type].koreanName}(${positionKorean(w.hit.position)}): ${influence}` : null;
      })
      .filter(Boolean);
    if (shinsalNotes.length > 0) {
      steps.push(`\u2463-2. 핵심 신살 영향: ${shinsalNotes.join('; ')}`);
    }
  }

  if (a.yongshinResult && a.daeunInfo) {
    const yr = a.yongshinResult;
    const yongshinOh = yr.finalYongshin;
    const favorableDaeun = a.daeunInfo.daeunPillars.filter(dp =>
      CHEONGAN_INFO[dp.pillar.cheongan].ohaeng === yongshinOh ||
      JIJI_INFO[dp.pillar.jiji].ohaeng === yongshinOh,
    );
    if (favorableDaeun.length > 0) {
      const periods = favorableDaeun.slice(0, 3).map(dp => {
        const sipseong = TenGodCalculator.calculate(dm, dp.pillar.cheongan);
        const unseong = calculateSibiUnseong(dm, dp.pillar.jiji);
        const assessment = daeunBriefAssessment(sipseong, unseong);
        const ssi = SIPSEONG_INFO[sipseong];
        const ui = SIBI_UNSEONG_INFO[unseong];
        return `${dp.startAge}~${dp.startAge + 9}세(${formatPillar(dp.pillar)}, ${ssi.koreanName}+${ui.koreanName}=${assessment})`;
      }).join(', ');
      steps.push(`\u2464 따라서 용신 ${ohaengKorean(yongshinOh)} 기운이 강화되는 대운인 ` +
        `${periods}이 가장 유리한 시기입니다. ${sentenceCite('daeun.interpretation')}`);
    }

    if (yr.gisin != null) {
      const gisinOh = yr.gisin;
      const unfavorableDaeun = a.daeunInfo.daeunPillars.filter(dp =>
        CHEONGAN_INFO[dp.pillar.cheongan].ohaeng === gisinOh ||
        JIJI_INFO[dp.pillar.jiji].ohaeng === gisinOh,
      );
      if (unfavorableDaeun.length > 0) {
        const periods = unfavorableDaeun.slice(0, 3).map(dp =>
          `${dp.startAge}~${dp.startAge + 9}세(${formatPillar(dp.pillar)})`,
        ).join(', ');
        steps.push(`\u2465 반면 기신 ${ohaengKorean(gisinOh)} 기운이 강한 대운인 ` +
          `${periods}에는 과도한 확장을 삼가고 내실을 다지는 것이 안전합니다.`);
      }
    }
  }

  return steps.length <= 1 ? '' : steps.join('\n');
}

export function buildStrengthToGyeokgukTransition(sr: StrengthResult | null, gr: GyeokgukResult): string {
  if (!sr) return '';
  const strongWeak = isStrongSide(sr.level) ? '강' : '약';
  const levelName = strengthLevelKorean(sr.level);

  switch (gr.category) {
    case GyeokgukCategory.NAEGYEOK:
      return `일간이 ${levelName}(${strongWeak})하므로, 종격이나 특수격이 아닌 월지 정기 기준의 내격(정격)이 유효합니다. 이 강약 상태에서`;
    case GyeokgukCategory.JONGGYEOK: {
      const direction = (sr.level === StrengthLevel.VERY_STRONG || sr.level === StrengthLevel.STRONG)
        ? '일간의 기운이 극히 강하여 한 방향으로 쏠려'
        : (sr.level === StrengthLevel.VERY_WEAK || sr.level === StrengthLevel.WEAK)
          ? '일간의 기운이 극히 약하여 다른 오행에 의존하는 형태로 쏠려'
          : '일간의 기운이 한쪽으로 치우쳐';
      return `${direction}, 종격(從格)의 조건을 충족합니다. 이 강약 상태에서`;
    }
    case GyeokgukCategory.HWAGYEOK:
      return `천간 합이 성립한 상황에서 일간이 ${levelName}(${strongWeak})하여 합화의 조건이 충족됩니다. 이 강약 상태에서`;
    case GyeokgukCategory.ILHAENG:
      return `하나의 오행이 원국을 지배하는 가운데 일간이 ${levelName}(${strongWeak})하여 일행득기의 조건이 갖추어졌습니다. 이 강약 상태에서`;
  }
}

export function buildMultiMethodYongshinBasis(yr: YongshinResult, sr: StrengthResult | null): string {
  if (yr.recommendations.length === 0) return '';
  const parts: string[] = [];

  for (const rec of yr.recommendations) {
    if (rec.type === YongshinType.EOKBU) {
      const direction = sr
        ? (isStrongSide(sr.level)
          ? '일간이 강하므로 설기(食傷)/재성(財星)/관성(官星)으로 기운을 분산'
          : '일간이 약하므로 인성(印星)/비겁(比劫)으로 기운을 보충')
        : '강약 균형 기준';
      parts.push(`억부론: ${direction}이 필요하여 ${ohaengKorean(rec.primaryElement)}을 추천`);
      continue;
    }
    parts.push(
      rec.type === YongshinType.JOHU ? `조후론: ${rec.reasoning.substring(0, 60)}`
        : rec.type === YongshinType.GYEOKGUK ? `격국론: ${rec.reasoning.substring(0, 60)}`
          : rec.type === YongshinType.TONGGWAN ? `통관론: 상극 오행 간 충돌을 중재하기 위해 ${ohaengKorean(rec.primaryElement)}을 추천`
            : rec.type === YongshinType.BYEONGYAK ? `병약론: 과다한 오행을 제어하기 위해 ${ohaengKorean(rec.primaryElement)}을 추천`
              : rec.type === YongshinType.JEONWANG ? `전왕론: 압도적 기운의 흐름을 따르기 위해 ${ohaengKorean(rec.primaryElement)}을 추천`
                : rec.type === YongshinType.HAPWHA_YONGSHIN ? `합화론: 합화를 유지/강화하기 위해 ${ohaengKorean(rec.primaryElement)}을 추천`
                  : `일행득기론: 지배적 오행의 균형을 위해 ${ohaengKorean(rec.primaryElement)}을 추천`,
    );
  }

  const distinctElements = [...new Set(yr.recommendations.map(r => r.primaryElement))];
  const convergenceNote = (distinctElements.length === 1 && distinctElements[0] !== undefined)
    ? `모든 방법론이 ${ohaengKorean(distinctElements[0])}으로 일치하여`
    : `${parts.length}개 방법론 중 ${distinctElements.length}개 오행이 제안되었으나 종합적으로 ${ohaengKorean(yr.finalYongshin)}이 가장 적합하여`;

  return `${parts.join('; ')}. ${convergenceNote},`;
}

export function daeunBriefAssessment(sipseong: Sipseong, unseong: SibiUnseong): string {
  let energyTier: string;
  if (unseong === SibiUnseong.JE_WANG || unseong === SibiUnseong.GEON_ROK) energyTier = '최고조';
  else if (unseong === SibiUnseong.GWAN_DAE || unseong === SibiUnseong.JANG_SAENG) energyTier = '상승';
  else if ([SibiUnseong.MOK_YOK, SibiUnseong.SWOE, SibiUnseong.TAE, SibiUnseong.YANG].includes(unseong)) energyTier = '보통';
  else energyTier = '침체';

  const SIPSEONG_TONES: Record<Sipseong, string> = {
    [Sipseong.JEONG_IN]: '안정', [Sipseong.JEONG_GWAN]: '안정', [Sipseong.JEONG_JAE]: '안정',
    [Sipseong.SIK_SIN]: '표현/기술', [Sipseong.BI_GYEON]: '자립/경쟁',
    [Sipseong.PYEON_JAE]: '투자/도전', [Sipseong.PYEON_GWAN]: '시련/성장',
    [Sipseong.SANG_GWAN]: '변화/창의', [Sipseong.PYEON_IN]: '학문/영감',
    [Sipseong.GYEOB_JAE]: '경쟁/분산',
  };
  const sipseongTone = SIPSEONG_TONES[sipseong] ?? '';

  return `${energyTier}+${sipseongTone}`;
}

export function buildLifePathSynthesis(a: SajuAnalysis): string {
  const parts: string[] = [];

  if (a.gyeokgukResult) {
    const gr = a.gyeokgukResult;
    const gti = GYEOKGUK_TYPE_INFO[gr.type];
    const categoryNote = gr.category === GyeokgukCategory.NAEGYEOK ? '내격(정격)'
      : gr.category === GyeokgukCategory.JONGGYEOK ? '종격(외격)'
        : gr.category === GyeokgukCategory.HWAGYEOK ? '합화격(외격)'
          : '일행득기격(외격)';
    const directionNote = gr.category === GyeokgukCategory.NAEGYEOK
      ? gr.type.includes('JAE') ? '재물·사업 영역에서 두각을 나타낼 구조'
        : gr.type.includes('GWAN') ? '조직·권력·공직 영역에서 힘을 발휘할 구조'
          : gr.type.includes('IN') ? '학문·연구·교육 영역에서 빛을 발할 구조'
            : gr.type.includes('SIK') || gr.type.includes('SANG') ? '표현·예술·기술 영역에서 재능을 발휘할 구조'
              : gr.type === GyeokgukType.GEONROK || gr.type === GyeokgukType.YANGIN ? '자수성가·독립적 리더십을 발휘할 구조'
                : `${gti.koreanName}의 구조`
      : gr.category === GyeokgukCategory.JONGGYEOK ? '한 방향에 기운이 쏠려 있어 흐름을 따르는 것이 유리한 구조'
        : gr.category === GyeokgukCategory.HWAGYEOK ? '천간 합화가 성립하여 변화와 적응에 강한 구조'
          : '하나의 오행이 지배적이어서 해당 분야에 집중할 때 큰 성과를 낼 구조';
    parts.push(`${categoryNote}인 ${gti.koreanName}(${gti.hanja})로, ${directionNote}입니다.`);
  }

  if (a.yongshinResult) {
    const yr = a.yongshinResult;
    const yongName = ohaengKorean(yr.finalYongshin);
    const TIMING: Record<Ohaeng, string> = {
      [Ohaeng.WOOD]: '봄(인·묘월)', [Ohaeng.FIRE]: '여름(사·오월)',
      [Ohaeng.EARTH]: '환절기(진·술·축·미월)', [Ohaeng.METAL]: '가을(신·유월)',
      [Ohaeng.WATER]: '겨울(해·자월)',
    };
    parts.push(`${yongName} 기운이 강해지는 ${TIMING[yr.finalYongshin]}과 해당 대운에서 기회가 열리며, 이 시기를 적극 활용하는 것이 핵심 전략입니다.`);
    if (yr.gisin != null) {
      parts.push(`반대로 ${ohaengKorean(yr.gisin)} 기운이 강한 시기에는 과도한 확장을 피하고 내실을 다지는 것이 안전합니다.`);
    }
  }

  if (a.gyeokgukResult && a.weightedShinsalHits.length > 0) {
    const topShinsals = [...a.weightedShinsalHits]
      .sort((a, b) => b.weightedScore - a.weightedScore)
      .slice(0, 3)
      .map(w => w.hit.type);
    const synergies: string[] = [];
    for (const shinsal of topShinsals) {
      const synergy = shinsalGyeokgukSynergyLookup(shinsal, a.gyeokgukResult.type, a.gyeokgukResult.category);
      if (synergy) synergies.push(synergy);
    }
    if (synergies.length > 0) {
      parts.push(synergies.join('. ') + '.');
    }
  }

  const ilju = a.analysisResults?.get('ilju') as IljuInterpretation | undefined;
  if (ilju) {
    parts.push(`"${ilju.nickname}"의 일주로서, ${ilju.lifePath.substring(0, 100)}`);
  }

  return parts.length === 0 ? '' : parts.join('\n');
}

