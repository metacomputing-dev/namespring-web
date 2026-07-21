import {
  candidateIdFromNameIdentityV1,
  isCandidateIdV1,
} from '../../experience/candidate-id.js';
import {
  assertReportDeliveryV1,
  ReportDeliveryRequestValidationError,
  validateReportDeliveryRequestV1,
} from '../delivery/validation.js';
import { REPORT_DELIVERY_REQUEST_SCHEMA_V1 } from '../delivery/types.js';
import { assertNameCharacterSyntax } from '../../name-entry-resolver.js';
import {
  snapshotPremiumReportRegistrationEvaluationInputV1,
  snapshotPremiumReportRegistrationRequestV1,
} from '../../public-request-snapshot.js';
import {
  AnalysisOptionsContractError,
  assertAnalysisOptionsContractV1,
} from '../analysis-options-validation.js';
import {
  PREMIUM_REPORT_ACCESS_REQUEST_SCHEMA_V1,
  PREMIUM_REPORT_DELIVERY_SCHEMA_V1,
  PREMIUM_REPORT_REGISTRATION_REQUEST_SCHEMA_V1,
  PREMIUM_REPORT_REFERENCE_SCHEMA_V1,
  REPORT_ENTITLEMENT_SCHEMA_V1,
  SERVICE_CATALOG_SCHEMA_V1,
  STORY_COMPLETION_PRODUCT_ID_V1,
  PremiumContractValidationErrorV1,
  type EvaluatePremiumReportAccessV1Input,
  type EvaluatePremiumReportRegistrationV1Input,
  type PremiumAccessAuthorizationScopeV1,
  type PremiumContractInvalidReasonV1,
  type PremiumRegistrationAuthorizationScopeV1,
  type PremiumRegistrationMaterialDigestV1,
  type PremiumReportAccessDecisionV1,
  type PremiumReportAccessRequestV1,
  type PremiumReportBindingV1,
  type PremiumReportDeliveryV1,
  type PremiumReportDeliveryValidationContextV1,
  type PremiumEntitlementOwnerV1,
  type PremiumReportReferenceV1,
  type PremiumReportRegistrationDecisionV1,
  type PremiumReportRegistrationRequestV1,
  type ReportEntitlementStatusV1,
  type ReportEntitlementV1,
  type ServiceCatalogV1,
} from './types.js';

const MAX_CATALOG_PRODUCTS = 32;
const MAX_PREMIUM_SECTIONS = 32;
const MAX_PREMIUM_DELIVERY_BYTES = 512 * 1024;
const MAX_PREMIUM_REGISTRATION_BYTES = 64 * 1024;
const MAX_TEXT_LENGTH = 32_768;
const OPAQUE_SUFFIX = '[a-zA-Z0-9_-]{16,128}';
const ID_PATTERNS = {
  report: new RegExp(`^report_v1_${OPAQUE_SUFFIX}$`, 'u'),
  entitlement: new RegExp(`^entitlement_v1_${OPAQUE_SUFFIX}$`, 'u'),
  delivery: new RegExp(`^premium_delivery_v1_${OPAQUE_SUFFIX}$`, 'u'),
  request: new RegExp(`^premium_request_v1_${OPAQUE_SUFFIX}$`, 'u'),
  // v1 remains parseable only for explicit offline migration. Runtime
  // authorization derives v2 owners and never guesses a cross-version link.
  owner: new RegExp(`^premium_owner_(?:v1|v2)_${OPAQUE_SUFFIX}$`, 'u'),
  localAnalysis: /^analysis_v1_[a-zA-Z0-9_-]{16,128}$/u,
  serverAnalysis: /^server_analysis_v1_[a-zA-Z0-9_-]{16,128}$/u,
};
const CONTENT_VERSION_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/u;
const CATALOG_VERSION_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/u;
const ISO_UTC_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
const ISO_CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const SHA256_MATERIAL_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const ENTITLEMENT_STATUSES = new Set<ReportEntitlementStatusV1>([
  'pending_payment', 'active', 'revoked', 'refunded', 'expired',
]);
const FREE_DELIVERY_FORBIDDEN_KEYS = new Set([
  'premiumContent', 'premiumBody', 'fullText', 'isUnlocked', 'paid',
  'entitlementId', 'deliveryId',
]);

function invalid(reason: PremiumContractInvalidReasonV1, detail: string): never {
  throw new PremiumContractValidationErrorV1(reason, detail);
}

function assertPlainObject(
  value: unknown,
  reason: PremiumContractInvalidReasonV1 = 'INVALID_SHAPE',
): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    invalid(reason, 'plain object required');
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    invalid(reason, 'plain object required');
  }
}

function assertAllowedKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  reason: PremiumContractInvalidReasonV1 = 'UNKNOWN_FIELD',
): void {
  const allowed = new Set(keys);
  const unknown = Object.keys(value).find((key) => !allowed.has(key));
  if (unknown) invalid(reason, `unknown field ${unknown}`);
}

function assertText(
  value: unknown,
  label: string,
  maxLength = MAX_TEXT_LENGTH,
): asserts value is string {
  if (typeof value !== 'string'
    || value.length < 1
    || value.length > maxLength
    || value !== value.trim()
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) {
    invalid('INVALID_SHAPE', label);
  }
}

function assertTimestamp(value: unknown, label: string): asserts value is string {
  const parsed = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  const canonical = typeof value === 'string' && !value.includes('.')
    ? value.replace(/Z$/u, '.000Z')
    : value;
  if (typeof value !== 'string'
    || !ISO_UTC_TIMESTAMP_PATTERN.test(value)
    || !Number.isFinite(parsed)
    || new Date(parsed).toISOString() !== canonical) {
    invalid('INVALID_TIMESTAMP', label);
  }
}

function assertChronological(
  earlier: string,
  later: string,
  label: string,
): void {
  if (Date.parse(later) < Date.parse(earlier)) invalid('INVALID_TIMESTAMP', label);
}

function assertId(value: unknown, pattern: RegExp, label: string): asserts value is string {
  if (typeof value !== 'string' || !pattern.test(value)) invalid('INVALID_ID', label);
}

