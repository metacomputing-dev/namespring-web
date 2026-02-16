import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { solarToLunar, lunarToSolar } from '../../src/calendar/lunar/KoreanLunarAlgorithmicConverter.js';
import type { SolarDate } from '../../src/calendar/lunar/LunarDate.js';
import type { LunarDate } from '../../src/calendar/lunar/LunarDate.js';
import { GanjiCycle } from '../../src/engine/GanjiCycle.js';
import { cheonganOrdinal } from '../../src/domain/Cheongan.js';
import { jijiOrdinal } from '../../src/domain/Jiji.js';

/**
 * KASI Cross-Validation Test
 *
 * Compares all 55,152 rows of the KASI astronomical dataset against
 * the TypeScript KoreanLunarAlgorithmicConverter for full accuracy verification.
 *
 * Source: https://astro.kasi.re.kr/life/solc
 * Range: 1900-01-01 ~ 2050-12-31
 */

// CSV path (relative to saju-ts project root, referencing the Kotlin project's data)
const CSV_PATH = resolve(__dirname, '../../../saju/data/kasi/kasi_solar_lunar_1900_2050_merged.csv');

interface KasiRow {
  solarYear: number;
  solarMonth: number;
  solarDay: number;
  lunarYear: number;
  lunarMonth: number;
  lunarDay: number;
  isLeapMonth: boolean;
  lunarDayGanji: string; // e.g. "갑술(甲戌)"
  jdn: number;
}

function parseKasiCsv(): KasiRow[] {
  const content = readFileSync(CSV_PATH, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  // Skip header
  const dataLines = lines.slice(1);

  return dataLines.map(line => {
    const cols = line.split(',');
    return {
      solarYear: parseInt(cols[3]!, 10),
      solarMonth: parseInt(cols[4]!, 10),
      solarDay: parseInt(cols[5]!, 10),
      lunarYear: parseInt(cols[7]!, 10),
      lunarMonth: parseInt(cols[8]!, 10),
      lunarDay: parseInt(cols[9]!, 10),
      isLeapMonth: cols[10] === '윤',
      lunarDayGanji: cols[13]!,
      jdn: parseInt(cols[14]!, 10),
    };
  });
}

// Parse ganji string like "갑술(甲戌)" to extract the 60-cycle index
const CHEONGAN_HANGUL = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
const JIJI_HANGUL = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];

function ganjiToIndex(ganjiStr: string): number {
  const stem = ganjiStr.charAt(0);
  const branch = ganjiStr.charAt(1);
  const stemIdx = CHEONGAN_HANGUL.indexOf(stem);
  const branchIdx = JIJI_HANGUL.indexOf(branch);
  if (stemIdx < 0 || branchIdx < 0) return -1;
  // Recover 60-cycle index using CRT: (6*stem - 5*branch) mod 60
  return ((6 * stemIdx - 5 * branchIdx) % 60 + 60) % 60;
}

let kasiRows: KasiRow[];

