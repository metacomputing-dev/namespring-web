import {
  REPORT_DELIVERY_REQUEST_SCHEMA_V1,
  REPORT_DELIVERY_SCHEMA_V1,
  type DeliveryAvailabilityV1,
  type DeliveryReasonCodeV1,
  type FiveElementIdV1,
  type MetricFactV1,
  type ReportBlockV1,
  type ReportCategoryIdV1,
  type ReportDeliverySelectionV1,
  type ReportDeliveryRequestV1,
  type ReportDeliveryV1,
  type ReportDepthV1,
  type ReportFactV1,
  type ReportInterpretationV1,
  type ReportSurfaceIdV1,
  type ReportSurfaceSelectionV1,
  type ReportSurfaceV1,
} from './types.js';
import { isCandidateIdV1 } from '../../experience/candidate-id.js';
import { ENGINE_BUILD_IDENTITY_V1 } from '../../engine-build-identity.generated.js';
import { validateBirthInputRuntimeContract } from '../../saju/birth-input-contract.js';
import {
  assertNameCharacterSyntax,
} from '../../name-entry-resolver.js';
import { findNameIdentityModeConflictV1 } from '../../name-identity-contract.js';
import { parseFortuneTargetDate } from '../../saju-request-policy.js';
import {
  AnalysisOptionsContractError,
  assertAnalysisOptionsContractV1,
} from '../analysis-options-validation.js';
import { FOUR_FRAME_AUTHORED_COPY_APPROVED } from './content-gates.js';
import { supportedRegionLocationMatches } from '../../saju/birth-location.js';
import {
  LEGACY_PRESET_REFERENCE_MERIDIANS,
  isLegacyPresetReferenceCode,
  normalizeReferenceMeridianDegrees,
  resolveCivilOffsetMinutesForValidation,
} from '../../saju/time-reference-validation.js';

const SURFACE_IDS = new Set(['integrated', 'saju', 'naming']);
const DEPTHS = new Set(['brief', 'standard', 'expert']);
const PERIODS = new Set(['today', 'thisWeek', 'thisMonth', 'thisYear']);
const CATEGORIES = new Set<ReportCategoryIdV1>([
  'overall', 'wealth', 'health', 'academic', 'romance', 'family',
  'career', 'study_document', 'expression_children', 'health_stress', 'movement',
]);
const AVAILABILITY_REASONS = new Set<DeliveryReasonCodeV1>([
  'SAJU_ANALYSIS_LIMITED',
  'BIRTH_TIME_IMPUTED',
  'SAJU_JUDGMENT_LOW_CONFIDENCE',
  'YONGSHIN_JONGGYEOK_RISK',
  'NAME_INPUT_MISSING',
  'NAME_ANALYSIS_UNAVAILABLE',
  'INTERACTION_EVIDENCE_INSUFFICIENT',
  'YONGSHIN_CONSENSUS_CONFLICT',
  'NAME_SAJU_SAFETY_CAUTION',
  'GENERATED_CONTENT_PARTIAL',
  'NOT_APPLICABLE',
  'METHOD_SCOPE_LIMITED',
  'CONTENT_EXPERT_REVIEW_REQUIRED',
  'NAMING_CALENDAR_METHOD_NOT_ESTABLISHED',
  'SERVER_ENTITLEMENT_REQUIRED',
]);
const NAMING_FRAME_LUCK_BUCKETS = new Set([0, 5, 10, 15, 20, 25]);
const DEPTH_WEIGHT: Readonly<Record<ReportDepthV1, number>> = {
  brief: 1,
  standard: 4,
  expert: 8,
};
const MAX_TIMELINE_COST = 32;
const MAX_DELIVERY_BYTES = 256 * 1024;
// The equation of time is physically bounded to roughly +/- 16.5 minutes.
// Keep a conservative envelope so a self-consistent but impossible clock
// cannot cross the public delivery boundary.
const MAX_EQUATION_OF_TIME_MINUTES = 20;
// The current IANA-backed producer emits non-negative whole-minute DST
// adjustments. Three hours is a deliberately conservative global ceiling.
const MAX_DAYLIGHT_SAVING_MINUTES = 180;
const FORBIDDEN_OUTPUT_KEYS = new Set([
  'selectionSeed', 'selectedFragments', 'fragmentId', 'caseId', 'packKey',
  'packUrl', 'premiumBody', 'premiumContent', 'fullText', 'isUnlocked', 'paid',
  'entitlement', 'entitlementId', 'deliveryId',
]);

export type ReportDeliveryRequestInvalidReason =
  | 'INVALID_SCHEMA_VERSION'
  | 'INVALID_SHAPE'
  | 'UNKNOWN_FIELD'
  | 'EMPTY_SELECTION'
  | 'DUPLICATE_SELECTION'
  | 'UNSUPPORTED_SELECTION'
  | 'PARTIAL_HANJA_IDENTITY'
  | 'PURE_HANGUL_MODE_CONFLICT'
  | 'PURE_HANGUL_MODE_DISABLED'
  | 'CANDIDATE_ID_MISMATCH'
  | 'REQUEST_COST_EXCEEDED';

export class ReportDeliveryRequestValidationError extends TypeError {
  readonly code = 'REPORT_DELIVERY_REQUEST_INVALID' as const;

  constructor(readonly reason: ReportDeliveryRequestInvalidReason) {
    super(`Invalid report delivery request: ${reason}.`);
    this.name = 'ReportDeliveryRequestValidationError';
  }
}

export class ReportDeliveryContractError extends Error {
  readonly code = 'REPORT_DELIVERY_CONTRACT_INVALID' as const;

  constructor(readonly reason: string) {
    super(`Invalid report delivery response: ${reason}.`);
    this.name = 'ReportDeliveryContractError';
  }
}

function fail(reason: ReportDeliveryRequestInvalidReason): never {
  throw new ReportDeliveryRequestValidationError(reason);
}

function assertPlainObject(value: unknown): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_SHAPE');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail('INVALID_SHAPE');
}

function assertAllowedKeys(value: Record<string, unknown>, keys: readonly string[]): void {
  const allowed = new Set(keys);
  if (Object.keys(value).some((key) => !allowed.has(key))) fail('UNKNOWN_FIELD');
}

function assertUniqueAllowedArray(
  value: unknown,
  allowed: ReadonlySet<string>,
  max: number,
): asserts value is readonly string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > max) fail('EMPTY_SELECTION');
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string' || !allowed.has(item)) fail('UNSUPPORTED_SELECTION');
    if (seen.has(item)) fail('DUPLICATE_SELECTION');
    seen.add(item);
  }
}

function validateTimeline(value: unknown): number {
  assertPlainObject(value);
  assertAllowedKeys(value, ['periods', 'categories']);
  assertUniqueAllowedArray(value.periods, PERIODS, PERIODS.size);
  assertUniqueAllowedArray(value.categories, CATEGORIES, CATEGORIES.size);
  return value.periods.length * value.categories.length;
}

function validateSurface(value: unknown): ReportSurfaceSelectionV1 {
  assertPlainObject(value);
  if (typeof value.id !== 'string' || !SURFACE_IDS.has(value.id)) fail('UNSUPPORTED_SELECTION');
  if (typeof value.depth !== 'string' || !DEPTHS.has(value.depth)) fail('UNSUPPORTED_SELECTION');

  if (value.id === 'integrated') {
    assertAllowedKeys(value, ['id', 'depth', 'timeline']);
    if (value.depth === 'expert') fail('UNSUPPORTED_SELECTION');
    if (value.timeline !== undefined) validateTimeline(value.timeline);
  } else if (value.id === 'saju') {
    assertAllowedKeys(value, ['id', 'depth', 'timeline', 'life']);
    if (value.timeline !== undefined) validateTimeline(value.timeline);
    if (value.life !== undefined && value.life !== 'summary') fail('UNSUPPORTED_SELECTION');
  } else {
    assertAllowedKeys(value, ['id', 'depth']);
  }
  return value as unknown as ReportSurfaceSelectionV1;
}

/** Validates and returns the already-snapshotted selection. */
export function validateReportDeliverySelectionV1(
  value: unknown,
): ReportDeliverySelectionV1 {
  assertPlainObject(value);
  assertAllowedKeys(value, ['schemaVersion', 'surfaces']);
  if (value.schemaVersion !== REPORT_DELIVERY_REQUEST_SCHEMA_V1) fail('INVALID_SCHEMA_VERSION');
  if (!Array.isArray(value.surfaces) || value.surfaces.length < 1 || value.surfaces.length > 3) {
    fail('EMPTY_SELECTION');
  }

  const seen = new Set<string>();
  let cost = 0;
  for (const rawSurface of value.surfaces) {
    const surface = validateSurface(rawSurface);
    if (seen.has(surface.id)) fail('DUPLICATE_SELECTION');
    seen.add(surface.id);
    if (surface.id !== 'naming' && surface.timeline) {
      cost += surface.timeline.periods.length
        * surface.timeline.categories.length
        * DEPTH_WEIGHT[surface.depth];
    }
    if (surface.id === 'saju' && surface.life === 'summary') {
      cost += DEPTH_WEIGHT[surface.depth];
    }
  }
  if (cost > MAX_TIMELINE_COST) fail('REQUEST_COST_EXCEEDED');
  return value as unknown as ReportDeliverySelectionV1;
}

function validateNameCharacters(
  value: unknown,
  max: number,
  role: 'surname' | 'givenName',
): void {
  if (!Array.isArray(value) || value.length < 1 || value.length > max) fail('INVALID_SHAPE');
  for (const character of value) {
    assertPlainObject(character);
    assertAllowedKeys(character, ['hangul', 'hanja']);
    if (typeof character.hangul !== 'string'
      || character.hangul !== character.hangul.trim()
      || character.hangul !== character.hangul.normalize('NFC')
      || Array.from(character.hangul).length !== 1
      || (character.hanja !== undefined
        && (typeof character.hanja !== 'string'
          || character.hanja !== character.hanja.trim()
          || character.hanja !== character.hanja.normalize('NFC')
          || Array.from(character.hanja).length !== 1))) {
      fail('INVALID_SHAPE');
    }
  }
  try {
    assertNameCharacterSyntax(value, { role });
  } catch {
    fail('INVALID_SHAPE');
  }
}

function validateNameIdentityMode(
  value: readonly unknown[],
  options: {
    readonly role: 'surname' | 'givenName';
    readonly pureHangulNameMode?: unknown;
  },
): void {
  const conflict = findNameIdentityModeConflictV1(value, options);
  if (conflict) fail(conflict);
}

/** Strict outer request guard. Called after the bounded public snapshot. */
export function validateReportDeliveryRequestV1(
  value: unknown,
): ReportDeliveryRequestV1 {
  assertPlainObject(value);
  assertAllowedKeys(value, [
    'birth', 'surname', 'givenName', 'targetDate', 'options', 'candidateId', 'delivery',
  ]);
  assertPlainObject(value.birth);
  assertAllowedKeys(value.birth, [
    'year', 'month', 'day', 'hour', 'minute', 'gender', 'calendarType',
    'isLeapMonth', 'region', 'city', 'birthPlace', 'timezone', 'latitude',
    'longitude', 'name',
  ]);
  if (validateBirthInputRuntimeContract(value.birth) !== null
    || !Number.isSafeInteger(value.birth.year)
    || !Number.isSafeInteger(value.birth.month)
    || !Number.isSafeInteger(value.birth.day)) {
    fail('INVALID_SHAPE');
  }
  if ((value.birth.hour === undefined || value.birth.hour === null)
    && value.birth.minute !== undefined
    && value.birth.minute !== null) {
    fail('INVALID_SHAPE');
  }
  if (value.birth.isLeapMonth === true && value.birth.calendarType !== 'lunar') {
    fail('INVALID_SHAPE');
  }
  const birthYear = Number(value.birth.year);
  const birthMonth = Number(value.birth.month);
  const birthDay = Number(value.birth.day);
  if (value.birth.calendarType === 'lunar') {
    if (birthDay > 30) fail('INVALID_SHAPE');
  } else {
    const birthDate = new Date(0);
    birthDate.setUTCHours(0, 0, 0, 0);
    birthDate.setUTCFullYear(birthYear, birthMonth - 1, birthDay);
    if (birthDate.getUTCFullYear() !== birthYear
      || birthDate.getUTCMonth() !== birthMonth - 1
      || birthDate.getUTCDate() !== birthDay) {
      fail('INVALID_SHAPE');
    }
  }
  if (value.surname !== undefined) validateNameCharacters(value.surname, 2, 'surname');
  if (value.givenName !== undefined) validateNameCharacters(value.givenName, 4, 'givenName');
  if (value.targetDate !== undefined) {
    if (typeof value.targetDate !== 'string') fail('INVALID_SHAPE');
    try {
      // Reject malformed and out-of-horizon dates before an engine operation,
      // repository initialization, or paid server recomputation can begin.
      parseFortuneTargetDate(value.targetDate, value.birth);
    } catch {
      fail('INVALID_SHAPE');
    }
  }
  if (value.candidateId !== undefined && typeof value.candidateId !== 'string') {
    fail('INVALID_SHAPE');
  }
  if (value.options !== undefined) {
    try {
      assertAnalysisOptionsContractV1(value.options, birthYear, {
        allowRemoteLunarConversion: false,
      });
    } catch (error) {
      if (error instanceof AnalysisOptionsContractError) {
        if (error.kind === 'UNKNOWN_FIELD') fail('UNKNOWN_FIELD');
        if (error.kind === 'REMOTE_FORBIDDEN') fail('UNSUPPORTED_SELECTION');
        fail('INVALID_SHAPE');
      }
      throw error;
    }
  }
  const pureHangulNameMode = value.options === undefined
    ? undefined
    : (value.options as Record<string, unknown>).pureHangulNameMode;
  if (value.surname !== undefined) {
    validateNameIdentityMode(value.surname as readonly unknown[], {
      role: 'surname',
      pureHangulNameMode,
    });
  }
  if (value.givenName !== undefined) {
    validateNameIdentityMode(value.givenName as readonly unknown[], {
      role: 'givenName',
      pureHangulNameMode,
    });
  }
  validateReportDeliverySelectionV1(value.delivery);
  return value as unknown as ReportDeliveryRequestV1;
}

function contractFail(reason: string): never {
  throw new ReportDeliveryContractError(reason);
}

function collectForbiddenKeys(value: unknown): void {
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) collectForbiddenKeys(item);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_OUTPUT_KEYS.has(key)) contractFail(`FORBIDDEN_KEY_${key}`);
    collectForbiddenKeys(child);
  }
}

function validateMetricRange(value: number, min: number, max: number): void {
  if (![value, min, max].every(Number.isFinite) || min > max || value < min || value > max) {
    contractFail('METRIC_OUT_OF_RANGE');
  }
}

function validateMetricUnitRange(
  unit: MetricFactV1['unit'],
  min: number,
  max: number,
): void {
  const expected: Readonly<Record<string, readonly [number, number]>> = {
    score_0_100: [0, 100],
    confidence_0_100: [0, 100],
    ratio_0_1: [0, 1],
    percent_0_100: [0, 100],
    stars_1_5: [1, 5],
  };
  const range = expected[unit];
  if (range && (min !== range[0] || max !== range[1])) contractFail('METRIC_UNIT_RANGE');
  if ((unit === 'count' || unit === 'stroke_count') && min < 0) {
    contractFail('METRIC_UNIT_RANGE');
  }
}

const ELEMENT_IDS = new Set<FiveElementIdV1>(['wood', 'fire', 'earth', 'metal', 'water']);
const FACT_KINDS = new Set([
  'metric',
  'day_master',
  'strength',
  'gyeokguk',
  'yongshin',
  'element_distribution',
  'pillars',
  'shinsal_hits',
  'ten_god_analysis',
  'natal_relations',
  'element_balance',
  'time_correction',
  'name_character',
  'naming_trend',
  'naming_phonetic',
  'name_statistics',
  'naming_frame',
  'name_saju_interaction',
]);
const BLOCK_KINDS = new Set([
  'hero',
  'fact_group',
  'element_comparison',
  'timeline',
  'life_flow',
  'four_frames',
  'capability',
  'premium_teaser',
  'deep_links',
]);
const METRIC_UNITS = new Set([
  'score_0_100',
  'confidence_0_100',
  'ratio_0_1',
  'percent_0_100',
  'count',
  'stroke_count',
  'stars_1_5',
]);
const INTERPRETATION_DOMAINS = new Set(['fortune', 'saju', 'naming', 'interaction']);
const FACT_DOMAINS = new Set(['saju', 'naming', 'interaction']);
const INTERACTION_LIMITATIONS = new Set([
  'element_match_scope_only',
  'not_a_combined_balance_score',
  'consensus_conflict_present',
  'safety_profile_caution',
  'safety_profile_unavailable',
]);
const FRAME_STAGES = new Set(['earlyLife', 'youthLife', 'middleLife', 'lateAndTotal']);
const NAMING_TREND_STATUSES = new Set([
  'current',
  'era_fit',
  'dated',
  'overused',
  'unknown',
]);
const NAME_GENDERS = new Set(['male', 'female', 'unknown']);
const PHONETIC_STATUSES = new Set(['smooth', 'watch', 'awkward', 'unknown']);
const PHONETIC_RISKS = new Set(['low', 'medium', 'high']);
const PHONETIC_BOUNDARIES = new Set(['surname_given', 'given_internal']);
const JUDGMENT_STRENGTHS = new Set(['definite', 'practical', 'candidate', 'deferred']);
const SAJU_PILLAR_POSITIONS = new Set(['year', 'month', 'day', 'hour']);
const TEN_GOD_CODES = new Set([
  'BI_GYEON',
  'GYEOB_JAE',
  'SIK_SIN',
  'SANG_GWAN',
  'PYEON_JAE',
  'JEONG_JAE',
  'PYEON_GWAN',
  'JEONG_GWAN',
  'PYEON_IN',
  'JEONG_IN',
]);
const TIME_UNCERTAINTY_AXES = new Set([
  'yearPillar',
  'monthPillar',
  'dayPillar',
  'hourPillar',
  'yongshin',
  'gyeokguk',
  'strength',
  'tenGod',
  'relations',
  'shinsal',
  'fortuneTiming',
]);

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function strictPlainObject(
  value: unknown,
  reason: string,
): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    contractFail(reason);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) contractFail(reason);
}