function sameBinding(left: PremiumReportBindingV1, right: PremiumReportBindingV1): boolean {
  return left.reportId === right.reportId
    && left.analysisId === right.analysisId
    && left.candidateId === right.candidateId
    && left.productId === right.productId
    && left.contentVersion === right.contentVersion;
}

function canonicalJson(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return `{${entries.map(([key, child]) => (
      `${JSON.stringify(key)}:${canonicalJson(child)}`
    )).join(',')}}`;
  }
  invalid('INVALID_REGISTRATION_REQUEST', 'registration replay material');
}

function assertRegistrationMaterialDigest(
  value: unknown,
): asserts value is PremiumRegistrationMaterialDigestV1 {
  if (typeof value !== 'string' || !SHA256_MATERIAL_DIGEST_PATTERN.test(value)) {
    invalid('INVALID_REGISTRATION_REQUEST', 'registration material digest');
  }
}

function accessAuthorizationScope(
  input: EvaluatePremiumReportAccessV1Input,
): PremiumAccessAuthorizationScopeV1 {
  return {
    requestId: input.request.requestId,
    entitlementId: input.request.entitlementId,
    owner: {
      kind: input.principal.kind,
      subjectId: input.principal.subjectId,
    },
    binding: {
      reportId: input.request.binding.reportId,
      analysisId: input.request.binding.analysisId,
      candidateId: input.request.binding.candidateId,
      productId: input.request.binding.productId,
      contentVersion: input.request.binding.contentVersion,
    },
  };
}

function assertPremiumAccessAuthorizationScopeV1(
  value: unknown,
): asserts value is PremiumAccessAuthorizationScopeV1 {
  assertPlainObject(value, 'INVALID_DELIVERY');
  assertAllowedKeys(
    value,
    ['requestId', 'entitlementId', 'owner', 'binding'],
    'INVALID_DELIVERY',
  );
  assertId(value.requestId, ID_PATTERNS.request, 'authorization.requestId');
  assertId(value.entitlementId, ID_PATTERNS.entitlement, 'authorization.entitlementId');
  assertPremiumEntitlementOwnerV1(value.owner);
  assertPremiumReportBindingV1(value.binding);
}

function assertRegistrationNameCharacters(
  value: unknown,
  label: 'surname' | 'givenName',
  max: number,
): asserts value is ReadonlyArray<{ readonly hangul: string; readonly hanja?: string }> {
  if (!Array.isArray(value) || value.length < 1 || value.length > max) {
    invalid('INVALID_REGISTRATION_REQUEST', label);
  }
  for (const [index, character] of value.entries()) {
    assertPlainObject(character, 'INVALID_REGISTRATION_REQUEST');
    assertAllowedKeys(character, ['hangul', 'hanja'], 'INVALID_REGISTRATION_REQUEST');
    if (typeof character.hangul !== 'string'
      || character.hangul.length < 1
      || character.hangul !== character.hangul.trim()
      || character.hangul !== character.hangul.normalize('NFC')
      || Array.from(character.hangul).length !== 1) {
      invalid('INVALID_REGISTRATION_REQUEST', `${label}[${index}].hangul`);
    }
    if (character.hanja !== undefined
      && (typeof character.hanja !== 'string'
        || character.hanja.length < 1
        || character.hanja !== character.hanja.trim()
        || character.hanja !== character.hanja.normalize('NFC')
        || Array.from(character.hanja).length !== 1)) {
      invalid('INVALID_REGISTRATION_REQUEST', `${label}[${index}].hanja`);
    }
  }
}

function assertRegistrationBirth(value: unknown): asserts value is Record<string, unknown> {
  assertPlainObject(value, 'INVALID_REGISTRATION_REQUEST');
  assertAllowedKeys(value, [
    'year', 'month', 'day', 'hour', 'minute', 'gender', 'calendarType',
    'isLeapMonth', 'region', 'city', 'birthPlace', 'timezone', 'latitude',
    'longitude',
  ], 'INVALID_REGISTRATION_REQUEST');
  const integer = (raw: unknown, label: string, min: number, max: number, nullable = false): void => {
    if (nullable && (raw === undefined || raw === null)) return;
    if (!Number.isSafeInteger(raw) || Number(raw) < min || Number(raw) > max) {
      invalid('INVALID_REGISTRATION_REQUEST', label);
    }
  };
  integer(value.year, 'birth.year', 1, 9999);
  integer(value.month, 'birth.month', 1, 12);
  integer(value.day, 'birth.day', 1, 31);
  integer(value.hour, 'birth.hour', 0, 23, true);
  integer(value.minute, 'birth.minute', 0, 59, true);
  if (typeof value.gender !== 'string'
    || !['male', 'female', 'neutral'].includes(value.gender)) {
    invalid('INVALID_REGISTRATION_REQUEST', 'birth.gender');
  }
  if (value.calendarType !== undefined
    && value.calendarType !== 'solar'
    && value.calendarType !== 'lunar') {
    invalid('INVALID_REGISTRATION_REQUEST', 'birth.calendarType');
  }
  if (value.isLeapMonth !== undefined && typeof value.isLeapMonth !== 'boolean') {
    invalid('INVALID_REGISTRATION_REQUEST', 'birth.isLeapMonth');
  }
  if (value.isLeapMonth === true && value.calendarType !== 'lunar') {
    invalid('INVALID_REGISTRATION_REQUEST', 'birth.isLeapMonth requires lunar calendar');
  }
  if ((value.hour === undefined || value.hour === null)
    && value.minute !== undefined
    && value.minute !== null) {
    invalid('INVALID_REGISTRATION_REQUEST', 'birth.minute requires hour');
  }
  const year = Number(value.year);
  const month = Number(value.month);
  const day = Number(value.day);
  if (value.calendarType === 'lunar') {
    if (day > 30) invalid('INVALID_REGISTRATION_REQUEST', 'birth lunar day');
  } else {
    const date = new Date(0);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCFullYear(year, month - 1, day);
    if (date.getUTCFullYear() !== year
      || date.getUTCMonth() !== month - 1
      || date.getUTCDate() !== day) {
      invalid('INVALID_REGISTRATION_REQUEST', 'birth solar date');
    }
  }
  for (const key of ['region', 'city', 'birthPlace', 'timezone'] as const) {
    if (value[key] !== undefined) assertText(value[key], `birth.${key}`, 256);
  }
  const coordinate = (raw: unknown, label: string, min: number, max: number): void => {
    if (raw === undefined) return;
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < min || raw > max) {
      invalid('INVALID_REGISTRATION_REQUEST', label);
    }
  };
  coordinate(value.latitude, 'birth.latitude', -90, 90);
  coordinate(value.longitude, 'birth.longitude', -180, 180);
}

