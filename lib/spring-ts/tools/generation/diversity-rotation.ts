/**
 * diversity-rotation.ts -- Category-agnostic deterministic rotation for the
 * anti-repetition HINTS injected into bundle prompts.
 *
 * The MECHANISM here is common to every category; each category supplies its own
 * palettes (see academic-matrix.ts for the academic ones). A category that
 * supplies no palette gets no hints (spec.diversityHints stays undefined →
 * manifest bytes unchanged), so this is opt-in per category.
 *
 * Deterministic: a hint depends only on its axis tuple (period/band/index), never
 * on Math.random, so regenerating the manifest is idempotent.
 *
 * Why hints instead of prompt rules: the corpus's biggest quality drag is
 * template repetition (name-effect formula, 중화 descriptor, expert endings). A
 * prompt line "don't repeat X" both dilutes signal and makes the model fixate on
 * X. Handing each cell a DIFFERENT concrete frame spreads the phrasing at the
 * source, which the gate (prose-lint clusters) can then keep honest.
 */

/** Anti-repetition hints for one cell. All fields optional; empty → omitted so
 *  the manifest never carries blank strings. */
export interface DiversityHints {
  /** Name-effect sentence frame for this cell (boost cases). */
  readonly nameFrame?: string;
  /** Strength/balance plain-word form to use in this cell (gate-valid). */
  readonly balancePhrase?: string;
  /** Expert-paragraph ending noun to anchor this cell (spreads 종결어). */
  readonly expertEndingHint?: string;
}

/** Index of `value` in `order`, or 0 when absent (stable fallback). */
export function axisIndex(value: string, order: readonly string[]): number {
  const i = order.indexOf(value);
  return i < 0 ? 0 : i;
}

/** Even, deterministic pick from a palette by integer position (wraps). */
export function rotateEven(palette: readonly string[], index: number): string {
  if (palette.length === 0) return '';
  return palette[((index % palette.length) + palette.length) % palette.length];
}

/** Drop empty fields; return undefined when nothing is set so callers can spread
 *  it into a spec without emitting `"diversityHints":{}` for empty cases. */
export function compactHints(h: DiversityHints): DiversityHints | undefined {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) if (v) out[k] = v;
  return Object.keys(out).length ? (out as DiversityHints) : undefined;
}
