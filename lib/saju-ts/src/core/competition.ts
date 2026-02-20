export interface CompetitionResult {
  methods: string[];
  power: number;
  minKeep: number;
  /** The (clamped) signals actually used for share computation. */
  signals: Record<string, number>;
  shares: Record<string, number>;
  multipliers: Record<string, number>;
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/**
 * Compute softmax-like shares and floor-multipliers for a set of competing methods.
 *
 * - signals are expected in [0,1] but we defensively clamp
 * - shares are computed from signal^power (winner-take-more when power>1)
 * - multipliers are computed as: minKeep + (1-minKeep)*share
 */
export function compete(methods: string[], signalsIn: Record<string, number>, opts: { power: number; minKeep: number }): CompetitionResult {
  const power = Math.max(0.01, typeof opts.power === 'number' && Number.isFinite(opts.power) ? opts.power : 2.0);
  const minKeep = clamp01(typeof opts.minKeep === 'number' && Number.isFinite(opts.minKeep) ? opts.minKeep : 0.2);

  const n = methods.length;
  const signals: Record<string, number> = {};
  const shares: Record<string, number> = {};
  const multipliers: Record<string, number> = {};
  if (n <= 0) return { methods: [...methods], power, minKeep, signals, shares, multipliers };

  const raw = methods.map((m) => {
    const s = clamp01(signalsIn[m] ?? 0);
    signals[m] = s;
    return Math.pow(s, power);
  });
  const sum = raw.reduce((a, b) => a + b, 0);

  if (sum > 1e-9) {
    for (let i = 0; i < n; i++) {
      const m = methods[i]!;
      const share = raw[i]! / sum;
      shares[m] = share;
      multipliers[m] = minKeep + (1 - minKeep) * share;
    }
  } else {
    const share = 1 / n;
    const mul = minKeep + (1 - minKeep) * share;
    for (const m of methods) {
      shares[m] = share;
      multipliers[m] = mul;
    }
  }

  return { methods: [...methods], power, minKeep, signals, shares, multipliers };
}

/**
 * Scale factor to preserve mass: scale = before/after.
 * Returned scale is always finite and positive.
 */
export function renormalizeScale(totalBefore: number, totalAfter: number): number {
  if (!(typeof totalBefore === 'number' && Number.isFinite(totalBefore) && totalBefore > 0)) return 1;
  if (!(typeof totalAfter === 'number' && Number.isFinite(totalAfter) && totalAfter > 1e-12)) return 1;
  return totalBefore / totalAfter;
}
