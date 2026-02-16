import { ClassicalSource, inlineCitation } from '../domain/ClassicalSource.js';
import {
  GyeokgukCategory,
  GyeokgukQuality,
  GYEOKGUK_TYPE_INFO,
  GYEOKGUK_QUALITY_INFO,
} from '../domain/Gyeokguk.js';
import { CHEONGAN_INFO } from '../domain/Cheongan.js';
import { JIJI_INFO } from '../domain/Jiji.js';
import { isStrongSide } from '../domain/StrengthResult.js';
import { YongshinType, YONGSHIN_TYPE_INFO } from '../domain/YongshinResult.js';
import type { SajuAnalysis } from '../domain/SajuAnalysis.js';
import {
  type CalculationConfig,
  HiddenStemScope,
  SaryeongMode,
  YongshinPriority,
} from '../config/CalculationConfig.js';
import { JohuTable } from '../engine/analysis/JohuTable.js';
import type { YongshinRecommendation } from '../domain/YongshinResult.js';
import { sentenceCite } from './NarrativeSentenceCite.js';
import { StrengthInterpreter } from './StrengthInterpreter.js';
import { OhaengPracticalGuide } from './OhaengPracticalGuide.js';
import {
  branchKorean,
  ohaengKorean,
  ohaengRelationNote,
  stemKorean,
  strengthLevelKorean,
} from './NarrativeFormatting.js';
import {
  strengthVariantNote,
  yongshinVariantNote,
} from './SchoolVariantHelpers.js';

