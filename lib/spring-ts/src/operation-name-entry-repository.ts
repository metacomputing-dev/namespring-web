import type { HanjaEntry } from '../../seed-ts/src/database/hanja-repository.js';
import type { NameEntryRepository } from './name-entry-resolver.js';

export interface OperationNameEntryCache {
  readonly byHanja: Map<string, HanjaEntry | null>;
  readonly byHangul: Map<string, readonly HanjaEntry[]>;
  readonly surnamesByHangul: Map<string, readonly HanjaEntry[]>;
}

export interface OperationStepRunner {
  <T>(work: () => Promise<T>): Promise<T>;
}

export function createOperationNameEntryCache(): OperationNameEntryCache {
  return {
    byHanja: new Map(),
    byHangul: new Map(),
    surnamesByHangul: new Map(),
  };
}

function snapshotEntry(entry: HanjaEntry): HanjaEntry {
  return Object.freeze({ ...entry });
}

function snapshotEntries(entries: readonly HanjaEntry[]): readonly HanjaEntry[] {
  return Object.freeze(entries.map(snapshotEntry));
}

function copyEntry(entry: HanjaEntry | null): HanjaEntry | null {
  return entry === null ? null : { ...entry };
}

function copyEntries(entries: readonly HanjaEntry[]): HanjaEntry[] {
  return entries.map((entry) => ({ ...entry }));
}

/**
 * Adds settled-value memoization to one SpringEngine operation.
 *
 * The active-step runner owns lifecycle checks. Delegate-rejected and in-flight
 * lookups are never cached, so repository errors remain retryable and
 * concurrent callers still cross the underlying boundary independently.
 */
export function createOperationNameEntryRepository(
  delegate: NameEntryRepository,
  cache: OperationNameEntryCache,
  runActiveStep: OperationStepRunner,
): NameEntryRepository {
  const repository: NameEntryRepository = {
    async findByHanja(hanja: string): Promise<HanjaEntry | null> {
      return runActiveStep(async () => {
        if (cache.byHanja.has(hanja)) {
          return copyEntry(cache.byHanja.get(hanja) ?? null);
        }

        const resolved = await delegate.findByHanja(hanja);
        const snapshot = resolved === null ? null : snapshotEntry(resolved);
        cache.byHanja.set(hanja, snapshot);
        return copyEntry(snapshot);
      });
    },

    async findByHangul(hangul: string): Promise<HanjaEntry[]> {
      return runActiveStep(async () => {
        if (cache.byHangul.has(hangul)) {
          return copyEntries(cache.byHangul.get(hangul) ?? []);
        }

        const resolved = await delegate.findByHangul(hangul);
        const snapshot = snapshotEntries(resolved);
        cache.byHangul.set(hangul, snapshot);
        return copyEntries(snapshot);
      });
    },
  };

  if (delegate.findSurnamesByHangul) {
    repository.findSurnamesByHangul = async (hangul: string): Promise<HanjaEntry[]> => {
      return runActiveStep(async () => {
        if (cache.surnamesByHangul.has(hangul)) {
          return copyEntries(cache.surnamesByHangul.get(hangul) ?? []);
        }

        const resolved = await delegate.findSurnamesByHangul!(hangul);
        const snapshot = snapshotEntries(resolved);
        cache.surnamesByHangul.set(hangul, snapshot);
        return copyEntries(snapshot);
      });
    };
  }

  return Object.freeze(repository);
}
