import { normalizeSearchRequest } from "../../core/search.js";
import type {
  BirthInfo,
  EvaluateRequest,
  Gender,
  NameInput,
  SearchRequest,
  SearchResult,
  SeedOptions,
  SeedResponse,
} from "../../core/types.js";
import { SQLITE_RUNTIME_CONTEXT_FACTORY } from "../infrastructure/sqlite/sqlite-runtime-context.js";
import type { RuntimeContextFactory } from "../ports/runtime-factory.js";
import type { RuntimeContext } from "../ports/runtime-ports.js";
import { toEvaluateInput } from "./evaluate-input.js";

export class SeedEngine {
  private static shared: RuntimeContext | null = null;
  private readonly runtime: RuntimeContext;

  constructor(
    options: SeedOptions = {},
    runtimeFactory: RuntimeContextFactory = SQLITE_RUNTIME_CONTEXT_FACTORY,
  ) {
    const hasCustom =
      options.dataRoot !== undefined ||
      options.includeSaju !== undefined ||
      options.sqlite !== undefined ||
      options.sajuBaseDistribution !== undefined;

    if (!hasCustom && runtimeFactory === SQLITE_RUNTIME_CONTEXT_FACTORY) {
      if (!SeedEngine.shared) {
        SeedEngine.shared = runtimeFactory.create({});
      }
      this.runtime = SeedEngine.shared;
      return;
    }
    this.runtime = runtimeFactory.create(options);
  }

  evaluate(source: EvaluateRequest | NameInput | string, _birth?: BirthInfo, _gender?: Gender): SeedResponse {
    const input = toEvaluateInput(source, this.runtime.includeSaju);
    return this.runtime.searchService.evaluateName(input.name, input.birth, input.includeSaju);
  }

  search(request: SearchRequest): SearchResult {
    return this.runtime.searchService.search(normalizeSearchRequest(request));
  }
}
