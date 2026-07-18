import {
  HanjaRepository,
  type HanjaEntry,
} from '../../../seed-ts/src/database/hanja-repository.js';
import { HANJA_DATABASE_ASSET } from '../../../seed-ts/src/database/database-asset-registry.js';
import {
  EXPECTED_FULL_HANJA_GLYPH_COUNT,
  EXPECTED_FULL_HANJA_READING_PAIR_COUNT,
} from '../full-hanja-glyph-registry.js';
import { getLegalAnnotation } from '../hanja-annotations.js';
import { assertNameCharacterSyntax } from '../name-entry-resolver.js';
import { assessNatalEvidenceV1 } from '../natal-evidence.js';
import {
  lunarToSolar,
  solarToLunar,
  type SolarDate,
} from '../calendar/korean-lunar-calendar.js';
import { snapshotCandidateSearchRequestV1 } from '../public-request-snapshot.js';
import { validateBirthInputRuntimeContract } from '../saju/birth-input-contract.js';
import { SpringEngine } from '../spring-engine.js';
import {
  AnalysisOptionsContractError,
  assertAnalysisOptionsContractV1,
} from '../report/analysis-options-validation.js';
import { REPORT_DELIVERY_SCHEMA_V1 } from '../report/delivery/types.js';
import {
  SERVICE_CATALOG_SCHEMA_V1,
  STORY_COMPLETION_PRODUCT_ID_V1,
} from '../report/premium/types.js';
import type { PillarCode, SajuSummary } from '../types.js';
import {
  LOCAL_ANALYSIS_CONTEXT_SCHEMA_V1,
  LOCAL_BIRTH_PREVIEW_SCHEMA_V1,
  LOCAL_CONTEXT_ID_PATTERN_V1,
  LOCAL_HANJA_LOOKUP_REQUEST_SCHEMA_V1,
  LOCAL_HANJA_LOOKUP_SCHEMA_V1,
  LOCAL_HOME_SUMMARY_SCHEMA_V1,
  LOCAL_SHARE_EXPORT_ID_PATTERN_V1,
  LOCAL_SHARE_EXPORT_SCHEMA_V1,
  MAX_LOCAL_HANJA_PAGE_SIZE_V1,
  LocalMenuContractErrorV1,
  type LocalAnalysisContextInputV1,
  type LocalAnalysisContextV1,
  type LocalAnalysisNameCharacterV1,
  type LocalBirthInputV1,
  type LocalBirthPreviewV1,
  type LocalFiveElementIdV1,
  type LocalHanjaLookupItemV1,
  type LocalHanjaLookupRequestV1,
  type LocalHanjaLookupV1,
  type LocalHomeAvailabilityReasonV1,
  type LocalHomeAvailabilityV1,
  type LocalHomeCapabilityV1,
  type LocalHomeCoreFactsV1,
  type LocalHomeSummaryV1,
  type LocalMenuContractReasonV1,
  type LocalShareExportV1,
} from './local-menu-types.js';

const MAX_LOCATION_TEXT_LENGTH = 256;
const MAX_TIMEZONE_LENGTH = 64;
const MAX_HANJA_SOURCE_ROWS = 2_048;
const MAX_HANJA_TEXT_LENGTH = 256;
const HANJA_ELEMENTS = new Set(['Wood', 'Fire', 'Earth', 'Metal', 'Water']);
const ELEMENT_ORDER = Object.freeze([
  'wood', 'fire', 'earth', 'metal', 'water',
] as const satisfies readonly LocalFiveElementIdV1[]);
const PILLAR_POSITIONS = Object.freeze([
  'year', 'month', 'day', 'hour',
] as const);
const HOME_CAPABILITIES = Object.freeze([
  Object.freeze({
    id: 'birth_preview',
    execution: 'local_device',
    contract: LOCAL_BIRTH_PREVIEW_SCHEMA_V1,
  }),
  Object.freeze({
    id: 'integrated_report',
    execution: 'local_device',
    contract: REPORT_DELIVERY_SCHEMA_V1,
    requestHint: Object.freeze({ surface: 'integrated', depth: 'standard' }),
  }),
  Object.freeze({
    id: 'saju_report',
    execution: 'local_device',
    contract: REPORT_DELIVERY_SCHEMA_V1,
    requestHint: Object.freeze({ surface: 'saju', depth: 'expert' }),
  }),
  Object.freeze({
    id: 'naming_report',
    execution: 'local_device',
    contract: REPORT_DELIVERY_SCHEMA_V1,
    requestHint: Object.freeze({ surface: 'naming', depth: 'expert' }),
  }),
  Object.freeze({
    id: 'candidate_search',
    execution: 'local_device',
    contract: 'spring-ts.candidate-search.v1',
  }),
  Object.freeze({
    id: 'hanja_lookup',
    execution: 'local_device',
    contract: LOCAL_HANJA_LOOKUP_SCHEMA_V1,
  }),
  Object.freeze({
    id: 'share_export',
    execution: 'local_device',
    contract: LOCAL_SHARE_EXPORT_SCHEMA_V1,
  }),
  Object.freeze({
    id: 'premium_story_entry',
    execution: 'server_after_explicit_intent',
    contract: SERVICE_CATALOG_SCHEMA_V1,
    catalog: 'not_prefetched',
    productId: STORY_COMPLETION_PRODUCT_ID_V1,
  }),
] as const satisfies readonly LocalHomeCapabilityV1[]);
const HOME_AVAILABILITY_REASONS = new Set<LocalHomeAvailabilityReasonV1>([
  'SAJU_ANALYSIS_LIMITED',
  'SAJU_JUDGMENT_LOW_CONFIDENCE',
  'YONGSHIN_JONGGYEOK_RISK',
  'YONGSHIN_CONSENSUS_CONFLICT',
  'CORE_NATAL_FACTS_UNAVAILABLE',
]);

function fail(reason: LocalMenuContractReasonV1): never {
  throw new LocalMenuContractErrorV1(reason);
}

function assertDataObject(
  value: unknown,
  allowedKeys: readonly string[],
  reason: LocalMenuContractReasonV1 = 'INVALID_SHAPE',
): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(reason);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail(reason);
  const allowed = new Set(allowedKeys);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !allowed.has(key)) fail('UNKNOWN_FIELD');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) fail(reason);
  }
}

function isBoundedCanonicalText(value: unknown, max: number): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= max
    && value === value.trim()
    && value === value.normalize('NFC')
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

function isOneHangul(value: unknown): value is string {
  return typeof value === 'string'
    && value === value.normalize('NFC')
    && /^[\uAC00-\uD7A3]$/u.test(value);
}

