import {
  awaitActiveRepositoryStep,
  RepositoryLifecycleCoordinator,
  type RepositoryLifecycleLease,
} from '../../seed-ts/src/database/repository-lifecycle.js';
import { sha256Hex } from '../../seed-ts/src/database/repository-artifact-integrity.js';
import { assertRepositoryString } from '../../seed-ts/src/database/repository-query-validation.js';
import { resolveNameStatShardKey } from '../../seed-ts/src/utils/name-stat-shard.js';
import { NAME_STAT_SUMMARY_ASSET_PROVENANCE } from './name-stat-summary-asset.generated.js';
import {
  type NameStatSummaryAssetProvenance,
  type NameStatSummaryTuple,
  validateNameStatSummaryDocument,
} from './name-stat-summary-contract.js';
import type { NameStatSourceProjection } from './name-stat-projection.js';

export const NAME_STAT_SUMMARY_INTEGRITY_MISMATCH =
  'NAME_STAT_SUMMARY_INTEGRITY_MISMATCH' as const;

export type NameStatSummaryIntegrityReason =
  | 'crypto_unavailable'
  | 'compressed_byte_length_mismatch'
  | 'compressed_sha256_mismatch'
  | 'gzip_unavailable'
  | 'gzip_invalid'
  | 'canonical_byte_length_mismatch'
  | 'canonical_sha256_mismatch'
  | 'utf8_invalid'
  | 'json_invalid'
  | 'contract_invalid'
  | 'canonical_format_mismatch';

export type NameStatSummaryIntegrityValue = string | number | null;

export class NameStatSummaryIntegrityError extends Error {
  public readonly code = NAME_STAT_SUMMARY_INTEGRITY_MISMATCH;
  public readonly retryable = false;

  public constructor(
    public readonly reason: NameStatSummaryIntegrityReason,
    public readonly expected: NameStatSummaryIntegrityValue,
    public readonly actual: NameStatSummaryIntegrityValue,
  ) {
    super(`NameStat summary asset failed integrity verification: ${reason}.`);
    this.name = 'NameStatSummaryIntegrityError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface NameStatSummaryRepositoryRuntime {
  readonly readAsset: (
    url: URL,
    signal: AbortSignal,
  ) => Promise<Uint8Array>;
  readonly gunzip: (bytes: Uint8Array) => Promise<Uint8Array>;
  readonly sha256: (bytes: Uint8Array) => Promise<string>;
}

export interface NameStatSummaryRepositoryOptions {
  readonly assetUrl?: URL;
  readonly provenance?: NameStatSummaryAssetProvenance;
  readonly runtime?: Partial<NameStatSummaryRepositoryRuntime>;
}

const DEFAULT_ASSET_URL =
  new URL('../data/name-stat/name-stat-summary.v1.bin', import.meta.url);

function integrityError(
  reason: NameStatSummaryIntegrityReason,
  expected: NameStatSummaryIntegrityValue,
  actual: NameStatSummaryIntegrityValue,
): NameStatSummaryIntegrityError {
  return new NameStatSummaryIntegrityError(reason, expected, actual);
}

function assertByteArray(value: unknown): Uint8Array {
  if (!(value instanceof Uint8Array)) {
    throw new TypeError('NameStat summary runtime must return Uint8Array bytes.');
  }
  return value;
}

async function readLocalAsset(url: URL, signal: AbortSignal): Promise<Uint8Array> {
  const moduleName = 'node:fs/promises';
  const fileSystem = await import(/* @vite-ignore */ moduleName) as {
    readFile(
      path: URL,
      options: { readonly signal: AbortSignal },
    ): Promise<Uint8Array>;
  };
  return assertByteArray(await fileSystem.readFile(url, { signal })).slice();
}

async function readBoundedHttpAsset(
  response: Response,
  signal: AbortSignal,
  expectedByteLength: number,
): Promise<Uint8Array> {
  const declaredLength = response.headers.get('content-length');
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (
      !Number.isSafeInteger(parsedLength)
      || parsedLength < 0
      || parsedLength !== expectedByteLength
    ) {
      try {
        await response.body?.cancel();
      } catch {
        // Preserve the integrity failure even when a transport rejects cancel.
      }
      throw integrityError(
        'compressed_byte_length_mismatch',
        expectedByteLength,
        Number.isSafeInteger(parsedLength) && parsedLength >= 0
          ? parsedLength
          : declaredLength,
      );
    }
  }

  if (!response.body) {
    throw integrityError(
      'compressed_byte_length_mismatch',
      expectedByteLength,
      0,
    );
  }

  const reader = response.body.getReader();
  const bytes = new Uint8Array(expectedByteLength);
  let receivedByteLength = 0;
  let readerCancelled = false;
  const cancelReader = (reason?: unknown): Promise<void> => {
    if (readerCancelled) return Promise.resolve();
    readerCancelled = true;
    return reader.cancel(reason).then(() => undefined, () => undefined);
  };
  const onAbort = (): void => {
    void cancelReader(signal.reason);
  };

