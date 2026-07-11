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