function assertPremiumAnalysisOptions(
  value: unknown,
  birthYear: number,
): void {
  try {
    assertAnalysisOptionsContractV1(value, birthYear, {
      // Registration accepts only reproducible source input. A trusted paid
      // handler may choose remote KASI infrastructure as server policy; the
      // client never chooses that resource through this DTO.
      allowRemoteLunarConversion: false,
    });
    const options = value as Record<string, unknown>;
    const precisionConfig = options.precisionConfig;
    if (precisionConfig !== undefined
      && precisionConfig !== null
      && typeof precisionConfig === 'object'
      && !Array.isArray(precisionConfig)
      && Object.hasOwn(precisionConfig, 'lunarConversionSource')) {
      invalid(
        'INVALID_REGISTRATION_REQUEST',
        'options.precisionConfig.lunarConversionSource is server-controlled',
      );
    }
  } catch (error) {
    if (error instanceof AnalysisOptionsContractError) {
      invalid('INVALID_REGISTRATION_REQUEST', error.detail);
    }
    throw error;
  }
}

/**
 * Validates the paid-transition request without trusting the local result.
 * The server must still run SpringEngine again and issue fresh persistent IDs.
 */
export function assertPremiumReportRegistrationRequestV1(
  value: unknown,
): asserts value is PremiumReportRegistrationRequestV1 {
  assertPlainObject(value, 'INVALID_REGISTRATION_REQUEST');
  assertAllowedKeys(value, [
    'schemaVersion', 'requestId', 'productId', 'localAnalysisId',
    'candidateId', 'analysisInput',
  ], 'INVALID_REGISTRATION_REQUEST');
  if (value.schemaVersion !== PREMIUM_REPORT_REGISTRATION_REQUEST_SCHEMA_V1) {
    invalid('INVALID_SCHEMA_VERSION', 'premium registration request');
  }
  assertId(value.requestId, ID_PATTERNS.request, 'registration requestId');
  assertId(value.localAnalysisId, ID_PATTERNS.localAnalysis, 'localAnalysisId');
  if (value.productId !== STORY_COMPLETION_PRODUCT_ID_V1
    || !isCandidateIdV1(value.candidateId)) {
    invalid('INVALID_REGISTRATION_REQUEST', 'productId/candidateId');
  }
  assertPlainObject(value.analysisInput, 'INVALID_REGISTRATION_REQUEST');
  assertAllowedKeys(
    value.analysisInput,
    ['birth', 'surname', 'givenName', 'targetDate', 'options'],
    'INVALID_REGISTRATION_REQUEST',
  );
  assertRegistrationBirth(value.analysisInput.birth);
  assertRegistrationNameCharacters(value.analysisInput.surname, 'surname', 2);
  assertRegistrationNameCharacters(value.analysisInput.givenName, 'givenName', 4);
  try {
    assertNameCharacterSyntax(value.analysisInput.surname, { role: 'surname' });
    assertNameCharacterSyntax(value.analysisInput.givenName, { role: 'givenName' });
  } catch {
    invalid('INVALID_REGISTRATION_REQUEST', 'name character syntax');
  }
  if (typeof value.analysisInput.targetDate !== 'string'
    || !ISO_CALENDAR_DATE_PATTERN.test(value.analysisInput.targetDate)
    || !Number.isFinite(Date.parse(`${value.analysisInput.targetDate}T00:00:00Z`))
    || new Date(`${value.analysisInput.targetDate}T00:00:00Z`)
      .toISOString().slice(0, 10) !== value.analysisInput.targetDate) {
    invalid('INVALID_REGISTRATION_REQUEST', 'targetDate');
  }
  if (value.analysisInput.options !== undefined) {
    assertPremiumAnalysisOptions(value.analysisInput.options, Number(value.analysisInput.birth.year));
  }
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    invalid('INVALID_REGISTRATION_REQUEST', 'registration must be JSON serializable');
  }
  if (new TextEncoder().encode(serialized).byteLength > MAX_PREMIUM_REGISTRATION_BYTES) {
    invalid('PAYLOAD_BUDGET_EXCEEDED', 'premium registration');
  }
  try {
    validateReportDeliveryRequestV1({
      birth: value.analysisInput.birth,
      surname: value.analysisInput.surname,
      givenName: value.analysisInput.givenName,
      targetDate: value.analysisInput.targetDate,
      ...(value.analysisInput.options ? { options: value.analysisInput.options } : {}),
      candidateId: value.candidateId,
      delivery: {
        schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
        surfaces: [{ id: 'integrated', depth: 'brief' }],
      },
    });
    const surname = value.analysisInput.surname;
    const givenName = value.analysisInput.givenName;
    const recomputed = candidateIdFromNameIdentityV1({
      surnameHangul: surname.map((character) => character.hangul).join(''),
      surnameHanja: surname.map((character) => character.hanja ?? '').join(''),
      givenHangul: givenName.map((character) => character.hangul).join(''),
      givenHanja: givenName.map((character) => character.hanja ?? '').join(''),
    });
    if (recomputed !== value.candidateId) {
      invalid('INVALID_REGISTRATION_REQUEST', 'candidateId/name mismatch');
    }
  } catch (error) {
    if (error instanceof PremiumContractValidationErrorV1) throw error;
    if (error instanceof ReportDeliveryRequestValidationError) {
      if (error.reason === 'PARTIAL_HANJA_IDENTITY'
        || error.reason === 'PURE_HANGUL_MODE_CONFLICT'
        || error.reason === 'PURE_HANGUL_MODE_DISABLED') {
        invalid(error.reason, 'analysisInput name identity');
      }
    }
    invalid('INVALID_REGISTRATION_REQUEST', 'analysis input');
  }
}

