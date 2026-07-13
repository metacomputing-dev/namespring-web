import type { HanjaEntry } from '../../seed-ts/src/database/hanja-repository.js';
import { makeFallbackEntry } from './core/name-utils.js';
import {
  isRecognizedHanjaGlyph,
  type HanjaPool,
} from './hanja-annotations.js';
import type { NameCharInput } from './types.js';

export const NAME_ENTRY_RESOLUTION_FAILED = 'NAME_ENTRY_RESOLUTION_FAILED' as const;

export type NameEntryResolutionFailureReason =
  | 'explicit_hanja_not_found'
  | 'hangul_hanja_reading_mismatch'
  | 'explicit_hanja_not_surname_eligible'
  | 'explicit_hanja_required'
  | 'ambiguous_surname_hanja'
  | 'invalid_hangul_syllable'
  | 'invalid_hanja_character';

export type NameEntryRole = 'surname' | 'givenName';

function nameEntryResolutionMessage(reason: NameEntryResolutionFailureReason): string {
  switch (reason) {
    case 'hangul_hanja_reading_mismatch':
      return 'The explicit Hangul and Hanja pair does not match a verified reading.';
    case 'invalid_hangul_syllable':
      return 'The name character must be one precomposed Hangul syllable.';
    case 'invalid_hanja_character':
      return 'Explicit Hanja must be exactly one Han character.';
    case 'explicit_hanja_not_surname_eligible':
      return 'The explicit character is not registered as an eligible surname.';
    case 'ambiguous_surname_hanja':
      return 'The surname reading maps to more than one eligible Hanja; explicit Hanja is required.';
    case 'explicit_hanja_required':
      return 'Explicit Hanja is required for non-pure name evaluation.';
    default:
      return 'The explicit Hanja is not available in the active name-character pool.';
  }
}

/**
 * Safe public error for an explicit name character that cannot be verified.
 *
 * The raw Hangul and Hanja are deliberately not retained on the error: names
 * are personal data, while the character index and role are sufficient for a
 * caller to identify the invalid input field.
 */
export class NameEntryResolutionError extends Error {
  readonly code = NAME_ENTRY_RESOLUTION_FAILED;
  readonly retryable = false;

  constructor(
    readonly reason: NameEntryResolutionFailureReason,
    readonly role: NameEntryRole,
    readonly characterIndex: number,
  ) {
    super(nameEntryResolutionMessage(reason));
    this.name = 'NameEntryResolutionError';
  }
}

export interface NameEntryRepository {
  findByHanja(hanja: string): Promise<HanjaEntry | null>;
  findByHangul(hangul: string): Promise<HanjaEntry[]>;
  findSurnamesByHangul?(hangul: string): Promise<HanjaEntry[]>;
}

export interface PreverifiedExplicitPairContext {
  readonly role: NameEntryRole;
  readonly hanjaPool: HanjaPool;
}

export type PreverifiedExplicitPairLookup = (
  input: NameCharInput,
  context: PreverifiedExplicitPairContext,
) => HanjaEntry | undefined;

export interface ResolveNameEntriesOptions {
  readonly forceHangulOnly?: boolean;
  readonly isSurname?: boolean;
  readonly hanjaPool?: HanjaPool;
  readonly fullPoolEntries?: () => readonly HanjaEntry[];
  readonly preverifiedExplicitPair?: PreverifiedExplicitPairLookup;
}

export interface ResolveFixedNameCharacterPoolOptions {
  readonly hanjaPool: HanjaPool;
  readonly poolLimit: number;
  readonly allowHangulFallback?: boolean;
  readonly fullPoolEntries?: () => readonly HanjaEntry[];
  readonly preverifiedEntry?: HanjaEntry;
}

export interface AssertExplicitNameIdentityOptions extends Pick<
  ResolveNameEntriesOptions,
  'isSurname' | 'hanjaPool' | 'fullPoolEntries'
> {
  readonly preverifiedExplicitPair?: PreverifiedExplicitPairLookup;
}

export interface AssertNameCharacterSyntaxOptions {
  readonly role: NameEntryRole;
  readonly allowGenerationFilter?: (input: NameCharInput) => boolean;
}

// One Han ideograph occupies at most two UTF-16 code units. Leave a small
// allowance for surrounding whitespace accepted by the legacy request shape,
// while rejecting attacker-sized strings before trim() performs a linear scan.
const MAX_RAW_HANJA_CODE_UNITS = 8;

