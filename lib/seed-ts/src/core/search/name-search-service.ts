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

interface RankedResponse {
  response: SeedResponse;
}

function isStrictPass(response: SeedResponse): boolean {
  const c = response.categoryMap;
  return response.interpretation.isPassed && c.SAJU_JAWON_BALANCE.isPassed;
}

function pushTopK(heap: MinHeap<RankedResponse>, item: RankedResponse, capacity: number): void {
  if (capacity <= 0) {
    return;
  }
  if (heap.size() < capacity) {
    heap.push(item);
    return;
  }
  const min = heap.peek();
  if (min && item.response.interpretation.score > min.response.interpretation.score) {
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

    if (limit !== undefined) {
      const selectionCapacity = Math.max(limit + offset, limit);
      const topK = new MinHeap<RankedResponse>((a, b) => {
        return a.response.interpretation.score - b.response.interpretation.score;
      });
      const fallbackTopK = new MinHeap<RankedResponse>((a, b) => {
        return a.response.interpretation.score - b.response.interpretation.score;
      });
      let totalPassed = 0;
      let totalEvaluated = 0;

      for (const surname of surnameCandidates) {
        const pairs = this.repository.getSurnamePairs(surname.korean, surname.hanja);
        const surnameStrokeCounts = pairs.map((pair) => this.getStrokeCount(pair.korean, pair.hanja, true));
        const validStrokeKeys = this.optimizer.getValidCombinations(surnameStrokeCounts, nameLength);
        const combinations = this.stats.findNameCombinations(query.nameBlocks, validStrokeKeys);

        for (const combination of combinations) {
          const strokeCounts: number[] = [];
          const koreanChars = Array.from(combination.korean);
          const hanjaChars = Array.from(combination.hanja);
          for (let i = 0; i < koreanChars.length; i += 1) {
            strokeCounts.push(this.getStrokeCount(koreanChars[i] ?? "", hanjaChars[i] ?? "", false));
          }
          if (!validStrokeKeys.has(toStrokeKey(strokeCounts))) {
            continue;
          }

          const response = this.evaluateName(
            makeNameInput(surname, combination),
            request.birth,
            true,
            request.gender,
          );
          totalEvaluated += 1;
          pushTopK(fallbackTopK, { response }, selectionCapacity);
          if (!isStrictPass(response)) {
            continue;
          }

          const ranked: RankedResponse = { response: toPassedResponse(response) };
          totalPassed += 1;
          pushTopK(topK, ranked, selectionCapacity);
        }
      }

      const selectedPassed = topK
        .toArray()
        .sort((a, b) => b.response.interpretation.score - a.response.interpretation.score);
      const hasPassed = selectedPassed.length > 0;
      const selectedRanked = hasPassed
        ? selectedPassed
        : fallbackTopK.toArray().sort((a, b) => b.response.interpretation.score - a.response.interpretation.score);
      const selected = selectedRanked.map((value) => value.response);
      const sliced = selected.slice(offset, offset + limit);
      return {
        query: request.query,
        totalCount: hasPassed ? selected.length : totalEvaluated,
        responses: sliced,
        truncated: hasPassed ? totalPassed > selected.length : totalEvaluated > selected.length,
      };
    }

    const passedResponses: SeedResponse[] = [];
    const fallbackTopK = new MinHeap<RankedResponse>((a, b) => {
      return a.response.interpretation.score - b.response.interpretation.score;
    });
    const fallbackCapacity = Math.max(500, offset + 200);

    for (const surname of surnameCandidates) {
      const pairs = this.repository.getSurnamePairs(surname.korean, surname.hanja);
      const surnameStrokeCounts = pairs.map((pair) => this.getStrokeCount(pair.korean, pair.hanja, true));
      const validStrokeKeys = this.optimizer.getValidCombinations(surnameStrokeCounts, nameLength);
      const combinations = this.stats.findNameCombinations(query.nameBlocks, validStrokeKeys);

      for (const combination of combinations) {
        const strokeCounts: number[] = [];
        const koreanChars = Array.from(combination.korean);
        const hanjaChars = Array.from(combination.hanja);
        for (let i = 0; i < koreanChars.length; i += 1) {
          strokeCounts.push(this.getStrokeCount(koreanChars[i] ?? "", hanjaChars[i] ?? "", false));
        }
        if (!validStrokeKeys.has(toStrokeKey(strokeCounts))) {
          continue;
        }

        const response = this.evaluateName(
          makeNameInput(surname, combination),
          request.birth,
          true,
          request.gender,
        );
        pushTopK(fallbackTopK, { response }, fallbackCapacity);
        if (!isStrictPass(response)) {
          continue;
        }

        passedResponses.push(toPassedResponse(response));
      }
    }

    passedResponses.sort((a, b) => b.interpretation.score - a.interpretation.score);
    if (passedResponses.length === 0) {
      const fallbackSelected = fallbackTopK
        .toArray()
        .sort((a, b) => b.response.interpretation.score - a.response.interpretation.score)
        .map((value) => value.response);
      return {
        query: request.query,
        totalCount: fallbackSelected.length,
        responses: fallbackSelected.slice(offset),
        truncated: true,
      };
    }

    const sliced = passedResponses.slice(offset);
    return {
      query: request.query,
      totalCount: passedResponses.length,
      responses: sliced,
      truncated: false,
    };
  }
}
