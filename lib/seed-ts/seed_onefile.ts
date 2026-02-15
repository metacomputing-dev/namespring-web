/**
 * Seed — Korean Name Evaluation Engine (Single-File Edition)
 *
 * Evaluates Korean names based on traditional naming theories:
 *   Four-Frame numerology, stroke/pronunciation element & polarity,
 *   saju (four pillars) root-element balance, and name statistics.
 *
 * External dependency: @metaintelligence/saju
 *
 * Architecture (top → bottom, zero circular references):
 *   §1  Types & Interfaces
 *   §2  Constants & Scoring Parameters
 *   §3  Utility Functions
 *   §4  Hangul Decomposition
 *   §5  SQLite Abstraction Layer
 *   §6  Hanja Repository
 *   §7  Stats Repository
 *   §8  Four-Frame Map
 *   §9  Name Calculator
 *   §10 Ohaeng (Element & Polarity) Rules
 *   §11 Saju Distribution Resolver
 *   §12 Saju Scoring
 *   §13 Evaluation Pipeline
 *   §14 Name Evaluator
 *   §15 Query Parser
 *   §16 Search Engine
 *   §17 Runtime Bootstrap
 *   §18 Public API
 */

import {
  analyzeSaju,
  createBirthInput,
  CHEONGAN_INFO,
  JIJI_INFO,
  Gender as SajuGender,
  Ohaeng,
  type SajuAnalysis,
} from "@metaintelligence/saju";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ════════════════════════════════════════════════════════════════════════════
//  §1  TYPES & INTERFACES
// ════════════════════════════════════════════════════════════════════════════

// ── Domain primitives ──

export type Gender     = "MALE" | "FEMALE" | "NONE" | "male" | "female" | "none";
export type Element    = "木" | "火" | "土" | "金" | "水";
export type Polarity   = "陰" | "陽";
export type LuckyLevel = "최상운수" | "상운수" | "양운수" | "흉운수" | "최흉운수" | "미정";
export type Status     = "POSITIVE" | "NEUTRAL" | "NEGATIVE";

export type Frame =
  | "NAME_STUDY" | "FOUR_FRAME_FORTUNE" | "FOUR_FRAME_ELEMENT"
  | "STROKE_ELEMENT" | "STROKE_POLARITY"
  | "PRONUNCIATION_ELEMENT" | "PRONUNCIATION_POLARITY"
  | "SAJU_ROOT_BALANCE" | "STATISTICS"
  | "ROOT_ELEMENT" | "POLARITY_HARMONY";

// ── Value objects ──

export interface Energy       { element: Element; polarity: Polarity }
export interface FourFrame    { origin: number; form: number; profit: number; harmony: number }
export interface BirthInfo    { year: number; month: number; day: number; hour: number; minute: number }
export interface NameBlock    { korean: string; hanja: string }
export interface NameCombination { korean: string; hanja: string }
export interface NameQuery    { surnameBlocks: NameBlock[]; nameBlocks: NameBlock[] }
export interface ResolvedName { surname: HanjaEntry[]; given: HanjaEntry[] }

export interface NameInput {
  lastNameHangul: string;
  lastNameHanja: string;
  firstNameHangul: string;
  firstNameHanja: string;
}

// ── Request / Response ──

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

// ── Hanja data ──

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

// ── Repository contracts ──

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

// ── SQLite / Runtime abstractions ──

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

export interface SqliteNodeRuntimeOption  { strategy?: "sqlite-node" }
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

// ── Saju summary types ──

export interface SajuPillarSummary {
  stemCode: string; stemHangul: string; stemHanja: string;
  branchCode: string; branchHangul: string; branchHanja: string;
  hangul: string; hanja: string;
}

export interface SajuTraceStepSummary {
  key: string; summary: string; evidence: string[]; citations: string[];
  reasoning: string[]; confidence: number | null;
}

export interface SajuYongshinRecommendationSummary {
  type: string; primaryElement: string; secondaryElement: string | null;
  confidence: number; reasoning: string;
}

export interface SajuYongshinSummary {
  finalYongshin: string; finalHeesin: string | null;
  gisin: string | null; gusin: string | null;
  finalConfidence: number; agreement: string;
  recommendations: SajuYongshinRecommendationSummary[];
}

export interface SajuStrengthSummary {
  level: string; isStrong: boolean; totalSupport: number; totalOppose: number;
}

export interface SajuDayMasterSummary {
  stemCode: string; stemHangul: string; stemHanja: string;
  elementCode: string; element: Element; eumyangCode: string;
}

export interface SajuGyeokgukSummary {
  type: string; category: string; confidence: number; reasoning: string;
  formation: {
    quality: string; breakingFactors: string[];
    rescueFactors: string[]; reasoning: string;
  } | null;
}

export interface SajuTenGodGroupCounts {
  friend: number; output: number; wealth: number; authority: number; resource: number;
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
  birthYear: number; birthMonth: number; birthDay: number;
  birthHour: number; birthMinute: number;
  gender: "MALE" | "FEMALE"; timezone: string; latitude: number; longitude: number;
}

export type SajuDistributionSource = "birth" | "fallback";

export interface SajuDistributionResolution {
  distribution: Record<Element, number>;
  source: SajuDistributionSource;
  input: SajuInputSummary | null;
  output: SajuOutputSummary | null;
  error: string | null;
}

// ── SeedTs wrapper types ──

export interface SeedTsUserInfo {
  lastName: string;
  firstName: string;
  birthDateTime?: Partial<BirthInfo>;
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

// ════════════════════════════════════════════════════════════════════════════
//  §2  CONSTANTS & SCORING PARAMETERS
// ════════════════════════════════════════════════════════════════════════════

const ELEMENTS: readonly Element[] = ["木", "火", "土", "金", "水"];
const ELEMENT_COUNT = 5;
const ELEMENT_INDEX: Record<Element, number> = { "木": 0, "火": 1, "土": 2, "金": 3, "水": 4 };
const ELEMENT_SET = new Set<Element>(ELEMENTS);

const EARTH: Element = "土";
const EUM: Polarity   = "陰";
const YANG: Polarity  = "陽";
const POLARITY_BY_BIT: Record<0 | 1, Polarity> = { 0: EUM, 1: YANG };

const DEFAULT_STROKE  = 10;
const FF_MOD          = 81;
const MAX_STROKE_CHAR = 40;
const MAX_STROKE_SQL  = 900;
const YEAR_BASE       = 2000;
const FORTUNE_UNDEF: LuckyLevel = "미정";
const POSITIVE_FORTUNES = new Set<LuckyLevel>(["최상운수", "상운수", "양운수"]);

/** Single source of truth for all scoring parameters. */
const P = {
  // Balance
  balMovePen: 20, balZeroPen: 10, balSpreadPen: 5, balPassTh: 70,

  // Yongshin affinity
  guAff: -1, giAff: -0.65, ysAff: 1, hsAff: 0.65,
  affW: 0.55, recW: 0.45, confBase: 0.55, confMul: 0.45,
  defConf: 0.65, defRecConf: 0.6, secElW: 0.6,

  // Penalty
  giPenMul: 7, guPenMul: 14, penBase: 0.4, penConf: 0.6,

  // Composite weights
  wBal: 0.6, wYng: 0.23, wStr: 0.12, wTG: 0.05,
  wShCon: 0.22, wShCB: 0.6, wShCM: 0.4, wShCtx: 0.08,
  wBalMin: 0.35, wBalMax: 0.6, wYngMin: 0.23, wYngMax: 0.48, wConDiv: 70,

  // Pass thresholds
  passMin: 62, passBal: 45, passYng: 35, severeGu: 0.75,

  // Strength scoring
  strDefInt: 0.35, strScBase: 0.45, strScInt: 0.55,

  // Ten-God scoring
  tgOverMul: 0.35, tgScMul: 45,

  // Element adjacency & balance
  elBase: 70, elSSBon: 15, elSGPen: 20, elSamePen: 5,
  elBalBr: [[2, 100], [4, 85], [6, 70], [8, 55], [10, 40]] as [number, number][],
  elBalFloor: 25, elSSMinR: 0.6, elMaxCons: 3,

  // Fortune bucket scores
  fTop: 25, fHigh: 20, fGood: 15, fWorst: 0, fBad: 5, fDef: 10,

  // Polarity scoring
  polBr: [[0.4, 50], [0.3, 35], [0.2, 20]] as [number, number][],
  polFloor: 10, polBase: 40,

  // Frame pass thresholds
  fBucketPass: 15, strokeElPass: 60, adjTh2: 65, adjTh1: 60,
  ffElPass: 65, pronElPass: 70,

  // Adaptive policy
  adaptTh: 0.55, adapt2Th: 0.78, strictTh: 60, adaptRed: 8,
  severeTh: 45, gateScore: 35,
  sajuBoost: 0.45, relaxRed: 0.3,

  // Priority scoring
  priBase: 0.55, priConf: 0.45, priPenDiv: 20, priPenW: 0.25,

  // Statistics
  statsBase: 60,

  // Signal weights
  sigMaj: 0.2, sigMin: 0.15,

  // Yongshin type weights
  ysTypeW: {
    EOKBU: 1, JOHU: 0.95, TONGGWAN: 0.9, GYEOKGUK: 0.85,
    BYEONGYAK: 0.8, JEONWANG: 0.75, HAPWHA_YONGSHIN: 0.7, ILHAENG_YONGSHIN: 0.7,
  } as Record<string, number>,
  ysTypeWDef: 0.75,
  ctxYsTypes: new Set(["JOHU", "TONGGWAN", "BYEONGYAK", "GYEOKGUK", "HAPWHA_YONGSHIN"]),

  // Default saju fallback distribution
  sajuFB: [3, 1, 2, 0, 2] as readonly number[],
} as const;

// ── Frame metadata: single source of truth for evaluation topology ──

interface FrameMeta {
  signal?: number;
  relaxable?: boolean;
  strict?: boolean;
  ordered?: boolean;
  aliasOf?: Frame;
}

const FRAME_META: Partial<Record<Frame, FrameMeta>> = {
  "NAME_STUDY":             { ordered: true },
  "FOUR_FRAME_FORTUNE":     { signal: P.sigMaj, relaxable: true, strict: true, ordered: true },
  "SAJU_ROOT_BALANCE":      { signal: P.sigMaj, strict: true, ordered: true },
  "STROKE_POLARITY":        { signal: P.sigMin, relaxable: true, strict: true, ordered: true },
  "PRONUNCIATION_ELEMENT":  { signal: P.sigMin, relaxable: true, strict: true, ordered: true },
  "PRONUNCIATION_POLARITY": { signal: P.sigMin, relaxable: true, strict: true, ordered: true },
  "FOUR_FRAME_ELEMENT":     { signal: P.sigMin, relaxable: true, strict: true, ordered: true },
  "STROKE_ELEMENT":         {},
  "STATISTICS":             {},
  "ROOT_ELEMENT":           { aliasOf: "STROKE_ELEMENT" },
  "POLARITY_HARMONY":       { aliasOf: "STROKE_POLARITY" },
};

const FRAME_ENTRIES = Object.entries(FRAME_META) as [Frame, FrameMeta][];
const SIGNAL_FRAMES  = FRAME_ENTRIES.filter(([, m]) => m.signal != null);
const RELAXABLE_SET  = new Set(SIGNAL_FRAMES.filter(([, m]) => m.relaxable).map(([f]) => f));
const STRICT_FRAMES  = FRAME_ENTRIES.filter(([, m]) => m.strict).map(([f]) => f);
const ORDERED_FRAMES = FRAME_ENTRIES.filter(([, m]) => m.ordered).map(([f]) => f);
const UNIQUE_FRAMES  = (Object.keys(FRAME_META) as Frame[]).filter(f => !FRAME_META[f]?.aliasOf);
const ALIAS_FRAMES   = FRAME_ENTRIES.filter(([, m]) => m.aliasOf) as [Frame, FrameMeta & { aliasOf: Frame }][];

// ── Ohaeng ↔ Element mapping (from @metaintelligence/saju enum) ──

const OHAENG_TO_ELEMENT: Record<Ohaeng, Element> = {
  [Ohaeng.WOOD]: "木", [Ohaeng.FIRE]: "火", [Ohaeng.EARTH]: "土",
  [Ohaeng.METAL]: "金", [Ohaeng.WATER]: "水",
};

const SAJU_ELEMENT_MAP: Record<string, Element> = {
  WOOD: "木", FIRE: "火", EARTH: "土", METAL: "金", WATER: "水",
};

// ── Ten-God group mapping ──

type TGGroup = keyof SajuTenGodGroupCounts;
const TG_GROUPS: TGGroup[] = ["friend", "output", "wealth", "authority", "resource"];

const TG_MAP: Record<string, TGGroup> = {
  BI_GYEON: "friend", GYEOB_JAE: "friend",
  SIK_SIN: "output", SANG_GWAN: "output",
  PYEON_JAE: "wealth", JEONG_JAE: "wealth",
  PYEON_GWAN: "authority", JEONG_GWAN: "authority",
  PYEON_IN: "resource", JEONG_IN: "resource",
};

// ════════════════════════════════════════════════════════════════════════════
//  §3  UTILITY FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function trim(s: string): string {
  return (s ?? "").trim();
}

