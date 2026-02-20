import { describe, it, expect } from 'vitest';
import { Cheongan } from '../../../src/domain/Cheongan.js';
import { Jiji } from '../../../src/domain/Jiji.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { PillarSet } from '../../../src/domain/PillarSet.js';
import { PillarPosition } from '../../../src/domain/PillarPosition.js';
import { ShinsalGrade, ShinsalHit, ShinsalType, SHINSAL_TYPE_INFO } from '../../../src/domain/Shinsal.js';
import { ShinsalDetector } from '../../../src/engine/analysis/ShinsalDetector.js';
import { ShinsalWeightCalculator } from '../../../src/engine/analysis/ShinsalWeightModel.js';

// ── Helper ──

function p(stem: Cheongan, branch: Jiji): Pillar {
  return new Pillar(stem, branch);
}

function pillars(
  year: [Cheongan, Jiji],
  month: [Cheongan, Jiji],
  day: [Cheongan, Jiji],
  hour: [Cheongan, Jiji],
): PillarSet {
  return new PillarSet(
    p(year[0], year[1]),
    p(month[0], month[1]),
    p(day[0], day[1]),
    p(hour[0], hour[1]),
  );
}

const GAP = Cheongan.GAP;
const EUL = Cheongan.EUL;
const BYEONG = Cheongan.BYEONG;
const JEONG = Cheongan.JEONG;
const MU = Cheongan.MU;
const GI = Cheongan.GI;
const GYEONG = Cheongan.GYEONG;
const C_SIN = Cheongan.SIN;
const IM = Cheongan.IM;
const GYE = Cheongan.GYE;

const JA = Jiji.JA;
const CHUK = Jiji.CHUK;
const IN = Jiji.IN;
const MYO = Jiji.MYO;
const JIN = Jiji.JIN;
const SA = Jiji.SA;
const O = Jiji.O;
const MI = Jiji.MI;
const SIN = Jiji.SIN;
const YU = Jiji.YU;
const SUL = Jiji.SUL;
const HAE = Jiji.HAE;

// ================================================================
// A-Grade: 천을귀인 (天乙貴人)
// ================================================================

