import { describe, it, expect } from 'vitest';
import { calculatePillars } from '../../src/engine/SajuCalculator.js';
import { createBirthInput } from '../../src/domain/types.js';
import { Gender } from '../../src/domain/Gender.js';
import { createConfig } from '../../src/config/CalculationConfig.js';
import { DayCutMode } from '../../src/calendar/time/DayCutMode.js';
import { standardMeridianDegrees, lmtOffsetMinutes } from '../../src/calendar/time/SolarTimeAdjuster.js';
import { Jiji, JIJI_VALUES } from '../../src/domain/Jiji.js';

/**
 * V-10: International hour pillar verification across five global cities.
 *
 * The saju engine applies LMT (Local Mean Time) correction based on
 * birth longitude relative to the timezone's standard meridian:
 *
 *     LMT correction = round((longitude - standardMeridian) * 4) minutes
 *
 * This test suite verifies that LMT correction correctly shifts the hour pillar
 * branch (jiji) when the birth time falls near a two-hour shi-chen boundary.
 * Each city case is deliberately chosen so that the LMT offset pushes
 * the adjusted solar time across a branch boundary, producing a different hour
 * pillar jiji than the uncorrected clock time would yield.
 *
 * Cities tested: Tokyo, New York, Shanghai, London, Sydney.
 */

// ---- Helpers ----

function internationalConfig(standardMeridian: number) {
  return createConfig({
    dayCutMode: DayCutMode.MIDNIGHT_00,
    applyDstHistory: false,
    includeEquationOfTime: false,
    lmtBaselineLongitude: standardMeridian,
  });
}

/**
 * Computes the expected hour branch (jiji) for a given 24-hour value,
 * mirroring the formula in GanjiCycle.hourPillar:
 *
 *     branchIndex = ((hour24 + 1) / 2) % 12
 */
function expectedBranchForHour(hour24: number): Jiji {
  const index = Math.floor((hour24 + 1) / 2) % 12;
  return JIJI_VALUES[index]!;
}

// ---- City cases ----

interface CityCase {
  id: string;
  timezone: string;
  year: number; month: number; day: number;
  hour: number; minute: number;
  longitude: number;
  latitude: number;
  expectedMeridian: number;
  expectedLmtMinutes: number;
  clockHourBranch: Jiji;
  adjustedHourBranch: Jiji;
  expectsBranchShift: boolean;
}

// All birth times chosen on 1990-07-15 (mid-year, avoids jeol boundaries)
// except London which uses January to avoid BST complications.
const cases: CityCase[] = [
  // Tokyo: JST (UTC+9), standard meridian 135.0
  // LMT = round((139.69 - 135.0) * 4) = round(18.76) = 19 min
  // Birth 12:50 JST -> adjusted 13:09 -> hour 13 -> MI
  // Clock hour 12 -> O, adjusted hour 13 -> MI -- branch shifts!
  {
    id: 'TOKYO', timezone: 'Asia/Tokyo',
    year: 1990, month: 7, day: 15, hour: 12, minute: 50,
    longitude: 139.69, latitude: 35.68,
    expectedMeridian: 135.0, expectedLmtMinutes: 19,
    clockHourBranch: Jiji.O,
    adjustedHourBranch: Jiji.MI,
    expectsBranchShift: true,
  },

  // New York: EST (UTC-5), standard meridian -75.0
  // LMT = round((-73.94 - (-75.0)) * 4) = round(4.24) = 4 min
  // Birth 10:57 local -> adjusted 11:01 -> hour 11 -> O
  // Clock hour 10 -> SA, adjusted hour 11 -> O -- branch shifts!
  {
    id: 'NEW_YORK', timezone: 'America/New_York',
    year: 1990, month: 7, day: 15, hour: 10, minute: 57,
    longitude: -73.94, latitude: 40.71,
    expectedMeridian: -75.0, expectedLmtMinutes: 4,
    clockHourBranch: Jiji.SA,
    adjustedHourBranch: Jiji.O,
    expectsBranchShift: true,
  },

  // Shanghai: CST (UTC+8), standard meridian 120.0
  // LMT = round((121.47 - 120.0) * 4) = round(5.88) = 6 min
  // Birth 12:55 local -> adjusted 13:01 -> hour 13 -> MI
  // Clock hour 12 -> O, adjusted hour 13 -> MI -- branch shifts!
  {
    id: 'SHANGHAI', timezone: 'Asia/Shanghai',
    year: 1990, month: 7, day: 15, hour: 12, minute: 55,
    longitude: 121.47, latitude: 31.23,
    expectedMeridian: 120.0, expectedLmtMinutes: 6,
    clockHourBranch: Jiji.O,
    adjustedHourBranch: Jiji.MI,
    expectsBranchShift: true,
  },

  // London: GMT (UTC+0), standard meridian 0.0
  // LMT = round((-0.12 - 0.0) * 4) = round(-0.48) = 0 min
  // Birth 14:30 GMT -> adjusted 14:30 -> hour 14 -> MI
  // No branch shift (longitude nearly on prime meridian) -- stability case
  // Using January to guarantee GMT (no BST)
  {
    id: 'LONDON', timezone: 'Europe/London',
    year: 1990, month: 1, day: 15, hour: 14, minute: 30,
    longitude: -0.12, latitude: 51.51,
    expectedMeridian: 0.0, expectedLmtMinutes: 0,
    clockHourBranch: Jiji.MI,
    adjustedHourBranch: Jiji.MI,
    expectsBranchShift: false,
  },

  // Sydney: AEST (UTC+10), standard meridian 150.0
  // LMT = round((151.21 - 150.0) * 4) = round(4.84) = 5 min
  // Birth 14:56 local -> adjusted 15:01 -> hour 15 -> SIN
  // Clock hour 14 -> MI, adjusted hour 15 -> SIN -- branch shifts!
  // July in Sydney is winter (AEST, no DST), standard offset +10
  {
    id: 'SYDNEY', timezone: 'Australia/Sydney',
    year: 1990, month: 7, day: 15, hour: 14, minute: 56,
    longitude: 151.21, latitude: -33.87,
    expectedMeridian: 150.0, expectedLmtMinutes: 5,
    clockHourBranch: Jiji.MI,
    adjustedHourBranch: Jiji.SIN,
    expectsBranchShift: true,
  },
];

