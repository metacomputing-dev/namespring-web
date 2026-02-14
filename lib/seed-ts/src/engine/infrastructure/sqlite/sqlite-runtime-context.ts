import path from "node:path";

import { NameEvaluator } from "../../../core/evaluator.js";
import { NameSearchService } from "../../../core/search.js";
import { SqliteHanjaRepository } from "../../../core/sqlite-hanja-repository.js";
import { SqliteStatsRepository } from "../../../core/sqlite-stats-repository.js";
import type { SeedOptions } from "../../../core/types.js";
import type { RuntimeContextFactory } from "../../ports/runtime-factory.js";
import type { RuntimeContext } from "../../ports/runtime-ports.js";
import { ensureSqliteFileExists, resolveSqlitePath } from "./sqlite-path.js";
import {
  ensureFourFrameLevelMapNotEmpty,
  extractPositiveFourFrameNumbers,
  loadFourFrameLevelMapFromSqlite,
} from "./sqlite-four-frame.js";

export function createSqliteRuntimeContext(options: SeedOptions): RuntimeContext {
  const includeSaju = true;
  const sqlitePath = resolveSqlitePath(
    options.dataRoot ?? path.resolve(process.cwd(), "lib/seed-ts/src/main/resources/seed/data"),
    options.sqlite?.path,
  );
  const sqliteUseFor = options.sqlite?.useFor ?? "all";

  if (sqliteUseFor !== "all") {
    throw new Error("`sqlite.useFor` must be `all` in sqlite-only runtime mode.");
  }
  ensureSqliteFileExists(sqlitePath);

  const hanja = SqliteHanjaRepository.create(sqlitePath);
  const stats = SqliteStatsRepository.create(sqlitePath);

  const fourFrameLevelMap = loadFourFrameLevelMapFromSqlite(sqlitePath);
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

export const SQLITE_RUNTIME_CONTEXT_FACTORY: RuntimeContextFactory = {
  create: createSqliteRuntimeContext,
};
