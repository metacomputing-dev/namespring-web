import { describe, it, expect } from 'vitest';
import { analyzeSaju } from '../../../src/engine/SajuAnalysisPipeline.js';
import { createBirthInput } from '../../../src/domain/types.js';
import { Gender } from '../../../src/domain/Gender.js';
import { Jiji } from '../../../src/domain/Jiji.js';
import {
  DEFAULT_CONFIG,
  configFromPreset,
  SchoolPreset,
} from '../../../src/config/CalculationConfig.js';

/**
 * BirthInput defensive tests -- boundary coordinates, LMT effects,
 * gender symmetry, and edge cases.
 *
 * Verifies that various boundary values pass through the analysis pipeline
 * without exceptions and produce valid results.
 */

// =========================================================================
// 1. Boundary coordinate tests
// =========================================================================

describe('BirthInputDefense: Boundary Coordinates', () => {

  it('default Seoul coordinates produce valid 4-pillar analysis', () => {
    const input = createBirthInput({
      birthYear: 1990, birthMonth: 5, birthDay: 15,
      birthHour: 14, birthMinute: 30,
      gender: Gender.MALE,
    });
    const result = analyzeSaju(input);

    expect(result.pillars.year).toBeDefined();
    expect(result.pillars.month).toBeDefined();
    expect(result.pillars.day).toBeDefined();
    expect(result.pillars.hour).toBeDefined();
    expect(input.latitude).toBe(37.5665);
    expect(input.longitude).toBe(126.978);
  });

  it('latitude 0 (equator) produces valid analysis without exception', () => {
    const input = createBirthInput({
      birthYear: 1990, birthMonth: 5, birthDay: 15,
      birthHour: 14, birthMinute: 30,
      gender: Gender.FEMALE,
      latitude: 0.0,
      longitude: 126.978,
    });
    const result = analyzeSaju(input);
    expect(result.pillars.year).toBeDefined();
    expect(result.pillars.day).toBeDefined();
  });

  it('latitude 90 (north pole) produces valid analysis without exception', () => {
    const input = createBirthInput({
      birthYear: 1990, birthMonth: 5, birthDay: 15,
      birthHour: 14, birthMinute: 30,
      gender: Gender.MALE,
      latitude: 90.0,
      longitude: 126.978,
    });
    const result = analyzeSaju(input);
    expect(result.pillars.year).toBeDefined();
  });

  it('latitude -90 (south pole) produces valid analysis without exception', () => {
    const input = createBirthInput({
      birthYear: 1990, birthMonth: 5, birthDay: 15,
      birthHour: 14, birthMinute: 30,
      gender: Gender.FEMALE,
      latitude: -90.0,
      longitude: 126.978,
    });
    const result = analyzeSaju(input);
    expect(result.pillars.day).toBeDefined();
  });

  it('longitude 0 (Greenwich) produces valid analysis', () => {
    const input = createBirthInput({
      birthYear: 1990, birthMonth: 5, birthDay: 15,
      birthHour: 14, birthMinute: 30,
      gender: Gender.MALE,
      latitude: 51.4769,
      longitude: 0.0,
    });
    const result = analyzeSaju(input);
    expect(result.pillars).toBeDefined();
  });

  it('longitude 180 (date line) produces valid analysis', () => {
    const input = createBirthInput({
      birthYear: 1990, birthMonth: 5, birthDay: 15,
      birthHour: 14, birthMinute: 30,
      gender: Gender.FEMALE,
      latitude: 37.5665,
      longitude: 180.0,
    });
    const result = analyzeSaju(input);
    expect(result.pillars).toBeDefined();
  });

  it('longitude -180 (date line west) produces valid analysis', () => {
    const input = createBirthInput({
      birthYear: 1990, birthMonth: 5, birthDay: 15,
      birthHour: 14, birthMinute: 30,
      gender: Gender.MALE,
      latitude: 37.5665,
      longitude: -180.0,
    });
    const result = analyzeSaju(input);
    expect(result.pillars).toBeDefined();
  });

  it('longitude 135 (KST standard meridian) produces valid analysis', () => {
    const input = createBirthInput({
      birthYear: 1990, birthMonth: 5, birthDay: 15,
      birthHour: 14, birthMinute: 30,
      gender: Gender.FEMALE,
      latitude: 37.5665,
      longitude: 135.0,
    });
    const result = analyzeSaju(input);
    expect(result.pillars).toBeDefined();
  });
});

