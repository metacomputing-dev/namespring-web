import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { NameEvaluator, toLegacyInterpretationText } from "./core/evaluator.js";
import { parseCompleteName } from "./core/query.js";
import { NameSearchService, normalizeSearchRequest } from "./core/search.js";
import { SqliteHanjaRepository } from "./core/sqlite-hanja-repository.js";
import { openSqliteDatabase } from "./core/sqlite-runtime.js";
import { SqliteStatsRepository } from "./core/sqlite-stats-repository.js";
import type {
  BirthInfo,
  EvaluateRequest,
  Gender,
  LuckyLevel,
  NameInput,
  SearchRequest,
  SearchResult,
  SeedOptions,
  SeedResponse,
} from "./core/types.js";
import { normalizeText, toRoundedInt } from "./core/utils.js";

interface SagyeokRow {
  number: unknown;
  lucky_level: unknown;
}

interface SeedTsUserInfo {
  lastName: string;
  firstName: string;
  birthDateTime?: Partial<BirthInfo>;
  gender?: Gender | string;
}

interface SeedTsCandidate {
  lastName: string;
  firstName: string;
  totalScore: number;
  interpretation: string;
  raw: SeedResponse;
}

interface SeedTsResult {
  candidates: SeedTsCandidate[];
  totalCount: number;
  gender?: Gender | string;
}

const POSITIVE_LEVELS = new Set<LuckyLevel>([
  "\uCD5C\uC0C1\uC6B4\uC218",
  "\uC0C1\uC6B4\uC218",
  "\uC591\uC6B4\uC218",
]);

function isNameInput(value: unknown): value is NameInput {
  if (!value || typeof value !== "object") {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v.lastNameHangul === "string" &&
    typeof v.lastNameHanja === "string" &&
    typeof v.firstNameHangul === "string" &&
    typeof v.firstNameHanja === "string"
  );
}

function normalizeLevel(value: unknown): LuckyLevel {
  const text = normalizeText(String(value ?? ""));
  if (text.includes("\uCD5C\uC0C1\uC6B4\uC218")) return "\uCD5C\uC0C1\uC6B4\uC218";
  if (text.includes("\uC0C1\uC6B4\uC218")) return "\uC0C1\uC6B4\uC218";
  if (text.includes("\uC591\uC6B4\uC218")) return "\uC591\uC6B4\uC218";
  if (text.includes("\uCD5C\uD749\uC6B4\uC218")) return "\uCD5C\uD749\uC6B4\uC218";
  if (text.includes("\uD749\uC6B4\uC218")) return "\uD749\uC6B4\uC218";
  return "\uBBF8\uC815";
}

function extractSqliteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return toRoundedInt(value);
  }
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function loadFourFrameMapFromSqlite(sqlitePath: string): Map<number, LuckyLevel> {
  const db = openSqliteDatabase(sqlitePath);
  try {
    const stmt = db.prepare("SELECT number, lucky_level FROM sagyeok_data ORDER BY number");
    const rows = stmt.all() as SagyeokRow[];
    const out = new Map<number, LuckyLevel>();
    for (const row of rows) {
      const number = extractSqliteNumber(row.number);
      if (number === null) {
        continue;
      }
      out.set(number, normalizeLevel(row.lucky_level));
    }
    return out;
  } catch (error) {
    throw new Error("failed to load `sagyeok_data` from sqlite database", {
      cause: error as Error,
    });
  } finally {
    db.close?.();
  }
}

