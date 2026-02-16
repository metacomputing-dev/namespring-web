import { Jiji } from '../../domain/Jiji.js';
import { JijiRelationHit } from '../../domain/Relations.js';

const ADJACENT_POSITION_GAP = 1;

function areAdjacentPositions(posA: number, posB: number): boolean {
  return Math.abs(posA - posB) === ADJACENT_POSITION_GAP;
}

function orderedBySetSize<T>(
  a: ReadonlySet<T>,
  b: ReadonlySet<T>,
): readonly [ReadonlySet<T>, ReadonlySet<T>] {
  return a.size <= b.size ? [a, b] : [b, a];
}

function setsOverlap<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  const [smaller, larger] = orderedBySetSize(a, b);
  for (const item of smaller) {
    if (larger.has(item)) return true;
  }
  return false;
}

function hasAdjacentPositions(
  positionsA: readonly number[] | undefined,
  positionsB: readonly number[] | undefined,
): boolean {
  if (!positionsA || !positionsB) return false;
  for (const pa of positionsA) {
    for (const pb of positionsB) {
      if (areAdjacentPositions(pa, pb)) return true;
    }
  }
  return false;
}

export function setIntersection<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): Set<T> {
  const [smaller, larger] = orderedBySetSize(a, b);
  return collectFromSet(smaller, (item) => larger.has(item));
}

export function setDifference<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): Set<T> {
  return collectFromSet(a, (item) => !b.has(item));
}

function collectFromSet<T>(source: ReadonlySet<T>, include: (item: T) => boolean): Set<T> {
  const result = new Set<T>();
  for (const item of source) {
    if (include(item)) result.add(item);
  }
  return result;
}

export function containsAll<T>(superset: ReadonlySet<T>, subset: ReadonlySet<T>): boolean {
  for (const item of subset) {
    if (!superset.has(item)) return false;
  }
  return true;
}

export function anyPairAdjacent(
  setA: ReadonlySet<Jiji>,
  setB: ReadonlySet<Jiji>,
  branchPositions: ReadonlyMap<Jiji, readonly number[]>,
): boolean {
  for (const a of setA) {
    const positionsA = branchPositions.get(a);
    for (const b of setB) {
      if (hasAdjacentPositions(positionsA, branchPositions.get(b))) return true;
    }
  }
  return false;
}

export function buildOverlapGraph(hits: readonly JijiRelationHit[]): number[][] {
  const n = hits.length;
  const graph: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (setsOverlap(hits[i]!.members, hits[j]!.members)) {
        graph[i]!.push(j);
        graph[j]!.push(i);
      }
    }
  }
  return graph;
}

