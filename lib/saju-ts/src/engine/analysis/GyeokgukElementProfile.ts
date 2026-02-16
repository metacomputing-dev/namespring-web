import { Cheongan, CHEONGAN_INFO } from '../../domain/Cheongan.js';
import { Ohaeng } from '../../domain/Ohaeng.js';
import { PillarSet } from '../../domain/PillarSet.js';
import { PillarPosition } from '../../domain/PillarPosition.js';
import { HiddenStemTable } from '../../domain/HiddenStem.js';
import { HapHwaEvaluation, HapState } from '../../domain/Relations.js';
import { TenGodCalculator } from './TenGodCalculator.js';
import { categorize, categorizeByOhaeng, SipseongCategory } from './GyeokgukDeterminerHelpers.js';
import { ohaengKorean } from './GyeokgukFormationShared.js';

export interface ElementProfile {
  readonly bigyeopCount: number;
  readonly siksangCount: number;
  readonly jaeCount: number;
  readonly gwanCount: number;
  readonly inseongCount: number;
}

export function effectiveOhaeng(
  position: PillarPosition,
  stem: Cheongan,
  hapHwaEvaluations: readonly HapHwaEvaluation[],
): Ohaeng | null {
  const activeHap = hapHwaEvaluations.find(eval_ =>
    eval_.state !== HapState.NOT_ESTABLISHED &&
    (eval_.position1 === position || eval_.position2 === position)
  );
  if (activeHap?.state === HapState.HAPGEO) return null;
  if (activeHap?.state === HapState.HAPWHA) return activeHap.resultOhaeng;
  return CHEONGAN_INFO[stem].ohaeng;
}

export function buildElementProfile(
  dayMaster: Cheongan,
  pillars: PillarSet,
  hapHwaEvaluations: readonly HapHwaEvaluation[],
): ElementProfile {
  let bigyeop = 0;
  let siksang = 0;
  let jae = 0;
  let gwan = 0;
  let inseong = 0;

  function count(category: SipseongCategory): void {
    switch (category) {
      case SipseongCategory.BIGYEOP: bigyeop++; break;
      case SipseongCategory.SIKSANG: siksang++; break;
      case SipseongCategory.JAE:     jae++; break;
      case SipseongCategory.GWAN:    gwan++; break;
      case SipseongCategory.INSEONG: inseong++; break;
    }
  }

  const dayMasterOhaeng = CHEONGAN_INFO[dayMaster].ohaeng;

  const nonDayPositions: [PillarPosition, Cheongan][] = [
    [PillarPosition.YEAR, pillars.year.cheongan],
    [PillarPosition.MONTH, pillars.month.cheongan],
    [PillarPosition.HOUR, pillars.hour.cheongan],
  ];

  for (const [pos, stem] of nonDayPositions) {
    const oh = effectiveOhaeng(pos, stem, hapHwaEvaluations);
    if (oh == null) continue; // 합거'd -- neutralized
    count(categorizeByOhaeng(dayMasterOhaeng, oh));
  }

  const allBranches = [pillars.year.jiji, pillars.month.jiji, pillars.day.jiji, pillars.hour.jiji];
  for (const jiji of allBranches) {
    count(categorize(TenGodCalculator.calculate(dayMaster, HiddenStemTable.getPrincipalStem(jiji))));
  }

  return { bigyeopCount: bigyeop, siksangCount: siksang, jaeCount: jae, gwanCount: gwan, inseongCount: inseong };
}

export { ohaengKorean };

