import { sum, adjustTo81 } from './scoring.js';

export class MinHeap<T> {
  private readonly d: T[] = [];
  constructor(private readonly cmp: (a: T, b: T) => number) {}

  size() { return this.d.length; }
  peek() { return this.d[0]; }

  push(item: T) {
    this.d.push(item);
    let i = this.d.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.cmp(this.d[i], this.d[p]) >= 0) break;
      [this.d[i], this.d[p]] = [this.d[p], this.d[i]];
      i = p;
    }
  }

  pop(): T | undefined {
    if (!this.d.length) return undefined;
    const top = this.d[0];
    const last = this.d.pop()!;
    if (this.d.length) { this.d[0] = last; this.sink(0); }
    return top;
  }

  replaceTop(item: T) {
    if (!this.d.length) { this.d.push(item); return; }
    this.d[0] = item;
    this.sink(0);
  }

  toArray() { return [...this.d]; }

  private sink(i: number) {
    const n = this.d.length;
    while (true) {
      let s = i;
      const l = 2 * i + 1, r = l + 1;
      if (l < n && this.cmp(this.d[l], this.d[s]) < 0) s = l;
      if (r < n && this.cmp(this.d[r], this.d[s]) < 0) s = r;
      if (s === i) break;
      [this.d[i], this.d[s]] = [this.d[s], this.d[i]];
      i = s;
    }
  }
}

export function pushTopK<T>(
  heap: MinHeap<T>, item: T, capacity: number, scoreAccessor: (item: T) => number,
): void {
  if (capacity <= 0) return;
  if (heap.size() < capacity) { heap.push(item); return; }
  const min = heap.peek();
  if (min && scoreAccessor(item) > scoreAccessor(min)) heap.replaceTop(item);
}

export interface FourFrameNumbers {
  won: number;
  hyeong: number;
  i: number;
  jeong: number;
}

export function calculateFourFrameNumbersFromStrokes(
  surnameStrokeCounts: readonly number[],
  givenStrokeCounts: readonly number[],
): FourFrameNumbers {
  const padded = [...givenStrokeCounts];
  if (padded.length === 1) padded.push(0);
  const mid = Math.floor(padded.length / 2);
  const guSum = sum(padded.slice(0, mid));
  const glSum = sum(padded.slice(mid));
  const sT = sum(surnameStrokeCounts);
  const gT = sum(givenStrokeCounts);
  return {
    won: adjustTo81(sum(padded)),
    hyeong: adjustTo81(sT + guSum),
    i: adjustTo81(sT + glSum),
    jeong: adjustTo81(sT + gT),
  };
}

export function toStrokeKey(values: readonly number[]) {
  return values.join(',');
}

export class FourFrameOptimizer {
  private readonly cache = new Map<string, Set<string>>();
  constructor(private readonly validNumbers: Set<number>) {}

  getValidCombinations(surnameStrokeCounts: number[], nameLength: number): Set<string> {
    const key = `${toStrokeKey(surnameStrokeCounts)}|${nameLength}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    if (nameLength < 1 || nameLength > 4) throw new Error(`unsupported name length: ${nameLength}`);

    const out = new Set<string>();
    const current = new Array<number>(nameLength).fill(1);

    const emit = () => {
      const r = calculateFourFrameNumbersFromStrokes(surnameStrokeCounts, current);
      if (!this.validNumbers.has(r.won) || !this.validNumbers.has(r.hyeong)) return;
      if (nameLength > 1 && !this.validNumbers.has(r.i)) return;
      if (!this.validNumbers.has(r.jeong)) return;
      out.add(toStrokeKey(current));
    };

    const dfs = (depth: number) => {
      if (depth >= nameLength) { emit(); return; }
      for (let v = 1; v <= 30; v++) { current[depth] = v; dfs(depth + 1); }
    };

    dfs(0);
    this.cache.set(key, out);
    return out;
  }
}
