import type {
  BirthInfo,
  Gender,
  NameInput,
  SearchRequest,
  SearchResult,
  SeedResponse,
} from "../../core/types.js";

export type { Element, Energy, FourFrame, Frame, HanjaChar, HangulChar, Polarity } from "../../core/types.js";

export interface EvaluateNameCommand {
  name: NameInput;
  birth?: BirthInfo;
  includeSaju: boolean;
}

export interface SearchNamesQuery {
  request: SearchRequest;
}

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

export interface EvaluateNameResult {
  response: SeedResponse;
}

export interface SearchNamesResult {
  result: SearchResult;
}