export function buildCoreCharacteristics(a: SajuAnalysis, config: CalculationConfig): string {
  const lines: string[] = [];
  lines.push('■ 핵심 성향 분석');
  lines.push('');

  if (a.strengthResult) {
    const sr = a.strengthResult;
    const interp = StrengthInterpreter.interpret(sr.level);
    const levelLabel = strengthLevelKorean(sr.level);
    lines.push(`【신강/신약】${levelLabel} ${sentenceCite('strength.level')}`);
    lines.push('');

    const wolji = a.pillars.month.jiji;
    const deukryeongNote = sr.score.deukryeong > 0
      ? `월지 ${branchKorean(wolji)}이 일간을 생조함 (${ohaengRelationNote(JIJI_INFO[wolji].ohaeng, CHEONGAN_INFO[a.pillars.day.cheongan].ohaeng)}) → ${Math.floor(sr.score.deukryeong)}점`
      : `월지 ${branchKorean(wolji)}이 일간을 돕지 않음 → ${Math.floor(sr.score.deukryeong)}점`;
    lines.push(`  · 득령(得令): ${deukryeongNote} ${sentenceCite('strength.deukryeong')}`);
    lines.push(`  · 득지(得地): 지장간 중 비겁·인성 부조 → ${Math.floor(sr.score.deukji)}점 ${sentenceCite('strength.deukji')}`);
    lines.push(`  · 득세(得勢): 천간 비겁·인성 부조 → ${Math.floor(sr.score.deukse)}점`);
    const threshold = Math.floor(config.strengthThreshold);
    const total = Math.floor(sr.score.totalSupport);
    const comparison = total >= threshold ? '\u2265' : '<';
    lines.push(`  · 총합 ${total}점 ${comparison} 임계값 ${threshold}점 → ${levelLabel} 판정`);
    lines.push('');

    lines.push(`  성격: ${interp.personality.join(', ')}`);
    lines.push(`  조언: ${interp.advice}`);

    const scopeNote = config.hiddenStemScopeForStrength === HiddenStemScope.ALL_THREE
      ? '여기+중기+정기 모두 포함'
      : config.hiddenStemScopeForStrength === HiddenStemScope.JEONGGI_ONLY
        ? '정기만 포함 (보수적)'
        : '사령 기준 (정밀)';
    const saryeongNote = config.saryeongMode === SaryeongMode.ALWAYS_JEONGGI
      ? '항상 정기'
      : '절입 후 일수 기반';
    lines.push(`  ※ 분석 기준: 득령 ${Math.floor(config.deukryeongWeight)}점, ` +
      `임계값 ${threshold}점, ` +
      `득지 범위=${scopeNote}, 사령=${saryeongNote} ${sentenceCite('strength.deukse')}`);
    const svn = strengthVariantNote(config);
    if (svn) lines.push(svn);
    lines.push('');
  }

  if (a.gyeokgukResult) {
    const gr = a.gyeokgukResult;
    const gti = GYEOKGUK_TYPE_INFO[gr.type];
    const categoryCite =
      gr.category === GyeokgukCategory.JONGGYEOK ? sentenceCite('gyeokguk.jonggyeok')
        : gr.category === GyeokgukCategory.HWAGYEOK ? sentenceCite('gyeokguk.hwagyeok')
          : gr.category === GyeokgukCategory.ILHAENG ? sentenceCite('gyeokguk.ilhaeng')
            : '';
    lines.push(`【격국】${gti.koreanName}(${gti.hanja}) ${sentenceCite('gyeokguk.type')} ${categoryCite}`.trimEnd());
    lines.push('');

    const wolji = a.pillars.month.jiji;
    switch (gr.category) {
      case GyeokgukCategory.NAEGYEOK:
        lines.push(`  · 판별: 월지 ${branchKorean(wolji)}의 지장간 투출 기준`);
        lines.push(`  · 근거: ${gr.reasoning}`);
        break;
      case GyeokgukCategory.JONGGYEOK: {
        const totalStr = a.strengthResult ? `총합 ${Math.floor(a.strengthResult.score.totalSupport)}점` : '';
        lines.push(`  · 판별: 일간 극강/극약으로 종격 조건 충족 (${totalStr})`);
        lines.push(`  · 근거: ${gr.reasoning}`);
        break;
      }
      case GyeokgukCategory.HWAGYEOK:
        lines.push('  · 판별: 천간 합화 성립 → 화격 우선 판별');
        lines.push(`  · 근거: ${gr.reasoning}`);
        break;
      case GyeokgukCategory.ILHAENG:
        lines.push('  · 판별: 하나의 오행이 원국을 지배 → 일행득기');
        lines.push(`  · 근거: ${gr.reasoning}`);
        break;
    }

    if (gr.formation && gr.formation.quality !== GyeokgukQuality.NOT_ASSESSED) {
      const qi = GYEOKGUK_QUALITY_INFO[gr.formation.quality];
      lines.push(`  [성격/파격] ${qi.koreanName} ${sentenceCite('gyeokguk.formation')}`);
      lines.push(`    ${gr.formation.reasoning}`);
      if (gr.formation.breakingFactors.length > 0) {
        lines.push('    파격 요인:');
        for (const f of gr.formation.breakingFactors) lines.push(`      - ${f}`);
      }
      if (gr.formation.rescueFactors.length > 0) {
        lines.push('    구원 요인:');
        for (const f of gr.formation.rescueFactors) lines.push(`      - ${f}`);
      }
    }

    if (a.yongshinResult) {
      const gyeokgukRec = a.yongshinResult.recommendations.find(r => r.type === YongshinType.GYEOKGUK);
      if (gyeokgukRec) {
        lines.push(`  [격국용신] ${gyeokgukRec.reasoning}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

export function buildYongshinGuidance(a: SajuAnalysis, config: CalculationConfig): string {
  const lines: string[] = [];
  lines.push('■ 용신(用神) 안내');
  lines.push('');

  const yr = a.yongshinResult;
  if (!yr) {
    lines.push('용신 분석이 수행되지 않았습니다.');
    return lines.join('\n');
  }

  lines.push(`최종 용신: ${ohaengKorean(yr.finalYongshin)} ${sentenceCite('yongshin.final')}`);
  if (yr.finalHeesin != null) lines.push(`희신(喜神): ${ohaengKorean(yr.finalHeesin)}`);
  if (yr.gisin != null) lines.push(`기신(忌神): ${ohaengKorean(yr.gisin)}`);
  if (yr.gusin != null) lines.push(`구신(仇神): ${ohaengKorean(yr.gusin)}`);
  lines.push(`신뢰도: ${Math.round(yr.finalConfidence * 100)}% (억부-조후 ${yr.agreement}) ${sentenceCite('yongshin.confidence')}`);
  lines.push('');

  if (a.strengthResult) {
    const sr = a.strengthResult;
    const dmName = stemKorean(sr.dayMaster);
    const levelLabel = strengthLevelKorean(sr.level);
    const direction = isStrongSide(sr.level) ? '설기·재성·관성으로 기운 분산' : '인성·비겁으로 기운 보충';
    lines.push('  [용신 판단 근거]');
    lines.push(`  · 일간 ${dmName}은 ${levelLabel} → ${direction}이 필요`);
    const eokbuRec = yr.recommendations.find(r => r.type === YongshinType.EOKBU);
    const johuRec = yr.recommendations.find(r => r.type === YongshinType.JOHU);
    if (eokbuRec) lines.push(`  · 억부법: ${ohaengKorean(eokbuRec.primaryElement)} 추천 ${sentenceCite('yongshin.eokbu')}`);
    if (johuRec) lines.push(`  · 조후법: ${ohaengKorean(johuRec.primaryElement)} 추천 ${sentenceCite('yongshin.johu')}`);
    const distinctElements = [...new Set(yr.recommendations.map(r => r.primaryElement))];
    if (distinctElements.length === 1 && distinctElements[0] !== undefined) {
      lines.push(`  · 결론: 모든 방법론이 ${ohaengKorean(distinctElements[0])}으로 일치 → 신뢰도 높음`);
    } else {
      lines.push(`  · 결론: ${distinctElements.length}개 오행이 제안됨 → 종합 판단으로 ${ohaengKorean(yr.finalYongshin)} 확정`);
    }
    lines.push('');
  }

  lines.push(`  ※ 용신 결정 기준: ${yongshinPriorityDescription(config)}`);
  const yvn = yongshinVariantNote(config);
  if (yvn) lines.push(yvn);
  lines.push('');

  const sortedRecs = sortRecommendationsByPriority(yr.recommendations, config.yongshinPriority);
  for (const rec of sortedRecs) {
    lines.push(`  [${YONGSHIN_TYPE_INFO[rec.type].koreanName}] ${rec.reasoning}`);
  }
  lines.push('');

  if (a.strengthResult) {
    const johuReason = JohuTable.reasoning(a.strengthResult.dayMaster, a.pillars.month.jiji);
    lines.push(`  [조후론 상세] ${johuReason} ${inlineCitation(ClassicalSource.GUNGTONGBOGAM)}`);
  }
  lines.push('');

  lines.push('  [오행 실천 가이드]');
  const yongshinGuide = OhaengPracticalGuide.guide(yr.finalYongshin);
  lines.push(`    \u25B8 용신 ${ohaengKorean(yr.finalYongshin)} 보충법:`);
  lines.push(`      색상: ${yongshinGuide.colors.join(', ')}`);
  lines.push(`      방향: ${yongshinGuide.direction}`);
  lines.push(`      계절: ${yongshinGuide.season}`);
  lines.push(`      숫자: ${yongshinGuide.numbers.join(', ')}`);
  lines.push(`      적성: ${yongshinGuide.careers.join(', ')}`);
  for (const tip of yongshinGuide.dailyTips) {
    lines.push(`      · ${tip}`);
  }

  if (yr.finalHeesin != null) {
    const heesinGuide = OhaengPracticalGuide.guide(yr.finalHeesin);
    lines.push(`    \u25B8 희신 ${ohaengKorean(yr.finalHeesin)} 보충법:`);
    lines.push(`      색상: ${heesinGuide.colors.join(', ')}`);
    lines.push(`      방향: ${heesinGuide.direction}`);
    lines.push(`      적성: ${heesinGuide.careers.join(', ')}`);
  }

  if (yr.gisin != null) {
    lines.push(`    \u25B8 기신 ${ohaengKorean(yr.gisin)} 주의:`);
    lines.push(`      ${OhaengPracticalGuide.avoidanceNote(yr.gisin)}`);
  }

  return lines.join('\n').trimEnd();
}

function yongshinPriorityDescription(config: CalculationConfig): string {
  if (config.yongshinPriority === YongshinPriority.JOHU_FIRST) {
    return '조후(기후 균형) 우선 — 한국 주류에서는 계절의 한난조습 균형이 첫 번째 기준입니다.';
  }
  if (config.yongshinPriority === YongshinPriority.EOKBU_FIRST) {
    return '억부(강약 균형) 우선 — 전통파에서는 일간의 강약 균형이 첫 번째 기준입니다.';
  }
  return '조후·억부·격국 동등 비중 — 현대 통합파에서는 여러 방법론을 종합하여 판단합니다.';
}

function sortRecommendationsByPriority(
  recommendations: readonly YongshinRecommendation[],
  priority: YongshinPriority,
): YongshinRecommendation[] {
  const order =
    priority === YongshinPriority.JOHU_FIRST
      ? [YongshinType.JOHU, YongshinType.EOKBU, YongshinType.GYEOKGUK, YongshinType.TONGGWAN, YongshinType.BYEONGYAK, YongshinType.JEONWANG]
      : priority === YongshinPriority.EOKBU_FIRST
        ? [YongshinType.EOKBU, YongshinType.GYEOKGUK, YongshinType.JOHU, YongshinType.TONGGWAN, YongshinType.BYEONGYAK, YongshinType.JEONWANG]
        : [YongshinType.EOKBU, YongshinType.JOHU, YongshinType.GYEOKGUK, YongshinType.TONGGWAN, YongshinType.BYEONGYAK, YongshinType.JEONWANG];
  return [...recommendations].sort((left, right) => {
    const leftIndex = order.indexOf(left.type);
    const rightIndex = order.indexOf(right.type);
    return (leftIndex < 0 ? 999 : leftIndex) - (rightIndex < 0 ? 999 : rightIndex);
  });
}
