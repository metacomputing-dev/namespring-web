import path from "node:path";

import { NameEvaluator, toLegacyInterpretationText } from "./core/evaluator.js";
import { InMemoryHanjaRepository } from "./core/hanja-repository.js";
import { parseCompleteName } from "./core/query.js";
import { readJsonSync, resolveSeedDataRoot } from "./core/resource.js";
import { NameSearchService, normalizeSearchRequest } from "./core/search.js";
import { SqliteHanjaRepository } from "./core/sqlite-hanja-repository.js";
import { SqliteStatsRepository } from "./core/sqlite-stats-repository.js";
import { InMemoryStatsRepository } from "./core/stats-repository.js";
import type {
  BirthInfo,
  EvaluateRequest,
  Gender,
  HanjaRepository,
  LuckyLevel,
  NameInput,
  SearchRequest,
  SearchResult,
  SeedOptions,
  SeedResponse,
  StatsRepository,
} from "./core/types.js";
import { normalizeText, toRoundedInt } from "./core/utils.js";

interface RawFourFrameRow {
  [key: string]: unknown;
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

function extractNumber(row: RawFourFrameRow): number | null {
  const keys = ["su", "number", "num", "value", "sagyeoksu", "stroke"];
  for (const key of keys) {
    const v = row[key];
    if (typeof v === "number" && Number.isFinite(v)) return toRoundedInt(v);
    if (typeof v === "string") {
      const n = Number.parseInt(v, 10);
      if (!Number.isNaN(n)) return n;
    }
  }
  for (const v of Object.values(row)) {
    if (typeof v === "number" && Number.isFinite(v) && v >= 1 && v <= 200) return toRoundedInt(v);
    if (typeof v === "string") {
      const n = Number.parseInt(v, 10);
      if (!Number.isNaN(n) && n >= 1 && n <= 200) return n;
    }
  }
  return null;
}

function extractLevel(row: RawFourFrameRow): LuckyLevel {
  const keys = ["lucky_level", "luckyLevel", "level", "grade", "category"];
  for (const key of keys) {
    if (key in row) {
      return normalizeLevel(row[key]);
    }
  }
  for (const value of Object.values(row)) {
    const level = normalizeLevel(value);
    if (level !== "\uBBF8\uC815") return level;
  }
  return "\uBBF8\uC815";
}

function loadFourFrameMap(dataRoot: string): Map<number, LuckyLevel> {
  const rows = readJsonSync<unknown>(path.join(dataRoot, "sagyeoksu_data.json"));
  const out = new Map<number, LuckyLevel>();
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (!row || typeof row !== "object") {
        continue;
      }
      const rec = row as RawFourFrameRow;
      const num = extractNumber(rec);
      if (num === null) continue;
      out.set(num, extractLevel(rec));
    }
    return out;
  }

  if (rows && typeof rows === "object") {
    const root = rows as Record<string, unknown>;
    const meanings = root.sagyeoksu_meanings;
    if (meanings && typeof meanings === "object") {
      for (const [key, raw] of Object.entries(meanings as Record<string, unknown>)) {
        if (!raw || typeof raw !== "object") {
          continue;
        }
        const rec = raw as RawFourFrameRow;
        const num = extractNumber({ number: key, ...rec });
        if (num === null) {
          continue;
        }
        out.set(num, extractLevel(rec));
      }
    }
  }
  return out;
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
  readonly dataRoot: string;
  readonly includeSaju: boolean;
  readonly hanja: HanjaRepository;
  readonly stats: StatsRepository;
  readonly evaluator: NameEvaluator;
  readonly search: NameSearchService;

  constructor(options: SeedOptions) {
    this.dataRoot = resolveSeedDataRoot(options.dataRoot);
    this.includeSaju = options.includeSaju ?? false;

    const sqlitePath = options.sqlite?.path?.trim();
    if (options.sqlite && !sqlitePath) {
      throw new Error("`SeedOptions.sqlite.path` is required when sqlite option is provided.");
    }
    const sqliteUseFor = options.sqlite?.useFor ?? "all";
    const useSqliteHanja = Boolean(sqlitePath) && (sqliteUseFor === "all" || sqliteUseFor === "hanja");
    const useSqliteStats = Boolean(sqlitePath) && (sqliteUseFor === "all" || sqliteUseFor === "stats");

    this.hanja =
      options.hanjaRepository ??
      (useSqliteHanja
        ? SqliteHanjaRepository.create(sqlitePath as string)
        : InMemoryHanjaRepository.create(this.dataRoot));
    this.stats =
      options.statsRepository ??
      (useSqliteStats
        ? SqliteStatsRepository.create(sqlitePath as string)
        : InMemoryStatsRepository.create(this.dataRoot));

    const luckyMap = loadFourFrameMap(this.dataRoot);
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
      options.hanjaRepository !== undefined ||
      options.statsRepository !== undefined ||
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
