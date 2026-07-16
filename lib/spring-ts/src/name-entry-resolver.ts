import type { HanjaEntry } from '../../seed-ts/src/database/hanja-repository.js';
import { makeFallbackEntry } from './core/name-utils.js';
import {
  isRecognizedHanjaGlyph,
  type HanjaPool,
} from './hanja-annotations.js';
import {
  verifySurnameAuthority,
  type SurnameAuthorityFailureReason,
} from './surname-authority.js';
import type { NameCharInput } from './types.js';

export const NAME_ENTRY_RESOLUTION_FAILED = 'NAME_ENTRY_RESOLUTION_FAILED' as const;

export type NameEntryResolutionFailureReason =
  | 'explicit_hanja_not_found'
  | 'hangul_hanja_reading_mismatch'
  | 'explicit_hanja_not_surname_eligible'
  | 'explicit_hanja_required'
  | 'ambiguous_surname_hanja'
  | 'invalid_hangul_syllable'
  | 'invalid_hanja_character'
  | SurnameAuthorityFailureReason;

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
    case 'unverified_single_surname':
      return 'The surname is not supported by the active authority registry.';
    case 'partial_compound_surname_hanja':
      return 'A compound surname must supply either both Hanja characters or neither.';
    case 'unverified_compound_surname':
      return 'The compound surname is not supported by the active authority registry.';
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

