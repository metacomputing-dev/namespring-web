import type { EngineConfig, SajuRequest } from '../api/types.js';
import type { JieBoundariesAround, JieTermId, SolarTermMethod, SolarTermInstant } from '../calendar/solarTerms.js';
import { getJieBoundaries, getLiChunUtcMs, jieTermMonthOrder } from '../calendar/solarTerms.js';
import type { LocalDate } from '../calendar/iso.js';
import type { LocalDateTime } from '../calendar/iso.js';
import { addDays, calcDayPillar, calcMonthPillarFromOrder, effectiveDayDate } from '../calendar/pillars.js';
import type { PillarIdx, StemIdx } from '../core/cycle.js';
import { pillar as makePillar, stemYinYang } from '../core/cycle.js';
import { mod } from '../core/mod.js';
import type {
  AgePartsApprox,
  DayLuck,
  FortuneDirection,
  FortunePolicy,
  FortuneTimeline,
  FortuneStart,
  MonthLuck,
  StartAgeMethodSpec,
  DecadeLuck,
  YearLuck,
} from './types.js';
import { assertFortuneHorizonPolicy } from './policy.js';

const MS_PER_DAY = 86_400_000;
const AVG_DAYS_PER_YEAR = 365.2425;

function shiftPillar(p: PillarIdx, steps: number): PillarIdx {
  return { stem: mod(p.stem + steps, 10), branch: mod(p.branch + steps, 12) };
}

function dirSign(d: FortuneDirection): number {
  return d === 'FORWARD' ? 1 : -1;
}

function computeDirection(sex: SajuRequest['sex'], yearStem: StemIdx, rule: FortunePolicy['directionRule']): FortuneDirection {
  if (rule === 'fixedForward') return 'FORWARD';
  if (rule === 'fixedBackward') return 'BACKWARD';

  // Default: 男陽順 / 男陰逆 / 女陽逆 / 女陰順 (sex-yearStemYinYang)
  if (sex !== 'M' && sex !== 'F') return 'FORWARD';
  const yy = stemYinYang(yearStem);
  const sign = (sex === 'M' ? 1 : -1) * (yy === 'YANG' ? 1 : -1);
  return sign >= 0 ? 'FORWARD' : 'BACKWARD';
}

function findPrevNextJie(utcMs: number, boundaries: JieBoundariesAround): { prev: { id: JieTermId; utcMs: number } | null; next: { id: JieTermId; utcMs: number } | null } {
  let prev: { id: JieTermId; utcMs: number } | null = null;
  let next: { id: JieTermId; utcMs: number } | null = null;

  for (const t of boundaries.terms) {
    const id = t.id as JieTermId; // boundaries are 12-terms
    if (t.utcMs <= utcMs) prev = { id, utcMs: t.utcMs };
    else {
      next = { id, utcMs: t.utcMs };
      break;
    }
  }

  return { prev, next };
}

function startAgeYears(deltaMs: number, method: FortunePolicy['startAgeMethod']): { years: number; formula: string; parts?: AgePartsApprox } {
  const deltaDays = deltaMs / MS_PER_DAY;

  const approxPartsFromYears = (y: number): AgePartsApprox => {
    const years = Math.max(0, Math.floor(y));
    const remY = Math.max(0, y - years);
    const months = Math.max(0, Math.floor(remY * 12));
    const remM = Math.max(0, remY * 12 - months);
    const days = Math.max(0, Math.round(remM * 30));
    return { years, months, days };
  };

  const ratioDays = (daysPerYear: number, label: string) => {
    const years = deltaDays / daysPerYear;
    return { years, formula: `startAgeYears = (Δdays / ${daysPerYear})  // ${label}`, parts: approxPartsFromYears(years) };
  };

  if (method === 'threeDaysOneYear') {
    return { ...ratioDays(3, '三日一歲'), formula: 'startAgeYears = (Δdays / 3)  // 三日一歲' };
  }
  if (method === 'oneDayFourMonths') {
    // Equivalent to 三日一歲
    return ratioDays(3, '一日四月 ≡ 三日一歲');
  }

  if (typeof method === 'object' && method && !Array.isArray(method)) {
    const m: any = method;
    if (m.kind === 'ratioDaysPerYear') {
      const dpy = m.daysPerYear;
      if (typeof dpy === 'number' && Number.isFinite(dpy) && dpy > 0) {
        return ratioDays(dpy, m.label ?? `ratioDaysPerYear(${dpy})`);
      }
    }
    if (m.kind === 'ratioMsPerYear') {
      const mpy = m.msPerYear;
      if (typeof mpy === 'number' && Number.isFinite(mpy) && mpy > 0) {
        const years = deltaMs / mpy;
        return { years, formula: `startAgeYears = (Δms / ${mpy})  // ${m.label ?? `ratioMsPerYear(${mpy})`}`, parts: approxPartsFromYears(years) };
      }
    }
  }

  // Fallback to 三日一歲.
  return ratioDays(3, '三日一歲(fallback)');
}

