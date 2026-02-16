import { GYEOKGUK_TYPE_INFO } from '../domain/Gyeokguk.js';
import { PillarPosition, PILLAR_POSITION_VALUES } from '../domain/PillarPosition.js';
import { SHINSAL_TYPE_INFO } from '../domain/Shinsal.js';
import { SIPSEONG_INFO } from '../domain/Sipseong.js';
import type { SajuAnalysis } from '../domain/SajuAnalysis.js';
import type { IljuInterpretation } from '../domain/IljuInterpretation.js';
import {
  type CalculationConfig,
  DEFAULT_CONFIG,
} from '../config/CalculationConfig.js';
import { sentenceCite } from './NarrativeSentenceCite.js';
import { StrengthAwareSipseongInterpreter } from './StrengthAwareSipseongInterpreter.js';
import {
  ohaengKorean,
  stemKorean,
  strengthLevelKorean,
} from './NarrativeFormatting.js';
import { buildCalculationReasoning, buildTraceOverview } from './NarrativeTraceOverview.js';
import { buildCausalChain, buildLifePathSynthesis } from './NarrativeOverallSynthesis.js';
import { buildLifeDomainAnalysis } from './NarrativeLifeDomainAnalysisSection.js';
import { buildLuckCycleOverview } from './NarrativeLuckCycleOverviewSection.js';
import { buildSpecialFeatures } from './NarrativeSpecialFeaturesSection.js';
import { buildSourceBibliography } from './NarrativeSourceBibliographySection.js';
import { buildOverview, buildOhaengDistribution } from './NarrativeOverviewSection.js';
import {
  buildCoreCharacteristics,
  buildYongshinGuidance,
} from './NarrativeStrengthAndYongshinSection.js';
import { buildPillarInterpretations } from './NarrativePillarSection.js';
import { schoolLabelFor } from './SchoolVariantHelpers.js';


export interface SajuNarrative {
  readonly schoolLabel: string;
  readonly overview: string;
  readonly ohaengDistribution: string;
  readonly coreCharacteristics: string;
  readonly yongshinGuidance: string;
  readonly pillarInterpretations: Record<PillarPosition, string>;
  readonly lifeDomainAnalysis: string;
  readonly specialFeatures: string;
  readonly overallAssessment: string;
  readonly luckCycleOverview: string;
  readonly detailedLuckNarrative: string;
  readonly yearlyFortuneNarrative: string;
  readonly calculationReasoning: string;
  readonly traceOverview: string;
  readonly sourceBibliography: string;
}

export function narrativeToFullReport(n: SajuNarrative): string {
  const parts: string[] = [];
  parts.push(n.overview);
  parts.push('');
  if (n.ohaengDistribution) { parts.push(n.ohaengDistribution); parts.push(''); }
  parts.push(n.coreCharacteristics);
  parts.push('');
  parts.push(n.yongshinGuidance);
  parts.push('');
  for (const pos of PILLAR_POSITION_VALUES) {
    const interp = n.pillarInterpretations[pos];
    if (interp) { parts.push(interp); parts.push(''); }
  }
  if (n.lifeDomainAnalysis) { parts.push(n.lifeDomainAnalysis); parts.push(''); }
  parts.push(n.specialFeatures);
  parts.push('');
  if (n.overallAssessment) { parts.push(n.overallAssessment); parts.push(''); }
  parts.push(n.luckCycleOverview);
  if (n.detailedLuckNarrative) { parts.push(''); parts.push(n.detailedLuckNarrative); }
  if (n.yearlyFortuneNarrative) { parts.push(''); parts.push(n.yearlyFortuneNarrative); }
  if (n.calculationReasoning) { parts.push(''); parts.push(n.calculationReasoning); }
  if (n.traceOverview) { parts.push(''); parts.push(n.traceOverview); }
  if (n.sourceBibliography) { parts.push(''); parts.push(n.sourceBibliography); }
  return parts.join('\n').trimEnd();
}



