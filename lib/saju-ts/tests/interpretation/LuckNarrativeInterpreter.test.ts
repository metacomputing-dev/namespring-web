import { describe, it, expect } from 'vitest';
import { Cheongan, CHEONGAN_INFO } from '../../src/domain/Cheongan.js';
import { type DaeunPillar } from '../../src/domain/DaeunInfo.js';
import { Jiji, JIJI_INFO } from '../../src/domain/Jiji.js';
import { type DaeunAnalysis, type LuckPillarAnalysis, LuckQuality } from '../../src/domain/LuckInteraction.js';
import { Ohaeng } from '../../src/domain/Ohaeng.js';
import { Pillar } from '../../src/domain/Pillar.js';
import { SibiUnseong, SIBI_UNSEONG_VALUES } from '../../src/domain/SibiUnseong.js';
import { Sipseong, SIPSEONG_VALUES } from '../../src/domain/Sipseong.js';
import {
  SIPSEONG_UN_THEMES,
  UNSEONG_ENERGY_THEMES,
  buildYongshinExplanation,
  buildRelationImpacts,
  buildTransitionWarning,
  buildWhySummary,
  buildPracticalGuidance,
  buildCombinedInterpretation,
  findCurrentDaeun,
  interpretDaeun,
} from '../../src/interpretation/LuckNarrativeInterpreter.js';

function makeLpa(overrides: Partial<LuckPillarAnalysis> = {}): LuckPillarAnalysis {
  return {
    pillar: new Pillar(Cheongan.GAP, Jiji.JA),
    sipseong: Sipseong.BI_GYEON,
    sibiUnseong: SibiUnseong.JANG_SAENG,
    isYongshinElement: false,
    isGisinElement: false,
    stemRelations: [],
    branchRelations: [],
    quality: LuckQuality.NEUTRAL,
    summary: '',
    ...overrides,
  };
}

function makeDaeunPillar(overrides: Partial<DaeunPillar> = {}): DaeunPillar {
  return {
    pillar: new Pillar(Cheongan.GAP, Jiji.JA),
    startAge: 10,
    endAge: 19,
    order: 1,
    ...overrides,
  };
}

function makeDaeunAnalysis(overrides: Partial<DaeunAnalysis> = {}): DaeunAnalysis {
  return {
    daeunPillar: makeDaeunPillar(),
    analysis: makeLpa(),
    isTransitionPeriod: false,
    ...overrides,
  };
}

