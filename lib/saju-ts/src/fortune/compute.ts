import type { EngineConfig, SajuRequest } from '../api/types.js';
import type {
  JieBoundariesAround,
  JieTermId,
  SolarTermAlgorithm,
  SolarTermMethod,
  SolarTermInstant,
} from '../calendar/solarTerms.js';
import { getJieBoundaries, getLiChunUtcMs, jieTermMonthOrder } from '../calendar/solarTerms.js';
import type { AberrationModel, SolarPrecision } from '../calendar/solar.js';
import type { LocalDate } from '../calendar/iso.js';
import type { LocalDateTime } from '../calendar/iso.js';
import { computeLunarNewYearBoundary } from '../calendar/lunarNewYear.js';
import { addDays, calcDayPillar, calcMonthPillarFromOrder, effectiveDayDate } from '../calendar/pillars.js';
import { utcMsFromParts } from '../calendar/utc.js';
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

const MS_PER_DAY = 86_400_000;
const AVG_DAYS_PER_YEAR = 365.2425;

interface SolarTermComputationPolicy {
  method: SolarTermMethod;
  algorithm: SolarTermAlgorithm;
  aberrationModel: AberrationModel;
  solarPrecision: SolarPrecision;
}

function resolveSolarTermComputationPolicy(
  calendar: EngineConfig['calendar'],
  method: SolarTermMethod,
): SolarTermComputationPolicy {
  return {
    method,
    algorithm: calendar.solarTerms?.algorithm === 'newton' ? 'newton' : 'bisection',
    aberrationModel: calendar.aberrationModel === 'rCorrected' ? 'rCorrected' : 'constant',
    solarPrecision:
      calendar.solarPrecision === 'iau1980_full'
        ? 'iau1980_full'
        : calendar.solarPrecision === 'iau1980_top10'
          ? 'iau1980_top10'
          : 'classical',
  };
}

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

// Keep documented day boundaries stable across division/multiplication round-off.
// 1e-9 day is 0.0864 ms, small enough to preserve the explicit +/-1 ms contract.
const START_AGE_ROUNDING_EPSILON_DAYS = 1e-9;

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
      display = remDays >= 2 - START_AGE_ROUNDING_EPSILON_DAYS ? floorYears + 1 : floorYears;
      break;
    case 'threshold8months':
      // 나머지를 1일=4개월로 환산해 8개월 초과 시 올림 (삼명통회 계열).
      display = remDays - 2 > START_AGE_ROUNDING_EPSILON_DAYS ? floorYears + 1 : floorYears;
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
  return utcMsFromParts(date.y, date.m - 1, date.d, time.h, time.min) - offsetMinutes * 60_000;
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

function localYearAtUtc(utcMs: number, offsetMinutes: number): number {
  return new Date(utcMs + offsetMinutes * 60_000).getUTCFullYear();
}

function yearBoundaryStartUtcMs(
  y: number,
  calendar: EngineConfig['calendar'],
  offsetMinutes: number,
  solarTermPolicy: SolarTermComputationPolicy,
): number {
  if (calendar.yearBoundary === 'lunarNewYear') {
    return computeLunarNewYearBoundary(y, offsetMinutes, solarTermPolicy.method).boundaryUtcMs;
  }
  if (calendar.yearBoundary === 'jan1') {
    return localToUtcMs({ y, m: 1, d: 1 }, { h: 0, min: 0 }, offsetMinutes);
  }
  return getLiChunUtcMs(
    y,
    solarTermPolicy.method,
    solarTermPolicy.algorithm,
    solarTermPolicy.aberrationModel,
    solarTermPolicy.solarPrecision,
  );
}

function yearLabelAtUtc(
  utcMs: number,
  calendar: EngineConfig['calendar'],
  offsetMinutes: number,
  solarTermPolicy: SolarTermComputationPolicy,
): number {
  const y = localYearAtUtc(utcMs, offsetMinutes);
  return utcMs < yearBoundaryStartUtcMs(y, calendar, offsetMinutes, solarTermPolicy) ? y - 1 : y;
}

function ageDisplayLabelOf(mode: FortunePolicy['ageDisplay']): string {
  return mode === 'koreanCountingAge'
    ? 'Korean counting age by configured year boundary'
    : 'Continuous age from birth';
}

