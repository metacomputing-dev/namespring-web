import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { gzipSync } from 'node:zlib';

import { NAME_STAT_DATABASE_ASSETS } from '../../../seed-ts/src/database/database-asset-registry.js';
import { NAME_STAT_SUMMARY_ASSET_PROVENANCE } from '../../src/name-stat-summary-asset.generated.js';
import {
  NAME_STAT_SUMMARY_EXPECTED_ROW_COUNT,
  NAME_STAT_SUMMARY_SCHEMA_VERSION,
  validateNameStatSummaryDocument,
  validateNameStatSummaryTuple,
} from '../../src/name-stat-summary-contract.js';
import {
  addNameStatSummaryProjection,
  assertDeterministicGzipBytes,
  collectNameStatSummary,
  computeNameStatSourceAssetSetSha256,
  createDeterministicGzip,
  verifyCommittedNameStatSummaryArtifact,
} from '../../tools/name-stat-summary-core.js';

const EXPECTED_SOURCE_ASSET_SET_SHA256 =
  '621446906bbc0605a0e83fee2c2b45f44d2c00fe0695b9e00867890055d00ea0';
const buildPromise = collectNameStatSummary();

function independentlyComputeSourceAssetSetSha256(): string {
  const canonical = JSON.stringify({
    schemaVersion: 'namespring.name-stat-source-asset-set/v1',
    assets: NAME_STAT_DATABASE_ASSETS.map((asset) => ({
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
  });
  return createHash('sha256').update(canonical).digest('hex');
}

test('committed compact asset exactly mirrors all verified NameStat rows', async () => {
  const build = await buildPromise;
  const artifact = verifyCommittedNameStatSummaryArtifact(build);

  assert.equal(build.sourceAssetSetSha256, EXPECTED_SOURCE_ASSET_SET_SHA256);
  assert.equal(
    computeNameStatSourceAssetSetSha256(),
    EXPECTED_SOURCE_ASSET_SET_SHA256,
  );
  assert.equal(
    independentlyComputeSourceAssetSetSha256(),
    EXPECTED_SOURCE_ASSET_SET_SHA256,
  );
  assert.deepEqual(build.audit, {
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
  });
  assert.equal(Object.keys(artifact.document.entries).length, 50_194);
  assert.deepEqual(artifact.document.entries['\uAE30\uD0C0'], [null, 0, 0]);
  assert.deepEqual(artifact.provenance, NAME_STAT_SUMMARY_ASSET_PROVENANCE);
});

test('gzip generation is byte-deterministic with a platform-neutral header', async () => {
  const build = await buildPromise;
  const first = createDeterministicGzip(build.canonicalJsonBytes);
  const second = createDeterministicGzip(build.canonicalJsonBytes);
  assert.deepEqual(first, second);
  assert.equal(first.subarray(0, 10).toString('hex'), '1f8b08000000000002ff');
});

test('checker rejects a canonical-looking header with a different deflate stream', async () => {
  const build = await buildPromise;
  const alternate = Buffer.from(gzipSync(build.canonicalJsonBytes, { level: 6 }));
  alternate.fill(0, 4, 8);
  alternate[8] = 2;
  alternate[9] = 0xff;
  assert.equal(
    alternate.subarray(0, 10).toString('hex'),
    '1f8b08000000000002ff',
  );
  assert.notDeepEqual(alternate, createDeterministicGzip(build.canonicalJsonBytes));
  assert.throws(
    () => assertDeterministicGzipBytes(build.canonicalJsonBytes, alternate),
    /deterministic level-9 artifact/u,
  );
});

test('duplicate names fail before compact object construction', () => {
  const projections = new Map();
  addNameStatSummaryProjection(projections, '\uAC00\uB098', {
    popularityRank: 1,
    maleBirths: 2,
    femaleBirths: 3,
  });
  assert.throws(
    () => addNameStatSummaryProjection(projections, '\uAC00\uB098', {
      popularityRank: 2,
      maleBirths: 4,
      femaleBirths: 5,
    }),
    /duplicate name/u,
  );
  assert.equal(projections.size, 1);
});

test('tuple contract rejects malformed and unsafe values with an entry path', () => {
  assert.deepEqual(
    validateNameStatSummaryTuple([null, 0, 0], 'entries.sentinel'),
    [null, 0, 0],
  );
  assert.deepEqual(
    validateNameStatSummaryTuple([1.5, 2, 3], 'entries.fractional'),
    [1.5, 2, 3],
  );
  for (const value of [
    null,
    [],
    [1, 2],
    [1, 2, 3, 4],
    [0, 2, 3],
    [-1, 2, 3],
    [Number.NaN, 2, 3],
    [Number.POSITIVE_INFINITY, 2, 3],
    ['1', 2, 3],
    [1, null, 3],
    [1, '2', 3],
    [1, -1, 3],
    [1, 1.5, 3],
    [1, Number.NaN, 3],
    [1, Number.POSITIVE_INFINITY, 3],
    [1, Number.MAX_SAFE_INTEGER + 1, 0],
    [1, Number.MAX_SAFE_INTEGER, 1],
  ]) {
    assert.throws(
      () => validateNameStatSummaryTuple(value, 'entries.bad'),
      (error: unknown) =>
        error instanceof Error && error.message.includes('entries.bad'),
    );
  }
  const sparse = new Array(3);
  sparse[0] = null;
  sparse[2] = 0;
  assert.throws(
    () => validateNameStatSummaryTuple(sparse, 'entries.sparse'),
    /entries\.sparse/u,
  );
});

test('document contract fails closed on envelope and ordering drift', () => {
  const valid = {
    schemaVersion: NAME_STAT_SUMMARY_SCHEMA_VERSION,
    sourceAssetSetSha256: 'a'.repeat(64),
    rowCount: 1,
    entries: { '\uAC00': [1, 2, 3] },
  };
  assert.equal(
    validateNameStatSummaryDocument(valid, { expectedRowCount: 1 }).rowCount,
    1,
  );
  assert.throws(
    () => validateNameStatSummaryDocument(
      { ...valid, schemaVersion: 'wrong' },
      { expectedRowCount: 1 },
    ),
    /schemaVersion/u,
  );
  assert.throws(
    () => validateNameStatSummaryDocument(
      { ...valid, sourceAssetSetSha256: 'BAD' },
      { expectedRowCount: 1 },
    ),
    /sourceAssetSetSha256/u,
  );
  assert.throws(
    () => validateNameStatSummaryDocument(
      {
        schemaVersion: NAME_STAT_SUMMARY_SCHEMA_VERSION,
        sourceAssetSetSha256: 'a'.repeat(64),
        rowCount: 2,
        entries: { '\uB098': [2, 0, 0], '\uAC00': [1, 0, 0] },
      },
      { expectedRowCount: 2 },
    ),
    /sorted keys/u,
  );
  assert.throws(
    () => validateNameStatSummaryDocument(
      { ...valid, unexpected: true },
      { expectedRowCount: 1 },
    ),
    /canonical order/u,
  );
  assert.throws(
    () => validateNameStatSummaryDocument(
      JSON.parse(
        `{"schemaVersion":"${NAME_STAT_SUMMARY_SCHEMA_VERSION}",`
        + `"sourceAssetSetSha256":"${'a'.repeat(64)}",`
        + '"rowCount":1,"entries":{"__proto__":[1,0,0]}}',
      ),
      { expectedRowCount: 1 },
    ),
    /precomposed Hangul/u,
  );
  assert.equal(NAME_STAT_SUMMARY_EXPECTED_ROW_COUNT, 50_194);
});
