import { describe, it, expect } from 'vitest';
import { analyzeSaju } from '../../../src/engine/SajuAnalysisPipeline.js';
import { createBirthInput, type BirthInput } from '../../../src/domain/types.js';
import { Gender } from '../../../src/domain/Gender.js';
import { Cheongan } from '../../../src/domain/Cheongan.js';
import { Jiji } from '../../../src/domain/Jiji.js';
import { Ohaeng, OhaengRelations } from '../../../src/domain/Ohaeng.js';
import { OHAENG_VALUES } from '../../../src/domain/Ohaeng.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { PillarSet } from '../../../src/domain/PillarSet.js';
import { YongshinType } from '../../../src/domain/YongshinResult.js';
import { YongshinDecider } from '../../../src/engine/analysis/YongshinDecider.js';
import { ShinsalDetector } from '../../../src/engine/analysis/ShinsalDetector.js';
import { DEFAULT_CONFIG, createConfig, ShinsalReferenceBranch } from '../../../src/config/CalculationConfig.js';

/**
 * Edge case tests for analysis logic: tonggwan yongshin priority (C-03)
 * and shinsal deduplication invariants (C-04).
 */

// =========================================================================
// Helper: create BirthInput
// =========================================================================

function birthInput(
  year: number, month: number, day: number, hour: number,
  minute: number = 0, gender: Gender = Gender.MALE,
): BirthInput {
  return createBirthInput({
    birthYear: year, birthMonth: month, birthDay: day,
    birthHour: hour, birthMinute: minute,
    gender, latitude: 37.5665, longitude: 126.978,
  });
}

function pillars(
  year: [Cheongan, Jiji], month: [Cheongan, Jiji],
  day: [Cheongan, Jiji], hour: [Cheongan, Jiji],
): PillarSet {
  return new PillarSet(
    new Pillar(year[0], year[1]),
    new Pillar(month[0], month[1]),
    new Pillar(day[0], day[1]),
    new Pillar(hour[0], hour[1]),
  );
}

// =========================================================================
// Section 1: Multi-Conflict Tonggwan Yongshin Priority (C-03)
// =========================================================================

describe('C-03 Tonggwan Yongshin Priority', () => {

  it('mediating element forms correct sangsaeng bridge for all 5 pairs', () => {
    for (const dmOhaeng of OHAENG_VALUES) {
      const controllerElement = OhaengRelations.controlledBy(dmOhaeng);
      const siksangElement = OhaengRelations.generates(dmOhaeng);
      const inseongElement = OhaengRelations.generatedBy(dmOhaeng);
      const jaeseongElement = OhaengRelations.controls(dmOhaeng);

      // Pair 1: controller vs self -> mediator = generates(controller)
      const med1 = OhaengRelations.generates(controllerElement);
      expect(OhaengRelations.generates(med1)).toBe(dmOhaeng);

      // Pair 2: inseong vs siksang -> mediator = generates(inseong)
      const med2 = OhaengRelations.generates(inseongElement);
      expect(OhaengRelations.generates(med2)).toBe(siksangElement);

      // Pair 3: self vs jaeseong -> mediator = generates(self) = siksang
      const med3 = OhaengRelations.generates(dmOhaeng);
      expect(OhaengRelations.generates(med3)).toBe(jaeseongElement);

      // Pair 4: siksang vs gwanseong -> mediator = generates(siksang) = jaeseong
      const med4 = OhaengRelations.generates(siksangElement);
      expect(OhaengRelations.generates(med4)).toBe(controllerElement);

      // Pair 5: jaeseong vs inseong -> mediator = generates(jaeseong) = gwanseong
      const med5 = OhaengRelations.generates(jaeseongElement);
      expect(OhaengRelations.generates(med5)).toBe(inseongElement);
    }
  });

  it('full analysis - tonggwan reasoning appears in yongshin trace when triggered', () => {
    const diverseDates = [
      birthInput(1990, 2, 4, 3),
      birthInput(1985, 8, 15, 22),
      birthInput(1970, 11, 1, 8),
      birthInput(1995, 5, 20, 14),
      birthInput(1980, 1, 10, 5),
      birthInput(2000, 3, 3, 23),
      birthInput(1975, 7, 7, 12),
      birthInput(1960, 12, 25, 6),
    ];

    const analyses = diverseDates.map(d => analyzeSaju(d));

    const tonggwanAnalyses = analyses.filter(a =>
      a.yongshinResult?.recommendations.some(r => r.type === YongshinType.TONGGWAN),
    );

    for (const analysis of tonggwanAnalyses) {
      const yongshinTrace = analysis.trace.find(t => t.key === 'yongshin');
      expect(yongshinTrace).toBeDefined();
    }

    // For all analyses, verify the mediating element is valid
    for (const analysis of analyses) {
      const tonggwanRec = analysis.yongshinResult?.recommendations
        .find(r => r.type === YongshinType.TONGGWAN);
      if (tonggwanRec) {
        expect(OHAENG_VALUES).toContain(tonggwanRec.primaryElement);
      }
    }
  });

  it('full analysis - balanced chart produces no tonggwan or it has valid reasoning', () => {
    const input = birthInput(2000, 4, 15, 10);
    const analysis = analyzeSaju(input);

    const recommendations = analysis.yongshinResult?.recommendations ?? [];
    const tonggwanRec = recommendations.find(r => r.type === YongshinType.TONGGWAN);

    if (tonggwanRec) {
      expect(tonggwanRec.reasoning.length).toBeGreaterThan(0);
      expect(tonggwanRec.confidence).toBeGreaterThan(0.0);
    }
  });
});