function displayAgeAt(
  ageYears: number,
  utcMsApprox: number,
  birthUtcMs: number,
  calendar: EngineConfig['calendar'],
  offsetMinutes: number,
  solarTermPolicy: SolarTermComputationPolicy,
  policy: FortunePolicy,
): number {
  if (policy.ageDisplay !== 'koreanCountingAge') return startAgeDisplayOf(ageYears, policy);
  const birthYear = yearLabelAtUtc(birthUtcMs, calendar, offsetMinutes, solarTermPolicy);
  const targetYear = yearLabelAtUtc(utcMsApprox, calendar, offsetMinutes, solarTermPolicy);
  return Math.max(1, targetYear - birthYear + 1);
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
  const solarTermPolicy = resolveSolarTermComputationPolicy(calendar, solarTermMethod);

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
      startAgeDisplay: displayAgeAt(0, parsedUtcMs, parsedUtcMs, calendar, birthLocalDateTime.offsetMinutes, solarTermPolicy, policy),
      ageDisplay: policy.ageDisplay,
      ageDisplayLabel: ageDisplayLabelOf(policy.ageDisplay),
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
    startAgeDisplay: displayAgeAt(startAge, startUtcMsApprox, parsedUtcMs, calendar, birthLocalDateTime.offsetMinutes, solarTermPolicy, policy),
    ageDisplay: policy.ageDisplay,
    ageDisplayLabel: ageDisplayLabelOf(policy.ageDisplay),
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
    const approxStartUtcMs = addYearsUtc(startUtcMsApprox, i * decadeLen);
    const approxEndUtcMs = addYearsUtc(startUtcMsApprox, (i + 1) * decadeLen);

    const rec: DecadeLuck = {
      kind: 'DECADE',
      index: i,
      startAgeYears,
      endAgeYears,
      displayStartAge: displayAgeAt(startAgeYears, approxStartUtcMs, parsedUtcMs, calendar, birthLocalDateTime.offsetMinutes, solarTermPolicy, policy),
      displayEndAge: displayAgeAt(endAgeYears, approxEndUtcMs, parsedUtcMs, calendar, birthLocalDateTime.offsetMinutes, solarTermPolicy, policy),
      pillar,
    };

    if (policy.axis === 'utcByGregorianYear') {
      // Interpret axis as approximate human-friendly Gregorian timeline starting from the daeun moment.
      rec.startUtcMs = approxStartUtcMs;
      rec.endUtcMs = approxEndUtcMs;
    }

    decades.push(rec);
  }

  // --- Years (歲運) segmented by the configured year boundary.
  // A12: natal year pillar (calcYearPillarFromLiChunUtc) honors calendar.yearBoundary
  // (liChun/lunarNewYear/jan1), so 세운 labels and segments must follow the same rule —
  // otherwise under non-liChun configs the 세운 row containing birth disagrees with the
  // natal year pillar. Default (liChun) behavior is byte-identical to the previous code.
  const yearStartUtcMs = (y: number): number =>
    yearBoundaryStartUtcMs(y, calendar, birthLocalDateTime.offsetMinutes, solarTermPolicy);
  const baseSolarYear = parsedUtcMs < yearStartUtcMs(localYear) ? localYear - 1 : localYear;

  const years: YearLuck[] = [];
  for (let k = 0; k < policy.maxYears; k++) {
    const y = baseSolarYear + k;
    const startUtcMs = yearStartUtcMs(y);
    const endUtcMs = yearStartUtcMs(y + 1);

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
  // Months are always jie-based regardless of calendar.yearBoundary (월주·월운은 절기 기준),
  // so the enumeration anchor uses the liChun-adjusted year — not the year-boundary-adjusted
  // baseSolarYear above. Identical under the default (liChun) config.
  let months: MonthLuck[] | undefined;
  if (policy.maxMonths > 0) {
    const jieBaseSolarYear =
      parsedUtcMs <
      getLiChunUtcMs(
        localYear,
        solarTermPolicy.method,
        solarTermPolicy.algorithm,
        solarTermPolicy.aberrationModel,
        solarTermPolicy.solarPrecision,
      )
        ? localYear - 1
        : localYear;
    const spanYears = Math.ceil(policy.maxMonths / 12) + 2;
    const terms: SolarTermInstant[] = [];
    for (let y = jieBaseSolarYear; y <= jieBaseSolarYear + spanYears; y++) {
      terms.push(
        ...getJieBoundaries(
          y,
          solarTermPolicy.method,
          solarTermPolicy.algorithm,
          solarTermPolicy.aberrationModel,
          solarTermPolicy.solarPrecision,
        ),
      );
    }
    terms.sort((a, b) => a.utcMs - b.utcMs);

    const startIdx = terms.findIndex((t) => t.year === jieBaseSolarYear && t.id === 'LICHUN');
    if (startIdx >= 0) {
      months = [];
      let solarYearCursor = jieBaseSolarYear;

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
