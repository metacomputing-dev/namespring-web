import initSqlJs, { type SqlJsStatic } from 'sql.js';
import {
  normalizeSha256Digest,
  verifySha256Digest,
} from './repository-artifact-integrity.js';

/** Bundled sql.js browser artifact, verified against the exact npm package. */
export const DEFAULT_SQL_JS_VERSION = '1.14.1' as const;
export const DEFAULT_SQL_JS_WASM_BYTE_LENGTH = 659_730;
export const DEFAULT_SQL_JS_WASM_URL = new URL(
  '../../assets/sql-wasm-1.14.1.wasm',
  import.meta.url,
).href;
export const DEFAULT_SQL_JS_WASM_SHA256 =
  '438c88f666dc054ce4e9395f80fe9db4218b1a3c379960454880f048a7898aed';

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

const defaultSqlJsInitializationByArtifact = new Map<string, Promise<SqlJsStatic>>();

interface NodeFileSystemPromises {
  readFile(
    path: URL,
    options?: { readonly signal?: AbortSignal },
  ): Promise<Uint8Array>;
}

function isNodeRuntime(): boolean {
  const nodeGlobal = globalThis as typeof globalThis & {
    readonly process?: { readonly versions?: { readonly node?: string } };
  };
  return typeof nodeGlobal.process?.versions?.node === 'string';
}

async function readNodeFile(
  url: string,
  signal?: AbortSignal,
): Promise<RepositoryFetchResponse> {
  // Keep this as a variable specifier. Browser bundlers must not resolve or
  // include the Node builtin; Vite leaves the guarded branch for Node only.
  const nodeFileSystemPromisesSpecifier = ['node', 'fs/promises'].join(':');
  const nodeFileSystem = await import(
    /* @vite-ignore */ nodeFileSystemPromisesSpecifier
  ) as NodeFileSystemPromises;
  const bytes = Uint8Array.from(
    await nodeFileSystem.readFile(new URL(url), signal ? { signal } : undefined),
  );
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    arrayBuffer: async () => bytes.slice().buffer,
  };
}

const defaultRepositoryFetch: RepositoryFetch = (url, options) => {
  const protocol = (() => {
    try {
      return new URL(url).protocol;
    } catch {
      return null;
    }
  })();
  if (protocol === 'file:' && isNodeRuntime()) {
    return readNodeFile(url, options?.signal);
  }
  return globalThis.fetch(url, options);
};

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

async function initializeVerifiedSqlJs(
  fetch: RepositoryFetch,
  wasmUrl: string,
  expectedSha256: string | null,
): Promise<SqlJsStatic> {
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
  const fetchedWasmBinary = await response.arrayBuffer();
  // A fetch implementation may retain and later mutate the returned buffer.
  // Own one snapshot and use that exact snapshot for both verification and
  // execution so verified bytes cannot be swapped before sql.js compiles them.
  const wasmBytes = new Uint8Array(fetchedWasmBinary).slice();
  const wasmBinary = wasmBytes.buffer;
  if (
    wasmUrl === DEFAULT_SQL_JS_WASM_URL
    && wasmBinary.byteLength !== DEFAULT_SQL_JS_WASM_BYTE_LENGTH
  ) {
    throw new Error(
      'Bundled sql.js WASM byte length mismatch: expected '
      + DEFAULT_SQL_JS_WASM_BYTE_LENGTH
      + ', received '
      + wasmBinary.byteLength
      + '.',
    );
  }
  await verifySha256Digest(wasmBytes, expectedSha256, {
    cryptoUnavailable: () => new RepositoryConfigurationError(
      'Web Crypto SHA-256 support is required to initialize sql.js safely.',
    ),
    mismatch: (expected, actual) => new RepositoryIntegrityError(expected, actual),
  });
  return initSqlJs({ wasmBinary });
}

function initializeDefaultSqlJs(
  wasmUrl: string,
  expectedSha256: string | null,
): Promise<SqlJsStatic> {
  if (!expectedSha256) {
    return Promise.reject(new RepositoryConfigurationError(
      'The default sql.js loader requires an expected WASM SHA-256 digest.',
    ));
  }
  const key = JSON.stringify([wasmUrl, expectedSha256]);
  const cached = defaultSqlJsInitializationByArtifact.get(key);
  if (cached) return cached;

  let trackedPromise: Promise<SqlJsStatic>;
  trackedPromise = initializeVerifiedSqlJs(
    defaultRepositoryFetch,
    wasmUrl,
    expectedSha256,
  ).catch((error: unknown) => {
    if (defaultSqlJsInitializationByArtifact.get(key) === trackedPromise) {
      defaultSqlJsInitializationByArtifact.delete(key);
    }
    throw error;
  });
  defaultSqlJsInitializationByArtifact.set(key, trackedPromise);
  return trackedPromise;
}

export function createRepositoryRuntime(
  overrides: RepositoryRuntimeOverrides = {},
): RepositoryRuntime {
  const fetch = overrides.fetch ?? defaultRepositoryFetch;
  const initializeSqlJsOverride = overrides.initializeSqlJs;
  const initializeSqlJs = initializeSqlJsOverride
    ?? (overrides.fetch
      ? (wasmUrl: string, expectedSha256: string | null) =>
          initializeVerifiedSqlJs(fetch, wasmUrl, expectedSha256)
      : initializeDefaultSqlJs);
  return {
    fetch,
    initializeSqlJs,
  };
}
