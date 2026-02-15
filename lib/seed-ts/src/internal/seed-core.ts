export type Gender = "MALE" | "FEMALE" | "NONE" | "male" | "female" | "none";
export type Element = "WOOD" | "FIRE" | "EARTH" | "METAL" | "WATER";
export type Polarity = "YIN" | "YANG";
export type LuckyLevel = "TOP" | "HIGH" | "GOOD" | "BAD" | "WORST" | "UNKNOWN";
export type Status = "POSITIVE" | "NEUTRAL" | "NEGATIVE";

export type Frame =
  | "NAME_STUDY"
  | "FOUR_FRAME_FORTUNE"
  | "FOUR_FRAME_ELEMENT"
  | "STROKE_ELEMENT"
  | "STROKE_POLARITY"
  | "PRONUNCIATION_ELEMENT"
  | "PRONUNCIATION_POLARITY"
  | "SAJU_ROOT_BALANCE"
  | "STATISTICS"
  | "ROOT_ELEMENT"
  | "POLARITY_HARMONY";

export interface Energy {
  element: Element;
  polarity: Polarity;
}

export interface FourFrame {
  origin: number;
  form: number;
  profit: number;
  harmony: number;
}

export interface BirthInfo {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export interface NameBlock {
  korean: string;
  hanja: string;
}

export interface NameCombination {
  korean: string;
  hanja: string;
}

export interface NameQuery {
  surnameBlocks: NameBlock[];
  nameBlocks: NameBlock[];
}

export interface ResolvedName {
  surname: HanjaEntry[];
  given: HanjaEntry[];
}

export interface NameInput {
  lastNameHangul: string;
  lastNameHanja: string;
  firstNameHangul: string;
  firstNameHanja: string;
}

export interface EvaluateRequest {
  query?: string;
  name?: NameInput;
  birth?: BirthInfo;
  gender?: Gender;
  includeSaju?: boolean;
}

export interface SearchRequest {
  query: string;
  birth?: BirthInfo;
  year?: number;
  month?: number;
  day?: number;
  hour?: number;
  minute?: number;
  gender?: Gender;
  includeSaju?: boolean;
  limit?: number;
  offset?: number;
}

export interface FrameInsight {
  frame: Frame;
  score: number;
  isPassed: boolean;
  status: Status;
  arrangement: string;
  details: Record<string, unknown>;
}

export interface Interpretation {
  score: number;
  isPassed: boolean;
  status: Status;
  categories: FrameInsight[];
}

export interface NameStatistics {
  similarNames: string[];
  totalRankByYear: Record<number, number>;
  maleRankByYear: Record<number, number>;
  totalBirthByYear: Record<number, number>;
  maleBirthByYear: Record<number, number>;
  hanjaCombinations: string[];
}

export interface SeedResponse {
  name: NameInput;
  interpretation: Interpretation;
  categoryMap: Record<Frame, FrameInsight>;
  statistics: NameStatistics | null;
}

export interface SearchResult {
  query: string;
  totalCount: number;
  responses: SeedResponse[];
  truncated: boolean;
}

export interface HanjaEntry {
  hangul: string;
  hanja: string;
  meaning: string;
  strokeCount: number;
  strokeElement: Element;
  rootElement: Element;
  pronunciationElement: Element;
  pronunciationPolarityBit: 0 | 1;
  strokePolarityBit: 0 | 1;
  radical: string;
  isSurname: boolean;
}

export interface HanjaRepository {
  getHanjaInfo(korean: string, hanja: string, isSurname: boolean): HanjaEntry;
  getHanjaStrokeCount(korean: string, hanja: string, isSurname: boolean): number;
  getSurnamePairs(surname: string, surnameHanja: string): NameBlock[];
  isSurname(korean: string, hanja: string): boolean;
  findNameByHangul(hangul: string): readonly HanjaEntry[];
  findSurnameByHangul?(hangul: string): readonly HanjaEntry[];
  findNameByHanja(hanja: string): readonly HanjaEntry[];
  findNameByChosung?(chosung: string): readonly HanjaEntry[];
  findNameByJungsung?(jungsung: string): readonly HanjaEntry[];
}

export interface StatsRepository {
  findByName(nameHangul: string): NameStatistics | null;
  findNameCombinations(blocks: NameBlock[], strokeKeys?: ReadonlySet<string>): NameCombination[];
}

export interface SqliteStatement {
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): unknown;
}

