import { sum, adjustTo81 } from './scoring.js';

export class FourFrameOptimizer {
  private readonly cache = new Map<string, Set<string>>();
  constructor(private readonly validNumbers: Set<number>) {}

  getValidCombinations(surnameStrokeCounts: number[], nameLength: number): Set<string> {
    const key = `${surnameStrokeCounts.join(',')}|${nameLength}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    if (nameLength < 1 || nameLength > 4) throw new Error(`unsupported name length: ${nameLength}`);

    const sT = sum(surnameStrokeCounts);
    const out = new Set<string>();
    const current = new Array<number>(nameLength).fill(1);

    const emit = () => {
      const padded = [...current];
      if (padded.length === 1) padded.push(0);
      const mid = Math.floor(padded.length / 2);
      const won = adjustTo81(sum(padded));
      const hyeong = adjustTo81(sT + sum(padded.slice(0, mid)));
      const i = adjustTo81(sT + sum(padded.slice(mid)));
      const jeong = adjustTo81(sT + sum(current));
      if (!this.validNumbers.has(won) || !this.validNumbers.has(hyeong)) return;
      if (nameLength > 1 && !this.validNumbers.has(i)) return;
      if (!this.validNumbers.has(jeong)) return;
      out.add(current.join(','));
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
