import { describe, it, expect } from 'vitest';
import { koreanDstOffsetMinutes } from '../../src/calendar/time/KoreanDstPeriod.js';

/**
 * Ported from KoreanDstPeriodTest.kt
 *
 * Tests Korean DST period offset lookup:
 * - DST applied during 1988 summer
 * - DST not applied during 1988 winter
 */

describe('KoreanDstPeriod', () => {
  it('DST is applied in 1988 summer', () => {
    // 1988-07-01 is within Korean DST period (1988-05-08 ~ 1988-10-09)
    expect(koreanDstOffsetMinutes(1988, 7, 1)).toBe(60);
  });

  it('DST is not applied in 1988 winter', () => {
    // 1988-12-01 is outside DST period
    expect(koreanDstOffsetMinutes(1988, 12, 1)).toBe(0);
  });
});
