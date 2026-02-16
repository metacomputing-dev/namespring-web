import { describe, it, expect } from 'vitest';
import { analyzeSaju } from '../../../src/engine/SajuAnalysisPipeline.js';
import { CompatibilityInterpreter } from '../../../src/interpretation/CompatibilityInterpreter.js';
import {
  CompatibilityGrade,
} from '../../../src/domain/Compatibility.js';
import { Cheongan, CHEONGAN_VALUES, CHEONGAN_INFO } from '../../../src/domain/Cheongan.js';
import { Jiji, JIJI_VALUES, JIJI_INFO } from '../../../src/domain/Jiji.js';
import { Ohaeng, OhaengRelations } from '../../../src/domain/Ohaeng.js';
import { GanjiCycle } from '../../../src/engine/GanjiCycle.js';
import { createBirthInput } from '../../../src/domain/types.js';
import { Gender } from '../../../src/domain/Gender.js';
import type { SajuAnalysis } from '../../../src/domain/SajuAnalysis.js';

/**
 * Exhaustive 10x10 Cheongan compatibility matrix test (7th audit G-03).
 *
 * Verifies that CompatibilityInterpreter.analyze produces correct
 * day-master scores and relation types for ALL 100 Cheongan pair
 * combinations. Each pair is classified into exactly one of 7 relation
 * categories:
 *
 * | Priority | Relation             | Score | Korean label           |
 * |----------|----------------------|-------|------------------------|
 * | 1        | cheongan hap         |  95   | 천간합(天干合)          |
 * | 2        | same stem (diagonal) |  60   | 동일 오행(同一五行)     |
 * | 3        | same element         |  55   | 동일 오행(同一五行)     |
 * | 4        | generating           |  80   | 상생(相生)             |
 * | 5        | cheongan clash       |  30   | 천간충(天干沖)          |
 * | 6        | control              |  45   | 상극(相剋)             |
 * | 7        | neutral (unreachable)|  65   | 중립(中立)             |
 */