/**
 * Produces the trusted idempotency material digest for one complete paid
 * registration request. The canonical plaintext contains birth/name data and
 * must never be logged, persisted, or returned to the browser.
 */
export async function createPremiumRegistrationMaterialDigestV1(
  value: unknown,
): Promise<PremiumRegistrationMaterialDigestV1> {
  try {
    // The descriptor-safe snapshot is the runtime boundary. Semantic
    // validation below narrows the copied value after accessors and exotic
    // objects have already been rejected without executing caller code.
    value = snapshotPremiumReportRegistrationRequestV1(
      value as PremiumReportRegistrationRequestV1,
    );
  } catch {
    invalid('INVALID_REGISTRATION_REQUEST', 'bounded plain registration data required');
  }
  assertPremiumReportRegistrationRequestV1(value);
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    invalid('INVALID_REGISTRATION_REQUEST', 'server SHA-256 unavailable');
  }
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await subtle.digest('SHA-256', bytes.slice().buffer);
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `sha256:${hex}`;
}

function registrationAuthorizationScope(
  input: EvaluatePremiumReportRegistrationV1Input,
  materialDigest: PremiumRegistrationMaterialDigestV1,
): PremiumRegistrationAuthorizationScopeV1 {
  return {
    requestId: input.request.requestId,
    owner: {
      kind: input.principal.kind,
      subjectId: input.principal.subjectId,
    },
    productId: input.request.productId,
    candidateId: input.request.candidateId,
    materialDigest,
  };
}

function assertPremiumRegistrationAuthorizationScopeV1(
  value: unknown,
): asserts value is PremiumRegistrationAuthorizationScopeV1 {
  assertPlainObject(value, 'INVALID_REGISTRATION_REQUEST');
  assertAllowedKeys(
    value,
    ['requestId', 'owner', 'productId', 'candidateId', 'materialDigest'],
    'INVALID_REGISTRATION_REQUEST',
  );
  assertId(value.requestId, ID_PATTERNS.request, 'registration authorization requestId');
  assertPremiumEntitlementOwnerV1(value.owner);
  if (value.productId !== STORY_COMPLETION_PRODUCT_ID_V1
    || !isCandidateIdV1(value.candidateId)) {
    invalid('INVALID_REGISTRATION_REQUEST', 'registration authorization binding');
  }
  assertRegistrationMaterialDigest(value.materialDigest);
}

/**
 * Evaluates a trusted, owner-scoped idempotency observation. The storage lookup
 * must be an atomic read/reservation keyed by owner kind + owner subjectId +
 * requestId. A different request body under the same key must never mint a
 * second report, checkout, or entitlement.
 */
export async function evaluatePremiumReportRegistrationReplayV1(
  input: EvaluatePremiumReportRegistrationV1Input,
): Promise<PremiumReportRegistrationDecisionV1> {
  try {
    input = snapshotPremiumReportRegistrationEvaluationInputV1(input);
  } catch {
    invalid('INVALID_REGISTRATION_REQUEST', 'bounded plain replay data required');
  }
  assertPremiumReportRegistrationRequestV1(input.request);
  assertPremiumEntitlementOwnerV1(input.principal);
  assertPlainObject(input.replay, 'INVALID_REGISTRATION_REQUEST');

  const materialDigest = await createPremiumRegistrationMaterialDigestV1(input.request);
  const authorization = registrationAuthorizationScope(input, materialDigest);

  if (input.replay.state === 'first_seen') {
    assertAllowedKeys(input.replay, ['state'], 'INVALID_REGISTRATION_REQUEST');
    return {
      registration: 'allow',
      reasonCode: 'REGISTRATION_ACCEPTED',
      registrationMode: 'initial',
      authorization,
    };
  }
  if (input.replay.state === 'conflicting_material_replay') {
    assertAllowedKeys(input.replay, ['state'], 'INVALID_REGISTRATION_REQUEST');
    return { registration: 'deny', reasonCode: 'REGISTRATION_REPLAY_MISMATCH' };
  }
  if (input.replay.state !== 'same_material_replay') {
    invalid('INVALID_REGISTRATION_REQUEST', 'server registration replay observation');
  }
  assertAllowedKeys(
    input.replay,
    ['state', 'materialDigest', 'priorReport'],
    'INVALID_REGISTRATION_REQUEST',
  );
  assertRegistrationMaterialDigest(input.replay.materialDigest);
  assertPremiumReportReferenceV1(input.replay.priorReport);
  if (input.replay.materialDigest !== materialDigest) {
    return { registration: 'deny', reasonCode: 'REGISTRATION_REPLAY_MISMATCH' };
  }
  if (input.replay.priorReport.status === 'retired') {
    return { registration: 'deny', reasonCode: 'REGISTRATION_REPORT_RETIRED' };
  }
  const priorRegistration = input.replay.priorReport.registration;
  if (priorRegistration.requestId !== input.request.requestId
    || priorRegistration.owner.kind !== input.principal.kind
    || priorRegistration.owner.subjectId !== input.principal.subjectId
    || priorRegistration.materialDigest !== materialDigest
    || input.replay.priorReport.binding.productId !== input.request.productId
    || input.replay.priorReport.binding.candidateId !== input.request.candidateId) {
    return { registration: 'deny', reasonCode: 'REGISTRATION_REFERENCE_MISMATCH' };
  }
  return {
    registration: 'allow',
    reasonCode: 'REGISTRATION_IDEMPOTENT_REPLAY',
    registrationMode: 'idempotent_replay',
    priorReport: input.replay.priorReport,
    authorization,
  };
}

