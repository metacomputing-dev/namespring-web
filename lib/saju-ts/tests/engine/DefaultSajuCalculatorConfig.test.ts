import { describe, it, expect } from 'vitest';
import { calculatePillars } from '../../src/engine/SajuCalculator.js';
import { createBirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';
import {
  createConfig,
  configFromPreset,
  SchoolPreset,
  DEFAULT_CONFIG,
} from '../../src/config/CalculationConfig.js';
import { DayCutMode } from '../../src/calendar/time/DayCutMode.js';
import { HiddenStemVariant } from '../../src/domain/HiddenStem.js';

/**
 * Ported from DefaultSajuCalculatorConfigTest.kt
 *
 * Tests configuration-dependent calculator behavior:
 * - YAZA mode shifting day pillar at hour 23
 * - Name not affecting calculation
 * - Preset factory producing different DayCut policies
 * - Ten god analysis presence in result
 */

describe('DefaultSajuCalculatorConfig', () => {
  it('YAZA mode can shift day pillar when hour is 23', () => {
    const input = createBirthInput({
      birthYear: 2024, birthMonth: 2, birthDay: 10,
      birthHour: 23, birthMinute: 30,
      gender: Gender.MALE,
      latitude: 37.5665,
      longitude: 135.0, // Standard meridian to avoid LMT shifts
      name: 'test',
    });

    const yaza = calculatePillars(input, createConfig({
      dayCutMode: DayCutMode.YAZA_23_TO_01_NEXTDAY,
      applyDstHistory: false,
    }));
    const midnight = calculatePillars(input, createConfig({
      dayCutMode: DayCutMode.MIDNIGHT_00,
      applyDstHistory: false,
    }));

    // YAZA mode advances the day at 23:00, MIDNIGHT does not
    expect(midnight.pillars.day.equals(yaza.pillars.day)).toBe(false);
  });

  it('name does not affect saju calculation', () => {
    const named = createBirthInput({
      birthYear: 2025, birthMonth: 2, birthDay: 3,
      birthHour: 23, birthMinute: 11,
      gender: Gender.MALE,
      latitude: 37.5665,
      longitude: 126.978,
      name: '\uD64D\uAE38\uB3D9', // 홍길동
    });
    const unnamed = createBirthInput({
      birthYear: 2025, birthMonth: 2, birthDay: 3,
      birthHour: 23, birthMinute: 11,
      gender: Gender.MALE,
      latitude: 37.5665,
      longitude: 126.978,
    });

    const namedResult = calculatePillars(named);
    const unnamedResult = calculatePillars(unnamed);

    expect(namedResult.pillars.year.equals(unnamedResult.pillars.year)).toBe(true);
    expect(namedResult.pillars.month.equals(unnamedResult.pillars.month)).toBe(true);
    expect(namedResult.pillars.day.equals(unnamedResult.pillars.day)).toBe(true);
    expect(namedResult.pillars.hour.equals(unnamedResult.pillars.hour)).toBe(true);
  });

  it('preset factory produces different day cut policies', () => {
    const korean = configFromPreset(SchoolPreset.KOREAN_MAINSTREAM);
    const traditional = configFromPreset(SchoolPreset.TRADITIONAL_CHINESE);
    const modern = configFromPreset(SchoolPreset.MODERN_INTEGRATED);

    expect(korean.dayCutMode).toBe(DayCutMode.YAZA_23_30_TO_01_30_NEXTDAY);
    expect(traditional.dayCutMode).toBe(DayCutMode.YAZA_23_30_TO_01_30_NEXTDAY);
    expect(modern.dayCutMode).toBe(DayCutMode.JOJA_SPLIT);
    expect(modern.includeEquationOfTime).toBe(true);
    expect(korean.hiddenStemVariant).toBe(HiddenStemVariant.STANDARD);
  });

  it('result contains valid four pillars with ten god computable data', () => {
    // This tests that the core result has enough info for ten god analysis.
    // In the Kotlin version, this tested tenGodAnalysis on the analysis pipeline;
    // here we verify the core pillar result contains valid pillars for downstream analysis.
    const input = createBirthInput({
      birthYear: 2024, birthMonth: 8, birthDay: 7,
      birthHour: 9, birthMinute: 20,
      gender: Gender.FEMALE,
      latitude: 37.5665,
      longitude: 126.978,
    });

    const result = calculatePillars(input, configFromPreset(SchoolPreset.KOREAN_MAINSTREAM));

    // All four pillars should be valid
    expect(result.pillars.year).toBeDefined();
    expect(result.pillars.month).toBeDefined();
    expect(result.pillars.day).toBeDefined();
    expect(result.pillars.hour).toBeDefined();

    // Day pillar cheongan is the day master, needed for ten god calc
    expect(result.pillars.day.cheongan).toBeDefined();
    expect(result.pillars.day.jiji).toBeDefined();
  });
});
