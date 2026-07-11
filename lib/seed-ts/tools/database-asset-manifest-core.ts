import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import initSqlJs, { type Database } from 'sql.js';

export const DATABASE_ASSET_MANIFEST_SCHEMA_VERSION =
  'namespring.seed-database-asset-manifest/v1' as const;

export interface NormalizedDatabaseColumn {
  readonly cid: number;
  readonly name: string;
  readonly declaredType: string;
  readonly notNull: boolean;
  readonly defaultValue: string | null;
  readonly primaryKeyPosition: number;
}

export interface DatabaseAssetManifestEntry {
  readonly assetId: string;
  readonly relativePath: string;
  readonly byteLength: number;
  readonly sha256: string;
  readonly userVersion: number;
  readonly schemaContractVersion: string;
  readonly schemaContractSha256: string;
  readonly table: string;
  readonly columns: readonly NormalizedDatabaseColumn[];
  readonly rowCount: number;
  readonly shardKey: string | null;
}

export interface DatabaseAssetManifest {
  readonly schemaVersion: typeof DATABASE_ASSET_MANIFEST_SCHEMA_VERSION;
  readonly assets: readonly DatabaseAssetManifestEntry[];
}

interface DatabaseAssetSpec {
  readonly assetId: string;
  readonly dataRelativePath: string;
  readonly schemaContractVersion: string;
  readonly table: string;
  readonly shardKey: string | null;
}

const PUBLIC_DATA_RELATIVE_PATH = 'namespring/public/data';
const SQL_WASM_RELATIVE_PATH = 'lib/seed-ts/node_modules/sql.js/dist/sql-wasm.wasm';

const DATABASE_ASSET_SPECS = [
  {
    assetId: 'fourframe',
    dataRelativePath: 'fourframe.db',
    schemaContractVersion: 'namespring.seed-db-schema/fourframe-v1',
    table: 'sagyeoksu_meanings',
    shardKey: null,
  },
  {
    assetId: 'hanja',
    dataRelativePath: 'hanja.db',
    schemaContractVersion: 'namespring.seed-db-schema/hanja-v1',
    table: 'hanjas',
    shardKey: null,
  },
  ...[
    ['01', '\u3131'], ['02', '\u3134'], ['03', '\u3137'], ['04', '\u3139'],
    ['05', '\u3141'], ['06', '\u3142'], ['07', '\u3145'], ['08', '\u3147'],
    ['09', '\u3148'], ['10', '\u314A'], ['11', '\u314B'], ['12', '\u314C'],
    ['13', '\u314D'], ['14', '\u314E'],
  ].map(([number, shardKey]) => ({
    assetId: `name-stat-${number}`,
    dataRelativePath: `name-stat-shards/${number}.db`,
    schemaContractVersion: 'namespring.seed-db-schema/name-stat-v1',
    table: 'name_stats',
    shardKey,
  })),
] as const satisfies readonly DatabaseAssetSpec[];

// These are independent v1 contract pins, not values learned from the current
// databases during generation. A schema change must introduce a new version
// and its reviewed digest instead of silently redefining an existing v1.
const SCHEMA_CONTRACT_SHA256_BY_VERSION: Readonly<Record<string, string>> = {
  'namespring.seed-db-schema/fourframe-v1':
    'b4666cb4da4d5e41fc0400afeb0b5c224dfad234e6fce89f426c8fc1cedcf493',
  'namespring.seed-db-schema/hanja-v1':
    'f224f1be915a6e47a20cdcf09febb4d496aba9b1f22348ffed4c0051d2be0fc6',
  'namespring.seed-db-schema/name-stat-v1':
    '7e784368d4ddbe4151c9a0b21f3a6b8f22fe153f668c90e2a973121222e42a2f',
};

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function listDatabaseFiles(root: string, relativeDirectory = ''): string[] {
  const absoluteDirectory = path.resolve(root, relativeDirectory);
  const entries = fs.readdirSync(absoluteDirectory, { withFileTypes: true })
    .sort((left, right) => compareText(left.name, right.name));
  const files: string[] = [];
  for (const entry of entries) {
    const childRelativePath = relativeDirectory
      ? `${relativeDirectory}/${entry.name}`
      : entry.name;
    if (entry.isDirectory()) {
      files.push(...listDatabaseFiles(root, childRelativePath));
    } else if (entry.isFile() && entry.name.endsWith('.db')) {
      files.push(childRelativePath);
    }
  }
  return files;
}

