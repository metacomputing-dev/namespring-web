import type {
  BirthInfo,
  EvaluateRequest,
  Gender,
  NameInput,
  SearchRequest,
  SearchResult,
  SeedOptions,
  SeedResponse,
} from "./core/types.js";
import type { SeedTsResult, SeedTsUserInfo } from "./engine/domain/naming.js";
import { SeedEngine, SeedTsAnalyzer } from "./engine/application/index.js";

export class Seed {
  private readonly engine: SeedEngine;

  constructor(options: SeedOptions = {}) {
    this.engine = new SeedEngine(options);
  }

  evaluate(source: EvaluateRequest | NameInput | string, birth?: BirthInfo, gender?: Gender): SeedResponse {
    return this.engine.evaluate(source, birth, gender);
  }

  search(request: SearchRequest): SearchResult {
    return this.engine.search(request);
  }
}

export class SeedTs {
  private readonly analyzer: SeedTsAnalyzer;

  constructor(options: SeedOptions = {}) {
    this.analyzer = new SeedTsAnalyzer(options);
  }

  analyze(userInfo: SeedTsUserInfo): SeedTsResult {
    return this.analyzer.analyze(userInfo);
  }
}