function isOneUnicodeScalar(value: unknown): value is string {
  if (typeof value !== 'string' || Array.from(value).length !== 1) return false;
  const codePoint = value.codePointAt(0);
  return codePoint !== undefined && (codePoint < 0xD800 || codePoint > 0xDFFF);
}

function isValidSolarDate(year: number, month: number, day: number): boolean {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function solarEquivalentOf(birth: LocalBirthInputV1): SolarDate | null {
  if (birth.calendarType === 'solar') {
    return isValidSolarDate(birth.year, birth.month, birth.day)
      ? { year: birth.year, month: birth.month, day: birth.day }
      : null;
  }
  return lunarToSolar({
    year: birth.year,
    month: birth.month,
    day: birth.day,
    isLeapMonth: birth.isLeapMonth,
  });
}

function validateBirth(value: unknown): asserts value is LocalBirthInputV1 {
  assertDataObject(value, [
    'year', 'month', 'day', 'hour', 'minute', 'gender', 'calendarType',
    'isLeapMonth', 'region', 'city', 'birthPlace', 'timezone', 'latitude', 'longitude',
  ], 'INVALID_BIRTH');
  if (validateBirthInputRuntimeContract(value) !== null
    || !Number.isSafeInteger(value.year)
    || !Number.isSafeInteger(value.month)
    || !Number.isSafeInteger(value.day)
    || (value.hour !== null && !Number.isSafeInteger(value.hour))
    || (value.minute !== null && !Number.isSafeInteger(value.minute))
    || (value.hour === null) !== (value.minute === null)
    || (value.calendarType !== 'solar' && value.calendarType !== 'lunar')
    || typeof value.isLeapMonth !== 'boolean'
    || (value.calendarType === 'solar' && value.isLeapMonth)) {
    fail('INVALID_BIRTH');
  }
  for (const key of ['region', 'city', 'birthPlace'] as const) {
    const raw = value[key];
    if (raw !== undefined && !isBoundedCanonicalText(raw, MAX_LOCATION_TEXT_LENGTH)) {
      fail('INVALID_BIRTH');
    }
  }
  if (value.timezone !== undefined
    && !isBoundedCanonicalText(value.timezone, MAX_TIMEZONE_LENGTH)) {
    fail('INVALID_BIRTH');
  }
  if (!solarEquivalentOf(value as unknown as LocalBirthInputV1)) fail('INVALID_BIRTH');
}

function normalizeNameCharacters(
  value: unknown,
  role: 'surname' | 'givenName',
  max: number,
): readonly LocalAnalysisNameCharacterV1[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > max) fail('INVALID_NAME');
  const normalized: LocalAnalysisNameCharacterV1[] = [];
  for (const raw of value) {
    assertDataObject(raw, ['hangul', 'hanja'], 'INVALID_NAME');
    if (!isOneHangul(raw.hangul)) fail('INVALID_NAME');
    if (raw.hanja !== undefined
      && (typeof raw.hanja !== 'string'
        || raw.hanja !== raw.hanja.trim()
        || raw.hanja !== raw.hanja.normalize('NFC')
        || (raw.hanja.length > 0
          && raw.hanja !== raw.hangul
          && !isOneUnicodeScalar(raw.hanja)))) {
      fail('INVALID_NAME');
    }
    const hanja = typeof raw.hanja === 'string' ? raw.hanja : '';
    normalized.push(Object.freeze({
      hangul: raw.hangul,
      ...(hanja && hanja !== raw.hangul ? { hanja } : {}),
    }));
  }
  try {
    assertNameCharacterSyntax(normalized, { role });
  } catch {
    fail('INVALID_NAME');
  }
  return Object.freeze(normalized);
}

function validateOptions(value: unknown, birthYear: number): void {
  try {
    assertAnalysisOptionsContractV1(value, birthYear, {
      allowRemoteLunarConversion: false,
    });
  } catch (error) {
    if (error instanceof AnalysisOptionsContractError
      && error.kind === 'REMOTE_FORBIDDEN') {
      fail('REMOTE_COMPUTATION_FORBIDDEN');
    }
    if (error instanceof AnalysisOptionsContractError) fail('INVALID_OPTIONS');
    throw error;
  }
}

function randomOpaqueId(prefix: 'local_context_v1_' | 'local_export_v1_'): string {
  const provider = globalThis.crypto;
  if (!provider || typeof provider.getRandomValues !== 'function') {
    fail('SECURE_RANDOM_UNAVAILABLE');
  }
  const bytes = provider.getRandomValues(new Uint8Array(16));
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return `${prefix}${hex}`;
}

function freezeOwned<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== 'object' || seen.has(value as object)) return value;
  seen.add(value as object);
  for (const child of Object.values(value as Record<string, unknown>)) {
    freezeOwned(child, seen);
  }
  return Object.freeze(value);
}

function formatDate(value: { readonly year: number; readonly month: number; readonly day: number }): string {
  return `${String(value.year).padStart(4, '0')}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}`;
}

function isCanonicalDateText(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(value);
}

function parseCanonicalDateText(value: unknown): SolarDate | null {
  if (!isCanonicalDateText(value)) return null;
  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!Number.isSafeInteger(year)
    || year < 1
    || year > 9_999
    || !Number.isSafeInteger(month)
    || !Number.isSafeInteger(day)) {
    return null;
  }
  return { year, month, day };
}

function assertContextInput(value: unknown): {
  readonly birth: LocalBirthInputV1;
  readonly surname: readonly LocalAnalysisNameCharacterV1[];
  readonly givenName?: readonly LocalAnalysisNameCharacterV1[];
  readonly options?: LocalAnalysisContextInputV1['options'];
} {
  assertDataObject(value, ['birth', 'surname', 'givenName', 'options']);
  validateBirth(value.birth);
  const surname = normalizeNameCharacters(value.surname, 'surname', 2);
  const givenName = value.givenName === undefined
    ? undefined
    : normalizeNameCharacters(value.givenName, 'givenName', 4);
  if (value.options !== undefined) validateOptions(value.options, value.birth.year);
  return {
    birth: value.birth,
    surname,
    ...(givenName ? { givenName } : {}),
    ...(value.options !== undefined
      ? { options: value.options as LocalAnalysisContextInputV1['options'] }
      : {}),
  };
}

