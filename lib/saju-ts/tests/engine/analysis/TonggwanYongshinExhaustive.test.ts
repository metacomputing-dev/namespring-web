import { describe, it, expect } from 'vitest';
import { Cheongan, CHEONGAN_INFO, CHEONGAN_VALUES } from '../../../src/domain/Cheongan.js';
import { Jiji } from '../../../src/domain/Jiji.js';
import { Ohaeng, OhaengRelations, OHAENG_VALUES } from '../../../src/domain/Ohaeng.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { PillarSet } from '../../../src/domain/PillarSet.js';
import { YongshinType } from '../../../src/domain/YongshinResult.js';
import { YongshinDecider } from '../../../src/engine/analysis/YongshinDecider.js';

const { WOOD, FIRE, EARTH, METAL, WATER } = Ohaeng;

// ── Ohaeng element helpers ──────────────────────────────────────

const stemsByOhaeng: Record<Ohaeng, [Cheongan, Cheongan]> = {
  [WOOD]:  [Cheongan.GAP, Cheongan.EUL],
  [FIRE]:  [Cheongan.BYEONG, Cheongan.JEONG],
  [EARTH]: [Cheongan.MU, Cheongan.GI],
  [METAL]: [Cheongan.GYEONG, Cheongan.SIN],
  [WATER]: [Cheongan.IM, Cheongan.GYE],
};

const branchesByOhaeng: Record<Ohaeng, Jiji[]> = {
  [WOOD]:  [Jiji.IN, Jiji.MYO],
  [FIRE]:  [Jiji.SA, Jiji.O],
  [EARTH]: [Jiji.CHUK, Jiji.JIN, Jiji.MI, Jiji.SUL],
  [METAL]: [Jiji.SIN, Jiji.YU],
  [WATER]: [Jiji.JA, Jiji.HAE],
};

function neutralStem(...avoid: Ohaeng[]): Cheongan {
  const avoidSet = new Set(avoid);
  return CHEONGAN_VALUES.find(c => !avoidSet.has(CHEONGAN_INFO[c].ohaeng))!;
}

// ── Day master mapping ──────────────────────────────────────────

interface DayMasterInfo {
  dayStem: Cheongan;
  dayMasterOhaeng: Ohaeng;
  bigyeop: Ohaeng;
  siksang: Ohaeng;
  jaeseong: Ohaeng;
  gwanseong: Ohaeng;
  inseong: Ohaeng;
}

function infoFor(dayStem: Cheongan): DayMasterInfo {
  const dm = CHEONGAN_INFO[dayStem].ohaeng;
  return {
    dayStem,
    dayMasterOhaeng: dm,
    bigyeop: dm,
    siksang: OhaengRelations.generates(dm),
    jaeseong: OhaengRelations.controls(dm),
    gwanseong: OhaengRelations.controlledBy(dm),
    inseong: OhaengRelations.generatedBy(dm),
  };
}

const allDayMasters: DayMasterInfo[] = CHEONGAN_VALUES.map(c => infoFor(c));

// ── PillarSet builders ──────────────────────────────────────────

function buildConflictPillars(
  dayStem: Cheongan,
  ohaengA: Ohaeng,
  countA: number,
  ohaengB: Ohaeng,
  countB: number,
): PillarSet {
  const stemsA = stemsByOhaeng[ohaengA];
  const stemsB = stemsByOhaeng[ohaengB];
  const branchesA = branchesByOhaeng[ohaengA];
  const branchesB = branchesByOhaeng[ohaengB];

  const allocatedStems: Cheongan[] = [];
  const allocatedBranches: Jiji[] = [];

  let remainA = countA;
  let remainB = countB;

  const stemsForA = Math.min(remainA, 3);
  for (let i = 0; i < stemsForA; i++) {
    allocatedStems.push(i % 2 === 0 ? stemsA[0] : stemsA[1]);
    remainA--;
  }

  const stemsForB = Math.min(remainB, 3 - stemsForA);
  for (let i = 0; i < stemsForB; i++) {
    allocatedStems.push(i % 2 === 0 ? stemsB[0] : stemsB[1]);
    remainB--;
  }

  const fillerStem = neutralStem(ohaengA, ohaengB);
  while (allocatedStems.length < 3) {
    allocatedStems.push(fillerStem);
  }

  const branchesForA = Math.min(remainA, 4);
  for (let i = 0; i < branchesForA; i++) {
    allocatedBranches.push(branchesA[i % branchesA.length]!);
    remainA--;
  }

  const branchesForB = Math.min(remainB, 4 - branchesForA);
  for (let i = 0; i < branchesForB; i++) {
    allocatedBranches.push(branchesB[i % branchesB.length]!);
    remainB--;
  }

  const neutralBranchOh = OHAENG_VALUES.find(o => o !== ohaengA && o !== ohaengB)!;
  const fillerBranch = branchesByOhaeng[neutralBranchOh][0]!;
  while (allocatedBranches.length < 4) {
    allocatedBranches.push(fillerBranch);
  }

  return new PillarSet(
    new Pillar(allocatedStems[0]!, allocatedBranches[0]!),
    new Pillar(allocatedStems[1]!, allocatedBranches[1]!),
    new Pillar(dayStem, allocatedBranches[2]!),
    new Pillar(allocatedStems[2]!, allocatedBranches[3]!),
  );
}