describe('ShinsalDetector', () => {
  describe('CheonulGwiin', () => {
    it('gapDayMasterWithChukInYearBranch', () => {
      const ps = pillars([GAP, CHUK], [BYEONG, IN], [GAP, JA], [BYEONG, IN]);
      const hits = ShinsalDetector.detectAll(ps);

      expect(hits.some(
        (h) => h.type === ShinsalType.CHEONUL_GWIIN && h.position === PillarPosition.YEAR && h.referenceBranch === CHUK,
      )).toBe(true);
    });

    it('gapDayMasterWithMiInMonthBranch', () => {
      const ps = pillars([GAP, JA], [BYEONG, MI], [GAP, JA], [BYEONG, IN]);
      const hits = ShinsalDetector.detectAll(ps);

      expect(hits.some(
        (h) => h.type === ShinsalType.CHEONUL_GWIIN && h.position === PillarPosition.MONTH && h.referenceBranch === MI,
      )).toBe(true);
    });

    it('gapDayMasterWithBothNobleBranchesPresent', () => {
      const ps = pillars([GAP, CHUK], [BYEONG, IN], [GAP, JA], [BYEONG, MI]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.CHEONUL_GWIIN);

      expect(hits).toHaveLength(2);
      expect(hits.some((h) => h.position === PillarPosition.YEAR && h.referenceBranch === CHUK)).toBe(true);
      expect(hits.some((h) => h.position === PillarPosition.HOUR && h.referenceBranch === MI)).toBe(true);
    });

    it('eulDayMasterNobleBranchesAreJaAndSin', () => {
      const ps = pillars([GAP, SIN], [BYEONG, IN], [EUL, MYO], [BYEONG, JA]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.CHEONUL_GWIIN);

      expect(hits).toHaveLength(2);
      expect(hits.some((h) => h.referenceBranch === SIN)).toBe(true);
      expect(hits.some((h) => h.referenceBranch === JA)).toBe(true);
    });

    it('byeongDayMasterNobleBranchesAreHaeAndYu', () => {
      const ps = pillars([GAP, HAE], [BYEONG, IN], [BYEONG, IN], [BYEONG, YU]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.CHEONUL_GWIIN);

      expect(hits.some((h) => h.referenceBranch === HAE)).toBe(true);
      expect(hits.some((h) => h.referenceBranch === YU)).toBe(true);
    });

    it('sinDayMasterNobleBranchesAreInAndO', () => {
      const ps = pillars([GAP, IN], [BYEONG, O], [C_SIN, YU], [BYEONG, SUL]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.CHEONUL_GWIIN);

      expect(hits).toHaveLength(2);
      expect(hits.some((h) => h.referenceBranch === IN)).toBe(true);
      expect(hits.some((h) => h.referenceBranch === O)).toBe(true);
    });

    it('imDayMasterNobleBranchesAreMyoAndSa', () => {
      const ps = pillars([GAP, MYO], [BYEONG, SA], [IM, JA], [BYEONG, IN]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.CHEONUL_GWIIN);

      expect(hits).toHaveLength(2);
      expect(hits.some((h) => h.referenceBranch === MYO)).toBe(true);
      expect(hits.some((h) => h.referenceBranch === SA)).toBe(true);
    });

    it('noCheonulGwiinWhenNeitherNobleBranchPresent', () => {
      const ps = pillars([GAP, IN], [BYEONG, JIN], [GAP, JA], [BYEONG, O]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.CHEONUL_GWIIN);

      expect(hits).toHaveLength(0);
    });
  });

  // ================================================================
  // A-Grade: 역마 (驛馬)
  // ================================================================

  describe('Yeokma', () => {
    it('inOSulGroupWithSinPresent', () => {
      const ps = pillars([GAP, SIN], [BYEONG, O], [GAP, IN], [BYEONG, SUL]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.YEOKMA);

      expect(hits.some((h) => h.referenceBranch === SIN && h.position === PillarPosition.YEAR)).toBe(true);
    });

    it('saYuChukGroupWithHaePresent', () => {
      const ps = pillars([GAP, HAE], [BYEONG, IN], [GAP, YU], [BYEONG, JA]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.YEOKMA);

      expect(hits.some((h) => h.referenceBranch === HAE)).toBe(true);
    });

    it('sinJaJinGroupWithInPresent', () => {
      const ps = pillars([GAP, IN], [BYEONG, O], [GAP, JA], [BYEONG, SUL]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.YEOKMA);

      expect(hits.some((h) => h.referenceBranch === IN)).toBe(true);
    });

    it('haeMvoMiGroupWithSaPresent', () => {
      const ps = pillars([GAP, SA], [BYEONG, IN], [EUL, MYO], [BYEONG, JA]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.YEOKMA);

      expect(hits.some((h) => h.referenceBranch === SA)).toBe(true);
    });

    it('yearBranchAlsoUsedAsReference', () => {
      const ps = pillars([GAP, O], [BYEONG, SIN], [GAP, JA], [BYEONG, IN]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.YEOKMA);

      expect(hits.some((h) => h.referenceBranch === SIN)).toBe(true);
      expect(hits.some((h) => h.referenceBranch === IN)).toBe(true);
    });

    it('noYeokmaWhenTargetBranchAbsent', () => {
      const ps = pillars([GAP, O], [BYEONG, IN], [GAP, IN], [BYEONG, SUL]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.YEOKMA);

      expect(hits).toHaveLength(0);
    });
  });

  // ================================================================
  // A-Grade: 도화 (桃花)
  // ================================================================

  describe('Dohwa', () => {
    it('inOSulGroupWithMyoPresent', () => {
      const ps = pillars([GAP, MYO], [BYEONG, IN], [GAP, O], [BYEONG, SUL]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.DOHWA);

      expect(hits.some((h) => h.referenceBranch === MYO && h.position === PillarPosition.YEAR)).toBe(true);
    });

    it('sinJaJinGroupWithYuPresent', () => {
      const ps = pillars([GAP, YU], [BYEONG, IN], [GAP, JIN], [BYEONG, JA]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.DOHWA);

      expect(hits.some((h) => h.referenceBranch === YU)).toBe(true);
    });

    it('noDohwaWhenTargetAbsent', () => {
      const ps = pillars([GAP, JA], [BYEONG, IN], [GAP, O], [BYEONG, SUL]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.DOHWA);

      expect(hits).toHaveLength(0);
    });
  });

  // ================================================================
  // A-Grade: 화개 (華蓋)
  // ================================================================

  describe('Hwagae', () => {
    it('inOSulGroupWithSulPresent', () => {
      const ps = pillars([GAP, JA], [BYEONG, O], [GAP, IN], [BYEONG, SUL]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.HWAGAE);

      expect(hits.some((h) => h.referenceBranch === SUL && h.position === PillarPosition.HOUR)).toBe(true);
    });

    it('saYuChukGroupWithChukPresent', () => {
      const ps = pillars([GAP, CHUK], [BYEONG, IN], [BYEONG, SA], [BYEONG, O]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.HWAGAE);

      expect(hits.some((h) => h.referenceBranch === CHUK)).toBe(true);
    });
  });

  // ================================================================
  // A-Grade: 태극귀인 (太極貴人)
  // ================================================================

  describe('TaegukGwiin', () => {
    it('gapDayMasterWithJaOrOPresent', () => {
      const ps = pillars([GAP, JA], [BYEONG, IN], [GAP, SUL], [BYEONG, O]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.TAEGUK_GWIIN);

      expect(hits).toHaveLength(2);
      expect(hits.some((h) => h.referenceBranch === JA && h.position === PillarPosition.YEAR)).toBe(true);
      expect(hits.some((h) => h.referenceBranch === O && h.position === PillarPosition.HOUR)).toBe(true);
    });

    it('eulDayMasterWithSaOrYuPresent', () => {
      const ps = pillars([GAP, SA], [BYEONG, IN], [EUL, MYO], [BYEONG, YU]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.TAEGUK_GWIIN);

      expect(hits.some((h) => h.referenceBranch === SA)).toBe(true);
      expect(hits.some((h) => h.referenceBranch === YU)).toBe(true);
    });

    it('muDayMasterWithChukOrMiPresent', () => {
      const ps = pillars([GAP, CHUK], [BYEONG, MI], [MU, IN], [BYEONG, JA]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.TAEGUK_GWIIN);

      expect(hits).toHaveLength(2);
      expect(hits.some((h) => h.referenceBranch === CHUK)).toBe(true);
      expect(hits.some((h) => h.referenceBranch === MI)).toBe(true);
    });

    it('noTaegukGwiinWhenNoBranchMatches', () => {
      const ps = pillars([GAP, IN], [BYEONG, MYO], [GAP, SUL], [BYEONG, CHUK]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.TAEGUK_GWIIN);

      expect(hits).toHaveLength(0);
    });
  });

  // ================================================================
  // A-Grade: 장성 (將星)
  // ================================================================

  describe('Jangseong', () => {
    it('inOSulGroupWithOPresent', () => {
      const ps = pillars([GAP, O], [BYEONG, JA], [GAP, IN], [BYEONG, JA]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.JANGSEONG);

      expect(hits.some((h) => h.referenceBranch === O && h.position === PillarPosition.YEAR)).toBe(true);
    });

    it('saYuChukGroupWithYuPresent', () => {
      const ps = pillars([GAP, YU], [BYEONG, IN], [GAP, CHUK], [BYEONG, JA]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.JANGSEONG);

      expect(hits.some((h) => h.referenceBranch === YU)).toBe(true);
    });

    it('sinJaJinGroupWithJaPresent', () => {
      const ps = pillars([GAP, JA], [BYEONG, IN], [GAP, JIN], [BYEONG, SUL]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.JANGSEONG);

      expect(hits.some((h) => h.referenceBranch === JA)).toBe(true);
    });

    it('haeMvoMiGroupWithMyoPresent', () => {
      const ps = pillars([GAP, MYO], [BYEONG, IN], [EUL, HAE], [BYEONG, JA]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.JANGSEONG);

      expect(hits.some((h) => h.referenceBranch === MYO)).toBe(true);
    });
  });

  // ================================================================
  // A-Grade: 원진살 (怨嗔殺)
  // ================================================================

  describe('Wonjin', () => {
    it('dayBranchJaTargetsMi', () => {
      const ps = pillars([GAP, MI], [BYEONG, IN], [GAP, JA], [BYEONG, SUL]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.WONJIN);

      expect(hits.some((h) => h.referenceBranch === MI && h.position === PillarPosition.YEAR)).toBe(true);
    });

    it('dayBranchMiTargetsJa (bidirectional)', () => {
      const ps = pillars([GAP, JA], [BYEONG, IN], [GAP, MI], [BYEONG, SUL]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.WONJIN);

      expect(hits.some((h) => h.referenceBranch === JA)).toBe(true);
    });

    it('dayBranchInTargetsYu', () => {
      const ps = pillars([GAP, YU], [BYEONG, JA], [GAP, IN], [BYEONG, SUL]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.WONJIN);

      expect(hits.some((h) => h.referenceBranch === YU)).toBe(true);
    });

    it('yearBranchAlsoUsedAsReference', () => {
      const ps = pillars([GAP, JIN], [BYEONG, HAE], [GAP, JA], [BYEONG, MI]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.WONJIN);

      expect(hits.some((h) => h.referenceBranch === HAE)).toBe(true);
      expect(hits.some((h) => h.referenceBranch === MI)).toBe(true);
    });

    it('noWonjinWhenNoMatchingPairPresent', () => {
      const ps = pillars([GAP, IN], [BYEONG, JA], [GAP, IN], [BYEONG, SUL]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.WONJIN);

      expect(hits).toHaveLength(0);
    });
  });

  // ================================================================
  // B-Grade: 문창귀인 (文昌貴人)
  // ================================================================

  describe('Munchang', () => {
    it('gapDayMasterWithSaPresent', () => {
      const ps = pillars([GAP, SA], [BYEONG, IN], [GAP, JA], [BYEONG, O]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.MUNCHANG);

      expect(hits.some((h) => h.referenceBranch === SA && h.position === PillarPosition.YEAR)).toBe(true);
    });

    it('noMunchangWhenTargetAbsent', () => {
      const ps = pillars([GAP, JA], [BYEONG, IN], [GAP, JA], [BYEONG, O]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.MUNCHANG);

      expect(hits).toHaveLength(0);
    });
  });

  // ================================================================
  // B-Grade: 양인 (羊刃)
  // ================================================================

  describe('Yangin', () => {
    it('gapDayMasterWithMyoPresent', () => {
      const ps = pillars([GAP, MYO], [BYEONG, IN], [GAP, JA], [BYEONG, O]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.YANGIN);

      expect(hits.some((h) => h.referenceBranch === MYO && h.position === PillarPosition.YEAR)).toBe(true);
    });

    it('gyeongDayMasterWithYuPresent', () => {
      const ps = pillars([GAP, JA], [BYEONG, YU], [GYEONG, JIN], [BYEONG, IN]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.YANGIN);

      expect(hits.some((h) => h.referenceBranch === YU)).toBe(true);
    });

    it('multipleYanginHitsWhenTargetInMultiplePillars', () => {
      const ps = pillars([GAP, MYO], [BYEONG, IN], [GAP, JA], [EUL, MYO]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.YANGIN);

      expect(hits).toHaveLength(2);
      expect(hits.some((h) => h.position === PillarPosition.YEAR)).toBe(true);
      expect(hits.some((h) => h.position === PillarPosition.HOUR)).toBe(true);
    });
  });

  // ================================================================
  // B-Grade: 괴강 (魁罡)
  // ================================================================

  describe('Goegang', () => {
    it('gyeongJinDayPillarIsGoegang', () => {
      const ps = pillars([GAP, JA], [BYEONG, IN], [GYEONG, JIN], [BYEONG, O]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.GOEGANG);

      expect(hits).toHaveLength(1);
      expect(hits[0]!.position).toBe(PillarPosition.DAY);
      expect(hits[0]!.referenceBranch).toBe(JIN);
    });

    it('imJinDayPillarIsGoegang', () => {
      const ps = pillars([GAP, JA], [BYEONG, IN], [IM, JIN], [BYEONG, O]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.GOEGANG);

      expect(hits).toHaveLength(1);
      expect(hits[0]!.referenceBranch).toBe(JIN);
    });

    it('gyeongSulDayPillarIsGoegang', () => {
      const ps = pillars([GAP, JA], [BYEONG, IN], [GYEONG, SUL], [BYEONG, O]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.GOEGANG);

      expect(hits).toHaveLength(1);
      expect(hits[0]!.referenceBranch).toBe(SUL);
    });

    it('imSulDayPillarIsGoegang', () => {
      const ps = pillars([GAP, JA], [BYEONG, IN], [IM, SUL], [BYEONG, O]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.GOEGANG);

      expect(hits).toHaveLength(1);
      expect(hits[0]!.referenceBranch).toBe(SUL);
    });

    it('nonGoegangDayPillarProducesNoHit', () => {
      const ps = pillars([GAP, JA], [BYEONG, IN], [GAP, JA], [BYEONG, O]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.GOEGANG);

      expect(hits).toHaveLength(0);
    });

    it('goegangOnlyCheckedOnDayPillar', () => {
      const ps = pillars([GYEONG, JIN], [BYEONG, IN], [GAP, JA], [BYEONG, O]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.GOEGANG);

      expect(hits).toHaveLength(0);
    });
  });

  // ================================================================
  // C-Grade: 백호 (白虎)
  // ================================================================

  describe('Baekho', () => {
    it('gapDayMasterWithJinPresent', () => {
      const ps = pillars([GAP, JIN], [BYEONG, IN], [GAP, JA], [BYEONG, O]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.BAEKHO);

      expect(hits.some((h) => h.referenceBranch === JIN)).toBe(true);
    });
  });

  // ================================================================
  // C-Grade: 홍염 (紅艶)
  // ================================================================

  describe('Hongyeom', () => {
    it('gapDayMasterWithOPresent', () => {
      const ps = pillars([GAP, JA], [BYEONG, O], [GAP, JA], [BYEONG, IN]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.HONGYEOM);

      expect(hits.some((h) => h.referenceBranch === O)).toBe(true);
    });
  });

  // ================================================================
  // B-Grade: 학당귀인 (學堂貴人)
  // ================================================================

  describe('Hakdang', () => {
    it('gapDayMasterWithHaePresent', () => {
      const ps = pillars([GAP, HAE], [BYEONG, IN], [GAP, JA], [BYEONG, O]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.HAKDANG);

      expect(hits.some((h) => h.referenceBranch === HAE)).toBe(true);
    });

    it('muDayMasterFollowsFireRule', () => {
      const ps = pillars([GAP, IN], [BYEONG, JA], [MU, O], [BYEONG, SUL]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.HAKDANG);

      expect(hits.some((h) => h.referenceBranch === IN)).toBe(true);
    });

    it('noHakdangWhenTargetAbsent', () => {
      const ps = pillars([GAP, JA], [BYEONG, IN], [GAP, MYO], [BYEONG, O]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.HAKDANG);

      expect(hits).toHaveLength(0);
    });
  });

  // ================================================================
  // B-Grade: 금여 (金輿)
  // ================================================================

  describe('Geumyeo', () => {
    it('gapDayMasterWithJinPresent', () => {
      const ps = pillars([GAP, JIN], [BYEONG, IN], [GAP, JA], [BYEONG, O]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.GEUMYEO);

      expect(hits.some((h) => h.referenceBranch === JIN)).toBe(true);
    });

    it('imDayMasterWithChukPresent', () => {
      const ps = pillars([GAP, CHUK], [BYEONG, IN], [IM, JA], [BYEONG, O]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.GEUMYEO);

      expect(hits.some((h) => h.referenceBranch === CHUK)).toBe(true);
    });

    it('noGeumyeoWhenTargetAbsent', () => {
      const ps = pillars([GAP, JA], [BYEONG, IN], [GAP, MYO], [BYEONG, O]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.GEUMYEO);

      expect(hits).toHaveLength(0);
    });
  });

  // ================================================================
  // B-Grade: 겁살 (劫殺)
  // ================================================================

  describe('Geopsal', () => {
    it('inOSulGroupWithSaPresent', () => {
      const ps = pillars([GAP, SA], [BYEONG, JA], [GAP, IN], [BYEONG, SUL]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.GEOPSAL);

      expect(hits.some((h) => h.referenceBranch === SA)).toBe(true);
    });

    it('sinJaJinGroupWithHaePresent', () => {
      const ps = pillars([GAP, HAE], [BYEONG, JA], [GAP, JIN], [BYEONG, SUL]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.GEOPSAL);

      expect(hits.some((h) => h.referenceBranch === HAE)).toBe(true);
    });

    it('haeMvoMiGroupWithSinPresent', () => {
      const ps = pillars([GAP, SIN], [BYEONG, JA], [EUL, MYO], [BYEONG, SUL]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.GEOPSAL);

      expect(hits.some((h) => h.referenceBranch === SIN)).toBe(true);
    });
  });

  // ================================================================
  // B-Grade: 고신살 (孤辰殺), 과숙살 (寡宿殺)
  // ================================================================

  describe('GosinGwasuk', () => {
    it('yearInMyoJinGroupGosinIsSa', () => {
      const ps = pillars([GAP, IN], [BYEONG, SA], [GAP, JA], [BYEONG, O]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.GOSIN);

      expect(hits.some((h) => h.referenceBranch === SA && h.position === PillarPosition.MONTH)).toBe(true);
    });

    it('yearInMyoJinGroupGwasukIsChuk', () => {
      const ps = pillars([EUL, MYO], [BYEONG, CHUK], [GAP, JA], [BYEONG, O]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.GWASUK);

      expect(hits.some((h) => h.referenceBranch === CHUK)).toBe(true);
    });

    it('yearSaOMiGroupGosinIsSin', () => {
      const ps = pillars([GAP, O], [BYEONG, SIN], [GAP, JA], [BYEONG, IN]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.GOSIN);

      expect(hits.some((h) => h.referenceBranch === SIN)).toBe(true);
    });

    it('yearHaeJaChukGroupGosinIsIn', () => {
      const ps = pillars([GAP, JA], [BYEONG, IN], [GAP, O], [BYEONG, SUL]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.GOSIN);

      expect(hits.some((h) => h.referenceBranch === IN)).toBe(true);
    });

    it('yearSinYuSulGroupGwasukIsMi', () => {
      const ps = pillars([GAP, YU], [BYEONG, MI], [GAP, JA], [BYEONG, IN]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.GWASUK);

      expect(hits.some((h) => h.referenceBranch === MI)).toBe(true);
    });
  });

  // ================================================================
  // C-Grade: 암록 (暗祿)
  // ================================================================

  describe('Amnok', () => {
    it('gapDayMasterWithSinPresent', () => {
      const ps = pillars([GAP, SIN], [BYEONG, IN], [GAP, JA], [BYEONG, O]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.AMNOK);

      expect(hits.some((h) => h.referenceBranch === SIN && h.position === PillarPosition.YEAR)).toBe(true);
    });

    it('byeongDayMasterWithHaePresent', () => {
      const ps = pillars([GAP, HAE], [BYEONG, IN], [BYEONG, IN], [BYEONG, O]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.AMNOK);

      expect(hits.some((h) => h.referenceBranch === HAE)).toBe(true);
    });

    it('gyeongDayMasterWithInPresent', () => {
      const ps = pillars([GAP, IN], [BYEONG, JA], [GYEONG, JIN], [BYEONG, O]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.AMNOK);

      expect(hits.some((h) => h.referenceBranch === IN)).toBe(true);
    });

    it('noAmnokWhenTargetAbsent', () => {
      const ps = pillars([GAP, JA], [BYEONG, IN], [GAP, MYO], [BYEONG, O]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.AMNOK);

      expect(hits).toHaveLength(0);
    });
  });

  // ================================================================
  // C-Grade: 천의성 (天醫星)
  // ================================================================

  describe('Cheonui', () => {
    it('monthInTargetsChuk', () => {
      const ps = pillars([GAP, CHUK], [BYEONG, IN], [GAP, JA], [BYEONG, O]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.CHEONUI);

      expect(hits.some((h) => h.referenceBranch === CHUK && h.position === PillarPosition.YEAR)).toBe(true);
    });

    it('monthJaTargetsHae (wrap-around)', () => {
      const ps = pillars([GAP, HAE], [BYEONG, JA], [GAP, IN], [BYEONG, O]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.CHEONUI);

      expect(hits.some((h) => h.referenceBranch === HAE)).toBe(true);
    });

    it('monthOTargetsSa', () => {
      const ps = pillars([GAP, SA], [BYEONG, O], [GAP, IN], [BYEONG, JA]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.CHEONUI);

      expect(hits.some((h) => h.referenceBranch === SA)).toBe(true);
    });

    it('noCheonuiWhenTargetAbsent', () => {
      const ps = pillars([GAP, JA], [BYEONG, IN], [GAP, MYO], [BYEONG, O]);
      const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.CHEONUI);

      expect(hits).toHaveLength(0);
    });
  });

  // ================================================================
  // Grade filtering
  // ================================================================

  describe('GradeFiltering', () => {
    it('aGradeOnlyReturnsOnlyAGradeShinsals', () => {
      const ps = pillars([GAP, CHUK], [BYEONG, MYO], [GAP, JA], [BYEONG, JIN]);
      const aGradeHits = ShinsalDetector.detect(ps, ShinsalGrade.A);

      expect(aGradeHits.every((h) => SHINSAL_TYPE_INFO[h.type].grade === ShinsalGrade.A)).toBe(true);
      expect(aGradeHits.some((h) => h.type === ShinsalType.CHEONUL_GWIIN)).toBe(true);
    });

    it('bGradeOnlyExcludesAAndCGrade', () => {
      const ps = pillars([GAP, CHUK], [BYEONG, MYO], [GAP, JA], [BYEONG, JIN]);
      const bGradeHits = ShinsalDetector.detect(ps, ShinsalGrade.B);

      expect(bGradeHits.every((h) => SHINSAL_TYPE_INFO[h.type].grade === ShinsalGrade.B)).toBe(true);
      expect(bGradeHits.some((h) => h.type === ShinsalType.YANGIN)).toBe(true);
    });

    it('cGradeOnlyExcludesAAndBGrade', () => {
      const ps = pillars([GAP, CHUK], [BYEONG, MYO], [GAP, JA], [BYEONG, JIN]);
      const cGradeHits = ShinsalDetector.detect(ps, ShinsalGrade.C);

      expect(cGradeHits.every((h) => SHINSAL_TYPE_INFO[h.type].grade === ShinsalGrade.C)).toBe(true);
      expect(cGradeHits.some((h) => h.type === ShinsalType.BAEKHO)).toBe(true);
    });

    it('nullGradeReturnsAllGrades', () => {
      const ps = pillars([GAP, CHUK], [BYEONG, MYO], [GAP, IN], [BYEONG, JIN]);
      const allHits = ShinsalDetector.detect(ps, null);
      const grades = new Set(allHits.map((h) => SHINSAL_TYPE_INFO[h.type].grade));

      expect(grades.has(ShinsalGrade.A)).toBe(true);
      expect(grades.has(ShinsalGrade.B)).toBe(true);
      expect(grades.has(ShinsalGrade.C)).toBe(true);
    });
  });

  // ================================================================
  // No false positives
  // ================================================================

  describe('NoFalsePositives', () => {
    it('noShinsalWhenNothingMatches (A/B grade empty, only JISAL in C)', () => {
      // All pillars = MU/SA
      const ps = new PillarSet(
        p(MU, SA), p(MU, SA), p(MU, SA), p(MU, SA),
      );

      const aGradeHits = ShinsalDetector.detect(ps, ShinsalGrade.A);
      expect(aGradeHits).toHaveLength(0);

      const bGradeHits = ShinsalDetector.detect(ps, ShinsalGrade.B);
      expect(bGradeHits).toHaveLength(0);

      // C-grade: only JISAL should trigger (SA = 사유축 생지)
      const allHits = ShinsalDetector.detectAll(ps);
      const nonJisalHits = allHits.filter((h) => h.type !== ShinsalType.JISAL);
      expect(nonJisalHits).toHaveLength(0);
      expect(allHits.every((h) => h.type === ShinsalType.JISAL)).toBe(true);
    });

    it('detectAllEqualsDetectWithNullGrade', () => {
      const ps = pillars([GAP, CHUK], [BYEONG, MYO], [GYEONG, JIN], [BYEONG, O]);
      const allHits = ShinsalDetector.detectAll(ps);
      const nullGradeHits = ShinsalDetector.detect(ps, null);

      expect(allHits).toEqual(nullGradeHits);
    });
  });

  // ================================================================
  // Multiple shinsals on same pillar
  // ================================================================

  describe('MultipleShinsal', () => {
    it('sameBranchCanTriggerMultipleShinsalTypes', () => {
      // GAP day, IN day branch (인오술 group). MYO in month: 양인(갑->묘) + 도화(인오술->묘)
      const ps = pillars([GAP, JA], [BYEONG, MYO], [GAP, IN], [BYEONG, O]);
      const hits = ShinsalDetector.detectAll(ps);
      const monthHits = hits.filter((h) => h.position === PillarPosition.MONTH);

      expect(monthHits.some((h) => h.type === ShinsalType.YANGIN)).toBe(true);
      expect(monthHits.some((h) => h.type === ShinsalType.DOHWA)).toBe(true);
    });
  });

  // ================================================================
  // 삼합 group coverage
  // ================================================================

  describe('SamhapGroupCoverage', () => {
    it('allFourGroupsYeokmaTargetsAreCorrect', () => {
      const cases: Array<{ dayBranch: Jiji; expectedYeokma: Jiji }> = [
        { dayBranch: IN, expectedYeokma: SIN },
        { dayBranch: O, expectedYeokma: SIN },
        { dayBranch: SUL, expectedYeokma: SIN },
        { dayBranch: SA, expectedYeokma: HAE },
        { dayBranch: YU, expectedYeokma: HAE },
        { dayBranch: CHUK, expectedYeokma: HAE },
        { dayBranch: SIN, expectedYeokma: IN },
        { dayBranch: JA, expectedYeokma: IN },
        { dayBranch: JIN, expectedYeokma: IN },
        { dayBranch: HAE, expectedYeokma: SA },
        { dayBranch: MYO, expectedYeokma: SA },
        { dayBranch: MI, expectedYeokma: SA },
      ];

      for (const { dayBranch, expectedYeokma } of cases) {
        const ps = new PillarSet(
          p(GAP, expectedYeokma),
          p(BYEONG, JA),
          p(GAP, dayBranch),
          p(BYEONG, JA),
        );

        const hits = ShinsalDetector.detectAll(ps).filter((h) => h.type === ShinsalType.YEOKMA);
        expect(
          hits.some((h) => h.referenceBranch === expectedYeokma),
          `Day branch ${dayBranch}: expected 역마 at ${expectedYeokma}`,
        ).toBe(true);
      }
    });
  });

  // ================================================================
  // ShinsalWeightCalculator
  // ================================================================

  describe('ShinsalWeightCalculator', () => {
    it('weight applies base weight and position multiplier', () => {
      const hit: ShinsalHit = {
        type: ShinsalType.CHEONUL_GWIIN,
        position: PillarPosition.DAY,
        referenceBranch: CHUK,
        note: 'test',
      };

      const weighted = ShinsalWeightCalculator.weight(hit);

      expect(weighted.baseWeight).toBe(95);
      expect(weighted.positionMultiplier).toBe(1.0);
      expect(weighted.weightedScore).toBe(95);
    });

    it('month position multiplier = 0.85', () => {
      const hit: ShinsalHit = {
        type: ShinsalType.CHEONUL_GWIIN,
        position: PillarPosition.MONTH,
        referenceBranch: CHUK,
        note: 'test',
      };

      const weighted = ShinsalWeightCalculator.weight(hit);
      expect(weighted.positionMultiplier).toBe(0.85);
      expect(weighted.weightedScore).toBe(Math.round(95 * 0.85));
    });

    it('year position multiplier = 0.7', () => {
      const hit: ShinsalHit = {
        type: ShinsalType.YEOKMA,
        position: PillarPosition.YEAR,
        referenceBranch: SIN,
        note: 'test',
      };

      const weighted = ShinsalWeightCalculator.weight(hit);
      expect(weighted.positionMultiplier).toBe(0.7);
      expect(weighted.weightedScore).toBe(Math.round(85 * 0.7));
    });

    it('hour position multiplier = 0.6', () => {
      const hit: ShinsalHit = {
        type: ShinsalType.DOHWA,
        position: PillarPosition.HOUR,
        referenceBranch: MYO,
        note: 'test',
      };

      const weighted = ShinsalWeightCalculator.weight(hit);
      expect(weighted.positionMultiplier).toBe(0.6);
      expect(weighted.weightedScore).toBe(Math.round(80 * 0.6));
    });

    it('weightAll sorts by descending weightedScore', () => {
      const hits: ShinsalHit[] = [
        { type: ShinsalType.GYEOKGAK, position: PillarPosition.HOUR, referenceBranch: JA, note: 'low' },
        { type: ShinsalType.CHEONUL_GWIIN, position: PillarPosition.DAY, referenceBranch: CHUK, note: 'high' },
        { type: ShinsalType.DOHWA, position: PillarPosition.MONTH, referenceBranch: MYO, note: 'mid' },
      ];

      const weighted = ShinsalWeightCalculator.weightAll(hits);
      expect(weighted[0]!.hit.type).toBe(ShinsalType.CHEONUL_GWIIN);
      expect(weighted[weighted.length - 1]!.hit.type).toBe(ShinsalType.GYEOKGAK);

      for (let i = 1; i < weighted.length; i++) {
        expect(weighted[i - 1]!.weightedScore).toBeGreaterThanOrEqual(weighted[i]!.weightedScore);
      }
    });

    it('every ShinsalType has a base weight', () => {
      for (const type of Object.values(ShinsalType)) {
        const weight = ShinsalWeightCalculator.baseWeightFor(type);
        expect(weight).toBeGreaterThan(0);
        expect(weight).toBeLessThanOrEqual(100);
      }
    });
  });
});