/**
 * 표기용 정수 대운수 (감사 B11). deltaDays 기반으로 유파별 반올림을 적용하고
 * minStartAge 하한을 건다. 연속값(startAgeYears)은 별도로 병존한다.
 */
function daysPerYearOfMethod(method: FortunePolicy['startAgeMethod']): number {
  if (method === 'threeDaysOneYear' || method === 'oneDayFourMonths') return 3;
  if (typeof method === 'object' && method) {
    const m: any = method;
    if (m.kind === 'ratioDaysPerYear' && Number.isFinite(m.daysPerYear) && m.daysPerYear > 0) return m.daysPerYear;
    if (m.kind === 'ratioMsPerYear' && Number.isFinite(m.msPerYear) && m.msPerYear > 0) return m.msPerYear / MS_PER_DAY;
  }
  return 3;
}

function startAgeDisplayOf(
  startAgeYears: number,
  policy: FortunePolicy,
): number {
  const rounding = policy.startAgeRounding ?? 'none';
  const floorYears = Math.max(0, Math.floor(startAgeYears));
  // 나머지를 해당 유파의 '일수'로 환산 (3일=1년 기본, 커스텀 환산비 지원).
  const remDays = (startAgeYears - floorYears) * daysPerYearOfMethod(policy.startAgeMethod);

  let display: number;
  switch (rounding) {
    case 'round1down2up':
      // 나머지 1일 버림·2일 올림 (다수 관행) — 2일 이상이면 올림.
      display = remDays >= 2 ? floorYears + 1 : floorYears;
      break;
    case 'threshold8months':
      // 나머지를 1일=4개월로 환산해 8개월 초과 시 올림 (삼명통회 계열).
      display = remDays * 4 > 8 ? floorYears + 1 : floorYears;
      break;
    case 'ceil':
      display = Math.ceil(startAgeYears);
      break;
    case 'floor':
    case 'none':
    default:
      display = floorYears;
      break;
  }

  return Math.max(policy.minStartAge ?? 0, display);
}

function localToUtcMs(date: LocalDate, time: { h: number; min: number }, offsetMinutes: number): number {
  return Date.UTC(date.y, date.m - 1, date.d, time.h, time.min, 0) - offsetMinutes * 60_000;
}

function daySegmentBounds(labelDate: LocalDate, dayBoundary: EngineConfig['calendar']['dayBoundary'], offsetMinutes: number): { startUtcMs: number; endUtcMs: number } {
  if (dayBoundary === 'ziSplit23') {
    const startDate = addDays(labelDate, -1);
    return {
      startUtcMs: localToUtcMs(startDate, { h: 23, min: 0 }, offsetMinutes),
      endUtcMs: localToUtcMs(labelDate, { h: 23, min: 0 }, offsetMinutes),
    };
  }
  // default: midnight
  return {
    startUtcMs: localToUtcMs(labelDate, { h: 0, min: 0 }, offsetMinutes),
    endUtcMs: localToUtcMs(addDays(labelDate, 1), { h: 0, min: 0 }, offsetMinutes),
  };
}

