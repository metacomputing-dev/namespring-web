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

const SURFACE_IDS = new Set(['integrated', 'saju', 'naming']);
const DEPTHS = new Set(['brief', 'standard', 'expert']);
const PERIODS = new Set(['today', 'thisWeek', 'thisMonth', 'thisYear']);
const CATEGORIES = new Set<ReportCategoryIdV1>([
  'overall', 'wealth', 'health', 'academic', 'romance', 'family',
  'career', 'study_document', 'expression_children', 'health_stress', 'movement',
]);
const AVAILABILITY_REASONS = new Set<DeliveryReasonCodeV1>([
  'SAJU_ANALYSIS_LIMITED',
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
  'name_character',
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
const JUDGMENT_STRENGTHS = new Set(['definite', 'practical', 'candidate', 'deferred']);

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
      ['judgmentStrength', 'consensus', 'jonggyeokRisk'],
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
    strictEnum(value.presentation, new Set(['summary', 'metrics', 'pillars', 'characters']), 'FACT_GROUP_PRESENTATION');
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
    || (fact.domain === 'saju' && fact.kind === 'yongshin');
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
    ]),
    pillars: new Set(['pillars']),
    characters: new Set(['name_character']),
  };
  const allowedPresentations: Readonly<Record<ReportSurfaceIdV1, ReadonlySet<string>>> = {
    integrated: new Set(['summary']),
    saju: new Set(['metrics', 'pillars']),
    naming: new Set(['metrics', 'characters']),
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
            if (!FOUR_FRAME_AUTHORED_COPY_APPROVED) {
              contractFail('FOUR_FRAME_CONTENT_GATE');
            }
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
    if (!FOUR_FRAME_AUTHORED_COPY_APPROVED
      && fourFrameCount > 0
      && !availability.reasonCodes.includes('CONTENT_EXPERT_REVIEW_REQUIRED')) {
      contractFail('FOUR_FRAME_CONTENT_GATE');
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
