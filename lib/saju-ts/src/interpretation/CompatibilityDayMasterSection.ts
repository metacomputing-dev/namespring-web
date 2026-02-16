import { Cheongan, CHEONGAN_INFO } from '../domain/Cheongan.js';
import { type DayMasterCompatibility } from '../domain/Compatibility.js';
import { OhaengRelations } from '../domain/Ohaeng.js';
import { type SajuAnalysis } from '../domain/SajuAnalysis.js';
import { ohaengKr, stemKr } from './CompatibilityShared.js';

const CHEONGAN_HAP_PAIRS: ReadonlyMap<Cheongan, Cheongan> = new Map([
  [Cheongan.GAP, Cheongan.GI], [Cheongan.GI, Cheongan.GAP],
  [Cheongan.EUL, Cheongan.GYEONG], [Cheongan.GYEONG, Cheongan.EUL],
  [Cheongan.BYEONG, Cheongan.SIN], [Cheongan.SIN, Cheongan.BYEONG],
  [Cheongan.JEONG, Cheongan.IM], [Cheongan.IM, Cheongan.JEONG],
  [Cheongan.MU, Cheongan.GYE], [Cheongan.GYE, Cheongan.MU],
]);

const CHEONGAN_CHUNG_MAP: ReadonlyMap<Cheongan, Cheongan> = new Map([
  [Cheongan.GAP, Cheongan.GYEONG], [Cheongan.GYEONG, Cheongan.GAP],
  [Cheongan.EUL, Cheongan.SIN], [Cheongan.SIN, Cheongan.EUL],
  [Cheongan.BYEONG, Cheongan.IM], [Cheongan.IM, Cheongan.BYEONG],
  [Cheongan.JEONG, Cheongan.GYE], [Cheongan.GYE, Cheongan.JEONG],
]);

export function analyzeDayMasterRelation(p1: SajuAnalysis, p2: SajuAnalysis): DayMasterCompatibility {
  const dm1 = p1.pillars.day.cheongan;
  const dm2 = p2.pillars.day.cheongan;

  const hapPair = CHEONGAN_HAP_PAIRS.get(dm1);
  const isHap = hapPair === dm2;

  const chungPair = CHEONGAN_CHUNG_MAP.get(dm1);
  const isChung = chungPair === dm2;

  const isSameElement = CHEONGAN_INFO[dm1].ohaeng === CHEONGAN_INFO[dm2].ohaeng;

  const generates1to2 = OhaengRelations.generates(CHEONGAN_INFO[dm1].ohaeng) === CHEONGAN_INFO[dm2].ohaeng;
  const generates2to1 = OhaengRelations.generates(CHEONGAN_INFO[dm2].ohaeng) === CHEONGAN_INFO[dm1].ohaeng;
  const isGenerating = generates1to2 || generates2to1;

  const controls1to2 = OhaengRelations.controls(CHEONGAN_INFO[dm1].ohaeng) === CHEONGAN_INFO[dm2].ohaeng;
  const controls2to1 = OhaengRelations.controls(CHEONGAN_INFO[dm2].ohaeng) === CHEONGAN_INFO[dm1].ohaeng;

  let score: number;
  let interpretation: string;

  if (isHap) {
    score = 95;
    interpretation = `${stemKr(dm1)}과 ${stemKr(dm2)}는 천간합(天干合) 관계로, 서로에게 끌리는 강한 인연이 있습니다. 자연스러운 조화를 이룹니다.`;
  } else if (isSameElement && dm1 === dm2) {
    score = 60;
    interpretation = `같은 ${stemKr(dm1)}끼리로, 비견(比肩) 관계입니다. 서로를 잘 이해하나 주도권 다툼이 생길 수 있습니다.`;
  } else if (isSameElement) {
    score = 55;
    interpretation = `${stemKr(dm1)}과 ${stemKr(dm2)}는 같은 ${ohaengKr(CHEONGAN_INFO[dm1].ohaeng)}으로, 동질감은 높으나 자극이 적을 수 있습니다.`;
  } else if (isGenerating) {
    const direction = generates1to2 ? `${stemKr(dm1)}→${stemKr(dm2)}` : `${stemKr(dm2)}→${stemKr(dm1)}`;
    score = 80;
    interpretation = `${direction} 상생(相生) 관계로, 한쪽이 상대를 자연스럽게 도와줍니다. 안정적이고 순환적인 관계가 됩니다.`;
  } else if (isChung) {
    score = 30;
    interpretation = `${stemKr(dm1)}과 ${stemKr(dm2)}는 천간충(天干沖) 관계로, 가치관과 행동양식이 부딪칠 수 있습니다. 서로의 차이를 인정하는 노력이 필요합니다.`;
  } else if (controls1to2 || controls2to1) {
    const direction = controls1to2 ? `${stemKr(dm1)}이 ${stemKr(dm2)}를` : `${stemKr(dm2)}이 ${stemKr(dm1)}를`;
    score = 45;
    interpretation = `${direction} 극(克)하는 관계로, 긴장감이 있을 수 있습니다. 하지만 적절한 극은 성장의 동력이 되기도 합니다.`;
  } else {
    score = 65;
    interpretation = `${stemKr(dm1)}과 ${stemKr(dm2)}는 직접적 합충 관계가 없어 무난한 관계이며, 큰 갈등 없이 지낼 수 있습니다.`;
  }

  let relationType: string;
  if (isHap) relationType = '천간합(天干合)';
  else if (isChung) relationType = '천간충(天干沖)';
  else if (isSameElement) relationType = '동일 오행(同一五行)';
  else if (isGenerating) relationType = '상생(相生)';
  else if (controls1to2 || controls2to1) relationType = '상극(相剋)';
  else relationType = '중립(中立)';

  return { stem1: dm1, stem2: dm2, relationType, score, interpretation };
}