/** Verifies the report selected or created after a registration decision. */
export function assertPremiumReportReferenceForRegistrationDecisionV1(
  value: unknown,
  decision: PremiumReportRegistrationDecisionV1,
): asserts value is PremiumReportReferenceV1 {
  assertPlainObject(decision, 'INVALID_REGISTRATION_REQUEST');
  if (decision.registration !== 'allow') {
    invalid('INVALID_REGISTRATION_REQUEST', 'registration decision denied');
  }
  if (decision.registrationMode === 'initial') {
    assertAllowedKeys(
      decision,
      ['registration', 'reasonCode', 'registrationMode', 'authorization'],
      'INVALID_REGISTRATION_REQUEST',
    );
    if (decision.reasonCode !== 'REGISTRATION_ACCEPTED') {
      invalid('INVALID_REGISTRATION_REQUEST', 'initial registration decision');
    }
  } else if (decision.registrationMode === 'idempotent_replay') {
    assertAllowedKeys(
      decision,
      ['registration', 'reasonCode', 'registrationMode', 'priorReport', 'authorization'],
      'INVALID_REGISTRATION_REQUEST',
    );
    if (decision.reasonCode !== 'REGISTRATION_IDEMPOTENT_REPLAY') {
      invalid('INVALID_REGISTRATION_REQUEST', 'replay registration decision');
    }
    assertPremiumReportReferenceV1(decision.priorReport);
  } else {
    invalid('INVALID_REGISTRATION_REQUEST', 'registration decision mode');
  }
  assertPremiumRegistrationAuthorizationScopeV1(decision.authorization);
  assertPremiumReportReferenceV1(value);
  const registration = value.registration;
  if (value.status !== 'registered'
    || registration.requestId !== decision.authorization.requestId
    || registration.owner.kind !== decision.authorization.owner.kind
    || registration.owner.subjectId !== decision.authorization.owner.subjectId
    || registration.materialDigest !== decision.authorization.materialDigest
    || value.binding.productId !== decision.authorization.productId
    || value.binding.candidateId !== decision.authorization.candidateId) {
    invalid('INVALID_REGISTRATION_REQUEST', 'registration decision/report binding');
  }
  if (decision.registrationMode === 'idempotent_replay') {
    if (!sameBinding(value.binding, decision.priorReport.binding)) {
      invalid('INVALID_REGISTRATION_REQUEST', 'registration replay report binding');
    }
  }
}

export function assertPremiumReportBindingV1(
  value: unknown,
): asserts value is PremiumReportBindingV1 {
  assertPlainObject(value, 'INVALID_BINDING');
  assertAllowedKeys(
    value,
    ['reportId', 'analysisId', 'candidateId', 'productId', 'contentVersion'],
    'INVALID_BINDING',
  );
  assertId(value.reportId, ID_PATTERNS.report, 'reportId');
  assertId(value.analysisId, ID_PATTERNS.serverAnalysis, 'server analysisId');
  if (!isCandidateIdV1(value.candidateId)) invalid('INVALID_ID', 'candidateId');
  if (value.productId !== STORY_COMPLETION_PRODUCT_ID_V1) {
    invalid('INVALID_BINDING', 'productId');
  }
  if (typeof value.contentVersion !== 'string'
    || !CONTENT_VERSION_PATTERN.test(value.contentVersion)) {
    invalid('INVALID_BINDING', 'contentVersion');
  }
}

function assertPremiumEntitlementOwnerV1(
  value: unknown,
): asserts value is PremiumEntitlementOwnerV1 {
  assertPlainObject(value, 'INVALID_ENTITLEMENT');
  assertAllowedKeys(value, ['kind', 'subjectId'], 'INVALID_ENTITLEMENT');
  if (value.kind !== 'account' && value.kind !== 'anonymous_session') {
    invalid('INVALID_ENTITLEMENT', 'owner kind');
  }
  assertId(value.subjectId, ID_PATTERNS.owner, 'owner subjectId');
}

export function assertServiceCatalogV1(value: unknown): asserts value is ServiceCatalogV1 {
  assertPlainObject(value, 'INVALID_CATALOG');
  assertAllowedKeys(
    value,
    ['schemaVersion', 'catalogVersion', 'generatedAt', 'products'],
    'INVALID_CATALOG',
  );
  if (value.schemaVersion !== SERVICE_CATALOG_SCHEMA_V1) {
    invalid('INVALID_SCHEMA_VERSION', 'service catalog');
  }
  if (typeof value.catalogVersion !== 'string'
    || !CATALOG_VERSION_PATTERN.test(value.catalogVersion)) {
    invalid('INVALID_CATALOG', 'catalogVersion');
  }
  assertTimestamp(value.generatedAt, 'catalog generatedAt');
  if (!Array.isArray(value.products)
    || value.products.length < 1
    || value.products.length > MAX_CATALOG_PRODUCTS) {
    invalid('INVALID_CATALOG', 'products');
  }

  const productIds = new Set<string>();
  for (const product of value.products) {
    assertPlainObject(product, 'INVALID_CATALOG');
    assertAllowedKeys(
      product,
      ['productId', 'contentVersion', 'displayName', 'availability', 'price'],
      'INVALID_CATALOG',
    );
    if (product.productId !== STORY_COMPLETION_PRODUCT_ID_V1) {
      invalid('INVALID_CATALOG', 'productId');
    }
    if (productIds.has(product.productId)) invalid('DUPLICATE_VALUE', 'productId');
    productIds.add(product.productId);
    if (typeof product.contentVersion !== 'string'
      || !CONTENT_VERSION_PATTERN.test(product.contentVersion)) {
      invalid('INVALID_CATALOG', 'contentVersion');
    }
    assertText(product.displayName, 'displayName', 256);
    if (typeof product.availability !== 'string'
      || !['active', 'unavailable', 'retired'].includes(product.availability)) {
      invalid('INVALID_CATALOG', 'availability');
    }
    const price = product.price;
    assertPlainObject(price, 'INVALID_CATALOG');
    assertAllowedKeys(
      price,
      ['amount', 'currency', 'authority', 'taxIncluded'],
      'INVALID_CATALOG',
    );
    if (typeof price.amount !== 'number'
      || !Number.isSafeInteger(price.amount)
      || price.amount < 1) {
      invalid('INVALID_CATALOG', 'price amount');
    }
    if (price.currency !== 'KRW'
      || price.authority !== 'server_catalog'
      || typeof price.taxIncluded !== 'boolean') {
      invalid('INVALID_CATALOG', 'price authority');
    }
  }
}

