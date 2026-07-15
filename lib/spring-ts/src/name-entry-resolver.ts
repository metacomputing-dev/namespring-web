import type { HanjaEntry } from '../../seed-ts/src/database/hanja-repository.js';
import { makeFallbackEntry } from './core/name-utils.js';
import type { HanjaPool } from './hanja-annotations.js';
import type { NameCharInput } from './types.js';

export const NAME_ENTRY_RESOLUTION_FAILED = 'NAME_ENTRY_RESOLUTION_FAILED' as const;

export type NameEntryResolutionFailureReason =
  | 'explicit_hanja_not_found'
  | 'hangul_hanja_reading_mismatch';

export type NameEntryRole = 'surname' | 'givenName';

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
    super(
      reason === 'hangul_hanja_reading_mismatch'
        ? 'The explicit Hangul and Hanja pair does not match a verified reading.'
        : 'The explicit Hanja is not available in the active name-character pool.',
    );
    this.name = 'NameEntryResolutionError';
  }
}

export interface NameEntryRepository {
  findByHanja(hanja: string): Promise<HanjaEntry | null>;
  findByHangul(hangul: string): Promise<HanjaEntry[]>;
}

export interface ResolveNameEntriesOptions {
  readonly forceHangulOnly?: boolean;
  readonly isSurname?: boolean;
  readonly hanjaPool?: HanjaPool;
  readonly fullPoolEntries?: () => readonly HanjaEntry[];
}

export interface ResolveFixedNameCharacterPoolOptions {
  readonly hanjaPool: HanjaPool;
  readonly poolLimit: number;
  readonly fullPoolEntries?: () => readonly HanjaEntry[];
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
