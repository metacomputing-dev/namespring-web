/**
 * Stable public identity for a resolved name candidate.
 *
 * Candidate IDs are deliberately independent from recommendation rank, score,
 * popularity, and generated copy. Those values can change as the engine is
 * improved without breaking a saved candidate -> report continuation.
 *
 * This ID is a correlation key, not an entitlement credential. Payment and
 * premium delivery servers must bind and verify the canonical name snapshot in
 * addition to this value.
 */

export const CANDIDATE_ID_PREFIX_V1 = 'candidate_v1_' as const;
export const CANDIDATE_ID_PATTERN_V1 = /^candidate_v1_[0-9a-f]{32}$/u;

const MAX_CANONICAL_NAME_CODE_UNITS = 256;
const FNV_64_PRIME = 0x100000001b3n;
const UINT64_MASK = 0xffff_ffff_ffff_ffffn;
const FNV_64_OFFSET_A = 0xcbf2_9ce4_8422_2325n;
const FNV_64_OFFSET_B = 0x6c62_272e_07bb_0142n;

export interface CandidateNameIdentityInputV1 {
  readonly surnameHangul: string;
  /** Empty is allowed when the surname is intentionally pure Hangul. */
  readonly surnameHanja: string;
  readonly givenHangul: string;
  /** Empty is allowed for a pure-Hangul given name. */
  readonly givenHanja: string;
}

export interface CanonicalCandidateNameIdentityV1 {
  readonly surnameHangul: string;
  readonly surnameHanja: string;
  readonly givenHangul: string;
  readonly givenHanja: string;
  readonly fullHangul: string;
  readonly fullHanja: string;
}

function normalizeIdentityPart(
  value: string,
  label: 'surnameHangul' | 'surnameHanja' | 'givenHangul' | 'givenHanja',
  allowEmpty: boolean,
): string {
  if (typeof value !== 'string') {
    throw new TypeError(`Candidate ${label} must be a string.`);
  }

  const normalized = value.normalize('NFC');
  if ((!allowEmpty && normalized.length === 0)
    || normalized.length > MAX_CANONICAL_NAME_CODE_UNITS
    || normalized !== normalized.trim()
    || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new TypeError(`Candidate ${label} is not a bounded canonical name value.`);
  }
  return normalized;
}

export function canonicalizeCandidateNameIdentityV1(
  input: CandidateNameIdentityInputV1,
): CanonicalCandidateNameIdentityV1 {
  const surnameHangul = normalizeIdentityPart(input.surnameHangul, 'surnameHangul', false);
  const surnameHanja = normalizeIdentityPart(input.surnameHanja, 'surnameHanja', true);
  const givenHangul = normalizeIdentityPart(input.givenHangul, 'givenHangul', false);
  const givenHanja = normalizeIdentityPart(input.givenHanja, 'givenHanja', true);
  if ((surnameHanja.length > 0
      && Array.from(surnameHanja).length !== Array.from(surnameHangul).length)
    || (givenHanja.length > 0
      && Array.from(givenHanja).length !== Array.from(givenHangul).length)) {
    throw new TypeError('Candidate Hangul/Hanja segment lengths must match when Hanja is present.');
  }
  return {
    surnameHangul,
    surnameHanja,
    givenHangul,
    givenHanja,
    fullHangul: `${surnameHangul}${givenHangul}`,
    fullHanja: `${surnameHanja}${givenHanja}`,
  };
}

function fnv1a64Utf16(value: string, offset: bigint): bigint {
  let hash = offset;
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    hash ^= BigInt(codeUnit & 0xff);
    hash = (hash * FNV_64_PRIME) & UINT64_MASK;
    hash ^= BigInt(codeUnit >>> 8);
    hash = (hash * FNV_64_PRIME) & UINT64_MASK;
  }
  return hash;
}

function hex64(value: bigint): string {
  return value.toString(16).padStart(16, '0');
}

export function candidateIdFromNameIdentityV1(
  input: CandidateNameIdentityInputV1,
): string {
  const canonical = canonicalizeCandidateNameIdentityV1(input);
  // JSON preserves surname/given-name and Hangul/Hanja boundaries. NFC is used
  // instead of compatibility normalization so legally distinct Hanja variants
  // are not silently collapsed. The segmentation is part of identity because
  // it changes four-frame and naming calculations even when concatenated text
  // happens to be identical.
  const material = JSON.stringify([
    'spring-ts.candidate-name-identity.v1',
    canonical.surnameHangul,
    canonical.surnameHanja,
    canonical.givenHangul,
    canonical.givenHanja,
  ]);
  const first = fnv1a64Utf16(material, FNV_64_OFFSET_A);
  const second = fnv1a64Utf16(`\u0001${material}`, FNV_64_OFFSET_B);
  return `${CANDIDATE_ID_PREFIX_V1}${hex64(first)}${hex64(second)}`;
}

export function isCandidateIdV1(value: unknown): value is string {
  return typeof value === 'string' && CANDIDATE_ID_PATTERN_V1.test(value);
}