export function assertPremiumReportReferenceV1(
  value: unknown,
): asserts value is PremiumReportReferenceV1 {
  assertPlainObject(value);
  assertAllowedKeys(
    value,
    [
      'schemaVersion', 'authority', 'registration', 'binding', 'status',
      'registeredAt', 'updatedAt',
    ],
  );
  if (value.schemaVersion !== PREMIUM_REPORT_REFERENCE_SCHEMA_V1) {
    invalid('INVALID_SCHEMA_VERSION', 'report reference');
  }
  if (value.authority !== 'server'
    || (value.status !== 'registered' && value.status !== 'retired')) {
    invalid('INVALID_SHAPE', 'report reference authority/status');
  }
  assertPremiumRegistrationAuthorizationScopeV1(value.registration);
  assertPremiumReportBindingV1(value.binding);
  if (value.registration.productId !== value.binding.productId
    || value.registration.candidateId !== value.binding.candidateId) {
    invalid('INVALID_BINDING', 'registration/report binding');
  }
  assertTimestamp(value.registeredAt, 'registeredAt');
  assertTimestamp(value.updatedAt, 'updatedAt');
  assertChronological(value.registeredAt, value.updatedAt, 'report reference order');
}

export function assertReportEntitlementV1(
  value: unknown,
): asserts value is ReportEntitlementV1 {
  assertPlainObject(value, 'INVALID_ENTITLEMENT');
  assertAllowedKeys(value, [
    'schemaVersion', 'entitlementId', 'authority', 'owner', 'binding', 'status',
    'grantSource', 'createdAt', 'updatedAt', 'activatedAt', 'expiresAt',
  ], 'INVALID_ENTITLEMENT');
  if (value.schemaVersion !== REPORT_ENTITLEMENT_SCHEMA_V1) {
    invalid('INVALID_SCHEMA_VERSION', 'entitlement');
  }
  assertId(value.entitlementId, ID_PATTERNS.entitlement, 'entitlementId');
  if (value.authority !== 'server') invalid('INVALID_ENTITLEMENT', 'authority');
  assertPremiumEntitlementOwnerV1(value.owner);
  assertPremiumReportBindingV1(value.binding);
  if (typeof value.status !== 'string'
    || !ENTITLEMENT_STATUSES.has(value.status as ReportEntitlementStatusV1)) {
    invalid('INVALID_ENTITLEMENT', 'status');
  }
  if (typeof value.grantSource !== 'string'
    || !['verified_payment', 'promotion', 'admin_grant'].includes(value.grantSource)) {
    invalid('INVALID_ENTITLEMENT', 'grantSource');
  }
  assertTimestamp(value.createdAt, 'entitlement createdAt');
  assertTimestamp(value.updatedAt, 'entitlement updatedAt');
  if (value.activatedAt !== undefined) assertTimestamp(value.activatedAt, 'activatedAt');
  if (value.expiresAt !== undefined) assertTimestamp(value.expiresAt, 'expiresAt');
  assertChronological(value.createdAt, value.updatedAt, 'entitlement update order');
  if (value.activatedAt !== undefined) {
    assertChronological(value.createdAt, value.activatedAt, 'entitlement activation order');
    assertChronological(value.activatedAt, value.updatedAt, 'entitlement activation/update order');
  }
  if (value.expiresAt !== undefined) {
    assertChronological(value.createdAt, value.expiresAt, 'entitlement expiry order');
  }
  if (value.status === 'active' && value.activatedAt === undefined) {
    invalid('INVALID_ENTITLEMENT', 'active entitlement requires activatedAt');
  }
}

export function assertPremiumReportAccessRequestV1(
  value: unknown,
): asserts value is PremiumReportAccessRequestV1 {
  assertPlainObject(value, 'INVALID_ACCESS_REQUEST');
  assertAllowedKeys(
    value,
    ['schemaVersion', 'requestId', 'entitlementId', 'binding'],
    'INVALID_ACCESS_REQUEST',
  );
  if (value.schemaVersion !== PREMIUM_REPORT_ACCESS_REQUEST_SCHEMA_V1) {
    invalid('INVALID_SCHEMA_VERSION', 'access request');
  }
  assertId(value.requestId, ID_PATTERNS.request, 'requestId');
  assertId(value.entitlementId, ID_PATTERNS.entitlement, 'entitlementId');
  assertPremiumReportBindingV1(value.binding);
}

function bindingMismatchReason(
  request: PremiumReportBindingV1,
  stored: PremiumReportBindingV1,
): PremiumReportAccessDecisionV1 | null {
  if (request.reportId !== stored.reportId) {
    return { access: 'deny', reasonCode: 'REPORT_ID_MISMATCH' };
  }
  if (request.analysisId !== stored.analysisId) {
    return { access: 'deny', reasonCode: 'ANALYSIS_ID_MISMATCH' };
  }
  if (request.candidateId !== stored.candidateId) {
    return { access: 'deny', reasonCode: 'CANDIDATE_ID_MISMATCH' };
  }
  if (request.productId !== stored.productId) {
    return { access: 'deny', reasonCode: 'PRODUCT_ID_MISMATCH' };
  }
  if (request.contentVersion !== stored.contentVersion) {
    return { access: 'deny', reasonCode: 'CONTENT_VERSION_MISMATCH' };
  }
  return null;
}

