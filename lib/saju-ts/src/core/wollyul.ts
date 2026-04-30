import type { BranchIdx, StemIdx } from './cycle.js';
import {
  hiddenStemsOfBranch,
  type HiddenStem,
  type HiddenStemRole,
  type HiddenStemWeightPolicy,
} from './hiddenStems.js';
import { mod } from './mod.js';
import type { Qi } from './wollyulData.js';
import { WOLLYUL_SEGMENTS } from './wollyulData.js';

/**
 * Strategy used by `findSaryeong` to map an in-month day position to
 * a commanding hidden stem.
 *
 * - 'classical': walk the WOLLYUL_SEGMENTS by literal day counts. If
 *   the astronomical month length exceeds the nominal 30-day sum,
 *   the *last* segment is extended so a chart on day 31 still
 *   resolves to the 正氣 (proper-qi) stem. This mirrors the saju_master
 *   v9.2 'classical' policy.
 * - 'scaled': scale every segment by
 *   `monthLengthDays / nominalTotalDays` so the proportional position
 *   inside the actual astronomical month is preserved.
 */
export type SaryeongScheme = 'classical' | 'scaled';

export interface SaryeongResult {
  stem: StemIdx;
  qi: Qi;
  scheme: SaryeongScheme;
  segmentStartDays: number;
  segmentEndDays: number;
  /** Sum of nominal `days` for the branch (always 30 in the classical table). */
  nominalTotalDays: number;
  /** The astronomical month length the caller passed in (used by 'scaled'). */
  monthLengthDays: number;
}

/**
 * Resolve the commanding hidden stem (司令字) for a chart whose
 * moment sits at `elapsedDays` after the previous 節氣 boundary.
 *
 * Pure function: depends only on the (branch, elapsedDays,
 * monthLengthDays, scheme) tuple, returns the segment that contains
 * the elapsed-day pointer.
 *
 * Defensive against non-finite or out-of-range inputs: a negative
 * elapsed-days is clamped to zero, a non-positive month length falls
 * back to the nominal sum, and over-long elapsed values resolve to
 * the final segment.
 *
 * Not yet wired into the engine. The dispatch in
 * `hiddenStemsForChart` and the `month.saryeong` graph node land in
 * later commits.
 */
export function findSaryeong(
  branch: BranchIdx,
  elapsedDays: number,
  monthLengthDays: number,
  scheme: SaryeongScheme = 'classical',
): SaryeongResult {
  const b = mod(branch, 12);
  const segments = WOLLYUL_SEGMENTS[b];
  const nominal = segments.reduce((s, seg) => s + seg.days, 0);

  const safeMonth =
    Number.isFinite(monthLengthDays) && monthLengthDays > 0
      ? monthLengthDays
      : nominal;
  const safeElapsed =
    Number.isFinite(elapsedDays) && elapsedDays > 0 ? elapsedDays : 0;

  const scale = scheme === 'scaled' ? safeMonth / nominal : 1;

  let cursor = 0;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    let end = cursor + seg.days * scale;

    // classical: extend the last segment to cover the full astronomical month
    if (scheme === 'classical' && i === segments.length - 1 && safeMonth > end) {
      end = safeMonth;
    }

    if (safeElapsed < end || i === segments.length - 1) {
      return {
        stem: seg.stem,
        qi: seg.qi,
        scheme,
        segmentStartDays: cursor,
        segmentEndDays: end,
        nominalTotalDays: nominal,
        monthLengthDays: safeMonth,
      };
    }

    cursor = end;
  }

  // Defensive fallback (the loop above always returns when reaching the last segment)
  const lastIdx = segments.length - 1;
  const last = segments[lastIdx];
  return {
    stem: last.stem,
    qi: last.qi,
    scheme,
    segmentStartDays: Math.max(0, cursor - last.days * scale),
    segmentEndDays: cursor,
    nominalTotalDays: nominal,
    monthLengthDays: safeMonth,
  };
}

/**
 * Solar-month context that the dynamic saryeong schemes need.
 *
 * The graph layer is the natural place to assemble these (it already
 * has the previous and next 節氣 boundaries); pure consumers of this
 * module shouldn't have to know about VSOP87 or julian arithmetic.
 */
export interface JieData {
  /** Days elapsed since the previous 節氣 boundary at the chart instant. */
  elapsedDays: number;
  /** Astronomical length of the current 節氣 segment (≈ 29.5..30.5 days). */
  monthLengthDays: number;
}

/**
 * Saryeong-aware extension of `hiddenStemsOfBranch`.
 *
 * Sibling-pattern decision: `hiddenStemsOfBranch` stays a pure
 * branch→table lookup with no jie-data dependency. This function adds
 * the `JieData` parameter and the `saryeongScheme` policy field that
 * the dynamic schemes need.
 *
 * Behavior:
 *   - `policy.saryeongScheme` undefined → forwards verbatim to
 *     `hiddenStemsOfBranch(branch, policy)`. Default callers and the
 *     existing static schemes are unaffected.
 *   - 'classical' | 'scaled' → returns the WOLLYUL_SEGMENTS rows for
 *     the branch, with weight 1.0 on the commanding stem (chosen by
 *     `findSaryeong`) and 0.0 on the rest.
 *
 * Note: WOLLYUL_SEGMENTS and rawHiddenStemsTable disagree on the
 * residual-qi entries for branches where saju-ts collapses to a
 * single hidden stem (e.g. 子). The saryeong path therefore returns
 * the full WOLLYUL_SEGMENTS rows, not the simplified static table.
 */
function qiToRole(qi: Qi): HiddenStemRole {
  if (qi === 'JEONG') return 'MAIN';
  if (qi === 'JUNG') return 'MIDDLE';
  return 'RESIDUAL';
}

export function hiddenStemsForChart(
  branch: BranchIdx,
  jieData: JieData,
  policy: HiddenStemWeightPolicy & { saryeongScheme?: SaryeongScheme } = {},
): HiddenStem[] {
  const scheme = policy.saryeongScheme;
  if (!scheme) {
    return hiddenStemsOfBranch(branch, policy);
  }

  const b = mod(branch, 12);
  const segments = WOLLYUL_SEGMENTS[b];
  const commanding = findSaryeong(
    branch,
    jieData.elapsedDays,
    jieData.monthLengthDays,
    scheme,
  );

  return segments.map((seg) => ({
    stem: seg.stem,
    role: qiToRole(seg.qi),
    weight: seg.stem === commanding.stem ? 1.0 : 0.0,
  }));
}

// Re-export StemIdx for downstream typings without an extra import line.
export type { StemIdx };