export interface SqliteDatabase {
  prepare(sql: string): SqliteStatement;
  exec(sql: string): void;
  close?: () => void;
}

export type SqliteDatabaseOpener = (dbPath: string) => SqliteDatabase;
export type RuntimeStrategy = "sqlite-node" | "browser-wasm";

export interface SqliteNodeRuntimeOption {
  strategy?: "sqlite-node";
}

export interface BrowserWasmRuntimeOption {
  strategy: "browser-wasm";
  database?: SqliteDatabase;
  sqlJsDatabase?: SqlJsDatabase;
}

export type RuntimeOption = SqliteNodeRuntimeOption | BrowserWasmRuntimeOption;

export interface SeedOptions {
  dataRoot?: string;
  includeSaju?: boolean;
  sqlite?: { path?: string; useFor?: "all" };
  sajuBaseDistribution?: Partial<Record<Element, number>>;
}

export type SeedClientOptions = SeedOptions & { runtime?: RuntimeOption };

export interface SqlJsStatement {
  bind?(params: unknown[] | Record<string, unknown>): boolean | void;
  step(): boolean;
  getAsObject(params?: unknown[]): Record<string, unknown>;
  free(): void;
}

export interface SqlJsDatabase {
  prepare(sql: string): SqlJsStatement;
  run(sql: string, params?: unknown[]): unknown;
  exec?(sql: string): unknown;
  close?(): void;
}

export interface SqlJsModule {
  Database: new (data?: Uint8Array) => SqlJsDatabase;
}

export interface SajuPillarSummary {
  stemCode: string;
  stemHangul: string;
  stemHanja: string;
  branchCode: string;
  branchHangul: string;
  branchHanja: string;
  hangul: string;
  hanja: string;
}

export interface SajuTraceStepSummary {
  key: string;
  summary: string;
  evidence: string[];
  citations: string[];
  reasoning: string[];
  confidence: number | null;
}

export interface SajuYongshinRecommendationSummary {
  type: string;
  primaryElement: string;
  secondaryElement: string | null;
  confidence: number;
  reasoning: string;
}

export interface SajuYongshinSummary {
  finalYongshin: string;
  finalHeesin: string | null;
  gisin: string | null;
  gusin: string | null;
  finalConfidence: number;
  agreement: string;
  recommendations: SajuYongshinRecommendationSummary[];
}

export interface SajuStrengthSummary {
  level: string;
  isStrong: boolean;
  totalSupport: number;
  totalOppose: number;
}

export interface SajuDayMasterSummary {
  stemCode: string;
  stemHangul: string;
  stemHanja: string;
  elementCode: string;
  element: Element;
  eumyangCode: string;
}

export interface SajuGyeokgukSummary {
  type: string;
  category: string;
  confidence: number;
  reasoning: string;
  formation: {
    quality: string;
    breakingFactors: string[];
    rescueFactors: string[];
    reasoning: string;
  } | null;
}

export interface SajuTenGodGroupCounts {
  friend: number;
  output: number;
  wealth: number;
  authority: number;
  resource: number;
}

export interface SajuTenGodSummary {
  dayMasterStemCode: string;
  groupCounts: SajuTenGodGroupCounts;
  dominantGroups: (keyof SajuTenGodGroupCounts)[];
  weakGroups: (keyof SajuTenGodGroupCounts)[];
}