function addYearsUtc(utcMs: number, years: number): number {
  const d = new Date(utcMs);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.getTime();
}

function yearPillarOfSolarYear(y: number): PillarIdx {
  // Same formula as calcYearPillarFromLiChunUtc after applying LiChun boundary:
  // stem = (y-4) mod 10, branch = (y-4) mod 12
  return makePillar(mod(y - 4, 10), mod(y - 4, 12));
}

function approxAgeYears(birthUtcMs: number, utcMs: number): number {
  return (utcMs - birthUtcMs) / (MS_PER_DAY * AVG_DAYS_PER_YEAR);
}

export function computeFortuneTimeline(args: {
  request: SajuRequest;
  parsedUtcMs: number;
  birthLocalDateTime: LocalDateTime;
  localYear: number;
  calendar: EngineConfig['calendar'];
  solarTermMethod: SolarTermMethod;
  jieBoundariesAround: JieBoundariesAround | null;
  natalYearPillar: PillarIdx;
  natalMonthPillar: PillarIdx;
  policy: FortunePolicy;
}): FortuneTimeline {
  const { request, parsedUtcMs, birthLocalDateTime, localYear, solarTermMethod, jieBoundariesAround, natalYearPillar, natalMonthPillar, policy, calendar } = args;
  assertFortuneHorizonPolicy(policy);

  if (!jieBoundariesAround) {
    // If boundaries are not computed (policy doesn't need them), fall back to a trivial timeline.
    // boundary is null — a fabricated LICHUN-at-birth value would be indistinguishable
    // from a real solar-term instant downstream (감사 A15b).
    const direction = computeDirection(request.sex, natalYearPillar.stem, policy.directionRule);
    const start: FortuneStart = {
      direction,
      boundary: null,
      deltaMs: 0,
      startAgeYears: 0,
      startAgeDisplay: startAgeDisplayOf(0, policy),
      startUtcMsApprox: parsedUtcMs,
      formula: 'startAgeYears = 0 (no solar-term boundaries available)',
    };
    return { policy, start, decades: [], years: [] };
  }

  const direction = computeDirection(request.sex, natalYearPillar.stem, policy.directionRule);
  const { prev, next } = findPrevNextJie(parsedUtcMs, jieBoundariesAround);

  const boundary = direction === 'FORWARD' ? next ?? prev : prev ?? next;
  if (!boundary) throw new Error('Invariant: unable to find any jie boundary');

  const deltaMs = Math.abs(boundary.utcMs - parsedUtcMs);
  const { years: startAge, formula, parts } = startAgeYears(deltaMs, policy.startAgeMethod);

  // Birth + startAgeYears (using tropical average year) — for UI only.
  const startUtcMsApprox = Math.round(parsedUtcMs + startAge * (MS_PER_DAY * AVG_DAYS_PER_YEAR));

  const start: FortuneStart = {
    direction,
    boundary: { id: boundary.id, utcMs: boundary.utcMs },
    deltaMs,
    startAgeYears: startAge,
    startAgeDisplay: startAgeDisplayOf(startAge, policy),
    startAgeParts: parts,
    startUtcMsApprox,
    formula,
  };

  // --- Decades (大運)
  const decades: DecadeLuck[] = [];
  const sgn = dirSign(direction);
  const decadeLen = policy.decadeLengthYears;
  const offset = policy.firstDecadeOffsetSteps;

  for (let i = 0; i < policy.maxDecades; i++) {
    const step = sgn * (offset + i);
    const pillar = shiftPillar(natalMonthPillar, step);

    const startAgeYears = startAge + i * decadeLen;
    const endAgeYears = startAgeYears + decadeLen;

    const rec: DecadeLuck = {
      kind: 'DECADE',
      index: i,
      startAgeYears,
      endAgeYears,
      pillar,
    };

    if (policy.axis === 'utcByGregorianYear') {
      // Interpret axis as “a human-friendly Gregorian timeline starting from the (approx) 起運 moment”.
      rec.startUtcMs = addYearsUtc(startUtcMsApprox, i * decadeLen);
      rec.endUtcMs = addYearsUtc(startUtcMsApprox, (i + 1) * decadeLen);
    }

    decades.push(rec);
  }

  // --- Years (歲運) by LiChun solar year boundary
  const liChunThisLocalYearUtcMs = getLiChunUtcMs(localYear, solarTermMethod);
  const baseSolarYear = calendar.yearBoundary === 'liChun' && parsedUtcMs < liChunThisLocalYearUtcMs ? localYear - 1 : localYear;

  const years: YearLuck[] = [];
  for (let k = 0; k < policy.maxYears; k++) {
    const y = baseSolarYear + k;
    const startUtcMs = getLiChunUtcMs(y, solarTermMethod);
    const endUtcMs = getLiChunUtcMs(y + 1, solarTermMethod);

    years.push({
      kind: 'YEAR',
      solarYear: y,
      pillar: yearPillarOfSolarYear(y),
      startUtcMs,
      endUtcMs,
      approxStartAgeYears: approxAgeYears(parsedUtcMs, startUtcMs),
      approxEndAgeYears: approxAgeYears(parsedUtcMs, endUtcMs),
    });
  }

  // --- Months (月運) segments by jie boundaries
  let months: MonthLuck[] | undefined;
  if (policy.maxMonths > 0) {
    const spanYears = Math.ceil(policy.maxMonths / 12) + 2;
    const terms: SolarTermInstant[] = [];
    for (let y = baseSolarYear; y <= baseSolarYear + spanYears; y++) {
      terms.push(...getJieBoundaries(y, solarTermMethod));
    }
    terms.sort((a, b) => a.utcMs - b.utcMs);

    const startIdx = terms.findIndex((t) => t.year === baseSolarYear && t.id === 'LICHUN');
    if (startIdx >= 0) {
      months = [];
      let solarYearCursor = baseSolarYear;

      for (let i = 0; i < policy.maxMonths; i++) {
        const a = terms[startIdx + i];
        const b = terms[startIdx + i + 1];
        if (!a || !b) break;

        // When a new LICHUN boundary appears (after the initial one), we enter the next solar-year.
        if (i > 0 && a.id === 'LICHUN') solarYearCursor += 1;

        const mo = jieTermMonthOrder(a.id as any);
        const yearStem = yearPillarOfSolarYear(solarYearCursor).stem;
        const pillar = calcMonthPillarFromOrder(yearStem, mo);

        months.push({
          kind: 'MONTH',
          solarYear: solarYearCursor,
          monthOrder: mo,
          startJie: a.id as any,
          pillar,
          startUtcMs: a.utcMs,
          endUtcMs: b.utcMs,
          approxStartAgeYears: approxAgeYears(parsedUtcMs, a.utcMs),
          approxEndAgeYears: approxAgeYears(parsedUtcMs, b.utcMs),
        });
      }
    }
  }

  // --- Days (日運) segments by local day boundary policy
  let days: DayLuck[] | undefined;
  if (policy.maxDays > 0) {
    const baseLabelDate = effectiveDayDate(birthLocalDateTime, calendar.dayBoundary);
    days = [];
    for (let i = 0; i < policy.maxDays; i++) {
      const label = addDays(baseLabelDate, i);
      const pillar = calcDayPillar(label);
      const { startUtcMs, endUtcMs } = daySegmentBounds(label, calendar.dayBoundary, birthLocalDateTime.offsetMinutes);

      days.push({
        kind: 'DAY',
        localDate: { y: label.y, m: label.m, d: label.d },
        pillar,
        startUtcMs,
        endUtcMs,
        approxStartAgeYears: approxAgeYears(parsedUtcMs, startUtcMs),
        approxEndAgeYears: approxAgeYears(parsedUtcMs, endUtcMs),
      });
    }
  }

  return { policy, start, decades, years, months, days };
}