  signal.addEventListener('abort', onAbort, { once: true });
  try {
    if (signal.aborted) {
      await cancelReader(signal.reason);
      throw signal.reason ?? new Error('NameStat summary asset read was aborted.');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (signal.aborted) {
        await cancelReader(signal.reason);
        throw signal.reason ?? new Error('NameStat summary asset read was aborted.');
      }
      if (done) break;
      if (!value || value.byteLength === 0) continue;

      const nextByteLength = receivedByteLength + value.byteLength;
      if (nextByteLength > expectedByteLength) {
        await cancelReader();
        throw integrityError(
          'compressed_byte_length_mismatch',
          expectedByteLength,
          nextByteLength,
        );
      }
      bytes.set(value, receivedByteLength);
      receivedByteLength = nextByteLength;
    }
  } finally {
    signal.removeEventListener('abort', onAbort);
    reader.releaseLock();
  }

  if (receivedByteLength !== expectedByteLength) {
    throw integrityError(
      'compressed_byte_length_mismatch',
      expectedByteLength,
      receivedByteLength,
    );
  }
  return bytes;
}

async function readDefaultAsset(
  url: URL,
  signal: AbortSignal,
  expectedByteLength: number,
): Promise<Uint8Array> {
  if (url.protocol === 'file:') {
    return readLocalAsset(url, signal);
  }
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`NameStat summary request failed with HTTP ${response.status}.`);
  }
  return readBoundedHttpAsset(response, signal, expectedByteLength);
}

async function gunzipDefault(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof globalThis.DecompressionStream !== 'function') {
    throw integrityError(
      'gzip_unavailable',
      'DecompressionStream gzip support',
      null,
    );
  }
  const input = new Blob([bytes.slice()]);
  const stream = input
    .stream()
    .pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function sha256Default(bytes: Uint8Array): Promise<string> {
  return sha256Hex(
    bytes,
    () => integrityError(
      'crypto_unavailable',
      'Web Crypto SHA-256 support',
      null,
    ),
  );
}

function createRuntime(
  overrides: Partial<NameStatSummaryRepositoryRuntime> | undefined,
  expectedCompressedByteLength: number,
): NameStatSummaryRepositoryRuntime {
  return Object.freeze({
    readAsset: overrides?.readAsset
      ?? ((url: URL, signal: AbortSignal) => readDefaultAsset(
        url,
        signal,
        expectedCompressedByteLength,
      )),
    gunzip: overrides?.gunzip ?? gunzipDefault,
    sha256: overrides?.sha256 ?? sha256Default,
  });
}

function assertByteLength(
  bytes: Uint8Array,
  expected: number,
  reason:
    | 'compressed_byte_length_mismatch'
    | 'canonical_byte_length_mismatch',
): void {
  if (bytes.byteLength !== expected) {
    throw integrityError(reason, expected, bytes.byteLength);
  }
}

async function assertSha256(
  bytes: Uint8Array,
  expected: string,
  reason:
    | 'compressed_sha256_mismatch'
    | 'canonical_sha256_mismatch',
  runtime: NameStatSummaryRepositoryRuntime,
): Promise<void> {
  const actual = await runtime.sha256(bytes);
  if (actual !== expected) {
    throw integrityError(reason, expected, actual);
  }
}

function decodeUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes);
  } catch {
    throw integrityError('utf8_invalid', 'strict UTF-8', null);
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw integrityError('json_invalid', 'valid JSON', null);
  }
}

function projectionFromTuple(
  tuple: NameStatSummaryTuple,
): NameStatSourceProjection {
  return {
    popularityRank: tuple[0],
    maleBirths: tuple[1],
    femaleBirths: tuple[2],
  };
}

async function loadVerifiedEntries(
  bytes: Uint8Array,
  provenance: NameStatSummaryAssetProvenance,
  runtime: NameStatSummaryRepositoryRuntime,
  assertActive: () => void,
  signal: AbortSignal,
): Promise<Readonly<Record<string, NameStatSummaryTuple>>> {
  assertByteLength(
    bytes,
    provenance.compressedByteLength,
    'compressed_byte_length_mismatch',
  );
  await awaitActiveRepositoryStep(
    () => assertSha256(
      bytes,
      provenance.compressedSha256,
      'compressed_sha256_mismatch',
      runtime,
    ),
    assertActive,
    signal,
  );

  let canonicalBytes: Uint8Array;
  try {
    canonicalBytes = await awaitActiveRepositoryStep(
      async () => assertByteArray(await runtime.gunzip(bytes)).slice(),
      assertActive,
      signal,
    );
  } catch (error) {
    // A lifecycle change must win over a decompressor error or a late result.
    assertActive();
    if (error instanceof NameStatSummaryIntegrityError) throw error;
    throw integrityError('gzip_invalid', 'valid gzip data', null);
  }
  assertByteLength(
    canonicalBytes,
    provenance.canonicalJsonByteLength,
    'canonical_byte_length_mismatch',
  );
  await awaitActiveRepositoryStep(
    () => assertSha256(
      canonicalBytes,
      provenance.canonicalJsonSha256,
      'canonical_sha256_mismatch',
      runtime,
    ),
    assertActive,
    signal,
  );

  const text = decodeUtf8(canonicalBytes);
  const parsed = parseJson(text);
  let document;
  try {
    document = validateNameStatSummaryDocument(parsed, {
      expectedRowCount: provenance.rowCount,
      expectedSourceAssetSetSha256: provenance.sourceAssetSetSha256,
    });
  } catch {
    // The contract error path may contain a name from the asset. Do not retain
    // it as a public cause or message.
    throw integrityError('contract_invalid', 'canonical NameStat summary', null);
  }
  if (`${JSON.stringify(document)}\n` !== text) {
    throw integrityError(
      'canonical_format_mismatch',
      provenance.canonicalization,
      null,
    );
  }

  return document.entries;
}