export function createLocalAnalysisContextV1(
  input: LocalAnalysisContextInputV1,
): LocalAnalysisContextV1 {
  const snapshot = snapshotCandidateSearchRequestV1(
    input as unknown as Parameters<typeof snapshotCandidateSearchRequestV1>[0],
  ) as unknown as LocalAnalysisContextInputV1;
  const validated = assertContextInput(snapshot);
  const context: LocalAnalysisContextV1 = {
    schemaVersion: LOCAL_ANALYSIS_CONTEXT_SCHEMA_V1,
    contextId: randomOpaqueId('local_context_v1_'),
    scope: 'device_session',
    computation: 'local_only',
    birth: validated.birth,
    name: {
      surname: validated.surname,
      ...(validated.givenName ? { givenName: validated.givenName } : {}),
    },
    ...(validated.options ? { options: validated.options } : {}),
    privacy: {
      containsPersonalData: true,
      urlEmbedding: 'forbidden',
      serverTransfer: 'premium_registration_only',
    },
  };
  assertLocalAnalysisContextV1(context);
  return freezeOwned(context);
}

export function assertLocalAnalysisContextV1(
  value: unknown,
): asserts value is LocalAnalysisContextV1 {
  assertDataObject(value, [
    'schemaVersion', 'contextId', 'scope', 'computation', 'birth', 'name', 'options', 'privacy',
  ]);
  if (value.schemaVersion !== LOCAL_ANALYSIS_CONTEXT_SCHEMA_V1
    || !LOCAL_CONTEXT_ID_PATTERN_V1.test(String(value.contextId ?? ''))
    || value.scope !== 'device_session'
    || value.computation !== 'local_only') {
    fail('CONTRACT_INVALID');
  }
  validateBirth(value.birth);
  assertDataObject(value.name, ['surname', 'givenName'], 'CONTRACT_INVALID');
  normalizeNameCharacters(value.name.surname, 'surname', 2);
  if (value.name.givenName !== undefined) {
    normalizeNameCharacters(value.name.givenName, 'givenName', 4);
  }
  if (value.options !== undefined) validateOptions(value.options, value.birth.year);
  assertDataObject(value.privacy, [
    'containsPersonalData', 'urlEmbedding', 'serverTransfer',
  ], 'CONTRACT_INVALID');
  if (value.privacy.containsPersonalData !== true
    || value.privacy.urlEmbedding !== 'forbidden'
    || value.privacy.serverTransfer !== 'premium_registration_only') {
    fail('CONTRACT_INVALID');
  }
}

function locationPreview(birth: LocalBirthInputV1): LocalBirthPreviewV1['location'] {
  const hasLocation = birth.region !== undefined
    || birth.city !== undefined
    || birth.birthPlace !== undefined
    || birth.timezone !== undefined
    || birth.latitude !== undefined
    || birth.longitude !== undefined;
  if (!hasLocation) return { status: 'not_provided' };
  return {
    status: 'provided',
    ...(birth.region !== undefined ? { region: birth.region } : {}),
    ...(birth.city !== undefined ? { city: birth.city } : {}),
    ...(birth.birthPlace !== undefined ? { birthPlace: birth.birthPlace } : {}),
    ...(birth.timezone !== undefined ? { timezone: birth.timezone } : {}),
    ...(birth.latitude !== undefined ? { latitude: birth.latitude } : {}),
    ...(birth.longitude !== undefined ? { longitude: birth.longitude } : {}),
  };
}

export function buildLocalBirthPreviewV1(
  input: LocalBirthInputV1,
): LocalBirthPreviewV1 {
  const snapshot = snapshotCandidateSearchRequestV1(
    input as unknown as Parameters<typeof snapshotCandidateSearchRequestV1>[0],
  ) as unknown as LocalBirthInputV1;
  validateBirth(snapshot);
  const solarEquivalent = solarEquivalentOf(snapshot)!;
  const knownTime = snapshot.hour !== null && snapshot.minute !== null;
  const preview: LocalBirthPreviewV1 = {
    schemaVersion: LOCAL_BIRTH_PREVIEW_SCHEMA_V1,
    computation: 'local_only',
    calendar: {
      inputType: snapshot.calendarType,
      inputDate: formatDate(snapshot),
      isLeapMonth: snapshot.isLeapMonth,
      ...(snapshot.calendarType === 'lunar'
        ? { solarEquivalent: formatDate(solarEquivalent) }
        : {}),
      conversion: snapshot.calendarType === 'lunar'
        ? 'builtin_korean_lunar_calendar'
        : 'not_required',
    },
    time: knownTime
      ? { precision: 'exact', hour: snapshot.hour!, minute: snapshot.minute! }
      : { precision: 'unknown' },
    gender: snapshot.gender,
    location: locationPreview(snapshot),
    constraints: {
      timeSensitiveAnalysis: knownTime ? 'available' : 'limited_unknown_time',
      genderDependentFortune: snapshot.gender === 'neutral'
        ? 'unavailable_without_explicit_gender_basis'
        : 'available',
    },
    provenance: {
      input: 'user_supplied',
      lunarConversion: 'builtin_only',
      remoteLookup: 'forbidden',
    },
  };
  assertLocalBirthPreviewV1(preview);
  return freezeOwned(preview);
}