describe('LuckNarrativeInterpreter', () => {

  // ═══════════════════════════════════════════════════════════════
  // Table completeness
  // ═══════════════════════════════════════════════════════════════

  describe('SIPSEONG_UN_THEMES table', () => {
    it('has exactly 10 entries for all sipseong', () => {
      expect(SIPSEONG_UN_THEMES.size).toBe(10);
      for (const ss of SIPSEONG_VALUES) {
        expect(SIPSEONG_UN_THEMES.has(ss)).toBe(true);
        const theme = SIPSEONG_UN_THEMES.get(ss)!;
        expect(theme.themeName).toBeTruthy();
        expect(theme.favorableAspects.length).toBeGreaterThan(0);
        expect(theme.cautionPoints.length).toBeGreaterThan(0);
      }
    });
  });

  describe('UNSEONG_ENERGY_THEMES table', () => {
    it('has exactly 12 entries for all sibiUnseong', () => {
      expect(UNSEONG_ENERGY_THEMES.size).toBe(12);
      for (const su of SIBI_UNSEONG_VALUES) {
        expect(UNSEONG_ENERGY_THEMES.has(su)).toBe(true);
        const theme = UNSEONG_ENERGY_THEMES.get(su)!;
        expect(theme.energyLevel).toBeTruthy();
        expect(theme.description).toBeTruthy();
        expect(theme.actionAdvice).toBeTruthy();
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // buildYongshinExplanation
  // ═══════════════════════════════════════════════════════════════

  describe('buildYongshinExplanation', () => {
    it('returns generic text when yongshin is null', () => {
      const lpa = makeLpa();
      const result = buildYongshinExplanation(lpa, null, null);
      expect(result).toContain('용신이 결정되지 않아');
    });

    it('detects yongshin match', () => {
      const lpa = makeLpa({ isYongshinElement: true });
      const result = buildYongshinExplanation(lpa, Ohaeng.WATER, null);
      expect(result).toContain('용신');
      expect(result).toContain('긍정적');
    });

    it('detects gisin match', () => {
      const lpa = makeLpa({ isGisinElement: true });
      const result = buildYongshinExplanation(lpa, Ohaeng.FIRE, Ohaeng.WATER);
      expect(result).toContain('기신');
      expect(result).toContain('부정적');
    });

    it('detects mixed yongshin + gisin', () => {
      const lpa = makeLpa({ isYongshinElement: true, isGisinElement: true });
      const result = buildYongshinExplanation(lpa, Ohaeng.WATER, Ohaeng.FIRE);
      expect(result).toContain('혼재');
    });

    it('returns neutral when neither matches', () => {
      const lpa = makeLpa();
      const result = buildYongshinExplanation(lpa, Ohaeng.FIRE, Ohaeng.METAL);
      expect(result).toContain('직접적 관련은 없으나');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // buildRelationImpacts
  // ═══════════════════════════════════════════════════════════════

  describe('buildRelationImpacts', () => {
    it('returns empty for no relations', () => {
      const lpa = makeLpa();
      expect(buildRelationImpacts(lpa)).toHaveLength(0);
    });

    it('detects stem 합 and 충', () => {
      const lpa = makeLpa({
        stemRelations: ['갑기합', '갑경충'],
      });
      const impacts = buildRelationImpacts(lpa);
      expect(impacts.length).toBe(2);
      expect(impacts[0]).toContain('천간');
      expect(impacts[0]).toContain('협력');
      expect(impacts[1]).toContain('천간');
      expect(impacts[1]).toContain('변화');
    });

    it('detects branch relations', () => {
      const lpa = makeLpa({
        branchRelations: ['자오충', '인해합', '인사형', '자묘파', '축오해'],
      });
      const impacts = buildRelationImpacts(lpa);
      expect(impacts.length).toBe(5);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // buildTransitionWarning
  // ═══════════════════════════════════════════════════════════════

  describe('buildTransitionWarning', () => {
    it('returns empty string when not transition period', () => {
      const da = makeDaeunAnalysis({ isTransitionPeriod: false });
      expect(buildTransitionWarning(da)).toBe('');
    });

    it('returns warning with age when transition period', () => {
      const da = makeDaeunAnalysis({
        isTransitionPeriod: true,
        daeunPillar: makeDaeunPillar({ startAge: 30 }),
      });
      const warning = buildTransitionWarning(da);
      expect(warning).toContain('30세');
      expect(warning).toContain('교운기');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // buildWhySummary
  // ═══════════════════════════════════════════════════════════════

  describe('buildWhySummary', () => {
    it('includes pillar label and quality description', () => {
      const lpa = makeLpa({ quality: LuckQuality.VERY_FAVORABLE });
      const theme = SIPSEONG_UN_THEMES.get(Sipseong.BI_GYEON)!;
      const energy = UNSEONG_ENERGY_THEMES.get(SibiUnseong.JANG_SAENG)!;
      const summary = buildWhySummary(lpa, theme, energy, '용신 설명', false);
      expect(summary).toContain('갑자');
      expect(summary).toContain('매우 좋은');
    });

    it('mentions transition when applicable', () => {
      const lpa = makeLpa();
      const theme = SIPSEONG_UN_THEMES.get(Sipseong.BI_GYEON)!;
      const energy = UNSEONG_ENERGY_THEMES.get(SibiUnseong.JANG_SAENG)!;
      const summary = buildWhySummary(lpa, theme, energy, '', true);
      expect(summary).toContain('교운기');
    });

    it('lists relation impacts when present', () => {
      const lpa = makeLpa({ stemRelations: ['갑기합'] });
      const theme = SIPSEONG_UN_THEMES.get(Sipseong.BI_GYEON)!;
      const energy = UNSEONG_ENERGY_THEMES.get(SibiUnseong.JANG_SAENG)!;
      const summary = buildWhySummary(lpa, theme, energy, '', false);
      expect(summary).toContain('갑기합');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // buildPracticalGuidance
  // ═══════════════════════════════════════════════════════════════

  describe('buildPracticalGuidance', () => {
    it('includes action advice from energy theme', () => {
      const lpa = makeLpa({ quality: LuckQuality.NEUTRAL });
      const theme = SIPSEONG_UN_THEMES.get(Sipseong.BI_GYEON)!;
      const energy = UNSEONG_ENERGY_THEMES.get(SibiUnseong.JANG_SAENG)!;
      const guidance = buildPracticalGuidance(lpa, theme, energy);
      expect(guidance).toContain('[행동 조언]');
    });

    it('lists favorable aspects for good quality', () => {
      const lpa = makeLpa({ quality: LuckQuality.FAVORABLE });
      const theme = SIPSEONG_UN_THEMES.get(Sipseong.BI_GYEON)!;
      const energy = UNSEONG_ENERGY_THEMES.get(SibiUnseong.JANG_SAENG)!;
      const guidance = buildPracticalGuidance(lpa, theme, energy);
      expect(guidance).toContain('적극 활용');
    });

    it('lists caution points for bad quality', () => {
      const lpa = makeLpa({ quality: LuckQuality.UNFAVORABLE });
      const theme = SIPSEONG_UN_THEMES.get(Sipseong.BI_GYEON)!;
      const energy = UNSEONG_ENERGY_THEMES.get(SibiUnseong.JANG_SAENG)!;
      const guidance = buildPracticalGuidance(lpa, theme, energy);
      expect(guidance).toContain('유의');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // buildCombinedInterpretation
  // ═══════════════════════════════════════════════════════════════

  describe('buildCombinedInterpretation', () => {
    it('returns independent interpretation when no current daeun', () => {
      const lpa = makeLpa();
      const theme = SIPSEONG_UN_THEMES.get(Sipseong.BI_GYEON)!;
      const result = buildCombinedInterpretation(lpa, null, theme, null, null);
      expect(result).toContain('독립적으로 작용');
    });

    it('combines daeun + saeun interpretation', () => {
      const lpa = makeLpa({
        pillar: new Pillar(Cheongan.BYEONG, Jiji.O), // 화
      });
      const daeun = makeDaeunPillar({
        pillar: new Pillar(Cheongan.GAP, Jiji.IN), // 목
      });
      const theme = SIPSEONG_UN_THEMES.get(Sipseong.BI_GYEON)!;
      const result = buildCombinedInterpretation(lpa, daeun, theme, null, null);
      expect(result).toContain('대운');
      expect(result).toContain('세운');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // findCurrentDaeun
  // ═══════════════════════════════════════════════════════════════

  describe('findCurrentDaeun', () => {
    it('finds correct daeun for given year', () => {
      const daeunInfo = {
        isForward: true,
        firstDaeunStartAge: 3,
        daeunPillars: [
          makeDaeunPillar({ startAge: 3, endAge: 12, order: 1 }),
          makeDaeunPillar({ startAge: 13, endAge: 22, order: 2 }),
          makeDaeunPillar({ startAge: 23, endAge: 32, order: 3 }),
        ],
        boundaryMode: 'EXACT_TABLE' as const,
        warnings: [],
        firstDaeunStartMonths: 0,
      };

      // Birth year 1990, year 2000 -> Korean age = 11
      const result = findCurrentDaeun(daeunInfo, 2000, 1990);
      expect(result).not.toBeNull();
      expect(result!.order).toBe(1);

      // Birth year 1990, year 2010 -> Korean age = 21
      const result2 = findCurrentDaeun(daeunInfo, 2010, 1990);
      expect(result2).not.toBeNull();
      expect(result2!.order).toBe(2);
    });

    it('returns null when no daeun matches', () => {
      const daeunInfo = {
        isForward: true,
        firstDaeunStartAge: 3,
        daeunPillars: [
          makeDaeunPillar({ startAge: 3, endAge: 12, order: 1 }),
        ],
        boundaryMode: 'EXACT_TABLE' as const,
        warnings: [],
        firstDaeunStartMonths: 0,
      };
      // Korean age = 1, no daeun starts at 1
      const result = findCurrentDaeun(daeunInfo, 1990, 1990);
      expect(result).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // interpretDaeun
  // ═══════════════════════════════════════════════════════════════

  describe('interpretDaeun', () => {
    it('produces a complete DaeunNarrative', () => {
      const da = makeDaeunAnalysis({
        analysis: makeLpa({
          sipseong: Sipseong.JEONG_GWAN,
          sibiUnseong: SibiUnseong.JE_WANG,
          quality: LuckQuality.FAVORABLE,
          isYongshinElement: true,
        }),
      });

      const narrative = interpretDaeun(da, Cheongan.GAP, Ohaeng.WATER, Ohaeng.FIRE);

      expect(narrative.quality).toBe(LuckQuality.FAVORABLE);
      expect(narrative.sipseongTheme.themeName).toBe('승진·명예운');
      expect(narrative.energyTheme.energyLevel).toBe('최고조');
      expect(narrative.yongshinExplanation).toContain('용신');
      expect(narrative.whySummary).toBeTruthy();
      expect(narrative.practicalGuidance).toContain('[행동 조언]');
    });

    it('includes transition warning when applicable', () => {
      const da = makeDaeunAnalysis({ isTransitionPeriod: true });
      const narrative = interpretDaeun(da, Cheongan.GAP, null, null);
      expect(narrative.transitionWarning).toContain('교운기');
    });

    it('has empty transition warning when not transition', () => {
      const da = makeDaeunAnalysis({ isTransitionPeriod: false });
      const narrative = interpretDaeun(da, Cheongan.GAP, null, null);
      expect(narrative.transitionWarning).toBe('');
    });
  });
});
