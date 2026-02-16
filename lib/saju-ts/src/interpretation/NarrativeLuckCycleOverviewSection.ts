import { CHEONGAN_INFO } from '../domain/Cheongan.js';
import { JIJI_INFO } from '../domain/Jiji.js';
import type { SajuAnalysis } from '../domain/SajuAnalysis.js';
import { formatPillar, ohaengKorean } from './NarrativeFormatting.js';
import { sentenceCite } from './NarrativeSentenceCite.js';

export function buildLuckCycleOverview(a: SajuAnalysis): string {
  const lines: string[] = [];
  lines.push('■ 대운(大運) 흐름');
  lines.push('');

  const daeun = a.daeunInfo;
  if (!daeun) {
    lines.push('대운 분석이 수행되지 않았습니다.');
    return lines.join('\n');
  }

  const direction = daeun.isForward ? '순행(順行)' : '역행(逆行)';
  const ageLabel = daeun.firstDaeunStartMonths > 0
    ? `${daeun.firstDaeunStartAge}세 ${daeun.firstDaeunStartMonths}개월`
    : `${daeun.firstDaeunStartAge}세`;
  lines.push(`대운 방향: ${direction}, 초년 대운 시작 나이: ${ageLabel} ${sentenceCite('daeun.direction')} ${sentenceCite('daeun.startAge')}`);
  lines.push('');

  for (const dp of daeun.daeunPillars) {
    const startLabel = (dp.order === 1 && daeun.firstDaeunStartMonths > 0)
      ? `${dp.startAge}세 ${daeun.firstDaeunStartMonths}개월`
      : `${dp.startAge}세`;
    lines.push(`  ${startLabel}~${dp.startAge + 9}세: ` +
      `${formatPillar(dp.pillar)} (${ohaengKorean(CHEONGAN_INFO[dp.pillar.cheongan].ohaeng)}/${ohaengKorean(JIJI_INFO[dp.pillar.jiji].ohaeng)})`);
  }

  return lines.join('\n').trimEnd();
}
