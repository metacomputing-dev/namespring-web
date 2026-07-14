export interface LuckIntervalRow {
  readonly startUtcMs?: unknown;
  readonly endUtcMs?: unknown;
}

export class LuckIntervalSelectionError extends RangeError {
  constructor(message: string) {
    super(message);
    this.name = 'LuckIntervalSelectionError';
  }
}

export function strictFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Selects the unique row covering an instant under a [start, end) contract.
 * Malformed rows never match, and overlapping matching rows fail closed.
 */
export function findLuckRowCoveringInstant<T extends LuckIntervalRow>(
  rows: readonly T[] | undefined,
  targetUtcMs: number,
): T | null {
  if (!Array.isArray(rows) || !Number.isFinite(targetUtcMs)) return null;
  let match: T | null = null;
  for (const row of rows) {
    if (row === null || typeof row !== 'object') continue;
    const start = strictFiniteNumber(row.startUtcMs);
    const end = strictFiniteNumber(row.endUtcMs);
    if (start === null || end === null || end <= start) continue;
    if (targetUtcMs < start || targetUtcMs >= end) continue;
    if (match) return null;
    match = row;
  }
  return match;
}

export function hasLuckIntervalMetadata<T extends LuckIntervalRow>(rows: readonly T[]): boolean {
  return rows.some((row) =>
    row !== null && typeof row === 'object' && (
      Object.prototype.hasOwnProperty.call(row, 'startUtcMs')
      || Object.prototype.hasOwnProperty.call(row, 'endUtcMs')
    ));
}

function assertCompleteLuckIntervals(rows: readonly unknown[]): void {
  for (const row of rows) {
    if (row === null || typeof row !== 'object') {
      throw new LuckIntervalSelectionError('luck interval rows must be objects');
    }
    const interval = row as LuckIntervalRow;
    const start = strictFiniteNumber(interval.startUtcMs);
    const end = strictFiniteNumber(interval.endUtcMs);
    if (start === null || end === null || end <= start) {
      throw new LuckIntervalSelectionError('luck interval rows must declare finite increasing bounds');
    }
  }
}

function selectUniqueCompleteInterval<T extends LuckIntervalRow>(
  rows: readonly T[],
  targetUtcMs: number,
): T | null {
  if (!Number.isFinite(targetUtcMs)) {
    throw new LuckIntervalSelectionError('luck interval target must be finite');
  }
  assertCompleteLuckIntervals(rows);
  let match: T | null = null;
  for (const row of rows) {
    const start = row.startUtcMs as number;
    const end = row.endUtcMs as number;
    if (targetUtcMs < start || targetUtcMs >= end) continue;
    if (match) {
      throw new LuckIntervalSelectionError('luck intervals overlap at the target instant');
    }
    match = row;
  }
  return match;
}

/**
 * Year-luck rows require explicit UTC intervals. A numeric year alone cannot
 * identify the active row around LiChun (or another configured year boundary),
 * so legacy year-only payloads fail closed instead of silently using the
 * host/calendar year.
 */
export function findYearLuckRowForInstant<T extends LuckIntervalRow & { readonly year?: unknown }>(
  rows: readonly T[] | undefined,
  targetUtcMs: number,
  _targetYear: number,
): T | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  if (hasLuckIntervalMetadata(rows)) {
    return selectUniqueCompleteInterval(rows, targetUtcMs);
  }
  throw new LuckIntervalSelectionError('year luck rows require explicit UTC interval bounds');
}

/**
 * Uses interval rows only when they declare a complete, unique [start,end)
 * match. Missing or valid non-covering collections may use a caller-owned
 * formula fallback; malformed or ambiguous intervals must throw instead.
 */
export function requireLuckRowCoveringInstant<T extends LuckIntervalRow>(
  rows: readonly T[] | undefined,
  targetUtcMs: number,
): T | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  if (!hasLuckIntervalMetadata(rows)) return null;
  return selectUniqueCompleteInterval(rows, targetUtcMs);
}