// =========================================================================
// 2. LMT effect verification
// =========================================================================

describe('BirthInputDefense: LMT Effects', () => {

  it('longitude 127 vs 135 produces different LMT correction', () => {
    const inputSeoul = createBirthInput({
      birthYear: 1990, birthMonth: 5, birthDay: 15,
      birthHour: 14, birthMinute: 30,
      gender: Gender.MALE,
      latitude: 37.5665,
      longitude: 127.0,
    });
    const inputMeridian = createBirthInput({
      birthYear: 1990, birthMonth: 5, birthDay: 15,
      birthHour: 14, birthMinute: 30,
      gender: Gender.MALE,
      latitude: 37.5665,
      longitude: 135.0,
    });
    const resultSeoul = analyzeSaju(inputSeoul);
    const resultMeridian = analyzeSaju(inputMeridian);

    // LMT correction at longitude 127: (127 - 135) * 4 = -32 minutes
    // LMT correction at longitude 135: (135 - 135) * 4 = 0 minutes
    expect(resultSeoul.coreResult.longitudeCorrectionMinutes).not.toBe(
      resultMeridian.coreResult.longitudeCorrectionMinutes,
    );
  });

  it('longitude 0 (Greenwich) produces large negative LMT shift in KST timezone', () => {
    const input = createBirthInput({
      birthYear: 1990, birthMonth: 5, birthDay: 15,
      birthHour: 14, birthMinute: 30,
      gender: Gender.MALE,
      latitude: 51.4769,
      longitude: 0.0,
    });
    const result = analyzeSaju(input);
    // LMT correction: (0 - 135) * 4 = -540 minutes = -9 hours
    expect(result.coreResult.longitudeCorrectionMinutes).toBeLessThan(-500);
  });

  it('longitude 180 produces positive LMT offset in KST timezone', () => {
    const input = createBirthInput({
      birthYear: 1990, birthMonth: 5, birthDay: 15,
      birthHour: 14, birthMinute: 30,
      gender: Gender.FEMALE,
      latitude: 37.5665,
      longitude: 180.0,
    });
    const result = analyzeSaju(input);
    // LMT correction: (180 - 135) * 4 = 180 minutes = +3 hours
    expect(result.coreResult.longitudeCorrectionMinutes).toBeGreaterThan(100);
  });

  it('negative longitude (NYC) works correctly in KST timezone', () => {
    const input = createBirthInput({
      birthYear: 1990, birthMonth: 5, birthDay: 15,
      birthHour: 14, birthMinute: 30,
      gender: Gender.MALE,
      latitude: 40.7128,
      longitude: -73.9857,
    });
    const result = analyzeSaju(input);
    // LMT correction: (-73.9857 - 135) * 4 ~ -836 minutes
    expect(result.pillars).toBeDefined();
    expect(result.coreResult.longitudeCorrectionMinutes).toBeLessThan(-800);
  });

  it('extreme longitude difference can change day pillar via LMT midnight crossing', () => {
    // Birth at 01:00 KST -- with extreme negative LMT, adjusted time moves to previous day
    const inputNearMeridian = createBirthInput({
      birthYear: 1990, birthMonth: 5, birthDay: 15,
      birthHour: 1, birthMinute: 0,
      gender: Gender.MALE,
      latitude: 37.5665,
      longitude: 135.0, // LMT = 0 minutes
    });
    const inputFarWest = createBirthInput({
      birthYear: 1990, birthMonth: 5, birthDay: 15,
      birthHour: 1, birthMinute: 0,
      gender: Gender.MALE,
      latitude: 37.5665,
      longitude: 0.0, // LMT = -540 minutes = -9 hours, adjusted = previous day 16:00
    });
    const resultNear = analyzeSaju(inputNearMeridian);
    const resultFar = analyzeSaju(inputFarWest);

    // The day pillars should differ because the LMT correction moves
    // the adjusted solar time across midnight into the previous day
    expect(resultNear.pillars.day.cheongan).not.toBe(resultFar.pillars.day.cheongan);
  });

  it('same time different longitudes produce different hour pillars when LMT is large', () => {
    // Birth at 13:30 KST -- longitude 0 shifts to 04:30 adjusted solar time
    const inputKst = createBirthInput({
      birthYear: 1990, birthMonth: 5, birthDay: 15,
      birthHour: 13, birthMinute: 30,
      gender: Gender.FEMALE,
      latitude: 37.5665,
      longitude: 135.0, // no LMT shift
    });
    const inputGreenwich = createBirthInput({
      birthYear: 1990, birthMonth: 5, birthDay: 15,
      birthHour: 13, birthMinute: 30,
      gender: Gender.FEMALE,
      latitude: 51.4769,
      longitude: 0.0, // -540 min shift -> 04:30 adjusted
    });
    const resultKst = analyzeSaju(inputKst);
    const resultGreenwich = analyzeSaju(inputGreenwich);

    // 13:30 is in 미(未) hour (13-15), 04:30 is in 인(寅) hour (03-05)
    expect(resultKst.pillars.hour.jiji).not.toBe(resultGreenwich.pillars.hour.jiji);
  });
});

