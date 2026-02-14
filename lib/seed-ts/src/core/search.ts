import type { SearchRequest } from "./types.js";
import { normalizeText } from "./utils.js";

export { NameSearchService } from "./search/name-search-service.js";

export function toSearchBirth(request: SearchRequest): SearchRequest["birth"] {
  if (request.birth) {
    return request.birth;
  }
  if (
    typeof request.year === "number" &&
    typeof request.month === "number" &&
    typeof request.day === "number" &&
    typeof request.hour === "number" &&
    typeof request.minute === "number"
  ) {
    return {
      year: request.year,
      month: request.month,
      day: request.day,
      hour: request.hour,
      minute: request.minute,
    };
  }
  return undefined;
}

export function normalizeSearchRequest(request: SearchRequest): SearchRequest {
  return {
    ...request,
    query: normalizeText(request.query),
    birth: toSearchBirth(request),
  };
}
