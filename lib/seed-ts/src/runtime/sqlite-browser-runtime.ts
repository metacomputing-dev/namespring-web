import { NameEvaluator } from "../core/evaluator.js";
import { NameSearchService } from "../core/search.js";
import { SqliteHanjaRepository } from "../core/sqlite-hanja-repository.js";
import type { SqliteDatabase } from "../core/sqlite-runtime.js";
import { SqliteStatsRepository } from "../core/sqlite-stats-repository.js";
import type { RuntimeContext } from "../engine/ports/runtime-ports.js";
import {
  ensureFourFrameLevelMapNotEmpty,
  extractPositiveFourFrameNumbers,
  loadFourFrameLevelMapFromDatabase,
} from "../engine/infrastructure/sqlite/sqlite-four-frame.js";
import type { BrowserWasmRuntimeOption, SeedClientOptions } from "./options.js";
import { createSqlJsDatabaseAdapter } from "./sqlite-browser-driver.js";

function resolveBrowserDatabase(option: BrowserWasmRuntimeOption): SqliteDatabase {
  if (option.database) {
    return option.database;
  }
  if (option.sqlJsDatabase) {
    return createSqlJsDatabaseAdapter(option.sqlJsDatabase);
  }
  throw new Error("`runtime.database` or `runtime.sqlJsDatabase` is required for browser-wasm runtime.");
}

export function createBrowserWasmRuntimeContext(options: SeedClientOptions): RuntimeContext {
  const runtimeOption = options.runtime;
  if (!runtimeOption || runtimeOption.strategy !== "browser-wasm") {
    throw new Error("browser-wasm runtime strategy options are required.");
  }

  const includeSaju = options.includeSaju ?? false;
  const sqliteUseFor = options.sqlite?.useFor ?? "all";
  if (sqliteUseFor !== "all") {
    throw new Error("`sqlite.useFor` must be `all` in browser-wasm runtime mode.");
  }

  const database = resolveBrowserDatabase(runtimeOption);

  const hanja = SqliteHanjaRepository.fromDatabase(database);
  const stats = SqliteStatsRepository.fromDatabase(database);

  const fourFrameLevelMap = loadFourFrameLevelMapFromDatabase(database);
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