function strictObject(
  value: unknown,
  required: readonly string[],
  optional: readonly string[],
  reason: string,
): asserts value is Record<string, unknown> {
  strictPlainObject(value, reason);
  const allowed = new Set([...required, ...optional]);
  if (required.some((key) => !hasOwn(value, key))
    || Object.keys(value).some((key) => !allowed.has(key))) {
    contractFail(reason);
  }
}

function strictArray(
  value: unknown,
  reason: string,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): asserts value is unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    contractFail(reason);
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!hasOwn(value, String(index))) contractFail(reason);
  }
  if (Object.keys(value).length !== value.length) contractFail(reason);
}

function strictString(value: unknown, reason: string, allowEmpty = false): asserts value is string {
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0)) contractFail(reason);
}

function strictBoundedText(
  value: unknown,
  reason: string,
  maxLength = 120,
): asserts value is string {
  strictString(value, reason);
  if (value !== value.normalize('NFC').trim()
    || Array.from(value).length > maxLength
    || /[\u0000-\u001f\u007f]/u.test(value)) {
    contractFail(reason);
  }
}

function strictEnum(
  value: unknown,
  allowed: ReadonlySet<string>,
  reason: string,
): asserts value is string {
  if (typeof value !== 'string' || !allowed.has(value)) contractFail(reason);
}

function strictFiniteNumber(value: unknown, reason: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) contractFail(reason);
}

function strictSafeInteger(value: unknown, reason: string, minimum = 0): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    contractFail(reason);
  }
}

function strictNullableString(value: unknown, reason: string): void {
  if (value !== null) strictString(value, reason);
}

function strictNullableMachineCode(value: unknown, reason: string): void {
  if (value === null) return;
  if (typeof value !== 'string' || !/^[A-Z][A-Z_]{0,39}$/u.test(value)) contractFail(reason);
}

