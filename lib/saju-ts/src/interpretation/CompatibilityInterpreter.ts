import {
  CompatibilityGrade,
  type CompatibilityResult,
} from '../domain/Compatibility.js';
import { type SajuAnalysis } from '../domain/SajuAnalysis.js';
import { analyzeDayMasterRelation } from './CompatibilityDayMasterSection.js';
import { analyzeDayBranchRelation } from './CompatibilityDayBranchSection.js';
import { analyzeOhaengComplement } from './CompatibilityOhaengSection.js';
import { analyzeSipseongCross } from './CompatibilitySipseongSection.js';
import { analyzeShinsalMatch } from './CompatibilityShinsalSection.js';
import { computeTotalScore } from './CompatibilityScoring.js';

export function analyzeCompatibility(person1: SajuAnalysis, person2: SajuAnalysis): CompatibilityResult {
  const dayMasterResult = analyzeDayMasterRelation(person1, person2);
  const dayBranchResult = analyzeDayBranchRelation(person1, person2);
  const ohaengComplement = analyzeOhaengComplement(person1, person2);
  const sipseongCross = analyzeSipseongCross(person1, person2);
  const shinsalMatch = analyzeShinsalMatch(person1, person2);

  const totalScore = computeTotalScore(
    dayMasterResult, dayBranchResult, ohaengComplement, sipseongCross, shinsalMatch,
  );

  let overallGrade: CompatibilityGrade;
  if (totalScore >= 85) overallGrade = CompatibilityGrade.EXCELLENT;
  else if (totalScore >= 70) overallGrade = CompatibilityGrade.GOOD;
  else if (totalScore >= 55) overallGrade = CompatibilityGrade.AVERAGE;
  else if (totalScore >= 40) overallGrade = CompatibilityGrade.BELOW_AVERAGE;
  else overallGrade = CompatibilityGrade.POOR;

  return {
    totalScore,
    grade: overallGrade,
    dayMaster: dayMasterResult,
    dayBranch: dayBranchResult,
    ohaengComplement,
    sipseongCross,
    shinsalMatch,
  };
}

export const CompatibilityInterpreter = {
  analyze: analyzeCompatibility,
} as const;

