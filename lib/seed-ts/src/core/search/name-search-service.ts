import { parseNameQuery } from "../query.js";
import type {
  Gender,
  HanjaRepository,
  NameInput,
  SearchRequest,
  SearchResult,
  SeedResponse,
  StatsRepository,
} from "../types.js";
import { NameEvaluator } from "../evaluator.js";
import { FourFrameOptimizer, toStrokeKey } from "./four-frame-optimizer.js";
import { MinHeap } from "./heap.js";
import { findSurnameCandidates, makeNameInput, toResolvedName } from "./surname-resolver.js";

function isStrictPass(response: SeedResponse): boolean {
  return response.interpretation.isPassed && response.categoryMap.SAJU_JAWON_BALANCE.isPassed;
}

function pushTopK(heap: MinHeap<SeedResponse>, item: SeedResponse, capacity: number): void {
  if (capacity <= 0) {
    return;
  }
  if (heap.size() < capacity) {
    heap.push(item);
    return;
  }
  const min = heap.peek();
  if (min && item.interpretation.score > min.interpretation.score) {
    heap.replaceTop(item);
  }
}

function toPassedResponse(response: SeedResponse): SeedResponse {
  return {
    ...response,
    interpretation: {
      ...response.interpretation,
      isPassed: true,
      status: "POSITIVE",
    },
  };
}

// ── Collector Pattern ──

interface SearchResultCollector {
  collect(response: SeedResponse): void;
  toSearchResult(query: string): SearchResult;
}

class LimitedCollector implements SearchResultCollector {
  private readonly topK: MinHeap<SeedResponse>;
  private readonly fallbackTopK: MinHeap<SeedResponse>;
  private readonly selectionCapacity: number;
  private readonly limit: number;
  private readonly offset: number;
  private totalPassed = 0;
  private totalEvaluated = 0;

  constructor(limit: number, offset: number) {
    this.limit = limit;
    this.offset = offset;
    this.selectionCapacity = Math.max(limit + offset, limit);
    const comparator = (a: SeedResponse, b: SeedResponse) => a.interpretation.score - b.interpretation.score;
    this.topK = new MinHeap<SeedResponse>(comparator);
    this.fallbackTopK = new MinHeap<SeedResponse>(comparator);
  }

  collect(response: SeedResponse): void {
    this.totalEvaluated += 1;
    pushTopK(this.fallbackTopK, response, this.selectionCapacity);
    if (!isStrictPass(response)) {
      return;
    }
    this.totalPassed += 1;
    pushTopK(this.topK, toPassedResponse(response), this.selectionCapacity);
  }

  toSearchResult(query: string): SearchResult {
    const selectedPassed = this.topK
      .toArray()
      .sort((a, b) => b.interpretation.score - a.interpretation.score);
    const hasPassed = selectedPassed.length > 0;
    const selectedRanked = hasPassed
      ? selectedPassed
      : this.fallbackTopK.toArray().sort((a, b) => b.interpretation.score - a.interpretation.score);
    const sliced = selectedRanked.slice(this.offset, this.offset + this.limit);
    return {
      query,
      totalCount: hasPassed ? selectedRanked.length : this.totalEvaluated,
      responses: sliced,
      truncated: hasPassed ? this.totalPassed > selectedRanked.length : this.totalEvaluated > selectedRanked.length,
    };
  }
}

const FALLBACK_BASE_CAPACITY = 500;
const FALLBACK_OFFSET_BUFFER = 200;

class UnlimitedCollector implements SearchResultCollector {
  private readonly passedResponses: SeedResponse[] = [];
  private readonly fallbackTopK: MinHeap<SeedResponse>;
  private readonly fallbackCapacity: number;
  private readonly offset: number;

  constructor(offset: number) {
    this.offset = offset;
    this.fallbackCapacity = Math.max(FALLBACK_BASE_CAPACITY, offset + FALLBACK_OFFSET_BUFFER);
    this.fallbackTopK = new MinHeap<SeedResponse>(
      (a, b) => a.interpretation.score - b.interpretation.score,
    );
  }

  collect(response: SeedResponse): void {
    pushTopK(this.fallbackTopK, response, this.fallbackCapacity);
    if (isStrictPass(response)) {
      this.passedResponses.push(toPassedResponse(response));
    }
  }