function assertExpectedAssetSet(publicDataRoot: string): void {
  const actual = listDatabaseFiles(publicDataRoot);
  const expected = DATABASE_ASSET_SPECS
    .map((spec) => spec.dataRelativePath)
    .sort(compareText);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      'Default database asset set changed. Expected '
      + JSON.stringify(expected)
      + ', received '
      + JSON.stringify(actual),
    );
  }
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function requiredInteger(value: unknown, description: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${description} must be a non-negative safe integer`);
  }
  return value;
}

function scalarInteger(db: Database, sql: string, description: string): number {
  const results = db.exec(sql);
  const value = results[0]?.values[0]?.[0];
  return requiredInteger(value, description);
}

function normalizedColumns(db: Database, table: string): NormalizedDatabaseColumn[] {
  const results = db.exec(`PRAGMA table_info(${quoteIdentifier(table)})`);
  const result = results[0];
  if (!result || result.values.length === 0) {
    throw new Error(`Required table ${table} is missing`);
  }
  const columnIndex = new Map(result.columns.map((name, index) => [name, index]));
  const valueAt = (row: readonly unknown[], name: string): unknown => {
    const index = columnIndex.get(name);
    if (index === undefined) throw new Error(`PRAGMA table_info omitted ${name}`);
    return row[index];
  };

  return result.values.map((row, rowIndex) => {
    const name = valueAt(row, 'name');
    const declaredType = valueAt(row, 'type');
    const defaultValue = valueAt(row, 'dflt_value');
    if (typeof name !== 'string' || name.length === 0) {
      throw new Error(`Column ${rowIndex} has an invalid name`);
    }
    if (typeof declaredType !== 'string') {
      throw new Error(`Column ${name} has an invalid declared type`);
    }
    if (defaultValue !== null && typeof defaultValue !== 'string') {
      throw new Error(`Column ${name} has an invalid default value`);
    }
    return {
      cid: requiredInteger(valueAt(row, 'cid'), `Column ${name} cid`),
      name,
      declaredType: declaredType.trim().replace(/\s+/gu, ' ').toUpperCase(),
      notNull: requiredInteger(valueAt(row, 'notnull'), `Column ${name} notnull`) === 1,
      defaultValue: defaultValue === null
        ? null
        : defaultValue.trim().replace(/\s+/gu, ' '),
      primaryKeyPosition: requiredInteger(valueAt(row, 'pk'), `Column ${name} pk`),
    };
  });
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function verifyPinnedSchemaContractSha256(
  schemaContractVersion: string,
  columns: readonly NormalizedDatabaseColumn[],
): string {
  const expected = SCHEMA_CONTRACT_SHA256_BY_VERSION[schemaContractVersion];
  if (!expected) {
    throw new Error(
      `Schema contract ${schemaContractVersion} has no reviewed SHA-256 pin`,
    );
  }
  const actual = createHash('sha256')
    .update(JSON.stringify(columns))
    .digest('hex');
  if (actual !== expected) {
    throw new Error(
      `Schema contract ${schemaContractVersion} changed: expected ${expected}, received ${actual}. `
      + 'Introduce a new schema contract version and reviewed digest.',
    );
  }
  return actual;
}

function readAsset(
  repositoryRoot: string,
  SQL: Awaited<ReturnType<typeof initSqlJs>>,
  spec: DatabaseAssetSpec,
): DatabaseAssetManifestEntry {
  const relativePath = `${PUBLIC_DATA_RELATIVE_PATH}/${spec.dataRelativePath}`;
  const absolutePath = path.resolve(repositoryRoot, ...relativePath.split('/'));
  const bytes = fs.readFileSync(absolutePath);
  const db = new SQL.Database(bytes);
  try {
    const columns = normalizedColumns(db, spec.table);
    return {
      assetId: spec.assetId,
      relativePath,
      byteLength: bytes.byteLength,
      sha256: sha256(bytes),
      userVersion: scalarInteger(db, 'PRAGMA user_version', `${spec.assetId} user_version`),
      schemaContractVersion: spec.schemaContractVersion,
      schemaContractSha256: verifyPinnedSchemaContractSha256(
        spec.schemaContractVersion,
        columns,
      ),
      table: spec.table,
      columns,
      rowCount: scalarInteger(
        db,
        `SELECT COUNT(*) FROM ${quoteIdentifier(spec.table)}`,
        `${spec.assetId} row count`,
      ),
      shardKey: spec.shardKey,
    };
  } finally {
    db.close();
  }
}

function assertSharedSchemaColumns(assets: readonly DatabaseAssetManifestEntry[]): void {
  const columnsByVersion = new Map<string, string>();
  for (const asset of assets) {
    const serialized = JSON.stringify(asset.columns);
    const existing = columnsByVersion.get(asset.schemaContractVersion);
    if (existing !== undefined && existing !== serialized) {
      throw new Error(
        `Assets under ${asset.schemaContractVersion} do not share one normalized column contract`,
      );
    }
    columnsByVersion.set(asset.schemaContractVersion, serialized);
  }
}

export async function collectDatabaseAssetManifest(
  repositoryRoot: string,
): Promise<DatabaseAssetManifest> {
  const publicDataRoot = path.resolve(
    repositoryRoot,
    ...PUBLIC_DATA_RELATIVE_PATH.split('/'),
  );
  assertExpectedAssetSet(publicDataRoot);
  const wasmPath = path.resolve(
    repositoryRoot,
    ...SQL_WASM_RELATIVE_PATH.split('/'),
  );
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const assets = DATABASE_ASSET_SPECS.map((spec) => readAsset(repositoryRoot, SQL, spec));
  assertSharedSchemaColumns(assets);
  return {
    schemaVersion: DATABASE_ASSET_MANIFEST_SCHEMA_VERSION,
    assets,
  };
}

const COLUMN_CONSTANT_BY_SCHEMA_VERSION = new Map([
  ['namespring.seed-db-schema/fourframe-v1', 'FOURFRAME_COLUMNS'],
  ['namespring.seed-db-schema/hanja-v1', 'HANJA_COLUMNS'],
  ['namespring.seed-db-schema/name-stat-v1', 'NAME_STAT_COLUMNS'],
]);

function renderColumnsConstant(
  constantName: string,
  columns: readonly NormalizedDatabaseColumn[],
): string[] {
  return [
    `const ${constantName} = ${JSON.stringify(columns, null, 2)} as const;`,
    '',
  ];
}

export function renderDatabaseAssetManifestModule(manifest: DatabaseAssetManifest): string {
  const firstAssetBySchema = new Map<string, DatabaseAssetManifestEntry>();
  for (const asset of manifest.assets) {
    if (!firstAssetBySchema.has(asset.schemaContractVersion)) {
      firstAssetBySchema.set(asset.schemaContractVersion, asset);
    }
  }

  const lines = [
    '/* This file is generated. Run: npm run generate:database-asset-manifest */',
    '',
  ];
  for (const [schemaVersion, constantName] of COLUMN_CONSTANT_BY_SCHEMA_VERSION) {
    const asset = firstAssetBySchema.get(schemaVersion);
    if (!asset) throw new Error(`No asset uses required schema ${schemaVersion}`);
    lines.push(...renderColumnsConstant(constantName, asset.columns));
  }

  lines.push(
    'export const GENERATED_DATABASE_ASSET_MANIFEST = {',
    `  schemaVersion: ${JSON.stringify(manifest.schemaVersion)},`,
    '  assets: [',
  );
  for (const asset of manifest.assets) {
    const columnConstant = COLUMN_CONSTANT_BY_SCHEMA_VERSION.get(asset.schemaContractVersion);
    if (!columnConstant) {
      throw new Error(`No column constant for ${asset.schemaContractVersion}`);
    }
    lines.push(
      '    {',
      `      assetId: ${JSON.stringify(asset.assetId)},`,
      `      relativePath: ${JSON.stringify(asset.relativePath)},`,
      `      byteLength: ${asset.byteLength},`,
      `      sha256: ${JSON.stringify(asset.sha256)},`,
      `      userVersion: ${asset.userVersion},`,
      `      schemaContractVersion: ${JSON.stringify(asset.schemaContractVersion)},`,
      `      schemaContractSha256: ${JSON.stringify(asset.schemaContractSha256)},`,
      `      table: ${JSON.stringify(asset.table)},`,
      `      columns: ${columnConstant},`,
      `      rowCount: ${asset.rowCount},`,
      `      shardKey: ${JSON.stringify(asset.shardKey)},`,
      '    },',
    );
  }
  lines.push('  ],', '} as const;', '');
  return lines.join('\n');
}
