import { CHEONGAN_INFO } from '../../domain/Cheongan.js';
import { JIJI_INFO } from '../../domain/Jiji.js';
import { Ohaeng, OHAENG_VALUES, ohaengKoreanLabel } from '../../domain/Ohaeng.js';
import { type PillarSet } from '../../domain/PillarSet.js';

export function ohaengKr(oh: Ohaeng): string {
  return ohaengKoreanLabel(oh);
}

function allPillarOhaengs(pillars: PillarSet): readonly Ohaeng[] {
  return [
    CHEONGAN_INFO[pillars.year.cheongan].ohaeng,
    JIJI_INFO[pillars.year.jiji].ohaeng,
    CHEONGAN_INFO[pillars.month.cheongan].ohaeng,
    JIJI_INFO[pillars.month.jiji].ohaeng,
    CHEONGAN_INFO[pillars.day.cheongan].ohaeng,
    JIJI_INFO[pillars.day.jiji].ohaeng,
    CHEONGAN_INFO[pillars.hour.cheongan].ohaeng,
    JIJI_INFO[pillars.hour.jiji].ohaeng,
  ];
}

export function buildOhaengDistribution(pillars: PillarSet): Map<Ohaeng, number> {
  const ohaengDistribution = new Map<Ohaeng, number>();
  for (const oh of OHAENG_VALUES) {
    ohaengDistribution.set(oh, 0);
  }
  for (const ohaeng of allPillarOhaengs(pillars)) {
    const count = ohaengDistribution.get(ohaeng) ?? 0;
    ohaengDistribution.set(ohaeng, count + 1);
  }
  return ohaengDistribution;
}
