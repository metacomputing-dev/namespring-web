import type { NameSearchService } from "../../core/search.js";

export interface RuntimeContext {
  includeSaju: boolean;
  searchService: NameSearchService;
}
