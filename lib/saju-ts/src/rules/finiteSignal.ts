import type { Expr } from './dsl.js';

/**
 * Return the first signal that is explicitly present as a finite number.
 *
 * Zero is a meaningful hard-veto value and must not be confused with an
 * unavailable signal. Non-numbers and non-finite numbers are treated as
 * unavailable so callers can continue to the documented fallback.
 */
export function firstFiniteSignal(...values: readonly unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return undefined;
}

/**
 * DSL equivalent of `firstFiniteSignal(primary, fallback)`.
 *
 * The fallback expression is evaluated only when the primary fact is absent
 * or non-finite; an explicit zero therefore remains authoritative.
 */
export function finiteSignalFallbackExpr(primaryPath: string, fallback: Expr): Expr {
  const primary: Expr = { var: primaryPath };
  return {
    op: 'if',
    args: [
      { op: 'isFiniteNumber', args: [primary] },
      primary,
      fallback,
    ],
  };
}
