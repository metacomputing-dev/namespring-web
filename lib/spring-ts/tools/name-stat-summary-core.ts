import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import initSqlJs from 'sql.js';

import type { DatabaseAssetManifestEntry } from '../../seed-ts/src/database/database-asset-contract.js';
import { NAME_STAT_DATABASE_ASSETS } from '../../seed-ts/src/database/database-asset-registry.js';
import {
  verifyOpenedRepositoryDatabase,
  verifyRepositoryDatabaseBytesBeforeOpen,
} from '../../seed-ts/src/database/database-integrity.js';
import {
  decodeNameStatRow,
  type NameStatEntry,
} from '../../seed-ts/src/database/name-stat-row.js';
import { resolveNameStatShardKey } from '../../seed-ts/src/utils/name-stat-shard.js';
import {
  NAME_STAT_SOURCE_ASSET_SET_SCHEMA_VERSION,
  NAME_STAT_SUMMARY_CANONICALIZATION,
  NAME_STAT_SUMMARY_EXPECTED_ROW_COUNT,
  NAME_STAT_SUMMARY_SCHEMA_VERSION,
  type NameStatSummaryAssetProvenance,
  type NameStatSummaryDocument,
  type NameStatSummaryTuple,
  validateNameStatSummaryDocument,
  validateNameStatSummaryTuple,
} from '../src/name-stat-summary-contract.js';
import {
  projectNameStatEntry,
  type NameStatSourceProjection,
} from '../src/name-stat-projection.js';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPOSITORY_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
const SQL_WASM_PATH = path.resolve(
  PACKAGE_ROOT,
  'node_modules',
  'sql.js',
  'dist',
  'sql-wasm.wasm',
);

export const NAME_STAT_SUMMARY_ASSET_PACKAGE_RELATIVE_PATH =
  'data/name-stat/name-stat-summary.v1.json.gz' as const;
export const NAME_STAT_SUMMARY_ASSET_PATH = path.resolve(
  PACKAGE_ROOT,
  ...NAME_STAT_SUMMARY_ASSET_PACKAGE_RELATIVE_PATH.split('/'),
);
export const NAME_STAT_SUMMARY_GENERATED_MODULE_PATH = path.resolve(
  PACKAGE_ROOT,
  'src',
  'name-stat-summary-asset.generated.ts',
);

const EXPECTED_SOURCE_ASSET_COUNT = 14;
const GZIP_HEADER = Buffer.from('1f8b08000000000002ff', 'hex');
const GZIP_CANONICALIZATION =
  'RFC 1952 gzip level 9 with FLG=0, MTIME=0, XFL=2, and OS=255';
const EMPTY_STAT_NAME = '\uAE30\uD0C0';
const TOTAL_BUCKET = '\uC804\uCCB4';

export interface NameStatSummaryAudit {
  readonly sourceAssetCount: number;
  readonly rowCount: number;
  readonly uniqueNameCount: number;
  readonly rankedEntryCount: number;
  readonly tiedRankMemberCount: number;
  readonly uniqueRankMemberCount: number;
  readonly positiveGenderTieCount: number;
  readonly allGenderTieCount: number;
  readonly totalBirthMismatchCount: number;
  readonly fractionalRankCount: number;
  readonly maximumPopularityRank: number;
}

export interface NameStatSummaryBuild {
  readonly document: NameStatSummaryDocument;
  readonly canonicalJsonBytes: Buffer;
  readonly sourceAssetSetSha256: string;
  readonly audit: NameStatSummaryAudit;
}

