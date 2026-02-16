import { CHEONGAN_INFO } from '../../domain/Cheongan.js';
import { Ohaeng } from '../../domain/Ohaeng.js';
import { PillarSet } from '../../domain/PillarSet.js';
import { StrengthResult } from '../../domain/StrengthResult.js';
import { HiddenStemTable } from '../../domain/HiddenStem.js';
import { Sipseong } from '../../domain/Sipseong.js';
import { TenGodCalculator } from './TenGodCalculator.js';

export interface FormationProfile {
  readonly dayMasterElement: Ohaeng;

  readonly hasBigyeop: boolean;
  readonly hasSiksang: boolean;
  readonly hasJae: boolean;
  readonly hasGwan: boolean;
  readonly hasInseong: boolean;

  readonly hasSangGwan: boolean;
  readonly hasSikSin: boolean;
  readonly hasPyeonIn: boolean;
  readonly hasPyeonGwan: boolean;
  readonly hasJeongGwan: boolean;
  readonly hasPyeonJae: boolean;
  readonly hasJeongJae: boolean;
  readonly hasGyeobJae: boolean;

  readonly bigyeopCount: number;
  readonly siksangCount: number;
  readonly jaeCount: number;
  readonly gwanCount: number;
  readonly inseongCount: number;

  readonly isStrong: boolean;

  readonly hiddenSipseongs: ReadonlySet<Sipseong>;
}

export function hasSikSinStrong(p: FormationProfile): boolean {
  return p.siksangCount >= 2;
}

export function hasHiddenSangGwan(p: FormationProfile): boolean {
  return !p.hasSangGwan && p.hiddenSipseongs.has(Sipseong.SANG_GWAN);
}

export function hasHiddenPyeonIn(p: FormationProfile): boolean {
  return !p.hasPyeonIn && p.hiddenSipseongs.has(Sipseong.PYEON_IN);
}

export function hasHiddenGyeobJae(p: FormationProfile): boolean {
  return !p.hasGyeobJae && p.hiddenSipseongs.has(Sipseong.GYEOB_JAE);
}


export function buildProfile(pillars: PillarSet, strength: StrengthResult): FormationProfile {
  const dayMaster = pillars.day.cheongan;
  const nonDayStems = [
    pillars.year.cheongan,
    pillars.month.cheongan,
    pillars.hour.cheongan,
  ];

  const sipseongList = nonDayStems.map(s => TenGodCalculator.calculate(dayMaster, s));

  const allBranches = [pillars.year.jiji, pillars.month.jiji, pillars.day.jiji, pillars.hour.jiji];
  const hiddenPrincipalSipseongs = new Set<Sipseong>();
  for (const branch of allBranches) {
    const principalStem = HiddenStemTable.getPrincipalStem(branch);
    if (principalStem !== dayMaster) {
      hiddenPrincipalSipseongs.add(TenGodCalculator.calculate(dayMaster, principalStem));
    }
  }

  const sipseongSet = new Set(sipseongList);
  const sipseongCountMap = new Map<Sipseong, number>();
  for (const sipseong of sipseongList) {
    sipseongCountMap.set(sipseong, (sipseongCountMap.get(sipseong) ?? 0) + 1);
  }

  const has = (sipseong: Sipseong): boolean => sipseongSet.has(sipseong);
  const countOf = (...targets: readonly Sipseong[]): number =>
    targets.reduce((sum, target) => sum + (sipseongCountMap.get(target) ?? 0), 0);

  const hasBigyeop = has(Sipseong.BI_GYEON) || has(Sipseong.GYEOB_JAE);
  const hasSiksang = has(Sipseong.SIK_SIN) || has(Sipseong.SANG_GWAN);
  const hasJae = has(Sipseong.PYEON_JAE) || has(Sipseong.JEONG_JAE);
  const hasGwan = has(Sipseong.PYEON_GWAN) || has(Sipseong.JEONG_GWAN);
  const hasInseong = has(Sipseong.PYEON_IN) || has(Sipseong.JEONG_IN);

  return {
    dayMasterElement: CHEONGAN_INFO[dayMaster].ohaeng,
    hasBigyeop,
    hasSiksang,
    hasJae,
    hasGwan,
    hasInseong,
    hasSangGwan: has(Sipseong.SANG_GWAN),
    hasSikSin: has(Sipseong.SIK_SIN),
    hasPyeonIn: has(Sipseong.PYEON_IN),
    hasPyeonGwan: has(Sipseong.PYEON_GWAN),
    hasJeongGwan: has(Sipseong.JEONG_GWAN),
    hasPyeonJae: has(Sipseong.PYEON_JAE),
    hasJeongJae: has(Sipseong.JEONG_JAE),
    hasGyeobJae: has(Sipseong.GYEOB_JAE),
    bigyeopCount: countOf(Sipseong.BI_GYEON, Sipseong.GYEOB_JAE),
    siksangCount: countOf(Sipseong.SIK_SIN, Sipseong.SANG_GWAN),
    jaeCount: countOf(Sipseong.PYEON_JAE, Sipseong.JEONG_JAE),
    gwanCount: countOf(Sipseong.PYEON_GWAN, Sipseong.JEONG_GWAN),
    inseongCount: countOf(Sipseong.PYEON_IN, Sipseong.JEONG_IN),
    isStrong: strength.isStrong,
    hiddenSipseongs: hiddenPrincipalSipseongs,
  };
}
