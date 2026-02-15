const FOUR_FRAME_MODULO = 81;
const MAX_STROKE_COUNT_PER_CHAR = 30;

function adjustTo81(value: number): number {
  if (value <= FOUR_FRAME_MODULO) return value;
  return ((value - 1) % FOUR_FRAME_MODULO) + 1;
}

function sum(values: readonly number[]): number {
  let out = 0;
  for (const v of values) out += v;
  return out;
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