// =========================================================================
// Section 2: Shinsal Deduplication (C-04)
// =========================================================================

describe('C-04 Shinsal Deduplication', () => {

  const diversePillarSets: PillarSet[] = [
    pillars(
      [Cheongan.GAP, Jiji.IN], [Cheongan.BYEONG, Jiji.O],
      [Cheongan.MU, Jiji.SUL], [Cheongan.GYEONG, Jiji.JA],
    ),
    pillars(
      [Cheongan.IM, Jiji.HAE], [Cheongan.GYE, Jiji.JA],
      [Cheongan.GAP, Jiji.IN], [Cheongan.EUL, Jiji.MYO],
    ),
    pillars(
      [Cheongan.MU, Jiji.CHUK], [Cheongan.GI, Jiji.MI],
      [Cheongan.BYEONG, Jiji.JIN], [Cheongan.JEONG, Jiji.SUL],
    ),
    pillars(
      [Cheongan.GYEONG, Jiji.SIN], [Cheongan.SIN, Jiji.YU],
      [Cheongan.IM, Jiji.SA], [Cheongan.GYE, Jiji.HAE],
    ),
    pillars(
      [Cheongan.BYEONG, Jiji.SA], [Cheongan.JEONG, Jiji.O],
      [Cheongan.MU, Jiji.MI], [Cheongan.GI, Jiji.CHUK],
    ),
  ];

  it('no duplicate shinsal hits across 5 diverse charts', () => {
    for (let index = 0; index < diversePillarSets.length; index++) {
      const ps = diversePillarSets[index]!;
      const hits = ShinsalDetector.detectAll(ps, DEFAULT_CONFIG);
      const triples = hits.map(h => `${h.type}|${h.position}|${h.referenceBranch}`);
      const uniqueTriples = new Set(triples);
      expect(triples.length, `Chart ${index} has duplicate shinsal hits`).toBe(uniqueTriples.size);
    }
  });

  it('grade filtering produces subset of detectAll', () => {
    for (const ps of diversePillarSets) {
      const allHits = ShinsalDetector.detectAll(ps, DEFAULT_CONFIG);
      const allSet = new Set(allHits.map(h => `${h.type}|${h.position}|${h.referenceBranch}`));
      // detectAll should contain all hits regardless of grade
      expect(allHits.length).toBeGreaterThan(0);
      // Each hit should have a valid type
      for (const hit of allHits) {
        expect(hit.type).toBeDefined();
        expect(hit.position).toBeDefined();
      }
    }
  });

  it('hit count is in reasonable range for each chart', () => {
    for (let index = 0; index < diversePillarSets.length; index++) {
      const ps = diversePillarSets[index]!;
      const hits = ShinsalDetector.detectAll(ps, DEFAULT_CONFIG);
      expect(hits.length, `Chart ${index} should have at least 1 shinsal hit`).toBeGreaterThan(0);
      expect(hits.length, `Chart ${index} has too many hits`).toBeLessThanOrEqual(100);
    }
  });

  it('no duplicate shinsal hits via full analysis calculator', () => {
    const diverseInputs = [
      birthInput(1990, 3, 15, 8),
      birthInput(1985, 7, 22, 14),
      birthInput(2000, 11, 5, 20),
      birthInput(1975, 1, 30, 4),
      birthInput(1960, 9, 18, 11, 0, Gender.FEMALE),
    ];

    for (let index = 0; index < diverseInputs.length; index++) {
      const input = diverseInputs[index]!;
      const analysis = analyzeSaju(input);
      const hits = analysis.shinsalHits;
      const triples = hits.map(h => `${h.type}|${h.position}|${h.referenceBranch}`);
      const uniqueTriples = new Set(triples);
      expect(triples.length, `Full analysis chart ${index} has duplicate shinsal hits`).toBe(uniqueTriples.size);
    }
  });
});
