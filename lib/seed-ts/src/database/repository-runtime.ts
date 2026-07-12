import initSqlJs, { type SqlJsStatic } from 'sql.js';
import {
  normalizeSha256Digest,
  verifySha256Digest,
} from './repository-artifact-integrity.js';

/** Pinned sql.js 1.14.0 browser artifact, verified against the npm package. */
export const DEFAULT_SQL_JS_WASM_URL =
  'https://cdn.jsdelivr.net/npm/sql.js@1.14.0/dist/sql-wasm.wasm';
export const DEFAULT_SQL_JS_WASM_SHA256 =
  '9125e039f90b91617b6327d6fe271865248a1ae36fa3857d022cd213c730f6f6';

export interface RepositoryFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface RepositoryFetchOptions {
  readonly signal?: AbortSignal;
}

export type RepositoryFetch = (
  url: string,
  options?: RepositoryFetchOptions,
) => Promise<RepositoryFetchResponse>;
export type SqlJsLoader = (
  wasmUrl: string,
  expectedSha256: string | null,
) => Promise<SqlJsStatic>;

export interface RepositoryRuntimeOverrides {
  readonly fetch?: RepositoryFetch;
  readonly initializeSqlJs?: SqlJsLoader;
}

export interface RepositoryWasmOptions extends RepositoryRuntimeOverrides {
  readonly wasmUrl?: string;
  readonly wasmSha256?: string;
}

export interface ResolvedRepositoryWasm {
  readonly url: string;
  readonly sha256: string | null;
}

export interface RepositoryRuntime {
  readonly fetch: RepositoryFetch;
  readonly initializeSqlJs: SqlJsLoader;
}

export class RepositoryConfigurationError extends Error {
  public readonly code = 'REPOSITORY_CONFIGURATION_INVALID';

  public constructor(message: string) {
    super(message);
    this.name = 'RepositoryConfigurationError';
  }
}

export class RepositoryIntegrityError extends Error {
  public readonly code = 'REPOSITORY_WASM_INTEGRITY_MISMATCH';
  public readonly expectedSha256: string;
  public readonly actualSha256: string;

  public constructor(expectedSha256: string, actualSha256: string) {
    super('The sql.js WASM artifact failed SHA-256 verification.');
    this.name = 'RepositoryIntegrityError';
    this.expectedSha256 = expectedSha256;
    this.actualSha256 = actualSha256;
  }
}

function normalizeSha256(value: string): string {
  return normalizeSha256Digest(
    value,
    () => new RepositoryConfigurationError(
      'wasmSha256 must be a 64-character hexadecimal SHA-256 digest.',
    ),
  );
}

export function resolveRepositoryWasm(
  options: RepositoryWasmOptions,
): ResolvedRepositoryWasm {
  if (!options.wasmUrl) {
    return {
      url: DEFAULT_SQL_JS_WASM_URL,
      sha256: options.wasmSha256
        ? normalizeSha256(options.wasmSha256)
        : DEFAULT_SQL_JS_WASM_SHA256,
    };
  }

  if (options.wasmSha256) {
    return {
      url: options.wasmUrl,
      sha256: normalizeSha256(options.wasmSha256),
    };
  }

  if (options.initializeSqlJs) {
    return { url: options.wasmUrl, sha256: null };
  }

  throw new RepositoryConfigurationError(
    'A custom wasmUrl requires wasmSha256 when using the default sql.js loader.',
  );
}

export function createRepositoryRuntime(
  overrides: RepositoryRuntimeOverrides = {},
): RepositoryRuntime {
  const fetch: RepositoryFetch = overrides.fetch
    ?? ((url, options) => globalThis.fetch(url, options));
  return {
    fetch,
    initializeSqlJs: overrides.initializeSqlJs ?? (async (wasmUrl, expectedSha256) => {
      if (!expectedSha256) {
        throw new RepositoryConfigurationError(
          'The default sql.js loader requires an expected WASM SHA-256 digest.',
        );
      }
      const response = await fetch(wasmUrl);
      if (!response.ok) {
        throw new Error(
          'Failed to fetch sql.js WASM: '
          + response.status + ' ' + response.statusText,
        );
      }
      const wasmBinary = await response.arrayBuffer();
      await verifySha256Digest(new Uint8Array(wasmBinary), expectedSha256, {
        cryptoUnavailable: () => new RepositoryConfigurationError(
          'Web Crypto SHA-256 support is required to initialize sql.js safely.',
        ),
        mismatch: (expected, actual) => new RepositoryIntegrityError(expected, actual),
      });
      return initSqlJs({ wasmBinary });
    }),
  };
}