/**
 * Browser and Node-compatible compact NameStat lookup repository.
 *
 * The complete asset is authenticated before decompression. Parsed values are
 * retained in a repository-owned private record, and callers receive fresh
 * projections so external mutation cannot affect later lookups.
 */
export class NameStatSummaryRepository {
  private readonly assetUrl: URL;
  private readonly provenance: NameStatSummaryAssetProvenance;
  private readonly runtime: NameStatSummaryRepositoryRuntime;
  private readonly lifecycle = new RepositoryLifecycleCoordinator();
  private entriesByName: Readonly<Record<string, NameStatSummaryTuple>> | null = null;
  private loadPromise: Promise<void> | null = null;

  public constructor(options: NameStatSummaryRepositoryOptions = {}) {
    this.provenance = options.provenance ?? NAME_STAT_SUMMARY_ASSET_PROVENANCE;
    this.assetUrl = this.versionedAssetUrl(
      new URL(options.assetUrl ?? DEFAULT_ASSET_URL),
      this.provenance.compressedSha256,
    );
    this.runtime = createRuntime(
      options.runtime,
      this.provenance.compressedByteLength,
    );
  }

  private versionedAssetUrl(url: URL, compressedSha256: string): URL {
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      url.searchParams.set('v', compressedSha256);
    }
    return url;
  }

  private cancellationError(): Error {
    return new Error('NameStatSummaryRepository initialization was cancelled by close().');
  }

  private assertActive(generation: number): void {
    this.lifecycle.assertActive(generation, () => this.cancellationError());
  }

  public init(): Promise<void> {
    // Match the previous sharded repository contract: engine initialization
    // establishes repository readiness but NameStat bytes remain lazy until
    // the first actual lookup.
    return Promise.resolve();
  }

  private ensureLoaded(): Promise<void> {
    if (this.entriesByName) return Promise.resolve();
    if (this.loadPromise) return this.loadPromise;

    const lease = this.lifecycle.beginLease();
    let trackedPromise: Promise<void>;
    trackedPromise = this.load(lease)
      .then((entries) => {
        this.assertActive(lease.generation);
        this.entriesByName = entries;
      })
      .finally(() => {
        lease.release();
        if (this.loadPromise === trackedPromise) {
          this.loadPromise = null;
        }
      });
    this.loadPromise = trackedPromise;
    return trackedPromise;
  }

  private async load(
    lease: RepositoryLifecycleLease,
  ): Promise<Readonly<Record<string, NameStatSummaryTuple>>> {
    const { generation, signal } = lease;
    const assertActive = (): void => this.assertActive(generation);
    const borrowedBytes = await awaitActiveRepositoryStep(
      () => this.runtime.readAsset(this.assetUrl, signal),
      assertActive,
      signal,
    );
    // Snapshot injected/fetched bytes before the asynchronous digest boundary
    // so a caller cannot mutate the authenticated payload in place.
    const bytes = assertByteArray(borrowedBytes).slice();
    return loadVerifiedEntries(
      bytes,
      this.provenance,
      this.runtime,
      assertActive,
      signal,
    );
  }

  public async findByName(name: string): Promise<NameStatSourceProjection | null> {
    const generation = this.lifecycle.currentGeneration;
    const normalizedName = assertRepositoryString(name, {
      repository: 'name-stat',
      path: 'name',
      maximumLength: 64,
    });
    if (!resolveNameStatShardKey(normalizedName)) return null;
    await this.ensureLoaded();
    this.assertActive(generation);

    const entries = this.entriesByName;
    if (!entries || !Object.hasOwn(entries, normalizedName)) return null;
    return projectionFromTuple(entries[normalizedName]);
  }

  public close(): void {
    const cancellation = this.lifecycle.beginCancellation();
    this.entriesByName = null;
    this.loadPromise = null;
    const closeErrors = cancellation.abortAll(this.cancellationError());
    if (closeErrors.length > 0) {
      throw new AggregateError(
        closeErrors,
        'NameStatSummaryRepository failed to cancel one or more asset reads.',
      );
    }
  }
}
