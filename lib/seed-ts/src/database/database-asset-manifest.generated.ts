/* This file is generated. Run: npm run generate:database-asset-manifest */

const FOURFRAME_COLUMNS = [
  {
    "cid": 0,
    "name": "id",
    "declaredType": "INTEGER",
    "notNull": false,
    "defaultValue": null,
    "primaryKeyPosition": 1
  },
  {
    "cid": 1,
    "name": "number",
    "declaredType": "INTEGER",
    "notNull": true,
    "defaultValue": null,
    "primaryKeyPosition": 0
  },
  {
    "cid": 2,
    "name": "title",
    "declaredType": "TEXT",
    "notNull": true,
    "defaultValue": null,
    "primaryKeyPosition": 0
  },
  {
    "cid": 3,
    "name": "summary",
    "declaredType": "TEXT",
    "notNull": true,
    "defaultValue": null,
    "primaryKeyPosition": 0
  },
  {
    "cid": 4,
    "name": "detailed_explanation",
    "declaredType": "TEXT",
    "notNull": false,
    "defaultValue": null,
    "primaryKeyPosition": 0
  },
  {
    "cid": 5,
    "name": "positive_aspects",
    "declaredType": "TEXT",
    "notNull": false,
    "defaultValue": null,
    "primaryKeyPosition": 0
  },
  {
    "cid": 6,
    "name": "caution_points",
    "declaredType": "TEXT",
    "notNull": false,
    "defaultValue": null,
    "primaryKeyPosition": 0
  },
  {
    "cid": 7,
    "name": "personality_traits",
    "declaredType": "TEXT",
    "notNull": false,
    "defaultValue": null,
    "primaryKeyPosition": 0
  },
  {
    "cid": 8,
    "name": "suitable_career",
    "declaredType": "TEXT",
    "notNull": false,
    "defaultValue": null,
    "primaryKeyPosition": 0
  },
  {
    "cid": 9,
    "name": "life_period_influence",
    "declaredType": "TEXT",
    "notNull": false,
    "defaultValue": null,
    "primaryKeyPosition": 0
  },
  {
    "cid": 10,
    "name": "special_characteristics",
    "declaredType": "TEXT",
    "notNull": false,
    "defaultValue": null,
    "primaryKeyPosition": 0
  },
  {
    "cid": 11,
    "name": "challenge_period",
    "declaredType": "TEXT",
    "notNull": false,
    "defaultValue": null,
    "primaryKeyPosition": 0
  },
  {
    "cid": 12,
    "name": "opportunity_area",
    "declaredType": "TEXT",
    "notNull": false,
    "defaultValue": null,
    "primaryKeyPosition": 0
  },
  {
    "cid": 13,
    "name": "lucky_level",
    "declaredType": "TEXT",
    "notNull": false,
    "defaultValue": null,
    "primaryKeyPosition": 0
  }
] as const;

const HANJA_COLUMNS = [
  {
    "cid": 0,
    "name": "id",
    "declaredType": "INTEGER",
    "notNull": false,
    "defaultValue": null,
    "primaryKeyPosition": 1
  },
  {
    "cid": 1,
    "name": "hangul",
    "declaredType": "TEXT",
    "notNull": true,
    "defaultValue": null,
    "primaryKeyPosition": 0
  },
  {
    "cid": 2,
    "name": "hanja",
    "declaredType": "TEXT",
    "notNull": true,
    "defaultValue": null,
    "primaryKeyPosition": 0
  },
  {
    "cid": 3,
    "name": "onset",
    "declaredType": "TEXT",
    "notNull": false,
    "defaultValue": null,
    "primaryKeyPosition": 0
  },
  {
    "cid": 4,
    "name": "nucleus",
    "declaredType": "TEXT",
    "notNull": false,
    "defaultValue": null,
    "primaryKeyPosition": 0
  },
  {
    "cid": 5,
    "name": "strokes",
    "declaredType": "INTEGER",
    "notNull": false,
    "defaultValue": null,
    "primaryKeyPosition": 0
  },
  {
    "cid": 6,
    "name": "stroke_element",
    "declaredType": "TEXT",
    "notNull": false,
    "defaultValue": null,
    "primaryKeyPosition": 0
  },
  {
    "cid": 7,
    "name": "resource_element",
    "declaredType": "TEXT",
    "notNull": false,
    "defaultValue": null,
    "primaryKeyPosition": 0
  },
  {
    "cid": 8,
    "name": "meaning",
    "declaredType": "TEXT",
    "notNull": false,
    "defaultValue": null,
    "primaryKeyPosition": 0
  },
  {
    "cid": 9,
    "name": "radical",
    "declaredType": "TEXT",
    "notNull": false,
    "defaultValue": null,
    "primaryKeyPosition": 0
  },
  {
    "cid": 10,
    "name": "is_surname",
    "declaredType": "INTEGER",
    "notNull": false,
    "defaultValue": "0",
    "primaryKeyPosition": 0
  }
] as const;

