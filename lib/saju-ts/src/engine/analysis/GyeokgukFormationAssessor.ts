import {
  GyeokgukCategory,
  GyeokgukFormation,
  GyeokgukResult,
} from '../../domain/Gyeokguk.js';
import { PillarSet } from '../../domain/PillarSet.js';
import { StrengthResult } from '../../domain/StrengthResult.js';
import { buildProfile } from './GyeokgukFormationProfile.js';
import { assessOegyeok } from './GyeokgukFormationOegyeokAssessors.js';
import { assessNaegyeok } from './GyeokgukFormationNaegyeokAssessors.js';

export const GyeokgukFormationAssessor = {
  assess(
    gyeokguk: GyeokgukResult,
    pillars: PillarSet,
    strength: StrengthResult,
  ): GyeokgukFormation {
    const profile = buildProfile(pillars, strength);

    if (gyeokguk.category !== GyeokgukCategory.NAEGYEOK) {
      return assessOegyeok(gyeokguk, profile);
    }

    return assessNaegyeok(gyeokguk.type, profile);
  },
} as const;

export const assessGyeokgukFormation = GyeokgukFormationAssessor.assess;
