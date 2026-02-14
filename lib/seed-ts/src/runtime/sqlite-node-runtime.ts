import { NameEvaluator } from "../core/evaluator.js";
import { NameSearchService } from "../core/search.js";
import { SqliteHanjaRepository } from "../core/sqlite-hanja-repository.js";
import {
  configureSqliteDatabaseOpener,
  type SqliteDatabase,
  type SqliteDatabaseOpener,
} from "../core/sqlite-runtime.js";
import { SqliteStatsRepository } from "../core/sqlite-stats-repository.js";
import type { RuntimeContext } from "../engine/ports/runtime-ports.js";
import {
  ensureFourFrameLevelMapNotEmpty,
  extractPositiveFourFrameNumbers,
  loadFourFrameLevelMapFromSqlite,
} from "../engine/infrastructure/sqlite/sqlite-four-frame.js";
import type { SeedClientOptions } from "./options.js";

interface NodeSqliteModule {
  DatabaseSync: new (path: string) => SqliteDatabase;
}

interface NodeFsModule {
  existsSync(path: string): boolean;
}

interface NodePathModule {
  dirname(path: string): string;
  join(...parts: string[]): string;
  resolve(...parts: string[]): string;
}

interface NodeUrlModule {
  fileURLToPath(url: string): string;
}

type BuiltinLoader = (id: string) => unknown;

interface NodeProcessLike {
  cwd?: () => string;
  getBuiltinModule?: BuiltinLoader;
}

function getNodeProcess(): NodeProcessLike {
  return (globalThis as { process?: NodeProcessLike }).process ?? {};
}

function loadNodeBuiltin<T>(id: string): T {
  const processObject = getNodeProcess();
  const loader = processObject.getBuiltinModule;
  if (typeof loader !== "function") {
    throw new Error("Node built-in module loader is not available in this runtime.");
  }

  const nodeId = id.startsWith("node:") ? id : `node:${id}`;
  const plainId = nodeId.replace(/^node:/, "");
  const loaded = loader(nodeId) ?? loader(plainId);
  if (!loaded) {
    throw new Error(`Failed to load Node built-in module: ${nodeId}`);
  }
  return loaded as T;
}

function getNodeCwd(): string {
  const processObject = getNodeProcess();
  if (typeof processObject.cwd === "function") {
    return processObject.cwd();
  }
  return ".";
}

function getPathModule(): NodePathModule {
  return loadNodeBuiltin<NodePathModule>("node:path");
}

function getFsModule(): NodeFsModule {
  return loadNodeBuiltin<NodeFsModule>("node:fs");
}

function getUrlModule(): NodeUrlModule {
  return loadNodeBuiltin<NodeUrlModule>("node:url");
}

function getDefaultDataRoot(): string {
  const path = getPathModule();
  return path.resolve(getNodeCwd(), "lib/seed-ts/src/main/resources/seed/data");
}

export function openNodeSqliteDatabase(dbPath: string): SqliteDatabase {
  const normalized = (dbPath ?? "").trim();
  if (!normalized) {
    throw new Error("SQLite database path is required.");
  }

  try {
    const sqlite = loadNodeBuiltin<NodeSqliteModule>("node:sqlite");
    return new sqlite.DatabaseSync(normalized);
  } catch (error) {
    throw new Error("`node:sqlite` is not available in this Node runtime.", {
      cause: error as Error,
    });
  }
}

export function resolveNodeSqlitePath(dataRoot: string, configuredPath?: string): string {
  const configured = configuredPath?.trim();
  if (configured && configured.length > 0) {
    return configured;
  }

  const path = getPathModule();
  const fs = getFsModule();
  const url = getUrlModule();
  const root = dataRoot.trim();
  const currentFile = url.fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  const cwd = getNodeCwd();

  const candidates = [
    path.join(root, "sqlite", "seed.db"),
    path.resolve(currentDir, "../main/resources/seed/data/sqlite/seed.db"),
    path.resolve(cwd, "lib/seed-ts/src/main/resources/seed/data/sqlite/seed.db"),
    path.resolve(cwd, "src/main/resources/seed/data/sqlite/seed.db"),
    path.resolve(cwd, "lib/seed-ts/data/sqlite/seed.db"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0] as string;
}

export function ensureNodeSqliteFileExists(sqlitePath: string): void {
  const fs = getFsModule();
  if (!fs.existsSync(sqlitePath)) {
    throw new Error(
      `SQLite database not found: ${sqlitePath}. Run \`npm run sqlite:build\` in \`lib/seed-ts\` first.`,
    );
  }
}

export function createSqliteNodeRuntimeContext(options: SeedClientOptions): RuntimeContext {
  const includeSaju = true;
  const sqliteUseFor = options.sqlite?.useFor ?? "all";

  if (sqliteUseFor !== "all") {
    throw new Error("`sqlite.useFor` must be `all` in sqlite-node runtime mode.");
  }

  const sqlitePath = resolveNodeSqlitePath(options.dataRoot ?? getDefaultDataRoot(), options.sqlite?.path);
  ensureNodeSqliteFileExists(sqlitePath);

  const opener: SqliteDatabaseOpener = openNodeSqliteDatabase;
  configureSqliteDatabaseOpener(opener);

  const hanja = SqliteHanjaRepository.create(sqlitePath, opener);
  const stats = SqliteStatsRepository.create(sqlitePath, opener);

  const fourFrameLevelMap = loadFourFrameLevelMapFromSqlite(sqlitePath, opener);
  ensureFourFrameLevelMapNotEmpty(fourFrameLevelMap);
  const validFourFrame = extractPositiveFourFrameNumbers(fourFrameLevelMap);

  const evaluator = new NameEvaluator(fourFrameLevelMap, stats, includeSaju, options.sajuBaseDistribution);
  const searchService = new NameSearchService(hanja, stats, evaluator, validFourFrame);

  return {
    includeSaju,
    searchService,
    hanjaRepository: hanja,
  };
}
