import engineConfig from '../config/engine.json';
import { parseJamoFilter } from './core/name-utils.js';
import {
  assertNameCharacterSyntax,
  hasExplicitNameHanja,
} from './name-entry-resolver.js';
import type { SpringRequest } from './types.js';
import { verifySurnameAuthority } from './surname-authority.js';

export const SPRING_NAME_REQUEST_INVALID = 'SPRING_NAME_REQUEST_INVALID' as const;

export const SPRING_NAME_LIMITS = Object.freeze({
  surnameMin: 1,
  surnameMax: 2,
  givenNameMin: 1,
  givenNameMax: 4,
  paginationMax: engineConfig.maxCandidates,
} as const);

export type SpringNameRequestValidationReason =
  | 'invalid_request'
  | 'invalid_surname_cardinality'
  | 'invalid_given_name_cardinality'
  | 'given_name_required'
  | 'invalid_given_name_length'
  | 'incoherent_given_name_length'
  | 'invalid_mode'
  | 'invalid_options'
  | 'invalid_pure_hangul_name_mode'
  | 'invalid_use_surname_hanja_in_pure_hangul'
  | 'unverified_single_surname'
  | 'partial_compound_surname_hanja'
  | 'unverified_compound_surname'
  | 'invalid_pagination_limit'
  | 'invalid_pagination_offset'
  | 'evaluation_generation_filter_not_allowed'
  | 'evaluation_name_identity_incomplete'
  | 'pure_hangul_explicit_hanja_conflict';

export type SpringNameRequestValidationField =
  | 'request'
  | 'surname'
  | 'givenName'
  | 'givenNameLength'
  | 'mode'
  | 'options'
  | 'options.pureHangulNameMode'
  | 'options.useSurnameHanjaInPureHangul'
  | 'options.limit'
  | 'options.offset';

function requestValidationMessage(reason: SpringNameRequestValidationReason): string {
  switch (reason) {
    case 'invalid_surname_cardinality':
      return 'The surname must contain one or two characters.';
    case 'invalid_given_name_cardinality':
      return 'A supplied given name must contain between one and four characters.';
    case 'given_name_required':
      return 'This operation requires an explicit given name.';
    case 'invalid_given_name_length':
      return 'The requested given-name length must be an integer from one to four.';
    case 'incoherent_given_name_length':
      return 'The requested given-name length must match the supplied given name.';
    case 'invalid_mode':
      return 'The requested naming mode is not supported.';
    case 'invalid_options':
      return 'Naming options must be a plain object.';
    case 'invalid_pure_hangul_name_mode':
      return 'The pure-Hangul naming mode is not supported.';
    case 'invalid_use_surname_hanja_in_pure_hangul':
      return 'The pure-Hangul surname policy must be boolean.';
    case 'unverified_single_surname':
      return 'The surname is not supported by the active authority registry.';
    case 'partial_compound_surname_hanja':
      return 'A compound surname must supply either both Hanja characters or neither.';
    case 'unverified_compound_surname':
      return 'The compound surname is not supported by the active authority registry.';
    case 'invalid_pagination_limit':
      return 'The pagination limit must be a positive integer within the candidate bound.';
    case 'invalid_pagination_offset':
      return 'The pagination offset must be a non-negative integer within the candidate bound.';
    case 'evaluation_generation_filter_not_allowed':
      return 'Evaluation mode cannot be combined with a name-generation filter.';
    case 'evaluation_name_identity_incomplete':
      return 'Evaluation requires either Hanja for every character or a complete pure-Hangul name.';
    case 'pure_hangul_explicit_hanja_conflict':
      return 'Pure-Hangul mode cannot be combined with explicit given-name Hanja.';
    default:
      return 'The naming request is invalid.';
  }
}

/** PII-free public error for structural naming-request failures. */
export class SpringNameRequestValidationError extends Error {
  readonly code = SPRING_NAME_REQUEST_INVALID;
  readonly retryable = false;

  constructor(
    readonly reason: SpringNameRequestValidationReason,
    readonly field: SpringNameRequestValidationField,
  ) {
    super(requestValidationMessage(reason));
    this.name = 'SpringNameRequestValidationError';
  }
}

export interface AssertSpringNameRequestContractOptions {
  readonly allowGivenNameGenerationFilters: boolean;
  readonly requireGivenName?: boolean;
  readonly evaluateGivenName?: boolean;
}

