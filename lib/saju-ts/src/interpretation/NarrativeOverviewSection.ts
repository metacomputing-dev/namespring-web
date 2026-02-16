import { CHEONGAN_INFO } from '../domain/Cheongan.js';
import { Eumyang } from '../domain/Eumyang.js';
import { HiddenStemTable } from '../domain/HiddenStem.js';
import { JIJI_INFO } from '../domain/Jiji.js';
import { Ohaeng, OHAENG_VALUES, OhaengRelations } from '../domain/Ohaeng.js';
import type { SajuAnalysis } from '../domain/SajuAnalysis.js';
import type { CalculationConfig } from '../config/CalculationConfig.js';
import { RuleCitationRegistry, citationInline } from './RuleCitationRegistry.js';
import { sentenceCite } from './NarrativeSentenceCite.js';
import {
  branchKorean,
  formatPillar,
  ohaengKorean,
  stemKorean,
} from './NarrativeFormatting.js';
import { schoolLabelFor } from './SchoolVariantHelpers.js';

function citationFor(key: string): string {
  const c = RuleCitationRegistry.forKey(key);
  return c ? citationInline(c) : '';
}

export function buildOverview(a: SajuAnalysis, config: CalculationConfig): string {
  const p = a.pillars;
  const dm = p.day.cheongan;
  const lines: string[] = [];

  lines.push('■ 사주 원국 개요');
  lines.push(`  [분석 기준: ${schoolLabelFor(config)}]`);
  lines.push('  ※ 유파에 따라 일부 판정(신강/신약, 용신, 신살 등)이 달라질 수 있습니다.');
  lines.push('');
  lines.push(`  년주: ${formatPillar(p.year)}  월주: ${formatPillar(p.month)}  ` +
    `일주: ${formatPillar(p.day)}  시주: ${formatPillar(p.hour)}`);
  lines.push('');
  lines.push(`일간(日干)은 ${stemKorean(dm)}이며, ` +
    `월지(月支) ${branchKorean(p.month.jiji)}에 태어났습니다.`);

  if (a.gongmangVoidBranches) {
    const [b1, b2] = a.gongmangVoidBranches;
    lines.push(`공망(空亡): ${branchKorean(b1)}, ${branchKorean(b2)} ${sentenceCite('gongmang.detection')}`);
  }

  const coreTrace = a.trace.find(t => t.key === 'core');
  if (coreTrace) {
    const timeNotes = coreTrace.reasoning.filter(r => r.startsWith('[시간 보정]'));
    if (timeNotes.length > 0) {
      lines.push('');
      lines.push(`  [시간 보정 사항] ${citationFor('core')}`);
      for (const note of timeNotes) {
        lines.push(`    · ${note.replace('[시간 보정] ', '').trim()}`);
      }
    }
  }

  return lines.join('\n').trimEnd();
}

