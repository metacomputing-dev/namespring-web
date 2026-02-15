import { FOUR_FRAME_MODULO, MAX_STROKE_COUNT_PER_CHAR } from './constants.js';

function adjustTo81(value: number): number {
  if (value <= FOUR_FRAME_MODULO) return value;
  return ((value - 1) % FOUR_FRAME_MODULO) + 1;
}

function sum(values: readonly number[]): number {
  let out = 0;
  for (const v of values) out += v;
  return out;
}

export class MinHeap<T> {
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

  push(item: T): void {
    this.data.push(item);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  replaceTop(item: T): void {
    if (this.data.length === 0) {
      this.data.push(item);
      return;
    }
    this.data[0] = item;
    this.sinkDown(0);
  }

  toArray(): T[] {
    return [...this.data];
  }

  private bubbleUp(idx: number): void {
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2);
      if (this.compare(this.data[idx], this.data[parent]) >= 0) break;
      [this.data[idx], this.data[parent]] = [this.data[parent], this.data[idx]];
      idx = parent;
    }
  }

  private sinkDown(idx: number): void {
    const length = this.data.length;
    while (true) {
      let smallest = idx;
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;
      if (left < length && this.compare(this.data[left], this.data[smallest]) < 0) {
        smallest = left;
      }
      if (right < length && this.compare(this.data[right], this.data[smallest]) < 0) {
        smallest = right;
      }
      if (smallest === idx) break;
      [this.data[idx], this.data[smallest]] = [this.data[smallest], this.data[idx]];
      idx = smallest;
    }
  }
}

export function pushTopK<T>(heap: MinHeap<T>, item: T, capacity: number, scoreAccessor: (item: T) => number): void {
  if (capacity <= 0) return;
  if (heap.size() < capacity) {
    heap.push(item);
    return;
  }
  const min = heap.peek();
  if (min && scoreAccessor(item) > scoreAccessor(min)) {
    heap.replaceTop(item);
  }
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
  const givenUpperSum = sum(padded.slice(0, mid));
  const givenLowerSum = sum(padded.slice(mid));
  const surnameTotal = sum(surnameStrokeCounts);
  const givenTotal = sum(givenStrokeCounts);

  return {
    won: adjustTo81(sum(padded)),
    hyeong: adjustTo81(surnameTotal + givenUpperSum),
    i: adjustTo81(surnameTotal + givenLowerSum),
    jeong: adjustTo81(surnameTotal + givenTotal),
  };
}

export function toStrokeKey(values: readonly number[]): string {
  return values.join(',');
}

export class FourFrameOptimizer {
  private readonly validNumbers: Set<number>;
  private readonly cache = new Map<string, Set<string>>();

  constructor(validNumbers: Set<number>) {
    this.validNumbers = validNumbers;
  }

  getValidCombinations(surnameStrokeCounts: number[], nameLength: number): Set<string> {
    const key = `${toStrokeKey(surnameStrokeCounts)}|${nameLength}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    if (nameLength < 1 || nameLength > 4) {
      throw new Error(`unsupported name length: ${nameLength}`);
    }
    const out = new Set<string>();
    const current = new Array<number>(nameLength).fill(1);

    const emit = () => {
      const result = calculateFourFrameNumbersFromStrokes(surnameStrokeCounts, current);
      if (!this.validNumbers.has(result.won)) return;
      if (!this.validNumbers.has(result.hyeong)) return;
      if (nameLength > 1 && !this.validNumbers.has(result.i)) return;
      if (!this.validNumbers.has(result.jeong)) return;
      out.add(toStrokeKey(current));
    };

    const dfs = (depth: number) => {
      if (depth >= nameLength) {
        emit();
        return;
      }
      for (let value = 1; value <= MAX_STROKE_COUNT_PER_CHAR; value++) {
        current[depth] = value;
        dfs(depth + 1);
      }
    };

    dfs(0);
    this.cache.set(key, out);
    return out;
  }
}
