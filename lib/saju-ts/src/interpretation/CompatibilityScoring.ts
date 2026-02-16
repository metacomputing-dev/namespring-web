import {
  type DayBranchCompatibility,
  type DayMasterCompatibility,
  type OhaengComplementResult,
  type ShinsalMatchResult,
  type SipseongCrossResult,
} from '../domain/Compatibility.js';

export function computeTotalScore(
  dayMaster: DayMasterCompatibility,
  dayBranch: DayBranchCompatibility,
  ohaeng: OhaengComplementResult,
  sipseong: SipseongCrossResult,
  shinsal: ShinsalMatchResult,
): number {
  return Math.floor(
    (dayMaster.score * 25 +
      dayBranch.score * 25 +
      ohaeng.score * 20 +
      sipseong.score * 20 +
      shinsal.score * 10) / 100,
  );
}

