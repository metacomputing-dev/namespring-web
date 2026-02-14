import { parseNameQuery } from "./query.js";
import type {
  HanjaRepository,
  NameCombination,
  NameInput,
  NameQuery,
  ResolvedName,
  SearchRequest,
  SearchResult,
  SeedResponse,
  StatsRepository,
} from "./types.js";
import {
  NameEvaluator,
  checkElementSangSaeng,
  checkFourFrameSuriElement,
  checkPolarityHarmony,
} from "./evaluator.js";
import { normalizeText } from "./utils.js";

interface SurnameCandidate {
  korean: string;
  hanja: string;
}

interface RankedResponse {
  response: SeedResponse;
}

class MinHeap<T> {
  private readonly data: T[] = [];
  private readonly compare: (a: T, b: T) => number;

  constructor(compare: (a: T, b: T) => number) {
    this.compare = compare;
  }

  size(): number {
    return this.data.length;
  }

  peek(): T | undefined {
    return this.data[0];
  }

  toArray(): T[] {
    return [...this.data];
  }

  push(value: T): void {
    this.data.push(value);
    this.heapifyUp(this.data.length - 1);
  }

  replaceTop(value: T): void {
    if (this.data.length === 0) {
      this.data.push(value);
      return;
    }
    this.data[0] = value;
    this.heapifyDown(0);
  }

  private heapifyUp(index: number): void {
    let i = index;
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (this.compare(this.data[i] as T, this.data[p] as T) >= 0) {
        break;
      }
      const t = this.data[i] as T;
      this.data[i] = this.data[p] as T;
      this.data[p] = t;
      i = p;
    }
  }

  private heapifyDown(index: number): void {
    let i = index;
    const n = this.data.length;
    while (true) {
      const l = i * 2 + 1;
      const r = i * 2 + 2;
      let s = i;
      if (l < n && this.compare(this.data[l] as T, this.data[s] as T) < 0) {
        s = l;
      }
      if (r < n && this.compare(this.data[r] as T, this.data[s] as T) < 0) {
        s = r;
      }
      if (s === i) {
        break;
      }
      const t = this.data[i] as T;
      this.data[i] = this.data[s] as T;
      this.data[s] = t;
      i = s;
    }
  }
}

function adjustTo81(value: number): number {
  if (value <= 81) {
    return value;
  }
  return ((value - 1) % 81) + 1;
}

function calculateFourFrameNumbers(surnameStrokeCounts: number[], givenStrokeCounts: number[]) {
  const padded = [...givenStrokeCounts];
  if (padded.length === 1) {
    padded.push(0);
  }
  const mid = Math.floor(padded.length / 2);
  const givenUpperSum = padded.slice(0, mid).reduce((a, b) => a + b, 0);
  const givenLowerSum = padded.slice(mid).reduce((a, b) => a + b, 0);
  const surnameTotal = surnameStrokeCounts.reduce((a, b) => a + b, 0);
  return {
    won: adjustTo81(padded.reduce((a, b) => a + b, 0)),
    hyeong: adjustTo81(surnameTotal + givenUpperSum),
    i: adjustTo81(surnameTotal + givenLowerSum),
    jeong: adjustTo81(surnameTotal + givenStrokeCounts.reduce((a, b) => a + b, 0)),
  };
}

function findSurnameCandidates(repository: HanjaRepository, query: NameQuery): SurnameCandidate[] {
  const blocks = query.surnameBlocks;
  if (blocks.length === 0) {
    return [];
  }
  if (blocks.length === 1) {
    const block = blocks[0];
    if (block && block.korean !== "_" && block.hanja !== "_" && repository.isSurname(block.korean, block.hanja)) {
      return [{ korean: block.korean, hanja: block.hanja }];
    }
    return [];
  }

  const first = blocks[0];
  const second = blocks[1];
  if (!first || !second) {
    return [];
  }
  const combinedK = first.korean + second.korean;
  const combinedH = first.hanja + second.hanja;
  if (first.korean.length === 1 && second.korean.length === 1 && repository.isSurname(combinedK, combinedH)) {
    return [{ korean: combinedK, hanja: combinedH }];
  }
  return [];
}

function listKey(values: readonly number[]): string {
  return values.join(",");
}

class FourFrameOptimizer {
  private readonly validNumbers: Set<number>;
  private readonly cache = new Map<string, Set<string>>();

  constructor(validNumbers: Set<number>) {
    this.validNumbers = validNumbers;
  }

  getValidCombinations(surnameStrokeCounts: number[], nameLength: number): Set<string> {
    const key = `${listKey(surnameStrokeCounts)}|${nameLength}`;
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }
    if (nameLength < 1 || nameLength > 4) {
      throw new Error(`unsupported name length: ${nameLength}`);
    }
    const out = new Set<string>();
    const current = new Array<number>(nameLength).fill(1);