export function evaluatePremiumReportAccessV1(
  input: EvaluatePremiumReportAccessV1Input,
): PremiumReportAccessDecisionV1 {
  assertPremiumReportAccessRequestV1(input.request);
  assertTimestamp(input.now, 'server now');
  assertPremiumEntitlementOwnerV1(input.principal);

  assertPlainObject(input.replay, 'INVALID_ACCESS_REQUEST');
  if (input.replay.state === 'first_seen') {
    assertAllowedKeys(input.replay, ['state'], 'INVALID_ACCESS_REQUEST');
  } else if (input.replay.state === 'same_binding_replay') {
    assertAllowedKeys(input.replay, ['state', 'priorDeliveryId'], 'INVALID_ACCESS_REQUEST');
    assertId(input.replay.priorDeliveryId, ID_PATTERNS.delivery, 'priorDeliveryId');
  } else if (input.replay.state === 'conflicting_binding_replay') {
    assertAllowedKeys(input.replay, ['state', 'priorDeliveryId'], 'INVALID_ACCESS_REQUEST');
    if (input.replay.priorDeliveryId !== undefined) {
      assertId(input.replay.priorDeliveryId, ID_PATTERNS.delivery, 'priorDeliveryId');
    }
  } else {
    invalid('INVALID_ACCESS_REQUEST', 'server replay observation');
  }

  if (input.replay.state === 'conflicting_binding_replay') {
    return { access: 'deny', reasonCode: 'REPLAY_BINDING_MISMATCH' };
  }
  if (!input.report) {
    return { access: 'deny', reasonCode: 'REPORT_NOT_FOUND' };
  }
  assertPremiumReportReferenceV1(input.report);
  if (input.report.status === 'retired') {
    return { access: 'deny', reasonCode: 'REPORT_RETIRED' };
  }
  if (input.report.registration.owner.kind !== input.principal.kind
    || input.report.registration.owner.subjectId !== input.principal.subjectId) {
    return { access: 'deny', reasonCode: 'REPORT_OWNER_MISMATCH' };
  }
  const reportMismatch = bindingMismatchReason(input.request.binding, input.report.binding);
  if (reportMismatch) return reportMismatch;
  if (!input.entitlement) {
    return { access: 'deny', reasonCode: 'ENTITLEMENT_NOT_FOUND' };
  }

  assertReportEntitlementV1(input.entitlement);
  if (input.request.entitlementId !== input.entitlement.entitlementId) {
    return { access: 'deny', reasonCode: 'ENTITLEMENT_ID_MISMATCH' };
  }
  if (input.principal.kind !== input.entitlement.owner.kind
    || input.principal.subjectId !== input.entitlement.owner.subjectId) {
    return { access: 'deny', reasonCode: 'ENTITLEMENT_OWNER_MISMATCH' };
  }
  const mismatch = bindingMismatchReason(input.request.binding, input.entitlement.binding);
  if (mismatch) return mismatch;

  switch (input.entitlement.status) {
    case 'pending_payment':
      return { access: 'deny', reasonCode: 'ENTITLEMENT_PENDING_PAYMENT' };
    case 'revoked':
      return { access: 'deny', reasonCode: 'ENTITLEMENT_REVOKED' };
    case 'refunded':
      return { access: 'deny', reasonCode: 'ENTITLEMENT_REFUNDED' };
    case 'expired':
      return { access: 'deny', reasonCode: 'ENTITLEMENT_EXPIRED' };
    case 'active':
      break;
  }
  if (input.entitlement.expiresAt
    && Date.parse(input.entitlement.expiresAt) <= Date.parse(input.now)) {
    return { access: 'deny', reasonCode: 'ENTITLEMENT_EXPIRED' };
  }
  if (!input.entitlement.activatedAt
    || Date.parse(input.entitlement.activatedAt) > Date.parse(input.now)) {
    return { access: 'deny', reasonCode: 'ENTITLEMENT_NOT_ACTIVE' };
  }

  if (input.replay.state === 'same_binding_replay') {
    return {
      access: 'allow',
      reasonCode: 'IDEMPOTENT_REPLAY',
      deliveryMode: 'idempotent_replay',
      priorDeliveryId: input.replay.priorDeliveryId,
      authorization: accessAuthorizationScope(input),
    };
  }
  return {
    access: 'allow',
    reasonCode: 'ACCESS_GRANTED',
    deliveryMode: 'initial',
    authorization: accessAuthorizationScope(input),
  };
}

