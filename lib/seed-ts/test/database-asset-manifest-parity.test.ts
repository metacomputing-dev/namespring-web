import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';

import { GENERATED_DATABASE_ASSET_MANIFEST } from '../src/database/database-asset-manifest.generated.js';
import { GENERATED_FOURFRAME_CATALOG_PROVENANCE } from '../src/fourframe-catalog.generated.js';
import {
  extractRawNameStatChoseong,
  foldNameStatChoseong,
  NAME_STAT_SHARD_KEYS,
  nameStatShardFilename,
  resolveNameStatShardKey,
} from '../src/utils/name-stat-shard.js';
import {
  collectDatabaseAssetManifest,
  verifyPinnedSchemaContractSha256,
} from '../tools/database-asset-manifest-core.js';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPOSITORY_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
const SQL_WASM_PATH = path.resolve(
  PACKAGE_ROOT,
  'node_modules',
  'sql.js',
  'dist',
  'sql-wasm.wasm',
);

const EXPECTED_NAME_STAT_ROW_COUNTS = [
  4_621, 1_894, 3_247, 5_781, 3_576, 3_191, 6_968,
  13_644, 2_199, 1_152, 309, 461, 259, 2_892,
] as const;

// Independent content oracle: these values deliberately do not come from the
// generator/runtime helper. A coordinated bug in shared routing must still
// fail against the deployed database contents.
const EXPECTED_RAW_CHOSEONG_ORDER = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ',
  'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const;