function strictStringArray(
  value: unknown,
  reason: string,
  options: {
    readonly min?: number;
    readonly max?: number;
    readonly allowed?: ReadonlySet<string>;
    readonly unique?: boolean;
    readonly allowEmptyItems?: boolean;
  } = {},
): asserts value is string[] {
  strictArray(value, reason, options.min ?? 0, options.max ?? Number.MAX_SAFE_INTEGER);
  const seen = new Set<string>();
  for (const item of value) {
    strictString(item, reason, options.allowEmptyItems === true);
    if (options.allowed && !options.allowed.has(item)) contractFail(reason);
    if (options.unique && seen.has(item)) contractFail(reason);
    seen.add(item);
  }
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function sameAvailability(
  left: DeliveryAvailabilityV1,
  right: DeliveryAvailabilityV1,
): boolean {
  return left.status === right.status && sameStringArray(left.reasonCodes, right.reasonCodes);
}

function strictAvailability(value: unknown): DeliveryAvailabilityV1 {
  strictObject(value, ['status', 'reasonCodes'], [], 'AVAILABILITY_SHAPE');
  strictEnum(value.status, new Set(['ready', 'limited', 'unavailable']), 'AVAILABILITY_SHAPE');
  strictStringArray(value.reasonCodes, 'AVAILABILITY_SHAPE', {
    allowed: AVAILABILITY_REASONS,
    unique: true,
  });
  if (value.status === 'ready' && value.reasonCodes.length !== 0) {
    contractFail('READY_WITH_REASON_CODES');
  }
  if (value.status !== 'ready' && value.reasonCodes.length === 0) {
    contractFail('NON_READY_WITHOUT_REASON_CODE');
  }
  return value as unknown as DeliveryAvailabilityV1;
}

function aggregateStrictAvailability(
  values: readonly DeliveryAvailabilityV1[],
): DeliveryAvailabilityV1 {
  if (values.length === 0 || values.every((value) => value.status === 'ready')) {
    return { status: 'ready', reasonCodes: [] };
  }
  const reasonCodes = [...new Set(values.flatMap((value) => value.reasonCodes))];
  return values.every((value) => value.status === 'unavailable')
    ? { status: 'unavailable', reasonCodes }
    : { status: 'limited', reasonCodes };
}

function overallStrictAvailability(
  surfaces: readonly ReportSurfaceV1[],
): DeliveryAvailabilityV1 {
  const reasonCodes = [...new Set(surfaces.flatMap((surface) =>
    surface.availability.reasonCodes))];
  if (surfaces.every((surface) => surface.availability.status === 'unavailable')) {
    return { status: 'unavailable', reasonCodes };
  }
  return reasonCodes.length > 0
    ? { status: 'limited', reasonCodes }
    : { status: 'ready', reasonCodes: [] };
}

function strictTimelineSelection(value: unknown): void {
  strictObject(value, ['periods', 'categories'], [], 'COVERAGE_TIMELINE_SHAPE');
  strictStringArray(value.periods, 'COVERAGE_TIMELINE_PERIODS', {
    min: 1,
    max: PERIODS.size,
    allowed: PERIODS,
    unique: true,
  });
  strictStringArray(value.categories, 'COVERAGE_TIMELINE_CATEGORIES', {
    min: 1,
    max: CATEGORIES.size,
    allowed: CATEGORIES,
    unique: true,
  });
}

function strictCoverageSurface(value: unknown): ReportSurfaceSelectionV1 {
  strictPlainObject(value, 'COVERAGE_SURFACE_SHAPE');
  strictEnum(value.id, SURFACE_IDS, 'COVERAGE_SURFACE_ID');
  strictEnum(value.depth, DEPTHS, 'COVERAGE_SURFACE_DEPTH');
  if (value.id === 'integrated') {
    strictObject(value, ['id', 'depth'], ['timeline'], 'COVERAGE_SURFACE_SHAPE');
    if (value.depth === 'expert') contractFail('COVERAGE_SURFACE_DEPTH');
  } else if (value.id === 'saju') {
    strictObject(value, ['id', 'depth'], ['timeline', 'life'], 'COVERAGE_SURFACE_SHAPE');
    if (hasOwn(value, 'life') && value.life !== 'summary') {
      contractFail('COVERAGE_LIFE_SHAPE');
    }
  } else {
    strictObject(value, ['id', 'depth'], [], 'COVERAGE_SURFACE_SHAPE');
  }
  if (hasOwn(value, 'timeline')) strictTimelineSelection(value.timeline);
  return value as unknown as ReportSurfaceSelectionV1;
}

function strictCoverage(value: unknown): readonly ReportSurfaceSelectionV1[] {
  strictObject(value, ['surfaces'], [], 'COVERAGE_SHAPE');
  strictArray(value.surfaces, 'COVERAGE_SURFACES_SHAPE', 1, 3);
  const seen = new Set<string>();
  const surfaces = value.surfaces.map((surface) => {
    const validated = strictCoverageSurface(surface);
    if (seen.has(validated.id)) contractFail('COVERAGE_DUPLICATE_SURFACE');
    seen.add(validated.id);
    return validated;
  });
  return surfaces;
}

function canonicalSurfaceSliceKey(surface: ReportSurfaceSelectionV1): string {
  const timeline = surface.id === 'naming' ? undefined : surface.timeline;
  const periods = timeline?.periods.join('-') ?? 'none';
  const categories = timeline?.categories.join('-') ?? 'none';
  const life = surface.id === 'saju' ? surface.life ?? 'none' : 'none';
  return [
    surface.id,
    surface.depth,
    'periods-' + periods,
    'categories-' + categories,
    'life-' + life,
  ].join('.');
}

function strictFactBase(value: Record<string, unknown>): void {
  strictString(value.id, 'FACT_ID');
  strictEnum(value.domain, FACT_DOMAINS, 'FACT_DOMAIN');
  strictString(value.method, 'FACT_METHOD');
}

function strictSajuProjectionProvenance(
  value: Record<string, unknown>,
  method: string,
  sourceFields: readonly string[],
): void {
  strictFactBase(value);
  if (value.domain !== 'saju'
    || value.method !== method
    || value.source !== 'spring-ts.SajuSummary'
    || value.projection !== 'normalized_without_recalculation') {
    contractFail('SAJU_PROJECTION_PROVENANCE');
  }
  strictStringArray(value.sourceFields, 'SAJU_PROJECTION_PROVENANCE', {
    min: sourceFields.length,
    max: sourceFields.length,
    unique: true,
  });
  if (!sameStringArray(value.sourceFields, sourceFields)) {
    contractFail('SAJU_PROJECTION_PROVENANCE');
  }
}

function strictTenGodDescriptor(value: unknown, reason: string): void {
  strictObject(value, ['label', 'code'], [], reason);
  strictBoundedText(value.label, reason, 40);
  if (value.code !== null) strictEnum(value.code, TEN_GOD_CODES, reason);
}

function strictLocalDateTime(
  value: unknown,
  reason: string,
): asserts value is {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  strictObject(value, ['year', 'month', 'day', 'hour', 'minute'], [], reason);
  strictSafeInteger(value.year, reason);
  strictSafeInteger(value.month, reason);
  strictSafeInteger(value.day, reason);
  strictSafeInteger(value.hour, reason);
  strictSafeInteger(value.minute, reason);
  const year = value.year as number;
  const month = value.month as number;
  const day = value.day as number;
  const hour = value.hour as number;
  const minute = value.minute as number;
  if (year < 1 || month < 1 || month > 12
    || day < 1 || day > 31
    || hour < 0 || hour > 23
    || minute < 0 || minute > 59) {
    contractFail(reason);
  }
  // Date.UTC aliases years 0..99 into 1900..1999.
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  if (date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day) {
    contractFail(reason);
  }
}

function shiftLocalDateTimeByCorrectionMinutes(
  value: {
    readonly year: number;
    readonly month: number;
    readonly day: number;
    readonly hour: number;
    readonly minute: number;
  },
  correctionMinutes: number,
): {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
} {
  // saju-ts applies a fractional true-solar correction to an integer-minute
  // civil clock and floors the resulting displayed minute. Since the input
  // clock is integral, that is equivalent to adding floor(delta) minutes.
  const shifted = new Date(0);
  shifted.setUTCHours(0, 0, 0, 0);
  shifted.setUTCFullYear(value.year, value.month - 1, value.day);
  shifted.setUTCHours(value.hour, value.minute + Math.floor(correctionMinutes), 0, 0);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

interface StrictCalendarDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

function strictCalendarDate(
  value: unknown,
  reason: string,
  calendar: 'gregorian' | 'lunar',
): asserts value is StrictCalendarDate {
  strictObject(value, ['year', 'month', 'day'], [], reason);
  strictSafeInteger(value.year, reason);
  strictSafeInteger(value.month, reason);
  strictSafeInteger(value.day, reason);
  const year = value.year as number;
  const month = value.month as number;
  const day = value.day as number;
  if (year < 1 || month < 1 || month > 12
    || day < 1 || day > (calendar === 'lunar' ? 30 : 31)) {
    contractFail(reason);
  }
  if (calendar === 'gregorian') {
    const date = new Date(0);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCFullYear(year, month - 1, day);
    if (date.getUTCFullYear() !== year
      || date.getUTCMonth() !== month - 1
      || date.getUTCDate() !== day) {
      contractFail(reason);
    }
  }
}

function strictNullableClockPart(
  value: unknown,
  maximum: number,
  reason: string,
): asserts value is number | null {
  if (value === null) return;
  strictSafeInteger(value, reason);
  if (value > maximum) contractFail(reason);
}

interface StrictTimeCorrectionInput {
  readonly calendarType: 'solar' | 'lunar';
  readonly providedLocalDateTime: StrictCalendarDate & {
    readonly hour: number | null;
    readonly minute: number | null;
  };
  readonly effectiveSolarDate: StrictCalendarDate;
  readonly timePrecision: 'exact' | 'unknown_hour' | 'unknown_minute';
}

function strictTimeCorrectionInput(
  value: unknown,
): asserts value is StrictTimeCorrectionInput {
  strictObject(
    value,
    [
      'calendarType',
      'providedLocalDateTime',
      'effectiveSolarDate',
      'timePrecision',
    ],
    [],
    'TIME_CORRECTION_INPUT',
  );
  strictEnum(value.calendarType, new Set(['solar', 'lunar']), 'TIME_CORRECTION_INPUT');
  strictObject(
    value.providedLocalDateTime,
    ['year', 'month', 'day', 'hour', 'minute'],
    [],
    'TIME_CORRECTION_INPUT',
  );
  strictCalendarDate(
    {
      year: value.providedLocalDateTime.year,
      month: value.providedLocalDateTime.month,
      day: value.providedLocalDateTime.day,
    },
    'TIME_CORRECTION_INPUT',
    value.calendarType === 'lunar' ? 'lunar' : 'gregorian',
  );
  strictNullableClockPart(
    value.providedLocalDateTime.hour,
    23,
    'TIME_CORRECTION_INPUT',
  );
  strictNullableClockPart(
    value.providedLocalDateTime.minute,
    59,
    'TIME_CORRECTION_INPUT',
  );
  strictCalendarDate(
    value.effectiveSolarDate,
    'TIME_CORRECTION_INPUT',
    'gregorian',
  );
  strictEnum(
    value.timePrecision,
    new Set(['exact', 'unknown_hour', 'unknown_minute']),
    'TIME_CORRECTION_INPUT',
  );
  const hour = value.providedLocalDateTime.hour;
  const minute = value.providedLocalDateTime.minute;
  if ((value.timePrecision === 'exact' && (hour === null || minute === null))
    || (value.timePrecision === 'unknown_hour' && hour !== null)
    || (value.timePrecision === 'unknown_minute'
      && (hour === null || minute !== null))) {
    contractFail('TIME_CORRECTION_INPUT_CONSISTENCY');
  }
}

function strictFallbackClock(
  value: Record<string, unknown>,
  reason: string,
): void {
  strictSafeInteger(value.fallbackHour, reason);
  strictSafeInteger(value.fallbackMinute, reason);
  if (value.fallbackHour > 23 || value.fallbackMinute > 59) {
    contractFail(reason);
  }
  if (hasOwn(value, 'fallbackTimezone')) {
    strictString(value.fallbackTimezone, reason);
  }
}

function strictUncertaintyAxes(
  value: Record<string, unknown>,
  reason: string,
): void {
  strictStringArray(value.affectedAxes, reason, {
    min: 1,
    max: TIME_UNCERTAINTY_AXES.size,
    allowed: TIME_UNCERTAINTY_AXES,
    unique: true,
  });
  if (hasOwn(value, 'affectedAxisLabels')) {
    strictStringArray(value.affectedAxisLabels, reason, {
      min: 1,
      max: TIME_UNCERTAINTY_AXES.size,
    });
  }
}

function strictTimeCorrectionUncertainty(
  value: unknown,
  precision: StrictTimeCorrectionInput['timePrecision'],
): void {
  if (precision === 'exact') {
    if (value !== null) contractFail('TIME_CORRECTION_UNCERTAINTY');
    return;
  }
  if (value === null) contractFail('TIME_CORRECTION_UNCERTAINTY');
  if (precision === 'unknown_hour') {
    strictObject(value, ['unknownHour'], [], 'TIME_CORRECTION_UNCERTAINTY');
    strictObject(
      value.unknownHour,
      [
        'fallbackHour',
        'fallbackMinute',
        'affectedAxes',
        'confidenceTierShift',
        'message',
      ],
      ['fallbackTimezone', 'affectedAxisLabels'],
      'TIME_CORRECTION_UNCERTAINTY',
    );
    strictFallbackClock(value.unknownHour, 'TIME_CORRECTION_UNCERTAINTY');
    strictUncertaintyAxes(value.unknownHour, 'TIME_CORRECTION_UNCERTAINTY');
    if (value.unknownHour.confidenceTierShift !== 'downgrade-one-step') {
      contractFail('TIME_CORRECTION_UNCERTAINTY');
    }
    strictString(value.unknownHour.message, 'TIME_CORRECTION_UNCERTAINTY');
    return;
  }

  strictObject(value, ['unknownMinute'], [], 'TIME_CORRECTION_UNCERTAINTY');
  strictObject(
    value.unknownMinute,
    [
      'fallbackHour',
      'fallbackMinute',
      'evaluatedMinuteRange',
      'comparedMinutes',
      'continuousTimingAffected',
      'boundarySensitive',
      'affectedAxes',
      'confidenceTierShift',
      'message',
    ],
    ['fallbackTimezone', 'affectedAxisLabels'],
    'TIME_CORRECTION_UNCERTAINTY',
  );
  strictFallbackClock(value.unknownMinute, 'TIME_CORRECTION_UNCERTAINTY');
  strictObject(
    value.unknownMinute.evaluatedMinuteRange,
    ['from', 'to'],
    [],
    'TIME_CORRECTION_UNCERTAINTY',
  );
  if (value.unknownMinute.evaluatedMinuteRange.from !== 0
    || value.unknownMinute.evaluatedMinuteRange.to !== 59) {
    contractFail('TIME_CORRECTION_UNCERTAINTY');
  }
  strictArray(
    value.unknownMinute.comparedMinutes,
    'TIME_CORRECTION_UNCERTAINTY',
    2,
    2,
  );
  if (value.unknownMinute.comparedMinutes[0] !== 0
    || value.unknownMinute.comparedMinutes[1] !== 59
    || value.unknownMinute.continuousTimingAffected !== true
    || typeof value.unknownMinute.boundarySensitive !== 'boolean') {
    contractFail('TIME_CORRECTION_UNCERTAINTY');
  }
  strictUncertaintyAxes(value.unknownMinute, 'TIME_CORRECTION_UNCERTAINTY');
  strictEnum(
    value.unknownMinute.confidenceTierShift,
    new Set(['none', 'downgrade-affected-axes-one-step']),
    'TIME_CORRECTION_UNCERTAINTY',
  );
  strictString(value.unknownMinute.message, 'TIME_CORRECTION_UNCERTAINTY');
}

function strictLunarConversion(
  value: unknown,
  input: StrictTimeCorrectionInput,
): void {
  if (value === null) {
    if (input.calendarType === 'lunar') {
      contractFail('TIME_CORRECTION_LUNAR_CONSISTENCY');
    }
    return;
  }
  if (input.calendarType !== 'lunar') {
    contractFail('TIME_CORRECTION_LUNAR_CONSISTENCY');
  }
  strictObject(
    value,
    ['lunar', 'solar', 'source'],
    ['kasiFallback'],
    'TIME_CORRECTION_LUNAR',
  );
  strictObject(
    value.lunar,
    ['year', 'month', 'day', 'isLeapMonth'],
    [],
    'TIME_CORRECTION_LUNAR',
  );
  strictCalendarDate(
    {
      year: value.lunar.year,
      month: value.lunar.month,
      day: value.lunar.day,
    },
    'TIME_CORRECTION_LUNAR',
    'lunar',
  );
  if (typeof value.lunar.isLeapMonth !== 'boolean') {
    contractFail('TIME_CORRECTION_LUNAR');
  }
  strictCalendarDate(value.solar, 'TIME_CORRECTION_LUNAR', 'gregorian');
  strictEnum(value.source, new Set(['builtin', 'kasi']), 'TIME_CORRECTION_LUNAR');
  if (hasOwn(value, 'kasiFallback')
    && (value.kasiFallback !== true || value.source !== 'builtin')) {
    contractFail('TIME_CORRECTION_LUNAR');
  }
  const provided = input.providedLocalDateTime;
  const effective = input.effectiveSolarDate;
  if (value.lunar.year !== provided.year
    || value.lunar.month !== provided.month
    || value.lunar.day !== provided.day
    || value.solar.year !== effective.year
    || value.solar.month !== effective.month
    || value.solar.day !== effective.day) {
    contractFail('TIME_CORRECTION_LUNAR_CONSISTENCY');
  }
}

function strictElement(value: unknown, reason: string, nullable = false): void {
  if (nullable && value === null) return;
  strictEnum(value, ELEMENT_IDS, reason);
}

function strictElementArray(
  value: unknown,
  reason: string,
  unique = false,
): asserts value is string[] {
  strictStringArray(value, reason, { allowed: ELEMENT_IDS, unique });
}

function strictNullableScore(value: unknown, reason: string): number | null {
  if (value === null) return null;
  strictFiniteNumber(value, reason);
  if (value < 0 || value > 100) contractFail(reason);
  return value;
}

function strictPositiveYear(value: unknown, reason: string): number {
  strictSafeInteger(value, reason, 1);
  return value;
}

function strictTrendPoint(
  value: unknown,
  reason: string,
): { readonly year: number; readonly rank: number; readonly count: number } | null {
  if (value === null) return null;
  strictObject(value, ['year', 'rank', 'count'], [], reason);
  strictSafeInteger(value.year, reason, 1);
  strictSafeInteger(value.rank, reason, 1);
  strictSafeInteger(value.count, reason, 1);
  return value as unknown as {
    readonly year: number;
    readonly rank: number;
    readonly count: number;
  };
}

function roundedOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function expectedPhoneticRisk(score: number): 'low' | 'medium' | 'high' {
  if (score < 72) return 'high';
  if (score < 86) return 'medium';
  return 'low';
}

function strictFact(value: unknown): ReportFactV1 {
  strictPlainObject(value, 'FACT_SHAPE');
  strictEnum(value.kind, FACT_KINDS, 'FACT_KIND');
  const base = ['id', 'domain', 'method', 'kind'];

  if (value.kind === 'metric') {
    strictObject(value, [...base, 'label', 'value', 'unit', 'range', 'direction'], [], 'METRIC_FACT_SHAPE');
    strictFactBase(value);
    strictString(value.label, 'METRIC_LABEL');
    strictFiniteNumber(value.value, 'METRIC_VALUE');
    strictEnum(value.unit, METRIC_UNITS, 'METRIC_UNIT');
    strictObject(value.range, ['min', 'max'], [], 'METRIC_RANGE_SHAPE');
    strictFiniteNumber(value.range.min, 'METRIC_RANGE');
    strictFiniteNumber(value.range.max, 'METRIC_RANGE');
    strictEnum(value.direction, new Set(['higher_is_better', 'higher_is_risk', 'neutral']), 'METRIC_DIRECTION');
    validateMetricRange(value.value, value.range.min, value.range.max);
    validateMetricUnitRange(
      value.unit as MetricFactV1['unit'],
      value.range.min,
      value.range.max,
    );
    if ((value.unit === 'count' || value.unit === 'stroke_count')
      && !Number.isSafeInteger(value.value)) {
      contractFail('METRIC_INTEGER_UNIT');
    }
  } else if (value.kind === 'day_master') {
    strictObject(value, [...base, 'stem', 'element', 'polarity'], [], 'DAY_MASTER_FACT_SHAPE');
    strictFactBase(value);
    if (value.domain !== 'saju') contractFail('DAY_MASTER_DOMAIN');
    strictString(value.stem, 'DAY_MASTER_STEM');
    strictElement(value.element, 'DAY_MASTER_ELEMENT', true);
    strictString(value.polarity, 'DAY_MASTER_POLARITY');
  } else if (value.kind === 'strength') {
    strictObject(
      value,
      [...base, 'level', 'levelCode', 'isStrong'],
      ['judgmentStrength'],
      'STRENGTH_FACT_SHAPE',
    );
    strictFactBase(value);
    if (value.domain !== 'saju') contractFail('STRENGTH_DOMAIN');
    strictString(value.level, 'STRENGTH_LEVEL');
    strictEnum(value.levelCode, new Set(['STRONG', 'BALANCED', 'WEAK', 'UNKNOWN']), 'STRENGTH_LEVEL_CODE');
    if (typeof value.isStrong !== 'boolean') contractFail('STRENGTH_VALUE');
    if (hasOwn(value, 'judgmentStrength')) {
      strictEnum(value.judgmentStrength, JUDGMENT_STRENGTHS, 'STRENGTH_JUDGMENT_STRENGTH');
    }
  } else if (value.kind === 'gyeokguk') {
    strictObject(
      value,
      [
        ...base,
        'type', 'typeCode', 'category', 'categoryCode',
        'baseTenGod', 'baseTenGodCode', 'confidence',
      ],
      ['judgmentStrength'],
      'GYEOKGUK_FACT_SHAPE',
    );
    strictFactBase(value);
    if (value.domain !== 'saju') contractFail('GYEOKGUK_DOMAIN');
    strictString(value.type, 'GYEOKGUK_TYPE');
    strictNullableMachineCode(value.typeCode, 'GYEOKGUK_TYPE_CODE');
    strictString(value.category, 'GYEOKGUK_CATEGORY');
    strictEnum(value.categoryCode, new Set(['NORMAL', 'JONGGYEOK', 'UNKNOWN']), 'GYEOKGUK_CATEGORY_CODE');
    strictNullableString(value.baseTenGod, 'GYEOKGUK_BASE_TEN_GOD');
    strictNullableMachineCode(value.baseTenGodCode, 'GYEOKGUK_BASE_TEN_GOD_CODE');
    strictFiniteNumber(value.confidence, 'GYEOKGUK_CONFIDENCE');
    if (value.confidence < 0 || value.confidence > 1) contractFail('GYEOKGUK_CONFIDENCE');
    if (hasOwn(value, 'judgmentStrength')) {
      strictEnum(value.judgmentStrength, JUDGMENT_STRENGTHS, 'GYEOKGUK_JUDGMENT_STRENGTH');
    }
  } else if (value.kind === 'yongshin') {
    strictObject(
      value,
      [...base, 'element', 'confidence', 'warnings'],
      [
        'judgmentStrength',
        'interpretationPolicy',
        'methodCandidates',
        'consensus',
        'jonggyeokRisk',
      ],
      'YONGSHIN_FACT_SHAPE',
    );
    strictFactBase(value);
    if (value.domain !== 'saju' || value.method !== 'saju-ts.yongshin.v1') {
      contractFail('YONGSHIN_AUTHORITY');
    }
    strictElement(value.element, 'YONGSHIN_ELEMENT', true);
    strictFiniteNumber(value.confidence, 'YONGSHIN_CONFIDENCE');
    if (value.confidence < 0 || value.confidence > 100) contractFail('YONGSHIN_CONFIDENCE');
    strictStringArray(value.warnings, 'YONGSHIN_WARNINGS', { unique: true });
    if (hasOwn(value, 'judgmentStrength')) {
      strictEnum(value.judgmentStrength, JUDGMENT_STRENGTHS, 'YONGSHIN_JUDGMENT_STRENGTH');
    }
    if (hasOwn(value, 'interpretationPolicy')) {
      strictObject(
        value.interpretationPolicy,
        [
          'schoolPreset',
          'schoolLabel',
          'schoolSelection',
          'schoolWeightsApplied',
          'yongshinMode',
          'yongshinModeSelection',
        ],
        [],
        'YONGSHIN_INTERPRETATION_POLICY_SHAPE',
      );
      strictEnum(
        value.interpretationPolicy.schoolPreset,
        new Set([
          'korean',
          'chinese',
          'modern',
          'korean_modern',
          'classical_text',
          'naming_safe',
        ]),
        'YONGSHIN_INTERPRETATION_SCHOOL',
      );
      strictString(value.interpretationPolicy.schoolLabel, 'YONGSHIN_INTERPRETATION_SCHOOL_LABEL');
      strictEnum(
        value.interpretationPolicy.schoolSelection,
        new Set(['product_default', 'user_selected']),
        'YONGSHIN_INTERPRETATION_SCHOOL_SELECTION',
      );
      if (typeof value.interpretationPolicy.schoolWeightsApplied !== 'boolean') {
        contractFail('YONGSHIN_INTERPRETATION_SCHOOL_WEIGHTS');
      }
      strictEnum(
        value.interpretationPolicy.yongshinMode,
        new Set(['classical_blend', 'chengbai_strict', 'consensus_aware']),
        'YONGSHIN_INTERPRETATION_MODE',
      );
      strictEnum(
        value.interpretationPolicy.yongshinModeSelection,
        new Set(['product_default', 'user_selected']),
        'YONGSHIN_INTERPRETATION_MODE_SELECTION',
      );
    }
    if (hasOwn(value, 'methodCandidates')) {
      strictArray(value.methodCandidates, 'YONGSHIN_METHOD_CANDIDATES', 6, 6);
      const expectedMethods = [
        'eokbu',
        'johu',
        'gyeokguk',
        'tonggwan',
        'byeongyak',
        'siksangFlow',
      ];
      for (const [index, candidate] of value.methodCandidates.entries()) {
        strictObject(candidate, ['method', 'element', 'score'], [], 'YONGSHIN_METHOD_CANDIDATE_SHAPE');
        if (candidate.method !== expectedMethods[index]) {
          contractFail('YONGSHIN_METHOD_CANDIDATE_ORDER');
        }
        strictElement(candidate.element, 'YONGSHIN_METHOD_CANDIDATE_ELEMENT', true);
        strictFiniteNumber(candidate.score, 'YONGSHIN_METHOD_CANDIDATE_SCORE');
        if (candidate.score < 0 || candidate.score > 1) {
          contractFail('YONGSHIN_METHOD_CANDIDATE_SCORE');
        }
      }
    }
    if (hasOwn(value, 'consensus')) {
      strictObject(
        value.consensus,
        ['conflictLevel', 'competingElements'],
        [],
        'YONGSHIN_CONSENSUS_SHAPE',
      );
      strictEnum(
        value.consensus.conflictLevel,
        new Set(['none', 'low', 'medium', 'high']),
        'YONGSHIN_CONSENSUS_CONFLICT',
      );
      strictElementArray(value.consensus.competingElements, 'YONGSHIN_CONSENSUS_ELEMENTS', true);
    }
    if (hasOwn(value, 'jonggyeokRisk')) {
      strictObject(
        value.jonggyeokRisk,
        [
          'level',
          'direction',
          'strengthIndex',
          'dominanceRatio',
          'subtypes',
          'maxCandidateScore',
          'confidenceAttenuated',
        ],
        [],
        'YONGSHIN_JONGGYEOK_RISK_SHAPE',
      );
      strictEnum(value.jonggyeokRisk.level, new Set(['HIGH', 'INFO']), 'YONGSHIN_JONGGYEOK_LEVEL');
      strictEnum(
        value.jonggyeokRisk.direction,
        new Set(['PRESSURE', 'SUPPORT']),
        'YONGSHIN_JONGGYEOK_DIRECTION',
      );
      strictFiniteNumber(value.jonggyeokRisk.strengthIndex, 'YONGSHIN_JONGGYEOK_STRENGTH');
      strictFiniteNumber(value.jonggyeokRisk.dominanceRatio, 'YONGSHIN_JONGGYEOK_DOMINANCE');
      strictFiniteNumber(value.jonggyeokRisk.maxCandidateScore, 'YONGSHIN_JONGGYEOK_SCORE');
      if (value.jonggyeokRisk.strengthIndex < -1
        || value.jonggyeokRisk.strengthIndex > 1
        || value.jonggyeokRisk.dominanceRatio < 0
        || value.jonggyeokRisk.maxCandidateScore < 0) {
        contractFail('YONGSHIN_JONGGYEOK_RANGE');
      }
      strictStringArray(value.jonggyeokRisk.subtypes, 'YONGSHIN_JONGGYEOK_SUBTYPES', {
        unique: true,
      });
      if (typeof value.jonggyeokRisk.confidenceAttenuated !== 'boolean') {
        contractFail('YONGSHIN_JONGGYEOK_ATTENUATION');
      }
    }
  } else if (value.kind === 'element_distribution') {
    strictObject(value, [...base, 'source', 'subjectScope', 'normalization', 'values'], [], 'ELEMENT_DISTRIBUTION_FACT_SHAPE');
    strictFactBase(value);
    strictEnum(value.source, new Set(['saju', 'name']), 'ELEMENT_DISTRIBUTION_SOURCE');
    if ((value.source === 'saju' && value.subjectScope !== 'natal_chart')
      || (value.source === 'name' && value.subjectScope !== 'full_name')) {
      contractFail('ELEMENT_DISTRIBUTION_SCOPE');
    }
    if (value.normalization !== 'within_source_percent') {
      contractFail('ELEMENT_DISTRIBUTION_NORMALIZATION');
    }
    if ((value.source === 'saju' && value.domain !== 'saju')
      || (value.source === 'name'
        && value.domain !== 'naming'
        && value.domain !== 'interaction')) {
      contractFail('ELEMENT_DISTRIBUTION_DOMAIN');
    }
    strictArray(value.values, 'ELEMENT_DISTRIBUTION_VALUES', 5, 5);
    const elements = new Set<string>();
    let sum = 0;
    for (const item of value.values) {
      strictObject(item, ['element', 'sharePercent'], [], 'ELEMENT_DISTRIBUTION_ITEM');
      strictElement(item.element, 'ELEMENT_DISTRIBUTION_ELEMENT');
      strictFiniteNumber(item.sharePercent, 'ELEMENT_DISTRIBUTION_RANGE');
      if (item.sharePercent < 0 || item.sharePercent > 100 || elements.has(item.element as string)) {
        contractFail('ELEMENT_DISTRIBUTION_RANGE');
      }
      elements.add(item.element as string);
      sum += item.sharePercent;
    }
    if (elements.size !== ELEMENT_IDS.size || Math.abs(sum - 100) > 0.02) {
      contractFail('ELEMENT_DISTRIBUTION_RANGE');
    }
  } else if (value.kind === 'pillars') {
    strictObject(value, [...base, 'values'], [], 'PILLARS_FACT_SHAPE');
    strictFactBase(value);
    if (value.domain !== 'saju') contractFail('PILLARS_DOMAIN');
    strictArray(value.values, 'PILLARS_VALUES', 4, 4);
    const expectedPositions = ['year', 'month', 'day', 'hour'];
    for (const [index, item] of value.values.entries()) {
      strictObject(item, ['position', 'stem', 'branch'], [], 'PILLAR_SHAPE');
      if (item.position !== expectedPositions[index]) contractFail('PILLAR_ORDER');
      for (const half of ['stem', 'branch'] as const) {
        strictObject(item[half], ['code', 'hangul', 'hanja'], [], 'PILLAR_HALF_SHAPE');
        strictString(item[half].code, 'PILLAR_CODE');
        strictString(item[half].hangul, 'PILLAR_HANGUL');
        strictString(item[half].hanja, 'PILLAR_HANJA');
      }
    }
  } else if (value.kind === 'shinsal_hits') {
    strictObject(
      value,
      [...base, 'source', 'projection', 'sourceFields', 'hits'],
      [],
      'SHINSAL_HITS_FACT_SHAPE',
    );
    strictSajuProjectionProvenance(
      value,
      'saju-ts.shinsal-summary-projection.v1',
      ['shinsalHits'],
    );
    strictArray(value.hits, 'SHINSAL_HITS', 0, 256);
    for (const hit of value.hits) {
      strictObject(
        hit,
        ['name', 'calculationBasis', 'grade', 'seatPillars', 'occurrenceCount'],
        [],
        'SHINSAL_HIT_SHAPE',
      );
      strictBoundedText(hit.name, 'SHINSAL_HIT_NAME', 80);
      strictObject(
        hit.calculationBasis,
        ['label', 'code'],
        [],
        'SHINSAL_HIT_BASIS',
      );
      strictBoundedText(hit.calculationBasis.label, 'SHINSAL_HIT_BASIS', 40);
      if (hit.calculationBasis.code !== null) {
        if (typeof hit.calculationBasis.code !== 'string'
          || !/^[A-Z][A-Z_]{0,39}$/u.test(hit.calculationBasis.code)) {
          contractFail('SHINSAL_HIT_BASIS');
        }
      }
      strictBoundedText(hit.grade, 'SHINSAL_HIT_GRADE', 16);
      strictStringArray(hit.seatPillars, 'SHINSAL_HIT_SEATS', {
        max: SAJU_PILLAR_POSITIONS.size,
        allowed: SAJU_PILLAR_POSITIONS,
        unique: true,
      });
      strictSafeInteger(hit.occurrenceCount, 'SHINSAL_HIT_COUNT', 1);
    }
  } else if (value.kind === 'ten_god_analysis') {
    strictObject(
      value,
      [...base, 'source', 'projection', 'sourceFields', 'dayMasterStem', 'positions'],
      [],
      'TEN_GOD_ANALYSIS_FACT_SHAPE',
    );
    strictSajuProjectionProvenance(
      value,
      'saju-ts.ten-god-analysis-projection.v1',
      ['tenGodAnalysis'],
    );
    strictBoundedText(value.dayMasterStem, 'TEN_GOD_DAY_MASTER', 16);
    strictArray(value.positions, 'TEN_GOD_POSITIONS', 4, 4);
    const expectedPositions = ['year', 'month', 'day', 'hour'];
    for (const [index, position] of value.positions.entries()) {
      strictObject(
        position,
        ['position', 'cheongan', 'jijiPrincipal', 'hiddenStems'],
        [],
        'TEN_GOD_POSITION_SHAPE',
      );
      if (position.position !== expectedPositions[index]) {
        contractFail('TEN_GOD_POSITION_ORDER');
      }
      strictTenGodDescriptor(position.cheongan, 'TEN_GOD_CHEONGAN');
      strictTenGodDescriptor(position.jijiPrincipal, 'TEN_GOD_JIJI');
      strictArray(position.hiddenStems, 'TEN_GOD_HIDDEN_STEMS', 1, 3);
      const seenStems = new Set<string>();
      let ratioTotal = 0;
      for (const hidden of position.hiddenStems) {
        strictObject(
          hidden,
          ['stem', 'element', 'ratio', 'tenGod'],
          [],
          'TEN_GOD_HIDDEN_STEM_SHAPE',
        );
        strictBoundedText(hidden.stem, 'TEN_GOD_HIDDEN_STEM', 16);
        if (seenStems.has(hidden.stem as string)) contractFail('TEN_GOD_HIDDEN_STEM');
        seenStems.add(hidden.stem as string);
        strictElement(hidden.element, 'TEN_GOD_HIDDEN_ELEMENT');
        strictFiniteNumber(hidden.ratio, 'TEN_GOD_HIDDEN_STEM_RATIO');
        if (hidden.ratio < 0 || hidden.ratio > 1) {
          contractFail('TEN_GOD_HIDDEN_STEM_RATIO');
        }
        ratioTotal += hidden.ratio as number;
        strictTenGodDescriptor(hidden.tenGod, 'TEN_GOD_HIDDEN_DESCRIPTOR');
      }
      if (ratioTotal !== 0 && Math.abs(ratioTotal - 1) > 1e-6) {
        contractFail('TEN_GOD_HIDDEN_STEM_RATIO');
      }
    }
  } else if (value.kind === 'natal_relations') {
    strictObject(
      value,
      [...base, 'source', 'projection', 'sourceFields', 'cheongan', 'jiji'],
      [],
      'NATAL_RELATIONS_FACT_SHAPE',
    );
    strictSajuProjectionProvenance(
      value,
      'saju-ts.natal-relations-projection.v1',
      ['cheonganRelations', 'jijiRelations'],
    );
    strictArray(value.cheongan, 'CHEONGAN_RELATIONS', 0, 64);
    for (const relation of value.cheongan) {
      strictObject(
        relation,
        ['type', 'stems', 'hapState', 'resultElement', 'resultConfirmed'],
        [],
        'CHEONGAN_RELATION_SHAPE',
      );
      strictBoundedText(relation.type, 'CHEONGAN_RELATION_TYPE', 40);
      strictStringArray(relation.stems, 'CHEONGAN_RELATION_STEMS', {
        min: 2,
        max: 2,
        unique: true,
      });
      for (const stem of relation.stems) {
        strictBoundedText(stem, 'CHEONGAN_RELATION_STEMS', 16);
      }
      if (relation.hapState !== null) {
        strictBoundedText(relation.hapState, 'CHEONGAN_RELATION_HAP_STATE', 40);
      }
      strictElement(relation.resultElement, 'CHEONGAN_RELATION_RESULT', true);
      if (typeof relation.resultConfirmed !== 'boolean'
        || (relation.resultConfirmed === true && relation.resultElement === null)) {
        contractFail('CHEONGAN_RELATION_RESULT');
      }
    }
    strictArray(value.jiji, 'JIJI_RELATIONS', 0, 128);
    for (const relation of value.jiji) {
      strictObject(
        relation,
        ['type', 'branches', 'outcome'],
        [],
        'JIJI_RELATION_SHAPE',
      );
      strictBoundedText(relation.type, 'JIJI_RELATION_TYPE', 40);
      strictStringArray(relation.branches, 'JIJI_RELATION_BRANCHES', {
        min: 2,
        max: 4,
        unique: true,
      });
      for (const branch of relation.branches) {
        strictBoundedText(branch, 'JIJI_RELATION_BRANCHES', 16);
      }
      if (relation.outcome !== null) {
        strictBoundedText(relation.outcome, 'JIJI_RELATION_OUTCOME', 80);
      }
    }
  } else if (value.kind === 'element_balance') {
    strictObject(
      value,
      [...base, 'source', 'projection', 'sourceFields', 'deficient', 'excessive'],
      [],
      'ELEMENT_BALANCE_FACT_SHAPE',
    );
    strictSajuProjectionProvenance(
      value,
      'saju-ts.element-balance-projection.v1',
      ['deficientElements', 'excessiveElements'],
    );
    strictElementArray(value.deficient, 'ELEMENT_BALANCE_DEFICIENT', true);
    strictElementArray(value.excessive, 'ELEMENT_BALANCE_EXCESSIVE', true);
    if ((value.deficient as string[]).some((element) =>
      (value.excessive as string[]).includes(element))) {
      contractFail('ELEMENT_BALANCE_CONSISTENCY');
    }
  } else if (value.kind === 'time_correction') {
    strictObject(
      value,
      [
        ...base,
        'input',
        'inputUncertainty',
        'lunarConversion',
        'location',
        'referenceMeridianDegrees',
        'referenceMeridianBasis',
        'standardLocalDateTime',
        'adjustedSolarLocalDateTime',
        'corrections',
        'policy',
        'solarDateChanged',
        'yazaBoundaryEffect',
      ],
      [],
      'TIME_CORRECTION_FACT_SHAPE',
    );
    strictFactBase(value);
    if (value.domain !== 'saju' || value.method !== 'saju-ts.time-correction.v1') {
      contractFail('TIME_CORRECTION_AUTHORITY');
    }
    strictTimeCorrectionInput(value.input);
    strictTimeCorrectionUncertainty(
      value.inputUncertainty,
      value.input.timePrecision,
    );
    strictLunarConversion(value.lunarConversion, value.input);
    strictObject(
      value.location,
      [
        'inputLabel',
        'resolvedRegionCode',
        'latitude',
        'longitude',
        'timezone',
        'source',
        'coordinatesApplied',
      ],
      [],
      'TIME_CORRECTION_LOCATION',
    );
    if (value.location.inputLabel !== null) {
      strictString(value.location.inputLabel, 'TIME_CORRECTION_LOCATION');
    }
    if (value.location.resolvedRegionCode !== null) {
      strictString(value.location.resolvedRegionCode, 'TIME_CORRECTION_LOCATION');
    }
    if (value.location.latitude !== null) {
      strictFiniteNumber(value.location.latitude, 'TIME_CORRECTION_LOCATION');
    }
    if (value.location.longitude !== null) {
      strictFiniteNumber(value.location.longitude, 'TIME_CORRECTION_LOCATION');
    }
    strictString(value.location.timezone, 'TIME_CORRECTION_LOCATION');
    strictEnum(
      value.location.source,
      new Set(['explicit', 'region', 'timezone', 'default']),
      'TIME_CORRECTION_LOCATION',
    );
    if (typeof value.location.coordinatesApplied !== 'boolean'
      || (value.location.latitude === null) !== (value.location.longitude === null)
      || (value.location.latitude !== null
        && (value.location.latitude < -90 || value.location.latitude > 90))
      || (value.location.longitude !== null
        && (value.location.longitude < -180 || value.location.longitude > 180))) {
      contractFail('TIME_CORRECTION_LOCATION');
    }
    if ((value.location.source === 'region'
        && (value.location.inputLabel === null
          || value.location.resolvedRegionCode === null))
      || (value.location.source === 'default'
        && value.location.inputLabel !== null)
      || (value.location.source === 'timezone'
        && (value.location.inputLabel !== null
          || value.location.resolvedRegionCode !== null
          || value.location.latitude !== null
          || value.location.longitude !== null
          || value.location.coordinatesApplied))
      || (value.location.source !== 'timezone'
        && (value.location.latitude === null || value.location.longitude === null))
      || (value.location.resolvedRegionCode !== null
        && value.location.latitude !== null
        && value.location.longitude !== null
        && !supportedRegionLocationMatches(
          value.location.resolvedRegionCode,
          value.location.latitude,
          value.location.longitude,
          value.location.timezone,
        ))) {
      contractFail('TIME_CORRECTION_LOCATION_CONSISTENCY');
    }
    if (value.referenceMeridianDegrees !== null) {
      strictFiniteNumber(value.referenceMeridianDegrees, 'TIME_CORRECTION_MERIDIAN');
      if (value.referenceMeridianDegrees < -180 || value.referenceMeridianDegrees > 180) {
        contractFail('TIME_CORRECTION_MERIDIAN');
      }
    }
    strictLocalDateTime(value.standardLocalDateTime, 'TIME_CORRECTION_STANDARD');
    strictLocalDateTime(value.adjustedSolarLocalDateTime, 'TIME_CORRECTION_ADJUSTED');
    strictObject(
      value.referenceMeridianBasis,
      ['kind'],
      ['utcOffsetMinutes', 'presetCode'],
      'TIME_CORRECTION_MERIDIAN_BASIS',
    );
    const meridianBasis = value.referenceMeridianBasis;
    let expectedReferenceMeridianDegrees: number | null = null;
    if (meridianBasis.kind === 'disabled') {
      strictObject(
        meridianBasis,
        ['kind'],
        [],
        'TIME_CORRECTION_MERIDIAN_BASIS',
      );
    } else if (meridianBasis.kind === 'civil_offset_at_birth') {
      strictObject(
        meridianBasis,
        ['kind', 'utcOffsetMinutes'],
        [],
        'TIME_CORRECTION_MERIDIAN_BASIS',
      );
      strictFiniteNumber(
        meridianBasis.utcOffsetMinutes,
        'TIME_CORRECTION_MERIDIAN_BASIS',
      );
      if (!Number.isSafeInteger(meridianBasis.utcOffsetMinutes)
        || meridianBasis.utcOffsetMinutes < -840
        || meridianBasis.utcOffsetMinutes > 840) {
        contractFail('TIME_CORRECTION_MERIDIAN_BASIS');
      }
      const resolvedOffset = resolveCivilOffsetMinutesForValidation(
        value.location.timezone,
        value.standardLocalDateTime,
      );
      if (resolvedOffset === null
        || resolvedOffset !== meridianBasis.utcOffsetMinutes) {
        contractFail('TIME_CORRECTION_MERIDIAN_CONSISTENCY');
      }
      expectedReferenceMeridianDegrees = normalizeReferenceMeridianDegrees(
        meridianBasis.utcOffsetMinutes / 4,
      );
    } else if (meridianBasis.kind === 'legacy_preset_registry') {
      strictObject(
        meridianBasis,
        ['kind', 'presetCode'],
        [],
        'TIME_CORRECTION_MERIDIAN_BASIS',
      );
      if (!isLegacyPresetReferenceCode(meridianBasis.presetCode)) {
        contractFail('TIME_CORRECTION_MERIDIAN_BASIS');
      }
      expectedReferenceMeridianDegrees =
        LEGACY_PRESET_REFERENCE_MERIDIANS[meridianBasis.presetCode];
    } else {
      contractFail('TIME_CORRECTION_MERIDIAN_BASIS');
    }
    if (expectedReferenceMeridianDegrees !== null
      && (value.referenceMeridianDegrees === null
        || Math.abs(
          value.referenceMeridianDegrees - expectedReferenceMeridianDegrees,
        ) > 1e-9)) {
      contractFail('TIME_CORRECTION_MERIDIAN_CONSISTENCY');
    }
    strictObject(
      value.corrections,
      ['daylightSavingMinutes', 'longitudeMinutes', 'equationOfTimeMinutes'],
      [],
      'TIME_CORRECTION_VALUES',
    );
    for (const key of [
      'daylightSavingMinutes',
      'longitudeMinutes',
      'equationOfTimeMinutes',
    ] as const) {
      strictFiniteNumber(value.corrections[key], 'TIME_CORRECTION_VALUES');
    }
    const longitudeMinutes = value.corrections.longitudeMinutes;
    const equationOfTimeMinutes = value.corrections.equationOfTimeMinutes;
    const daylightSavingMinutes = value.corrections.daylightSavingMinutes;
    strictFiniteNumber(longitudeMinutes, 'TIME_CORRECTION_VALUES');
    strictFiniteNumber(equationOfTimeMinutes, 'TIME_CORRECTION_VALUES');
    strictFiniteNumber(daylightSavingMinutes, 'TIME_CORRECTION_VALUES');
    if (!Number.isSafeInteger(daylightSavingMinutes)
      || daylightSavingMinutes < 0
      || daylightSavingMinutes > MAX_DAYLIGHT_SAVING_MINUTES
      || Math.abs(equationOfTimeMinutes) > MAX_EQUATION_OF_TIME_MINUTES) {
      contractFail('TIME_CORRECTION_VALUES');
    }
    strictObject(
      value.policy,
      [
        'trueSolarTime',
        'longitudeCorrection',
        'longitudeReference',
        'explicitLocationRequired',
        'yaza',
        'yazaMode',
      ],
      [],
      'TIME_CORRECTION_POLICY',
    );
    strictEnum(value.policy.trueSolarTime, new Set(['on', 'off']), 'TIME_CORRECTION_POLICY');
    strictEnum(value.policy.longitudeCorrection, new Set(['on', 'off']), 'TIME_CORRECTION_POLICY');
    strictEnum(
      value.policy.longitudeReference,
      new Set(['off', 'civilOffsetMeridian', 'legacyPreset']),
      'TIME_CORRECTION_POLICY',
    );
    if (typeof value.policy.explicitLocationRequired !== 'boolean') {
      contractFail('TIME_CORRECTION_POLICY');
    }
    strictEnum(value.policy.yaza, new Set(['on', 'off']), 'TIME_CORRECTION_POLICY');
    strictEnum(value.policy.yazaMode, new Set(['23:00', '23:30']), 'TIME_CORRECTION_POLICY');
    strictEnum(
      value.yazaBoundaryEffect,
      new Set(['disabled', 'outside_boundary', 'inside_boundary']),
      'TIME_CORRECTION_YAZA',
    );
    if (typeof value.solarDateChanged !== 'boolean') contractFail('TIME_CORRECTION_DATE_CHANGE');

    const standard = value.standardLocalDateTime;
    const adjusted = value.adjustedSolarLocalDateTime;
    const input = value.input;
    const provided = input.providedLocalDateTime;
    const effective = input.effectiveSolarDate;
    let expectedStandardHour = provided.hour;
    let expectedStandardMinute = provided.minute;
    let fallbackTimezone: unknown;
    if (input.timePrecision !== 'exact') {
      const uncertainty = value.inputUncertainty as Record<string, unknown>;
      const detail = uncertainty[
        input.timePrecision === 'unknown_hour' ? 'unknownHour' : 'unknownMinute'
      ] as Record<string, unknown>;
      expectedStandardHour = detail.fallbackHour as number;
      expectedStandardMinute = detail.fallbackMinute as number;
      fallbackTimezone = detail.fallbackTimezone;
    }
    if (standard.year !== effective.year
      || standard.month !== effective.month
      || standard.day !== effective.day
      || standard.hour !== expectedStandardHour
      || standard.minute !== expectedStandardMinute
      || (input.calendarType === 'solar'
        && (provided.year !== effective.year
          || provided.month !== effective.month
          || provided.day !== effective.day))
      || (fallbackTimezone !== undefined
        && fallbackTimezone !== value.location.timezone)) {
      contractFail('TIME_CORRECTION_INPUT_CONSISTENCY');
    }
    const expectedDateChanged = standard.year !== adjusted.year
      || standard.month !== adjusted.month
      || standard.day !== adjusted.day;
    const expectedAdjusted = shiftLocalDateTimeByCorrectionMinutes(
      standard,
      longitudeMinutes + equationOfTimeMinutes,
    );
    const adjustedMatchesCorrection = adjusted.year === expectedAdjusted.year
      && adjusted.month === expectedAdjusted.month
      && adjusted.day === expectedAdjusted.day
      && adjusted.hour === expectedAdjusted.hour
      && adjusted.minute === expectedAdjusted.minute;
    const insideYazaBoundary = value.policy.yazaMode === '23:30'
      ? adjusted.hour === 23 && adjusted.minute >= 30
      : adjusted.hour === 23;
    const expectedBoundary = value.policy.yaza === 'off'
      ? 'disabled'
      : insideYazaBoundary ? 'inside_boundary' : 'outside_boundary';
    const normalizeLongitudeDegrees = (degrees: number): number =>
      ((degrees + 180) % 360 + 360) % 360 - 180;
    const expectedLongitudeMinutes = value.referenceMeridianDegrees === null
      ? 0
      : value.location.longitude === null
        ? Number.NaN
      : normalizeLongitudeDegrees(
        value.location.longitude - value.referenceMeridianDegrees,
      ) * 4;
    if (value.solarDateChanged !== expectedDateChanged
      || !adjustedMatchesCorrection
      || value.yazaBoundaryEffect !== expectedBoundary
      || (value.policy.longitudeCorrection === 'off'
        && (value.policy.longitudeReference !== 'off'
          || longitudeMinutes !== 0
          || value.referenceMeridianDegrees !== null
          || meridianBasis.kind !== 'disabled'
          || value.location.coordinatesApplied))
      || (value.policy.longitudeCorrection === 'on'
        && (value.policy.longitudeReference === 'off'
          || value.referenceMeridianDegrees === null
          || meridianBasis.kind === 'disabled'
          || (value.policy.longitudeReference === 'civilOffsetMeridian'
            && meridianBasis.kind !== 'civil_offset_at_birth')
          || (value.policy.longitudeReference === 'legacyPreset'
            && meridianBasis.kind !== 'legacy_preset_registry')
          || expectedReferenceMeridianDegrees === null
          || Math.abs(
            value.referenceMeridianDegrees - expectedReferenceMeridianDegrees
          ) > 1e-9
          || !value.location.coordinatesApplied
          || value.location.latitude === null
          || value.location.longitude === null
          || Math.abs(longitudeMinutes - expectedLongitudeMinutes) > 1e-6))
      || (value.policy.explicitLocationRequired
        && value.location.source !== 'region'
        && value.location.source !== 'explicit')
      || (value.policy.trueSolarTime === 'on'
        && !value.policy.explicitLocationRequired)
      || (value.policy.longitudeReference === 'legacyPreset'
        && !value.policy.explicitLocationRequired)
      || (value.policy.trueSolarTime === 'off'
        && equationOfTimeMinutes !== 0)) {
      contractFail('TIME_CORRECTION_CONSISTENCY');
    }
  } else if (value.kind === 'name_character') {
    strictObject(
      value,
      [...base, 'position', 'index', 'hangul', 'legal'],
      ['hanja', 'meaning', 'strokes', 'element', 'polarity'],
      'NAME_CHARACTER_FACT_SHAPE',
    );
    strictFactBase(value);
    if (value.domain !== 'naming') contractFail('NAME_CHARACTER_DOMAIN');
    strictEnum(value.position, new Set(['surname', 'givenName']), 'NAME_CHARACTER_POSITION');
    strictSafeInteger(value.index, 'NAME_CHARACTER_INDEX');
    strictString(value.hangul, 'NAME_CHARACTER_HANGUL');
    strictEnum(value.legal, new Set(['registrable', 'not_registrable', 'unknown']), 'NAME_CHARACTER_LEGAL');
    for (const key of ['hanja', 'meaning', 'polarity']) {
      if (hasOwn(value, key)) strictString(value[key], 'NAME_CHARACTER_' + key.toUpperCase());
    }
    if (hasOwn(value, 'strokes')) strictSafeInteger(value.strokes, 'NAME_CHARACTER_STROKES');
    if (hasOwn(value, 'element')) strictElement(value.element, 'NAME_CHARACTER_ELEMENT');
    if (value.method === 'spring-ts.pure-hangul-character.v1') {
      if (hasOwn(value, 'hanja') || hasOwn(value, 'strokes') || value.legal !== 'unknown') {
        contractFail('NAME_CHARACTER_BASIS');
      }
    } else if (value.method === 'spring-ts.naming-report-character.v1') {
      if (!hasOwn(value, 'hanja') || !hasOwn(value, 'strokes')) {
        contractFail('NAME_CHARACTER_BASIS');
      }
    } else {
      contractFail('NAME_CHARACTER_METHOD');
    }
  } else if (value.kind === 'naming_trend') {
    strictObject(
      value,
      [
        ...base,
        'source',
        'projection',
        'sourceFields',
        'sourceTier',
        'authorityTruthEligible',
        'givenHangul',
        'gender',
        'birthYear',
        'matchedYear',
        'latestYear',
        'trendFit',
        'trendRisk',
        'eraFitScore',
        'status',
        'matchedPoint',
        'latestPoint',
      ],
      [],
      'NAMING_TREND_FACT_SHAPE',
    );
    strictFactBase(value);
    if (value.id !== 'naming.name-trend'
      || value.domain !== 'naming'
      || value.method !== 'spring-ts.official-name-trend-projection.v1'
      || value.source !== 'spring-ts.NamingReport.nameTrend'
      || value.projection !== 'selective_without_recalculation'
      || value.sourceTier !== 'T5_OFFICIAL'
      || value.authorityTruthEligible !== true) {
      contractFail('NAMING_TREND_PROVENANCE');
    }
    strictStringArray(value.sourceFields, 'NAMING_TREND_PROVENANCE', {
      min: 1,
      max: 1,
      unique: true,
    });
    if (!sameStringArray(value.sourceFields, ['nameTrend'])) {
      contractFail('NAMING_TREND_PROVENANCE');
    }
    strictBoundedText(value.givenHangul, 'NAMING_TREND_IDENTITY', 8);
    if (!/^[가-힣]+$/u.test(value.givenHangul)) {
      contractFail('NAMING_TREND_IDENTITY');
    }
    strictEnum(value.gender, NAME_GENDERS, 'NAMING_TREND_GENDER');
    const birthYear = value.birthYear === null
      ? null
      : strictPositiveYear(value.birthYear, 'NAMING_TREND_YEAR');
    const matchedYear = value.matchedYear === null
      ? null
      : strictPositiveYear(value.matchedYear, 'NAMING_TREND_YEAR');
    const latestYear = strictPositiveYear(value.latestYear, 'NAMING_TREND_YEAR');
    const trendFit = strictNullableScore(value.trendFit, 'NAMING_TREND_SCORE');
    const trendRisk = strictNullableScore(value.trendRisk, 'NAMING_TREND_SCORE');
    const eraFitScore = strictNullableScore(value.eraFitScore, 'NAMING_TREND_SCORE');
    strictEnum(value.status, NAMING_TREND_STATUSES, 'NAMING_TREND_STATUS');
    const matchedPoint = strictTrendPoint(
      value.matchedPoint,
      'NAMING_TREND_MATCHED_POINT',
    );
    const latestPoint = strictTrendPoint(
      value.latestPoint,
      'NAMING_TREND_LATEST_POINT',
    );
    if (trendFit !== eraFitScore
      || (value.status === 'unknown') !== (
        trendFit === null && trendRisk === null && eraFitScore === null
      )
      || (matchedPoint !== null && matchedPoint.year !== matchedYear)
      || (latestPoint !== null && latestPoint.year !== latestYear)
      || (matchedYear !== null && matchedYear > latestYear)
      || (birthYear !== null && birthYear > Number.MAX_SAFE_INTEGER)) {
      contractFail('NAMING_TREND_CONSISTENCY');
    }
  } else if (value.kind === 'naming_phonetic') {
    strictObject(
      value,
      [
        ...base,
        'source',
        'projection',
        'sourceFields',
        'sourceTier',
        'authorityTruthEligible',
        'fullHangul',
        'surnameHangul',
        'givenHangul',
        'phoneticScore',
        'transitionScore',
        'familyNameFitScore',
        'status',
        'transitions',
      ],
      [],
      'NAMING_PHONETIC_FACT_SHAPE',
    );
    strictFactBase(value);
    if (value.id !== 'naming.phonetic'
      || value.domain !== 'naming'
      || value.method !== 'spring-ts.phonetic-transition-projection.v1'
      || value.source !== 'spring-ts.NamingReport.phonetic'
      || value.projection !== 'selective_without_recalculation'
      || value.sourceTier !== 'T3_AUTHORED_INTERPRETATION'
      || value.authorityTruthEligible !== false) {
      contractFail('NAMING_PHONETIC_PROVENANCE');
    }
    strictStringArray(value.sourceFields, 'NAMING_PHONETIC_PROVENANCE', {
      min: 1,
      max: 1,
      unique: true,
    });
    if (!sameStringArray(value.sourceFields, ['phonetic'])) {
      contractFail('NAMING_PHONETIC_PROVENANCE');
    }
    strictBoundedText(value.fullHangul, 'NAMING_PHONETIC_IDENTITY', 12);
    strictBoundedText(value.surnameHangul, 'NAMING_PHONETIC_IDENTITY', 4);
    strictBoundedText(value.givenHangul, 'NAMING_PHONETIC_IDENTITY', 8);
    if (!/^[가-힣]+$/u.test(value.fullHangul)
      || !/^[가-힣]+$/u.test(value.surnameHangul)
      || !/^[가-힣]+$/u.test(value.givenHangul)
      || value.fullHangul !== `${value.surnameHangul}${value.givenHangul}`) {
      contractFail('NAMING_PHONETIC_IDENTITY');
    }
    const phoneticScore = strictNullableScore(
      value.phoneticScore,
      'NAMING_PHONETIC_SCORE',
    );
    const transitionScore = strictNullableScore(
      value.transitionScore,
      'NAMING_PHONETIC_SCORE',
    );
    const familyNameFitScore = strictNullableScore(
      value.familyNameFitScore,
      'NAMING_PHONETIC_SCORE',
    );
    strictEnum(value.status, PHONETIC_STATUSES, 'NAMING_PHONETIC_STATUS');
    strictArray(value.transitions, 'NAMING_PHONETIC_TRANSITIONS', 1, 8);
    const surnameCharacters = Array.from(value.surnameHangul);
    const givenCharacters = Array.from(value.givenHangul);
    if (value.transitions.length !== givenCharacters.length) {
      contractFail('NAMING_PHONETIC_TRANSITIONS');
    }
    const expectedTransitions = [
      {
        from: surnameCharacters[surnameCharacters.length - 1],
        to: givenCharacters[0],
        boundary: 'surname_given',
      },
      ...givenCharacters.slice(0, -1).map((from, index) => ({
        from,
        to: givenCharacters[index + 1],
        boundary: 'given_internal',
      })),
    ];
    const transitionValues: Array<{
      readonly score: number;
      readonly boundary: string;
      readonly severities: readonly string[];
    }> = [];
    for (const [index, transition] of value.transitions.entries()) {
      strictObject(
        transition,
        ['from', 'to', 'boundary', 'score', 'risk', 'signals'],
        [],
        'NAMING_PHONETIC_TRANSITION_SHAPE',
      );
      strictBoundedText(transition.from, 'NAMING_PHONETIC_TRANSITION_IDENTITY', 1);
      strictBoundedText(transition.to, 'NAMING_PHONETIC_TRANSITION_IDENTITY', 1);
      strictEnum(
        transition.boundary,
        PHONETIC_BOUNDARIES,
        'NAMING_PHONETIC_TRANSITION_BOUNDARY',
      );
      const expected = expectedTransitions[index];
      if (!expected
        || transition.from !== expected.from
        || transition.to !== expected.to
        || transition.boundary !== expected.boundary) {
        contractFail('NAMING_PHONETIC_TRANSITION_IDENTITY');
      }
      strictFiniteNumber(transition.score, 'NAMING_PHONETIC_TRANSITION_SCORE');
      if (transition.score < 0 || transition.score > 100) {
        contractFail('NAMING_PHONETIC_TRANSITION_SCORE');
      }
      strictEnum(transition.risk, PHONETIC_RISKS, 'NAMING_PHONETIC_TRANSITION_RISK');
      if (transition.risk !== expectedPhoneticRisk(transition.score)) {
        contractFail('NAMING_PHONETIC_TRANSITION_RISK');
      }
      strictArray(transition.signals, 'NAMING_PHONETIC_SIGNALS', 0, 16);
      const signalCodes = new Set<string>();
      const severities: string[] = [];
      let penaltyTotal = 0;
      for (const signal of transition.signals) {
        strictObject(
          signal,
          ['code', 'severity', 'penalty'],
          [],
          'NAMING_PHONETIC_SIGNAL_SHAPE',
        );
        strictBoundedText(signal.code, 'NAMING_PHONETIC_SIGNAL_CODE', 64);
        if (!/^[a-z][a-z0-9_]{0,63}$/u.test(signal.code)
          || signalCodes.has(signal.code)) {
          contractFail('NAMING_PHONETIC_SIGNAL_CODE');
        }
        signalCodes.add(signal.code);
        strictEnum(signal.severity, PHONETIC_RISKS, 'NAMING_PHONETIC_SIGNAL_SEVERITY');
        strictSafeInteger(signal.penalty, 'NAMING_PHONETIC_SIGNAL_PENALTY');
        if (signal.penalty > 100) {
          contractFail('NAMING_PHONETIC_SIGNAL_PENALTY');
        }
        penaltyTotal += signal.penalty;
        severities.push(signal.severity);
      }
      const expectedScore = Math.max(
        0,
        Math.min(100, roundedOneDecimal(100 - penaltyTotal)),
      );
      if (transition.score !== expectedScore) {
        contractFail('NAMING_PHONETIC_TRANSITION_SCORE');
      }
      transitionValues.push({
        score: transition.score,
        boundary: transition.boundary,
        severities,
      });
    }
    const expectedTransitionScore = roundedOneDecimal(
      transitionValues.reduce((sum, transition) => sum + transition.score, 0)
        / transitionValues.length,
    );
    const expectedFamilyNameFitScore = transitionValues.find(
      (transition) => transition.boundary === 'surname_given',
    )?.score ?? null;
    const expectedPhoneticScore = roundedOneDecimal(
      (expectedTransitionScore * 0.6)
      + ((expectedFamilyNameFitScore ?? 100) * 0.4),
    );
    const severities = transitionValues.flatMap((transition) =>
      transition.severities);
    const expectedStatus = severities.includes('high')
      ? expectedPhoneticScore < 78 ? 'awkward' : 'watch'
      : severities.filter((severity) => severity === 'medium').length >= 2
        ? 'watch'
        : expectedPhoneticScore < 72
          ? 'awkward'
          : expectedPhoneticScore < 86 ? 'watch' : 'smooth';
    if (transitionScore !== expectedTransitionScore
      || familyNameFitScore !== expectedFamilyNameFitScore
      || phoneticScore !== expectedPhoneticScore
      || value.status !== expectedStatus) {
      contractFail('NAMING_PHONETIC_CONSISTENCY');
    }
  } else if (value.kind === 'name_statistics') {
    strictObject(
      value,
      [
        ...base,
        'source',
        'projection',
        'sourceFields',
        'popularityRank',
        'maleRatio',
        'nameGender',
      ],
      [],
      'NAME_STATISTICS_FACT_SHAPE',
    );
    strictFactBase(value);
    if (value.id !== 'naming.statistics'
      || value.domain !== 'naming'
      || value.method !== 'spring-ts.name-stat-summary-projection.v1'
      || value.source !== 'spring-ts.SpringReport'
      || value.projection !== 'selective_without_recalculation') {
      contractFail('NAME_STATISTICS_PROVENANCE');
    }
    strictStringArray(value.sourceFields, 'NAME_STATISTICS_PROVENANCE', {
      min: 3,
      max: 3,
      unique: true,
    });
    if (!sameStringArray(
      value.sourceFields,
      ['popularityRank', 'maleRatio', 'nameGender'],
    )) {
      contractFail('NAME_STATISTICS_PROVENANCE');
    }
    if (value.popularityRank !== null) {
      strictFiniteNumber(value.popularityRank, 'NAME_STATISTICS_RANK');
      if (value.popularityRank <= 0
        || value.popularityRank > Number.MAX_SAFE_INTEGER) {
        contractFail('NAME_STATISTICS_RANK');
      }
    }
    if (value.maleRatio !== null) {
      strictFiniteNumber(value.maleRatio, 'NAME_STATISTICS_RATIO');
      if (value.maleRatio < 0 || value.maleRatio > 1) {
        contractFail('NAME_STATISTICS_RATIO');
      }
    }
    strictEnum(value.nameGender, NAME_GENDERS, 'NAME_STATISTICS_GENDER');
    if ((value.maleRatio === null && value.nameGender !== 'unknown')
      || (value.maleRatio !== null
        && value.nameGender !== (value.maleRatio >= 0.5 ? 'male' : 'female'))
      || (value.popularityRank === null
        && value.maleRatio === null
        && value.nameGender === 'unknown')) {
      contractFail('NAME_STATISTICS_CONSISTENCY');
    }
  } else if (value.kind === 'naming_frame') {
    strictObject(
      value,
      [...base, 'stage', 'frameType', 'strokeSum', 'element', 'polarity', 'luckyLevel'],
      [],
      'NAMING_FRAME_FACT_SHAPE',
    );
    strictFactBase(value);
    if (value.domain !== 'naming') contractFail('NAMING_FRAME_DOMAIN');
    strictEnum(value.stage, FRAME_STAGES, 'NAMING_FRAME_STAGE');
    strictEnum(value.frameType, new Set(['won', 'hyung', 'lee', 'jung']), 'NAMING_FRAME_TYPE');
    strictSafeInteger(value.strokeSum, 'NAMING_FRAME_RANGE');
    strictElement(value.element, 'NAMING_FRAME_ELEMENT', true);
    strictString(value.polarity, 'NAMING_FRAME_POLARITY');
    strictSafeInteger(value.luckyLevel, 'NAMING_FRAME_RANGE');
    if (!NAMING_FRAME_LUCK_BUCKETS.has(value.luckyLevel)) contractFail('NAMING_FRAME_RANGE');
    const expectedStage: Readonly<Record<string, string>> = {
      won: 'earlyLife',
      hyung: 'youthLife',
      lee: 'middleLife',
      jung: 'lateAndTotal',
    };
    if (value.stage !== expectedStage[value.frameType as string]) contractFail('NAMING_FRAME_STAGE');
  } else {
    strictObject(
      value,
      [
        ...base,
        'classification',
        'yongshinElement',
        'gishinElement',
        'nameElements',
        'nameElementScope',
        'yongshinMatchCount',
        'gishinMatchCount',
        'limitations',
      ],
      ['safety'],
      'INTERACTION_FACT_SHAPE',
    );
    strictFactBase(value);
    if (value.domain !== 'interaction'
      || value.method !== 'yongshin-gishin-element-match.v1') {
      contractFail('INTERACTION_AUTHORITY');
    }
    strictEnum(
      value.classification,
      new Set([
        'supportive_signal',
        'mixed_signals',
        'no_direct_match',
        'caution_signal',
        'unavailable',
      ]),
      'INTERACTION_CLASSIFICATION',
    );
    strictElement(value.yongshinElement, 'INTERACTION_YONGSHIN', true);
    strictElement(value.gishinElement, 'INTERACTION_GISHIN', true);
    strictElementArray(value.nameElements, 'INTERACTION_NAME_ELEMENTS');
    if (value.nameElementScope !== 'surname_and_given_name') {
      contractFail('INTERACTION_NAME_ELEMENT_SCOPE');
    }
    strictSafeInteger(value.yongshinMatchCount, 'INTERACTION_COUNT');
    strictSafeInteger(value.gishinMatchCount, 'INTERACTION_COUNT');
    strictStringArray(value.limitations, 'INTERACTION_LIMITATIONS', {
      min: 2,
      max: INTERACTION_LIMITATIONS.size,
      allowed: INTERACTION_LIMITATIONS,
      unique: true,
    });
    if (hasOwn(value, 'safety')) {
      strictObject(
        value.safety,
        ['posture', 'strategy', 'competingElements'],
        ['conflictLevel'],
        'INTERACTION_SAFETY_PROFILE',
      );
      strictEnum(value.safety.posture, new Set(['safe', 'balanced', 'aggressive']), 'INTERACTION_SAFETY_PROFILE');
      strictEnum(
        value.safety.strategy,
        new Set(['legacy_direct_reinforcement', 'safe_balance', 'aggressive_reinforcement']),
        'INTERACTION_SAFETY_PROFILE',
      );
      if (hasOwn(value.safety, 'conflictLevel')) {
        strictEnum(
          value.safety.conflictLevel,
          new Set(['none', 'low', 'medium', 'high']),
          'INTERACTION_SAFETY_PROFILE',
        );
      }
      strictElementArray(value.safety.competingElements, 'INTERACTION_SAFETY_PROFILE', true);
    }
    const yongshinMatchCount = value.yongshinMatchCount as number;
    const gishinMatchCount = value.gishinMatchCount as number;
    const nameElements = value.nameElements as string[];
    const actualYongshinMatches = value.yongshinElement === null
      ? 0
      : nameElements.filter((element) => element === value.yongshinElement).length;
    const actualGishinMatches = value.gishinElement === null
      ? 0
      : nameElements.filter((element) => element === value.gishinElement).length;
    if (yongshinMatchCount > nameElements.length
      || gishinMatchCount > nameElements.length
      || yongshinMatchCount !== actualYongshinMatches
      || gishinMatchCount !== actualGishinMatches
      || (value.yongshinElement === null && yongshinMatchCount !== 0)
      || (value.gishinElement === null && gishinMatchCount !== 0)) {
      contractFail('INTERACTION_COUNT');
    }
    const expectedClassification = value.yongshinElement === null
      ? 'unavailable'
      : gishinMatchCount > yongshinMatchCount && gishinMatchCount >= 1
        ? 'caution_signal'
        : yongshinMatchCount > 0 && gishinMatchCount > 0
          ? 'mixed_signals'
          : yongshinMatchCount > 0
            ? 'supportive_signal'
            : 'no_direct_match';
    const limitations = value.limitations as string[];
    if (value.classification !== expectedClassification
      || !limitations.includes('element_match_scope_only')
      || !limitations.includes('not_a_combined_balance_score')
      || (hasOwn(value, 'safety') === limitations.includes('safety_profile_unavailable'))
      || ((value.safety as Record<string, unknown> | undefined)?.posture === 'aggressive')
        !== limitations.includes('safety_profile_caution')) {
      contractFail('INTERACTION_CLASSIFICATION');
    }
  }

  return value as unknown as ReportFactV1;
}

function strictTextArray(value: unknown, reason: string): void {
  strictStringArray(value, reason, { allowEmptyItems: false });
}

function strictInterpretation(value: unknown): ReportInterpretationV1 {
  strictObject(
    value,
    ['id', 'domain', 'availability', 'authority', 'origin', 'factRefs', 'brief'],
    ['standard', 'expert'],
    'INTERPRETATION_SHAPE',
  );
  strictString(value.id, 'INTERPRETATION_ID');
  strictEnum(value.domain, INTERPRETATION_DOMAINS, 'INTERPRETATION_DOMAIN');
  strictAvailability(value.availability);
  if (value.authority !== 'interpretive') contractFail('INTERPRETATION_AUTHORITY');
  strictEnum(
    value.origin,
    new Set(['deterministic_template', 'authored_bundle', 'mixed']),
    'INTERPRETATION_ORIGIN',
  );
  strictStringArray(value.factRefs, 'INTERPRETATION_FACT_REFS', { unique: true });
  strictObject(value.brief, ['headline'], ['hook'], 'INTERPRETATION_BRIEF');
  strictString(value.brief.headline, 'INTERPRETATION_HEADLINE');
  if (hasOwn(value.brief, 'hook')) strictString(value.brief.hook, 'INTERPRETATION_HOOK');
  if (hasOwn(value, 'standard')) {
    strictObject(
      value.standard,
      ['paragraphs'],
      ['livingTips', 'cautions'],
      'INTERPRETATION_STANDARD',
    );
    strictTextArray(value.standard.paragraphs, 'INTERPRETATION_STANDARD_PARAGRAPHS');
    if (hasOwn(value.standard, 'livingTips')) {
      strictTextArray(value.standard.livingTips, 'INTERPRETATION_STANDARD_LIVING_TIPS');
    }
    if (hasOwn(value.standard, 'cautions')) {
      strictTextArray(value.standard.cautions, 'INTERPRETATION_STANDARD_CAUTIONS');
    }
  }
  if (hasOwn(value, 'expert')) {
    strictObject(
      value.expert,
      ['paragraphs'],
      ['numericalFactRefs'],
      'INTERPRETATION_EXPERT',
    );
    strictTextArray(value.expert.paragraphs, 'INTERPRETATION_EXPERT_PARAGRAPHS');
    if (hasOwn(value.expert, 'numericalFactRefs')) {
      strictStringArray(value.expert.numericalFactRefs, 'INTERPRETATION_NUMERICAL_REFS', {
        unique: true,
      });
    }
  }
  return value as unknown as ReportInterpretationV1;
}

function strictBlock(value: unknown): ReportBlockV1 {
  strictPlainObject(value, 'BLOCK_SHAPE');
  strictEnum(value.kind, BLOCK_KINDS, 'BLOCK_KIND');
  const base = ['id', 'kind', 'title', 'availability'];
  if (value.kind === 'hero') {
    strictObject(value, [...base, 'interpretationRef', 'supportingFactRefs'], [], 'HERO_BLOCK_SHAPE');
    strictString(value.interpretationRef, 'HERO_INTERPRETATION_REF');
    strictStringArray(value.supportingFactRefs, 'HERO_FACT_REFS', { unique: true });
  } else if (value.kind === 'fact_group') {
    strictObject(
      value,
      [...base, 'factRefs', 'presentation'],
      ['interpretationRef'],
      'FACT_GROUP_BLOCK_SHAPE',
    );
    strictStringArray(value.factRefs, 'FACT_GROUP_REFS', { min: 1, unique: true });
    strictEnum(
      value.presentation,
      new Set(['summary', 'metrics', 'pillars', 'characters', 'evidence']),
      'FACT_GROUP_PRESENTATION',
    );
    if (hasOwn(value, 'interpretationRef')) {
      strictString(value.interpretationRef, 'FACT_GROUP_INTERPRETATION_REF');
    }
  } else if (value.kind === 'element_comparison') {
    strictObject(
      value,
      [
        ...base,
        'sajuDistributionFactRef',
        'nameDistributionFactRef',
        'presentation',
        'normalization',
      ],
      [],
      'ELEMENT_COMPARISON_BLOCK_SHAPE',
    );
    strictString(value.sajuDistributionFactRef, 'ELEMENT_COMPARISON_SAJU_REF');
    strictString(value.nameDistributionFactRef, 'ELEMENT_COMPARISON_NAME_REF');
    if (value.presentation !== 'overlay' || value.normalization !== 'within_source_percent') {
      contractFail('ELEMENT_COMPARISON_PRESENTATION');
    }
  } else if (value.kind === 'timeline') {
    strictObject(
      value,
      [...base, 'basis', 'defaultPeriod', 'availablePeriodOrder', 'periods'],
      [],
      'TIMELINE_BLOCK_SHAPE',
    );
    if (value.basis !== 'natal_saju_calendar') contractFail('TIMELINE_BASIS');
    strictEnum(value.defaultPeriod, PERIODS, 'TIMELINE_DEFAULT_PERIOD');
    strictStringArray(value.availablePeriodOrder, 'TIMELINE_PERIOD_ORDER', {
      min: 1,
      max: PERIODS.size,
      allowed: PERIODS,
      unique: true,
    });
    strictArray(value.periods, 'TIMELINE_PERIODS', 1, PERIODS.size);
    for (const period of value.periods) {
      strictObject(period, ['id', 'label', 'cells'], [], 'TIMELINE_PERIOD_SHAPE');
      strictEnum(period.id, PERIODS, 'TIMELINE_PERIOD_ID');
      strictString(period.label, 'TIMELINE_PERIOD_LABEL');
      strictArray(period.cells, 'TIMELINE_CELLS', 1, CATEGORIES.size);
      for (const cell of period.cells) {
        strictObject(
          cell,
          ['category', 'availability'],
          ['ratingFactRef', 'interpretationRef'],
          'TIMELINE_CELL_SHAPE',
        );
        strictEnum(cell.category, CATEGORIES, 'TIMELINE_CATEGORY');
        strictAvailability(cell.availability);
        if (hasOwn(cell, 'ratingFactRef')) strictString(cell.ratingFactRef, 'TIMELINE_RATING_REF');
        if (hasOwn(cell, 'interpretationRef')) {
          strictString(cell.interpretationRef, 'TIMELINE_INTERPRETATION_REF');
        }
      }
    }
  } else if (value.kind === 'life_flow') {
    strictObject(
      value,
      [...base, 'interpretationRef'],
      ['ratingFactRef'],
      'LIFE_FLOW_BLOCK_SHAPE',
    );
    strictString(value.interpretationRef, 'LIFE_INTERPRETATION_REF');
    if (hasOwn(value, 'ratingFactRef')) strictString(value.ratingFactRef, 'LIFE_RATING_REF');
  } else if (value.kind === 'four_frames') {
    strictObject(value, [...base, 'items'], [], 'FOUR_FRAMES_BLOCK_SHAPE');
    strictArray(value.items, 'FOUR_FRAMES_ITEMS', 4, 4);
    for (const item of value.items) {
      strictObject(item, ['stage', 'factRef'], ['interpretationRef'], 'FOUR_FRAME_ITEM_SHAPE');
      strictEnum(item.stage, FRAME_STAGES, 'FOUR_FRAME_STAGE');
      strictString(item.factRef, 'FOUR_FRAME_FACT_REF');
      if (hasOwn(item, 'interpretationRef')) {
        strictString(item.interpretationRef, 'FOUR_FRAME_INTERPRETATION_REF');
      }
    }
  } else if (value.kind === 'capability') {
    strictObject(value, [...base, 'feature'], [], 'CAPABILITY_BLOCK_SHAPE');
    if (value.feature !== 'calendar_fortune') contractFail('CAPABILITY_FEATURE');
  } else if (value.kind === 'premium_teaser') {
    strictObject(
      value,
      [...base, 'offerId'],
      ['teaserInterpretationRef'],
      'PREMIUM_TEASER_BLOCK_SHAPE',
    );
    if (value.offerId !== 'story_completion') contractFail('PREMIUM_TEASER_OFFER');
    if (hasOwn(value, 'teaserInterpretationRef')) {
      strictString(value.teaserInterpretationRef, 'PREMIUM_TEASER_INTERPRETATION_REF');
    }
  } else {
    strictObject(value, [...base, 'targets'], [], 'DEEP_LINKS_BLOCK_SHAPE');
    strictArray(value.targets, 'DEEP_LINK_TARGETS', 1);
    const targets = new Set<string>();
    for (const target of value.targets) {
      strictObject(target, ['surface'], ['anchor'], 'DEEP_LINK_TARGET_SHAPE');
      strictEnum(target.surface, SURFACE_IDS, 'DEEP_LINK_SURFACE');
      if (hasOwn(target, 'anchor')) strictString(target.anchor, 'DEEP_LINK_ANCHOR');
      const key = String(target.surface) + ':' + String(target.anchor ?? '');
      if (targets.has(key)) contractFail('DUPLICATE_DEEP_LINK_TARGET');
      targets.add(key);
    }
  }
  strictString(value.id, 'BLOCK_ID');
  strictString(value.title, 'BLOCK_TITLE');
  strictAvailability(value.availability);
  return value as unknown as ReportBlockV1;
}

function factRef(
  facts: ReadonlyMap<string, ReportFactV1>,
  ref: string,
  reason: string,
): ReportFactV1 {
  const fact = facts.get(ref);
  if (!fact) contractFail(reason);
  return fact;
}

function interpretationRef(
  interpretations: ReadonlyMap<string, ReportInterpretationV1>,
  ref: string,
  reason: string,
): ReportInterpretationV1 {
  const interpretation = interpretations.get(ref);
  if (!interpretation) contractFail(reason);
  return interpretation;
}

function interpretationAllowsFact(
  interpretation: ReportInterpretationV1,
  fact: ReportFactV1,
): boolean {
  if (interpretation.domain === 'fortune' || interpretation.domain === 'saju') {
    return fact.domain === 'saju';
  }
  if (interpretation.domain === 'naming') return fact.domain === 'naming';
  return fact.domain === 'interaction'
    || (fact.domain === 'saju'
      && new Set([
        'yongshin',
        'pillars',
        'time_correction',
        'element_distribution',
        'day_master',
        'strength',
      ])
        .has(fact.kind))
    || (fact.domain === 'naming'
      && new Set(['name_character', 'metric']).has(fact.kind));
}

function assertProjectionDepth(
  interpretation: ReportInterpretationV1,
  depth: ReportDepthV1,
  reason: string,
  exact = false,
): void {
  if ((depth === 'brief' && (interpretation.standard !== undefined
      || interpretation.expert !== undefined))
    || (depth === 'standard' && interpretation.expert !== undefined)
    || (exact
      && interpretation.availability.status !== 'unavailable'
      && depth === 'standard'
      && interpretation.standard === undefined)
    || (exact
      && interpretation.availability.status !== 'unavailable'
      && depth === 'expert'
      && (interpretation.standard === undefined || interpretation.expert === undefined))) {
    contractFail(reason);
  }
}

function validateTypedFactGroup(
  block: Extract<ReportBlockV1, { readonly kind: 'fact_group' }>,
  facts: ReadonlyMap<string, ReportFactV1>,
  surfaceId: ReportSurfaceIdV1,
): void {
  const expectedKinds: Readonly<Record<typeof block.presentation, ReadonlySet<string>>> = {
    summary: new Set(['name_saju_interaction']),
    metrics: new Set([
      'metric',
      'day_master',
      'strength',
      'gyeokguk',
      'yongshin',
      'element_distribution',
      'time_correction',
    ]),
    pillars: new Set(['pillars']),
    characters: new Set(['name_character']),
    evidence: new Set([
      'shinsal_hits',
      'ten_god_analysis',
      'natal_relations',
      'element_balance',
      'naming_trend',
      'naming_phonetic',
      'name_statistics',
    ]),
  };
  const allowedPresentations: Readonly<Record<ReportSurfaceIdV1, ReadonlySet<string>>> = {
    integrated: new Set(['summary']),
    saju: new Set(['metrics', 'pillars', 'evidence']),
    naming: new Set(['metrics', 'characters', 'evidence']),
  };
  if (!allowedPresentations[surfaceId].has(block.presentation)) {
    contractFail('FACT_GROUP_SURFACE_PRESENTATION');
  }
  const expectedDomain = surfaceId === 'integrated' ? 'interaction' : surfaceId;
  for (const ref of block.factRefs) {
    const fact = factRef(facts, ref, 'DANGLING_FACT_REF');
    if (!expectedKinds[block.presentation].has(fact.kind)
      || fact.domain !== expectedDomain) {
      contractFail('FACT_GROUP_TYPED_REF');
    }
    if (fact.kind === 'time_correction') {
      const expectedAvailability: DeliveryAvailabilityV1 =
        fact.input.timePrecision === 'exact'
          ? { status: 'ready', reasonCodes: [] }
          : { status: 'limited', reasonCodes: ['BIRTH_TIME_IMPUTED'] };
      if (block.factRefs.length !== 1
        || !sameAvailability(block.availability, expectedAvailability)) {
        contractFail('TIME_CORRECTION_AVAILABILITY');
      }
    }
  }
}

function validateOfferShape(value: unknown): void {
  strictObject(
    value,
    [
      'id',
      'productId',
      'access',
      'entitlementAuthority',
      'contentState',
      'analysisId',
    ],
    ['candidateId'],
    'OFFER_SHAPE',
  );
  if (value.id !== 'story_completion'
    || value.productId !== 'report.story-completion.v1'
    || value.access !== 'requires_server_entitlement'
    || value.entitlementAuthority !== 'server'
    || value.contentState !== 'omitted') {
    contractFail('OFFER_AUTHORITY');
  }
  strictString(value.analysisId, 'OFFER_ANALYSIS_ID');
  if (hasOwn(value, 'candidateId')) strictString(value.candidateId, 'OFFER_CANDIDATE_ID');
}

function assertNoOrphanPayload(
  facts: ReadonlyMap<string, ReportFactV1>,
  interpretations: ReadonlyMap<string, ReportInterpretationV1>,
  surfaces: readonly ReportSurfaceV1[],
): void {
  const usedFacts = new Set<string>();
  const usedInterpretations = new Set<string>();
  for (const interpretation of interpretations.values()) {
    for (const ref of interpretation.factRefs) usedFacts.add(ref);
    for (const ref of interpretation.expert?.numericalFactRefs ?? []) usedFacts.add(ref);
  }
  for (const surface of surfaces) for (const block of surface.blocks) {
    if (block.kind === 'hero') {
      usedInterpretations.add(block.interpretationRef);
      for (const ref of block.supportingFactRefs) usedFacts.add(ref);
    } else if (block.kind === 'fact_group') {
      for (const ref of block.factRefs) usedFacts.add(ref);
      if (block.interpretationRef !== undefined) {
        usedInterpretations.add(block.interpretationRef);
      }
    } else if (block.kind === 'element_comparison') {
      usedFacts.add(block.sajuDistributionFactRef);
      usedFacts.add(block.nameDistributionFactRef);
    } else if (block.kind === 'timeline') {
      for (const period of block.periods) for (const cell of period.cells) {
        if (cell.ratingFactRef !== undefined) usedFacts.add(cell.ratingFactRef);
        if (cell.interpretationRef !== undefined) {
          usedInterpretations.add(cell.interpretationRef);
        }
      }
    } else if (block.kind === 'life_flow') {
      if (block.ratingFactRef !== undefined) usedFacts.add(block.ratingFactRef);
      usedInterpretations.add(block.interpretationRef);
    } else if (block.kind === 'four_frames') {
      for (const item of block.items) {
        usedFacts.add(item.factRef);
        if (item.interpretationRef !== undefined) {
          usedInterpretations.add(item.interpretationRef);
        }
      }
    } else if (block.kind === 'premium_teaser'
      && block.teaserInterpretationRef !== undefined) {
      usedInterpretations.add(block.teaserInterpretationRef);
    }
  }
  if ([...facts.keys()].some((id) => !usedFacts.has(id))) contractFail('UNUSED_FACT');
  if ([...interpretations.keys()].some((id) => !usedInterpretations.has(id))) {
    contractFail('UNUSED_INTERPRETATION');
  }
}

/**
 * Strict runtime schema and relational guard for the public DTO.
 *
 * The input is deliberately unknown: this boundary is also used for decoded
 * JSON, so TypeScript's compile-time shape cannot be trusted here.
 */
export function assertReportDeliveryV1(
  delivery: unknown,
  selection?: ReportDeliverySelectionV1,
): asserts delivery is ReportDeliveryV1 {
  strictObject(
    delivery,
    [
      'schemaVersion',
      'analysisId',
      'generatedAt',
      'anchorDate',
      'subject',
      'coverage',
      'provenance',
      'availability',
      'facts',
      'interpretations',
      'surfaces',
      'offers',
    ],
    [],
    'TOP_LEVEL_SHAPE',
  );
  if (delivery.schemaVersion !== REPORT_DELIVERY_SCHEMA_V1) contractFail('SCHEMA_VERSION');
  strictString(delivery.analysisId, 'ANALYSIS_ID');
  if (!/^analysis_v1_[a-zA-Z0-9_-]{16,128}$/u.test(delivery.analysisId)) {
    contractFail('ANALYSIS_ID');
  }
  strictString(delivery.generatedAt, 'GENERATED_AT');
  const generatedTime = Date.parse(delivery.generatedAt);
  if (!Number.isFinite(generatedTime)
    || new Date(generatedTime).toISOString() !== delivery.generatedAt) {
    contractFail('GENERATED_AT');
  }
  strictString(delivery.anchorDate, 'ANCHOR_DATE');
  const anchorMatch = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(delivery.anchorDate);
  if (!anchorMatch) contractFail('ANCHOR_DATE');
  const anchorYear = Number(anchorMatch[1]);
  const anchorMonth = Number(anchorMatch[2]);
  const anchorDay = Number(anchorMatch[3]);
  const anchor = new Date(Date.UTC(anchorYear, anchorMonth - 1, anchorDay));
  if (anchor.getUTCFullYear() !== anchorYear
    || anchor.getUTCMonth() !== anchorMonth - 1
    || anchor.getUTCDate() !== anchorDay) {
    contractFail('ANCHOR_DATE');
  }

  strictObject(delivery.subject, [], ['displayName', 'candidateId'], 'SUBJECT_SHAPE');
  if (hasOwn(delivery.subject, 'displayName')) {
    strictString(delivery.subject.displayName, 'SUBJECT_DISPLAY_NAME');
  }
  if (hasOwn(delivery.subject, 'candidateId')) {
    strictString(delivery.subject.candidateId, 'CANDIDATE_ID');
    if (!isCandidateIdV1(delivery.subject.candidateId)) contractFail('CANDIDATE_ID');
  }

  const coverageSurfaces = strictCoverage(delivery.coverage);
  if (selection
    && JSON.stringify(coverageSurfaces) !== JSON.stringify(selection.surfaces)) {
    contractFail('COVERAGE_MISMATCH');
  }

  strictObject(
    delivery.provenance,
    ['engine', 'facts', 'narratives', 'cacheScope', 'artifactIdentity', 'versions', 'computation'],
    [],
    'PROVENANCE_SHAPE',
  );
  if (delivery.provenance.engine !== 'spring-ts'
    || delivery.provenance.facts !== 'deterministic-engine-output'
    || delivery.provenance.narratives !== 'interpretive-not-fact-authority'
    || delivery.provenance.cacheScope !== 'engine_session') {
    contractFail('PROVENANCE');
  }
  strictObject(
    delivery.provenance.artifactIdentity,
    ['manifestSchema', 'digest', 'authority', 'correctnessAuthority'],
    [],
    'PROVENANCE_ARTIFACT_IDENTITY_SHAPE',
  );
  if (delivery.provenance.artifactIdentity.manifestSchema !== ENGINE_BUILD_IDENTITY_V1.schemaVersion
    || delivery.provenance.artifactIdentity.digest !== ENGINE_BUILD_IDENTITY_V1.aggregateDigest
    || delivery.provenance.artifactIdentity.authority !== ENGINE_BUILD_IDENTITY_V1.authority
    || delivery.provenance.artifactIdentity.correctnessAuthority !== false) {
    contractFail('PROVENANCE_ARTIFACT_IDENTITY');
  }
  strictObject(
    delivery.provenance.versions,
    ['engine', 'ruleset', 'data', 'deliveryTemplate', 'timelineArticleTemplate'],
    [],
    'PROVENANCE_VERSIONS_SHAPE',
  );
  strictString(delivery.provenance.versions.engine, 'PROVENANCE_ENGINE_VERSION');
  if (delivery.provenance.versions.ruleset !== ENGINE_BUILD_IDENTITY_V1.rulesetDigest
    || delivery.provenance.versions.data !== ENGINE_BUILD_IDENTITY_V1.dataDigest
    || delivery.provenance.versions.deliveryTemplate !== 'delivery-template-v1'
    || delivery.provenance.versions.timelineArticleTemplate !== 'article-v1') {
    contractFail('PROVENANCE_VERSIONS');
  }
  strictObject(
    delivery.provenance.computation,
    ['natalSaju', 'naming', 'interaction'],
    [],
    'PROVENANCE_COMPUTATION_SHAPE',
  );
  if (delivery.provenance.computation.natalSaju !== 'birth-derived-invariant'
    || delivery.provenance.computation.naming !== 'name-derived'
    || delivery.provenance.computation.interaction !== 'birth-and-name-conditioned') {
    contractFail('PROVENANCE');
  }

  const topAvailability = strictAvailability(delivery.availability);
  strictArray(delivery.facts, 'FACTS_SHAPE');
  const factById = new Map<string, ReportFactV1>();
  for (const rawFact of delivery.facts) {
    const fact = strictFact(rawFact);
    if (factById.has(fact.id)) contractFail('DUPLICATE_OR_EMPTY_FACT_ID');
    factById.set(fact.id, fact);
  }
  const namingDetailFacts = [...factById.values()].filter((fact) =>
    fact.kind === 'naming_trend'
    || fact.kind === 'naming_phonetic'
    || fact.kind === 'name_statistics');
  if (namingDetailFacts.length > 0) {
    if (!coverageSurfaces.some((surface) => surface.id === 'naming')) {
      contractFail('NAMING_DETAIL_SURFACE');
    }
    const charactersFor = (position: 'surname' | 'givenName') =>
      [...factById.values()]
        .filter((fact) =>
          fact.kind === 'name_character' && fact.position === position)
        .sort((left, right) =>
          (left as Extract<ReportFactV1, { kind: 'name_character' }>).index
          - (right as Extract<ReportFactV1, { kind: 'name_character' }>).index) as
        Extract<ReportFactV1, { kind: 'name_character' }>[];
    const surnameCharacters = charactersFor('surname');
    const givenCharacters = charactersFor('givenName');
    if (surnameCharacters.length < 1
      || givenCharacters.length < 1
      || surnameCharacters.some((fact, index) => fact.index !== index)
      || givenCharacters.some((fact, index) => fact.index !== index)) {
      contractFail('NAMING_DETAIL_IDENTITY');
    }
    const surnameHangul = surnameCharacters.map((fact) => fact.hangul).join('');
    const givenHangul = givenCharacters.map((fact) => fact.hangul).join('');
    const fullHangul = `${surnameHangul}${givenHangul}`;
    if (delivery.subject.displayName !== fullHangul) {
      contractFail('NAMING_DETAIL_IDENTITY');
    }
    for (const fact of namingDetailFacts) {
      if (fact.kind === 'naming_trend' && fact.givenHangul !== givenHangul) {
        contractFail('NAMING_DETAIL_IDENTITY');
      }
      if (fact.kind === 'naming_phonetic'
        && (fact.surnameHangul !== surnameHangul
          || fact.givenHangul !== givenHangul
          || fact.fullHangul !== fullHangul)) {
        contractFail('NAMING_DETAIL_IDENTITY');
      }
    }
  }
  // Integrated delivery also carries the exact natal time-correction fact so
  // a method disagreement cannot erase the deterministic calculation basis.
  const expectsSajuTimeCorrection = coverageSurfaces.some((surface) => surface.id === 'saju');
  const permitsIntegratedTimeCorrection = coverageSurfaces.some((surface) => surface.id === 'integrated');
  const timeCorrectionFactCount = [...factById.values()]
    .filter((fact) => fact.kind === 'time_correction').length;
  if ((expectsSajuTimeCorrection && timeCorrectionFactCount !== 1)
    || (!expectsSajuTimeCorrection
      && timeCorrectionFactCount > (permitsIntegratedTimeCorrection ? 1 : 0))) {
    contractFail('TIME_CORRECTION_CARDINALITY');
  }

  // An integrated interaction is meaningful only against the exact natal
  // yongshin evidence carried by the same delivery. Shape-valid facts from two
  // different computations must not be composable into one trusted DTO.
  const deliveryYongshinFacts = [...factById.values()].filter(
    (fact) => fact.kind === 'yongshin',
  );
  const interactionFacts = [...factById.values()].filter(
    (fact) => fact.kind === 'name_saju_interaction',
  );
  if (interactionFacts.length > 1
    || (interactionFacts.length === 1 && deliveryYongshinFacts.length !== 1)) {
    contractFail('INTERACTION_NATAL_BINDING');
  }
  const deliveryYongshin = deliveryYongshinFacts[0];
  for (const fact of interactionFacts) {
    const natalConflict = deliveryYongshin?.kind === 'yongshin'
      && (deliveryYongshin.consensus?.conflictLevel === 'medium'
        || deliveryYongshin.consensus?.conflictLevel === 'high');
    const interactionConflict = fact.limitations.includes('consensus_conflict_present');
    if (!deliveryYongshin
      || deliveryYongshin.kind !== 'yongshin'
      || deliveryYongshin.element !== fact.yongshinElement
      || Boolean(natalConflict) !== interactionConflict) {
      contractFail('INTERACTION_NATAL_BINDING');
    }
  }

  strictArray(delivery.interpretations, 'INTERPRETATIONS_SHAPE');
  const interpretationById = new Map<string, ReportInterpretationV1>();
  for (const rawInterpretation of delivery.interpretations) {
    const interpretation = strictInterpretation(rawInterpretation);
    if (interpretationById.has(interpretation.id)) {
      contractFail('DUPLICATE_OR_EMPTY_INTERPRETATION_ID');
    }
    for (const ref of interpretation.factRefs) {
      const fact = factRef(factById, ref, 'DANGLING_FACT_REF');
      if (!interpretationAllowsFact(interpretation, fact)) {
        contractFail('INTERPRETATION_FACT_DOMAIN');
      }
    }
    for (const ref of interpretation.expert?.numericalFactRefs ?? []) {
      const fact = factRef(factById, ref, 'DANGLING_NUMERICAL_FACT_REF');
      if (!interpretationAllowsFact(interpretation, fact)) {
        contractFail('INTERPRETATION_FACT_DOMAIN');
      }
      if (fact.kind !== 'metric') {
        contractFail('NUMERICAL_REF_NOT_METRIC');
      }
    }
    interpretationById.set(interpretation.id, interpretation);
  }

  strictArray(delivery.surfaces, 'SURFACES_SHAPE', 1, 3);
  if (delivery.surfaces.length !== coverageSurfaces.length) {
    contractFail('REQUESTED_SURFACE_MISSING');
  }
  const surfaceIds = new Set<string>();
  const sliceKeys = new Set<string>();
  const surfaces: ReportSurfaceV1[] = [];
  let premiumTeaserCount = 0;
  for (const [surfaceIndex, rawSurface] of delivery.surfaces.entries()) {
    strictObject(
      rawSurface,
      ['id', 'depth', 'sliceKey', 'availability', 'blocks'],
      [],
      'SURFACE_SHAPE',
    );
    strictEnum(rawSurface.id, SURFACE_IDS, 'SURFACE_ID');
    strictEnum(rawSurface.depth, DEPTHS, 'SURFACE_DEPTH');
    strictString(rawSurface.sliceKey, 'SURFACE_SLICE_KEY');
    if (surfaceIds.has(rawSurface.id)) contractFail('DUPLICATE_OR_EMPTY_SURFACE_ID');
    if (sliceKeys.has(rawSurface.sliceKey)) contractFail('DUPLICATE_SURFACE_SLICE_KEY');
    surfaceIds.add(rawSurface.id);
    sliceKeys.add(rawSurface.sliceKey);
    const coverage = coverageSurfaces[surfaceIndex];
    if (!coverage || coverage.id !== rawSurface.id || coverage.depth !== rawSurface.depth) {
      contractFail('SURFACE_COVERAGE_MISMATCH');
    }
    if (rawSurface.sliceKey !== canonicalSurfaceSliceKey(coverage)) {
      contractFail('SURFACE_SLICE_KEY_MISMATCH');
    }
    const coverageTimeline = coverage.id === 'naming' ? undefined : coverage.timeline;
    const availability = strictAvailability(rawSurface.availability);
    strictArray(rawSurface.blocks, 'BLOCKS_SHAPE', 1);
    const surface = rawSurface as unknown as ReportSurfaceV1;
    const blockIds = new Set<string>();
    let heroCount = 0;
    let deepLinksCount = 0;
    let timelineCount = 0;
    let lifeFlowCount = 0;
    let namingCalendarCount = 0;
    let fourFrameCount = 0;
    let timeCorrectionBlockCount = 0;

    for (const rawBlock of rawSurface.blocks) {
      const block = strictBlock(rawBlock);
      if (blockIds.has(block.id)) contractFail('DUPLICATE_OR_EMPTY_BLOCK_ID');
      if (!block.id.startsWith(rawSurface.sliceKey + '.')) {
        contractFail('BLOCK_SLICE_KEY_MISMATCH');
      }
      blockIds.add(block.id);

      if (block.kind === 'hero') {
        heroCount += 1;
        const interpretation = interpretationRef(
          interpretationById,
          block.interpretationRef,
          'DANGLING_INTERPRETATION_REF',
        );
        if (block.interpretationRef !== block.id + '.interpretation') {
          contractFail('HERO_SLICE_REF');
        }
        const expectedDomain = surface.id === 'integrated' ? 'interaction' : surface.id;
        if (interpretation.domain !== expectedDomain
          || !sameAvailability(block.availability, interpretation.availability)) {
          contractFail('HERO_TYPED_REF');
        }
        assertProjectionDepth(interpretation, surface.depth, 'HERO_DEPTH_REF', true);
        for (const ref of block.supportingFactRefs) {
          factRef(factById, ref, 'DANGLING_FACT_REF');
          if (!interpretation.factRefs.includes(ref)) contractFail('HERO_FACT_BINDING');
        }
        const yongshinFact = [...factById.values()].find((fact) => fact.kind === 'yongshin');
        if (surface.id !== 'naming' && yongshinFact
          && (!interpretation.factRefs.includes(yongshinFact.id)
            || !block.supportingFactRefs.includes(yongshinFact.id))) {
          contractFail('YONGSHIN_HERO_BINDING');
        }
      } else if (block.kind === 'fact_group') {
        validateTypedFactGroup(block, factById, surface.id);
        if (block.factRefs.some((ref) => factById.get(ref)?.kind === 'time_correction')) {
          timeCorrectionBlockCount += 1;
        }
        if (block.interpretationRef !== undefined) {
          const interpretation = interpretationRef(
            interpretationById,
            block.interpretationRef,
            'DANGLING_INTERPRETATION_REF',
          );
          const expectedDomain = surface.id === 'integrated' ? 'interaction' : surface.id;
          if (interpretation.domain !== expectedDomain
            || !sameAvailability(block.availability, interpretation.availability)
            || block.factRefs.some((ref) => !interpretation.factRefs.includes(ref))) {
            contractFail('FACT_GROUP_INTERPRETATION_BINDING');
          }
          assertProjectionDepth(interpretation, surface.depth, 'FACT_GROUP_DEPTH_REF');
        }
      } else if (block.kind === 'element_comparison') {
        if (surface.id !== 'integrated') contractFail('ELEMENT_COMPARISON_SURFACE');
        const sajuDistribution = factRef(
          factById,
          block.sajuDistributionFactRef,
          'DANGLING_FACT_REF',
        );
        const nameDistribution = factRef(
          factById,
          block.nameDistributionFactRef,
          'DANGLING_FACT_REF',
        );
        if (sajuDistribution.kind !== 'element_distribution'
          || sajuDistribution.source !== 'saju'
          || nameDistribution.kind !== 'element_distribution'
          || nameDistribution.source !== 'name') {
          contractFail('ELEMENT_COMPARISON_TYPED_REF');
        }
      } else if (block.kind === 'timeline') {
        timelineCount += 1;
        if (surface.id === 'naming' || !coverageTimeline) {
          contractFail('UNREQUESTED_TIMELINE');
        }
        const expectedPeriods = coverageTimeline.periods;
        const periodIds = block.periods.map((period) => period.id);
        if (!sameStringArray(periodIds, expectedPeriods)
          || !sameStringArray(block.availablePeriodOrder, expectedPeriods)
          || block.defaultPeriod !== (expectedPeriods.includes('today')
            ? 'today'
            : expectedPeriods[0])) {
          contractFail('TIMELINE_PERIOD_COVERAGE_MISMATCH');
        }
        const cellAvailabilities: DeliveryAvailabilityV1[] = [];
        for (const period of block.periods) {
          const categories = period.cells.map((cell) => cell.category);
          if (!sameStringArray(categories, coverageTimeline.categories)) {
            contractFail('TIMELINE_CATEGORY_COVERAGE_MISMATCH');
          }
          for (const cell of period.cells) {
            cellAvailabilities.push(cell.availability);
            const expectedCellBase = `fortune.${period.id}.${cell.category}`;
            if (cell.ratingFactRef !== undefined) {
              if (cell.ratingFactRef !== `${expectedCellBase}.stars`) {
                contractFail('TIMELINE_RATING_BINDING');
              }
              const rating = factRef(factById, cell.ratingFactRef, 'DANGLING_RATING_FACT_REF');
              if (rating.kind !== 'metric' || rating.unit !== 'stars_1_5') {
                contractFail('RATING_REF_NOT_STAR_METRIC');
              }
            }
            if (cell.interpretationRef !== undefined) {
              if (cell.interpretationRef !== `${expectedCellBase}.${surface.depth}.interpretation`) {
                contractFail('TIMELINE_INTERPRETATION_BINDING');
              }
              const interpretation = interpretationRef(
                interpretationById,
                cell.interpretationRef,
                'DANGLING_INTERPRETATION_REF',
              );
              if (interpretation.domain !== 'fortune'
                || !cell.interpretationRef.endsWith('.' + surface.depth + '.interpretation')
                || !sameAvailability(cell.availability, interpretation.availability)) {
                contractFail('TIMELINE_TYPED_REF');
              }
              assertProjectionDepth(interpretation, surface.depth, 'TIMELINE_DEPTH_REF', true);
              if (cell.ratingFactRef !== undefined
                && !interpretation.factRefs.includes(cell.ratingFactRef)) {
                contractFail('TIMELINE_RATING_BINDING');
              }
            } else if (cell.availability.status !== 'unavailable') {
              contractFail('TIMELINE_INTERPRETATION_REQUIRED');
            }
          }
        }
        const expectedAvailability = aggregateStrictAvailability(cellAvailabilities);
        if (!sameAvailability(block.availability, expectedAvailability)) {
          contractFail('TIMELINE_AVAILABILITY');
        }
      } else if (block.kind === 'life_flow') {
        lifeFlowCount += 1;
        if (surface.id !== 'saju' || coverage.id !== 'saju' || coverage.life !== 'summary') {
          contractFail('UNREQUESTED_LIFE_FLOW');
        }
        const interpretation = interpretationRef(
          interpretationById,
          block.interpretationRef,
          'DANGLING_INTERPRETATION_REF',
        );
        if (block.interpretationRef !== `fortune.life.overall.${surface.depth}.interpretation`
          || interpretation.domain !== 'fortune'
          || !sameAvailability(block.availability, interpretation.availability)) {
          contractFail('LIFE_TYPED_REF');
        }
        assertProjectionDepth(interpretation, surface.depth, 'LIFE_DEPTH_REF', true);
        if (block.ratingFactRef !== undefined) {
          if (block.ratingFactRef !== 'fortune.life.overall.stars') {
            contractFail('LIFE_RATING_BINDING');
          }
          const rating = factRef(factById, block.ratingFactRef, 'DANGLING_RATING_FACT_REF');
          if (rating.kind !== 'metric' || rating.unit !== 'stars_1_5'
            || !interpretation.factRefs.includes(block.ratingFactRef)) {
            contractFail('LIFE_RATING_BINDING');
          }
        }
      } else if (block.kind === 'four_frames') {
        fourFrameCount += 1;
        if (surface.id !== 'naming') contractFail('FOUR_FRAMES_SURFACE');
        const stages = new Set<string>();
        for (const item of block.items) {
          if (stages.has(item.stage)) contractFail('DUPLICATE_FOUR_FRAME_STAGE');
          stages.add(item.stage);
          const fact = factRef(factById, item.factRef, 'DANGLING_FACT_REF');
          if (fact.kind !== 'naming_frame' || fact.stage !== item.stage) {
            contractFail('FOUR_FRAME_TYPED_REF');
          }
          if (item.interpretationRef !== undefined) {
            const interpretation = interpretationRef(
              interpretationById,
              item.interpretationRef,
              'DANGLING_INTERPRETATION_REF',
            );
            if (interpretation.domain !== 'naming'
              || item.interpretationRef !== item.factRef + '.' + surface.depth + '.interpretation'
              || !interpretation.factRefs.includes(item.factRef)) {
              contractFail('FOUR_FRAME_INTERPRETATION_BINDING');
            }
            if (!FOUR_FRAME_AUTHORED_COPY_APPROVED
              && interpretation.origin === 'authored_bundle') {
              contractFail('FOUR_FRAME_CONTENT_GATE');
            }
            assertProjectionDepth(interpretation, surface.depth, 'FOUR_FRAME_DEPTH_REF', true);
          }
        }
        if (stages.size !== FRAME_STAGES.size) contractFail('FOUR_FRAME_CARDINALITY');
      } else if (block.kind === 'capability') {
        if (surface.id !== 'naming'
          || block.availability.status !== 'unavailable'
          || !block.availability.reasonCodes.includes('NAMING_CALENDAR_METHOD_NOT_ESTABLISHED')) {
          contractFail('NAMING_CALENDAR_CAPABILITY');
        }
        namingCalendarCount += 1;
      } else if (block.kind === 'premium_teaser') {
        if (surface.id !== 'integrated'
          || !sameAvailability(block.availability, {
            status: 'limited',
            reasonCodes: ['SERVER_ENTITLEMENT_REQUIRED'],
          })) {
          contractFail('PREMIUM_TEASER_STATE');
        }
        premiumTeaserCount += 1;
        if (block.teaserInterpretationRef === undefined) {
          contractFail('PREMIUM_TEASER_BINDING');
        }
        const teaser = interpretationRef(
          interpretationById,
          block.teaserInterpretationRef,
          'DANGLING_INTERPRETATION_REF',
        );
        if (block.teaserInterpretationRef !== block.id + '.teaser.interpretation'
          || teaser.domain !== 'interaction'
          || !sameAvailability(teaser.availability, block.availability)) {
          contractFail('PREMIUM_TEASER_BINDING');
        }
        assertProjectionDepth(teaser, surface.depth, 'PREMIUM_TEASER_DEPTH_REF', true);
      } else if (block.kind === 'deep_links') {
        deepLinksCount += 1;
      }
    }

    if (heroCount !== 1) contractFail('HERO_CARDINALITY');
    if (deepLinksCount !== 1) contractFail('DEEP_LINKS_CARDINALITY');
    if (timelineCount !== (coverageTimeline ? 1 : 0)) {
      contractFail('TIMELINE_COVERAGE_MISMATCH');
    }
    const expectsLife = coverage.id === 'saju' && coverage.life === 'summary';
    if (lifeFlowCount !== (expectsLife ? 1 : 0)) contractFail('LIFE_COVERAGE_MISMATCH');
    if (surface.id === 'naming' && namingCalendarCount !== 1) {
      contractFail('NAMING_CALENDAR_CAPABILITY_MISSING');
    }
    if (surface.id !== 'naming' && namingCalendarCount !== 0) {
      contractFail('NAMING_CALENDAR_CAPABILITY_SURFACE');
    }
    if (timeCorrectionBlockCount !== (surface.id === 'saju' ? 1 : 0)) {
      contractFail('TIME_CORRECTION_BLOCK_REQUIRED');
    }
    const coreBlocks = surface.blocks.filter((block) =>
      block.kind !== 'capability'
      && block.kind !== 'premium_teaser'
      && block.kind !== 'deep_links');
    const coreAvailability = aggregateStrictAvailability(
      coreBlocks.map((block) => block.availability),
    );
    const omitsCoreReason = coreAvailability.reasonCodes.some(
      (reason) => !availability.reasonCodes.includes(reason),
    );
    if (omitsCoreReason
      || (availability.status === 'ready' && coreAvailability.status !== 'ready')
      || (availability.status === 'unavailable'
        && coreAvailability.status !== 'unavailable')) {
      contractFail('SURFACE_AVAILABILITY');
    }
    surfaces.push(surface);
  }

  const expectedTopAvailability = overallStrictAvailability(surfaces);
  if (!sameAvailability(topAvailability, expectedTopAvailability)) {
    contractFail('TOP_LEVEL_AVAILABILITY');
  }
  assertNoOrphanPayload(factById, interpretationById, surfaces);

  strictArray(delivery.offers, 'OFFERS_SHAPE', 0, 1);
  for (const offer of delivery.offers) validateOfferShape(offer);
  const subjectCandidateId = delivery.subject.candidateId as string | undefined;
  const integratedSurface = surfaces.find((surface) => surface.id === 'integrated');
  const hasEligibleInteraction = [...factById.values()].some((fact) =>
    fact.kind === 'name_saju_interaction'
    && fact.classification !== 'unavailable'
    && fact.safety !== undefined);
  const yongshinEvidence = [...factById.values()].find((fact) => fact.kind === 'yongshin');
  const natalEvidenceReasonCodes = new Set<DeliveryReasonCodeV1>([
    'SAJU_ANALYSIS_LIMITED',
    'SAJU_JUDGMENT_LOW_CONFIDENCE',
    'YONGSHIN_JONGGYEOK_RISK',
    'YONGSHIN_CONSENSUS_CONFLICT',
  ]);
  const natalEvidenceLimited = !yongshinEvidence
    || yongshinEvidence.kind !== 'yongshin'
    || yongshinEvidence.element === null
    || yongshinEvidence.confidence < 45
    || yongshinEvidence.warnings.length > 0
    || yongshinEvidence.judgmentStrength === 'candidate'
    || yongshinEvidence.judgmentStrength === 'deferred'
    || yongshinEvidence.jonggyeokRisk?.level === 'HIGH'
    || yongshinEvidence.consensus?.conflictLevel === 'medium'
    || yongshinEvidence.consensus?.conflictLevel === 'high'
    || integratedSurface?.availability.reasonCodes.some((reason) =>
      natalEvidenceReasonCodes.has(reason)) === true;
  const canOffer = integratedSurface !== undefined
    && subjectCandidateId !== undefined
    && hasEligibleInteraction
    && !natalEvidenceLimited;
  if (delivery.offers.length !== (canOffer ? 1 : 0)
    || premiumTeaserCount !== delivery.offers.length) {
    contractFail('OFFER_CARDINALITY');
  }
  for (const offer of delivery.offers) {
    const typedOffer = offer as Record<string, unknown>;
    if (typedOffer.analysisId !== delivery.analysisId
      || typedOffer.candidateId !== subjectCandidateId) {
      contractFail('OFFER_BINDING');
    }
  }

  collectForbiddenKeys(delivery);
  let serialized: string;
  try {
    serialized = JSON.stringify(delivery);
  } catch {
    contractFail('NOT_JSON_SERIALIZABLE');
  }
  if (new TextEncoder().encode(serialized).byteLength > MAX_DELIVERY_BYTES) {
    contractFail('PAYLOAD_BUDGET_EXCEEDED');
  }
}