export function assertLocalBirthPreviewV1(
  value: unknown,
): asserts value is LocalBirthPreviewV1 {
  assertDataObject(value, [
    'schemaVersion', 'computation', 'calendar', 'time', 'gender', 'location',
    'constraints', 'provenance',
  ]);
  if (value.schemaVersion !== LOCAL_BIRTH_PREVIEW_SCHEMA_V1
    || value.computation !== 'local_only'
    || !['male', 'female', 'neutral'].includes(String(value.gender))) {
    fail('CONTRACT_INVALID');
  }
  assertDataObject(value.calendar, [
    'inputType', 'inputDate', 'isLeapMonth', 'solarEquivalent', 'conversion',
  ], 'CONTRACT_INVALID');
  const inputDate = parseCanonicalDateText(value.calendar.inputDate);
  if ((value.calendar.inputType !== 'solar' && value.calendar.inputType !== 'lunar')
    || inputDate === null
    || typeof value.calendar.isLeapMonth !== 'boolean'
    || (value.calendar.inputType === 'solar'
      && (!isValidSolarDate(inputDate.year, inputDate.month, inputDate.day)
        || value.calendar.isLeapMonth
        || value.calendar.solarEquivalent !== undefined
        || value.calendar.conversion !== 'not_required'))
    || (value.calendar.inputType === 'lunar'
      && (inputDate.month < 1
        || inputDate.month > 12
        || inputDate.day < 1
        || inputDate.day > 30
        || !isCanonicalDateText(value.calendar.solarEquivalent)
        || value.calendar.conversion !== 'builtin_korean_lunar_calendar'))) {
    fail('CONTRACT_INVALID');
  }
  if (value.calendar.inputType === 'lunar') {
    const converted = lunarToSolar({
      ...inputDate,
      isLeapMonth: value.calendar.isLeapMonth,
    });
    const convertedBack = converted === null ? null : solarToLunar(converted);
    if (converted === null
      || formatDate(converted) !== value.calendar.solarEquivalent
      || convertedBack === null
      || convertedBack.year !== inputDate.year
      || convertedBack.month !== inputDate.month
      || convertedBack.day !== inputDate.day
      || convertedBack.isLeapMonth !== value.calendar.isLeapMonth) {
      fail('CONTRACT_INVALID');
    }
  }
  assertDataObject(value.time, ['precision', 'hour', 'minute'], 'CONTRACT_INVALID');
  const exactTime = value.time.precision === 'exact';
  const hour = value.time.hour;
  const minute = value.time.minute;
  if ((!exactTime && value.time.precision !== 'unknown')
    || (exactTime
      ? (typeof hour !== 'number'
        || !Number.isInteger(hour)
        || hour < 0
        || hour > 23
        || typeof minute !== 'number'
        || !Number.isInteger(minute)
        || minute < 0
        || minute > 59)
      : (hour !== undefined || minute !== undefined))) {
    fail('CONTRACT_INVALID');
  }
  assertDataObject(value.location, [
    'status', 'region', 'city', 'birthPlace', 'timezone', 'latitude', 'longitude',
  ], 'CONTRACT_INVALID');
  if (value.location.status === 'not_provided') {
    if (Object.keys(value.location).length !== 1) fail('CONTRACT_INVALID');
  } else if (value.location.status === 'provided') {
    if (Object.keys(value.location).length < 2) fail('CONTRACT_INVALID');
    for (const key of ['region', 'city', 'birthPlace'] as const) {
      const raw = value.location[key];
      if (raw !== undefined && !isBoundedCanonicalText(raw, MAX_LOCATION_TEXT_LENGTH)) {
        fail('CONTRACT_INVALID');
      }
    }
    if (value.location.timezone !== undefined
      && !isBoundedCanonicalText(value.location.timezone, MAX_TIMEZONE_LENGTH)) {
      fail('CONTRACT_INVALID');
    }
    if (value.location.latitude !== undefined
      && (typeof value.location.latitude !== 'number'
        || !Number.isFinite(value.location.latitude)
        || value.location.latitude < -90
        || value.location.latitude > 90)) {
      fail('CONTRACT_INVALID');
    }
    if (value.location.longitude !== undefined
      && (typeof value.location.longitude !== 'number'
        || !Number.isFinite(value.location.longitude)
        || value.location.longitude < -180
        || value.location.longitude > 180)) {
      fail('CONTRACT_INVALID');
    }
  } else {
    fail('CONTRACT_INVALID');
  }
  assertDataObject(value.constraints, [
    'timeSensitiveAnalysis', 'genderDependentFortune',
  ], 'CONTRACT_INVALID');
  if (value.constraints.timeSensitiveAnalysis
      !== (exactTime ? 'available' : 'limited_unknown_time')
    || value.constraints.genderDependentFortune
      !== (value.gender === 'neutral'
        ? 'unavailable_without_explicit_gender_basis'
        : 'available')) {
    fail('CONTRACT_INVALID');
  }
  assertDataObject(value.provenance, [
    'input', 'lunarConversion', 'remoteLookup',
  ], 'CONTRACT_INVALID');
  if (value.provenance.input !== 'user_supplied'
    || value.provenance.lunarConversion !== 'builtin_only'
    || value.provenance.remoteLookup !== 'forbidden') {
    fail('CONTRACT_INVALID');
  }
}

function canonicalElement(value: unknown): LocalFiveElementIdV1 | null {
  if (typeof value !== 'string') return null;
  switch (value.trim().toUpperCase()) {
    case 'WOOD': case '목': case '木': return 'wood';
    case 'FIRE': case '화': case '火': return 'fire';
    case 'EARTH': case '토': case '土': return 'earth';
    case 'METAL': case '금': case '金': return 'metal';
    case 'WATER': case '수': case '水': return 'water';
    default: return null;
  }
}

function canonicalPolarity(value: unknown): 'yin' | 'yang' | null {
  if (typeof value !== 'string') return null;
  switch (value.trim().toUpperCase()) {
    case 'YIN': case '음': case '陰': return 'yin';
    case 'YANG': case '양': case '陽': return 'yang';
    default: return null;
  }
}

function copyPillarCode(value: PillarCode): LocalHomeCoreFactsV1['pillars'][number]['stem'] {
  if (!isBoundedCanonicalText(value?.code, 32)
    || !isBoundedCanonicalText(value?.hangul, 8)
    || !isBoundedCanonicalText(value?.hanja, 8)) {
    fail('CORE_NATAL_FACTS_INVALID');
  }
  return { code: value.code, hangul: value.hangul, hanja: value.hanja };
}

function normalizedElementDistribution(
  raw: Readonly<Record<string, number>>,
): LocalHomeCoreFactsV1['elementDistribution'] {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    fail('CORE_NATAL_FACTS_INVALID');
  }
  const counts: Record<LocalFiveElementIdV1, number> = {
    wood: 0, fire: 0, earth: 0, metal: 0, water: 0,
  };
  for (const [key, value] of Object.entries(raw)) {
    const element = canonicalElement(key);
    if (!element || typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      fail('CORE_NATAL_FACTS_INVALID');
    }
    counts[element] += value;
  }
  const values = ELEMENT_ORDER.map((element) => counts[element]);
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!(total > 0) || !Number.isFinite(total)) fail('CORE_NATAL_FACTS_INVALID');
  const exactBasisPoints = values.map((value) => (value / total) * 10_000);
  const basisPoints = exactBasisPoints.map(Math.floor);
  let remaining = 10_000 - basisPoints.reduce((sum, value) => sum + value, 0);
  const allocationOrder = exactBasisPoints
    .map((value, index) => ({ index, remainder: value - basisPoints[index] }))
    .filter(({ index }) => values[index] > 0)
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index);
  for (let index = 0; index < remaining; index += 1) {
    basisPoints[allocationOrder[index % allocationOrder.length].index] += 1;
  }
  remaining = 10_000 - basisPoints.reduce((sum, value) => sum + value, 0);
  if (remaining !== 0) fail('CORE_NATAL_FACTS_INVALID');
  return ELEMENT_ORDER.map((element, index) => ({
    element,
    sharePercent: basisPoints[index] / 100,
  }));
}

