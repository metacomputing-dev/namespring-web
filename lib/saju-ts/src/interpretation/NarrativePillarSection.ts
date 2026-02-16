import { CHEONGAN_INFO } from '../domain/Cheongan.js';
import { JIJI_INFO } from '../domain/Jiji.js';
import { Ohaeng } from '../domain/Ohaeng.js';
import { PillarPosition, PILLAR_POSITION_VALUES } from '../domain/PillarPosition.js';
import { SIBI_UNSEONG_INFO } from '../domain/SibiUnseong.js';
import { SIPSEONG_INFO } from '../domain/Sipseong.js';
import type { SajuAnalysis } from '../domain/SajuAnalysis.js';
import type { IljuInterpretation } from '../domain/IljuInterpretation.js';
import {
  type CalculationConfig,
  EarthLifeStageRule,
} from '../config/CalculationConfig.js';
import { sentenceCite } from './NarrativeSentenceCite.js';
import { SipseongInterpreter } from './SipseongInterpreter.js';
import { SibiUnseongInterpreter } from './SibiUnseongInterpreter.js';
import { sibiUnseongPrinciple } from './LifeStagePrinciples.js';
import {
  formatPillar,
  pillarAt,
  positionKorean,
} from './NarrativeFormatting.js';

export function buildPillarInterpretations(a: SajuAnalysis, config: CalculationConfig): Record<PillarPosition, string> {
  const result = {} as Record<PillarPosition, string>;
  for (const pos of PILLAR_POSITION_VALUES) {
    result[pos] = buildSinglePillarNarrative(a, pos, config);
  }
  return result;
}

export function buildSinglePillarNarrative(a: SajuAnalysis, pos: PillarPosition, config: CalculationConfig): string {
  const lines: string[] = [];
  const posName = positionKorean(pos);
  const pillar = pillarAt(a.pillars, pos);

  lines.push(`■ ${posName} (${formatPillar(pillar)})`);
  lines.push('');

  const tenGod = a.tenGodAnalysis?.byPosition[pos];
  if (tenGod) {
    const stemSipseong = tenGod.cheonganSipseong;
    const branchSipseong = tenGod.jijiPrincipalSipseong;
    const stemInterp = SipseongInterpreter.interpret(stemSipseong, pos);
    const ssi = SIPSEONG_INFO[stemSipseong];
    lines.push(`  [천간 ${ssi.koreanName}] ${stemInterp.shortDescription} ${sentenceCite('sipseong.interpretation')}`);
    lines.push(`    장점: ${stemInterp.positiveTraits.join(', ')}`);
    lines.push(`    단점: ${stemInterp.negativeTraits.join(', ')}`);
    lines.push(`    적성: ${stemInterp.careerHint}`);
    if (branchSipseong !== stemSipseong) {
      const branchInterp = SipseongInterpreter.interpret(branchSipseong, pos);
      const bsi = SIPSEONG_INFO[branchSipseong];
      lines.push(`  [지지 ${bsi.koreanName}] ${branchInterp.shortDescription}`);
    }
    lines.push('');
  }

  if (a.sibiUnseong) {
    const unseong = a.sibiUnseong.get(pos);
    if (unseong) {
      const interp = SibiUnseongInterpreter.interpret(unseong, pos);
      const ui = SIBI_UNSEONG_INFO[unseong];
      lines.push(`  [${ui.koreanName}(${ui.hanja})] ${interp.description} ${sentenceCite('sibiUnseong.interpretation')}`);
      lines.push(`    에너지: ${interp.energy}`);
      lines.push(`    ${sibiUnseongPrinciple(a.pillars.day.cheongan, pillar.jiji, unseong, config)}`);
      if (JIJI_INFO[pillar.jiji].ohaeng === Ohaeng.EARTH || CHEONGAN_INFO[pillar.cheongan].ohaeng === Ohaeng.EARTH) {
        const ruleNote = config.earthLifeStageRule === EarthLifeStageRule.FOLLOW_FIRE ? '화토동법'
          : config.earthLifeStageRule === EarthLifeStageRule.FOLLOW_WATER ? '수토동법'
            : '토 독립설';
        const reversalNote = config.yinReversalEnabled ? '양순음역' : '음양개순';
        lines.push(`    ※ 십이운성 기준: ${ruleNote}, ${reversalNote}`);
      }
      lines.push('');
    }
  }

  if (a.palaceAnalysis) {
    const palace = a.palaceAnalysis[pos];
    if (palace?.interpretation) {
      lines.push(`  [${palace.palaceInfo.koreanName}] ${palace.interpretation.summary} ${sentenceCite('palace.interpretation')}`);
      lines.push(`    ${palace.interpretation.detail}`);
      lines.push('');
    }
  }

  if (pos === PillarPosition.DAY) {
    const ilju = (a.analysisResults?.get('ilju') as IljuInterpretation | undefined);
    if (ilju) {
      lines.push(`  [일주론: ${ilju.nickname}] ${sentenceCite('ilju.personality')}`);
      lines.push(`    성격: ${ilju.personality}`);
      lines.push(`    관계: ${ilju.relationships}`);
      lines.push(`    직업: ${ilju.career}`);
      lines.push(`    건강: ${ilju.health}`);
      lines.push(`    인생: ${ilju.lifePath}`);
      lines.push('');
    }
  }

  return lines.join('\n').trimEnd();
}
