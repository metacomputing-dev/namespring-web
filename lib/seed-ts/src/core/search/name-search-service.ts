import { parseNameQuery } from "../query.js";
import type {
  Element,
  Gender,
  HanjaRepository,
  NameInput,
  Polarity,
  SearchRequest,
  SearchResult,
  SeedResponse,
  StatsRepository,
} from "../types.js";
import {
  NameEvaluator,
  checkElementSangSaeng,
  checkFourFrameSuriElement,
  checkPolarityHarmony,
} from "../evaluator.js";
import { FourFrameOptimizer, toStrokeKey } from "./four-frame-optimizer.js";
import { MinHeap } from "./heap.js";
import { findSurnameCandidates, makeNameInput, toResolvedName } from "./surname-resolver.js";

interface RankedResponse {
  response: SeedResponse;
}

function isStrictPass(response: SeedResponse): boolean {
  const c = response.categoryMap;
  const surnameLen = Array.from(response.name.lastNameHangul).length;
  const givenLen = Array.from(response.name.firstNameHangul).length;
  const fourFrameElementArr = c.SAGYEOK_OHAENG.arrangement.split("-").filter(Boolean) as Element[];
  const pronunciationElementArr = c.BALEUM_OHAENG.arrangement.split("-").filter(Boolean) as Element[];
  const strokePolarityArr = c.HOEKSU_EUMYANG.arrangement.split("").filter(Boolean) as Polarity[];
  const pronunciationPolarityArr = c.BALEUM_EUMYANG.arrangement.split("").filter(Boolean) as Polarity[];

  return (
    c.SAGYEOK_SURI.isPassed &&
    checkFourFrameSuriElement(fourFrameElementArr, givenLen) &&
    checkPolarityHarmony(strokePolarityArr, surnameLen) &&
    checkElementSangSaeng(pronunciationElementArr, surnameLen) &&
    checkPolarityHarmony(pronunciationPolarityArr, surnameLen) &&
    c.SAJU_JAWON_BALANCE.isPassed
  );
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
      const topK = new MinHeap<RankedResponse>((a, b) => {
        return a.response.interpretation.score - b.response.interpretation.score;
      });
      let totalPassed = 0;

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
          if (!isStrictPass(response)) {
            continue;
          }

          const ranked: RankedResponse = { response: toPassedResponse(response) };
          totalPassed += 1;
          if (topK.size() < limit) {
            topK.push(ranked);
          } else {
            const min = topK.peek();
            if (min && ranked.response.interpretation.score > min.response.interpretation.score) {
              topK.replaceTop(ranked);
            }
          }
        }
      }

      const selectedRanked = topK
        .toArray()
        .sort((a, b) => b.response.interpretation.score - a.response.interpretation.score);
      const selected = selectedRanked.map((value) => value.response);
      const sliced = selected.slice(offset, offset + limit);
      return {
        query: request.query,
        totalCount: selected.length,
        responses: sliced,
        truncated: totalPassed > selected.length,
      };
    }

    const passedResponses: SeedResponse[] = [];

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
        if (!isStrictPass(response)) {
          continue;
        }

        passedResponses.push(toPassedResponse(response));
      }
    }

    passedResponses.sort((a, b) => b.interpretation.score - a.interpretation.score);
    const sliced = passedResponses.slice(offset);
    return {
      query: request.query,
      totalCount: passedResponses.length,
      responses: sliced,
      truncated: false,
    };
  }
}