function isOrdinaryHanCharacter(value: string): boolean {
  const character = singleCodePoint(value);
  return character !== null && /^\p{Script=Han}$/u.test(character);
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

function throwSurnameAuthorityFailure(
  reason: SurnameAuthorityFailureReason,
): never {
  throw new NameEntryResolutionError(reason, 'surname', 0);
}

async function resolveAuthoritativeSurnameEntry(
  input: NameCharInput,
  targetHanja: string,
  repository: NameEntryRepository,
  options: {
    readonly hanjaPool: HanjaPool;
    readonly characterIndex: number;
    readonly fullPoolEntries?: () => readonly HanjaEntry[];
    readonly preverifiedExplicitPair?: PreverifiedExplicitPairLookup;
  },
): Promise<HanjaEntry> {
  const preverified = options.preverifiedExplicitPair?.(input, {
    role: 'surname',
    hanjaPool: options.hanjaPool,
  });
  if (preverified?.hangul === input.hangul && preverified.hanja === targetHanja) {
    return { ...preverified, is_surname: true };
  }

  const byHangul = await repository.findByHangul(input.hangul);
  const exactRepositoryPair = byHangul.find((entry) => entry.hanja === targetHanja);
  const activeFullPool = fullPool(options);
  const exactFullPair = activeFullPool.find(
    (entry) => entry.hanja === targetHanja && entry.hangul === input.hangul,
  );
  if (exactRepositoryPair || exactFullPair) {
    return { ...(exactRepositoryPair ?? exactFullPair!), is_surname: true };
  }

  // Seed repository Hanja queries deliberately accept ordinary Han only.
  // Court-mirror PUA glyphs are resolved exclusively from the active full
  // pool, so a recognized legal glyph never crosses the repository boundary.
  const byHanja = isOrdinaryHanCharacter(targetHanja)
    ? await repository.findByHanja(targetHanja)
    : null;
  if (byHanja?.hangul === input.hangul) {
    return { ...byHanja, is_surname: true };
  }
  const glyphExists = byHanja != null
    || activeFullPool.some((entry) => entry.hanja === targetHanja);
  throw new NameEntryResolutionError(
    glyphExists ? 'hangul_hanja_reading_mismatch' : 'explicit_hanja_not_found',
    'surname',
    options.characterIndex,
  );
}

async function resolveVerifiedSurnameEntries(
  chars: readonly NameCharInput[],
  repository: NameEntryRepository,
  options: ResolveNameEntriesOptions,
): Promise<HanjaEntry[]> {
  assertNameCharacterSyntax(chars, { role: 'surname' });
  const verification = verifySurnameAuthority(chars);
  if (!verification.ok) throwSurnameAuthorityFailure(verification.reason);

  const forceHangulOnly = options.forceHangulOnly ?? false;
  if (forceHangulOnly) {
    return chars.map((char) => makeFallbackEntry(
      char.hangul,
      { hanja: '', isSurname: true },
    ));
  }

  const authority = verification.authority;
  let targetHanja: readonly string[];
  if (authority.kind === 'single') {
    const suppliedHanja = normalizeNameHanja(chars[0]);
    if (suppliedHanja.length > 0 && suppliedHanja !== chars[0].hangul) {
      targetHanja = [suppliedHanja];
    } else {
      if (authority.registeredHanja.length !== 1) {
        throw new NameEntryResolutionError(
          'ambiguous_surname_hanja',
          'surname',
          0,
        );
      }
      targetHanja = [authority.registeredHanja[0]];
    }
  } else {
    targetHanja = authority.hanja;
  }

  const hanjaPool = options.hanjaPool ?? 'curated';
  return Promise.all(chars.map((char, characterIndex) =>
    resolveAuthoritativeSurnameEntry(char, targetHanja[characterIndex], repository, {
      hanjaPool,
      characterIndex,
      fullPoolEntries: options.fullPoolEntries,
      preverifiedExplicitPair: options.preverifiedExplicitPair,
    })));
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

  if (!isOneHanCharacter(hanja)) {
    throw new NameEntryResolutionError(
      'invalid_hanja_character',
      options.role,
      options.characterIndex,
    );
  }

  if (!isOrdinaryHanCharacter(hanja)) {
    const activeFullPool = fullPool(options);
    const exactFullPair = activeFullPool.find(
      (entry) => entry.hanja === hanja && entry.hangul === hangul,
    );
    if (exactFullPair) return { ...exactFullPair, is_surname: options.isSurname };
    const glyphExists = activeFullPool.some((entry) => entry.hanja === hanja);
    throw new NameEntryResolutionError(
      glyphExists ? 'hangul_hanja_reading_mismatch' : 'explicit_hanja_not_found',
      options.role,
      options.characterIndex,
    );
  }

  const byHanja = await repository.findByHanja(hanja);
  if (byHanja?.hangul === hangul) return { ...byHanja, is_surname: options.isSurname };

  const byHangul = await repository.findByHangul(hangul);
  const exactRepositoryPair = byHangul.find((entry) => entry.hanja === hanja);
  if (exactRepositoryPair) {
    return { ...exactRepositoryPair, is_surname: options.isSurname };
  }

  const activeFullPool = fullPool(options);
  const exactFullPair = activeFullPool.find(
    (entry) => entry.hanja === hanja && entry.hangul === hangul,
  );
  if (exactFullPair) return { ...exactFullPair, is_surname: options.isSurname };

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

  if (isSurname) {
    const entries = await resolveVerifiedSurnameEntries(chars, repository, {
      isSurname: true,
      hanjaPool,
      fullPoolEntries: options.fullPoolEntries,
      preverifiedExplicitPair: options.preverifiedExplicitPair,
    });
    chars.forEach((char, index) => resolved.set(char, entries[index]));
    return resolved;
  }

  for (const [characterIndex, char] of chars.entries()) {
    const hangul = char.hangul;
    const hanja = normalizeNameHanja(char);
    if (hanja.length === 0 || hanja === hangul) continue;
    const preverified = options.preverifiedExplicitPair?.(char, { role, hanjaPool });
    const entry = preverified
      ? { ...preverified, is_surname: false }
      : await resolveVerifiedExplicitPair(char, repository, {
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
  const isSurname = options.isSurname ?? false;
  if (isSurname) {
    return resolveVerifiedSurnameEntries(chars, repository, options);
  }

  const forceHangulOnly = options.forceHangulOnly ?? false;
  const role: NameEntryRole = 'givenName';
  const hanjaPool = options.hanjaPool ?? 'curated';

  return Promise.all(chars.map(async (char, characterIndex) => {
    if (forceHangulOnly) {
      return makeFallbackEntry(char.hangul, { hanja: '' });
    }

    if (hasExplicitNameHanja(char)) {
      const preverified = options.preverifiedExplicitPair?.(char, { role, hanjaPool });
      if (preverified) return { ...preverified, is_surname: false };

      return resolveVerifiedExplicitPair(char, repository, {
        hanjaPool,
        isSurname: false,
        role,
        characterIndex,
        fullPoolEntries: options.fullPoolEntries,
      });
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
    if (options.preverifiedEntry) {
      return [{ ...options.preverifiedEntry, is_surname: false }];
    }
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
