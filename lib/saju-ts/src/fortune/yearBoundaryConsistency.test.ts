import { describe, expect, it } from 'vitest';

import { createEngine } from '../api/engine.js';
import { getLiChunUtcMs } from '../calendar/solarTerms.js';

/**
 * A12 (감사 §2) — yearBoundary 비-liChun 설정에서 연주와 세운의 기준 불일치 회귀 테스트.
 *
 * 계약: 어떤 yearBoundary 설정에서든, 출생 시점을 포함하는 세운 행의 간지는
 * 명식 연주와 일치해야 한다 (연주 규칙과 세운 분절 규칙의 단일 진실).
 * 기본 설정(liChun)의 세운 분절은 수정 전과 바이트 동일해야 한다.
 *
 * 테스트 명식: 2001-01-28 12:00 KST — 설날(2001-01-24)과 입춘(2001-02-04) 사이.
 *  - liChun:        연주 2000 庚辰 (입춘 전)
 *  - lunarNewYear:  연주 2001 辛巳 (설 이후)
 *  - jan1:          연주 2001 辛巳
 */

const BIRTH = '2001-01-28T12:00:00+09:00';
const BIRTH_UTC_MS = Date.parse(BIRTH);

type YearRow = { solarYear: number; pillar: unknown; startUtcMs?: number; endUtcMs?: number };

function analyzeWith(yearBoundary: 'liChun' | 'lunarNewYear' | 'jan1') {
  const engine = createEngine({ calendar: { yearBoundary } } as any);
  const bundle = engine.analyze({ birth: { instant: BIRTH, calendar: 'gregorian' }, sex: 'M' } as any);
  const summary: any = bundle.summary;
  expect(summary?.pillars?.year).toBeTruthy();
  expect(Array.isArray(summary?.fortune?.years)).toBe(true);
  return summary;
}

function rowContaining(years: YearRow[], utcMs: number): YearRow | undefined {
  return years.find((r) => typeof r.startUtcMs === 'number' && typeof r.endUtcMs === 'number' && r.startUtcMs <= utcMs && utcMs < r.endUtcMs);
}

describe('A12 — 연주↔세운 yearBoundary 정합', () => {
  it('기본(liChun): 세운 분절은 입춘 경계와 동일(회귀 가드) + 출생 포함 행 = 연주', () => {
    const summary = analyzeWith('liChun');
    const years: YearRow[] = summary.fortune.years;

    // 회귀 가드: 기본 설정의 분절은 여전히 입춘 시각과 바이트 동일
    for (const r of years.slice(0, 3)) {
      expect(r.startUtcMs).toBe(getLiChunUtcMs(r.solarYear, 'meeus'));
      expect(r.endUtcMs).toBe(getLiChunUtcMs(r.solarYear + 1, 'meeus'));
    }

    const row = rowContaining(years, BIRTH_UTC_MS);
    expect(row).toBeTruthy();
    expect(row!.solarYear).toBe(2000); // 입춘 전 출생 → 2000년 세운
    expect(row!.pillar).toEqual(summary.pillars.year); // 庚辰
  });

  it('lunarNewYear: 설 이후 출생 → 연주·세운 모두 2001 辛巳로 정합', () => {
    const summary = analyzeWith('lunarNewYear');
    const years: YearRow[] = summary.fortune.years;

    const row = rowContaining(years, BIRTH_UTC_MS);
    expect(row).toBeTruthy();
    expect(row!.solarYear).toBe(2001); // 설(1/24) 이후 출생
    expect(row!.pillar).toEqual(summary.pillars.year); // 辛巳
    // 분절이 실제로 설 경계로 전환됐는지(입춘과 다른 시각) 확인
    expect(row!.startUtcMs).not.toBe(getLiChunUtcMs(2001, 'meeus'));
  });

  it('jan1: 연주·세운 모두 2001 辛巳, 세운 분절은 현지 1/1 00:00', () => {
    const summary = analyzeWith('jan1');
    const years: YearRow[] = summary.fortune.years;

    const row = rowContaining(years, BIRTH_UTC_MS);
    expect(row).toBeTruthy();
    expect(row!.solarYear).toBe(2001);
    expect(row!.pillar).toEqual(summary.pillars.year); // 辛巳
    // 2001-01-01 00:00 KST = 2000-12-31T15:00:00Z
    expect(row!.startUtcMs).toBe(Date.parse('2000-12-31T15:00:00Z'));
  });

  it('전 설정 공통: 세운 행은 빈틈없이 연속(k.end === k+1.start)', () => {
    for (const yb of ['liChun', 'lunarNewYear', 'jan1'] as const) {
      const years: YearRow[] = analyzeWith(yb).fortune.years;
      for (let k = 0; k + 1 < years.length; k++) {
        expect(years[k]!.endUtcMs).toBe(years[k + 1]!.startUtcMs);
      }
    }
  });

  it('월운 앵커는 yearBoundary와 무관하게 절기 기준(출생 포함 창 유지)', () => {
    for (const yb of ['liChun', 'lunarNewYear', 'jan1'] as const) {
      const summary = analyzeWith(yb);
      const months: YearRow[] = summary.fortune.months ?? [];
      expect(months.length).toBeGreaterThan(0);
      // 출생 시점이 월운 창 안에 있어야 한다 (비-liChun에서 앵커가 흔들리면 깨짐)
      const containing = months.find(
        (m: any) => m.startUtcMs <= BIRTH_UTC_MS && BIRTH_UTC_MS < m.endUtcMs,
      );
      expect(containing).toBeTruthy();
    }
  });
});