// ====================================================================
// Tests
// ====================================================================

describe('InternationalHourPillarVerificationTest', () => {

  // ----------------------------------------------------------------
  // Test 1: Standard meridian derivation for each timezone
  // ----------------------------------------------------------------
  it('each city timezone yields the correct standard meridian', () => {
    for (const c of cases) {
      const meridian = standardMeridianDegrees(c.timezone);
      expect(meridian, `${c.id}: standard meridian`).toBe(c.expectedMeridian);
    }
  });

  // ----------------------------------------------------------------
  // Test 2: LMT correction matches hand-calculated values
  // ----------------------------------------------------------------
  it('LMT correction minutes match formula for each city longitude', () => {
    for (const c of cases) {
      // Verify via direct formula (use +0 to normalize -0 to 0 for Object.is)
      const formulaLmt = Math.round((c.longitude - c.expectedMeridian) * 4.0) || 0;
      expect(formulaLmt, `${c.id}: hand-calculated LMT`).toBe(c.expectedLmtMinutes);

      // Verify via engine output
      const config = internationalConfig(c.expectedMeridian);
      const input = createBirthInput({
        birthYear: c.year, birthMonth: c.month, birthDay: c.day,
        birthHour: c.hour, birthMinute: c.minute,
        gender: Gender.MALE, timezone: c.timezone,
        longitude: c.longitude, latitude: c.latitude,
      });
      const result = calculatePillars(input, config);
      // Normalize -0 to 0 for Object.is equality
      const engineLmt = result.longitudeCorrectionMinutes || 0;
      expect(engineLmt, `${c.id}: engine LMT`).toBe(c.expectedLmtMinutes);
    }
  });

  // ----------------------------------------------------------------
  // Test 3: Hour pillar branch shifts across shi-chen boundary with LMT
  // ----------------------------------------------------------------
  it('LMT correction shifts hour pillar branch at boundary birth times', () => {
    for (const c of cases) {
      const config = internationalConfig(c.expectedMeridian);
      const input = createBirthInput({
        birthYear: c.year, birthMonth: c.month, birthDay: c.day,
        birthHour: c.hour, birthMinute: c.minute,
        gender: Gender.MALE, timezone: c.timezone,
        longitude: c.longitude, latitude: c.latitude,
      });
      const result = calculatePillars(input, config);

      // Verify the engine's hour pillar branch matches the expected adjusted branch
      expect(
        result.pillars.hour.jiji,
        `${c.id}: hour pillar branch after LMT`,
      ).toBe(c.adjustedHourBranch);

      // Verify the clock hour (before LMT) would produce a different branch
      const clockBranch = expectedBranchForHour(c.hour);
      expect(clockBranch, `${c.id}: clock hour ${c.hour} branch`).toBe(c.clockHourBranch);

      // For boundary cases, assert the shift actually happened
      if (c.expectsBranchShift) {
        expect(
          result.pillars.hour.jiji,
          `${c.id}: LMT should shift branch`,
        ).not.toBe(clockBranch);
      } else {
        expect(
          result.pillars.hour.jiji,
          `${c.id}: near-zero LMT should NOT shift branch`,
        ).toBe(clockBranch);
      }
    }
  });

  // ----------------------------------------------------------------
  // Test 4: No-LMT vs with-LMT produces different hour pillar
  // ----------------------------------------------------------------
  it('calculating at standard meridian longitude produces clock-time branch', () => {
    for (const c of cases.filter(cc => cc.expectsBranchShift)) {
      const config = internationalConfig(c.expectedMeridian);

      // Calculate with longitude == standard meridian (LMT = 0)
      const noLmtInput = createBirthInput({
        birthYear: c.year, birthMonth: c.month, birthDay: c.day,
        birthHour: c.hour, birthMinute: c.minute,
        gender: Gender.MALE, timezone: c.timezone,
        longitude: c.expectedMeridian, // on the standard meridian -> LMT = 0
        latitude: c.latitude,
      });
      const noLmtResult = calculatePillars(noLmtInput, config);

      // Without LMT shift, hour branch should match raw clock hour
      expect(
        noLmtResult.pillars.hour.jiji,
        `${c.id}: at standard meridian, hour branch should be ${c.clockHourBranch}`,
      ).toBe(c.clockHourBranch);

      // With real longitude, hour branch should differ
      const withLmtInput = createBirthInput({
        birthYear: c.year, birthMonth: c.month, birthDay: c.day,
        birthHour: c.hour, birthMinute: c.minute,
        gender: Gender.MALE, timezone: c.timezone,
        longitude: c.longitude,
        latitude: c.latitude,
      });
      const withLmtResult = calculatePillars(withLmtInput, config);

      expect(
        noLmtResult.pillars.hour.jiji === withLmtResult.pillars.hour.jiji,
        `${c.id}: real longitude should produce different hour branch than standard meridian`,
      ).toBe(false);
    }
  });

  // ----------------------------------------------------------------
  // Test 5: All four pillars are structurally valid for every city
  // ----------------------------------------------------------------
  it('all four pillars are valid and non-degenerate for every city', () => {
    for (const c of cases) {
      const config = internationalConfig(c.expectedMeridian);
      const input = createBirthInput({
        birthYear: c.year, birthMonth: c.month, birthDay: c.day,
        birthHour: c.hour, birthMinute: c.minute,
        gender: Gender.MALE, timezone: c.timezone,
        longitude: c.longitude, latitude: c.latitude,
      });
      const result = calculatePillars(input, config);

      expect(result.pillars.year.cheongan, `${c.id}: year cheongan`).toBeDefined();
      expect(result.pillars.year.jiji, `${c.id}: year jiji`).toBeDefined();
      expect(result.pillars.month.cheongan, `${c.id}: month cheongan`).toBeDefined();
      expect(result.pillars.month.jiji, `${c.id}: month jiji`).toBeDefined();
      expect(result.pillars.day.cheongan, `${c.id}: day cheongan`).toBeDefined();
      expect(result.pillars.day.jiji, `${c.id}: day jiji`).toBeDefined();
      expect(result.pillars.hour.cheongan, `${c.id}: hour cheongan`).toBeDefined();
      expect(result.pillars.hour.jiji, `${c.id}: hour jiji`).toBeDefined();
    }
  });

  // ----------------------------------------------------------------
  // Test 6: Same UTC instant from three cities -- day pillar consistency
  // ----------------------------------------------------------------
  it('same UTC instant produces identical day pillar regardless of timezone', () => {
    // 1990-07-15 04:00 UTC chosen to land in normal daytime hours across zones
    // Tokyo: 13:00 JST, Shanghai: 12:00 CST, Sydney: 14:00 AEST
    const instantCases: Array<{
      id: string; timezone: string; longitude: number; latitude: number;
      localHour: number; localMinute: number;
    }> = [
      { id: 'TOKYO', timezone: 'Asia/Tokyo', longitude: 139.69, latitude: 35.68, localHour: 13, localMinute: 0 },
      { id: 'SHANGHAI', timezone: 'Asia/Shanghai', longitude: 121.47, latitude: 31.23, localHour: 12, localMinute: 0 },
      { id: 'SYDNEY', timezone: 'Australia/Sydney', longitude: 151.21, latitude: -33.87, localHour: 14, localMinute: 0 },
    ];

    const dayPillars: Array<{ id: string; cheongan: string; jiji: string }> = [];

    for (const ic of instantCases) {
      const meridian = standardMeridianDegrees(ic.timezone);
      const config = internationalConfig(meridian);
      const input = createBirthInput({
        birthYear: 1990, birthMonth: 7, birthDay: 15,
        birthHour: ic.localHour, birthMinute: ic.localMinute,
        gender: Gender.MALE, timezone: ic.timezone,
        longitude: ic.longitude, latitude: ic.latitude,
      });
      const result = calculatePillars(input, config);
      dayPillars.push({
        id: ic.id,
        cheongan: result.pillars.day.cheongan,
        jiji: result.pillars.day.jiji,
      });
    }

    // All cities at the same UTC instant should share the same day pillar
    const first = dayPillars[0]!;
    for (const dp of dayPillars) {
      expect(dp.cheongan, `${dp.id}: day cheongan should match`).toBe(first.cheongan);
      expect(dp.jiji, `${dp.id}: day jiji should match`).toBe(first.jiji);
    }
  });

  // ----------------------------------------------------------------
  // Test 7: Same UTC instant -- hour pillars diverge due to LMT offset
  // ----------------------------------------------------------------
  it('same UTC instant from distant cities produces divergent hour pillars', () => {
    // 1990-07-15 12:00 UTC -> Tokyo 21:00 JST, New York 08:00 EDT
    // Tokyo adjusted: 21:00 + 19min = 21:19 -> hour 21 -> SUL
    // NY adjusted:    08:00 + 4min  = 08:04 -> hour  8 -> JIN
    // These must differ.
    const tokyoMeridian = standardMeridianDegrees('Asia/Tokyo');
    const nyMeridian = standardMeridianDegrees('America/New_York');

    const tokyoInput = createBirthInput({
      birthYear: 1990, birthMonth: 7, birthDay: 15,
      birthHour: 21, birthMinute: 0,
      gender: Gender.FEMALE, timezone: 'Asia/Tokyo',
      longitude: 139.69, latitude: 35.68,
    });
    const nyInput = createBirthInput({
      birthYear: 1990, birthMonth: 7, birthDay: 15,
      birthHour: 8, birthMinute: 0,
      gender: Gender.FEMALE, timezone: 'America/New_York',
      longitude: -73.94, latitude: 40.71,
    });

    const tokyoResult = calculatePillars(tokyoInput, internationalConfig(tokyoMeridian));
    const nyResult = calculatePillars(nyInput, internationalConfig(nyMeridian));

    expect(
      tokyoResult.pillars.hour.jiji === nyResult.pillars.hour.jiji,
    ).toBe(false);
  });

  // ----------------------------------------------------------------
  // Test 9: Negative LMT -- westward offset subtracts from clock time
  // ----------------------------------------------------------------
  it('negative LMT correction shifts hour pillar backward (Reykjavik)', () => {
    // Reykjavik: longitude -21.94, timezone Atlantic/Reykjavik (UTC+0), meridian 0.0
    // LMT = round((-21.94 - 0.0) * 4) = round(-87.76) = -88 min (about 1h28m backward)
    // Birth 01:25 GMT -> adjusted 01:25 - 88min = 23:57 previous day
    // Clock hour 1 -> CHUK, adjusted hour 23 -> JA -- dramatic backward shift!
    const meridian = standardMeridianDegrees('Atlantic/Reykjavik');
    expect(meridian).toBe(0.0);

    const expectedLmt = Math.round((-21.94 - 0.0) * 4.0);
    expect(expectedLmt).toBe(-88);

    const config = internationalConfig(meridian);
    const input = createBirthInput({
      birthYear: 1990, birthMonth: 1, birthDay: 15,
      birthHour: 1, birthMinute: 25,
      gender: Gender.FEMALE, timezone: 'Atlantic/Reykjavik',
      longitude: -21.94, latitude: 64.15,
    });
    const result = calculatePillars(input, config);

    expect(result.longitudeCorrectionMinutes).toBe(-88);

    // Clock hour 1 -> CHUK (per formula ((1+1)/2)%12=1)
    const clockBranch = expectedBranchForHour(1);
    expect(clockBranch).toBe(Jiji.CHUK);

    // Adjusted: 01:25 - 88min = 23:57 previous day -> hour 23 -> JA
    expect(result.pillars.hour.jiji).toBe(Jiji.JA);
  });
});
