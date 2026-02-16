import { type OhaengComplementResult } from '../domain/Compatibility.js';
import { OHAENG_VALUES } from '../domain/Ohaeng.js';
import { type SajuAnalysis } from '../domain/SajuAnalysis.js';
import { countOhaeng, ohaengKr } from './CompatibilityShared.js';

export function analyzeOhaengComplement(p1: SajuAnalysis, p2: SajuAnalysis): OhaengComplementResult {
  const counts1 = countOhaeng(p1.pillars);
  const counts2 = countOhaeng(p2.pillars);
  const absent1 = OHAENG_VALUES.filter(oh => counts1.get(oh)! === 0);
  const absent2 = OHAENG_VALUES.filter(oh => counts2.get(oh)! === 0);

  const fills1from2 = absent1.filter(oh => counts2.get(oh)! >= 1).length;
  const fills2from1 = absent2.filter(oh => counts1.get(oh)! >= 1).length;
  const totalFills = fills1from2 + fills2from1;
  const totalGaps = absent1.length + absent2.length;

  let combinedPresent = 0;
  for (const oh of OHAENG_VALUES) {
    if (counts1.get(oh)! + counts2.get(oh)! > 0) combinedPresent++;
  }

  let complementScore: number;
  if (totalGaps === 0) {
    complementScore = 70;
  } else if (totalFills === totalGaps) {
    complementScore = 95;
  } else if (totalFills > 0) {
    complementScore = 60 + Math.floor(totalFills * 30 / Math.max(totalGaps, 1));
  } else {
    complementScore = 40;
  }

  const details: string[] = [];
  if (absent1.length > 0) {
    const filled = absent1.filter(oh => counts2.get(oh)! >= 1);
    if (filled.length > 0) {
      details.push(`상대방이 나에게 부족한 ${filled.map(ohaengKr).join('/')}을 보충해줍니다.`);
    }
    const unfilled = absent1.filter(oh => counts2.get(oh)! === 0);
    if (unfilled.length > 0) {
      details.push(`나의 부족 오행 ${unfilled.map(ohaengKr).join('/')}은 상대방에게도 없어 외부 보강이 필요합니다.`);
    }
  }
  if (absent2.length > 0) {
    const filled = absent2.filter(oh => counts1.get(oh)! >= 1);
    if (filled.length > 0) {
      details.push(`내가 상대방에게 부족한 ${filled.map(ohaengKr).join('/')}을 보충해줍니다.`);
    }
  }
  if (combinedPresent === 5) {
    details.push('두 사람이 합치면 오행 5행이 모두 갖추어져 완전한 균형을 이룹니다.');
  }

  return { score: complementScore, combinedCompleteness: combinedPresent, details };
}