const NAME_STAT_COLUMNS = [
  {
    "cid": 0,
    "name": "id",
    "declaredType": "INTEGER",
    "notNull": false,
    "defaultValue": null,
    "primaryKeyPosition": 1
  },
  {
    "cid": 1,
    "name": "name",
    "declaredType": "TEXT",
    "notNull": true,
    "defaultValue": null,
    "primaryKeyPosition": 0
  },
  {
    "cid": 2,
    "name": "first_char",
    "declaredType": "TEXT",
    "notNull": true,
    "defaultValue": null,
    "primaryKeyPosition": 0
  },
  {
    "cid": 3,
    "name": "first_choseong",
    "declaredType": "TEXT",
    "notNull": true,
    "defaultValue": null,
    "primaryKeyPosition": 0
  },
  {
    "cid": 4,
    "name": "similar_names_json",
    "declaredType": "TEXT",
    "notNull": true,
    "defaultValue": null,
    "primaryKeyPosition": 0
  },
  {
    "cid": 5,
    "name": "yearly_rank_json",
    "declaredType": "TEXT",
    "notNull": true,
    "defaultValue": null,
    "primaryKeyPosition": 0
  },
  {
    "cid": 6,
    "name": "yearly_birth_json",
    "declaredType": "TEXT",
    "notNull": true,
    "defaultValue": null,
    "primaryKeyPosition": 0
  },
  {
    "cid": 7,
    "name": "hanja_combinations_json",
    "declaredType": "TEXT",
    "notNull": true,
    "defaultValue": null,
    "primaryKeyPosition": 0
  },
  {
    "cid": 8,
    "name": "raw_entry_json",
    "declaredType": "TEXT",
    "notNull": true,
    "defaultValue": null,
    "primaryKeyPosition": 0
  }
] as const;