function resolveSqlitePath(dataRoot: string, configuredPath?: string): string {
  const configured = configuredPath?.trim();
  if (configured && configured.length > 0) {
    return configured;
  }

  const root = dataRoot.trim();
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  const candidates = [
    path.join(root, "sqlite", "seed.db"),
    path.resolve(currentDir, "../main/resources/seed/data/sqlite/seed.db"),
    path.resolve(currentDir, "../../src/main/resources/seed/data/sqlite/seed.db"),
    path.resolve(process.cwd(), "lib/seed-ts/src/main/resources/seed/data/sqlite/seed.db"),
    path.resolve(process.cwd(), "src/main/resources/seed/data/sqlite/seed.db"),
    path.resolve(process.cwd(), "lib/seed-ts/data/sqlite/seed.db"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return candidates[0] as string;
}

function extractValidFourFrameNumbers(map: Map<number, LuckyLevel>): Set<number> {
  const out = new Set<number>();
  for (const [num, level] of map.entries()) {
    if (POSITIVE_LEVELS.has(level)) {
      out.add(num);
    }
  }
  return out;
}

class Runtime {
  readonly includeSaju: boolean;
  readonly hanja: SqliteHanjaRepository;
  readonly stats: SqliteStatsRepository;
  readonly evaluator: NameEvaluator;
  readonly search: NameSearchService;

  constructor(options: SeedOptions) {
    this.includeSaju = options.includeSaju ?? false;

    const sqlitePath = resolveSqlitePath(
      options.dataRoot ?? path.resolve(process.cwd(), "lib/seed-ts/src/main/resources/seed/data"),
      options.sqlite?.path,
    );
    const sqliteUseFor = options.sqlite?.useFor ?? "all";
    if (sqliteUseFor !== "all") {
      throw new Error("`sqlite.useFor` must be `all` in sqlite-only runtime mode.");
    }
    if (!fs.existsSync(sqlitePath)) {
      throw new Error(
        `SQLite database not found: ${sqlitePath}. Run \`npm run sqlite:build\` in \`lib/seed-ts\` first.`,
      );
    }

    this.hanja = SqliteHanjaRepository.create(sqlitePath);
    this.stats = SqliteStatsRepository.create(sqlitePath);

    const luckyMap = loadFourFrameMapFromSqlite(sqlitePath);
    if (luckyMap.size === 0) {
      throw new Error("`sagyeok_data` is empty in sqlite database. Rebuild sqlite data first.");
    }
    const validFourFrame = extractValidFourFrameNumbers(luckyMap);
    this.evaluator = new NameEvaluator(
      luckyMap,
      this.stats,
      this.includeSaju,
      options.sajuBaseDistribution,
    );
    this.search = new NameSearchService(this.hanja, this.stats, this.evaluator, validFourFrame);
  }
}

function toEvaluateInput(
  source: EvaluateRequest | NameInput | string,
  defaultIncludeSaju: boolean,
): { name: NameInput; birth?: BirthInfo; includeSaju: boolean } {
  if (typeof source === "string") {
    const parsed = parseCompleteName(source);
    if (!parsed) throw new Error("invalid evaluate query");
    return { name: parsed, includeSaju: defaultIncludeSaju };
  }
  if (isNameInput(source)) {
    return { name: source, includeSaju: defaultIncludeSaju };
  }
  if (source.name) {
    return { name: source.name, birth: source.birth, includeSaju: source.includeSaju ?? defaultIncludeSaju };
  }
  if (source.query) {
    const parsed = parseCompleteName(source.query);
    if (!parsed) throw new Error("query is not complete evaluate input");
    return { name: parsed, birth: source.birth, includeSaju: source.includeSaju ?? defaultIncludeSaju };
  }
  throw new Error("evaluate input requires name or query");
}

export class Seed {
  private static shared: Runtime | null = null;
  private readonly runtime: Runtime;

  constructor(options: SeedOptions = {}) {
    const hasCustom =
      options.dataRoot !== undefined ||
      options.includeSaju !== undefined ||
      options.sqlite !== undefined ||
      options.sajuBaseDistribution !== undefined;
    if (!hasCustom) {
      if (!Seed.shared) {
        Seed.shared = new Runtime({});
      }
      this.runtime = Seed.shared;
    } else {
      this.runtime = new Runtime(options);
    }
  }

  evaluate(source: EvaluateRequest | NameInput | string, _birth?: BirthInfo, _gender?: Gender): SeedResponse {
    const input = toEvaluateInput(source, this.runtime.includeSaju);
    return this.runtime.search.evaluateName(input.name, input.birth, input.includeSaju);
  }

  search(request: SearchRequest): SearchResult {
    return this.runtime.search.search(normalizeSearchRequest(request));
  }
}

function underscoreByLength(value: string): string {
  return "_".repeat(Array.from(value).length);
}

function makeQuery(lastName: string, firstName: string): string {
  let out = `[${lastName}/${underscoreByLength(lastName)}]`;
  for (const c of Array.from(firstName)) {
    out += `[${c}/_]`;
  }
  return out;
}

export class SeedTs {
  private readonly seed: Seed;

  constructor(options: SeedOptions = {}) {
    this.seed = new Seed(options);
  }

  analyze(userInfo: SeedTsUserInfo): SeedTsResult {
    const result = this.seed.search({
      query: makeQuery(userInfo.lastName, userInfo.firstName),
      limit: 1,
      offset: 0,
      includeSaju: false,
      gender: (userInfo.gender as Gender) ?? "NONE",
      birth:
        userInfo.birthDateTime &&
        typeof userInfo.birthDateTime.year === "number" &&
        typeof userInfo.birthDateTime.month === "number" &&
        typeof userInfo.birthDateTime.day === "number" &&
        typeof userInfo.birthDateTime.hour === "number" &&
        typeof userInfo.birthDateTime.minute === "number"
          ? {
              year: userInfo.birthDateTime.year,
              month: userInfo.birthDateTime.month,
              day: userInfo.birthDateTime.day,
              hour: userInfo.birthDateTime.hour,
              minute: userInfo.birthDateTime.minute,
            }
          : undefined,
    });

    const top = result.responses[0];
    if (top) {
      return {
        candidates: [
          {
            lastName: top.name.lastNameHangul,
            firstName: top.name.firstNameHangul,
            totalScore: top.interpretation.score,
            interpretation: toLegacyInterpretationText(top),
            raw: top,
          },
        ],
        totalCount: result.totalCount,
        gender: userInfo.gender,
      };
    }

    const fallback = this.seed.evaluate({
      name: {
        lastNameHangul: userInfo.lastName,
        lastNameHanja: underscoreByLength(userInfo.lastName),
        firstNameHangul: userInfo.firstName,
        firstNameHanja: underscoreByLength(userInfo.firstName),
      },
      includeSaju: false,
    });

    return {
      candidates: [
        {
          lastName: fallback.name.lastNameHangul,
          firstName: fallback.name.firstNameHangul,
          totalScore: fallback.interpretation.score,
          interpretation: toLegacyInterpretationText(fallback),
          raw: fallback,
        },
      ],
      totalCount: 1,
      gender: userInfo.gender,
    };
  }
}