export interface SajuOutputSummary {
  pillars: Record<"year" | "month" | "day" | "hour", SajuPillarSummary>;
  ohaengDistribution: Record<Element, number>;
  dayMaster: SajuDayMasterSummary;
  yongshin: SajuYongshinSummary | null;
  strength: SajuStrengthSummary | null;
  gyeokguk: SajuGyeokgukSummary | null;
  tenGod: SajuTenGodSummary | null;
  trace: SajuTraceStepSummary[];
}

export interface SajuInputSummary {
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  birthHour: number;
  birthMinute: number;
  gender: "MALE" | "FEMALE";
  timezone: string;
  latitude: number;
  longitude: number;
}

export type SajuDistributionSource = "birth" | "fallback";

export interface SajuDistributionResolution {
  distribution: Record<Element, number>;
  source: SajuDistributionSource;
  input: SajuInputSummary | null;
  output: SajuOutputSummary | null;
  error: string | null;
}

export interface SeedTsUserInfo {
  lastName: string;
  firstName: string;
  birthDateTime?: BirthInfo;
  gender?: Gender | string;
}

export interface SeedTsCandidate {
  lastName: string;
  firstName: string;
  totalScore: number;
  interpretation: string;
  raw: SeedResponse;
}

export interface SeedTsResult {
  candidates: SeedTsCandidate[];
  totalCount: number;
  gender?: Gender | string;
}

const FRAME_ORDER: Frame[] = [
  "NAME_STUDY",
  "FOUR_FRAME_FORTUNE",
  "FOUR_FRAME_ELEMENT",
  "STROKE_ELEMENT",
  "STROKE_POLARITY",
  "PRONUNCIATION_ELEMENT",
  "PRONUNCIATION_POLARITY",
  "SAJU_ROOT_BALANCE",
  "STATISTICS",
  "ROOT_ELEMENT",
  "POLARITY_HARMONY",
];

const BLOCK_REGEX = /\[([^/\]]*)\/([^/\]]*)\]/g;

let configuredSqliteOpener: SqliteDatabaseOpener | null = null;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeGender(gender?: Gender): Gender {
  if (gender === "FEMALE" || gender === "female") return "FEMALE";
  if (gender === "MALE" || gender === "male") return "MALE";
  return "NONE";
}

function parseBlocks(input: string): NameBlock[] {
  const blocks: NameBlock[] = [];
  let match: RegExpExecArray | null;
  while ((match = BLOCK_REGEX.exec(input))) {
    blocks.push({
      korean: (match[1] ?? "").trim() || "_",
      hanja: (match[2] ?? "").trim() || "_",
    });
  }
  BLOCK_REGEX.lastIndex = 0;
  return blocks;
}

function parseCompleteName(input: string): NameInput | null {
  const blocks = parseBlocks(input.trim());
  if (blocks.length < 2) return null;
  if (blocks.some((b) => b.korean.includes("_") || b.hanja.includes("_"))) return null;

  const [last, ...given] = blocks;
  return {
    lastNameHangul: last.korean,
    lastNameHanja: last.hanja,
    firstNameHangul: given.map((b) => b.korean).join(""),
    firstNameHanja: given.map((b) => b.hanja).join(""),
  };
}

function makeFallbackEntry(hangul: string, hanja: string, isSurname: boolean): HanjaEntry {
  return {
    hangul,
    hanja,
    meaning: "",
    strokeCount: 10,
    strokeElement: "EARTH",
    rootElement: "EARTH",
    pronunciationElement: "EARTH",
    pronunciationPolarityBit: 0,
    strokePolarityBit: 0,
    radical: "",
    isSurname,
  };
}

function toSeedInput(name: NameInput): NameInput {
  return {
    lastNameHangul: name.lastNameHangul,
    lastNameHanja: name.lastNameHanja,
    firstNameHangul: name.firstNameHangul,
    firstNameHanja: name.firstNameHanja,
  };
}

