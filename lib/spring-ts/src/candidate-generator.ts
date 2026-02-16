/**
 * candidate-generator.ts -- Candidate name generation with four-frame optimization.
 *
 * Combines FourFrameOptimizer (exhaustive stroke-combination search) with
 * pool-building and DFS strategies to generate name candidates.
 *
 * Two strategies:
 *   1. Stroke-based (no jamo filter, ≤2 chars): uses FourFrameOptimizer
 *      to find valid stroke combinations, then picks hanja per stroke count.
 *   2. DFS (jamo filter present, or 3+ chars): builds per-position pools
 *      and explores all combinations via depth-first search.
 *
 * Ported from feature branch's search.ts + spring-engine.ts candidate logic.
 */

import type { HanjaRepository, HanjaEntry } from '../../seed-ts/src/database/hanja-repository.js';
import type { JamoFilter } from './utils.js';
import { makeFallbackEntry } from './utils.js';
import { adjustTo81 } from './scoring.js';
import type { NameCharInput } from './types.js';
import engineConfig from '../config/engine.json';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const MAX_STROKES_PER_CHARACTER = 30;
const MAX_CANDIDATES            = engineConfig.maxCandidates;
const POOL_LIMIT_SINGLE_CHAR    = engineConfig.candidatePoolLimits.singleCharPerStroke;
const POOL_LIMIT_DOUBLE_CHAR    = engineConfig.candidatePoolLimits.doubleCharPerPosition;
const POOL_LIMIT_JAMO_FILTERED  = engineConfig.candidatePoolLimits.jamoFilteredPerPosition;
const STROKE_MIN                = engineConfig.strokeRange.min;
const STROKE_MAX                = engineConfig.strokeRange.max;

// ---------------------------------------------------------------------------
// FourFrameOptimizer
// ---------------------------------------------------------------------------

function sum(arr: number[]): number {
  let total = 0;
  for (const v of arr) total += v;
  return total;
}

export class FourFrameOptimizer {
  private readonly cache = new Map<string, Set<string>>();
  constructor(private readonly validNumbers: Set<number>) {}

