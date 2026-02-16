import { type SipseongCrossResult } from '../domain/Compatibility.js';
import { SIPSEONG_INFO } from '../domain/Sipseong.js';
import { type SajuAnalysis } from '../domain/SajuAnalysis.js';
import { computeSipseong, sipseongPartnerMeaning, sipseongRelScore } from './CompatibilityShared.js';

export function analyzeSipseongCross(p1: SajuAnalysis, p2: SajuAnalysis): SipseongCrossResult {
  const dm1 = p1.pillars.day.cheongan;
  const dm2 = p2.pillars.day.cheongan;
  const gender1 = p1.input.gender;
  const gender2 = p2.input.gender;

  const ss2to1 = computeSipseong(dm1, dm2);
  const ss1to2 = computeSipseong(dm2, dm1);

  const interp2to1 = sipseongPartnerMeaning(ss2to1, gender1);
  const interp1to2 = sipseongPartnerMeaning(ss1to2, gender2);

  const scorePair = Math.floor((sipseongRelScore(ss2to1) + sipseongRelScore(ss1to2)) / 2);

  return {
    person2ToPerson1: ss2to1,
    person1ToPerson2: ss1to2,
    interpretation2to1: `상대가 나에게 ${SIPSEONG_INFO[ss2to1].koreanName}(${SIPSEONG_INFO[ss2to1].hanja}) — ${interp2to1}`,
    interpretation1to2: `내가 상대에게 ${SIPSEONG_INFO[ss1to2].koreanName}(${SIPSEONG_INFO[ss1to2].hanja}) — ${interp1to2}`,
    score: scorePair,
  };
}