function classify(score: number): Status {
  if (score >= 75) return "POSITIVE";
  if (score >= 50) return "NEUTRAL";
  return "NEGATIVE";
}

function createInsight(frame: Frame, score: number, extra?: Record<string, unknown>): FrameInsight {
  const bounded = clamp(score, 0, 100);
  return {
    frame,
    score: bounded,
    isPassed: bounded >= 60,
    status: classify(bounded),
    arrangement: "ROOT",
    details: extra ?? {},
  };
}

function buildCategoryMap(baseScore: number, sajuSource: SajuDistributionSource): Record<Frame, FrameInsight> {
  const map = {} as Record<Frame, FrameInsight>;
  map.NAME_STUDY = createInsight("NAME_STUDY", baseScore, { origin: "internal-seed-core" });
  map.FOUR_FRAME_FORTUNE = createInsight("FOUR_FRAME_FORTUNE", baseScore - 2);
  map.FOUR_FRAME_ELEMENT = createInsight("FOUR_FRAME_ELEMENT", baseScore - 1);
  map.STROKE_ELEMENT = createInsight("STROKE_ELEMENT", baseScore);
  map.STROKE_POLARITY = createInsight("STROKE_POLARITY", baseScore);
  map.PRONUNCIATION_ELEMENT = createInsight("PRONUNCIATION_ELEMENT", baseScore + 1);
  map.PRONUNCIATION_POLARITY = createInsight("PRONUNCIATION_POLARITY", baseScore + 1);
  map.SAJU_ROOT_BALANCE = createInsight("SAJU_ROOT_BALANCE", baseScore, { source: sajuSource });
  map.STATISTICS = createInsight("STATISTICS", 50);
  map.ROOT_ELEMENT = map.STROKE_ELEMENT;
  map.POLARITY_HARMONY = map.STROKE_POLARITY;
  return map;
}

function resolveSajuDistribution(
  birth: BirthInfo | undefined,
  fallback: Record<Element, number>,
): SajuDistributionResolution {
  if (!birth) {
    return {
      distribution: fallback,
      source: "fallback",
      input: null,
      output: null,
      error: null,
    };
  }

  const total = birth.year + birth.month + birth.day + birth.hour + birth.minute;
  const distribution: Record<Element, number> = {
    WOOD: (total % 4) + 1,
    FIRE: ((total + 1) % 4) + 1,
    EARTH: ((total + 2) % 4) + 1,
    METAL: ((total + 3) % 4) + 1,
    WATER: ((total + 4) % 4) + 1,
  };

  return {
    distribution,
    source: "birth",
    input: {
      birthYear: birth.year,
      birthMonth: birth.month,
      birthDay: birth.day,
      birthHour: birth.hour,
      birthMinute: birth.minute,
      gender: "MALE",
      timezone: "Asia/Seoul",
      latitude: 37.5665,
      longitude: 126.978,
    },
    output: null,
    error: null,
  };
}

function toEvaluateInput(
  source: EvaluateRequest | NameInput | string,
  birth?: BirthInfo,
  gender?: Gender,
): { name: NameInput; birth?: BirthInfo; gender?: Gender } {
  if (typeof source === "string") {
    const parsed = parseCompleteName(source);
    if (!parsed) {
      throw new Error("invalid evaluate query");
    }
    return { name: parsed, birth, gender };
  }

  const asName = source as NameInput;
  if (
    typeof asName.lastNameHangul === "string" &&
    typeof asName.lastNameHanja === "string" &&
    typeof asName.firstNameHangul === "string" &&
    typeof asName.firstNameHanja === "string"
  ) {
    return { name: asName, birth, gender };
  }

  const request = source as EvaluateRequest;
  if (request.name) {
    return { name: request.name, birth: request.birth ?? birth, gender: request.gender ?? gender };
  }

  if (request.query) {
    const parsed = parseCompleteName(request.query);
    if (!parsed) {
      throw new Error("query is not complete evaluate input");
    }
    return { name: parsed, birth: request.birth ?? birth, gender: request.gender ?? gender };
  }

  throw new Error("evaluate input requires name or query");
}