export interface VerifiedNameStatSummaryArtifact {
  readonly provenance: NameStatSummaryAssetProvenance;
  readonly compressedBytes: Buffer;
  readonly document: NameStatSummaryDocument;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function assetPath(contract: DatabaseAssetManifestEntry): string {
  return path.resolve(REPOSITORY_ROOT, ...contract.relativePath.split('/'));
}

function sourceAssetSetDocument(
  assets: readonly DatabaseAssetManifestEntry[],
): object {
  return {
    schemaVersion: NAME_STAT_SOURCE_ASSET_SET_SCHEMA_VERSION,
    assets: assets.map((asset) => ({
      assetId: asset.assetId,
      relativePath: asset.relativePath,
      byteLength: asset.byteLength,
      sha256: asset.sha256,
      userVersion: asset.userVersion,
      schemaContractVersion: asset.schemaContractVersion,
      schemaContractSha256: asset.schemaContractSha256,
      table: asset.table,
      rowCount: asset.rowCount,
      shardKey: asset.shardKey,
    })),
  };
}

export function computeNameStatSourceAssetSetSha256(
  assets: readonly DatabaseAssetManifestEntry[] = NAME_STAT_DATABASE_ASSETS,
): string {
  return sha256(JSON.stringify(sourceAssetSetDocument(assets)));
}

function assertCanonicalSourceAssetSet(
  assets: readonly DatabaseAssetManifestEntry[],
): void {
  if (assets.length !== EXPECTED_SOURCE_ASSET_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_SOURCE_ASSET_COUNT} NameStat source assets, received ${assets.length}.`,
    );
  }
  const assetIds = new Set<string>();
  const shardKeys = new Set<string>();
  let manifestRows = 0;
  for (const asset of assets) {
    if (assetIds.has(asset.assetId)) {
      throw new Error(`NameStat source assetId is duplicated: ${asset.assetId}.`);
    }
    assetIds.add(asset.assetId);
    if (typeof asset.shardKey !== 'string' || asset.shardKey.length === 0) {
      throw new Error(`NameStat source ${asset.assetId} has no shard key.`);
    }
    if (shardKeys.has(asset.shardKey)) {
      throw new Error(`NameStat source shard key is duplicated: ${asset.shardKey}.`);
    }
    shardKeys.add(asset.shardKey);
    manifestRows += asset.rowCount;
  }
  if (manifestRows !== NAME_STAT_SUMMARY_EXPECTED_ROW_COUNT) {
    throw new Error(
      `NameStat source manifest must contain ${NAME_STAT_SUMMARY_EXPECTED_ROW_COUNT} rows, received ${manifestRows}.`,
    );
  }
}

export function addNameStatSummaryProjection(
  projectionsByName: Map<string, NameStatSourceProjection>,
  name: string,
  projection: NameStatSourceProjection,
): void {
  if (name.length === 0 || name.normalize('NFC') !== name) {
    throw new Error('NameStat source names must be non-empty NFC strings.');
  }
  if (projectionsByName.has(name)) {
    throw new Error(`NameStat source contains duplicate name ${JSON.stringify(name)}.`);
  }
  validateNameStatSummaryTuple(
    [projection.popularityRank, projection.maleBirths, projection.femaleBirths],
    `source.${name}`,
  );
  projectionsByName.set(name, Object.freeze({ ...projection }));
}

function sumBucket(bucket: Readonly<Record<string, number>> | undefined): number {
  if (!bucket) return 0;
  return Object.values(bucket).reduce((sum, value) => sum + value, 0);
}

function scanAudit(
  projectionsByName: ReadonlyMap<string, NameStatSourceProjection>,
  totalBirthMismatchCount: number,
): NameStatSummaryAudit {
  const rankFrequencies = new Map<number, number>();
  let rankedEntryCount = 0;
  let positiveGenderTieCount = 0;
  let allGenderTieCount = 0;
  let fractionalRankCount = 0;
  let maximumPopularityRank = 0;

  for (const projection of projectionsByName.values()) {
    if (projection.popularityRank !== null) {
      rankedEntryCount += 1;
      rankFrequencies.set(
        projection.popularityRank,
        (rankFrequencies.get(projection.popularityRank) ?? 0) + 1,
      );
      if (!Number.isInteger(projection.popularityRank)) fractionalRankCount += 1;
      maximumPopularityRank = Math.max(
        maximumPopularityRank,
        projection.popularityRank,
      );
    }
    if (projection.maleBirths === projection.femaleBirths) {
      allGenderTieCount += 1;
      if (projection.maleBirths > 0) positiveGenderTieCount += 1;
    }
  }

  let tiedRankMemberCount = 0;
  let uniqueRankMemberCount = 0;
  for (const frequency of rankFrequencies.values()) {
    if (frequency > 1) tiedRankMemberCount += frequency;
    else uniqueRankMemberCount += 1;
  }

  return Object.freeze({
    sourceAssetCount: NAME_STAT_DATABASE_ASSETS.length,
    rowCount: projectionsByName.size,
    uniqueNameCount: projectionsByName.size,
    rankedEntryCount,
    tiedRankMemberCount,
    uniqueRankMemberCount,
    positiveGenderTieCount,
    allGenderTieCount,
    totalBirthMismatchCount,
    fractionalRankCount,
    maximumPopularityRank,
  });
}

function assertExpectedAudit(audit: NameStatSummaryAudit): void {
  const expected: NameStatSummaryAudit = {
    sourceAssetCount: 14,
    rowCount: 50_194,
    uniqueNameCount: 50_194,
    rankedEntryCount: 50_193,
    tiedRankMemberCount: 50_029,
    uniqueRankMemberCount: 164,
    positiveGenderTieCount: 1_164,
    allGenderTieCount: 1_165,
    totalBirthMismatchCount: 175,
    fractionalRankCount: 0,
    maximumPopularityRank: 8_057,
  };
  for (const key of Object.keys(expected) as Array<keyof NameStatSummaryAudit>) {
    if (audit[key] !== expected[key]) {
      throw new Error(
        `NameStat audit ${key} changed: expected ${expected[key]}, received ${audit[key]}.`,
      );
    }
  }
}

function buildDocument(
  projectionsByName: ReadonlyMap<string, NameStatSourceProjection>,
  sourceAssetSetSha256: string,
): NameStatSummaryDocument {
  const entries: Record<string, NameStatSummaryTuple> = Object.create(null);
  const sorted = [...projectionsByName.entries()]
    .sort(([left], [right]) => compareText(left, right));
  for (const [name, projection] of sorted) {
    entries[name] = Object.freeze([
      projection.popularityRank,
      projection.maleBirths,
      projection.femaleBirths,
    ]);
  }
  const document: NameStatSummaryDocument = {
    schemaVersion: NAME_STAT_SUMMARY_SCHEMA_VERSION,
    sourceAssetSetSha256,
    rowCount: sorted.length,
    entries,
  };
  return validateNameStatSummaryDocument(document, {
    expectedSourceAssetSetSha256: sourceAssetSetSha256,
  });
}

function canonicalJsonBytes(document: NameStatSummaryDocument): Buffer {
  return Buffer.from(`${JSON.stringify(document)}\n`, 'utf8');
}

export function createDeterministicGzip(canonicalBytes: Uint8Array): Buffer {
  const compressed = Buffer.from(gzipSync(canonicalBytes, { level: 9 }));
  if (compressed.length < GZIP_HEADER.length) {
    throw new Error('NameStat gzip output is shorter than its required header.');
  }
  compressed.fill(0, 4, 8);
  compressed[9] = 0xff;
  if (!compressed.subarray(0, GZIP_HEADER.length).equals(GZIP_HEADER)) {
    throw new Error('NameStat gzip header did not match the canonical contract.');
  }
  if (!Buffer.from(gunzipSync(compressed)).equals(Buffer.from(canonicalBytes))) {
    throw new Error('NameStat gzip round-trip changed canonical JSON bytes.');
  }
  return compressed;
}

export function assertDeterministicGzipBytes(
  canonicalBytes: Uint8Array,
  compressedBytes: Uint8Array,
): void {
  const expected = createDeterministicGzip(canonicalBytes);
  if (!Buffer.from(compressedBytes).equals(expected)) {
    throw new Error(
      'NameStat summary gzip bytes are not the deterministic level-9 artifact.',
    );
  }
}

async function scanSourceAssets(): Promise<{
  readonly projectionsByName: Map<string, NameStatSourceProjection>;
  readonly totalBirthMismatchCount: number;
}> {
  assertCanonicalSourceAssetSet(NAME_STAT_DATABASE_ASSETS);
  const SQL = await initSqlJs({ locateFile: () => SQL_WASM_PATH });
  const projectionsByName = new Map<string, NameStatSourceProjection>();
  let totalBirthMismatchCount = 0;

  for (const contract of NAME_STAT_DATABASE_ASSETS) {
    const bytes = fs.readFileSync(assetPath(contract));
    await verifyRepositoryDatabaseBytesBeforeOpen(bytes, contract);
    const db = new SQL.Database(bytes);
    let statement: ReturnType<typeof db.prepare> | null = null;
    try {
      await verifyOpenedRepositoryDatabase(db, contract);
      statement = db.prepare(
        `SELECT * FROM ${quoteIdentifier(contract.table)} ORDER BY ${quoteIdentifier('id')}`,
      );
      let scannedRows = 0;
      while (statement.step()) {
        const row = statement.getAsObject();
        if (typeof row.name !== 'string') {
          throw new Error(`${contract.assetId} row ${scannedRows} has no string name.`);
        }
        const entry: NameStatEntry = decodeNameStatRow(row, row.name);
        if (resolveNameStatShardKey(entry.name) !== contract.shardKey) {
          throw new Error(
            `${contract.assetId} contains a name routed to another shard.`,
          );
        }
        const projection = projectNameStatEntry(entry);
        addNameStatSummaryProjection(projectionsByName, entry.name, projection);
        const sourceTotal = sumBucket(entry.yearly_birth[TOTAL_BUCKET]);
        if (sourceTotal !== projection.maleBirths + projection.femaleBirths) {
          totalBirthMismatchCount += 1;
        }
        scannedRows += 1;
      }
      if (scannedRows !== contract.rowCount) {
        throw new Error(
          `${contract.assetId} scan count changed: expected ${contract.rowCount}, received ${scannedRows}.`,
        );
      }
    } finally {
      try {
        statement?.free();
      } finally {
        db.close();
      }
    }
  }

  return { projectionsByName, totalBirthMismatchCount };
}

export async function collectNameStatSummary(): Promise<NameStatSummaryBuild> {
  const sourceAssetSetSha256 = computeNameStatSourceAssetSetSha256();
  const { projectionsByName, totalBirthMismatchCount } = await scanSourceAssets();
  const audit = scanAudit(projectionsByName, totalBirthMismatchCount);
  assertExpectedAudit(audit);
  const document = buildDocument(projectionsByName, sourceAssetSetSha256);
  const emptyTuple = document.entries[EMPTY_STAT_NAME];
  if (JSON.stringify(emptyTuple) !== '[null,0,0]') {
    throw new Error('NameStat empty-stat sentinel must remain [null,0,0].');
  }
  return Object.freeze({
    document,
    canonicalJsonBytes: canonicalJsonBytes(document),
    sourceAssetSetSha256,
    audit,
  });
}

function provenanceFor(
  build: NameStatSummaryBuild,
  compressedBytes: Uint8Array,
): NameStatSummaryAssetProvenance {
  return Object.freeze({
    schemaVersion: NAME_STAT_SUMMARY_SCHEMA_VERSION,
    assetSourceRelativePath: NAME_STAT_SUMMARY_ASSET_PACKAGE_RELATIVE_PATH,
    sourceAssetSetSha256: build.sourceAssetSetSha256,
    rowCount: build.document.rowCount,
    canonicalJsonByteLength: build.canonicalJsonBytes.byteLength,
    canonicalJsonSha256: sha256(build.canonicalJsonBytes),
    compressedByteLength: compressedBytes.byteLength,
    compressedSha256: sha256(compressedBytes),
    canonicalization: NAME_STAT_SUMMARY_CANONICALIZATION,
    gzipCanonicalization: GZIP_CANONICALIZATION,
  });
}

export function renderNameStatSummaryGeneratedModule(
  provenance: NameStatSummaryAssetProvenance,
): string {
  return [
    '/* This file is generated. Run: npm run generate:name-stat-summary */',
    '',
    "import type { NameStatSummaryAssetProvenance } from './name-stat-summary-contract.js';",
    '',
    'export const NAME_STAT_SUMMARY_ASSET_PROVENANCE = Object.freeze({',
    `  schemaVersion: ${JSON.stringify(provenance.schemaVersion)},`,
    `  assetSourceRelativePath: ${JSON.stringify(provenance.assetSourceRelativePath)},`,
    `  sourceAssetSetSha256: ${JSON.stringify(provenance.sourceAssetSetSha256)},`,
    `  rowCount: ${provenance.rowCount},`,
    `  canonicalJsonByteLength: ${provenance.canonicalJsonByteLength},`,
    `  canonicalJsonSha256: ${JSON.stringify(provenance.canonicalJsonSha256)},`,
    `  compressedByteLength: ${provenance.compressedByteLength},`,
    `  compressedSha256: ${JSON.stringify(provenance.compressedSha256)},`,
    `  canonicalization: ${JSON.stringify(provenance.canonicalization)},`,
    `  gzipCanonicalization: ${JSON.stringify(provenance.gzipCanonicalization)},`,
    '}) satisfies NameStatSummaryAssetProvenance;',
    '',
  ].join('\n');
}

function parseCanonicalDocument(bytes: Uint8Array): NameStatSummaryDocument {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (!text.endsWith('\n') || text.slice(0, -1).includes('\n')) {
    throw new Error('NameStat canonical JSON must contain exactly one trailing LF.');
  }
  const parsed = JSON.parse(text) as unknown;
  const document = validateNameStatSummaryDocument(parsed);
  if (`${JSON.stringify(document)}\n` !== text) {
    throw new Error('NameStat summary JSON is not in canonical byte form.');
  }
  return document;
}

function assertDocumentParity(
  source: NameStatSummaryDocument,
  committed: NameStatSummaryDocument,
): void {
  if (source.sourceAssetSetSha256 !== committed.sourceAssetSetSha256) {
    throw new Error('NameStat summary source asset-set SHA is stale.');
  }
  const sourceNames = Object.keys(source.entries);
  const committedNames = Object.keys(committed.entries);
  if (sourceNames.length !== committedNames.length) {
    throw new Error('NameStat summary key count is stale.');
  }
  for (let index = 0; index < sourceNames.length; index += 1) {
    const sourceName = sourceNames[index];
    const committedName = committedNames[index];
    if (sourceName !== committedName) {
      throw new Error(`NameStat summary key set diverged at index ${index}.`);
    }
    if (
      JSON.stringify(source.entries[sourceName])
      !== JSON.stringify(committed.entries[committedName])
    ) {
      throw new Error(
        `NameStat summary tuple is stale for ${JSON.stringify(sourceName)}.`,
      );
    }
  }
}

export function writeNameStatSummaryArtifact(
  build: NameStatSummaryBuild,
): VerifiedNameStatSummaryArtifact {
  const compressedBytes = createDeterministicGzip(build.canonicalJsonBytes);
  const provenance = provenanceFor(build, compressedBytes);
  fs.mkdirSync(path.dirname(NAME_STAT_SUMMARY_ASSET_PATH), { recursive: true });
  fs.writeFileSync(NAME_STAT_SUMMARY_ASSET_PATH, compressedBytes);
  fs.writeFileSync(
    NAME_STAT_SUMMARY_GENERATED_MODULE_PATH,
    renderNameStatSummaryGeneratedModule(provenance),
    'utf8',
  );
  return { provenance, compressedBytes, document: build.document };
}

export function verifyCommittedNameStatSummaryArtifact(
  build: NameStatSummaryBuild,
): VerifiedNameStatSummaryArtifact {
  if (!fs.existsSync(NAME_STAT_SUMMARY_ASSET_PATH)) {
    throw new Error('NameStat summary gzip asset is missing.');
  }
  if (!fs.existsSync(NAME_STAT_SUMMARY_GENERATED_MODULE_PATH)) {
    throw new Error('NameStat summary generated provenance module is missing.');
  }
  const compressedBytes = fs.readFileSync(NAME_STAT_SUMMARY_ASSET_PATH);
  if (!compressedBytes.subarray(0, GZIP_HEADER.length).equals(GZIP_HEADER)) {
    throw new Error('NameStat summary gzip header is not canonical.');
  }
  assertDeterministicGzipBytes(build.canonicalJsonBytes, compressedBytes);
  const uncompressed = Buffer.from(gunzipSync(compressedBytes));
  const committedDocument = parseCanonicalDocument(uncompressed);
  assertDocumentParity(build.document, committedDocument);
  if (!uncompressed.equals(build.canonicalJsonBytes)) {
    throw new Error('NameStat summary canonical JSON bytes are stale.');
  }

  const provenance = provenanceFor(build, compressedBytes);
  const expectedModule = renderNameStatSummaryGeneratedModule(provenance);
  const currentModule = fs.readFileSync(
    NAME_STAT_SUMMARY_GENERATED_MODULE_PATH,
    'utf8',
  ).replaceAll('\r\n', '\n');
  if (currentModule !== expectedModule) {
    throw new Error(
      'NameStat summary provenance is stale. Run npm run generate:name-stat-summary.',
    );
  }
  return { provenance, compressedBytes, document: committedDocument };
}