function buildHomeCoreFacts(saju: SajuSummary | null): LocalHomeCoreFactsV1 | null {
  // Any analysisStatus denotes a non-complete adapter result. In particular,
  // failed/unavailable summaries contain structurally shaped empty placeholders
  // which must not be projected as natal facts (or turned into an exception).
  if (!saju || saju.analysisStatus !== undefined) return null;
  const dayMasterElement = canonicalElement(saju.dayMaster?.element);
  const dayMasterPolarity = canonicalPolarity(saju.dayMaster?.polarity);
  if (!isBoundedCanonicalText(saju.dayMaster?.stem, 32)
    || !dayMasterElement
    || !dayMasterPolarity) {
    fail('CORE_NATAL_FACTS_INVALID');
  }
  const pillars = PILLAR_POSITIONS.map((position) => {
    const pillar = saju.pillars?.[position];
    if (!pillar) fail('CORE_NATAL_FACTS_INVALID');
    return {
      position,
      stem: copyPillarCode(pillar.stem),
      branch: copyPillarCode(pillar.branch),
    };
  });
  return {
    pillars,
    dayMaster: {
      stem: saju.dayMaster.stem,
      element: dayMasterElement,
      polarity: dayMasterPolarity,
    },
    elementDistribution: normalizedElementDistribution(saju.elementDistribution),
  };
}

function assertAvailability(value: unknown): asserts value is LocalHomeAvailabilityV1 {
  assertDataObject(value, ['status', 'reasonCodes'], 'CONTRACT_INVALID');
  if (!['ready', 'limited', 'unavailable'].includes(String(value.status))
    || !Array.isArray(value.reasonCodes)) {
    fail('CONTRACT_INVALID');
  }
  const reasons = new Set<string>();
  for (const reason of value.reasonCodes) {
    if (typeof reason !== 'string'
      || !HOME_AVAILABILITY_REASONS.has(reason as LocalHomeAvailabilityReasonV1)
      || reasons.has(reason)) {
      fail('CONTRACT_INVALID');
    }
    reasons.add(reason);
  }
  if ((value.status === 'ready') !== (value.reasonCodes.length === 0)) {
    fail('CONTRACT_INVALID');
  }
}

function assertHomeFacts(value: unknown): asserts value is LocalHomeCoreFactsV1 {
  assertDataObject(value, ['pillars', 'dayMaster', 'elementDistribution'], 'CONTRACT_INVALID');
  if (!Array.isArray(value.pillars) || value.pillars.length !== PILLAR_POSITIONS.length) {
    fail('CONTRACT_INVALID');
  }
  for (let index = 0; index < value.pillars.length; index += 1) {
    const pillar = value.pillars[index];
    assertDataObject(pillar, ['position', 'stem', 'branch'], 'CONTRACT_INVALID');
    if (pillar.position !== PILLAR_POSITIONS[index]) fail('CONTRACT_INVALID');
    for (const key of ['stem', 'branch'] as const) {
      const code = pillar[key];
      assertDataObject(code, ['code', 'hangul', 'hanja'], 'CONTRACT_INVALID');
      if (!isBoundedCanonicalText(code.code, 32)
        || !isBoundedCanonicalText(code.hangul, 8)
        || !isBoundedCanonicalText(code.hanja, 8)) {
        fail('CONTRACT_INVALID');
      }
    }
  }
  assertDataObject(value.dayMaster, ['stem', 'element', 'polarity'], 'CONTRACT_INVALID');
  if (!isBoundedCanonicalText(value.dayMaster.stem, 32)
    || !ELEMENT_ORDER.includes(value.dayMaster.element as LocalFiveElementIdV1)
    || (value.dayMaster.polarity !== 'yin' && value.dayMaster.polarity !== 'yang')) {
    fail('CONTRACT_INVALID');
  }
  if (!Array.isArray(value.elementDistribution)
    || value.elementDistribution.length !== ELEMENT_ORDER.length) {
    fail('CONTRACT_INVALID');
  }
  let total = 0;
  for (let index = 0; index < value.elementDistribution.length; index += 1) {
    const row = value.elementDistribution[index];
    assertDataObject(row, ['element', 'sharePercent'], 'CONTRACT_INVALID');
    if (row.element !== ELEMENT_ORDER[index]
      || typeof row.sharePercent !== 'number'
      || !Number.isFinite(row.sharePercent)
      || row.sharePercent < 0
      || row.sharePercent > 100
      || Math.round(row.sharePercent * 100) !== row.sharePercent * 100) {
      fail('CONTRACT_INVALID');
    }
    total += row.sharePercent;
  }
  if (Math.round(total * 100) !== 10_000) fail('CONTRACT_INVALID');
}

export async function buildLocalHomeSummaryV1(
  engine: SpringEngine,
  context: LocalAnalysisContextV1,
): Promise<LocalHomeSummaryV1> {
  if (!(engine instanceof SpringEngine)) fail('SPRING_ENGINE_REQUIRED');
  assertLocalAnalysisContextV1(context);
  // The public API never accepts a detached SajuSummary. Natal facts are
  // recomputed from this exact context inside the same call, so a caller
  // cannot accidentally pair one person's birth context with another chart.
  const saju = await engine.getSajuReport({
    birth: context.birth,
    surname: [...context.name.surname],
    ...(context.name.givenName ? { givenName: [...context.name.givenName] } : {}),
    mode: context.name.givenName ? 'evaluate' : 'recommend',
    ...(context.options ? { options: context.options } : {}),
  });
  const facts = buildHomeCoreFacts(saju);
  const natalEvidence = assessNatalEvidenceV1(saju);
  const reasonCodes = [...natalEvidence.reasonCodes] as LocalHomeAvailabilityReasonV1[];
  if (!facts && !reasonCodes.includes('CORE_NATAL_FACTS_UNAVAILABLE')) {
    reasonCodes.push('CORE_NATAL_FACTS_UNAVAILABLE');
  }
  const availability: LocalHomeAvailabilityV1 = {
    status: !facts
      ? 'unavailable'
      : reasonCodes.length > 0
        ? 'limited'
        : 'ready',
    reasonCodes,
  };
  const summary: LocalHomeSummaryV1 = {
    schemaVersion: LOCAL_HOME_SUMMARY_SCHEMA_V1,
    contextId: context.contextId,
    computation: {
      execution: 'local_only',
      source: 'SpringEngine.getSajuReport',
      scope: 'natal_preview',
      fullReportComputed: false,
      remoteLookup: 'forbidden',
      natalSaju: 'birth_derived_invariant',
    },
    birthPreview: buildLocalBirthPreviewV1(context.birth),
    availability,
    facts,
    capabilities: HOME_CAPABILITIES,
  };
  assertLocalHomeSummaryV1(summary);
  return freezeOwned(summary);
}

