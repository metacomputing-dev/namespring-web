import type {
  AnalyzeSelectionRequest,
  AnalyzeSelectionResult,
  BirthInfo,
  EvaluateRequest,
  Gender,
  HanjaEntry,
  HanjaLookupOptions,
  NameInput,
  SearchCandidatesRequest,
  SearchRequest,
  SearchResult,
  SeedResponse,
} from "./core/types.js";
import type { SeedTsResult, SeedTsUserInfo } from "./engine/domain/naming.js";
import { SeedEngine, SeedTsAnalyzer } from "./engine/application/index.js";
import type { RuntimeContextFactory } from "./engine/ports/runtime-factory.js";
import type { SeedClientOptions } from "./runtime/options.js";
import { DEFAULT_RUNTIME_CONTEXT_FACTORY } from "./runtime/runtime-context.js";

function toAnalyzeSelectionSource(request: AnalyzeSelectionRequest): EvaluateRequest {
  return {
    name: request.name,
    birth: request.birth,
    gender: request.gender,
    includeSaju: true,
  };
}

export class SeedClient {
  private readonly engine: SeedEngine;

  constructor(
    options: SeedClientOptions = {},
    runtimeFactory: RuntimeContextFactory = DEFAULT_RUNTIME_CONTEXT_FACTORY,
  ) {
    this.engine = new SeedEngine(options, runtimeFactory);
  }

  evaluate(source: EvaluateRequest | NameInput | string, birth?: BirthInfo, gender?: Gender): SeedResponse {
    return this.engine.evaluate(source, birth, gender);
  }

  search(request: SearchRequest): SearchResult {
    return this.engine.search(request);
  }

  analyzeSelection(request: AnalyzeSelectionRequest): AnalyzeSelectionResult {
    return {
      response: this.engine.evaluate(toAnalyzeSelectionSource(request)),
    };
  }

  analyze(request: AnalyzeSelectionRequest): AnalyzeSelectionResult {
    return this.analyzeSelection(request);
  }

  evaluateName(request: AnalyzeSelectionRequest): SeedResponse {
    return this.analyzeSelection(request).response;
  }

  searchCandidates(request: SearchCandidatesRequest): SearchResult {
    return this.engine.search(request);
  }

  findHanjaByHangul(hangul: string, options: HanjaLookupOptions = {}): readonly HanjaEntry[] {
    return this.engine.findHanjaByHangul(hangul, options.surname ?? false);
  }
}

export function createSeedClient(options: SeedClientOptions = {}): SeedClient {
  return new SeedClient(options);
}

export class Seed {
  private readonly client: SeedClient;

  constructor(options: SeedClientOptions = {}) {
    this.client = createSeedClient(options);
  }

  evaluate(source: EvaluateRequest | NameInput | string, birth?: BirthInfo, gender?: Gender): SeedResponse {
    return this.client.evaluate(source, birth, gender);
  }

  search(request: SearchRequest): SearchResult {
    return this.client.search(request);
  }
}

export class SeedTs {
  private readonly analyzer: SeedTsAnalyzer;

  constructor(options: SeedClientOptions = {}) {
    this.analyzer = new SeedTsAnalyzer(options);
  }

  analyze(userInfo: SeedTsUserInfo): SeedTsResult {
    return this.analyzer.analyze(userInfo);
  }
}
