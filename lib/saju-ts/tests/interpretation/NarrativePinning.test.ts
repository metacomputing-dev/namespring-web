import { describe, it, expect } from 'vitest';
import { analyzeSaju } from '../../src/engine/SajuAnalysisPipeline.js';
import {
  generate,
  narrativeToFullReport,
} from '../../src/interpretation/NarrativeEngine.js';
import {
  configFromPreset,
  SchoolPreset,
} from '../../src/config/CalculationConfig.js';
import { createBirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';
import { Ohaeng } from '../../src/domain/Ohaeng.js';
import { CHEONGAN_INFO } from '../../src/domain/Cheongan.js';
import { STRENGTH_LEVEL_INFO } from '../../src/domain/StrengthResult.js';
import { GYEOKGUK_TYPE_INFO } from '../../src/domain/Gyeokguk.js';
import { Sipseong } from '../../src/domain/Sipseong.js';
import { SibiUnseong } from '../../src/domain/SibiUnseong.js';
import { PillarPosition } from '../../src/domain/PillarPosition.js';
import { LuckQuality, LUCK_QUALITY_INFO } from '../../src/domain/LuckInteraction.js';
import {
  LuckNarrativeInterpreter,
  SIPSEONG_UN_THEMES,
  UNSEONG_ENERGY_THEMES,
} from '../../src/interpretation/LuckNarrativeInterpreter.js';

/**
 * QA-3: Narrative pinning tests -- golden-value assertions that prevent
 * silent regressions in the narrative output.
 *
 * Pins specific domain conclusions (strength level, gyeokguk, yongshin,
 * daeun direction) through to their narrative text rendering.
 */
describe('NarrativePinning', () => {

  const config = configFromPreset(SchoolPreset.KOREAN_MAINSTREAM);

  // ====================================================================
  // Case A: 1986-04-19 05:45 Male Seoul
  // ====================================================================

  const caseA = analyzeSaju(createBirthInput({
    birthYear: 1986, birthMonth: 4, birthDay: 19,
    birthHour: 5, birthMinute: 45,
    gender: Gender.MALE,
    longitude: 126.978,
  }), config);
  const narrativeA = generate(caseA, config);

  function ohaengKoreanName(oh: Ohaeng): string {
    const NAMES: Record<Ohaeng, string> = {
      [Ohaeng.WOOD]: '목(木)',
      [Ohaeng.FIRE]: '화(火)',
      [Ohaeng.EARTH]: '토(土)',
      [Ohaeng.METAL]: '금(金)',
      [Ohaeng.WATER]: '수(水)',
    };
    return NAMES[oh];
  }

  describe('CaseA domain pinning', () => {
    it('day master pillar is pinned in overview', () => {
      const dm = caseA.pillars.day.cheongan;
      const dmInfo = CHEONGAN_INFO[dm];
      expect(dmInfo.hangul.length).toBeGreaterThan(0);
      expect(narrativeA.overview).toContain(dmInfo.hangul);
    });

    it('strength level is pinned in narrative', () => {
      const level = caseA.strengthResult!.level;
      const koreanName = STRENGTH_LEVEL_INFO[level].koreanName;
      expect(narrativeA.coreCharacteristics).toContain(koreanName);
    });

    it('gyeokguk type is pinned in narrative', () => {
      const typeName = GYEOKGUK_TYPE_INFO[caseA.gyeokgukResult!.type].koreanName;
      expect(narrativeA.coreCharacteristics).toContain(typeName);
    });

    it('yongshin ohaeng is pinned in narrative', () => {
      const yr = caseA.yongshinResult!;
      const ohaengName = ohaengKoreanName(yr.finalYongshin);
      expect(narrativeA.yongshinGuidance).toContain(ohaengName);
    });

    it('daeun direction is pinned in narrative', () => {
      const daeun = caseA.daeunInfo!;
      const expectedDirection = daeun.isForward ? '순행(順行)' : '역행(逆行)';
      expect(narrativeA.luckCycleOverview).toContain(expectedDirection);
    });

    it('daeun start age is pinned in narrative', () => {
      const daeun = caseA.daeunInfo!;
      const startAge = daeun.firstDaeunStartAge;
      expect(narrativeA.luckCycleOverview).toContain(`${startAge}세`);
    });

    it('yongshin confidence percentage is pinned in narrative', () => {
      const yr = caseA.yongshinResult!;
      const pctStr = `${Math.round(yr.finalConfidence * 100)}`;
      expect(narrativeA.yongshinGuidance).toContain(`${pctStr}%`);
    });
  });

  describe('CaseA narrative structure pinning', () => {
    it('causal chain has at least 4 steps', () => {
      const assessment = narrativeA.overallAssessment;
      const steps = ['\u2460', '\u2461', '\u2462', '\u2463', '\u2464', '\u2465'];
      const stepCount = steps.filter(s => assessment.includes(s)).length;
      expect(stepCount).toBeGreaterThanOrEqual(4);
    });

    it('causal chain mentions deukryeong score', () => {
      expect(narrativeA.overallAssessment).toContain('득령');
    });

    it('causal chain mentions deukji score', () => {
      expect(narrativeA.overallAssessment).toContain('득지');
    });

    it('causal chain mentions deukse score', () => {
      expect(narrativeA.overallAssessment).toContain('득세');
    });

    it('full report has all major sections', () => {
      const report = narrativeToFullReport(narrativeA);
      const sections = [
        '사주 원국 개요',
        '오행(五行) 분포',
        '핵심 성향 분석',
        '용신(用神) 안내',
        '특수 요소',
        '종합 판단',
        '대운(大運) 흐름',
        '참고 원전',
      ];
      for (const section of sections) {
        expect(report).toContain(section);
      }
    });
  });

  // ====================================================================
  // Case B: 1989-01-10 01:30 Male Seoul
  // ====================================================================

  const caseB = analyzeSaju(createBirthInput({
    birthYear: 1989, birthMonth: 1, birthDay: 10,
    birthHour: 1, birthMinute: 30,
    gender: Gender.MALE,
    longitude: 126.978,
  }), config);
  const narrativeB = generate(caseB, config);

  describe('CaseB domain pinning', () => {
    it('strength level is pinned', () => {
      const level = caseB.strengthResult!.level;
      expect(narrativeB.coreCharacteristics).toContain(STRENGTH_LEVEL_INFO[level].koreanName);
    });

    it('gyeokguk type is pinned', () => {
      const typeName = GYEOKGUK_TYPE_INFO[caseB.gyeokgukResult!.type].koreanName;
      expect(narrativeB.coreCharacteristics).toContain(typeName);
    });

    it('yongshin is pinned', () => {
      const yr = caseB.yongshinResult!;
      const ohaengName = ohaengKoreanName(yr.finalYongshin);
      expect(narrativeB.yongshinGuidance).toContain(ohaengName);
    });

    it('daeun pillar count is at least 8', () => {
      const count = caseB.daeunInfo!.daeunPillars.length;
      expect(count).toBeGreaterThanOrEqual(8);
    });
  });

  // ====================================================================
  // Case C: 1988-06-15 10:00 Female Seoul (DST era)
  // ====================================================================

  const caseC = analyzeSaju(createBirthInput({
    birthYear: 1988, birthMonth: 6, birthDay: 15,
    birthHour: 10, birthMinute: 0,
    gender: Gender.FEMALE,
  }), config);
  const narrativeC = generate(caseC, config);

  describe('CaseC DST era pinning', () => {
    it('daeun direction is pinned', () => {
      const daeun = caseC.daeunInfo!;
      const direction = daeun.isForward ? '순행(順行)' : '역행(逆行)';
      expect(narrativeC.luckCycleOverview).toContain(direction);
    });

    it('narrative mentions correct day master', () => {
      const dm = caseC.pillars.day.cheongan;
      expect(narrativeC.overview).toContain(CHEONGAN_INFO[dm].hangul);
    });

    it('school label is pinned for Korean mainstream', () => {
      expect(narrativeC.schoolLabel).toBe('한국 주류(적천수+궁통보감)');
    });
  });

  // ====================================================================
  // Cross-case: confidence citations
  // ====================================================================

  describe('cross-case confidence pinning', () => {
    it('all cases have sentence-level confidence citations in full report', () => {
      for (const [label, narrative] of [
        ['CaseA', narrativeA],
        ['CaseB', narrativeB],
        ['CaseC', narrativeC],
      ] as const) {
        const report = narrativeToFullReport(narrative);
        const count = [...report.matchAll(/신뢰도 \d+%/g)].length;
        expect(count, `${label} should have >= 5 confidence citations`).toBeGreaterThanOrEqual(5);
      }
    });

    it('all cases have causal chain in overall assessment', () => {
      for (const [label, narrative] of [
        ['CaseA', narrativeA],
        ['CaseB', narrativeB],
        ['CaseC', narrativeC],
      ] as const) {
        expect(narrative.overallAssessment, `${label} should have causal chain`).toContain('논리 체인');
        expect(narrative.overallAssessment, `${label} should have step 1`).toContain('\u2460');
      }
    });

    it('all cases have source bibliography', () => {
      for (const [label, narrative] of [
        ['CaseA', narrativeA],
        ['CaseB', narrativeB],
        ['CaseC', narrativeC],
      ] as const) {
        expect(narrative.sourceBibliography, `${label} should cite 적천수`).toContain('적천수');
        expect(narrative.sourceBibliography, `${label} should cite 궁통보감`).toContain('궁통보감');
      }
    });
  });

  // ====================================================================
  // Luck narrative pinning
  // ====================================================================

  describe('luck narrative content pinning', () => {
    it('detailed luck narrative contains theme keyword (if non-empty)', () => {
      const detailed = narrativeA.detailedLuckNarrative;
      if (detailed.length > 0) {
        expect(detailed).toContain('테마:');
      }
    });

    it('detailed luck narrative contains energy keyword (if non-empty)', () => {
      const detailed = narrativeA.detailedLuckNarrative;
      if (detailed.length > 0) {
        expect(detailed).toContain('에너지:');
      }
    });

    it('detailed luck narrative contains quality assessment (if non-empty)', () => {
      const detailed = narrativeA.detailedLuckNarrative;
      if (detailed.length > 0) {
        const hasQuality = ['대길', '길', '보통', '흉', '대흉'].some(q =>
          detailed.includes(`[${q}]`),
        );
        expect(hasQuality).toBe(true);
      }
    });
  });

  // ====================================================================
  // Sipseong and SibiUnseong theme tables
  // ====================================================================

  describe('sipseong theme table pinning', () => {
    const expected: Record<string, string> = {
      [Sipseong.BI_GYEON]: '자립\u00B7경쟁운',
      [Sipseong.GYEOB_JAE]: '경쟁\u00B7변동운',
      [Sipseong.SIK_SIN]: '표현\u00B7풍요운',
      [Sipseong.SANG_GWAN]: '창의\u00B7반항운',
      [Sipseong.PYEON_JAE]: '투자\u00B7유동운',
      [Sipseong.JEONG_JAE]: '안정\u00B7축적운',
      [Sipseong.PYEON_GWAN]: '도전\u00B7압박운',
      [Sipseong.JEONG_GWAN]: '승진\u00B7명예운',
      [Sipseong.PYEON_IN]: '학문\u00B7변화운',
      [Sipseong.JEONG_IN]: '학업\u00B7보호운',
    };

    for (const [sipseong, expectedTheme] of Object.entries(expected)) {
      it(`${sipseong} maps to theme '${expectedTheme}'`, () => {
        const theme = SIPSEONG_UN_THEMES.get(sipseong as Sipseong);
        expect(theme).toBeDefined();
        expect(theme!.themeName).toBe(expectedTheme);
      });
    }
  });

  describe('sibi unseong energy table pinning', () => {
    const expected: Record<string, string> = {
      [SibiUnseong.JANG_SAENG]: '상승',
      [SibiUnseong.MOK_YOK]: '변동',
      [SibiUnseong.GWAN_DAE]: '성장',
      [SibiUnseong.GEON_ROK]: '왕성',
      [SibiUnseong.JE_WANG]: '최고조',
      [SibiUnseong.SWOE]: '하강',
      [SibiUnseong.BYEONG]: '약화',
      [SibiUnseong.SA]: '정지',
      [SibiUnseong.MYO]: '저장',
      [SibiUnseong.JEOL]: '단절',
      [SibiUnseong.TAE]: '잠재',
      [SibiUnseong.YANG]: '준비',
    };

    for (const [unseong, expectedLevel] of Object.entries(expected)) {
      it(`${unseong} maps to energy '${expectedLevel}'`, () => {
        const theme = UNSEONG_ENERGY_THEMES.get(unseong as SibiUnseong);
        expect(theme).toBeDefined();
        expect(theme!.energyLevel).toBe(expectedLevel);
      });
    }
  });

  describe('sipseong theme fields non-blank', () => {
    for (const [sipseong, theme] of SIPSEONG_UN_THEMES) {
      it(`${sipseong} has non-blank fields`, () => {
        expect(theme.lifeDomain.length).toBeGreaterThan(0);
        expect(theme.favorableAspects.length).toBeGreaterThan(0);
        expect(theme.cautionPoints.length).toBeGreaterThan(0);
        expect(theme.themeDescription.length).toBeGreaterThan(0);
        for (const aspect of theme.favorableAspects) {
          expect(aspect.length).toBeGreaterThan(0);
        }
        for (const point of theme.cautionPoints) {
          expect(point.length).toBeGreaterThan(0);
        }
      });
    }
  });

  describe('energy theme fields non-blank', () => {
    for (const [unseong, theme] of UNSEONG_ENERGY_THEMES) {
      it(`${unseong} has non-blank description and actionAdvice`, () => {
        expect(theme.description.length).toBeGreaterThan(0);
        expect(theme.actionAdvice.length).toBeGreaterThan(0);
      });
    }
  });

  describe('sipseong lifeDomain exact pinning', () => {
    const expected: Record<string, string> = {
      [Sipseong.BI_GYEON]: '인간관계\u00B7독립',
      [Sipseong.GYEOB_JAE]: '재물\u00B7경쟁',
      [Sipseong.SIK_SIN]: '의식주\u00B7재능',
      [Sipseong.SANG_GWAN]: '창의\u00B7언변',
      [Sipseong.PYEON_JAE]: '재물\u00B7사업',
      [Sipseong.JEONG_JAE]: '재물\u00B7가정',
      [Sipseong.PYEON_GWAN]: '직업\u00B7권력',
      [Sipseong.JEONG_GWAN]: '명예\u00B7직업',
      [Sipseong.PYEON_IN]: '학문\u00B7전문성',
      [Sipseong.JEONG_IN]: '학업\u00B7정신성장',
    };

    for (const [sipseong, expectedDomain] of Object.entries(expected)) {
      it(`${sipseong} lifeDomain is '${expectedDomain}'`, () => {
        const theme = SIPSEONG_UN_THEMES.get(sipseong as Sipseong);
        expect(theme!.lifeDomain).toBe(expectedDomain);
      });
    }
  });

  describe('LuckQuality koreanName pinning', () => {
    it('VERY_FAVORABLE is 대길', () => {
      expect(LUCK_QUALITY_INFO[LuckQuality.VERY_FAVORABLE].koreanName).toBe('대길');
    });
    it('FAVORABLE is 길', () => {
      expect(LUCK_QUALITY_INFO[LuckQuality.FAVORABLE].koreanName).toBe('길');
    });
    it('NEUTRAL is 평', () => {
      expect(LUCK_QUALITY_INFO[LuckQuality.NEUTRAL].koreanName).toBe('평');
    });
    it('UNFAVORABLE is 흉', () => {
      expect(LUCK_QUALITY_INFO[LuckQuality.UNFAVORABLE].koreanName).toBe('흉');
    });
    it('VERY_UNFAVORABLE is 대흉', () => {
      expect(LUCK_QUALITY_INFO[LuckQuality.VERY_UNFAVORABLE].koreanName).toBe('대흉');
    });
  });

  describe('table completeness', () => {
    it('SIPSEONG_UN_THEMES covers all 10 Sipseong entries', () => {
      const allSipseong: Sipseong[] = [
        Sipseong.BI_GYEON, Sipseong.GYEOB_JAE,
        Sipseong.SIK_SIN, Sipseong.SANG_GWAN,
        Sipseong.PYEON_JAE, Sipseong.JEONG_JAE,
        Sipseong.PYEON_GWAN, Sipseong.JEONG_GWAN,
        Sipseong.PYEON_IN, Sipseong.JEONG_IN,
      ];
      for (const s of allSipseong) {
        expect(SIPSEONG_UN_THEMES.has(s), `Missing entry for ${s}`).toBe(true);
      }
      expect(SIPSEONG_UN_THEMES.size).toBe(10);
    });

    it('UNSEONG_ENERGY_THEMES covers all 12 SibiUnseong entries', () => {
      const allUnseong: SibiUnseong[] = [
        SibiUnseong.JANG_SAENG, SibiUnseong.MOK_YOK,
        SibiUnseong.GWAN_DAE, SibiUnseong.GEON_ROK,
        SibiUnseong.JE_WANG, SibiUnseong.SWOE,
        SibiUnseong.BYEONG, SibiUnseong.SA,
        SibiUnseong.MYO, SibiUnseong.JEOL,
        SibiUnseong.TAE, SibiUnseong.YANG,
      ];
      for (const u of allUnseong) {
        expect(UNSEONG_ENERGY_THEMES.has(u), `Missing entry for ${u}`).toBe(true);
      }
      expect(UNSEONG_ENERGY_THEMES.size).toBe(12);
    });
  });
});