describe('CompatibilityExhaustiveMatrix', () => {

  // =========================================================================
  // Pre-computation: map each Cheongan to a SajuAnalysis
  // =========================================================================

  /**
   * For each of the 10 Cheongan values, find a date in mid-2024 whose day
   * pillar has that stem, then create and cache a SajuAnalysis.
   */
  const stemToAnalysis = new Map<Cheongan, SajuAnalysis>();
  const foundStems = new Set<Cheongan>();
  const baseYear = 2024, baseMonth = 6, baseDay = 15;

  for (let offset = 0; offset < 10; offset++) {
    const dayPillar = GanjiCycle.dayPillarByJdn(baseYear, baseMonth, baseDay + offset);
    const stem = dayPillar.cheongan;
    if (!foundStems.has(stem)) {
      foundStems.add(stem);
      const input = createBirthInput({
        birthYear: baseYear, birthMonth: baseMonth, birthDay: baseDay + offset,
        birthHour: 12, birthMinute: 0,
        gender: Gender.MALE,
        longitude: 126.978,
      });
      stemToAnalysis.set(stem, analyzeSaju(input));
    }
  }

  function analysisFor(stem: Cheongan): SajuAnalysis {
    const a = stemToAnalysis.get(stem);
    if (!a) throw new Error(`No analysis found for stem ${stem}`);
    return a;
  }

  // =========================================================================
  // Expected relation oracle
  // =========================================================================

  const HAP_PAIRS = new Map<Cheongan, Cheongan>([
    [Cheongan.GAP, Cheongan.GI], [Cheongan.GI, Cheongan.GAP],
    [Cheongan.EUL, Cheongan.GYEONG], [Cheongan.GYEONG, Cheongan.EUL],
    [Cheongan.BYEONG, Cheongan.SIN], [Cheongan.SIN, Cheongan.BYEONG],
    [Cheongan.JEONG, Cheongan.IM], [Cheongan.IM, Cheongan.JEONG],
    [Cheongan.MU, Cheongan.GYE], [Cheongan.GYE, Cheongan.MU],
  ]);

  const CHUNG_MAP = new Map<Cheongan, Cheongan>([
    [Cheongan.GAP, Cheongan.GYEONG], [Cheongan.GYEONG, Cheongan.GAP],
    [Cheongan.EUL, Cheongan.SIN], [Cheongan.SIN, Cheongan.EUL],
    [Cheongan.BYEONG, Cheongan.IM], [Cheongan.IM, Cheongan.BYEONG],
    [Cheongan.JEONG, Cheongan.GYE], [Cheongan.GYE, Cheongan.JEONG],
  ]);

  function expectedRelation(dm1: Cheongan, dm2: Cheongan): [string, number] {
    const isHap = HAP_PAIRS.get(dm1) === dm2;
    const isChung = CHUNG_MAP.get(dm1) === dm2;
    const isSameElement = CHEONGAN_INFO[dm1].ohaeng === CHEONGAN_INFO[dm2].ohaeng;
    const generates1to2 = OhaengRelations.generates(CHEONGAN_INFO[dm1].ohaeng) === CHEONGAN_INFO[dm2].ohaeng;
    const generates2to1 = OhaengRelations.generates(CHEONGAN_INFO[dm2].ohaeng) === CHEONGAN_INFO[dm1].ohaeng;
    const isGenerating = generates1to2 || generates2to1;
    const controls1to2 = OhaengRelations.controls(CHEONGAN_INFO[dm1].ohaeng) === CHEONGAN_INFO[dm2].ohaeng;
    const controls2to1 = OhaengRelations.controls(CHEONGAN_INFO[dm2].ohaeng) === CHEONGAN_INFO[dm1].ohaeng;

    if (isHap) return ['천간합(天干合)', 95];
    if (isSameElement && dm1 === dm2) return ['동일 오행(同一五行)', 60];
    if (isSameElement) return ['동일 오행(同一五行)', 55];
    if (isGenerating) return ['상생(相生)', 80];
    if (isChung) return ['천간충(天干沖)', 30];
    if (controls1to2 || controls2to1) return ['상극(相剋)', 45];
    return ['중립(中立)', 65];
  }

  // =========================================================================
  // 1. Full 10x10 day master matrix
  // =========================================================================

  describe('DayMasterMatrix', () => {
    it('all 10 stems are cached', () => {
      expect(stemToAnalysis.size).toBe(10);
      for (const stem of CHEONGAN_VALUES) {
        expect(stemToAnalysis.has(stem), `Missing stem ${stem}`).toBe(true);
      }
    });

    for (const stem1 of CHEONGAN_VALUES) {
      for (const stem2 of CHEONGAN_VALUES) {
        const label1 = `${CHEONGAN_INFO[stem1].hangul}(${CHEONGAN_INFO[stem1].hanja})`;
        const label2 = `${CHEONGAN_INFO[stem2].hangul}(${CHEONGAN_INFO[stem2].hanja})`;

        it(`[${label1}]-[${label2}] score matches expected`, () => {
          const result = CompatibilityInterpreter.analyze(analysisFor(stem1), analysisFor(stem2));
          const [, expectedScore] = expectedRelation(stem1, stem2);
          expect(result.dayMaster.score).toBe(expectedScore);
        });

        it(`[${label1}]-[${label2}] relation type matches expected`, () => {
          const result = CompatibilityInterpreter.analyze(analysisFor(stem1), analysisFor(stem2));
          const [expectedType] = expectedRelation(stem1, stem2);
          expect(result.dayMaster.relationType).toBe(expectedType);
        });

        it(`[${label1}]-[${label2}] interpretation non-blank`, () => {
          const result = CompatibilityInterpreter.analyze(analysisFor(stem1), analysisFor(stem2));
          expect(result.dayMaster.interpretation.length).toBeGreaterThan(0);
        });
      }
    }
  });

  // =========================================================================
  // 2. Score and relation type symmetry
  // =========================================================================

  describe('SymmetryTests', () => {
    for (let i = 0; i < CHEONGAN_VALUES.length; i++) {
      for (let j = i; j < CHEONGAN_VALUES.length; j++) {
        const s1 = CHEONGAN_VALUES[i]!;
        const s2 = CHEONGAN_VALUES[j]!;
        const label = `${CHEONGAN_INFO[s1].hangul}-${CHEONGAN_INFO[s2].hangul}`;

        it(`[${label}] day master score is symmetric`, () => {
          const forward = CompatibilityInterpreter.analyze(analysisFor(s1), analysisFor(s2));
          const reverse = CompatibilityInterpreter.analyze(analysisFor(s2), analysisFor(s1));
          expect(forward.dayMaster.score).toBe(reverse.dayMaster.score);
        });

        it(`[${label}] day master relation type is symmetric`, () => {
          const forward = CompatibilityInterpreter.analyze(analysisFor(s1), analysisFor(s2));
          const reverse = CompatibilityInterpreter.analyze(analysisFor(s2), analysisFor(s1));
          expect(forward.dayMaster.relationType).toBe(reverse.dayMaster.relationType);
        });

        it(`[${label}] day branch score is symmetric`, () => {
          const forward = CompatibilityInterpreter.analyze(analysisFor(s1), analysisFor(s2));
          const reverse = CompatibilityInterpreter.analyze(analysisFor(s2), analysisFor(s1));
          expect(forward.dayBranch.score).toBe(reverse.dayBranch.score);
        });

        it(`[${label}] day branch relation type is symmetric`, () => {
          const forward = CompatibilityInterpreter.analyze(analysisFor(s1), analysisFor(s2));
          const reverse = CompatibilityInterpreter.analyze(analysisFor(s2), analysisFor(s1));
          expect(forward.dayBranch.relationType).toBe(reverse.dayBranch.relationType);
        });
      }
    }
  });

  // =========================================================================
  // 3. Total score bounds and grade consistency for all 100 pairs
  // =========================================================================

  describe('ScoreBoundsAndGrade', () => {
    for (const stem1 of CHEONGAN_VALUES) {
      for (const stem2 of CHEONGAN_VALUES) {
        const l1 = CHEONGAN_INFO[stem1].hangul;
        const l2 = CHEONGAN_INFO[stem2].hangul;

        it(`[${l1}-${l2}] total score in 0..100`, () => {
          const result = CompatibilityInterpreter.analyze(analysisFor(stem1), analysisFor(stem2));
          expect(result.totalScore).toBeGreaterThanOrEqual(0);
          expect(result.totalScore).toBeLessThanOrEqual(100);
        });

        it(`[${l1}-${l2}] grade matches score thresholds`, () => {
          const result = CompatibilityInterpreter.analyze(analysisFor(stem1), analysisFor(stem2));
          let expectedGrade: CompatibilityGrade;
          if (result.totalScore >= 85) expectedGrade = CompatibilityGrade.EXCELLENT;
          else if (result.totalScore >= 70) expectedGrade = CompatibilityGrade.GOOD;
          else if (result.totalScore >= 55) expectedGrade = CompatibilityGrade.AVERAGE;
          else if (result.totalScore >= 40) expectedGrade = CompatibilityGrade.BELOW_AVERAGE;
          else expectedGrade = CompatibilityGrade.POOR;
          expect(result.grade).toBe(expectedGrade);
        });

        it(`[${l1}-${l2}] total score equals weighted average`, () => {
          const result = CompatibilityInterpreter.analyze(analysisFor(stem1), analysisFor(stem2));
          const expected = Math.floor((
            result.dayMaster.score * 25 +
            result.dayBranch.score * 25 +
            result.ohaengComplement.score * 20 +
            result.sipseongCross.score * 20 +
            result.shinsalMatch.score * 10
          ) / 100);
          expect(result.totalScore).toBe(expected);
        });

        it(`[${l1}-${l2}] all 5 axis scores in valid range`, () => {
          const result = CompatibilityInterpreter.analyze(analysisFor(stem1), analysisFor(stem2));
          expect(result.dayMaster.score).toBeGreaterThanOrEqual(0);
          expect(result.dayMaster.score).toBeLessThanOrEqual(100);
          expect(result.dayBranch.score).toBeGreaterThanOrEqual(0);
          expect(result.dayBranch.score).toBeLessThanOrEqual(100);
          expect(result.ohaengComplement.score).toBeGreaterThanOrEqual(0);
          expect(result.ohaengComplement.score).toBeLessThanOrEqual(100);
          expect(result.sipseongCross.score).toBeGreaterThanOrEqual(0);
          expect(result.sipseongCross.score).toBeLessThanOrEqual(100);
          expect(result.shinsalMatch.score).toBeGreaterThanOrEqual(0);
          expect(result.shinsalMatch.score).toBeLessThanOrEqual(100);
        });
      }
    }
  });

  // =========================================================================
  // 4. Day branch relation verification (known pairs)
  // =========================================================================

  describe('DayBranchMatrix', () => {
    // Build branch analysis cache
    const branchToAnalysis = new Map<Jiji, SajuAnalysis>();
    const branchFoundSet = new Set<Jiji>();
    for (let offset = 0; offset < 12; offset++) {
      const dayPillar = GanjiCycle.dayPillarByJdn(baseYear, baseMonth, baseDay + offset);
      const branch = dayPillar.jiji;
      if (!branchFoundSet.has(branch)) {
        branchFoundSet.add(branch);
        const input = createBirthInput({
          birthYear: baseYear, birthMonth: baseMonth, birthDay: baseDay + offset,
          birthHour: 12, birthMinute: 0,
          gender: Gender.MALE,
          longitude: 126.978,
        });
        branchToAnalysis.set(branch, analyzeSaju(input));
      }
    }

    function branchAnalysis(branch: Jiji): SajuAnalysis {
      const a = branchToAnalysis.get(branch);
      if (!a) throw new Error(`No analysis found for branch ${branch}`);
      return a;
    }

    // Yukhap 6 pairs (score=90)
    const yukHapPairs: [Jiji, Jiji][] = [
      [Jiji.JA, Jiji.CHUK], [Jiji.IN, Jiji.HAE],
      [Jiji.MYO, Jiji.SUL], [Jiji.JIN, Jiji.YU],
      [Jiji.SA, Jiji.SIN], [Jiji.O, Jiji.MI],
    ];

    // Chung 6 pairs (score=25)
    const chungPairs: [Jiji, Jiji][] = [
      [Jiji.JA, Jiji.O], [Jiji.CHUK, Jiji.MI],
      [Jiji.IN, Jiji.SIN], [Jiji.MYO, Jiji.YU],
      [Jiji.JIN, Jiji.SUL], [Jiji.SA, Jiji.HAE],
    ];

    function isPairIn(b1: Jiji, b2: Jiji, pairs: [Jiji, Jiji][]): boolean {
      return pairs.some(([a, b]) => (a === b1 && b === b2) || (a === b2 && b === b1));
    }

    const branchRelationCases: [string, Jiji, Jiji, string, number][] = [];

    // Add yukhap cases
    for (const [b1, b2] of yukHapPairs) {
      if (branchToAnalysis.has(b1) && branchToAnalysis.has(b2)) {
        branchRelationCases.push([
          `${JIJI_INFO[b1].hangul}${JIJI_INFO[b2].hangul} 육합`,
          b1, b2, '육합(六合)', 90,
        ]);
      }
    }

    // Add chung cases
    for (const [b1, b2] of chungPairs) {
      if (branchToAnalysis.has(b1) && branchToAnalysis.has(b2)) {
        branchRelationCases.push([
          `${JIJI_INFO[b1].hangul}${JIJI_INFO[b2].hangul} 충`,
          b1, b2, '충(沖)', 25,
        ]);
      }
    }

    for (const [label, b1, b2, expectedRel, expectedScore] of branchRelationCases) {
      it(`[${label}] day branch relation and score match`, () => {
        const result = CompatibilityInterpreter.analyze(branchAnalysis(b1), branchAnalysis(b2));
        expect(result.dayBranch.relationType).toBe(expectedRel);
        expect(result.dayBranch.score).toBe(expectedScore);
      });

      it(`[${label}] day branch interpretation non-blank`, () => {
        const result = CompatibilityInterpreter.analyze(branchAnalysis(b1), branchAnalysis(b2));
        expect(result.dayBranch.interpretation.length).toBeGreaterThan(0);
      });
    }
  });

  // =========================================================================
  // 5. Relation coverage verification
  // =========================================================================

  describe('RelationCoverage', () => {
    it('all 5 reachable day master relation types appear', () => {
      const observedRelations = new Set<string>();
      const observedScores = new Set<number>();

      for (const s1 of CHEONGAN_VALUES) {
        for (const s2 of CHEONGAN_VALUES) {
          const result = CompatibilityInterpreter.analyze(analysisFor(s1), analysisFor(s2));
          observedRelations.add(result.dayMaster.relationType);
          observedScores.add(result.dayMaster.score);
        }
      }

      const expectedRelations = [
        '천간합(天干合)',
        '동일 오행(同一五行)',
        '상생(相生)',
        '천간충(天干沖)',
        '상극(相剋)',
      ];

      for (const rel of expectedRelations) {
        expect(observedRelations.has(rel), `Expected relation '${rel}' to appear`).toBe(true);
      }

      const expectedScores = [95, 60, 55, 80, 30, 45];
      for (const score of expectedScores) {
        expect(observedScores.has(score), `Expected score ${score} to appear`).toBe(true);
      }
    });

    it('exactly 10 hap pairs exist in the 100-pair matrix', () => {
      let hapCount = 0;
      for (const s1 of CHEONGAN_VALUES) {
        for (const s2 of CHEONGAN_VALUES) {
          const result = CompatibilityInterpreter.analyze(analysisFor(s1), analysisFor(s2));
          if (result.dayMaster.relationType === '천간합(天干合)') hapCount++;
        }
      }
      expect(hapCount).toBe(10);
    });

    it('exactly 8 chung pairs exist in the 100-pair matrix', () => {
      let chungCount = 0;
      for (const s1 of CHEONGAN_VALUES) {
        for (const s2 of CHEONGAN_VALUES) {
          const result = CompatibilityInterpreter.analyze(analysisFor(s1), analysisFor(s2));
          if (result.dayMaster.relationType === '천간충(天干沖)') chungCount++;
        }
      }
      expect(chungCount).toBe(8);
    });

    it('exactly 10 diagonal (same-stem) pairs score 60', () => {
      let count = 0;
      for (const stem of CHEONGAN_VALUES) {
        const result = CompatibilityInterpreter.analyze(analysisFor(stem), analysisFor(stem));
        if (result.dayMaster.score === 60) count++;
      }
      expect(count).toBe(10);
    });

    it('exactly 10 same-element-different-stem pairs score 55', () => {
      let count = 0;
      for (const s1 of CHEONGAN_VALUES) {
        for (const s2 of CHEONGAN_VALUES) {
          const result = CompatibilityInterpreter.analyze(analysisFor(s1), analysisFor(s2));
          if (result.dayMaster.score === 55) count++;
        }
      }
      expect(count).toBe(10);
    });

    it('score distribution matches mathematical expectation', () => {
      const scoreCounts = new Map<number, number>();
      for (const s1 of CHEONGAN_VALUES) {
        for (const s2 of CHEONGAN_VALUES) {
          const result = CompatibilityInterpreter.analyze(analysisFor(s1), analysisFor(s2));
          const score = result.dayMaster.score;
          scoreCounts.set(score, (scoreCounts.get(score) ?? 0) + 1);
        }
      }

      expect(scoreCounts.get(95) ?? 0).toBe(10);  // hap
      expect(scoreCounts.get(60) ?? 0).toBe(10);  // same-stem
      expect(scoreCounts.get(55) ?? 0).toBe(10);  // same-element
      expect(scoreCounts.get(80) ?? 0).toBe(40);  // generating
      expect(scoreCounts.get(30) ?? 0).toBe(8);   // clash
      expect(scoreCounts.get(45) ?? 0).toBe(22);  // control
      expect(scoreCounts.get(65) ?? 0).toBe(0);   // neutral (unreachable)

      let total = 0;
      for (const c of scoreCounts.values()) total += c;
      expect(total).toBe(100);
    });
  });

  // =========================================================================
  // 6. Mathematical property tests
  // =========================================================================

  describe('MathematicalProperties', () => {
    it('no stem pair is classified as neutral', () => {
      for (const s1 of CHEONGAN_VALUES) {
        for (const s2 of CHEONGAN_VALUES) {
          const result = CompatibilityInterpreter.analyze(analysisFor(s1), analysisFor(s2));
          expect(
            result.dayMaster.relationType,
            `${CHEONGAN_INFO[s1].hangul}-${CHEONGAN_INFO[s2].hangul} should not be neutral`,
          ).not.toBe('중립(中立)');
        }
      }
    });

    it('hap pairs span 5 distinct element pair combinations', () => {
      const hapPairs: [Cheongan, Cheongan][] = [
        [Cheongan.GAP, Cheongan.GI],
        [Cheongan.EUL, Cheongan.GYEONG],
        [Cheongan.BYEONG, Cheongan.SIN],
        [Cheongan.JEONG, Cheongan.IM],
        [Cheongan.MU, Cheongan.GYE],
      ];

      const elementPairs = new Set<string>();
      for (const [a, b] of hapPairs) {
        const e1 = CHEONGAN_INFO[a].ohaeng;
        const e2 = CHEONGAN_INFO[b].ohaeng;
        expect(e1).not.toBe(e2); // hap pairs involve different elements
        const key = [e1, e2].sort().join('-');
        elementPairs.add(key);
      }
      expect(elementPairs.size).toBe(5);
    });

    it('chung pairs are always same yin-yang, different element', () => {
      const chungPairs: [Cheongan, Cheongan][] = [
        [Cheongan.GAP, Cheongan.GYEONG],
        [Cheongan.EUL, Cheongan.SIN],
        [Cheongan.BYEONG, Cheongan.IM],
        [Cheongan.JEONG, Cheongan.GYE],
      ];

      for (const [a, b] of chungPairs) {
        expect(CHEONGAN_INFO[a].eumyang).toBe(CHEONGAN_INFO[b].eumyang);
        expect(CHEONGAN_INFO[a].ohaeng).not.toBe(CHEONGAN_INFO[b].ohaeng);
        const isControl = OhaengRelations.controls(CHEONGAN_INFO[a].ohaeng) === CHEONGAN_INFO[b].ohaeng ||
                          OhaengRelations.controls(CHEONGAN_INFO[b].ohaeng) === CHEONGAN_INFO[a].ohaeng;
        expect(isControl).toBe(true);
      }
    });

    it('generating relation count matches 5-element cycle theory (40)', () => {
      let count = 0;
      for (const s1 of CHEONGAN_VALUES) {
        for (const s2 of CHEONGAN_VALUES) {
          const result = CompatibilityInterpreter.analyze(analysisFor(s1), analysisFor(s2));
          if (result.dayMaster.score === 80) count++;
        }
      }
      expect(count).toBe(40);
    });

    it('control relation count matches theory (22)', () => {
      let count = 0;
      for (const s1 of CHEONGAN_VALUES) {
        for (const s2 of CHEONGAN_VALUES) {
          const result = CompatibilityInterpreter.analyze(analysisFor(s1), analysisFor(s2));
          if (result.dayMaster.score === 45) count++;
        }
      }
      expect(count).toBe(22);
    });
  });

  // =========================================================================
  // 7. Sipseong cross-reference consistency
  // =========================================================================

  describe('SipseongCrossTests', () => {
    it('sipseong cross is symmetric under partner swap', () => {
      for (const s1 of CHEONGAN_VALUES) {
        for (const s2 of CHEONGAN_VALUES) {
          const forward = CompatibilityInterpreter.analyze(analysisFor(s1), analysisFor(s2));
          const reverse = CompatibilityInterpreter.analyze(analysisFor(s2), analysisFor(s1));

          expect(forward.sipseongCross.person2ToPerson1).toBe(reverse.sipseongCross.person1ToPerson2);
          expect(forward.sipseongCross.person1ToPerson2).toBe(reverse.sipseongCross.person2ToPerson1);
        }
      }
    });

    it('sipseong score is in 0..100 for all 100 pairs', () => {
      for (const s1 of CHEONGAN_VALUES) {
        for (const s2 of CHEONGAN_VALUES) {
          const result = CompatibilityInterpreter.analyze(analysisFor(s1), analysisFor(s2));
          expect(result.sipseongCross.score).toBeGreaterThanOrEqual(0);
          expect(result.sipseongCross.score).toBeLessThanOrEqual(100);
        }
      }
    });
  });

  // =========================================================================
  // 8. Stem mapping verification
  // =========================================================================

  describe('StemMappingVerification', () => {
    it('all 10 cached analyses have distinct day master stems', () => {
      const stems = new Set(stemToAnalysis.keys());
      expect(stems.size).toBe(10);
    });

    it('each cached analysis has the correct day master stem', () => {
      for (const [expectedStem, analysis] of stemToAnalysis) {
        expect(analysis.pillars.day.cheongan).toBe(expectedStem);
      }
    });
  });

  // =========================================================================
  // 9. Shinsal match baseline verification
  // =========================================================================

  describe('ShinsalBaseline', () => {
    it('shinsal match score >= 60 for all 100 pairs', () => {
      for (const s1 of CHEONGAN_VALUES) {
        for (const s2 of CHEONGAN_VALUES) {
          const result = CompatibilityInterpreter.analyze(analysisFor(s1), analysisFor(s2));
          expect(result.shinsalMatch.score).toBeGreaterThanOrEqual(60);
        }
      }
    });
  });

  // =========================================================================
  // 10. Ohaeng complement structural tests
  // =========================================================================

  describe('OhaengComplement', () => {
    it('combined completeness is 1 to 5 for all 100 pairs', () => {
      for (const s1 of CHEONGAN_VALUES) {
        for (const s2 of CHEONGAN_VALUES) {
          const result = CompatibilityInterpreter.analyze(analysisFor(s1), analysisFor(s2));
          expect(result.ohaengComplement.combinedCompleteness).toBeGreaterThanOrEqual(1);
          expect(result.ohaengComplement.combinedCompleteness).toBeLessThanOrEqual(5);
        }
      }
    });

    it('ohaeng complement score is always positive for all 100 pairs', () => {
      for (const s1 of CHEONGAN_VALUES) {
        for (const s2 of CHEONGAN_VALUES) {
          const result = CompatibilityInterpreter.analyze(analysisFor(s1), analysisFor(s2));
          expect(result.ohaengComplement.score).toBeGreaterThan(0);
        }
      }
    });
  });
});