function buildOverallAssessment(a: SajuAnalysis): string {
  const lines: string[] = [];
  lines.push(`■ 종합 판단 ${sentenceCite('overall.synthesis')}`);
  lines.push('');

  const dm = a.pillars.day.cheongan;
  const dmName = stemKorean(dm);

  const strengthDesc = a.strengthResult
    ? `${strengthLevelKorean(a.strengthResult.level)} 일간`
    : '일간';
  lines.push(`${dmName} ${strengthDesc}입니다.`);

  if (a.gyeokgukResult) {
    const gti = GYEOKGUK_TYPE_INFO[a.gyeokgukResult.type];
    lines.push(`${gti.koreanName}(${gti.hanja})의 구조를 갖추고 있어, ${a.gyeokgukResult.reasoning}`);
  }

  if (a.yongshinResult) {
    const yr = a.yongshinResult;
    const yongshinName = ohaengKorean(yr.finalYongshin);
    const heesinNote = yr.finalHeesin != null ? `, 희신은 ${ohaengKorean(yr.finalHeesin)}` : '';
    lines.push(`용신은 ${yongshinName}${heesinNote}으로, 이 오행이 강화되는 시기에 운이 상승합니다.`);
    if (yr.gisin != null) {
      lines.push(`반면 기신 ${ohaengKorean(yr.gisin)}이 강해지는 시기는 주의가 필요합니다.`);
    }
  }

  if (a.strengthResult && a.tenGodAnalysis) {
    const sr = a.strengthResult;
    const tga = a.tenGodAnalysis;
    lines.push('');
    lines.push('[강약 관점의 핵심 십성 분석]');

    const monthTg = tga.byPosition[PillarPosition.MONTH];
    if (monthTg) {
      const reading = StrengthAwareSipseongInterpreter.interpret(monthTg.cheonganSipseong, sr.level);
      const ssi = SIPSEONG_INFO[monthTg.cheonganSipseong];
      lines.push(`  월주 ${ssi.koreanName} [${reading.favorability}]: ${reading.commentary}`);
      lines.push(`    → ${reading.advice}`);
    }

    const dayTg = tga.byPosition[PillarPosition.DAY];
    if (dayTg) {
      const reading = StrengthAwareSipseongInterpreter.interpret(dayTg.jijiPrincipalSipseong, sr.level);
      const ssi = SIPSEONG_INFO[dayTg.jijiPrincipalSipseong];
      lines.push(`  일지 ${ssi.koreanName} [${reading.favorability}]: ${reading.commentary}`);
      lines.push(`    → ${reading.advice}`);
    }
  }
  lines.push('');

  if (a.weightedShinsalHits.length > 0) {
    const top3 = [...a.weightedShinsalHits]
      .sort((a, b) => b.weightedScore - a.weightedScore)
      .slice(0, 3)
      .map(w => SHINSAL_TYPE_INFO[w.hit.type].koreanName)
      .join(', ');
    lines.push(`특기할 신살: ${top3} — 이들이 원국의 특수한 기질을 형성합니다.`);
  }

  const ilju = a.analysisResults?.get('ilju') as IljuInterpretation | undefined;
  if (ilju) {
    lines.push('');
    lines.push(`일주 "${ilju.nickname}" — ${ilju.personality.substring(0, 80)}...`);
  }

  const causalChain = buildCausalChain(a);
  if (causalChain) {
    lines.push('');
    lines.push('[논리 체인: 왜 이런 결론인가?]');
    lines.push(causalChain);
  }

  const synthesis = buildLifePathSynthesis(a);
  if (synthesis) {
    lines.push('');
    lines.push('[인생 방향 종합]');
    lines.push(synthesis);
  }

  return lines.join('\n').trimEnd();
}


export function generate(
  analysis: SajuAnalysis,
  config: CalculationConfig = DEFAULT_CONFIG,
  targetYear?: number,
): SajuNarrative {
  return {
    schoolLabel: schoolLabelFor(config),
    overview: buildOverview(analysis, config),
    ohaengDistribution: buildOhaengDistribution(analysis),
    coreCharacteristics: buildCoreCharacteristics(analysis, config),
    yongshinGuidance: buildYongshinGuidance(analysis, config),
    pillarInterpretations: buildPillarInterpretations(analysis, config),
    lifeDomainAnalysis: buildLifeDomainAnalysis(analysis),
    specialFeatures: buildSpecialFeatures(analysis, config),
    overallAssessment: buildOverallAssessment(analysis),
    luckCycleOverview: buildLuckCycleOverview(analysis),
    detailedLuckNarrative: '', // Requires full LuckNarrativeInterpreter integration
    yearlyFortuneNarrative: '', // Requires SaeunCalculator integration
    calculationReasoning: buildCalculationReasoning(analysis),
    traceOverview: buildTraceOverview(analysis),
    sourceBibliography: buildSourceBibliography(analysis),
  };
}

export const NarrativeEngine = {
  generate,
  narrativeToFullReport,
} as const;