export const GENERATED_DATABASE_ASSET_MANIFEST = {
  schemaVersion: "namespring.seed-database-asset-manifest/v1",
  assets: [
    {
      assetId: "fourframe",
      relativePath: "namespring/public/data/fourframe.db",
      byteLength: 802816,
      sha256: "80d9ce378ee0180042f6e594785d8dd767e1c022d065cbb6ca88d505c22fe32e",
      userVersion: 0,
      schemaContractVersion: "namespring.seed-db-schema/fourframe-v1",
      schemaContractSha256: "b4666cb4da4d5e41fc0400afeb0b5c224dfad234e6fce89f426c8fc1cedcf493",
      table: "sagyeoksu_meanings",
      columns: FOURFRAME_COLUMNS,
      rowCount: 81,
      shardKey: null,
    },
    {
      assetId: "hanja",
      relativePath: "namespring/public/data/hanja.db",
      byteLength: 376832,
      sha256: "0f78eefc23e727937714b30215464783bf93882e5636d131c7113cfc1049e449",
      userVersion: 0,
      schemaContractVersion: "namespring.seed-db-schema/hanja-v1",
      schemaContractSha256: "f224f1be915a6e47a20cdcf09febb4d496aba9b1f22348ffed4c0051d2be0fc6",
      table: "hanjas",
      columns: HANJA_COLUMNS,
      rowCount: 4849,
      shardKey: null,
    },
    {
      assetId: "name-stat-01",
      relativePath: "namespring/public/data/name-stat-shards/01.db",
      byteLength: 10510336,
      sha256: "0f92a29dcd26186b30a77218919c6b599b5b69124c9e2a9db5b4e86d95e24bd1",
      userVersion: 0,
      schemaContractVersion: "namespring.seed-db-schema/name-stat-v1",
      schemaContractSha256: "7e784368d4ddbe4151c9a0b21f3a6b8f22fe153f668c90e2a973121222e42a2f",
      table: "name_stats",
      columns: NAME_STAT_COLUMNS,
      rowCount: 4621,
      shardKey: "ㄱ",
    },
    {
      assetId: "name-stat-02",
      relativePath: "namespring/public/data/name-stat-shards/02.db",
      byteLength: 2609152,
      sha256: "8623891476f2cb3c686aa117bb0805d3bc698911c656bdbf3dc4b68c002325c8",
      userVersion: 0,
      schemaContractVersion: "namespring.seed-db-schema/name-stat-v1",
      schemaContractSha256: "7e784368d4ddbe4151c9a0b21f3a6b8f22fe153f668c90e2a973121222e42a2f",
      table: "name_stats",
      columns: NAME_STAT_COLUMNS,
      rowCount: 1894,
      shardKey: "ㄴ",
    },
    {
      assetId: "name-stat-03",
      relativePath: "namespring/public/data/name-stat-shards/03.db",
      byteLength: 5685248,
      sha256: "c1cad1adc8eb31de3e62f192b668d18ce846ea916d5a88ad0da6612a491fd6ed",
      userVersion: 0,
      schemaContractVersion: "namespring.seed-db-schema/name-stat-v1",
      schemaContractSha256: "7e784368d4ddbe4151c9a0b21f3a6b8f22fe153f668c90e2a973121222e42a2f",
      table: "name_stats",
      columns: NAME_STAT_COLUMNS,
      rowCount: 3247,
      shardKey: "ㄷ",
    },
    {
      assetId: "name-stat-04",
      relativePath: "namespring/public/data/name-stat-shards/04.db",
      byteLength: 8364032,
      sha256: "c960c9216a00af13fd44479caf777f4c0092c5532f02af9f10814b380cc081da",
      userVersion: 0,
      schemaContractVersion: "namespring.seed-db-schema/name-stat-v1",
      schemaContractSha256: "7e784368d4ddbe4151c9a0b21f3a6b8f22fe153f668c90e2a973121222e42a2f",
      table: "name_stats",
      columns: NAME_STAT_COLUMNS,
      rowCount: 5781,
      shardKey: "ㄹ",
    },
    {
      assetId: "name-stat-05",
      relativePath: "namespring/public/data/name-stat-shards/05.db",
      byteLength: 5808128,
      sha256: "9c2da1835330e1f9cbf2edd4f699bbb282a2c164ee719a355974f85600b63b28",
      userVersion: 0,
      schemaContractVersion: "namespring.seed-db-schema/name-stat-v1",
      schemaContractSha256: "7e784368d4ddbe4151c9a0b21f3a6b8f22fe153f668c90e2a973121222e42a2f",
      table: "name_stats",
      columns: NAME_STAT_COLUMNS,
      rowCount: 3576,
      shardKey: "ㅁ",
    },
    {
      assetId: "name-stat-06",
      relativePath: "namespring/public/data/name-stat-shards/06.db",
      byteLength: 5558272,
      sha256: "4b085935cfead6194f786c664850d2fb8f36919aa56ca165b0ccda9e536f55b2",
      userVersion: 0,
      schemaContractVersion: "namespring.seed-db-schema/name-stat-v1",
      schemaContractSha256: "7e784368d4ddbe4151c9a0b21f3a6b8f22fe153f668c90e2a973121222e42a2f",
      table: "name_stats",
      columns: NAME_STAT_COLUMNS,
      rowCount: 3191,
      shardKey: "ㅂ",
    },
    {
      assetId: "name-stat-07",
      relativePath: "namespring/public/data/name-stat-shards/07.db",
      byteLength: 14204928,
      sha256: "83919167ac27aeb5a380d1172c09a3fba16f82c89877774c54b2637ea472a762",
      userVersion: 0,
      schemaContractVersion: "namespring.seed-db-schema/name-stat-v1",
      schemaContractSha256: "7e784368d4ddbe4151c9a0b21f3a6b8f22fe153f668c90e2a973121222e42a2f",
      table: "name_stats",
      columns: NAME_STAT_COLUMNS,
      rowCount: 6968,
      shardKey: "ㅅ",
    },
    {
      assetId: "name-stat-08",
      relativePath: "namespring/public/data/name-stat-shards/08.db",
      byteLength: 24469504,
      sha256: "a7675916c781586e474654781311aa128c533e41388e50dc4b6c88207183df87",
      userVersion: 0,
      schemaContractVersion: "namespring.seed-db-schema/name-stat-v1",
      schemaContractSha256: "7e784368d4ddbe4151c9a0b21f3a6b8f22fe153f668c90e2a973121222e42a2f",
      table: "name_stats",
      columns: NAME_STAT_COLUMNS,
      rowCount: 13644,
      shardKey: "ㅇ",
    },
    {
      assetId: "name-stat-09",
      relativePath: "namespring/public/data/name-stat-shards/09.db",
      byteLength: 7745536,
      sha256: "792f70865a9afaf7d2d97439687bd1caefe7d01f2d1ec92f194cd7412d3f0932",
      userVersion: 0,
      schemaContractVersion: "namespring.seed-db-schema/name-stat-v1",
      schemaContractSha256: "7e784368d4ddbe4151c9a0b21f3a6b8f22fe153f668c90e2a973121222e42a2f",
      table: "name_stats",
      columns: NAME_STAT_COLUMNS,
      rowCount: 2199,
      shardKey: "ㅈ",
    },
    {
      assetId: "name-stat-10",
      relativePath: "namespring/public/data/name-stat-shards/10.db",
      byteLength: 3178496,
      sha256: "c14a9899d45219ac2388127293c50ad517ee4a438264488527a9267d0253fcb2",
      userVersion: 0,
      schemaContractVersion: "namespring.seed-db-schema/name-stat-v1",
      schemaContractSha256: "7e784368d4ddbe4151c9a0b21f3a6b8f22fe153f668c90e2a973121222e42a2f",
      table: "name_stats",
      columns: NAME_STAT_COLUMNS,
      rowCount: 1152,
      shardKey: "ㅊ",
    },
    {
      assetId: "name-stat-11",
      relativePath: "namespring/public/data/name-stat-shards/11.db",
      byteLength: 413696,
      sha256: "4a4c69f98074026d07a5a8cbf9512ae269e80e9332535274c1b2757063c43f6c",
      userVersion: 0,
      schemaContractVersion: "namespring.seed-db-schema/name-stat-v1",
      schemaContractSha256: "7e784368d4ddbe4151c9a0b21f3a6b8f22fe153f668c90e2a973121222e42a2f",
      table: "name_stats",
      columns: NAME_STAT_COLUMNS,
      rowCount: 309,
      shardKey: "ㅋ",
    },
    {
      assetId: "name-stat-12",
      relativePath: "namespring/public/data/name-stat-shards/12.db",
      byteLength: 1142784,
      sha256: "e387822821ae62314f196ba3f43484c2610d6c37f39365ef440ac1ea5443e1de",
      userVersion: 0,
      schemaContractVersion: "namespring.seed-db-schema/name-stat-v1",
      schemaContractSha256: "7e784368d4ddbe4151c9a0b21f3a6b8f22fe153f668c90e2a973121222e42a2f",
      table: "name_stats",
      columns: NAME_STAT_COLUMNS,
      rowCount: 461,
      shardKey: "ㅌ",
    },
    {
      assetId: "name-stat-13",
      relativePath: "namespring/public/data/name-stat-shards/13.db",
      byteLength: 524288,
      sha256: "345d9ba75c77815501fe2326f0322725ed9195928aecbaeb877a53539e16ac90",
      userVersion: 0,
      schemaContractVersion: "namespring.seed-db-schema/name-stat-v1",
      schemaContractSha256: "7e784368d4ddbe4151c9a0b21f3a6b8f22fe153f668c90e2a973121222e42a2f",
      table: "name_stats",
      columns: NAME_STAT_COLUMNS,
      rowCount: 259,
      shardKey: "ㅍ",
    },
    {
      assetId: "name-stat-14",
      relativePath: "namespring/public/data/name-stat-shards/14.db",
      byteLength: 8249344,
      sha256: "5ede9fbf94e8c3ae01d43ae2c2e6f810c879ef123045ceb754b4176efac1719d",
      userVersion: 0,
      schemaContractVersion: "namespring.seed-db-schema/name-stat-v1",
      schemaContractSha256: "7e784368d4ddbe4151c9a0b21f3a6b8f22fe153f668c90e2a973121222e42a2f",
      table: "name_stats",
      columns: NAME_STAT_COLUMNS,
      rowCount: 2892,
      shardKey: "ㅎ",
    },
  ],
} as const;
