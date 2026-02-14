import initSqlJs from "sql.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import {
  Runtime,
  createSeedClient,
  type AnalyzeSelectionRequest,
  type HanjaEntry,
  type SearchResult,
  type SeedClient,
  type SeedResponse,
} from "@seed/index";
import { buildSearchQuery } from "../utils/naming-query";
import type {
  AnalysisCandidate,
  AnalysisResult,
  AnalyzeRequest,
  CandidateSearchRequest,
  CandidateSearchResult,
  HanjaOption,
} from "../types";

const STATUS_LABEL: Record<string, string> = {
  POSITIVE: "Strong",
  NEUTRAL: "Balanced",
  NEGATIVE: "Needs care",
};

function resolveSeedDatabaseUrl(): string {
  if (import.meta.env.DEV && typeof __SEED_DB_DEV_URL__ === "string" && __SEED_DB_DEV_URL__.length > 0) {
    return __SEED_DB_DEV_URL__;
  }

  const configuredUrl = (import.meta.env.VITE_SEED_DB_URL as string | undefined)?.trim();
  if (configuredUrl) {
    return configuredUrl;
  }
  return "/seed.db";
}

function toHanjaOption(entry: HanjaEntry): HanjaOption {
  return {
    hangul: entry.hangul,
    hanja: entry.hanja,
    meaning: entry.meaning || "No meaning data",
    strokes: entry.strokeCount,
    strokeCount: entry.strokeCount,
    resourceElement: entry.rootElement,
    isSurname: entry.isSurname,
  };
}

function summarizeResponse(response: SeedResponse): string {
  const categories = response.interpretation.categories;
  if (categories.length === 0) {
    return `Score ${response.interpretation.score}`;
  }

  const best = [...categories].sort((left, right) => right.score - left.score)[0];
  if (!best) {
    return `Score ${response.interpretation.score}`;
  }

  const label = STATUS_LABEL[best.status] ?? "Reviewed";
  return `${best.arrangement} - ${label}`;
}

function toCandidate(response: SeedResponse): AnalysisCandidate {
  return {
    lastNameHangul: response.name.lastNameHangul,
    firstNameHangul: response.name.firstNameHangul,
    lastNameHanja: response.name.lastNameHanja,
    firstNameHanja: response.name.firstNameHanja,
    totalScore: response.interpretation.score,
    interpretation: summarizeResponse(response),
    categories: response.interpretation.categories.map((category) => ({
      frame: category.frame,
      score: category.score,
      status: category.status,
      arrangement: category.arrangement,
    })),
    provider: "SeedClient",
  };
}

function toAnalysisResult(response: SeedResponse): AnalysisResult {
  return {
    candidates: [toCandidate(response)],
    totalCount: 1,
    provider: "SeedClient",
  };
}

function toCandidateSearchResult(
  response: SearchResult,
  offset: number,
  limit: number,
): CandidateSearchResult {
  return {
    candidates: response.responses.map((item) => toCandidate(item)),
    totalCount: response.totalCount,
    provider: "SeedClient",
    query: response.query,
    truncated: response.truncated,
    offset,
    limit,
  };
}

export class SeedClientService {
  private clientPromise: Promise<SeedClient> | null = null;
  private readonly hanjaLookupCache = new Map<string, HanjaOption[]>();

  public async initialize(): Promise<void> {
    await this.getClient();
  }

  public async findHanjaByHangul(hangul: string, surname = false): Promise<HanjaOption[]> {
    const normalized = (hangul ?? "").trim();
    if (!normalized) {
      return [];
    }
    const cacheKey = `${surname ? "s" : "g"}:${normalized}`;
    const cached = this.hanjaLookupCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const client = await this.getClient();
    const options = client.findHanjaByHangul(normalized, { surname }).map((entry) => toHanjaOption(entry));
    this.hanjaLookupCache.set(cacheKey, options);
    return options;
  }

  public async analyze(request: AnalyzeRequest): Promise<AnalysisResult> {
    const client = await this.getClient();
    const payload: AnalyzeSelectionRequest = {
      name: {
        lastNameHangul: request.lastNameHangul,
        lastNameHanja: request.lastNameHanja,
        firstNameHangul: request.firstNameHangul,
        firstNameHanja: request.firstNameHanja,
      },
      birth: request.birthDateTime,
      gender: request.gender,
      includeSaju: request.includeSaju,
    };
    const result = client.analyzeSelection(payload);
    return toAnalysisResult(result.response);
  }

  public async searchCandidates(request: CandidateSearchRequest): Promise<CandidateSearchResult> {
    const client = await this.getClient();
    const query = buildSearchQuery({
      surnameHangul: request.surnameHangul,
      surnameHanja: request.surnameHanja,
      constraints: request.constraints,
    });

    const result = client.searchCandidates({
      query,
      birth: request.birthDateTime,
      gender: request.gender,
      includeSaju: request.includeSaju,
      limit: request.limit,
      offset: request.offset,
    });

    return toCandidateSearchResult(result, request.offset, request.limit);
  }

  private async getClient(): Promise<SeedClient> {
    if (!this.clientPromise) {
      this.clientPromise = this.createClient();
    }
    return this.clientPromise;
  }

  private async createClient(): Promise<SeedClient> {
    const sqlModule = await initSqlJs({
      locateFile: () => sqlWasmUrl,
    });
    const dbUrl = resolveSeedDatabaseUrl();
    const response = await fetch(dbUrl);
    if (!response.ok) {
      throw new Error(`Failed to load seed sqlite database from ${dbUrl}: ${response.status}`);
    }

    const binary = new Uint8Array(await response.arrayBuffer());
    const database = Runtime.openSqlJsDatabase(sqlModule, binary);
    return createSeedClient({
      includeSaju: false,
      runtime: {
        strategy: "browser-wasm",
        database,
      },
    });
  }
}