function isNameCharacterRecord(value: unknown): value is NameCharInput {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Normalize the optional Hanja field without scanning an unbounded string. */
export function normalizeNameHanja(input: unknown): string {
  if (!isNameCharacterRecord(input) || typeof input.hanja !== 'string') return '';
  if (input.hanja.length > MAX_RAW_HANJA_CODE_UNITS) return '';
  return input.hanja.trim();
}

/** True only for a bounded, non-placeholder Hanja value. */
export function hasExplicitNameHanja(input: unknown): boolean {
  if (!isNameCharacterRecord(input) || typeof input.hangul !== 'string') return false;
  const hanja = normalizeNameHanja(input);
  return hanja.length > 0 && hanja !== input.hangul;
}

function singleCodePoint(value: string): string | null {
  const iterator = value[Symbol.iterator]();
  const first = iterator.next();
  if (first.done || !iterator.next().done) return null;
  return first.value;
}

function isOnePrecomposedHangulSyllable(value: string): boolean {
  const character = singleCodePoint(value);
  const codePoint = character?.codePointAt(0);
  return codePoint !== undefined && codePoint >= 0xac00 && codePoint <= 0xd7a3;
}

function isOneHanCharacter(value: string): boolean {
  return isRecognizedHanjaGlyph(value);
}

/** Validate name-character syntax without retaining or exposing the raw name. */
export function assertNameCharacterSyntax(
  chars: readonly NameCharInput[],
  options: AssertNameCharacterSyntaxOptions,
): void {
  for (const [characterIndex, char] of chars.entries()) {
    const isCharacterRecord = isNameCharacterRecord(char);
    const hangul = isCharacterRecord && typeof char.hangul === 'string'
      ? char.hangul
      : '';
    if (!isOnePrecomposedHangulSyllable(hangul)) {
      const hasGenerationFilter = isCharacterRecord
        && typeof char.hangul === 'string'
        && options.allowGenerationFilter?.(char) === true;
      if (
        options.role !== 'givenName'
        || hasExplicitNameHanja(char)
        || !hasGenerationFilter
      ) {
        throw new NameEntryResolutionError(
          'invalid_hangul_syllable',
          options.role,
          characterIndex,
        );
      }
    }

    if (!isCharacterRecord) {
      throw new NameEntryResolutionError(
        'invalid_hangul_syllable',
        options.role,
        characterIndex,
      );
    }
    if (!Object.prototype.hasOwnProperty.call(char, 'hanja')) continue;
    if (
      typeof char.hanja !== 'string'
      || char.hanja.length > MAX_RAW_HANJA_CODE_UNITS
    ) {
      throw new NameEntryResolutionError(
        'invalid_hanja_character',
        options.role,
        characterIndex,
      );
    }
    const hanja = normalizeNameHanja(char);
    if (hanja.length === 0 || hanja === char.hangul) continue;
    if (!isOneHanCharacter(hanja)) {
      throw new NameEntryResolutionError(
        'invalid_hanja_character',
        options.role,
        characterIndex,
      );
    }
  }
}

function fullPool(options: {
  readonly hanjaPool: HanjaPool;
  readonly fullPoolEntries?: () => readonly HanjaEntry[];
}): readonly HanjaEntry[] {
  return options.hanjaPool === 'inmyeongyong_full'
    ? (options.fullPoolEntries?.() ?? [])
    : [];
}

async function findRegisteredSurnames(
  repository: NameEntryRepository,
  hangul: string,
): Promise<HanjaEntry[]> {
  const registered = repository.findSurnamesByHangul
    ? await repository.findSurnamesByHangul(hangul)
    : await repository.findByHangul(hangul);
  return registered.filter(
    (entry) => entry.hangul === hangul && entry.is_surname === true,
  );
}

async function resolveVerifiedExplicitPair(
  input: NameCharInput,
  repository: NameEntryRepository,
  options: {
    readonly hanjaPool: HanjaPool;
    readonly isSurname: boolean;
    readonly role: NameEntryRole;
    readonly characterIndex: number;
    readonly fullPoolEntries?: () => readonly HanjaEntry[];
  },
): Promise<HanjaEntry> {
  const hangul = input.hangul;
  const hanja = normalizeNameHanja(input);

  if (options.role === 'surname') {
    const eligibleSurnames = await findRegisteredSurnames(repository, hangul);
    const exactEligible = eligibleSurnames.find(
      (entry) => entry.hanja === hanja
        && entry.hangul === hangul
        && entry.is_surname === true,
    );
    if (exactEligible) return exactEligible;
  }

  const byHanja = await repository.findByHanja(hanja);
  if (options.role !== 'surname' && byHanja?.hangul === hangul) {
    return byHanja;
  }

  const byHangul = await repository.findByHangul(hangul);
  const exactRepositoryPair = byHangul.find((entry) => entry.hanja === hanja);
  if (options.role !== 'surname' && exactRepositoryPair) return exactRepositoryPair;

  const activeFullPool = fullPool(options);
  const exactFullPair = activeFullPool.find(
    (entry) => entry.hanja === hanja && entry.hangul === hangul,
  );
  if (options.role !== 'surname' && exactFullPair) return exactFullPair;

  const exactPairExists = byHanja?.hangul === hangul
    || exactRepositoryPair !== undefined
    || exactFullPair !== undefined;
  if (options.role === 'surname' && exactPairExists) {
    throw new NameEntryResolutionError(
      'explicit_hanja_not_surname_eligible',
      options.role,
      options.characterIndex,
    );
  }

  const glyphExists = byHanja != null
    || activeFullPool.some((entry) => entry.hanja === hanja);
  throw new NameEntryResolutionError(
    glyphExists ? 'hangul_hanja_reading_mismatch' : 'explicit_hanja_not_found',
    options.role,
    options.characterIndex,
  );
}

/**
 * Verify only caller-supplied Hangul/Hanja pairs, preserving source indexes.
 *
 * Recommendation inputs may also contain Hangul/jamo generation filters; those
 * are intentionally left untouched here. Explicit pairs are checked in stable
 * index order so an identity error cannot be hidden by NameStat not-found or
 * transport failures later in the public pipeline.
 */
export async function assertExplicitNameIdentity(
  chars: readonly NameCharInput[],
  repository: NameEntryRepository,
  options: AssertExplicitNameIdentityOptions = {},
): Promise<ReadonlyMap<NameCharInput, HanjaEntry>> {
  const isSurname = options.isSurname ?? false;
  const role: NameEntryRole = isSurname ? 'surname' : 'givenName';
  const hanjaPool = options.hanjaPool ?? 'curated';
  const resolved = new Map<NameCharInput, HanjaEntry>();

  for (const [characterIndex, char] of chars.entries()) {
    const hangul = char.hangul;
    const hanja = normalizeNameHanja(char);
    if (hanja.length === 0 || hanja === hangul) continue;
    const preverified = options.preverifiedExplicitPair?.(char, { role, hanjaPool });
    const entry = preverified ?? await resolveVerifiedExplicitPair(char, repository, {
      hanjaPool,
      isSurname,
      role,
      characterIndex,
      fullPoolEntries: options.fullPoolEntries,
    });
    resolved.set(char, entry);
  }
  return resolved;
}

/** Resolve scoring inputs without ever replacing an explicit Hanja silently. */
export async function resolveNameEntries(
  chars: readonly NameCharInput[],
  repository: NameEntryRepository,
  options: ResolveNameEntriesOptions = {},
): Promise<HanjaEntry[]> {
  const forceHangulOnly = options.forceHangulOnly ?? false;
  const isSurname = options.isSurname ?? false;
  const role: NameEntryRole = isSurname ? 'surname' : 'givenName';
  const hanjaPool = options.hanjaPool ?? 'curated';

  return Promise.all(chars.map(async (char, characterIndex) => {
    const hasExplicitHanja = hasExplicitNameHanja(char);

    if (forceHangulOnly) {
      return makeFallbackEntry(char.hangul, { hanja: '', isSurname });
    }

    if (hasExplicitHanja) {
      const preverified = options.preverifiedExplicitPair?.(char, { role, hanjaPool });
      if (preverified) return preverified;

      return resolveVerifiedExplicitPair(char, repository, {
        hanjaPool,
        isSurname,
        role,
        characterIndex,
        fullPoolEntries: options.fullPoolEntries,
      });
    }

    if (role === 'surname') {
      const eligible = await findRegisteredSurnames(repository, char.hangul);
      if (eligible.length === 1) return eligible[0];
      if (eligible.length > 1) {
        throw new NameEntryResolutionError(
          'ambiguous_surname_hanja',
          role,
          characterIndex,
        );
      }
    }

    throw new NameEntryResolutionError(
      'explicit_hanja_required',
      role,
      characterIndex,
    );
  }));
}

/** Resolve a fixed candidate-generation position using the same pair policy. */
export async function resolveFixedNameCharacterPool(
  input: NameCharInput,
  repository: NameEntryRepository,
  options: ResolveFixedNameCharacterPoolOptions,
): Promise<HanjaEntry[]> {
  if (hasExplicitNameHanja(input)) {
    if (options.preverifiedEntry) return [options.preverifiedEntry];
    return [await resolveVerifiedExplicitPair(input, repository, {
      hanjaPool: options.hanjaPool,
      isSurname: false,
      role: 'givenName',
      characterIndex: 0,
      fullPoolEntries: options.fullPoolEntries,
    })];
  }

  if (options.allowHangulFallback === true) {
    return [makeFallbackEntry(input.hangul, { hanja: '' })];
  }

  const entries = options.hanjaPool === 'inmyeongyong_full'
    ? fullPool(options).filter((entry) => entry.hangul === input.hangul)
    : await repository.findByHangul(input.hangul);
  return entries.length > 0
    ? [...entries.slice(0, options.poolLimit)]
    : [];
}