  toSearchResult(query: string): SearchResult {
    this.passedResponses.sort((a, b) => b.interpretation.score - a.interpretation.score);
    if (this.passedResponses.length === 0) {
      const fallbackSelected = this.fallbackTopK
        .toArray()
        .sort((a, b) => b.interpretation.score - a.interpretation.score);
      return {
        query,
        totalCount: fallbackSelected.length,
        responses: fallbackSelected.slice(this.offset),
        truncated: true,
      };
    }
    return {
      query,
      totalCount: this.passedResponses.length,
      responses: this.passedResponses.slice(this.offset),
      truncated: false,
    };
  }
}

export class NameSearchService {
  private readonly repository: HanjaRepository;
  private readonly stats: StatsRepository;
  private readonly evaluator: NameEvaluator;
  private readonly optimizer: FourFrameOptimizer;
  private readonly strokeCountCache = new Map<string, number>();

  constructor(
    repository: HanjaRepository,
    stats: StatsRepository,
    evaluator: NameEvaluator,
    validFourFrameNumbers: Set<number>,
  ) {
    this.repository = repository;
    this.stats = stats;
    this.evaluator = evaluator;
    this.optimizer = new FourFrameOptimizer(validFourFrameNumbers);
  }

  private getStrokeCount(korean: string, hanja: string, isSurname: boolean): number {
    const key = `${isSurname ? "s" : "g"}|${korean}|${hanja}`;
    const cached = this.strokeCountCache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const strokeCount = this.repository.getHanjaStrokeCount(korean, hanja, isSurname);
    this.strokeCountCache.set(key, strokeCount);
    return strokeCount;
  }

  evaluateName(
    input: NameInput,
    birth?: SearchRequest["birth"],
    _includeSaju?: boolean,
    gender?: Gender,
  ): SeedResponse {
    const resolved = toResolvedName(this.repository, input);
    return this.evaluator.evaluate(input, resolved, birth, true, gender);
  }

  search(request: SearchRequest): SearchResult {
    const query = parseNameQuery(this.repository, request.query);
    const surnameCandidates = findSurnameCandidates(this.repository, query);
    if (surnameCandidates.length === 0) {
      return { query: request.query, totalCount: 0, responses: [], truncated: false };
    }

    if (query.nameBlocks.length === 0) {
      const responses = surnameCandidates.map((surname) =>
        this.evaluateName(
          {
            lastNameHangul: surname.korean,
            lastNameHanja: surname.hanja,
            firstNameHangul: "",
            firstNameHanja: "",
          },
          request.birth,
          true,
          request.gender,
        ),
      );
      return {
        query: request.query,
        totalCount: responses.length,
        responses,
        truncated: false,
      };
    }

    const nameLength = query.nameBlocks.length;
    const limit =
      typeof request.limit === "number" && Number.isFinite(request.limit) && request.limit > 0
        ? Math.trunc(request.limit)
        : undefined;
    const offset = Math.max(0, request.offset ?? 0);

    const collector: SearchResultCollector = limit !== undefined
      ? new LimitedCollector(limit, offset)
      : new UnlimitedCollector(offset);

    for (const surname of surnameCandidates) {
      this.evaluateSurnameCombinations(surname, query.nameBlocks, nameLength, request, collector);
    }

    return collector.toSearchResult(request.query);
  }

  private evaluateSurnameCombinations(
    surname: { korean: string; hanja: string },
    nameBlocks: ReturnType<typeof parseNameQuery>["nameBlocks"],
    nameLength: number,
    request: SearchRequest,
    collector: SearchResultCollector,
  ): void {
    const pairs = this.repository.getSurnamePairs(surname.korean, surname.hanja);
    const surnameStrokeCounts = pairs.map((pair) => this.getStrokeCount(pair.korean, pair.hanja, true));
    const validStrokeKeys = this.optimizer.getValidCombinations(surnameStrokeCounts, nameLength);
    const combinations = this.stats.findNameCombinations(nameBlocks, validStrokeKeys);

    for (const combination of combinations) {
      const strokeCounts = this.computeGivenStrokeCounts(combination);
      if (!validStrokeKeys.has(toStrokeKey(strokeCounts))) {
        continue;
      }

      const response = this.evaluateName(
        makeNameInput(surname, combination),
        request.birth,
        true,
        request.gender,
      );
      collector.collect(response);
    }
  }

  private computeGivenStrokeCounts(combination: { korean: string; hanja: string }): number[] {
    const koreanChars = Array.from(combination.korean);
    const hanjaChars = Array.from(combination.hanja);
    const strokeCounts: number[] = [];
    for (let i = 0; i < koreanChars.length; i += 1) {
      strokeCounts.push(this.getStrokeCount(koreanChars[i] ?? "", hanjaChars[i] ?? "", false));
    }
    return strokeCounts;
  }
}
