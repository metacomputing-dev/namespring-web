import { CHEONGAN_INFO } from '../domain/Cheongan.js';
import { type DaeunPillar } from '../domain/DaeunInfo.js';
import { JIJI_INFO } from '../domain/Jiji.js';
import {
  type DaeunAnalysis,
  type LuckPillarAnalysis,
} from '../domain/LuckInteraction.js';
import { Ohaeng, OhaengRelation, OhaengRelations, ohaengKoreanLabel } from '../domain/Ohaeng.js';
import {
  type SipseongUnTheme,
  type UnseongEnergyTheme,
} from './LuckNarrativeThemes.js';
import {
  LUCK_QUALITY_ADJECTIVE,
  isFavorableLuckQuality,
  isUnfavorableLuckQuality,
} from './LuckQualityNarrative.js';

function ohaengName(oh: Ohaeng): string {
  return ohaengKoreanLabel(oh);
}

export function buildYongshinExplanation(
  lpa: LuckPillarAnalysis,
  yongshinElement: Ohaeng | null | undefined,
  gisinElement: Ohaeng | null | undefined,
): string {
  if (yongshinElement == null) return '용신이 결정되지 않아 오행 길흉 판단이 제한적입니다';

  const stemOhaeng = CHEONGAN_INFO[lpa.pillar.cheongan].ohaeng;
  const branchOhaeng = JIJI_INFO[lpa.pillar.jiji].ohaeng;

  if (lpa.isYongshinElement && lpa.isGisinElement) {
    return `천간 ${ohaengName(stemOhaeng)}과 지지 ${ohaengName(branchOhaeng)}이 용신과 기신을 동시에 포함하여, 길흉이 혼재된 시기입니다`;
  }
  if (lpa.isYongshinElement) {
    const matchParts: string[] = [];
    if (stemOhaeng === yongshinElement) matchParts.push(`천간 ${ohaengName(stemOhaeng)}`);
    if (branchOhaeng === yongshinElement) matchParts.push(`지지 ${ohaengName(branchOhaeng)}`);
    return `${matchParts.join('과 ')}이 용신 ${ohaengName(yongshinElement)}과 일치하여 긍정적인 기운이 강한 시기입니다`;
  }
  if (lpa.isGisinElement) {
    const matchParts: string[] = [];
    if (gisinElement != null && stemOhaeng === gisinElement) matchParts.push(`천간 ${ohaengName(stemOhaeng)}`);
    if (gisinElement != null && branchOhaeng === gisinElement) matchParts.push(`지지 ${ohaengName(branchOhaeng)}`);
    return `${matchParts.join('과 ')}이 기신 ${ohaengName(gisinElement!)}과 일치하여 부정적 영향에 주의가 필요한 시기입니다`;
  }
  return `용신(${ohaengName(yongshinElement)})과 직접적 관련은 없으나, 다른 요소들의 종합 판단이 필요합니다`;
}

export function buildRelationImpacts(lpa: LuckPillarAnalysis): string[] {
  const impacts: string[] = [];

  for (const rel of lpa.stemRelations) {
    if (rel.includes('합')) impacts.push(`천간 ${rel}: 새로운 인연이나 협력 관계가 형성될 수 있습니다`);
    if (rel.includes('충')) impacts.push(`천간 ${rel}: 갈등이나 변화가 발생할 수 있으며, 외부 환경의 변동에 유의하세요`);
  }

  for (const rel of lpa.branchRelations) {
    if (rel.includes('합')) impacts.push(`지지 ${rel}: 안정적인 결합과 조화의 기운이 작용합니다`);
    else if (rel.includes('충')) impacts.push(`지지 ${rel}: 환경의 급변이나 이사·이직 등 큰 변화가 예상됩니다`);
    else if (rel.includes('형')) impacts.push(`지지 ${rel}: 법적 문제나 건강 이슈에 주의가 필요합니다`);
    else if (rel.includes('파')) impacts.push(`지지 ${rel}: 기존 관계나 계획이 깨질 수 있으므로 신중하게 행동하세요`);
    else if (rel.includes('해')) impacts.push(`지지 ${rel}: 은밀한 방해나 뜻밖의 손해에 주의하세요`);
  }

  return impacts;
}

export function buildTransitionWarning(daeunAnalysis: DaeunAnalysis): string {
  if (!daeunAnalysis.isTransitionPeriod) return '';
  const age = daeunAnalysis.daeunPillar.startAge;
  return `${age}세 전후는 교운기(交運期)로, 이전 대운에서 새 대운으로 전환되는 불안정한 시기입니다. 큰 결정이나 변화는 1~2년 뒤로 미루는 것이 안전합니다`;
}

