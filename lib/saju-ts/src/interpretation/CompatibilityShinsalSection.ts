import { type ShinsalMatchResult } from '../domain/Compatibility.js';
import { ShinsalType } from '../domain/Shinsal.js';
import { type SajuAnalysis } from '../domain/SajuAnalysis.js';

export function analyzeShinsalMatch(p1: SajuAnalysis, p2: SajuAnalysis): ShinsalMatchResult {
  const details: string[] = [];
  let bonus = 0;

  const gwiin1 = p1.weightedShinsalHits.filter(h => h.hit.type === ShinsalType.CHEONUL_GWIIN);
  const gwiin2 = p2.weightedShinsalHits.filter(h => h.hit.type === ShinsalType.CHEONUL_GWIIN);
  if (gwiin1.length > 0 || gwiin2.length > 0) {
    details.push('천을귀인(天乙貴人) 관계가 있어 서로가 서로의 귀인이 될 수 있습니다.');
    bonus += 5;
  }

  const dohwa1 = p1.weightedShinsalHits.some(h => h.hit.type === ShinsalType.DOHWA);
  const dohwa2 = p2.weightedShinsalHits.some(h => h.hit.type === ShinsalType.DOHWA);
  if (dohwa1 && dohwa2) {
    details.push('둘 다 도화(桃花)가 있어 서로에게 강한 매력을 느끼나 외부 유혹에 주의가 필요합니다.');
    bonus += 3;
  } else if (dohwa1 || dohwa2) {
    details.push('한쪽에 도화(桃花)가 있어 이성적 매력이 관계에 활력을 줍니다.');
    bonus += 2;
  }

  const yeokma1 = p1.weightedShinsalHits.some(h => h.hit.type === ShinsalType.YEOKMA);
  const yeokma2 = p2.weightedShinsalHits.some(h => h.hit.type === ShinsalType.YEOKMA);
  if (yeokma1 && yeokma2) {
    details.push('둘 다 역마(驛馬)가 있어 함께 여행하고 새로운 경험을 나누기 좋은 관계입니다.');
    bonus += 2;
  }

  const hongyeom1 = p1.weightedShinsalHits.some(h => h.hit.type === ShinsalType.HONGYEOM);
  const hongyeom2 = p2.weightedShinsalHits.some(h => h.hit.type === ShinsalType.HONGYEOM);
  if (hongyeom1 || hongyeom2) {
    details.push('홍염살(紅艶)이 있어 강렬한 이성 인연이 형성됩니다.');
    bonus += 2;
  }

  const baseScore = Math.min(60 + bonus, 100);
  return { score: baseScore, details };
}

