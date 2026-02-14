import { calculateFourFrameNumbersFromStrokes } from "../../calculator/frame-calculator.js";

export function toStrokeKey(values: readonly number[]): string {
  return values.join(",");
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
    if (cached) {
      return cached;
    }
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
      for (let value = 1; value <= 40; value += 1) {
        current[depth] = value;
        dfs(depth + 1);
      }
    };

    dfs(0);
    this.cache.set(key, out);
    return out;
  }
}