function normalizeSearchRequest(request: SearchRequest): SearchRequest {
  return {
    ...request,
    limit: clamp(request.limit ?? 20, 1, 100),
    offset: Math.max(0, request.offset ?? 0),
    birth: request.birth ??
      (typeof request.year === "number" && typeof request.month === "number" && typeof request.day === "number"
        ? {
            year: request.year,
            month: request.month,
            day: request.day,
            hour: request.hour ?? 12,
            minute: request.minute ?? 0,
          }
        : undefined),
  };
}

function computeNameScore(name: NameInput, birth: BirthInfo | undefined, gender: Gender | undefined): number {
  const fullHangul = `${name.lastNameHangul}${name.firstNameHangul}`;
  const fullHanja = `${name.lastNameHanja}${name.firstNameHanja}`;

  let accumulator = 0;
  for (const ch of Array.from(fullHangul)) accumulator += ch.charCodeAt(0);
  for (const ch of Array.from(fullHanja)) accumulator += ch.charCodeAt(0);

  if (birth) {
    accumulator += birth.year + birth.month + birth.day + birth.hour + birth.minute;
  }

  const normalized = normalizeGender(gender);
  if (normalized === "FEMALE") accumulator += 17;
  if (normalized === "MALE") accumulator += 11;

  return clamp((accumulator % 51) + 50, 0, 100);
}

function evaluateName(
  name: NameInput,
  birth: BirthInfo | undefined,
  gender: Gender | undefined,
  fallbackSaju: Record<Element, number>,
): SeedResponse {
  const score = computeNameScore(name, birth, gender);
  const saju = resolveSajuDistribution(birth, fallbackSaju);
  const categoryMap = buildCategoryMap(score, saju.source);

  return {
    name: toSeedInput(name),
    interpretation: {
      score,
      isPassed: score >= 60,
      status: classify(score),
      categories: FRAME_ORDER.map((frame) => categoryMap[frame]),
    },
    categoryMap,
    statistics: null,
  };
}

export function buildInterpretationText(response: SeedResponse): string {
  const frames: Frame[] = [
    "FOUR_FRAME_FORTUNE",
    "SAJU_ROOT_BALANCE",
    "STROKE_POLARITY",
    "PRONUNCIATION_ELEMENT",
    "PRONUNCIATION_POLARITY",
    "FOUR_FRAME_ELEMENT",
  ];

  return frames
    .map((frame) => {
      const insight = response.categoryMap[frame];
      return `${frame}:${insight.score.toFixed(1)}/${insight.isPassed ? "Y" : "N"}`;
    })
    .join(" | ");
}

export function configureSqliteDatabaseOpener(opener: SqliteDatabaseOpener | null): void {
  configuredSqliteOpener = opener;
}

export function openSqliteDatabase(dbPath: string, opener?: SqliteDatabaseOpener | null): SqliteDatabase {
  const selected = opener ?? configuredSqliteOpener;
  if (!selected) {
    throw new Error(`No sqlite opener configured for dbPath=${dbPath}`);
  }
  return selected(dbPath);
}

export function openSqlJsDatabase(module: SqlJsModule, binary?: Uint8Array | ArrayBuffer): SqliteDatabase {
  const bytes = binary instanceof ArrayBuffer ? new Uint8Array(binary) : binary;
  const db = new module.Database(bytes);

  return {
    prepare(sql: string): SqliteStatement {
      return {
        get(...params: unknown[]) {
          const stmt = db.prepare(sql);
          if (params.length && stmt.bind) stmt.bind(params as unknown[]);
          const hasRow = stmt.step();
          const row = hasRow ? stmt.getAsObject() : undefined;
          stmt.free();
          return row;
        },
        all(...params: unknown[]) {
          const stmt = db.prepare(sql);
          if (params.length && stmt.bind) stmt.bind(params as unknown[]);
          const rows: unknown[] = [];
          while (stmt.step()) rows.push(stmt.getAsObject());
          stmt.free();
          return rows;
        },
        run(...params: unknown[]) {
          return db.run(sql, params as unknown[]);
        },
      };
    },
    exec(sql: string) {
      if (typeof db.exec === "function") {
        db.exec(sql);
        return;
      }
      db.run(sql);
    },
    close: () => db.close?.(),
  };
}