export function assertPremiumReportDeliveryV1(
  value: unknown,
  context: PremiumReportDeliveryValidationContextV1,
): asserts value is PremiumReportDeliveryV1 {
  assertPlainObject(context, 'INVALID_DELIVERY');
  assertAllowedKeys(
    context,
    ['entitlement', 'allowedEvidenceRefs', 'accessDecision'],
    'INVALID_DELIVERY',
  );
  assertReportEntitlementV1(context.entitlement);
  assertPlainObject(context.accessDecision, 'INVALID_DELIVERY');
  if (context.accessDecision.access !== 'allow') {
    invalid('INVALID_DELIVERY', 'delivery requires an allow access decision');
  }
  if (context.accessDecision.deliveryMode === 'initial') {
    assertAllowedKeys(
      context.accessDecision,
      ['access', 'reasonCode', 'deliveryMode', 'authorization'],
      'INVALID_DELIVERY',
    );
    if (context.accessDecision.reasonCode !== 'ACCESS_GRANTED') {
      invalid('INVALID_DELIVERY', 'initial access decision');
    }
  } else if (context.accessDecision.deliveryMode === 'idempotent_replay') {
    assertAllowedKeys(
      context.accessDecision,
      ['access', 'reasonCode', 'deliveryMode', 'priorDeliveryId', 'authorization'],
      'INVALID_DELIVERY',
    );
    if (context.accessDecision.reasonCode !== 'IDEMPOTENT_REPLAY') {
      invalid('INVALID_DELIVERY', 'replay access decision');
    }
    assertId(
      context.accessDecision.priorDeliveryId,
      ID_PATTERNS.delivery,
      'accessDecision.priorDeliveryId',
    );
  } else {
    invalid('INVALID_DELIVERY', 'access decision delivery mode');
  }
  assertPremiumAccessAuthorizationScopeV1(context.accessDecision.authorization);
  const authorization = context.accessDecision.authorization;
  if (authorization.entitlementId !== context.entitlement.entitlementId
    || authorization.owner.kind !== context.entitlement.owner.kind
    || authorization.owner.subjectId !== context.entitlement.owner.subjectId
    || !sameBinding(authorization.binding, context.entitlement.binding)) {
    invalid('INVALID_DELIVERY', 'access decision authorization scope');
  }
  if (!Array.isArray(context.allowedEvidenceRefs)
    || context.allowedEvidenceRefs.length < 1
    || context.allowedEvidenceRefs.length > 4096) {
    invalid('INVALID_DELIVERY', 'allowedEvidenceRefs');
  }
  const allowedEvidenceRefs = new Set<string>();
  for (const ref of context.allowedEvidenceRefs) {
    assertText(ref, 'allowed evidence ref', 256);
    if (allowedEvidenceRefs.has(ref)) {
      invalid('DUPLICATE_VALUE', 'allowed evidence ref');
    }
    allowedEvidenceRefs.add(ref);
  }

  assertPlainObject(value, 'INVALID_DELIVERY');
  assertAllowedKeys(value, [
    'schemaVersion', 'deliveryId', 'binding', 'entitlement', 'deliveryMode',
    'deliveredAt', 'premiumContent',
  ], 'INVALID_DELIVERY');
  if (value.schemaVersion !== PREMIUM_REPORT_DELIVERY_SCHEMA_V1) {
    invalid('INVALID_SCHEMA_VERSION', 'premium delivery');
  }
  assertId(value.deliveryId, ID_PATTERNS.delivery, 'deliveryId');
  assertPremiumReportBindingV1(value.binding);
  assertPlainObject(value.entitlement, 'INVALID_DELIVERY');
  assertAllowedKeys(value.entitlement, ['entitlementId', 'status'], 'INVALID_DELIVERY');
  assertId(value.entitlement.entitlementId, ID_PATTERNS.entitlement, 'entitlementId');
  if (value.entitlement.status !== 'active') invalid('INVALID_DELIVERY', 'entitlement status');
  if (value.deliveryMode !== 'initial' && value.deliveryMode !== 'idempotent_replay') {
    invalid('INVALID_DELIVERY', 'deliveryMode');
  }
  if (value.deliveryMode !== context.accessDecision.deliveryMode
    || (value.deliveryMode === 'idempotent_replay'
      && value.deliveryId !== context.accessDecision.priorDeliveryId)) {
    invalid('INVALID_DELIVERY', 'delivery replay binding');
  }
  assertTimestamp(value.deliveredAt, 'deliveredAt');

  assertPlainObject(value.premiumContent, 'INVALID_DELIVERY');
  assertAllowedKeys(
    value.premiumContent,
    ['kind', 'format', 'title', 'summary', 'sections'],
    'INVALID_DELIVERY',
  );
  if (value.premiumContent.kind !== 'story_completion'
    || value.premiumContent.format !== 'structured_plain_text_v1') {
    invalid('INVALID_DELIVERY', 'premium content kind/format');
  }
  assertText(value.premiumContent.title, 'premium title', 512);
  assertText(value.premiumContent.summary, 'premium summary');
  if (!Array.isArray(value.premiumContent.sections)
    || value.premiumContent.sections.length < 1
    || value.premiumContent.sections.length > MAX_PREMIUM_SECTIONS) {
    invalid('INVALID_DELIVERY', 'premium sections');
  }
  const sectionIds = new Set<string>();
  for (const section of value.premiumContent.sections) {
    assertPlainObject(section, 'INVALID_DELIVERY');
    assertAllowedKeys(section, ['id', 'title', 'body', 'evidenceRefs'], 'INVALID_DELIVERY');
    assertText(section.id, 'section id', 128);
    if (sectionIds.has(section.id)) invalid('DUPLICATE_VALUE', 'section id');
    sectionIds.add(section.id);
    assertText(section.title, 'section title', 512);
    assertText(section.body, 'section body');
    if (!Array.isArray(section.evidenceRefs)
      || section.evidenceRefs.length < 1
      || section.evidenceRefs.length > 128
      || section.evidenceRefs.some((ref) => typeof ref !== 'string' || ref.length < 1)) {
      invalid('INVALID_DELIVERY', 'evidenceRefs');
    }
    const sectionRefs = new Set<string>();
    for (const ref of section.evidenceRefs) {
      assertText(ref, 'evidence ref', 256);
      if (sectionRefs.has(ref)) invalid('DUPLICATE_VALUE', 'section evidence ref');
      if (!allowedEvidenceRefs.has(ref)) {
        invalid('INVALID_DELIVERY', 'dangling evidence ref');
      }
      sectionRefs.add(ref);
    }
  }

  const entitlement = context.entitlement;
  if (entitlement.status !== 'active'
    || value.entitlement.entitlementId !== entitlement.entitlementId
    || !sameBinding(value.binding, entitlement.binding)) {
    invalid('INVALID_DELIVERY', 'delivery/entitlement binding mismatch');
  }
  if (entitlement.expiresAt
    && Date.parse(entitlement.expiresAt) <= Date.parse(value.deliveredAt)) {
    invalid('INVALID_DELIVERY', 'expired entitlement delivery');
  }
  if (!entitlement.activatedAt
    || Date.parse(entitlement.activatedAt) > Date.parse(value.deliveredAt)) {
    invalid('INVALID_DELIVERY', 'entitlement not active at delivery');
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    invalid('INVALID_DELIVERY', 'not JSON serializable');
  }
  if (new TextEncoder().encode(serialized).byteLength > MAX_PREMIUM_DELIVERY_BYTES) {
    invalid('PAYLOAD_BUDGET_EXCEEDED', 'premium delivery');
  }
}

/** Additional defense for free ReportDeliveryV1 before a server sends it. */
export function assertFreeReportPremiumBoundaryV1(value: unknown): void {
  try {
    assertReportDeliveryV1(value);
  } catch {
    invalid('FREE_DELIVERY_PREMIUM_LEAK', 'invalid free report delivery shape');
  }

  const stack: unknown[] = [value];
  const seen = new WeakSet<object>();
  let visitedNodes = 0;
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === null || typeof node !== 'object' || seen.has(node)) continue;
    seen.add(node);
    visitedNodes += 1;
    if (visitedNodes > 20_000) {
      invalid('FREE_DELIVERY_PREMIUM_LEAK', 'free delivery traversal budget');
    }
    if (Array.isArray(node)) {
      for (const child of node) stack.push(child);
      continue;
    }
    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      if (FREE_DELIVERY_FORBIDDEN_KEYS.has(key)) {
        invalid('FREE_DELIVERY_PREMIUM_LEAK', key);
      }
      if (key === 'contentState' && child !== 'omitted') {
        invalid('FREE_DELIVERY_PREMIUM_LEAK', 'offer contentState');
      }
      stack.push(child);
    }
  }
}