export function assertLocalHomeSummaryV1(
  value: unknown,
): asserts value is LocalHomeSummaryV1 {
  assertDataObject(value, [
    'schemaVersion', 'contextId', 'computation', 'birthPreview',
    'availability', 'facts', 'capabilities',
  ]);
  if (value.schemaVersion !== LOCAL_HOME_SUMMARY_SCHEMA_V1
    || !LOCAL_CONTEXT_ID_PATTERN_V1.test(String(value.contextId ?? ''))) {
    fail('CONTRACT_INVALID');
  }
  assertDataObject(value.computation, [
    'execution', 'source', 'scope', 'fullReportComputed', 'remoteLookup', 'natalSaju',
  ], 'CONTRACT_INVALID');
  if (value.computation.execution !== 'local_only'
    || value.computation.source !== 'SpringEngine.getSajuReport'
    || value.computation.scope !== 'natal_preview'
    || value.computation.fullReportComputed !== false
    || value.computation.remoteLookup !== 'forbidden'
    || value.computation.natalSaju !== 'birth_derived_invariant') {
    fail('CONTRACT_INVALID');
  }
  assertLocalBirthPreviewV1(value.birthPreview);
  assertAvailability(value.availability);
  if (value.facts === null) {
    if (value.availability.status !== 'unavailable'
      || !value.availability.reasonCodes.includes('CORE_NATAL_FACTS_UNAVAILABLE')) {
      fail('CONTRACT_INVALID');
    }
  } else {
    assertHomeFacts(value.facts);
    if (value.availability.status === 'unavailable') fail('CONTRACT_INVALID');
  }
  if (!Array.isArray(value.capabilities)
    || value.capabilities.length !== HOME_CAPABILITIES.length) {
    fail('CONTRACT_INVALID');
  }
  for (let index = 0; index < HOME_CAPABILITIES.length; index += 1) {
    const actual = value.capabilities[index];
    const expected = HOME_CAPABILITIES[index];
    if ('requestHint' in expected) {
      assertDataObject(
        actual,
        ['id', 'execution', 'contract', 'requestHint'],
        'CONTRACT_INVALID',
      );
      assertDataObject(actual.requestHint, ['surface', 'depth'], 'CONTRACT_INVALID');
      if (actual.id !== expected.id
        || actual.execution !== expected.execution
        || actual.contract !== expected.contract
        || actual.requestHint.surface !== expected.requestHint.surface
        || actual.requestHint.depth !== expected.requestHint.depth) {
        fail('CONTRACT_INVALID');
      }
      continue;
    }
    if ('catalog' in expected) {
      assertDataObject(
        actual,
        ['id', 'execution', 'contract', 'catalog', 'productId'],
        'CONTRACT_INVALID',
      );
      if (actual.id !== expected.id
        || actual.execution !== expected.execution
        || actual.contract !== expected.contract
        || actual.catalog !== expected.catalog
        || actual.productId !== expected.productId) {
        fail('CONTRACT_INVALID');
      }
      continue;
    }
    assertDataObject(actual, ['id', 'execution', 'contract'], 'CONTRACT_INVALID');
    if (actual.id !== expected.id
      || actual.execution !== expected.execution
      || actual.contract !== expected.contract) {
      fail('CONTRACT_INVALID');
    }
  }
}

function validateHanjaRequest(value: unknown): {
  readonly reading: string;
  readonly role: LocalHanjaLookupRequestV1['role'];
  readonly offset: number;
  readonly limit: number;
} {
  assertDataObject(value, ['schemaVersion', 'reading', 'role', 'offset', 'limit'], 'INVALID_HANJA_REQUEST');
  const offset = value.offset ?? 0;
  const limit = value.limit ?? 30;
  if (value.schemaVersion !== LOCAL_HANJA_LOOKUP_REQUEST_SCHEMA_V1
    || !isOneHangul(value.reading)
    || (value.role !== 'surname' && value.role !== 'given_name')
    || !Number.isSafeInteger(offset)
    || (offset as number) < 0
    || !Number.isSafeInteger(limit)
    || (limit as number) < 1
    || (limit as number) > MAX_LOCAL_HANJA_PAGE_SIZE_V1) {
    fail('INVALID_HANJA_REQUEST');
  }
  return {
    reading: value.reading,
    role: value.role,
    offset: offset as number,
    limit: limit as number,
  };
}

function validateHanjaEntry(
  raw: unknown,
  reading: string,
  role: LocalHanjaLookupRequestV1['role'],
): HanjaEntry {
  try {
    assertDataObject(raw, [
      'id', 'hangul', 'hanja', 'onset', 'nucleus', 'strokes', 'stroke_element',
      'resource_element', 'meaning', 'radical', 'is_surname',
    ], 'HANJA_SOURCE_ROW_INVALID');
  } catch (error) {
    if (error instanceof LocalMenuContractErrorV1 && error.reason === 'UNKNOWN_FIELD') {
      fail('HANJA_SOURCE_ROW_INVALID');
    }
    throw error;
  }
  if (!Number.isSafeInteger(raw.id)
    || (raw.id as number) < 1
    || raw.hangul !== reading
    || !isOneHangul(raw.hangul)
    || !isOneUnicodeScalar(raw.hanja)
    || !isBoundedCanonicalText(raw.onset, 8)
    || !isBoundedCanonicalText(raw.nucleus, 8)
    || !Number.isSafeInteger(raw.strokes)
    || (raw.strokes as number) < 1
    || !HANJA_ELEMENTS.has(String(raw.stroke_element))
    || !HANJA_ELEMENTS.has(String(raw.resource_element))
    || !isBoundedCanonicalText(raw.meaning, MAX_HANJA_TEXT_LENGTH)
    || typeof raw.radical !== 'string'
    || raw.radical.length > MAX_HANJA_TEXT_LENGTH
    || raw.radical !== raw.radical.trim()
    || raw.radical !== raw.radical.normalize('NFC')
    || typeof raw.is_surname !== 'boolean'
    || (role === 'surname' && raw.is_surname !== true)) {
    fail('HANJA_SOURCE_ROW_INVALID');
  }
  const entry = raw as unknown as HanjaEntry;
  const legal = getLegalAnnotation(entry);
  if (legal.legalRegistrable !== true || legal.legalStatus !== 'allowed') {
    fail('HANJA_LEGAL_AUTHORITY_MISMATCH');
  }
  return entry;
}

