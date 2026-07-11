import type { NameGenderTendency } from './types.js';

export const NAME_STAT_LOOKUP_UNAVAILABLE = 'NAME_STAT_LOOKUP_UNAVAILABLE' as const;

/**
 * A successful repository lookup. `not_found` means the repository answered
 * normally and no row exists; infrastructure failures are represented by
 * {@link NameStatLookupUnavailableError}, never by this result type.
 */
export type NameStatLookupResult =
  | {
      readonly status: 'found';
      readonly popularityRank: number | null;
      readonly maleRatio: number | null;
      readonly nameGender: NameGenderTendency;
    }
  | {
      readonly status: 'not_found';
      readonly popularityRank: null;
      readonly maleRatio: null;
      readonly nameGender: 'unknown';
    };

export class NameStatLookupUnavailableError extends Error {
  readonly code = NAME_STAT_LOOKUP_UNAVAILABLE;
  readonly retryable = true;

  constructor(cause: unknown) {
    super('Name-stat data is temporarily unavailable; the name was not classified as missing.', {
      cause,
    });
    this.name = 'NameStatLookupUnavailableError';
  }
}
