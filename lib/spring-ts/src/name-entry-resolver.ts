import type { HanjaEntry } from '../../seed-ts/src/database/hanja-repository.js';
import { makeFallbackEntry } from './core/name-utils.js';
import type { HanjaPool } from './hanja-annotations.js';
import type { NameCharInput } from './types.js';

export const NAME_ENTRY_RESOLUTION_FAILED = 'NAME_ENTRY_RESOLUTION_FAILED' as const;

export type NameEntryResolutionFailureReason =
  | 'explicit_hanja_not_found'
  | 'hangul_hanja_reading_mismatch'
  | 'invalid_hangul_syllable';

export type NameEntryRole = 'surname' | 'givenName';

function nameEntryResolutionMessage(reason: NameEntryResolutionFailureReason): string {
  switch (reason) {
    case 'hangul_hanja_reading_mismatch':
      return 'The explicit Hangul and Hanja pair does not match a verified reading.';
    case 'invalid_hangul_syllable':
      return 'The name character must be one precomposed Hangul syllable.';
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

function isOnePrecomposedHangulSyllable(value: string): boolean {
  const codePoints = Array.from(value);
  if (codePoints.length !== 1) return false;
  const codePoint = codePoints[0]?.codePointAt(0);
  return codePoint !== undefined && codePoint >= 0xac00 && codePoint <= 0xd7a3;
}

/** Validate name-character syntax without retaining or exposing the raw name. */
export function assertNameCharacterSyntax(
  chars: readonly NameCharInput[],
  options: AssertNameCharacterSyntaxOptions,
): void {
  for (const [characterIndex, char] of chars.entries()) {
    const hangul = String(char.hangul ?? '');
    if (isOnePrecomposedHangulSyllable(hangul)) continue;

    const hanja = String(char.hanja ?? '').trim();
    const hasExplicitHanja = hanja.length > 0 && hanja !== hangul;
    if (
      options.role === 'givenName'
      && !hasExplicitHanja
      && options.allowGenerationFilter?.(char) === true
    ) {
      continue;
    }
    throw new NameEntryResolutionError(
      'invalid_hangul_syllable',
      options.role,
      characterIndex,
    );
  }
}

function withRole(entry: HanjaEntry, isSurname: boolean): HanjaEntry {
  return { ...entry, is_surname: isSurname };
}

function fullPool(options: {
  readonly hanjaPool: HanjaPool;
  readonly fullPoolEntries?: () => readonly HanjaEntry[];
}): readonly HanjaEntry[] {
  return options.hanjaPool === 'inmyeongyong_full'
    ? (options.fullPoolEntries?.() ?? [])
    : [];
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
  const hangul = String(input.hangul ?? '');
  const hanja = String(input.hanja ?? '').trim();
  const byHanja = await repository.findByHanja(hanja);

  // Preserve the common, already-correct route byte-for-byte.
  if (byHanja?.hangul === hangul) {
    return { ...byHanja, hangul, is_surname: options.isSurname };
  }

  // HanjaRepository.findByHanja historically returns only one row. Verify an
  // alternate registered reading through the Hangul index before rejecting it.
  const byHangul = await repository.findByHangul(hangul);
  const exactRepositoryPair = byHangul.find((entry) => entry.hanja === hanja);
  if (exactRepositoryPair) return withRole(exactRepositoryPair, options.isSurname);

  const activeFullPool = fullPool(options);
  const exactFullPair = activeFullPool.find(
    (entry) => entry.hanja === hanja && entry.hangul === hangul,
  );
  if (exactFullPair) return withRole(exactFullPair, options.isSurname);

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
    const hangul = String(char.hangul ?? '');
    const hanja = String(char.hanja ?? '').trim();
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
    const hasHanjaField = Object.prototype.hasOwnProperty.call(char, 'hanja');
    const normalizedHanja = String(char.hanja ?? '').trim();

    if (forceHangulOnly || (hasHanjaField && normalizedHanja.length === 0)) {
      return makeFallbackEntry(char.hangul, { hanja: '', isSurname });
    }

    if (normalizedHanja.length > 0) {
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

    const entries = hanjaPool === 'inmyeongyong_full'
      ? fullPool({ hanjaPool, fullPoolEntries: options.fullPoolEntries })
        .filter((entry) => entry.hangul === char.hangul)
        .map((entry) => withRole(entry, isSurname))
      : await repository.findByHangul(char.hangul);
    return entries[0] ?? makeFallbackEntry(char.hangul, {
      hanja: '',
      isSurname,
    });
  }));
}

/** Resolve a fixed candidate-generation position using the same pair policy. */
export async function resolveFixedNameCharacterPool(
  input: NameCharInput,
  repository: NameEntryRepository,
  options: ResolveFixedNameCharacterPoolOptions,
): Promise<HanjaEntry[]> {
  const normalizedHanja = String(input.hanja ?? '').trim();
  if (normalizedHanja.length > 0) {
    if (options.preverifiedEntry) return [options.preverifiedEntry];
    return [await resolveVerifiedExplicitPair(input, repository, {
      hanjaPool: options.hanjaPool,
      isSurname: false,
      role: 'givenName',
      characterIndex: 0,
      fullPoolEntries: options.fullPoolEntries,
    })];
  }

  const entries = options.hanjaPool === 'inmyeongyong_full'
    ? fullPool(options).filter((entry) => entry.hangul === input.hangul)
    : await repository.findByHangul(input.hangul);
  return entries.length > 0
    ? [...entries.slice(0, options.poolLimit)]
    : [makeFallbackEntry(input.hangul, { hanja: '' })];
}
