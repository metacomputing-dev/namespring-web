import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { FourframeRepository } from "../../../lib/seed-ts/src/database/fourframe-repository.js";
import { HanjaRepository } from "../../../lib/seed-ts/src/database/hanja-repository.js";
import {
  FOURFRAME_DATABASE_ASSET,
  HANJA_DATABASE_ASSET,
} from "../../../lib/seed-ts/src/database/database-asset-registry.js";
import { DEFAULT_SQL_JS_WASM_SHA256 } from "../../../lib/seed-ts/src/database/repository-runtime.js";
import { NAME_STAT_SUMMARY_ASSET_PROVENANCE } from "../../../lib/spring-ts/src/name-stat-summary-asset.generated.js";
import { NameStatSummaryRepository } from "../../../lib/spring-ts/src/name-stat-summary-repository.js";
import { SpringEngine } from "../../../lib/spring-ts/src/spring-engine.js";

export const SERVER_SPRING_ENGINE_ASSET_ERROR =
  "SERVER_SPRING_ENGINE_ASSET_UNAVAILABLE" as const;
export const SERVER_SPRING_ENGINE_ASSET_INTEGRITY_ERROR =
  "SERVER_SPRING_ENGINE_ASSET_INTEGRITY_MISMATCH" as const;

export class ServerSpringEngineAssetError extends Error {
  public readonly code = SERVER_SPRING_ENGINE_ASSET_ERROR;

  public constructor(readonly asset: string) {
    super(`Required SpringEngine server asset is unavailable: ${asset}.`);
    this.name = "ServerSpringEngineAssetError";
  }
}

export class ServerSpringEngineAssetIntegrityError extends Error {
  public readonly code = SERVER_SPRING_ENGINE_ASSET_INTEGRITY_ERROR;

  public constructor(readonly asset: string) {
    super(`Required SpringEngine server asset failed its pinned integrity check: ${asset}.`);
    this.name = "ServerSpringEngineAssetIntegrityError";
  }
}

export interface ServerSpringEngineAssetPathsV1 {
  readonly hanjaDatabase?: string;
  readonly fourFrameDatabase?: string;
  readonly sqlWasm?: string;
  readonly nameStatSummary?: string;
}

const verifiedServerAssetPaths = new Set<string>();

const SERVER_ASSET_SHA256: Readonly<Record<keyof ServerSpringEngineAssetPathsV1, string>> = {
  hanjaDatabase: HANJA_DATABASE_ASSET.sha256,
  fourFrameDatabase: FOURFRAME_DATABASE_ASSET.sha256,
  sqlWasm: DEFAULT_SQL_JS_WASM_SHA256,
  nameStatSummary: NAME_STAT_SUMMARY_ASSET_PROVENANCE.compressedSha256,
};

function firstExistingFile(asset: string, candidates: readonly string[]): URL {
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) return pathToFileURL(candidate);
    } catch {
      // Try the next deterministic deployment/source-tree location.
    }
  }
  throw new ServerSpringEngineAssetError(asset);
}

function configuredFile(
  asset: string,
  configuredPath: string | undefined,
  defaults: readonly string[],
): URL {
  if (configuredPath !== undefined) {
    const trimmed = configuredPath.trim();
    if (trimmed.length === 0) throw new ServerSpringEngineAssetError(asset);
    return firstExistingFile(asset, [resolve(process.cwd(), trimmed)]);
  }
  return firstExistingFile(asset, defaults);
}

function sourceRelative(relativePath: string): string {
  return fileURLToPath(new URL(relativePath, import.meta.url));
}

function resolveServerAssets(
  overrides: ServerSpringEngineAssetPathsV1,
): Required<Record<keyof ServerSpringEngineAssetPathsV1, URL>> {
  const cwd = process.cwd();
  return {
    hanjaDatabase: configuredFile(
      "hanjaDatabase",
      overrides.hanjaDatabase ?? process.env.NAMESPRING_ENGINE_HANJA_DB_FILE,
      [
        resolve(cwd, "public/data/hanja.db"),
        resolve(cwd, "namespring/public/data/hanja.db"),
        sourceRelative("../../public/data/hanja.db"),
      ],
    ),
    fourFrameDatabase: configuredFile(
      "fourFrameDatabase",
      overrides.fourFrameDatabase ?? process.env.NAMESPRING_ENGINE_FOURFRAME_DB_FILE,
      [
        resolve(cwd, "public/data/fourframe.db"),
        resolve(cwd, "namespring/public/data/fourframe.db"),
        sourceRelative("../../public/data/fourframe.db"),
      ],
    ),
    sqlWasm: configuredFile(
      "sqlWasm",
      overrides.sqlWasm ?? process.env.NAMESPRING_ENGINE_SQL_WASM_FILE,
      [
        resolve(cwd, "../lib/seed-ts/assets/sql-wasm-1.14.1.wasm"),
        resolve(cwd, "lib/seed-ts/assets/sql-wasm-1.14.1.wasm"),
        sourceRelative("../../../lib/seed-ts/assets/sql-wasm-1.14.1.wasm"),
      ],
    ),
    nameStatSummary: configuredFile(
      "nameStatSummary",
      overrides.nameStatSummary ?? process.env.NAMESPRING_ENGINE_NAME_STAT_FILE,
      [
        resolve(cwd, "../lib/spring-ts/data/name-stat/name-stat-summary.v1.bin"),
        resolve(cwd, "lib/spring-ts/data/name-stat/name-stat-summary.v1.bin"),
        sourceRelative("../../../lib/spring-ts/data/name-stat/name-stat-summary.v1.bin"),
      ],
    ),
  };
}

function verifyServerAssetOnce(
  asset: keyof ServerSpringEngineAssetPathsV1,
  url: URL,
): void {
  const expectedSha256 = SERVER_ASSET_SHA256[asset];
  const absolutePath = resolve(fileURLToPath(url));
  const cacheKey = `${asset}\0${absolutePath}\0${expectedSha256}`;
  if (verifiedServerAssetPaths.has(cacheKey)) return;
  let bytes: Buffer;
  try {
    bytes = readFileSync(absolutePath);
  } catch {
    throw new ServerSpringEngineAssetError(asset);
  }
  const actualSha256 = createHash("sha256").update(bytes).digest("hex");
  if (actualSha256 !== expectedSha256) {
    throw new ServerSpringEngineAssetIntegrityError(asset);
  }
  verifiedServerAssetPaths.add(cacheKey);
}

/**
 * Build the paid-report engine with file-only, integrity-checked repositories.
 * This deliberately has no HTTP fallback: a missing deployment artifact must
 * fail before charging or producing a server report.
 */
export function createServerSpringEngineV1(
  overrides: ServerSpringEngineAssetPathsV1 = {},
): SpringEngine {
  const assets = resolveServerAssets(overrides);
  for (const asset of Object.keys(assets) as (keyof ServerSpringEngineAssetPathsV1)[]) {
    verifyServerAssetOnce(asset, assets[asset]);
  }
  const wasmUrl = assets.sqlWasm.href;
  return new SpringEngine({
    repositories: {
      hanja: new HanjaRepository({
        dbUrl: assets.hanjaDatabase.href,
        wasmUrl,
        wasmSha256: DEFAULT_SQL_JS_WASM_SHA256,
      }),
      fourFrame: new FourframeRepository({
        dbUrl: assets.fourFrameDatabase.href,
        wasmUrl,
        wasmSha256: DEFAULT_SQL_JS_WASM_SHA256,
      }),
      nameStat: new NameStatSummaryRepository({
        assetUrl: assets.nameStatSummary,
      }),
    },
  });
}