function fail(
  reason: SpringNameRequestValidationReason,
  field: SpringNameRequestValidationField,
): never {
  throw new SpringNameRequestValidationError(reason, field);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Validate the runtime name contract before database initialization.
 *
 * TypeScript types are not a security boundary: JavaScript and JSON callers
 * can supply arbitrary shapes. This guard keeps malformed or unbounded inputs
 * from reaching SQLite, candidate expansion, or scoring.
 */
export function assertSpringNameRequestContract(
  request: SpringRequest,
  options: AssertSpringNameRequestContractOptions,
): void {
  if (!isPlainRecord(request)) fail('invalid_request', 'request');

  if (
    !Array.isArray(request.surname)
    || request.surname.length < SPRING_NAME_LIMITS.surnameMin
    || request.surname.length > SPRING_NAME_LIMITS.surnameMax
  ) {
    fail('invalid_surname_cardinality', 'surname');
  }

  const hasGivenNameProperty = Object.prototype.hasOwnProperty.call(request, 'givenName');
  const evaluateGivenName = options.evaluateGivenName === true
    || request.mode === 'evaluate';
  const requireGivenName = options.requireGivenName === true || evaluateGivenName;
  if (
    hasGivenNameProperty
    && (
      !Array.isArray(request.givenName)
      || request.givenName.length < SPRING_NAME_LIMITS.givenNameMin
      || request.givenName.length > SPRING_NAME_LIMITS.givenNameMax
    )
  ) {
    if (
      requireGivenName
      && Array.isArray(request.givenName)
      && request.givenName.length === 0
    ) {
      fail('given_name_required', 'givenName');
    }
    fail('invalid_given_name_cardinality', 'givenName');
  }
  if (requireGivenName && !request.givenName?.length) {
    fail('given_name_required', 'givenName');
  }

  if (
    request.givenNameLength !== undefined
    && (
      !Number.isSafeInteger(request.givenNameLength)
      || request.givenNameLength < SPRING_NAME_LIMITS.givenNameMin
      || request.givenNameLength > SPRING_NAME_LIMITS.givenNameMax
    )
  ) {
    fail('invalid_given_name_length', 'givenNameLength');
  }
  if (
    request.givenName?.length !== undefined
    && request.givenNameLength !== undefined
    && (
      evaluateGivenName
        ? request.givenName.length !== request.givenNameLength
        : request.givenName.length > request.givenNameLength
    )
  ) {
    fail('incoherent_given_name_length', 'givenNameLength');
  }

  if (
    request.mode !== undefined
    && !(['auto', 'evaluate', 'recommend', 'all'] as readonly unknown[]).includes(request.mode)
  ) {
    fail('invalid_mode', 'mode');
  }
  if (request.options !== undefined && !isPlainRecord(request.options)) {
    fail('invalid_options', 'options');
  }
  if (
    request.options?.pureHangulNameMode !== undefined
    && !(['auto', 'on', 'off'] as readonly unknown[]).includes(
      request.options.pureHangulNameMode,
    )
  ) {
    fail('invalid_pure_hangul_name_mode', 'options.pureHangulNameMode');
  }
  if (
    request.options?.useSurnameHanjaInPureHangul !== undefined
    && typeof request.options.useSurnameHanjaInPureHangul !== 'boolean'
  ) {
    fail(
      'invalid_use_surname_hanja_in_pure_hangul',
      'options.useSurnameHanjaInPureHangul',
    );
  }

  const paginationLimit = request.options?.limit;
  if (
    paginationLimit !== undefined
    && (
      typeof paginationLimit !== 'number'
      || !Number.isSafeInteger(paginationLimit)
      || paginationLimit < 1
      || paginationLimit > SPRING_NAME_LIMITS.paginationMax
    )
  ) {
    fail('invalid_pagination_limit', 'options.limit');
  }
  const paginationOffset = request.options?.offset;
  if (
    paginationOffset !== undefined
    && (
      typeof paginationOffset !== 'number'
      || !Number.isSafeInteger(paginationOffset)
      || paginationOffset < 0
      || paginationOffset > SPRING_NAME_LIMITS.paginationMax
    )
  ) {
    fail('invalid_pagination_offset', 'options.offset');
  }

  assertNameCharacterSyntax(request.surname, { role: 'surname' });
  const surnameAuthority = verifySurnameAuthority(request.surname);
  if (!surnameAuthority.ok) fail(surnameAuthority.reason, 'surname');
  if (request.givenName?.length) {
    assertNameCharacterSyntax(request.givenName, {
      role: 'givenName',
      ...(options.allowGivenNameGenerationFilters
        ? { allowGenerationFilter: (input) => parseJamoFilter(input.hangul) !== null }
        : {}),
    });

    const explicitHanjaFlags = request.givenName.map(hasExplicitNameHanja);
    const hasExplicitHanja = explicitHanjaFlags.some(Boolean);
    if (
      request.options?.pureHangulNameMode === 'on'
      && hasExplicitHanja
    ) {
      fail('pure_hangul_explicit_hanja_conflict', 'givenName');
    }

    if (evaluateGivenName) {
      const filters = request.givenName.map((input) => parseJamoFilter(input.hangul));
      if (filters.some((filter) => filter !== null)) {
        fail('evaluation_generation_filter_not_allowed', 'givenName');
      }
      const allExplicitHanja = explicitHanjaFlags.every(Boolean);
      const allPureHangul = explicitHanjaFlags.every((explicit) => !explicit)
        && request.options?.pureHangulNameMode !== 'off';
      if (!allExplicitHanja && !allPureHangul) {
        fail('evaluation_name_identity_incomplete', 'givenName');
      }
    }
  }
}