// =========================================================================
// 3. Gender symmetry
// =========================================================================

describe('BirthInputDefense: Gender Symmetry', () => {

  it('same birth data with MALE vs FEMALE produces identical 4 pillars', () => {
    const maleInput = createBirthInput({
      birthYear: 1990, birthMonth: 5, birthDay: 15,
      birthHour: 14, birthMinute: 30,
      gender: Gender.MALE,
      latitude: 37.5665,
      longitude: 126.978,
    });
    const femaleInput = createBirthInput({
      birthYear: 1990, birthMonth: 5, birthDay: 15,
      birthHour: 14, birthMinute: 30,
      gender: Gender.FEMALE,
      latitude: 37.5665,
      longitude: 126.978,
    });
    const maleResult = analyzeSaju(maleInput);
    const femaleResult = analyzeSaju(femaleInput);

    // Pillars must be identical regardless of gender
    expect(maleResult.pillars.year.cheongan).toBe(femaleResult.pillars.year.cheongan);
    expect(maleResult.pillars.year.jiji).toBe(femaleResult.pillars.year.jiji);
    expect(maleResult.pillars.month.cheongan).toBe(femaleResult.pillars.month.cheongan);
    expect(maleResult.pillars.month.jiji).toBe(femaleResult.pillars.month.jiji);
    expect(maleResult.pillars.day.cheongan).toBe(femaleResult.pillars.day.cheongan);
    expect(maleResult.pillars.day.jiji).toBe(femaleResult.pillars.day.jiji);
    expect(maleResult.pillars.hour.cheongan).toBe(femaleResult.pillars.hour.cheongan);
    expect(maleResult.pillars.hour.jiji).toBe(femaleResult.pillars.hour.jiji);
  });

  it('both genders analyze without exception', () => {
    for (const gender of [Gender.MALE, Gender.FEMALE]) {
      const input = createBirthInput({
        birthYear: 1990, birthMonth: 5, birthDay: 15,
        birthHour: 14, birthMinute: 30,
        gender,
        latitude: 37.5665,
        longitude: 126.978,
      });
      const result = analyzeSaju(input);
      expect(result.daeunInfo, `Daeun must be computed for ${gender}`).not.toBeNull();
      expect(result.strengthResult, `Strength must be computed for ${gender}`).not.toBeNull();
    }
  });

  it('daeun direction follows yang-stem MALE forward, yang-stem FEMALE reverse', () => {
    // 1990-05-15 year stem: after ipchun -> 경오(庚午) -> 경=GYEONG=YANG
    const yangStemMale = createBirthInput({
      birthYear: 1990, birthMonth: 5, birthDay: 15,
      birthHour: 14, birthMinute: 30,
      gender: Gender.MALE,
    });
    const yangStemFemale = createBirthInput({
      birthYear: 1990, birthMonth: 5, birthDay: 15,
      birthHour: 14, birthMinute: 30,
      gender: Gender.FEMALE,
    });
    const maleAnalysis = analyzeSaju(yangStemMale);
    const femaleAnalysis = analyzeSaju(yangStemFemale);

    const maleForward = maleAnalysis.daeunInfo!.isForward;
    const femaleForward = femaleAnalysis.daeunInfo!.isForward;

    // YANG year stem: male = forward (순행), female = reverse (역행)
    expect(maleForward).toBe(true);
    expect(femaleForward).toBe(false);
    expect(maleForward).not.toBe(femaleForward);
  });
});

