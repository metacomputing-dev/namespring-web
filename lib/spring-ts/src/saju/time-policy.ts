import type {
  SajuAnalysisReasonCode,
  SpringRequest,
} from '../types.js';

type PolicyToggle = 'on' | 'off';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export type LegacyLongitudeCorrectionPolicy =
  | { readonly mode: 'off' }
  | { readonly mode: 'civilOffsetMeridian' }
  | { readonly mode: 'fixedMeridian'; readonly meridianDeg: number };

export interface LegacySajuTimePolicyPatch {
  readonly trueSolarTimeEnabled: boolean;
  readonly includeEquationOfTime: boolean;
  readonly longitudeCorrectionPolicy: LegacyLongitudeCorrectionPolicy;
  readonly yazaEnabled: boolean;
  readonly yazaMode?: 'YAZA_23_TO_01_NEXTDAY' | 'YAZA_23_30_TO_01_30_NEXTDAY';
  readonly dayCutMode:
    | 'MIDNIGHT_00'
    | 'YAZA_23_TO_01_NEXTDAY'
    | 'YAZA_23_30_TO_01_30_NEXTDAY';
}

export interface CivilDateTimeMinute {
  readonly y: number;
  readonly m: number;
  readonly d: number;
  readonly h: number;
  readonly min: number;
}

export type CivilOffsetResolver = (
  timeZone: string,
  civil: CivilDateTimeMinute,
) => number;

export type KnownHourCivilTimePreflight =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reasonCode: SajuAnalysisReasonCode;
    };

export class LegacyPresetMeridianUnavailableError extends Error {
  readonly code = 'SPRING_LEGACY_PRESET_MERIDIAN_UNAVAILABLE';

  constructor() {
    super('The selected legacy preset does not provide a finite LMT meridian.');
    this.name = 'LegacyPresetMeridianUnavailableError';
  }
}

/** Maps saju-ts timezone failures onto Spring's stable public diagnostics. */
export function legacyTimeFailureReasonCode(
  error: unknown,
): SajuAnalysisReasonCode | null {
  const code = error && typeof error === 'object'
    ? (error as { readonly code?: unknown }).code
    : undefined;

  if (code === 'SAJU_LEGACY_TIMEZONE_INVALID') return 'BIRTH_TIMEZONE_INVALID';
  if (code === 'SAJU_LEGACY_TIMEZONE_DATA_UNSUPPORTED') {
    return 'BIRTH_TIMEZONE_DATA_UNSUPPORTED';
  }
  if (code === 'SAJU_LEGACY_TIME_NONEXISTENT') return 'BIRTH_TIME_NONEXISTENT';
  if (code === 'SAJU_LEGACY_TIME_AMBIGUOUS') return 'BIRTH_TIME_AMBIGUOUS';
  if (code === 'SAJU_LEGACY_BIRTH_LOCATION_PARTIAL') return 'BIRTH_LOCATION_PARTIAL';
  if (code === 'SAJU_LEGACY_BIRTH_LOCATION_INVALID') return 'BIRTH_LOCATION_INVALID';
  return null;
}

/**
 * Verifies every civil minute represented by a known-hour/missing-minute input.
 * This is deliberately a timezone-only preflight: the expensive saju analysis
 * still runs only for the established :00 and :59 endpoint comparison.
 */
export function preflightKnownHourCivilTimeRange(args: {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly timeZone: string;
  readonly resolveOffsetMinutes: CivilOffsetResolver | undefined;
}): KnownHourCivilTimePreflight {
  if (typeof args.resolveOffsetMinutes !== 'function') {
    return { ok: false, reasonCode: 'SAJU_CALCULATION_FAILED' };
  }

  for (let minute = 0; minute < 60; minute += 1) {
    try {
      const offsetMinutes = args.resolveOffsetMinutes(args.timeZone, {
        y: args.year,
        m: args.month,
        d: args.day,
        h: args.hour,
        min: minute,
      });
      if (!Number.isFinite(offsetMinutes)) {
        return { ok: false, reasonCode: 'SAJU_CALCULATION_FAILED' };
      }
    } catch (error) {
      const reasonCode = legacyTimeFailureReasonCode(error);
      return {
        ok: false,
        reasonCode:
          reasonCode === 'BIRTH_TIME_NONEXISTENT'
          || reasonCode === 'BIRTH_TIME_AMBIGUOUS'
            ? 'BIRTH_TIME_RANGE_TRANSITION'
            : (reasonCode ?? 'SAJU_CALCULATION_FAILED'),
      };
    }
  }

  return { ok: true };
}

function resolvePolicyToggle(value: unknown, fallback: PolicyToggle): PolicyToggle {
  return value === 'on' || value === 'off' ? value : fallback;
}