  getValidCombinations(surnameStrokeCounts: number[], nameLength: number): Set<string> {
    const cacheKey = `${surnameStrokeCounts.join(',')}|${nameLength}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    if (nameLength < 1 || nameLength > 4) {
      throw new Error(`unsupported name length: ${nameLength}`);
    }

    const surnameStrokeTotal = sum(surnameStrokeCounts);
    const validCombinations = new Set<string>();
    const currentStrokes = new Array<number>(nameLength).fill(1);

    const checkAndAddCombination = (): void => {
      const paddedStrokes = nameLength === 1
        ? [currentStrokes[0], 0]
        : currentStrokes;
      const midPoint = Math.floor(paddedStrokes.length / 2);

      const wonFrame   = adjustTo81(sum(paddedStrokes));
      const hyungFrame = adjustTo81(surnameStrokeTotal + sum(paddedStrokes.slice(0, midPoint)));
      const leeFrame   = adjustTo81(surnameStrokeTotal + sum(paddedStrokes.slice(midPoint)));
      const jungFrame  = adjustTo81(surnameStrokeTotal + sum(currentStrokes));

      if (!this.validNumbers.has(wonFrame))   return;
      if (!this.validNumbers.has(hyungFrame)) return;
      if (nameLength > 1 && !this.validNumbers.has(leeFrame)) return;
      if (!this.validNumbers.has(jungFrame))  return;

      validCombinations.add(currentStrokes.join(','));
    };

    const searchAllCombinations = (depth: number): void => {
      if (depth >= nameLength) {
        checkAndAddCombination();
        return;
      }
      for (let strokeCount = 1; strokeCount <= MAX_STROKES_PER_CHARACTER; strokeCount++) {
        currentStrokes[depth] = strokeCount;
        searchAllCombinations(depth + 1);
      }
    };

    searchAllCombinations(0);

    this.cache.set(cacheKey, validCombinations);
    return validCombinations;
  }
}

// ---------------------------------------------------------------------------
// Helper: convert HanjaEntry to NameCharInput
// ---------------------------------------------------------------------------

function toNameCharInput(entry: HanjaEntry): NameCharInput {
  return { hangul: entry.hangul, hanja: entry.hanja };
}

// ---------------------------------------------------------------------------
// Pool builders
// ---------------------------------------------------------------------------

export async function buildStrokeBasedPools(
  hanjaRepo: HanjaRepository,
  optimizer: FourFrameOptimizer,
  surnameEntries: HanjaEntry[],
  nameLength: number,
  targetElements: Set<string>,
  avoidElements: Set<string>,
): Promise<Map<number, HanjaEntry[]>> {
  const surnameStrokes = surnameEntries.map(entry => entry.strokes);
  const validCombinations = optimizer.getValidCombinations(surnameStrokes, nameLength);

  const neededStrokes = new Set<number>();
  for (const key of validCombinations) {
    for (const part of key.split(',')) {
      neededStrokes.add(Number(part));
    }
  }

  if (neededStrokes.size === 0) return new Map();

  const allHanja = await hanjaRepo.findByStrokeRange(
    Math.min(...neededStrokes),
    Math.max(...neededStrokes),
  );

  const pools = new Map<number, HanjaEntry[]>();

  for (const hanjaEntry of allHanja) {
    if (hanjaEntry.is_surname) continue;
    if (!neededStrokes.has(hanjaEntry.strokes)) continue;
    if (avoidElements.has(hanjaEntry.resource_element)) continue;

    let bucket = pools.get(hanjaEntry.strokes);
    if (!bucket) {
      bucket = [];
      pools.set(hanjaEntry.strokes, bucket);
    }
    bucket.push(hanjaEntry);
  }

  for (const [strokeCount, bucket] of pools) {
    pools.set(strokeCount, bucket.sort((a, b) =>
      (targetElements.has(b.resource_element) ? 1 : 0)
      - (targetElements.has(a.resource_element) ? 1 : 0),
    ));
  }

  return pools;
}

export async function buildJamoBasedPools(
  hanjaRepo: HanjaRepository,
  givenName: NameCharInput[] | undefined,
  nameLength: number,
  jamoFilters: (JamoFilter | null)[] | undefined,
  targetElements: Set<string>,
  avoidElements: Set<string>,
): Promise<Map<number, HanjaEntry[]>> {
  const fullPool = (await hanjaRepo.findByStrokeRange(STROKE_MIN, STROKE_MAX))
    .filter(entry => !entry.is_surname && !avoidElements.has(entry.resource_element));

  const pools = new Map<number, HanjaEntry[]>();

  for (let position = 0; position < nameLength; position++) {
    const jamoFilter    = jamoFilters?.[position];
    const givenNameChar = givenName?.[position];

    // Case A: no jamo filter and user supplied a character
    if (jamoFilter === null && givenNameChar) {
      pools.set(position, await resolveFixedCharPool(hanjaRepo, givenNameChar));
      continue;
    }

    // Case B: filter the full pool by jamo onset/nucleus
    let filtered = fullPool;
    if (jamoFilter?.onset)   filtered = filtered.filter(entry => entry.onset === jamoFilter.onset);
    if (jamoFilter?.nucleus) filtered = filtered.filter(entry => entry.nucleus === jamoFilter.nucleus);

    filtered = [...filtered].sort((a, b) =>
      (targetElements.has(b.resource_element) ? 1 : 0)
      - (targetElements.has(a.resource_element) ? 1 : 0),
    );

    pools.set(position, filtered.slice(0, POOL_LIMIT_JAMO_FILTERED));
  }

  return pools;
}

async function resolveFixedCharPool(
  hanjaRepo: HanjaRepository,
  givenNameChar: NameCharInput,
): Promise<HanjaEntry[]> {
  if (givenNameChar.hanja) {
    const entry = await hanjaRepo.findByHanja(givenNameChar.hanja);
    return entry ? [entry] : [makeFallbackEntry(givenNameChar.hangul)];
  }

  const entries = await hanjaRepo.findByHangul(givenNameChar.hangul);
  return entries.length
    ? entries.slice(0, POOL_LIMIT_SINGLE_CHAR)
    : [makeFallbackEntry(givenNameChar.hangul)];
}

// ---------------------------------------------------------------------------
// Generation strategies
// ---------------------------------------------------------------------------

export function generateViaStrokeOptimizer(
  optimizer: FourFrameOptimizer,
  surnameEntries: HanjaEntry[],
  pools: Map<number, HanjaEntry[]>,
  nameLength: number,
): NameCharInput[][] {
  const surnameStrokes = surnameEntries.map(entry => entry.strokes);
  const validStrokeCombinations = optimizer.getValidCombinations(surnameStrokes, nameLength);
  const results: NameCharInput[][] = [];

  for (const strokeKey of validStrokeCombinations) {
    if (results.length >= MAX_CANDIDATES) break;

    const strokeCounts = strokeKey.split(',').map(Number);

    if (nameLength === 1) {
      const candidates = (pools.get(strokeCounts[0]) ?? []).slice(0, POOL_LIMIT_SINGLE_CHAR);
      for (const candidate of candidates) {
        results.push([toNameCharInput(candidate)]);
        if (results.length >= MAX_CANDIDATES) break;
      }
    } else {
      const firstCandidates  = (pools.get(strokeCounts[0]) ?? []).slice(0, POOL_LIMIT_DOUBLE_CHAR);
      const secondCandidates = (pools.get(strokeCounts[1]) ?? []).slice(0, POOL_LIMIT_DOUBLE_CHAR);

      for (const firstChar of firstCandidates) {
        for (const secondChar of secondCandidates) {
          if (firstChar.hanja === secondChar.hanja) continue;
          results.push([toNameCharInput(firstChar), toNameCharInput(secondChar)]);
          if (results.length >= MAX_CANDIDATES) return results;
        }
        if (results.length >= MAX_CANDIDATES) return results;
      }
    }
  }

  return results;
}

export function generateViaDepthFirstSearch(
  pools: Map<number, HanjaEntry[]>,
  nameLength: number,
): NameCharInput[][] {
  const positionPools = Array.from(
    { length: nameLength },
    (_, position) => pools.get(position) ?? [],
  );
  const results: NameCharInput[][] = [];

  const explore = (depth: number, current: HanjaEntry[]): void => {
    if (results.length >= MAX_CANDIDATES) return;

    if (depth >= nameLength) {
      results.push(current.map(toNameCharInput));
      return;
    }

    for (const candidate of positionPools[depth]) {
      if (current.some(existing => existing.hanja === candidate.hanja)) continue;
      explore(depth + 1, [...current, candidate]);
    }
  };

  explore(0, []);
  return results;
}

// ---------------------------------------------------------------------------
// High-level candidate generation (combines pool building + strategy)
// ---------------------------------------------------------------------------

export interface CandidateGeneratorOptions {
  hanjaRepo: HanjaRepository;
  optimizer: FourFrameOptimizer;
  surnameEntries: HanjaEntry[];
  nameLength: number;
  targetElements: Set<string>;
  avoidElements: Set<string>;
  givenName?: NameCharInput[];
  jamoFilters?: (JamoFilter | null)[];
}

export async function generateCandidates(opts: CandidateGeneratorOptions): Promise<NameCharInput[][]> {
  const hasJamoFilter = opts.jamoFilters?.some(filter => filter !== null) ?? false;
  const useStrokeStrategy = !hasJamoFilter && opts.nameLength <= 2;

  if (useStrokeStrategy) {
    const pools = await buildStrokeBasedPools(
      opts.hanjaRepo, opts.optimizer, opts.surnameEntries,
      opts.nameLength, opts.targetElements, opts.avoidElements,
    );
    return generateViaStrokeOptimizer(opts.optimizer, opts.surnameEntries, pools, opts.nameLength);
  } else {
    const pools = await buildJamoBasedPools(
      opts.hanjaRepo, opts.givenName, opts.nameLength,
      opts.jamoFilters, opts.targetElements, opts.avoidElements,
    );
    return generateViaDepthFirstSearch(pools, opts.nameLength);
  }
}