export function buildOhaengDistribution(a: SajuAnalysis): string {
  const lines: string[] = [];
  lines.push(`■ 오행(五行) 분포 ${sentenceCite('ohaeng.distribution')}`);
  lines.push('');

  const p = a.pillars;
  const allElements = [
    CHEONGAN_INFO[p.year.cheongan].ohaeng, JIJI_INFO[p.year.jiji].ohaeng,
    CHEONGAN_INFO[p.month.cheongan].ohaeng, JIJI_INFO[p.month.jiji].ohaeng,
    CHEONGAN_INFO[p.day.cheongan].ohaeng, JIJI_INFO[p.day.jiji].ohaeng,
    CHEONGAN_INFO[p.hour.cheongan].ohaeng, JIJI_INFO[p.hour.jiji].ohaeng,
  ];
  const counts = new Map<Ohaeng, number>();
  for (const oh of OHAENG_VALUES) counts.set(oh, 0);
  for (const oh of allElements) counts.set(oh, (counts.get(oh) ?? 0) + 1);

  for (const oh of OHAENG_VALUES) {
    const count = counts.get(oh)!;
    const bar = '\u25CF'.repeat(count) + '\u25CB'.repeat(8 - count);
    lines.push(`  ${ohaengKorean(oh)}: ${bar} (${count}/8)`);
  }
  lines.push('');

  const excess = OHAENG_VALUES.filter(oh => (counts.get(oh) ?? 0) >= 3);
  const absent = OHAENG_VALUES.filter(oh => (counts.get(oh) ?? 0) === 0);
  const scarce = OHAENG_VALUES.filter(oh => (counts.get(oh) ?? 0) === 1);

  if (excess.length > 0) {
    const excessNames = excess.map(oh => `${ohaengKorean(oh)}(${counts.get(oh)}개)`).join(', ');
    lines.push(`  과다: ${excessNames}`);
  }
  if (absent.length > 0) {
    const absentNames = absent.map(oh => ohaengKorean(oh)).join(', ');
    lines.push(`  부재: ${absentNames} — 원국에 없으므로 대운/세운에서 보충이 중요합니다.`);
  }
  if (scarce.length > 0 && absent.length === 0) {
    const scarceNames = scarce.map(oh => ohaengKorean(oh)).join(', ');
    lines.push(`  부족: ${scarceNames} — 1개뿐이므로 보강이 도움이 됩니다.`);
  }

  const stemList = [p.year.cheongan, p.month.cheongan, p.day.cheongan, p.hour.cheongan];
  const yangCount = stemList.filter(c => CHEONGAN_INFO[c].eumyang === Eumyang.YANG).length;
  const eumCount = stemList.filter(c => CHEONGAN_INFO[c].eumyang === Eumyang.YIN).length;
  let balance: string;
  if (yangCount === eumCount) {
    balance = `균형 (양${yangCount}:음${eumCount})`;
  } else if (yangCount > eumCount) {
    balance = `양 우세 (양${yangCount}:음${eumCount}) — 적극적이고 외향적인 기질`;
  } else {
    balance = `음 우세 (양${yangCount}:음${eumCount}) — 내향적이고 신중한 기질`;
  }
  lines.push(`  음양: ${balance}`);
  lines.push('');

  lines.push('  [지장간 포함 오행 분포]');
  const weightedOhaeng = new Map<Ohaeng, number>();
  for (const oh of OHAENG_VALUES) weightedOhaeng.set(oh, 0);
  for (const stem of stemList) {
    const oh = CHEONGAN_INFO[stem].ohaeng;
    weightedOhaeng.set(oh, weightedOhaeng.get(oh)! + 1.0);
  }
  const branches = [p.year.jiji, p.month.jiji, p.day.jiji, p.hour.jiji];
  for (const branch of branches) {
    const hiddenStems = HiddenStemTable.getHiddenStems(branch);
    const totalDays = hiddenStems.reduce((sum, e) => sum + e.days, 0);
    if (totalDays > 0) {
      for (const entry of hiddenStems) {
        const weight = entry.days / totalDays;
        const oh = CHEONGAN_INFO[entry.stem].ohaeng;
        weightedOhaeng.set(oh, weightedOhaeng.get(oh)! + weight);
      }
    }
  }
  const totalWeight = Array.from(weightedOhaeng.values()).reduce((a, b) => a + b, 0);
  for (const oh of OHAENG_VALUES) {
    const w = weightedOhaeng.get(oh)!;
    const pct = totalWeight > 0 ? (w / totalWeight * 100) : 0;
    lines.push(`    ${ohaengKorean(oh)}: ${pct.toFixed(1)}% (${w.toFixed(1)}/8.0)`);
  }
  lines.push('');

  lines.push(`  [오행 흐름 분석] ${sentenceCite('ohaeng.flow')}`);
  const dm = CHEONGAN_INFO[p.day.cheongan].ohaeng;
  const present = new Set(OHAENG_VALUES.filter(oh => (counts.get(oh) ?? 0) > 0));

  const sangsaengActive: string[] = [];
  const sangsaengBlocked: string[] = [];
  for (const oh of OHAENG_VALUES) {
    const target = OhaengRelations.generates(oh);
    if (present.has(oh) && present.has(target)) {
      sangsaengActive.push(`${ohaengKorean(oh)}→${ohaengKorean(target)}`);
    } else if (present.has(oh) && !present.has(target)) {
      sangsaengBlocked.push(`${ohaengKorean(oh)}→${ohaengKorean(target)}(단절)`);
    }
  }
  if (sangsaengActive.length > 0) lines.push(`    상생: ${sangsaengActive.join(', ')}`);
  if (sangsaengBlocked.length > 0) lines.push(`    단절: ${sangsaengBlocked.join(', ')}`);
  lines.push(`    순환: ${sangsaengActive.length}/5 상생 연결 활성`);

  const generatesMe = OhaengRelations.generatedBy(dm);
  const iGenerate = OhaengRelations.generates(dm);
  const controlsMe = OhaengRelations.controlledBy(dm);
  const iControl = OhaengRelations.controls(dm);
  const dmCount = counts.get(dm) ?? 0;
  const supportCount = counts.get(generatesMe) ?? 0;
  const drainCount = counts.get(iGenerate) ?? 0;
  const pressureCount = counts.get(controlsMe) ?? 0;
  const controlCount = counts.get(iControl) ?? 0;

  lines.push(`    일간 ${ohaengKorean(dm)} 역학:`);
  lines.push(`      도움(${ohaengKorean(generatesMe)}→나): ${supportCount}개, 비겁(나와 동일): ${dmCount}개`);
  lines.push(`      설기(나→${ohaengKorean(iGenerate)}): ${drainCount}개, 극제(${ohaengKorean(controlsMe)}→나): ${pressureCount}개, 지배(나→${ohaengKorean(iControl)}): ${controlCount}개`);

  const totalSupport = dmCount + supportCount;
  const totalDrain = drainCount + pressureCount + controlCount;
  let dynamicNote: string;
  if (totalSupport >= totalDrain + 3) {
    dynamicNote = '일간을 도와주는 기운이 매우 강하여 에너지가 넘칩니다.';
  } else if (totalSupport > totalDrain) {
    dynamicNote = '일간을 도와주는 기운이 우세하여 안정적입니다.';
  } else if (totalDrain >= totalSupport + 3) {
    dynamicNote = '일간의 에너지를 빼앗는 기운이 강하여 소진되기 쉽습니다.';
  } else if (totalDrain > totalSupport) {
    dynamicNote = '일간의 에너지를 소모하는 기운이 다소 강합니다.';
  } else {
    dynamicNote = '도움과 소모가 균형을 이루고 있습니다.';
  }
  lines.push(`    → ${dynamicNote}`);

  return lines.join('\n').trimEnd();
}