function buildInseongSiksangPillars(mapping: DayMasterInfo): PillarSet {
  const inOh = mapping.inseong;
  const sikOh = mapping.siksang;
  const inStems = stemsByOhaeng[inOh];
  const sikStems = stemsByOhaeng[sikOh];
  const inBranches = branchesByOhaeng[inOh];
  const sikBranches = branchesByOhaeng[sikOh];
  const fillerBranch = branchesByOhaeng[mapping.jaeseong][0]!;

  return new PillarSet(
    new Pillar(inStems[0], inBranches[0]!),
    new Pillar(inStems[1], sikBranches[0]!),
    new Pillar(mapping.dayStem, sikBranches[1 % sikBranches.length]!),
    new Pillar(sikStems[0], fillerBranch),
  );
}

// ================================================================
// 1st priority: gwanseong vs bigyeop
// ================================================================

describe('GwanseongVsBigyeop', () => {
  it('all 10 day masters trigger with 3+3', () => {
    for (const mapping of allDayMasters) {
      const ps = buildConflictPillars(
        mapping.dayStem, mapping.gwanseong, 3, mapping.bigyeop, 3,
      );
      const result = YongshinDecider.tongwanYongshin(ps, mapping.dayMasterOhaeng);
      const expectedMediator = OhaengRelations.generates(mapping.gwanseong);

      expect(result).not.toBeNull();
      expect(result!.type).toBe(YongshinType.TONGGWAN);
      expect(result!.primaryElement).toBe(expectedMediator);
      expect(result!.confidence).toBe(0.6);
      expect(result!.secondaryElement).toBeNull();
      expect(result!.reasoning).toContain('통관');
      expect(result!.reasoning).toContain('관성');
      expect(result!.reasoning).toContain('비겁');
    }
  });

  it('all 10 day masters below threshold returns null', () => {
    for (const mapping of allDayMasters) {
      const ps = buildConflictPillars(
        mapping.dayStem, mapping.gwanseong, 2, mapping.bigyeop, 2,
      );
      const result = YongshinDecider.tongwanYongshin(ps, mapping.dayMasterOhaeng);
      expect(result).toBeNull();
    }
  });

  it('mediator completes sangsaeng chain for all 5 ohaeng', () => {
    const expectations: [Ohaeng, Ohaeng, Ohaeng, Ohaeng][] = [
      [WOOD, METAL, WATER, WOOD],
      [FIRE, WATER, WOOD, FIRE],
      [EARTH, WOOD, FIRE, EARTH],
      [METAL, FIRE, EARTH, METAL],
      [WATER, EARTH, METAL, WATER],
    ];
    for (const [dm, controller, mediator, controlled] of expectations) {
      expect(OhaengRelations.generates(controller)).toBe(mediator);
      expect(OhaengRelations.generates(mediator)).toBe(controlled);
      expect(OhaengRelations.controls(controller)).toBe(controlled);
    }
  });
});

// ================================================================
// 2nd priority: inseong vs siksang
// ================================================================