export function buildWhySummary(
  lpa: LuckPillarAnalysis,
  sipseongTheme: SipseongUnTheme,
  energyTheme: UnseongEnergyTheme,
  yongshinExplanation: string,
  isTransition: boolean,
): string {
  const pillarLabel = `${CHEONGAN_INFO[lpa.pillar.cheongan].hangul}${JIJI_INFO[lpa.pillar.jiji].hangul}`;
  const qualityDesc = LUCK_QUALITY_ADJECTIVE[lpa.quality];

  let sb = '';
  sb += `${pillarLabel}운은 ${qualityDesc} 시기입니다. `;
  sb += `${sipseongTheme.themeName}의 기운이 작용하여 ${sipseongTheme.lifeDomain} 영역에 변화가 옵니다. `;
  sb += `에너지는 '${energyTheme.energyLevel}' 단계로, ${energyTheme.description}. `;
  sb += yongshinExplanation;

  if (lpa.stemRelations.length > 0 || lpa.branchRelations.length > 0) {
    const allRelations = [...lpa.stemRelations, ...lpa.branchRelations];
    sb += ` 원국과의 관계에서 ${allRelations.join(', ')}이 발생합니다.`;
  }

  if (isTransition) {
    sb += ' 또한 교운기에 해당하여 전환기적 불안정이 있습니다.';
  }

  return sb;
}

export function buildPracticalGuidance(
  lpa: LuckPillarAnalysis,
  sipseongTheme: SipseongUnTheme,
  energyTheme: UnseongEnergyTheme,
): string {
  let sb = `[행동 조언] ${energyTheme.actionAdvice}`;

  if (isFavorableLuckQuality(lpa.quality)) {
    sb += ` ${sipseongTheme.favorableAspects.join(', ')} 등의 좋은 기운을 적극 활용하세요.`;
  } else if (isUnfavorableLuckQuality(lpa.quality)) {
    sb += ` ${sipseongTheme.cautionPoints.join(', ')} 등에 유의하세요.`;
  } else {
    sb += ` 장점(${sipseongTheme.favorableAspects[0]})을 살리고, 약점(${sipseongTheme.cautionPoints[0]})을 보완하세요.`;
  }

  return sb;
}

export function buildCombinedInterpretation(
  lpa: LuckPillarAnalysis,
  currentDaeun: DaeunPillar | null,
  sipseongTheme: SipseongUnTheme,
  yongshinElement: Ohaeng | null | undefined,
  gisinElement: Ohaeng | null | undefined,
): string {
  if (currentDaeun === null) {
    return `${sipseongTheme.themeName}의 세운이 독립적으로 작용합니다. ${sipseongTheme.themeDescription}`;
  }

  const daeunLabel = `${CHEONGAN_INFO[currentDaeun.pillar.cheongan].hangul}${JIJI_INFO[currentDaeun.pillar.jiji].hangul}`;
  const saeunLabel = `${CHEONGAN_INFO[lpa.pillar.cheongan].hangul}${JIJI_INFO[lpa.pillar.jiji].hangul}`;

  const daeunOhaeng = CHEONGAN_INFO[currentDaeun.pillar.cheongan].ohaeng;
  const saeunOhaeng = CHEONGAN_INFO[lpa.pillar.cheongan].ohaeng;

  const ohaengRelation = OhaengRelations.relation(daeunOhaeng, saeunOhaeng);
  let relationDesc: string;
  switch (ohaengRelation) {
    case OhaengRelation.BIHWA:     relationDesc = '대운과 세운이 같은 오행으로, 해당 기운이 강화됩니다'; break;
    case OhaengRelation.SANGSAENG: relationDesc = '대운이 세운을 생(生)하여, 세운의 기운이 힘을 얻습니다'; break;
    case OhaengRelation.YEOKSAENG: relationDesc = '세운이 대운을 생(生)하여, 대운의 기운을 돕습니다'; break;
    case OhaengRelation.SANGGEUK:  relationDesc = '대운이 세운을 극(剋)하여, 세운의 기운이 제약을 받습니다'; break;
    case OhaengRelation.YEOKGEUK:  relationDesc = '세운이 대운을 극(剋)하여, 대운의 흐름에 변화가 생깁니다'; break;
  }

  return `${daeunLabel} 대운 위에 ${saeunLabel} 세운이 겹치면서, ${relationDesc}. ${sipseongTheme.themeName}의 테마가 이 해를 지배합니다`;
}