/** Runtime validation for the public JSON/API time-policy surface. */
export function isValidSajuTimePolicy(
  options: SpringRequest['options'] | undefined,
): boolean {
  const policy = options?.sajuTimePolicy as unknown;
  if (policy === undefined) return true;
  if (!isRecord(policy)) return false;

  const validToggle = (value: unknown) =>
    value === undefined || value === 'on' || value === 'off';
  return validToggle(policy['trueSolarTime'])
    && validToggle(policy['longitudeCorrection'])
    && validToggle(policy['yaza'])
    && (
      policy['longitudeReference'] === undefined
      || policy['longitudeReference'] === 'civilOffsetMeridian'
      || policy['longitudeReference'] === 'legacyPreset'
    )
    && (
      policy['yazaMode'] === undefined
      || policy['yazaMode'] === '23:00'
      || policy['yazaMode'] === '23:30'
    );
}

export function isLongitudeCorrectionEnabled(
  options: SpringRequest['options'] | undefined,
): boolean {
  return resolvePolicyToggle(options?.sajuTimePolicy?.longitudeCorrection, 'on') === 'on';
}

/** Maps Spring's product policy onto the saju-ts legacy compatibility seam. */
export function toLegacySajuTimePolicyConfig(
  options: SpringRequest['options'] | undefined,
  legacyPresetMeridian?: number,
): LegacySajuTimePolicyPatch {
  const policy = options?.sajuTimePolicy;

  // Product defaults (audit decision 2026-07-08): longitude correction on,
  // equation-of-time off, and zi-split at 23:00. The longitude reference is
  // now independent from the selected interpretive school.
  const trueSolarTime = resolvePolicyToggle(policy?.trueSolarTime, 'off');
  const longitudeCorrection = resolvePolicyToggle(policy?.longitudeCorrection, 'on');
  const yaza = resolvePolicyToggle(policy?.yaza, 'on');
  const trueSolarTimeEnabled = trueSolarTime === 'on' || longitudeCorrection === 'on';
  const longitudeCorrectionPolicy = longitudeCorrection === 'off'
    ? { mode: 'off' as const }
    : policy?.longitudeReference === 'legacyPreset'
      ? Number.isFinite(legacyPresetMeridian)
        ? {
            mode: 'fixedMeridian' as const,
            meridianDeg: Number(legacyPresetMeridian),
          }
        : (() => {
            throw new LegacyPresetMeridianUnavailableError();
          })()
      : { mode: 'civilOffsetMeridian' as const };

  if (yaza === 'off') {
    return {
      trueSolarTimeEnabled,
      includeEquationOfTime: trueSolarTime === 'on',
      longitudeCorrectionPolicy,
      yazaEnabled: false,
      dayCutMode: 'MIDNIGHT_00',
    };
  }

  const yazaMode = policy?.yazaMode === '23:30'
    ? 'YAZA_23_30_TO_01_30_NEXTDAY' as const
    : 'YAZA_23_TO_01_NEXTDAY' as const;
  return {
    trueSolarTimeEnabled,
    includeEquationOfTime: trueSolarTime === 'on',
    longitudeCorrectionPolicy,
    yazaEnabled: true,
    yazaMode,
    // springLegacy resolves dayCutMode before yazaMode, so both must agree.
    dayCutMode: yazaMode,
  };
}

function recordOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function omitKeys(
  source: Record<string, unknown>,
  keys: ReadonlySet<string>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(source).filter(([key]) => !keys.has(key)),
  );
}

const PRODUCT_TRUE_SOLAR_KEYS = new Set([
  'enabled',
  'longitudeCorrectionPolicy',
  'equationOfTime',
  'applyTo',
]);
const PRODUCT_DAY_BOUNDARY_KEYS = new Set([
  'dayBoundary',
  'hourStemDayBoundary',
  'dayCutShiftMinutes',
  'trueSolarTime',
]);

/**
 * Makes the product-facing time policy authoritative over the raw sajuConfig
 * escape hatch, including nested calendar fields consumed after legacy merge.
 */
export function applyAuthoritativeSajuTimePolicyConfig(
  config: Record<string, unknown>,
  options: SpringRequest['options'] | undefined,
  legacyPresetMeridian?: number,
): Record<string, unknown> {
  const patch = toLegacySajuTimePolicyConfig(options, legacyPresetMeridian);
  const calendar = recordOrEmpty(config['calendar']);
  const trueSolarTime = recordOrEmpty(calendar['trueSolarTime']);
  const preservedCalendar = omitKeys(calendar, PRODUCT_DAY_BOUNDARY_KEYS);
  const preservedTrueSolarTime = omitKeys(
    trueSolarTime,
    PRODUCT_TRUE_SOLAR_KEYS,
  );
  const equationOfTime =
    resolvePolicyToggle(options?.sajuTimePolicy?.trueSolarTime, 'off') === 'on'
      ? 'precise'
      : 'off';

  return {
    ...config,
    ...patch,
    calendar: {
      ...preservedCalendar,
      trueSolarTime: {
        ...preservedTrueSolarTime,
        enabled: patch.trueSolarTimeEnabled,
        longitudeCorrectionPolicy: patch.longitudeCorrectionPolicy,
        equationOfTime,
        applyTo: 'dayAndHour',
      },
    },
  };
}