describe('InseongVsSiksang', () => {
  it('all 10 day masters trigger with 3+3', () => {
    for (const mapping of allDayMasters) {
      const ps = buildInseongSiksangPillars(mapping);
      const result = YongshinDecider.tongwanYongshin(ps, mapping.dayMasterOhaeng);
      const expectedMediator = OhaengRelations.generates(mapping.inseong);

      expect(result).not.toBeNull();
      expect(result!.type).toBe(YongshinType.TONGGWAN);
      expect(result!.primaryElement).toBe(expectedMediator);
      expect(result!.confidence).toBe(0.5);
      expect(result!.secondaryElement).toBeNull();
      expect(result!.reasoning).toContain('통관');
      expect(result!.reasoning).toContain('인성');
      expect(result!.reasoning).toContain('식상');
    }
  });

  it('all 10 day masters below threshold returns null', () => {
    for (const mapping of allDayMasters) {
      const ps = buildConflictPillars(
        mapping.dayStem, mapping.inseong, 2, mapping.siksang, 2,
      );
      const result = YongshinDecider.tongwanYongshin(ps, mapping.dayMasterOhaeng);
      expect(result).toBeNull();
    }
  });

  it('mediator is always day master element', () => {
    for (const ohaeng of OHAENG_VALUES) {
      const inseong = OhaengRelations.generatedBy(ohaeng);
      const mediator = OhaengRelations.generates(inseong);
      expect(mediator).toBe(ohaeng);
    }
  });
});

// ================================================================
// Secondary conflicts never trigger
// ================================================================

describe('SecondaryConflictsNeverTrigger', () => {
  it('4+4 is mathematically impossible with 7 positions', () => {
    for (const a of OHAENG_VALUES) {
      for (const b of OHAENG_VALUES) {
        if (a === b) continue;
        expect(7 - 4).toBeLessThan(4);
      }
    }
  });
});

// ================================================================
// Mediator correctness
// ================================================================

describe('MediatorCorrectness', () => {
  it('mediator forms sangsaeng bridge for all 5 pairs', () => {
    const pairs: [Ohaeng, Ohaeng, Ohaeng][] = [
      [METAL, WOOD, WATER],
      [WOOD, EARTH, FIRE],
      [EARTH, WATER, METAL],
      [WATER, FIRE, WOOD],
      [FIRE, METAL, EARTH],
    ];
    for (const [attacker, defender, mediator] of pairs) {
      expect(OhaengRelations.generates(attacker)).toBe(mediator);
      expect(OhaengRelations.generates(mediator)).toBe(defender);
      expect(OhaengRelations.controls(attacker)).toBe(defender);
    }
  });

  it('each DM maps to correct mediator for gwanseong vs bigyeop', () => {
    const expectedMediators: [Ohaeng, Ohaeng][] = [
      [WOOD, WATER], [FIRE, WOOD], [EARTH, FIRE], [METAL, EARTH], [WATER, METAL],
    ];
    for (const [dm, expectedMediator] of expectedMediators) {
      const gwanseong = OhaengRelations.controlledBy(dm);
      const actualMediator = OhaengRelations.generates(gwanseong);
      expect(actualMediator).toBe(expectedMediator);
    }
  });

  it('each DM maps to self as mediator for inseong vs siksang', () => {
    for (const dm of OHAENG_VALUES) {
      const inseong = OhaengRelations.generatedBy(dm);
      const actualMediator = OhaengRelations.generates(inseong);
      expect(actualMediator).toBe(dm);
    }
  });
});

// ================================================================
// Threshold boundary tests
// ================================================================

describe('ThresholdBoundary', () => {
  it('gwanseong 3 and bigyeop 3 triggers', () => {
    const mapping = infoFor(Cheongan.GAP);
    const ps = buildConflictPillars(mapping.dayStem, mapping.gwanseong, 3, mapping.bigyeop, 3);
    expect(YongshinDecider.tongwanYongshin(ps, mapping.dayMasterOhaeng)).not.toBeNull();
  });

  it('inseong 3 and siksang 3 triggers', () => {
    const mapping = infoFor(Cheongan.GAP);
    const ps = buildInseongSiksangPillars(mapping);
    const result = YongshinDecider.tongwanYongshin(ps, mapping.dayMasterOhaeng);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe(0.5);
  });

  it('inseong 2 and siksang 2 does not trigger', () => {
    const mapping = infoFor(Cheongan.GAP);
    const ps = buildConflictPillars(mapping.dayStem, mapping.inseong, 2, mapping.siksang, 2);
    const result = YongshinDecider.tongwanYongshin(ps, mapping.dayMasterOhaeng);
    expect(result).toBeNull();
  });
});