    const emit = () => {
      const result = calculateFourFrameNumbers(surnameStrokeCounts, current);
      if (!this.validNumbers.has(result.won)) return;
      if (!this.validNumbers.has(result.hyeong)) return;
      if (nameLength > 1 && !this.validNumbers.has(result.i)) return;
      if (!this.validNumbers.has(result.jeong)) return;
      out.add(listKey(current));
    };

    const dfs = (depth: number) => {
      if (depth >= nameLength) {
        emit();
        return;
      }
      for (let v = 1; v <= 40; v += 1) {
        current[depth] = v;
        dfs(depth + 1);
      }
    };

    dfs(0);
    this.cache.set(key, out);
    return out;
  }
}

function toResolvedName(repository: HanjaRepository, name: NameInput): ResolvedName {
  const surnamePairs = repository.getSurnamePairs(name.lastNameHangul, name.lastNameHanja);
  const surname = surnamePairs.map((pair) => repository.getHanjaInfo(pair.korean, pair.hanja, true));
  const firstHangul = Array.from(name.firstNameHangul);
  const firstHanja = Array.from(name.firstNameHanja);
  const given = firstHangul.map((k, i) => repository.getHanjaInfo(k, firstHanja[i] ?? "", false));
  return { surname, given };
}

function makeNameInput(surname: SurnameCandidate, combination: NameCombination): NameInput {
  return {
    lastNameHangul: surname.korean,
    lastNameHanja: surname.hanja,
    firstNameHangul: combination.korean,
    firstNameHanja: combination.hanja,
  };
}

export class NameSearchService {
  private readonly repository: HanjaRepository;
  private readonly stats: StatsRepository;
  private readonly evaluator: NameEvaluator;
  private readonly optimizer: FourFrameOptimizer;

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
    return this.repository.getHanjaStrokeCount(korean, hanja, isSurname);
  }

  evaluateName(input: NameInput, birth?: SearchRequest["birth"], includeSaju?: boolean): SeedResponse {
    const resolved = toResolvedName(this.repository, input);
    return this.evaluator.evaluate(input, resolved, birth, includeSaju);
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
          request.includeSaju,
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
    const limit = Math.max(1, request.limit ?? 10000);
    const offset = Math.max(0, request.offset ?? 0);

    const topK = new MinHeap<RankedResponse>((a, b) => {
      return a.response.interpretation.score - b.response.interpretation.score;
    });
    let truncated = false;
    let totalPassed = 0;
    for (const surname of surnameCandidates) {
      const pairs = this.repository.getSurnamePairs(surname.korean, surname.hanja);
      const surnameStrokeCounts = pairs.map((pair) => this.getStrokeCount(pair.korean, pair.hanja, true));
      const valid = this.optimizer.getValidCombinations(surnameStrokeCounts, nameLength);
      const combinations = this.stats.findNameCombinations(query.nameBlocks, valid);

      for (const combination of combinations) {
        const strokeCounts: number[] = [];
        const kChars = Array.from(combination.korean);
        const hChars = Array.from(combination.hanja);
        for (let i = 0; i < kChars.length; i += 1) {
          strokeCounts.push(this.getStrokeCount(kChars[i] ?? "", hChars[i] ?? "", false));
        }
        if (!valid.has(listKey(strokeCounts))) {
          continue;
        }

        const response = this.evaluateName(makeNameInput(surname, combination), request.birth, request.includeSaju);
        const c = response.categoryMap;
        const surnameLen = Array.from(response.name.lastNameHangul).length;
        const givenLen = Array.from(response.name.firstNameHangul).length;
        const fourFrameElementArr = c.SAGYEOK_OHAENG.arrangement.split("-").filter(Boolean) as any;
        const pronunciationElementArr = c.BALEUM_OHAENG.arrangement.split("-").filter(Boolean) as any;
        const strokePolarityArr = c.HOEKSU_EUMYANG.arrangement.split("").filter(Boolean) as any;
        const pronunciationPolarityArr = c.BALEUM_EUMYANG.arrangement.split("").filter(Boolean) as any;

        const strictPass =
          c.SAGYEOK_SURI.isPassed &&
          checkFourFrameSuriElement(fourFrameElementArr, givenLen) &&
          checkPolarityHarmony(strokePolarityArr, surnameLen) &&
          checkElementSangSaeng(pronunciationElementArr, surnameLen) &&
          checkPolarityHarmony(pronunciationPolarityArr, surnameLen) &&
          c.SAJU_JAWON_BALANCE.isPassed;

        if (!strictPass) {
          continue;
        }
        const selected: SeedResponse = {
          ...response,
          interpretation: {
            ...response.interpretation,
            isPassed: true,
            status: "POSITIVE",
          },
        };
        const ranked: RankedResponse = { response: selected };

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
      truncated: truncated || totalPassed > selected.length,
    };
  }
}

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


