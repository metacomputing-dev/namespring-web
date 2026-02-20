import { describe, it, expect } from 'vitest';
import { analyzeSaju } from '../../src/engine/SajuAnalysisPipeline.js';
import { createBirthInput, type BirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';
import {
  configFromPreset,
  SchoolPreset,
} from '../../src/config/CalculationConfig.js';

/**
 * Performance benchmark for the full analysis pipeline.
 *
 * Verifies that the engine meets performance targets suitable for production
 * API use. Simplified from the Kotlin version to timeout verification since
 * TypeScript does not require JVM warmup considerations.
 */

const config = configFromPreset(SchoolPreset.KOREAN_MAINSTREAM);

const sampleInputs: BirthInput[] = [
  createBirthInput({
    birthYear: 1990, birthMonth: 3, birthDay: 15,
    birthHour: 14, birthMinute: 30,
    gender: Gender.MALE, longitude: 126.978,
  }),
  createBirthInput({
    birthYear: 1985, birthMonth: 7, birthDay: 22,
    birthHour: 3, birthMinute: 15,
    gender: Gender.FEMALE, longitude: 126.978,
  }),
  createBirthInput({
    birthYear: 2000, birthMonth: 1, birthDay: 1,
    birthHour: 0, birthMinute: 0,
    gender: Gender.MALE, longitude: 126.978,
  }),
  createBirthInput({
    birthYear: 1975, birthMonth: 12, birthDay: 31,
    birthHour: 23, birthMinute: 45,
    gender: Gender.FEMALE, longitude: 126.978,
  }),
  createBirthInput({
    birthYear: 1960, birthMonth: 6, birthDay: 10,
    birthHour: 8, birthMinute: 0,
    gender: Gender.MALE, longitude: 126.978,
  }),
];

const options = {
  daeunCount: 10,
  saeunStartYear: null as number | null,
  saeunYearCount: 10,
};

describe('PerformanceBenchmark', () => {

  it('single analysis completes under 2000ms', () => {
    const start = performance.now();
    const result = analyzeSaju(sampleInputs[1]!, config, options);
    const elapsed = performance.now() - start;

    expect(result.coreResult.pillars).toBeDefined();
    expect(elapsed).toBeLessThan(2000);
  });

  it('20 analyses complete under 10 seconds', () => {
    const start = performance.now();
    for (let i = 0; i < 20; i++) {
      analyzeSaju(sampleInputs[i % sampleInputs.length]!, config, options);
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(10_000);
  });

  it('three preset configs all complete within timeout', () => {
    const presets = [
      SchoolPreset.KOREAN_MAINSTREAM,
      SchoolPreset.TRADITIONAL_CHINESE,
      SchoolPreset.MODERN_INTEGRATED,
    ];

    const times: Record<string, number> = {};

    for (const preset of presets) {
      const cfg = configFromPreset(preset);
      const start = performance.now();
      for (let i = 0; i < 5; i++) {
        analyzeSaju(sampleInputs[i % sampleInputs.length]!, cfg, options);
      }
      times[preset] = performance.now() - start;
    }

    // Each preset's 5 analyses should complete under 5 seconds
    for (const [preset, time] of Object.entries(times)) {
      expect(time, `Preset ${preset} took ${time}ms for 5 analyses`).toBeLessThan(5000);
    }

    // No preset should be more than 10x slower than the fastest
    // (generous ratio to account for JIT warmup on first preset run)
    const fastest = Math.min(...Object.values(times));
    for (const [preset, time] of Object.entries(times)) {
      expect(
        time,
        `Preset ${preset} (${time.toFixed(0)}ms) should not be more than 10x slower than fastest (${fastest.toFixed(0)}ms)`,
      ).toBeLessThan(fastest * 10);
    }
  });

  it('analysis produces complete results for all sample inputs', () => {
    for (const input of sampleInputs) {
      const result = analyzeSaju(input, config, options);

      expect(result.coreResult.pillars.year).toBeDefined();
      expect(result.coreResult.pillars.month).toBeDefined();
      expect(result.coreResult.pillars.day).toBeDefined();
      expect(result.coreResult.pillars.hour).toBeDefined();
      expect(result.strengthResult).not.toBeNull();
      expect(result.daeunInfo).not.toBeNull();
      expect(result.saeunPillars.length).toBeGreaterThan(0);
    }
  });
});