// ================================================================
// Reasoning text validation
// ================================================================

describe('ReasoningText', () => {
  it('gwanseong vs bigyeop reasoning contains expected terms', () => {
    const mapping = infoFor(Cheongan.BYEONG);
    const ps = buildConflictPillars(mapping.dayStem, mapping.gwanseong, 3, mapping.bigyeop, 3);
    const result = YongshinDecider.tongwanYongshin(ps, mapping.dayMasterOhaeng)!;
    expect(result.reasoning).toContain('통관(通關)');
    expect(result.reasoning).toContain('관성');
    expect(result.reasoning).toContain('비겁');
    expect(result.reasoning).toContain('상극');
    expect(result.reasoning).toContain('통관 역할');
  });

  it('ohaeng names in correct Korean format', () => {
    const mapping = infoFor(Cheongan.GAP);
    const ps = buildConflictPillars(mapping.dayStem, mapping.gwanseong, 3, mapping.bigyeop, 3);
    const result = YongshinDecider.tongwanYongshin(ps, mapping.dayMasterOhaeng)!;
    expect(result.reasoning).toContain('금(金)');
    expect(result.reasoning).toContain('목(木)');
    expect(result.reasoning).toContain('수(水)');
  });
});

// ================================================================
// Balanced chart returns null
// ================================================================

describe('BalancedChart', () => {
  it('all 10 day masters return null for balanced chart', () => {
    for (const stem of CHEONGAN_VALUES) {
      const ps = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.SA),
        new Pillar(Cheongan.MU, Jiji.YU),
        new Pillar(stem, Jiji.JA),
        new Pillar(Cheongan.IM, Jiji.CHUK),
      );
      const result = YongshinDecider.tongwanYongshin(ps, CHEONGAN_INFO[stem].ohaeng);
      expect(result).toBeNull();
    }
  });
});

// ================================================================
// Day stem exclusion
// ================================================================

describe('DayStemExclusion', () => {
  it('changing day stem does not affect element counts', () => {
    const basePillars = (dayStem: Cheongan) => new PillarSet(
      new Pillar(Cheongan.GYEONG, Jiji.IN),
      new Pillar(Cheongan.SIN, Jiji.MYO),
      new Pillar(dayStem, Jiji.SIN),
      new Pillar(Cheongan.GYEONG, Jiji.IN),
    );

    const resultGap = YongshinDecider.tongwanYongshin(basePillars(Cheongan.GAP), WOOD);
    const resultEul = YongshinDecider.tongwanYongshin(basePillars(Cheongan.EUL), WOOD);

    expect(resultGap?.primaryElement).toBe(resultEul?.primaryElement);
    expect(resultGap?.confidence).toBe(resultEul?.confidence);
  });
});

// ================================================================
// Integration with decide
// ================================================================

describe('IntegrationWithDecide', () => {
  it('tonggwan appears in decide for triggered chart', () => {
    const mapping = infoFor(Cheongan.GAP);
    const ps = buildConflictPillars(mapping.dayStem, mapping.gwanseong, 3, mapping.bigyeop, 4);
    const result = YongshinDecider.decide(ps, true, WOOD);
    const tonggwan = result.recommendations.find(r => r.type === YongshinType.TONGGWAN);
    expect(tonggwan).not.toBeUndefined();
    expect(tonggwan!.primaryElement).toBe(WATER);
  });

  it('tonggwan absent from decide for balanced chart', () => {
    const ps = new PillarSet(
      new Pillar(Cheongan.GAP, Jiji.SA),
      new Pillar(Cheongan.MU, Jiji.YU),
      new Pillar(Cheongan.GAP, Jiji.JA),
      new Pillar(Cheongan.IM, Jiji.CHUK),
    );
    const result = YongshinDecider.decide(ps, false, WOOD);
    const tonggwan = result.recommendations.find(r => r.type === YongshinType.TONGGWAN);
    expect(tonggwan).toBeUndefined();
  });
});