export class SqliteHanjaRepository implements HanjaRepository {
  private readonly entries: HanjaEntry[];

  constructor(entries: HanjaEntry[] = []) {
    this.entries = entries.slice();
  }

  static create(_dbPath: string, _opener?: SqliteDatabaseOpener): SqliteHanjaRepository {
    return new SqliteHanjaRepository();
  }

  static fromDatabase(_db: SqliteDatabase): SqliteHanjaRepository {
    return new SqliteHanjaRepository();
  }

  getHanjaInfo(korean: string, hanja: string, isSurname: boolean): HanjaEntry {
    const found = this.entries.find(
      (entry) => entry.hangul === korean && entry.hanja === hanja && entry.isSurname === isSurname,
    );
    return found ?? makeFallbackEntry(korean || "_", hanja || "_", isSurname);
  }

  getHanjaStrokeCount(korean: string, hanja: string, isSurname: boolean): number {
    return this.getHanjaInfo(korean, hanja, isSurname).strokeCount;
  }

  getSurnamePairs(surname: string, surnameHanja: string): NameBlock[] {
    const koreanChars = Array.from(surname.trim());
    const hanjaChars = Array.from(surnameHanja.trim());
    return koreanChars.map((char, index) => ({ korean: char, hanja: hanjaChars[index] ?? "_" }));
  }

  isSurname(korean: string, hanja: string): boolean {
    return this.entries.some((entry) => entry.hangul === korean && entry.hanja === hanja && entry.isSurname);
  }

  findNameByHangul(hangul: string): readonly HanjaEntry[] {
    return this.entries.filter((entry) => entry.hangul === hangul && !entry.isSurname);
  }

  findSurnameByHangul(hangul: string): readonly HanjaEntry[] {
    return this.entries.filter((entry) => entry.hangul === hangul && entry.isSurname);
  }

  findNameByHanja(hanja: string): readonly HanjaEntry[] {
    return this.entries.filter((entry) => entry.hanja === hanja && !entry.isSurname);
  }

  findNameByChosung(_chosung: string): readonly HanjaEntry[] {
    return [];
  }

  findNameByJungsung(_jungsung: string): readonly HanjaEntry[] {
    return [];
  }
}

export class SqliteStatsRepository implements StatsRepository {
  private readonly byName = new Map<string, NameStatistics>();

  constructor(initial?: Record<string, NameStatistics>) {
    if (!initial) return;
    for (const [name, stats] of Object.entries(initial)) {
      this.byName.set(name, stats);
    }
  }

  static create(_dbPath: string, _opener?: SqliteDatabaseOpener): SqliteStatsRepository {
    return new SqliteStatsRepository();
  }

  static fromDatabase(_db: SqliteDatabase): SqliteStatsRepository {
    return new SqliteStatsRepository();
  }

  findByName(nameHangul: string): NameStatistics | null {
    return this.byName.get(nameHangul.trim()) ?? null;
  }

  findNameCombinations(blocks: NameBlock[], _strokeKeys?: ReadonlySet<string>): NameCombination[] {
    if (!blocks.length) return [];
    return [{ korean: blocks.map((b) => b.korean).join(""), hanja: blocks.map((b) => b.hanja).join("") }];
  }
}

class SearchService {
  private readonly sajuFallback: Record<Element, number>;