function compareHanjaEntries(left: HanjaEntry, right: HanjaEntry): number {
  return left.strokes - right.strokes
    || left.hanja.codePointAt(0)! - right.hanja.codePointAt(0)!
    || left.id - right.id;
}

function toHanjaItem(entry: HanjaEntry): LocalHanjaLookupItemV1 {
  return {
    hangul: entry.hangul,
    hanja: entry.hanja,
    meaning: entry.meaning,
    strokes: entry.strokes,
    strokeElement: entry.stroke_element,
    resourceElement: entry.resource_element,
    radical: entry.radical,
    isSurname: entry.is_surname,
    legal: { status: 'registrable', exactGlyphReadingPair: true },
  };
}

export async function buildLocalHanjaLookupV1(
  repository: HanjaRepository,
  request: LocalHanjaLookupRequestV1,
): Promise<LocalHanjaLookupV1> {
  const validated = validateHanjaRequest(request);
  if (!(repository instanceof HanjaRepository)) fail('HANJA_REPOSITORY_REQUIRED');
  let rawRows: unknown;
  try {
    rawRows = validated.role === 'surname'
      ? await repository.findSurnamesByHangul(validated.reading)
      : await repository.findByHangul(validated.reading);
  } catch (cause) {
    throw new LocalMenuContractErrorV1('HANJA_REPOSITORY_UNAVAILABLE', { cause });
  }
  if (!Array.isArray(rawRows)) fail('HANJA_SOURCE_ROW_INVALID');
  if (rawRows.length > MAX_HANJA_SOURCE_ROWS) fail('HANJA_SOURCE_LIMIT_EXCEEDED');
  const rows = rawRows.map((row) => validateHanjaEntry(row, validated.reading, validated.role));
  const seen = new Set<string>();
  for (const row of rows) {
    const key = `${row.hangul}\u0000${row.hanja}`;
    if (seen.has(key)) fail('DUPLICATE_HANJA_ENTRY');
    seen.add(key);
  }
  rows.sort(compareHanjaEntries);
  if (validated.offset > rows.length) fail('PAGINATION_OUT_OF_RANGE');
  const items = rows
    .slice(validated.offset, validated.offset + validated.limit)
    .map(toHanjaItem);
  const lookup: LocalHanjaLookupV1 = {
    schemaVersion: LOCAL_HANJA_LOOKUP_SCHEMA_V1,
    computation: 'local_only',
    request: { reading: validated.reading, role: validated.role },
    ordering: {
      policy: 'strokes_codepoint_id.v1',
      authority: 'spring-ts',
      clientInstruction: 'preserve_order',
    },
    pagination: {
      offset: validated.offset,
      requestedLimit: validated.limit,
      returnedCount: items.length,
      totalAvailable: rows.length,
      hasMore: validated.offset + items.length < rows.length,
    },
    provenance: {
      metadataSource: 'seed-ts.HanjaRepository',
      databaseSha256: HANJA_DATABASE_ASSET.sha256,
      schemaContractSha256: HANJA_DATABASE_ASSET.schemaContractSha256,
      legalAuthority: 'pinned_korean_court_lookup_snapshot',
      legalValidation: 'exact_glyph_reading_pair',
      expectedLegalGlyphCount: EXPECTED_FULL_HANJA_GLYPH_COUNT,
      expectedLegalReadingPairCount: EXPECTED_FULL_HANJA_READING_PAIR_COUNT,
      remoteLookup: 'forbidden',
    },
    items,
  };
  assertLocalHanjaLookupV1(lookup);
  return freezeOwned(lookup);
}

function assertHanjaItem(
  value: unknown,
  reading: string,
  role: LocalHanjaLookupRequestV1['role'],
): asserts value is LocalHanjaLookupItemV1 {
  assertDataObject(value, [
    'hangul', 'hanja', 'meaning', 'strokes', 'strokeElement', 'resourceElement',
    'radical', 'isSurname', 'legal',
  ], 'CONTRACT_INVALID');
  if (value.hangul !== reading
    || !isOneUnicodeScalar(value.hanja)
    || !isBoundedCanonicalText(value.meaning, MAX_HANJA_TEXT_LENGTH)
    || !Number.isSafeInteger(value.strokes)
    || (value.strokes as number) < 1
    || !HANJA_ELEMENTS.has(String(value.strokeElement))
    || !HANJA_ELEMENTS.has(String(value.resourceElement))
    || typeof value.radical !== 'string'
    || value.radical.length > MAX_HANJA_TEXT_LENGTH
    || value.radical !== value.radical.trim()
    || value.radical !== value.radical.normalize('NFC')
    || typeof value.isSurname !== 'boolean'
    || (role === 'surname' && value.isSurname !== true)) {
    fail('CONTRACT_INVALID');
  }
  assertDataObject(value.legal, ['status', 'exactGlyphReadingPair'], 'CONTRACT_INVALID');
  if (value.legal.status !== 'registrable' || value.legal.exactGlyphReadingPair !== true) {
    fail('CONTRACT_INVALID');
  }
  const legal = getLegalAnnotation({
    hangul: value.hangul,
    hanja: value.hanja,
  } as HanjaEntry);
  if (legal.legalRegistrable !== true || legal.legalStatus !== 'allowed') {
    fail('CONTRACT_INVALID');
  }
}

function compareHanjaItems(left: LocalHanjaLookupItemV1, right: LocalHanjaLookupItemV1): number {
  return left.strokes - right.strokes
    || left.hanja.codePointAt(0)! - right.hanja.codePointAt(0)!;
}