// =========================================================================
// 4. Edge cases
// =========================================================================

describe('BirthInputDefense: Edge Cases', () => {

  it('name undefined is accepted and analysis succeeds', () => {
    const input = createBirthInput({
      birthYear: 1990, birthMonth: 5, birthDay: 15,
      birthHour: 14, birthMinute: 30,
      gender: Gender.MALE,
    });
    const result = analyzeSaju(input);
    expect(result.pillars).toBeDefined();
    expect(input.name).toBeUndefined();
  });

  it('very long name (100 chars) works at domain level', () => {
    const longName = 'A'.repeat(100);
    const input = createBirthInput({
      birthYear: 1990, birthMonth: 5, birthDay: 15,
      birthHour: 14, birthMinute: 30,
      gender: Gender.FEMALE,
      name: longName,
    });
    const result = analyzeSaju(input);
    expect(result.pillars).toBeDefined();
    expect(input.name!.length).toBe(100);
  });

  it('non-KST timezone (UTC) works correctly', () => {
    const input = createBirthInput({
      birthYear: 1990, birthMonth: 5, birthDay: 15,
      birthHour: 5, birthMinute: 30,
      gender: Gender.MALE,
      timezone: 'UTC',
      latitude: 51.4769,
      longitude: 0.0,
    });
    const result = analyzeSaju(input);
    expect(result.pillars).toBeDefined();
  });

  it('birth at midnight 00:00 produces valid analysis', () => {
    const input = createBirthInput({
      birthYear: 1990, birthMonth: 5, birthDay: 15,
      birthHour: 0, birthMinute: 0,
      gender: Gender.MALE,
      latitude: 37.5665,
      longitude: 126.978,
    });
    const result = analyzeSaju(input);
    expect(result.pillars).toBeDefined();
    // Midnight 00:00 in default mode is 자(子) hour (23:00-01:00)
    expect(result.pillars.hour.jiji).toBe(Jiji.JA);
  });

  it('birth at 23:59 produces valid analysis in ja hour', () => {
    const input = createBirthInput({
      birthYear: 1990, birthMonth: 5, birthDay: 15,
      birthHour: 23, birthMinute: 59,
      gender: Gender.FEMALE,
      latitude: 37.5665,
      longitude: 135.0, // use standard meridian for no LMT shift
    });
    const result = analyzeSaju(input);
    expect(result.pillars).toBeDefined();
    // 23:59 with no LMT shift: in default YAZA mode this is 자(子) hour
    expect(result.pillars.hour.jiji).toBe(Jiji.JA);
  });

  it('createBirthInput defaults timezone to Asia/Seoul', () => {
    const input = createBirthInput({
      birthYear: 2000, birthMonth: 1, birthDay: 1,
      birthHour: 12, birthMinute: 0,
      gender: Gender.MALE,
    });
    expect(input.timezone).toBe('Asia/Seoul');
  });

  it('createBirthInput defaults latitude and longitude to Seoul', () => {
    const input = createBirthInput({
      birthYear: 2000, birthMonth: 1, birthDay: 1,
      birthHour: 12, birthMinute: 0,
      gender: Gender.FEMALE,
    });
    expect(input.latitude).toBe(37.5665);
    expect(input.longitude).toBe(126.978);
  });

  it('leap year Feb 29 birth produces valid analysis', () => {
    const input = createBirthInput({
      birthYear: 2000, birthMonth: 2, birthDay: 29,
      birthHour: 12, birthMinute: 0,
      gender: Gender.MALE,
    });
    const result = analyzeSaju(input);
    expect(result.pillars).toBeDefined();
    expect(result.strengthResult).not.toBeNull();
  });

  it('year 1900 January 1 boundary produces valid analysis', () => {
    const input = createBirthInput({
      birthYear: 1900, birthMonth: 1, birthDay: 1,
      birthHour: 12, birthMinute: 0,
      gender: Gender.FEMALE,
    });
    const result = analyzeSaju(input);
    expect(result.pillars).toBeDefined();
  });

  it('year 2050 December 31 boundary produces valid analysis', () => {
    const input = createBirthInput({
      birthYear: 2050, birthMonth: 12, birthDay: 31,
      birthHour: 23, birthMinute: 30,
      gender: Gender.MALE,
    });
    const result = analyzeSaju(input);
    expect(result.pillars).toBeDefined();
  });
});
