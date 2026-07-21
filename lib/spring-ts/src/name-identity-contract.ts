import { hasExplicitNameHanja } from './name-entry-resolver.js';

export type NameIdentityModeConflictV1 =
  | 'PARTIAL_HANJA_IDENTITY'
  | 'PURE_HANGUL_MODE_CONFLICT'
  | 'PURE_HANGUL_MODE_DISABLED';

/**
 * Shared identity-mode guard for local contexts, free reports, and paid
 * registration. A name segment must not silently change identity by joining
 * only the Hanja that happened to be supplied.
 */
export function findNameIdentityModeConflictV1(
  characters: readonly unknown[],
  options: {
    readonly role: 'surname' | 'givenName';
    readonly pureHangulNameMode?: unknown;
  },
): NameIdentityModeConflictV1 | null {
  const explicitHanja = characters.map(hasExplicitNameHanja);
  const hasAnyExplicitHanja = explicitHanja.some(Boolean);
  const hasEveryExplicitHanja = explicitHanja.every(Boolean);

  if (hasAnyExplicitHanja && !hasEveryExplicitHanja) {
    return 'PARTIAL_HANJA_IDENTITY';
  }
  if (options.role !== 'givenName') return null;
  if (options.pureHangulNameMode === 'on' && hasAnyExplicitHanja) {
    return 'PURE_HANGUL_MODE_CONFLICT';
  }
  if (options.pureHangulNameMode === 'off' && !hasAnyExplicitHanja) {
    return 'PURE_HANGUL_MODE_DISABLED';
  }
  return null;
}