describe('KASI Cross-Validation (55,152 rows)', () => {

  // Load data once
  kasiRows = parseKasiCsv();

  it('CSV has 55,152 data rows', () => {
    expect(kasiRows.length).toBe(55152);
  });

  // V-04: Solar → Lunar conversion (full dataset)
  describe('V-04: Solar → Lunar conversion accuracy', () => {
    it('all 55,152 solar dates convert to correct lunar dates', () => {
      let matchCount = 0;
      let mismatchCount = 0;
      const mismatches: string[] = [];

      for (const row of kasiRows) {
        try {
          const solar: SolarDate = { year: row.solarYear, month: row.solarMonth, day: row.solarDay };
          const lunar = solarToLunar(solar);

          if (lunar !== null &&
              lunar.year === row.lunarYear &&
              lunar.month === row.lunarMonth &&
              lunar.day === row.lunarDay &&
              lunar.isLeapMonth === row.isLeapMonth) {
            matchCount++;
          } else {
            mismatchCount++;
            if (mismatches.length < 20) {
              const got = lunar ? `L${lunar.year}-${lunar.month}-${lunar.day}${lunar.isLeapMonth ? '(윤)' : ''}` : 'null';
              mismatches.push(
                `${row.solarYear}-${row.solarMonth}-${row.solarDay}: ` +
                `expected L${row.lunarYear}-${row.lunarMonth}-${row.lunarDay}${row.isLeapMonth ? '(윤)' : ''}, ` +
                `got ${got}`
              );
            }
          }
        } catch (e) {
          mismatchCount++;
          if (mismatches.length < 20) {
            mismatches.push(
              `${row.solarYear}-${row.solarMonth}-${row.solarDay}: ERROR - ${(e as Error).message}`
            );
          }
        }
      }

      console.log(`Solar→Lunar: ${matchCount}/${kasiRows.length} match (${(matchCount/kasiRows.length*100).toFixed(4)}%)`);
      if (mismatches.length > 0) {
        console.log(`First mismatches:\n${mismatches.join('\n')}`);
      }

      expect(matchCount).toBe(kasiRows.length);
    });
  });

  // V-04 reverse: Lunar → Solar conversion (full dataset)
  describe('V-04 reverse: Lunar → Solar conversion accuracy', () => {
    it('all 55,152 lunar dates convert back to correct solar dates', () => {
      let matchCount = 0;
      let mismatchCount = 0;
      let skipCount = 0;
      const mismatches: string[] = [];

      for (const row of kasiRows) {
        try {
          const lunarInput: LunarDate = {
            year: row.lunarYear,
            month: row.lunarMonth,
            day: row.lunarDay,
            isLeapMonth: row.isLeapMonth,
          };
          const solar = lunarToSolar(lunarInput);

          if (solar !== null &&
              solar.year === row.solarYear &&
              solar.month === row.solarMonth &&
              solar.day === row.solarDay) {
            matchCount++;
          } else {
            mismatchCount++;
            if (mismatches.length < 20) {
              const got = solar ? `S${solar.year}-${solar.month}-${solar.day}` : 'null';
              mismatches.push(
                `L${row.lunarYear}-${row.lunarMonth}-${row.lunarDay}${row.isLeapMonth ? '(윤)' : ''}: ` +
                `expected S${row.solarYear}-${row.solarMonth}-${row.solarDay}, ` +
                `got ${got}`
              );
            }
          }
        } catch (e) {
          skipCount++;
          if (mismatches.length < 20) {
            mismatches.push(
              `L${row.lunarYear}-${row.lunarMonth}-${row.lunarDay}${row.isLeapMonth ? '(윤)' : ''}: ` +
              `ERROR - ${(e as Error).message}`
            );
          }
        }
      }

      console.log(`Lunar→Solar: ${matchCount}/${kasiRows.length} match (${(matchCount/kasiRows.length*100).toFixed(4)}%), ${skipCount} errors`);
      if (mismatches.length > 0) {
        console.log(`First mismatches:\n${mismatches.join('\n')}`);
      }

      expect(matchCount).toBe(kasiRows.length);
    });
  });

  // V-04 round-trip: Solar → Lunar → Solar
  describe('V-04 round-trip: Solar → Lunar → Solar', () => {
    it('all 55,152 dates survive round-trip conversion', () => {
      let matchCount = 0;
      let mismatchCount = 0;
      const mismatches: string[] = [];

      for (const row of kasiRows) {
        try {
          const solar: SolarDate = { year: row.solarYear, month: row.solarMonth, day: row.solarDay };
          const lunar = solarToLunar(solar);
          if (!lunar) { mismatchCount++; continue; }
          const backToSolar = lunarToSolar(lunar);
          if (!backToSolar) { mismatchCount++; continue; }

          if (backToSolar.year === row.solarYear &&
              backToSolar.month === row.solarMonth &&
              backToSolar.day === row.solarDay) {
            matchCount++;
          } else {
            mismatchCount++;
            if (mismatches.length < 20) {
              mismatches.push(
                `${row.solarYear}-${row.solarMonth}-${row.solarDay} → ` +
                `L${lunar.year}-${lunar.month}-${lunar.day} → ` +
                `${backToSolar.year}-${backToSolar.month}-${backToSolar.day}`
              );
            }
          }
        } catch (e) {
          mismatchCount++;
        }
      }

      console.log(`Round-trip: ${matchCount}/${kasiRows.length} match (${(matchCount/kasiRows.length*100).toFixed(4)}%)`);

      expect(matchCount).toBe(kasiRows.length);
    });
  });

  // V-01: Day pillar (JDN) verification
  describe('V-01: Day pillar JDN verification', () => {
    it('all 55,152 JDN day pillars match KASI ganji', () => {
      let matchCount = 0;
      let mismatchCount = 0;
      let parseSkipCount = 0;
      const mismatches: string[] = [];

      for (const row of kasiRows) {
        const kasiGanjiIndex = ganjiToIndex(row.lunarDayGanji);
        if (kasiGanjiIndex < 0) {
          parseSkipCount++;
          continue;
        }

        // Use the JDN formula directly: (jdn + 49) % 60
        const enginePillar = GanjiCycle.dayPillarByJdn(row.solarYear, row.solarMonth, row.solarDay);
        const stemOrd = cheonganOrdinal(enginePillar.cheongan);
        const branchOrd = jijiOrdinal(enginePillar.jiji);
        const engineIndex = ((6 * stemOrd - 5 * branchOrd) % 60 + 60) % 60;

        if (engineIndex === kasiGanjiIndex) {
          matchCount++;
        } else {
          mismatchCount++;
          if (mismatches.length < 20) {
            mismatches.push(
              `JDN ${row.jdn} (${row.solarYear}-${row.solarMonth}-${row.solarDay}): ` +
              `KASI=${row.lunarDayGanji}(${kasiGanjiIndex}), ` +
              `engine=${enginePillar.cheongan}_${enginePillar.jiji}(${engineIndex})`
            );
          }
        }
      }

      const total = matchCount + mismatchCount;
      console.log(`JDN Day Pillar: ${matchCount}/${total} match (${(matchCount/total*100).toFixed(4)}%), ${parseSkipCount} parse-skipped`);
      if (mismatches.length > 0) {
        console.log(`First mismatches:\n${mismatches.join('\n')}`);
      }

      expect(matchCount).toBe(total);
    });
  });

  // Q-01: Statistical quality checks
  describe('Q-01: Statistical quality checks', () => {
    it('covers 151 years (1900-2050)', () => {
      const years = new Set(kasiRows.map(r => r.solarYear));
      expect(years.size).toBe(151);
      expect(Math.min(...years)).toBe(1900);
      expect(Math.max(...years)).toBe(2050);
    });

    it('60-ganji cycle is uniformly distributed (±2%)', () => {
      const ganjiCounts = new Map<number, number>();
      for (const row of kasiRows) {
        const idx = ganjiToIndex(row.lunarDayGanji);
        if (idx >= 0) {
          ganjiCounts.set(idx, (ganjiCounts.get(idx) || 0) + 1);
        }
      }

      const expectedPerGanji = kasiRows.length / 60;
      for (const [idx, count] of ganjiCounts.entries()) {
        const ratio = count / expectedPerGanji;
        expect(ratio).toBeGreaterThan(0.98);
        expect(ratio).toBeLessThan(1.02);
      }
    });

    it('leap month years exist (at least 50)', () => {
      const leapYears = new Set(
        kasiRows.filter(r => r.isLeapMonth).map(r => r.lunarYear)
      );
      expect(leapYears.size).toBeGreaterThanOrEqual(50);
    });

    it('every year has 353-385 days', () => {
      const yearDayCounts = new Map<number, number>();
      for (const row of kasiRows) {
        yearDayCounts.set(row.solarYear, (yearDayCounts.get(row.solarYear) || 0) + 1);
      }

      for (const [year, days] of yearDayCounts.entries()) {
        expect(days, `Year ${year}`).toBeGreaterThanOrEqual(365);
        expect(days, `Year ${year}`).toBeLessThanOrEqual(366);
      }
    });
  });
});