function toText(v: unknown): string {
  return String(v ?? "").trim();
}

function toInt(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  const parsed = parseInt(String(v ?? ""), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function toBit(v: unknown): 0 | 1 {
  return toInt(v, 0) === 0 ? 0 : 1;
}

function sum(arr: readonly number[]): number {
  let total = 0;
  for (const v of arr) total += v;
  return total;
}

function toStringList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((e): e is string => typeof e === "string") : [];
}

/** Memo-cache helper: compute once per key, reuse thereafter. */
function cached<K, V>(map: Map<K, V>, key: K, compute: () => V): V {
  const existing = map.get(key);
  if (existing !== undefined) return existing;
  const v = compute();
  map.set(key, v);
  return v;
}

/** Element-distribution utilities. */
const Dist = {
  empty(): Record<Element, number> {
    return { "木": 0, "火": 0, "土": 0, "金": 0, "水": 0 };
  },

  clone(d: Record<Element, number>): Record<Element, number> {
    return { "木": d["木"] ?? 0, "火": d["火"] ?? 0, "土": d["土"] ?? 0, "金": d["金"] ?? 0, "水": d["水"] ?? 0 };
  },

  fromArray(arr: readonly Element[]): Record<Element, number> {
    const d = Dist.empty();
    for (const e of arr) d[e]++;
    return d;
  },

  total(d: Record<Element, number>): number {
    let t = 0;
    for (const e of ELEMENTS) t += d[e] ?? 0;
    return t;
  },

  get(d: Record<Element, number>, el: Element | null): number {
    return el ? d[el] ?? 0 : 0;
  },

  weightedAvg(d: Record<Element, number>, weight: (e: Element) => number): number {
    const t = Dist.total(d);
    if (t <= 0) return 0;
    let w = 0;
    for (const e of ELEMENTS) {
      const count = d[e] ?? 0;
      if (count > 0) w += weight(e) * count;
    }
    return w / t;
  },
} as const;

// ════════════════════════════════════════════════════════════════════════════
//  §4  HANGUL DECOMPOSITION
// ════════════════════════════════════════════════════════════════════════════

const H_BASE   = 0xac00;
const H_END    = 0xd7a3;
const CHO_DIV  = 21 * 28;
const JUNG_DIV = 28;

const CHOSUNG = [
  "ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ",
  "ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ",
] as const;

const JUNGSUNG = [
  "ㅏ","ㅐ","ㅑ","ㅒ","ㅓ","ㅔ","ㅕ","ㅖ","ㅗ","ㅘ","ㅙ",
  "ㅚ","ㅛ","ㅜ","ㅝ","ㅞ","ㅟ","ㅠ","ㅡ","ㅢ","ㅣ",
] as const;

const CHOSUNG_SET  = new Set<string>(CHOSUNG);
const JUNGSUNG_SET = new Set<string>(JUNGSUNG);
const YANG_VOWELS  = new Set(["ㅏ","ㅑ","ㅐ","ㅒ","ㅗ","ㅛ","ㅘ","ㅙ","ㅚ"]);

const CHO_ELEMENT: Record<string, Element> = {
  "ㄱ":"木","ㅋ":"木","ㄲ":"木",
  "ㄴ":"火","ㄷ":"火","ㅌ":"火","ㄹ":"火","ㄸ":"火",
  "ㅇ":"土","ㅎ":"土",
  "ㅅ":"金","ㅈ":"金","ㅊ":"金","ㅆ":"金","ㅉ":"金",
  "ㅁ":"水","ㅂ":"水","ㅍ":"水","ㅃ":"水",
};

const CHO_ENG: Record<string, string> = {
  "ㄱ":"g","ㄲ":"gg","ㄴ":"n","ㄷ":"d","ㄸ":"dd","ㄹ":"r","ㅁ":"m","ㅂ":"b","ㅃ":"bb",
  "ㅅ":"s","ㅆ":"ss","ㅇ":"ng","ㅈ":"j","ㅉ":"jj","ㅊ":"ch","ㅋ":"k","ㅌ":"t","ㅍ":"p","ㅎ":"h",
};

function hangulOffset(c: string): number {
  const code = c.codePointAt(0);
  return code !== undefined && code >= H_BASE && code <= H_END ? code - H_BASE : -1;
}

function isSyllable(c: string): boolean {
  const code = c.codePointAt(0);
  return c.length === 1 && code !== undefined && code >= H_BASE && code <= H_END;
}

function extractCho(c: string): string {
  if (!c) return "";
  if (CHOSUNG_SET.has(c)) return c;
  const off = hangulOffset(c);
  return off < 0 ? "" : CHOSUNG[Math.floor(off / CHO_DIV)] ?? "";
}

function extractJung(c: string): string {
  if (!c) return "";
  const off = hangulOffset(c);
  return off < 0 ? "" : JUNGSUNG[Math.floor((off % CHO_DIV) / JUNG_DIV)] ?? "";
}

// ════════════════════════════════════════════════════════════════════════════
//  §5  SQLITE ABSTRACTION LAYER
// ════════════════════════════════════════════════════════════════════════════

let defaultSqliteOpener: SqliteDatabaseOpener | null = null;

export function configureSqliteDatabaseOpener(opener: SqliteDatabaseOpener | null): void {
  defaultSqliteOpener = opener;
}

export function openSqliteDatabase(
  dbPath: string,
  opener: SqliteDatabaseOpener | null = defaultSqliteOpener,
): SqliteDatabase {
  const p = trim(dbPath);
  if (!p) throw new Error("SQLite database path is required.");
  if (opener) return opener(p);

  const proc = (globalThis as Record<string, unknown>).process as { getBuiltinModule?: (name: string) => Record<string, unknown> | null } | undefined;
  const loader = proc?.getBuiltinModule;
  if (typeof loader === "function") {
    const mod = loader("node:sqlite") ?? loader("sqlite");
    if (mod?.DatabaseSync) return new (mod.DatabaseSync as new (p: string) => SqliteDatabase)(p);
  }
  throw new Error("SQLite opener is not configured.");
}

function createSqlJsAdapter(sqlJs: SqlJsDatabase): SqliteDatabase {
  function withStmt<R>(sql: string, params: unknown[], collect: (stmt: SqlJsStatement) => R): R {
    const stmt = sqlJs.prepare(sql);
    try {
      if (params.length) stmt.bind?.(Array.from(params));
      return collect(stmt);
    } finally {
      stmt.free();
    }
  }

  function adapt(sql: string): SqliteStatement {
    return {
      get(...p) { return withStmt(sql, p, s => s.step() ? s.getAsObject() : undefined); },
      all(...p) { return withStmt(sql, p, s => { const r: unknown[] = []; while (s.step()) r.push(s.getAsObject()); return r; }); },
      run(...p) { return withStmt(sql, p, s => { while (s.step()); return undefined; }); },
    };
  }

  return {
    prepare: adapt,
    exec(sql) { sqlJs.exec?.(sql) ?? sqlJs.run(sql); },
    close() { sqlJs.close?.(); },
  };
}

export function openSqlJsDatabase(module: SqlJsModule, binary?: Uint8Array | ArrayBuffer): SqliteDatabase {
  const bytes = binary instanceof Uint8Array ? binary : binary ? new Uint8Array(binary) : undefined;
  return createSqlJsAdapter(bytes ? new module.Database(bytes) : new module.Database());
}

// ════════════════════════════════════════════════════════════════════════════
//  §6  HANJA REPOSITORY
// ════════════════════════════════════════════════════════════════════════════

interface HanjaRow {
  hangul: unknown; hanja: unknown; meaning: unknown; hoeksu: unknown;
  hoeksu_ohaeng: unknown; jawon_ohaeng: unknown; pronunciation_ohaeng: unknown;
  pronunciation_eumyang: unknown; hoeksu_eumyang: unknown; boosoo: unknown; is_surname: unknown;
}

const HANJA_SELECT =
  "SELECT hangul, hanja, meaning, hoeksu, hoeksu_ohaeng, jawon_ohaeng, " +
  "pronunciation_ohaeng, pronunciation_eumyang, hoeksu_eumyang, boosoo, is_surname FROM hanja_entries";

function toElement(v: unknown, fallback: Element): Element {
  const t = toText(v) as Element;
  return ELEMENT_SET.has(t) ? t : fallback;
}

function fallbackEntry(korean: string, hanja: string, isSurname: boolean): HanjaEntry {
  return {
    hangul: trim(korean).slice(0, 1) || "_",
    hanja: trim(hanja).slice(0, 1) || "_",
    meaning: "",
    strokeCount: DEFAULT_STROKE,
    strokeElement: EARTH,
    rootElement: EARTH,
    pronunciationElement: EARTH,
    pronunciationPolarityBit: 0,
    strokePolarityBit: 0,
    radical: "",
    isSurname,
  };
}

export class SqliteHanjaRepository implements HanjaRepository {
  private readonly stmts: Record<string, SqliteStatement>;

  static create(dbPath: string, opener?: SqliteDatabaseOpener) {
    return new SqliteHanjaRepository(openSqliteDatabase(dbPath, opener ?? null));
  }

  static fromDatabase(db: SqliteDatabase) {
    return new SqliteHanjaRepository(db);
  }

  constructor(private readonly db: SqliteDatabase) {
    const q = (where: string) => db.prepare(`${HANJA_SELECT} ${where}`);
    this.stmts = {
      exact:     q("WHERE hangul = ? AND hanja = ? AND is_surname = ? LIMIT 1"),
      byHanja:   q("WHERE hanja = ? AND is_surname = ? LIMIT 1"),
      nameByH:   q("WHERE hangul = ? AND is_surname = 0"),
      surnByH:   q("WHERE hangul = ? AND is_surname = 1"),
      nameByHj:  q("WHERE hanja = ? AND is_surname = 0"),
      nameByCho: q("WHERE hangul_chosung = ? AND is_surname = 0"),
      nameByJng: q("WHERE hangul_jungsung = ? AND is_surname = 0"),
      surnPair:  db.prepare("SELECT 1 FROM surname_pairs WHERE korean = ? AND hanja = ? LIMIT 1"),
    };
  }

  private toEntry(row: HanjaRow, isSurnameDefault: boolean): HanjaEntry {
    return {
      hangul: toText(row.hangul),
      hanja: toText(row.hanja),
      meaning: toText(row.meaning),
      strokeCount: toInt(row.hoeksu, DEFAULT_STROKE),
      strokeElement: toElement(row.hoeksu_ohaeng, EARTH),
      rootElement: toElement(row.jawon_ohaeng, EARTH),
      pronunciationElement: toElement(row.pronunciation_ohaeng, EARTH),
      pronunciationPolarityBit: toBit(row.pronunciation_eumyang),
      strokePolarityBit: toBit(row.hoeksu_eumyang),
      radical: toText(row.boosoo),
      isSurname: toInt(row.is_surname, isSurnameDefault ? 1 : 0) === 1,
    };
  }

  getHanjaInfo(korean: string, hanja: string, isSurname: boolean): HanjaEntry {
    const k = toText(korean);
    const h = toText(hanja);
    const flag = isSurname ? 1 : 0;

    if (k && h) {
      const row = this.stmts.exact.get(k, h, flag) as HanjaRow | undefined;
      if (row) return this.toEntry(row, isSurname);
    }
    if (h) {
      const row = this.stmts.byHanja.get(h, flag) as HanjaRow | undefined;
      if (row) return this.toEntry(row, isSurname);
    }
    return fallbackEntry(k || "_", h || "_", isSurname);
  }

  getHanjaStrokeCount(korean: string, hanja: string, isSurname: boolean): number {
    return this.getHanjaInfo(korean, hanja, isSurname).strokeCount;
  }

  getSurnamePairs(surname: string, surnameHanja: string): NameBlock[] {
    const kChars = Array.from(trim(surname));
    const hChars = Array.from(trim(surnameHanja));
    if (kChars.length <= 1) {
      return [{ korean: kChars[0] ?? "", hanja: hChars[0] ?? "" }];
    }
    return kChars.map((c, i) => ({ korean: c, hanja: hChars[i] ?? "" }));
  }

  isSurname(korean: string, hanja: string): boolean {
    const k = toText(korean);
    const h = toText(hanja);
    return !!(k && h && (this.stmts.surnPair.get(k, h) || this.stmts.exact.get(k, h, 1)));
  }

  private queryAll(stmtKey: string, value: string, isSurname: boolean): readonly HanjaEntry[] {
    const t = toText(value);
    if (!t) return [];
    return (this.stmts[stmtKey].all(t) as HanjaRow[]).map(r => this.toEntry(r, isSurname));
  }

  findNameByHangul(hangul: string)     { return this.queryAll("nameByH", hangul, false); }
  findSurnameByHangul(hangul: string)  { return this.queryAll("surnByH", hangul, true); }
  findNameByHanja(hanja: string)       { return this.queryAll("nameByHj", hanja, false); }
  findNameByChosung(chosung: string)   { return this.queryAll("nameByCho", chosung, false); }
  findNameByJungsung(jungsung: string) { return this.queryAll("nameByJng", jungsung, false); }
}

// ════════════════════════════════════════════════════════════════════════════
//  §7  STATS REPOSITORY
// ════════════════════════════════════════════════════════════════════════════

interface StatsNameRow  { payload_json: unknown }
interface StatsComboRow { name_hangul: unknown; name_hanja: unknown }

function parseYearMap(input: Record<string, unknown> | undefined): Record<number, number> {
  if (!input) return {};
  const out: Record<number, number> = {};
  for (const [k, v] of Object.entries(input)) {
    const key = parseInt(k, 10);
    const val = typeof v === "number" ? v : parseFloat(String(v));
    if (!isNaN(key) && !isNaN(val)) out[YEAR_BASE + key] = val;
  }
  return out;
}

function parseStatsPayload(payload: unknown): NameStatistics | null {
  if (typeof payload !== "string") return null;
  try {
    const p = JSON.parse(payload);
    if (!p || typeof p !== "object") return null;
    const row = p as Record<string, unknown>;
    const rank  = (row.r as Record<string, Record<string, unknown>>) ?? {};
    const birth = (row.b as Record<string, Record<string, unknown>>) ?? {};
    return {
      similarNames:     toStringList(row.s),
      totalRankByYear:  parseYearMap(rank.t),
      maleRankByYear:   parseYearMap(rank.m),
      totalBirthByYear: parseYearMap(birth.t),
      maleBirthByYear:  parseYearMap(birth.m),
      hanjaCombinations: toStringList(row.h),
    };
  } catch {
    return null;
  }
}

// ── Block classification ──

type BlockType = "syllable" | "chosung" | "jungsung" | "empty" | "other";

function classifyBlock(b: NameBlock): BlockType {
  if (b.korean === "_" || !b.korean) return "empty";
  if (b.korean.length !== 1) return "other";
  if (isSyllable(b.korean)) return "syllable";
  if (CHOSUNG_SET.has(b.korean)) return "chosung";
  if (JUNGSUNG_SET.has(b.korean)) return "jungsung";
  return "other";
}

function matchesKorean(block: NameBlock, char: string): boolean {
  switch (classifyBlock(block)) {
    case "empty":    return true;
    case "syllable": return block.korean === char;
    case "chosung":  return extractCho(char) === block.korean;
    case "jungsung": return extractJung(char) === block.korean;
    default:         return false;
  }
}

function blockMatchesAt(block: NameBlock, nameChar: string, hanjaChar: string): boolean {
  return matchesKorean(block, nameChar) &&
    (!block.hanja || block.hanja === "_" || block.hanja === hanjaChar);
}

function allBlocksMatch(blocks: readonly NameBlock[], korean: string, hanja: string): boolean {
  const nc = Array.from(korean);
  const hc = Array.from(hanja);
  return blocks.every((b, i) => blockMatchesAt(b, nc[i] ?? "", hc[i] ?? ""));
}

function indexKeyFor(b: NameBlock): string | null {
  const bt = classifyBlock(b);
  if (bt === "chosung") return CHO_ENG[b.korean] ?? "misc";
  if (bt === "syllable") return CHO_ENG[extractCho(Array.from(b.korean)[0] ?? "")] ?? "misc";
  return null;
}

function indexKeyForName(name: string): string {
  return CHO_ENG[extractCho(Array.from(name)[0] ?? "")] ?? "misc";
}

const INDEXED_COLS = ["k1","k2","k3","h1","h2","h3","c1","c2","c3","j1","j2","j3","stroke_key"];

export class SqliteStatsRepository implements StatsRepository {
  private readonly stmts: {
    filesByKey: SqliteStatement;
    allFiles: SqliteStatement;
    statsByName: SqliteStatement;
    combosByFileLen: SqliteStatement;
    hasIndexed: boolean;
  };

  private readonly cache = {
    names:      new Map<string, NameStatistics | null>(),
    filesByKey: new Map<string, string[]>(),
    combos:     new Map<string, NameCombination[]>(),
    idxCombos:  new Map<string, NameCombination[]>(),
    idxQueries: new Map<string, SqliteStatement>(),
    allFiles:   null as string[] | null,
  };

  static create(dbPath: string, opener?: SqliteDatabaseOpener) {
    return new SqliteStatsRepository(openSqliteDatabase(dbPath, opener ?? null));
  }

  static fromDatabase(db: SqliteDatabase) {
    return new SqliteStatsRepository(db);
  }

  constructor(private readonly db: SqliteDatabase) {
    let hasIndexed = false;
    try {
      const cols = new Set(
        (db.prepare("PRAGMA table_info(stats_combinations)").all() as { name: unknown }[])
          .map(r => toText(r.name)),
      );
      hasIndexed = INDEXED_COLS.every(c => cols.has(c));
    } catch { /* table may not exist */ }

    this.stmts = {
      filesByKey:     db.prepare("SELECT file_id FROM stats_index WHERE chosung_key = ? ORDER BY ord, file_id"),
      allFiles:       db.prepare("SELECT file_id FROM stats_index ORDER BY rowid"),
      statsByName:    db.prepare("SELECT payload_json FROM stats_name WHERE file_id = ? AND name_hangul = ? LIMIT 1"),
      combosByFileLen: db.prepare("SELECT name_hangul, name_hanja FROM stats_combinations WHERE file_id = ? AND name_length = ? ORDER BY rowid"),
      hasIndexed,
    };
  }

  findByName(nameHangul: string): NameStatistics | null {
    const name = trim(nameHangul);
    if (!name) return null;
    return cached(this.cache.names, name, () => {
      for (const fid of this.getFiles(indexKeyForName(name))) {
        const row = this.stmts.statsByName.get(fid, name) as StatsNameRow | undefined;
        if (row) {
          const stats = parseStatsPayload(row.payload_json);
          if (stats) return stats;
        }
      }
      return null;
    });
  }

  findNameCombinations(blocks: NameBlock[], strokeKeys?: ReadonlySet<string>): NameCombination[] {
    if (!blocks.length) return [];

    const first = blocks[0]!;
    const key = indexKeyFor(first);
    const files = key !== null ? this.getFiles(key) : this.getAllFiles();
    const useIdx = this.stmts.hasIndexed && blocks.length <= 3;
    const out: NameCombination[] = [];

    for (const fid of files) {
      if (useIdx) {
        out.push(...this.loadIndexed(fid, blocks, strokeKeys));
        continue;
      }
      const combos = this.loadCombos(fid, blocks.length);
      for (const c of combos) {
        if (matchesKorean(first, Array.from(c.korean)[0] ?? "") && allBlocksMatch(blocks, c.korean, c.hanja)) {
          out.push(c);
        }
      }
    }
    return out;
  }

  private getFiles(key: string): string[] {
    return cached(this.cache.filesByKey, key, () =>
      (this.stmts.filesByKey.all(key) as { file_id: unknown }[])
        .map(r => toText(r.file_id))
        .filter(id => id.length > 0),
    );
  }

  private getAllFiles(): string[] {
    return this.cache.allFiles ??=
      (this.stmts.allFiles.all() as { file_id: unknown }[])
        .map(r => toText(r.file_id))
        .filter(id => id.length > 0);
  }

  private parseCombos(rows: StatsComboRow[], expectedLen: number): NameCombination[] {
    return rows
      .map(r => ({ korean: toText(r.name_hangul), hanja: toText(r.name_hanja) }))
      .filter(v =>
        v.korean.length > 0 && v.hanja.length > 0 &&
        Array.from(v.korean).length === expectedLen &&
        Array.from(v.hanja).length === expectedLen,
      );
  }

  private loadCombos(fid: string, len: number): NameCombination[] {
    return cached(this.cache.combos, `${fid}|${len}`, () =>
      this.parseCombos(this.stmts.combosByFileLen.all(fid, len) as StatsComboRow[], len),
    );
  }

  private loadIndexed(fid: string, blocks: NameBlock[], strokeKeys?: ReadonlySet<string>): NameCombination[] {
    const blockKey = blocks.map(b => `${b.korean}/${b.hanja}`).join(",");
    const strokeKeyStr = strokeKeys && strokeKeys.size > 0 && strokeKeys.size <= MAX_STROKE_SQL
      ? Array.from(strokeKeys).filter(k => k.length > 0).sort().join(",")
      : "";
    const cacheKey = strokeKeyStr ? `${fid}|${blockKey}|${strokeKeyStr}` : `${fid}|${blockKey}`;

    return cached(this.cache.idxCombos, cacheKey, () => {
      const clauses = ["file_id = ?", "name_length = ?"];
      const params: unknown[] = [fid, blocks.length];

      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i]!;
        const pos = i + 1;
        const bt = classifyBlock(b);

        if (bt === "syllable")      { clauses.push(`k${pos} = ?`); params.push(b.korean); }
        else if (bt === "chosung")  { clauses.push(`c${pos} = ?`); params.push(b.korean); }
        else if (bt === "jungsung") { clauses.push(`j${pos} = ?`); params.push(b.korean); }
        else if (bt !== "empty") {
          return this.loadCombos(fid, blocks.length).filter(c => allBlocksMatch(blocks, c.korean, c.hanja));
        }

        if (b.hanja && b.hanja !== "_") {
          clauses.push(`h${pos} = ?`);
          params.push(b.hanja);
        }
      }

      if (strokeKeys && strokeKeys.size > 0 && strokeKeys.size <= MAX_STROKE_SQL) {
        const keys = Array.from(strokeKeys).filter(k => k.length > 0).sort();
        if (keys.length > 0) {
          clauses.push(`stroke_key IN (${keys.map(() => "?").join(",")})`);
          params.push(...keys);
        }
      }

      const sql = `SELECT name_hangul, name_hanja FROM stats_combinations WHERE ${clauses.join(" AND ")} ORDER BY rowid`;
      const stmt = cached(this.cache.idxQueries, sql, () => this.db.prepare(sql));
      return this.parseCombos(stmt.all(...params) as StatsComboRow[], blocks.length);
    });
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  §8  FOUR-FRAME MAP
// ════════════════════════════════════════════════════════════════════════════

const FORTUNE_KEYWORDS: [string, LuckyLevel][] = [
  ["최상운수", "최상운수"],
  ["최흉운수", "최흉운수"],
  ["상운수",   "상운수"],
  ["양운수",   "양운수"],
  ["흉운수",   "흉운수"],
];

function normalizeFortune(v: unknown): LuckyLevel {
  const t = trim(String(v ?? ""));
  for (const [keyword, level] of FORTUNE_KEYWORDS) {
    if (t.includes(keyword)) return level;
  }
  return FORTUNE_UNDEF;
}

function loadFourFrameMap(db: SqliteDatabase): Map<number, LuckyLevel> {
  const rows = db.prepare("SELECT number, lucky_level FROM sagyeok_data ORDER BY number").all() as {
    number: unknown;
    lucky_level: unknown;
  }[];

  const map = new Map<number, LuckyLevel>();
  for (const r of rows) {
    const n = toInt(r.number, NaN);
    if (!isNaN(n)) map.set(n, normalizeFortune(r.lucky_level));
  }
  if (!map.size) throw new Error("sagyeok_data is empty");
  return map;
}

// ════════════════════════════════════════════════════════════════════════════
//  §9  NAME CALCULATOR
// ════════════════════════════════════════════════════════════════════════════

function polarityFromBit(v: number): Polarity {
  return POLARITY_BY_BIT[(Math.abs(v) % 2) as 0 | 1];
}

function elementFromLastDigit(stroke: number): Element {
  const d = Math.abs(stroke) % 10;
  if (d <= 0) return "水";
  if (d <= 2) return "木";
  if (d <= 4) return "火";
  if (d <= 6) return "土";
  if (d <= 8) return "金";
  return "水";
}

function adjustTo81(v: number): number {
  return v <= FF_MOD ? v : ((v - 1) % FF_MOD) + 1;
}

function computeFourFrame(surnameStrokes: readonly number[], givenStrokes: readonly number[]): FourFrame {
  const padded = [...givenStrokes];
  if (padded.length === 1) padded.push(0);

  const mid = Math.floor(padded.length / 2);
  const sTotal = sum(surnameStrokes);

  return {
    origin:  adjustTo81(sum(padded)),
    form:    adjustTo81(sTotal + sum(padded.slice(0, mid))),
    profit:  adjustTo81(sTotal + sum(padded.slice(mid))),
    harmony: adjustTo81(sTotal + sum(givenStrokes)),
  };
}

/** Pre-computed name properties derived from resolved hanja entries. */
class NameCalc {
  readonly ff: FourFrame;
  readonly ffElements: Element[];
  readonly strokeElements: Element[];
  readonly rootElements: Element[];
  readonly strokePolarities: Polarity[];
  readonly pronElements: Element[];
  readonly pronPolarities: Polarity[];

  constructor(surname: readonly HanjaEntry[], given: readonly HanjaEntry[]) {
    const all = [...surname, ...given];

    this.ff = computeFourFrame(
      surname.map(e => e.strokeCount),
      given.map(e => e.strokeCount),
    );

    this.ffElements = [
      elementFromLastDigit(this.ff.profit),
      elementFromLastDigit(this.ff.form),
      elementFromLastDigit(this.ff.origin),
    ];

    this.strokeElements   = all.map(e => e.strokeElement);
    this.rootElements     = all.map(e => e.rootElement);
    this.strokePolarities = all.map(e => polarityFromBit(e.strokePolarityBit));

    this.pronElements = all.map(e =>
      e.pronunciationElement || (CHO_ELEMENT[extractCho(e.hangul)] ?? "水") as Element,
    );

    this.pronPolarities = all.map(e => {
      if (e.pronunciationPolarityBit === 0 || e.pronunciationPolarityBit === 1) {
        return polarityFromBit(e.pronunciationPolarityBit);
      }
      return YANG_VOWELS.has(extractJung(e.hangul)) ? YANG : EUM;
    });
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  §10 OHAENG (ELEMENT & POLARITY) RULES
// ════════════════════════════════════════════════════════════════════════════

/** 상생 (producing cycle): Wood → Fire → Earth → Metal → Water → Wood */
function isSangsaeng(a: Element, b: Element): boolean {
  return (ELEMENT_INDEX[a] + 1) % ELEMENT_COUNT === ELEMENT_INDEX[b];
}

/** 상극 (overcoming cycle): Wood ↔ Earth, Fire ↔ Metal, etc. */
function isSanggeuk(a: Element, b: Element): boolean {
  const ia = ELEMENT_INDEX[a];
  const ib = ELEMENT_INDEX[b];
  return (ia + 2) % ELEMENT_COUNT === ib || (ib + 2) % ELEMENT_COUNT === ia;
}

function adjacencyScore(arr: readonly Element[], surnameLen = 1): number {
  if (arr.length < 2) return 100;

  let ssCount = 0;
  let sgCount = 0;
  let sameCount = 0;

  for (let i = 0; i < arr.length - 1; i++) {
    if (surnameLen === 2 && i === 0) continue;
    const a = arr[i]!;
    const b = arr[i + 1]!;
    if (isSangsaeng(a, b)) ssCount++;
    else if (isSanggeuk(a, b)) sgCount++;
    else if (a === b) sameCount++;
  }

  return clamp(P.elBase + ssCount * P.elSSBon - sgCount * P.elSGPen - sameCount * P.elSamePen, 0, 100);
}

function balanceScore(dist: Record<Element, number>): number {
  const total = Dist.total(dist);
  if (!total) return 0;

  const avg = total / ELEMENT_COUNT;
  let deviation = 0;
  for (const k of ELEMENTS) deviation += Math.abs((dist[k] ?? 0) - avg);

  for (const [threshold, score] of P.elBalBr) {
    if (deviation <= threshold) return score;
  }
  return P.elBalFloor;
}

interface ElementEvaluation {
  dist: Record<Element, number>;
  adj: number;
  bal: number;
  score: number;
}

function evaluateElements(arr: readonly Element[], surnameLen: number): ElementEvaluation {
  const dist = Dist.fromArray(arr);
  const adj  = adjacencyScore(arr, surnameLen);
  const bal  = balanceScore(dist);
  return { dist, adj, bal, score: (bal + adj) / 2 };
}

function checkSangsaengSequence(arr: readonly Element[], surnameLen: number): boolean {
  if (arr.length < 2) return true;
  const start = surnameLen === 2 ? 1 : 0;

  // No 상극 between adjacent elements
  for (let i = start; i < arr.length - 1; i++) {
    if (isSanggeuk(arr[i]!, arr[i + 1]!)) return false;
  }

  // No more than P.elMaxCons consecutive identical elements
  let consecutive = 1;
  for (let i = (surnameLen === 2 ? 2 : 1); i < arr.length; i++) {
    if (arr[i] === arr[i - 1]) {
      consecutive++;
      if (consecutive >= P.elMaxCons) return false;
    } else {
      consecutive = 1;
    }
  }

  // First-last 상극 check (skip for 2-char surname + 3 total)
  if (!(surnameLen === 2 && arr.length === 3) && isSanggeuk(arr[0]!, arr[arr.length - 1]!)) {
    return false;
  }

  // Minimum 상생 ratio among non-same-element pairs
  let relationships = 0;
  let ssCount = 0;
  for (let i = 0; i < arr.length - 1; i++) {
    if (surnameLen === 2 && i === 0) continue;
    if (arr[i] === arr[i + 1]) continue;
    relationships++;
    if (isSangsaeng(arr[i]!, arr[i + 1]!)) ssCount++;
  }

  return !relationships || ssCount / relationships >= P.elSSMinR;
}

function checkFourFrameElements(arr: readonly Element[], givenLen: number): boolean {
  const checked = givenLen === 1 && arr.length === 3 ? arr.slice(0, 2) : arr.slice();
  if (checked.length < 2) return false;

  for (let i = 0; i < checked.length - 1; i++) {
    if (isSanggeuk(checked[i]!, checked[i + 1]!)) return false;
  }
  return !isSanggeuk(checked[checked.length - 1]!, checked[0]!) && new Set(checked).size > 1;
}

function hasDominantElement(dist: Record<Element, number>): boolean {
  const total = Dist.total(dist);
  return ELEMENTS.some(k => dist[k] >= Math.floor(total / 2) + 1);
}

function checkPolarityHarmony(arr: readonly Polarity[], surnameLen: number): boolean {
  if (arr.length < 2) return true;
  const eumCount = arr.filter(v => v === EUM).length;
  return eumCount > 0 && eumCount < arr.length && !(surnameLen === 1 && arr[0] === arr[arr.length - 1]);
}

function polarityScore(eumCount: number, yangCount: number): number {
  const total = Math.max(0, eumCount + yangCount);
  if (!total) return 0;

  const ratio = Math.min(eumCount, yangCount) / total;
  let ratioScore = P.polFloor;
  for (const [threshold, score] of P.polBr) {
    if (ratio >= threshold) { ratioScore = score; break; }
  }
  return P.polBase + ratioScore;
}

interface PolarityEvaluation {
  score: number;
  isPassed: boolean;
  arr: readonly Polarity[];
}

function evaluatePolarity(arr: readonly Polarity[], surnameLen: number): PolarityEvaluation {
  const eumCount = arr.filter(v => v === EUM).length;
  return {
    score: polarityScore(eumCount, arr.length - eumCount),
    isPassed: checkPolarityHarmony(arr, surnameLen),
    arr,
  };
}

const FORTUNE_BUCKETS: [string, number][] = [
  ["최상", P.fTop], ["상", P.fHigh], ["양", P.fGood], ["최흉", P.fWorst], ["흉", P.fBad],
];

function fortuneBucket(fortune: string): number {
  for (const [keyword, value] of FORTUNE_BUCKETS) {
    if ((fortune ?? "").includes(keyword)) return value;
  }
  return P.fDef;
}

// ════════════════════════════════════════════════════════════════════════════
//  §11 SAJU DISTRIBUTION RESOLVER
// ════════════════════════════════════════════════════════════════════════════

function toSajuGender(g?: Gender): SajuGender {
  return g === "FEMALE" || g === "female" ? SajuGender.FEMALE : SajuGender.MALE;
}

function pillarSummary(analysis: SajuAnalysis, pos: "year" | "month" | "day" | "hour"): SajuPillarSummary {
  const p = analysis.pillars[pos];
  const si = CHEONGAN_INFO[p.cheongan];
  const bi = JIJI_INFO[p.jiji];
  return {
    stemCode: p.cheongan, stemHangul: si.hangul, stemHanja: si.hanja,
    branchCode: p.jiji, branchHangul: bi.hangul, branchHanja: bi.hanja,
    hangul: `${si.hangul}${bi.hangul}`, hanja: `${si.hanja}${bi.hanja}`,
  };
}

function toOutputSummary(analysis: SajuAnalysis, dist: Record<Element, number>): SajuOutputSummary {
  const dm = analysis.pillars.day.cheongan;
  const dmi = CHEONGAN_INFO[dm];

  const dayMaster: SajuDayMasterSummary = {
    stemCode: dm, stemHangul: dmi.hangul, stemHanja: dmi.hanja,
    elementCode: dmi.ohaeng, element: OHAENG_TO_ELEMENT[dmi.ohaeng], eumyangCode: dmi.eumyang,
  };

  const yongshin: SajuYongshinSummary | null = analysis.yongshinResult ? {
    finalYongshin: analysis.yongshinResult.finalYongshin,
    finalHeesin: analysis.yongshinResult.finalHeesin ?? null,
    gisin: analysis.yongshinResult.gisin ?? null,
    gusin: analysis.yongshinResult.gusin ?? null,
    finalConfidence: analysis.yongshinResult.finalConfidence,
    agreement: analysis.yongshinResult.agreement,
    recommendations: analysis.yongshinResult.recommendations.map(r => ({
      type: r.type, primaryElement: r.primaryElement,
      secondaryElement: r.secondaryElement ?? null,
      confidence: r.confidence, reasoning: r.reasoning,
    })),
  } : null;

  const strength: SajuStrengthSummary | null = analysis.strengthResult ? {
    level: analysis.strengthResult.level,
    isStrong: analysis.strengthResult.isStrong,
    totalSupport: analysis.strengthResult.score.totalSupport,
    totalOppose: analysis.strengthResult.score.totalOppose,
  } : null;

  const gyeokguk: SajuGyeokgukSummary | null = analysis.gyeokgukResult ? {
    type: analysis.gyeokgukResult.type,
    category: analysis.gyeokgukResult.category,
    confidence: analysis.gyeokgukResult.confidence,
    reasoning: analysis.gyeokgukResult.reasoning,
    formation: analysis.gyeokgukResult.formation ? {
      quality: analysis.gyeokgukResult.formation.quality,
      breakingFactors: [...analysis.gyeokgukResult.formation.breakingFactors],
      rescueFactors: [...analysis.gyeokgukResult.formation.rescueFactors],
      reasoning: analysis.gyeokgukResult.formation.reasoning,
    } : null,
  } : null;

  let tenGod: SajuTenGodSummary | null = null;
  if (analysis.tenGodAnalysis) {
    const gc: SajuTenGodGroupCounts = { friend: 0, output: 0, wealth: 0, authority: 0, resource: 0 };
    for (const pa of Object.values(analysis.tenGodAnalysis.byPosition)) {
      if (!pa) continue;
      const cg = TG_MAP[pa.cheonganSipseong]; if (cg) gc[cg]++;
      const pg = TG_MAP[pa.jijiPrincipalSipseong]; if (pg) gc[pg]++;
    }
    const vals = TG_GROUPS.map(k => gc[k]);
    const maxVal = Math.max(...vals);
    const minVal = Math.min(...vals);
    tenGod = {
      dayMasterStemCode: analysis.tenGodAnalysis.dayMaster,
      groupCounts: gc,
      dominantGroups: TG_GROUPS.filter(k => gc[k] === maxVal && maxVal > 0),
      weakGroups: TG_GROUPS.filter(k => gc[k] === minVal),
    };
  }

  return {
    pillars: {
      year:  pillarSummary(analysis, "year"),
      month: pillarSummary(analysis, "month"),
      day:   pillarSummary(analysis, "day"),
      hour:  pillarSummary(analysis, "hour"),
    },
    ohaengDistribution: Dist.clone(dist),
    dayMaster, yongshin, strength, gyeokguk, tenGod,
    trace: analysis.trace.map(s => ({
      key: s.key, summary: s.summary,
      evidence: [...s.evidence], citations: [...s.citations],
      reasoning: [...s.reasoning], confidence: s.confidence,
    })),
  };
}

function resolveSajuDistribution(
  birth: BirthInfo | undefined,
  gender: Gender | undefined,
  fallback: Record<Element, number>,
): SajuDistributionResolution {
  const fb = Dist.clone(fallback);
  if (!birth) return { distribution: fb, source: "fallback", input: null, output: null, error: null };

  const sajuGender = toSajuGender(gender);
  const canonicalGender = sajuGender === SajuGender.FEMALE ? "FEMALE" as const : "MALE" as const;

  const input: SajuInputSummary = {
    birthYear: birth.year, birthMonth: birth.month, birthDay: birth.day,
    birthHour: birth.hour, birthMinute: birth.minute,
    gender: canonicalGender, timezone: "Asia/Seoul", latitude: 37.5665, longitude: 126.978,
  };

  try {
    const birthInput = createBirthInput({
      birthYear: birth.year, birthMonth: birth.month, birthDay: birth.day,
      birthHour: birth.hour, birthMinute: birth.minute, gender: sajuGender,
      timezone: input.timezone, latitude: input.latitude, longitude: input.longitude,
    });
    const analysis = analyzeSaju(birthInput);

    if (!analysis.ohaengDistribution) {
      return { distribution: fb, source: "fallback", input, output: null, error: "No ohaeng distribution." };
    }

    const dist = Dist.empty();
    for (const [ohaeng, count] of analysis.ohaengDistribution.entries()) {
      dist[OHAENG_TO_ELEMENT[ohaeng]] = count;
    }
    return { distribution: dist, source: "birth", input, output: toOutputSummary(analysis, dist), error: null };
  } catch (e) {
    return {
      distribution: fb, source: "fallback", input, output: null,
      error: e instanceof Error ? e.message : "Saju analysis failed.",
    };
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  §12 SAJU SCORING
// ════════════════════════════════════════════════════════════════════════════

function elementFromCode(v: string | null | undefined): Element | null {
  return v ? SAJU_ELEMENT_MAP[v] ?? null : null;
}

function cycleElement(el: Element, offset: number): Element {
  return ELEMENTS[((ELEMENTS.indexOf(el)) + offset + ELEMENT_COUNT) % ELEMENT_COUNT]!;
}

function normalizeSignedToPercent(v: number): number {
  return clamp((v + 1) * 50, 0, 100);
}

function computeOptimalDistribution(initial: number[], count: number): number[] {
  const sorted = [...initial].sort((a, b) => a - b);
  let remaining = count;
  let level = 0;

  while (level < ELEMENT_COUNT - 1 && remaining > 0) {
    const curr = sorted[level]!;
    const next = sorted[level + 1] ?? curr;
    const width = level + 1;
    const diff = next - curr;

    if (!diff) { level++; continue; }

    if (remaining >= diff * width) {
      for (let k = 0; k <= level; k++) sorted[k]! += diff;
      remaining -= diff * width;
      level++;
    } else {
      const share = Math.floor(remaining / width);
      const extra = remaining % width;
      for (let k = 0; k <= level; k++) sorted[k]! += share;
      for (let k = 0; k < extra; k++) sorted[k]!++;
      remaining = 0;
    }
  }

  if (remaining > 0) {
    const share = Math.floor(remaining / ELEMENT_COUNT);
    const extra = remaining % ELEMENT_COUNT;
    for (let k = 0; k < ELEMENT_COUNT; k++) sorted[k]! += share;
    for (let k = 0; k < extra; k++) sorted[k]!++;
  }

  return sorted;
}

interface BalanceResult {
  score: number;
  isPassed: boolean;
  combined: Record<Element, number>;
}

function computeBalance(sajuDist: Record<Element, number>, rootDist: Record<Element, number>): BalanceResult {
  const initial  = ELEMENTS.map(k => sajuDist[k] ?? 0);
  const rootCounts = ELEMENTS.map(k => rootDist[k] ?? 0);
  const final    = initial.map((v, i) => v + rootCounts[i]!);
  const rootTotal = sum(rootCounts);
  const deltas   = final.map((v, i) => v - initial[i]!);

  if (deltas.some(v => v < 0) || sum(deltas) !== rootTotal) {
    return { score: 0, isPassed: false, combined: Dist.empty() };
  }

  const optimal  = computeOptimalDistribution(initial, rootTotal);
  const finalSorted = [...final].sort((a, b) => a - b);
  const isOptimal = finalSorted.every((v, i) => v === optimal[i]);

  const finalZeros   = final.filter(v => !v).length;
  const optimalZeros = optimal.filter(v => !v).length;
  const spread       = Math.max(...final) - Math.min(...final);
  const optSpread    = Math.max(...optimal) - Math.min(...optimal);
  const moves        = Math.floor(finalSorted.reduce((acc, v, i) => acc + Math.abs(v - optimal[i]!), 0) / 2);

  const score = (!rootTotal && final.every((v, i) => v === initial[i])) || isOptimal
    ? 100
    : clamp(
        100
        - P.balMovePen * moves
        - P.balZeroPen * Math.max(0, finalZeros - optimalZeros)
        - P.balSpreadPen * Math.max(0, spread - optSpread),
        0, 100,
      );

  return {
    score,
    isPassed: isOptimal || (finalZeros <= optimalZeros && spread <= optSpread && score >= P.balPassTh),
    combined: Object.fromEntries(ELEMENTS.map((e, i) => [e, final[i]!])) as Record<Element, number>,
  };
}

function computeYongshin(rootDist: Record<Element, number>, yng: SajuYongshinSummary | null) {
  const nil = {
    score: 50, confidence: 0, contextualPriority: 0,
    gisinPenalty: 0, gusinPenalty: 0, gisinRatio: 0, gusinRatio: 0,
    elementMatches: { yongshin: 0, heesin: 0, gisin: 0, gusin: 0 },
  };
  if (!yng) return nil;

  const ye = elementFromCode(yng.finalYongshin);
  const he = elementFromCode(yng.finalHeesin);
  const ge = elementFromCode(yng.gisin);
  const gu = elementFromCode(yng.gusin);
  const conf = Number.isFinite(yng.finalConfidence) ? clamp(yng.finalConfidence, 0, 1) : P.defConf;

  // Affinity score: how well root elements align with yongshin/heesin vs gisin/gusin
  const affinity = Dist.weightedAvg(rootDist, e => {
    if (gu && e === gu) return P.guAff;
    if (ge && e === ge) return P.giAff;
    if (ye && e === ye) return P.ysAff;
    if (he && e === he) return P.hsAff;
    return 0;
  });
  const affinityScore = normalizeSignedToPercent(affinity);

  // Recommendation-based score
  let recResult: { score: number; contextualPriority: number } | null = null;
  if (yng.recommendations.length) {
    let weightedSum = 0;
    let totalWeight = 0;
    let contextWeight = 0;

    for (const rec of yng.recommendations) {
      const pe = elementFromCode(rec.primaryElement);
      const se = elementFromCode(rec.secondaryElement);
      if (!pe && !se) continue;

      const rc = Number.isFinite(rec.confidence) ? clamp(rec.confidence, 0, 1) : P.defRecConf;
      const w = Math.max(0.1, rc * (P.ysTypeW[rec.type] ?? P.ysTypeWDef));

      weightedSum += Dist.weightedAvg(rootDist, e => {
        if (pe && e === pe) return 1;
        if (se && e === se) return P.secElW;
        return 0;
      }) * w;

      totalWeight += w;
      if (P.ctxYsTypes.has(rec.type)) contextWeight += w;
    }

    if (totalWeight > 0) {
      recResult = {
        score: clamp((weightedSum / totalWeight) * 100, 0, 100),
        contextualPriority: clamp(contextWeight / totalWeight, 0, 1),
      };
    }
  }

  const raw = recResult === null ? affinityScore : P.affW * affinityScore + P.recW * recResult.score;
  const score = clamp(50 + (raw - 50) * (P.confBase + conf * P.confMul), 0, 100);

  const total = Dist.total(rootDist);
  const giCount = Dist.get(rootDist, ge);
  const guCount = Dist.get(rootDist, gu);
  const giRatio = total > 0 ? giCount / total : 0;
  const guRatio = total > 0 ? guCount / total : 0;
  const penFactor = P.penBase + P.penConf * conf;

  return {
    score, confidence: conf,
    contextualPriority: recResult?.contextualPriority ?? 0,
    gisinPenalty: Math.round(giRatio * P.giPenMul * penFactor),
    gusinPenalty: Math.round(guRatio * P.guPenMul * penFactor),
    gisinRatio: giRatio, gusinRatio: guRatio,
    elementMatches: { yongshin: Dist.get(rootDist, ye), heesin: Dist.get(rootDist, he), gisin: giCount, gusin: guCount },
  };
}

function computeStrengthScore(rootDist: Record<Element, number>, output: SajuOutputSummary | null): number {
  const st = output?.strength;
  const dm = output?.dayMaster?.element;
  if (!st || !dm) return 50;

  const favorable = new Set<Element>();
  const unfavorable = new Set<Element>();

  if (st.isStrong) {
    favorable.add(cycleElement(dm, 1));
    favorable.add(cycleElement(dm, 2));
    favorable.add(cycleElement(dm, -2));
    unfavorable.add(dm);
    unfavorable.add(cycleElement(dm, -1));
  } else {
    favorable.add(dm);
    favorable.add(cycleElement(dm, -1));
    unfavorable.add(cycleElement(dm, 1));
    unfavorable.add(cycleElement(dm, 2));
    unfavorable.add(cycleElement(dm, -2));
  }

  const base = normalizeSignedToPercent(
    Dist.weightedAvg(rootDist, e => favorable.has(e) ? 1 : unfavorable.has(e) ? -1 : 0),
  );

  const sup = Math.abs(st.totalSupport);
  const opp = Math.abs(st.totalOppose);
  const total = sup + opp;
  const intensity = total > 0 ? clamp(Math.abs(sup - opp) / total, 0, 1) : P.strDefInt;

  return clamp(50 + (base - 50) * (P.strScBase + intensity * P.strScInt), 0, 100);
}

function grpElement(dayMaster: Element, group: TGGroup): Element {
  switch (group) {
    case "friend":   return dayMaster;
    case "resource":  return cycleElement(dayMaster, -1);
    case "output":    return cycleElement(dayMaster, 1);
    case "wealth":    return cycleElement(dayMaster, 2);
    case "authority": return cycleElement(dayMaster, -2);
  }
}

function computeTenGodScore(rootDist: Record<Element, number>, output: SajuOutputSummary | null): number {
  const tg = output?.tenGod;
  const dm = output?.dayMaster?.element;
  if (!tg || !dm) return 50;

  const counts = tg.groupCounts;
  const total = TG_GROUPS.reduce((a, g) => a + (counts[g] ?? 0), 0);
  if (total <= 0) return 50;

  const avg = total / TG_GROUPS.length;
  const elementWeights = Dist.empty();

  for (const g of TG_GROUPS) {
    const normalizedDiff = (avg - (counts[g] ?? 0)) / Math.max(avg, 1);
    elementWeights[grpElement(dm, g)] += normalizedDiff >= 0 ? normalizedDiff : normalizedDiff * P.tgOverMul;
  }

  return clamp(50 + Dist.weightedAvg(rootDist, e => clamp(elementWeights[e], -1, 1)) * P.tgScMul, 0, 100);
}

interface SajuScoreResult {
  score: number;
  isPassed: boolean;
  combined: Record<Element, number>;
  breakdown: {
    balance: number; yongshin: number; strength: number; tenGod: number;
    weights: Record<string, number>; weightedBeforePenalty: number;
    penalties: { gisin: number; gusin: number; total: number };
    elementMatches: Record<string, number>;
  };
}

function computeSajuScore(
  sajuDist: Record<Element, number>,
  rootDist: Record<Element, number>,
  sajuOut: SajuOutputSummary | null,
): SajuScoreResult {
  const bal = computeBalance(sajuDist, rootDist);
  const yng = computeYongshin(rootDist, sajuOut?.yongshin ?? null);
  const str = computeStrengthScore(rootDist, sajuOut);
  const tg  = computeTenGodScore(rootDist, sajuOut);

  // Dynamic weight adjustment based on confidence and score divergence
  let bw = P.wBal;
  let yw = P.wYng;
  const convergence = clamp((yng.score - bal.score) / P.wConDiv, 0, 1);
  const confidence  = clamp(yng.confidence, 0, 1);
  const ctxPri      = clamp(yng.contextualPriority, 0, 1);
  const shift = P.wShCon * convergence * (P.wShCB + P.wShCM * confidence) + P.wShCtx * confidence * ctxPri;

  bw = clamp(bw - shift, P.wBalMin, P.wBalMax);
  yw = clamp(yw + shift, P.wYngMin, P.wYngMax);

  const totalWeight = bw + yw + P.wStr + P.wTG;
  const weights = {
    balance:  bw / totalWeight,
    yongshin: yw / totalWeight,
    strength: P.wStr / totalWeight,
    tenGod:   P.wTG / totalWeight,
  };

  const weighted = clamp(
    weights.balance * bal.score + weights.yongshin * yng.score + weights.strength * str + weights.tenGod * tg,
    0, 100,
  );
  const penalty = yng.gisinPenalty + yng.gusinPenalty;
  const score = clamp(weighted - penalty, 0, 100);
  const hasYongshin = sajuOut?.yongshin != null;

  return {
    score,
    isPassed: score >= P.passMin && bal.score >= P.passBal &&
      (!hasYongshin || (yng.score >= P.passYng && yng.gusinRatio < P.severeGu)),
    combined: bal.combined,
    breakdown: {
      balance: bal.score, yongshin: yng.score, strength: str, tenGod: tg,
      weights, weightedBeforePenalty: weighted,
      penalties: { gisin: yng.gisinPenalty, gusin: yng.gusinPenalty, total: penalty },
      elementMatches: yng.elementMatches,
    },
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  §13 EVALUATION PIPELINE
// ════════════════════════════════════════════════════════════════════════════

interface EvalContext {
  name: NameInput;
  resolved: ResolvedName;
  surnameLen: number;
  givenLen: number;
  birth?: BirthInfo;
  gender?: Gender;
  luckyMap: Map<number, LuckyLevel>;
  sajuDist: Record<Element, number>;
  sajuSource: SajuDistributionSource;
  sajuInput: SajuInputSummary | null;
  sajuOutput: SajuOutputSummary | null;
  sajuError: string | null;
  stats: NameStatistics | null;
  calc: NameCalc;
  insights: Partial<Record<Frame, FrameInsight>>;
}

function createInsight(
  frame: Frame,
  score: number,
  isPassed: boolean,
  arrangement: string,
  details: Record<string, unknown> = {},
): FrameInsight {
  return {
    frame,
    score: Math.trunc(clamp(score, 0, 100)),
    isPassed,
    status: isPassed ? "POSITIVE" : "NEGATIVE",
    arrangement,
    details,
  };
}

function runEvaluation(ctx: EvalContext): void {
  const { surnameLen, givenLen, calc, insights } = ctx;
  const adjThreshold = surnameLen === 2 ? P.adjTh2 : P.adjTh1;
  const lookupFortune = (n: number) => ctx.luckyMap.get(n) ?? FORTUNE_UNDEF;

  // ── 1. Four-Frame Fortune ──
  const { ff } = calc;
  const buckets = [
    fortuneBucket(lookupFortune(ff.origin)),
    fortuneBucket(lookupFortune(ff.form)),
  ];
  if (givenLen > 1) buckets.push(fortuneBucket(lookupFortune(ff.profit)));
  buckets.push(fortuneBucket(lookupFortune(ff.harmony)));

  insights["FOUR_FRAME_FORTUNE"] = createInsight(
    "FOUR_FRAME_FORTUNE",
    sum(buckets),
    buckets.every(b => b >= P.fBucketPass),
    `${ff.origin}/${lookupFortune(ff.origin)}-${ff.form}/${lookupFortune(ff.form)}-${ff.profit}/${lookupFortune(ff.profit)}-${ff.harmony}/${lookupFortune(ff.harmony)}`,
    { origin: ff.origin, form: ff.form, profit: ff.profit, harmony: ff.harmony },
  );

  // ── 2–4. Element evaluations (table-driven) ──
  const elementRules: {
    frame: Frame;
    arr: Element[];
    pass: (ev: ElementEvaluation, arr: Element[]) => boolean;
  }[] = [
    {
      frame: "STROKE_ELEMENT",
      arr: calc.strokeElements,
      pass: ev => ev.bal >= P.strokeElPass,
    },
    {
      frame: "FOUR_FRAME_ELEMENT",
      arr: calc.ffElements,
      pass: (ev, a) => checkFourFrameElements(a, givenLen) && !hasDominantElement(ev.dist) && ev.adj >= adjThreshold && ev.score >= P.ffElPass,
    },
    {
      frame: "PRONUNCIATION_ELEMENT",
      arr: calc.pronElements,
      pass: (ev, a) => checkSangsaengSequence(a, surnameLen) && !hasDominantElement(ev.dist) && ev.adj >= adjThreshold && ev.score >= P.pronElPass,
    },
  ];

  for (const rule of elementRules) {
    const ev = evaluateElements(rule.arr, surnameLen);
    insights[rule.frame] = createInsight(
      rule.frame, ev.score, rule.pass(ev, rule.arr), rule.arr.join("-"),
      { distribution: ev.dist, adjacencyScore: ev.adj, balanceScore: ev.bal },
    );
  }

  // ── 5–6. Polarity evaluations (table-driven) ──
  const polarityRules: [Frame, Polarity[]][] = [
    ["STROKE_POLARITY", calc.strokePolarities],
    ["PRONUNCIATION_POLARITY", calc.pronPolarities],
  ];

  for (const [frame, arr] of polarityRules) {
    const ev = evaluatePolarity(arr, surnameLen);
    insights[frame] = createInsight(frame, ev.score, ev.isPassed, arr.join(""), { arrangementList: arr });
  }

  // ── 7. Saju Root Balance ──
  const rootDist = Dist.fromArray(ctx.resolved.given.map(e => e.rootElement));
  const saju = computeSajuScore(ctx.sajuDist, rootDist, ctx.sajuOutput);

  insights["SAJU_ROOT_BALANCE"] = createInsight("SAJU_ROOT_BALANCE", saju.score, saju.isPassed, "SAJU+ROOT", {
    sajuDistribution: ctx.sajuDist,
    sajuDistributionSource: ctx.sajuSource,
    rootDistribution: rootDist,
    sajuRootDistribution: saju.combined,
    sajuScoring: saju.breakdown,
    requestedBirth: ctx.birth,
    requestedGender: ctx.gender,
    sajuInput: ctx.sajuInput,
    sajuOutput: ctx.sajuOutput,
    sajuCalculationError: ctx.sajuError,
  });

  // ── 8. Statistics ──
  insights["STATISTICS"] = createInsight(
    "STATISTICS",
    ctx.stats ? clamp(P.statsBase + ctx.stats.similarNames.length, 0, 100) : 0,
    true,
    "stats",
    { found: ctx.stats !== null },
  );

  // ── 9. NAME_STUDY aggregate ──
  const sajuInsight = insights["SAJU_ROOT_BALANCE"]!;
  const sajuScoring = sajuInsight.details.sajuScoring as Record<string, unknown> | undefined;

  let sajuPriority = 0;
  if (sajuScoring) {
    const balanceVal  = typeof sajuScoring.balance === "number" ? sajuScoring.balance : 0;
    const yongshinVal = typeof sajuScoring.yongshin === "number" ? sajuScoring.yongshin : 0;
    const penaltyObj  = sajuScoring.penalties as Record<string, unknown> | undefined;
    const penaltyTotal = typeof penaltyObj?.total === "number" ? penaltyObj.total : 0;

    const sajuOutput = sajuInsight.details.sajuOutput as Record<string, unknown> | undefined;
    const yongshinData = sajuOutput?.yongshin as Record<string, unknown> | undefined;
    const confidence = clamp(
      typeof yongshinData?.finalConfidence === "number" ? yongshinData.finalConfidence : P.defConf,
      0, 1,
    );

    sajuPriority = clamp(
      ((balanceVal + yongshinVal) / 200) * (P.priBase + confidence * P.priConf) -
      Math.min(1, penaltyTotal / P.priPenDiv) * P.priPenW,
      0, 1,
    );
  }

  const isAdaptive = sajuPriority >= P.adaptTh;

  const signals = SIGNAL_FRAMES.map(([frame, meta]) => {
    const insight = insights[frame]!;
    const multiplier = frame === "SAJU_ROOT_BALANCE"
      ? 1 + sajuPriority * P.sajuBoost
      : RELAXABLE_SET.has(frame) ? 1 - sajuPriority * P.relaxRed : 1;

    const adjustedWeight = meta.signal! * multiplier;
    return {
      frame,
      score: insight.score,
      isPassed: insight.isPassed,
      weight: meta.signal!,
      adjustedWeight,
      adjustedWeighted: insight.score * adjustedWeight,
    };
  });

  const totalWeight = signals.reduce((a, s) => a + s.adjustedWeight, 0);
  const weightedScore = totalWeight > 0
    ? signals.reduce((a, s) => a + s.adjustedWeighted, 0) / totalWeight
    : 0;

  const relaxFailures = signals.filter(s => RELAXABLE_SET.has(s.frame) && !s.isPassed);
  const allowedFailures = isAdaptive ? (sajuPriority >= P.adapt2Th ? 2 : 1) : 0;
  const threshold = isAdaptive ? P.strictTh - P.adaptRed * sajuPriority : P.strictTh;

  const isPassed = isAdaptive
    ? sajuInsight.isPassed &&
      insights["FOUR_FRAME_FORTUNE"]!.score >= P.gateScore &&
      weightedScore >= threshold &&
      !relaxFailures.some(s => s.score < P.severeTh) &&
      relaxFailures.length <= allowedFailures
    : STRICT_FRAMES.every(f => insights[f]!.isPassed) && weightedScore >= P.strictTh;

  insights["NAME_STUDY"] = createInsight("NAME_STUDY", weightedScore, isPassed, "ROOT", {
    contributions: Object.fromEntries(signals.map(s => [s.frame, {
      rawScore: s.score, weight: s.weight, adjustedWeight: s.adjustedWeight,
      weighted: s.adjustedWeighted, isPassed: s.isPassed,
    }])),
    failedFrames: signals.filter(s => !s.isPassed).map(s => s.frame),
    adaptivePolicy: {
      mode: isAdaptive ? "adaptive" : "strict",
      sajuPriority,
      allowedFailures,
      threshold,
      relaxableFailures: relaxFailures.map(s => s.frame),
    },
  });
}

// ════════════════════════════════════════════════════════════════════════════
//  §14 NAME EVALUATOR
// ════════════════════════════════════════════════════════════════════════════

class NameEvaluator {
  private readonly luckyMap: Map<number, LuckyLevel>;
  private readonly stats: StatsRepository | null;
  private readonly sajuFallback: Record<Element, number>;
  private readonly sajuCache = new Map<string, SajuDistributionResolution>();

  constructor(
    luckyMap: Map<number, LuckyLevel>,
    stats: StatsRepository | null,
    sajuBase?: Partial<Record<Element, number>>,
  ) {
    this.luckyMap = luckyMap;
    this.stats = stats;
    this.sajuFallback = Object.fromEntries(
      ELEMENTS.map((e, i) => [e, sajuBase?.[e] ?? P.sajuFB[i]!]),
    ) as Record<Element, number>;
  }

  evaluate(name: NameInput, resolved: ResolvedName, birth?: BirthInfo, gender?: Gender): SeedResponse {
    const cacheKey = birth
      ? `${birth.year}-${birth.month}-${birth.day}-${birth.hour}-${birth.minute}|${(gender ?? "NONE").toUpperCase()}`
      : null;

    const sajuRes = cacheKey
      ? cached(this.sajuCache, cacheKey, () => resolveSajuDistribution(birth, gender, this.sajuFallback))
      : resolveSajuDistribution(birth, gender, this.sajuFallback);

    const ctx: EvalContext = {
      name, resolved,
      surnameLen: resolved.surname.length,
      givenLen: resolved.given.length,
      birth, gender,
      luckyMap: this.luckyMap,
      sajuDist: sajuRes.distribution,
      sajuSource: sajuRes.source,
      sajuInput: sajuRes.input,
      sajuOutput: sajuRes.output,
      sajuError: sajuRes.error,
      stats: this.stats?.findByName(name.firstNameHangul) ?? null,
      calc: new NameCalc(resolved.surname, resolved.given),
      insights: {},
    };

    runEvaluation(ctx);

    // Build category map with aliases
    const categoryMap = Object.fromEntries(
      UNIQUE_FRAMES.map(f => [f, ctx.insights[f]!]),
    ) as Record<Frame, FrameInsight>;

    for (const [alias, meta] of ALIAS_FRAMES) {
      categoryMap[alias] = categoryMap[meta.aliasOf];
    }

    const nameStudy = categoryMap["NAME_STUDY"];
    return {
      name,
      statistics: ctx.stats,
      interpretation: {
        score: nameStudy.score,
        isPassed: nameStudy.isPassed,
        status: nameStudy.status,
        categories: ORDERED_FRAMES.map(f => categoryMap[f]),
      },
      categoryMap,
    };
  }
}

export function buildInterpretationText(r: SeedResponse): string {
  const frames: Frame[] = [
    "FOUR_FRAME_FORTUNE", "SAJU_ROOT_BALANCE", "STROKE_POLARITY",
    "PRONUNCIATION_ELEMENT", "PRONUNCIATION_POLARITY", "FOUR_FRAME_ELEMENT",
  ];
  return frames
    .map(f => `${f}:${r.categoryMap[f].score}/${r.categoryMap[f].isPassed ? "Y" : "N"}`)
    .join(" | ");
}

// ════════════════════════════════════════════════════════════════════════════
//  §15 QUERY PARSER
// ════════════════════════════════════════════════════════════════════════════

const BLOCK_REGEX = /\[([^/\]]*)\/([^/\]]*)\]/g;

function parseBlocks(input: string): NameBlock[] {
  const out: NameBlock[] = [];
  let match: RegExpExecArray | null;
  while ((match = BLOCK_REGEX.exec(trim(input)))) {
    out.push({
      korean: trim(match[1] ?? "") || "_",
      hanja:  trim(match[2] ?? "") || "_",
    });
  }
  BLOCK_REGEX.lastIndex = 0;  // reset stateful regex
  return out;
}

function parseNameQuery(repo: HanjaRepository, input: string): NameQuery {
  const blocks = parseBlocks(input);
  if (!blocks.length) return { surnameBlocks: [], nameBlocks: [] };

  const expandDouble = (b: NameBlock): NameBlock[] => {
    if (b.korean !== "_" && b.hanja !== "_" && b.korean.length === 2 && b.hanja.length === 2 && repo.isSurname(b.korean, b.hanja)) {
      return [
        { korean: b.korean[0]!, hanja: b.hanja[0]! },
        { korean: b.korean[1]!, hanja: b.hanja[1]! },
      ];
    }
    return [b];
  };

  if (blocks.length === 1) {
    return { surnameBlocks: expandDouble(blocks[0]!), nameBlocks: [] };
  }

  const expanded = expandDouble(blocks[0]!);
  if (expanded.length === 2) {
    return { surnameBlocks: expanded, nameBlocks: blocks.slice(1) };
  }

  const [first, second] = [blocks[0]!, blocks[1]!];
  if (
    first.hanja !== "_" && second.hanja !== "_" &&
    first.korean.length === 1 && second.korean.length === 1 &&
    first.hanja.length === 1 && second.hanja.length === 1 &&
    repo.isSurname(first.korean + second.korean, first.hanja + second.hanja)
  ) {
    return { surnameBlocks: blocks.slice(0, 2), nameBlocks: blocks.slice(2) };
  }

  return { surnameBlocks: [blocks[0]!], nameBlocks: blocks.slice(1) };
}

function parseCompleteName(input: string): NameInput | null {
  const blocks = parseBlocks(input);
  if ((input.match(/\[/g) ?? []).length !== (input.match(/\]/g) ?? []).length) return null;
  if (input.includes("_") || blocks.length < 2) return null;

  const [last, ...given] = blocks;
  return {
    lastNameHangul:  trim(last!.korean),
    lastNameHanja:   trim(last!.hanja),
    firstNameHangul: trim(given.map(b => b.korean).join("")),
    firstNameHanja:  trim(given.map(b => b.hanja).join("")),
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  §16 SEARCH ENGINE
// ════════════════════════════════════════════════════════════════════════════

function strokeKey(vals: readonly number[]): string {
  return vals.join(",");
}

/** Pre-computes valid stroke combinations against Four-Frame fortune constraints. */
class FFOptimizer {
  private readonly validFF: Set<number>;
  private readonly cache = new Map<string, Set<string>>();

  constructor(validFF: Set<number>) {
    this.validFF = validFF;
  }

  getValid(surnameStrokes: number[], nameLen: number): Set<string> {
    return cached(this.cache, `${strokeKey(surnameStrokes)}|${nameLen}`, () => {
      const validKeys = new Set<string>();
      const current = new Array(nameLen).fill(1);

      const emit = () => {
        const ff = computeFourFrame(surnameStrokes, current);
        if (
          this.validFF.has(ff.origin) && this.validFF.has(ff.form) &&
          (nameLen <= 1 || this.validFF.has(ff.profit)) && this.validFF.has(ff.harmony)
        ) {
          validKeys.add(strokeKey(current));
        }
      };

      const dfs = (depth: number) => {
        if (depth >= nameLen) { emit(); return; }
        for (let v = 1; v <= MAX_STROKE_CHAR; v++) {
          current[depth] = v;
          dfs(depth + 1);
        }
      };

      dfs(0);
      return validKeys;
    });
  }
}

/** Generic min-heap for top-K selection. */
class MinHeap<T> {
  private readonly data: T[] = [];

  constructor(private readonly compare: (a: T, b: T) => number) {}

  size(): number { return this.data.length; }
  peek(): T | undefined { return this.data[0]; }
  toArray(): T[] { return [...this.data]; }

  push(value: T): void {
    this.data.push(value);
    this.bubbleUp(this.data.length - 1);
  }

  replaceTop(value: T): void {
    if (!this.data.length) { this.data.push(value); return; }
    this.data[0] = value;
    this.sinkDown(0);
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.compare(this.data[i]!, this.data[parent]!) >= 0) break;
      [this.data[i], this.data[parent]] = [this.data[parent]!, this.data[i]!];
      i = parent;
    }
  }

  private sinkDown(i: number): void {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const left  = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.compare(this.data[left]!, this.data[smallest]!) < 0)  smallest = left;
      if (right < n && this.compare(this.data[right]!, this.data[smallest]!) < 0) smallest = right;
      if (smallest === i) break;
      [this.data[i], this.data[smallest]] = [this.data[smallest]!, this.data[i]!];
      i = smallest;
    }
  }
}

function findSurnames(repo: HanjaRepository, query: NameQuery): NameBlock[] {
  const blocks = query.surnameBlocks;
  if (!blocks.length) return [];

  if (blocks.length === 1) {
    const b = blocks[0]!;
    return (b.korean !== "_" && b.hanja !== "_" && repo.isSurname(b.korean, b.hanja))
      ? [{ korean: b.korean, hanja: b.hanja }]
      : [];
  }

  const [a, b] = [blocks[0]!, blocks[1]!];
  const combinedK = a.korean + b.korean;
  const combinedH = a.hanja + b.hanja;
  return (a.korean.length === 1 && b.korean.length === 1 && repo.isSurname(combinedK, combinedH))
    ? [{ korean: combinedK, hanja: combinedH }]
    : [];
}

function resolveEntries(repo: HanjaRepository, name: NameInput): ResolvedName {
  const pairs = repo.getSurnamePairs(name.lastNameHangul, name.lastNameHanja);
  return {
    surname: pairs.map(p => repo.getHanjaInfo(p.korean, p.hanja, true)),
    given: Array.from(name.firstNameHangul).map((k, i) =>
      repo.getHanjaInfo(k, Array.from(name.firstNameHanja)[i] ?? "", false),
    ),
  };
}

class NameSearchService {
  private readonly repo: HanjaRepository;
  private readonly stats: StatsRepository;
  private readonly evaluator: NameEvaluator;
  private readonly ffOptimizer: FFOptimizer;
  private readonly strokeCache = new Map<string, number>();

  constructor(repo: HanjaRepository, stats: StatsRepository, evaluator: NameEvaluator, validFF: Set<number>) {
    this.repo = repo;
    this.stats = stats;
    this.evaluator = evaluator;
    this.ffOptimizer = new FFOptimizer(validFF);
  }

  private getStroke(korean: string, hanja: string, isSurname: boolean): number {
    return cached(
      this.strokeCache,
      `${isSurname ? "s" : "g"}|${korean}|${hanja}`,
      () => this.repo.getHanjaStrokeCount(korean, hanja, isSurname),
    );
  }

  evaluateName(input: NameInput, birth?: BirthInfo, gender?: Gender): SeedResponse {
    return this.evaluator.evaluate(input, resolveEntries(this.repo, input), birth, gender);
  }

  search(request: SearchRequest): SearchResult {
    const query = parseNameQuery(this.repo, request.query);
    const surnames = findSurnames(this.repo, query);
    if (!surnames.length) {
      return { query: request.query, totalCount: 0, responses: [], truncated: false };
    }

    // Surname-only query
    if (!query.nameBlocks.length) {
      const responses = surnames.map(s => this.evaluateName(
        { lastNameHangul: s.korean, lastNameHanja: s.hanja, firstNameHangul: "", firstNameHanja: "" },
        request.birth, request.gender,
      ));
      return { query: request.query, totalCount: responses.length, responses, truncated: false };
    }

    const limit     = typeof request.limit === "number" && request.limit > 0 ? Math.trunc(request.limit) : undefined;
    const offset    = Math.max(0, request.offset ?? 0);
    const isLimited = limit !== undefined;
    const capacity  = isLimited ? Math.max(limit + offset, limit) : 0;
    const fbCapacity = isLimited ? capacity : Math.max(500, offset + 200);
    const scoreCmp  = (a: SeedResponse, b: SeedResponse) => a.interpretation.score - b.interpretation.score;
    const descSort  = (a: SeedResponse, b: SeedResponse) => b.interpretation.score - a.interpretation.score;

    const topHeap     = new MinHeap<SeedResponse>(scoreCmp);
    const fallbackHeap = new MinHeap<SeedResponse>(scoreCmp);
    const passedAll: SeedResponse[] = [];
    let totalPassed = 0;
    let totalEvaluated = 0;

    for (const surname of surnames) {
      const pairs = this.repo.getSurnamePairs(surname.korean, surname.hanja);
      const surnameStrokes = pairs.map(p => this.getStroke(p.korean, p.hanja, true));
      const validKeys = this.ffOptimizer.getValid(surnameStrokes, query.nameBlocks.length);
      const combos = this.stats.findNameCombinations(query.nameBlocks, validKeys);

      for (const combo of combos) {
        const kChars = Array.from(combo.korean);
        const hChars = Array.from(combo.hanja);
        const givenStrokes = kChars.map((k, i) => this.getStroke(k, hChars[i] ?? "", false));
        if (!validKeys.has(strokeKey(givenStrokes))) continue;

        const nameInput: NameInput = {
          lastNameHangul: surname.korean,
          lastNameHanja: surname.hanja,
          firstNameHangul: combo.korean,
          firstNameHanja: combo.hanja,
        };
        const response = this.evaluateName(nameInput, request.birth, request.gender);
        totalEvaluated++;

        // Maintain fallback heap
        if (fallbackHeap.size() < fbCapacity) {
          fallbackHeap.push(response);
        } else if (fallbackHeap.peek() && response.interpretation.score > fallbackHeap.peek()!.interpretation.score) {
          fallbackHeap.replaceTop(response);
        }

        // Collect passed results
        if (response.interpretation.isPassed && response.categoryMap["SAJU_ROOT_BALANCE"].isPassed) {
          const passed: SeedResponse = {
            ...response,
            interpretation: { ...response.interpretation, isPassed: true, status: "POSITIVE" },
          };
          totalPassed++;

          if (isLimited) {
            if (topHeap.size() < capacity) {
              topHeap.push(passed);
            } else if (topHeap.peek() && passed.interpretation.score > topHeap.peek()!.interpretation.score) {
              topHeap.replaceTop(passed);
            }
          } else {
            passedAll.push(passed);
          }
        }
      }
    }

    // Return results
    if (isLimited) {
      const selected = topHeap.toArray().sort(descSort);
      const hasPassed = selected.length > 0;
      const ranked = hasPassed ? selected : fallbackHeap.toArray().sort(descSort);
      return {
        query: request.query,
        totalCount: hasPassed ? ranked.length : totalEvaluated,
        responses: ranked.slice(offset, offset + limit!),
        truncated: hasPassed ? totalPassed > ranked.length : totalEvaluated > ranked.length,
      };
    }

    passedAll.sort(descSort);
    if (!passedAll.length) {
      const fallback = fallbackHeap.toArray().sort(descSort);
      return { query: request.query, totalCount: fallback.length, responses: fallback.slice(offset), truncated: true };
    }
    return { query: request.query, totalCount: passedAll.length, responses: passedAll.slice(offset), truncated: false };
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  §17 RUNTIME BOOTSTRAP
// ════════════════════════════════════════════════════════════════════════════

interface RuntimeContext {
  searchService: NameSearchService;
  hanjaRepository: HanjaRepository;
}

function buildRuntime(options: SeedClientOptions, db: SqliteDatabase): RuntimeContext {
  const hanja   = SqliteHanjaRepository.fromDatabase(db);
  const stats   = SqliteStatsRepository.fromDatabase(db);
  const luckyMap = loadFourFrameMap(db);

  const validFF = new Set<number>();
  for (const [n, level] of luckyMap) {
    if (POSITIVE_FORTUNES.has(level)) validFF.add(n);
  }

  return {
    searchService: new NameSearchService(hanja, stats, new NameEvaluator(luckyMap, stats, options.sajuBaseDistribution), validFF),
    hanjaRepository: hanja,
  };
}

const DB_SEARCH_SUBDIRS = [
  "sqlite/seed.db",
  "../main/resources/seed/data/sqlite/seed.db",
  "../../src/main/resources/seed/data/sqlite/seed.db",
];

const DB_SEARCH_CWD_PATHS = [
  "lib/seed-ts/src/main/resources/seed/data/sqlite/seed.db",
  "src/main/resources/seed/data/sqlite/seed.db",
  "lib/seed-ts/data/sqlite/seed.db",
];

function createRuntime(options: SeedClientOptions): RuntimeContext {
  // Browser/WASM runtime
  if (options.runtime?.strategy === "browser-wasm") {
    const rt = options.runtime as BrowserWasmRuntimeOption;
    const db = rt.database ?? (rt.sqlJsDatabase ? createSqlJsAdapter(rt.sqlJsDatabase) : null);
    if (!db) throw new Error("`runtime.database` or `runtime.sqlJsDatabase` is required for browser-wasm.");
    return buildRuntime(options, db);
  }

  // Node.js runtime — resolve DB path
  const dataRoot = options.dataRoot ?? path.resolve(process.cwd(), "lib/seed-ts/src/main/resources/seed/data");
  const configPath = options.sqlite?.path?.trim();
  let dbPath = configPath && configPath.length > 0 ? configPath : "";

  if (!dbPath) {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const cwd = process.cwd();

    const candidates = [
      path.join(dataRoot.trim(), "sqlite", "seed.db"),
      ...DB_SEARCH_SUBDIRS.map(sub => path.resolve(currentDir, sub)),
      ...DB_SEARCH_CWD_PATHS.map(sub => path.resolve(cwd, sub)),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) { dbPath = candidate; break; }
    }
    if (!dbPath) dbPath = path.join(dataRoot.trim(), "sqlite", "seed.db");
  }

  if (!fs.existsSync(dbPath)) throw new Error(`SQLite database not found: ${dbPath}`);
  return buildRuntime(options, openSqliteDatabase(dbPath));
}

// ════════════════════════════════════════════════════════════════════════════
//  §18 PUBLIC API
// ════════════════════════════════════════════════════════════════════════════

function normalizeSearchRequest(req: SearchRequest): SearchRequest {
  const birth = req.birth ?? (
    typeof req.year === "number" && typeof req.month === "number" &&
    typeof req.day === "number" && typeof req.hour === "number" && typeof req.minute === "number"
      ? { year: req.year, month: req.month, day: req.day, hour: req.hour, minute: req.minute }
      : undefined
  );
  return { ...req, query: trim(req.query), birth };
}

function toEvaluateInput(
  source: EvaluateRequest | NameInput | string,
  birth?: BirthInfo,
  gender?: Gender,
): { name: NameInput; birth?: BirthInfo; gender?: Gender } {
  // String shorthand: "[김/金][민/敏][수/秀]"
  if (typeof source === "string") {
    const parsed = parseCompleteName(source);
    if (!parsed) throw new Error("invalid evaluate query");
    return { name: parsed, birth, gender };
  }

  // Direct NameInput
  const obj = source as Record<string, unknown>;
  if (
    typeof obj.lastNameHangul === "string" && typeof obj.lastNameHanja === "string" &&
    typeof obj.firstNameHangul === "string" && typeof obj.firstNameHanja === "string"
  ) {
    return { name: source as NameInput, birth, gender };
  }

  // EvaluateRequest
  const req = source as EvaluateRequest;
  if (req.name) {
    return { name: req.name, birth: req.birth ?? birth, gender: req.gender ?? gender };
  }
  if (req.query) {
    const parsed = parseCompleteName(req.query);
    if (!parsed) throw new Error("query is not complete evaluate input");
    return { name: parsed, birth: req.birth ?? birth, gender: req.gender ?? gender };
  }
  throw new Error("evaluate input requires name or query");
}

export class Seed {
  private readonly rt: RuntimeContext;

  constructor(options: SeedClientOptions = {}) {
    this.rt = createRuntime(options);
  }

  evaluate(source: EvaluateRequest | NameInput | string, birth?: BirthInfo, gender?: Gender): SeedResponse {
    const { name, birth: b, gender: g } = toEvaluateInput(source, birth, gender);
    return this.rt.searchService.evaluateName(name, b, g);
  }

  search(request: SearchRequest): SearchResult {
    return this.rt.searchService.search(normalizeSearchRequest(request));
  }

  findHanjaByHangul(hangul: string, surname = false): readonly HanjaEntry[] {
    const repo = this.rt.hanjaRepository;
    return surname && typeof repo.findSurnameByHangul === "function"
      ? repo.findSurnameByHangul(hangul)
      : repo.findNameByHangul(hangul);
  }
}

// ── SeedTs high-level wrapper ──

export class SeedTs {
  private readonly seed: Seed;

  constructor(options: SeedClientOptions = {}) {
    this.seed = new Seed(options);
  }

  analyze(userInfo: SeedTsUserInfo): SeedTsResult {
    const wildcard = (s: string) => "_".repeat(Array.from(s).length);

    let query = `[${userInfo.lastName}/${wildcard(userInfo.lastName)}]`;
    for (const c of Array.from(userInfo.firstName)) {
      query += `[${c}/_]`;
    }

    const b = userInfo.birthDateTime;
    const birth = b &&
      typeof b.year === "number" && typeof b.month === "number" &&
      typeof b.day === "number" && typeof b.hour === "number" && typeof b.minute === "number"
        ? { year: b.year, month: b.month, day: b.day, hour: b.hour, minute: b.minute }
        : undefined;

    const gender = (userInfo.gender as Gender) ?? "NONE";
    const result = this.seed.search({ query, limit: 1, offset: 0, includeSaju: true, gender, birth });

    const toCandidate = (r: SeedResponse): SeedTsCandidate => ({
      lastName: r.name.lastNameHangul,
      firstName: r.name.firstNameHangul,
      totalScore: r.interpretation.score,
      interpretation: buildInterpretationText(r),
      raw: r,
    });

    const top = result.responses[0];
    if (top) return { candidates: [toCandidate(top)], totalCount: result.totalCount, gender: userInfo.gender };

    const fallback = this.seed.evaluate({
      name: {
        lastNameHangul: userInfo.lastName,
        lastNameHanja: wildcard(userInfo.lastName),
        firstNameHangul: userInfo.firstName,
        firstNameHanja: wildcard(userInfo.firstName),
      },
      includeSaju: true,
    });
    return { candidates: [toCandidate(fallback)], totalCount: 1, gender: userInfo.gender };
  }
}

// ── Legacy aliases ──

export const SeedClient = Seed;
export const createSeedClient = (options: SeedClientOptions = {}) => new Seed(options);