export function assertLocalHanjaLookupV1(
  value: unknown,
): asserts value is LocalHanjaLookupV1 {
  assertDataObject(value, [
    'schemaVersion', 'computation', 'request', 'ordering', 'pagination', 'provenance', 'items',
  ]);
  if (value.schemaVersion !== LOCAL_HANJA_LOOKUP_SCHEMA_V1
    || value.computation !== 'local_only') {
    fail('CONTRACT_INVALID');
  }
  assertDataObject(value.request, ['reading', 'role'], 'CONTRACT_INVALID');
  if (!isOneHangul(value.request.reading)
    || (value.request.role !== 'surname' && value.request.role !== 'given_name')) {
    fail('CONTRACT_INVALID');
  }
  assertDataObject(value.ordering, [
    'policy', 'authority', 'clientInstruction',
  ], 'CONTRACT_INVALID');
  if (value.ordering.policy !== 'strokes_codepoint_id.v1'
    || value.ordering.authority !== 'spring-ts'
    || value.ordering.clientInstruction !== 'preserve_order') {
    fail('CONTRACT_INVALID');
  }
  assertDataObject(value.pagination, [
    'offset', 'requestedLimit', 'returnedCount', 'totalAvailable', 'hasMore',
  ], 'CONTRACT_INVALID');
  if (!Number.isSafeInteger(value.pagination.offset)
    || (value.pagination.offset as number) < 0
    || !Number.isSafeInteger(value.pagination.requestedLimit)
    || (value.pagination.requestedLimit as number) < 1
    || (value.pagination.requestedLimit as number) > MAX_LOCAL_HANJA_PAGE_SIZE_V1
    || !Number.isSafeInteger(value.pagination.returnedCount)
    || !Number.isSafeInteger(value.pagination.totalAvailable)
    || (value.pagination.totalAvailable as number) < 0
    || typeof value.pagination.hasMore !== 'boolean'
    || !Array.isArray(value.items)
    || value.pagination.returnedCount !== value.items.length
    || value.items.length > (value.pagination.requestedLimit as number)
    || (value.pagination.offset as number) + value.items.length
      > (value.pagination.totalAvailable as number)
    || value.pagination.hasMore
      !== ((value.pagination.offset as number) + value.items.length
        < (value.pagination.totalAvailable as number))) {
    fail('CONTRACT_INVALID');
  }
  assertDataObject(value.provenance, [
    'metadataSource', 'databaseSha256', 'schemaContractSha256', 'legalAuthority',
    'legalValidation', 'expectedLegalGlyphCount', 'expectedLegalReadingPairCount',
    'remoteLookup',
  ], 'CONTRACT_INVALID');
  if (value.provenance.metadataSource !== 'seed-ts.HanjaRepository'
    || value.provenance.databaseSha256 !== HANJA_DATABASE_ASSET.sha256
    || value.provenance.schemaContractSha256 !== HANJA_DATABASE_ASSET.schemaContractSha256
    || value.provenance.legalAuthority !== 'pinned_korean_court_lookup_snapshot'
    || value.provenance.legalValidation !== 'exact_glyph_reading_pair'
    || value.provenance.expectedLegalGlyphCount !== EXPECTED_FULL_HANJA_GLYPH_COUNT
    || value.provenance.expectedLegalReadingPairCount !== EXPECTED_FULL_HANJA_READING_PAIR_COUNT
    || value.provenance.remoteLookup !== 'forbidden') {
    fail('CONTRACT_INVALID');
  }
  const seen = new Set<string>();
  for (let index = 0; index < value.items.length; index += 1) {
    const item = value.items[index];
    assertHanjaItem(item, value.request.reading, value.request.role);
    if (seen.has(item.hanja)) fail('CONTRACT_INVALID');
    seen.add(item.hanja);
    if (index > 0 && compareHanjaItems(value.items[index - 1], item) >= 0) {
      fail('CONTRACT_INVALID');
    }
  }
}

function canonicalTimestamp(value: string): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

export function buildLocalShareExportV1(
  home: LocalHomeSummaryV1,
): LocalShareExportV1 {
  assertLocalHomeSummaryV1(home);
  const output: LocalShareExportV1 = {
    schemaVersion: LOCAL_SHARE_EXPORT_SCHEMA_V1,
    exportId: randomOpaqueId('local_export_v1_'),
    createdAt: new Date().toISOString(),
    transport: 'native_share_or_file',
    privacy: {
      directIdentifiers: 'omitted',
      birthInput: 'omitted',
      sourceContextId: 'omitted',
      urlEmbedding: 'forbidden',
    },
    source: {
      schemaVersion: LOCAL_HOME_SUMMARY_SCHEMA_V1,
      computation: 'local_only',
    },
    summary: {
      availability: {
        status: home.availability.status,
        reasonCodes: [...home.availability.reasonCodes],
      },
      ...(home.facts ? {
        dayMaster: { ...home.facts.dayMaster },
        elementDistribution: home.facts.elementDistribution.map((row) => ({ ...row })),
      } : {}),
    },
  };
  assertLocalShareExportV1(output);
  return freezeOwned(output);
}

export function assertLocalShareExportV1(
  value: unknown,
): asserts value is LocalShareExportV1 {
  assertDataObject(value, [
    'schemaVersion', 'exportId', 'createdAt', 'transport', 'privacy', 'source', 'summary',
  ]);
  if (value.schemaVersion !== LOCAL_SHARE_EXPORT_SCHEMA_V1
    || !LOCAL_SHARE_EXPORT_ID_PATTERN_V1.test(String(value.exportId ?? ''))
    || typeof value.createdAt !== 'string'
    || !canonicalTimestamp(value.createdAt)
    || value.transport !== 'native_share_or_file') {
    fail('CONTRACT_INVALID');
  }
  assertDataObject(value.privacy, [
    'directIdentifiers', 'birthInput', 'sourceContextId', 'urlEmbedding',
  ], 'CONTRACT_INVALID');
  if (value.privacy.directIdentifiers !== 'omitted'
    || value.privacy.birthInput !== 'omitted'
    || value.privacy.sourceContextId !== 'omitted'
    || value.privacy.urlEmbedding !== 'forbidden') {
    fail('CONTRACT_INVALID');
  }
  assertDataObject(value.source, ['schemaVersion', 'computation'], 'CONTRACT_INVALID');
  if (value.source.schemaVersion !== LOCAL_HOME_SUMMARY_SCHEMA_V1
    || value.source.computation !== 'local_only') {
    fail('CONTRACT_INVALID');
  }
  assertDataObject(value.summary, [
    'availability', 'dayMaster', 'elementDistribution',
  ], 'CONTRACT_INVALID');
  assertAvailability(value.summary.availability);
  const hasDayMaster = value.summary.dayMaster !== undefined;
  const hasDistribution = value.summary.elementDistribution !== undefined;
  if (hasDayMaster !== hasDistribution) fail('CONTRACT_INVALID');
  if (hasDayMaster !== (value.summary.availability.status !== 'unavailable')) {
    fail('CONTRACT_INVALID');
  }
  if (hasDayMaster) {
    assertHomeFacts({
      pillars: PILLAR_POSITIONS.map((position) => ({
        position,
        stem: { code: 'omitted', hangul: '미제공', hanja: '未提供' },
        branch: { code: 'omitted', hangul: '미제공', hanja: '未提供' },
      })),
      dayMaster: value.summary.dayMaster,
      elementDistribution: value.summary.elementDistribution,
    });
  }
}
