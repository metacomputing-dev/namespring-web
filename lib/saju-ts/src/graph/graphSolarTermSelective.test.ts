import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../calendar/solarTerms.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../calendar/solarTerms.js')>();
  return {
    ...actual,
    getJieBoundariesAround: vi.fn(actual.getJieBoundariesAround),
    getSolarTermsAround: vi.fn(actual.getSolarTermsAround),
  };
});

import { createEngine } from '../api/engine.js';
import {
  getJieBoundariesAround,
  getSolarTermsAround,
  isJieTermId,
} from '../calendar/solarTerms.js';
import { analyzeSaju } from '../compat/springLegacy.js';

const mockedGetJieBoundariesAround = vi.mocked(getJieBoundariesAround);
const mockedGetSolarTermsAround = vi.mocked(getSolarTermsAround);

function requestForYear(year: number) {
  return {
    birth: {
      instant: `${year}-06-15T12:00:00+09:00`,
      calendar: 'gregorian' as const,
    },
    sex: 'M' as const,
    location: { lat: 37.5665, lon: 126.978, name: 'Seoul' },
  };
}

function approxConfig(alwaysCompute: boolean) {
  return {
    calendar: {
      solarTerms: { method: 'approx', alwaysCompute },
    },
  } as any;
}

function calendarFacts(bundle: ReturnType<ReturnType<typeof createEngine>['analyze']>) {
  const facts = bundle.report.facts as Record<string, any>;
  return {
    solar: facts['calendar.solarTermsAround'],
    jie: facts['calendar.jieBoundariesAround'],
  };
}

describe('selective solar-term graph materialization', () => {
  beforeEach(() => {
    mockedGetJieBoundariesAround.mockClear();
    mockedGetSolarTermsAround.mockClear();
  });

  it('materializes only 36 Jie boundaries on the default pillar/fortune path', () => {
    const year = 6081;
    const bundle = createEngine(approxConfig(false)).analyze(requestForYear(year));
    const { solar, jie } = calendarFacts(bundle);

    expect(mockedGetJieBoundariesAround).toHaveBeenCalledOnce();
    expect(mockedGetJieBoundariesAround).toHaveBeenCalledWith(
      year,
      'approx',
      'bisection',
      'constant',
      'classical',
    );
    expect(mockedGetSolarTermsAround).not.toHaveBeenCalled();
    expect(solar.terms).toHaveLength(36);
    expect(solar.terms.every((term: any) => isJieTermId(term.id))).toBe(true);
    expect(jie).toEqual(solar);
  });

  it('preserves the exact 72-term contract when alwaysCompute is enabled', () => {
    const year = 6085;
    const bundle = createEngine(approxConfig(true)).analyze(requestForYear(year));
    const { solar, jie } = calendarFacts(bundle);

    expect(mockedGetSolarTermsAround).toHaveBeenCalledOnce();
    expect(mockedGetSolarTermsAround).toHaveBeenCalledWith(
      year,
      'approx',
      'bisection',
      'constant',
      'classical',
    );
    expect(mockedGetJieBoundariesAround).not.toHaveBeenCalled();
    expect(solar.terms).toHaveLength(72);
    expect(jie.terms).toHaveLength(36);
    expect(jie.terms).toEqual(solar.terms.filter((term: any) => isJieTermId(term.id)));
  });

  it('keeps the public summary byte-identical to full materialization', () => {
    const request = requestForYear(6083);
    const selective = createEngine(approxConfig(false)).analyze(request);
    const full = createEngine(approxConfig(true)).analyze(request);

    expect(JSON.stringify(selective.summary)).toBe(JSON.stringify(full.summary));
    expect(calendarFacts(selective).solar.terms).toEqual(
      calendarFacts(full).solar.terms.filter((term: any) => isJieTermId(term.id)),
    );
  });

  it('keeps the complete legacy bridge output, including Jie proximity, byte-identical', () => {
    const birth = {
      birthYear: 6084,
      birthMonth: 6,
      birthDay: 15,
      birthHour: 12,
      birthMinute: 0,
      gender: 'MALE' as const,
      calendarType: 'SOLAR' as const,
    };
    const selective = analyzeSaju(birth, approxConfig(false));
    const full = analyzeSaju(birth, approxConfig(true));

    expect(selective.jieProximity).not.toBeNull();
    expect(JSON.stringify(selective)).toBe(JSON.stringify(full));
  });
});
