import { normalizeSearchRequest } from "../../core/search.js";
import type {
  BirthInfo,
  EvaluateRequest,
  Gender,
  HanjaEntry,
  NameInput,
  SearchRequest,
  SearchResult,
  SeedResponse,
} from "../../core/types.js";
import type { RuntimeContextFactory } from "../ports/runtime-factory.js";
import type { RuntimeContext } from "../ports/runtime-ports.js";
import { DEFAULT_RUNTIME_CONTEXT_FACTORY } from "../../runtime/runtime-context.js";
import type { SeedClientOptions } from "../../runtime/options.js";
import { toEvaluateInput } from "./evaluate-input.js";

export class SeedEngine {
  private readonly runtime: RuntimeContext;

  constructor(
    options: SeedClientOptions = {},
    runtimeFactory: RuntimeContextFactory = DEFAULT_RUNTIME_CONTEXT_FACTORY,
  ) {
    this.runtime = runtimeFactory.create(options);
  }

  evaluate(source: EvaluateRequest | NameInput | string, _birth?: BirthInfo, _gender?: Gender): SeedResponse {
    const input = toEvaluateInput(source, this.runtime.includeSaju);
    return this.runtime.searchService.evaluateName(input.name, input.birth, input.includeSaju);
  }

  search(request: SearchRequest): SearchResult {
    return this.runtime.searchService.search(normalizeSearchRequest(request));
  }

  findHanjaByHangul(hangul: string, surname = false): readonly HanjaEntry[] {
    if (surname && typeof this.runtime.hanjaRepository.findSurnameByHangul === "function") {
      return this.runtime.hanjaRepository.findSurnameByHangul(hangul);
    }
    return this.runtime.hanjaRepository.findNameByHangul(hangul);
  }
}