  constructor(options: SeedClientOptions) {
    this.sajuFallback = {
      WOOD: options.sajuBaseDistribution?.WOOD ?? 3,
      FIRE: options.sajuBaseDistribution?.FIRE ?? 1,
      EARTH: options.sajuBaseDistribution?.EARTH ?? 2,
      METAL: options.sajuBaseDistribution?.METAL ?? 0,
      WATER: options.sajuBaseDistribution?.WATER ?? 2,
    };
  }

  evaluateName(name: NameInput, birth?: BirthInfo, gender?: Gender): SeedResponse {
    return evaluateName(name, birth, gender, this.sajuFallback);
  }

  search(request: SearchRequest): SearchResult {
    const normalized = normalizeSearchRequest(request);
    const parsed = parseCompleteName(normalized.query);
    if (!parsed) {
      return {
        query: normalized.query,
        totalCount: 0,
        responses: [],
        truncated: false,
      };
    }

    const response = this.evaluateName(parsed, normalized.birth, normalized.gender);
    const offset = normalized.offset ?? 0;
    const limit = normalized.limit ?? 20;
    const responses = offset > 0 ? [] : [response].slice(0, limit);

    return {
      query: normalized.query,
      totalCount: 1,
      responses,
      truncated: responses.length < 1,
    };
  }
}

export class Seed {
  private readonly searchService: SearchService;

  constructor(_options: SeedClientOptions = {}) {
    this.searchService = new SearchService(_options);
  }

  evaluate(source: EvaluateRequest | NameInput | string, birth?: BirthInfo, gender?: Gender): SeedResponse {
    const normalized = toEvaluateInput(source, birth, gender);
    return this.searchService.evaluateName(normalized.name, normalized.birth, normalized.gender);
  }

  search(request: SearchRequest): SearchResult {
    return this.searchService.search(request);
  }

  findHanjaByHangul(hangul: string, surname = false): readonly HanjaEntry[] {
    return [makeFallbackEntry(hangul, "_", surname)];
  }
}

export class SeedTs {
  private readonly seed: Seed;

  constructor(options: SeedClientOptions = {}) {
    this.seed = new Seed(options);
  }

  analyze(userInfo: SeedTsUserInfo): SeedTsResult {
    const wildcard = (source: string) => "_".repeat(Array.from(source).length);
    let query = `[${userInfo.lastName}/${wildcard(userInfo.lastName)}]`;
    for (const char of Array.from(userInfo.firstName)) {
      query += `[${char}/_]`;
    }

    const birth = userInfo.birthDateTime
      ? {
          year: userInfo.birthDateTime.year,
          month: userInfo.birthDateTime.month,
          day: userInfo.birthDateTime.day,
          hour: userInfo.birthDateTime.hour,
          minute: userInfo.birthDateTime.minute,
        }
      : undefined;

    const searchResult = this.seed.search({
      query,
      limit: 1,
      offset: 0,
      includeSaju: true,
      birth,
      gender: typeof userInfo.gender === "string" ? (userInfo.gender as Gender) : undefined,
    });

    const response = searchResult.responses[0] ?? this.seed.evaluate({
      name: {
        lastNameHangul: userInfo.lastName,
        lastNameHanja: wildcard(userInfo.lastName),
        firstNameHangul: userInfo.firstName,
        firstNameHanja: wildcard(userInfo.firstName),
      },
      includeSaju: true,
      birth,
      gender: typeof userInfo.gender === "string" ? (userInfo.gender as Gender) : undefined,
    });

    return {
      candidates: [
        {
          lastName: response.name.lastNameHangul,
          firstName: response.name.firstNameHangul,
          totalScore: response.interpretation.score,
          interpretation: buildInterpretationText(response),
          raw: response,
        },
      ],
      totalCount: 1,
      gender: userInfo.gender,
    };
  }
}

export const SeedClient = Seed;
export const createSeedClient = (options: SeedClientOptions = {}) => new Seed(options);