const EXPECTED_NAME_STAT_SHARD_KEYS = [
  'ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ',
  'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const;
const EXPECTED_TENSE_CHOSEONG_FOLDS = {
  'ㄲ': 'ㄱ',
  'ㄸ': 'ㄷ',
  'ㅃ': 'ㅂ',
  'ㅆ': 'ㅅ',
  'ㅉ': 'ㅈ',
} as const;
const EXPECTED_TENSE_CHOSEONG_ROW_COUNTS = {
  'ㄲ': 111,
  'ㄸ': 60,
  'ㅃ': 32,
  'ㅆ': 147,
  'ㅉ': 4,
} as const;

function requiredString(value: unknown, description: string): string {
  assert.equal(typeof value, 'string', description);
  return value as string;
}

function independentlyExtractRawChoseong(value: string): string | null {
  const codePoint = value.codePointAt(0);
  if (codePoint === undefined || codePoint < 0xac00 || codePoint > 0xd7a3) {
    return null;
  }
  return EXPECTED_RAW_CHOSEONG_ORDER[
    Math.floor((codePoint - 0xac00) / 588)
  ] ?? null;
}

function independentlyFoldChoseong(rawChoseong: string): string {
  return EXPECTED_TENSE_CHOSEONG_FOLDS[
    rawChoseong as keyof typeof EXPECTED_TENSE_CHOSEONG_FOLDS
  ] ?? rawChoseong;
}

// Independent review pins: do not import these from the generator. A schema
// migration must add a new version and digest in both authority points.
const EXPECTED_SCHEMA_CONTRACT_SHA256 = {
  'namespring.seed-db-schema/fourframe-v1':
    'b4666cb4da4d5e41fc0400afeb0b5c224dfad234e6fce89f426c8fc1cedcf493',
  'namespring.seed-db-schema/hanja-v1':
    'f224f1be915a6e47a20cdcf09febb4d496aba9b1f22348ffed4c0051d2be0fc6',
  'namespring.seed-db-schema/name-stat-v1':
    '7e784368d4ddbe4151c9a0b21f3a6b8f22fe153f668c90e2a973121222e42a2f',
} as const;

test('generated manifest has exact byte, schema, and row-count parity with all 16 DB assets', async () => {
  const actual = await collectDatabaseAssetManifest(REPOSITORY_ROOT);
  assert.deepEqual(actual, GENERATED_DATABASE_ASSET_MANIFEST);
  assert.equal(actual.assets.length, 16);
  assert.equal(new Set(actual.assets.map((asset) => asset.assetId)).size, 16);
  assert.equal(new Set(actual.assets.map((asset) => asset.relativePath)).size, 16);
  for (const asset of actual.assets) {
    assert.ok(asset.byteLength > 0, `${asset.assetId} byte length`);
    assert.match(asset.sha256, /^[a-f0-9]{64}$/u, `${asset.assetId} SHA-256`);
    assert.equal(asset.userVersion, 0, `${asset.assetId} current SQLite user_version`);
    assert.ok(asset.columns.length > 0, `${asset.assetId} normalized columns`);
    assert.ok(asset.rowCount > 0, `${asset.assetId} row count`);
  }
});

test('manifest pins the canonical table identities and exact dataset sizes', () => {
  const fourframe = GENERATED_DATABASE_ASSET_MANIFEST.assets.find(
    (asset) => asset.assetId === 'fourframe',
  );
  const hanja = GENERATED_DATABASE_ASSET_MANIFEST.assets.find(
    (asset) => asset.assetId === 'hanja',
  );
  const nameStats = GENERATED_DATABASE_ASSET_MANIFEST.assets.filter(
    (asset) => asset.schemaContractVersion === 'namespring.seed-db-schema/name-stat-v1',
  );

  assert.ok(fourframe);
  assert.equal(fourframe.table, 'sagyeoksu_meanings');
  assert.equal(fourframe.rowCount, 81);
  assert.deepEqual(fourframe.columns.map((column) => column.name), [
    'id', 'number', 'title', 'summary', 'detailed_explanation',
    'positive_aspects', 'caution_points', 'personality_traits',
    'suitable_career', 'life_period_influence', 'special_characteristics',
    'challenge_period', 'opportunity_area', 'lucky_level',
  ]);

  assert.ok(hanja);
  assert.equal(hanja.table, 'hanjas');
  assert.equal(hanja.rowCount, 4_849);
  assert.deepEqual(hanja.columns.map((column) => column.name), [
    'id', 'hangul', 'hanja', 'onset', 'nucleus', 'strokes',
    'stroke_element', 'resource_element', 'meaning', 'radical', 'is_surname',
  ]);

  assert.equal(nameStats.length, 14);
  assert.deepEqual(nameStats.map((asset) => asset.rowCount), EXPECTED_NAME_STAT_ROW_COUNTS);
  assert.equal(nameStats.reduce((sum, asset) => sum + asset.rowCount, 0), 50_194);
  assert.deepEqual(
    nameStats.map((asset) => asset.shardKey),
    EXPECTED_NAME_STAT_SHARD_KEYS,
  );
  assert.ok(nameStats.every((asset) => asset.table === 'name_stats'));
  assert.ok(nameStats.every((asset) =>
    asset.columns.map((column) => column.name).join(',')
      === 'id,name,first_char,first_choseong,similar_names_json,yearly_rank_json,yearly_birth_json,hanja_combinations_json,raw_entry_json'));
});

test('NameStat choseong contract keeps raw identity separate from 14-shard routing', () => {
  for (const [index, expectedRaw] of EXPECTED_RAW_CHOSEONG_ORDER.entries()) {
    const syllable = String.fromCodePoint(0xac00 + (index * 588));
    assert.equal(extractRawNameStatChoseong(syllable), expectedRaw);
    assert.equal(
      foldNameStatChoseong(expectedRaw),
      independentlyFoldChoseong(expectedRaw),
      `${expectedRaw} shared fold matches independent oracle`,
    );
  }
  assert.deepEqual(NAME_STAT_SHARD_KEYS, EXPECTED_NAME_STAT_SHARD_KEYS);
  assert.deepEqual(
    NAME_STAT_SHARD_KEYS.map((shardKey) => nameStatShardFilename(shardKey)),
    [
      '01.db', '02.db', '03.db', '04.db', '05.db', '06.db', '07.db',
      '08.db', '09.db', '10.db', '11.db', '12.db', '13.db', '14.db',
    ],
  );

  const tenseCases = [
    ['까', 'ㄲ', 'ㄱ', '01.db'],
    ['따', 'ㄸ', 'ㄷ', '03.db'],
    ['빠', 'ㅃ', 'ㅂ', '06.db'],
    ['싸', 'ㅆ', 'ㅅ', '07.db'],
    ['짜', 'ㅉ', 'ㅈ', '09.db'],
  ] as const;
  for (const [name, expectedRaw, expectedShard, expectedFile] of tenseCases) {
    const raw = extractRawNameStatChoseong(name);
    assert.equal(raw, expectedRaw, `${name} raw choseong`);
    assert.ok(raw);
    assert.equal(foldNameStatChoseong(raw), expectedShard, `${name} folded shard`);
    assert.equal(resolveNameStatShardKey(`${name}람`), expectedShard, `${name} name routing`);
    assert.equal(nameStatShardFilename(expectedShard), expectedFile, `${name} shard file`);
  }

  assert.equal(extractRawNameStatChoseong('A'), null);
  assert.equal(resolveNameStatShardKey(''), null);
});

test('all committed NameStat rows preserve raw choseong and belong to their pinned shard', async () => {
  const SQL = await initSqlJs({ locateFile: () => SQL_WASM_PATH });
  const nameStatAssets = GENERATED_DATABASE_ASSET_MANIFEST.assets.filter(
    (asset) => asset.schemaContractVersion === 'namespring.seed-db-schema/name-stat-v1',
  );
  const tenseCounts = new Map<string, number>();
  let totalRows = 0;

  for (const asset of nameStatAssets) {
    const expectedShardKey = EXPECTED_NAME_STAT_SHARD_KEYS.find(
      (shardKey) => shardKey === asset.shardKey,
    );
    assert.ok(expectedShardKey, `${asset.assetId} canonical shard key`);
    const bytes = fs.readFileSync(path.resolve(REPOSITORY_ROOT, asset.relativePath));
    const db = new SQL.Database(bytes);
    const statement = db.prepare(
      'SELECT name, first_char, first_choseong FROM name_stats ORDER BY id',
    );
    let assetRows = 0;
    try {
      while (statement.step()) {
        const row = statement.getAsObject();
        const name = requiredString(row.name, `${asset.assetId} row name`);
        const firstChar = requiredString(
          row.first_char,
          `${asset.assetId}/${name} first_char`,
        );
        const storedRawChoseong = requiredString(
          row.first_choseong,
          `${asset.assetId}/${name} first_choseong`,
        );
        const expectedFirstChar = Array.from(name)[0] ?? '';
        assert.equal(
          firstChar,
          expectedFirstChar,
          `${asset.assetId}/${name} first_char matches name`,
        );
        const rawChoseong = independentlyExtractRawChoseong(firstChar);
        assert.ok(rawChoseong, `${asset.assetId}/${name} supported raw choseong`);
        assert.equal(
          storedRawChoseong,
          rawChoseong,
          `${asset.assetId}/${name} stores raw choseong`,
        );
        assert.equal(
          independentlyFoldChoseong(rawChoseong),
          expectedShardKey,
          `${asset.assetId}/${name} folds to manifest shard`,
        );
        if (rawChoseong !== expectedShardKey) {
          tenseCounts.set(rawChoseong, (tenseCounts.get(rawChoseong) ?? 0) + 1);
        }
        assetRows += 1;
      }
    } finally {
      statement.free();
      db.close();
    }
    assert.equal(assetRows, asset.rowCount, `${asset.assetId} scanned row count`);
    totalRows += assetRows;
  }

  assert.equal(totalRows, 50_194);
  assert.deepEqual(
    Object.fromEntries(
      [...tenseCounts.entries()].sort(([left], [right]) => left.localeCompare(right, 'ko')),
    ),
    EXPECTED_TENSE_CHOSEONG_ROW_COUNTS,
  );
});

test('three independent v1 digests pin every normalized column property', () => {
  const observedVersions = new Set<string>();
  for (const asset of GENERATED_DATABASE_ASSET_MANIFEST.assets) {
    const version = asset.schemaContractVersion;
    const expected = EXPECTED_SCHEMA_CONTRACT_SHA256[
      version as keyof typeof EXPECTED_SCHEMA_CONTRACT_SHA256
    ];
    assert.ok(expected, `${version} has an independent test digest`);
    const actual = createHash('sha256')
      .update(JSON.stringify(asset.columns))
      .digest('hex');
    assert.equal(actual, expected, `${version} full normalized column contract`);
    assert.equal(asset.schemaContractSha256, expected, `${asset.assetId} manifest digest`);
    observedVersions.add(version);
  }
  assert.deepEqual(
    [...observedVersions].sort(),
    Object.keys(EXPECTED_SCHEMA_CONTRACT_SHA256).sort(),
  );
});

test('a normalized column change cannot reuse an existing v1 contract', () => {
  const seen = new Set<string>();
  for (const asset of GENERATED_DATABASE_ASSET_MANIFEST.assets) {
    if (seen.has(asset.schemaContractVersion)) continue;
    seen.add(asset.schemaContractVersion);
    const [first, ...remaining] = asset.columns;
    assert.ok(first);
    const changedColumns = [
      { ...first, notNull: !first.notNull },
      ...remaining,
    ];
    assert.throws(
      () => verifyPinnedSchemaContractSha256(
        asset.schemaContractVersion,
        changedColumns,
      ),
      /Introduce a new schema contract version and reviewed digest/u,
    );
  }
  assert.equal(seen.size, 3);
});

test('four-frame database hash has one truth across both generated provenance records', () => {
  const fourframe = GENERATED_DATABASE_ASSET_MANIFEST.assets.find(
    (asset) => asset.assetId === 'fourframe',
  );
  assert.ok(fourframe);
  assert.equal(
    fourframe.sha256,
    GENERATED_FOURFRAME_CATALOG_PROVENANCE.sourceDatabaseSha256,
  );
});
