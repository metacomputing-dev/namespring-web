import type { NameSearchService } from "../../core/search.js";
import type { HanjaRepository } from "../../core/types.js";

export interface RuntimeContext {
  includeSaju: boolean;
  searchService: NameSearchService;
  hanjaRepository: HanjaRepository;
}
